`timescale 1ns / 1ps
//////////////////////////////////////////////////////////////////////////////////
// Company: 
// Engineer: 
// 
// Create Date:    21:47:51 09/22/2016 
// Design Name: 
// Module Name:    HighLevel 
// Project Name: 
// Target Devices: 
// Tool versions: 
// Description: 
//
// Dependencies: 
//
// Revision: 
// Revision 0.01 - File Created
// Additional Comments: 
//
//////////////////////////////////////////////////////////////////////////////////
module HighLevel(
		//input CLOCK, //posedge:PC
		input CLOCK_P,
		input CLOCK_N,
		input RESET,
		//input[7:0]SW,
		//input ENABLED,
		//output[3:0]AN,
		//output[6:0]seg,
		output[7:0] LEDS,
		output[6:0] LCD
    );
	 
	wire CLK;
	wire[7:0] SW;
	wire ENABLED = 1'B1;
	wire[3:0] AN;
	wire[6:0] seg;
	
	wire CLOCK;
	
    clk_wiz_0 MASTER_CLOCK
    (
   // Clock in ports
    .clk_in1_p(CLOCK_P),
    .clk_in1_n(CLOCK_N),
    // Clock out ports  
    .clk_out1(CLOCK),
    // Status and control signals               
    .reset(RESET), 
    .locked()            
    );
	
//	assign CLK = CLOCK;
	ClockDivider PRIMARYCLOCK(
		.clkin(CLOCK),
		.divBy(26'd10_000_00),
		.clkout(CLK)
   );
	//assign LED = CLK;
	wire[15:0] PC_VALUE;
	wire[15:0] REG_ADDRESS;
	
	wire DO_JUMP;
	PC PC (
		.CLK(CLK),
		.EN(ENABLED),
		.ADDRESS(REG_ADDRESS),
		.LOAD(DO_JUMP),
		.Q(PC_VALUE)
	);
	
	wire[7:0] INSTRUCTION;
	InstructionMemory INSTR_MEM(
		.ADDRESS(PC_VALUE),
		.EN(ENABLED),
		.IO(INSTRUCTION)
   );
	 
	wire[15:0] OPCODE;
	wire[3:0] IMM;
	wire LOADACC;
	wire SETFLAGS;
	wire REG;
	wire MEM;
	
	ControlLogic ControlLogic(
		.instruction(INSTRUCTION),
		.EN(ENABLED),
		.OP(OPCODE),
		.LoadAcc(LOADACC),
		.SetFlags(SETFLAGS),
		.REG(REG),
		.MEM(MEM),
		.IMM(IMM)
    );
	 
	 
	 wire[7:0] FLAGS;
	 JumpLogic JumpLogic(
		.FLAGS(FLAGS),
		.JMP(OPCODE[11]),
		.IMM(IMM),
		.DOJUMP(DO_JUMP)
    );
	 
	wire[7:0] REGOUT;
	wire[7:0] RESULT;
	wire[7:0] ACCVALUE;
	
	ALU ALU (
		.CLK(CLK),
		.ADD(OPCODE[5]),
		.SUB(OPCODE[6]),
		.SHIFT(OPCODE[8]),
		.OR(OPCODE[10]),
		.AND(OPCODE[9]),
		.SetFlags(SETFLAGS),
		
		.ACC(ACCVALUE),
		.REG(REGOUT),
		
		.RESULT(RESULT),
		.FLAGS(FLAGS)
	);
	
	wire[7:0] MEM_IO;
	Registers REGISTERS(
		.IMM(IMM),
		.LOADACC(LOADACC),
		.ANS(RESULT),
		.CLK(CLK),
		.MEMIO(MEM_IO),
		.MOV(OPCODE[3]),
		.TOACC(OPCODE[4]),
		.LLI(OPCODE[1]),
		.LUI(OPCODE[2]),
		.STORE(OPCODE[12]),
		.LOADREG(REG),
		.OUT(REGOUT),
		.ACC(ACCVALUE),
		.ADDRESS(REG_ADDRESS)
    );
	 
	 wire[7:0] OUTPUT_0;
	 wire[7:0] OUTPUT_1;
	 
	ProgramMemory PROGRAM_MEMORY (
        .CLK(CLK), 
        .STORE(OPCODE[12]), 
        .LOAD(OPCODE[13]), 
        .IO(MEM_IO), 
        .ADDRESS(REG_ADDRESS), 
        .INPUT_0(SW),
        .OUTPUT_0(OUTPUT_0),
        .OUTPUT_1(OUTPUT_1),
        .OUTPUT_2()
    );
	
	
	wire[3:0] DIGIT_0;
	wire[3:0] DIGIT_1;
	wire[3:0] DIGIT_2;
	
	assign LEDS = OUTPUT_0;
	assign LCD = OUTPUT_1[6:0];
	
	Binary_BCD BCD(
		.binary(OUTPUT_0),
		.hundreds(DIGIT_2),
		.tens(DIGIT_1),
		.ones(DIGIT_0)
   );
	
	DoubleSevenSegment DISPLAY(
		.CLK(CLOCK),
		.SW({4'b0000, DIGIT_2, DIGIT_1, DIGIT_0}),
		.AN(AN),
		.seg(seg)
   );
endmodule
