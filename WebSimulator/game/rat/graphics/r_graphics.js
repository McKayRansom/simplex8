//
// Graphics objects and utilities
//
rat.modules.add("rat.graphics.r_graphics",
[
	{ name: "rat.math.r_math", processBefore: true },

	"rat.graphics.r_color",
	"rat.os.r_system",
	"rat.os.r_events",
	"rat.debug.r_console",
	"rat.debug.r_profiler",
	"rat.math.r_matrix",
	"rat.utils.r_utils",
	"rat.utils.r_shapes",
],
function (rat)
{
	var math = rat.math; // for quick local access below

	/// Update our held view state.
	function getViewState()
	{
		if (rat.system.has.winJS)
		{
			//	see https://msdn.microsoft.com/en-US/library/windows/apps/windows.ui.viewmanagement.applicationviewstate
			var states = window.Windows.UI.ViewManagement.ApplicationViewState;
			switch (rat.graphics.winJSAppView.value)
			{
				case states.fullScreenLandscape:
					rat.graphics.viewState = "fullscreen";
					break;
				case states.filled:
					rat.graphics.viewState = "filled";
					break;
				case states.snapped:
					rat.graphics.viewState = "snapped";
					break;
				case states.fullscreenPortrait:
					rat.graphics.viewState = "fullscreenPortrait";
					break;
				default:
					rat.graphics.viewState = "unknown";
					break;
			}
			rat.graphics.viewState = rat.graphics.winJSAppView.value;	//	for convenience later
		}
		else
			rat.graphics.viewState = "fullscreen";
	}

	// remember old known size, so we know whether to bother informing anyone.
	var oldSize = { x: 0, y: 0 };
	/// our screen size changed.  Tell people about it.
	function screenSizeChanged()
	{
		var newSize = { x: rat.graphics.SCREEN_WIDTH, y: rat.graphics.SCREEN_HEIGHT };

		if (oldSize.x !== newSize.x || oldSize.y !== newSize.y)
		{
			rat.events.fire("resize", newSize, oldSize);
			oldSize.x = newSize.x;
			oldSize.y = newSize.y;
		}
	}

	///
	///	rat graphics module
	/// @namespace
	///
	rat.graphics = {

		SCREEN_WIDTH: 760, //	gets reset correctly later
		SCREEN_HEIGHT: 600, //	gets reset correctly later

		// auto scaling to match desired display as closely as we can
		globalScale: { x: void 0, y: void 0 },	// current scale, if there is one
		globalTranslate: null,	// current shift, if there is one
		autoTargetSize: { x: 0, y: 0 },	// ideal size
		autoResizeCanvas: true,	// turn on/off auto resizing system
		autoFillOnResize: false, // once we resize close enough, go ahead and accept the window size (see below)
		autoCenterCanvas: false, // turn on/off style-based canvas centering inside its parent

		// factor in high-DPI devices when sizing
		// A reason this is off by default is that on high-DPI devices we'll do a lot more rendering work, slowing us down.
		// If performance is a concern, don't turn this on!
		autoScaleWithDevicePixelRatio: false,
		canvasPixelRatio: 1,

		autoClearCanvas: false,	// whether or not we should clear canvas automatically each frame
		autoClearColor: "#000",	// color to which we should autoclear, or "" if we should clear to transparent.

		frameIndex: 0,		// current frame since launch of application
		ctx: null,

		frameStats: { totalElementsDrawn: 0 },	// for debug, some stats about what we've drawn this frame

		cursorPos: { x: -1, y: -1 },	// last known cursor pos, in canvas space

		minAutoScale: 0.0000001, // Minimum auto scale defaults to 0.00000001

		mTransform: void 0,	// our internally tracked transformation matrix
		mStateStack: [],

		viewState: "fullscreen"
	};

	var mIgnoreRatTransform = false; // Should matrix calculations ignore the rat matrix.  Set via rat.graphics.save

	//	not needed by default - we grab it above.
	//	Use this if you want to override or whatever...?
	//	or above function may change, since it's kinda hardcoded.
	rat.graphics.setContext = function (ctx)
	{
		rat.graphics.ctx = ctx;
	};

	rat.graphics.getContext = function ()
	{
		return rat.graphics.ctx;
	};



	/// 
	/// Init rat.graphics
	/// @param {string} canvasID
	/// @suppress {missingProperties | checkTypes}
	/// Again, suppress in favor of a registered init func
	/// 
	rat.graphics.init = function (canvasID)
	{
		var rGraphics = rat.graphics;

		// set the transform up
		rGraphics.mTransform = new rat.Matrix();
		///@todo use canvas object passed to us, don't assume names.
		// pkonneker - passed in an id, and made it default to the old style if none is passed
		//	Don't know if we'd rather just use the canvas object itself instead, though
		rGraphics.canvas = document.getElementById(canvasID);
		if (rat.system.has.Wraith && Wraith.w_onPlatform === "PS4")
		{
			rGraphics.canvas.style = {};
		}
		rGraphics.ctx = rGraphics.canvas.getContext("2d");
		rGraphics.SCREEN_WIDTH = rGraphics.canvas.width;
		rGraphics.SCREEN_HEIGHT = rGraphics.canvas.height;

		rGraphics.winJSAppView = void 0;
		if (rat.system.has.winJS)
			rGraphics.winJSAppView = window.Windows.UI.ViewManagement.ApplicationView;

		// set up a normal window resize callback
		getViewState();
		rat.addOSEventListener(window, 'resize', rGraphics.resizeCallback);
		screenSizeChanged();
	};

	// This is our callback for screen resize events from the browser/os... this is where we first learn about resizes.
	rat.graphics.resizeCallback = function (eventArgs)
	{
		getViewState();

		rat.events.fire("before_resize", eventArgs);
		//console.log("resizeCallback " + rat.graphics.callAutoScale);
		if (rat.graphics.callAutoScale)
			rat.graphics.autoScaleCallback();
	};

	rat.graphics.setAutoClear = function (doAutoClear, autoClearStyle)
	{
		rat.graphics.autoClearCanvas = doAutoClear;
		if (typeof (autoClearStyle !== 'undefined'))
			rat.graphics.autoClearColor = autoClearStyle;
	};

	//	clear canvas to autoclear color
	rat.graphics.clearCanvas = function ()
	{
		var ctx = rat.graphics.getContext();
		if (rat.graphics.autoClearColor === "" || (rat.graphics.Video && rat.graphics.Video.numberOfActiveBGVideos > 0))
			ctx.clearRect(0, 0, rat.graphics.SCREEN_WIDTH, rat.graphics.SCREEN_HEIGHT);
		else
		{
			ctx.fillStyle = rat.graphics.autoClearColor;
			ctx.fillRect(0, 0, rat.graphics.SCREEN_WIDTH, rat.graphics.SCREEN_HEIGHT);
		}
	};

	//	begin a new frame (mostly just for counting and tracking purposes, currently)
	rat.graphics.beginFrame = function ()
	{
		rat.graphics.frameIndex++;
		rat.graphics.frameStats.totalElementsDrawn = 0;

		if (rat.profiler && rat.profiler.beginFrame)
			rat.profiler.beginFrame();
	};

	//	end the current frame
	rat.graphics.endFrame = function ()
	{
		if (rat.profiler && rat.profiler.endFrame)
			rat.profiler.endFrame();
	};

	//
	//	Set global scale for shrinking or expanding rendering
	//	e.g. to fit our larger screen in a smaller space, like my sad laptop.
	//
	rat.graphics.setGlobalScale = function (x, y)
	{
		x = x || 1;
		y = y || 1;
		// Ugh...  this is getting complicated.
		// the problem now is that sometimes the scale isn't changing, e.g. if rat.graphics.autoFillOnResize,
		// but SCREEN_WIDTH and SCREEN_HEIGHT are not being fixed...
		// So, why was this check here, anyway?  If it's needed, better work out some other solution for autoFillOnResize, or check that flag here?
		//if (x !== rat.graphics.globalScale.x ||
		// y !== rat.graphics.globalScale.y )
		{
			rat.graphics.globalScale.x = x;
			rat.graphics.globalScale.y = y;
			//rat.console.log("RAT: Global scale set to " + JSON.stringify(rat.graphics.globalScale));

			//	the idea is to pretend like we have a bigger space than we do.
			//	so, if we're scaling down, scale internal effective screen size variables up.
			rat.graphics.SCREEN_WIDTH = (rat.graphics.canvas.width / rat.graphics.globalScale.x) | 0;
			rat.graphics.SCREEN_HEIGHT = (rat.graphics.canvas.height / rat.graphics.globalScale.y) | 0;

			screenSizeChanged();
		}
	};
	rat.graphics.clearGlobalScale = function ()
	{
		rat.graphics.globalScale.x = void 0;
		rat.graphics.globalScale.y = void 0;
		rat.graphics.SCREEN_WIDTH = rat.graphics.canvas.width;
		rat.graphics.SCREEN_HEIGHT = rat.graphics.canvas.height;
		screenSizeChanged();
	};

	rat.graphics.setGlobalTranslate = function (x, y)
	{
		rat.graphics.globalTranslate = { x: x, y: y };
	};
	rat.graphics.clearGlobalTranslate = function ()
	{
		rat.graphics.globalTranslate = { x: 0, y: 0 };
	};

	//	return true if we're currently applying a global scale
	rat.graphics.hasGlobalScale = function ()
	{
		var gblScale = rat.graphics.globalScale;
		var hasGlobalScale = gblScale.x && gblScale.y && (gblScale.x !== 1.0 || gblScale.y !== 1.0);
		return hasGlobalScale;
	};

	//	and if you want to temporarily ignore global scale and translation (e.g. to match real screen coordinates)...
	//	Use these like this:
	//	rat.graphics.save();
	//	rat.graphics.counterGlobalScale(ctx);
	//	rat.graphics.counterGlobalTranslate(ctx);
	//	... my drawing ...
	//	rat.graphics.restore();
	rat.graphics.counterGlobalScale = function (tctx)
	{
		if (rat.graphics.hasGlobalScale())
			rat.graphics.scale(1 / rat.graphics.globalScale.x, 1 / rat.graphics.globalScale.y, tctx);
	};
	rat.graphics.counterGlobalTranslate = function (tctx)
	{
		if (rat.graphics.globalTranslate)
			rat.graphics.translate(-rat.graphics.globalTranslate.x, -rat.graphics.globalTranslate.y, tctx);
	};

	//	autoscale to an ideal target window size.
	//	this is only used if enabled, and only when window is resized
	rat.graphics.autoScaleCallback = function ()
	{
		var winSize = rat.utils.getWindowSize();
		var scale = winSize.w / rat.graphics.autoTargetSize.w;	//	in order to fit horiz
		var altScale = winSize.h / rat.graphics.autoTargetSize.h;	//	in order to fit vert
		if (altScale < scale)	//	use whichever is smaller
			scale = altScale;

		//	support minimum scale down.
		//	This is useful for things like not scaling down to super-mini-size in snap state.
		if (scale < rat.graphics.minAutoScale)
			scale = rat.graphics.minAutoScale;

		//	Cap scale.  Could change to allow this by default?
		//	It's not a big problem, just not what I want right now.  Anyway, changeable with flag.
		if (!rat.graphics.allowAutoUpscale && scale > 1)
			scale = 1;

		if (rat.graphics.autoResizeCanvas && rat.graphics.canvas)
		{
			var width = math.floor(rat.graphics.autoTargetSize.w * scale);
			var height = math.floor(rat.graphics.autoTargetSize.h * scale);
			var remainingWidth = winSize.w - width;
			var remainingHeight = winSize.h - height;

			//	OK, but for systems like win8, we don't want ugly black bars on the sides...
			if (rat.graphics.autoFillOnResize)
			{
				//	We got as close as we could for game logic to match its internal scale.
				//	Now just fill in any leftover space in canvas, with this new scale.
				//	Note that this leaves rat.graphics.SCREEN_HEIGHT and SCREEN_WIDTH at new values,
				//	(and aspect ratio will have changed)
				//	which the game needs to expect, and do its own centering to deal with.
				//	If you want a simpler solution, consider autoCenterCanvas below
				width = winSize.w;
				height = winSize.h;
			}

			//	check for some incompatible flags...
			if (rat.graphics.autoScaleWithDevicePixelRatio && !rat.graphics.allowAutoUpscale)
			{
				//	scaling to device pixel ratio requires an upscale, usually.
				//	though...  hmm...
				//	TODO:  Get rid of this warning and check below.
				//		Instead, check !allowAutoUpscale below and specifically check if scale is > 1
				//		and if so, limit our scale back down again.
				rat.console.log("WARNING: autoScaleWithDevicePixelRatio is not compatible with rat.graphics.allowAutoUpscale being false.");
			}

			//	on top of all that, factor in device pixel ratio, if requested.
			//	This is to adapt to high-DPI devices,
			//	like a new iPad, or the Helix, or the 2in1 Intel laptop
			//	This is relatively new code, and hasn't been tested on various browsers, host environments,
			//	etc., and I don't know how well it will interact with other flags like centering, max scaling, filling, etc.
			//
			//	It makes things look really nice in Chrome on high-end devices,
			//	at some performance cost.
			//	Also works in IE 10+, with a slightly more noticeable performance cost with lots of text.
			//	Works in Win8 now (see custom code below), but there we have weird clip problems, so not using it in any apps yet.
			//
			if (rat.graphics.autoScaleWithDevicePixelRatio && rat.graphics.allowAutoUpscale)
			{
				var ctx = rat.graphics.canvas.getContext('2d');

				//	BROWSER version
				var devicePixelRatio = window.devicePixelRatio || 1;

				var backingStoreRatio = ctx.webkitBackingStorePixelRatio ||
							ctx.mozBackingStorePixelRatio ||
							ctx.msBackingStorePixelRatio ||
							ctx.oBackingStorePixelRatio ||
							ctx.backingStorePixelRatio || 1;

				//	WINDOWS 8+ implementation
				if (rat.system.has.windows8 && Windows && Windows.Graphics && Windows.Graphics.Display)
				{
					//	see https://github.com/yoik/cordova-yoik-screenorientation/issues/35 for correctly dealing with this in Win 8 and Win8.1,
					//	since things changed!
					var displayInformation = (Windows.Graphics.Display.DisplayInformation) ? Windows.Graphics.Display.DisplayInformation.getForCurrentView() : Windows.Graphics.Display.DisplayProperties;

					if (displayInformation)
					{
						//var logicalDPI = displayInformation.logicalDpi;	//	interesting...
						backingStoreRatio = 100;
						devicePixelRatio = displayInformation.resolutionScale;
					}
				}

				var ratio = devicePixelRatio / backingStoreRatio;
				rat.graphics.canvasPixelRatio = ratio;
				//	todo: support capping this value for performance reasons?

				//	tell style to scale us down to fit in the same browser space
				rat.graphics.canvas.style.width = "" + width + "px";
				rat.graphics.canvas.style.height = "" + height + "px";
				//	but render big!
				width *= ratio;
				height *= ratio;
				scale *= ratio;

				if (ratio !== 1)
				{
					rat.console.log("device pixel ratio " + ratio + " : " + devicePixelRatio + " / " + backingStoreRatio);
				}
			}

			rat.graphics.canvas.width = width;
			rat.graphics.canvas.height = height;

			//	alternatively, accept the black bars, but make sure everything is centered.
			//	(in contrast with autoFillOnResize, which is generally preferred for a few reasons)
			//	This is a new attempt, useful for quicker development.
			//	Makes certain assumptions about html setup.
			if (rat.graphics.autoCenterCanvas)
			{
				var dw = math.floor(remainingWidth / 2);
				var dh = math.floor(remainingHeight / 2);
				rat.graphics.canvas.style["margin-left"] = "" + dw + "px";
				rat.graphics.canvas.style["margin-top"] = "" + dh + "px";
			}

		}

		//	STT moved this here from above 2013.6.6
		//	This is correct, I think, so rat.graphics.SCREEN_xxx is set correctly
		rat.graphics.setGlobalScale(scale, scale);

		rat.console.log("autoScaleCallback: " + scale + " canvas: " + rat.graphics.canvas.width + "," + rat.graphics.canvas.height);
	};

	//	set up automated scaling when user resizes window
	//	This mostly just sets a bunch of globals for how to deal with resizes,
	//	and triggers one call now to force setup.
	rat.graphics.setAutoScaleFromIdeal = function (targetW, targetH, resizeCanvas, allowAutoUpscale)
	{
		//	remember desired values
		rat.graphics.autoTargetSize.w = targetW;
		rat.graphics.autoTargetSize.h = targetH;
		if (typeof resizeCanvas !== 'undefined')
			rat.graphics.autoResizeCanvas = resizeCanvas;
		rat.graphics.allowAutoUpscale = allowAutoUpscale;
		rat.graphics.callAutoScale = true;	//	remember to call autoscale function later on resize event

		//	also call once now just to get things right to start with
		rat.graphics.autoScaleCallback();
	};

	//	This is a set of routines to modify the transformation of the given context.
	//	These will apply the change, but also track it internally so that we can do some extra stuff,
	//	like ask for the current transformation at any given time, do our own transform math, etc.
	//	the ctx argument here is last, so that it can be optional, in which case we use the current rat ctx
	/**
	 * Rotate the current matrix
	 * @param {number} r
	 * @param {Object=} tctx
	 */
	rat.graphics.rotate = function (r, tctx)
	{
		var ctx = tctx || rat.graphics.ctx;
		if (!mIgnoreRatTransform)
			rat.graphics.mTransform.rotateSelf(r);
		ctx.rotate(r);
	};

	/**
	 * Scale the current matrix
	 * @param {number} x
	 * @param {number} y
	 * @param {Object=} tctx
	 */
	rat.graphics.scale = function (x, y, tctx)
	{
		if (y === void 0)
			y = x;
		var ctx = tctx || rat.graphics.ctx;
		if (!mIgnoreRatTransform)
			rat.graphics.mTransform.scaleSelf(x, y);
		ctx.scale(x, y);
	};

	/**
	 * Translate the current matrix
	 * @param {number} x
	 * @param {number} y
	 * @param {Object=} tctx
	 */
	rat.graphics.translate = function (x, y, tctx)
	{
		var ctx = tctx || rat.graphics.ctx;
		if (!mIgnoreRatTransform)
			rat.graphics.mTransform.translateSelf(x, y);
		ctx.translate(x, y);
	};

	rat.graphics.transform = function (m11, m12, m21, m22, dx, dy, tctx)
	{
		if (Array.isArray(m11.m))
			m11 = m11.m;
		if (Array.isArray(m11))
		{
			//	m11, m12, m21, m22, dx, dy, tctx
			//	m11, dx, dy, tctx
			tctx = m22;
			m12 = m11[1][0];
			m21 = m11[0][1];
			m22 = m11[1][1];
			dx = m11[0][2];
			dy = m11[1][2];
			m11 = m11[0][0];
		}
		var ctx = tctx || rat.graphics.ctx;
		if (!mIgnoreRatTransform)
		{
			var m = [[m11, m12, dx], [m21, m22, dy], [0, 0, 1]];
			rat.graphics.mTransform.multSelf(m);// = rat.Matrix.matMult(rat.graphics.mTransform, m);
		}
		ctx.transform(m11, m12, m21, m22, dx, dy);
	};

	rat.graphics.setTransform = function (m11, m12, m21, m22, dx, dy, tctx)
	{
		rat.graphics.resetTransform();
		rat.graphics.transform(m11, m12, m21, m22, dx, dy, tctx);
	};

	/**
	 * Reset the transformation matrix
	 * @param {Object=} tctx
	 */
	rat.graphics.resetTransform = function (tctx)
	{
		var ctx = tctx || rat.graphics.ctx;
		if (!mIgnoreRatTransform)
			rat.graphics.mTransform.loadIdent();
		ctx.setTransform(1, 0, 0, 1, 0, 0);
	};

	/** 
	 * Save the current rendering state
	 * @param {Object=} options  {ignoreRatMat:true}  You can never set ignoreRatMat to false if it was true.  it goes back to false after a .restore
	 */
	rat.graphics.save = function (options)
	{
		var ctx = rat.graphics.ctx;
		options = options || {};
		if (options.ignoreRatMat === void 0)
			options.ignoreRatMat = mIgnoreRatTransform;
		else
		{
			//once ignoreRatMat is set to true, it only goes to false with a restore.  You cannot set it to false with a save!
			options.ignoreRatMat = mIgnoreRatTransform || options.ignoreRatMat || false;
		}
		ctx.save();
		var state = {
			ignoreRatMat: mIgnoreRatTransform,
			transform: void 0
		};
		mIgnoreRatTransform = options.ignoreRatMat;

		//	Get a new version of the .m so that we are not pointing to the same thing
		// We only need to do this if we care about the rat matrix.
		if (!mIgnoreRatTransform)
		{
			state.transform = rat.graphics.mTransform.m;
			rat.graphics.mStateStack.push(state);
			// DON'T POINT at the old matrix.
			var m = rat.graphics.mTransform.m;
			// THIS IS A COPY!
			m = [[m[0][0], m[0][1], m[0][2]],
			 [m[1][0], m[1][1], m[1][2]],
			 [m[2][0], m[2][1], m[2][2]]];
			rat.graphics.mTransform.m = m;
		}
		else
		{
			rat.graphics.mStateStack.push(state);// DON'T POINT at the old matrix.
		}
	};

	/// Restore a saved rendering state
	rat.graphics.restore = function ()
	{
		var ctx = rat.graphics.ctx;
		ctx.restore();
		var state = rat.graphics.mStateStack.pop();
		mIgnoreRatTransform = state.ignoreRatMat;
		if (state.transform)
			rat.graphics.mTransform.m = state.transform;
	};

	rat.graphics.getTransform = function ()
	{
		return rat.graphics.mTransform;
	};

	/** @param {Object=} dest */
	rat.graphics.transformPoint = function (p, dest)
	{
		return rat.graphics.mTransform.transformPoint(p, dest);
	};

	/** Push a gfx profiling mark.   Only works under wraith */
	rat.graphics.pushPerfMark = function (label, ctx)
	{
		if (!ctx)
			ctx = rat.graphics.ctx;
		if (ctx.pushPerfMark)
			ctx.pushPerfMark(label);
	};

	/** Pop off a gfx profiling mark.   Only works under wraith */
	rat.graphics.popPerfMark = function (ctx)
	{
		if (!ctx)
			ctx = rat.graphics.ctx;
		if (ctx.popPerfMark)
			ctx.popPerfMark();

	};

	/**
	 * Draw a line
	 * @param {Object|Number} p1
	 * @param {Object|Number} p2
	 * @param {Object|Number=} p3
	 * @param {Number=} p4
	 */
	rat.graphics.drawLine = function (p1, p2, p3, p4, ops)
	{
		var point1 = { x: 0, y: 0 };
		var point2 = { x: 0, y: 0 };
		if (p1.x !== void 0)
		{
			point1 = p1;
			if (p2.x !== void 0)
			{
				point2 = p2;
				ops = p3;
			}
			else
			{
				point2.x = p2;
				point2.y = p3;
				ops = p4;
			}
		}
		else
		{
			point1.x = p1;
			point1.y = p2;
			if (p3.x !== void 0)
			{
				point2 = p3;
				ops = p4;
			}
			else
			{
				point2.x = p3;
				point2.y = p4;
			}
		}
		var ctx = rat.graphics.ctx;

		if (ops)
		{
			if (ops.color)
				ctx.strokeStyle = ops.color.toString();
			if (ops.lineWidth !== void 0)
				ctx.lineWidth = ops.lineWidth;
		}

		ctx.beginPath();
		ctx.moveTo(point1.x, point1.y);
		ctx.lineTo(point2.x, point2.y);
		ctx.stroke();
	};

	/**
	 * Draw some text
	 * @param {string} text
	 * @param {number=} x
	 * @param {number=} y
	 * @param {number=} maxWidth
	 */
	rat.graphics.drawText = function (text, x, y, maxWidth)
	{
		x = x || 0;
		y = y || 0;
		if (maxWidth)
			rat.graphics.ctx.fillText(text, x, y, maxWidth);
		else
			rat.graphics.ctx.fillText(text, x, y);
	};

	/**
	 * Draw a text in an arc
	 */
	///	 See http://www.html5canvastutorials.com/labs/html5-canvas-text-along-arc-path/
	rat.graphics.drawTextArc = function (str, centerX, centerY, radius, angle, options)
	{
		options = options || {};
		var len;
		if (!angle)
		{
			len = rat.graphics.ctx.measureText(str);
			if (len.width !== void 0)
				len = len.width;
			angle = rat.math.min(len / radius);
			if (options.angleScale)
				angle *= options.angleScale;
		}
		var context = rat.graphics.ctx;

		if (options.stroke)
		{
			if (options.lineWidth)
				context.lineWidth = options.lineWidth;
		}

		var s;
		len = str.length;
		context.save();
		context.translate(centerX, centerY);
		context.rotate(-1 * angle / 2);
		context.rotate(-1 * (angle / len) / 2);
		for (var n = 0; n < len; n++)
		{
			context.rotate(angle / len);
			context.save();
			context.translate(0, -1 * radius);
			s = str[n];
			if (options.stroke)
				context.strokeText(s, 0, 0);
			else
				context.fillText(s, 0, 0);
			context.restore();
		}
		context.restore();
	};

	/**
	 * Draw an open (not filled) circle (rat.shapes.Circle)
	 * @param {Object|number} circ
	 * @param {number=} y
	 * @param {number=} r
	 */
	rat.graphics.drawCircle = function (circ, y, r, ops)
	{
		var ctx = rat.graphics.ctx;
		ctx.beginPath();
		if (circ.center !== void 0)
		{
			ops = y;
			r = circ.radius;
			y = circ.center.y;
			circ = circ.center.x;
		}
		else if (circ.x !== void 0)
		{
			if (circ.r !== void 0)
			{
				ops = y;
				r = circ.r;
				y = circ.y;
				circ = circ.x;
			}
			else
			{
				ops = r;
				r = y;
				y = circ.y;
				circ = circ.x;
			}
		}

		if (ops !== void 0)
		{
			if (ops.color)
			{
				if (ops.fill)
					ctx.fillStyle = ops.color.toString();
				else
					ctx.strokeStyle = ops.color.toString();
			}
			if (!ops.fill && ops.lineWidth !== void 0)
				ctx.lineWidth = ops.lineWidth;
		}
		ctx.arc(circ, y, r, 0, rat.math.PI2, true);
		ctx.closePath();

		if (ops && ops.fill)
			ctx.fill();
		else
			ctx.stroke();
	};

	/**
	 * Draw a rectangle (rat.shapes.Rect)
	 * @param {Object} rect
	 * @param {Object=} ops
	 */
	rat.graphics.drawRect = function (rect, ops)
	{
		ops = ops || {};
		if (ops.fill)
		{
			if (ops.color)
				rat.graphics.ctx.fillStyle = ops.color.toString();
			rat.graphics.ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
		}
		else
		{
			if (ops.lineWidth)
				rat.graphics.ctx.lineWidth = ops.lineWidth;
			if (ops.color)
				rat.graphics.ctx.stokeStyle = ops.color.toString();
			rat.graphics.ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
		}
	};

	/**
	 * Draw a list of shapes (see r_collision2d)
	 * @param {Array} list
	 */
	rat.graphics.drawShapeList = function (list)
	{
		if (!list || list.length <= 0)
			return;
		var shape;
		for (var index = 0; index !== list.length; ++index)
		{
			shape = list[index];
			switch (shape.type)
			{
				case 'circle':
					rat.graphics.drawCircle(shape);
					break;
				case 'rect':
					rat.graphics.drawRect(shape);
					break;
				default:
					rat.console.log("Unable able to identify shape for drawing\n");
					break;
			}

			//	Draw the children
			rat.graphics.drawShapeList(shape.children);
		}
	};

	//
	//--------- more graphics utils ----------------
	//

	//	@todo: move to graphics utils (separate module)?
	//	maybe r_draw, and call them rat.draw_whatever...?
	//	and rename - what's with the underscore?
	rat.graphics.draw_fillbar = function (x, y, w, h, fillCur, fillTotal, backColor, bodyColor, frameColor)
	{
		var fillPoint = fillCur * w / fillTotal;
		var ctx = rat.graphics.getContext();
		ctx.fillStyle = backColor;
		ctx.fillRect(x, y, w, h);

		ctx.fillStyle = bodyColor;
		ctx.fillRect(x, y, fillPoint, h);

		ctx.lineWidth = 1;
		ctx.strokeStyle = frameColor;
		ctx.strokeRect(x, y, w, h);
	};

	// Don't make or use global functions.
	//draw_fillbar = rat.graphics.draw_fillbar;	//	shorter name for backwards compat

	//	util to make a unilateral polygon (e.g. triangle) shape.
	//	rotate of 0 results in a point on the right hand side
	//	You probably want to call fillPolygon or strokePolygon
	rat.graphics.makePolygonShape = function (centerX, centerY, radius, rotate, sides)
	{
		if (typeof (sides) === 'undefined')
			sides = 3;
		if (typeof (rotate) === 'undefined')
			rotate = 0;
		var rotInc = Math.PI * 2 / sides;

		rat.graphics.ctx.beginPath();
		for (var i = 0; i < sides; i++)
		{
			var x = Math.cos(rotate + i * rotInc) * radius;
			var y = Math.sin(rotate + i * rotInc) * radius;
			if (i === 0)
				rat.graphics.ctx.moveTo(centerX + x, centerY + y);
			else
				rat.graphics.ctx.lineTo(centerX + x, centerY + y);
		}
		rat.graphics.ctx.closePath();
	};

	rat.graphics.fillPolygon = function (centerX, centerY, radius, rotate, sides)
	{
		rat.graphics.makePolygonShape(centerX, centerY, radius, rotate, sides);
		rat.graphics.ctx.fill();
	};

	rat.graphics.strokePolygon = function (centerX, centerY, radius, rotate, sides)
	{
		rat.graphics.makePolygonShape(centerX, centerY, radius, rotate, sides);
		rat.graphics.ctx.stroke();
	};
	
	//	define a round rect path in the rat context
	//	(to be filled/stroked/whatever externally)
	//	arguments:  rect that defines bounds, corner radius
	rat.graphics.roundRect = function (rect, cornerRadius)
	{
		var pi = Math.PI;
		var ctx = rat.graphics.ctx;
		ctx.beginPath();
		
		//	Start with the top left arc
		var x = rect.x + cornerRadius;
		var y = rect.y + cornerRadius;
		ctx.arc(x, y, cornerRadius, pi, pi * 1.5);
		
		var x = rect.x + rect.w - cornerRadius;
		ctx.lineTo(x, rect.y);
		ctx.arc(x, y, cornerRadius, pi * 1.5, pi * 2);
		
		var y = rect.y + rect.h - cornerRadius;
		ctx.lineTo(rect.x + rect.w, y);
		ctx.arc(x, y, cornerRadius, 0, pi * 0.5);
		
		var x = rect.x + cornerRadius;
		ctx.lineTo(x, rect.y + rect.h);
		ctx.arc(x, y, cornerRadius, pi * 0.5, pi);
		
		//	this will finish up the last line
		ctx.closePath();
	};

	rat.graphics.drawMiniArrow = function (x, y, color)
	{
		var ctx = rat.graphics.ctx;

		ctx.strokeStyle = color;
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.moveTo(x - 2, y);
		ctx.lineTo(x + 7, y);
		ctx.closePath();
		ctx.stroke();
		ctx.beginPath();

		ctx.lineWidth = 2;
		ctx.moveTo(x + 4, y - 3);
		ctx.lineTo(x + 8, y);
		ctx.lineTo(x + 4, y + 3);
		ctx.closePath();
		ctx.stroke();
	};

	//	Draw arrow.  This is centered near the base of the arrow...
	//	baseX/Y indicate base of arrow
	//	tx/ty indicate target position
	rat.graphics.drawArrow = function (baseX, baseY, tx, ty, fillStyle, strokeStyle, thick)
	{
		var ctx = rat.graphics.ctx;

		var dx = tx - baseX;
		var dy = ty - baseY;
		var s = Math.sqrt(dx * dx + dy * dy);	//	Length.
		var angle = Math.atan2(dy, dx);
		var t = s / 4;
		//if (typeof thick !== 'undefined')
		//	t = thick;

		rat.graphics.save();
		rat.graphics.translate(baseX, baseY);
		rat.graphics.rotate(angle);

		ctx.beginPath();
		ctx.moveTo(-t, -t);
		ctx.lineTo(-t, t);
		ctx.lineTo(t, t);
		ctx.lineTo(t, 2 * t);
		ctx.lineTo(3 * t, 0);
		ctx.lineTo(t, -2 * t);
		ctx.lineTo(t, -t);
		ctx.closePath();
		ctx.fillStyle = fillStyle;
		ctx.fill();
		ctx.lineWidth = 1;
		ctx.strokeStyle = strokeStyle;
		ctx.stroke();

		rat.graphics.restore();
	};

	//	these suck, and are placeholder for more useful functions
	rat.graphics.drawPlus = function ()
	{
		var ctx = rat.graphics.ctx;
		ctx.fillStyle = "#70B070";
		ctx.fillRect(-7, -3, 14, 6);
		ctx.fillRect(-3, -7, 6, 14);
	};

	rat.graphics.drawMinus = function ()
	{
		var ctx = rat.graphics.ctx;
		ctx.fillStyle = "#C07070";
		ctx.fillRect(-7, -3, 14, 6);
		//ctx.fillRect(-3, -7, 6, 14);
	};

	//	draw parallelogram
	//	upper left position
	//	this is a pretty customized function for Jared, but might be useful in general.
	//	"fillAmount" (0-1) indicates how far up from the bottom to draw the parallelogram, which is a little weird.
	//	"angle" is in radians
	rat.graphics.drawParallelogram = function (x, y, w, h, angle, fillStyle, fillAmount)
	{
		if (typeof (fillAmount) === 'undefined')
			fillAmount = 1;
		if (fillAmount === 0)
			return;

		var ctx = rat.graphics.ctx;

		var xShift = Math.tan(angle) * h;

		var topX = (x + xShift * (1 - fillAmount));
		var topY = (y + (1 - fillAmount) * h);

		ctx.beginPath();
		ctx.moveTo(topX, topY);
		ctx.lineTo(topX + w, topY);

		ctx.lineTo(x + w + xShift, y + h);
		ctx.lineTo(x + xShift, y + h);
		ctx.closePath();

		ctx.fillStyle = fillStyle;
		ctx.fill();

		//ctx.lineWidth = 1;
		//ctx.strokeStyle = strokeStyle;
		//ctx.stroke();

	};

	/**
	 * Draws the line segment or arc.
	 * @param {{center:{x:number, y:number}, radius:number, startAngle:number, endAngle:number, anticlockwise:boolean}|{point1:{x:number, y:number},point2:{x:number, y:number}}} segment represents the arc or strait line.
	 * @param {string|Object} color of the segment.
	 * @param {number=} width of the segment.
	 */
	rat.graphics.drawSegmentOrArc = function (segment, color, width)
	{
		if (color.toString())
			color = color.toString();
		width = width || 1;
		var ctx = rat.graphics.ctx;
		ctx.beginPath();
		if (segment.type === "arc")
			// We are drawing an arc
			ctx.arc(segment.center.x, segment.center.y, segment.radius, segment.startAngle, segment.endAngle, segment.anticlockwise);
		else
		{
			// Line segment
			ctx.moveTo(segment.point1.x, segment.point1.y);
			ctx.lineTo(segment.point2.x, segment.point2.y);
			ctx.closePath();
		}
		//rat.graphics.save();
		ctx.lineWidth = width;
		ctx.strokeStyle = color;
		ctx.stroke();
		//rat.graphics.restore();
	};

	/**
	 * Setup the matrix to have any global translation or scale wanted by the game.
	 */
	rat.graphics.setupMatrixForRendering = function ()
	{
		if (rat.graphics.globalTranslate)
			rat.graphics.translate(rat.graphics.globalTranslate.x, rat.graphics.globalTranslate.y);
		if (rat.graphics.hasGlobalScale())
			rat.graphics.scale(rat.graphics.globalScale.x, rat.graphics.globalScale.y);
	};
});
