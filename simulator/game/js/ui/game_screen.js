//
//	game screen (HUD)
//
//	See game.js for game logic and other drawing
//

/**
 * @constructor for game screen
 * @extends rat.ui.Screen
*/
rat.modules.add( "js.ui.game_screen",
[
	{name: "rat.ui.r_screen", processBefore: true },	//	we inherit from, so process first.
	"js.ui.ui",	//	we use functions and data here
],
function(rat)
{
	var GameScreen = function()
	{
		GameScreen.prototype.parentConstructor.call(this); //	default init
		
		//	set up this screen
		var screen = this;
		screen.setPos(0, 0);
		screen.setSize(rat.graphics.SCREEN_WIDTH, rat.graphics.SCREEN_HEIGHT);

		//	make title
		//var tbox = ui.makeTitleBox(screen, "[hud]");
		//this.titleBox = tbox;
		//var pos = tbox.getPos();
		
		//	make buttons
		var x = 1700;
		var y = 200;
		var b = ui.makeButtonAt(screen, "tick >", x, y);
		b.setCallback(function(e, u) {
			game.runOneTick();
		});
		y += ui.menuButtonSpacing.y;
		
		var b = ui.makeButtonAt(screen, "run >>", x, y);
		b.setCallback(function(e, u) {
			game.toggleRunning();
		});
		screen.runButton = b;
		y += ui.menuButtonSpacing.y;
		y += ui.menuButtonSpacing.y;
		
		var b = ui.makeButtonAt(screen, "reset", x, y);
		b.setCallback(function(e, u) {
			game.resetSimulation();
		});
		
		//	if you want to use the standard ui audio toggle buttons:
		//ui.makeAudioButtons(buttonLayer);
	};
	(function(){ rat.utils.inheritClassFrom( GameScreen, rat.ui.Screen ); })();

	//
	//	This screen is being activated.
	GameScreen.prototype.myScreenActivate = function()
	{
		//console.log("hud activate");
	}

	//	This screen is being deactivated
	GameScreen.prototype.myScreenDeactivate = function()
	{
		//console.log("hud deactivate");
	}

	//	handle resizing (optional)
	GameScreen.prototype.handleResize = function(screen, w, h)
	{
		//console.log("game screen resize");
		//	In this case, let's try not rebuilding everything.
		//	Let's just adjust the position of a few things.
		screen.setSize(w, h);
		
		//	rebuild stuff?
		
		//	rebuild audio buttons to position correctly
		//ui.removeAudioButtons(screen.buttonLayer);
		//ui.makeAudioButtons(screen.buttonLayer);
	};

	//	update me
	//GameScreen.prototype.updateSelf = function(dt)
	//{
	//	
	//};
	
	GameScreen.prototype.updateButtons = function()
	{
		var screen = this;
		if (game.running)
			screen.runButton.setTextValue("pause ||");
		else
			screen.runButton.setTextValue("run >>");
	};

	//	mouse down in me
	//	pass on to game.
	GameScreen.prototype.mouseDown = function(pos, ratEvent)
	{
		//console.log("mouseDown " + pos.x + ", " + pos.y);
		return game.mouseDown(pos, ratEvent);
	};

	//	mouse up in me
	//	pass on to game.
	GameScreen.prototype.mouseUp = function(pos, ratEvent)
	{
		return game.mouseUp(pos, ratEvent);
	};

	//	mouse move in me
	//	pass on to game.
	GameScreen.prototype.mouseMove = function(pos, ratEvent)
	{
		return game.mouseMove(pos, ratEvent);
	};


	//	key down in me
	//	pass on to game.
	GameScreen.prototype.handleKeyDown = function(ratEvent)
	{
		//console.log("keyDown " + ratEvent.which);
		return game.handleKeyDown(ratEvent);
	};

	GameScreen.prototype.handleKeyUp = function(ratEvent)
	{
		return game.handleKeyUp(ratEvent);
	};
	
	app.types.GameScreen = GameScreen;	//	global access to this class for my convenience
});
