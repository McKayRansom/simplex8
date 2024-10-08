/*
 * Simplex8 simulator
 *
 * */

use crate::simplex8::{opcode_str, AssemblyError};

pub const REG_COUNT: usize = 16;
const INST_MEM_SIZE: usize = 0x3ff;
const DATA_MEM_SIZE: usize = 0x3ff;

pub struct Sim {
    pub pc: usize,
    flags: u8,
    pub reg: [u8; REG_COUNT],
    pub inst_mem: [u8; INST_MEM_SIZE],
    pub data_mem: [u8; DATA_MEM_SIZE],
    pub last_reg: Option<usize>,
}

impl Sim {
    pub fn new() -> Self {
        Self {
            pc: 0,
            flags: 0,
            reg: [0; REG_COUNT],
            inst_mem: [0; INST_MEM_SIZE],
            data_mem: [0; DATA_MEM_SIZE],
            last_reg: None,
        }
    }

    pub fn load(&mut self, instructions: Vec<u8>) {
        for (item_number, item) in instructions.iter().enumerate() {
            self.inst_mem[item_number] = *item;
        }
    }

    pub fn reset(&mut self) {
        self.pc = 0;
        self.flags = 0;
        self.reg.fill(0);
        self.data_mem.fill(0);
        self.last_reg = None;
    }

    fn jump(&mut self, condition: u8) -> bool {
        condition & self.flags != 0
    }

    fn addr_reg(&mut self) -> usize {
        self.reg[0] as usize | (self.reg[1] as usize) << 8
    }

    fn step_op(&mut self, opcode: &str, arg: usize) -> Result<(), AssemblyError> {
        self.last_reg = None;
        match opcode {
            "NOP" => {}
            "LI" => {
                self.reg[0] = (self.reg[0] & 0xF0) | (arg as u8 & 0xF);
                self.last_reg = Some(0);
            }
            "UI" => {
                self.reg[0] = ((arg as u8) << 4 & 0xF0) | (self.reg[0] & 0xF);
                self.last_reg = Some(0);
            }
            "MOV" => {
                self.reg[arg] = self.reg[0];
                self.last_reg = Some(arg);
            }
            "ACC" => {
                self.reg[0] = self.reg[arg];
                self.last_reg = Some(0);
            }
            "ADD" => {
                self.reg[0] = self.reg[arg] + self.reg[0];
                self.last_reg = Some(0);
            }
            "SUB" => {
                self.reg[0] = self.reg[arg] - self.reg[0];
                self.last_reg = Some(0);
            }
            "SHIFT" => {
                self.reg[0] = self.reg[0] >> 1;
                self.last_reg = Some(0);
            }
            "AND" => {
                self.reg[0] = self.reg[0] & self.reg[arg];
                self.last_reg = Some(0);
            }
            "OR" => {
                self.reg[0] = self.reg[0] | self.reg[arg];
                self.last_reg = Some(0);
            }
            "JMP" => {
                if self.jump(arg as u8) {
                    self.pc = self.addr_reg()
                };
            }
            "STORE" => {
                self.data_mem[self.addr_reg()] = self.reg[arg];
            }
            "LOAD" => {
                self.reg[arg] = self.data_mem[self.addr_reg()];
                self.last_reg = Some(arg);
            }
            _ => {
                return Err(AssemblyError::UnknownInstruction);
            }
        }
        Ok(())
    }

    pub fn step(&mut self) -> Result<(), AssemblyError> {
        let instruction = self.inst_mem[self.pc];
        let arg = instruction & 0xF;
        self.pc += 1;
        let opcode = instruction >> 4;

        let opcode_str = opcode_str(opcode).unwrap_or_default();
        
        self.step_op(opcode_str, arg as usize)
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::simplex8::inst;

    fn do_inst(sim: &mut Sim, instruction: u8) {
        sim.inst_mem[sim.pc] = instruction;
        sim.step();
    }

    #[test]
    fn test_sim() {
        let mut sim = Sim::new();
        sim.step();
        assert_eq!(sim.pc, 1);

        do_inst(&mut sim, inst("LI", 0xF));
        assert_eq!(sim.reg[0], 0xF);

        do_inst(&mut sim, inst("UI", 0xF));
        assert_eq!(sim.reg[0], 0xFF);

        do_inst(&mut sim, inst("MOV", 0x1));
        assert_eq!(sim.reg[1], 0xFF);

        do_inst(&mut sim, inst("ACC", 0x2));
        assert_eq!(sim.reg[0], 0);

        do_inst(&mut sim, inst("ADD", 0x1));
        assert_eq!(sim.reg[0], 0xFF);

        do_inst(&mut sim, inst("LI", 0x0));
        assert_eq!(sim.reg[0], 0xF0);

        do_inst(&mut sim, inst("UI", 0x0));
        assert_eq!(sim.reg[0], 0x00);
    }
}
