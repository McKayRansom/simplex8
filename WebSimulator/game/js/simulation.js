Simulation = function()
{
	this.nextInstruction = 0;
	this.flags = [
		false, //EQUALS
		false, //OVERFLOW
		false, //INPUT
		false, //AND
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
		'9' :'JMP',
		'a' :'STORE',
		'b' :'LOAD',
		'c' :'DISP',
		'd':'INPUT',
		'e' :'FREE',
		'f' :'HALT'
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
	this.instructions = [
	'00','11','31','11','32','11','33','14',
	'34','13','35','13','36','d1','14','21',
	'96','46','56','36','d2','1a','21','96',
	'86','36','d3','11','22','96','45','55',
	'35','d4','17','22','96','85','35','1f',
	'20','37','10','20','c7','37','45','c7',
	'17','20','37','46','c7','41','c2','11',
	'20','78','10','20','38','1d','20','91',
	'11','20','38','10','28','71','1c','24',
	'94','10','20','33','11','20','71','15',
	'25','94','11','20','33','11','20','72',
	'17','26','94','45','71','16','26','97',
	'11','20','34','17','26','90','f0','16',
	'20','72','19','27','94','46','71','18',
	'27','97','10','20','34','19','27','90',
	'f0','11','20','74','16','28','91','11',
	'20','62','32','1a','28','90','11','20',
	'52','32','11','20','73','15','29','91',
	'81','31','18','29','90','41','51','31',
	'1d','20','90'
	]
	this.display = [
	[0, 0, 0, 0, 0, 0, 0, 0],
	[0, 0, 0, 0, 0, 0, 0, 0],
	[0, 0, 0, 0, 0, 0, 0, 0],
	[0, 0, 0, 0, 0, 0, 0, 0],
	[0, 0, 0, 0, 0, 0, 0, 0],
	[0, 0, 0, 0, 0, 0, 0, 0],
	[0, 0, 0, 0, 0, 0, 0, 0],
	[0, 0, 0, 0, 0, 0, 0, 0]
	]
	
	this.memory = new Array(256);
	this.displayLinger = .9;
}

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
	switch (condition) {
		case 0:
			return true;
		case 1: //EQUALS
		case 2: //OVERFLOW
		case 3: //INPUT
			if (this.flags[condition - 1]) {
				return true;
			}
			break;
		case 4: //NOT EQUALS
		case 5: //NOT OVERFLOW
		case 6: //NOT INPUT
		case 7: //NOT AND
			if (!this.flags[condition - 4]) {
				return true
			}
			break;

	}
	return false;
}

Simulation.prototype.updateDisplay = function(dt) {
	for (var row = 0; row < 8; row++) {
		for (var column = 0; column < 8; column++) {
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
	var EQUALS = 0;
	var OVERFLOW = 1;
	var INPUT = 2;
	var AND = 3;
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
			break;
		case "6": //SUB
			this.registers[0] = -this.registers[0] + this.registers[immediate];
			break;
		case "7": //EQUAL
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
			
			break;
		case "8": //SHIFT
			this.registers[0] = Math.floor(this.registers[immediate] / 2)
			break;
		case "9": //JMP
			//no condition:
			if (this.testJumpCondition(immediate)) {
				this.nextInstruction = this.registers[0];
			}
			break;
		case "a": //STORE
			this.memory[this.registers[0]] = this.registers[immediate];
			break;
		case "b": //LOAD
			this.registers[immediate] = this.memory[this.registers[0]];
			break;
		case "c": //DISP
			this.simulateDisplay(this.registers[0], this.registers[immediate]);
			break;
		case "d": //INPUT
			if (this.inputs[immediate]) {
				this.flags[INPUT] = true;
			} else {
				this.flags[INPUT] = false;
			}
			break;
		case "e": //FREE?
		case "f" : //HALT
			return true;
		default:
	}
	var nextInstr = this.instructions[this.nextInstruction]
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



