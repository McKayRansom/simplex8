//
//	Sample starting point for a game
//
//	In order to set up a new app, do this:
//
//		make a new project folder
//		copy rtest.html and rename as desired
//		copy this file (js/game.js) (rename if desired)
//		edit rtest.html
//			include only the js files you want (probably all the rat/blah.js files as well as js/game.js)
//		change the bottom of rtest.html to call appInit() below, instead of init()
//		if you're adding the project to SVN, do the external reference trick to include rat,
//			OR, check out rat somewhere else and change rtest.html to refer to it from the correct location.
//			For instance, check rat out one level above your project, and change rtest.html to refer to "../rat/system.js", etc.
//

//	This approach wraps all the app functions inside an object.  You don't have to do it this way.
var app;
var XuiJSAppInit;
rat.modules.add( "rat.xuijs.game",
[
	"rat.os.r_system",
	"rat.input.r_input",
	"rat.graphics.r_graphics",
	"rat.debug.r_console",
	"rat.ui.r_screenmanager",
	"rat.math.r_math",
	"rat.xuijs.js.xui_api",
	"rat.xuijs.js.xui_screen",
], 
function(rat)
{
	app = {
		particles : null,
		ctx : null,

		waitForImagePreload : false,
		
		xuijs : null,
		//
		//	My init function.  Set up rat and some local things
		//	ops is a object with named fields to make the calling code more readable
		//	Current options
		//		waitForImagePreload : should we wait for image loads before executing the LUA
		//		useAutoClearCanvas : Does this app need to use the autoClearCanvas code (use of rat.video requires this to be true)
		//	If a true or false is passed as ops, then it is assumed to be setting the waitForImagePreload to not break existing functionality.
		init : function(initRat, ops) {
			ops = ops || {};
			app.waitForImagePreload = !!ops.waitForImagePreload;
			app.useAutoClearCanvas = !!ops.useAutoClearCanvas;
			
			var canvasElement = document.getElementById("canvas");
		
			app.ctx = canvasElement.getContext("2d");
		
			//	set up rat
			if (initRat)
				rat.init();

			xuijs = rat.xuijs;
			// Tell the system that we don't want the default close behavior.
			// This prevents us from being closed/minimized by the "B" button.
			// To handle the close, we should call Ormma.close() from the Main Manu or something similar.
			if (rat.system.has.xboxLE) {
				Ormma.useCustomClose(true);
			}
			
			//	in an environment other than the actual xboxLE,
			//	support fake keyboard->controller input
			if (!rat.system.has.xboxLE)
			{
				rat.input.gamepadKeyFakeEnabled = true;
			}
			
			//	Target an ideal screen size of 1280x720.
			rat.graphics.setAutoScaleFromIdeal(1280, 720, true, true);			// (targetW, targetH, resizeCanvas, allowAutoUpscale)
			//rat.graphics.setAutoScaleFromIdeal(1920, 1080);
			rat.graphics.setAutoClear( true, rat.graphics.black );
			
			rat.setDraw(app.draw);	//	rat will call our "draw" function below, each frame
			rat.setUpdate(app.update);	//	rat will call our "update" function below, each frame

			//	helpful debug display
			rat.system.debugDrawTiming = false;
			rat.system.debugDrawStats = false;
			rat.system.debugDrawFramerateGraph = false;

			// xui tests
			
			// Initialize the xui screen, so things can be added into it when we load the main lua file.
			app.initXuiScreen();
			
			// We need to preload the xui files before initializing lua and running the main lua file.
			function preLoadDone(){
				app.xuiLoaded = true;
				
				if (app.waitForImagePreload)
				{
					rat.console.log("Loaded XUI, waiting for image preload...");
					//	checked each frame in update() below
				} else {
					app.initLoadedLua();
				}
			}
			
			var xuiManifestFile = "media/xuiManifest.js";
			xuijs.preloadXuiData(xuiManifestFile, "", preLoadDone);
			
			// this variable is used for the loading animation before lua is loaded
			app.loadingRotation = 0;
			
		},

		//	call this when XUI files are loaded.  See above.
		initLoadedLua : function()
		{
			// Initialize Lua
			rat.console.log("Initializing Lua...");
			var luaPackageFile = "lua/packedLua.js";
			var mainLuaFile = "main_rat.lua";
			xuijs.initLua(luaPackageFile, mainLuaFile, function(successful){
				if( successful ){
					rat.console.log("Lua initialization succeeded, hooray!");
					app.luaLoaded = true;
					if (!app.useAutoClearCanvas)
						rat.graphics.setAutoClear( false );	//	let's assume xui rendering will cover everything now
				}
				else{
					rat.console.log("Lua initialization failed! Oh no!");
				}
			});
		},
		
		// Init xui stuff
		initXuiScreen : function()
		{
			//	make a full-screen-sized menu screen
			
			var screen = new xuijs.XuiScreen();
			rat.screenManager.setUIRoot(screen);
			screen.autoSizeToParent();
			
			xuijs.setXuiScreen(screen);
			
			// Set up Lua cycle update.
			// TODO: I'm not really pleased with this update callback setup, 
			// since it means each game would have to set it up,
			// but I also don't really want to pollute XuiScreen with Lua-based stuff.
			screen.setUpdateCallback(xuijs.apiUtils.LuaCycleUpdate);
			
			// Having controller button callbacks didn't fit well into the exisiting WInput setup on the Lua side, but it still might be useful.
			//screen.setButtonCallbacks(app.screenButtonDown, app.screenButtonUp);
		},
		
		// Function for calling a buttonDown function on the Lua side
		// This didn't fit well into the exisitng WInput on the Lua side, but it could be useful in other cases.
		/*
		screenButtonDown : function(event)
		{
			if( xuijs.isInitialized() ){
				var args = [event.which];
				var options = {includeSelf: true};
				xuijs.callLuaFunc("WInput", "OnControllerButtonDown", args, options);
			}
		},

		// Function for calling a buttonUp function on the Lua side
		screenButtonUp : function(event)
		{
			if( xuijs.isInitialized() ){
				var args = [event.which];
				var options = {includeSelf: true};
				xuijs.callLuaFunc("WInput", "OnControllerButtonUp", args, options);
			}
		},
		*/
		
		//	my draw function - draw background (now handled by rat.graphics auto-clear system), outside of all rat UI screens
		//	if needed.
		draw : function()
		{
		
			rat.graphics.save(app.ctx);	//	save before drawing anything that changes context

			// This code creates an animation to play on screen before the lua is loaded
			if (!app.luaLoaded || app.waitForImagePreload)
			{
			
				app.ctx.translate(rat.graphics.SCREEN_WIDTH / 2, rat.graphics.SCREEN_HEIGHT / 2);
				app.ctx.rotate(app.loadingRotation * rat.math.PI / 180);
			
				function drawMultiRadiantCircle(xc, yc, r, radientColors) {
					var partLength = (2 * Math.PI) / radientColors.length;
					var start = 0;
					var gradient = null;
					var startColor = null,
						endColor = null;

					for (var i = 0; i < radientColors.length - 2; i++) {
						startColor = radientColors[i];
						endColor = radientColors[(i + 1) % radientColors.length];

						// x start / end of the next arc to draw
						var xStart = xc + Math.cos(start) * r;
						var xEnd = xc + Math.cos(start + partLength) * r;
						// y start / end of the next arc to draw
						var yStart = yc + Math.sin(start) * r;
						var yEnd = yc + Math.sin(start + partLength) * r;

						app.ctx.beginPath();

						gradient = app.ctx.createLinearGradient(xStart, yStart, xEnd, yEnd);
						gradient.addColorStop(0, startColor);
						gradient.addColorStop(1.0, endColor);

						app.ctx.strokeStyle = gradient;
						app.ctx.arc(xc, yc, r, start, start + partLength);
						app.ctx.lineWidth = 30;
						app.ctx.stroke();
						app.ctx.closePath();

						start += partLength;
					}
				}

				var someColors = [];
				someColors.push('#000');
				someColors.push('#550');
				someColors.push('#AA0');
				someColors.push('#FF0');
				someColors.push('#FF0');
				someColors.push('#000');

				drawMultiRadiantCircle(0,0, 120, someColors);
				
			}
			
			rat.graphics.restore(app.ctx);
		},

		//	repeating update function, if needed
		update : function(dt) {
			//this updates the rotation of the loading animation
			app.loadingRotation += 500 * dt;
			
			if (app.xuiLoaded && app.waitForImagePreload && rat.graphics.isCacheLoaded())
			{
				app.waitForImagePreload = false;	//	done
				app.initLoadedLua();
				
			}
		},
		
	};

	//	When using this as a sample starter file for a new app, have your html file call this init function
	XuiJSAppInit = function( ops )
	{
		if (ops === true || ops === false)
			ops = {waitForImagePreload:ops};
		app.init(true, ops);
	};
});