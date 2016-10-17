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
	"CMP":   7,
	"SHIFT":  8,
	"AND":   9,
	"OR":    10,
	"JMP":   11,
	"STORE":  12,
	"LOAD":  13,
	"DISP":  14,
	"INPUT": 15,

	"NOOP":  0,
	"MOVE":  3,
	"JMPIF": 11,
	"EQUAL": 7,
}

var jumpConditions = map[string]uint {
	"!input":  6,
	"equal" :  1,
	"!equal":  4,
	"!any"  :  7,
}

var macros = map[string]func(uint)[]*Instruction{
	// "MOVE":
	// 		func (arg uint, arg2 uint)[]*Instruction {
	// 			return []*Instruction{
	// 				&Instruction{Opcode: ops["ACC"], Arg: arg},
	// 				&Instruction{Opcode: ops["MOV"], Arg: arg2},
	// 			}
	// 		},
	"SET":
			func (arg uint)[]*Instruction {
				return []*Instruction{
					&Instruction{Macro: "SETL", Arg: arg},
					&Instruction{Macro: "SETU", Arg: arg},
				}
			},
}

var subMacros = map[string]func(uint)*Instruction {
	"SETU":
			func (arg uint) *Instruction {
				return &Instruction{Opcode: ops["UI"], Arg: arg / 16}
			},
	"SETL":
			func (arg uint) *Instruction {
				return &Instruction{Opcode: ops["LI"], Arg: arg % 16}
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
	return fmt.Sprintf("'%01x%01x', ", i.Opcode, i.Arg)
}

func compileLine(command string, instructions []*Instruction) ([]*Instruction, error) {
	parts := strings.Fields(command)
	if len(parts) == 0 { //blank line
		return instructions, nil
	}

	op := parts[0]
	var isMacro = false
	var inst = &Instruction{}

	if len(parts) == 1 {
		return nil, fmt.Errorf("'%s' requires argument", op)
	}

	//check opCodes
	opcode, ok := ops[strings.ToUpper(op)]
	if !ok {
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
		macro := macros[inst.Macro](inst.Arg)
		macro[0].LabelArg = inst.LabelArg
		macro[1].LabelArg = inst.LabelArg
		instructions = append(instructions, macro[0])
		instructions = append(instructions, macro[1])
	}

	return instructions, nil
}

func main() {
	if len(os.Args) == 1 {
		println("Input file required")
		return
	}
	if len(os.Args) > 2 {
		println("Too many input files")
		return
	}

	file, err := os.Open(os.Args[1])
	if err != nil {
		fmt.Printf("error opening file: %v", err)
		return
	}
	defer file.Close()

	labels := make(map[string]uint)

	var instructions []*Instruction

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

	for _, i := range instructions {
		fmt.Printf(i.String())
	}
}
