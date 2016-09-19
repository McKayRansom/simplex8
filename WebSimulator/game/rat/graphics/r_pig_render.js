//
//	pig render support
//
//	Render an image, based on a source image, in the style of the drawpig project.
//
//	The source image can be an image loaded from a single asset, or a composited realtime-drawn thing, or whatever.
//	You can set a bunch of parameters for how the image is drawn, redraw it later, whatever.
//
//	Usage Notes:
//		* this is not a rat ui object because the overhead might not be needed.
//			we might add another class later, like rat.ui.pigRenderPane or something.
//
//		Basic Usage:
//			var pr = new rat.graphics.PigRender();
//			pr.loadAndSetImage(url);
//			//	or if image/canvas is already loaded:  pr.setImage(image);
//			pr.setSpeed(10);	//	or whatever - a high number like 10000 will draw in just a few updates
//
//			pr.update(dt);	//	update regularly
//			pr.draw(ctx);	//	draw (draw in progress, if you like, or after it's done...)
//
//			if (pr.isDone()) ... // done
//
//		By default, the render is random.  You can switch to deterministic by doing something like this:
//			pr.config.rng = new rat.math.rng.Simple(13),
//
//		By default, the render will speed up dramatically as it goes, even with a fixed update.
//			This is presumably because at first there's a lot of drawing per update, which is slow.
//			later, we're mostly discarding spots that have been drawn on already, which is fast.
//
//		UPDATE_SPEED is the default method of updating
//			just specify how many loops to run per update.
//			Easy to understand, but hard to control how long the render takes.
//			It looks cool, though - because of the above speeding-up issue
//		UPDATE_RATIO gives more control.
//		
//			
//
//	Implementation Notes:
//		* Render canvas is final render (well, almost final - not counting the backplane fill, which is optional but standard)
//		* backplane canvas is used for a couple of things, including filling in gaps when the image is done
//		* reference canvas is where we get the pixels from the original reference source image
//
//		We don't use dt at all any more - we don't need our results to be dependent on frame rate,
//			especially when usually we're doing a bunch of updates in a single frame.

/*
	TODO:
	
	do we need overborder values?  What is overborder for?  To simplify my offscreen data?
		if so, and only for that, add that overborder stuff to the offscreen object itself.
		In this implementation, I've chosen to ignore overborder, and it's been working.  why?

	Maybe support tinting or palette swapping while we're at it...
		since these are RGB images, the source image will either have to have a restricted palette,
		or we'll need a logical sense of palette swap, like "change reddish stuff to cyanish stuff" or something.
		more like Photoshop's hue shift.

Stuff to consider:

pick average color at a point, instead of just a single pixel color, for less abrupt color choices.
Or even scale image way down and then way up, to simplify that process

[X] Build a single list of all available places, and randomize that.
	(If that's too huge or slow, maybe keep a list of macroblocks or strips...)
	Then use that list to know where to go next, instead of completely random.
	This will also help us know when we're approaching done.

Maybe sometimes randomness and sometimes use the list? 

fade in background (backplane) fill as we approach done, instead of popping in when done.

Another visual idea: Dots.
Have the pigs just draw dots where they land, no lines.
Some big, some small, depending on how much the surrounding spaces share the same color.
e.g. if nearby cross spaces share same color characteristics, draw medium dot, if bigger cross, draw big dot.
Overlap dots.  Drawn in random order, should look OK.

And I'm sure we can come up with more visual approaches.

[/] Line idea:  watch right edge
	When drawing line, track the edge we're near, and veer toward it if it moves away, so we're less likely to leave white gaps.
	Would generally like some improvements to avoid leaving gaps on large curves.

Idea:
after drawing for a while, be more likely to pick locations in the center of the image,
since that usually needs more refinement?
Note that drawing refinement afterward is usually good, since lines overlap,
so if we get little details first and then big details, the little details get swallowed up.
Also note that lots of little dots (after the image is already mostly done) sometimes looks bad
Maybe implement this with the way we handle startSpots?

calculate estimated time left? (based on startSpots? or something else?)
Actually, this ties into another issue... since we don't factor in deltatime, how can a client control
the real-time speed at which an image is drawn?  Maybe use startSpots, and let the client specify how much (percentage) to finish this update.
Then the client could say "I want this whole image in 2 seconds, and I just updated 0.2 seconds of time, so give me 0.2/2 percent done."

Optimization:
* dirty rects
(if rendering is the issue, which I'm not sure it is yet)

Optimization Idea: (low pri)
sometimes don't draw into backbuffer, e.g. if we're not stuck, wait one update and then connect old point to new point.
could be faster...

*/

rat.modules.add( "rat.graphics.r_pig_render",
[
	{name: "rat.graphics.r_graphics", processBefore: true },
	
	"rat.graphics.r_simple_image_data",
	
	//"rat.debug.r_console",
	//"rat.os.r_system",
], 
function(rat)
{
	
	//	perceived luminance (http://stackoverflow.com/questions/596216/formula-to-determine-brightness-of-rgb-color)
	//	see also rat color module
	var LUM_R = 0.299;
	var LUM_G = 0.587;
	var LUM_B = 0.114;

	//	movement types.
	//	maybe add or mix in or separately control stuck behavior,
	//	e.g. do one where we immediately give up when stuck?  or give up quicker, so it's just lines?
	var MOVE_STRAIGHT = 1;
	var MOVE_RANDOM = 2;
	var MOVE_CURVE = 3;
	var MOVE_TRIANGLES = 4;	//	really needs FOLLOW_WALLS to work right
	
	var STATE_INIT = 'init';
	var STATE_READY = 'ready';
	var STATE_DRAW = 'draw';
	var STATE_DONE = 'done';
	
	///
	/// PigRender Object
	/// @constructor PigRender
	/// @param {Object=} config optional great big "config" object controls how this render behaves.
	///
	var PigRender = function (config)
	{
		this.setDefaultConfig();
		if (config)
			this.setConfig(config);
		this.validateConfig();
		
		this.pigs = [];
		
		this.nextPos = [];	//	This is a way to specify where the next pig should start, overriding other random placement methods briefly.
		
		this.doneRatio = 0;
		
		this.myImageData = null;
		//this.ctx

		this.state = STATE_INIT;	//	we don't start acting until we have our source image
		
		this.drawTime = 0;
	};
	
	PigRender.standardSizes = [
		//	lw, testahead = lw/3, moveinc = lw/2
		{lineWidth:3, name:"3", testAhead:1, moveIncrement:1.5, giveUpCounter:160},
		{lineWidth:6, name:"5", testAhead:2, moveIncrement:3, giveUpCounter:150},	//	was 6?
		{lineWidth:9, name:"9", testAhead:3, moveIncrement:4.5, giveUpCounter:110},
		{lineWidth:15, name:"15", testAhead:5, moveIncrement:7.5, giveUpCounter:90},
	];
	
	var STUCK_GIVE_UP_STRAIGHT = 4;	//	only 4 directions to check in straight mode
	var STUCK_GIVE_UP_RANDOM = 11;	//	randomly try these - this was determined empirically
	var STUCK_GIVE_UP_CURVED = 70;	//	based on STUCK_TURN_INCREMENT - probably want about one full revolution

	PigRender.prototype.setDefaultConfig = function()
	{
		if (!this.config)
			this.config = {};
		var config = this.config;
		
		config.USE_MY_PIXELS = true;	//	use my own pixel data tracking instead of built-in getimagedata calls, which are slow.
		config.USE_REF_IMAGE = true;	//	use ref image?  Note that currently, not using ref image is not super well supported...
		
		config.USE_REF_IMAGE_LUM = false;	//	compare with luminance instead of color distance
		config.USE_BACK_START_COLOR = false;	//	start with a color sampled from the backplane instead of image (useful for more consistency in random color setup)
		config.RANDOM_LUMINANCE_START = false;	//	start with random color of same luminance (only works with other luminance settings)
		config.BACK_PLANE_BLOTCHINESS = 0.80;	//	normally 1.  6 is interesting if you "USE_BACK_START_COLOR", but you start to get gross artifacts...

		config.WAIT_FOR_NEXT_POS_TO_SPAWN = false;	//	only spawn on clicks
			
		config.MOVE_TYPE = MOVE_CURVE;
		config.FOLLOW_WALLS = true;	//	a little more expensive, try to follow side wall (applies only to some move types)
		
		config.DRAW_DONE_WITH_BACKPLANE = true;	//	when done, draw backplane behind image

		//	These are current values form whatever preset value is selected.  They do change.
		//	LINE_WIDTH is the current line width
		//	TEST_AHEAD is added to the move space when testing for hitting something.  Should not be zero.  Generally line_width/3
		//	MOVE_INCREMENT is generally line_width/2

		//	these values are reasonable, but they don't matter as initial values.  sizeIndex is what matters.
		//config.LINE_WIDTH = 6;
		//config.TEST_AHEAD = 2;
		//config.MOVE_INCREMENT = 3;
		
		config.sizeIndex = 1;	//	see validate below?
		
		config.LINE_ALPHA = 0.7;	//	1 = full opaque, other values look more like watercolor.
		
		config.ALPHA_CLEAR_LEVEL = 130;	//	how much alpha can be considered opaque (above 40 or so doesn't seem to matter)

		//	threshold used to compare colors for blocking/shapes
		//	A higher value here means be more forgiving in considering colors close enough to be the same block/shape
		config.COLOR_SQ_THRESH = 70*70;	//	90 seems too high to be pretty..., 70 has worked well.
		//	this one is used if USE_REF_IMAGE_LUM:
		config.COLOR_LUM_THRESH = 0.1;	//	threshold for matching luminance in lum mode.  I haven't tried a variety of values here.
		
		//	color change settings.  A really low value like 1 means don't change from original color at all.
		//	Note that this is still different from color thresholds above, which determine when to be blocked by a different ref color,
		//	and when to consider it the same color.
		config.COLOR_CHANGE_LIMIT = 20;
		config.COLOR_CHANGE_VARIANCE = 6;	//	how much to vary in one update when shifting colors
		//	a slightly lower value here than var/2 will slightly brighten the image, which is nice.
		config.COLOR_CHANGE_HALF_VARIANCE = config.COLOR_CHANGE_VARIANCE * 0.49;

		config.NUM_PIGS = 6;	//	higher number results in faster image generation, since it doesn't affect frequency of getImageData calls.
		//config.SPAWN_GIVE_UP_TIME = 3;	//	if I can't find a spawn place in this much time, we're done.
		config.MAX_PIGS = 10;
		config.MIN_PIGS = 1;

		//	if I can't find a spawn place in this many updates (single pig), we're done.
		//	depends on line width now, so this is a temp number that gets replaced.
		config.SPAWN_GIVE_UP_COUNTER = 100;

		//config.STUCK_TURN_SPEED = 10;
		config.NORMAL_TURN_INCREMENT = 0.02;	//	turn when curving...  0.03 was my best for a long time...
		config.RANDOM_TURN_RANGE = 0.50;
		//config.RANDOM_TURN_RANGE = 0.25;
		//	turn increment affects several things, including following nearby curves, getting unstuck, and detecting long-term stuck.
		config.STUCK_TURN_INCREMENT = 0.1;//0.2;

		//	how many updates we remain stuck (turning) before popping to new loc
		config.STUCK_GIVE_UP_COUNT = STUCK_GIVE_UP_CURVED;	//	default based on default move type being curved...

		//	how many times we update all the pigs in one call to update()
		config.UPDATE_SPEED = 3;
		config.UPDATE_RATIO = 0;	//	by default, don't use this method.  use UPDATE_SPEED.
		
		//	if using  update_speed mode, SPEED_INCREASE will increase speed each update.  So, it'll be something like 3 or 10 or whatever.
		//	if using ratio mode, SPEED_INCREASE will increase ratio each update.  So, use values like 0.005 or something.
		config.SPEED_INCREASE = 0;
		
		//	test ratio-based defaults.
		//config.UPDATE_RATIO = 0.01;
		//config.SPEED_INCREASE = 0.005;
		
		config.RANDOM_START_SPOTS = false;	//	use random start points.  This is slow, since we build a list and randomize it.
		//	note that linear starts (the alternative) is faster to set up, but about the same speed after that.
		//	also, linear starts are more likely to have spirals, because pigs spawn right next to each other more often.
		
		config.rng = rat.math.rng.Default();
		
		this.validateConfig();
	};
	
	//	apply this configuration.
	//	any missing fields will be left like they were (probably default values)
	PigRender.prototype.setConfig = function(config)
	{
		for (var k in config)
		{
			this.config[k] = config[k];
		}
		
		this.validateConfig(config);
	};
	
	//	make sure config is correct,
	//	and update a few config values that are dependent on other config values.
	PigRender.prototype.validateConfig = function(wasSetFrom)
	{
		var config = this.config;
		
		//SPAWN_GIVE_UP_COUNTER based on LINE_WIDTH?
		//	and set values based on sizeIndex
		
		//	Some settings depend on the intention of this new change...
		//	e.g. if they set color variance but not half variance,
		//	so we need to look back at what they were trying to change, not what our defaults are.
		//	That's what "wasSetFrom" is for.
		if (wasSetFrom)
		{
			if (wasSetFrom.COLOR_CHANGE_VARIANCE && !wasSetFrom.COLOR_CHANGE_HALF_VARIANCE)
			{
				config.COLOR_CHANGE_HALF_VARIANCE = wasSetFrom.COLOR_CHANGE_VARIANCE/2;
			}
		}
		
		config.ORIG_UPDATE_SPEED = config.UPDATE_SPEED;
		config.ORIG_UPDATE_RATIO = config.UPDATE_RATIO;
	};
	
	//	set this as our ref image
	//	assumes the load has happened, width/height are legit, etc. (see loadAndSetImage alternative)
	PigRender.prototype.setImage = function(image)
	{
		this.width = this.config.width = image.width;
		this.height = this.config.height = image.height;

		this.createRefCanvas();
		this.setupRefCanvas(image);

		//	finally we know size, go ahead with everything else.
		this.prepForDrawing();
	};
	
	//	load, wait for load to happen, and then set from this image
	//	todo: support some basic optional scaling here, for convenience.
	PigRender.prototype.loadAndSetImage = function(url)
	{
		var pr = this;
		var image = new Image();
		image.onload = function()
		{
			pr.setImage(image);
		};
		image.src = url;
	};

	//	stuff to eventually include?
	//	click support?
	//nextPos : [],	//	{valid: false, pos : new rat.Vector() },
	//	draw pigs when drawing?
	//pigImage : new rat.graphics.ImageRef("images/hero.png"),
	
	//
	//	prep for drawing.
	//	This can't happen until our ref image is loaded, so we know its size.
	//	So, at this point, we assume we have a ref image, it's loaded, the ref canvas is created, etc.
	PigRender.prototype.prepForDrawing = function()
	{
		this.createRenderCanvas();	//	make our final render canvas to draw into
		this.setupStartSpots();
		this.myImageData = new rat.graphics.SimpleImageData(this.width, this.height);
		
		this.applySize();	//	apply our current drawing size/width, and set up related values
		
		//	create and draw our backplane, which is partly based on the refimage and other config values
		this.createBackplane();
		this.setupBackplane();
		
		this.state = STATE_DRAW;	//	now we can draw.
		
		console.log("state draw");
		
		//	create pigs
		this.setPigCount(this.config.NUM_PIGS);
	}

	//
	//	reset everything to init state, and start over with current settings,
	//	and with the image we have in our refCanvas already.
	PigRender.prototype.restart = function()
	{
		this.config.UPDATE_SPEED = this.config.ORIG_UPDATE_SPEED;
		this.config.UPDATE_RATIO = this.config.ORIG_UPDATE_RATIO;
		this.doneRatio = 0;
		
		this.setPaused(false);
		this.everGoneOver = false;
		this.everGonePartOver = false;
		this.nextPos = [];

		//	clear offscreen (start over on pig drawings)
		this.renderContext.clearRect(0, 0, this.renderCanvas.width, this.renderCanvas.height);
		
		this.setupStartSpots();

		if (this.config.USE_MY_PIXELS)
			this.myImageData.clear();

		this.setupBackplane();
		
		//	reload reference (image) screen
		//	We assume it has not changed and doesn't need to be reset.
		//if (this.config.USE_REF_IMAGE)
		//	setupRefCanvas();
	
		this.state = STATE_DRAW;
		this.drawTime = 0;
	};
	
	PigRender.prototype.setupStartSpots = function()
	{
		console.log("setup start spots");
		
		//	figure out how many start spots we care about
		this.curStartSpot = 0;
		var START_RES = this.config.LINE_WIDTH;
		this.startSpotRes = START_RES;
		var xdim = ((this.width+START_RES-1) / START_RES)|0;
		this.startSpotWidth = xdim;
		var ydim = ((this.height+START_RES-1) / START_RES)|0;
		this.startSpotHeight = ydim;
		this.totalStartSpots = xdim * ydim;

		//	now handle several approaches
		if (!this.config.RANDOM_START_SPOTS)	//	linear approach - don't make a list, just go through mathematically.
		{
			console.log("startspot non-array length = " + this.totalStartSpots);
		} else {
			this.startSpots = [];
			for (var y = 0; y < ydim; y++)
			{
				for (var x = 0; x < xdim; x++)
				{
					var index = xdim * y + x;
					this.startSpots[index] = index;	//	store as encoded int for space/speed
				}
			}
			rat.utils.randomizeList(this.startSpots, this.config.rng);
			console.log("startspot length = " + this.startSpots.length);
		}
		
		this.doneSpawning = false;
		
		//	Now, just for fun, let's throw some random start spots in by fiddling with nextPos...
		//	This could be an interesting idea to explore.  E.g. start with diagonal spread of pigs,
		//	or start with a clump in a particular area, or start with user-specified values that mean something
		//		based on the source art... or start with detected dark areas, or whatever.
		/*
		this.nextPos.push(
			{valid: true, pos:{x:20, y:20}}
		);
		this.nextPos.push(
			{valid: true, pos:{x:140, y:20}}
		);
		this.nextPos.push(
			{valid: true, pos:{x:280, y:20}}
		);
		*/
	};
	
	//	create our render canvas (the final image we draw into)
	PigRender.prototype.createRenderCanvas = function()
	{
		//this.overBorder = new rat.Vector(21, 21);
		this.renderCanvas = document.createElement("canvas");
		this.renderCanvas.width = this.width;// + this.overBorder.x * 2;
		this.renderCanvas.height = this.height;// + this.overBorder.y * 2;
		this.renderContext = this.renderCanvas.getContext("2d");

		//this.renderContext.fillStyle = "#404520";
		//this.renderContext.fillRect(0, 0, this.renderCanvas.width, this.renderCanvas.height);
		//	clear - this will clear alpha values, too, which we want!
		this.renderContext.clearRect(0, 0, this.renderCanvas.width, this.renderCanvas.height);
		//var ctx2 = this.renderContext;

		//DRAW_SPACE_X = this.renderCanvas.width;
		//DRAW_SPACE_Y = this.renderCanvas.height;

		this.updateContextModes();
	}

	//	make sure our render context has the right canvas settings/modes, e.g. line cap
	PigRender.prototype.updateContextModes = function()
	{
		if (!this.renderContext)	//	only update if our context exists.  Otherwise, we'll do it later when context is created.
			return;
		
		var ctx2 = this.renderContext;
		if (this.config.MOVE_TYPE === MOVE_STRAIGHT)
			ctx2.lineCap = 'square';
		else
			ctx2.lineCap = 'round';
		ctx2.lineWidth = this.config.LINE_WIDTH;
	}

	//
	//	apply preset size, and all related settings
	//
	PigRender.prototype.applySize = function(sizeIndex)
	{
		if (sizeIndex === void 0)
			sizeIndex = this.config.sizeIndex;
		var standardSize = PigRender.standardSizes[sizeIndex];
		
		this.config.LINE_WIDTH = standardSize.lineWidth;
		this.config.TEST_AHEAD = standardSize.testAhead;
		this.config.MOVE_INCREMENT = standardSize.moveIncrement;
		this.config.SPAWN_GIVE_UP_COUNTER = standardSize.giveUpCounter;

		console.log("size: " + this.config.LINE_WIDTH);
		//console.log("move: " + this.config.MOVE_INCREMENT);
		//console.log("test ahead: " + this.config.TEST_AHEAD);

		this.updateContextModes();
		if (this.myImageData)
			this.myImageData.setLineWidth(this.config.LINE_WIDTH);
	}

	//	backplane - this is an image that draws behind everything
	PigRender.prototype.createBackplane = function()
	{
		this.backplane = document.createElement("canvas");
		this.backplane.width = this.width;// + this.overBorder.x * 2;
		this.backplane.height = this.height;// + this.overBorder.y * 2;
		this.backContext = this.backplane.getContext("2d");
	}

	//update backplane with something interesting - draw circles randomly
	//	Originally, I went through top to bottom left to right,
	//	but that made the final image look sort of shifted,
	//	since bottom-right circles had priority...
	//	so, trying a new approach where we randomize circle order.
	PigRender.prototype.setupBackplane = function()
	{
		console.log("setupBackplane " + this.width + "," + this.height);
		//	leave transparent
		//this.backContext.fillStyle = "#FFFFFF";
		//this.backContext.fillRect(0, 0, this.backplane.width, this.backplane.height);
		this.backplane.width = this.backplane.width;	//	reset to clear with transparency
		
		//	todo:
		//	maybe these blobs should be averaged colors,
		//	so there's less chance of high-contrast artifacts when we fill with backplane later...
		//	todo: probably faster if we store encoded xy integer values instead of objects
		
		var ctx2 = this.backContext;
		//	sync up approximately with line width.  Note that if line changes happen after restart, this is not recalculated, currently.
		var DOT_INC = this.config.LINE_WIDTH * this.config.BACK_PLANE_BLOTCHINESS;//LINE_WIDTH/2;
		if (DOT_INC < 3)	//	too small and it takes forever.  This is good enough...
			DOT_INC = 3;
		var list = [];
		for (var y = DOT_INC/2; y < this.backplane.height; y += DOT_INC)
		{
			for (var x = DOT_INC/2; x < this.backplane.width; x += DOT_INC)
			{
				list[list.length] = {x:x, y:y};
			}
		}
		rat.utils.randomizeList(list, this.config.rng);

		console.log("backplane list " + list.length);
		
		//	todo: optimize this?  If this list of points is long, this can take quite a while...
		//	e.g. skip refColorAt call and creation of color object and toString...
		//	just grab that data directly and set your own color directly?
		
		for (var i = 0; i < list.length; i++)
		{
			var tx = (list[i].x) | 0;
			var ty = (list[i].y) | 0;
			//var tx = Math.floor(x);
			//var ty = Math.floor(y);
			var origC = this.refColorAt(tx, ty);
			if (origC.a < 0.01)	//	don't bother with almost transparent bits
				continue;
			
			if (this.config.RANDOM_LUMINANCE_START)
			{
				var c = randomSameLum(origC, this.config.rng);
				c.a = origC.a;
				
				/*var c = new rat.graphics.Color();
				c.r = 255;
				c.g = 255;
				c.b = 0;
				c.applyLimits();
				c = matchLum(c, origC);
				*/
				
				ctx2.fillStyle = c.toString();
			} else {
				//ctx2.fillStyle = origC.toString();
				ctx2.fillStyle = "rgba(" + origC.r + "," + origC.g + "," + origC.b + "," + origC.a + ")";
			}
			
			//	too small and it's too much like original image.  too big and it's not accurate enough.
			var scale = DOT_INC + this.config.rng.random() * DOT_INC/2;

			if (this.config.MOVE_TYPE == MOVE_STRAIGHT)
			{
				//this.backContext.fillRect(x-scale, y-scale, scale*2, scale*2);
				this.backContext.fillRect(tx-scale/2, ty-scale/2, scale, scale);
			} else {
				//	circle version
				ctx2.beginPath();
				ctx2.arc(tx, ty, scale, 0, Math.PI * 2, true);
				ctx2.closePath();
				ctx2.fill();
			}
		}
		
		//	temp test:
		//ctx2.fillStyle = "#00FF00";
		//ctx2.fillRect(0, 0, this.backplane.width, this.backplane.height/2);
		//ctx2.fillStyle = "#0000FF";
		//ctx2.fillRect(0, this.backplane.height/2, this.backplane.width, this.backplane.height/2);
		
		//	test - respect background alpha on a pixel by pixel basis.
		//	So, anything in the original image that is transparent, make transparent in the backplane.
		//	This is very helpful with images that have transparent sections - otherwise, our blotchy backplane,
		//	when eventually used to fill gaps, will mess up any nice smooth edge lines we created when drawing.
		if (1)
		{
			this.backContext.globalCompositeOperation = 'destination-in';
			//this.backContext.fillRect(0, 200, this.backplane.width, this.backplane.height);
			this.backContext.drawImage(this.refCanvas, 0, 0);
			this.backContext.globalCompositeOperation = 'source-over';
		}
		
		console.log("setupBackplane drawn");
		
		//	in some variants we need this...
		if (this.config.USE_BACK_START_COLOR)
		{
			var imageData = this.backContext.getImageData(0, 0, this.backplane.width, this.backplane.height);
			this.backPixelData = imageData.data;
		}
	}

	//	draw my backplane into this given context
	PigRender.prototype.drawBackplane = function(ctx)
	{
		if (this.backplane)
		{
			//var coverWidth = this.refCanvas.width;
			//var coverHeight = this.refCanvas.height;
			//ctx.drawImage(this.backplane, 0, 0, coverWidth, coverHeight, 0, 0, coverWidth, coverHeight);
			ctx.drawImage(this.backplane, 0, 0);//, coverWidth, coverHeight, 0, 0, coverWidth, coverHeight);
		}
	};
	
	//	create reference canvas to draw our reference image into
	PigRender.prototype.createRefCanvas = function()
	{
		this.refCanvas = document.createElement("canvas");
		this.refCanvas.width = this.width;// + this.overBorder.x * 2;
		this.refCanvas.height = this.height;// + this.overBorder.y * 2;
		this.refContext = this.refCanvas.getContext("2d");
	};

	//
	//	draw into reference screen (offscreen buffer)
	//	with the current reference image
	//	and create our reference pixel data
	PigRender.prototype.setupRefCanvas = function(image)
	{
		//	todo: DON'T FILL!  We need to support transparency.
		//this.refContext.fillStyle = "#202020";	//	change this to use background color
		//this.refContext.fillRect(0, 0, this.refCanvas.width, this.refCanvas.height);
		
		//	draw a picture in there...

		/*temp test
		this.refContext.fillStyle = "#C0C040";
		this.refContext.fillRect(200, 200, 400, 400);

		this.refContext.fillStyle = "#F03040";
		this.refContext.fillRect(100, 100, 300, 150);

		this.refContext.fillStyle = "#4080f0";
		this.refContext.fillRect(400, 120, 100, 100);
		*/

		this.refContext.drawImage(image, 0, 0);
		this.setupRefPixels();
	};

	//	set up imagedata for pixels from our reference canvas
	PigRender.prototype.setupRefPixels = function()
	{
		var imageData = this.refContext.getImageData(0, 0, this.refCanvas.width, this.refCanvas.height);
		this.refPixelData = imageData.data;
	};

	//	draw refCanvas
	//	this is for debug...
	PigRender.prototype.drawRefCanvas = function(ctx)
	{
		if (this.refCanvas)
		{
			var coverWidth = this.refCanvas.width;
			var coverHeight = this.refCanvas.height;
			//ctx.drawImage(this.refCanvas, this.overBorder.x, this.overBorder.y, coverWidth, coverHeight, 0, 0, coverWidth, coverHeight);
			ctx.drawImage(this.refCanvas, 0, 0);
		}
	};
	
	//	draw start spots left (debug!)
	PigRender.prototype.drawStartSpots = function(ctx)
	{
		if (!this.startSpots)
			return;
		
		ctx.fillStyle = "#80FF80";
		for (var i = this.curStartSpot; i < this.startSpots.length; i++)
		{
			var val = this.startSpots[i];
			var sx = val % this.startSpotWidth;
			var sy = (val - sx) / this.startSpotWidth;
			var x = sx * this.startSpotRes;
			var y = sy * this.startSpotRes;
			if (y < 0)
			{
				console.log("ugh");
			}
			ctx.fillRect(x-3, y-3, 6, 6);
		}
	};

	//	get a single color from a spot in our reference pixel data
	PigRender.prototype.refColorAt = function(x, y)
	{
		var offset = (this.refCanvas.width * y + x) * 4;
		
		//	don't construct a whole rat color object for this.  It's expensive.
		//	just return rgb values directly.
		//	Any caller that needs a real Color object can make their own.
		//var c = new rat.graphics.Color(this.refPixelData[offset], this.refPixelData[offset+1], this.refPixelData[offset+2], this.refPixelData[offset+3]/255);
		//return c;
		
		return {
			r:this.refPixelData[offset],
			g:this.refPixelData[offset+1],
			b:this.refPixelData[offset+2],
			a:this.refPixelData[offset+3]/255
		};
	}

	//	get a single luminance value from a spot in our reference pixel data
	PigRender.prototype.refLumAt = function(x, y)
	{
		var offset = (this.refCanvas.width * y + x) * 4;
		var lum = LUM_R * this.refPixelData[offset]/255 + LUM_G * this.refPixelData[offset+1]/255 + LUM_B * this.refPixelData[offset+2]/255;
		
		return lum;
	}

	//	get color of backplane at a given location
	PigRender.prototype.backColorAt = function(x, y)
	{
		var offset = (this.backplane.width * y + x) * 4;
		var c = new rat.graphics.Color(this.backPixelData[offset], this.backPixelData[offset+1], this.backPixelData[offset+2]);
		
		return c;
	}

	//	util: pick a random color the same luminance as this reference color
	randomSameLum = function(color, rng)
	{
		var c = new rat.graphics.Color();
		//	TODO: use random generator!
		c.setRandom(rng);
		return matchLum(c, color, rng);
	}

	//	util: adjust this color to match the luminance of the given reference color.
	matchLum = function(color, lumColor, rng)
	{
		var startLum = lumColor.luminancePerceived();
		var newColor = color.copy();
		
		//	fix luminance by adjusting colors, and do that in random order.
		//	This pretty much sucks.
		//	Need real math to find closest color that matches luminance, but uses the same HUE.
		//	Need Hue Saturation Luminance, basically.  (HSP?)  Keep hue, move lum, then convert to rgb.
		//	Can HSV do this?  I don't think so!  It's not the same!  (I've tried it, and it didn't really help)
		//	maybe http://stackoverflow.com/questions/6478284/whats-the-formula-to-increase-the-luminance-in-an-image-in-a-similar-way-how-th
		//	https://en.wikipedia.org/wiki/HSL_and_HSV
		//	(look for "From luma/chroma/hue")
		//	http://colormine.org/convert/rgb-to-lab
		//	but we really just want luminance, not luma.
		//	I need a color model that uses luminance.
		var order = [
			{name:'r', ratio: LUM_R},
			{name:'g', ratio: LUM_G},
			{name:'b', ratio: LUM_B},
			];
		rat.utils.randomizeList(order, rng);
		
		var passCount = 20;
		for (var pass = 0; pass < passCount; pass++)
		{
			for (var i = 0; i < 3; i++)
			{
				var o = order[i];
				
				var oldVal = newColor[o.name];
				
				var newLum = startLum;
				for (var otherIndex = 0; otherIndex < 3; otherIndex++)
				{
					if (otherIndex === i)
						continue;
					newLum -= order[otherIndex].ratio * newColor[order[otherIndex].name]/255;
				}
				var fixed = newLum / o.ratio;
				newColor[o.name] = fixed * 255 / 8 + oldVal * 7/8;	//	only partway there each pass
				
				//	old:
				//var fixed = (startLum - LUM_R * newColor.r/255 - LUM_B * newColor.b/255) / LUM_G;
				//newColor.g = fixed * 255;
				newColor.applyLimits();
			}
		}
		
		//	check it...
		var lum = newColor.luminancePerceived();	//	test
		var dlum = lum - startLum;
		if (dlum < -0.1 || dlum > 0.1)
		{
			console.log("dlum = " + (lum - startLum));
		}
		
		return newColor;
	};

	//	draw our render image into this context
	//	todo: more sophisticated drawing support, scaling, etc.?
	PigRender.prototype.draw = function(targetCtx)
	{
		if (this.state === STATE_DONE && this.config.DRAW_DONE_WITH_BACKPLANE)
			this.drawBackplane(targetCtx);
		if (this.renderCanvas)
			targetCtx.drawImage(this.renderCanvas, 0, 0);
	};
	
	
	//	get final rendered image
	//	a client could do this themselves, but this is convenient.
	//	One use of this is to get the final render and then throw away the whole pigRender object, when we're done.
	//	todo: specify new size
	PigRender.prototype.getFinalRender = function(w, h)
	{
		if (!w)
			w = this.width;
		if (!h)
			h = this.height;
		
		var canvas = document.createElement("canvas");
		canvas.width = w;
		canvas.height = h;
		var ctx = canvas.getContext("2d");
		ctx.save();
		ctx.scale(w/this.width, h/this.height);
		this.draw(ctx);
		ctx.restore();
		return canvas;
	};
	
	//
	//	Update (draw into) our render canvas based on our state, pigs, etc.
	//
	//	Old optimization idea:
	//		Since stroke call is expensive,
	//		don't make stroke call if we're not actually rendering.
	//		just call setPixels...
	//		Do the stroke call later, based on saved up points.
	//		Downsides:
	//			slightly more complicated code.
	//			will need to finish draw before we kill a pig in the middle of an update.
	//			two pigs drawing next to each other won't quite look the same, but we almost never have that.
	//			we'll need to cut it off regularly to get a color change - stroke color can't change mid-stroke.
	//				but that's good anyway - fewer calls to color.tostring
	//		OK, this didn't work!
	//			Because we need colors to shift over time,
	//			we must eventually break up the stroke calls,
	//			and as soon as we do that, we start getting alpha overlapping problems,
	//			and it looks like dotted lines.
	//		Could consider only supporting alpha value of 1... would that fix it?
	//			probably.
	//			It's already kinda questionable that we have an alpha of non-1, since we draw so tight and overlapped,
	//			most likely the alpha is not relevant.  Try again with forced alpha of 1?
	//	I tried just increasing move distance, but that actually slowed things down.
	//	So, other ideas to reduce stroke calls?
	PigRender.prototype.drawToRenderCanvas = function()
	{
		var ctx2 = this.renderContext;
		var len = this.pigs.length;

		for (var pigIndex = 0; pigIndex < len; pigIndex++)
		{
			var pig = this.pigs[pigIndex];
			
			if (pig.stuck)
				continue;	//	don't bother drawing - we didn't move
		
			var x = pig.place.pos.x;
			var y = pig.place.pos.y;
				
			//ctx2.fillStyle = pig.color.toString();//"#FFA040";
			//	optimization idea: only update this every once in a while,
			//	store string version in pig.colorString
			ctx2.strokeStyle = pig.color.toString();
				
			ctx2.beginPath();
			ctx2.moveTo(pig.oldPos.x, pig.oldPos.y);
			ctx2.lineTo(x, y);
			ctx2.stroke();
			
			//	update my own pixel tracking whether we drew or not.
			this.myImageData.setPixels(x, y);	//	set data to myImageData as well, for faster collision tests
		}
	}

	/*
	PigRender.prototype.drawPigs = function(ctx)
	{
		for (var i = 0; i < this.pigs.length; i++)
		{
			var pig = this.pigs[i];
			ctx.save();
			ctx.translate(pig.place.pos.x - this.overBorder.x, pig.place.pos.y - this.overBorder.y);
			ctx.rotate(-pig.place.rot.angle + Math.PI/2);// + Math.PI);
			
			var image = this.pigImage.getImage();
			if (image != null)
			{
				ctx.drawImage(image, -image.width/2, -image.height/2);
			}
			ctx.restore();
		}
	}
	*/

	//	temp separate function for profiling
	/*
	function getPixelData()
	{
		if (this.config.USE_MY_PIXELS)
			var imageData = this.myImageData.getImageData();
		else
			var imageData = this.renderContext.getImageData(0, 0, this.renderCanvas.width, this.renderCanvas.height);
		
		return imageData.data;
	}
	*/

	//	Update all of our pigs
	PigRender.prototype.updatePigs = function(dt)
	{
		//	get ready to test pixels
		var pixelData = this.myImageData.getImageData();//getPixelData();
		//console.log('pixelData ' + pixelData);

		var numOverTime = 0;
		var numSpawning = 0;

		for (var pigIndex = 0; pigIndex < this.pigs.length; pigIndex++)
		{
			var pig = this.pigs[pigIndex];
			
			if (pig.spawning)
			{
				if (!this.doneSpawning)
					pig.updateSpawn(pixelData);
				if (pig.spawning)	//	still spawning even after trying new spot?
				{
					numSpawning++;
					
					//	if we're using startspots, don't worry about giving up.  We'll just run through them.
					if (!this.totalStartSpots)
					{
						if (pig.spawnTimer > this.config.SPAWN_GIVE_UP_COUNTER)
						{
							numOverTime++;
							this.everGoneOver = true;
							//console.log("over");
						}
						if (pig.spawnTimer > this.config.SPAWN_GIVE_UP_COUNTER/2)	//	keep track of getting close to done
						{
							this.everGonePartOver = true;
						}
					}
				}
			} else {
				pig.updateMove(pixelData);
				pig.updateStuck(pixelData);
			}
		}
		
		//	doneRatio is used by various systems to detect how far we've done, how much we need to do this update, etc.
		if (this.totalStartSpots)
			this.doneRatio = this.curStartSpot / this.totalStartSpots;
		else
			this.doneRatio = 0.5;	//	we have no idea, really!
		
		//	detect completion and go into done mode, if needed.
		if (this.doneRatio >= 1)
			this.setDone();
		else if (numSpawning == this.pigs.length && (this.everGoneOver || this.doneSpawning))
		{
			this.setDone();
		}
	};
	
	PigRender.prototype.setDone = function()
	{
		//console.log("DONE");
		this.state = STATE_DONE;
		console.log("draw time " + this.drawTime + " at " + this.config.ORIG_UPDATE_SPEED + " + " + this.config.SPEED_INCREASE);
	};
	
	PigRender.prototype.isDone = function()
	{
		return this.state === STATE_DONE;
	};
	
	//	repeating update function
	PigRender.prototype.update = function(dt)
	{
		if (this.state == STATE_DRAW && !this.paused)
		{
			this.drawTime += dt;
			
			if (this.config.UPDATE_RATIO)
			{
				var targetRatio = this.doneRatio + this.config.UPDATE_RATIO;	//	new target ratio step to hit
				if (targetRatio > 1)
					targetRatio = 1;
				//	important to run at least one updatePigs() call each loop,
				//	since inside there is where we detect completion.
				do {
					this.updatePigs(dt);
					this.drawToRenderCanvas();
				} while (this.doneRatio < targetRatio && this.state == STATE_DRAW);
				console.log("doneRatio " + this.doneRatio);
				
				if (this.config.SPEED_INCREASE)
					this.config.UPDATE_RATIO += this.config.SPEED_INCREASE;
				
			} else {	//	simple version that just runs a fixed number of updates
				for (var i = 0; i < this.config.UPDATE_SPEED && this.state == STATE_DRAW; i++)
				{
					this.updatePigs(dt);
					this.drawToRenderCanvas();
				}
				if (this.config.SPEED_INCREASE)
					this.config.UPDATE_SPEED += dt * this.config.SPEED_INCREASE;
			}
			//console.log("ratio " + this.doneRatio);
		}
	};

	/*
	PigRender.prototype.startDot = function(pos)
	{
		
		var baseX = pos.x;// + this.overBorder.x;
		var baseY = pos.y;// + this.overBorder.y;
		
		//	let's try to make them all the same color and see how that goes.
		this.curBaseColor.setRandom();
		
		this.nextPos.push(
			{valid: true, pos:{x:baseX, y:baseY}}
		);
		for (var i = 0; i < 35; i++)
		{
			var x = baseX + Math.random() * 40 - 20;
			var y = baseY + Math.random() * 40 - 20;
			
			this.nextPos.push(
				{valid: true, pos:{x:x, y:y}}
			);
		}
		
		//	since the user is interacting, they probably don't want to stop soon,
		//	so cut down all spawn over timers.
		for (var pigIndex = 0; pigIndex < this.pigs.length; pigIndex++)
		{
			var pig = this.pigs[pigIndex];
			
			if (pig.spawning)
			{
				pig.spawnTimer /= 2;
			}
		}
		this.everGoneOver = false;
	};

	function startRandomDot(e)
	{
		var x = Math.random() * rat.graphics.SCREEN_WIDTH;
		var y = Math.random() * rat.graphics.SCREEN_HEIGHT;
		startDot({x:x, y:y});
	};
	*/

	//	update pig count larger or smaller
	PigRender.prototype.setPigCount = function(newCount)
	{
		this.config.NUM_PIGS = newCount;
		while (newCount > this.pigs.length)
		{
			var newPig = new Pig(this);
			this.pigs.push(newPig);
		}
		if (newCount < this.pigs.length) {
			this.pigs.splice(newCount);
		}
	};

	//	set pig size from a standard list of sizes
	PigRender.prototype.setPigSize = function(newSizeIndex)
	{
		var sizes = PigRender.standardSizes;
		
		this.config.sizeIndex = newSizeIndex;
		
		//	limit to official list
		if (this.config.sizeIndex < 0)
			this.config.sizeIndex = 0;
		if (this.config.sizeIndex >= sizes.length)
			this.config.sizeIndex = sizes.length-1;

		this.applySize(this.config.sizeIndex);
	};

	//	set pig movement style
	PigRender.prototype.setPigStyle = function(moveType)
	{
		this.config.MOVE_TYPE = moveType;
		
		//console.log("move type: " + MOVE_TYPE);

		//	if straight, fix some pigs to face the right direction.
		//	todo: make this a pig-based reset function that does its own thinking, more generic and flexible that way.
		if (moveType === MOVE_STRAIGHT)
		{
			for (var pigIndex = 0; pigIndex < this.pigs.length; pigIndex++)
			{
				this.pigs[pigIndex].pickRandomSquareAngle();
			}
		}

		this.updateContextModes();

		if (moveType === MOVE_STRAIGHT)
		{
			this.config.STUCK_GIVE_UP_COUNT = STUCK_GIVE_UP_STRAIGHT;
			this.config.FOLLOW_WALLS = false;	//	actually pretty cool, though, when this is true!
		}
		else if (moveType === MOVE_RANDOM)
		{
			this.config.STUCK_GIVE_UP_COUNT = STUCK_GIVE_UP_RANDOM;
			this.config.FOLLOW_WALLS = false;	//	actually pretty cool, though, when this is true!
		}
		else
		{
			this.config.STUCK_GIVE_UP_COUNT = STUCK_GIVE_UP_CURVED;
			this.config.FOLLOW_WALLS = true;
		}
	};

	//	set speed
	PigRender.prototype.setSpeed = function(speed)
	{
		this.config.ORIG_UPDATE_SPEED = speed;
		this.config.UPDATE_SPEED = speed;
	};
	PigRender.prototype.setSpeedIncrease = function(speedInc)
	{
		this.config.SPEED_INCREASE = speedInc;
	};

	PigRender.prototype.setPaused = function(newPaused)
	{
		this.paused = newPaused;
	};

	//------------------------------------------------
	//	individual pig class
	var Pig = function (pigRender)	//	constructor for a single pig
	{
		this.render = pigRender;
		this.config = pigRender.config;
		var config = pigRender.config;
		//	position is actually really set in updateSpawn()
		this.place = new rat.Position(0, 0, 0);
		this.oldPos = new rat.Vector(this.place.pos.x, this.place.pos.y);
		this.spawning = true;	//	spawn through normal spawn mechanic
		this.wait = false;
		this.spawnTimer = 0;
		this.stuck = true;	//	current place is not valid, don't draw from it.  Force us to find new place to move to.
		this.stuckTimer = 0;
		
		//	this part is bogus - spawn mechanic will pick a real color, right?
		this.color = new rat.graphics.Color();
		this.startColor = this.color.copy();
		this.startLum = this.color.luminancePerceived();
		this.color.setRandom(this.config.rng);	//	not actually used when we have a ref image

		if (pigRender.config.MOVE_TYPE == MOVE_STRAIGHT)
		{
			this.pickRandomSquareAngle();
		}
	}

	//	in support of a square movement style, pick a random direction right/down/left/up
	Pig.prototype.pickRandomSquareAngle = function()
	{
		var ang = this.config.rng.random();
		this.place.rot.angle = Math.floor(ang * 4) * Math.PI / 2;
	}
	
	//	test this pixel and see if it's OK for movement, according to our configuration
	//	return true if OK, return false if blocking
	Pig.prototype.pixelIsBlocking = function(x, y)
	{
		var config = this.config;
		var pixA;
		if (config.USE_MY_PIXELS)
			pixA = this.render.myImageData.getValue(x, y);
		else {
			var offset = (this.render.renderCanvas.width * y + x) * 4;
			pixA = pixelData[offset + 3];
		}
		if (pixA > config.ALPHA_CLEAR_LEVEL)	//	already drawn here in destination image
		{
			//console.log("stuck alpha " + pixelData[offset + 3]);
			return true;
		} else if (config.USE_REF_IMAGE_LUM) {	//	also check reference image (luminance)
			var lum = refLumAt(x, y);
			if (lum - this.startLum < -config.COLOR_LUM_THRESH || lum - this.startLum > config.COLOR_LUM_THRESH)
				return true;
		} else if (config.USE_REF_IMAGE) {		//	check reference image (rgb)
			//	also test pixels in refcanvas
			//	maybe just do this sometimes for speed?  Or optimize this code if necessary?
			var c = this.render.refColorAt(x, y);
			var deltaColorSq = this.startColor.distanceSq(c);	//	measure from start color, not current, so drift in color doesn't break us
			//	debug
			//if (deltaColorSq > 3000)
			//	console.log("dcq = " + deltaColorSq);
			//	stick
			if (deltaColorSq > config.COLOR_SQ_THRESH)
				return true;
		}
		
		return false;	//	everything's fine
	};

	//	update a moving pig's position
	Pig.prototype.updateMove = function(pixelData)
	{
		var render = this.render;
		var config = this.config;
		
		var pig = this;
		var pos = pig.place.pos;
		pig.oldPos.x = pos.x;	//	remember old pos before moving
		pig.oldPos.y = pos.y;
		
		//if (!pig.stuck)	//	well, we spend a lot of time stuck, and we still want this a lot of the time?
		{
			//	curve? move randomly? compare with below logic to get out of corner.
			if (config.MOVE_TYPE == MOVE_RANDOM)
				pig.place.rot.angle += (config.rng.random() * config.RANDOM_TURN_RANGE - config.RANDOM_TURN_RANGE/2);	//	turn randomly
			else if (config.MOVE_TYPE == MOVE_CURVE)
			{
				//	note that during normal curved movement, we increment angle, and when trying to get unstuck, we reverse it.
				pig.place.rot.angle += config.NORMAL_TURN_INCREMENT;// * gDT;	//	curve slightly - again better if this is not framerate-related
			}
			
			//	follow walls affects different move modes differently.
			if (config.FOLLOW_WALLS) {	//	try a little harder to follow walls.  This might be expensive...?
				//	we only want to do this if there *IS* a wall there, right? Let's try that.
				
				var len = config.TEST_AHEAD * 2;	//	lookahead is somehow not big enough in this case?  Hrm...
				//	pi*0.5 here = look directly to the side.
				//	pi*0.25 = look forward-left diagonally
				//	we might fiddle with this angle a bit...
				var newAngle = pig.place.rot.angle + Math.PI * 0.4;
				var x = (pos.x + Math.sin(newAngle) * len) | 0;
				var y = (pos.y + Math.cos(newAngle) * len) | 0;
				
				if (pig.pixelIsBlocking(x, y))
				{
					//	a higher value here results in tighter line following,
					//	but more frequent jumping outside of lines.
					//	we could possibly do another check here.  If forward path is also blocked,
					//	before turning, then don't turn so much.
					//	but we check that below anyway.  Hmm...
					pig.place.rot.angle += 1 * config.NORMAL_TURN_INCREMENT
				}
				
				/*
				//	look forward and a little left (left curve)
				var len = config.TEST_AHEAD;
				var newAngle = pig.place.rot.angle - Math.PI/4;
				var x = Math.floor(pos.x + Math.sin(newAngle) * len);
				var y = Math.floor(pos.y + Math.cos(newAngle) * len);
				
				if (pig.pixelIsBlocking(x, y))
					pig.place.rot.angle += 2 * config.NORMAL_TURN_INCREMENT
				*/
			}
		}
		
		//	also find new algorithm to follow wall, make that optional?
		//	also dots or leaves or something
			
		if (!pig.stuck)
		{
			//	change color?
			//	todo - more interesting random walk that doesn't end at white or black?
			//	or use hsv conversion?  could be slow, unless we remember that value and only convert one way each time.
			/*
			pig.color.r += (Math.floor(Math.random() * 6 - 2.5));
			pig.color.g += (Math.floor(Math.random() * 6 - 2.5));
			pig.color.b += (Math.floor(Math.random() * 6 - 2.5));
			pig.color.applyLimits();
			*/
			var VARIANCE = config.COLOR_CHANGE_VARIANCE;
			var HALF_VARIANCE = config.COLOR_CHANGE_HALF_VARIANCE;
			
			var pc = pig.color;	//	pig color object reference
				
			/*	old code:
				pc.r += Math.random() * VARIANCE - HALF_VARIANCE;
				pc.g += Math.random() * VARIANCE - HALF_VARIANCE;
				pc.b += Math.random() * VARIANCE - HALF_VARIANCE;
				if (pc.r < 0) pc.r = 0;
				if (pc.g < 0) pc.g = 0;
				if (pc.b < 0) pc.b = 0;
		//		if (pc.a < 0) pc.a = 0;
				if (pc.r > 255) pc.r = 255;
				if (pc.g > 255) pc.g = 255;
				if (pc.b > 255) pc.b = 255;
		//		if (pc.a > 1) pc.a = 1;
				pc.r = pc.r|0;	//	floor
				pc.g = pc.g|0;
				pc.b = pc.b|0;
			*/
			
			//	That's all fine, but we're playing with some new ideas:
			
			//	new approach that tries not to go too far...
			//	make a temp copy of the color values to play with
			var c = {
				r:pc.r,
				g:pc.g,
				b:pc.b,
			};
			c.r += config.rng.random() * VARIANCE - HALF_VARIANCE;
			c.g += config.rng.random() * VARIANCE - HALF_VARIANCE;
			c.b += config.rng.random() * VARIANCE - HALF_VARIANCE;
			if (c.r < 0) c.r = 0;
			if (c.g < 0) c.g = 0;
			if (c.b < 0) c.b = 0;
			if (c.r > 255) c.r = 255;
			if (c.g > 255) c.g = 255;
			if (c.b > 255) c.b = 255;
			c.r = c.r|0;	//	floor
			c.g = c.g|0;
			c.b = c.b|0;
			
			//	note that the "value" calculated here is strange,
			//	not really an artistic color value...
			/*
			var newValue = c.r + c.g + c.b;
			var dv = newValue - pig.startColorValue;
			if (dv < 10 && dv > -10)
			{
				pc.r = c.r;
				pc.g = c.g;
				pc.b = c.b;
			}*/
			
			//	That looks fine, truly, and still gives us some wild colors sometimes...
			//	Another approach is
			//	to calculate distance in color space,
			//	which would mean more math, but let's try it...
			//	Again, being in HSV space would be convenient here!
			//	This also looks pretty good.  Loses some character, though - fewer wild random colors thrown in.
			var dr = c.r - pig.startColor.r;
			var dg = c.g - pig.startColor.g;
			var db = c.b - pig.startColor.b;
			var dc = dr * dr + dg * dg + db * db;
			
			//	are we still within a reasonable distance of start color?
			//	this value strongly controls color variance within one pig-drawn-line.
			//		NOTE: we still look at the distance from original color in a different place when checking for when to stop drawing
			//			with this pig.  That threshold is different.  So, we still end up spreading a color over other colors,
			//			in a way that can be quite a bit different from the original image.  It all depends on the look you want...
			if (dc < config.COLOR_CHANGE_LIMIT*config.COLOR_CHANGE_LIMIT)
			{
				pc.r = c.r;
				pc.g = c.g;
				pc.b = c.b;
			}
			
			//	or, to go back to previous approach,
			//	just copy the colors back in without caring how much they changed
			//	Funny note:  only changing pc.r value to c.b value here is a cool gray-pink look.
			//		e.g. pc.r = c.b;
			//pc.r = c.r;
			//pc.g = c.g;
			//pc.b = c.b;
		}

		//	Look ahead:
		//	It's important to look ahead, not where we are, because otherwise we're sensing our own trail before we've moved off,
		//	so we turn too early and too often.
		//	wall following gets messed up as well.
		//	Problem:  Look ahead is important, but it means we're testing one space and moving to another...
		//	Example situation:  we look ahead, see empty space, and OK the move, but the move doesn't write to that empty space,
		//	sometimes we get stuck the next turn, flip around, do the same in the opposite direction,
		//	then flip around and look ahead at the same space ahead,
		//	see that it's empty, but again not written to, and repeat, getting stuck forever.
		//	Option:  for "stuck" detect how far we've moved.  More math, so slower... :(
		//	What we're doing now:  Limit line size to 4, so look ahead is less likely to be in subpixel space, and we seem to be OK...

		var angle = pig.place.rot.angle;
		var move = config.MOVE_INCREMENT;
		if (pig.stuck && pig.stuckTimer > config.STUCK_GIVE_UP_COUNT/2)
		{
			//	if I'm stuck, be a little more aggressive in finding a new spot - try random distances
			move = config.rng.random() * config.MOVE_INCREMENT * 2;
		}
		
		//	actually move.
		//	OK, I'm changing this to not be DT related...  This will help results be independent of frame rate.
		//	since there's no user interaction, that's fine, and preferred.
		pos.x += Math.sin(angle) * move;// * gDT;
		pos.y += Math.cos(angle) * move;// * gDT;
		
		//	Detect stuckness.
		pig.stuck = false;	//	assume we're unstuck, until proven otherwise
		//if (pos.x < this.overBorder.x || pos.y < this.overBorder.y || pos.x > DRAW_SPACE_X - this.overBorder.x || pos.y > DRAW_SPACE_Y - this.overBorder.y)
		if (pos.x < 0 || pos.y < 0 || pos.x > render.width || pos.y > render.height)
		{
			pig.stuck = true;
		} else {
			//	test pixels in ofscreen
			//	look a little ahead
			////var len = TEST_AHEAD + this.config.rng.random() * TEST_SHORT;
			var len = config.TEST_AHEAD;
			var x = Math.floor(pos.x + Math.sin(angle) * len);
			var y = Math.floor(pos.y + Math.cos(angle) * len);
			//var x = Math.floor(pos.x);// + Math.sin(angle) * len);
			//var y = Math.floor(pos.y);// + Math.cos(angle) * len);
			
			if (pig.pixelIsBlocking(x, y))
				pig.stuck = true;
		}
	}

	//
	//	Update this pig's stuck state - if stuck, do something about it.
	//	(called whether pick is stuck or not, updates stuck timer either way)
	//
	Pig.prototype.updateStuck = function(pixelData)
	{
		var pig = this;
		var config = this.config;
		if (pig.stuck)
		{
			if (config.MOVE_TYPE == MOVE_RANDOM)
				pig.place.rot.angle = this.config.rng.random() * Math.PI * 2;
			else if (config.MOVE_TYPE == MOVE_STRAIGHT)
			{
				pig.place.rot.angle += Math.PI / 2;
			}
			else	//	turn out of it over time, in reverse direction of normal turning
				pig.place.rot.angle -= config.STUCK_TURN_INCREMENT;// * gDT;
				
			//	go back to old known good pos (why?)
			pig.place.pos.x = pig.oldPos.x;
			pig.place.pos.y = pig.oldPos.y;
			
			//pig.stuckTimer += gDT;
			pig.stuckTimer += 1;	//	fixed logic instead of time-based, so framerate doesn't matter
			//console.log('boing! ' + pig.place.pos.x + "," + pig.place.pos.y);

			if (pig.stuckTimer > config.STUCK_GIVE_UP_COUNT)
			{
				//console.log('pop!');
				pig.spawning = true;
				pig.wait = true;	//	temp test...
				pig.color.setRandom(this.config.rng);
			}
		} else {
			pig.stuckTimer = 0;
		}
	}

	//
	//	Update a pig that's spawning
	//
	Pig.prototype.updateSpawn = function(pixelData)
	{
		var pig = this;
		var config = this.config;
		var render = this.render;
		
		//	pick random spot and see if it's valid.  But just do this once per update.

		//	use user-selected pos?
		if (render.nextPos.length)
		{
			pig.place.pos.copyFrom(render.nextPos[0].pos);
			render.nextPos.shift();
		} else if (render.totalStartSpots) {
			
			//	just pick this predetermined spot and move on.
			//	if it's blocked, we'll find out below, and it's fine - we won't pick this start spot again anyway.
				
			var sx, sy;
			if (render.startSpots)
			{
				var val = render.startSpots[render.curStartSpot++];
				
				//	deconstruct xy values from packed xy value
				sx = val % render.startSpotWidth;
				sy = (val - sx) / render.startSpotWidth;
			
			} else {
				
				//	go from center vertically...
				//	Start in the middle, and each alternate value goes up or down from center...
				var val = render.curStartSpot++;
				sx = val % render.startSpotWidth;
				
				//	optional - go from center horizontally, too?
				var mx = (sx % 2) * 2 -1;
				sx = render.startSpotWidth/2 + (((sx+1)/2)|0) * mx;//	+1 so we don't duplicate the first value...
				
				sy = ((val/render.startSpotWidth)|0);
				var m = (sy % 2) * 2 - 1;	//	convert from even/odd to -1 or 1
				sy = render.startSpotHeight/2 + (((sy+1)/2)|0) * m;//	+1 so we don't duplicate the first line...
				
				//	an older simple version that really just goes linearly...
				//	by adding render.startSpotWidth/2, we're picking horizontally centralized spots first.
				//	technically this starts in the middle, moves right, and then wraps from left,
				//	but it usually happens fast enough that nobody notices.
				//	similarly, we can add render.totalStartSpots/2 to start vertically in the middle as well,
				//	but that is more visible and looks funny.
				//	So, a simple top-down approach is better...
				//	todo: move some of this math to setup for better speed..?
				//var val = ((render.curStartSpot++) + render.startSpotWidth/2 + render.totalStartSpots/2) % render.totalStartSpots;
				//var val = (((render.curStartSpot++) + render.startSpotWidth/2)|0) % render.totalStartSpots;
				//	and like the other approach, just deconstruct xy values from packed xy value
				//sx = val % render.startSpotWidth;
				//sy = (val - sx) / render.startSpotWidth;
				
				//if (render.curStartSpot < 400)
				//	console.log("sx,sy: " + sx + ", " + sy);
			}
			
			pig.place.pos.x = sx * render.startSpotRes;
			pig.place.pos.y = sy * render.startSpotRes;
			
			if (render.curStartSpot >= render.totalStartSpots)
				render.doneSpawning = true;
			
		} else {
			
			if (config.WAIT_FOR_NEXT_POS_TO_SPAWN)
			{
				//	don't autospawn at all...
				pig.spawnTimer = 0;
				return;
			}
			
			//	be sure to spawn from inside normal area, not in overborder
			//pig.place.pos.x = Math.floor(Math.random()*(this.render.width - this.overBorder.x*2)) + this.overBorder.x;
			//pig.place.pos.y = Math.floor(Math.random()*(this.render.height - this.overBorder.y*2)) + this.overBorder.y;
			pig.place.pos.x = Math.floor(this.config.rng.random()*(this.render.width));
			pig.place.pos.y = Math.floor(this.config.rng.random()*(this.render.height));
		}
		//todo new random direction, too.
		
		var x = Math.floor(pig.place.pos.x);
		var y = Math.floor(pig.place.pos.y);

		var pixA;
		if (config.USE_MY_PIXELS)
			pixA = render.myImageData.getValue(x, y);
		else {
			var offset = (this.renderCanvas.width * y + x) * 4;
			pixA = pixelData[offset + 3];
		}
		if (pixA <= config.ALPHA_CLEAR_LEVEL)	//	we're OK
		{
			pig.spawning = false;
			pig.spawnTimer = 0;

			if (config.USE_REF_IMAGE)
			{
				var cvals = render.refColorAt(x, y);
				pig.color = new rat.graphics.Color(cvals.r, cvals.g, cvals.b, cvals.a);
			}
			else
				pig.color.setRandom(this.config.rng);
			
			//	test: mess with color in an interesting way!
			//	pick a different color that matches luminance.
			if (config.USE_BACK_START_COLOR)
			{
				//	start with the back color already there, so we have consistent colors next to others.
				var backColor = render.backColorAt(x, y);
				var refColor = render.refColorAt(x, y);
				
				//	but still luminance-match with original image, so backcolor image can have BIG blotches in it,
				//	without making us start with way-off colors that immediately get stuck...
				pig.color = matchLum(backColor, refColor, this.config.rng);
				
				//pig.color = matchLum(this.curBaseColor, backColor);
				//pig.color = backColor.copy();
			}
			
			//	alpha
			//	NOTE:  Setting this to non-1 value results in an interesting softer look,
			//	almost like watercolor in some cases...
			pig.color.a *= config.LINE_ALPHA;
			
			//	track starting values for later comparison
			pig.startColor = pig.color.copy();
			pig.startColorValue = pig.startColor.r + pig.startColor.g + pig.startColor.b;
			pig.startLum = pig.startColor.luminancePerceived();
			
			pig.stuckTimer = 0;	//	in new place, start over on stuck timer.  TODO:  Maybe shorter, though?

			//	test:  make sure we at least draw *something* here...
			//	maybe don't do this, if it leaves a bunch of little dots everywhere?
			//	Ah, works OK with colors taken from an image, but not so well with random-color algorithms.
			//	Maybe check that and change this logic as a result.
			pig.stuck = false;
			//pig.oldPos.x = pig.place.pos.x - 0.1;
			//pig.oldPos.y = pig.place.pos.y - 0.1;
			pig.oldPos.x = pig.place.pos.x - 0.1;
			pig.oldPos.y = pig.place.pos.y;

		} else {
			pig.spawnTimer += 1;//gDT;
		}
	}


	//	make this class accessible
	rat.graphics.PigRender = PigRender;
	
} );
