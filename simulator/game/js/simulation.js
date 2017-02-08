
//	global simulation class

Simulation = function()
{
	//essential the PC (program counter)
	this.nextInstruction = 0;
	
	//	convert all instructions to binary now, instead of every tick.
	this.processInstructions();

	//current state of all flags (for conditional jumps)
	this.flags = [
		false, //EQUALS
		false, //LT
		false, //GT
		false, //OVERFLOW
		false, //input???
		false, //any
		false, //shiftOverflow
	]

	//map of inputs (Simulating IO)
	this.inputs = [
		true,
		false,
		false,
		false,
		false,
	]
	
	//the name of the current instruction for display next to the current line.
	//this.name = "NOOP"

	//a list of instruction names to generate the above
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

	//input map
	this.keys = {
		"ArrowUp": 3,
		"ArrowDown": 4,
		"w": 1,
		"s": 2
	}

	//register values
	this.registers = [
		0, 0, 0, 0,
		0, 0, 0, 0,
		0, 0, 0, 0,
		0, 0, 0, 0
	];
	
	//display emulation
	//	STT rewriting this 2017.2.5 to try to emulate more accurately...
	
	//	Keeping the "displayLinger" concept, but let's put that in a separate place, so we can
	//	eventually try to mix colors...
	
	//	this.ioMemory[] contains the actual LED display registers.
	//	this display block here is more of an emulation of what the eye has seen
	//	over the last little bit of time...
	
	this.display = [];
	for (var row = 0; row < 8; row++)
	{
		this.display[row] = [];
		for (var col = 0; col < 8; col++)
		{
			//	each of these values is a time since that color was last set,
			//	so, the longer it's been, the more faded that color.
			this.display[row][col] = {
				red:99, green:99, blue:99,
				show : "#323232",	//	will get calculated color after time
				lastCombined : 0x323232,
			};
		}
	};
	
	//this determines how long dots on the display linger. An attempt to fix display problems...
	this.displayLinger = .4;

	//program memory
	//	todo: this should be 32K, right?  Why not clear it?
	this.memory = new Array(1024);
	for (var i = 0; i < this.memory.length; i++)
	{
		this.memory[i] = 0;
	}
	//this.memory[0] = 0;
	//this.memory[1] = 0;
	
	//	memory-mapped stuff..  Let's put this in a different block for now.
	//	COULD have been added at the correct address in the above array (sparse array is fine in JavaScript)
	//	But we need custom code looking at these values as they change anyway, so no point in
	//	pretending that those addresses are not special...
	this.ioMemory = [];
	
	this.ioLEDCols = 0;
	this.ioLEDRows = 1;
	this.ioLEDColor = 2;
	this.ioUnused = 3;
	this.ioButtons = 4;
	this.ioUnused2 = 5;
	this.ioMemory[this.ioLEDCols] = 0;
	this.ioMemory[this.ioLEDRows] = 0;
	this.ioMemory[this.ioLEDColor] = 0;
	this.ioMemory[this.ioButtons] = 0;
};

//placeholder instructions Instructions should be overwritten by 'instructions.js' generated by the assembler
Simulation.prototype.instructions = ['00', '00', '00'];

//
//	Convert string instructions to binary,
//	for faster operations (strings are slow!)
Simulation.prototype.processInstructions = function()
{
	this.binInstructions = [];
	for (var i = 0; i < this.instructions.length; i++)
	{
		var instruction = this.instructions[i];
		var opCode = this.fromHex(instruction.substr(0, 1));
		var immediate = this.fromHex(instruction.substr(1, 1));
		this.binInstructions[i] = {opCode:opCode, immediate:immediate};
	};
};

// function to convert from hex to decimal
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

//function to convert to hex from decimal
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
//converts from a decimal to a binary array
Simulation.prototype.toBinaryArray = function(decimal) {
	var binaryArray = [0, 0, 0, 0, 0, 0, 0, 0]
	for (var i = 0; i < 8; i++) {
		binaryArray[i] = decimal % 2;
		decimal = Math.floor(decimal / 2 )
	}
	return binaryArray;
}

/*	old unused
Simulation.prototype.simulateDisplay = function(row, column) {
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
*/

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

//set flags after an arithmetic function.
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

//	display-related address just got set.
//	In order to keep up to date with what should be displayed,
//	let's immediately update our display structure...
//
Simulation.prototype.mapDisplay = function(address) {
	this.updateDisplay(0);
	/*
	if (this.memory[0] > 0) {
		//take the current output to the display and display it
		this.display[this.memory[0].toString()] = this.toBinaryArray(this.memory[1]);
	}
	*/
};

//	Update display simulation.
//	We do a couple of things here...
//	For one thing, we update what colors are being displayed where, depending on io memory,
//	and we also update fade timers...
Simulation.prototype.updateDisplay = function(dt) {	
	
	var rowFlags = this.ioMemory[this.ioLEDRows];
	var colFlags = this.ioMemory[this.ioLEDCols];
	
	var colorFlags = (this.ioMemory[this.ioLEDColor] & 0x07);
		
	for (var row = 0; row < 8; row++)
	{
		for (var col = 0; col < 8; col++)
		{
			var dot = this.display[row][col];
			
			//	normal decay
			dot.red += dt;
			dot.green += dt;
			dot.blue += dt;
				
			//	is this dot being controlled? 
			if (((1 << row) & rowFlags) && ((1 << col) & colFlags))
			{
				if ((colorFlags & 0x01) === 0)	//	see if this bit is clear, e.g. 110
					dot.red = 0;	//	reset timer
				if ((colorFlags & 0x02) === 0)	//	see if this bit is clear, e.g. 101
					dot.green = 0;	//	reset timer
				if ((colorFlags & 0x04) === 0)	//	see if this bit is clear, e.g. 011
					dot.blue = 0;	//	reset timer
			}
			//	map to useful displayable display...
			//	temp hack to get something displayed...
			//	But I'm set up above, I hope, to simulate mixed colors...
			
			//	baseline gray so you can see boxes
			var r = 50;
			var g = 50;
			var b = 50;
			//	how quickly (in seconds) we fade.
			var sensitive = 0.04;
			if (dot.red < sensitive)
				r = 255;
				//r = ((1-dot.red) * 235)|0 + 20;
			if (dot.green < sensitive)
				g = 255;
				//g = ((1-dot.green) * 235)|0 + 20;
			if (dot.blue < sensitive)
				b = 255;
				//b = ((1-dot.blue) * 235)|0 + 20;
			
			if (dot.lastCombined != ((r << 16) | (g << 8) | b))	//	changed?
			{
				//	if didn't change, don't go creating a new javascript string, which is slow
				this.display[row][col].show = "rgba(" + r + "," + g + "," + b + ",1)";
				dot.lastCombined = ((r << 16) | (g << 8) | b);
			}
		}
	}
	
	/*	old
	//go through each row
	for (var row = 1; row < 129; row *= 2) {
		//go through each column
		for (var column = 0; column < 8; column++) {
			//each position contains a number, this is how long until we turn it off.
			//this way each dot 'lingers' for a second before disapearing
			row = row.toString()
			if (this.display[row][column] > 0 && this.display[row][column] < 1) {
				this.display[row][column] -= dt;
			} else if (this.display[row][column] == 1) {
				this.display[row][column] = this.displayLinger;
			}
		}
	}
	*/
};

//run one machine cycle
Simulation.prototype.tick = function() {
	
	//get next instruction
	//var instruction = this.instructions[this.nextInstruction];
	var instruction = this.binInstructions[this.nextInstruction];
	//	trying to tick when we're already at end?  don't do that.
	if (!instruction) {
		//finished execution
		return true;
	}

	//var opCode = instruction.substr(0, 1);
	var opCode = instruction.opCode;
	//var immediate = this.fromHex(instruction.substr(1, 1))
	var immediate = instruction.immediate;
	this.nextInstruction++;
	switch (opCode) {

		case 0: //NOOP
			break;
		case 1: //LI
			this.registers[0] = Math.floor(this.registers[0] / 16) * 16 + immediate;
			break;
		case 2: //UI
			this.registers[0] = (this.registers[0] % 16) + (immediate * 16);
			break;
		case 3: //MOVE
			this.registers[immediate] = this.registers[0];
			break;
			break;
		case 4: //ACC
			this.registers[0] = this.registers[immediate];
			break;
		case 5: //ADD
			this.registers[0] = this.registers[0] + this.registers[immediate];
			this.setFlags(immediate);
			break;
		case 6: //SUB
			//	temp conditional flag setting based on subtraction.
			//	todo: this should be in setFlags?
			if (this.registers[0] < this.registers[immediate])
				this.flags[1] = true;	//	LT
			else
				this.flags[1] = false;
			if (this.registers[0] > this.registers[immediate])
				this.flags[2] = true;	//	GT
			else
				this.flags[2] = false;
			this.registers[0] = -this.registers[0] + this.registers[immediate];
			this.setFlags(immediate);
			break;
		case 7: //EQUAL (not used)
			break;
		case 8: //SHIFT
			if (this.registers[0] % 2 == 1) {
				this.flags[6] = true
			} else {
				this.flags[6] = false
			}
			this.registers[0] = this.registers[0] >>> 1;	//	zero-fill right shift (don't keep sign)
			//	this seems wrong to me: why is immediate even a factor here, since there really isn't one...?  Oh well...
			this.setFlags(immediate);
			break;
		case 9: //AND
			this.setFlags(immediate);
			this.registers[0] = this.registers[0] & this.registers[immediate];

			break;
		case 0xA: //OR
			this.setFlags(immediate);
			this.registers[0] = this.registers[0] | this.registers[immediate];
			break;
		case 0xB: //JMP
			//no condition:
			if (this.testJumpCondition(immediate)) {
				this.nextInstruction = this.registers[0] + this.registers[1] * 256;
			}
			break;
		case 0xC: //STORE
			if (this.registers[1] & (0x80))	//	handle memory-mapped IO
			{
				this.ioMemory[this.registers[0]] = this.registers[immediate];
				this.mapDisplay(this.registers[0]);
			} else {	//	normal write
				this.memory[this.registers[0]] = this.registers[immediate];
			}
			break;
		case 0xD: //LOAD
			if (this.registers[1] & (0x80))	//	handle memory-mapped IO
			{
				//	todo: cleaner memory-mapped IO here!  just read straight in from ioMemory, but that isn't being set yet...
				if (this.registers[0] === 4)	//	read input flags
				{
					this.registers[immediate] = 0;
					for (var i = 1; i < 5; i++) {
						if (this.inputs[i]) {
							this.registers[immediate] += Math.pow(2, (i-1));
						}
					}
				}
			} else {	//	normal read
				this.registers[immediate] = this.memory[this.registers[0]];
			}
			break;
		case 0xE: //DISP REMOVED
			//this.simulateDisplay(this.registers[0], this.registers[immediate]);
			break;
		case 0xF: //INPUT REMOVED
			// if (this.inputs[immediate]) {
			// 	this.flags[INPUT] = true;
			// } else {
			// 	this.flags[INPUT] = false;
			// }
			break;
		default:
	}
	var nextInstr = this.binInstructions[this.nextInstruction]
	if (!nextInstr) {
		//finished execution
		return true;
	}
	//update the instruction name (to be displayed next to the current line)
	//this.name = this.getInstructionName(nextInstr);
	return false;
}

Simulation.prototype.getInstructionName = function(instr)
{
	return this.instructionNames[instr.substr(0,1)] + " " + instr.substr(1,1);
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
};
