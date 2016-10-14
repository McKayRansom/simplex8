`timescale 1ns / 1ps
//////////////////////////////////////////////////////////////////////////////////
// Company: 
// Engineer: 
// 
// Create Date:    15:47:18 09/21/2016 
// Design Name: 
// Module Name:    decoder4_16 
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
module decoder4_16(
	input[3:0] d,
	output [15:0] o,
	input en
);

	wire en1, en2;
	
	assign en1 = d[3] & en;
	assign en2 = ~d[3] & en;
	
	decoder3_8 d1(
			.en(en1),
			.d(d[2:0]),
			.o(o[7:0])
		);
	decoder3_8 d2(
			.en(en2),
			.d(d[2:0]),
			.o(o[15:8])
		);


endmodule
