package main

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
	"strings"
)

var ops = map[string]uint{
	"NOP":   0,
	"LI":    1,
	"UI":    2,
	"MOV":   3,
	"ACC":   4,
	"ADD":   5,
	"SUB":   6,
	//"CMP":   7,
	"SHIFT":  8,
	"AND":   9,
	"OR":    10,
	"JMP":   11,
	"STORE":  12,
	"LOAD":  13,
	//"DISP":  14,
	//"INPUT": 15,

	"NOOP":  0,
	"MOVE":  3,
	"JMPIF": 11,
	"EQUAL": 9,
	"CMP":   9,
	"DISP": 12,
}

var jumpConditions = map[string]uint {
	"equal" : 1,
	"lt" : 2,
	"gt" : 3,
	"overflow" : 4,
	"input" : 5,
	"any": 6,
	"shiftOverflow" : 7,
	"!equal" : 9,
	"!lt" : 10,
	"!gt" : 11,
	"!overflow" : 12,
	"!input" : 13,
	"!any": 14,
	"!shiftOverflow" : 15,
}

var macros = map[string]func(uint, uint, string)[]*Instruction{
	// "MOVE":
	// 		func (arg uint, arg2 uint)[]*Instruction {
	// 			return []*Instruction{
	// 				&Instruction{Opcode: ops["ACC"], Arg: arg},
	// 				&Instruction{Opcode: ops["MOV"], Arg: arg2},
	// 			}
	// 		},
	"SET":
			func (arg uint, line uint, label string)[]*Instruction {
				if (label == "") {
					return []*Instruction{
						&Instruction{Macro: "SETL", Arg: arg},
						&Instruction{Macro: "SETU", Arg: arg},
					}
				} else {
					return []*Instruction{
						&Instruction{Macro: "SETUL", LabelArg: label},
						&Instruction{Macro: "SETUU", LabelArg: label},
						&Instruction{Opcode: ops["MOV"], Arg: 1},
						&Instruction{Macro: "SETL", LabelArg: label},
						&Instruction{Macro: "SETU", LabelArg: label},
					}
				}
			},
	"WAIT":
			func (arg uint, line uint, label string)[]*Instruction {
				var list []*Instruction
				for i := 0; i < int(arg); i++ {
					list = append(list, &Instruction{Opcode: ops["NOP"], Arg: 0})
				}
				return list
			},
	"CALL": //call function
			func (arg uint, line uint, label string)[]*Instruction {
				return []*Instruction{
					&Instruction{Macro: "SETL", Arg: line + 12},
					&Instruction{Macro: "SETU", Arg: line + 12},
					&Instruction{Opcode: ops["MOV"], Arg: 14},
					&Instruction{Macro: "SETUL", Arg: line + 12},
					&Instruction{Macro: "SETUU", Arg: line + 12},
					&Instruction{Opcode: ops["MOV"], Arg: 15},
					&Instruction{Macro: "SETUL", LabelArg: label},
					&Instruction{Macro: "SETUU", LabelArg: label},
					&Instruction{Opcode: ops["MOV"], Arg: 1},
					&Instruction{Macro: "SETL", LabelArg: label},
					&Instruction{Macro: "SETU", LabelArg: label},
					&Instruction{Opcode: ops["JMP"], Arg: arg},
				}
			},
	"RET": //RETURN
			func (arg uint, line uint, label string)[]*Instruction {
				return []*Instruction {
					&Instruction{Opcode: ops["ACC"], Arg: 15},
					&Instruction{Opcode: ops["MOV"], Arg: 1},
					&Instruction{Opcode: ops["ACC"], Arg: 14},
					&Instruction{Opcode: ops["JMP"], Arg: arg},
				}
			},
}

var subMacros = map[string]func(uint)*Instruction {
	"SETU":
			func (arg uint) *Instruction {
				return &Instruction{Opcode: ops["UI"], Arg: (arg % 256) / 16}
			},
	"SETL":
			func (arg uint) *Instruction {
				return &Instruction{Opcode: ops["LI"], Arg: arg % 16}
			},
	"SETUU":
			func (arg uint) *Instruction {
				return &Instruction{Opcode: ops["UI"], Arg: arg >> 12}
			},
	"SETUL":
			func (arg uint) *Instruction {
				return &Instruction{Opcode: ops["LI"], Arg: (arg >> 8) % 16}
			},
}

type Instruction struct {
	Opcode   uint
	Arg      uint
	Arg2		 uint
	LabelArg string
	Macro    string
}

func (i *Instruction) String() string {
	return fmt.Sprintf("%01x%01x", i.Opcode, i.Arg)
}

//	compile a single instruction line into instructions
func compileLine(command string, instructions []*Instruction) ([]*Instruction, error) {
	parts := strings.Fields(command)
	if len(parts) == 0 { //blank line
		return instructions, nil
	}

	//	first part is opcode
	op := parts[0]
	var isMacro = false
	var inst = &Instruction{}

	//	all operations require an argument
	if len(parts) == 1 {
		return nil, fmt.Errorf("'%s' requires argument", op)
	}
	
	//	**********************************
	//	This is Steve's first time writing go code, so take it easy on him.
	//	In order to allow many arguments to the RDATA instruction,
	//	I'm just jumping in right here and parsing RDATA directly, if it's there.
	//
	//	The way RDATA ("relative data") works is we assume they have r2 set to the address where data should go,
	//	and r3 set to the space between data (increment)
	//	And our only job here is to load up each individual value...
	//	Each value translates, unfortunately, to 7 instructions.
	//	This is not ideal, but it was pretty easy to implement,
	//	and it makes it easy to edit data in code.
	//	Slightly better would be:
	//		START_DATA address_in_memory (some kind of label?)
	//		DATA x y z etc
	//	and each data block would only need 6 instructions.  Not a ton better.  :)
	if (op == "RDATA") {
		//println("Hey, some data.")
		var partLen = len(parts)
		for i := 1; i < partLen; i++ {
			
			value, err := strconv.ParseUint(parts[i], 10, 8)
			if err != nil {
				return nil, fmt.Errorf("error parsing argument: %v", err)
			}
				
			var uvalue = uint(value);
			
			//debug: fmt.Printf("data: %d\n", uvalue)
			
			var block = []*Instruction{
				&Instruction{Opcode: ops["UI"], Arg: (uvalue % 256)/16},
				&Instruction{Opcode: ops["LI"], Arg: uvalue % 16},				
				&Instruction{Opcode: ops["MOV"], Arg: 4},
				&Instruction{Opcode: ops["ACC"], Arg: 2},
				&Instruction{Opcode: ops["STORE"], Arg: 4},
				&Instruction{Opcode: ops["ADD"], Arg: 3},
				&Instruction{Opcode: ops["MOV"], Arg: 2},
			}
			for _, oneline := range block {
				instructions = append(instructions, oneline)
			}
		}
		
		return instructions, nil
	}

	//check opCodes
	opcode, ok := ops[strings.ToUpper(op)]
	if !ok {	//	not found - check macros
		//check macros
		_, ok := macros[strings.ToUpper(op)]

		if !ok {
			return nil, fmt.Errorf("invalid operation: %s", op)
		} else {
			isMacro = true;
			inst.Macro = op

		}
	} else {
		inst.Opcode = opcode
	}
	
	arg := parts[1]

	if strings.HasPrefix(arg, "@") {
		label := arg[1:]
		inst.LabelArg = label
	} else {
		if strings.HasPrefix(arg, "$") {
			arg = arg[1:]
		}

		argu, err := strconv.ParseUint(arg, 10, 8)
		if err != nil {

			argCond := jumpConditions[arg]
			if argCond > 0 {
				inst.Arg = argCond
			} else {
				return nil, fmt.Errorf("error parsing argument: %v", err)
			}
		} else {
			inst.Arg = uint(argu)
		}
	}

	if len(parts) > 2 {
		return nil, fmt.Errorf("too many arguments")
	}
	if !isMacro {
		instructions = append(instructions, inst)
	} else {
		instToAdd := macros[inst.Macro](inst.Arg, uint(len(instructions)), inst.LabelArg)
		for _, macro := range instToAdd {
			instructions = append(instructions, macro)
		}
	}

	return instructions, nil
}

func main() {
	if len(os.Args) == 1 {
		println("Input file required")
		return
	}
	if len(os.Args) > 3 {
		println("Too many input files")
		return
	}

	file, err := os.Open(os.Args[1])
	if err != nil {
		fmt.Printf("error opening file: %v", err)
		return
	}

	labels := make(map[string]uint)

	var instructions []*Instruction

	instructions = append(instructions, &Instruction{Opcode: 0, Arg: 0})

	var lineNum uint
	scanner := bufio.NewScanner(file)
	for scanner.Scan() {
		lineNum++

		line := strings.Trim(scanner.Text(), " \t")

		// strip comments
		pos := strings.IndexRune(line, '#')
		if pos >= 0 {
			line = line[:pos]
		}
		pos = strings.IndexRune(line, '/')
		if pos >= 0 {
			line = line[:pos]
		}

		// handle labels
		pos = strings.IndexRune(line, ':')
		if pos >= 0 {
			label := line[:pos]
			line = line[pos+1:]

			labels[label] = uint(len(instructions))
		}

		instructions, err = compileLine(line, instructions)
		if err != nil {
			fmt.Printf("syntax error on line %d\n", lineNum)
			fmt.Printf("\t%v\n", err)
			return
		}
		// if instr != nil {
		// 	instructions = append(instructions, instr)
		// }

	}
	file.Close();
	if err := scanner.Err(); err != nil {
		fmt.Printf("error scanning file: %v", err)
		return
	}

	fmt.Printf("compiledLines: %d\n", lineNum)
	fmt.Printf("instructions: %d\n", len(instructions))
	// link
	for num, i := range instructions {
		if !(i.LabelArg == "") {
			arg, ok := labels[i.LabelArg]
			if !ok {
				fmt.Printf("undefined label '%s'\n", i.LabelArg)
				return
			}

			i.Arg = arg
		}
		if !(i.Macro == "") {
			theMacro, ok := subMacros[i.Macro]
			if !ok {
				fmt.Printf("undefined macro '%s'\n", i.Macro)
				return
			}
			instructions[num] = theMacro(i.Arg)
		}

	}

	file, err = os.Create("output.mem")
	var counter uint;
	counter = 0;
	for _, i := range instructions {

		file.WriteString(i.String())
		file.WriteString(" ")
		counter++
		if counter % 8 == 0 {
			file.WriteString("\n")
		}
	}
	file.Close();

	file, err = os.Create("instructions.js")
	file.WriteString("Simulation.prototype.instructions = [\n")
	counter = 0
	for _, i := range instructions {
		file.WriteString("'")
		file.WriteString(i.String())
		file.WriteString("',")
		counter++
		if counter % 8 == 0 {
			file.WriteString("\n")
		}
	}
	file.WriteString("'00'\n ]")
	file.Close();

	file, err = os.Create("../arduino_program_loader/instructions.c")
	file.WriteString("int instructions[] = {\n")
	counter = 0
	for _, i := range instructions {
		file.WriteString("0x")
		file.WriteString(i.String())
		file.WriteString(",")
		counter++
		if counter % 8 == 0 {
			file.WriteString("\n")
		}
	}
	file.WriteString("0x00\n };\nint* program = &instructions;\nint program_length = ");
	file.WriteString(strconv.Itoa(len(instructions)));
	file.WriteString(";\n");
	file.Close();
}
