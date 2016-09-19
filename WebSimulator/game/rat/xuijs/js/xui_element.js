//
//	Classes representing the various xui elements
//
rat.modules.add( "rat.xuijs.js.xui_element",
[
	{name: "rat.xuijs.js.xui_api", processBefore: true },
	{name: "rat.utils.r_utils", processBefore: true },
	{name: "rat.ui.r_ui", processBefore: true },
	{name: "rat.ui.r_ui_textbox", processBefore: true },
	{name: "rat.graphics.r_graphics", processBefore: true },
	
	"rat.math.r_math",
	"rat.math.r_vector",
	"rat.graphics.r_graphics",
	"rat.utils.r_utils",
	"rat.debug.r_console",
	"rat.graphics.r_image",
	"rat.debug.r_profiler",
	"rat.audio.r_audio",
	"rat.graphics.r_video",
], 
function(rat)
{
	var xuijs = rat.xuijs;
	
	// For handling handles (heh, see what I did there?)
	var nextHandle = 0;
	var handleMap = {};
	
	// Get an element object by its handle.
	xuijs.getXuiElementByHandle = function(handle)
	{
		return handleMap[handle];
	};
	
	// Assign a handle to the given element, and track the element.
	var assignHandle = function(element)
	{
		element.mXuiHandle = nextHandle++;
		if (xuijs.LuaCAPI) {
			handleMap[element.mXuiHandle] = element;
		}
	};
	
	// Clears the handle for the given element
	var clearHandle = function(element)
	{
		// Delete isn't like C/C++ delete.  It just removes a property from an object. 
		if (xuijs.LuaCAPI) {
			delete handleMap[element.mXuiHandle];
		}
		element.mXuiHandle = null;
	};

	// Utility function for finding a child index 
	function findChildIndex(parent, child){
		var index = -1;
		if( parent.subElements ){
			for( var i = 0; i < parent.subElements.length; i++ ){
				if (parent.subElements[i] == child){
					index = i;
					break;
				}
			}
		}
		
		return index;
	}
	
	//	Utility function to convert db sound level to % sound levels
	xuijs.getSoundPercent = function (db) {
		// volume defaults to -12 with a range of -96 to +6   -- this is relative decibel levels
		// the form for decibel to volume conversion is vol = 2^(x/10) where x is the decibel change - negative for less volume positive for more
		var volPercent = rat.math.pow(2, db / 10);
		if (volPercent > 1)
			volPercent = 1;
		else if (volPercent < 0)
			volPercent = 0;
		return volPercent;
	};

	// Converts the given frame number into a time value.
	// This assumes Xui is defined using 60 FPS.
	xuijs.getTimeForFrame = function(frameNumber){
		var baseFPS = 60.0;
		return frameNumber / baseFPS;
	};
	
	
	//	Possible events XuiElements can fire
	xuijs.SubscribeEvents = {
		Destroy: 			"Destroy",			// Supported
		HtmlLinkActivated:	"HtmlLinkActivated",
		KeyDown: 			"KeyDown",
		KeyUp:				"KeyUp",
		KillFocus: 			"KillFocus",
		Press: 				"Press",
		Pressing: 			"Pressing",
		SelectionChanged: 	"SelectionChanged",
		SetFocus: 			"SetFocus",
		SlotKillFocus: 		"SlotKillFocus",
		SlotSetFocus: 		"SlotSetFocus",
		TimelineEnd: 		"TimelineEnd",		//	Supported
		Timer: 				"Timer",			//	Supported
		TransitionEnd: 		"TransitionEnd",		
		TransitionStart: 	"TransitionStart",
		VideoEnd: 			"VideoEnd"
	};

	var XuiElementAutoPlay = true;

	xuijs.XuiElementsDrawnThisFrame = {};
	xuijs.XuiElementsSkippedThisFrame = {};
	// Xui element types
	// XuiElement
	xuijs.XuiElement = function()
	{
		xuijs.XuiElement.prototype.parentConstructor.call(this); //	default init
		
		// Make sure we get a handle.
		assignHandle(this);
		
		this.mPivot = new rat.Vector(0, 0);
		
		this.mXuiOpacity = 1;
		
		this.mBlendMode = xuijs.XuiElement.BlendMode.DEFAULT;
		
		this.mBasePath = "";
		
		// Animation stuff.
		if (XuiElementAutoPlay)
		{
			this.mPlayingAnimRange = true;
			this.mAnimPaused = false;
			this.mAnimEndTime = -1;
		}
		else
		{
			this.mPlayingAnimRange = false;
			this.mAnimPaused = true;
			this.mAnimEndTime = 0;
		}
		this.mAnimStartTime = 0;
		
		
		this.mCurrAnimTime = 0;
		this.mLastAnimationKeyTime = 0;
		this.mKeyFrameAnimators = [];
		this.mNamedFrames = [];
		this.mNamedFrames.byName = {};
		this.mDisableTimelineRecursion = false;
		this.mColorFactor = new rat.graphics.Color( rat.graphics.white );
		
		this.mEventSubscribers = {};	//	JS-side event subscribers, to implement event firing without Lua
		this.mLastSubscriptionID = 0;
		
		//	Timers
		this.mTimers = null;//{};// KEY is the ID
		
		//	Custom Vars (Set by xui)
		this.customVars = {};
	};
	rat.utils.inheritClassFrom(xuijs.XuiElement, rat.ui.Element);
	xuijs.XuiElement.prototype.elementType = 'xuiElement';
	xuijs.XuiElement.prototype.isXuiElement = true;
	xuijs.XuiElement.prototype.xuiElemType = "XuiElement";
	
	xuijs.XuiElement.prototype.setColor = function(c)
	{
		if (this.color.equal(c))
			return;
		xuijs.XuiElement.prototype.parentPrototype.setColor.call(this, c);
		this.setDirty(true);
	};
	
	//	Push the LUA object for this element onto the stack
	xuijs.XuiElement.prototype.pushLUAObject = function(L)
	{
		var C = xuijs.LuaCAPI;
		L = L || xuijs.LuaState;

		C.lua_getglobal( L, "WXuiElement" );
		if (C.lua_isnil( L, -1 ) == 1)
		{
			rat.console.log( "Unable to find global WXuiElement" );
			C.lua_pop(L, 1);
			C.lua_pushnil( L );
			return false;
		}
		C.lua_getfield( L, -1, "mHandleMap" );
		if (C.lua_isnil( L, -1 ) == 1)
		{
			rat.console.log( "Unable to find global WXuiElement.mHandleMap" );
			C.lua_pop(L, 2);
			C.lua_pushnil( L );
			return false;
		}
		
		C.lua_pushnumber( L, this.GetHandle() );
		C.lua_gettable( L, -2 );
		if (C.lua_isnil( L, -1 ) == 1)
		{
			rat.console.log( "Unable to find global WXuiElement.mHandleMap." + this.GetHandle() );
			C.lua_pop(L, 3);
			C.lua_pushnil( L );
			return false;
		}
		
		//	remove the global object from the stack
		C.lua_remove( L, -2 ); // mHandleMap
		C.lua_remove( L, -2 ); // WXuiElement
		//	Leave the value
		return true;
	};

	//	Called when we destroy this object
	xuijs.XuiElement.prototype.destroy = function()
	{
		//	Destroy my children first
		while( this.subElements && this.subElements.length )
		{
			var last = this.subElements[this.subElements.length-1];
			last.Unlink();
			last.DestroyObject();
		}
	
		this.fireEvent( xuijs.SubscribeEvents.Destroy, this.GetHandle() );
		
		//	if no LUA, that's fine.
		if (!xuijs.LuaCAPI)
		{
			clearHandle(this);
			return;
		}
		//	or if our handle isn't exposed to lua...
		if (!this.createdFromLua)
		{
			clearHandle(this);
			return;
		}
		
		var C = xuijs.LuaCAPI;
		var L = xuijs.LuaState;
	
		this.pushLUAObject(L);
		
		//rat.console.log( "Calling ForgetSelf on " + this.GetHandle() + "..." );
		xuijs.callLUAFuncOn( -1, "ForgetSelf", [], {includeSelf:true} );
		C.lua_pop(L, 1);
		//rat.console.log( "..Done" );
		clearHandle(this);
	};
	
	//	subscribe to events (used in non-lua implementation)
	xuijs.XuiElement.prototype.Subscribe = function( eventType, callback )
	{
		if (!this.mEventSubscribers[eventType])
		{
			this.mEventSubscribers[eventType] = {};
		}
		var subscription = ++this.mLastSubscriptionID;
		this.mEventSubscribers[eventType][subscription] = callback;
		return subscription;
	};
	
	//	unsubscribe to events (used in non-lua implementation)
	xuijs.XuiElement.prototype.Unsubscribe = function( subscription )
	{
		for (var eType in this.mEventSubscribers)
		{
			if (this.mEventSubscribers[eType][subscription])
			{
				delete this.mEventSubscribers[eType][subscription];	//	remove from object
			}
		}
	};
	
	//	Called to fire an event
	//	number of arguments depends on the event.
	xuijs.XuiElement.prototype.fireEvent = function( eventType, varArgs )
	{
		//	any non-lua subscribers?
		if (this.mEventSubscribers && this.mEventSubscribers[eventType])
		{
			for (var sub in this.mEventSubscribers[eventType])
			{
				//	grab the arguments other than eventType
				var args = Array.prototype.slice.call(arguments, 1);
				args.unshift(this);
				//	So, we end up passing in this element as first argument, and then the rest of the arguments except the eventType,
				//	which is what seems to be expected, right?
				this.mEventSubscribers[eventType][sub].apply(null, args);
			}
		}

		//	if no LUA, that's fine.  If nobody above was subscribed, then we're done.
		if (!xuijs.LuaCAPI)
			return;
		//	or if our handle isn't exposed to lua...
		if (!this.createdFromLua)
			return;
		
		var C = xuijs.LuaCAPI;
		var L = xuijs.LuaState;
	
		this.pushLUAObject(L);
		
		// rat.console.log( "Firing event " + eventType + " For " + this.GetHandle() );
		var args = Array.prototype.slice.call( arguments );
		xuijs.callLUAFuncOn( -1, "_FireEvent", args, {includeSelf:true} );
		C.lua_pop(L, 1);
	};

	xuijs.XuiElement.BlendMode = {
		DEFAULT: 0, // How is this differnt than normal? I think default mean inherit from parent.
		NORMAL: 1,
		MULTIPLY: 2,
		DARKEN: 3, // What does this do exactly?
		LIGHTEN: 4, // What does this do exactly? Maybe like screen? 
		ADD: 5,
		SUBTRACT: 6,
		ALPHA_MASK: 7, // What does this do exactly?
		LAYER: 8, // What does this do exactly?
		OVERRIDE: 9, // What does this do exactly?
	};
	
	// Override the applyTransformation function to handle center/pivoting stuff.
	xuijs.XuiElement.prototype.applyTransformation = function(ctx)
	{
		rat.graphics.translate(this.place.pos.x, this.place.pos.y, ctx);
		
		rat.graphics.translate(this.mPivot.x, this.mPivot.y, ctx);
		
		if (this.place.rot.angle)
			rat.graphics.rotate(this.place.rot.angle, ctx);
		if (this.scale.x !== 1 || this.scale.y !== 1)
			rat.graphics.scale(this.scale.x, this.scale.y, ctx);
		
		rat.graphics.translate(-this.mPivot.x, -this.mPivot.y, ctx);
	};

	// Override updateSelf so we can do animation stuff.
	xuijs.XuiElement.prototype.updateSelf = function(deltaTime)
	{
		var neededUpdate = false;
		
		// TODO: I think there are still some minor issues with animation handling 
		// (i.e. auto-playing in a child group while calling PlayTimeline() on the parent,
		// with the recurse option false, and just occasional glitches)
		// but for the most part it seems to work pretty well.
		
		//	Note:  If we don't have keyframes at all, do none of this,
		//	because without keyframes, no properties can change, even if we have named frames.
		
		if (this.mKeyFrameAnimators && this.mKeyFrameAnimators.length && !this.mAnimPaused)
		{
			neededUpdate = true;
			
			rat.profiler.pushPerfMark( "XuiElement Anim" );
			
			this.updateAnimations(deltaTime);
			
			rat.profiler.popPerfMark( "XuiElement Anim" );
		}
		
		//	Update any timers that we have
		if (this.mTimers)
		{
			var timer;
			var fireTimersFor;
			for (var id in this.mTimers)
			{
				neededUpdate = true;
			
				timer = this.mTimers[id];
				if (timer)
				{
					timer.timer += deltaTime;
					if( timer.timer >= timer.fireEvery)
					{
						if (!fireTimersFor)
							fireTimersFor = [];
						timer.timer = 0;
						fireTimersFor.push(id);
					}
				}
			}
			if (fireTimersFor)
			{
				for( var index = 0; index !== fireTimersFor.length; ++index )
				{
					//rat.console.log( "Firing timer " + fireTimersFor[index] );
					this.fireEvent( xuijs.SubscribeEvents.Timer, fireTimersFor[index] );
				}
			}
		}
		
		//	if we didn't update anything, assume we're done updating forever until told otherwise (e.g. a new animation is played)
		if (!neededUpdate)
		{
			//this.needsUpdate = false;
			if (this.id === "character1")
			{
				//console.log("c1 did not need update");
			}
		}
		return neededUpdate;
	};
	
	//	update just named and keyframe animations - called from above.
	//	broke this into another function so our recursion would be more correct...
	xuijs.XuiElement.prototype.updateAnimations = function(deltaTime)
	{
		// If we're playing an anim range, then we have to check if we're done.
		// But named-frame actions take precedent, I think.
		if (this.mPlayingAnimRange && !this.mAnimPaused){
			
			// If we're playing an anim range, we need to handle time updates differently.
			var incrementCurrAnimTime = true;
			
			// Check if there's a named frame between the current time (before incrementing), and mAnimEndTime.
			// Derek: I'm telling getFirstNamedFrameBetween to exclude play named frames because those don't do anything
			//		  here, but we need to check if we pass over any other kind of named frame even if there is a play
			//		  named frame in between. Skipping the play named frames fixes a bug where a play named frame and a
			//		  different frame are adjacent, but the delta time is greater than 1/60 sec.
			var namedFrame = this.getFirstNamedFrameBetween(this.mCurrAnimTime, this.mAnimEndTime, xuijs.NamedFrame.CommandType.PLAY);
			if( namedFrame ){
				// Set mAnimEndTime to the time from the named frame
				// (if it's not just a "play" action), because we'll never get past that frame anyway.
				if( namedFrame.command != xuijs.NamedFrame.CommandType.PLAY ){
					this.mAnimEndTime = namedFrame.time;
				}
				
				// Now check if we will be going past the named frame, and if so, handle its command.
				if( this.mCurrAnimTime + deltaTime >= namedFrame.time ){
					if( namedFrame.command == xuijs.NamedFrame.CommandType.GOTO || 
						namedFrame.command == xuijs.NamedFrame.CommandType.GOTO_AND_PLAY ||
						namedFrame.command == xuijs.NamedFrame.CommandType.GOTO_AND_STOP )
					{
						// Jumping somewhere new.
						// Figure out new start/end times.
						var gotoTime = this.getTimeForNamedFrame(namedFrame.commandTarget);
						if( gotoTime !== null ){
							var newEndTime = this.mLastAnimationKeyTime;
							if( namedFrame.command == xuijs.NamedFrame.CommandType.GOTO_AND_STOP ){
								newEndTime = gotoTime;
							}
						}
						
						// We won't need to increment mCurrAnimTime.
						if( namedFrame.command == xuijs.NamedFrame.CommandType.GOTO_AND_STOP )
							incrementCurrAnimTime = false;
						else
						{
							//	When we keep playing, we need to wrap the times correctly.
							//	And because we have (or will) set out time to the new frame, we need to know
							//	how much we stepped over the named frame the told us to go somewhere
							deltaTime = (this.mCurrAnimTime + deltaTime) - namedFrame.time;
						}
						// Call playAnimRange() to set everything up.
						this.playAnimRange(gotoTime, newEndTime);
						
						if( (namedFrame.command == xuijs.NamedFrame.CommandType.GOTO || 
							namedFrame.command == xuijs.NamedFrame.CommandType.GOTO_AND_PLAY) &&
							this.mKeyFrameAnimators &&
							this.mKeyFrameAnimators.length !== 0 ) {
							// Derek: The play head moved and still playing. Find the next named frame so that we don't skip over it.
							//		  I'm going to use tail recursion as a quick fix to start this check from the begining. It may be
							//		  more optimal to use a loop instead.
							//		  Also, I'm checking if there are even animators on this object because if it doesn't, then
							//		  playAnimRange didn't reset the mCurrAnimTime.
							return this.updateAnimations(deltaTime);
						}
					}
					else if( namedFrame.command == xuijs.NamedFrame.CommandType.STOP ){
						// I think this should have already happened above.
						this.mAnimEndTime = namedFrame.time;
					}
				}
			}
			
			// Update our anim time.
			if( incrementCurrAnimTime ){
				this.mCurrAnimTime += deltaTime;
			} else {
				deltaTime = 0;
			}
			
			// Let's assume that by this point mAnimEndTime has been adjusted if needed.
			if( this.mAnimEndTime >= 0 && this.mCurrAnimTime >= this.mAnimEndTime ){
				// We're past our end frame, so stop everything from updating, then make sure we're on the end time.
				this.mCurrAnimTime = this.mAnimEndTime;
				this.mAnimPaused = true;
				deltaTime = 0; // We clear this so the block ~15 line later will not update the keyframeAnimators 
								// and cause the times in the element and the animator to be out of sync.
				// Do a last "fake" update to make sure we're at the end time.
				for( var i = 0; i < this.mKeyFrameAnimators.length; i++ ){
					this.mKeyFrameAnimators[i].setTime(this.mCurrAnimTime);
					this.mKeyFrameAnimators[i].update(0);
				}
				
				//console.log("firing timeline end for " + this.GetHandle());
				this.fireEvent( xuijs.SubscribeEvents.TimelineEnd, this.GetHandle() );
				//console.log(" .. done with timeline end");
			}
			
			//rat.profiler.popPerfMark( "XuiElement Anim" );
		}
		
		if (this.mKeyFrameAnimators && this.mKeyFrameAnimators.length && !this.mAnimPaused) {
			// If we're not playing an anim range, just update animators normally.
			// Update the animators.
			for( var i = 0; i < this.mKeyFrameAnimators.length; i++ ){
				this.mKeyFrameAnimators[i].update(deltaTime);
			}
		}
	};
	
	//	optimization to check if something is out of view (not on screen) and hide it
	//
	//	NOTES:
	//
	//		let's do this only on objects where our pivot is upper left, which is common in dive,
	//			and easier on my brain.
	//
	//		This is working OK in the dive case, but it depends on parents NOT being rotated,
	//			which they aren't in dive, but might be in other games.
	//			John's approach is theoretically better (use rat.graphics transform tracking)
	//			but I didn't want to debug that.  I figured I'd try this and see how it did.
	//
	//		This is working - sometimes I'm cutting out 120 or so images!
	//		But it's a lot of math every frame.
	//
	//		Maybe let each game flag them, or unflag them as needing to hide, in case there are problems?
	//		Do this elsewhere, e.g. preDraw like John was doing?
	//		Do it for non-image types?
	//		A tiny bit of buffer around the space we check, and then check only every Nth frame?
	//		If they're off the left in dive, mark as never check again?  Problematic, e.g. with
	//			scrolling background which wraps...
	xuijs.XuiElement.prototype.checkOutOfView = function()
	{
		if (this.mPivot.x < 1 && this.mPivot.y < 1)
		{
			//rat.profiler.pushPerfMark( "XUI-checkOutOfView" );
			
			var bounds = this.getGlobalBounds();
			
			//	then see if our extents are fully inside screen space
			if (bounds.xmin > rat.graphics.SCREEN_WIDTH || bounds.xmax < 0
				|| bounds.ymin > rat.graphics.SCREEN_HEIGHT || bounds.ymax < 0)
			{
				/* some debug framing stuff
				if (!this.__isHidden)
				{
					//	mark so we can see it should be hidden
					this.setFrame(2, rat.graphics.red);
				}
				this.__isHidden = true;
				*/
				
				//	count it
				xuijs.XuiElementsSkippedThisFrame[this.xuiElemType] = xuijs.XuiElementsSkippedThisFrame[this.xuiElemType] || 0;
				rat.xuijs.XuiElementsSkippedThisFrame[this.xuiElemType]++;
				return true;
			}
			/*	debug framing
			else
			{
				if (!this.__isHidden)	//	mark so we know it was hidden before
					this.setFrame(2, rat.graphics.white);
				this.__isHidden = false;
			}
			*/
			
			//rat.profiler.popPerfMark( "XUI-checkOutOfView" );
		}
		return false;
	}
	
	// Derek: Gets the global bounds for the element.
	xuijs.XuiElement.prototype.getGlobalBounds = function()
	{
		bounds = {xmin:0, ymin:0, xmax:0, ymax:0 };
		var width = this.size.x;
		var height = this.size.y;

		var pane = this;
		do
		{
			//  move the pivot to the origin so we can scale about it.
			bounds.xmin -= pane.mPivot.x;
			bounds.ymin -= pane.mPivot.y;
			
			//	factor in my scale
			bounds.xmin *= pane.scale.x;
			bounds.ymin *= pane.scale.y;
			width *= pane.scale.x;
			height *= pane.scale.y;
			
			// TODO: Rotate
			
			// return the pivot to where it was
			bounds.xmin += pane.mPivot.x;
			bounds.ymin += pane.mPivot.y;

			//	move to parent space
			bounds.xmin += pane.place.pos.x;
			bounds.ymin += pane.place.pos.y;

			pane = pane.parent;
		} while (pane && pane.mPivot); // Go until we've hit the XUI root.
		
		if(width > 0) {
			bounds.xmax = bounds.xmin + width;
		}
		else {
			bounds.xmax = bounds.xmin;
			bounds.xmin = bounds.xmax + width;
		}
		if(height > 0) {
			bounds.ymax = bounds.ymin + height;
		}
		else {
			bounds.ymax = bounds.ymin;
			bounds.ymin = bounds.ymax + height;
		}
		
		//return new rat.Vector(x, y);
		return bounds;
	}
	
	//	We need to update some of our graphical rendering properties BEFORE rat would normally call
	//	drawSelfPre.   An example of this would be bounds, opactiy, clipping, ect...
	//	IF this code was in drawSelfPre, then things like opacity have already been applied so changing them
	//	here (via setOpacity) would not work
	var abortDrawRes = {abortDraw:true};
	xuijs.XuiElement.prototype.preDraw = function(toOffscreen)
	{
		if (toOffscreen)
		{
			//	If I myself am being drawn to offscreen, then draw normally, without fade,
			//	since that will be handled later when my offscreen is rendered.
			//	(otherwise, we'll end up rendering twice as faded, which is wrong)
			//	Also, make sure my effectiveOpacity is correct for when my children are drawn,
			//		for the same reason.  Our eventual semi-transparent render from offscreen
			//		will result in the multiplied transparency we want for our children.
			this.effectiveOpacity = 1;
			//	also deal with blend mode?
			
			this.setOpacity(this.effectiveOpacity);
			
			return;
		}
		
		//	Don't try to draw objects that are not visible or don't draw
		if (this.doesNotDraw || this.mXuiOpacity <= 0 || this.mColorFactor.a <= 0)
			return abortDrawRes;
		
		if (this.hideOutOfView && this.checkOutOfView())
			return abortDrawRes;
				
		//rat.profiler.pushPerfMark( "XUI-PreDraw" );
		if (xuijs.XuiElement.prototype.parentPrototype.preDraw)
			xuijs.XuiElement.prototype.parentPrototype.preDraw.call(this, toOffscreen);
		
		var parent = this.parent;
		this.effectiveOpacity = this.mXuiOpacity;
		this.effectiveBlendMode = this.mBlendMode;
		// Parent should have already calculated effectiveOpacity/effectiveBlendMode, so grab it from there.
		if( parent && parent.isXuiElement ){
			if( typeof parent.effectiveOpacity == "number" ){
				this.effectiveOpacity *= parent.effectiveOpacity;
			}
			if( this.effectiveBlendMode == xuijs.XuiElement.BlendMode.DEFAULT &&
				typeof parent.effectiveBlendMode == "number" )
			{
				this.effectiveBlendMode = parent.effectiveBlendMode;
			}
		}
		
		//	Call rat.ui.Elements (which i inherit from) setOpacity
		this.setOpacity(this.effectiveOpacity);
		//rat.profiler.popPerfMark( "XUI-PreDraw" );
	};
	
	// Override drawSelfPre() so that we can update things like blendmode
	//	NOTE: blendmode cannot be in predraw because it would not get property reverted with the ctx.restore
	//	as ctx.save has not been called when we enter preDraw
	xuijs.XuiElement.prototype.drawSelfPre = function(deltaTime)
	{
		xuijs.XuiElementsDrawnThisFrame[this.xuiElemType] = xuijs.XuiElementsDrawnThisFrame[this.xuiElemType] || 0;
		xuijs.XuiElementsDrawnThisFrame[this.xuiElemType]++;
		
		//rat.profiler.pushPerfMark( "XUI-DrawSelfPre" );
		
		// TODO: Do we need to do a context save here?
		// I think it's covered by rat.ui.Element's draw functions.
		
		if( this.effectiveBlendMode != xuijs.XuiElement.BlendMode.DEFAULT ){
			
			// Canvas doesn't support many blending operations.  Mostly just "ligher", which is sort of like additive.
			// Some browsers support additional modes, like multiply, screen, dodge, etc., but it's not in the standard (yet - Adobe is pushing it).
			if( this.effectiveBlendMode == xuijs.XuiElement.BlendMode.ADD ){
				rat.graphics.ctx.globalCompositeOperation = "lighter";
			}
			else{
				rat.console.logOnce("Unsupported blend-mode: " + this.effectiveBlendMode + "!", 'unSupBlendMode', 3);
			}
		}
		//rat.profiler.popPerfMark( "XUI-DrawSelfPre" );
	};

	// Override drawSelfPost() so that we can do any necessary cleanup from drawSelfPre().
	//xuijs.XuiElement.prototype.drawSelfPost = function(deltaTime)
	//{
	//	// TODO: Do we need a context restore here?
	//	// I think it's covered by rat.ui.Element's draw functions.
	//};
	
	// Utility methods
	xuijs.XuiElement.prototype.GetHandle = function()
	{
		return this.mXuiHandle;
	};
	
	xuijs.XuiElement.prototype.setBlendMode = function(blendMode){
		this.mBlendMode = blendMode;
	}

	// Set the base path for this element.
	// Other paths, (i.e. for images, etc.) can be found relative to this path.
	xuijs.XuiElement.prototype.setBasePath = function(basePath)
	{
		basePath = basePath.replace(/\\/g, "/");
		this.mBasePath = basePath;
	};
	
	// Resolves a relative path into a full path, based on previously set base path.
	xuijs.XuiElement.prototype.resolvePath = function(relativePath)
	{
		return xuijs.parser.resolvePath(this.mBasePath, relativePath);
	};
	
	// Adds a named frame to this element.
	// namedFrame should be a xuijs.NamedFrame object.
	// NOTE: This assumes that named frames are added in time-order.
	xuijs.XuiElement.prototype.addNamedFrame = function(namedFrame)
	{
		this.mNamedFrames.push(namedFrame);
		this.mNamedFrames.byName[namedFrame.name] = namedFrame;
	};
	
	//	Return if a given named frame exists
	xuijs.XuiElement.prototype.HasNamedFrame = function( name )
	{
		return this.mNamedFrames.byName[name];
	};
	
	// Finds the named frame with the given name, and returns its time value.
	// Returns null if one can't be found.
	xuijs.XuiElement.prototype.getTimeForNamedFrame = function(name)
	{
		//	IF this name starts with xbox_, check first for a rat_
		var ratName = "rat_" + name;
		if (this.HasNamedFrame(ratName))
			return this.mNamedFrames.byName[ratName].time;
		if (this.HasNamedFrame(name))
			return this.mNamedFrames.byName[name].time;
		return null;
	}
	
	// Return the first named frame object between startTime and endTime.
	// Returns null if none are found.
	xuijs.XuiElement.prototype.getFirstNamedFrameBetween = function(startTime, endTime, excludeCommand)
	{
		if (endTime === void 0)
			endTime = -1;
			
		// TODO: This could get slow when having to do it every frame.
		// Optimize it somehow - binary search, check against ones found previous frame first, etc.
		
		// Just march through the array and find one for now.
		//	If endTime is -1, then we need the next key frame
		for (var i = 0; i < this.mNamedFrames.length; i++)
		{
			if (this.mNamedFrames[i].command !== excludeCommand && this.mNamedFrames[i].time >= startTime)
			{
				if (endTime === -1 || this.mNamedFrames[i].time <= endTime )
					return this.mNamedFrames[i];
			}
		}
		return null;
	};
	
	// Sets up an animation play time range.
	// Used internally by PlayTimeline().
	xuijs.XuiElement.prototype.playAnimRange = function(startTime, endTime){
		//Don't do anything if we don't have animators, or we might mess something up.
		if( !this.mKeyFrameAnimators || this.mKeyFrameAnimators.length == 0 ){
			return;
		}
		
		this.setNeedsUpdate(true);
		
		// Set start and end time values, to be used during update function.
		this.mAnimStartTime = startTime;
		if (endTime !== void 0)
			this.mAnimEndTime = endTime;
		else
			this.mAnimEndTime = -1;

		// Set the current animation time, and mark as playing an anim range.
		this.mCurrAnimTime = startTime;
		this.mPlayingAnimRange = true;
		this.mAnimPaused = false;
		
		// Set times on the animators
		for( var i = 0; i < this.mKeyFrameAnimators.length; i++ ){
			this.mKeyFrameAnimators[i].setTime(this.mAnimStartTime);
			// When we play a specific range, the looping on the animators needs to stop.
			this.mKeyFrameAnimators[i].setLooping(false);
		}
		
	}

	// Utility function to recursively call a function on an element and all its children/grandchildren/etc.
	xuijs.XuiElement.prototype.playAnimRangeRecursive = function(startTime, endTime)
	{
		// Could potentially use GetFirstChild(), GetNext(), etc. but it would probably be slow.
		
		// Do the call
		this.playAnimRange(startTime, endTime);
		
		// Recurse
		// Make sure to handle "DisableTimelineRecursion" setting.
		if( !this.mDisableTimelineRecursion && this.subElements ){
			for( var i = 0; i < this.subElements.length; i++ ){
				var child = this.subElements[i];
				if( child && child.isXuiElement ){
					child.playAnimRangeRecursive(startTime, endTime);
				}
			}
		}
	};
	
	xuijs.XuiElement.prototype.disableTimelineRecursion = function(disable)
	{
		this.mDisableTimelineRecursion = disable;
	}
	
	// Adds a keyframe animator to be updated with this element.
	xuijs.XuiElement.prototype.addKeyFrameAnimator = function(keyFrameAnimator)
	{
		// Track last keyframe time among all animators.
		var animatorLastKeyTime = keyFrameAnimator.getLastKeyTime();
		if( animatorLastKeyTime > this.mLastAnimationKeyTime ){
			this.mLastAnimationKeyTime = animatorLastKeyTime;
		}
		
		this.mKeyFrameAnimators.push(keyFrameAnimator);
	};
	
	// Function to be used when applying key frame animation values 
	xuijs.keyFrameAnimatorApplyFunc = function(owner, propertyNames, values, valueType)
	{
		for( var i = 0; i < propertyNames.length; i++ ){
			var propName = propertyNames[i];
			var value = values[i];
			
			// TODO: Add support for other property types.
			
			switch (propName) {
			case "Width":
				owner.SetWidth(value);
				break;
			case "Height":
				owner.SetHeight(value);
				break;
			case "Position":
				owner.SetPosition(value[0], value[1]);
				break;
			case "Scale":
				owner.SetScale(value[0], value[1]);
				break;
			case "Rotation":
			case "ShortestRotation":
				owner.setRotation(value);
				break;
			case "Opacity":
				owner.SetOpacity(value);
				break;
			case "Pivot":
				owner.SetPivot(value[0], value[1]);
				break;
			case "Show":
				owner.SetShow(value);
				break;
			case "ImagePath":
				//	STT explanation:
				//	sometimes in rat.KeyFrameAnimator.prototype.getValues
				//	we end up interpolating to a frame
				//	that has an undefined image value.
				//	It's not really rat.KeyFrameAnimator's fault - it's the data's fault!
				//	I think the correct solution is to do something about it somewhere else?
				//	I'm not sure where.  But we should do whatever the real XUI hosting system does?
				//	And in any case, this is a really clean easy fix for now.
				if (!value)
					break;
				owner.SetImagePath(value);
				break;
			case "Text":
				owner.SetText(value);
				break;
			case "State":
				owner.SetState(value);
				break;
			case "DisableTimelineRecursion":
				owner.disableTimelineRecursion(value);
				break;
			case "Fill.FillType":
				owner.mFillType = value;
				break;
			case "Fill.Translation":
				owner.mFillTranslation.x = value[0];
				owner.mFillTranslation.y = value[1];
				break;
			case "Fill.FillColor":
				owner.mFillColor.r = value[0];
				owner.mFillColor.g = value[1];
				owner.mFillColor.b = value[2];
				owner.mFillColor.a = value[3];
				// NOTE: This may result in a color that has decimal points...  We don't fix it here because
				//	we need to take into account the color factor which may also generate deciaml points..
				//	So that is where we fix the problem
				break;
			case "ColorFactor":
				owner.mColorFactor.r = value[0];
				owner.mColorFactor.g = value[1];
				owner.mColorFactor.b = value[2];
				owner.mColorFactor.a = value[3];
				//	See comment for case "Fill.FillColor":
				break;
			case "TextColor":
				owner.setColor( new rat.graphics.Color( value[0], value[1], value[2], value[3]) );
				
				//	See comment for case "Fill.FillColor":
				break;
			default:
				rat.console.log("xuijs.keyFrameAnimatorApplyFunc - Unsupported xui property '" + propName + "'!");
			}
		}
	};
		
	
	// Xui Interface methods
	
	xuijs.XuiElement.prototype.Unlink = function()
	{
		// Remove element from its parent
		var parent = this.GetParent();
		if( !parent ){
			return;
		}

		// removeFromParent() has issues with children with the same ID,
		// which we apparently have in some cases.
		//this.removeFromParent();
		if( parent.subElements ){
			for( var i = 0; i < parent.subElements.length; i++){
				if( parent.subElements[i].mXuiHandle === this.mXuiHandle ){
					parent.subElements.splice(i, 1);
					break;
				}
			}
		}
		
		// Remove reference to child on parent with id as key
		if( parent ){
			var id = this.GetId();
			if( id ){
				// Delete isn't like C/C++ delete.  It just removes a property from an object. 
				delete parent[id];
			}
		}

		// Clear out parent reference on element
		this.parent = null;
	};
	
	//	Setup a new timer.
	xuijs.XuiElement.prototype.SetTimer = function( id, elapsed )
	{
		//rat.console.log( "SetTimer called with " + id + ":" + elapsed );
		elapsed = elapsed/1000;	// Convert to seconds..
		
		// Find a timer with the provided ID, or create one
		if (!this.mTimers)
			this.mTimers = {};
		if (!this.mTimers[id])
			this.mTimers[id] = { id: id, fireEvery: elapsed/1000, timer: 0 };
		else
			this.mTimers[id].fireEvery=elapsed;
	};
	
	//	Remove a timer.
	xuijs.XuiElement.prototype.Kill = function( id )
	{
		if (this.mTimers)
			this.mTimers[id] = void 0;
	};

	xuijs.XuiElement.prototype.DestroyObject = function()
	{
		// Remove reference from handle map
		// With all references to it gone, an element should get garbage collected.
		// TODO: Should probably test that this works, somehow.
		//rat.console.log( "JS Destroy object (" + this.GetId() + ")..." );
		this.destroy();
		//rat.console.log( "..Done (JS Destroy object)" );
	};
	
	xuijs.XuiElement.prototype.GetId = function()
	{
		return this.id;
	};
	
	xuijs.XuiElement.prototype.AddChild = function(child)
	{
		// Add sub element.
		this.appendSubElement(child);
		
		// Add reference to child onto parent with id as key
		var childID = child.GetId();
		if( childID ){
			//	If the child's ID happens to match an existing property we have, we're about to overwrite that!
			//	That's bad, especially if it's some intrinsic property like "name", either in a xuiElement or in rat ui elements!
			//	This happened once in slush, for instance, with ui elements called "name".
			//	What's worse is the parsing code (before this point?) will fail as well in weird ways...
			//	see "Find element" comment in xui_parser.js (around line 1014)
			if (this[childID])
			{
				//	OK, but weirdly, we overwrite XuiCanvas normally?  Why?
				if (childID !== "XuiCanvas")
					rat.console.logOnce("!!!!!!!!!!!!!! WARNING!  Overwriting property " + childID + " on xuiElement " + this.name, 'propertyOverwrite'+childID);
			}
			this[childID] = child;
		}
	};
	
	xuijs.XuiElement.prototype.InsertChild = function(child, previousChild, nextChild)
	{
		var insertBeforeIndex = -1;
		
		if( typeof previousChild === 'undefined' || previousChild === null ){
			// insert at beginning
			insertBeforeIndex = 0;
		}
		else if( typeof nextChild === 'undefined' || nextChild === null ){
			// insert at end
			insertBeforeIndex = this.subElements.length;
		}
		else{
			// Find previousChild in list
			var index = findChildIndex(this, previousChild);
			if( index >= 0 && index + 1 < this.subElements.length ){
				insertBeforeIndex = index + 1;
			}
			
			if( insertBeforeIndex == -1 ){
				// Not sure what the behavior should be here.  Not insert the child?  Let's just append.
				insertBeforeIndex = this.subElements.length;
			}
		}
		
		this.insertSubElement(child, insertBeforeIndex);

		// Add reference to child onto parent with id as key
		var childID = child.GetId();
		if( childID ){
			this[childID] = child;
		}
	};
	
	xuijs.XuiElement.prototype.GetFirstChild = function()
	{
		if( !this.subElements ){
			return null;
		}
		return this.subElements[0];
	};
	
	xuijs.XuiElement.prototype.GetLastChild = function()
	{
		if( !this.subElements ){
			return null;
		}
		return this.subElements[this.subElements.length - 1];
	};
	
	xuijs.XuiElement.prototype.GetNext = function()
	{
		var parent = this.parent;
		if( !parent ){
			return null;
		}
		// Find this element's index in the parent's list of children
		var index = findChildIndex(parent, this);
		if( index < 0 || index + 1 >= parent.subElements.length ){
			return null;
		}
		
		// Return the next item
		return parent.subElements[index + 1];
	};
	
	xuijs.XuiElement.prototype.GetPrevious = function()
	{
		var parent = this.parent;
		if( !parent ){
			return null;
		}
		// Find this element's index in the parent's list of children
		var index = findChildIndex(parent, this);
		if( index < 0 || index - 1 < 0 ){
			return null;
		}
		
		// Return the previous item
		return parent.subElements[index - 1];
	};
	
	xuijs.XuiElement.prototype.GetParent = function()
	{
		return this.parent;
	}

	xuijs.XuiElement.prototype.SetPivot = function(x, y, z)
	{
		this.mPivot.x = x;
		this.mPivot.y = y;
	};

	xuijs.XuiElement.prototype.GetPivot = function()
	{
		var pivot = [this.mPivot.x, this.mPivot.y, 0];
		return pivot;
	};
	
	xuijs.XuiElement.prototype.SetPosition = function(x, y, z)
	{
		// Do we need to adjust for pivot?
		this.setPos(x, y);
	};

	xuijs.XuiElement.prototype.GetPosition = function()
	{
		// Do we need to adjust for pivot?
		var pos = this.getPos();
		return [pos.x, pos.y, 0];
	};
	
	// NOTE: Rotation values here are specified in degrees.
	xuijs.XuiElement.prototype.SetRotation = function(x, y, z)
	{
		// Xui supports "3D" rotations, but rat doesn't, and they're not really used that much.
		// We assume x and y are 0, and normal 2D rotation value is in Z.
		if( x || y )
			rat.console.log("Unsupported rotation value!  Only Z-axis rotation is supported!");
		
		this.setRotation(z * rat.math.PI / 180.0);
	}

	xuijs.XuiElement.prototype.SetScale = function(x, y, z)
	{
		this.setScale(x, y);
	};

	xuijs.XuiElement.prototype.GetScale = function()
	{
		var scale = this.getScale();
		return [scale.x, scale.y, 1];
	};

	xuijs.XuiElement.prototype.SetWidth = xuijs.XuiElement.prototype.setWidth;
	xuijs.XuiElement.prototype.GetWidth = xuijs.XuiElement.prototype.getWidth;
	xuijs.XuiElement.prototype.SetHeight = xuijs.XuiElement.prototype.setHeight;
	xuijs.XuiElement.prototype.GetHeight = xuijs.XuiElement.prototype.getHeight;
	
	xuijs.XuiElement.prototype.SetShow = xuijs.XuiElement.prototype.setVisible;
	xuijs.XuiElement.prototype.IsShown = xuijs.XuiElement.prototype.isVisible;

	// Opacity is a little tricky because in Xui, setting the opacity for a group changes apparent opacity for all children.
	// But the actual opacity of children is not changed, it just gets multiplied as it goes down the hierarchy.
	// In rat we have setOpacityRecursive, but that doesn't really match the behavior.
	// Let's set our own mXuiOpacity value, and then before we draw, calculate an effective opacity by marching up the parentage, mutliplying opacities.
	// This also has the result of making all children dirty, right?
	xuijs.XuiElement.prototype.SetOpacity = function(opacity)
	{
		if (this.mXuiOpacity !== opacity)
			this.setDirtyRecursive(true);
		this.mXuiOpacity = opacity;
	};

	xuijs.XuiElement.prototype.GetOpacity = function()
	{
		return this.mXuiOpacity;
	};
	
	//	Play timeline on this element.
	//	Matches up with standard Xui object playtimeline from lua
	xuijs.XuiElement.prototype.PlayTimeline = function(startFrame, endFrame, recurse)
	{
		//	happens in playAnimRange now.
		//this.setNeedsUpdate(true);
		
		// startFrame and endFrame can be named frames.
		var startTime = null;
		var endTime = null;
		
		if( typeof startFrame == 'string' ){
			startTime = this.getTimeForNamedFrame(startFrame);
		}
		else{
			startTime = xuijs.getTimeForFrame(startFrame);
		}
		
		if( typeof endFrame == 'string' ){
			endTime = this.getTimeForNamedFrame(endFrame);
		}
		else{
			endTime = xuijs.getTimeForFrame(endFrame);
		}
		
		
		if( recurse && !this.mDisableTimelineRecursion ){
			// Call playAnimRange recursively
			this.playAnimRangeRecursive(startTime, endTime);
		}
		else{
			this.playAnimRange(startTime, endTime);
		}
	};
	

	// XuiImage
	xuijs.XuiImage = function()
	{
		xuijs.XuiImage.prototype.parentConstructor.call(this); //	default init

		this.mImageRef = null;
		this.mCurrImagePath = "";
		this.mSizeMode = xuijs.XuiImage.SizeMode.NORMAL;
		
		this.hideOutOfView = true;
	};
	rat.utils.inheritClassFrom(xuijs.XuiImage, xuijs.XuiElement);
	xuijs.XuiImage.prototype.xuiElemType = "XuiImage";
	
	xuijs.XuiImage.SizeMode = {
		NORMAL: 0,
		AUTO_SIZE: 1,
		CENTER: 2,
		STRETCH: 4,
		STRETCH_MAINTAIN_ASPECT: 8,
		STRETCH_CENTER_MAINTAIN_ASPECT: 16,
		FILL_MAINTAIN_ASPECT: 32,
		FILL_CENTER_MAINTAIN_ASPECT: 64,
	};
	
	// drawSelf function
	xuijs.XuiImage.prototype.drawSelf = function()
	{
		//rat.profiler.pushPerfMark( "XUIImage" );
		// Call parent
		xuijs.XuiImage.prototype.parentPrototype.drawSelf.call(this);

		var context = rat.graphics.getContext();
		
		// Handle different size modes.
		if( this.mImageRef ){
			
			//	don't get raw image.  We might not have one - we might be sprite-sheet-based
			
			//var image;
			//image = this.mImageRef.getImage();
			//if( !image ){
				//rat.profiler.popPerfMark( "XUIImage" );
				//return;
			//}
			
			//	instead, ask nicely.
			//	returned object is in the form {w:..., h:...}
			var imageSize = this.mImageRef.getSize();
			
			var elementWidth = this.GetWidth();
			var elementHeight = this.GetHeight();
			
			var sourceX = 0;
			var sourceY = 0;
			var sourceW = imageSize.w;
			var sourceH = imageSize.h;
			var destX = 0;
			var destY = 0;
			var destW = imageSize.w;
			var destH = imageSize.h;
			
			switch(this.mSizeMode){
				case xuijs.XuiImage.SizeMode.NORMAL:
					sourceX = 0;
					sourceY = 0;
					sourceW = rat.math.min(imageSize.w, elementWidth);
					sourceH = rat.math.min(imageSize.h, elementHeight);
					
					destX = 0;
					destY = 0;
					destW = sourceW;
					destH = sourceH;
					break;
				case xuijs.XuiImage.SizeMode.AUTO_SIZE:
					// Shouldn't need to do anything
					break;
				case xuijs.XuiImage.SizeMode.CENTER:
					sourceX = rat.math.max(0, imageSize.w/2 - elementWidth/2);
					sourceY = rat.math.max(0, imageSize.h/2 - elementHeight/2);
					sourceW = rat.math.min(imageSize.w, elementWidth);
					sourceH = rat.math.min(imageSize.h, elementHeight);
					
					destX = elementWidth/2 - sourceW/2;
					destY = elementHeight/2 - sourceH/2;
					destW = sourceW;
					destH = sourceH;
					break;
				case xuijs.XuiImage.SizeMode.STRETCH:
					sourceX = 0;
					sourceY = 0;
					sourceW = imageSize.w;
					sourceH = imageSize.h;
					
					destX = 0;
					destY = 0;
					destW = elementWidth;
					destH = elementHeight;
					break;
				case xuijs.XuiImage.SizeMode.STRETCH_MAINTAIN_ASPECT:
					sourceX = 0;
					sourceY = 0;
					sourceW = imageSize.w;
					sourceH = imageSize.h;
					
					var scaleFactor = rat.math.min(elementWidth / imageSize.w, elementHeight / imageSize.h);
					
					destX = 0;
					destY = 0;
					destW = imageSize.w * scaleFactor;
					destH = imageSize.h * scaleFactor;
					break;
				case xuijs.XuiImage.SizeMode.STRETCH_CENTER_MAINTAIN_ASPECT:
					sourceX = 0;
					sourceY = 0;
					sourceW = imageSize.w;
					sourceH = imageSize.h;
					
					var scaleFactor = rat.math.min(elementWidth / imageSize.w, elementHeight / imageSize.h);
					
					destW = imageSize.w * scaleFactor;
					destH = imageSize.h * scaleFactor;
					destX = elementWidth/2 - destW/2;
					destY = elementHeight/2 - destH/2;
					break;
				case xuijs.XuiImage.SizeMode.FILL_MAINTAIN_ASPECT:
					var scaleFactor = rat.math.max(elementWidth / imageSize.w, elementHeight / imageSize.h);
					
					sourceX = 0;
					sourceY = 0;
					sourceW = rat.math.min(imageSize.w, elementWidth / scaleFactor);
					sourceH = rat.math.min(imageSize.h, elementHeight / scaleFactor);
					
					destX = 0;
					destY = 0;
					destW = sourceW * scaleFactor;
					destH = sourceH * scaleFactor;
					break;
				case xuijs.XuiImage.SizeMode.FILL_CENTER_MAINTAIN_ASPECT:
					var scaleFactor = rat.math.max(elementWidth / imageSize.w, elementHeight / imageSize.h);
					
					sourceX = rat.math.max(0, imageSize.w/2 - elementWidth/(2*scaleFactor));
					sourceY = rat.math.max(0, imageSize.h/2 - elementHeight/(2*scaleFactor));
					sourceW = rat.math.min(imageSize.w, elementWidth / scaleFactor);
					sourceH = rat.math.min(imageSize.h, elementHeight / scaleFactor);
					
					destX = 0;
					destY = 0;
					destW = sourceW * scaleFactor;
					destH = sourceH * scaleFactor;
					break;
				default:
			}
			
			// Now draw the image
			this.mImageRef.draw(context, destX, destY, destW, destH, sourceX, sourceY, sourceW, sourceH);
		}
		//rat.profiler.popPerfMark( "XUIImage" );
	};
	
	xuijs.XuiImage.prototype.setSizeMode = function(sizeMode)
	{
		this.mSizeMode = sizeMode;
	};
	
	// Xui Interface methods
	xuijs.XuiImage.prototype.GetImagePath = function()
	{
		return this.mCurrImagePath;
	};
	
	xuijs.XuiImage.prototype.SetImagePath = function(imagePath)
	{
		var fullPath = this.resolvePath(imagePath);
		
		// TODO: Eventually do something clever with sprite sheets, image frames, or something.
		// For now just create a new imageref each time.  Image caching will hopefully make it fast.
		this.mImageRef = new rat.graphics.ImageRef(fullPath);
		
		this.mCurrImagePath = imagePath;
	};
	

	// XuiFigure
	xuijs.XuiFigure = function()
	{
		xuijs.XuiFigure.prototype.parentConstructor.call(this); //	default init
		
		// Stroke
		this.mStrokeWidth = 0;
		// Xui default stroke color seems to be "FF0F0FEB"
		//	This is the correct color for figures...  why was it not being used...
		//this.mStrokeColor = new rat.graphics.Color(0, 0, 0, 0);
		this.mStrokeColor = new rat.graphics.Color(15, 15, 128, 1);
		
		// Fill
		this.mFillType = xuijs.XuiFigure.FillType.SOLID;
		// Xui default fill color seems to be "FF0F0F80"
		//	This is the correct color for figures...  why was it not being used...
		//this.mFillColor = new rat.graphics.Color(255, 255, 255, 1);
		this.mFillColor = new rat.graphics.Color(15, 15, 128, 1);
		
		// Other fill types will have other settings.
		
		// Closed
		this.mClosed = true;
		
		// Point data
		this.mPointData = [];
		
		// Bounding data for bezier curve segments.
		this.mCurveBounds = {width: 1, height: 1};
		
		// Gradient data
		this.mGradientStopData = [];
		
		// Texture fill data
		this.mFillTexturePath = "";
		this.mFillTextureImageRef;
		
		// Fill transform stuff
		this.mFillTranslation = {x:0, y:0};
		this.mFillScale = {x:1, y:1};
		this.mFillRotation = 0;
		
	};
	rat.utils.inheritClassFrom(xuijs.XuiFigure, xuijs.XuiElement);
	xuijs.XuiFigure.prototype.xuiElemType = "XuiFigure";
	
	xuijs.XuiFigure.FillType = {
		NONE: 0,
		SOLID: 1,
		LINEAR_GRADIENT: 2,
		RADIAL_GRADIENT: 3,
		TEXTURE: 4,
		CONE_GRADIENT: 5,
	};
	
	var tempColor = new rat.graphics.Color();
	
	// drawSelf function
	xuijs.XuiFigure.prototype.drawSelf = function()
	{
		rat.profiler.pushPerfMark( "XuiFigure" );
		// Call parent
		xuijs.XuiFigure.prototype.parentPrototype.drawSelf.call(this);
		
		// draw shape
		if( this.mPointData.length < 2 ){
			rat.profiler.popPerfMark( "XuiFigure" );
			return;
		}
		
		rat.graphics.save();
		
		var context = rat.graphics.getContext();
		
		// Set stroke and fill settings
		// Stroke in canvas is centered on shape line.  In Xui it's outside the shape.
		// Probably only noticable for large widths.  We could maybe draw stroke first, at double width to mimic?
		context.lineWidth = this.mStrokeWidth;
		this.mStrokeColor.mult( this.mColorFactor, tempColor );
		context.strokeStyle = tempColor.toString();
		
		// Set up fill for various types
		if( this.mFillType == xuijs.XuiFigure.FillType.SOLID ){
			this.mFillColor.mult( this.mColorFactor, tempColor );
			context.fillStyle = tempColor.toString();
		}
		else if( this.mFillType == xuijs.XuiFigure.FillType.LINEAR_GRADIENT ){
			// Set up gradient
			// Will need to figure out best way to handle xui gradient transform -> canvas gradient start/stop.
			// For now assume default, no translation setup.
			var gradient = context.createLinearGradient(0, 0, this.mCurveBounds.width, 0);
			for (var i = 0; i < this.mGradientStopData.length; i++) {
				// had issues with ranges, so we're clamping this for now
				var val = this.mGradientStopData[i].pos
				if (val < 0)
					val = 0;
				else if (val > 1)
					val = 1;
				this.mGradientStopData[i].color.mult( this.mColorFactor, tempColor );
				gradient.addColorStop(val, tempColor.toString());
			}
			context.fillStyle = gradient;
		}
		else if( this.mFillType == xuijs.XuiFigure.FillType.RADIAL_GRADIENT ){
			// Set up gradient
			// Will need to figure out best way to handle xui gradient transform -> canvas gradient start/stop.
			// For now assume default, no translation setup.
			var centerX = this.mCurveBounds.width / 2;//this.GetWidth()/2;
			var centerY = this.mCurveBounds.height / 2;//this.GetHeight()/2
			var radius1 = 0;
			var radius2 = rat.math.max(centerX, centerY);
			
			var gradient = context.createRadialGradient(
				centerX, centerY, radius1,
				centerX, centerY, radius2);
			
			for( var i = 0; i < this.mGradientStopData.length; i++ ){
				this.mGradientStopData[i].color.mult( this.mColorFactor, tempColor );
				gradient.addColorStop(this.mGradientStopData[i].pos, tempColor.toString());
			}
			context.fillStyle = gradient;
		}
		else if( this.mFillType == xuijs.XuiFigure.FillType.TEXTURE ){
			///	COLOR FACTOR NOT SUPPORTED!
			if( this.mFillTextureImageRef ){
				var image = this.mFillTextureImageRef.getImage();
				if( image ){
					var pattern = context.createPattern(image, "repeat");
					context.fillStyle = pattern;
				}
			}
		}
		else if( this.mFillType == xuijs.XuiFigure.FillType.NONE ){
			context.fillStyle = "rgba(0, 0, 0 ,0)";
		}
		
		// Draw the shape
		
		// Point data is a flat array of pertinent value.
		// The first entry is the number of bezier segments.
		// After that, for each segment there are 7 values.
		// 3 pairs of xy coordinates for bezier curve values, and the last value indicates smooth/sharp, I think.
		
		// Get the scale factor we need to scale the curve into the current width/height of the element.
		var scaleX = this.GetWidth() / this.mCurveBounds.width;
		var scaleY = this.GetHeight() / this.mCurveBounds.height;
		
		// Save context before scale.  We only want it active while we set up the path, not while we stroke/fill it.
		context.save();
		context.scale(scaleX, scaleY);

		// FOR DEBUGGING BOUNDS
		//context.save();
		//context.lineWidth = 1;
		//context.strokeStyle = "rgb(255, 0, 0)";
		//context.strokeRect(0, 0, this.mCurveBounds.width, this.mCurveBounds.height);
		//context.restore();
		// END DEBUGGING
		
		context.beginPath();
		
		// Get the number of segments
		var curr = 0;
		var numSegments = this.mPointData[curr++];
		
		// Get first point
		var startX = this.mPointData[curr++];
		var startY = this.mPointData[curr++];
		context.moveTo(startX, startY);
		
		// When we draw with bezierCurveTo, we start from our current position (thus the moveTo() above),
		// then we give control-point 1 data, and control-point 2 data, 
		// then we give the end point (which in this case is actually the first value of the next segment data).
		for( var i = 0; i < numSegments; i++ ){
			var cp1x = this.mPointData[curr++];
			var cp1y = this.mPointData[curr++];
			
			var cp2x = this.mPointData[curr++];
			var cp2y = this.mPointData[curr++];
			
			curr++; // Increment past "smooth/sharp" entry. 
			
			// Make sure we wrap around if we're at the end of the data.
			if( curr == this.mPointData.length ){
				curr = 1;
			}
			
			var endx = this.mPointData[curr++];
			var endy = this.mPointData[curr++];
			
			context.bezierCurveTo(cp1x, cp1y, cp2x, cp2y, endx, endy);
		}
		
		// Restore the context to pre-scale, or else stroke/fill will be distorted.
		context.restore();

		if( this.mFillType == xuijs.XuiFigure.FillType.LINEAR_GRADIENT || 
			this.mFillType == xuijs.XuiFigure.FillType.RADIAL_GRADIENT || 
			this.mFillType == xuijs.XuiFigure.FillType.CONICAL_GRADIENT )
		{
			// Need to scale the fill so it matches element's width/height ratio.
			// TODO: This may not be really the best way to handle this, but it seems to work for now.
			// It won't work if there's custom transforms on the fill.
			context.save();
			// These transforms could probably be simplified, but it seems to work, and I don't want to figure it out another way.
			context.scale(scaleX, scaleY);
			context.translate(this.mCurveBounds.width/2, this.mCurveBounds.height/2);
			context.scale(1, this.mCurveBounds.height / this.mCurveBounds.width);
			context.translate(-this.mCurveBounds.width/2, -this.mCurveBounds.height/2);
			context.fill();
			context.restore();
		}
		else if( this.mFillType == xuijs.XuiFigure.FillType.TEXTURE )
		{
			// Need to transform based on the texture fill transform properties.
			context.save();
			
			var elementWidth = this.GetWidth();
			var elementHeight = this.GetHeight();

			var imageWidth = 0;
			var imageHeight = 0;
			var image = this.mFillTextureImageRef.getImage();
			if( image ){
				imageWidth = image.width;
				imageHeight = image.height;
			}
			
			// Transformation needs to be Translate-Rotate-Scale order (which means apply them inverse of that here).
			// And rotation and scale need to happen around the center-point of the element.
			context.translate(elementWidth / 2, elementHeight / 2);
			
			context.scale(1/this.mFillScale.x, 1/this.mFillScale.y);
			context.rotate(-this.mFillRotation);
			context.translate(-this.mFillTranslation.x * imageWidth, -this.mFillTranslation.y * imageHeight);
			
			context.translate(-elementWidth / 2, -elementHeight / 2);
			
			context.fill();
			
			context.restore();
		}
		else{
			// Don't need any transformations - just fill
			context.fill();
		}
		
		if( this.mStrokeWidth > 0 ){
			context.stroke();
		}
		
		rat.graphics.restore();
		rat.profiler.popPerfMark( "XuiFigure" );
	};
	
	// Functions for setting up the figure
	xuijs.XuiFigure.prototype.setStroke = function(width, color)
	{
		this.mStrokeColor = color;
		this.mStrokeWidth = width;
	};
	
	xuijs.XuiFigure.prototype.setFillType = function(type, options)
	{
		this.mFillType = type;
		
		// Handle transformation stuff
		if( options.Translation ){
			this.mFillTranslation = {x:options.Translation[0], y:options.Translation[1]};
		}
		if( options.Scale ){
			this.mFillScale = {x:options.Scale[0], y:options.Scale[1]};
		}
		if( options.Rotation ){
			this.mFillRotation = options.Rotation;
		}
		
		// Handle options for various types
		if( this.mFillType == xuijs.XuiFigure.FillType.NONE ){
		}
		else if( this.mFillType == xuijs.XuiFigure.FillType.SOLID ){
			if( options.color ){
				this.mFillColor = options.color;
			}
		}
		else if( this.mFillType == xuijs.XuiFigure.FillType.LINEAR_GRADIENT ){
			if( options.Stops ){
				this.mGradientStopData = options.Stops;
			}
		}
		else if( this.mFillType == xuijs.XuiFigure.FillType.RADIAL_GRADIENT ){
			if( options.Stops ){
				this.mGradientStopData = options.Stops;
			}
		}
		else if( this.mFillType == xuijs.XuiFigure.FillType.TEXTURE ){
			if( options.TextureFileName ){
				var fullPath = this.resolvePath(options.TextureFileName);
				this.mFillTexturePath = fullPath;
				this.mFillTextureImageRef = new rat.graphics.ImageRef(this.mFillTexturePath);
			}
		}
		else{
			rat.console.log("Unsupported Fill type: " + type);
		}
	};
	
	xuijs.XuiFigure.prototype.setClosed = function(closed)
	{
		this.mClosed = closed;
	};
	
	xuijs.XuiFigure.prototype.setPointData = function(pointData)
	{
		// Point data is a flat array of values.
		// We'll deal with the different parts of the data when we draw.
		this.mPointData = pointData;
		
		// Calc new curve bounds
		this.mCurveBounds = this.calcCurveBounds();
	};
	
	xuijs.XuiFigure.prototype.calcCurveBounds = function()
	{
		// Calculate the bounds of a set of bezier curves.
		var extentsX = {
			max : null,
			min : null,
		};
		var extentsY = {
			max : null,
			min : null,
		};
		
		// Get the number of segments
		var numSegments = this.mPointData[0];
		
		// Start with the min-max of the actual points in the data (not the control points).
		for( var i = 0; i < numSegments; i++ ){
			var pointX = this.mPointData[i*7 + 1];
			var pointY = this.mPointData[i*7 + 2];
			
			if( pointX > extentsX.max || extentsX.max === null ){
				extentsX.max = pointX;
			}
			if( pointX < extentsX.min || extentsX.min === null ){
				extentsX.min = pointX;
			}
			
			if( pointY > extentsY.max || extentsY.max === null ){
				extentsY.max = pointY;
			}
			if( pointY < extentsY.min || extentsY.min === null ){
				extentsY.min = pointY;
			}
		}
		
		
		// Now calculate the bounds of each bezier segment
		var curr = 0;
		var numSegments = this.mPointData[curr++];
		
		for( var i = 0; i < numSegments; i++ ){
			// Get P0, P1, P2, P3
			var P0x = this.mPointData[curr++];
			var P0y = this.mPointData[curr++];
			
			var P1x = this.mPointData[curr++];
			var P1y = this.mPointData[curr++];
			
			var P2x = this.mPointData[curr++];
			var P2y = this.mPointData[curr++];
			
			curr++; // Increment past "smooth/sharp" entry. 
			
			// Make sure we wrap around if we're at the end of the data.
			if( curr == this.mPointData.length ){
				curr = 1;
			}
			
			var P3x = this.mPointData[curr++];
			var P3y = this.mPointData[curr++];
			
			// Move curr back so that P3 from this loop will be P0 in the next loop.
			curr -= 2;
			
			// Mathy stuff pulled from:
			// https://github.com/blairbonnett/inkscape-pybounds/blob/master/docs/bezier.rst
			
			// If control points are contained in bounds, we can skip all this.
			if( 
				P1x >= extentsX.min && P1x <= extentsX.max &&
				P1y >= extentsY.min && P1y <= extentsY.max &&
				P2x >= extentsX.min && P2x <= extentsX.max &&
				P2y >= extentsY.min && P2y <= extentsY.max
			){
				continue;
			}
			
			var Q0x = P1x - P0x;
			var Q0y = P1y - P0y;
			
			var Q1x = P2x - P1x;
			var Q1y = P2y - P1y;
			
			var Q2x = P3x - P2x;
			var Q2y = P3y - P2y;
			
			function calcQuadratic(a, b, c){
				var sqrtPart = rat.math.sqrt((b*b) - (4*a*c));
				var plusAnswer = (-b + sqrtPart) / (2 * a);
				var minusAnswer = (-b - sqrtPart) / (2 * a);
				
				// We only care about real values between 0 and 1.
				var results = [];
				if( !isNaN(plusAnswer) && isFinite(plusAnswer) && plusAnswer > 0 && plusAnswer < 1 ){
					results.push(plusAnswer);
				}
				if( !isNaN(minusAnswer) && isFinite(minusAnswer) && minusAnswer > 0 && minusAnswer < 1 ){
					results.push(minusAnswer);
				}
					
				return results;
			}
			
			function calc_t_vals(Q0, Q1, Q2){
				var a = 3 * Q0 - 6 * Q1 + 3 * Q2;
				var b = -6 * Q0 + 6 * Q1;
				var c = 3 * Q0;
				
				return calcQuadratic(a, b, c);
			}
			
			function calcCubicBezierVal(P0, P1, P2, P3, t){
				var result = (1 - t)*(1 - t)*(1 - t) * P0;
				result += 3 * (1 - t)*(1 - t) * t * P1;
				result += 3 * (1 - t) * t * t * P2;
				result += t * t * t * P3;
				
				return result;
			}
			
			// Calculate places where derivitive of bezier function is zero.
			var t_vals_x = calc_t_vals(Q0x, Q1x, Q2x);
			var t_vals_y = calc_t_vals(Q0y, Q1y, Q2y);
			
			// Calculate the value of the curve at the given values, and adjust min/max with them.
			function expandMinMax( tValues, curveParams, extents ){
				for( var k = 0; k < tValues.length; k++ ){
					var value = calcCubicBezierVal(curveParams[0], curveParams[1], curveParams[2], curveParams[3], tValues[k]);
					if( value < extents.min ){
						extents.min = value;
					}
					if( value > extents.max ){
						extents.max = value;
					}
				}
			}
			
			// Expand the min/max values for x and y
			expandMinMax(t_vals_x, [P0x, P1x, P2x, P3x], extentsX);
			expandMinMax(t_vals_y, [P0y, P1y, P2y, P3y], extentsY);
		}

		return {width: extentsX.max - extentsX.min, height: extentsY.max - extentsY.min};
	};

	
	// XuiText
	// TODO: Not sure if I want to keep text handling all in this element, or if I should use a rat.ui.TextBox in some way.
	xuijs.XuiText = function()
	{
		xuijs.XuiText.prototype.parentConstructor.call(this); //	default init
		rat.ui.TextBox.call(this);
		this.setUseOffscreen( true );
		
		//	default font setup
		this.setFont( xuijs.XuiText.defaultFontName,
			Math.floor(xuijs.XuiText.defaultFontSize*xuijs.XuiText.fontScaleMultiplier));
		this.setColor( rat.graphics.black );
		this.setShadow( new rat.graphics.Color(0, 0, 0, 0.5), 1, 1 );
		this.mStyleFlags = 
			xuijs.XuiText.StyleFlags.WORDWRAP_OFF | 
			xuijs.XuiText.StyleFlags.ALIGN_X_LEFT | 
			xuijs.XuiText.StyleFlags.ALIGN_Y_TOP;
		this.mTextScale = 1.0;
		this.mTextCase = "raw"; // Can be either upper or lower or raw
		this.mRawText = ""; // Text value before casing
		this.updateRatTextBox();
	};
	rat.utils.inheritClassFrom(xuijs.XuiText, xuijs.XuiElement);
	rat.utils.extendClassWith(xuijs.XuiText, rat.ui.TextBox);
	xuijs.XuiText.prototype.xuiElemType = "XuiText";
	xuijs.XuiText.prototype.useOffscreen = true; // Draw using an off screen buffer
	
	xuijs.XuiText.defaultFontName = "Segoe UI";	//	standard Xbox font - needs to be in html/stylesheet?
	xuijs.XuiText.defaultFontSize = 14;	//	XUI actually assumes 14!  Probably don't change this.  Usually, everybody ends up setting a size, but not always
	xuijs.XuiText.fontScaleMultiplier = 1.5;	//	make fonts closer to XUI fonts?  I don't know if this is usefully accurate.  Maybe change in a future game.
	
	xuijs.XuiText.fontColorOverride = null;	//	force all font color set commands to use this value, if defined.
	xuijs.XuiText.fontStrokeOverride = null;	//	force all font color set commands to use these stroke values, if defined
	
	//	set up some font defaults to make it easier to use a particular font throughout a game.
	//	The reason this is relevant is I don't really want to port our fancy WText fake font system,
	//	and this is a lot easier than passing all those values through, at least in the case of slush...
	//	2015.10.14 STT
	xuijs.XuiText.setFontDefaults = function(fontName, fontSize, fontScaleMultiplier)
	{
		xuijs.XuiText.defaultFontName = fontName;
		if (fontSize)
			xuijs.XuiText.defaultFontSize = fontSize;
		if (fontScaleMultiplier)
			xuijs.XuiText.fontScaleMultiplier = fontScaleMultiplier;
	};
	
	//	IF we don't re-set these to point to the TextBox, then we end up with these bypassing the TextBox logic
	//	Multiple-inheritance problems
	xuijs.XuiText.prototype.boundsChanged = rat.ui.TextBox.prototype.boundsChanged;
	//xuijs.XuiElement.prototype.SetWidth = rat.ui.TextBox.prototype.setWidth;
	//xuijs.XuiElement.prototype.SetHeight = rat.ui.TextBox.prototype.setHeight;
	
	// These are a little bit weird, especially with default values vs. no-values, but hopefully this will work.
	xuijs.XuiText.StyleFlags = {
		DEFAULT: 0x0,
		DROP_SHADOW: 0x1,	//	Use the drop shadow 
		ITALIC: 0x2,		//	Draw Italic
		BOLD: 0x4,			//	Draw bold
		UNDERLINE: 0x8,		//	Draw underline
		WORDWRAP_OFF: 0x10,	//	Don't word wrap
		ALIGN_X_LEFT: 0x100,	
		ALIGN_X_RIGHT: 0x200,
		ALIGN_X_CENTER: 0x400,
		ALIGN_Y_CENTER: 0x1000,
		ELIPSIS: 0x4000,
		UPPERCASE: 0x1000000,//	Draw Text upper case
		LOWERCASE: 0x2000000,//	Draw Text lower case
		ALIGN_Y_TOP: 0x4000000,
		ALIGN_Y_BOTTOM: 0x8000000,
	};
	
	xuijs.XuiText.prototype.updateRatTextBox = function()
	{
		var styleFlags = xuijs.XuiText.StyleFlags;
		var mStyleFlags = this.mStyleFlags;
		this.setAutoWrap( !(mStyleFlags & styleFlags.WORDWRAP_OFF) );
		if (mStyleFlags & styleFlags.ALIGN_X_LEFT)
			this.setAlign( rat.ui.TextBox.alignLeft );
		else if (mStyleFlags & styleFlags.ALIGN_X_CENTER)
			this.setAlign( rat.ui.TextBox.alignCenter );
		else if (mStyleFlags & styleFlags.ALIGN_X_RIGHT)
			this.setAlign( rat.ui.TextBox.alignRight );
			
		if (mStyleFlags & styleFlags.ALIGN_Y_TOP)
			this.setBaseline( rat.ui.TextBox.baselineTop );
		else if (mStyleFlags & styleFlags.ALIGN_Y_CENTER)
			this.setBaseline( rat.ui.TextBox.baselineMiddle );
		else if (mStyleFlags & styleFlags.ALIGN_Y_BOTTOM)
			this.setBaseline( rat.ui.TextBox.baselineBottom );
		
		var style = "";
		if (mStyleFlags & styleFlags.ITALIC)
			style += "italic ";
		if (mStyleFlags & styleFlags.BOLD)
			style += "bold ";
		this.setFontStyle( style );
		
		this.setShadowEnabled(mStyleFlags & styleFlags.DROP_SHADOW);
		
		var newCase;
		if (mStyleFlags & styleFlags.UPPERCASE)
			newCase = "upper";
		else if (mStyleFlags & styleFlags.LOWERCASE)
			newCase = "lower";			
		else
			newCase = "raw";
		if (this.mTextCase !== newCase)
		{
			this.mTextCase = newCase;
			this.setTextValue( this.mRawText, true ); // true = force
		}
	};

	//	Track the original text set (w/out casing changes)
	xuijs.XuiText.prototype.setTextValue = function(value, force)
	{
		var inherited = rat.ui.TextBox.prototype.setTextValue.bind(this);
		if (this.mRawText !== value || force)
		{
			this.mRawText = value;
			 
			if (this.mTextCase === "upper")
				inherited( this.mRawText.toUpperCase() );
			else if (this.mTextCase === "lower")
				inherited( this.mRawText.toLowerCase() );
			else
				inherited( this.mRawText );
		}
	};
	
	xuijs.XuiText.prototype.GetTextLength = function()
	{
		if (this.mRawText)
			return this.mRawText.length;
		else
			return 0;
	};
	
	xuijs.XuiText.prototype.SetWrap = function(onOff)
	{
		this.setAutoWrap(onOff);
	};
	
	xuijs.XuiText.prototype.translateAndSetTextValue = function(value)
	{
		//	NOTE that we don't call xuijs.XuiText.prototype.translateAndSetTextValue because we need to change what the actual set text is
		//	NOTE: We CANNOT call setTextValue because some of our classes override that to call translateAndSetTextValue which would cause infinite recursion
		if (rat.string)
			value = rat.string.getString(value);
		if (value !== this.mRawText)
		{
			this.mRawText = value;
			if (this.mTextCase === "upper")
				this.value = this.mRawText.toUpperCase();
			else if (this.mTextCase === "lower")
				this.value = this.mRawText.toLowerCase();
			else
				this.value = mRawText;
			this.textChanged();
		}			
	};

	// drawSelf function
	xuijs.XuiText.prototype.drawSelf = function()
	{
		rat.profiler.pushPerfMark( "XuiText" );
		
		// Call parent functions
		//	Try to apply any set text scaling here
		var savedFontSize = this.fontSize;
		this.fontSize *= this.mTextScale;
		
		xuijs.XuiText.prototype.parentPrototype.drawSelf.call(this);
		rat.ui.TextBox.prototype.drawSelf.call(this);
		
		// //	Undo what we did to apply text scaling.
		// this.fontSize = savedFontSize;
		
		// return;
		// // Get context
		// var context = rat.graphics.getContext();
		
		// context.save();
		
		// // TODO: Figure out how best to handle font.  For now use Calibri.
		// // TODO: We may want to handle font size/scaling differently too.
		// var fontString = "Segoe UI";
		// fontString = this.mFontSize * this.mTextScale + "px " + fontString;
		// if( this.mStyleFlags & xuijs.XuiText.StyleFlags.BOLD ){
			// fontString = "bold " + fontString;
		// }
		// if( this.mStyleFlags & xuijs.XuiText.StyleFlags.ITALIC ){
			// fontString = "italic " + fontString;
		// }
		// context.font = fontString;
		
		// // Colors
		// this.mTextColor.mult( this.mColorFactor, tempColor );
		// context.fillStyle = tempColor.toString();
		// if( this.mStyleFlags & xuijs.XuiText.StyleFlags.DROP_SHADOW ){
			// this.mTextShadowColor.mult( this.mColorFactor, tempColor );
			// context.shadowColor = tempColor.toString();
			// context.shadowOffsetX = 1;
			// context.shadowOffsetY = 1;
		// }
		
		// // Handle different alignment modes.
		// var posX = 0;
		// var posY = 0;
		// context.textAlign = "left";
		// context.textBaseline = "top";
		
		// // Horizontal alignment
		// if( this.mStyleFlags & xuijs.XuiText.StyleFlags.ALIGN_X_LEFT ){
			// context.textAlign = "left";
			// posX = 0;
		// }
		// else if( this.mStyleFlags & xuijs.XuiText.StyleFlags.ALIGN_X_CENTER ){
			// context.textAlign = "center";
			// posX = this.GetWidth() / 2;
		// }
		// else if( this.mStyleFlags & xuijs.XuiText.StyleFlags.ALIGN_X_RIGHT ){
			// context.textAlign = "right";
			// posX = this.GetWidth();
		// }
		
		// // Vertical alignment
		// if( this.mStyleFlags & xuijs.XuiText.StyleFlags.ALIGN_Y_TOP ){
			// context.textBaseline = "top";
			// posY = 0;
		// }
		// else if( this.mStyleFlags & xuijs.XuiText.StyleFlags.ALIGN_Y_CENTER ){
			// context.textBaseline = "middle";
			// posY = this.GetHeight() / 2;
		// }
		// else if( this.mStyleFlags & xuijs.XuiText.StyleFlags.ALIGN_Y_BOTTOM ){
			// context.textBaseline = "bottom";
			// posY = this.GetHeight();
		// }

		// if(this.mTextString){
			// // Get the text string and draw it.
			// // TODO: We could probably handle word-wrap and line-breaks by splitting the string and drawing two.
			
			// //var textString = this.mTextString;
			// //	Hey, let's do that now!  STT 2014.11.20
			
			// var yOffset = 0;
			// var lines = ("" + this.mTextString).split('\n');	// NOTE: If this can't be converted into a string, this will crash
			// for (var i = 0; i < lines.length; i++)
			// {
				// var textString = lines[i];
			
				// if( this.mStyleFlags & xuijs.XuiText.StyleFlags.UPPERCASE ){
					// textString = textString.toUpperCase();
				// }
				// else if( this.mStyleFlags & xuijs.XuiText.StyleFlags.LOWERCASE ){
					// textString = textString.toLowerCase();
				// }
				// context.fillText(textString, posX, posY + yOffset)
				
				// yOffset += 75;	//	JARED:  here is the hard-coded text height awfulness for which I will go to hell one day.
			// }
		// }
		
		// context.restore();
		rat.profiler.popPerfMark( "XuiText" );
	};
	
	xuijs.XuiText.prototype.init = function(options)
	{
		// Text
		if( options.Text ){
			this.SetText(options.Text);
		}
		
		// TextColor
		if( options.TextColor ){
			if (xuijs.XuiText.fontColorOverride)
			{
				var color = xuijs.XuiText.fontColorOverride.copy();
				//color.a = options.TextColor.a;
				this.setColor( color );
			}
			else
				this.setColor( options.TextColor );
		}
		
		// DropShadowColor
		if( options.DropShadowColor ){
			this.setShadow( options.DropShadowColor );
		}
		
		// PointSize - set whether it was provided or not, so we can get the correct stroke and everything in one place.
		var pointSize = options.PointSize || xuijs.XuiText.defaultFontSize;
		// Apply a scaling factor, to try to match Xui better.
		this.setFontSize(Math.floor(pointSize * xuijs.XuiText.fontScaleMultiplier));
		if (xuijs.XuiText.fontStrokeOverride)
		{
			var override = xuijs.XuiText.fontStrokeOverride;
			var strokeSize = Math.floor(pointSize * xuijs.XuiText.fontScaleMultiplier * override.widthFraction);
			this.setStroke(strokeSize, override.color, false);
		}
		
		// TextStyle
		if( options.TextStyle ){
			this.mStyleFlags = options.TextStyle;
			this.updateRatTextBox();
		}
		
		// TextScale
		if( options.TextScale ){
			this.mTextScale = options.TextScale;
			this.setDirty();
		}
	}
	
	// Xui Interface methods
	xuijs.XuiText.prototype.GetText = function()
	{
		return this.mRawText;
	};

	xuijs.XuiText.prototype.SetText = xuijs.XuiText.prototype.setTextValue;
	
	//	a custom call for handling of xui text specifically...
	xuijs.XuiText.prototype.GetXAlign = function()
	{
		if (this.mStyleFlags & xuijs.XuiText.StyleFlags.ALIGN_X_RIGHT)
			return "RIGHT";
		else if (this.mStyleFlags & xuijs.XuiText.StyleFlags.ALIGN_X_CENTER)
			return "CENTER";
		else
			return "LEFT";
	};


	// XuiSound
	// supported functions GetFile, GetVolume, IsMuted, Mute, Play, SetFile, SetVolume, Stop
	xuijs.XuiSound = function()
	{
		xuijs.XuiSound.prototype.parentConstructor.call(this); //	default init

		this.mFilepath = null;
		this.mVolume = -12;					// volume defaults to -12 with a range of -96 to +6
		this.mLoop = false;					// is the sound looping ** TODO - Implement looping
		this.mFinish = false;				// no idea what this one even does! ** UNUSED
		this.mMuted = false;				// only set via functions
		this.mSoundId = void 0;				// Set once we get a call to SetFile
		this.mUniqueSoundId = 0;
	};
	rat.utils.inheritClassFrom(xuijs.XuiSound, xuijs.XuiElement);
	xuijs.XuiSound.prototype.doesNotDraw = true;
	xuijs.XuiSound.prototype.xuiElemType = "XuiSound";
	
	///	Extended parent destroy function
	xuijs.XuiSound.prototype.destroy = function()
	{
		this.Stop();
		xuijs.XuiSound.prototype.parentPrototype.destroy.call(this);
	};
	
	// internally used functions
	xuijs.XuiSound.prototype.getSoundPercent = function () {
		return xuijs.getSoundPercent( this.mVolume );
	};
	
	// may be called after the object is constructed
	// XuiSounds default to playing once loaded
	xuijs.XuiSound.prototype.SetState = function (state) {
		if (this.mSoundId < 0)
			return;
		if(typeof state === 'undefined' || state === null || state === "2")
		{
			//rat.audio.playSound(this.mSoundId);
			this.Play();
		}
		
		if(state == 'Stop' || state == "4")
		{
			//rat.audio.stopSound(this.mSoundId);
			this.Stop();
		}
	};

	// XUI API supported functions
	xuijs.XuiSound.prototype.GetFile = function () {
		return this.mFilepath;
	};
	xuijs.XuiSound.prototype.SetFile = function (filepath) {
		var fullPath = this.resolvePath(filepath);

		// the sound should be preloaded into r_audio already with a key of its filepath
		if (this.mUniqueSoundId === void 0)
		{
			rat.console.log("ERROR: sound " + filepath + " did not load correctly.  Is it in a timeline?");
			this.mSoundId = void 0;
		} else
			this.mSoundId = this.mUniqueSoundId + fullPath;

		this.mFilepath = filepath;

		rat.audio.setSoundVolume(this.mSoundId, this.getSoundPercent());
		// its possible that setting the path would reset the sound and we may want to in the future reset the playing of it, and/or its mute flag
	};
	xuijs.XuiSound.prototype.SetLooping = function(loop)
	{
		rat.audio.setSoundLooping( this.mSoundId, loop );
	};
	xuijs.XuiSound.prototype.GetVolume = function () {
		return this.mVolume;
	};
	xuijs.XuiSound.prototype.SetVolume = function (volume) {
		if(typeof volume === 'string')
			volume = volume | 0;
		this.mVolume = volume;
		
		rat.audio.setSoundVolume(this.mSoundId, this.getSoundPercent());
	};
	xuijs.XuiSound.prototype.IsMuted = function () {
		return this.mMuted;
	};
	xuijs.XuiSound.prototype.Mute = function (shouldMute) {
		if (this.mSoundId < 0)
			return;

		if (shouldMute) {
			// mute the sound for our mSoundId
			rat.audio.setSoundVolume(this.mSoundId, 0);
		}
		else {
			// un-mute the sound!
			rat.audio.setSoundVolume(this.mSoundId, this.getSoundPercent());
		}
		this.muted = shouldMute;

	};
	xuijs.XuiSound.prototype.Play = function () {
		if (this.mSoundId < 0)
			return;

		rat.audio.playSound(this.mSoundId);
	};
	xuijs.XuiSound.prototype.Stop = function () {
		if (this.mSoundId < 0)
			return;

		rat.audio.stopSound(this.mSoundId);
	};
	
	// XuiVideo
	// supported functions GetFile, GetVolume, IsMuted, IsPaused, Mute, Pause, Play, SetFile, SetVolume, Stop
	//	
	xuijs.XuiVideo = function( isCompVideo )
	{
		this.isXuiCompVideo = isCompVideo || false;
		this.mVolume = -12;					// volume defaults to -12 with a range of -96 to +6
		this.video = new rat.graphics.Video({foreground:false, volume:xuijs.getSoundPercent(this.mVolume)} );
		this.video.addEventListener( "destroy", this.onDestroy, this );
		this.video.addEventListener( "load", this.onLoad, this );
		this.video.addEventListener( "end", this.onEnd, this );
		this.video.addEventListener( "startbuffering", this.onStartBuffering, this );
		this.video.addEventListener( "endbuffering", this.onEndBuffering, this );
		xuijs.XuiVideo.prototype.parentConstructor.call(this); //	default init
	};
	rat.utils.inheritClassFrom(xuijs.XuiVideo, xuijs.XuiElement);
	xuijs.XuiVideo.prototype.doesNotDraw = true;
	xuijs.XuiVideo.prototype.xuiElemType = "XuiVideo";
	xuijs.XuiVideo.prototype.onDestroy = function(from, type)
	{
		this.fireEvent( "destroy", this.GetHandle(), type );
	};
	xuijs.XuiVideo.prototype.onLoad = function(from, type)
	{
		this.fireEvent( "loaded", this.GetHandle(), type );
	};
	xuijs.XuiVideo.prototype.onEnd = function(from, type)
	{
		this.fireEvent( "end", this.GetHandle(), type );
	};
	xuijs.XuiVideo.prototype.onStartBuffering = function(from, type)
	{
		this.fireEvent( "startbuffering", this.GetHandle(), type );
	};
	xuijs.XuiVideo.prototype.onEndBuffering = function(from, type)
	{
		this.fireEvent( "endbuffering", this.GetHandle(), type );
	};
	
	///	Extended parent destroy function
	xuijs.XuiVideo.prototype.destroy = function()
	{
		this.video.destroy();
		this.video = void 0;
		xuijs.XuiVideo.prototype.parentPrototype.destroy.call(this)
	};
	
	xuijs.XuiVideo.prototype.GetCurrentPositionSeconds = function()
	{
		return this.video.getCurrentTime();
	};
	
	//	seek (set current position)
	xuijs.XuiVideo.prototype.SetCurrentPositionSeconds = function(secs)
	{
		this.video.setCurrentTime( secs );
	};
	
	///	Get the currently set file path
	xuijs.XuiVideo.prototype.GetFile = function()
	{
		return this.video.getFile();
	};
	
	///	Get the currently set volume
	xuijs.XuiVideo.prototype.GetVolume = function()
	{
		//	NOTE: We don't call the videos getVolume because mVolume is in db, and the videos volume is in %
		//		Instead, when we get a call to SetVolume, we track what volume we set it to (in db),
		//		convert it to % and pass it to the video object
		return this.mVolume;
	};
	
	//	Set the video volume
	xuijs.XuiVideo.prototype.SetVolume = function(db)
	{
		this.mVolume = db;
		this.video.setVolume( xuijs.getSoundPercent(db) );
	};
	
	///	Get if the video is muted
	xuijs.XuiVideo.prototype.IsMuted = function()
	{
		return this.video.isMuted();
	};
	
	///	Get if the video is paused
	xuijs.XuiVideo.prototype.IsPaused = function()
	{
		return this.video.isPaused();
	};
	
	//	Get if the video is playing
	xuijs.XuiVideo.prototype.IsPlaying = function()
	{
		return this.video.isPlaying();
	};
	
	///	Toggles the video mute
	xuijs.XuiVideo.prototype.Mute = function( shouldMute )
	{
		this.video.mute(shouldMute);
	};
	
	///	Toggles if the video is paused
	xuijs.XuiVideo.prototype.Pause = function(shouldPause)
	{
		if (this.IsPaused() === shouldPause || !this.IsPlaying())
			return;
		
		if (this.IsPaused())
		{
			this.video.resume();
		}
		else
		{
			this.video.pause();
		}
	};
	
	///	Begins playback of the specified video file.
	xuijs.XuiVideo.prototype.Play = function(file)
	{
		this.video.play( file );
	};

	///	Sets the path to the video file associated with the video element.	
	xuijs.XuiVideo.prototype.SetFile = function(file)
	{
		this.video.setFile( file );
	};
	
	///	Stops playback of the video.
	xuijs.XuiVideo.prototype.Stop = function()
	{
		this.video.stop();
	};
	
	///	 Return if we are loaded
	xuijs.XuiVideo.prototype.IsLoaded = function()
	{
		// rat.console.log( "Testing " + this.video.htmlTagID +  " isLoaded.." );
		if (this.video.isLoading())
			return false;
		else
			return true;
	};
	
	///	Return if we are buffering
	xuijs.XuiVideo.prototype.IsBuffering = function()
	{
		return this.video.isBuffering();
	}
	
	xuijs.XuiVideo.prototype.updateSelf = function(deltaTime)
	{
		xuijs.XuiVideo.prototype.parentPrototype.updateSelf.call(this,deltaTime);
		this.video.update(deltaTime);
	};
	
	// Named Frame
	xuijs.NamedFrame = function(name, time, command, commandTarget)
	{
		this.name = name;
		this.time = time;
		this.command = command;
		this.commandTarget = commandTarget;
	};
	xuijs.NamedFrame.CommandType = {
		PLAY: "play",
		STOP: "stop",
		GOTO: "goto",
		GOTO_AND_PLAY: "gotoandplay",
		GOTO_AND_STOP: "gotoandstop",
	};
	
	
	
} );