
//----------------------------
//	sprite Element (subclass of ui Element)
//	renders with a loaded image

//	TODO:
//		Figure out how to autoscale sprites when setSize() is called, but factor in
//			images that load late
//			setting size before image loads
//			setting size after image loads
//			loading a new image after setting size...
//			all of the above for buttons which use images.  (spritebuttons)
//			see partially written code below. :(
//			would be very nice to figure out some solution to that "isn't loaded yet, can't get size" thing...
//			maybe require preloading, or sprite sheets, or something.
//			
//			Also note that scaling the whole element just to fit the sprite seems incorrect.
//			We should only be scaling the sprite itself to fit our size.
//			For instance, scaling the whole element results in a scaled frame, which is annoying.
//			I'm going to try switching to an internal image scale here instead of element scale.
//
rat.modules.add( "rat.ui.r_ui_sprite",
[
	{name: "rat.ui.r_ui", processBefore: true },
	{name: "rat.utils.r_utils", processBefore: true },
	
	"rat.graphics.r_graphics",
	"rat.graphics.r_image",
	"rat.debug.r_console",
	"rat.ui.r_ui_data",
], 
function(rat)
{
	/**
	 * @constructor
	 * @extends rat.ui.Element
	 * @param {string|Array=} resource
	 * @param {?} extra1
	 * @param {?} extra2
	*/
	rat.ui.Sprite = function (resource, extra1, extra2)
	{
		rat.ui.Sprite.prototype.parentConstructor.call(this); //	default init
		this.flags |= rat.ui.Element.autoSizeAfterLoadFlag;	//	by default, we autosize ourself to match image size after image load
		//	todo: But a manual call to setSize() ought to clear that flag, right?  e.g. user wants to set size explicitly...?
		//	maybe...  see autoScaleAfterLoadFlag

		this.name = "<sprite>" + this.id;	//	+ resource
		this.loadImage(resource, extra1, extra2);	//	do actual image load, or at least set it up
		this.setTracksMouse(false);	//	no mouse tracking, highlight, tooltip, etc. including subelements.
		
		this.imageScaleX = this.imageScaleY = 1;
	};
	rat.utils.inheritClassFrom(rat.ui.Sprite, rat.ui.Element);
	rat.ui.Sprite.prototype.elementType = 'sprite';

	//	Load this resource in as the new image.
	/**
	 * @param {string|Array=} resource
	 * @param {?} extra1
	 * @param {?} extra2
	*/
	rat.ui.Sprite.prototype.loadImage = function (resource, extra1, extra2)
	{
		this.resource = resource;	//	I don't think this is used.  TODO: remove this line.
		if (typeof(resource) !== 'undefined')
		{
			this.imageRef = rat.graphics.makeImage(resource, extra1, extra2);
			//	"makeImage" is a more flexible way of creating sprites - may return a different type of imageref as needed.
			var self = this;	//	set up reference to self for use in closure below
			this.imageRef.setOnLoad(function ()
			{
				var imageSize = self.imageRef.getFrameSize(0);
				self.setContentSize(imageSize.w, imageSize.h);	//	set my content size to match the content we just loaded
				
				self.setDirty(true);
				
				//	autoscale to size
				//	or autosize to content.  These two are mutually exclusive
				//	TODO:  Ugh, this all happens immediately if image is already loaded.
				//	We DO need a way for a call to setSize() to trigger an autoscale after sprite is created.
				//	Or have setSize() assume that for sprites?
				
				if (self.flags & rat.ui.Element.autoScaleAfterLoadFlag)	//	scale image to match our size
				{
					//self.setScale(self.size.x/imageSize.w, self.size.y/imageSize.h);
					self.scaleImageToSize();
					//console.log("set scale on load: " + self.size.x + "/" + imageSize.w);
				}
				else if (self.flags & rat.ui.Element.autoSizeAfterLoadFlag)	//	set our size to match image size
				{
					self.setSize(imageSize.w, imageSize.h);	//	calls boundschanged
					//console.log("set size on load: " + imageSize.w);
				}
				if (self.flags & rat.ui.Element.autoCenterAfterLoadFlag)
				{
					//console.log("delayed autocenter B");
					self.autoCenter();
				}
				if (self.onLoad)
					self.onLoad(self.onLoadArg);
			});
			
			//	for convenient debug purposes, set our internal element name to include the source used.
			if (typeof(resource) === 'string')
				this.name = "<sprite>" + resource + this.id;
		}
	};
	
	//	explicitly use this imageref instead of loading above
	rat.ui.Sprite.prototype.useImageRef = function (imageRef)
	{
		this.imageRef = imageRef;
		//	do other stuff like autocenter, based on current flags?
		
		this.setDirty(true);
	};
	
	//	get back whatever imageref we're using.
	rat.ui.Sprite.prototype.getImageRef = function ()
	{
		return this.imageRef;
	};

	//	explicitly reset my element size to the size of my loaded image.
	//	assumes the image is done loading.
	rat.ui.Sprite.prototype.sizeToImage = function ()
	{
		if (this.imageRef)
		{
			var imageSize = this.imageRef.getFrameSize(0);
			this.setSize(imageSize.w, imageSize.h);	//	calls boundschanged
		}
	};
	//	explicitly reset my scale to my ui element size (with an optional extra scale to also apply)
	//	assumes the image is done loading.
	rat.ui.Sprite.prototype.scaleImageToSize = function (extraScaleX, extraScaleY)
	{
		extraScaleX = extraScaleX || 1;
		extraScaleY = extraScaleY || 1;
		
		if (this.imageRef)
		{
			var imageSize = this.imageRef.getFrameSize(0);
			//	track internal image scale instead of scaling element.
			this.imageScaleX = this.size.x/imageSize.w * extraScaleX;
			this.imageScaleY = this.size.y/imageSize.h * extraScaleY;
			//this.setScale(, this.size.y/imageSize.h);
			
			this.setDirty(true);
		}
	};
	
	//	directly set our separate scale factor
	rat.ui.Sprite.prototype.setImageScale = function (scaleX, scaleY)
	{
		this.imageScaleX = scaleX;
		this.imageScaleY = scaleY;
		
		this.setDirty(true);
	};

	//	auto center for sprites
	//	if sprite is not loaded, do autocenter after load.
	rat.ui.Sprite.prototype.autoCenter = function ()
	{
		//	Old code was doing nothing if the sprite happened to have no image ref (yet).
		//	so, later when new imageref is loaded in, the correct center is not set.
		//	So, current logic:  set afterload flag only if we HAVE an image and it's being loaded.
		//		otherwise, immediately calculate new center.
		if (typeof(this.imageRef) !== "undefined" && !this.imageRef.isLoaded())
		{
			//console.log("delayed autocenter A");
			this.flags |= rat.ui.Element.autoCenterAfterLoadFlag;
		} else {
			rat.ui.Sprite.prototype.parentPrototype.autoCenter.call(this);	//	inherited normal func
		}
	
		/*
		if (this.imageRef !== void 0)
		{
			if (!this.imageRef.isLoaded())
			{
				//console.log("delayed autocenter A");
				this.flags |= rat.ui.Element.autoCenterAfterLoadFlag;
			} else
			{
				rat.ui.Sprite.prototype.parentPrototype.autoCenter.call(this);	//	inherited normal func
			}
		}
		*/
	};

	//	turn on custom outline mode for sprites
	rat.ui.Sprite.prototype.setOutline = function (enabled, scale)
	{
		if (this.outline !== enabled || this.outlineScale !== scale)
			this.setDirty(true);
		
		this.outline = enabled;
		this.outlineScale = scale;
	};

	//	Update my image, in case it needs to animate or something.
	rat.ui.Sprite.prototype.updateSelf = function (dt)
	{
		if (this.imageRef)
		{
			//	update our image, in case it's animated.
			//	NOTE:  If you're using an animated image, it's probably not a good idea to use offscreen functionality,
			//	but just in case, we support it here with a dirty check.  If your image only sometimes animates, that's probably fine.
			var oldFrame = this.imageRef.getFrame();
			this.imageRef.update(dt);
			if (this.imageRef.getFrame() !== oldFrame)
				this.setDirty(true);
		}
	};
	
	//	Draw my sprite, tiled into this space.
	//	This function is useful for being called directly, from outside of the normal UI draw process.
	//	It acts handles positioning and rotation, but doesn't draw subelements.
	//	(Actually, this is a little weird - why does it do SOME of the standard draw, with copied and pasted code?
	//		Seems like this function should be rewritten, calling draw() instead...?)
	//	So, don't use it like it is for normal UI hierarchy drawing.  Just use the tiled flag for that.  See below.
	rat.ui.Sprite.prototype.drawTiled = function (w, h)
	{
		if (!this.isVisible())	//	don't draw me or sub stuff if I'm invisible
			return;
		
		rat.graphics.frameStats.totalElementsDrawn++;	//	for debugging, track total elements drawn per frame
		var ctx = rat.graphics.getContext();
		rat.graphics.save();

		rat.graphics.translate(this.place.pos.x, this.place.pos.y);
		if (this.place.rot.angle)
			rat.graphics.rotate(this.place.rot.angle);
		if (this.scale.x !== 1 || this.scale.y !== 1)
			rat.graphics.scale(this.scale.x, this.scale.y);
		ctx.globalAlpha = this.opacity;
		
		if (this.frameWidth > 0)
		{
			ctx.strokeStyle = this.frameColor.toString();
			ctx.lineWidth = this.frameWidth;
			ctx.strokeRect(-this.center.x - this.frameOutset, -this.center.y - this.frameOutset,
					this.size.x + 2 * this.frameOutset, this.size.y + 2 * this.frameOutset);
		}

		if (this.flags & rat.ui.Element.clipFlag)
		{
			ctx.beginPath();
			ctx.moveTo(0, 0);
			ctx.lineTo(this.size.x, 0);
			ctx.lineTo(this.size.x, this.size.y);
			ctx.lineTo(0, this.size.y);
			ctx.lineTo(0, 0);
			ctx.clip();
		}
		
		//	do the actual drawing
		this.drawMyImageTiled(w, h);
		
		rat.graphics.restore();
	};
	
	//	simple internal utility for drawing my image tiled.  Used by several other functions to do the actual tiled draw.
	//	tile the image as many times as needed to hit w/h
	rat.ui.Sprite.prototype.drawMyImageTiled = function (w, h)
	{
		var ctx = rat.graphics.getContext();
		var imageSize = this.imageRef.getSize();
		for (var x = 0; x < w; x += imageSize.w) {
			for (var y = 0; y < h; y += imageSize.h) {
				//	todo:  Do we need this translate/restore approach?  Why not just pass position args to draw()?
				rat.graphics.save();
				
				var width;
				var height;
				if (imageSize.w + x > w)
					width = w - x;
				else
					width = imageSize.w;
				if (imageSize.h + y > h)
					height = h - y;
				else
					height = imageSize.h;
				rat.graphics.translate(x, y);
				this.imageRef.draw(ctx, 0, 0, width, height, 0, 0, width, height);
				
				rat.graphics.restore();
			}
		}
	};

	//	Draw me
	rat.ui.Sprite.prototype.drawSelf = function ()
	{
		if ((this.flags & rat.ui.Element.drawTiledFlag) !== 0)
		{
			this.drawMyImageTiled(this.size.x, this.size.y);
			
		} else if (this.imageRef)
		{
			var ctx = rat.graphics.getContext();
			//	some custom code for faking outlines around objects by drawing them bigger in a funky mode.
			if (this.outline)
			{
				var frameSize = this.imageRef.getSize();
				ctx.globalCompositeOperation = 'destination-out';
				var ow = frameSize.w * this.outlineScale;
				var oh = frameSize.h * this.outlineScale;
				var dx = (ow - frameSize.w) / 2;
				var dy = (oh - frameSize.h) / 2;
				this.imageRef.draw(ctx, -(this.center.x + dx), -(this.center.y + dy), ow, oh);
				ctx.globalCompositeOperation = 'source-over';	//	back to normal
			}

			//	normal draw, factoring in scale.
			var imageSize = this.imageRef.getSize();
			var w = imageSize.w * this.imageScaleX;
			var h = imageSize.h * this.imageScaleY;

			this.imageRef.draw(ctx, -this.center.x, -this.center.y, w, h);
			
			/*
			image = this.imageRef.getImage();
			if (image != null)
				ctx.drawImage(image, -this.center.x, -this.center.y);
			else
			{
				//	not ready yet...
				//console.log("invalid sprite");
			}
			*/
		}
	};

	//	sprite bounds changed
	/* bleah, lame...
	rat.ui.Sprite.prototype.boundsChanged = function ()
	{
		//	if we should be scaling our content to match our size, set that up.
		//	todo - use contentSize, which should be accurate, and do this at generic boundsChanged level instead of here.
		//	maybe add a way to make sure contentSize is valid, or don't act on zero-sized content or whatever
		if ((this.flags & rat.ui.Element.autoScaleContentFlag) && (this.imageRef !== void 0))
		{
			var frameSize = this.imageRef.getSize();
			var sx = this.size.x / frameSize.w;
			var sy = this.size.y / frameSize.h;
			if (sx != 1 || sy != 1)
				this.setScale(sx, sy);
		}
	
		rat.ui.Sprite.prototype.parentPrototype.boundsChanged.call(this);	//	inherited normal func
	};
	*/

	rat.ui.Sprite.prototype.setOnLoad = function (func, arg)
	{
		this.onLoad = func;
		this.onLoadArg = arg;
	};
	
	//--------------------------------------------------------------------------------------
	//	Setup from data
	//autoCenter: true,
	//outline: scale,
	//resource:""/[]
	
	rat.ui.Sprite.editProperties = [
	{ label: "image",
		props: [
			{propName:'resource', type:'resource'},
			{propName:'outline', type:'float'},
			//{propName:'autoCenter', type:'boolean'},
		],
	}
	];

	rat.ui.Sprite.setupFromData = function (pane, data, parentBounds)
	{
		rat.ui.data.callParentSetupFromData(rat.ui.Sprite, pane, data, parentBounds);

		if (data.autoCenter)
			pane.autoCenter();
		if (data.outline)
			pane.setOutline(true, data.outline);
		if (data.onLoad)
			pane.setOnLoad(data.onLoad, pane);
		if (data.resource)
			pane.loadImage(data.resource);
		if (data.animSpeed && pane.imageRef)
			pane.imageRef.animSpeed = data.animSpeed;
		
		//	If a size was set in the data, then re-set it here.  This is because pane.loadImage may change it.

	};
});