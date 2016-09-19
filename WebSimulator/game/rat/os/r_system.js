//
//	@todo	move a bunch of graphics stuff to r_graphics...
//
rat.modules.add( "rat.os.r_system",
[
	"rat.graphics.r_graphics",
	"rat.debug.r_console",
	"rat.debug.r_profiler",
	"rat.math.r_math",
	
	{ name: "rat.os.r_le_core", platform: "xboxLE" } // Platform file
], 
function(rat)
{
	rat.paused = false; // For Cheats
	
	//	todo move to "debug" subobject, and move to r_debug module
	//	and rename functions and variables = it's confusing how they conflict/contrast
	rat.system.debugDrawTiming = false;
	rat.system.debugDrawStats = false;
	rat.system.debugDrawFramerateGraph = false;
	rat.system.debugDrawMemoryGraph = false;
	rat.system.debugFramerateGraphSettings = {
		bounds: {}
	};
	rat.system.debugDrawConsole = false;

	rat.system.load = null;
	rat.system.commandHandler = null;
	rat.system.hasFocus = true;
	if (window.hasFocus)
		rat.system.hasFocus = window.hasFocus();
	else if (document.hasFocus)
		rat.system.hasFocus = document.hasFocus();
	rat.preLoadTimer = null;

	rat.mousePos = {x:-1, y:-1};	//	better way to mark whether we've ever actually gotten the mouse position from a move?

	/**
	* @param {string=} canvasID
	* @suppress {uselessCode} - rat.system.load may not exist.
	*/
	rat.init = function (canvasID)
	{
		rat.console.log("Initalizing Rat...");
		//rat.console.log("rs: " +rat.system);

		if(rat.system.load)
			rat.system.load();
		canvasID = canvasID || "canvas";

		rat.detectPlatform();	//	detect platform and capabilities
		rat.profiler.init();
		rat.graphics.init(canvasID);
		if( rat.particle )
			rat.particle.init();
		if( rat.audio )
			rat.audio.init();
		if (rat.clipboard)
			rat.clipboard.init();
		
		//	eventually, call cycle, which will set itself up repeatedly.
		//setInterval(rat.system.cycle, 1000 / 60);
		//setTimeout(rat.system.cycle, 1000 / 60);
		window.requestAnimationFrame(rat.system.cycle);

		if( rat.input )
		{
			rat.input.init();
			rat.input.autoHandleEvents();
		}
		
		rat.console.registerCommand("showMemory", function (cmd, args)
		{
			var on = rat.system.debugDrawMemoryGraph;
			rat.system.debugDrawMemoryGraph = !on;
		}, ["showMemory", "memory"]);
	};

	rat.preLoadImages = function (imageList, postLoadFunction)
	{
		rat.postLoadFunction = postLoadFunction;
		rat.graphics.preLoadImages(imageList);	//	start the loading process
		rat.preLoadTimer = setInterval(rat.processPreLoad, 1000 / 60);	//	check back from time to time
	};

	rat.processPreLoad = function ()
	{
		if(rat.graphics.isCacheLoaded())
		{
			rat.console.log("rat preload done.");
			clearInterval(rat.preLoadTimer);
			rat.preLoadTimer = null;
			if(typeof rat.postLoadFunction !== 'undefined')
				rat.postLoadFunction();
		}
	};

	rat.setDraw = function (f)
	{
		rat.draw = f;
	};

	rat.setPostUIDraw = function (f)
	{
		rat.postUIDraw = f;
	};

	rat.setUpdate = function (f)
	{
		rat.update = f;
	};

	//
	//	main engine loop - do all updates and draw everything
	//
	rat.system.lastCycleTime = 0;
	rat.system.cycle = function ()
	{
		//	John:  This makes things harder for me when working in chrome - 
		//	I want chrome to give me the exception, not rat.  :)
		//	We could move all this code into a subroutine and then maybe optionally support a try/catch around it,
		//	based on platform or config or something?
		//try
		//{
			//	begin new frame
			rat.graphics.beginFrame();

			rat.profiler.pushPerfMark("Rat.System.Cycle");
			window.requestAnimationFrame(rat.system.cycle);	//	request next cycle immediately

			//	This is a system for capping framerate.  This avoids those super high spikes we get when the system
			//	suddenly gives us an update again very quickly.  Is this desirable?  I'm not sure.
			//if (0)
			//{
			//	var now = new Date().getTime();//Date().now();
			//	var elapsed = now - rat.system.lastCycleTime;

			//	var fpsInterval = rat.math.floor(1000/15);	//	1000/60 = 60 fps interval
			//	if (elapsed < fpsInterval)
			//		return;

			//	rat.system.lastCycleTime = now;// - (elapsed % fpsInterval);
			//}

			//	TODO:  move the above, and update deltatime into a new rat module, r_timing
			//		split timing loops into update and rendering?
			//		have updateDeltaTime tell us whether we've hit the minimum threshold for processing (to incorporate the above minimum check)

			

			//	update
			rat.profiler.pushPerfMark("updateDeltaTime");
			rat.system.updateDeltaTime();
			rat.profiler.popPerfMark("updateDeltaTime");

			if(rat.update)
			{
				rat.profiler.pushPerfMark("GameUpdate");
				rat.update(rat.deltaTime);
				rat.profiler.popPerfMark("GameUpdate");
			}

			if( rat.input )
			{
				rat.profiler.pushPerfMark("input.update");
				rat.input.update(rat.deltaTime);
				rat.profiler.popPerfMark("input.update");
			}

			if( rat.ui )
			{
				rat.profiler.pushPerfMark("ui.updateAnimators");
				rat.ui.updateAnimators(rat.deltaTime);
				rat.profiler.popPerfMark("ui.updateAnimators");
			}

			rat.profiler.pushPerfMark("updateScreens");
			rat.screenManager.updateScreens();
			rat.profiler.popPerfMark("updateScreens");
			
			if (rat.audio.update)
				rat.audio.update(rat.deltaTime);

			if(rat.cycleUpdate)
			{
				rat.profiler.pushPerfMark("cycleupdate");
				rat.cycleUpdate.updateAll(rat.deltaTime);
				rat.profiler.popPerfMark("cycleupdate");
			}
			
			if(rat.timerUpdater)
			{
				rat.profiler.pushPerfMark("timerUpdate");
				rat.timerUpdater.updateAll(rat.deltaTime);
				rat.profiler.popPerfMark("timerUpdate");
			}

			if (rat.Rumble && rat.Rumble.supported)
				rat.Rumble.frameUpdate(rat.deltaTime);

			//	draw, starting with global transform if any, and then installed draw routine
			rat.profiler.pushPerfMark("Rendering");
			rat.graphics.save();

			rat.graphics.setupMatrixForRendering();
			if(rat.graphics.autoClearCanvas)
			{
				rat.profiler.pushPerfMark("Clearing Canvas");
				rat.graphics.clearCanvas();
				rat.profiler.popPerfMark("Clearing Canvas");
			}

			if (rat.graphics.canvas.style && rat.graphics.canvas.style.backgroundImage && rat.system.has.Wraith)
			{
				rat.graphics.canvas.style.backgroundImage.drawTiled(rat.graphics.canvas.width, rat.graphics.canvas.height);
			}

			if (rat.beforeDraw)
			{
				rat.profiler.pushPerfMark("BEFORE draw");
				rat.beforeDraw();
				rat.profiler.popPerfMark("BEFORE draw");
			}
			
			if(rat.draw)
			{
				rat.profiler.pushPerfMark("rat.draw");
				rat.draw();
				rat.profiler.popPerfMark("rat.draw");
			}

			if( rat.screenManager )
			{
				rat.profiler.pushPerfMark("screen draw");
				rat.screenManager.drawScreens();
				rat.profiler.popPerfMark("screen draw");

				if (rat.postUIDraw)
				{
					rat.profiler.pushPerfMark("post UI draw");
					rat.postUIDraw();
					rat.profiler.popPerfMark("post UI draw");
				}
			}

			//	draw debug display, if it's turned on
			//	We used to do this after scale/translate, so we can be sure to be in the bottom corner...
			//	but that's lame.  For one thing, it makes it hard to see on high-res displays!
			//	Also, these variable names are ridiculous, but they're sort of embedded in many apps at this point.
			//	could at least rename the functions...  Or deprecate the old names but keep supporting them...?
			rat.profiler.pushPerfMark("Debug Rendering");
			rat.console.drawConsole();
			if(rat.system.debugDrawTiming)
				rat.system.drawDebugTiming();
			if(rat.system.debugDrawStats)
				rat.system.drawDebugStats();
			if (rat.system.debugDrawFramerateGraph)
				rat.system.drawDebugFramerateGraph();
			if (rat.system.debugDrawMemoryGraph)
				rat.system.drawDebugMemoryGraph();
			if(rat.system.debugDrawConsole)
				rat.console.drawLog();
			if (rat.profiler && rat.profiler.displayStats)
			{
				rat.profiler.pushPerfMark("Profiler draw");
				rat.profiler.displayStats();
				rat.profiler.popPerfMark("Profiler draw");
			}
			rat.profiler.popPerfMark("Debug Rendering");

			rat.graphics.restore();	//	restore after scaling, translating, etc.
			rat.profiler.popPerfMark("Rendering");

			if (rat.afterDraw)
			{
				rat.profiler.pushPerfMark("After Draw");
				rat.afterDraw();
				rat.profiler.popPerfMark("After Draw");
			}
			
			rat.profiler.popPerfMark("Rat.System.Cycle");

			rat.graphics.endFrame();
		//}
		//catch (err)
		//{
		//	rat.console.log( "EXCEPTION: " + err.toString() );
		//}
	};

	//	timing globals - move this stuff to rat namespace
	rat.deltaTimeRaw = 1 / 60.0;	//	deltatime.  see calculation near framerate update
	rat.deltaTimeRawSmoothed = rat.deltaTimeRaw;
	rat.deltaTimeMod = 1;
	rat.deltaTimeUnsmoothed = rat.deltaTime;
	rat.deltaTime = rat.deltaTimeRaw;
	rat.runningFpsUnsmoothed = 1 / rat.deltaTimeUnsmoothed;
	rat.runningFps = 1 / rat.deltaTime;
	rat.runningTime = 0;

	function getDeltaTimeStamp()
	{
		if (rat.system.has.Wraith)
			return 0;
		else if (window.performance)
			return window.performance.now()/1000;
		else
			return new Date().getTime()/1000;
	}

	var lastTimeStamp = getDeltaTimeStamp();
	//	This array is used to generate the smoothed deltaTimeRaw
	var gDeltaTimeRawSmoother = [];
	rat.SMOOTHING_SAMPLE_SIZE = 25;
	var gSmootherIndex = 0;

	//	These arrays are used by the FPS Debug graph
	var gDeltaTimeRawRecord = [];
	var gDeltaTimeRawSmoothedRecord = [];
	var FPS_RECORD_SIZE = 100;
	rat.system.FPS_RECORD_SIZE = FPS_RECORD_SIZE;
	var gFPSRecordIndex = 0;
	

	//	update deltatime calculation
	var gHighDeltaTime; // The highest delta time over the last amount of time.  This means the slowest FPS
	var gHighFor = 0;// How long as the high delta time been the hi
	rat.system.updateDeltaTime = function ()
	{
		//	Things break down with a delta time mode <= 0
		if (rat.deltaTimeMod <= 0)
			rat.deltaTimeMod = 0.0000000001;
		var now;

		//	Get the rat.deltaTimeRaw
		//	a bunch of timing stuff, both for debug display and for deltatime (DT) calculations
		//	todo: use higher precision timing.
		if (rat.system.has.Wraith)
			rat.deltaTimeRaw = Wraith.getDeltaTime();
		else
		{
			now = getDeltaTimeStamp();
			rat.deltaTimeRaw = now - lastTimeStamp;
			lastTimeStamp = now;
		}

		//	Force?
		if (rat.paused)
			rat.deltaTimeRaw = 0;

		//	artificial limit of dt for systems running so slowly that an accurate dt would be ridiculous.
		if (rat.deltaTimeRaw > 0.1 && !rat.paused)	//	10fps
			rat.deltaTimeRaw = 0.1;

		//	Include the deltaTimeMod in rat.deltaTime
		rat.deltaTimeUnsmoothed = rat.deltaTimeRaw * rat.deltaTimeMod;

		//	Get the raw FPS
		rat.runningFpsUnsmoothed = 1 / rat.deltaTimeUnsmoothed;

		//	Figure out the smoothed deltaTime
		//	this controls how quickly average frame rate matches immediate frame rate.  1 = just use current frame.  5 = average out over 5 frames.
		//	The value was 5 for a long time.  I'm just not sure that's right.
		var totalTimeRaw = 0;
		gDeltaTimeRawSmoother[gSmootherIndex] = rat.deltaTimeRaw;
		gSmootherIndex = (gSmootherIndex + 1) % rat.SMOOTHING_SAMPLE_SIZE;
		var recordSize = gDeltaTimeRawSmoother.length < rat.SMOOTHING_SAMPLE_SIZE ? gDeltaTimeRawSmoother.length : rat.SMOOTHING_SAMPLE_SIZE;
		for (var index = 0; index !== recordSize; ++index)
			totalTimeRaw += gDeltaTimeRawSmoother[index];
		rat.deltaTimeRawSmoothed = totalTimeRaw / recordSize;

		rat.deltaTime = rat.deltaTimeRawSmoothed * rat.deltaTimeMod;

		rat.runningFps = 1 / rat.deltaTime;

		gDeltaTimeRawRecord[gFPSRecordIndex] = rat.deltaTimeRaw;
		gDeltaTimeRawSmoothedRecord[gFPSRecordIndex] = rat.deltaTimeRawSmoothed;
		gFPSRecordIndex = (gFPSRecordIndex + 1) % FPS_RECORD_SIZE;
		rat.runningTime += rat.deltaTimeRaw;

		if (gHighDeltaTime === void 0 || (gHighFor += rat.deltaTimeRaw) > 2.0 || gHighDeltaTime < rat.deltaTimeRaw)
		{
			gHighDeltaTime = rat.deltaTimeRaw;
			gHighFor = 0;
		}
	};

	//	draw some debug timing info (framerate info)
	rat.system.drawDebugTiming = function ()
	{
		//var dispFps = rat.math.floor(rat.runningFps * 10)/10;
		var dispFps = rat.math.floor(rat.runningFps);
		var dispDT = rat.math.floor(rat.deltaTime * 1000) / 1000;
		var ctx = rat.graphics.getContext();
		ctx.fillStyle = "#F08030";
		var fontSize = rat.math.floor(12 * 1/rat.graphics.globalScale.x);
		ctx.font = "bold " + fontSize + "px monospace";
		var yPos = rat.graphics.SCREEN_HEIGHT - fontSize;
		ctx.fillText("fps: " + dispFps + "  DT: " + dispDT, 30, yPos);
	};

	//	draw debug stats - particle counts, for instance
	//	TODO: use offscreen for this and only update when it changes?
	//	fillText is slow and affects the performance we're trying to measure.  :(
	//	I'm hesitant to introduce a dependency here from rat.system to rat.ui or rat.offscreen
	//	do we already have a ui dependency?
	rat.system.drawDebugStats = function ()
	{
		var atX = 30;
		
		var ctx = rat.graphics.getContext();
		ctx.fillStyle = "#F08030";
		var fontSize = rat.math.floor(12 * 1/rat.graphics.globalScale.x);
		ctx.font = "bold " + fontSize + "px monospace";
		var yShift = fontSize;
		var yPos = rat.graphics.SCREEN_HEIGHT - 3 * fontSize;

		//	particle stats
		if( rat.particle )
		{
			var totalSystems = rat.particle.getSystemCount();
			var totalEmitters = rat.particle.getAllEmitterCount();
			var totalParticles = rat.particle.getAllParticleCount();
			var totalCachedStates = rat.particle.State.cacheSize;
			var totalParticleStateObjects = rat.particle.State.count;
			
			//	Particle system stats.
			if(rat.particle.stateCaching.enabled)
			{
				ctx.fillText("   states(cached): " + totalParticleStateObjects + "(" + totalCachedStates + ")", atX, yPos);
				yPos -= yShift;
			}
			ctx.fillText("P: sys: " + totalSystems + "  em: " + totalEmitters + "  p: " + totalParticles, atX, yPos);
			yPos -= yShift;
		}
		
		//	UI stats
		if (rat.graphics && rat.graphics.frameStats && rat.ui )
		{
			ctx.fillText("UI: elem: " + rat.graphics.frameStats.totalElementsDrawn
				+ ", mcalls " + rat.ui.mouseMoveCallCount
				+ ", ucalls " + rat.ui.updateCallCount,
				atX, yPos);
			yPos -= yShift;
		}
		
		//	image draw calls
		if (rat.graphics && rat.graphics.Image && rat.graphics.Image.perFrameDrawCount )
		{
			ctx.fillText("Images: " + rat.graphics.Image.perFrameDrawCount, atX, yPos);
			yPos -= yShift;
		}

		//	XUI element renders
		if (rat.xuijs)
		{
			var total = 0;
			for( var key in rat.xuijs.XuiElementsDrawnThisFrame)
			{
				total += rat.xuijs.XuiElementsDrawnThisFrame[key];
				var skippedText = (
					(rat.xuijs.XuiElementsSkippedThisFrame[key])
					? " (/" + rat.xuijs.XuiElementsSkippedThisFrame[key] + ")"
					: "");
				ctx.fillText( "   "+ key +": "
					+ rat.xuijs.XuiElementsDrawnThisFrame[key]
					+ skippedText
					, atX, yPos );
				yPos -= yShift;
			}
			ctx.fillText( "XUI Elem: " + total, atX, yPos );
			yPos -= yShift;
			
			rat.xuijs.XuiElementsDrawnThisFrame = {};
			rat.xuijs.XuiElementsSkippedThisFrame = {};
		}
	};

	//	show debug memory graph (if we can)
	rat.system.drawDebugMemoryGraph = function ()
	{
		if( !rat.system.debugMemoryGraphSettings)
			rat.system.debugMemoryGraphSettings = {bounds:{}, history:[]};
		var settings = rat.system.debugMemoryGraphSettings;
		var ctx = rat.graphics.getContext();
		var space = {width : rat.graphics.SCREEN_WIDTH, height : rat.graphics.SCREEN_HEIGHT};
		if( !settings.bounds || !settings.bounds.x )
		{
			settings.bounds = {};
			settings.bounds.w = space.width/4;
			settings.bounds.h = space.height/8;
			settings.bounds.x = space.width * 0.90 - settings.bounds.w;
			settings.bounds.y = (space.height * 0.95 - (settings.bounds.h * 2))-16;
		}
		var bounds = settings.bounds;
		
		ctx.save();
		ctx.fillStyle = "white";
		ctx.translate(bounds.x, bounds.y);
		var fontSize = rat.math.floor(12 * 1/rat.graphics.globalScale.x);
		ctx.font = "bold " + fontSize + "px monospace";
		
		//	the marks
		var x, y;
		for( var markIndex = 0; markIndex < 3; ++markIndex )
		{
			ctx.lineWidth = 1;
			ctx.strokeStyle = (["red", "yellow", "blue"])[markIndex];
			ctx.beginPath();
			y = (markIndex/2) * bounds.h;
			ctx.moveTo(0, y);
			ctx.lineTo(bounds.w, y);
			ctx.stroke();
		}
		
		//	We need two records to draw.
		if( !window.performance || !window.performance.memory )
		{
			ctx.textAlign = "start";
			ctx.textBaseline = "hanging";
			ctx.fillText("Memory unavailable.", 0, bounds.h+1);
		}
		else
		{
			var ttl = window.performance.memory.totalJSHeapSize || 1;
			var used= window.performance.memory.usedJSHeapSize || 0;
			var percent = (used/ttl)*100;
			settings.history.push( used );
			if( settings.history.length > rat.system.FPS_RECORD_SIZE )
				settings.history.shift();
			ctx.textAlign = "start";
			ctx.textBaseline = "hanging";
			ctx.fillText("Memory: " + percent.toFixed(2) + "% of " + (ttl / 1024 / 1024).toFixed(2) + "MB", 0, bounds.h+1);
			
			ctx.strokeStyle = "green";
			ctx.save();
			ctx.beginPath();
			for( var index = 0; index < settings.history.length && index < rat.system.FPS_RECORD_SIZE; ++index )
			{
				var visualIndex = index;
				if( settings.history.length < rat.system.FPS_RECORD_SIZE )
					visualIndex += (rat.system.FPS_RECORD_SIZE -settings.history.length);
				var record = settings.history[index];
				var x = bounds.w * (visualIndex/(rat.system.FPS_RECORD_SIZE-1));
				var y = bounds.h * (1.0-(record/ttl));
				if( index == 0 )
					ctx.moveTo( x, y );
				else
					ctx.lineTo( x, y );
			}
			ctx.stroke();
			ctx.restore();
		}
		ctx.restore();
	};
		
	//	show debug frame rate graph
	rat.system.drawDebugFramerateGraph = function ()
	{
		//	We need two records to draw.
		var recordCount = gDeltaTimeRawRecord.length;
		if (recordCount <= 1)
			return;

		var ctx = rat.graphics.getContext();
		//var canvas = rat.graphics.canvas;
		var space = {width : rat.graphics.SCREEN_WIDTH, height : rat.graphics.SCREEN_HEIGHT};
		var graph = rat.system.debugFramerateGraphSettings;
		//	STT changed this 2015.3.3
		//	It had the problem that it was only getting set the first time, so if screen resized, it wasn't updating, so it ended up in lame placs.
		//	But I want to respect the idea of having defined settings or not.
		//	So, now we check if there were any settings and recalculate local values ourselves each frame instead of setting the globals.
		//	Another approach would be to copy whatever is set in debugFramerateGraphSettings and just fill in what's missing each frame.
		//	Also note that if some project is actually using debugFramerateGraphSettings, they'd better be adapting to resizes!  :)
		if (!graph || !graph.bounds || !graph.bounds.x)
		{
			graph = {bounds:{}};	//	make a new local temp settings object
			graph.bounds.w = space.width/4;
			graph.bounds.h = space.height/8;
			graph.bounds.x = space.width * 0.90 - graph.bounds.w;
			graph.bounds.y = space.height * 0.95 - graph.bounds.h;
		}
		
		ctx.translate(graph.bounds.x, graph.bounds.y);

		//	the marks
		ctx.lineWidth = 1;
		ctx.strokeStyle = "#F02040";
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.lineTo(graph.bounds.w, 0);
		ctx.stroke();

		ctx.beginPath();
		ctx.moveTo(0, graph.bounds.h / 2);
		ctx.lineTo(graph.bounds.w, graph.bounds.h / 2);
		ctx.stroke();

		ctx.beginPath();
		ctx.moveTo(0, graph.bounds.h);
		ctx.lineTo(graph.bounds.w, graph.bounds.h);
		ctx.stroke();

		//	What is the top mark
		var topMark = 120; // 120 fps

		function drawChart(vals, startIndex)
		{
			ctx.beginPath();
			var point = {
				x: 0,
				y: 0
			};
			var len = vals.length;
			var xShift = graph.bounds.w / (FPS_RECORD_SIZE-1);
			var p;
			for (var index = 0; index !== len; ++index)
			{
				p = vals[(index + startIndex) % len];
				p = (1 / p) / topMark;
				point.y = graph.bounds.h - (p * graph.bounds.h);
				
				if (index === 0)
					ctx.moveTo(point.x, point.y);
				else
					ctx.lineTo(point.x, point.y);

				point.x += xShift;
			}
			ctx.stroke();
		}

		ctx.lineWidth = 2;

		//	Draw profile markers if we are using rat.profiler and have some
		var p;
		if (rat.profiler.perfmarkers.length > 0)
		{
			ctx.save();

			var list = rat.profiler.perfmarkers;

			//	What is the current frame
			var curFrame = rat.graphics.frameIndex;

			var marker;
			var tx;
			for (var index = 0; index !== list.length; ++index)
			{
				marker = list[index];
				p = 1-((curFrame - marker.frame) / FPS_RECORD_SIZE);

				ctx.strokeStyle = marker.color;
				ctx.beginPath();
				tx = graph.bounds.w * p;
				ctx.moveTo(tx, 0);
				ctx.lineTo(tx, graph.bounds.h);
				ctx.stroke();
			}

			ctx.restore();
		}
		
		//	Draw the FPS records
		//	Second - raw
		ctx.strokeStyle = "#808000";
		drawChart(gDeltaTimeRawRecord, gFPSRecordIndex);

		//	Draw the FPS records
		//	First - smoothed
		ctx.strokeStyle = "#8080FF";
		drawChart(gDeltaTimeRawSmoothedRecord, gFPSRecordIndex);

		//	FPS text
		//	Scale this up to be legible by default in high res.
		var fontSize = rat.math.floor(12 * 1/rat.graphics.globalScale.x);
		var dispFps = ((rat.runningFps*100)|0)/100;
		var dispDT = ((rat.deltaTime * 1000) | 0) / 1000;
		var lowFPS = 1/gHighDeltaTime;
		ctx.fillStyle = "#F0F0F0";
		ctx.font = "bold " + fontSize + "px monospace";
		ctx.textBaseline = "hanging";
		ctx.TextAlign = "left";
		dispFps = "" + dispFps.toFixed(2);
		dispDT = "" + dispDT.toFixed(3);
		lowFPS = "" + lowFPS.toFixed(2);
		var padder = "     ";
		dispFps = padder.substr(0, padder.length - dispFps.length) + dispFps;
		dispDT = padder.substr(0, padder.length - dispDT.length) + dispDT;

		ctx.fillText("fps: " + dispFps + " (low "+ lowFPS+")  DT: " + dispDT, 0, graph.bounds.h);

		ctx.translate(-graph.bounds.x, -graph.bounds.y);
	};

	//
	//	send a rat/game command down the screen stack.
	//	This lets any screen step in and handle the command.
	//	todo:  merge with the above functions
	//
	rat.dispatchCommand = function (command, info)
	{
		//	first see if any screen in the stack is going to handle this.
		//	this is for popups, for example.
		if( rat.screenManager )
		{
			for(var i = rat.screenManager.screenStack.length - 1; i >= 0; i--)
			{
				var screen = rat.screenManager.screenStack[i];
				if(typeof screen.handleCommand !== 'undefined')
				{
					var handled = screen.handleCommand(command, info);
					//	note that the screen might have popped itself, but the way we're handling this in reverse order is OK.
					if(handled)
						return;
				}
			}
		}
		
		//	then hand to whatever registered command handler there is.
		if(rat.system.commandHandler)
			rat.system.commandHandler(command, info);
	};

	/**
	* util to use the proper event handling for IE and other browsers
	* @param {boolean=} capture optional
	*/
	rat.addOSEventListener = function (element, event, func, capture)
	{
		if (element && element.addEventListener)
			return element.addEventListener(event, func, !!capture);
		else if (element && element.attachEvent)
			return element.attachEvent(event, func);
		else if (typeof (window) !== 'undefined' && window.addEventListener)
			return window.addEventListener(event, func, !!capture);
	};

	/**
	* util to remove the proper event handling for IE and other browsers
	* @param {boolean=} capture optional
	*
	* If an event listener retains any data (such as inside a closure), use this
	* function to remove that data reference. Called with the same parameters as
	* rat.addOSEventListener that added it.
	*/
	rat.removeOSEventListener = function (element, event, func, capture)
	{
		if (element.removeEventListener)
			element.removeEventListener(event, func, !!capture);
		else if (element.detachEvent)
			element.detachEvent(event, func);
		else if (typeof window !== 'undefined' && window.removeEventListener)
			window.removeEventListener(event, func, !!capture);
	};

	/**
	* add key event listener, and standardize some values in event
	* @param {boolean=} capture optional
	*/
	rat.addOSKeyEventListener = function (element, event, func, capture)
	{
		rat.addOSEventListener(element, event, function (e)
		{
			if( rat.input )
				rat.input.standardizeKeyEvent(e);
			func(e);
		}, capture);
	};

	////////////////////////////////////////////////////////////////////////////////
	/// Handle event dispatches for error, suspend and resume as fired by WinJS apps

	//	Fire on any error
	// A global error handler that will catch any errors that are not caught and handled by your application's code.
	// Ideally the user should never hit this function because you have gracefully handled the error before it has 
	// had a chance to bubble up to this point. In case the error gets this far, the function below will display an
	// error dialog informing the user that an error has occurred.
	function onError(event)
	{
		rat.console.log("JS ERROR! " + JSON.stringify(event));
		if (rat.events && rat.events.fire)
			rat.events.fire("error", { sysEvent: event });

		var errorDialog = new window.Windows.UI.Popups.MessageDialog(
			event.detail.errorUrl +
				"\n\tLine:\t" + event.detail.errorLine +
				"\tCharacter:\t" + event.detail.errorCharacter +
				"\nMessage: " + (event.detail.message || event.detail.errorMessage),
			(event.type === "error") ? "Unhanded Error!" : event.type);
		errorDialog.cancelCommandIndex = 0;
		errorDialog.defaultCommandIndex = 0;
		errorDialog.showAsync();
		return true;
	}

	//	Fired when we are resumed from a suspend.
	function onResume(event)
	{
		var args = { sysEvent: event };
		if (rat.events && rat.events.fire)
			rat.events.fire("resume", args);
		//	How did we get a resume before we finished loading in rat...
	}

	//	Fired when the app is going to be suspended
	function onSuspend(event)
	{
		var sysEvent = event;	//	Cannot leave this as a param or it isn't available to our sub-functions

		//	If we have async stuff to do...
		var busyCount = 0;
		var promise;
		function setBusy()
		{
			++busyCount;
			if (busyCount === 1 && rat.system.has.winJS)
			{
				sysEvent.setPromise(
					new window.WinJS.Promise(function (completeDispatch, errorDispatch, progressDispatch)
					{
						promise = completeDispatch;
					})
				);
			}
		}

		//	Set that we are done with our work.
		function setDone()
		{
			if (busyCount <= 0)
				return;

			--busyCount;
			if (busyCount === 0 && promise)
				promise("Done");
		}

		//	Set what to save with the suspend.
		var sessionData = {};
		function storeData(data)
		{
			sessionData = data;
		}

		//	Start busy.
		setBusy();

		//	Firing the event out into the world.
		var args = { store: storeData, setBusy: setBusy, setDone: setDone, sysEvent: sysEvent };
		if (rat.events && rat.events.fire)
			rat.events.fire("suspend", args);

		//	Save any data set
		if (rat.system.has.winJS)
			window.WinJS.Application.sessionState["savedState"] = sessionData;

		//	And we are done working in this file... Note that we may still be pending elsewhere.
		setDone();
	}

	var hasSuspendResume = false;
	if (rat.detectPlatform.detected)
		hasSuspendResume = rat.system.has.winJS;
	else
		hasSuspendResume = !!window.Windows;

	///TODO Wraith will need to fire similar (or the same) events if we event ship a JS app running in wraith under Windows 8 or as an XboxOne app
	if (hasSuspendResume && window.WinJS)
	{
		/// [JSH 1/20/2015] most of this is copied and modified from what was found in agent.

		window.WinJS.Application.onerror = onError;
		window.WinJS.Application.oncheckpoint = onSuspend;
		window.Windows.UI.WebUI.WebUIApplication.addEventListener("resuming", onResume, false);
	}

	////////////////////////////////////////////////////////////////////////////////
	///	Handle focus/blur events so we can now if the app is in focus
	rat.addOSEventListener( window, "focus", function ()
	{
		if (!rat.system.hasFocus)
		{
			//rat.console.log("App has focus");
			rat.system.hasFocus = true;
			if (rat.events && rat.events.fire)
				rat.events.fire("focus");
		}
	});

	rat.addOSEventListener(window, "blur", function ()
	{
		if (rat.system.hasFocus)
		{
			//rat.console.log("App does NOT have focus");
			rat.system.hasFocus = false;
			if (rat.events && rat.events.fire)
				rat.events.fire("blur");
		}
	});

});