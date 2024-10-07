/*
 * Assembly definitions for the Simplex8 ISA
 *
 */
use num_derive::FromPrimitive;
use std::collections::HashMap;

#[derive(Debug, Clone)]
pub enum AssemblyError {
    IntParseFailed,
    UnknownInstruction,
}

#[derive(Debug, Clone, FromPrimitive)]
pub enum Opcode {
    NOP = 0,
    LLI = 1,
    LUI = 2,
    MOV = 3,
    ACC = 4,
    ADD = 5,
    SUB = 6,
    // CMP = 7,
    SHIFT = 8,
    AND = 9,
    OR = 10,
    JMP = 11,
    STORE = 12,
    LOAD = 13,
    // DISP =  14,
    // INPUT = 15,
    // NOOP = 0,
    // MOVE = 3,
    // JMPIF = 11,
    // EQUAL = 9,
    // CMP = 9,
    // DISP = 12,
}

#[derive(Debug)]
pub struct Instruction {
    pub op: Opcode,
    pub arg: u8,
}

impl Instruction {
    pub fn emit(&self) -> u8 {
        ((self.op.clone() as u8) << 4) | self.arg
    }
}

pub fn inst(op: Opcode, arg: u8) -> u8 {
    (op as u8) << 4 | arg
}

fn lookup_op(op_str: &str) -> Option<u8> {
    let opcodes: HashMap<_, u8> = HashMap::from([
        ("NOP", 0),
        ("LI", 1),
        ("UI", 2),
        ("MOV", 3),
        ("ACC", 4),
        ("ADD", 5),
        ("SUB", 6),
        // (//"CMP",   7),
        ("SHIFT", 8),
        ("AND", 9),
        ("OR", 10),
        ("JMP", 11),
        ("STORE", 12),
        ("LOAD", 13),
        // (//"DISP",  14),
        // (//"INPUT", 15),
        ("NOOP", 0),
        ("MOVE", 3),
        ("JMPIF", 11),
        ("EQUAL", 9),
        ("CMP", 9),
        ("DISP", 12),
    ]);

    let Some(&op_code) = opcodes.get(op_str) else {
        return None;
    };

    Some(op_code)
}

fn lookup_macro(op_str: &str, arg_str: &str) -> Result<Vec<u8>, AssemblyError> {
    let arg_u8: u8 = arg_str.parse().unwrap();
    match op_str {
        "SET" => Ok(vec![
            Instruction {
                op: Opcode::LLI,
                arg: arg_u8 & 0xF,
            }
            .emit(),
            Instruction {
                op: Opcode::LUI,
                arg: arg_u8 >> 4,
            }
            .emit(),
        ]),
        _ => Err(AssemblyError::UnknownInstruction),
    }
}

pub fn assemble(line: &str) -> Result<Vec<u8>, AssemblyError> {
    let (left, right) = line
        .split_once(' ')
        .ok_or(AssemblyError::UnknownInstruction)?;

    let arg = if right.starts_with("$") {
        let right_ = &right[1..right.len()];
        right_.parse::<u8>().unwrap()
    } else {
        right.parse::<u8>().unwrap()
    };

    // we have left and right
    match lookup_op(left) {
        Some(opcode) => Ok(vec![opcode << 4 | arg]),
        None => lookup_macro(left, right),
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_instruction_emit() {
        assert_eq!(
            Instruction {
                op: Opcode::ADD,
                arg: 4
            }
            .emit(),
            0x54
        );
    }

    #[test]
    fn test_lookup_op() {
        assert_eq!(lookup_op("ADD").unwrap(), 5);
    }

    #[test]
    fn test_assemble() {
        assert_eq!(assemble("ADD $5").unwrap(), [0x55]);
        assert_eq!(assemble("SET 255").unwrap(), [0x1F, 0x2F]);
    }
}
