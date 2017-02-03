//
//	main display and UI
//	simulation logic is handled in simulation.js module.
//
/*
	TODO:
	
		* edit register values on the fly
		* edit memory on the fly, including input/output and display
		* visual buttons to simulate input buttons?
		* display input button state?
		* dump disassembled program to console?
		* on jump command, show arrow up/down
		* show marker next to current instruction, not just color
*/

rat.modules.add( "js.game",
[
	//	dependencies...
	"rat.ui.r_ui",
	
	//	moved these to explicit sync load in rat.load call, to guarantee it's ready before instructions.js...
	//"js/simulation",
	//"../../assembler/instructions.js",
	
	"js.audio",
	"js.graphics.effects",
	"js.ui.game_screen",
],
function (rat) 
{
var game = {

	//	for tracking which register values changed this update - a visual thing only
	previousRegisters : [
		0, 0, 0, 0,
		0, 0, 0, 0,
		0, 0, 0, 0,
		0, 0, 0, 0
	],
	
	//	One-time init per launch.
	oneTimeInit : function()
	{

	},

	//
	//	init, per level session
	//
	init : function()
	{
		this.state = 'play';
		this.simulation = new Simulation();
		this.delta = 0;
		
		//	STT:  I have an easier time thinking about this math if we start with a simulated processor speed.
		this.processorSpeed = 1 * 1024 * 1024;
		this.speedMultiplier = 1;	//	this is what we control with UI to speed up and slow down the simulation
		
		//	old value
		//this.speed = .000001;	//	1MHz in seconds per cycle (1/1MHz)

		this.buildHud();
	},

	exit : function()
	{
		rat.screenManager.popAllScreens();
		this.hud = null;
	},
	
	//	reset everything
	resetSimulation : function()
	{
		this.simulation = new Simulation();
		this.running = false;
		this.hud.updateButtons();
		this.previousRegisters = rat.utils.copyObject(this.simulation.registers);
	},

	//
	//	Set up game HUD/UI
	//	create gamescreen object, which is the HUD overlayed over other drawing.
	//
	buildHud : function()
	{
		var gameScreen = new app.types.GameScreen();
		rat.screenManager.pushScreen(gameScreen);
		this.hud = gameScreen;
	},

	//	update game (every frame)
	update : function(dt)
	{
		//gfx.update(dt);
		if (this.running) {
			this.simulation.updateDisplay(dt);
			//this.delta += dt;
			//run multiple machine cycles per frame
			//	track register change across the whole update, so remember values now
			this.previousRegisters = rat.utils.copyObject(this.simulation.registers);
			//while (this.delta > this.speed) {

			//	new approach to speed - try to natively run the speed of the processor...
			//	which is .. what?  Let's pretend 2MHz first...
			var runCycles = this.processorSpeed * dt * this.speedMultiplier;
			
			for (var i = 0; i < runCycles; i++)
			{
				if (this.simulation.tick()) {
					//HALT
					this.running = false;
					this.hud.updateButtons();
					break;
				}
			}
		}
	},
	
	toggleRunning : function()
	{
		this.running = !this.running;
		this.hud.updateButtons();
	},
	runOneTick : function()
	{
		//	figure out how much time passes in one tick, so we can update the display simulator by that much time.
		var secondsPerCycle = 1 / this.processorSpeed;
		this.simulation.updateDisplay(secondsPerCycle);
		
		this.previousRegisters = rat.utils.copyObject(this.simulation.registers);
		this.simulation.tick();
	},

	//	draw under UI (if needed)
	draw : function(ctx)
	{
		var ctx = ctx;
		ctx.fillStyle = "#000000";
		ctx.fillRect(10, 10, 1400, 1400);

		ctx.fillStyle = "#FFFFFF";
		ctx.font = "70px arial";
		ctx.fillText("Simplex8 Simulator", 50, 100, 800);
		
		//draw Registers		
		
		ctx.font = "50px arial";
		ctx.fillText("Registers", 40, 200, 800);
		
		//	monospace font for values
		ctx.font = "bold 48px courier new";
		
		ctx.textAlign = "right";
		var labelX = 150;	//	register name
		var valueX = 250;	//	register value
		var startY = 300;
		for (i = 0; i < 16; i++) {
			var yPos = startY + (i * 50);
			//	color recently changed registers
			if (this.simulation.registers[i] === this.previousRegisters[i])
				ctx.fillStyle = "#FFFFFF";
			else
				ctx.fillStyle = "#FFFF00";
			ctx.fillText("$" + this.simulation.toHex(i) + ":", labelX, yPos);
			var val = this.toHex(this.simulation.registers[i]);
			while (val.length < 3)	//	pad to 3 characters with 0, to fill out to 256 (toHex doesn't really convert, currently)
				val = "0"  + val;
			ctx.fillText(val, valueX, yPos);
			//ctx.fillText("$" + this.simulation.toHex(i) + ": " + this.toHex(this.simulation.registers[i]), 200, 270 + (i * 50), 400);
		}
	
		//draw Program (the closest 10 lines of it anyway)
		ctx.font = "50px arial";
		ctx.fillText("Program", 600, 200, 800);
		
		//	monospace font for values
		ctx.font = "bold 48px courier new";
		
		var startingPoint = Math.max(0, this.simulation.nextInstruction - 5)
		var labelX = 550;
		var valueX = 600;
		var startY = 300;
		for (var i = startingPoint;
				i < Math.min(this.simulation.instructions.length, this.simulation.nextInstruction + 5);
				i++) {
			
			//	default styles for text
			var lineStyle = "#FFFFFF";
			var instructionStyle = "#A0A0A0";
			
			//	for current instruction, draw it all in light green
			if (i == (this.simulation.nextInstruction)) {
				lineStyle = "#80FF80";
				instructionStyle = "#80FF80";
			}
			
			//	draw line number and instruction right-adjusted
			ctx.fillStyle = lineStyle;
			ctx.textAlign = "right";
			ctx.fillText(this.toHex(i) + ": " + this.simulation.instructions[i], labelX, startY + ((i - startingPoint) * 50), 400);
			
			//	draw instruction disassembled
			//	(STT changed this to happen all the time instead of just on the current line)
			ctx.fillStyle = instructionStyle;
			ctx.textAlign = "left";
			
			var instructionName = this.simulation.getInstructionName(this.simulation.instructions[i]);
			ctx.fillText(instructionName, valueX, startY + ((i - startingPoint) * 50), 400);
			
		}

		//draw display
		var dist = 0
		var displayX = 850;
		for (var row = 1; row < 129; row*=2) {
			for (var column = 0; column < 8; column++) {
				if (this.simulation.display[row][column] > 0) {
					ctx.fillStyle = "#FF0000";
				} else {
					ctx.fillStyle = "#666666";
				}

				ctx.fillRect(displayX + dist, 750 - column * 52, 50, 50);

			}
			dist += 52
		}
	},

	//	draw over UI (if needed)
	//postDraw : function(ctx)
	//{
		//ctx.fillStyle = "#101030";
		//ctx.fillRect(0, 0, rat.graphics.SCREEN_WIDTH, rat.graphics.SCREEN_HEIGHT);
	//},

	mouseMove : function(pos, ratEvent)
	{
		return true;
	},

	mouseDown : function(pos, ratEvent)
	{
		//effects.testEffect(pos.x, pos.y);
		//audio.playSound('hit');

		return true;
	},

	mouseUp : function(pos, ratEvent)
	{
		return false;
	},
	
	handleKeyDown : function(event)
	{
		var key = event.sysEvent.key;
		if (key == "t") {
			this.runOneTick();
		} else if (key == "k") {
			this.toggleRunning();
		} else if (key == "r") {
			this.resetSimulation();
		} else {
			this.simulation.handleKeyDown(key);
		}
		return false;
	},

	handleKeyUp : function(event)
	{
		var key = event.sysEvent.key;
		this.simulation.handleKeyUp(key);
		return false;
	},

	toHex : function(number)
	{
		//	I'm not sure what McKay wanted here.  Is it commented out because he didn't like the hex display?
		return "" + number;
		// return this.simulation.toHex(Math.floor(number/16)) + this.simulation.toHex(number % 16);
	},
	
	dumpDisassembly : function()
	{
		//	dump entire disassembled program to console
		console.log("dumping " + this.simulation.instructions.length + " instructions:");
		var text = "";
		for (var i = 0; i < this.simulation.instructions.length; i++)
		{
			var instructionText = this.simulation.getInstructionName(this.simulation.instructions[i]);
			text += instructionText + "\n";
		}
		console.log(text);
	},

};
	//global access
	window.game = game;

});
