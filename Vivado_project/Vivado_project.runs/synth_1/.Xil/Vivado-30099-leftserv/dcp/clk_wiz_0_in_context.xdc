create_clock -period 5.000 [get_ports clk_in1_p]
create_generated_clock -source [get_ports clk_in1_p] -edges {1 2 3} -edge_shift {0.000 47.500 95.000} [get_ports -no_traverse clk_out1]
set_property -quiet IO_BUFFER_TYPE NONE [get_ports -quiet clk_in1_p]
set_property -quiet IO_BUFFER_TYPE NONE [get_ports -quiet clk_in1_n]
