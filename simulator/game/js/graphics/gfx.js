//
//	Game graphics module
//
//	for defining a bunch of source assets and properties,
//	for pre-loading those,
//	and for some useful drawing functions
//
rat.modules.add( "js.gfx", [], function(rat)
{
var gfx = {
	
	assets : {
		'checkmark' : {res:"images/checkmark.png"},
		//	etc...
		//	'money' : {res:"images/ui/money.png", autoCenter: false, animSpeed:12},
	},
	
	//	Init once per session (mostly for a chance to register images to preload)
	oneTimeInit : function()
	{
		//	load main set of assets
		for (var key in gfx.assets)
		{
			var entry = gfx.assets[key];
			
			//	preload that
			rat.graphics.preLoadImages(entry.res);

			//	automatically build a ref to every image in our asset list, so we can easily
			//	draw everything later.
			var theImageRef = new rat.graphics.ImageRef(entry.res);
			entry.image = theImageRef;
			
			//	everything is centered by default
			if (entry.autoCenter !== false)
				theImageRef.setCentered(true, true);
			
			if (entry.animSpeed)
				theImageRef.setAnimSpeed(entry.animSpeed);
		};
	},
	
	//	Init something after preload stage is done?
	initAfterLoad : function()
	{
	},
	
	//	update each frame
	update : function(dt)
	{
		//	asset animation, in case any of these imagerefs are animated.
		for (var key in gfx.assets)
		{
			gfx.assets[key].image.update(dt);
		}
	},
	
	//
	//	Given an asset name, return the image we preloaded for that, if any. 
	getImage : function(name, variant)
	{
		if (this.assets[name] && this.assets[name].image)
			return this.assets[name].image;
		else
			return null;
	},
	
	//	draw a single asset, more generically, at a given location, rotation, and size
	drawAsset : function(ctx, assetName, x, y, rot, drawSize)
	{
		if (!ctx)
			ctx = app.ctx;
		if (!rot)
			rot = 0;
		
		ctx.save();
		ctx.translate(x, y);
		ctx.rotate(rot);
		
		var image = this.getImage(assetName);
		//	match rendering width to desired size
		var imageSize = image.getSize();
		
		if (!drawSize)
			drawSize = imageSize.w;
		
		//	match height to width with same aspect ratio
		var scale = drawSize/imageSize.w;
		var height = scale * imageSize.h;

		image.draw(ctx, 0, 0, drawSize, height);
		
		ctx.restore();
	},
		
};	//	end of local gfx namespace and object

//	global access to this functionality and data
window.gfx = gfx;

});
