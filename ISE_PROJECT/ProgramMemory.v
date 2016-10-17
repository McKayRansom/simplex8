`timescale 1ns / 1ps
//////////////////////////////////////////////////////////////////////////////////
// Company: 
// Engineer: 
// 
// Create Date:    21:41:44 09/22/2016 
// Design Name: 
// Module Name:    ProgramMemory 
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
module ProgramMemory(
		input CLK,
		input STORE,
		input LOAD,
		input[7:0] IO,
		
		input[15:0] ADDRESS,
		input[7:0] INPUT_0,
		
		output[7:0] OUTPUT_0,
		output[7:0] OUTPUT_1,
		output[7:0] OUTPUT_2
    );
	 reg[7:0] memory [0:260];
	 
	 assign OUTPUT_0 = memory[256];
	 assign OUTPUT_1 = memory[257];
	 assign OUTPUT_2 = memory[258];
	 
	 //assign memory[512] = INPUT_0;
	 
	 initial begin: reset
		integer i;
		for (i = 0; i< 261; i = i+1) begin
			memory[i] = 8'd0;
		end
	 end
	 
//	 always @(posedge CLK) begin
//		 if (LOAD)
	 //assign IO = memory[ADDRESS];
//	end
	 
	 always @(posedge CLK) begin
		if (STORE)
			memory[ADDRESS] = IO;
	 end


endmodule
