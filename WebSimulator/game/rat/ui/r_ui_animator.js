
//----------------------------
//	Animators for ui elements
//	(can be used to animate other stuff, too, as long as function names match up)
//
//	Usage:
//		* create one of these, attaching to a UI element.
//			the animator will get put in a global animators list that's updated every frame.
//
//		* for timed animation from a to b, use setTimer and setStartEnd
//		* for continuous increasing/decreasing animation, use setSpeed instead.
//
rat.modules.add( "rat.ui.r_ui_animator",
[
	{ name: "rat.ui.r_ui", processBefore: true },
	
	"rat.debug.r_console",
	"rat.math.r_vector",
	"rat.utils.r_utils",
], 
function(rat)
{
	rat.ui.animators = [];

	/**
	 * @constructor
	*/
	rat.ui.Animator = function (type, targetElement, id, relative)
	{
		//	third argument might actually be "relative" flag
		if (typeof (id) === "boolean" && arguments.length === 3) {
			relative = id;
			id = void 0;
		}
		
		this.id = id; // Possible custom ID
		this.type = type;
		this.relative = !!relative;
		this.target = targetElement;
		this.startValue = new rat.Vector(0, 0); //	initial value for animation, e.g. move, scale
		this.endValue = new rat.Vector(0, 0); //	destination for animation, e.g. move, scale

		this.startTime = -1;
		this.time = -1;
		this.delay = 0;
		//this.interp = 0;
		//	default to ease in/out, since usually that's what we'll want, I proclaim.
		//	if this is not desired, call clearInterpFilter.
		this.interpFilter = rat.ui.Animator.filterEaseInOut;

		this.flags = 0;
		this.setAutoDie(true);				//	this is almost always desired - kill animator (stop animating) when you're done animating.

		this.speed = 1; 					//	units per second - used when there's no timer (continuous)

		this.continuousVal = 0;				//	Continuous animation value.  Used to make repeating back-and-forth/in-out effect.
		this.continuousSign = 1;			//	Continuous animation "direction". Used to make repeating back-and-forth/in-out effect.
		
		this.delayCallback = null;
		this.doneCallback = null;

		if (!this.target)
		{
			rat.console.log("No target input for animator! Bad juju! Not adding it to the animator list");
			return;
		}

		this.targetStartState = {
			x: this.target.place.pos.x,
			y: this.target.place.pos.y,
			cx: this.target.contentOffset.x,
			cy: this.target.contentOffset.y,
			sx: this.target.scale.x,
			sy: this.target.scale.y,
			w: this.target.size.x,
			h: this.target.size.y,
			r: this.target.place.rot.angle,
			opacity: this.target.opacity
		};

		rat.ui.animators.push(this);
		//console.log("animator");
	};

	//	some constants for animators.
	//	animation types:
	rat.ui.Animator.mover = 1; //	move (use element place.pos)
	rat.ui.Animator.rotator = 2; //	rotate (use element place.rot)
	rat.ui.Animator.rotater = rat.ui.Animator.rotator;	//	alternate (more consistent) name
	rat.ui.Animator.scaler = 3; //	scale (use element scale)
	rat.ui.Animator.resizer = 4; //	resize (use element size)
	rat.ui.Animator.fader = 5; //	fade (use opacity)
	rat.ui.Animator.scroller = 6; //	scroll  (use element contentoffset)
	//	todo: support rotate from center, or a new centerRotator?  or is that what centering code above was supposed to support? *sigh*
	//	todo: it'd be cool to have an animator that applies a rat ui flag (remembering the old flag setting) for a set time.  E.g. fake pressed for 1 second.

	rat.ui.Animator.autoDieFlag = 0x01; //	kill this animator as soon as its timer runs out
	rat.ui.Animator.autoRemoveTargetFlag = 0x02; //	when this animator is done, remove target from parent

	//	animator functions
	rat.ui.Animator.prototype.setAutoDie = function (sense)
	{
		if (sense || sense === void 0)
			this.flags |= rat.ui.Animator.autoDieFlag;
		else
			this.flags &= ~rat.ui.Animator.autoDieFlag;
	};

	rat.ui.Animator.prototype.setAutoRemoveTarget = function (sense)
	{
		if (sense || sense === void 0)
			this.flags |= rat.ui.Animator.autoRemoveTargetFlag;
		else
			this.flags &= ~rat.ui.Animator.autoRemoveTargetFlag;
	};

	rat.ui.Animator.prototype.setDoneCallback = function (f)	//	call after done
	{
		this.doneCallback = f;
	};

	rat.ui.Animator.prototype.setDelayDoneCallback = function (f)	//	call after delay
	{
		this.delayCallback = f;
	};

	rat.ui.Animator.prototype.setTimer = function (time)
	{
		this.startTime = time;
		this.time = time;
	};

	rat.ui.Animator.prototype.setDelay = function (time)
	{
		this.delay = time;
	};

	rat.ui.Animator.prototype.setSpeed = function (speed)
	{
		this.speed = speed;
	};

	//	set start and end interpolation values in scalar form, for things like fade
	rat.ui.Animator.prototype.setStartEnd = function (startVal, endVal)
	{
		this.startValue.x = startVal;
		this.startValue.y = startVal;	//	copy to y as well, useful for things like uniform scale
		this.endValue.x = endVal;
		this.endValue.y = endVal;

		this.update(0);	//	start out at the start value now
	};

	//	set start and end interpolation values in vector form (for things like move)
	rat.ui.Animator.prototype.setStartEndVectors = function (startVal, endVal)
	{
		//	make this a little easier to call - if no startval is specified, try to figure out current value,
		//	and use that as start value.
		if (!startVal)
		{
			var curVal = this.getCurrentValueForType();
			this.startValue.x = curVal.x;
			this.startValue.y = curVal.y;
		} else {
			this.startValue.x = startVal.x;
			this.startValue.y = startVal.y;
		}
		this.endValue.x = endVal.x;
		this.endValue.y = endVal.y;

		this.update(0);	//	start out at the start value now
	};
	
	//
	//	Filter functions.
	//
	//	You can think of these as speed modifiers.
	//	"ease in", for instance, means start out at a speed of 0, and ease in to full speed.
	//	Each filter function takes input from 0-1 and returns output from 0-1,
	//	so they're easy to mix in to existing logic.
	//	There's nothing specific to the rat.ui.Animator module about these functions, just
	//	that they're convenient here.  You can use them in other modules,
	//	or move them some day to another place.
	//	Todo: Another module would be a good idea.
	
	//	For similar stuff, see:
	//	http://robertpenner.com/easing/
	//	http://easings.net/
	//	https://github.com/danro/jquery-easing/blob/master/jquery.easing.js
	//	http://gizma.com/easing/
	//	these robert penner functions take:
	//	cur interp, start value, change in value, total interp.
	//	or... 
	//	t = f
	//	b = 0
	//	c = 1
	//	d = 1
	//	So, you can take any penner function, plug in those values, and simplify.
	
	//	Don't change
	rat.ui.Animator.filterNone = function (f) {
		return 0;
	};

	//	Linear
	rat.ui.Animator.filterLinear = function (f) {
		return f;
	};

	//	Ease in and ease out.
	rat.ui.Animator.filterEaseInOut = function (f)
	{
		//return 3 * (f * f) - 2 * (f * f * f);
		return (f * f) * (3 - 2 * f);
	};
	//s(x) = sin(x*PI/2)^2 is slightly smoother?
	//s(x) = x - sin(x*2*PI) / (2*PI) is noticeably smoother?
	//see also http://gizma.com/easing/

	//	ease in, but then full speed to end
	rat.ui.Animator.filterEaseIn = function (f)
	{
		return (f * f);
	};
	
	//	full speed at start, then ease out speed at end.
	rat.ui.Animator.filterEaseOut = function (f)
	{
		return f * (2 - f);
	};
	
	//	ease in, ease out at destination halfway through time, and then ease back to start!
	//	this is nice for things like briefly scaling an object up and down with just one scaler animator.
	rat.ui.Animator.filterEaseThereAndBack = function (f)
	{
		if (f < 0.5)
			return rat.ui.Animator.filterEaseInOut(f*2);
		else
			return 1 - rat.ui.Animator.filterEaseInOut((f-0.5)*2);
	};
	
	//	these would be nice.  :)
	rat.ui.Animator.filterEaseInElastic = function (f)
	{
		return f;
	},
	
	rat.ui.Animator.filterEaseOutElastic = function(f)
	{
		if (f <= 0)
			return 0;
		if (f >= 1)
			return 1;
		
		//	how many times we bounce, basically. (how much we cut down on sin() frequency below)
		//	0.5 = very few bounces, 0.2 = lots of bounces.  0.3 was original.
		var p = 0.4;	//	0.3
		
		var s = p/(2*Math.PI) * 1.5707;//Math.asin (1);
		return Math.pow(2,-10*f) * Math.sin( (f-s)*(2*Math.PI)/p ) + 1;
	},
	
	rat.ui.Animator.prototype.setInterpFilter = function(filterFunc)
	{
		this.interpFilter = filterFunc;
	};
	rat.ui.Animator.prototype.clearInterpFilter = function()
	{
		this.setInterpFilter(null);
	};
	
	//	Update this animator
	rat.ui.Animator.prototype.update = function (dt)
	{
		if (!this.target)
			return false;

		if (this.delay > 0)
		{
			this.delay -= dt;
			if (this.delay > 0)
				return false;
			///@todo	subtract leftover from timer as well? (for accuracy)
			
			if (this.delayCallback)
				this.delayCallback(this);
		}

		var done = false;

		var interp = null;

		//	first figure out how much to change animation value, based on timer and timer type
		if (this.time < 0)	//	continuous mode
		{
			if (this.type === rat.ui.Animator.rotator)
				// For rotations, just do a continuous rotation, using this.speed as radians per second
				this.target.place.rot.angle += this.speed * dt;
			else
			{
				// For other types, calculate an interpolation value, and let the code below handle the rest.
				// Set up a "back-and-forth" type animation from 0 to 1 and back.
				// this.continuousVal is the current value in the 0 to 1 range.
				// this.continuousSign controls whether it's increasing or decreasing.
				this.continuousVal += this.continuousSign * this.speed * dt;
				if (this.continuousVal > 1)
				{
					this.continuousVal = 1;
					this.continuousSign = -this.continuousSign;
				}
				else if (this.continuousVal < 0)
				{
					this.continuousVal = 0;
					this.continuousSign = -this.continuousSign;
				}

				interp = this.continuousVal;
			}

		} else
		{	//	timer mode
			this.time -= dt;
			if (this.time < 0)
			{
				this.time = 0;
				done = true;
			}

			// Calculate interpolation value
			if (this.startTime <= 0)	//	somehow we were asked to take 0 seconds to animate...
				interp = 1;
			else
				interp = 1 - (this.time / this.startTime);

		}

		// Use interpolation value to set appropriate target values.
		if (interp !== null)
		{
			if (this.interpFilter !== void 0)
				interp = this.interpFilter(interp);
			var xVal = rat.utils.interpolate(this.startValue.x, this.endValue.x, interp);
			var yVal = rat.utils.interpolate(this.startValue.y, this.endValue.y, interp);

			//	then set target element's values based on animator type
			if (this.type === rat.ui.Animator.mover)
			{
				if (this.relative) {
					xVal += this.targetStartState.x;
					yVal += this.targetStartState.y;
				}

				this.target.place.pos.x = xVal;
				this.target.place.pos.y = yVal;
				
				//	this changes look of parent.  see element setScale
				if (this.target.parent)
					this.target.parent.setDirty(true);
			}
			else if (this.type === rat.ui.Animator.rotator)
			{
				if (this.relative)
					xVal += this.targetStartState.r;

				this.target.place.rot.angle = xVal;
				//	this changes look of parent.  see element setScale
				if (this.target.parent)
					this.target.parent.setDirty(true);
			}
			else if (this.type === rat.ui.Animator.scaler)
			{
				if (this.relative) {
					xVal += this.targetStartState.sx;
					yVal += this.targetStartState.sy;
				}
				this.target.setScale(xVal, yVal);
			}
			else if (this.type === rat.ui.Animator.resizer)
			{
				if (this.relative) {
					xVal += this.targetStartState.w;
					yVal += this.targetStartState.h;
				}
				this.target.setSize(xVal, yVal);
			}
			else if (this.type === rat.ui.Animator.fader)
			{
				if (this.relative)
					xVal += this.targetStartState.opacity;
				this.target.setOpacityRecursive(xVal);
			}
			else if (this.type === rat.ui.Animator.scroller)
			{
				if (this.relative) {
					xVal += this.targetStartState.cx;
					yVal += this.targetStartState.cy;
				}
				this.target.contentOffset.x = xVal;
				this.target.contentOffset.y = yVal;
				//	clamp?  Let's assume they know what they're doing...
				//	set dirty?  see element scroll function
				//	todo: see if there was actually a change
				if (this.target.viewChanged)
					this.target.viewChanged();
				}
		}

		if (done && this.doneCallback)
		{
			//	warning - if you have a doneCallback and you don't autodie this animator, it'll get called over and over?
			var self = this;
			this.doneCallback(this.target, self);
		}

		if (done && (this.flags & rat.ui.Animator.autoRemoveTargetFlag))
		{
			this.target.removeFromParent();
		}

		if (done && (this.flags & rat.ui.Animator.autoDieFlag))
		{
			return true;
		}

		return false;
	};
	
	//	utility: given our type, get whatever our target's current value is.
	rat.ui.Animator.prototype.getCurrentValueForType = function()
	{
		if (this.type === rat.ui.Animator.mover)
			return this.target.place.pos;
		else if (this.type === rat.ui.Animator.rotator)
			return this.target.place.rot.angle;
		else if (this.type === rat.ui.Animator.scaler)
			return this.target.scale;
		else if (this.type === rat.ui.Animator.resizer)
			return this.target.size;
		else if (this.type === rat.ui.Animator.fader)
			return this.target.opacity;
		else if (this.type === rat.ui.Animator.scroller)
			return this.target.contentOffset;
		else
			return null;
	};

	rat.ui.Animator.prototype.die = function (dt)
	{
		this.target = null;	// remove target so I die next update
	};

	rat.ui.Animator.prototype.getElapsed = function (dt)
	{
		return this.startTime - this.time;
	};
	
	//	Finish an animation
	rat.ui.Animator.prototype.finish = function () {
		if (this.time < 0) {
			//rat.console.log("WARNING! Attempting to finish endless animator");
			return;	
		}
		else
		{
			this.delay = 0;
			this.update(this.time + 0.0001);
		}
	};

	//	Reset the targets properties to what they were BEFORE this changed them
	rat.ui.Animator.prototype.resetTargetState = function () {
		//	Only reset the things i change
		var startState = this.targetStartState;
		switch (this.type) {
			case rat.ui.Animator.mover:
				this.target.setPos(startState.x, startState.y);
				break;
			case rat.ui.Animator.rotator:
				this.target.setRotation(startState.r);
				break;
			case rat.ui.Animator.scaler:
				this.target.setScale(startState.sx, startState.sy);
				break;
			case rat.ui.Animator.resizer:
				this.target.setSize(startState.w, startState.h);
				break;
			case rat.ui.Animator.fader:
				this.target.setOpacity(startState.opacity);
				break;
			case rat.ui.Animator.scroller:
				this.target.setContentOffset(startState.cx, startState.cy);
				break;
		}
	};
	
	var updatingAnimators = 0;
	rat.ui.updateAnimators = function (dt)
	{
		++updatingAnimators;
		for (var i = rat.ui.animators.length - 1; i >= 0; i--)
		{
			var kill = rat.ui.animators[i].update(dt);
			if (kill)
			{
				//rat.console.log("killed");
				rat.ui.animators.splice(i, 1);
			}
		}
		--updatingAnimators;
	};

	//	Reset Start state for all running animators on an element
	rat.ui.resetStateStateForAllAnimatorsForElement = function (element, animatorType) {
		//	todo refactor with function below
		for (var i = rat.ui.animators.length - 1; i >= 0; i--) {
			var anim = rat.ui.animators[i];
			if (!anim.target) {
				rat.console.log("JS FAILURE: animator is missing target! check that on construction all objects have a target!\n");
				rat.ui.animators.splice(i, 1);			// there is no target and thus should be no animator, purge it with fire!
				continue;
			}

			//	we check for equality by comparing objects here, instead of ID, since duplicate IDs might exist.
			//	If this is a problem, I recommend we have a new uniqueID property for each ui element, and compare that.  I think I've wanted that before for other things anyway...
			if (anim.target === element && (animatorType === void 0 || anim.type === animatorType)) {
				anim.resetTargetState();
			}
		}
	};

	//	Finish all running animators on an element
	rat.ui.finishAnimatorsForElement = function (element, animatorType, kill) {
		//	todo refactor with function below
		for (var i = rat.ui.animators.length - 1; i >= 0; i--) {
			var anim = rat.ui.animators[i];
			if (!anim.target) {
				rat.console.log("JS FAILURE: animator is missing target! check that on construction all objects have a target!\n");
				rat.ui.animators.splice(i, 1);			// there is no target and thus should be no animator, purge it with fire!
				continue;
			}

			//	we check for equality by comparing objects here, instead of ID, since duplicate IDs might exist.
			//	If this is a problem, I recommend we have a new uniqueID property for each ui element, and compare that.  I think I've wanted that before for other things anyway...
			if ( anim.target === element && (animatorType === void 0 || anim.type === animatorType) ) {
				anim.finish();

				if( kill && !updatingAnimators )
					rat.ui.animators.splice(i, 1);
			}
		}
	};

	//	kill any animators (with optional animator type check) attached to this element
	//	return number killed.
	rat.ui.killAnimatorsForElement = function (element, animatorType)
	{
		var killCount = 0;
		
		//	todo refactor with function below
		for (var i = rat.ui.animators.length - 1; i >= 0; i--)
		{
			var anim = rat.ui.animators[i];
			if (!anim.target)
			{
				// this really needs to be an assert
				rat.console.log("JS FAILURE: animator is missing target! check that on construction all objects have a target!\n");
				rat.ui.animators.splice(i, 1);			// there is no target and thus should be no animator, purge it with fire!
				continue;
			}

			//	we check for equality by comparing objects here, instead of ID, since duplicate IDs might exist.
			//	If this is a problem, I recommend we have a new uniqueID property for each ui element, and compare that.  I think I've wanted that before for other things anyway...
			if (
				anim.target === element &&
					(animatorType === void 0 || anim.type === animatorType)
			)
			{
				//rat.console.log("killed for " + element.id);
				rat.ui.animators.splice(i, 1);
				killCount++;
			}
		}
		
		return killCount;
	};
	
	//	get a list of animators for this element, possibly filtered to an ID
	rat.ui.getAnimatorsForElement = function (element, animatorType, id)
	{
		var list = [];
		for (var i = rat.ui.animators.length - 1; i >= 0; i--)
		{
			var anim = rat.ui.animators[i];
			if (anim.target === element
				&& (animatorType === void 0 || anim.type === animatorType)
				&& (id === void 0 || anim.id === id))
			{
				list.push(anim);
			}
		}
		return list;
	};

	//
	//	kill any registered animators
	//	(useful for cleanly getting rid of continuous ones...)
	rat.ui.killAnimators = function ()
	{
		//console.log("killing animators.  There are " + rat.ui.animators.length);
		rat.ui.animators = [];
	};

	//	lots to do...
	/*

	add to log.txt

	finish bubble box
	bubble bar support inside bubble box
	bubble button!
	various button details (highlights, etc.)

	ooh... cheats!  we should have a cheat dialog system somehow...
	frames for debugging
	more element subclasses
	sprite
	make them work
	sizes/centering for all
	shape graphic - work for circles, squares, paths

	add panes, UI, see notes on paper
	design better on paper - highlights - how do they work?  active, target, etc., like wraith?
	buttons, with frames, that highlight.
	bubble boxes
	buttons
	bubble buttons

	eventually, support tinting by drawing element to offscreen canvas with fancy canvas operations?
	It'll be slow, but for UI maybe it's OK.
	Won't work well for particles, because of speed concerns.  :(

	add more animator support, clean up and fix


	*/

	//
	//--------- utils
	//
} );