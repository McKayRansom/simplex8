`timescale 1ns / 1ps

////////////////////////////////////////////////////////////////////////////////
// Company: 
// Engineer:
//
// Create Date:   17:05:31 09/21/2016
// Design Name:   DoubleSevenSegment
// Module Name:   E:/DigitalCircuts/Lab3/DoubleSevenSegment/DoubleSevenSegmentTest.v
// Project Name:  DoubleSevenSegment
// Target Device:  
// Tool versions:  
// Description: 
//
// Verilog Test Fixture created by ISE for module: DoubleSevenSegment
//
// Dependencies:
// 
// Revision:
// Revision 0.01 - File Created
// Additional Comments:
// 
////////////////////////////////////////////////////////////////////////////////

module DoubleSevenSegmentTest;

	// Inputs
	reg CLK;
	reg [15:0] SW;

	// Outputs
	wire [3:0] AN;
	wire [6:0] seg;

	// Instantiate the Unit Under Test (UUT)
	DoubleSevenSegment uut (
		.CLK(CLK), 
		.SW(SW), 
		.AN(AN), 
		.seg(seg)
	);

	initial begin
		// Initialize Inputs
		CLK = 0;
		SW = 16'b1111_0011_1100_0000;
		
		// Wait 100 ns for global reset to finish
		#100;
        
		// Add stimulus here
		
		forever #10 CLK = ~CLK;
		
	end
	
//	always @(posedge AN[0]) begin
//		SW = SW + 1;
//	end
      
endmodule

