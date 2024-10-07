use core::panic;
use std::collections::HashMap;
use std::fs::File;
use std::io;
use std::io::prelude::*;
use std::io::BufReader;
use std::path::Path;

use sim_tui::App;

// use sim_tui::*;
mod sim_tui;

#[derive(Debug)]
#[derive(Clone)]
enum Opcode {
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
struct Instruction {
    op: Opcode,
    arg: u8,
}

impl Instruction {
    fn emit(&self) -> u8 {
        ((self.op.clone() as u8) << 4) | self.arg
    }
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


#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_instruction_emit() {
        assert_eq!(Instruction{op: Opcode::ADD, arg: 4}.emit(), 0x54);
    }

    #[test]
    fn test_lookup_op() {
        assert_eq!(lookup_op("ADD").unwrap(), 5);
    }
}


fn lookup_macro(op_str: &str, arg_str: &str, instructions: &mut Vec<u8>) {
    let arg_u8: u8 = arg_str.parse().unwrap();
    match op_str {
        "SET" => {
            instructions.push(Instruction{op: Opcode::LLI, arg: arg_u8 & 0xF}.emit());
            instructions.push(Instruction{op: Opcode::LUI, arg: arg_u8 >> 4}.emit());
        }
        "FOO" => {
            println!("FOO HERE");
        }
        "BAR" => {
            println!("BAR HERE");
        }
        _ => {
            panic!("Unkown macro: {op_str}");
        }
    }
}

fn parse_file(path: &Path) -> Option<Vec<u8>> {

    let file = File::open(path).unwrap();
    let reader = BufReader::new(file);

    let mut instructions: Vec<u8> = Vec::new();

    for (line_number, line) in reader.lines().enumerate() {
        let line = line.ok()?;

        if let Some((left, right)) = line.split_once(' ') {
            let arg: u8;
            if right.starts_with("$") {
                let right_ = &right[1 .. right.len()];
                arg = right_.parse::<u8>().unwrap();
            }
            else {
                arg = right.parse::<u8>().unwrap();
            }

            // we have left and right
            let opcode = lookup_op(left);
            if let Some(opcode) = opcode {
                instructions.push(opcode << 4 | arg);
            } else {
                lookup_macro(left, right, &mut instructions)
            }
        } else {
            panic!("syntax error line: {}", line_number);
        }
    }

    Some(instructions)
}

fn main() -> io::Result<()> {

    let path = Path::new("../../programs/BBFibinachi.txt");

    let instructions = parse_file(path);

    for item in instructions.unwrap() {
        println!("0x{item:x}");
    }

    let terminal = ratatui::init();
    let result = App::new().run(terminal);
    ratatui::restore();

    result
}
