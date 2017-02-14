
//	global simulation class

Simulation = function()
{
	//	the PC (program counter)
	this.nextInstruction = 0;
	
	//	how many cycles (ticks) we've run.
	this.cycleCount = 0;
	
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
	];
	
	//map of inputs (Simulating IO)
	this.inputs = [
		true,
		false,
		false,
		false,
		false,
	];
	
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
	};

	//input map
	this.keys = {
		"ArrowUp": 3,
		"ArrowDown": 4,
		"w": 1,
		"s": 2
	};

	//register values
	this.registers = [
		0, 0, 0, 0,
		0, 0, 0, 0,
		0, 0, 0, 0,
		0, 0, 0, 0
	];
	
	//display emulation
	//	STT rewriting this 2017.2.5 to try to emulate more accurately...
	
	//	this.ioMemory[] contains the actual LED display registers (row, col, color)
	
	//	the display block stuff here is more of an emulation of what the eye has seen
	//	over the last little bit of time...
	//	In order to accurately simulate something like Pulse Width Modulation and persistence of vision,
	//	I really want to know the *average* on/off state of a light over time.
	//	I could have implemented a moving average, but I hate those - they trend toward inaccurate over time,
	//	if the value is changing.
	//	Yet I certainly can't store every value at every cycle, that'd be a ton of data.
	//	So, I defined "blocks" of time (in cycles),
	//	and just keep track of whether a light was on during that whole window of time,
	//	(by setting one bit)
	//	and then count those bits to get the average.
	
	//	you can play with these numbers.  I'm trying to guess what would best emulate the hardware.
	//	remember that we're running at 1MHz, so you can estimate this time window like this:
	//	displayTrackBlockSize / (1024*1024)
	this.displayTrackBlockSize = 2048;	//	how big a time window (in cycles) to watch for light being on/off
	this.displayTrackBlockCount = 32;	//	how many blocks back to look (use bits for this, for memory optimization)
	this.lastDisplayCheck = 0;
	
	//	initialize a bunch of tracking data all at once.
	this.display = [];
	for (var row = 0; row < 8; row++)
	{
		this.display[row] = [];
		for (var col = 0; col < 8; col++)
		{
			this.display[row][col] = {
				//	these are timer values from the old implementation, but they're still here in case we want them back.
				//	these are in seconds.
				//	higher time = more time has passed since last time light was set
				//	0 = was just set (lit up).
				red:99, green:99, blue:99,
				
				//	these are bitfields - see above!
				redBlocks:0x0,greenBlocks:0x0,blueBlocks:0x0,
				
				//	this is the color value (in string (html style) form) we last calculated,
				//	for displaying in the simulator.
				//	this is only updated when needed.
				show : "#323232",	//	will get calculated color after time
				
				//	this is the last set of values used to calculate the above "show" value,
				//	so we can easily check if something changed without rebuilding the "show" string.
				//	(string manipulation in javascript can be really slow)
				lastCombined : 0x323232,
			};
		}
	};
	
	//	Old implementation
	//this determines how long dots on the display linger. An attempt to fix display problems...
	//this.displayLinger = .4;

	//program memory
	//	todo: this should be 32K, right?
	//	Oh, hey...  We should not be clearing this.  McKay says it starts uncleared, with random values.
	//	Maybe for simulation, we should set random values?
	//	Yeah, let's do that!  At least the first 1K.
	this.memory = new Array(1024);
	for (var i = 0; i < this.memory.length; i++)
	{
		this.memory[i] = (Math.random() * 256)|0;
	}
	//this.memory[0] = 0;
	//this.memory[1] = 0;
	
	//	memory-mapped stuff..  Let's put this in a different block for now.
	//	In theory, these values live at 0x8000 (1000 0000 0000 0000)
	//	COULD have been added at the correct address in the above array (sparse array is fine in JavaScript)
	//	But we need custom code looking at these values as they change anyway, so no point in
	//	pretending that those addresses are not special...
	this.ioMemory = [];
	
	//	these are addresses for the above block of ioMemory
	this.ioLEDCols = 0;
	this.ioLEDRows = 1;
	this.ioLEDColor = 2;
	this.ioUnused = 3;
	this.ioButtons = 4;
	this.ioUnused2 = 5;
	//	clear out initial values
	this.ioMemory[this.ioLEDCols] = 0;
	this.ioMemory[this.ioLEDRows] = 0;
	this.ioMemory[this.ioLEDColor] = 0;
	this.ioMemory[this.ioButtons] = 0;
};

//	Placeholder instructions
//	Instructions should be overwritten by 'instructions.js' generated by the assembler
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

//set flags that are set based on register contents before the operation
Simulation.prototype.setPreFlags = function(immediate) {
	var EQUALS = 0;
	//var LT = 1;
	//var GT = 2;
	var SHIFT_OVERFLOW = 6;
	if (this.registers[0] == this.registers[immediate]) {
		this.flags[EQUALS] = true;
	} else {
		this.flags[EQUALS] = false;
	}
	if ((this.registers[0] % 2) == 1) {//shift overflow
		this.flags[SHIFT_OVERFLOW] = true;
	} else {
		this.flags[SHIFT_OVERFLOW] = false;
	}
	if (this.registers[0] < this.registers[immediate])
		this.flags[1] = true;	//	LT
	else
		this.flags[1] = false;
	if (this.registers[0] > this.registers[immediate])
		this.flags[2] = true;	//	GT
	else
		this.flags[2] = false;
}

//set flags that are set after the arithmetic operation is preformed
Simulation.prototype.setPostFlags = function(immediate) {
	var OVERFLOW = 3;
//	var INPUT = 4;
	var ANY = 5;
	var a = this.toBinaryArray(this.registers[0]);
	var b = this.toBinaryArray(this.registers[immediate]);
	this.flags[ANY] = false;
	for ( var i = 0; i < 8; i++) {
		if ( a[i] && b[i]) {
			this.flags[ANY] = true;
			break;
		}
	}
	if (this.registers[0] > 255) {
		this.registers[0] = this.registers[0] % 256;
		this.flags[OVERFLOW] = true;
	} else {
		this.flags[OVERFLOW] = false;
	}
}

//	A memory-mapped io address just got set!  May have been a display value.
//	In order to keep up to date with what should be displayed,
//	let's immediately update our display structure...
//	
//	(Under normal circumstances, we don't update display every cycle, because that's slow!
//	so, now is a good time to jump in and update)
//
Simulation.prototype.mapDisplay = function(address) {
	this.updateDisplay(0);
};

//	Update display simulation tracking.
//
//	New approach to fading (see "display block" notes above for details):
//		When updating, set a tracking bit for any light that turns on.
//		and keep those bits around for a while.
//		After so many cycles, move on to tracking a new set of bits, but keep the old
//		This way, we have a kind of sample history of when a light was on/off over time.
//		We can use that to decide how bright a light should be perceived as being...

Simulation.prototype.updateDisplay = function(dt) {	
	
	var rowFlags = this.ioMemory[this.ioLEDRows];
	var colFlags = this.ioMemory[this.ioLEDCols];
	
	var colorFlags = (this.ioMemory[this.ioLEDColor] & 0x07);
	
	//	has it been long enough (in cycles) to move to a new light sample block?
	//var	advanceSample = false;
	if (this.cycleCount > this.lastDisplayCheck + this.displayTrackBlockSize)
	{
		this.lastDisplayCheck = this.cycleCount;	//	remember when we last checked
		//advanceSample = true;
		
		//	advance to next sampling block for every light
		for (var row = 0; row < 8; row++)
		{
			for (var col = 0; col < 8; col++)
			{
				var dot = this.display[row][col];
				dot.redBlocks = dot.redBlocks << 1;
				dot.greenBlocks = dot.greenBlocks << 1;
				dot.blueBlocks = dot.blueBlocks << 1;
			}
		}
	}

	//	now immediately mark current flags/timers based on current display registers
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
				{
					dot.redBlocks |= 0x01;
					dot.red = 0;	//	reset timer
				}
				if ((colorFlags & 0x02) === 0)	//	see if this bit is clear, e.g. 101
				{
					dot.greenBlocks |= 0x01;
					dot.green = 0;	//	reset timer
				}
				if ((colorFlags & 0x04) === 0)	//	see if this bit is clear, e.g. 011
				{
					dot.blueBlocks |= 0x01;
					dot.blue = 0;	//	reset timer
				}
			}
			
		}
	}
};

//
//	Based on what we know about our lights over time,
//	calculate a "show" value for display purposes.
//	This is only called by game when it thinks it needs to update the display visually.
//
Simulation.prototype.interpretDisplay = function() {
	
	//	count number of bits on in this 32-bit value
	function countBits(i)
	{
		//	http://stackoverflow.com/questions/109023/how-to-count-the-number-of-set-bits-in-a-32-bit-integer
		i = i - ((i >>> 1) & 0x55555555);
		i = (i & 0x33333333) + ((i >>> 2) & 0x33333333);
		return (((i + (i >>> 4)) & 0x0F0F0F0F) * 0x01010101) >>> 24;
	}
	
	//	make a single color-channel value (e.g. just red) based on what bits have been on recently in the given block.
	function dotBlockToColor(dotBlocks)
	{
		var val = 50;	//	baseline gray to show dots even when off
		
		//	we expect 8 bits on in all that time,
		//	32 bits, and we'll give it 4 blocks to cycle through and come back on...
		//	at 2048, that's about 8192 cycles...
		var bitsOn = countBits(dotBlocks & 0xFFFFFFFF);
		val = 50 + ((205 * bitsOn/8)|0);
		if (val > 255)
				val = 255;
		
		/*	an idea I discarded later:
		
		//	If it was on any time in the last few blocks, make it full bright
		//	We adjust sensitivity here...
		//	basically, the number of bits we track here * displayTrackBlockSize
		//	e.g. 4 * 2048 = 8192 cycles, which at 1MHz is 1/128th of a second.
		//	determines how long lights are on before we start fading them.
		//	I don't know how long the hardware takes.
		//	I'll need to play with that and see.
		var recentMask = 0x0F;	//	look at these bits
		if (dotBlocks & recentMask)
			val = 255;
		else if (dotBlocks) {	//	has it been on at all in a while?
			var bitsOn = countBits(dotBlocks);// & 0xFFFFFFF0);	//	look at the other bits
			//	OK, I kinda expect 7 or more of those to be set...
			//	but that needs to be adjusted depending on various other factors...
			//	7 comes from : 28 (number of bits I haven't looked at) divided by 4 (number we look at at a time)
			
			val = 50 + ((205 * bitsOn/7)|0);
			
			//	and cap
			if (val > 255)
				val = 255;
				
		}
		*/
		return val;
	}
	
	//var	curColor = {r:0, g:0, b:0};
	
	for (var row = 0; row < 8; row++)
	{
		for (var col = 0; col < 8; col++)
		{
			var dot = this.display[row][col];
			//	map to useful displayable display...
			
			//var r = 50;
			//var g = 50;
			//var b = 50;
			
			var r = dotBlockToColor(dot.redBlocks);
			var g = dotBlockToColor(dot.greenBlocks);
			var b = dotBlockToColor(dot.blueBlocks);
			
			/*
			//	OLD:  a temp hack to get basic solid colors displayed,
			//	But the bit block stuff should be working well enough now
			//	and this code is too simple to do anything cool like dark colors
			
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
			*/
			
			//	if didn't change, don't go creating a new javascript string, which is slow
			if (dot.lastCombined != ((r << 16) | (g << 8) | b))	//	changed?
			{
				this.display[row][col].show = "rgba(" + r + "," + g + "," + b + ",1)";
				dot.lastCombined = ((r << 16) | (g << 8) | b);
			}
		}
	}
}

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
		case 4: //ACC
			this.registers[0] = this.registers[immediate];
			break;
		case 5: //ADD
			this.setPreFlags(immediate);
			this.registers[0] = this.registers[0] + this.registers[immediate];
			this.setPostFlags(immediate);
			break;
		case 6: //SUB
			//	temp conditional flag setting based on subtraction.
			//	todo: this should be in setFlags?
			this.setPreFlags(immediate);
			this.registers[0] = -this.registers[0] + this.registers[immediate];
			this.setPostFlags(immediate);
			break;
		case 7: //EQUAL (not used)
			break;
		case 8: //SHIFT
			this.setPreFlags(immediate);
			this.registers[0] = this.registers[0] >>> 1;	//	zero-fill right shift (don't keep sign)
			this.setPostFlags(immediate);
			//	this seems wrong to me: why is immediate even a factor here, since there really isn't one...?  Oh well...
			break;
		case 9: //AND
			this.setPreFlags(immediate);
			this.registers[0] = this.registers[0] & this.registers[immediate];
			this.setPostFlags(immediate);
			break;
		case 0xA: //OR
			this.setPreFlags(immediate);
			this.registers[0] = this.registers[0] | this.registers[immediate];
			this.setPostFlags(immediate);
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
	
	this.cycleCount++;
	
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
