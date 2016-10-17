`timescale 1ns / 1ps
//////////////////////////////////////////////////////////////////////////////////
// Company: 
// Engineer: 
// 
// Create Date:    21:39:42 09/22/2016 
// Design Name: 
// Module Name:    JumpLogic 
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
module JumpLogic(
		input[7:0] FLAGS,
		input JMP,
		input[3:0] IMM,
		output DOJUMP
    );
	 wire JUMP_CONDITION;
	 assign DOJUMP = JUMP_CONDITION & JMP;
	 
	 wire WHICH_CONDITION;
//	 always @(FLAGS) begin
	 assign WHICH_CONDITION = FLAGS[IMM[2:0]];
	 assign JUMP_CONDITION = WHICH_CONDITION ^ IMM[3];
//	 
//	 end


endmodule
