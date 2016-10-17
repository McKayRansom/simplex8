`timescale 1ns / 1ps
//////////////////////////////////////////////////////////////////////////////////
// Company: 
// Engineer: 
// 
// Create Date:    21:35:57 09/22/2016 
// Design Name: 
// Module Name:    PC 
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
module PC(
		input CLK,
		input EN,
		input[15:0] ADDRESS,
		input LOAD,
		output reg[15:0] Q
    );
	
	initial begin
		Q = 16'd0;
	end
	
	always @(posedge CLK) begin
		if (LOAD)
			Q <= ADDRESS;
		else
			Q <= Q + 1;
		
	end
	

endmodule
