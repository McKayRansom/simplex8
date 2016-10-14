`timescale 1ns / 1ps
//////////////////////////////////////////////////////////////////////////////////
// Company: 
// Engineer: 
// 
// Create Date:    21:31:41 09/22/2016 
// Design Name: 
// Module Name:    Registers 
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
module Registers(
		input[3:0] IMM,
		input LOADACC,
		input[7:0] ANS,
		input CLK,
		output[7:0] MEMIO,
		input MOV,
		input TOACC, //the instruction
		input LLI,
		input LUI,
		input STORE,
		input LOADREG,
		output[7:0] OUT,
		output[7:0] ACC,
		output[15:0] ADDRESS
    );
	 
	reg[7:0] REGISTERS[0:15];
	
	assign ACC = REGISTERS[0];
	assign ADDRESS = {REGISTERS[1], REGISTERS[0]};
	//assign MEMIO = REGISTERS[4];
	 
	wire[7:0] ACCIN;
	wire[7:0] ACCIN_1;
	wire[7:0] ACCIN_2;	

	wire[7:0] REGIN;
	wire[7:0] REGIN_1;
	wire[7:0] REGIN_2;
	wire[7:0] REGOUT;
	
	assign REGOUT = REGISTERS[IMM];
	assign MEMIO = REGOUT;
	assign OUT = REGOUT;
	
	initial begin: reset
		//zero all registers
		integer i;
		for (i=0; i<16; i = i+1) begin
			REGISTERS[i] = 8'd0;
		end
//		REGISTERS[3] = 233;
//		REGISTERS[2] = 144;
	end
	 
//	always @(LLI or LUI) begin
//		if (LLI)
//			ACCIN <= {ACC[7:4], IMM};
//		else if (LUI)
//			ACCIN <= {IMM, ACC[3:0]};
//		else if(LOADACC & !TOACC) //an alu instruction
//			ACCIN <= ANS;
//		
//	end
//	
//	always @(MOV or STORE) begin
//		if(MOV)
//			REGIN <= ACC;
//		if(STORE)
//			REGIN <= REGOUT;
//	end
//	
//	always @(TOACC) begin
//		if (TOACC)
//			ACCIN <= REGOUT;
//	end
	
	//SELECT LLI
	mux_array #(.SIZE(8)) ACC_INPUT_SELECT (
		.sel(LLI),
		.a(ACCIN_1),
		.b({ACC[7:4], IMM}),
		.o(ACCIN)
	);
	
	//SELECT LUI
	mux_array #(.SIZE(8)) ACC_INPUT_SELECT1 (
		.sel(LUI),
		.a(ACCIN_2),
		.b({IMM, ACC[3:0]}),
		.o(ACCIN_1)
	);
	
	//SELECT TOACC
	mux_array #(.SIZE(8)) ACC_INPUT_SELECT2 (
		.sel(TOACC),
		.a(ANS),
		.b(REGOUT),
		.o(ACCIN_2)
	);
	
	//SELECT MOV
	mux_array #(.SIZE(8)) REG_INPUT_SELECT (
		.sel(MOV),
		.a(REGIN_1),
		.b(ACC),
		.o(REGIN)
	);
	
	//SELECT STORE
	mux_array #(.SIZE(8)) REG_INPUT_SELECT1(
		.sel(STORE),
		.a(REGOUT),
		.b(MEMIO),
		.o(REGIN_1)
	);
	
//	//SELECT LOAD
//	MUXarray #(.SIZE(8)) ACC_INPUT_SELECT (
//		.sel(LOAD),
//		.a(ACC),
//		.b(REGOUT),
//		.o(REGIN_2)
//	);

	
	 
	always @(posedge CLK) begin
		if (LOADACC)
			REGISTERS[0] <= ACCIN;
		if (LOADREG)
			REGISTERS[IMM] <= REGIN;		
	end


endmodule
