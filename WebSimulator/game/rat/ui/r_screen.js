//
//	Single screen class.
//	See r_screenmanager for screen stack management (I moved things around)
//
//	TODO:  
//		This and rat.screenManager should be in rat.ui folder,
//		and this class should be in rat.ui namespace, or at least just rat.Screen

//----------------------------
//	Screen
rat.modules.add( "rat.ui.r_screen",
[
	{ name: "rat.utils.r_utils", processBefore: true },
	{ name: "rat.ui.r_ui", processBefore: true },
	{ name: "rat.graphics.r_graphics", processBefore: true },
	
	"rat.ui.r_ui_shape",
	"rat.ui.r_screenmanager",
	"rat.input.r_input",
	"rat.input.r_inputmap",
], 
function(rat)
{
	/**@constructor
	 * @extends rat.ui.Element
	 * @param {?} shapeType */
	rat.ui.Screen = function ( shapeType )	//	unused param?  Huh?
	{
		rat.ui.Screen.prototype.parentConstructor.call(this); //	default init
		this.setBounds(0, 0, rat.graphics.SCREEN_WIDTH, rat.graphics.SCREEN_HEIGHT);
	};
	rat.utils.inheritClassFrom(rat.ui.Screen, rat.ui.Element);

	//	Default class properties (DO NOT ADD OBJECTS/ARRAYS HERE!  THEY BECOMRE STATIC!)
	rat.ui.Screen.prototype.modal = false;
	rat.ui.Screen.prototype.inputMap = null;	//	optional inputmap for key/controller inputs
	
	//	simple alternative to inputmaps - also optional.
	//	This is a list of current targets for all users, not a list of possible targets
	rat.ui.Screen.prototype.targets = null;
	
	rat.ui.Screen.prototype.allowClickAway = false;	//	allow a click outside the screen to dismiss it.  useful for touch UI.
	rat.ui.Screen.prototype.allowBackClose = false;	//	automatically support 'back' ui button (e.g. ESC key) to close a window, like clickAway
	//	Variables modified and managed via the screen manager
	rat.ui.Screen.prototype.isDeactivated = true;	//	Screens do not start active.
	rat.ui.Screen.prototype.isOverlay = true;		//	Old functionality seems to indicate that all screens were overlay screen
	rat.ui.Screen.prototype.isSuspended = true;	//	screen start suspended.
	rat.ui.Screen.prototype.savedTarget = void 0;	//	When the current target gets saved, save it here.

	//	Add a prop to screen to support the old var name fullOpaque which is the reverse of isOverlay
	rat.utils.addProp(rat.ui.Screen.prototype, 'fullOpaque',
		function (v)
		{
			this.setOverlay( !v );
		},
		function ()
		{
			return !this.isOverlay;
		});

	//	Cleanup the screen
	rat.ui.Screen.prototype.destroy = function()
	{
	};

	/// Set if this screen is currently an overlay screen
	rat.ui.Screen.prototype.setOverlay = function (isOverlay)
	{
		this.isOverlay = isOverlay;
	};

	/// Deactivate this screen if is is not already deactivated
	rat.ui.Screen.prototype.deactivate = function (options)
	{
		if (options === true)
			options = { allowOnlySuspend: true };
		else
			options = options || {};
		
		//	Handle a "light" deactivate
		if (!this.isSuspended)
		{
			this.isSuspended = true;
			if (this.screenSuspend)
			{
				this.screenSuspend();
			}
		}

		//	Only suspend only works if the screen HAS a suspend
		if (options.allowOnlySuspend && this.screenSuspend)
			return;

		//	Now deactivate
		if (!this.isDeactivated)
		{
			this.isDeactivated = true;
			if (this.screenDeactivate)
			{
				this.screenDeactivate();
			}
		}	
	};

	/// Activate this screen if is is not already active
	rat.ui.Screen.prototype.activate = function ()
	{
		if (this.isDeactivated)
		{
			this.isDeactivated = false;
			if (this.screenActivate)
			{
				this.screenActivate();
			}
		}

		//	Don't forget to resume
		if (this.isSuspended)
		{
			this.isSuspended = false;
			if (this.screenResume)
			{
				this.screenResume();
			}
		}
	};

	rat.ui.Screen.prototype.setModal = function (isModal)
	{
		this.modal = isModal;
	};
	rat.ui.Screen.prototype.isModal = function ()
	{
		return this.modal;
	};

	rat.ui.Screen.prototype.setAllowClickAway = function (allowClickAway)
	{
		this.allowClickAway = allowClickAway;
	};
	rat.ui.Screen.prototype.setAllowBackClose = function (allowBackClose)
	{
		this.allowBackClose = allowBackClose;
	};

	//	expand me to full screen display
	rat.ui.Screen.prototype.expandToDisplay = function ()
	{
		this.setPos(0, 0);
		this.setSize(rat.graphics.SCREEN_WIDTH, rat.graphics.SCREEN_HEIGHT);
	};
	
	//	center me in full screen display
	rat.ui.Screen.prototype.centerInDisplay = function ()
	{
		var size = this.getSize();
		var x = Math.floor((rat.graphics.SCREEN_WIDTH - size.w)/2);
		var y = Math.floor((rat.graphics.SCREEN_HEIGHT - size.h)/2);
		this.setPos(x, y);
	};
	
	//	position me in standard good spot for popup (top 1/3 of screen)
	rat.ui.Screen.prototype.centerHighInDisplay = function ()
	{
		var size = this.getSize();
		var x = Math.floor((rat.graphics.SCREEN_WIDTH - size.w)/2);
		var y = Math.floor((rat.graphics.SCREEN_HEIGHT - size.h)/3);
		this.setPos(x, y);
	};
	
	//	Set this element as the current direct input target for this screen.
	//	e.g. if the user clicked directly on an edittext box,
	//	that should be the current input target.
	//	If we have an inputmap, use that.
	//	It's OK to pass a null new target, to clear any current target.
	rat.ui.Screen.prototype.setCurrentTarget = function (newTarget, sourceEvent) {
		if (this.inputMap) {
			this.inputMap.focusByButton(newTarget, true);
		} else {
			//	simpler direct target support... (only semi-tested)
			//	This is for when somebody sets up a screen without an input map, but it does have
			//	things in it like edit text boxes, and they need to become a target for keyboard inputs!
			if (!this.targets)
				this.targets = [];
			//	todo: check input index from sourceEvent, if any.
			var oldTarget = this.targets[0];
			if (oldTarget && oldTarget !== newTarget)
			{
				if (oldTarget.Blur)
					oldTarget.Blur();
				else if (oldTarget.blur)
					oldTarget.blur();
			}
			this.targets[0] = newTarget;
			if (newTarget && newTarget !== oldTarget)
				newTarget.focus();
		}
		
	};
	
	//	return this screen's current target (or null if none)
	rat.ui.Screen.prototype.getCurrentTarget = function (inputIndex) {
		inputIndex = inputIndex || 0;
		if (this.inputMap)
			return this.inputMap.getTarget();
		else {
			if (this.targets && this.targets[inputIndex])
				return this.targets[inputIndex];
		}
		return null;
	}
	
	//	Save the current target.
	rat.ui.Screen.prototype.saveCurrentTarget = function () {
		if (this.inputMap) {
			this.savedTarget = this.inputMap.map[this.inputMap.index];
		}
	};

	//	Restore the saved target (if there isn't one, select the first)
	rat.ui.Screen.prototype.restoreSavedTarget = function () {
		if (!this.inputMap)
			return;
		var index = 0;
		var saved = this.savedTarget;
		this.savedTarget = void 0;
		if (saved) {
			var map = this.inputMap.map;
			for (var testIndex = 0; testIndex !== map.length; ++testIndex) {
				if (map[testIndex] === saved) {
					index = testIndex;
					break;
				}
			}
		}
		this.inputMap.focusButton(index, true);
	};

	rat.ui.Screen.prototype.handleUIInput = function (event)
	{
		function isUIDirection(which)
		{
			if (which === 'up' || which === 'down' || which === 'left' || which === 'right' || which === 'enter')
				return true;
			else
				return false;
		}

		//console.log("screen ui " + event.which);

		//	See if we have an input map.  If so, handle direction inputs nicely
		//	TODO:  We're ignoring ratInputIndex here?
		//	only give inputMap UI navigation events, and only directions.
		//	we handle 'enter' key presses ourselves in button event handling code.
		if (this.inputMap && event.eventType === 'ui' && isUIDirection(event.which))
		{
			//	KLUDGE:  This is temp... translate 'enter' to 'select'
			//	note that I'm going to remove that entirely from this solution, as soon as I have targeting working,
			//	since I want that to be handled elsewhere.
			if (event.which === 'enter')
				event.which = 'select';
			return this.inputMap.handleDirection(event.which);
		} else if (event.which === 'back' && this.allowBackClose)
		{
			rat.screenManager.popScreen();
			return true;    //  handled (closed)
		}
		return false;
	};
	
	//	handle some keys specially.
	rat.ui.Screen.prototype.handleKeyDown = function (ratEvent)
	{
		//	could invent a new ui input concept of "next targetable input" and "previous targetable input" events.
		//	But let's just do this for now - keyboard tab support is standard.
		if (ratEvent.which === rat.keys.tab && this.inputMap) {
			return this.inputMap.handleTab(ratEvent);
		}
		
		//	inherited behavior
		return rat.ui.Screen.prototype.parentPrototype.handleKeyDown.call(this, ratEvent);
	};

	//	Some functions related to building inputmap.
	//	Probably move this to another module.
	//	Maybe inputmap itself, or a new module specifically for constructing inputmaps or otherwise processing screen layout
	var targetList;
	
	function addToList()
	{
		//	OK to use "this" here?  this function is being called with "call", so it should be OK.
		//	Seems to work.
		var el = this;
		if (el.isTargetable() && el.isEnabled() && el.isVisible())
		{
			var entry = {
				globalPos: el.getGlobalPos(),
				rect: el.getBounds(el.tempRect),
				el: el
			};
			entry.pos = {
				x: entry.globalPos.x + entry.rect.w / 2,
				y: entry.globalPos.y + entry.rect.h / 2,
			};
			targetList.push( entry );
		}
	}

	//	do a single pass looking for best option in one direction.
	function singlePass(skipIndex, startPos, skipMe, searchAngleRatio, dir, directionPreference)
	{
		var bestDist = 0;
		var bestIndex = -1;
		var arcSize = 1 / searchAngleRatio;
		for (var i = 0; i !== targetList.length; ++i)
		{
			//	don't target self?
			if (skipMe && i === skipIndex)
				continue;

			var e = targetList[i];
			var tpos = e.pos;

			var dx = tpos.x - startPos.x;
			var dy = tpos.y - startPos.y;
			var arcSizeDy = (dy < 0 ? -dy : dy) * arcSize;
			var arcSizeDx = (dx < 0 ? -dy : dx) * arcSize;

			//	this value is somewhat arbitrary - it narrows the size of our arc,
			//	by increasing the opposite direction we're competing against...
			//	arcSize 1 = 45-degree angle, 2 = narrow
			//	so, convert from "searchAngleRatio" to arcSize
			if ( (dir === 'right' && dx > 0 && dx > arcSizeDy) ||
				 (dir === 'left' && dx < 0 && -dx > arcSizeDy) ||
				 (dir === 'down' && dy > 0 && dy > arcSizeDx) ||
				(dir === 'up' && dy < 0 && -dy > arcSizeDx) )
			{
				//	experiment:  I don't want to narrow the arc too tight and eliminate buttons,
				//	but let's give a higher weight to the x/y value that matches the direction we're looking,
				//	e.g. if we're looking left, count x values as closer than y values.
				//	e.g. if directionPreference is 2, then we count aligned directions twice as strongly
				//	Initial tests are good.  This is an effective approach.
				if (dir === 'right' || dir === 'left')
					dx /= directionPreference;
				else
					dy /= directionPreference;

				var dist2 = dx * dx + dy * dy;
				if (bestIndex < 0 || dist2 < bestDist)
				{
					bestIndex = i;
					bestDist = dist2;
				}
			}
		}

		return bestIndex;
	}

	function findNearestTargetInDirection(skipIndex, pos, dir, searchAngleRatio, directionPreference, wrapHoriz, wrapVert, screen)
	{
		//	do our first pass normally - look from where we are in the given direction.
		var bestIndex = singlePass(skipIndex, pos, true, searchAngleRatio, dir, directionPreference);

		//	if near button not found, and we support wrapping around,
		//	search a second time with our point reset to the appropriate opposite edge.
		if (bestIndex < 0 && (wrapHoriz || wrapVert))
		{
			//	important:  This needs to happen in global space, like everything else here,
			//	and keeping in mind the fact that the screen may not be at 0,0.
			//var screenPos = screen.getGlobalPos();
			//	hmm...  to get to opposite side, just add/subtract screen size.
			//	this puts us PAST the edge, which is good anyway, since it gives us leeway for our arc check to find things nearby,
			//	instead of starting right at the edge and not finding reasonably nearby stuff.
			//	If you do want to change that, you'll need screenPos above, to be in the right global space.

			//	Note:  This does not currently work well at all with buttons inside a big scrollview.
			//		In that case, what we really should be doing is factoring in the content size of the scrollview,
			//		but that's complicated here since we're in GLOBAL space, not parent content space, and who knows how many levels up
			//		the scrollview might be...  Find a way to fix this.

			var pos2 = { x: pos.x, y: pos.y };
			//	wrap
			if (dir === 'right' && wrapHoriz)
				pos2.x -= screen.size.x;	//	left edge
			if (dir === 'left' && wrapHoriz)
				pos2.x += screen.size.x;	//	right edge
			if (dir === 'down' && wrapVert)
				pos2.y -= screen.size.y;	//	top edge
			if (dir === 'up' && wrapVert)
				pos2.y += screen.size.y;	//	bottom edge

			//	This is subtle, but when wrapping, this button might really be its own best target,
			//		rather than another button near it.
			//		For instance, imagine a simple aligned column of buttons...
			//		you'd want left/right wrapping to just go to the same button rather than one above/below it.
			//	So, when wrapping, allow me to be my own target, if that really does turn out best.

			//	do second (wrapped) pass
			bestIndex = singlePass(skipIndex, pos2, false, searchAngleRatio, dir, directionPreference);
		}

		//	did we get something with either pass?
		if (bestIndex >= 0)
		{
			return targetList[bestIndex].el;
		}

		return null;
	}

	//	given a bunch of elements inside this screen,
	//	build an input map automatically based on positions.
	//	Notable issues: the positioning relies on e.size,
	//		so if an element's size is image-based,
	//		and the image has not yet fully loaded by the time this function
	//		is called, the size ends up being 0,0 and causing issues
	rat.ui.Screen.prototype.autoBuildInputMap = function (wrapHoriz, wrapVert, searchAngleRatio, directionPreference)
	{
		var screen = this;
		this.inputMap = null;
		
		if (!this.subElements)	//	no controls at all, don't bother
			return;
		
		//	some argument defaults
		if (wrapHoriz === void 0)
			wrapHoriz = true;
		if (wrapVert === void 0)
			wrapVert = true;
		if (searchAngleRatio === void 0)
			searchAngleRatio = 1;	//	see below - specify a large searchAngleRatio to allow nearby buttons to be tested at all.
		if (directionPreference === void 0)
			directionPreference = 2;	//	see below
		
		//	build target list first, recursively.
		targetList = []; // This is a hidden variable so it can be exposed to other functions in this file
	
		this.applyRecursively(addToList, targetList);
		if (targetList.length <= 0)
			return;
		
		//	now check each control, looking for up/left/right/down controls.
		var map = [];
		for (var i = 0; i < targetList.length; i++)
		{
			var e = targetList[i];
			var entry = {currObj : e.el};
			var pos = e.pos;//getGlobalPos();
			//pos.x += e.getBounds().w / 2;
			//pos.y += e.getBounds().h / 2;
			
			entry.up = findNearestTargetInDirection(i, pos, 'up', searchAngleRatio, directionPreference, wrapHoriz, wrapVert, screen);
			entry.down = findNearestTargetInDirection(i, pos, 'down', searchAngleRatio, directionPreference, wrapHoriz, wrapVert, screen);
			entry.left = findNearestTargetInDirection(i, pos, 'left', searchAngleRatio, directionPreference, wrapHoriz, wrapVert, screen);
			entry.right = findNearestTargetInDirection(i, pos, 'right', searchAngleRatio, directionPreference, wrapHoriz, wrapVert, screen);
			
			map.push(entry);
			
			//	and keep track of where that went, for temp use in tab order below...
			e.mapEntry = entry;
			
			//console.log("map " + i);
			//console.log(entry);
		}
		//	create that input map (and try to guess at correct default)
		var defaultItem = -1;
		if (rat.input.useLastUIInputType && (rat.input.lastUIInputType === 'keyboard' || rat.input.lastUIInputType === 'controller'))
			defaultItem = 0;
		
		//	Set up default tab order based on screen layout.
		//	left-to-right and top to bottom.
		//	basically, we just need to sort our target list...
		//	A more sophisticated version would maybe check angles and arcs and things like the above.  *sigh*
		targetList.sort(function(a, b)
			{
				if (a.pos.y < b.pos.y)
					return -1;
				else if (a.pos.y > b.pos.y)
					return 1;
				else {
					if (a.pos.x < b.pos.x)
						return -1;
					return 1;
				}
			}
		);
		for (var i = 0; i < targetList.length; i++)
		{
			var t = targetList[i];
			t.mapEntry.tabOrder = i;
			
			//console.log("" + i + ": " + t.pos.x + "," + t.pos.y + "    " + t.el.name);
		}
		
		//	create inputmap object with that mapping.
		this.inputMap = new rat.InputMap(map, defaultItem);
		
		//	temp debug:
		//this.inputMap.dumpList();
		
		/*
		//	for now, let's pretend they're vertical, just to get things going!
		//	reference:
		//  var buttonBack = { currObj: this.backButton, down: this.adsButton, right: this.adsButton }
		//  var buttonAds = { currObj: this.adsButton, up: this.backButton, left: this.backButton }
		//  var map = [buttonBack, buttonAds]

		var map = [];
		for (var i = 0; i < targetList.length; i++)
		{
			var up = null;
			var down = null;
			if (i > 0)
				up = targetList[i-1];
			else
				up = targetList[targetList.length-1];
			if (i < targetList.length-1)
				down = targetList[i+1];
			else
				down = targetList[0];
			var entry = {currObj : targetList[i], up: up, down: down};
			map.push(entry);
		}
		this.inputMap = new rat.InputMap(map, -1);
		*/

		targetList = void 0;

		return this.inputMap;
	};

	//	OK, here's some trickiness.
	//	Until we have a functional "target" system, I'm going to do this.
	//	Look for a scroll view inside this screen.  Is there one?  If so, send mouse wheel events to that.  :)
	//	If you need different behavior in your screen, just override this function.
	
	//	STARTING OVER ON THIS:
	//		mouseWheel is sent to a visual target now, like clicks.
	//		you can still override this in your screen and redirect for yourself, if you like,
	//		e.g. let the user scroll a view when they're not OVER it.
	//		but by default, you scroll what you're hovering over, like most UI systems.
	/*
	rat.ui.Screen.prototype.handleMouseWheel = function (pos, ratEvent)
	{
		var found = this.applyRecursively(function ()
		{
			if (this.elementType === 'scrollView')
				return this;
			return false;
		});

		if (found)
			return found.handleMouseWheel(ratEvent);
		return false;
	};
	*/
});