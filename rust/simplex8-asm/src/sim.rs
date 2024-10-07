/*
 * Simplex8 simulator
 *
 * */

use crate::simplex8::{ Opcode, inst };
use num_traits::FromPrimitive;

const REG_COUNT: usize = 16;
const INST_MEM_SIZE: usize = 0x3ff;
const DATA_MEM_SIZE: usize = 0x3ff;

pub struct Sim {
    pc: usize,
    flags: u8,
    reg: [u8; REG_COUNT],
    inst_mem: [u8; INST_MEM_SIZE],
    data_mem: [u8; DATA_MEM_SIZE],
}

impl Sim {
    pub fn new() -> Self {
        Self {
            pc: 0,
            flags: 0,
            reg: [0; REG_COUNT],
            inst_mem: [0; INST_MEM_SIZE],
            data_mem: [0; DATA_MEM_SIZE],
        }
    }

    fn jump(&mut self, condition: u8) -> bool {
        condition & self.flags != 0
    }

    fn addr_reg(&mut self) -> usize {
        self.reg[0] as usize | (self.reg[1] as usize) << 8
    }

    fn step_op(&mut self, opcode: Opcode, arg: usize) {
        match opcode {
            Opcode::NOP => {}
            Opcode::LLI => {
                self.reg[0] |= arg as u8;
            }
            Opcode::LUI => {
                self.reg[0] |= (arg as u8) << 4;
            }
            Opcode::MOV => {
                self.reg[arg] = self.reg[0];
            }
            Opcode::ACC => {
                self.reg[0] = self.reg[arg];
            }
            Opcode::ADD => {
                self.reg[0] = self.reg[arg] + self.reg[0];
            }
            Opcode::SUB => {
                self.reg[0] = self.reg[arg] - self.reg[0];
            }
            Opcode::SHIFT => {
                self.reg[0] = self.reg[0] >> 1;
            }
            Opcode::AND => {
                self.reg[0] = self.reg[0] & self.reg[arg];
            }
            Opcode::OR => {
                self.reg[0] = self.reg[0] | self.reg[arg];
            }
            Opcode::JMP => {
                if self.jump(arg as u8) {
                    self.pc = self.addr_reg()
                };
            }
            Opcode::STORE => {
                self.data_mem[self.addr_reg()] = self.reg[arg];
            }
            Opcode::LOAD => {
                self.reg[arg] = self.data_mem[self.addr_reg()];
            }
        }
    }

    pub fn step(&mut self) {
        let instruction = self.inst_mem[self.pc];
        let arg = instruction & 0xF;
        self.pc += 1;
        match FromPrimitive::from_u8(instruction >> 4) {
            Some(opcode) => self.step_op(opcode, arg as usize),
            None => panic!("Unknown Opcode"),
        }
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    fn do_inst(sim: &mut Sim, instruction: u8) {
        sim.inst_mem[sim.pc] = instruction;
        sim.step();
    }

    #[test]
    fn test_sim() {
        let mut sim = Sim::new();
        sim.step();
        assert_eq!(sim.pc, 1);

        do_inst(&mut sim, inst(Opcode::LLI,0xF));
        assert_eq!(sim.reg[0], 0xF);

        do_inst(&mut sim, inst(Opcode::LUI,0xF));
        assert_eq!(sim.reg[0], 0xFF);

        do_inst(&mut sim, inst(Opcode::MOV,0x1));
        assert_eq!(sim.reg[1], 0xFF);

        do_inst(&mut sim, inst(Opcode::ACC,0x2));
        assert_eq!(sim.reg[0], 0);

        do_inst(&mut sim, inst(Opcode::ADD,0x1));
        assert_eq!(sim.reg[0], 0xFF);
    }
}
