`timescale 1ns / 1ps

////////////////////////////////////////////////////////////////////////////////
// Company: 
// Engineer:
//
// Create Date:   22:16:07 09/22/2016
// Design Name:   ALUTest
// Module Name:   E:/MISC Computer/MISCMicroprocessor/ALUTestTest.v
// Project Name:  MISCMicroprocessor
// Target Device:  
// Tool versions:  
// Description: 
//
// Verilog Test Fixture created by ISE for module: ALUTest
//
// Dependencies:
// 
// Revision:
// Revision 0.01 - File Created
// Additional Comments:
// 
////////////////////////////////////////////////////////////////////////////////

module ALUTestTest;

	// Inputs
	reg CLK;
	reg [7:0] SW;

	// Outputs
	wire [3:0] AN;
	wire [6:0] seg;

	// Instantiate the Unit Under Test (UUT)
	ALUTest uut (
		.CLK(CLK), 
		.SW(SW), 
		.AN(AN), 
		.seg(seg)
	);

	initial begin
		// Initialize Inputs
		CLK = 0;
		SW = 0;

		// Wait 100 ns for global reset to finish
		#100;
        
		// Add stimulus here
		#100 SW = 8'b0001_0001;

	end
      
endmodule

