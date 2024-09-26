#ifndef SIM_RUN_H
#define SIM_RUN_H

void sim_init(uint8_t *instructions, uint16_t instCount);
void sim_step();
void sim_run();
void sim_printRegs();

uint8_t *sim_getInstMem();
uint16_t sim_getPc();
uint8_t *sim_getRegs();
uint8_t sim_getFlags();

#endif