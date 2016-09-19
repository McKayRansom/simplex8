
//----------------------------
//	SizeBox Element
//	
//	A box that a user can reposition and resize,
//	and which optionally controls the size/position of another pane
//	e.g. like resizing a sprite in an editor
//
rat.modules.add( "rat.ui.r_ui_sizebox",
[
	{name: "rat.ui.r_ui", processBefore: true },
	{name: "rat.utils.r_utils", processBefore: true },
	"rat.ui.r_ui_statelook",
	"rat.debug.r_console",
	"rat.ui.r_ui_data",
	"rat.input.r_keyboard",
	"rat.graphics.r_graphics",
	"rat.math.r_math",
], 
function(rat)
{
	/**
	 * @constructor
	 * @extends rat.ui.Element
	 * @param {Object} container
	 * @param {Object} target
	 * @param {Object} config (settings for how it behaves and what inputs it supports)
	*/
	rat.ui.SizeBox = function (container, target, config)
	{
		rat.ui.SizeBox.prototype.parentConstructor.call(this, container); //	default init
		
		if (!config)
			config = {
				truncValues : true,	//	truncate to this many pixels, 1/value.  So, a value here of "1" means truncate to even pixels!
				showWhenInactive : true,
			};
			
		this.target = target;
		this.config = config;
		
		this.editable = true;	//	can be overridden to make a selectable sizebox that's not actually movable/sizeable
		
		this.drawStates = new rat.ui.StateLook({
			normal: {color : new rat.graphics.Color(160, 160, 160, 1), width:2},
			highlighted: {color : new rat.graphics.Color(200, 220, 200), width:2},
			targeted: {color : new rat.graphics.Color(160, 220, 220), width:4},	//	active
		});
		
		this.handleStates = new rat.ui.StateLook({
			normal : {color: new rat.graphics.Color(160, 160, 160), type:'frame'},
			highlighted : {color: new rat.graphics.Color(200, 220, 200, 0.5), type:'fill'},
			tracking : {color: new rat.graphics.Color(255, 255, 200), type:'fill'},
		});
		
		this.setTargetable(true);
		this.setTracksMouse(true);
		
		//	set up handles - to be fixed later on any resize
		this.handles = [];
		var hsize = rat.ui.SizeBox.baseHandleSize;
		
		//todo: pretty easy to add top left bottom right handles, right?
		
		//	4 corners plus the whole box under them
		//	topleft, topright, bottomleft, bottomright, base
		for (var i = 0; i < 5; i++)
		{
			this.handles[i] = {tracking:false, x:0, y:0, w:hsize, h:hsize};
		}
		
		//	topleft:  when user drags up/left, then add that to pos, and subtract that from size
		this.handles[0].adjustX = 1;
		this.handles[0].adjustY = 1;
		this.handles[0].adjustW = -1;
		this.handles[0].adjustH = -1;
		
		//	topright
		this.handles[1].adjustX = 0;
		this.handles[1].adjustY = 1;
		this.handles[1].adjustW = 1;
		this.handles[1].adjustH = -1;
		
		//	botleft
		this.handles[2].adjustX = 1;
		this.handles[2].adjustY = 0;
		this.handles[2].adjustW = -1;
		this.handles[2].adjustH = 1;
		
		//	botright
		this.handles[3].adjustX = 0;
		this.handles[3].adjustY = 0;
		this.handles[3].adjustW = 1;
		this.handles[3].adjustH = 1;
		
		//	base
		this.handles[4].adjustX = 1;
		this.handles[4].adjustY = 1;
		this.handles[4].adjustW = 0;
		this.handles[4].adjustH = 0;
		
		this.positionHandles();
		
	};
	rat.utils.inheritClassFrom(rat.ui.SizeBox, rat.ui.Element);
	rat.ui.SizeBox.prototype.elementType = 'sizeBox';
	
	rat.ui.SizeBox.baseHandleSize = 40;
	
	//	global scale applied to some sizebox display elements like titles, frames (well, eventually frames)
	//	This is useful when sizeboxes are inside scaled space.
	//	Not applied to handles because it's often nice to zoom in to those and interact with them more easily.
	//	Also Scales input movement, though not grid snapping, which presumed to be in global space.
	rat.ui.SizeBox.uiScale = 1;
	
	//	some settings for all sizeboxes at once,
	//	but we expect these to change on the fly
	rat.ui.SizeBox.snapToGrid = false;
	rat.ui.SizeBox.gridSize = 20;
	rat.ui.SizeBox.gridOffset = {x:0,y:0};
	
	//	set whether this can be resized/moved.
	//	If not editable, we have just one handle for selection, but not moving/sizing
	rat.ui.SizeBox.prototype.setEditable = function (editable)
	{
		if (!editable)
		{
			if (this.handles.length > 4)
				this.handles = [this.handles[4]];	//	just one main handle
		} else {
			//	todo: support reenabling?
		}
		
		this.editable = editable;
	};
	
	//	React to my bounds changing
	rat.ui.SizeBox.prototype.boundsChanged = function ()
	{
		if (this.config.truncValues)
		{
			var t = this.config.truncValues;
			this.place.pos.x = ((this.place.pos.x * t)|0)/t;
			this.place.pos.y = ((this.place.pos.y * t)|0)/t;
			
			this.size.x = ((this.size.x * t)|0)/t;
			this.size.y = ((this.size.y * t)|0)/t;
		}
		//	don't allow negative sizes.
		//	zero sizes are also a pain, but I'm not sure I want to impose that limit here.
		if (this.size.x < 0)
			this.size.x = 0;
		if (this.size.y < 0)
			this.size.y = 0;
		
		rat.ui.SizeBox.prototype.parentPrototype.boundsChanged.call(this);	//	inherited
		
		//	update handles.
		this.positionHandles();
	};
	
	//	update handle positions, sizes.
	rat.ui.SizeBox.prototype.positionHandles = function()
	{
		//	Let's make our handle size relative to our box size.
		var hsize = rat.ui.SizeBox.baseHandleSize;
		//	we like a handle size about 20% of our total size.
		var smallSide = this.size.x;
		if (this.size.y < this.size.x)
			smallSide = this.size.y;
		var potentialSize = (smallSide * 0.2)|0;
		if (potentialSize < hsize)
			hsize = potentialSize;
		if (hsize < 5)	//	some minimum clickable size
			hsize = 5;
		//	todo: support auto disabling them entirely if the box is simply way too small.
		//	todo: support auto disabling side handles if not enough room for them.  prioritize corners.

		//	todo: better logic for detecting if we're in 1-handle mode or 5-handle mode.
		//	probably always have 5, and just disable them as needed!
		//	especially 'cause we're going to add 4 more for edges at some point.
		if (this.handles.length > 4)
		{
			for (var i = 0; i < 4; i++)
			{
				this.handles[i].w = hsize;
				this.handles[i].h = hsize;
			}
			this.handles[1].x = this.size.x - hsize;
			this.handles[2].y = this.size.y - hsize;
			this.handles[3].x = this.size.x - hsize;
			this.handles[3].y = this.size.y - hsize;
		}
		
		//	last handle is the whole box,
		//	(if we don't 't detect interaction with the others, we fall back to the whole thing)
		var lastHandle = this.handles.length-1;
		this.handles[lastHandle].w = this.size.x;
		this.handles[lastHandle].h = this.size.y;
		this.handles[lastHandle].invisible = true;
	};

	//	draw my handles.
	//	do this post, since we're often used as a container for other panes,
	//	and we want to draw out UI on top of contents.
	rat.ui.SizeBox.prototype.drawSelfPost = function ()
	{
		if (!this.config.showWhenInactive && !this.isHighlighted() && !this.isTargeted())
			return;
		
		var ctx = rat.graphics.getContext();
		ctx.save();
		if (this.center)
		{
			ctx.translate(-this.center.x, -this.center.y);
		}
		
		//	render my basic highlight indicator
		this.drawStates.setAndDraw(ctx, this);
		
		//	indicate center, if it's not default topleft
		if (this.center.x !== 0 || this.center.y !== 0)
		{
			this.drawStates.drawRect(ctx, {x:this.center.x-5, y:this.center.y-5, w:10, h:10});
		}
		
		//	mouse in? highlight handles
		if (this.flags & rat.ui.Element.mouseInFlag)
		{
			for (var i = 0; i < this.handles.length; i++)
			{
				var handle = this.handles[i];
				if (handle.invisible)
					continue;
				
				//	draw my highlighting for this rectangle (take advantage of the fact that "handle" has xywh)
				this.handleStates.setAndDrawRect(ctx, handle, handle);
			}
		}
		
		//	show name?
		var fontSize = (24 * rat.ui.SizeBox.uiScale)|0;
		ctx.fillStyle = "#408080";
		ctx.font = "" + fontSize + "px arial";
		ctx.textAlign = "left";
		ctx.fillText(this.name, 45, fontSize, 800);
		
		//debug crap
		/*
		ctx.fillStyle = "#FFFFFF";
		ctx.font = "36px arial";
		ctx.textAlign = "left";
		//var text = "Flags " + this.flags;
		ctx.fillText(text, 20, 20, 800);
		
		if (this.flags & rat.ui.Element.highlightedFlag)
			ctx.fillText("high", 20, 40, 800);
		if (this.flags & rat.ui.Element.targetedFlag)
			ctx.fillText("target", 20, 60, 800);
		*/
		
		ctx.restore();
	};
	
	//	snap this position to grid
	rat.ui.SizeBox.snapPos = function(pos)
	{
		pos.x = rat.ui.SizeBox.snapValueX(pos.x);
		pos.y = rat.ui.SizeBox.snapValueY(pos.y);
		return pos;
	};
	rat.ui.SizeBox.snapValueX = function(value)
	{
		if (!rat.ui.SizeBox.snapToGrid)
			return value;
		var dx = rat.ui.SizeBox.gridOffset.x % rat.ui.SizeBox.gridSize;
		value = (((value + dx) / rat.ui.SizeBox.gridSize)|0)*rat.ui.SizeBox.gridSize;
		return value;
	};
	rat.ui.SizeBox.snapValueY = function(value)
	{
		if (!rat.ui.SizeBox.snapToGrid)
			return value;
		var dy = rat.ui.SizeBox.gridOffset.y % rat.ui.SizeBox.gridSize;
		value = (((value + dy) / rat.ui.SizeBox.gridSize)|0)*rat.ui.SizeBox.gridSize;
		return value;
	};
	
	//	track clicking in our handles
	//	We do a lot of this in global space.
	//	Why?  (1) So that when this thing moves around, we don't have to recalculate
	//		our old position values.
	//		(2) so snapping to grid happens in a single unified space
	//	Note, though, that this means we kinda ignore scaling... :(
	//	right now, I'm expecting that rat.ui.SizeBox.uiScale counteracts this...
	rat.ui.SizeBox.prototype.mouseDown = function(pos, ratEvent)
	{
		//	call inherited to get correct flags cleared/set
		rat.ui.SizeBox.prototype.parentPrototype.mouseDown.call(this, pos, ratEvent);
	
		if (!this.editable)
			return false;

		//	remember old values
		this.origBounds = {
			x:this.place.pos.x, y:this.place.pos.y,
			w:this.size.x, h:this.size.y,
		};
		
		//	was this in a handle?
		var handle = this.posToHandle(pos);
		if (handle)
		{
			this.trackHandle = handle;
			handle.tracking = true;
			//	remember relative grab point, so we don't pop on initial grab
			handle.grabPos = this.getGlobalPos(pos.x, pos.y);
			handle.lastPos = {x:handle.grabPos.x, y:handle.grabPos.y};
		}
		return true;
	};
	
	rat.ui.SizeBox.prototype.mouseUp = function(pos, ratEvent)
	{
		//	call inherited to get correct flags cleared/set
		rat.ui.EditText.prototype.parentPrototype.mouseUp.call(this, pos, ratEvent);
		
		//	clear tracking flags in any handle
		for (var hIndex = 0; hIndex < this.handles.length; hIndex++)
			this.handles[hIndex].tracking = false;
		this.trackHandle = null;
		
		//	todo: put "boundsChange" in app's undo stack, with old bounds to go directly back to.
		//		or somehow report this to anybody listening..
		
		return false;
	};
	
	//	track mouse movement for selection
	rat.ui.SizeBox.prototype.mouseMove = function(pos, ratEvent)
	{
		if (this.trackHandle)
		{
			var gpos = this.getGlobalPos(pos.x, pos.y);
			
			//	total delta from original grab position, in global coordinates.
			var dx = gpos.x - this.trackHandle.grabPos.x;
			var dy = gpos.y - this.trackHandle.grabPos.y;
			dx *= rat.ui.SizeBox.uiScale;
			dy *= rat.ui.SizeBox.uiScale;
			
			if (this.trackHandle.adjustX !== 0)
				this.place.pos.x = rat.ui.SizeBox.snapValueX(this.origBounds.x + dx);
			if (this.trackHandle.adjustY !== 0)
				this.place.pos.y = rat.ui.SizeBox.snapValueY(this.origBounds.y + dy);

			//	technically, snap should go to new bottom right *position* not size,
			//	but I'm sick of working on this.
			if (this.trackHandle.adjustW !== 0)
				this.size.x = rat.ui.SizeBox.snapValueX(this.origBounds.w + dx * this.trackHandle.adjustW);
			if (this.trackHandle.adjustH !== 0)
				this.size.y = rat.ui.SizeBox.snapValueY(this.origBounds.h + dy * this.trackHandle.adjustH);
			
			this.trackHandle.lastPos.x = gpos.x;
			this.trackHandle.lastPos.y = gpos.y;
			
			//	handle shift-key constraints
			//	shift-key maintains original aspect ratio, regardless of where the mouse goes.
			if (rat.input.keyboard.isKeyDown(rat.keys.shift))
			{
				var dwr = this.size.x / this.origBounds.w;
				var dhr = this.size.y / this.origBounds.h;
				var oldAspect = this.origBounds.w / this.origBounds.h;
				if (dwr*dwr > dhr*dhr)	//	moved more horizontally
				{
					//	so, leave any X change, but fix Y change to match.
					var oh = this.size.y;
					this.size.y = this.size.x / oldAspect;
					//	and if this is a handle that moves pos, then fix that...
					this.place.pos.y += this.trackHandle.adjustY * (oh - this.size.y);
				} else {
					var ow = this.size.x;
					this.size.x = this.size.y * oldAspect;
					//	and if this is a handle that moves pos, then fix that...
					this.place.pos.x += this.trackHandle.adjustX * (ow - this.size.x);
				}
				//console.log("dwh " + dwr + "," + dhr);
			}
			//	todo: also apply size limits - don't let them go negative size
			
			this.boundsChanged();
			this.updateAfterMove();
		} else {
			//	do highlighting of handles
			//	first unhighlight all
			for (var hIndex = 0; hIndex < this.handles.length; hIndex++)
				this.handles[hIndex].highlighted = false;
			//	then highlight only the one found
			var handle = this.posToHandle(pos);
			if (handle)
				handle.highlighted = true;
		}
			
		//	track
		return false;
	};
	
	//	update our size/position, etc., after anything changes.
	//	This is so we can continue to enforce certain placement flags, snap state, etc..
	rat.ui.SizeBox.prototype.updateAfterMove = function()
	{
		
		//	also notify others who care that we changed.
		//	todo: Using the r_messenger system or event trigger system would be more flexible here!
		if (this.changeCallback)
			this.changeCallback(this, 'bounds');
	};
	
	//	given a position, return any handle it hit.
	rat.ui.SizeBox.prototype.posToHandle = function(pos)
	{
		var thePos = {x:pos.x + this.center.x, y:pos.y + this.center.y};
		for (var hIndex = 0; hIndex < this.handles.length; hIndex++)
		{
			var h = this.handles[hIndex];
			if (thePos.x > h.x && thePos.y > h.y && thePos.x < h.x + h.w && thePos.y < h.y + h.h)
			{
				return h;
			}
		}
		return null;
	};
	
	rat.ui.SizeBox.prototype.keyDown = function(ratEvent)
	{
		var dir = rat.input.keyToDirection(ratEvent.which);
		//	arrow keys nudge.  shift-arrow moves farther.
		//	don't eat up other meta-arrow keys, since they might be needed by somebody else.
		if (this.editable && dir && !ratEvent.sysEvent.altKey && !ratEvent.sysEvent.ctrlKey)
		{
			var mult = 1;
			if (ratEvent.sysEvent.shiftKey)
				mult = 10;
			this.place.pos.x += dir.x * mult;
			this.place.pos.y += dir.y * mult;
			this.updateAfterMove();
			return true;
		}
		return false;
	};
	

	rat.ui.SizeBox.setupFromData = function (pane, data, parentBounds)
	{
		rat.ui.data.callParentSetupFromData(rat.ui.SizeBox, pane, data, parentBounds);
		//	todo: other config stuff.
		//	But these are usually just created on the fly?
	};
});