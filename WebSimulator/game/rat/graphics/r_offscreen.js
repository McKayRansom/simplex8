/*

	rat.Offscreen
	
	This is an offscreen buffer (canvas) that you can draw to once (or at least less frequently)
	and then render into a normal scene.
	
	This is useful for performance optimization, among other things.
	
	Simple Use Case 1:
		* create an Offscreen
		* draw to it once
		* render to your scene each frame after that
		
		var off = new rat.Offscreen(200, 200);
		var ctx = off.getContext();
		ctx.fillStyle = "#FF0000";
		ctx.fillRect(0, 0, 200, 200);
		...
		off.render(mainCTX);
		
	Use Case 2:
		* create an Offscreen
		* redraw it only when its content changes
		* render to your scene each frame
		
	Use Case 3:
		* create an Offscreen
		* call offscreen.enableDirtyRects();
		* use the dirty rectangle feature to limit drawing to parts that need redrawing
		* render to your scene each frame

Implementation Notes:

The basic idea:

* create this thing (an offscreen buffer (canvas))
* do a bunch of drawing to it
*   ... only once, if that's an option!  (e.g. a static scene)
*   ... or only when things change
*   	... and only the part that changes
* and then draw it into the main canvas every frame

objective:  faster rendering most of the time, on screens where most things aren't changing.

useful for the main display, but also for things like individual UI screens or panels or parts of a display.
so, we expect several of these to exist, but also probably a rat.graphics.mainOffscreen, or something.

Features:

Dirty Rectangles
* provide an API to say when a rectangular piece of the image has changed
* track all these rectangles
* coalesce them when two overlap or one includes another, etc.
* provide an API to check against this set of rectangles, so we know if something needs to be drawn.
* do this in a separate module.  A general rectlist handling module or something, that's good at dirty rects,
	but also for whatever reason, general management of a list of rects

Rat UI integration
* given dirty rectangle info (as described above), only redraw the UI elements that changed
* ... will require the coders/designers to get serious about ui element sizes, wherever they want to use this feature effectively
* won't quite allow automatic optimization of UI screens, since we'll still need to know what is *changing*
* ... but that could be a future feature: track changes within rat.ui elements, for fully automated ui screen optimizations

Background Image Handling
* support identifying an image or set of images as "background" images
* only draw the part of the image that intersects with dirty rect (doing sub-image drawing)

Scrolling Support
* support a bigger offscreen area than eventually used, so we can have a moving camera without rebuilding the whole image every frame
* ... (until they get outside that bigger area, at which point we'll have to bump things over and draw the newly revealed part)

*/
rat.modules.add( "rat.graphics.r_offscreen",
[
	{name: "rat.graphics.r_graphics", processBefore: true },
	{name: "rat.graphics.r_color", processBefore: true },	//	for debug colors to be defined
	
	"rat.debug.r_console",
	"rat.os.r_system",
	"rat.graphics.r_rectlist",
], 
function(rat)
{
	///
	/// Offscreen Object
	/// @constructor
	///
	rat.Offscreen = function (width, height)
	{
		this.canvas = document.createElement("canvas");
		this.canvas.width = this.width = width;
		this.canvas.height = this.height = height;
		this.ctx = this.canvas.getContext("2d");
		
		//	dirtyrects are not default any more.  Why use them all the time, when sometimes
		//	we really just want the easy offscreen canvas support.
		
		//	call enableDirtyRects() to use them.
		//this.dirtyRects = new rat.RectList();
		//this.dirtyRects.snapEven = true;
		
		if (rat.ui && !rat.ui.allowOffscreens)	//	double-check with rat ui global disable flag
		{
			rat.console.log("WARNING!  You're trying to use an OffscreenImage() object, but offscreens are not allowed by this host!");
		}
	};
	//rat.Offscreen.prototype.blah = true;	//	whatever

	//	STATIC vars
	rat.Offscreen.allowOffscreens = !rat.system.has.Wraith;
	
	//	enable dirty rects if they're not already set up.
	rat.Offscreen.prototype.enableDirtyRects = function ()
	{
		if (!this.dirtyRects)
		{
			this.dirtyRects = new rat.RectList();
			this.dirtyRects.snapEven = true;
		}
	};
	
	rat.Offscreen.prototype.setSize = function (w, h, force)
	{
		if (!force && this.width === w && this.height === h)
			return;	//	don't resize (which also erases) if we're already the right size.
		
		//	note: this will erase our offscreen image as well.
		this.canvas.width = this.width = w;
		this.canvas.height = this.height = h;
	};
	
	//	return context for drawing to
	rat.Offscreen.prototype.getContext = function ()
	{
		return this.ctx;
	};
	//	return canvas object.  Useful if you're doing your own drawImage call, for example.
	rat.Offscreen.prototype.getCanvas = function ()
	{
		return this.canvas;
	};
	
	//	render this canvas to another context
	rat.Offscreen.prototype.render = function (targetContext, x, y, drawWidth, drawHeight)
	{
		if (!targetContext)
			targetContext = rat.graphics.getContext();
		if (!x)
			x = 0;
		if (!y)
			y = 0;
		if (!drawWidth)
			drawWidth = this.canvas.width;
		if (!drawHeight)
			drawHeight = this.canvas.height;

		targetContext.drawImage(this.canvas, x, y, drawWidth, drawHeight);
	};
	
	//	erase any space hit by dirty rects.
	//	An alternative is to set clipping and use erase() below, but see notes there.
	rat.Offscreen.prototype.eraseDirty = function()
	{
		if (this.dirtyRects)
			this.dirtyRects.eraseList(this.ctx);
	};
	
	//	A simple clear - clear the whole offscreen image in a  low-level way,
	//	ignoring clipping, etc.
	//	Compare with erase(), which clears using clipping and can be useful in some cases.
	//	This also clears out the dirty rect list, which is invalid now.
	rat.Offscreen.prototype.clear = function (w, h, force)
	{
		//	erase offscreen
		this.canvas.width = this.canvas.width;
		
		//	and presumably you want dirty rects cleared, too.
		if (this.dirtyRects)
			this.dirtyRects.clear();
	};
	
	
	//	Erase the whole offscreen (with canvas clearRect call)
	//	compare with clear(), which empties the offscreen in a more low-level way
	//	and ignores clipping.
	//
	//	If you're using clipToDirty() below,
	//	this will only erase dirty rect space, which is often what we want.
	//
	//	IMPORTANT NOTE!
	//	On IE10, and therefore Windows 8.0,
	//	This erase call fails with a clip region more complex than a single rect.
	//	https://connect.microsoft.com/IE/feedback/details/782736/canvas-clearrect-fails-with-non-rectangular-yet-simple-clipping-paths
	//	So, don't use this in windows 8 or IE 10 with a complex clip region.
	//	(which is the whole point of dirty rect lists, so it's likely you'll have trouble)
	rat.Offscreen.prototype.erase = function()
	{
		if (rat.system.has.IEVersion === 10 && !rat.Offscreen.warnedAboutIE10)
		{
			rat.console.log("!! Warning:  This clearRect() call will fail in IE10 if you're using fancy clipping.");
			rat.Offscreen.warnedAboutIE10 = true;
		}
		
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
	};

	//	So, to hide those problems, let's give a single function that tries to do the right thing.
	//	Note that this will start a save() call either way, so you definitely need to unclip() later.
	rat.Offscreen.prototype.clipAndEraseDirty = function ()
	{
		if (rat.system.has.IEVersion === 10) {
			this.eraseDirty();
			this.clipToDirty();
		} else {
			this.clipToDirty();
			this.erase();
		}
	};
	
	//	set offscreen clip region to the total dirty space.
	rat.Offscreen.prototype.clipToDirty = function()
	{
		this.dirtyRects.clipToList(this.ctx);
	};
	rat.Offscreen.prototype.unclip = function()
	{
		this.dirtyRects.unclip(this.ctx);
	};
	
	rat.Offscreen.prototype.dirtyToPath = function(ctx, list)
	{
		if (!ctx)
			ctx = this.ctx;
		if (!list)
			list = this.dirtyRects.list;
		this.dirtyRects.listToPath(ctx, list);
	};
	
	//	for debugging purposes, draw an overlay effect to clearly indicate what is an offscreen buffer.
	//	pick cycling color/effect, so we can see when it changes.
	//	This is normally done right after the offscreen is rendered or updated.
	//
	rat.Offscreen.debugColors = [rat.graphics.orange, rat.graphics.darkGreen, rat.graphics.cyan, rat.graphics.blue, rat.graphics.violet];
	rat.Offscreen.prototype.applyDebugOverlay = function()
	{
		var ctx;
		//	make debug pattern if we don't have it already
		if (!rat.Offscreen.checkerImages)
		{
			rat.Offscreen.checkerImages = [];
			var colors = rat.Offscreen.debugColors;
			for (var i = 0; i < colors.length; i++)
			{
				var color = colors[i];
				var square = 16;
			
				rat.Offscreen.checkerImages[i] = document.createElement("canvas");
				rat.Offscreen.checkerImages[i].width = 2 * square;
				rat.Offscreen.checkerImages[i].height = 2 * square;
				ctx = rat.Offscreen.checkerImages[i].getContext("2d");
				ctx.fillStyle = "#FFFFFF";
				ctx.fillRect(0, 0, 2 * square, 2 * square);
				ctx.fillStyle = color.toString();//"#000000";
				ctx.fillRect(0, 0, square, square);
				ctx.fillRect(square, square, square, square);
			}
		}
		
		if (!this.debugOffscreenCycle)
			this.debugOffscreenCycle = 0;
		var cycleLength = rat.Offscreen.debugColors.length;
		ctx = this.ctx;
		//if (!this.pat)
			this.pat = ctx.createPattern(rat.Offscreen.checkerImages[this.debugOffscreenCycle], "repeat");
		
		var oldAlpha = ctx.globalAlpha;
		ctx.globalAlpha = 0.3;
		
		//ctx.fillStyle = color.toString();
		
		ctx.fillStyle = this.pat;
		
		ctx.fillRect(0, 0, this.width, this.height);
		
		this.debugOffscreenCycle = (this.debugOffscreenCycle+1) % cycleLength;
		ctx.globalAlpha = oldAlpha;
	};
		
	
} );
