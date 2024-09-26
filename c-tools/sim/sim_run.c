
#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>
#include <ctype.h>


typedef enum opcodes_t {
	OP_NOP = 0,
	OP_LI = 1,
	OP_UI = 2,
	OP_MOV = 3,
	OP_ACC = 4,
	OP_ADD = 5,
	OP_SUB = 6,
	OP_UNUSED = 7,
	OP_SHIFT = 8,
	OP_AND = 9,
	OP_OR = 10,
	OP_JMP = 11,
	OP_STORE = 12,
	OP_LOAD = 13,
	OP_EXP = 14,
	OP_EXP_1 = 15,
} opcodes_t;

typedef enum conditions_t {
	JMP_ALWAYS = 0b0,
	JMP_EQUAL = 0b1,
	JMP_LT = 0b10,
	JMP_GT = 0b100,
	JMP_OVERFLOW = 0b1000,
	JMP_INPUT = 0b10000,
	JMP_ANY = 0b100000,
	JMP_SHIFTOVER = 0b1000000,
	JMP_NOT = 0b10000000,
} conditions_t;

uint8_t *instMem;
uint16_t instMemLen;

uint16_t pc;

uint8_t regs[16];
#define ACC regs[0]

uint8_t flags;

uint8_t progMem[0xFFFF];

void compare(uint8_t a, uint8_t b)
{
	flags = 0;
	if (a < b)
		flags |= JMP_LT;
	else if (a == b)
		flags |= JMP_EQUAL;
	else
		flags |= JMP_GT;

	if (ACC)
		flags |= JMP_ANY;
}

void sim_init(uint8_t *instructions, uint16_t instCount)
{
	instMem = instructions;
	instMemLen = instCount;

	pc = 0;
	for (uint8_t i = 0; i < sizeof(regs); i++)
		regs[i] = 0;
}


void setColor(uint8_t columns, uint8_t rows, uint8_t color);

void sim_step()
{
	uint8_t inst = instMem[pc++];
	opcodes_t op = inst >> 4;
	uint8_t arg = inst & 0xF;

	switch (op)
	{
	case OP_NOP:
		break;
	case OP_LI:
		ACC = (ACC & 0xF0) | arg;
		break;
	case OP_UI:
		ACC = (ACC & 0xF) | arg << 4;
		break;
	case OP_MOV:
		regs[arg] = ACC;
		break;
	case OP_ACC:
		ACC = regs[arg];
		break;
	case OP_ADD:
	{
		uint16_t sum = (uint16_t)ACC + (uint16_t)regs[arg];
		compare(ACC, regs[arg]);
		if (sum > 0xFF)
			flags |= JMP_OVERFLOW;
		ACC = sum;
		break;
	}
	case OP_SUB:
		compare(ACC, regs[arg]);
		ACC -= regs[arg];
		break;
	case OP_UNUSED:
		break;
	case OP_SHIFT:
		compare(ACC, regs[arg]);
		if (ACC & 1)
			flags |= JMP_SHIFTOVER;
		ACC = ACC >> 1;
		break;
	case OP_AND:
		compare(ACC, regs[arg]);
		ACC &= regs[arg];
		break;
	case OP_OR:
		compare(ACC, regs[arg]);
		ACC |= regs[arg];
		break;
	case OP_JMP:
	{
		uint8_t jmp = (arg & JMP_NOT) ? ((arg & ~JMP_NOT) & flags) == arg : (arg & flags) == arg;
		if (jmp)
			pc = (uint16_t)ACC | ((uint16_t)regs[1] << 8);
		break;
	}
	case OP_STORE:
	{
		static uint8_t ledColumn;
		static uint8_t ledRow;
		static uint8_t ledColor;
		uint16_t addr = ACC | regs[1] << 8;
		// printf("STR: 0x%x <- %x\n", addr, regs[arg]);
		if (addr < 0x8000)
			progMem[addr] = regs[arg];
		else 
		{
			if (addr == 0x8000)
				ledColumn = regs[arg]; // COLUMN
			else if (addr == 0x8001)
				ledRow = regs[arg]; // ROW
			else if (addr == 0x8002)
				ledColor = regs[arg];// COLOR

			if (ledColumn && ledRow && ledColor)
			{
				setColor(ledColumn, ledRow, ledColor);
				ledColumn = 0;
				ledRow = 0;
				ledColor = 0;
			}
		}

		break;
	}
	case OP_LOAD:
		break;
	case OP_EXP:
		break;
	case OP_EXP_1:
		break;
	}
}

void sim_run()
{
	while (pc < instMemLen)
		sim_step();
}

void sim_printRegs()
{
	for (uint8_t i = 0; i < sizeof(regs);i++)
		printf("$%d: 0x%.2x\n", i, regs[i]);
}

uint8_t *sim_getInstMem()
{
	return instMem;
}

uint8_t *sim_getProgMem()
{
	return progMem;
}

uint16_t sim_getPc()
{
	return pc;
}
uint8_t *sim_getRegs()
{
	return regs;
}
uint8_t sim_getFlags()
{
	return flags;
}
