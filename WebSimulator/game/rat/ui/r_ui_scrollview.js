//----------------------------
//	ScrollView UI Element
//
//		A UI element for showing a scissored (cropped) view of possibly scrolled content.
//		handles user interaction (clicking and dragging to scroll, events from attached scrollbar (to be implemented)), etc.
//
//	works off of basic content scroll support in Element (see r_ui.js, and the "contentOffset" field in standard elements).
//	In fact, if you want a non-interactive view that clips and scrolls, you can use a standard Element instead,
//		and set clipping true.
//
//	todo: momentum, fling... are these done?
//
//	todo: zoom (with mouse wheel and pinch support)
//
//	TODO:  Offscreen and Dirty support?  Tricky...
//
rat.modules.add( "rat.ui.r_ui_scrollview",
[
	{name: "rat.ui.r_ui", processBefore: true },
	{name: "rat.utils.r_utils", processBefore: true },
	
	"rat.math.r_math",
	"rat.math.r_vector",
	"rat.graphics.r_graphics",
	"rat.debug.r_console",
	"rat.os.r_system",
], 
function(rat)
{
	/**
	 * @constructor
	 * @extends rat.ui.Element
	*/
	rat.ui.ScrollView = function (parentView)
	{
		rat.ui.ScrollView.prototype.parentConstructor.call(this, parentView); //	default init
		this.setClip(true);	//	scroll views aren't very interesting unless they clip
		this.lastMousePos = new rat.Vector(0, 0);
		this.grabPos = new rat.Vector(0, 0);
		this.grabOffset = new rat.Vector(0, 0);
		//	sensitivity is number of pixels per scrollWheel unit.  1 is never useful, so I'm setting it to something higher just as a guess as to what will be useful
		//	Most UI designers will want to change this (which they can do directly)
		this.wheelSensitivity = 32;
		this.wheelAffects = 'y';	//	default to wheel scrolling vertically.
		this.allowPinchZoom = false;	//	allow zoom (e.g. pinch to zoom)
		//	todo: pinch zoom tracking values.
		//		do pinch zoom/scroll like chrome does on mobile.  It's pretty slick.
		//		you can add finger touches on the fly and it handles it nicely.

		//this.allowDrag = true;

		//	fling handling
		this.allowFling = true;
		this.flingMouse = {x:0, y:0};
		this.flingTrack = [];
		for (var i = 0; i < rat.ui.ScrollView.flingTrackFrames; i++)
			this.flingTrack[i] = {x:0, y:0};
		this.flingTrackIndex = 0;
		this.flingVelocity = {x:0, y:0};
	};
	rat.utils.inheritClassFrom(rat.ui.ScrollView, rat.ui.Element);
	rat.ui.ScrollView.flingTrackFrames = 4;
	
	//	default values for scrollview objects
	rat.ui.ScrollView.prototype.elementType = "scrollView";
	
	//	drag interpretation thresholds.
	//	These default values are not super useful
	//		the appropriate thresholds depend on resolution, gui scale, size of view, desired user experience, etc.
	//		most games should override these. (like:  myView.minimumDragThreshold = 50;)
	rat.ui.ScrollView.prototype.minimumDragThreshold = 10;	//	how far before we even respect drag attempt
	rat.ui.ScrollView.prototype.meaningfulDragThreshold = 15;	//	how far before we tell everybody else we got this
	
	//	a quick way to do standard wheel-zooming support
	rat.ui.ScrollView.prototype.supportZoom = function ()
	{
		this.wheelAffects = 'z';
		this.wheelSensitivity = 0.1;
		this.allowPinchZoom = true;
	};

	//	Scroll view handle mouse wheel inside me.
	rat.ui.ScrollView.prototype.mouseWheelEvent = function (pos, ratEvent)
	{
		if (!this.isEnabled())
			return false;
		
		if (this.wheelAffects === 'y' || this.wheelAffects === 'x')
		{
			if (this.wheelAffects === 'y')
				this.contentOffset.y += ratEvent.wheelDelta * this.wheelSensitivity;
			else
				this.contentOffset.x += ratEvent.wheelDelta * this.wheelSensitivity;
			//console.log("scroll " + this.wheelEventsThisFrame);
			
			//	Make sure we haven't moved outside actual content
			this.clampScroll();
			
			//	todo: actually detect real change?
			if (this.viewChanged)
				this.viewChanged();

			return true;	//	handled
			
		} else if (this.wheelAffects === 'z')	//	zoom
		{
			//	TODO: factor in the idea that when the zoom is big, we want change to be higher.
			//		e.g. going from 9.8 to 9.9 is hardly noticeable,
			//		but going from 0.1 to 0.2 is huge.
			//		So, how should that work?
			//		It should be fixed here, not somewhere else.
			//		Remember, though, that the nice thing about a stepped zoom as currently implemented
			//		is that it's reversible.  If you switch this to something else (like percentage)
			//		make sure that's reversible, too.
			//		Interesting.  Gimp seems to use a table.
			//		scaling up goes 100%, 150, 200, 300, 400, 550, 800
			//		should be solvable ... with ... math.
			var deltaScale = ratEvent.wheelDelta * this.wheelSensitivity;
			
			this.stepZoomAnchored(deltaScale, this.mousePos);
			
			return true;
		}
		
		return false;
	};
	
	//	Zoom using an anchor point in CONTENT space.
	//	todo: move to rat.ui.Element?
	rat.ui.ScrollView.prototype.stepZoomAnchored = function(deltaScale, anchorPos)
	{
		//	Factor in position of mouse, and scroll to account for that.
		//	so we zoom like google maps and supreme commander - focusing on mouse position.
		//	The basic idea is we want the mouse to be pointing at the sme spot (in content space) when we're done.
		//	So, the easy way to do this is to remember where we were pointing, in content space,
		//	and figure out how much that content-space point moved when we scaled.
		//	deltaX = oldX * newScal - oldX * oldScale
		//	It's stupid, but it took me hours to work out.  :(
		
		//	Another problem is that we may be in the middle of a scroll at the same time,
		//	and not only will parentToLocalContentPos below give the wrong target value,
		//	but also the direct setting of offset below will be bogus, since a scroller is actively
		//	changing that value...
		//	Anyway... since we don't animate zoom right now anyway,
		//	let's just kill any scrollers we had going...  :)
		//	also, let's jump to the target immediately, so that effort wasn't lost.
		//	todo: when animated zoom is implemented, redo this.
		var targetOffset = this.getTargetContentOffset();
		this.contentOffset.x = targetOffset.x;
		this.contentOffset.y = targetOffset.y;
		rat.ui.killAnimatorsForElement(this, rat.ui.Animator.scroller);
		
		if (!anchorPos)
		{
			//	use whatever center of view currently points at.
			anchorPos = this.parentToLocalContentPos(this.place.pos.x + this.size.x / 2, this.place.pos.y + this.size.y / 2);
		}
		//	these are in pure local content space coordinates
		var oldX = anchorPos.x;
		var oldY = anchorPos.y;
		
		//	remember our old scale
		var oldZoomX = this.contentScale.x;
		var oldZoomY = this.contentScale.y;
		
		//	do the zoom
		this.stepZoom(deltaScale);
		
		//	and adjust offset (which is in pixels in parent space, I think)
		this.contentOffset.x -= oldX * this.contentScale.x - oldX * oldZoomX;
		this.contentOffset.y -= oldY * this.contentScale.y - oldY * oldZoomY;
		
		this.clampScroll();
		
		//	todo: actually detect real change?
		if (this.viewChanged)
			this.viewChanged();
	};

	//	todo: move this last pos current pos tracking stuff up to element level?
	//	could be useful for lots of classes
	//	todo: move scroll limits to element class, too?

	//	mouse down
	//	pos is in local space
	rat.ui.ScrollView.prototype.mouseDown = function (pos)
	{
		if (!this.isEnabled())
			return;

		//	all this logic in this function and related functions happens in parent space.
		//	I'm not sure why, but it seemed like a good idea at the time, and probably is.
		//	so, since mouseDown is in local space, convert to parent space for dealing with later
		this.lastMousePos.x = pos.x + this.place.pos.x;	//	last known mouse pos
		this.lastMousePos.y = pos.y + this.place.pos.y;
		this.grabPos.x = pos.x + this.place.pos.x;	//	starting grab point
		this.grabPos.y = pos.y + this.place.pos.y;
		this.grabOffset.x = this.contentOffset.x;	//	remember what offset we had when we first grabbed
		this.grabOffset.y = this.contentOffset.y;
		//console.log("grab " + this.grabPos.x + "," + this.grabPos.y);
		//console.log("  graboff " + this.grabOffset.x +"," +this.grabOffset.y);
		
		//	reset fling tracking
		this.flingMouse.x = rat.mousePos.x;
		this.flingMouse.y = rat.mousePos.y;
		this.flingVelocity.x = this.flingVelocity.y = 0;
		for (var i = 0; i < rat.ui.ScrollView.flingTrackFrames; i++)
			this.flingTrack[i].x = this.flingTrack[i].y = 0;
		
		rat.ui.ScrollView.prototype.parentPrototype.mouseDown.call(this, pos);	//	inherited behavior
	};

	//	mouse up
	//	called whether the mouseup happened in this element or not,
	//	in case we were tracking the mouse.
	//	pos is in local space
	rat.ui.ScrollView.prototype.mouseUp = function (pos)
	{
		var wasTracking = (this.flags & rat.ui.Element.trackingMouseDownFlag) !== 0;
		
		var handled = rat.ui.ScrollView.prototype.parentPrototype.mouseUp.call(this, pos);	//	inherited behavior
		
		//	apply fling
		if (wasTracking && this.allowFling)
		{
			//	calculate average of last few frames
			this.flingVelocity.x = this.flingVelocity.y = 0;
			for (var i = 0; i < rat.ui.ScrollView.flingTrackFrames; i++)
			{
				this.flingVelocity.x += this.flingTrack[i].x;
				this.flingVelocity.y += this.flingTrack[i].y;
			}
			this.flingVelocity.x /= rat.ui.ScrollView.flingTrackFrames;
			this.flingVelocity.y /= rat.ui.ScrollView.flingTrackFrames;
			var MAX_FLING_VEL = 2000;
			if (this.flingVelocity.x > MAX_FLING_VEL)
				this.flingVelocity.x = MAX_FLING_VEL;
			if (this.flingVelocity.x < -MAX_FLING_VEL)
				this.flingVelocity.x = -MAX_FLING_VEL;
			if (this.flingVelocity.y > MAX_FLING_VEL)
				this.flingVelocity.y = MAX_FLING_VEL;
			if (this.flingVelocity.y < -MAX_FLING_VEL)
				this.flingVelocity.y = -MAX_FLING_VEL;
				
			//console.log("fling! " + this.flingVelocity.x);
		}
		
		//	"handled" is better determined by parent function, which checks where mouseup happened.
		return handled;
	};

	//
	//	Handle mouse move, including passing to sub elements.
	//	This is a good time to track dragging.
	//	pos is in parent coordinates
	//
	rat.ui.ScrollView.prototype.handleMouseMove = function (newPos, handleLeaveOnly, ratEvent)
	{
		//	inherited normal func
		rat.ui.ScrollView.prototype.parentPrototype.handleMouseMove.call(this, newPos, handleLeaveOnly, ratEvent);

		if (this.flags & rat.ui.Element.trackingMouseDownFlag)
		{
			//var myBounds = this.getBounds();	//	in parent space
			//var inBounds = PointInRect(newPos, myBounds);
			//if (inBounds)
				
			var deltaX = newPos.x - this.grabPos.x;
			var deltaY = newPos.y - this.grabPos.y;
			//rat.console.log("ButtonScrollView mouse move delta = (" + deltaX + ", " + deltaY + ")");
			
			if (Math.abs(deltaX) > this.minimumDragThreshold || Math.abs(deltaY) > this.minimumDragThreshold)
			{
				//	figure out offset from original grabPos
				//	and set that offset directly.
				
				var offsetX = this.grabOffset.x + deltaX;
				var offsetY = this.grabOffset.y + deltaY;
				//console.log("scroll " + offsetX + "," + offsetY);

				this.contentOffset.x = offsetX;
				this.contentOffset.y = offsetY;

				//	todo: that bouncy snap thing when you try to drag a scrolly view past its content edges
				this.clampScroll();
				
				//	now, adjust lastmousepos only to match dx and dy,
				//	so we lock where the source position is in the scrollview and I know that made no sense but trust me it's good...
				this.lastMousePos.x = newPos.x;
				this.lastMousePos.y = newPos.y;
				
				//	todo: actually detect real change?
				if (this.viewChanged)
					this.viewChanged();
			}
			
			//	if we're being dragged, then we don't want any of our subelements,
			//	like buttons, to keep tracking this set of inputs, since it's obviously
			//	a scrollview drag.
			//	This is the behavior that used to be in buttonScrollView,
			//	but that was lame to have a whole module and class for this little bit of functionality.
			
			var threshold = this.meaningfulDragThreshold;
			if (Math.abs(deltaX) > threshold || Math.abs(deltaY) > threshold)
			{
				//console.log("canceling mouse tracking for scrollview drag with thresh " + threshold);
				// Call the stopMouseTrackingRecurse() function for all subelements of the scroll view.
				this.callForSubElements(stopMouseTrackingRecurse);
			}
		}
	};
	
	// Function for canceling mouse tracking state.
	//	(used above)
	//	todo: move to rat element class?  Generally useful?
	function doStopMouseTracking(){
		var elem = this;
		// Disable then re-enable the element.
		//	This results in lots of flags being cleared, including tracking, highlight, pressed, etc.
		// Kind of dumb, but maybe better than mucking around with internal flags?
		if (elem.isEnabled())
		{
			elem.setEnabled(false);
			elem.setEnabled(true);
		}
		//	and support a custom function to handle this case, as well, if anyone wants it.
		if (elem.stopMouseTracking)
			elem.stopMouseTracking();
	}
	// Function used for recursion
	function stopMouseTrackingRecurse(){
		doStopMouseTracking.call(this);
		this.callForSubElements(stopMouseTrackingRecurse);
	}
	
	//
	//	Update every frame.  A good time to handle animation,
	//	particularly flinging.
	//
	rat.ui.ScrollView.prototype.updateSelf = function (dt)
	{
		//	get info about mouse velocity.
		if (this.allowFling)
		{
			if (this.flags & rat.ui.Element.trackingMouseDownFlag)
			{
				//	in case a mouseup is coming, track velocity for fling.
				//	average over several frames, but only a few.
				//	If the user comes to a stop and lets up, we want no velocity...
				var newPos = rat.mousePos;
				
				var dx = (newPos.x - this.flingMouse.x) / dt;
				var dy = (newPos.y - this.flingMouse.y) / dt;
				this.flingMouse.x = newPos.x;
				this.flingMouse.y = newPos.y;
				
				var spot = this.flingTrackIndex;
				this.flingTrack[spot].x = dx;
				this.flingTrack[spot].y = dy;
				this.flingTrackIndex = (spot + 1) % rat.ui.ScrollView.flingTrackFrames;
				
			//	if mouse NOT down, and we did have fling info, do fling movement update
			} else if (this.flingVelocity.x !== 0 || this.flingVelocity.y !== 0) {
				
				//console.log("dx " + this.flingVelocity.x);
				
				//	scroll directly
				this.contentOffset.x += this.flingVelocity.x * dt;
				this.contentOffset.y += this.flingVelocity.y * dt;
				
				this.clampScroll();
				
				//	todo: actually detect real change?
				if (this.viewChanged)
					this.viewChanged();
				
				//	this number controls how far a fling coasts...
				var decay = dt * 3000;	//	todo: make this configurable?
				//	decay velocity
				if (this.flingVelocity.x < 0)
				{
					this.flingVelocity.x += decay;
					if (this.flingVelocity.x > 0)
						this.flingVelocity.x = 0;
				} else if (this.flingVelocity.x > 0)
				{
					this.flingVelocity.x -= decay;
					if (this.flingVelocity.x < 0)
						this.flingVelocity.x = 0;
				}
				if (this.flingVelocity.y < 0)
				{
					this.flingVelocity.y += decay;
					if (this.flingVelocity.y > 0)
						this.flingVelocity.y = 0;
				} else if (this.flingVelocity.y > 0)
				{
					this.flingVelocity.y -= decay;
					if (this.flingVelocity.y < 0)
						this.flingVelocity.y = 0;
				}
			}
		}
		
		//rat.ui.ScrollView.prototype.parentPrototype.updateSelf.call(this, dt);	//	inherited behavior (there isn't one!)
	};
	
	//--------------------------------------------------------------------------------------
	//	Setup from data
	
	rat.ui.ScrollView.editProperties = [
	{ label: "scroll",
		props: [
			//	contentsize (and contentOffset) is really from rat.ui.Element, but nobody uses it but scrollview.
			//	feel free to move this if you need to.
			//	Note that the actual value is read in rat.ui.Element where it should be.
			{propName:'contentSize', type:'sizevector', valueType:'float'},
			//	There's some weird bug with setting this, so don't even allow it for now.
			//{propName:'contentOffset', type:'xyvector', valueType:'float', defValue:{x:0, y:0}},
			
			{propName:'wheelSensitivity', type:'float', defValue:32, tipText:"If used for zoom, use a really low value, like 0.1"},
			{propName:'wheelAffects', type:'string', defValue:"y"},
			{propName:'allowPinchZoom', type:'boolean', tipText:"Not supported yet!"},
			{propName:'allowFling', type:'boolean'},
		],
	}
	];

	rat.ui.ScrollView.setupFromData = function (pane, data, parentBounds)
	{
		rat.ui.data.callParentSetupFromData(rat.ui.ScrollView, pane, data, parentBounds);

		pane.wheelSensitivity = data.wheelSensitivity || pane.wheelSensitivity;
		pane.wheelAffects = data.wheelAffects || pane.wheelAffects;
		pane.allowPinchZoom = data.allowPinchZoom || pane.allowPinchZoom;
		pane.allowFling = data.allowFling || pane.allowFling;
	};
	
	//	old variant name
	rat.ui.ButtonScrollView = rat.ui.ScrollView;
	
});
