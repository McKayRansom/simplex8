
#include <stdio.h>
#include <stdint.h>
#include <stdlib.h>
#include <ctype.h>

#include "sim_run.h"



const char *fileName;
uint8_t instructions[1024];
size_t instructionCount;


void readInstructions(FILE *fp)
{
	instructionCount = fread(instructions, 1, sizeof(instructions), fp);
}

void error(char *string)
{
    printf("ERROR: %s\n", string);
    exit(1);
}

void sim_tui();

int main(int argc, char** argv)
{
	if (argc == 1)
		error("Requires input file\n");
	
	fileName = argv[1];

	FILE *fp = fopen(fileName, "r");
	readInstructions(fp);
	fclose(fp);

    sim_init(instructions, instructionCount);

	if (argv[2] && argv[2][0] == 't')
	{
		sim_tui();
	}
	else if (argv[2] && isdigit(argv[2][0]))
	{
		for (uint8_t i = 0; i < atoi(argv[2]);i++)
			sim_step();

        sim_printRegs();
	}
	else
		sim_run();

    if (argv[2] && argv[2][0] == 'r')
        sim_printRegs();
	
	return EXIT_SUCCESS;
}
