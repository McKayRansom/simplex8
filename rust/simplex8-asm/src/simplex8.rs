/*
 * Assembly definitions for the Simplex8 ISA
 *
 */

#[derive(Debug, Clone)]
pub enum AssemblyError {
    IntParseFailed,
    UnknownInstruction,
}

const OPCODES: [&'static str; 16] = [
    "NOP",    // 0
    "LI",     // 1
    "UI",     // 2
    "MOV",    // 3
    "ACC",    // 4
    "ADD",    // 5
    "SUB",    // 6
    "_CMP",   // 7
    "SHIFT",  // 8
    "AND",    // 9
    "OR",     // 10
    "JMP",    // 11
    "STORE",  // 12
    "LOAD",   // 13
    "_DISP",  // 14
    "_INPUT", // 15
];

// for any str
fn lookup_op(op_str: &str) -> Option<u8> {
    match OPCODES.iter().position(|&r| r == op_str) {
        Some(op) => Some(op as u8),
        None => None
    }
}

// static str you know works
fn op(op: &'static str) -> u8 {
    lookup_op(op).unwrap() as u8
}

// for any str
pub fn instruction(op: &str, arg: u8) -> Option<u8> {
    match lookup_op(op) {
        Some(op) => Some(op << 4 | arg & 0xF),
        None => None
    }
}

// static str you know works
pub fn inst(op: &'static str, arg: u8) -> u8 {
    instruction(op, arg).unwrap()
}

pub fn opcode_str(opcode: u8) -> Option<&'static str> {
    if opcode < OPCODES.len() as u8 {
        Some(OPCODES[opcode as usize]) 
    } else {
        None
    }
}

fn lookup_macro(op_str: &str, arg_u8: u8) -> Result<Vec<u8>, AssemblyError> {
    // let arg_u8: u8 = arg_str.parse().unwrap_or_default();
    match op_str {
        "SET" => Ok(vec![inst("LI", arg_u8 & 0xF), inst("UI", arg_u8 >> 4)]),
        "NOOP" => Ok(vec![inst("NOP", 0)]),
        "MOVE" => Ok(vec![inst("MOV", arg_u8)]),
        "JMPIF" => Ok(vec![inst("JMP", arg_u8)]),
        "EQUAL" => Ok(vec![inst("AND", arg_u8)]),
        "CMP" => Ok(vec![inst("AND", arg_u8)]),
        "DISP" => Ok(vec![inst("STORE", arg_u8)]),
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

    match instruction(left, arg) {
        Some(instruction) => Ok(vec![instruction]),
        None => lookup_macro(left, arg),
    }
}

// pub fn disassemble(instr: u8) -> &str {}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_instruction_emit() {
        assert_eq!(inst("ADD", 4), 0x54);
        // check we truncate the arg
        assert_eq!(inst("ADD", 255), 0x5F);
    }

    #[test]
    fn test_lookup_op() {
        assert_eq!(op("ADD"), 5);
    }

    #[test]
    fn test_assemble() {
        assert_eq!(assemble("LI 0").unwrap(), [inst("LI", 0)]);
        assert_eq!(assemble("ADD $5").unwrap(), [inst("ADD", 5)]);
        assert_eq!(assemble("UI 255").unwrap(), [inst("UI", 0xF)]);
    }

    #[test]
    fn test_assemble_macro() {
        assert_eq!(assemble("SET 255").unwrap(), [inst("LI", 15), inst("UI", 15)]);
    }
}
