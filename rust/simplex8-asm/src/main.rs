use core::panic;
use std::collections::HashMap;
use std::fs::File;
use std::io;
use std::io::prelude::*;
use std::io::BufReader;
use std::path::Path;

#[derive(Debug)]
enum Instruction {
    Nop,
    Li,
    Mov{ from: Register, to: Register }
}

#[derive(Debug)]
enum Register {
    A,
    B,
    C,
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

#[test]
fn test_lookup_op() {
    assert_eq!(lookup_op("ADD").unwrap(), 4);
}

fn lookup_macro(op_str: &str) {
    match op_str {
        "SET" => {
             println!("SET HERE");
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

fn main() -> io::Result<()> {
    let i = Instruction::Mov { from: Register::B, to: Register::C };

    dbg!(i);
    let path = Path::new("../../programs/BBFibinachi.txt");

    let file = File::open(path).unwrap();
    let reader = BufReader::new(file);

    for (line_number, line) in reader.lines().enumerate() {
        // println!("{}", line?);
        let line = line?;

        if let Some((left, right)) = line.split_once(' ') {
            // we have left and right
            let opcode = lookup_op(left);
            if let Some(opcode) = opcode {
                println!("opcode: {opcode}");
                continue;
            }

            lookup_macro(left)


        } else {
            panic!("syntax error line: {}", line_number);
        }
    }

    Ok(())
}
