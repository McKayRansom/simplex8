package main

import (
	"bufio"
	"fmt"
	"os"
	"strconv"
	"strings"
)

var ops = map[string]uint{
	"NOOP":  0,
	"LI":    1,
	"SET":  1,
	"UI":    2,
	"SETU":  1,
	"MOVE":  3,
	"ACC":   4,
	"ADD":   5,
	"SUB":   6,
	"CMP":   7,
	"SHIFT": 8,
	"AND":   9,
	"OR":    10,
	"JMP":   11,
	"STORE": 12,
	"LOAD":  13,
	"DISP":  14,
	"INPUT": 15,
}

type Instruction struct {
	Opcode   uint
	Arg      uint
	LabelArg string
}

func (i *Instruction) String() string {
	return fmt.Sprintf("%04b%04b", i.Opcode, i.Arg)
}

func compileLine(command string) (*Instruction, error) {
	parts := strings.Fields(command)

	if len(parts) == 0 {
		return nil, nil
	}

	op := parts[0]

	opcode, ok := ops[strings.ToUpper(op)]
	if !ok {
		return nil, fmt.Errorf("invalid operation: %s", op)
	}

	if len(parts) == 1 {
		return nil, fmt.Errorf("'%s' requires argument", op)
	}

	inst := &Instruction{Opcode: opcode}

	arg := parts[1]

	if strings.HasPrefix(arg, "@") {
		label := arg[1:]

		inst.LabelArg = label

	} else {
		if strings.HasPrefix(arg, "$") {
			arg = arg[1:]
		}

		argu, err := strconv.ParseUint(arg, 10, 4)
		if err != nil {
			return nil, fmt.Errorf("error parsing argument: %v", err)
		}

		inst.Arg = uint(argu)
	}

	if len(parts) > 2 {
		return nil, fmt.Errorf("too many arguments")
	}

	return inst, nil
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

		// handle labels
		pos = strings.IndexRune(line, ':')
		if pos >= 0 {
			label := line[:pos]
			line = line[pos+1:]

			labels[label] = uint(len(instructions))
		}

		instr, err := compileLine(line)
		if err != nil {
			fmt.Printf("syntax error on line %d\n", lineNum)
			fmt.Printf("\t%v\n", err)
			return
		}

		if instr != nil {
			instructions = append(instructions, instr)
		}
	}

	if err := scanner.Err(); err != nil {
		fmt.Printf("error scanning file: %v", err)
		return
	}

	// link
	for _, i := range instructions {
		if i.LabelArg == "" {
			continue
		}

		arg, ok := labels[i.LabelArg]
		if !ok {
			fmt.Printf("undefined label '%s'\n", i.LabelArg)
			return
		}

		i.Arg = arg
	}

	for _, i := range instructions {
		fmt.Println(i.String())
	}
}
