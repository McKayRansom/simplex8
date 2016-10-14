`timescale 1ns / 1ps

////////////////////////////////////////////////////////////////////////////////
// Company: 
// Engineer:
//
// Create Date:   13:32:22 09/23/2016
// Design Name:   Registers
// Module Name:   E:/MISC Computer/MISCMicroprocessor/RegisterTest.v
// Project Name:  MISCMicroprocessor
// Target Device:  
// Tool versions:  
// Description: 
//
// Verilog Test Fixture created by ISE for module: Registers
//
// Dependencies:
// 
// Revision:
// Revision 0.01 - File Created
// Additional Comments:
// 
////////////////////////////////////////////////////////////////////////////////

module RegisterTest;

	// Inputs
	reg [3:0] IMM;
	reg LOADACC;
	reg [7:0] ANS;
	reg CLK;
	wire [7:0] MEMIO;
	reg MOV;
	reg TOACC;
	reg LLI;
	reg LUI;
	reg STORE;
	reg LOADREG;

	// Outputs
	wire [7:0] OUT;
	wire [7:0] ACC;
	wire [15:0] ADDRESS;

	// Instantiate the Unit Under Test (UUT)
	Registers uut (
		.IMM(IMM), 
		.LOADACC(LOADACC), 
		.ANS(ANS), 
		.CLK(CLK), 
		.MEMIO(MEMIO), 
		.MOV(MOV), 
		.TOACC(TOACC), 
		.LLI(LLI), 
		.LUI(LUI), 
		.STORE(STORE), 
		.LOADREG(LOADREG), 
		.OUT(OUT), 
		.ACC(ACC), 
		.ADDRESS(ADDRESS)
	);

	initial begin
		// Initialize Inputs
		IMM = 0;
		LOADACC = 0;
		ANS = 0;
		CLK = 0;
		//MEMIO = 0;
		MOV = 0;
		TOACC = 0;
		LLI = 0;
		LUI = 0;
		STORE = 0;
		LOADREG = 0;

		// Wait 100 ns for global reset to finish
		#100;
        
		// Add stimulus here
		LLI = 1; LOADACC = 1; IMM = 4'b1111;
		#10 CLK = ~CLK; #10 CLK = ~CLK;
		
		#20
		MOV = 1; LOADACC = 0; LOADREG = 1; IMM = 4'b0010;LLI = 0;
		#10 CLK = ~CLK; #10 CLK = ~CLK;
		

	end
      
endmodule

