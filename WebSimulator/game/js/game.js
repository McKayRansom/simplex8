//
//	game logic and main display
//

var game = {

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
		this.speed = .000001;
		this.buildHud();

	},

	exit : function()
	{
		rat.screenManager.popAllScreens();
		this.hud = null;
	},

	//
	//	Set up game HUD/UI
	//	create gamescreen object, which is the HUD overlayed over other drawing.
	//
	buildHud : function()
	{
		var gameScreen = new GameScreen();
		rat.screenManager.pushScreen(gameScreen);
		this.hud = gameScreen;
	},

	//	update game (every frame)
	update : function(dt)
	{
		//gfx.update(dt);
		//ADD: if we are running a clock
		if (this.running) {
			this.simulation.updateDisplay(dt);
			this.delta += dt;
			while (this.delta > this.speed) {
				this.delta -= this.speed;
				if (this.simulation.tick()) {
					//HALT
					this.running = false;
					return;
				}
			}
		}
	},

	//	draw under UI (if needed)
	draw : function(ctx)
	{
		var ctx = ctx;
		ctx.fillStyle = "#000000";
		ctx.fillRect(10, 10, 1200, 1200);

		ctx.fillStyle = "#FFFFFF";
		ctx.font = "70px ariel";
		ctx.fillText("Simplex8 Simulator", 50, 100, 800);
		ctx.font = "50px arial";
		ctx.textAlign = "right";
		// ctx.fillText("Template Game", 200, 200, 800);
		ctx.fillText("Registers", 260, 200, 800);
		for (i = 0; i < 16; i++) {
			ctx.fillText("$" + this.simulation.toHex(i) + ": " + this.toHex(this.simulation.registers[i]), 200, 250 + (i * 50), 400);
		}
		ctx.fillText("Program", 500, 200, 800);
		ctx.textAlign = "left";
		var startingPoint = Math.max(0, this.simulation.nextInstruction - 5)
		for (var i = startingPoint;
				i < Math.min(this.simulation.instructions.length, this.simulation.nextInstruction + 5);
				i++) {
			if (i == (this.simulation.nextInstruction)) {
				ctx.fillStyle = "#FF0000";
				ctx.fillText(this.simulation.name, 515, 250 + ((i - startingPoint) * 50), 400);
			} else {
				ctx.fillStyle = "#FFFFFF";
			}
			ctx.fillText(this.toHex(i) + ": " + this.simulation.instructions[i], 350, 250 + ((i - startingPoint) * 50), 400);
		}
		var dist = 0
		for (var row = 1; row < 129; row*=2) {
			for (var column = 0; column < 8; column++) {
				if (this.simulation.display[row][column] > 0) {
					ctx.fillStyle = "#FF0000";
				} else {
					ctx.fillStyle = "#666666";
				}

				ctx.fillRect(750 + dist, 750 - column * 52, 50, 50);

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
			this.simulation.tick();
		} else if (key == "k") {
			this.running = !this.running;
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
		return number;
		// return this.simulation.toHex(Math.floor(number/16)) + this.simulation.toHex(number % 16);
	}

};
