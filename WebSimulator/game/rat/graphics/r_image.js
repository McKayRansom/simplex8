// Image loading, caching, sharing, animating, and other stuff
//
// Image:  an object to store all data needed for an image, including tracking multiple frames
//  this is for the image data, not information about rendering it (e.g. location, etc.)
//
// ImageRef:  a reference to an image, with runtime rendering info like which frame we're on in an animation.
//  this is separate so that each use can have its own current frame, but still collect
//  all the logic in one place instead of in each chunk of code using images, and make it easy
//  to intermix animated and nonanimated images
//
// Image Cache:  a cache of images...
//  Some browsers might cache images, but in practice I've found that they generally don't.  (e.g. chrome 24)
//  amd even then we'd still have to wait for it to call our onload function to get details like size.
//  so, for our convenience in being able to preload stuff and later use it immediately,
//  we preload into a cache (preLoadImages) and keep those images around.
//  maybe could have worked around the details, but this means we don't have to worry about
//  some implementations not caching images, or dumping them on a whim, or whatever.
//
// Hmm...  We do need some kind of way to queue up a bunch of loads, show a loading screen,
// and then move on.  Should that support be here?
// this per-image onLoad stuff is annoying...
//
// TODO:  Rewrite to use or support sprite sheets (atlases)
//------------------------------------------------------------------------------------
rat.modules.add("rat.graphics.r_image",
[
	{ name: "rat.graphics.r_graphics", processBefore: true },

	{ name: "rat.debug.r_console", processBefore: true},
	"rat.os.r_system",
],
function (rat)
{
	///
	/// Image Object
	/// @constructor
	///
	rat.graphics.Image = function ()
	{
		this.imageFrames = []; // separate list of Image() objects
		this.frames = null; // this is used for spritesheet-based images - a list of spritesheet frame info
		this.frameEvents = void 0;
		this.loadedCount = 0;
		this.loadedTargetCount = 0;
	};
	rat.graphics.Image.prototype.isImage = true; // for ease of detection
	
	rat.graphics.Image.centeredX = 0x0001;
	rat.graphics.Image.centeredY = 0x0002;
	rat.graphics.Image.flipX = 0x0004;
	rat.graphics.Image.flipY = 0x0008;

	// some system-wide properties (see below)
	rat.graphics.Image.lastRenderFrameIndex = -1;
	rat.graphics.Image.perFrameDrawCount = 0;

	// todo:  rename these "varName" or something, for clarity below.  These are all JSON file variable names,
	// Very indirect and kinda confusing.  I don't think they change, but by referring to them with variable names, we avoid problems with compilers renaming stuff
	//  which would then not match literal names in JSON files.
	// For some variable names (e.g. 'x', 'y', 'w', 'h') I use the literal names below, instead of using an indirect variable here.  Maybe do that everywhere?
	var frameName = 'frame'; // this is the name of the variable in a spritesheet file that holds frame info.
	var framesName = 'frames'; // this is the name of the variable in a spritesheet file that holds the list of frames
	var fileNameName = 'filename';
	var srcSizeName = 'spriteSourceSize'; // this is the size of the section of image we want to render?  different from "frame" if trimmed...
	var origSizeName = 'sourceSize'; // this is the *original* size of the original-pre-packed image.  Important to know to make spritesheet usage transparent.

	// note:  don't use flip, if you can avoid it.
	//  see http://stackoverflow.com/questions/7918803/flip-a-sprite-in-canvas and http://jsperf.com/ctx-flip-performance/5

	/// get the image for this frame, if it exists and is ready to draw.
	/// otherwise return null
	/// @method
	/// @param {number} frameNum 
	/// @param {Object=} options 
	///
	rat.graphics.Image.prototype.getImageFrame = function (frameNum, options)
	{
		if (!this.imageFrames)
		{
			return null;
		}
		if (frameNum < 0 || frameNum >= this.imageFrames.length)
		{
			if (!options || !options.noWarn)
			{
				if (this.imageFrames.length <= 0)
					rat.console.log("Bad image frame! Failed to specify/load any images?");
				else
					rat.console.log("Bad image frame! " + frameNum + " / " + this.imageFrames.length);
			}
			return null;
		}

		if (!this.imageFrames[frameNum].valid)
		{
			return null;
		}

		return this.imageFrames[frameNum];
	};

	rat.graphics.Image.prototype.isLoaded = function ()
	{
		for (var i = 0; i < this.imageFrames.length; i++)
		{
			//	check valid or error to know if load attempt is done.
			if (!this.imageFrames[i].valid && !this.imageFrames[i].error)
				return false;
		}
		return true;
	};

	//
	//	Add these frames to this image's frame list
	//	This is really the main chokepoint for loading, for images, single-frame or multi-frame.
	//	(start things loading)
	//
	rat.graphics.Image.prototype.appendFrames = function (inList)
	{
		if (!inList)
			return;
		
		//	handle list of sources or single source
		var sourceList = inList;
		if (!Array.isArray(inList))
		{
			sourceList = [inList];
		}
		//	what type of thing are we being given, here?  Could be resource name or canvas...
		var sourceType = typeof (sourceList[0]);
		
		//	set debug name for convenience
		if (sourceType === 'string')
			this.debugName = sourceList[0];

		//	can we find this in already loaded sprite sheets?
		if (sourceType === 'string' && this.findAndBuildFromSpriteSheets(sourceList))
			return;

		function onImgLoadComplete(img)
		{
			//console.log("loaded " + img.src + "\n");
			img.onload = null;	//	don't let anyone call me again.  See logic below.  Depends on browser.
			img.valid = true;
			this.loadedCount++;
			if (this.loadedCount >= this.loadedTargetCount && this.onLoad)
			{
				//console.log("finished loading " + this.loadedCount + " images");
				//console.log("first is " + this.frames[0].valid);
				//console.log("length is " + this.frames.length);

				this.onLoad(img); //	done loading all frames
			}
		}

		function onImgLoadError(img)
		{
			img.onerror = null;
			rat.console.log("ERROR loading image " + img.src);
			this.loadedCount++;
			img.error = true;	//	so we can skip it or track back problems later
		}

		//	load normally through cached images
		this.loadedTargetCount = sourceList.length;
		for (var i = 0; i < sourceList.length; i++)
		{
			//console.log("loading... " + sourceList[i] + "\n");

			var image = rat.graphics.findInCache(sourceList[i]);
			if (image !== null)
			{
				//	already in cache - just use that.
				//console.log("   found in cache " + image.origSrc + "\n");
				this.loadedCount++;
			} else
			{
				if (sourceType === 'string')
				{
					//console.log( "   making new image... "+sourceList[i]+"\n" );
					image = new Image();
					image.valid = false;	//	not yet loaded
					image.error = false;

					image.onload = onImgLoadComplete.bind(this, image);
					image.origSrc = sourceList[i];	//	remember original relative source
					image.onerror = onImgLoadError.bind(this, image);
					//rat.console.log("Loading image " + image.origSrc + "...");

					image.src = rat.system.fixPath(sourceList[i]);	//	will eventually get changed to full source path

					//console.log( "   Set src " + image.src + "\n" );

					//	a quick test.  does this work?
					//	If this image is already loaded, it might be nice to use it now instead of wait until onload gets called,
					//	because sometimes onload is not immediately called, even if the image is loaded.
					//	confirm this by checking width.
					if (image.width > 0 && image.onload)
						onImgLoadComplete.call(this, image); // this will clear the onload method

					//	todo: consider adding this to cache automatically
					//	currently, this function is already being used by cache to create new entries, so be careful with that.

				} else
				{
					//	support canvases.  Let's start by assuming that's what this is.
					//	TODO: step back a level - store an object that contains this canvas, or image,
					//		and has custom fields at THAT level instead of adding fields to a system canvas/image object,
					//		as we do here and above.  :(  Pretty bogus.

					//	UGH, this is really not ideal.  If the canvas we're loading comes from an image we have to wait for,
					//	then all kinds of things are wrong here... :(
					console.log("Trying to load non-string-resource image...");
					image = sourceList[i];	//	canvas
					image.valid = true;
					//	origSrc = leave it empty to force a different check...
					this.loadedCount++;
				}
			}

			this.imageFrames.push(image);
		}
	};
	
	rat.graphics.Image.spriteSheets = [];
	rat.graphics.Image.spriteSheets.numInMemory = 0;

	function SpriteSheet(image, tpjs, opts)
	{
		this.image = image;
		this.tpjs = tpjs;
		this.opts = opts;
		if (tpjs['meta'] && tpjs['meta'])
			this.scaledBy = Number(tpjs['meta']['scale']) || 1;
		else
			this.scaledBy = 1;
		this.undoScaler = 1/this.scaledBy;
		++rat.graphics.Image.spriteSheets.numInMemory;
	}
	SpriteSheet.prototype.inMemory = true;
	
	//	Load/unload a spritesheet from memory
	SpriteSheet.prototype.setActive = function( active )
	{
		if( active === void 0 )
			active = true;
		if( active == this.inMemory )
			return;
		
		if( !active )
		{
			this.inMemory = false;
			rat.graphics.clearFromCache( this.image );
			--rat.graphics.Image.spriteSheets.numInMemory;
		}
		else
		{
			rat.graphics.preLoadImages([this.image]);
			this.inMemory = true;
			++rat.graphics.Image.spriteSheets.numInMemory;
		}
		rat.console.log( (active ? "" : "UN-") + "loading spritesheet " + this.image );
	};
	
	//	load and register multi-part image from texturepacker js file
	//	this caches the image (if it's not already cached)
	//	and records all the frame info, which can be used later on a frame by frame basis
	rat.graphics.Image.registerSpriteSheet = function (image, tpjs, opts)
	{
		if (rat.graphics.Image.getSpriteSheetIndex(tpjs) >= 0)	//	already here
			return;
		if( !opts )
			opts = {};
		var sheet = new SpriteSheet( image, tpjs, opts );

		//	we support two kinds of tpjs files:  array of frames, and object with each frame named.
		//	Since most of the code in this module is designed to work with an array of frames, adapt the other type now.
		//	Note that it would be a lot more optimal to use the other approach (named variables instead of array) when searching for images,
		//	but for now I'm not going to worry about it - it's usually a one-time thing.
		//	If needed, we could later support them both more aggressively throughout this file, instead of translating here.

		var frameList = tpjs[framesName];
		if (!Array.isArray(frameList))
		{
			tpjs.namedFrames = frameList;	//	store for future reference in original form
			tpjs[framesName] = [];
			//	and build an array instead...
			for (var prop in frameList)	//	go through all properties in frame list (e.g. frame names.  "prop" here is just the property name)
			{
				if (frameList.hasOwnProperty(prop))
				{
					if (opts.forceLowerCase)
						frameList[prop][fileNameName] = prop.toLowerCase();
					else
						frameList[prop][fileNameName] = prop;
					
					tpjs[framesName].push(frameList[prop]);
				}
			}
		}
		
		if (opts.forceLowerCase)
		{
			var texPath = tpjs['meta']['image'];
			if (texPath)
				tpjs['meta']['image'] = texPath.toLowerCase();
		}
		
		if (opts.verbose)
		{
			rat.console.log("loaded spritesheet with " + sheet.tpjs[framesName].length + " frames");
		}
		rat.graphics.Image.spriteSheets.push(sheet);
	};
	
	//	Get how many sprite sheets exist
	//	This can be setup to only include sheets that are in memory
	rat.graphics.Image.getSpriteSheetCount = function(opts)
	{
		if( opts && opts.inMemory )
			return rat.graphics.Image.spriteSheets.numInMemory
		else
			return rat.graphics.Image.spriteSheets.length;
	};
	
	//	Get the nth spritesheet
	//	This can be setup to only include sheets that are in memory
	rat.graphics.Image.getNthSpriteSheet = function(nth, opts)
	{
		var sheets = rat.graphics.Image.spriteSheets;
		if( opts && opts.inMemory )
		{
			for( var index = 0; index < sheets.length; ++index)
			{
				var sheet = rat.graphics.Image.spriteSheets[index];
				if( sheet.inMemory )
				{
					--nth;
					if( nth < 0 )
						return sheet;
				}
			}
			return void 0;
		}
		else
			return sheets[nth];
	};
	
	//	Operate on each spritesheet that we have
	//	Can be setup to only run on sheets that are in memory
	rat.graphics.Image.forEachSpriteSheet = function( func, opts )
	{
		if( !func )
			return;
		var nth = 0;
		var sheet;
		while( (sheet = rat.graphics.Image.getNthSpriteSheet( nth, opts )) )
		{
			++nth;
			func( sheet, opts );
		}
	};

	//	find sprite sheet index by reference to tpjs
	rat.graphics.Image.getSpriteSheetIndex = function (tpjs)
	{
		for (var sheetIndex = 0; sheetIndex < rat.graphics.Image.spriteSheets.length; sheetIndex++)
		{
			if (rat.graphics.Image.spriteSheets[sheetIndex].tpjs === tpjs)
				return sheetIndex;
		}
		return -1;
	};

	//	Find this list of resources in one of our loaded sprite sheets.
	//	If found, return sprite sheet index and an array of indices into the frame list
	//	Note:  We access texture sheet (tpjs) vars (e.g. "spriteSourceSize") by literal name,
	//	since they're defined that way in the js files...  more convenient this way,
	//	rather than rewriting those files...  (though, it makes the code hard to read.  would be nice to clean up somehow)
	//	NOTE:  We only support finding them all in one sheet, not across sheets, currently.
	rat.graphics.Image.findInSpriteSheet = function (origResList)
	{
		//	simple case - we never loaded spritesheets.
		if (!rat.graphics.Image.spriteSheets || rat.graphics.Image.spriteSheets.length < 1)
			return null;
		
		//	We're going to search twice.  Once with full name matching including path, and then again without path (if needed).
		//	Why?
		//	We do the first path with full path matching so we can have several spritesheets with similar names,
		//	e.g. if two characters each have a "death_1.png" file, we need to be able to distinguish between them.
		//	We do the second search without full path matching as a fallback, to make it easier to set up spriteSheets
		//	with a bunch of files just thrown into them without any concern about where they came from.
		
		//	so, here's a search function we can use...
		function searchSheets(resList, doMatchPath)
		{
			for (var sheetIndex = 0; sheetIndex !== rat.graphics.Image.spriteSheets.length; ++sheetIndex)
			{
				var sheetEntry = rat.graphics.Image.spriteSheets[sheetIndex];
				var tpjs = sheetEntry.tpjs;
				var frames = tpjs[framesName];	//	list of frames in spritesheet to search
				
				var frameIndexList;	//	list of collected frames that match
				frameIndexList = [];
				
				var prefix = "";
				if (doMatchPath)
				{
					//	todo: when registering spritesheets, support manually setting an alternative search prefix path.
					var texPath = tpjs['meta'];
					if (!texPath)
						continue;
					var texPath = texPath['image'];
					if (!texPath)
						continue;	//	no image path, so we can't use it as a prefix, so don't bother
					
					prefix = rat.utils.getPath(texPath, true);
					
				} else {	//	match without path?
					//	if this sheet requires path matching, skip it.
					if (sheetEntry.opts.requirePath)
						continue;
				}
				
				for (resIndex = 0; resIndex !== resList.length; ++resIndex)
				{
					var lowerRes = null;	//	only created if needed below
					
					for (var frameIndex = 0; frameIndex !== frames.length; ++frameIndex)
					{
						//	Note: sprite sheets sometimes store a simple file name, and sometimes a partial path,
						//	e.g. if texturePacker is using "smartFolders".
						
						var res;
						if (sheetEntry.opts.forceLowerCase)
						{
							if (!lowerRes)	//	first time we needed this?
								lowerRes = resList[resIndex].toLowerCase();
							res = lowerRes;
						} else
							res = resList[resIndex];

						if (prefix + frames[frameIndex][fileNameName] === res)
						{
							frameIndexList.push(frameIndex);
							break;	//	got it, don't keep searching for this one
						}
					}
				}
				
				//	did we find them all?  NOTE:  We seem to only support finding them all in one sheet, not across sheets, currently.
				if (frameIndexList.length === resList.length)
					return { sheetIndex: sheetIndex, frameIndexList: frameIndexList };
				else
					frameIndexList = [];
			}
			return null;
		}
		
		//	search first with paths
		//	Build list of fixed names in case they have .. in them.
		var newResList = [];
		for (var resIndex = 0; resIndex !== origResList.length; ++resIndex)
		{
			newResList[resIndex] = rat.utils.cleanPath(origResList[resIndex]);
			
			//	temp debug stuff
			if (newResList[resIndex].indexOf("out/media/img/char/lvl1_m/attack_1.png") >= 0)
				rat.console.log("will be searching for " + newResList[resIndex]);
		}
		var res = searchSheets(newResList, true);
		if (res)
			return res;
		
		//	temp debug
		//if (newResList[0].indexOf("Lvl1_m/attack_1.png") >= 0)
		//	rat.console.logOnce("!couldn't find " + newResList[0], 'nofind');
		
		//	then without...
		//	Build a version of resList that does not include path.
		var shortResList = [];
		for (var resIndex = 0; resIndex !== origResList.length; ++resIndex)
		{
			shortResList[resIndex] = rat.utils.stripPath(origResList[resIndex]);
		}
		
		return searchSheets(shortResList, false);
	};

	//	Attempt to build my frames from one of the registered spritesheets
	//	the list passed in is a list of resource names
	rat.graphics.Image.prototype.findAndBuildFromSpriteSheets = function (resList)
	{
		var foundInfo = rat.graphics.Image.findInSpriteSheet(resList);
		if (!foundInfo)
			return false;

		this.buildFramesFromSpriteSheets(foundInfo.sheetIndex, foundInfo.frameIndexList);
		return true;
	};

	//
	//	Build my frames from this specified sheet in our list, and this frame index list.
	//
	rat.graphics.Image.prototype.buildFramesFromSpriteSheets = function (sheetIndex, frameIndexList)
	{
		var sheetEntry = rat.graphics.Image.spriteSheets[sheetIndex];
		var tpjs = sheetEntry.tpjs;

		this.appendFrames(sheetEntry.image);	//	set our one image to be the one for this sheet.  will use cached image if possible.

		//	copy a bunch of data over.  See note above about tpjs literal field name access
		this.frames = [];	//	multi-frame from internal list
		for (var fIndex = 0; fIndex < frameIndexList.length; fIndex++)
		{
			var frame = {};

			var tpFrameIndex = frameIndexList[fIndex];
			var tpFrame = tpjs[framesName][tpFrameIndex];

			var name = tpFrame[fileNameName];
			frame.name = name.substring(0, name.length - 4);
			frame.scaledBy = sheetEntry.scaledBy;
			frame.undoScaler = sheetEntry.undoScaler;

			frame.drawBox = {
				x: tpFrame[frameName]['x'],
				y:	tpFrame[frameName]['y'],
				w:	tpFrame[frameName]['w'],
				h:	tpFrame[frameName]['h']
			};
			
			frame.box = {};
			frame.box.x = frame.drawBox.x * sheetEntry.undoScaler;
			frame.box.y = frame.drawBox.y * sheetEntry.undoScaler;
			frame.box.w = frame.drawBox.w * sheetEntry.undoScaler;
			frame.box.h = frame.drawBox.h * sheetEntry.undoScaler;

			var trimFrame = tpFrame[srcSizeName];
			frame.trimRect = {
				x: trimFrame['x'] * sheetEntry.undoScaler,
				y: trimFrame['y'] * sheetEntry.undoScaler,
				w: trimFrame['w'] * sheetEntry.undoScaler,
				h: trimFrame['h'] * sheetEntry.undoScaler };

			var sourceSize = tpFrame[srcSizeName];
			frame.sourceSize = { w: sourceSize['w'], h: sourceSize['h'] };

			//	original size of original image before being packed.  This is the size we'll report if anyone asks how big we are.
			var origSize = tpFrame[origSizeName];
			var oW, oH;
			if( origSize['w'] )
				oW = origSize['w'] * sheetEntry.undoScaler;
			else
				oW = frame.box.w;
			if( origSize['h'] )
				oH = origSize['h'] * sheetEntry.undoScaler;
			else
				oH = frame.box.h;
			frame.origSize = {
				w: oW,
				h: oH
			};

			//var name = tpFrame['filename'];
			//frame.name = name.substring(0, name.length-4);

			this.frames.push(frame);
		}
	};

	//
	//	build this image automatically from all the frames in a tpjs (by tpjs reference passed in)
	//	(so, this is useful if the entire spritesheet is a single animation, in order)
	//
	rat.graphics.Image.prototype.buildFromSpriteSheet = function (tpjs)
	{
		var sheetIndex = rat.graphics.Image.getSpriteSheetIndex(tpjs);
		if (sheetIndex < 0)
			return;

		//	just make a list of indices and use our function above.
		var frameIndexList = [];
		for (var i = 0; i < tpjs[framesName].length; i++) // I assume that this is ['frames'] because the JSON is not minimized?
		{
			frameIndexList[i] = i;
		}

		this.buildFramesFromSpriteSheets(sheetIndex, frameIndexList);
	};

	//	return frame count for this image
	rat.graphics.Image.prototype.frameCount = function ()
	{
		//	multi-part?  if so, return that count
		if (this.frames)
			return this.frames.length;

		//	otherwise return raw image count, since those are our frames
		return this.imageFrames.length;
	};

	//	return the index of the frame with this name, if any
	//	otherwise return -1
	rat.graphics.Image.prototype.getNamedFrame = function (name)
	{
		//	multi-part?  if so, return that count
		if (this.frames)
		{
			for (var i = 0; i < this.frames.length; i++)
			{
				if (this.frames[i].name === name)
					return i;
			}
		}

		//	TODO:  look through our images and see if one has the right name.
		//this.imageFrames.length;
		return -1;
	};

	//	return frame size
	//	returned object is in the form {w:..., h:...}
	rat.graphics.Image.prototype.getFrameSize = function (frameIndex)
	{
		if (this.frames)	//	sprite sheet based, with a list of frames?  Return the size from that frame info.
		{
			//	STT 2015.1.9:  Use ORIGINAL size of image.  This is important for complete transparency with spritesheet usage.
			return this.frames[frameIndex].origSize;
			//return this.frames[frameIndex].sourceSize;
		}
		else
		{
			var frameImage = this.getImageFrame(frameIndex);
			if (frameImage)
			{
				return { w: frameImage.width, h: frameImage.height };
			} else
			{	//	no image loaded?
				var debugName = this.debugName || "";
				rat.console.logOnce("r_image: error:  asking for size of image that hasn't been loaded : " + debugName, 'imageSizeError');
				return { w: 32, h: 32 };	//	fake it so we don't crash
			}
		}
	};

	//	set function to call when all frames are loaded
	rat.graphics.Image.prototype.setOnLoad = function (func)
	{
		this.onLoad = func;
		if( !func )
			return;
		//	already done?  I don't think this ever happens, even if image is cached.
		if (this.loadedCount >= this.loadedTargetCount)
		{
			//console.log("finished(pre) loading " + this.loadedCount + " images");
			this.onLoad(this.imageFrames[0]);
		}/* else
		{
			rat.console.log("waiting...");
		}
		*/
	};

	/**
	*	Draw.
	*	This hides internals, like whether we're single-frame, sprite-sheet, multi-sheet, etc.
	*
	*	IMPORTANT!
	*		This functionality is also extracted and rewritten in the particle system, for speed.
	*		Maybe not the best approach, since that has already broken at least once.
	*		As far as I can tell, it's to save one function call per draw.
	*		Anyway, if you change code here, you have to change it in the particle system, too.
	*		todo: Find some way to do macros instead of duplicating code?
	*
	*	@param {Object=} ctx
	*	@param {number=} frameNum
	*	@param {number=} x
	*	@param {number=} y
	*	@param {number=} w
	*	@param {number=} h
	*	@param {number=} flags
	*	@param {number=} clipX
	*	@param {number=} clipY
	*	@param {number=} clipWidth
	*	@param {number=} clipHeight
	*/
	rat.graphics.Image.prototype.draw = function (ctx, frameNum, x, y, w, h, flags, clipX, clipY, clipWidth, clipHeight)
	{
		ctx = ctx || rat.graphics.ctx;
		var offsetX;
		var offsetY;
		var frameImage;
		var offsetMultX = 1;
		var offsetMultY = 1;
		var saved = false;

		x = x || 0;
		y = y || 0;

		if (!this.frames)	//	easy version - single frame
		{
			frameImage = this.getImageFrame(frameNum);
			if (!frameImage)
				return;

			if (w === void 0)
				w = frameImage.width;
			if (h === void 0)
				h = frameImage.height;
			if (clipX === void 0)
				clipX = 0;
			if (clipY === void 0)
				clipY = 0;
			if (clipWidth === void 0)
				clipWidth = frameImage.width;
			if (clipHeight === void 0)
				clipHeight = frameImage.height;

			offsetX = 0;
			offsetY = 0;
			if (flags & rat.graphics.Image.centeredX)
				offsetX = -w / 2;
			if (flags & rat.graphics.Image.centeredY)
				offsetY = -h / 2;

			if (flags & rat.graphics.Image.flipX)
			{
				saved = true;
				ctx.save();
				offsetMultX = -1;
				ctx.translate(w, 0);
				ctx.scale(-1, 1);
			}
			if (flags & rat.graphics.Image.flipY)
			{
				if (!saved)
				{
					saved = true;
					ctx.save();
				}

				offsetMultY = -1;
				ctx.translate(0, h);
				ctx.scale(1, -1);
			}

			ctx.drawImage(frameImage, clipX, clipY, clipWidth, clipHeight, (x + offsetX) * offsetMultX, (y + offsetY) * offsetMultY, w, h);

		} else
		{	//	sprite sheet version (todo: consolidate common elements! yes...)
			// TODO! support clipping for sprite sheets - EG clipX, clipY, clipWidth, clipHeight

			frameImage = this.getImageFrame(0);
			if (!frameImage)
				return;

			var curFrame = this.frames[frameNum];

			if (typeof w === 'undefined')
				w = curFrame.origSize.w;	//	use original image size, as if this had never been packed in a sprite sheet
			if (typeof h === 'undefined')
				h = curFrame.origSize.h;

			//	figure out scale, and thus effective width and height in the trimmed "box" space...

			//var wscale = w / curFrame.sourceSize.w;	//	how much client wants to scale
			//var hscale = h / curFrame.sourceSize.h;
			var wscale = w / curFrame.origSize.w;	//	how much client wants to scale from original size
			var hscale = h / curFrame.origSize.h;
			var ew = curFrame.box.w * wscale;
			var eh = curFrame.box.h * hscale;

			offsetX = curFrame.trimRect.x * wscale;	//	account for trim
			offsetY = curFrame.trimRect.y * hscale;

			if (flags & rat.graphics.Image.flipX)
			{
				saved = true;
				ctx.save();
				offsetMultX = -1;
				ctx.translate(ew, 0);
				offsetX = (curFrame.origSize.w - (curFrame.trimRect.x + curFrame.box.w)) * wscale;
				ctx.scale(-1, 1);
			}
			if (flags & rat.graphics.Image.flipY)
			{
				if (!saved)
				{
					saved = true;
					ctx.save();
				}
				offsetMultY = -1;
				ctx.translate(0, eh);
				offsetX = (curFrame.origSize.h - (curFrame.trimRect.y + curFrame.box.h)) * hscale;
				ctx.scale(1, -1);
			}

			if (flags & rat.graphics.Image.centeredX)
				offsetX -= w / 2;	//	center based on desired render size, not trimmed image
			if (flags & rat.graphics.Image.centeredY)
				offsetY -= h / 2;

			ctx.drawImage(
				frameImage,
				curFrame.drawBox.x,	// use x in image
				curFrame.drawBox.y,	//	use y in image
				curFrame.drawBox.w,	//	use w in image
				curFrame.drawBox.h, // use h in image
				(x + offsetX) * offsetMultX,			//	Draw to x
				(y + offsetY) * offsetMultY,			//	Draw to y
				ew,											//	Draw to w
				eh);											//	Draw to h

			//	The image should draw in this frame
			//ctx.strokeRect(x, y, w*wscale, h*wscale);
		}

		if (saved)
			ctx.restore();

		//	for debugging purposes, count how many images we've drawn this frame.
		if (rat.graphics.frameIndex !== rat.graphics.Image.lastRenderFrameIndex)
		{
			rat.graphics.Image.lastRenderFrameIndex = rat.graphics.frameIndex;
			rat.graphics.Image.perFrameDrawCount = 0;
		}
		rat.graphics.Image.perFrameDrawCount++;
	};

	//------------------------------
	//	ImageRef class

	///
	/// Image Ref
	/// track a reference to an image, and track unique rendering info like current frame.
	/// @constructor
	/// @param {Array.<string>|string=} sources
	///
	rat.graphics.ImageRef = function (sources)
	{
		//console.log("imageref constructor");

		if (typeof (sources) === 'object' && sources.isImageRef)	//	support copying from existing imageref
		{
			this.copyFrom(sources);
			return;

		} else if (typeof (sources) === 'object' && sources.isImage)	//	support construction from existing image object
		{
			this.image = sources;
		} else
		{
			this.image = new rat.graphics.Image();
			if (sources)
				this.image.appendFrames(sources);
		}

		//	note:  if you add fields to this list, remember to update copyFrom() below.
		//	this is an argument for using "flags" instead of adding separate named flag fields,
		//	since "flags" is already copied.

		this.frame = 0;
		this.animSpeed = 0; //	by default, not animated
		this.animDir = 1; //	by default, forward
		this.animPaused = false; // Is the animation paused

		//	todo move to a more flexible set of start/end action flags?
		//	use flags value below instead of named properties here.
		this.animAutoReverse = false;	//	if this is set, don't loop - reverse and bounce back and forth
		this.animStopAtEnd = false;	//	if this is set, don't loop or reverse, just play and stop.

		this.time = 0;

		this.flags = 0;
	};
	rat.graphics.ImageRef.prototype.isImageRef = true;	//	for ease of detection

	//	Set up all my values as a copy from this other imageRef's values.
	rat.graphics.ImageRef.prototype.copyFrom = function (source)
	{
		this.image = source.image;
		this.frame = source.frame;
		this.animSpeed = source.animSpeed;
		this.animDir = source.animDir;
		this.animPaused = source.animPaused;
		this.animAutoReverse = source.animAutoReverse;
		this.animStopAtEnd = source.animStopAtEnd;
		this.time = source.time;
		this.flags = source.flags;
		this.frameEvents = source.frameEvents;
	};

	//	Assign the frame events
	rat.graphics.ImageRef.prototype.setFrameEvents = function (events) {
		this.frameEvents = events;
	};

	//	Fire any event assigned to the current frame
	rat.graphics.ImageRef.prototype.fireEventsForFrame = function (frame) {
		if (!this.frameEvents || !this.frameEvents[frame] || !rat.eventMap)
			return;
		rat.eventMap.fire(this.frameEvents[frame], this);
	};

	//
	//	given a sprite sheet, register it and build an imageref that uses all its frames.
	rat.graphics.ImageRef.buildFromSpriteSheet = function (res, tpjs)
	{
		rat.graphics.Image.registerSpriteSheet(res, tpjs);
		var imageRef = new rat.graphics.ImageRef();
		imageRef.image.buildFromSpriteSheet(tpjs);
		return imageRef;
	};

	//	given a sprite sheet already registered, build a collection of imagerefs with the proper animation frames,
	//	judging by frame name.
	//
	//	This is a very high level function intended to automatically build all the animations in a spritesheet,
	//	using the frame names to figure out what animations are distinct.
	//	Since we assume the spritesheet is already registered and loaded, don't worry about caching - just create all the imagerefs we need.
	//	Lots of assumptions about names, currently.  We assume names like "walk_0001.png"
	//	if there's no extension or the name is all numbers, this code will crash and burn.  I haven't bothered doing error checking yet.
	//
	//	This has been tested, and works in at least my test case, but it may have limited use.
	//	It doesn't tell us crucial things about the animations we collect, including animation speed.
	rat.graphics.ImageRef.constructAllFromSpriteSheet = function (tpjs)
	{
		//	get entry in our list of registered spritesheets
		var sheetIndex = rat.graphics.Image.getSpriteSheetIndex(tpjs);
		if (sheetIndex < 0)
			return null;

		var collection = {};

		function finishSequence(name, sequence)
		{
			if (sequence.length <= 0)
				return;

			//	trim trailing _ if any, for final name in our collection object
			var len = name.length;
			if (name.charAt(len - 1) === '_')
				name = name.substring(0, len - 1);

			var imageRef = new rat.graphics.ImageRef();
			imageRef.image.buildFramesFromSpriteSheets(sheetIndex, sequence);

			collection[name] = imageRef;

			//	add in both named and list form?
			//collection.list.push(imageRef);
		}

		//	walk through all the frames for that guy.  For now, let's maybe just assume they're sequential,
		//	and switch when the new one has a new name.
		var lastName = "";
		var sequence = [];
		var frames = rat.graphics.Image.spriteSheets[sheetIndex].tpjs[framesName];
		for (var frameIndex = 0; frameIndex < frames.length; frameIndex++)
		{
			var name = frames[frameIndex][fileNameName];
			//	examine that name.  deconstruct the numbering part with the base name part.
			//var len = name.length;
			var check = name.lastIndexOf(".");	//	skip past .png part
			name = name.substring(0, check);	//	cut that part off
			while (check >= 0)
			{
				if (isNaN(name.charAt(check)))	//	not a number
				{
					check++;	//	don't include bogus char in our number part
					break;
				}
				check--;
			}

			var number;
			if (check <= 0 || check >= name.length)	//	all number or no number part
				number = 0;
			else
			{
				var numPart = name.substring(check);
				name = name.substring(0, check);
				number = parseInt(numPart);
			}

			// OK!  Now, if the name changed, start a new list
			if (lastName !== name)
			{
				finishSequence(lastName, sequence);
				sequence = [];
			}

			//	add the original frame index to our existing list.
			sequence.push(frameIndex);
			lastName = name;
		}
		finishSequence(lastName, sequence);

		return collection;
	};

	rat.graphics.ImageRef.prototype.setOnLoad = function (func)
	{
		this.image.setOnLoad(func);
	};

	rat.graphics.ImageRef.prototype.isLoaded = function ()
	{
		return this.image.isLoaded();
	};

	//	get the current image, if it exists and is ready to draw.
	//	otherwise return null
	rat.graphics.ImageRef.prototype.getImage = function ()
	{
		return this.image.getImageFrame(this.frame);
	};

	rat.graphics.ImageRef.prototype.getNamedFrame = function (name)
	{
		return this.image.getNamedFrame(name);
	};

	//	get frame count
	//	todo: inconsistent names - "frameCount()" should probably be "getFrameCount()" in image.
	rat.graphics.ImageRef.prototype.getFrameCount = function ()
	{
		return this.image.frameCount();
	};

	rat.graphics.ImageRef.prototype.setFrame = function (index)
	{
		var frameCount = this.image.frameCount();
		if (index < 0)
			index = 0;
		index = index % frameCount;	//	let's just wrap to make sure we're in the right range

		var oldFrame = this.frame;
		this.frame = index;

		if (oldFrame !== this.frame && this.frameEvents)
			this.fireEventsForFrame(this.frame);
	};

	rat.graphics.ImageRef.prototype.setFrameByName = function (name)
	{
		this.setFrame(this.getNamedFrame(name));
	};

	//	get current frame index
	rat.graphics.ImageRef.prototype.getFrame = function ()
	{
		return this.frame;
	};

	//	get size for this given frame
	//	returned object is in the form {w:..., h:...}
	rat.graphics.ImageRef.prototype.getFrameSize = function (frameIndex)
	{
		return this.image.getFrameSize(frameIndex);
	};

	//	get current frame size
	//	returned object is in the form {w:..., h:...}
	rat.graphics.ImageRef.prototype.getSize = function ()
	{
		return this.getFrameSize(this.frame);
	};

	rat.graphics.ImageRef.prototype.setAnimSpeed = function (animSpeed)
	{
		this.animSpeed = animSpeed;
	};
	rat.graphics.ImageRef.prototype.setAnimAutoReverse = function (autoReverse)
	{
		this.animAutoReverse = autoReverse;
	};
	rat.graphics.ImageRef.prototype.setAnimOneShot = function (oneShot)
	{
		this.animOneShot = oneShot;
	};
	/** @param {boolean=} paused */
	rat.graphics.ImageRef.prototype.setAnimPaused = function (pause)
	{
		this.animPaused = (pause === void 0) ? true : pause;
	};
	rat.graphics.ImageRef.prototype.setAnimFinished = function ()
	{
		this.time = this.image.frameCount();
		this.update(0);	//	immediately reflect this correctly in current frame, rather than wait for next update
	};
	rat.graphics.ImageRef.prototype.isAnimFinished = function ()
	{
		return (this.time >= this.image.frameCount());
	};
	rat.graphics.ImageRef.prototype.isAnimOneShot = function ()
	{
		return this.animOneShot;
	};
	rat.graphics.ImageRef.prototype.restartAnim = function ()
	{
		this.time = 0;
		this.update(0);	//	immediately reflect this correctly in current frame, rather than wait for next update
	};
	rat.graphics.ImageRef.prototype.setRandomTime = function ()
	{
		this.time = Math.random() * this.image.frameCount();
		this.update(0);	//	immediately reflect this correctly in current frame, rather than wait for next update
	};

	//	update our state, mostly dealing with animation
	rat.graphics.ImageRef.prototype.update = function (dt)
	{
		if (this.animSpeed > 0)
		{
			var frameCount = this.image.frameCount();
			if (!this.animPaused)
			{
				this.time += this.animSpeed * this.animDir * dt;
				var timeLen = frameCount;
				if (this.animAutoReverse)	//	bounce back and forth
				{
					if (this.time > timeLen)
					{
						var delta = this.time - timeLen;	//	go back as much as we went over
						this.time = timeLen - delta;
						this.animDir = -1;
					}
					if (this.time < 0)
					{
						if (this.animOneShot)
						{
							this.time = 0;	//	Stay at the front.
						}
						else
						{
							this.time = -this.time;	//	go forward as much as we went too far back
							this.animDir = 1;
						}
					}
				} else if (this.animOneShot)
				{
					if (this.time > timeLen)
					{
						this.time = timeLen;	//	stay at end
					}
				} else
				{	//	loop back to start
					while (this.time > timeLen)	//	could have gone way past end, need to keep looping back
					{
						this.time -= timeLen; //	back to start, factoring in how much we overshot
					}
				}
			}

			//	update frame based on time
			//	(being paused but animating doesn't mean that someone else isn't changing our time explicitly.  Let them.)
			var oldFrame = this.frame;
			this.frame = (this.time) | 0;

			//	clamp to valid space
			if (this.frame < 0)
				this.frame = 0;
			if (this.frame >= frameCount)
				this.frame = frameCount - 1;

			if (oldFrame !== this.frame && this.frameEvents)
				this.fireEventsForFrame(this.frame);
		}
		//	otherwise leave it alone - maybe somebody manually controls current frame
	};

	/**
	*	draw!  See image draw above.  This just picks correct frame.
	*	@param {Object=} ctx
	*	@param {number=} x
	*	@param {number=} y
	*	@param {number=} w
	*	@param {number=} h
	*	@param {number=} clipX
	*	@param {number=} clipY
	*	@param {number=} clipWidth
	*	@param {number=} clipHeight
	*/
	rat.graphics.ImageRef.prototype.draw = function (ctx, x, y, w, h, clipX, clipY, clipWidth, clipHeight)
	{
		this.image.draw(ctx, this.frame, x, y, w, h, this.flags, clipX, clipY, clipWidth, clipHeight);
	};

	rat.graphics.ImageRef.prototype.setCentered = function (centeredX, centeredY)
	{
		if (typeof centeredY === 'undefined')
			centeredY = centeredX;
		if (centeredX)
			this.flags |= rat.graphics.Image.centeredX;
		else
			this.flags &= ~rat.graphics.Image.centeredX;
		if (centeredY)
			this.flags |= rat.graphics.Image.centeredY;
		else
			this.flags &= ~rat.graphics.Image.centeredY;

		//	Allow chaining calls
		return this;
	};

	rat.graphics.ImageRef.prototype.setFlipped = function (flipX, flipY)
	{
		if (flipX)
			this.flags |= rat.graphics.Image.flipX;
		else
			this.flags &= ~rat.graphics.Image.flipX;
		if (flipY)
			this.flags |= rat.graphics.Image.flipY;
		else
			this.flags &= ~rat.graphics.Image.flipY;
	};

	//--------------- Caching images -----------------

	//	this is a cache of images, in the form of rat.graphics.Image obects.
	rat.graphics.imageCache = [];
	rat.graphics.imageCache.leftToLoad = 0;

	//	explicitly preload (start caching) a bunch of images.
	//	The argument here can be either a single image
	//		rat.graphics.preLoadImages("bob.png");
	//	or a list
	//		rat.graphics.preLoadImages(["bob.png", "sally.png", "frank.png"]);
	//	This will start those images loading, and register them in our internal cache for easy use later.
	//	More importantly, when you try to use them later, they'll be loaded and have width/height info available.
	//	You can check if preloading is done by calling isCacheLoaded below.
	//	You can call this as many times as you want.
	rat.graphics.preLoadImages = function (list)
	{
		if (!Array.isArray(list))	//	for convenience, allow a single string to be passed in
			list = [list];

		//	we now skip preloads if they're already found in spritesheets.
		//	todo:  also skip if they were preloaded normally?  What if we have duplicates in this list?
		//	or had a previous call to preLoadImages?
		
		var alreadyInSheetsCount = 0;
		//console.log("preloading this many images: " + list.length + "\n");
		for (var i = 0; i < list.length; i++)
		{
			if (rat.graphics.Image.findInSpriteSheet([list[i]]))
			{
				alreadyInSheetsCount++;
				continue;
			}
			
			rat.graphics.imageCache.leftToLoad += 1;
			
			//console.log( "    preloading image " + (i+1) + " of " + list.length + "\n" );
			//	just add each one as a rat.graphics.Image
			var image = new rat.graphics.Image();
			image.appendFrames(list[i]);
			image.setOnLoad( function(image, data)
			{
				image.setOnLoad(void 0);
				--rat.graphics.imageCache.leftToLoad;
				if( rat.graphics.imageCache.leftToLoad < 0 )
					rat.graphics.imageCache.leftToLoad = 0;
			}.bind(void 0, image));
			rat.graphics.imageCache.push(image);

			//console.log("    precaching " + list[i]);
		}
		//console.log("precaching " + rat.graphics.imageCache.leftToLoad + " images, " + alreadyInSheetsCount + " were already in sheets.");
		//console.log("done queueing up cache.");
	};
	
	//	Remove an image from the cache
	rat.graphics.clearFromCache = function(path)
	{
		var foundOut = {};
		var found = rat.graphics.findInCache(path, foundOut);
		if( !found )
			return;
		
		//	Remove from the cache
		rat.graphics.imageCache.splice( foundOut.index, 1 );
		
		//	This may be over kill, but i want to make sure that the image is gone
		//	Because the image object in the cache is shared with rat.graphics.images that
		//	Use it, i cannot modify the actual image object.
		//found.cleanup();
	};
	
	//	see if entire cache is loaded (e.g. match call to preLoadImages above)
	rat.graphics.isCacheLoaded = function ()
	{
		for (var i = 0; i < rat.graphics.imageCache.length; i++)
		{
			if (!rat.graphics.imageCache[i].isLoaded())
			{
				//console.log("image cache waiting for " + rat.graphics.imageCache[i].imageFrames[0].src);
				return false;
			}
		}
		return true;
	};
	
	//	get cache state
	//	todo: update this only when things change, not every time called.
	rat.graphics.getCacheState = function()
	{
		var res = {
			total : rat.graphics.imageCache.length,
			current : 0,
			firstWaiting : -1,
		};
		
		for (var i = 0; i < rat.graphics.imageCache.length; i++)
		{
			if (rat.graphics.imageCache[i].isLoaded())
				res.current++;
			else if (res.firstWaiting < 0)
				res.firstWaiting = i;
		}
		
		return res;
	};

	//	Report what imgaes are in the cache
	rat.graphics.reportCache = function ()
	{
			var cached = rat.graphics.imageCache;
			rat.console.log( "-----------------------------------" );
			rat.console.log( "" + cached.length + " images in cache." );
			for (var i = 0; i < cached.length; i++)
			{
				var img = cached[i].getImageFrame(0, { noWarn: true });
				rat.console.log( "\t " + i.toFixed(2) + ">" + img.origSrc  );
			}
			rat.console.log( "-----------------------------------" );
	};
	rat.console.registerCommand( "imageCache", rat.graphics.reportCache, ["reportImageCache", "showImageCache"] )
	
	//	see if this image is already in cache
	//	return low level Image directly, if found.
	//	otherwise, return null.
	//	STT: adding canvas support, so "resource" here could be asset string or canvas object
	rat.graphics.findInCache = function (resource, out)
	{
		//console.log("find in cache " + resource);
		//console.log("cache is this long: " + rat.graphics.imageCache.length);
		for (var i = 0; i < rat.graphics.imageCache.length; i++)
		{
			///	todo:  We currently assume all frames are cached independently,
			//	but will that be the case?  Do we need to walk through all frames?
			var img = rat.graphics.imageCache[i].getImageFrame(0, { noWarn: true });
			if (img !== null)
			{
				//console.log("checking " + img.origSrc);
				if ((img.origSrc && img.origSrc === resource) || img === resource)
				{
					if( out )
						out.index = i;
					return img;
				}
			}
		}
		//console.log("not found: " + resource);
		return null;
	};

	//---------------- support for external image systems to use our api ------------------

	rat.graphics.externalSpriteMaker = null;

	//	a sort of light factory.  Make images.
	//	if we have an external image creator and extra arguments were supplied, then use that creator.
	//	todo: support variable args instead of fixed 2.
	rat.graphics.makeImage = function (resource, extra1, extra2)
	{
		if (extra1 && rat.graphics.externalSpriteMaker)
		{
			return rat.graphics.externalSpriteMaker(resource, extra1, extra2);
		} else
		{
			return new rat.graphics.ImageRef(resource);
		}
	};

	//	set up an external sprite creation function.
	//	This is basically for bridging other image-handling libraries in to rat.
	//		or providing a way to have very different image creation support on a game by game basis.
	//	Any image created with this external sprite maker (see makeImage() above!) must respect the same basic API
	//		that we support with ImageRef, particularly draw(), update(), getFrameSize(), isLoaded(), and more.
	//		see usage in r_ui_sprite
	rat.graphics.setExternalSpriteMaker = function (f)
	{
		rat.graphics.externalSpriteMaker = f;
	};
});