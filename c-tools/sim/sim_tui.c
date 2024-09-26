
#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include <string.h>
#include <stdbool.h>
#include <ctype.h>

#include "sim_run.h"

#define TB_IMPL
#include "termbox2.h"

const char *opcodes[] = {
    "NOP",
	"LI",
	"UI",
	"MOV",
	"ACC",
	"ADD",
	"SUB",
	"UNUSED",
	"LSR",
	"AND",
	"OR",
	"JMP",
	"STR",
    "LDR",
};

void display_instmem(int x, int y)
{
    uint8_t *instructions = sim_getInstMem();
    uint16_t pc = sim_getPc();
    uint16_t start = (pc < 5) ? 0 : pc - 5;
    uint16_t end = (start + 10) < 10 ? 0xFFFF : start + 10;
    for (uint8_t i = start; i < end; i++)
        tb_printf(x, y + (i - start), i == pc ? TB_GREEN : 0, 0, "|0x%.4x %4s %2d |", i, opcodes[instructions[i] >> 4], instructions[i] & 0xF);
}

void display_regs(int x, int y)
{
    uint8_t *regs = sim_getRegs();
    static uint8_t regsLast[16];
    for (uint8_t i = 0; i < 16; i++)
    {
        tb_printf(x, y + i, regs[i] != regsLast[i] ? TB_GREEN : 0, 0, "$%x: %.2x", i, regs[i]);
        regsLast[i] = regs[i];
    }

    static uint8_t flagsLast;
    uint8_t flags = sim_getFlags();
    tb_printf(x, y + 16, flags != flagsLast ? TB_GREEN : 0, 0, "fl: %.2x", flags);

}

/*
0 - Select Dot matrix Columns (0000_0001 is leftmost column 1, 1000_0000 is rightmost column 8) (left to right)
1 - Select Dot matrix Rows (0000_0001 is bottom row one 1000_0000 is top row 8) (bottom to top)
2 - Select Dot matrix Color (ACTIVE LOW) (XXXX_X110 = red, XXXX_X101 = green, XXXX_X011 = blue)
*/

static uint16_t ledDisplay[8][8];

// get color as rrrrggggbbbb
uintattr_t getColor(uint16_t rgb)
{
    uint8_t red = rgb >> 8;
    uint8_t green = rgb >> 4;
    uint8_t blue = rgb & 0xF;

    if (red > green && red > blue)
        return TB_RED;
    if (green > red && green > blue)
        return TB_GREEN;
    if (blue > red && blue > green)
        return TB_BLUE;
    return TB_WHITE;
}

void setColor(uint8_t columns, uint8_t rows, uint8_t color)
{
    uint16_t value = 0;
    if (~color & 1) // RED
        value = 0xF00;
    else if (~color & 2) // GREEN
        value = 0x0F0;
    else if (~color & 4) // BLUE
        value = 0x00F;

    for (uint8_t i = 0; i < 8; i++)
        for (uint8_t j = 0; j < 8; j++)
            if (rows & (1 << i) && columns & (1 << j))
                ledDisplay[i][j] = value;
}

void display_dotMatrix(int x, int y)
{
    tb_printf(x, y++, 0, 0, "*--------*");
    for (uint8_t i = 0; i < 8; i ++)
    {
        tb_print(x, y + i, 0, 0, "|");
        for (uint8_t j = 0; j < 8; j++)
            tb_print(x + 1 + j, y + i, 0, getColor(ledDisplay[i][j]), " ");

        tb_print(x + 9, y + i, 0, 0, "|");
    }

    tb_print(x, y + 8, 0, 0, "*--------*");

}

void display()
{
    display_instmem(0, 1);
    display_regs(18, 1);
    display_dotMatrix(29, 1);
}

void sim_tui()
{
    struct tb_event ev;

    tb_init();

    tb_printf(0, 0, TB_GREEN, 0, "SIMPLEX 8 SIMULATOR");
    // tb_printf()
    display();
    // tb_printf(0, y++, 0, 0, "width=%d height=%d", tb_width(), tb_height());
    // tb_printf(0, y++, 0, 0, "press any key...");
    tb_present();

    // tb_poll_event(&ev);

    // y++;
    // tb_printf(0, y++, 0, 0, "event type=%d key=%d ch=%c", ev.type, ev.key, ev.ch);
    // tb_printf(0, y++, 0, 0, "press any key to quit...");


    bool run = false;
    int tick_ms = 100;
    while(1)
    {
        if (run)
            tb_peek_event(&ev, tick_ms);
        else
            tb_poll_event(&ev);

        if ((ev.type == 0) && run)
        {
            sim_step();
            display();
        }

        if (ev.ch == 's')
        {
            sim_step();
            display();
        }
        else if (ev.ch == 'r')
        {
            sim_step();
            display();
            run = true;
        }
        else if (ev.key == TB_KEY_ESC)
        {
            tb_shutdown();
            exit(0);
        }


        tb_present();
    }
}
