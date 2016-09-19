
//
//	ui element to display an offscreen object as needed.
//	This is very simple way to insert an offscreen object in the display tree,
//	but it does NOT handle building the object or updating it.  It is expected that that's handled elsewhere.
//
rat.modules.add( "rat.ui.r_ui_offscreenimage",
[
	{name: "rat.ui.r_ui", processBefore: true },
	{name: "rat.utils.r_utils", processBefore: true },
	
	"rat.debug.r_console",
	"rat.graphics.r_offscreen",
	"rat.graphics.r_graphics",
	"rat.ui.r_ui_data",
], 
function(rat)
{
	/**
	 * @constructor
	 * @extends rat.ui.Element
	*/
	rat.ui.OffscreenImage = function (offscreen)
	{
		rat.ui.OffscreenImage.prototype.parentConstructor.call(this); //	default init
		
		if (!rat.ui.allowOffscreens)	//	global disable of ui offscreens?
		{
			rat.console.log("WARNING!  You're trying to use an OffscreenImage() object, but offscreens are not allowed by this host!");
		}
		
		this.offscreen = null;
		if (offscreen)
			this.setOffscreen(offscreen);
		
		this.setTracksMouse(false);	//	by default, no mouse tracking, highlight, tooltip, etc. including subelements.
	};
	rat.utils.inheritClassFrom(rat.ui.OffscreenImage, rat.ui.Element);
	rat.ui.OffscreenImage.prototype.elementType = "OffscreenImage";
	
	//	set my offscreen image.
	rat.ui.OffscreenImage.prototype.setOffscreen = function (offscreen)
	{
		this.offscreen = offscreen;
		this.offscreen.enableDirtyRects();
		this.contentSize.x = offscreen.width;
		this.contentSize.y = offscreen.height;
	};
	
	//	Automatically construct an offscreen image that captures
	//	the state of another ui element, and then automatically add me in the same position to the same parent.
	rat.ui.OffscreenImage.prototype.buildFrom = function (otherPane)
	{
		//	note for future:  this works if the bounds are simple, not centered, etc.
		//	in the future, it'll probably have to not call getBounds, and instead grab place/size values directly.
		//	maybe match some other flags as well?
		var pbounds = otherPane.getBounds();
		
		//	already have one? need a new one?
		var off;
		if (this.offscreen)
		{
			off = this.offscreen;
			off.setSize(pbounds.w, pbounds.h, true);
		}
		else
			off = new rat.Offscreen(pbounds.w, pbounds.h);
		off.enableDirtyRects();
		
		var ctx = off.getContext();
		
		//	debug - violet background so we can tell we're definitely rendering from offscreen.  :)
		//ctx.fillStyle = "#FF00FF";
		//ctx.fillRect(0, 0, pbounds.w, pbounds.h);
		
		var oldCtx = rat.graphics.getContext();	//	remember old context
		rat.graphics.setContext(ctx);
		otherPane.setVisible(true);	//	make sure other pane is visible, or this won't work at all
		otherPane.setBounds(0, 0, pbounds.w, pbounds.h);	//	force draw in upper left corner of this context
		
		otherPane.draw();
		if (rat.ui.debugOffscreens)
			off.applyDebugOverlay();
		
		otherPane.setBounds(pbounds);	//	restore bounds
		rat.graphics.setContext(oldCtx);	//	restore old context
		this.setOffscreen(off);
		
		//	now set me up as closely as possible to match the other pane
		this.setBounds(pbounds);	//	match bounds
		//	and insert me in the other parent's subelements, as a sibling to the original pane.
		if (otherPane.getParent())
		{
			//	removing me first if I'm already in somebody else's list...
			if (this.getParent())
				this.removeFromParent();
			
			var index = otherPane.getParent().getSubElementIndex(otherPane);
			if (index < 0)
				index = 0;
			otherPane.getParent().insertSubElement(this, index);		//	insert me in the same place
		}
	};
	
	//	redraw from just this one pane.  Similar to the above, but faster, we hope, in many cases.
	rat.ui.OffscreenImage.prototype.updateFromSinglePane = function (otherParentPane, otherPane)
	{
		var off = this.offscreen;
		var ctx = off.getContext();
		var oldCtx = rat.graphics.getContext();	//	remember old context
		rat.graphics.setContext(ctx);
		
		//	let's use the offscreen's dirty rect feature just to make clipping easier.  :)
		off.dirtyRects.clear();
		var pbounds = otherPane.getBounds();
		off.dirtyRects.add(pbounds);
		off.clipToDirty();
		off.erase();	//	erase, even though we're about to draw, so anything semi-transparent doesn't overlap.
		//	debug - colored background so we can tell this is doing something.
		//ctx.fillStyle = "#FFA000";
		//ctx.fillRect(0, 0, off.width, off.height);
		
		otherPane.setVisible(true);	//	make sure other pane is visible, or this won't work at all
		//otherPane.setBounds(0, 0, pbounds.w, pbounds.h);	//	force draw in upper left corner of this context
		otherPane.draw();
		//otherPane.setBounds(pbounds);	//	restore bounds
		
		//	if we're debugging offscreens, just paint the part that changed!
		if (rat.ui.debugOffscreens)
			off.applyDebugOverlay();
		
		off.unclip();	//	done with clipped drawing in that space
		
		rat.graphics.setContext(oldCtx);	//	restore old context
		
	};
	
	//	draw me - render my offscreen image
	rat.ui.OffscreenImage.prototype.drawSelf = function ()
	{
		var ctx = rat.graphics.getContext();
		
		if (this.offscreen)
			this.offscreen.render(ctx, -(this.center.x), -(this.center.y));
	};

	rat.ui.OffscreenImage.setupFromData = function (pane, data, parentBounds)
	{
		rat.ui.data.callParentSetupFromData(rat.ui.OffscreenImage, pane, data, parentBounds);
	};
});
