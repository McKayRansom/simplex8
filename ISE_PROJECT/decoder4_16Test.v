`timescale 1ns / 1ps

////////////////////////////////////////////////////////////////////////////////
// Company: 
// Engineer:
//
// Create Date:   15:53:38 09/21/2016
// Design Name:   decoder4_16
// Module Name:   E:/DigitalCircuts/Lab3/DoubleSevenSegment/decoder4_16Test.v
// Project Name:  DoubleSevenSegment
// Target Device:  
// Tool versions:  
// Description: 
//
// Verilog Test Fixture created by ISE for module: decoder4_16
//
// Dependencies:
// 
// Revision:
// Revision 0.01 - File Created
// Additional Comments:
// 
////////////////////////////////////////////////////////////////////////////////

module decoder4_16Test;

	// Inputs
	reg [3:0] d;
	reg en;

	// Outputs
	wire [15:0] o;

	// Instantiate the Unit Under Test (UUT)
	decoder4_16 uut (
		.d(d), 
		.en(en), 
		.o(o)
	);
	
	reg clk;
	reg[4:0] count;

	initial begin
		// Initialize Inputs
		d = 0;
		en = 0;
		count = 0;
		clk = 0;

		// Wait 100 ns for global reset to finish
		#100;
        
		// Add stimulus here

		forever #10 clk = ~clk;
	end
	
	always @(posedge clk) begin
		count <= count + 1;
		d <= count[3:0];
		en <= count[4];
	end
      
endmodule

