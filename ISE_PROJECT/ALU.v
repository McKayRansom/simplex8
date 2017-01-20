`timescale 1ns / 1ps
//////////////////////////////////////////////////////////////////////////////////
// Company: 
// Engineer: 
// 
// Create Date:    21:26:24 09/22/2016 
// Design Name: 
// Module Name:    ALU 
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
module ALU(
	input CLK,

	input ADD,
	input SUB,
	input SHIFT,
	input OR,
	input AND,
	input SetFlags,
	
	input[7:0] ACC,
	input[7:0] REG,
	
	output[7:0] RESULT,
	output reg[7:0] FLAGS//FLAGS 0 always equals 1
);
	wire[7:0] TOFLAGS;
	wire[4:0] STATE = {
		ADD, 
		SUB, 
		SHIFT, 
		OR, 
		AND
	};
	always @(posedge clk) begin
		case (state)
			5'b00001: begin 
				//ADD
				RESULT <= ADDER_RESULT;			
				end
			5'b00010: begin
				//SUB
				RESULT <= ADDER_RESULT;			
				end
			5'b00100: begin
				//SHIFT
				RESULT <= SHIFT_RESULT;
				end
			5'b01000: begin
				//OR
				RESULT <= OR_RESULT;
				end
			5'b10000: begin
				//AND
				RESULT <= AND_RESULT;
				end
		endcase
	end
	
	wire[7:0] ADDER_INPUT;
	mux_array #(.SIZE(8)) ADDER_INPUT_SELECT (
		.sel(SUB),
		.a(ACC),
		.b(~ACC),
		.o(ADDER_INPUT)
	);
//	always @(ADD or SUB) begin
//		if (ADD)
//			ADDER_INPUT <= ACC;
//		if (SUB)
//			ADDER_INPUT <= ~ACC;
//	end
	
	//ADD AND SUBTRACT
	wire[8:0] ADDER_RESULT;
	assign ADDER_RESULT = ADDER_INPUT + REG + SUB;
//	always @(ADDER_RESULT or ADD or SUB) begin
//		if (ADD | SUB)
//			RESULT <= ADDER_RESULT[7:0];
//	end
	//OVERFLOW
	assign TOFLAGS[4] = ADDER_RESULT[8];
	
	//SHIFT
	wire[8:0] SHIFT_RESULT;
	assign SHIFT_RESULT = REG >> 1;
//	always @(SHIFT_RESULT or SHIFT) begin
//		if (SHIFT)
//			RESULT = SHIFT_RESULT[7:0];
//	end
	//OVERFLOW
	assign TOFLAGS[7] = SHIFT_RESULT[8];
	
	//AND / OR is boring
	wire[7:0] AND_RESULT = REG & ACC;
	wire[7:0] OR_RESULT = REG | ACC;
	
	//Compare
	assign TOFLAGS[1] = (REG == ACC);
	assign TOFLAGS[2] = (ACC < REG);
	assign TOFLAGS[3] = (ACC > REG);
	
	
	//ANY
	assign TOFLAGS[6] = |RESULT;
	
	//SET FLAGS
	assign TOFLAGS[0] = 1'b1;
	always @(posedge CLK) begin
		if (SetFlags)
			FLAGS <= TOFLAGS;
	end
	initial begin
		FLAGS = 8'b00000001;
	end
	
//	//SELECT RESULT
//	mux_array #(.SIZE(8)) RESULT_SELECT (
//		.sel(SHIFT),
//		.a(ADDER_RESULT[7:0]),
//		.b(SHIFT_RESULT[7:0]),
//		.o(RESULT)
//	);
	
endmodule
