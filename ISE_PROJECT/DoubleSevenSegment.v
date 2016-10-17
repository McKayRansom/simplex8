`timescale 1ns / 1ps
//////////////////////////////////////////////////////////////////////////////////
// Company: 
// Engineer: 
// 
// Create Date:    16:54:36 09/21/2016 
// Design Name: 
// Module Name:    DoubleSevenSegment 
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
module DoubleSevenSegment(
		input CLK,
		input[15:0]SW,
		output[3:0]AN,
		output[6:0]seg
    );
	
	wire sel;
	
	ClockDivider DISPLAY_CLK(
		.clkin(CLK),
		.divBy(26'd50_000),
		.clkout(sel)
   );
	
	reg[1:0] count;
	
	initial
		count <= 0;
	
	always @(posedge sel)
		count <= count + 1;
	
	wire[3:0] d;
	wire[6:0] segNotInverted;
	
	sevensegment seg_dec (
		.wxyz(d), 
		.seg(segNotInverted)
	);
	
	assign seg = ~segNotInverted;
	//4 to 1 mux
	wire [3:0] select;
	wire [7:0] o;
	mux_array part0 (
    .a(SW[3:0]), 
    .b(SW[7:4]), 
    .sel(count[0]), 
    .o(o[3:0])
    );
	 
	 mux_array part1 (
    .a(SW[11:8]), 
    .b(SW[15:12]), 
    .sel(count[0]), 
    .o(o[7:4])
    );
	 
	 mux_array master (
    .a(o[3:0]), 
    .b(o[7:4]), 
    .sel(count[1]), 
    .o(d)
    );
	
	//basically 2-4 decoder
	assign select[0] = ~count[0] & ~count[1];
	assign select[1] = count[0] &~count[1];
	assign select[2] = ~count[0] & count[1];
	assign select[3] = count[0] & count[1];
	
	assign AN = ~select;
	

endmodule