`timescale 1ns / 1ps
//////////////////////////////////////////////////////////////////////////////////
// Company: 
// Engineer: 
// 
// Create Date:    21:51:41 09/22/2016 
// Design Name: 
// Module Name:    ALUTest 
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
module ALUTest(
		input CLK,
		input[7:0]SW,
		output[3:0]AN,
		output[6:0]seg
    );
	 
	wire[7:0] ANSWER;
	
	ALU testALU (
		.CLK(),
	
		.ADD(1'b1),
		.SUB(1'b0),
		.SHIFT(1'b0),
		.OR(1'b0),
		.AND(1'b0),
		.SetFlags(1'b1),
		
		.ACC({4'b0000, SW[3:0]}),
		.REG({4'b0000, SW[7:4]}),
		
		.RESULT(ANSWER),
		.FLAGS()
	);
	
	wire[3:0] LOWER;
	wire[3:0] UPPER;
	
	Binary_BCD BCD(
		.binary(ANSWER),
		.hundreds(),
		.tens(UPPER),
		.ones(LOWER)
   );
	
	DoubleSevenSegment DISPLAY(
		.CLK(CLK),
		.SW({UPPER, LOWER}),
		.AN(AN),
		.seg(seg)
   );
	

endmodule
