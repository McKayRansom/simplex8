//
//	app module
//

//	this license block appears with other comments stripped in compiled version.
/**
* @license
* template, Copyright whoever.  All Rights Reserved.
* Rat is owned by Wahoo Studios, Inc.  See rat.js license.
* Firebase (embedded below in compiled version) is owned by Firebase, Inc.  See license URL below.
*/

//	global app object for this project
var app = {
	
	release : false,	//	use this to globally flag things like turning off cheats.
	
	//	user settings/preferences stored locally
	settings : {
		version: 1,	//	current settings version
		soundOn : true,
		musicOn : true,
		
		admin : false,	//	useful flag to indicate (and store) that the player is a developer and has special access
		
		debug : {
			
		},
		
		//	add your own settings here
	},
	
	//	app config - display constants, debugging settings, etc.
	config : {
		
	},
	
	ctx : null,	//	global app rendering context - for convenient access
	
	state : 'loading',
	
	//
	//	My one-time app init function.  Set up rat and some local things
	//
	init: function () {

		console.log("--- app.init");
	
	    var canvasElement = document.getElementById("canvas");
	    app.canvasElement = canvasElement;
	
		app.ctx = canvasElement.getContext("2d");

		//	set up rat
		rat.init();
	
		audio.init();	//	start audio loading
		
		ui.init();
		
		app.setupGraphics();
	
		rat.setDraw(app.draw);	//	rat will call our "draw" function below, each frame
		//rat.setPostUIDraw(app.postDraw);	//	rat will call our "postDraw" function below, each frame
		rat.setUpdate(app.update);	//	rat will call our "update" function below, each frame

		rat.addEventListener('resize', app.resizeHandler);

		//	helpful debug display
		//rat.system.debugDrawTiming = true;
		//rat.system.debugDrawStats = true;
		//rat.system.debugDrawFramerateGraph = true;

		//	Here is where you'd start preloading a bunch of images,
		//	which will mean there's time between startup and loading being complete.
		//	other modules (like gfx modules) may also add things to the preload list.
		rat.graphics.preLoadImages([
			//"blah.png",
		]);
		
		//	gfx system init
		//gfx.oneTimeInit();
		//	effects system init
		effects.oneTimeInit();
		
		game.oneTimeInit();
		
		//	canvas starts empty, so background draws, which is some gray color,
		//	if we didn't change CSS.
		//	let's fill canvas to something more interesting for now.
		//	Even black is more interesting.
		app.ctx.fillStyle = "#000000";
		app.ctx.fillRect(0, 0, app.canvasElement.width, app.canvasElement.height);
		
		app.initTelemetry();
		
		//	reenable this when you know what prefix you want to use for localstore
		//app.storage = rat.storage.getStorage(rat.storage.permanentLocal);
		//app.storage.setPrefix("xxxxxxx_");		
		//app.readSettings();
		
		app.state = 'loading';
		
		console.log("--- app.init done");
		
		//	see initAfterLoad() for continuation...
	},
	
	//	After our initial loading is done, this is called, and we can initialize more stuff.
	initAfterLoad : function()
	{
		//gfx.initAfterLoad();
		
		var start = 'main';	//	by default, go to main menu
		//	let settings override that, if somebody wants to store that value instead of changing code.
		//if (app.settings.debug.skipTo)
		//	start = app.settings.debug.skipTo;
		
		//app.state = 'menus';
		//app.gotoScreen(start);
		
		app.gotoGame();
		
	},
	
	gotoGame : function()
	{
		game.init();
		app.state = 'play';
	},
	
	//	init stats tracking (telemetry)
	initTelemetry : function()
	{
		/*
		
		This is all good to go.
		Just use a real telemetry addresss, and start making calls like rat.telemetry.sessionLog()
		
		var telemAddress;
		if (app.release)
			telemAddress = 'https://whalebunny.firebaseio.com/xxxxxxx/telem/';
		else
			telemAddress = 'https://whalebunny.firebaseio.com/xxxxxxxd/telem/';
	
		//	example log for reference, from another game.
		//	|[3:!][4:!][5:!][6:!][7:!][8:!][9:!][10::UA:UD:UA:UD:UA:UD^^:UA:UD:UA:UD~][11:"
		rat.telemetry.init(telemAddress);
		rat.telemetry.userIncrement("_uses", 1);
		rat.telemetry.sessionLog("|v" + app.version + "|");	//	start
		*/
	},
	
	//
	//	Set up display resolution and resize handling stuff
	setupGraphics : function()
	{
		var autoResizeCanvas = true; //  in the web, yes, scale to ideal target
		var allowAutoUpscale = false;
		var idealW = 2048;
		var idealH = 1536;
		//	todo:  You know, since we're adapting to final window size anyway (autoFillOnResize),
		//		maybe this "ideal" w/h should be a square, so things don't get so tiny when
		//		the window is tall.
		if (rat.system.has.windows8) {
			allowAutoUpscale = true;	//	let graphics system scale up on high-res devices
			//	use real view aspect ratio after scaling
			//	(e.g. SCREEN_WIDTH and height will not be idealW and idealH, and we'll need to
			//	react to that after each resize.
			rat.graphics.autoFillOnResize = true;
		} else {
			//	ACTUALLY... let's try to do the same we do for win8, for easier testing.
			allowAutoUpscale = true;
			rat.graphics.autoFillOnResize = true;
		}
		rat.graphics.setAutoScaleFromIdeal(idealW, idealH, autoResizeCanvas, allowAutoUpscale);

		//	TODO: We should not be autoclearing most screens.
		rat.graphics.autoClearCanvas = true;
		rat.graphics.autoClearColor = "#0A3214";
		
		app.resizeHandler();
		
	},
	
	//	resize handler - called after rat does its thing.
	resizeHandler: function()
	{
		//console.log("resize handler");
		
		//	adjust/center UI, if we have some
		ui.resizeHandler();
	},
	
	//	repeating update function, if needed
	update : function(dt) {
	
		if (app.state === 'loading')
		{
			//	detect the completion of loading
			if (rat.graphics.isCacheLoaded() && rat.audio.isCacheLoaded())
			{
				console.log("initial shell load done.");
				app.initAfterLoad();
			}
		}
		else if (app.state === 'play')
			game.update(dt);
		
		effects.update(dt);
		
		//app.stateTime += dt;
	},
	
	//	My draw function, mostly to handle loading state before everything's set up
	draw : function() {
		var ctx = app.ctx;
		
		//	use actual canvas size during loading - ignore rat setup?
		//var SCREEN_WIDTH = app.canvasElement.width;
		//var SCREEN_HEIGHT = app.canvasElement.height;
		var SCREEN_WIDTH = rat.graphics.SCREEN_WIDTH;
		var SCREEN_HEIGHT = rat.graphics.SCREEN_HEIGHT;
		
		if (app.state === 'loading')
		{
			//	custom loading rendering
		}
		else
			game.draw(ctx);
		
		//	feel free to move this
		effects.particles.draw();
	},
	
	//	draw on top of UI elements
	//postDraw : function()
	//{
	//	if (app.state === 'loading')
	//	{
	//	}
	//	else
	//	{
	//		game.postDraw(app.ctx);
	//		//effects.uiParticles.draw();
	//	}
	//},
	
	//	debug tool to change skipto and write it out to prefs.
	skipTo : function(what)
	{
		if (!app.settings.admin)
			return;
		app.settings.debug.skipTo = what;
		app.writeSettings();
		console.log("set skipTo to " + what);
	},
	
	//	write settings
	writeSettings : function()
	{
		app.storage.setObject('settings', app.settings);
	},
	
	//	read settings
	readSettings : function()
	{
		rat.console.log("read settings");
		var settings = app.storage.getObject('settings');
		var updateSettings = false;	//	do we need to write back out after a fix?
		if (settings) {
			app.settings = settings;
		} else {
			rat.console.log("no settings");
			updateSettings = true;
		}
		
		//	make up a user ID that we can use to uniquely identify us for various things.
		if (typeof(app.settings.userID) === 'undefined')
		{
			var d = new Date();
			var m = d.getUTCMonth();
			var day = d.getUTCDate();
			var prefix = '' + (d.getUTCFullYear() - 2000) + ((m < 9) ? '0' : '') + (m+1) + ((day < 10) ? '0' : '') + day;
			
			app.settings.userID = prefix + '_' + rat.utils.makeID(10);
			rat.console.log("new user id " + app.settings.userID);
			
			updateSettings = true;
		}
		
		//	another example of how to fill in default value for missing var
		/*
		if (typeof(app.settings.scores) === 'undefined')
		{
			app.settings.scores = [];
			updateSettings = true;
		}
		*/
		if (typeof(app.settings.debug) === 'undefined')
		{
			app.settings.debug = {};
			updateSettings = true;
		}
		
		//	update right now so we don't have these missing fields in the future
		if (updateSettings)
			app.writeSettings();

		//	update system sound setting based on settings
		ui.updateAudioButtons();
		rat.audio.soundOn = app.settings.soundOn;
	},
}

