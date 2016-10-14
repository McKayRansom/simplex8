`timescale 1ns / 1ps
//////////////////////////////////////////////////////////////////////////////////
// Company: 
// Engineer: 
// 
// Create Date:    22:36:23 09/22/2016 
// Design Name: 
// Module Name:    InstructionMemory 
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
module InstructionMemory(
		input[15:0] ADDRESS,
		input EN,
		output[7:0] IO
    );
	 reg[7:0] memory [0:35];
	 
	 initial begin: reset
//		integer i;
//		for (i = 0; i< 255; i = i+1) begin
//			memory[i] = 8'd0;
//		end
		$readmemb("memory.list", memory);
	 end
	 
	 assign IO = memory[ADDRESS];


endmodule
