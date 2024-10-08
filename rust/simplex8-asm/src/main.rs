use std::fs::File;
use std::io;
use std::io::prelude::*;
use std::io::BufReader;
use std::path::Path;

use tui::App;

mod sim;
mod simplex8;
mod tui;

use sim::Sim;

fn parse_file(path: &Path) -> Option<Vec<u8>> {
    let file = File::open(path).unwrap();
    let reader = BufReader::new(file);

    let mut instructions: Vec<u8> = Vec::new();

    for (line_number, line) in reader.lines().enumerate() {
        let line = line.ok()?;
        let instrs_new =
            simplex8::assemble(&line).expect(&format!("Assembly error line: {line_number}"));
        instructions.extend(&instrs_new);
    }

    Some(instructions)
}

fn main() -> io::Result<()> {
    let path = Path::new("../../programs/BBFibinachi.txt");

    let instructions = parse_file(path);

    // for item in instructions.unwrap() {
    // println!("0x{item:x}");
    // }

    let mut sim = Sim::new();
    sim.load(instructions.unwrap());

    let terminal = ratatui::init();
    let result = App::new(sim).run(terminal);
    ratatui::restore();

    result
}
