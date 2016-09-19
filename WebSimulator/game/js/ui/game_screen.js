//
//	game screen (HUD)
//
//	See game.js for game logic and other drawing
//

/**
 * @constructor for game screen
 * @extends rat.ui.Screen
*/
GameScreen = function()
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
	
	//ui.makeAudioButtons(buttonLayer);
};
//GameScreen.inheritsFrom(rat.ui.Screen);
(function(){ rat.utils.inheritClassFrom( GameScreen, rat.ui.Screen ); })();

//
//	This screen is being activated.
GameScreen.prototype.myScreenActivate = function()
{
	console.log("hud activate");
}

GameScreen.prototype.myScreenDeactivate = function()
{
	console.log("hud deactivate");
}

GameScreen.prototype.handleResize = function(screen, w, h)
{
	//console.log("game screen resize");
	//	In this case, let's try not rebuilding everything.
	//	Let's just adjust the position of a few things.
	screen.setSize(w, h);
	
	//	rebuild stufd...
	//console.log("screenw : " + screen.size.x + " .. " + w);

	//	rebuild audio buttons to position correctly
	ui.removeAudioButtons(screen.buttonLayer);
	ui.makeAudioButtons(screen.buttonLayer);
};

//	update me
//GameScreen.prototype.updateSelf = function(dt)
//{
//	
//};

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
