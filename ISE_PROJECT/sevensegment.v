`timescale 1ns / 1ps
//////////////////////////////////////////////////////////////////////////////////
// Company: 
// Engineer: 
// 
// Create Date:    16:16:48 09/21/2016 
// Design Name: 
// Module Name:    sevensegment 
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
module sevensegment (
	input [3:0] wxyz,
	output [6:0] seg
);	

	wire [15:0] d;
	
	decoder4_16 D(.d(wxyz), .en(1'b1), .o(d));
	
	assign seg[6] = |(d & 16'hB7C0); // a
	assign seg[5] = |(d & 16'hF9C0); // b
	assign seg[4] = |(d & 16'hDFC0); // c
	assign seg[3] = |(d & 16'hB6C0); // d
	assign seg[2] = |(d & 16'hA280); // e
	assign seg[1] = |(d & 16'h8EC0); // f
	assign seg[0] = |(d & 16'h3EC0); // g
	
endmodule