
//----------------------------
//	StateLook
//
//	this is a module and class for tracking the look of a ui element based on its state.
//	I kept writing this same functionality over and over.  So, here's an attempt to consolidate that.
//	
//	similar to button state tracking, but so many questions:
//		use rat ui flags?
//		how to prioritize one state over another?
//		what is the use of the new module? standard searching-for-matching-state functions?
//		standard get/set functions for client use?
//		standard functions to apply to fill/stroke in current context?
		
rat.modules.add( "rat.ui.r_ui_statelook",
[
	{name: "rat.ui.r_ui", processBefore: true },
	{name: "rat.utils.r_utils", processBefore: true },
	//"rat.ui.r_ui_data",	//	TODO: nicely support data-driving an individual look
	"rat.graphics.r_graphics",
], 
function(rat)
{
	/**
	 * @constructor
	**/
	rat.ui.StateLook = function (states)
	{
		this.states = states;
		this.bestState = states.normal;
	};
	
	rat.ui.StateLook.prototype.getBestState = function(flagObject)
	{
		var bestState = this.states.normal;
		
		//	UGH so tired of reimplementing similar things.
		//	Hacked for now.
		//	TODO: store flags in state list, find best one generically by looking at flags,
		//	like button code does it.
		
		//	standard flags come from rat.ui.Element
		var F = rat.ui.Element;
		
		//	translate some vars to standard flags
		var flags = flagObject.flags || 0;
		
		if (flagObject.tracking)
			flags |= F.trackingMouseDownFlag;
		if (flagObject.highlighted)
			flags |= F.highlightedFlag;
		if (flagObject.targeted)
			flags |= F.targetedFlag;
		
		if ((flags & F.highlightedFlag) && this.states.highlighted)
			bestState = this.states.highlighted;
		if ((flags & F.targetedFlag) && this.states.targeted)
			bestState = this.states.targeted;
		if ((flags & F.trackingMouseDownFlag) && this.states.tracking)
			bestState = this.states.tracking;
		
		return bestState;
	};
	
	//	get the best state for this element, and apply it to the current ctx,
	//	and also track which one we picked in case some draw() calls are made below.
	rat.ui.StateLook.prototype.setStateFor = function(ctx, forElement)
	{
		var drawState = this.getBestState(forElement);
		this.bestState = drawState;
		
		//	todo: support different fill and stroke in same state
		ctx.strokeStyle = drawState.color.toString();
		ctx.fillStyle = drawState.color.toString();
		if (drawState.width)
			ctx.lineWidth = drawState.width;
	};
	
	rat.ui.StateLook.prototype.drawRect = function(ctx, rect)
	{
		var type = this.bestState.type || 'frame';
		
		if (type === 'frame')
			ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
		else
			ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
	};
	
	rat.ui.StateLook.prototype.drawForElement = function(ctx, forElement)
	{
		//	todo: center
		this.drawRect(ctx, {x:0, y:0, w:forElement.size.x, h:forElement.size.y});
	};
	
	rat.ui.StateLook.prototype.setAndDraw = function(ctx, forElement)
	{
		this.setStateFor(ctx, forElement);
		this.drawForElement(ctx, forElement);
	};
	
	rat.ui.StateLook.prototype.setAndDrawRect = function(ctx, stateObject, rect)
	{
		this.setStateFor(ctx, stateObject);
		this.drawRect(ctx, rect);
	};
});