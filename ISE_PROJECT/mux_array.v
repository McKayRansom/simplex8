`timescale 1ns / 1ps
//////////////////////////////////////////////////////////////////////////////////
// Company: 
// Engineer: 
// 
// Create Date:    16:05:48 09/21/2016 
// Design Name: 
// Module Name:    mux_array 
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
module mux_array #(parameter SIZE=4)(
		input[SIZE-1:0] a,
		input[SIZE-1:0] b,
		input sel,
		output[SIZE-1:0] o
);
	genvar i;
	
	generate
		for (i=0; i<SIZE; i=i+1) begin: MUXarray
			mux m(
				.i({b[i], a[i]}),
				.sel(sel),
				.o(o[i])
			);
		end
	endgenerate
//	
//module mux_array (
//		input[3:0] a,
//		input[3:0] b,
//		input sel,
//		output[3:0] o
//);
//
//	mux m(
//		.i({a[0], b[0]}),
//		.sel(sel),
//		.o(o[0])
//	);
endmodule
