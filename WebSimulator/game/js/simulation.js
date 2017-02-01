Simulation = function()
{
	this.nextInstruction = 0;
	this.flags = [
		false, //EQUALS
		false, //LT
		false, //GT
		false, //OVERFLOW
		false, //input???
		false, //any
		false, //shiftOverflow
	]
	this.inputs = [
		true,
		false,
		false,
		false,
		false,
	]
	this.name = "NOOP"
	this.instructionNames = {
		'0': 'NOOP',
		'1': 'LI',
		'2' :'UI',
		'3' :'MOVE',
		'4' :'ACC',
		'5' :'ADD',
		'6' :'SUB',
		'7' :'EQUAL',
		'8' :'SHIFT',
		'9' :'AND',
		'a' :'OR',
		'b' :'JMP',
		'c' :'STORE',
		'd' :'LOAD',
		'e' :'DISP',
		'f' :'INPUT'
	}

	this.keys = {
		"ArrowUp": 1,
		"ArrowDown": 2,
		"w": 3,
		"s": 4
	}


	this.registers = [
		0, 0, 0, 0,
		0, 0, 0, 0,
		0, 0, 0, 0,
		0, 0, 0, 0
	]
	// this.instructions = [
		// "00",
		// "15", // SET 5
		// "34", // MOVE $4
		// "11", // SET 1
		// "31", // MOVE $1
		// "51", // ADD $1
		// "32", // MOVE $2
		// "41", // ACC $1
		// "33", // MOVE $3
		// "42", // ACC $2
		// "31", // MOVE $1
		// "43", // ACC $3
		// "94" // JMP $4
	// ]
	// this.instructions = [
	// '00','11','31','11','32','11','33','14',
	// '34','13','35','13','36','d1','14','21',
	// '96','46','56','36','d2','1a','21','96',
	// '86','36','d3','11','22','96','45','55',
	// '35','d4','17','22','96','85','35','1f',
	// '20','37','10','20','c7','37','45','c7',
	// '17','20','37','46','c7','41','c2','11',
	// '20','78','10','20','38','1d','20','91',
	// '11','20','38','10','28','71','1c','24',
	// '94','10','20','33','11','20','71','15',
	// '25','94','11','20','33','11','20','72',
	// '17','26','94','45','71','16','26','97',
	// '11','20','34','17','26','90','f0','16',
	// '20','72','19','27','94','46','71','18',
	// '27','97','10','20','34','19','27','90',
	// 'f0','11','20','74','16','28','91','11',
	// '20','62','32','1a','28','90','11','20',
	// '52','32','11','20','73','15','29','91',
	// '81','31','18','29','90','41','51','31',
	// '1d','20','90'
	// ]
	// this.instructions = [
	// 	'11', '20', '31', '11', '20', '32', '11', '20', '33', '14', '20', '34', '13', '20', '35', '13', '20', '36', 'f1', '19', '21', 'b6', '46', '56', '36', 'f2', '1f', '21', 'b6', '86', '36', 'f3', '16', '22', 'b6', '45', '55', '35', 'f4', '1c', '22', 'b6', '85', '35', '1f', '20', '37', '10', '20', 'e7', '37', '45', 'e7', '17', '20', '37', '46', 'e7', '41', 'e2', '10', '28', '71', '15', '24', 'b4', '10', '20', '33', '11', '20', '71', '1e', '24', 'b4', '11', '20', '33', '11', '20', '72', '1f', '25', 'b4', '45', '71', '1f', '25', 'b7', '11', '20', '34', '1f', '25', 'b0', '16', '20', '72', '10', '27', 'b4', '46', '71', '1f', '25', 'b7', '10', '20', '34', '10', '27', 'b0', '11', '20', '78', '10', '20', '38', '12', '21', 'b1', '11', '20', '38', '11', '20', '74', '19', '28', 'b1', '11', '20', '62', '32', '1d', '28', 'b0', '11', '20', '52', '32', '11', '20', '73', '18', '29', 'b1', '81', '31', '1b', '29', 'b0', '41', '51', '31', '12', '21', 'b0'
	// ]
	// this.instructions = [
	// '00',
	// '11',
	// '32',
	// '33',
	// '42',
	// '53',
	// '34',
	// '43',
	// '32',
	// '44',
	// '33',
	// '14',
	// '20',
	// 'b0'
	//
	// ]
	this.display = {
	'1' : [0, 0, 0, 0, 0, 0, 0, 0],
	'2' : [0, 0, 0, 0, 0, 0, 0, 0],
	'4' :	[0, 0, 0, 0, 0, 0, 0, 0],
	'8' :	[0, 0, 0, 0, 0, 0, 0, 0],
	'16' :	[0, 0, 0, 0, 0, 0, 0, 0],
	'32' :	[0, 0, 0, 0, 0, 0, 0, 0],
	'64' :	[0, 0, 0, 0, 0, 0, 0, 0],
	'128' :	[0, 0, 0, 0, 0, 0, 0, 0]
	}

	this.memory = new Array(256);
	this.memory[0] = 0;
	this.memory[1] = 0;
	this.displayLinger = .5;
}

Simulation.prototype.instructions = ['00', '00', '00']

Simulation.prototype.fromHex = function(toConvert) {
	var hexLookup = {
		'0': 0,
		'1': 1,
		'2' : 2,
		'3' : 3,
		'4' : 4,
		'5' :5,
		'6' :6,
		'7' :7,
		'8' :8,
		'9' :9,
		'a' :10,
		'b' :11,
		'c' :12,
		'd':13,
		'e' :14,
		'f' :15
	}
	return hexLookup[toConvert]
}

Simulation.prototype.toHex = function(decimalNumber) {
	var lookupTable = {
		"10": "a",
		"11": "b",
		"12": "c",
		"13": "d",
		"14": "e",
		"15": "f"
	}
	var numberString= decimalNumber.toString();
	//return this.toHex(Math.floor(decimalNumber/16)) + this.toHex(decimalNumber % 16);
	if (Math.floor(decimalNumber / 16) > 0) {
		//fix this someday
	} else if (decimalNumber < 10) {
		return decimalNumber.toString();
	} else {
		return lookupTable[decimalNumber];
	}
}


//WOW! this is SUPER COOL!!!
Simulation.prototype.toBinaryArray = function(decimal) {
	var binaryArray = [0, 0, 0, 0, 0, 0, 0, 0]
	for (var i = 0; i < 8; i++) {
		binaryArray[i] = decimal % 2;
		decimal = Math.floor(decimal / 2 )
	}
	return binaryArray;
}

Simulation.prototype.simulateDisplay = function(row, column) {
	if (column == 15) {
		// //RESET
		// this.display = [
	// [0, 0, 0, 0, 0, 0, 0, 0],
	// [0, 0, 0, 0, 0, 0, 0, 0],
	// [0, 0, 0, 0, 0, 0, 0, 0],
	// [0, 0, 0, 0, 0, 0, 0, 0],
	// [0, 0, 0, 0, 0, 0, 0, 0],
	// [0, 0, 0, 0, 0, 0, 0, 0],
	// [0, 0, 0, 0, 0, 0, 0, 0],
	// [0, 0, 0, 0, 0, 0, 0, 0]]
	return;
	}
	var array = this.toBinaryArray(row);
	this.display[column] = array;

	// this.display[this.registers[0]][this.registers[immediate]] = 1;
	// if (this.previousLED) {
		// this.display[this.previousLED.row][this.previousLED.column] = this.displayLinger;
	// }
	// this.previousLED = {
		// row: this.registers[0],
		// column: this.registers[immediate]
	// }
}

Simulation.prototype.testJumpCondition = function(condition) {
	if (condition == 0) {
		return true;
	} else if (condition < 8) {
		return this.flags[condition - 1]
	} else {
		return !this.flags[condition - 9]
	}
	return false;
}

Simulation.prototype.setFlags = function(immediate) {
	var EQUALS = 0;
	var OVERFLOW = 3;
	var INPUT = 4;
	var AND = 5;
	if (this.registers[0] == this.registers[immediate]) {
		this.flags[EQUALS] = true;
	} else {
		this.flags[EQUALS] = false;
	}
	var a = this.toBinaryArray(this.registers[0]);
	var b = this.toBinaryArray(this.registers[immediate]);
	this.flags[AND] = false;
	for ( var i = 0; i < 8; i++) {
		if ( a[i] && b[i]) {
			this.flags[AND] = true;
			break;
		}
	}
	if (this.registers[0] > 255) {
		this.registers[0] = this.registers[0] & 255;
		this.flags[OVERFLOW] = true;
	} else {
		this.flags[OVERFLOW] = false;
	}
}

Simulation.prototype.updateDisplay = function(dt) {
	if (this.memory[0] > 0) {
		this.display[this.memory[0].toString()] = this.toBinaryArray(this.memory[1]);
	}
	for (var row = 1; row < 129; row *= 2) {
		for (var column = 0; column < 8; column++) {
			row = row.toString()
			if (this.display[row][column] > 0 && this.display[row][column] < 1) {
				this.display[row][column] -= dt;
			} else if (this.display[row][column] == 1) {
				this.display[row][column] = this.displayLinger;
			}
		}
	}
}

Simulation.prototype.tick = function() {
	//get next instruction
	var instruction = this.instructions[this.nextInstruction];


	var opCode = instruction.substr(0, 1);
	var immediate = this.fromHex(instruction.substr(1, 1))
	this.nextInstruction++;
	switch (opCode) {

		case "0": //NOOP
			break;
		case "1": //LI
			this.registers[0] = Math.floor(this.registers[0] / 16) * 16 + immediate;
			break;
		case "2": //UI
			this.registers[0] = (this.registers[0] % 16) + (immediate * 16);
			break;
		case "3": //MOVE
			this.registers[immediate] = this.registers[0];
			break;
			break;
		case "4": //ACC
			this.registers[0] = this.registers[immediate];
			break;
		case "5": //ADD
			this.registers[0] = this.registers[0] + this.registers[immediate];
			this.setFlags(immediate);
			break;
		case "6": //SUB
			this.registers[0] = -this.registers[0] + this.registers[immediate];
			this.setFlags(immediate);
			break;
		case "7": //EQUAL
			break;
		case "8": //SHIFT
			if (this.registers[0] % 2 == 1) {
				this.flags[6] = true
			} else {
				this.flags[6] = false
			}
			this.registers[0] = Math.floor(this.registers[0] / 2)
			this.setFlags(immediate);
			break;
		case "9": //AND
			this.setFlags(immediate);
			this.registers[0] = this.registers[0] & this.registers[immediate];

			break;
		case "a": //OR
			this.setFlags(immediate);
			this.registers[0] = this.registers[0] | this.registers[immediate];
			break;
		case "b": //JMP
			//no condition:
			if (this.testJumpCondition(immediate)) {
				this.nextInstruction = this.registers[0] + this.registers[1] * 256;
			}
			break;
		case "c": //STORE
			this.memory[this.registers[0]] = this.registers[immediate];
			break;
		case "d": //LOAD
			if (!(this.registers[0] == 4)) {
				this.registers[immediate] = this.memory[this.registers[0]];
			} else {
				this.registers[immediate] = 0;
				for (var i = 1; i < 5; i++) {
					if (this.inputs[i]) {
						this.registers[immediate] += Math.pow(2, (i-1));
					}
				}
			}
			break;
		case "e": //DISP
			//this.simulateDisplay(this.registers[0], this.registers[immediate]);
			break;
		case "f": //INPUT
			// if (this.inputs[immediate]) {
			// 	this.flags[INPUT] = true;
			// } else {
			// 	this.flags[INPUT] = false;
			// }
			break;
		default:
	}
	var nextInstr = this.instructions[this.nextInstruction]
	if (!nextInstr) {
		return true;
	}
	this.name = this.instructionNames[nextInstr.substr(0,1)] + " " + nextInstr.substr(1,1);
	return false;
}

Simulation.prototype.handleKeyDown = function(key) {
	if (this.keys[key]) {
		this.inputs[this.keys[key]] = true;
	}
}

Simulation.prototype.handleKeyUp = function(key) {
	if (this.keys[key]) {
		this.inputs[this.keys[key]] = false;
	}
}
