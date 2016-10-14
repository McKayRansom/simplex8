`timescale 1ns / 1ps
//////////////////////////////////////////////////////////////////////////////////
// Company: 
// Engineer: 
// 
// Create Date:    21:11:00 09/22/2016 
// Design Name: 
// Module Name:    ControlLogic 
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
module ControlLogic(
		input[7:0] instruction,
		input EN,
		output[15:0] OP,
		output LoadAcc,
		output SetFlags,
		output REG,
		output MEM,
		output [3:0] IMM
    );
	wire[15:0] rv; //reversed OP
	//esential decoding
	decoder4_16 instructionDecoder (
		.d(instruction[7:4]),
		.o(rv),//reversed OP
		.en(EN)
	);
	
	//assign OP = {rv[15], rv[14], rv[13], rv[12], rv[11],rv[10],rv[9],rv[8],rv[7],rv[6],rv[5],rv[4],rv[3],rv[2],rv[1],rv[0]};
	assign OP = {rv[0],rv[1], rv[2], rv[3], rv[4], rv[5],rv[6],rv[7],rv[8],rv[9],rv[10],rv[11],rv[12],rv[13],rv[14],rv[15]};
	
	assign IMM = instruction[3:0];
	
	assign LoadAcc = (OP[1] | OP[2] | OP[4] | OP[5] | OP[6] | OP[8] | OP[9] | OP[10]);
	assign SetFlags = (OP[5] | OP[6] | OP[7] | OP[8] | OP[9] | OP[10] | OP[15]);
	assign REG = OP[3] | OP[13];
	assign MEM = OP[13] | OP[12];
	
endmodule
