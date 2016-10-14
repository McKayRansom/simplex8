`timescale 1ns / 1ps

////////////////////////////////////////////////////////////////////////////////
// Company: 
// Engineer:
//
// Create Date:   17:24:16 09/21/2016
// Design Name:   mux_array
// Module Name:   E:/DigitalCircuts/Lab3/DoubleSevenSegment/MUXArrayTest.v
// Project Name:  DoubleSevenSegment
// Target Device:  
// Tool versions:  
// Description: 
//
// Verilog Test Fixture created by ISE for module: mux_array
//
// Dependencies:
// 
// Revision:
// Revision 0.01 - File Created
// Additional Comments:
// 
////////////////////////////////////////////////////////////////////////////////

module MUXArrayTest;

	// Inputs
	reg [3:0] a;
	reg [3:0] b;
	reg sel;

	// Outputs
	wire [3:0] o;
	
	reg clk;
	reg [4:0] count;

	// Instantiate the Unit Under Test (UUT)
	mux_array uut (
		.a(a), 
		.b(b), 
		.sel(sel), 
		.o(o)
	);

	initial begin
		// Initialize Inputs
		a = 4'b1111;
		b = 4'b0000;
		sel = 0;

		// Wait 100 ns for global reset to finish
		#100;
        
		// Add stimulus here
//		#10 sel = ~sel;
	end
      
endmodule

