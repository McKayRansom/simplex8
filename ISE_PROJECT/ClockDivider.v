`timescale 1ns / 1ps
//////////////////////////////////////////////////////////////////////////////////
// Company: 
// Engineer: 
// 
// Create Date:    15:58:58 09/07/2016 
// Design Name: 
// Module Name:    ClockDivider 
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
module ClockDivider(
	input clkin,
	input[25:0] divBy,
	output reg clkout
   );
	
	reg[25:0] count;
	
	initial begin
		count = 0;
		clkout = 0;
	end
	
	always @(posedge clkin) begin
		if (count == divBy) begin //26'd50_000
		//if (count == 26'b0000_0000_0000_0000_0000_0010_00) begin
			count <= 0;
			clkout <= ~clkout;
		end
		else begin
			count <= count + 1;
		end
	end


endmodule
