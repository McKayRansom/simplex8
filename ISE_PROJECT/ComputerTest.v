`timescale 1ns / 1ps

////////////////////////////////////////////////////////////////////////////////
// Company: 
// Engineer:
//
// Create Date:   00:34:15 09/23/2016
// Design Name:   HighLevel
// Module Name:   E:/MISC Computer/MISCMicroprocessor/ComputerTest.v
// Project Name:  MISCMicroprocessor
// Target Device:  
// Tool versions:  
// Description: 
//
// Verilog Test Fixture created by ISE for module: HighLevel
//
// Dependencies:
// 
// Revision:
// Revision 0.01 - File Created
// Additional Comments:
// 
////////////////////////////////////////////////////////////////////////////////

module ComputerTest;

	// Inputs
	reg CLOCK;
	reg [7:0] SW;
	reg ENABLED;

	// Outputs
	wire [3:0] AN;
	wire [6:0] seg;
	wire LED;

	// Instantiate the Unit Under Test (UUT)
	HighLevel uut (
		.CLOCK(CLOCK), 
		.SW(SW), 
		.ENABLED(ENABLED), 
		.AN(AN), 
		.seg(seg),
		.LED(LED)
	);

	initial begin
		// Initialize Inputs
		CLOCK = 0;
		SW = 0;
		ENABLED = 1;

		// Wait 100 ns for global reset to finish
		#100;
        
		// Add stimulus here
		forever #10 CLOCK = ~CLOCK;
	end
      
endmodule

