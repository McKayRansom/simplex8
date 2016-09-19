//
//	UI support (for game UI and for general graphics usefulness)
//
//	This module defines the rat.ui space and the rat.ui.Element class.
//	Subclasses are defined in their own modules, but this module is still big and complicated
//		because the ui.Element class handles a ton of ui functionality all at the base class level.
//	DIRTY and OFFSCREEN
//		The offscreen system is a way to optimize rendering - if an element is not changing every frame, then
//		it's faster to render changes once to an offscreen canvas,
//		and then render that canvas from then on whenever the ui element is drawn.
//		
//		So, we support setting a "useOffscreen" flag on any element.
//
//		We then need to keep track of when the offscreen render needs updating, so this is what the "Dirty" flag is for.
//		A ton of different actions can potentially set the dirty flag for a given element.  It depends on the element.
//		For instance, highlighting a button makes it dirty.  Changing text makes a textbox dirty.
//
//		The actual rendering of the offscreen buffer happens right before an element normally needs to be drawn
//		(in the "draw" function below)
//		This is a good place because it means a dirty flag can get set by lots of operations,
//		but the offscreen re-render (which we assume is expensive) only happens once.
//
//		There are all kinds of subtle aspects of this process.  It's tricky.  See implementation below.
//		Because it may not always be exactly what you want, offscreen rendering is off by default.
//		It is assumed that each game will turn this flag on on a case-by-case and element-by-element basis,
//		and confirm that the desired results are achieved.
//
//		Offscreen support is also not 100% implemented yet.
//		It's not working yet for scrollviews, and in some cases like rotation, I suspect...?
//		It's working for containers, buttons, and text boxes, assuming these don't have custom code that fails to setDirty() properly,
//		and assuming they don't contain something that also fails to setDirty() properly.
//
//		But where it does work, it works nicely.  It's really easy to turn on for a container and get an immediate performance boost.
//
//		rat.ui.debugOffscreens = true
//		will turn on a really neat visual debug indication of where offscreen buffers are being used, and when they change.
//
//

//	TOOLTIPS
//		Why doesn't my tooltip show up?
//			* Is your element enabled and visible?
//			* Is it the kind of element that already tracks mouse movement (e.g. button)?  If not, you'll need to explicitly call setTracksMouse(true)
//			* you either need to explicitly set an element's toolTipScreen value to the top-level screen it's in,
//				or make sure the tooltip is added AFTER the element is added to its screen.  See below.

//	CENTERING:
//		Currently, the way this works is we track a separate center offset (x and y) (basically, an anchor)
//		When drawing, we include that offset.  When calculating things like bounds, we include that offset.
//		A different approach would be to only center once when an element is being set up, e.g. when autoCenter is called.
//			In that case, we'd immediately change this.place.pos, and move on, and never look at centering again.
//			Pros:
//				* Less math and fiddling with "center" value later!
//			Cons:
//				* Basically, any rotation gets WAY harder and uglier if we don't have an anchor concept.
//					e.g. animating rotation over time.  Really need this concept of centering for rotation to work nice.
//				* It's also nice to center things and not worry about how big they are later, e.g. when moving them around
//
//			Note that we already do the one-time approach in some functions like centerInParent.
//			I think the *ideal* thing would maybe be to rename most of these "center" things to "anchor".
//
//		Centering is currently broken with bubblebox buttons - doesn't call autocenter on its children.  should it?  see below.
//		Centering is currently broken with clipping
//
//		What we OUGHT to do is apply center.x and center.y in draw() below, in the translate call.
//		Why don't we?
//	
//		Also, I think local/global conversions don't handle center very well or consistently.
//
//	TODO:
//		* Fix all use of global ctx in various ui modules
//		* some functions to auto-distribute sub-elements spatially inside an element.
//
//------------------------------------------------------------------------------------
rat.modules.add( "rat.ui.r_ui",
[
	{ name: "rat.os.r_events", processBefore: true },
	{ name: "rat.graphics.r_offscreen", processBefore: true },
	
	"rat.debug.r_console",
	"rat.os.r_system",
	"rat.math.r_vector",
	"rat.graphics.r_graphics",
	"rat.utils.r_shapes",
	"rat.ui.r_ui_animator",
	"rat.math.r_math",
	"rat.utils.r_collision2d",
	"rat.ui.r_ui_textbox",
	"rat.ui.r_ui_edittext",
	"rat.ui.r_ui_data",
	"rat.utils.r_eventmap"
], 
function(rat)
{
    // @namespace
	rat.ui = {};

	rat.ui.TOOL_TIP_TIME = 0.5;
	rat.ui.nextElementID = 1;	//	incrementing unique ID for each element we create
	rat.ui.mouseMoveCallCount = 0;	//	debug
	rat.ui.updateCallCount = 0;	//	debug
	
	rat.ui.debugOffscreens = false;	//	global offscreen debug display system which is pretty awesome
	//	global disable for rat ui system offscreen usage!  This is important for systems like Wraith,
	//	where offscreen canvas rendering is not yet supported.
	//	This is a good flag for game-specific offscreen rendering to check as well.
	//	Allowed by default, of course.
	rat.ui.allowOffscreens = true && rat.Offscreen.allowOffscreens;
	
	//------------------------------------------------------------------------------------
	//	basic ui element.

	//	constructor for ui Element
	/**
	 * @constructor
	 * @param {Object=} parent - optional parent object
	*/
	rat.ui.Element = function (parent)
	{
		//	Have we already been constructed?
		//	This can happen with diamond inheritance
		//	See r_ui_fillSprite
		if (this.id !== void 0)
			return;

		//console.log("Element cons");
		this.id = rat.ui.nextElementID++;
		//	consider:  also set a 'uniqueID' property that doesn't change, so ALL panes have some truly unique identifier, which is needed in a few cases.
		//		(use the same initial value, since nextElementID is unique)
		
		///@todo	replace with standard position tracker object...  (pos + rot)
		this.place = new rat.Position(0, 0, 0);
		this.center = new rat.Vector(0, 0); //	default to draw from upper left
		this.color = new rat.graphics.Color(); //	dang, this is useless for images, currently... TODO: set to null and only set if needed.
		this.size = new rat.Vector(0, 0);
		this.scale = new rat.Vector(1, 1); 	//	overall scale for rendering and interacting with content.
		this.opacity = 1.0;

		this.tempRect = new rat.shapes.Rect();

		this.contentOffset = new rat.Vector(0, 0);	//	for scrolling internal content around
		this.contentSize = new rat.Vector(0, 0);	//	for limiting scrolling and other stuff
		this.contentScale = new rat.Vector(1, 1);	//	scaling content, e.g. zoom
		this.contentScaleMin = new rat.Vector(0.1, 0.1);
		this.contentScaleMax = new rat.Vector(10, 10);

		this.flags = 0;
		this.flags |= rat.ui.Element.enabledFlag;	//	everything is enabled by default
		this.flags |= rat.ui.Element.visibleFlag;	//	everything is visible by default
		this.flags |= rat.ui.Element.adjustForScaleFlag;	//	normally, some element subclasses will try to fix bugs that come up when scaled
		
		//	TODO: most elements should NOT have tracksmouse flag set.
		//	If you're an interactive element, you must set this yourself.
		this.flags |= rat.ui.Element.tracksMouseFlag;	//	most elements track mouse.  we'll clear this on a case by case basis.
		
		
		this.name = "<elem>" + this.id; //	name is useful for debugging

		this.command = 0;	//	for triggering, e.g. buttons
		this.commandInfo = 0;

		this.callback = null;	//	call this when element is "hit" or triggered, or whatever.  like command, above.
		this.callbackInfo = null;
		//	see also flagsChangedCallback

		this.events = {};

		this.frameWidth = 0;
		this.frameColor = new rat.graphics.Color(0, 0, 0);
		this.frameOutset = 0;	//	push frame out a bit - helps with thick frames around content

		//	optional offscreen rendering optimization
		this.offscreen = null;
		this.useOffscreen = false;
		this.isDirty = true;	//	offscreen always dirty when first created
		
		//	update optimization - we assume everybody wants an update,
		//	but you can turn this off on a per-object basis, to disable updating for the pane and all subelements.
		//	It's generally expected that you would turn this off in your updateSelf() function, or externally.
		//	Turn off on single objects at a time.  Their parents will figure out if they can turn themselves off as well.
		//	But when you turn ON the flag, you need to call setNeedsUpdate(), so it can reenable the whole parent chain.
		//	See update() and setNeedsUpdate() below.
		//	Note that this whole system is not generally used in rat games, currently - but IS used in the Xui system,
		//	So, it's easy to ignore this stuff entirely and only dig into it if you feel you need to optimize update calls
		//	for a complex game/scene.
		this.needsUpdate = true;

		//this.subElements = undefined
		//this.palette = undefined

		if (parent)
		{
			parent.appendSubElement(this);
		} else
			this.parent = null;
		
		this.toolTip = null;
		
		//	TODO:  We should probably switch this around and say
		//	NO elements track mouse by default,
		//	and then only set it for the ones that do.
		//	elements themselves don't generally track mouse.
		//	but we don't know if this constructor is being called for some subclass...
		//this.setTracksMouse(false);
		
	};
	rat.ui.Element.prototype.elementType = 'element';	//	various subclasses change this

	//	state flags for elements
	rat.ui.Element.highlightedFlag = 0x0001;	//	highlighted, e.g. being moused over
	rat.ui.Element.enabledFlag = 0x0002;		//	enabled (can be highlighted, targeted, pressed)
	rat.ui.Element.pressedFlag = 0x0004;		//	is currently being pressed
	rat.ui.Element.toggledFlag = 0x0008;		//	is toggled (for things that have a toggle)
	rat.ui.Element.visibleFlag = 0x0010;		//	is visible (draws in standard draw process)
	rat.ui.Element.clipFlag = 0x0020;			//	should we clip to our bounds when drawing?
	rat.ui.Element.targetableFlag = 0x0040;		//	targetable (in input map, for example)
	rat.ui.Element.targetedFlag = 0x0080;		//	is currently a target for input (not the same as highlighted)

	rat.ui.Element.mouseInFlag = 0x0100;	//	mouse is currently in my bounds (useful for tooltips)
	rat.ui.Element.trackingMouseDownFlag = 0x0200;	//	actively tracking mouse down
	rat.ui.Element.tracksMouseFlag = 0x0400;	//	track mouse at all.  If false, don't even try to track.

	//	tracksmouse is different from enabled.  !tracksmouse means don't even process mouse.
	//	enabled might change over time, unlike tracksmouse, and we might track disabled elements for things like tooltips?
	//	tracksmouse indicates whether this element should care at all about tracking mouse down or mouse movement.
	//	if tracksmouse is false, the element won't get clicks at all, and will never have trackingMouseDownFlag set.
	//	Only some elements (interactive ones like buttons) have tracksmouse set by default.
	
	rat.ui.Element.autoSizeAfterLoadFlag = 0x1000;	//	after loading, set our size to match content
	rat.ui.Element.autoCenterAfterLoadFlag = 0x2000;	//	after loading, automatically center content (not finished)
	rat.ui.Element.autoScaleAfterLoadFlag = 0x4000;	//	after loading, automatically scale so content matches existing size
	
	rat.ui.Element.adjustForScaleFlag = 0x00010000;	//	some elements need to fiddle with rendering to make them look good when scaled.  See BubbleBox
	
	rat.ui.Element.drawTiledFlag = 0x00100000;	//	automatically draw me tiled.  Useful for sprites, if nothing else.
	
	//	by default, no flag changes should set me dirty, because my look doesn't change when my flags change.
	//	even "visible", because that just means I don't get drawn at all!
	//	We may want to add something here, though, like the clip flag?  Not sure about that one yet.
	//	This is an inheritable property that various classes can change.  E.g. buttons display differently based on flags!
	rat.ui.Element.prototype.flagsThatDirtyMe = 0;
	
	//	on the other hand, some flags should always dirty my parent, like "visible".
	//	This may actually be the only one?  note that flagsthatdirtyme above also applies to parents,
	//	so this list is just flags that dirty parent that aren't already included in flagsThatDirtyMe...
	rat.ui.Element.prototype.flagsThatDirtyParent = rat.ui.Element.visibleFlag;
	
	rat.ui.Element.prototype.appendSubElement_unsafe = function (g)
	{
		//	add to sub elements
		if (!this.subElements)
			this.subElements = [g];
		else
			this.subElements.push(g);

		//	and set parent for this subelement
		g.parent = this;
		
		//	fix up tooltip parentage, if needed
		if (g.toolTip && g.toolTipScreenWasAssumed)
			g.toolTipScreen = g.getTopParent();
		
		this.setDirty(true);	//	we're certainly dirty now
		
		//	the thing added to us may need update (or may not understand needsUpdate system),
		//	so give it a chance by reenabling this whole tree's updates for the next time through.
		this.setNeedsUpdate(true);
	};

	//	add sub elements to this element
	rat.ui.Element.prototype.appendSubElement = function (g)
	{
		//	debug:
		if (this.findSubElementByID(g.id, false))
		{
			rat.console.logOnce("WARNING: appending subelement with duplicate ID:  " + g.id, 'dupID');
		}
		
		this.appendSubElement_unsafe(g);
	};

	//	insert sub element in this element, before a given index
	rat.ui.Element.prototype.insertSubElement = function (g, beforeIndex)
	{
		//	debug:
		if (this.findSubElementByID(g.id))
		{
			rat.console.logOnce("WARNING: appending subelement with duplicate ID:  " + g.id, 'dupID');
		}

		if (beforeIndex === void 0)
			beforeIndex = 0;
		//	add to sub elements
		if (!this.subElements)
			this.subElements = [g];
		else
			this.subElements.splice(beforeIndex, 0, g);
		//	and set parent for this subelement
		g.parent = this;
		
		this.setDirty(true);
	};
	
	//	insert sub element before another element
	rat.ui.Element.prototype.insertSubElementBefore = function (g, beforeElement)
	{
		var index = this.getSubElementIndex(beforeElement);
		if (index < 0)
		{
			rat.console.logOnce("ERROR: attempting insert before element not in tree: " + beforeElement.id, 'noBeforeElem');
			index = 0;
		}
		
		this.insertSubElement(g, index);
	};
	
	//	get this element's parent pane
	rat.ui.Element.prototype.getParent = function ()
	{
		return this.parent;
	};
	
	//	get the most-parent parent of this pane.
	//	walk through parentage until we find a pane with no parent.
	rat.ui.Element.prototype.getTopParent = function ()
	{
		var elem = this; // Start from the current element, and find the root element.
		while (elem.parent)
			elem = elem.parent;
		return elem;
	};

	//	remove a sub element by id
	//	including a recursive check
	//	note that this and all the other "removesub" functions don't clear parent ref for the removed item.
	//	todo: should they?  probably...
	rat.ui.Element.prototype.removeSubElementByID = function (id)
	{
		if (this.subElements)
		{
			var i;
			for (i = 0; i < this.subElements.length; i++)
			{
				if (this.subElements[i].id === id)
				{
					//	some cleanup function?
					this.subElements.splice(i, 1);
					this.setDirty(true);
					return true;
				}
			}

			//	not found? look recursively deeper.
			for (i = 0; i < this.subElements.length; i++)
			{
				if (this.subElements[i].removeSubElementByID(id))
				{
					this.setDirty(true);
					return true;
				}
			}
		}

		return false;
	};

	//	remove a sub element by object reference
	//	recursive (see above)
	rat.ui.Element.prototype.removeSubElement = function (element)
	{
		return this.removeSubElementByID(element.id);
	};

	//	remove this element from its own parent
	rat.ui.Element.prototype.removeFromParent = function ()
	{
		if (typeof this.parent !== 'undefined')
			this.parent.removeSubElement(this);
	};

	//	Detach all of my children from me.  Returns the array of gfx
	rat.ui.Element.prototype.detachAllChildren = function ()
	{
		var detached = this.subElements || [];
		this.subElements = void 0;

		for (var index = 0; index !== detached.length; ++index)
			detached[index].parent = null;
		
		this.setDirty(true);
		
		return detached;
	};

	//	remove all subelements of this element
	rat.ui.Element.prototype.removeAllSubElements = function (killMe)
	{
		if (this.subElements)
		{
			for (var i = 0; i < this.subElements.length; i++)
			{
				this.subElements[i].removeAllSubElements(true);	//	kill subelements even if we ourselves are not dying
			}
		}

		if (killMe)
		{
			//console.log("try to kill...");
			//	clear stuff?  animators are sort of external to me, actually.  What do we kill here?
			//	maybe find animators that drive me (look them up) and kill them.  Yeah.  TODO.
			this.killMyAnimators();
		}

		this.subElements = [];
		
		this.setDirty(true);

		//	OLD
		//this.subElements = [];
		//	this is pretty simple for now, but in the future we might need to clear parent refs,
		//	and stuff.  It would be nice to kill animators, for instance, which have callbacks...
		//	which would make this more complex and would possibly need to be recursive?
	};

	rat.ui.Element.prototype.killMyAnimators = function ()
	{
		rat.ui.killAnimatorsForElement(this);
	};

	//	find a sub element by id
	/**
	 * @param {?} id
	 * @param {boolean=} recursive
	 */
	rat.ui.Element.prototype.findSubElementByID = function (id, recursive)
	{
		if (recursive === void 0)
			recursive = true;
		//	search my sub elements.
		var res;
		var elem;
		if (this.subElements)
		{
			for (var i = 0; i !== this.subElements.length; ++i)
			{
				elem = this.subElements[i];
				if (!elem)
					continue;
				if (elem.id === id)
					return elem;
				if (recursive)
				{
					res = this.subElements[i].findSubElementByID(id, recursive);
					if (res)
						return res;
				}
			}
		}

		//	Not found i guess
		return void 0;
	};
	
	//	return a sub element by index
	/**
	 * @param {?} index
	 */
	rat.ui.Element.prototype.getSubElement = function (index)
	{
		if (!this.subElements || this.subElements.length < index)
			return null;
		return this.subElements[index];
	};
	
	//	return the index of this subelement.
	//	Probably an internal-use-only function!  This index is going to be valid only until the list next changes...
	//	return -1 if not found.
	rat.ui.Element.prototype.getSubElementIndex = function (elem)
	{
		if (this.subElements)
		{
			for (var i = 0; i < this.subElements.length; ++i)
			{
				var checkElem = this.subElements[i];
				if (checkElem === elem)
					return i;
			}
		}
		return -1;
	};
	
	//	return the number of my subelements
	rat.ui.Element.prototype.getSubElementCount = function (elem)
	{
		if (this.subElements)
			return this.subElements.length;
			
		return 0;
	};
	
	//	debug - dump info about this element and all subelements.
	//	return object with some extra info like total number of items...
	rat.ui.Element.prototype.dumpTree = function(depth, collectData)
	{
		if (typeof(depth) === 'undefined')
			depth = 0;
		
		var meVisible = this.isVisible();
		
		//	if we didn't get handed collectData, we're presumably first.  Initialize it.
		if (!collectData)
		{
			collectData = {
				lines : [],
				totalCount : 0,
				hiddenCount : 0,
				updateCount : 0,
				parentHidden : false,
			};
		}
		
		//	add my counts
		collectData.totalCount++;
		var oldTotal = collectData.totalCount;
		
		if (this.needsUpdate)
			collectData.updateCount++;
		
		//	if my parent was hidden, I count as hidden in totals
		if (!meVisible || collectData.parentHidden)
			collectData.hiddenCount++;
		
		//	set up my output line to reserve space, but don't fill it out yet.
		var myLineNumber = collectData.lines.length;
		collectData.lines.push("");
		
		//	now collect data from everybody under me
		if (this.subElements)
		{
			//	remember if our parent was hidden, but then set for all my children if I am hidden
			var parentWasHidden = collectData.parentHidden;
			if (!meVisible)
				collectData.parentHidden = true;
			if (this.useOffscreen)	//	if I'm an offscreen render, count my children as being under hidden parent
				collectData.parentHidden = true;
			
			for (i = 0; i < this.subElements.length; i++)
			{
				this.subElements[i].dumpTree(depth+1, collectData);
			}
			
			//	restore old hidden value
			collectData.parentHidden = parentWasHidden;
		}
		
		//	and set up my line
		var out = "";
		var i;
		for (i = 0; i < depth; i++)
		{
			out += "._";
		}
		var bounds = this.getBounds();
		
		//	convert bounds to short strings for more concise display
		bounds.x = "" + rat.math.floor(bounds.x * 100)/100;
		bounds.y = "" + rat.math.floor(bounds.y * 100)/100;
		bounds.w = "" + rat.math.floor(bounds.w * 100)/100;
		bounds.h = "" + rat.math.floor(bounds.h * 100)/100;
		
		//	add xui object subtype if it exists
		//	todo - function instead so other classes can do this as well,
		//	like "getSubTypeString()" or something
		var xuiTypeString = "";
		if (this.xuiElemType)
			xuiTypeString = " " + this.xuiElemType;
		
		//	add total subcount if there was one
		var subCountString = "";
		if (collectData.totalCount > oldTotal)
			subCountString = " subCount: " + (collectData.totalCount - oldTotal);
		
		var visString = (meVisible ? "Visible" : "Hidden");
		if (this.useOffscreen)
			visString = "Offscreen";	//	call this out specifically in the dump - sort of visible
		if (collectData.parentHidden)
			visString = "(" + visString + ")";	//	in some way show that we're actually hidden
		var upString = (this.needsUpdate ? "ups" : "noup");
		collectData.lines[myLineNumber] =
			out
			+ this.id + ":" + this.name
			+ xuiTypeString
			+ " : " + visString
			+ " : " + upString
			+ " : " + bounds.x + ", " + bounds.y + " (" + bounds.w + " x " + bounds.h + ")"
			+ subCountString
		
		//	and we're done
		return collectData;
	};

	//	set generic "color" property.  How this is used depends entirely on subclasses.
	//	The base element class doesn't use it for anything in particular,
	//	and doesn't draw a background by default.
	rat.ui.Element.prototype.setColor = function (c)
	{
		if (typeof(c) === "string")
			c = new rat.graphics.Color(c);
		this.color = c;
	};

	rat.ui.Element.prototype.setSize = function (w, h)
	{
		this.size.x = w;
		this.size.y = h;
		this.boundsChanged();
	};

	rat.ui.Element.prototype.setWidth = function (w)
	{
		this.size.x = w;
		this.boundsChanged();
	};

	/// Set the position and size of this element
	/**
	 * @param {number|Object} x
	 * @param {number=} y
	 * @param {number=} w
	 * @param {number=} h
	 */
	rat.ui.Element.prototype.setBounds = function (x, y, w, h)
	{
		if (x.x !== void 0)	//	support a single argument which is an object with x,y,w,h
		{
			this.place.pos.x = x.x;
			this.place.pos.y = x.y;
			this.size.x = x.w;
			this.size.y = x.h;
		}
		else	//	handle 4 arguments
		{
			this.place.pos.x = x;
			this.place.pos.y = y;
			this.size.x = w;
			this.size.y = h;
		}
		this.boundsChanged();
	};

	rat.ui.Element.prototype.setHeight = function (h)
	{
		this.size.y = h;
		this.boundsChanged();
	};

	rat.ui.Element.prototype.getSize = function ()
	{
		var theSize = {};
		theSize.x = this.size.x;
		theSize.y = this.size.y;
		theSize.w = this.size.x;	//	alternative names, for convenience
		theSize.h = this.size.y;
		return theSize;
	};

	rat.ui.Element.prototype.getWidth = function ()
	{
		return this.size.x;
	};

	rat.ui.Element.prototype.getHeight = function ()
	{
		return this.size.y;
	};

	//	content size is for managing scroll limits in a scrollview.
	//	most of the time, you want setSize()
	rat.ui.Element.prototype.setContentSize = function (w, h)
	{
		this.contentSize.x = w;
		this.contentSize.y = h;
	};

	//
	//	automatically calculate and set our content size from the position/size of all our subelements.
	//
	rat.ui.Element.prototype.setContentSizeFromSubElements = function ()
	{
		var space = this.calculateContentBounds();
		
		//	intentionally ignoring the potential for space.x and space.y to be other than 0
		//	we're just setting our SIZE here
		this.setContentSize(space.w, space.h);
	};
	
	//	automatically calculate the bounding space of our contained elements.
	//	including factoring in rotation.
	//	This assumes that each subelement bounding box is correct for that element
	rat.ui.Element.prototype.calculateContentBounds = function ()
	{
		var xmin = 9999;
		var xmax = -9999;
		var ymin = 9999;
		var ymax = -9999;
		
		for (var i = 0; this.subElements && i < this.subElements.length; i++)
		{
			var elem = this.subElements[i];
			var bounds = elem.getBounds(elem.tempRect);
			var basePos = elem.place.pos;	//	here's what we'd change if we had a "center"

			//	Handle rotation and scale.
			//if (1)//elem.place.rot.angle != 0)
			{
				//	probably wrong if we have a center offset...
				var cosa = Math.cos(elem.place.rot.angle);
				var sina = Math.sin(elem.place.rot.angle);
				
				//	for each point, transform by rotation of object and find if it changes our min/max x and y
				var checkP = function (x, y)
				{
					var xp = basePos.x + x * cosa - y * sina;
					var yp = basePos.y + x * sina + y * cosa;
					if (xp < xmin) xmin = xp;
					if (xp > xmax) xmax = xp;
					if (yp < ymin) ymin = yp;
					if (yp > ymax) ymax = yp;
				}
				checkP(0, 0);
				checkP(elem.size.x * elem.scale.x, 0);
				checkP(elem.size.x * elem.scale.x, elem.size.y * elem.scale.y);
				checkP(0, elem.size.y * elem.scale.y);
				
			}
		}
		
		return {x:xmin, y:ymin, w:xmax-xmin, h:ymax-ymin};
	};

	//	automatically reset our bounds to include all our content
	rat.ui.Element.prototype.setBoundsFromContent = function (borderSpace)
	{
		var space = this.calculateContentBounds();
		
		//	since space could have negative xy values here, we have to be prepared to
		//	reposition ourselves and shift all our subelements in the opposite direction to match!
		var bumpX = space.x - borderSpace;
		var bumpY = space.y - borderSpace;
		this.setPos(this.place.pos.x + bumpX, this.place.pos.y + bumpY);
		
		for (var i = 0; this.subElements && i < this.subElements.length; i++)
		{
			var elem = this.subElements[i];
			elem.setPos(elem.place.pos.x - bumpX, elem.place.pos.y - bumpY);
		}
		
		this.setSize(space.w + 2 * borderSpace, space.h + 2 * borderSpace);
	};

	rat.ui.Element.prototype.getContentSize = function ()
	{
		return this.contentSize.copy();
	};

	rat.ui.Element.prototype.setPos = function (x, y)
	{
		if (x.x != void 0)	//	unpack from object, if they passed that in
		{
			y = x.y;
			x = x.x;
		}
		this.place.pos.x = x;
		this.place.pos.y = y;
		this.boundsChanged();
	};

	rat.ui.Element.prototype.getPos = function ()
	{
		return this.place.pos;	//	note - returning a REF... usually they'll want to call getPos().copy()
	};

	rat.ui.Element.prototype.getPosX = function () { return this.place.pos.x; };
	rat.ui.Element.prototype.getPosY = function () { return this.place.pos.y; };

	rat.ui.Element.prototype.setPosX = function (x)
	{
		this.place.pos.x = x;
		this.boundsChanged();
	};
	rat.ui.Element.prototype.setPosY = function (y)
	{
		this.place.pos.y = y;
		this.boundsChanged();
	};

	//	Set this ui element's scale.
	rat.ui.Element.prototype.setScale = function (x, y)
	{
		this.scale.x = x;
		this.scale.y = y;
		
		//	This doesn't change my bounds.  And for most (all?) cases, that's fine.
		//	Scaling at this level happens without an element knowing about it, generally.
		//	We just apply a context scale and then draw the element normally,
		//	so the bounds of the element didn't change, from the element's point of view.
		
		//	similarly, we don't set a dirty flag here for the element itself,
		//	because it doesn't change the rendering of that element.
		//	Scaled content does, however, change the look of the element that contains it,
		//	so the parent element needs to be set dirty.
		//	Same concept applies below in setting rotation and opacity and stuff...
		if (this.parent)
			this.parent.setDirty(true);
	};

	rat.ui.Element.prototype.getScale = function ()
	{
		return this.scale;
	};

	rat.ui.Element.prototype.setRotation = function (angle)
	{
		this.place.rot.angle = angle;
		
		//	see setScale notes above
		if (this.parent)
			this.parent.setDirty(true);
	};

	rat.ui.Element.prototype.getRotation = function ()
	{
		return this.place.rot.angle;
	};

	rat.ui.Element.prototype.setOpacity = function (alpha)
	{
		this.opacity = alpha;
		
		//	see setScale notes above
		if (this.parent)
			this.parent.setDirty(true);
	};
	
	rat.ui.Element.prototype.getOpacity = function ()
	{
		return this.opacity;
	};

	rat.ui.Element.prototype.setOpacityRecursive = function (alpha)
	{
		this.applyRecursively(rat.ui.Element.prototype.setOpacity, alpha);
	};

	rat.ui.Element.prototype.setID = function (id)
	{
		this.id = id;
	};

	/**
	 * Set the frame on this element
	 * @param {number} frameWidth how wide is the frame
	 * @param {Object=} frameColor
	 * @param {?} frameOutset
	 */
	rat.ui.Element.prototype.setFrame = function (frameWidth, frameColor, frameOutset)
	{
		this.frameWidth = frameWidth;
		if (typeof frameColor !== 'undefined')
		{
			if (typeof frameColor === 'string')	//	support style string
				this.frameColor.copyFrom(rat.graphics.Color.makeFromStyleString(frameColor));
			else
				this.frameColor.copyFrom(frameColor);
		}
		else if( frameColor === void 0 )
			this.frameColor.copyFrom(rat.graphics.white);
		
		if (typeof frameOutset !== 'undefined')
			this.frameOutset = frameOutset;
		
		//	we consider "frame" rendering to happen outside offscreen buffers,
		//	so, this does not mark US as dirty, but we do need to re-render our parent.
		if (this.parent)
			this.parent.setDirty(true);
	};

	rat.ui.Element.prototype.setFrameRandom = function (frameWidth)
	{
		this.frameWidth = frameWidth;
		this.frameColor.setRandom();
		//	leave outset whatever it was
		
		//	see setFrame notes above
		if (this.parent)
			this.parent.setDirty(true);
	};

	/**
	//	get global coordinates from local coordinates relative to me.  Compare with getGlobalContentPos below.
	//	this involves processing the chain from parent to parent, to the top level.
	//	But we do that locally, instead of recursively, to avoid extra function calls and overhead.
	* @param {number=} x
	* @param {number=} y
	*/
	rat.ui.Element.prototype.getGlobalPos = function (x, y)
	{
		if (x === void 0)
		{
			x = 0;
			y = 0;
		}
		if (x.x !== void 0)	//	support object being passed in
		{
			y = x.y;
			x = x.x;
		}

		var pane = this;
		do
		{
			//	2016.5.23 STT:
			//		for things inside things that are centered, I really think getGlobalPos needs to factor in centering.
			//		otherwise there's no way this function will return the right value.  Who knows which of these items in the chain
			//		have their own centering value.
			//		it's *possible* it should only be in the "parent" check below?  I'm not sure.
			//		anyway, it was in neither place, before, which really seems wrong.
			//		I had to change getGlobalBounds() to match this...
					
			x -= pane.center.x;
			y -= pane.center.y;
			
			//	factor in my scale
			x *= pane.scale.x;
			y *= pane.scale.y;
			
			//	move to parent space
			x += pane.place.pos.x;
			y += pane.place.pos.y;

			if (pane.parent)
			{
				//	factor in scrolled/scaled content
				x *= pane.parent.contentScale.x;
				y *= pane.parent.contentScale.y;
				x += pane.parent.contentOffset.x;
				y += pane.parent.contentOffset.y;
			}
			pane = pane.parent;
		} while (pane);
		
		//return new rat.Vector(x, y);
		return {x:x, y:y};
	};

	//	get global coordinates from a point inside my content.
	//	This is different from above if MY content itself is scrolled.
	//	So, this is useful mostly for scrollview content
	rat.ui.Element.prototype.getGlobalContentPos = function (x, y)
	{
		if (typeof x === 'undefined')
		{
			x = 0;
			y = 0;
		}
		//	factor in scrolled/scaled content
		x *= this.contentScale.x;
		y *= this.contentScale.y;
		x += this.contentOffset.x;
		y += this.contentOffset.y;
		
		return this.getGlobalPos(x, y);
	};

	//	convert parent-space point to local space point.
	//	this factors in:
	//		my location inside parent
	//		my scale, if any
	rat.ui.Element.prototype.parentToLocalPos = function (x, y)
	{
		var relPos = new rat.Vector(x, y);
		relPos.x -= (this.place.pos.x);// - this.center.x);
		relPos.y -= (this.place.pos.y);// - this.center.y);
		
		//	Why do we not factor in centering here?  I don't know.  Should have commented this...
		//	2016.5.23 I feel like this (centering) should maybe be rethought and added back in.
		//	But centering as a while all needs to be rethought.

		//	factor in my scale
		//	(this is a divide because we draw scaled up,
		//		so a point on the screen is bigger than logical points inside me and my subelements,
		//		who know nothing about my scale)
		relPos.x /= this.scale.x;
		relPos.y /= this.scale.y;

		return relPos;
	};

	//	convert parent-space point to local content space point.
	//	The difference here is that we factor in our content scroll, which is useful for scrollviews.
	//	So, this factors in:
	//		my location inside parent
	//		my scale
	//		my content scroll, if any
	//		my content scale, if any
	rat.ui.Element.prototype.parentToLocalContentPos = function (x, y)
	{
		var pos = this.parentToLocalPos(x, y);

		pos.x -= this.contentOffset.x;
		pos.y -= this.contentOffset.y;
		pos.x /= this.contentScale.x;
		pos.y /= this.contentScale.y;
		
		return pos;
	};
	
	//	TODO:  Why are there no globalToLocalPos and globalToLocalContentPos functions?
	//	they're tricky, but need to exist.  Walk through parent chain from global to self, converting space using parentToLocal function.
	//	probably do this with postorder recursion.
	
	//	convert from global space to my own local space.
	rat.ui.Element.prototype.globalToLocalPos = function (x, y)
	{
		var relPos;
		if (this.parent)
			relPos = this.parent.globalToLocalPos(x, y);
		else
			relPos = {x:x, y:y};

		relPos.x -= (this.place.pos.x);// - this.center.x);
		relPos.y -= (this.place.pos.y);// - this.center.y);
		//	Why do we not factor in centering here?  I don't know.  Should have commented this...
	
		//	factor in my scale
		relPos.x /= this.scale.x;
		relPos.y /= this.scale.y;
		
		return relPos;
	};
	
	//
	//	Utility function to apply this function (as a "call") to all subelements recursively (with arg), including this one.
	//	If any element returns non-false it means it handled everything, and we should stop calling.
	//
	//	NOTE:  This will call this specific function on each element, but won't handle polymorphism!  If you just want to apply a utility function, great.
	//		if you want to give every subpane a chance to override and handle in their own way, this is not the approach you want.
	//	We could support that by using a function NAME instead of a function.  That'd be a different utility, I think, though similar to this.
	//
	//	todo: use this in more places?
	//	todo: varargs
	/**
	 * @param {?} func
	 * @param {?} arg
	 */
	rat.ui.Element.prototype.applyRecursively = function (func, arg)
	{
		//	do my own handling
		var res = func.call(this, arg);
		if (res)
			return res;

		//	now handle for all children
		if (this.subElements)
		{
			for (var i = 0; i < this.subElements.length; i++)
			{
				//	call this recursive utility on each subelement
				res = this.subElements[i].applyRecursively(func, arg);
				if (res)
					return res;
			}
		}
		return false;
	};

	//
	//	Utility function to pass this call down to all subelements,
	//	This is not inherently recursive, but will recurse if the applied function also calls this function again, which is often the case.
	//
	rat.ui.Element.prototype.callForSubElements = function (func, arg)
	{
		if (this.subElements)
		{
			for (var i = 0, len = this.subElements.length; i !== len; ++i)
			{
				var res = func.call(this.subElements[i], arg);
				if (res)
					return res;
			}
		}
		return false;
	};

	//
	//	Utility function to pass this call down to all subelements,
	//	with relative pos calculated...
	//	This is not inherently recursive, but will recurse if the applied function also calls this function again, which is often the case.
	//	TODO:  There must be a better way to do all this in JS.
	//		at the very least, use varargs here.
	//
	rat.ui.Element.prototype.callForSubElementsWithPos = function (func, pos, arg1, arg2)
	{
		if (this.subElements)
		{
			//	let subelements handle this.  Make sure they're thinking in MY coordinates (parent, to them)
			//	and include my scroll state, if any, since subelements are part of my contents

			var relPos = this.parentToLocalContentPos(pos.x, pos.y);

			//	factor in centering.
			//	why is this not part of parentToLocalContentPos?  I'm not sure,
			//	maybe it should be, but I don't want to screw other stuff up,
			//	without testing everything again and that's a drag...
			relPos.x += this.center.x;
			relPos.y += this.center.y;
			
			// Handle the elements front to back, in case any of our subelements get deleted while being processed.
			for (var i = this.subElements.length - 1; i >= 0; i--)
				//for (var i = 0; i < this.subElements.length; i++)
			{
				var res = func.call(this.subElements[i], relPos, arg1, arg2);
				if (res)
					return res;
			}
		}
		return false;
	};

	//
	//	update me and my subelements
	//	(e.g. animate sprites, jiggle, whatever.)
	//	compare and contrast with animator class...
	//	this is for more internal class-specific animation, like changing my internal appearance over time.
	//	animator class is for pushing around elements externally.
	//
	rat.ui.Element.prototype.update = function (dt)
	{
		rat.ui.updateCallCount++;	//	debug
		
		//	let's hope nobody (me, and my children) needed an update, and we'll correct that assumption below if needed.
		//	the only way for my needsUpdate flag to get turned off is if my own update functions (updateSelf, updateSelfPost)
		//	report back that they didn't need an update, and my children also don't need one.
		var neededUpdate = false;
		
		//	if I have an updateself, call that.  (convenience for subclasses and game use)
		if (this.updateSelf)
		{
			var res = this.updateSelf(dt);
			if (res === void 0 || res === true)	//	either doesn't understand update system or explicitly needs update
				neededUpdate = true;
		}

		//	New approach:  don't use callForSubElements, do my own loop.
		//	update() is taking a lot of time in some games.  I'd like to minimize this.
		//	More importantly, we now do some flag checking as we loop through...
		if (this.subElements)
		{
			var len = this.subElements.length;
			for (var i = len-1; i >= 0; --i)	//	reverse in case some are removed from list
			{
				var e = this.subElements[i];
				if (e.needsUpdate)
				{
					var res = e.update(dt);
					if (res === void 0 || res === true)	//	either doesn't understand update system or explicitly needs update
						neededUpdate = true;
				}
			}
		}
		
		//	old way
		//this.callForSubElements(rat.ui.Element.prototype.update, dt);

		//	tooltip processing - is this a good place?  Update my own tooltip...
		if (this.toolTip)
		{
			neededUpdate = true;	//	let's assume if we have a tooltip at all, we need to update it frequently.
			
			if ((this.flags & rat.ui.Element.mouseInFlag)
					&& (this.flags & rat.ui.Element.visibleFlag))
			{
				this.toolTip.timer += dt;
				if (this.toolTip.timer > rat.ui.TOOL_TIP_TIME)
				{
					//console.log("show tooltip");
					//	eh... don't bother with visibility flag - they explicitly get drawn from elsewhere
					//this.toolTip.setVisible(true);

					//	if this is a mouse-tracking tooltip, update position every frame...
					if (this.toolTipPlacementFromMouse)
					{
						this.positionToolTip(this.toolTipPlacement, this.toolTipPlacementOffset, this.toolTipPlacementFromMouse);
					}

					//	convert tooltip pos to global space, in case something has moved
					var globalPos = this.getGlobalPos(this.toolTipOffset.x, this.toolTipOffset.y);
					this.toolTip.setPos(globalPos.x, globalPos.y);
					this.toolTipScreen.activeToolTip = this.toolTip;	//	set each frame - gets drawn and cleared later
				}
			} else
			{
				this.toolTip.setVisible(false);
				this.toolTip.timer = 0;
			}
		}
		
		//	updateSelfPost (optional, of course) is for panes to update after their subpanes have updated.
		if (this.updateSelfPost)
		{
			var res = this.updateSelfPost(dt);
			if (res === void 0 || res === true)	//	either doesn't understand update system or explicitly needs update
				neededUpdate = true;
		}

		//	OK, finally, if we got through that without anybody needing an update (or just not really telling us)
		//	let's turn off our needsUpdate flag.
		//	This will stay off until somebody explicitly sets it again,
		//	or calls setNeedsUpdate() on us or a child.
		if (!neededUpdate)
			this.needsUpdate = false;
		
		return this.needsUpdate;
	};
	
	//	needs update tracking
	rat.ui.Element.prototype.setNeedsUpdate = function (needs)
	{
		if (needs === void 0)
			needs = true;
		this.needsUpdate = needs;
		
		if (!needs)	//	if clearing, just apply to us
			return;
		
		//	this also means my whole parent chain needs update.
		//	do this all directly in a loop here to save some time
		var e = this.parent;
		while (e)
		{
			e.needsUpdate = true;
			e = e.parent;
		}
	};

	//	calculate anchor (center) position based on size.
	//	This is one-time - it doesn't auto-update later.
	//	if you pass "false" in here, it resets centering to topleft
	rat.ui.Element.prototype.autoCenter = function (doCenter)
	{
		if (doCenter || doCenter === void 0)
		{
			this.center.x = this.size.x / 2;
			this.center.y = this.size.y / 2;
		} else {
			this.center.x = this.center.y = 0;
		}
	};
	
	rat.ui.Element.prototype.setCenter = function (x, y)
	{
		this.center.x = x;
		this.center.y = y;
		
		//	see setScale notes above
		if (this.parent)
			this.parent.setDirty(true);
	};

	//	assuming our size is correct, center this pane at this position.
	//	(the point given needs to be in my parent space)
	//	this does NOT use the "center" property, it just positions us based on our size.
	rat.ui.Element.prototype.centerAt = function (atX, atY)
	{
		var x = atX - this.size.x / 2;
		var y = atY - this.size.y / 2;
		this.setPos(x, y);
	};
	
	//	assuming our size is correct, center us in parent
	//	this does not use the "center" property, it just positions us based on our size and parent size.
	rat.ui.Element.prototype.centerInParent = function ()
	{
		if (!this.parent)
			return;

		//console.log("centerInParent: " + this.size.x + " p " + this.parent.size.x);

		this.place.pos.x = (this.parent.size.x - this.size.x) / 2;
		this.place.pos.y = (this.parent.size.y - this.size.y) / 2;
		
		//	see setScale notes above
		this.parent.setDirty(true);
	};

	//	assuming our size is correct, center us horizontally in parent
	rat.ui.Element.prototype.centerInParentHorizontally = function ()
	{
		if (!this.parent)
			return;

		this.place.pos.x = (this.parent.size.x - this.size.x) / 2;
		
		this.parent.setDirty(true);
	};

	//	assuming our size is correct, center us vertically in parent
	rat.ui.Element.prototype.centerInParentVertically = function ()
	{
		if (!this.parent)
			return;

		this.place.pos.y = (this.parent.size.y - this.size.y) / 2;
		
		this.parent.setDirty(true);
	};

	//
	//	resize to parent size.
	//	todo maybe rename this function to resizeToParent, or fitToParentSize or something?
	//	why "auto"?  Well, it does seem to be the first thing I think of when I imagine this function...  maybe leave it.
	rat.ui.Element.prototype.autoSizeToParent = function ()
	{
		if (!this.parent)
			return;

		//console.log("autoSizeToParent: " + this + " p " + this.parent);
		this.setBounds(0, 0, this.parent.size.x, this.parent.size.y);
	};

	rat.ui.Element.prototype.autoSizeToContent = function ()
	{
		this.size.x = this.contentSize.x;
		this.size.y = this.contentSize.y;

		this.boundsChanged();
	};

	//	get my bounds in parent space
	//	Factor in my own scale automatically, if I'm scaled, because various things like tooltip highlights make more sense this way.
	rat.ui.Element.prototype.getBounds = function (dest)
	{
		var r = dest || new rat.shapes.Rect();
		r.x = this.place.pos.x - this.center.x;
		r.y = this.place.pos.y - this.center.y;
		r.w = this.size.x * this.scale.x;
		r.h = this.size.y * this.scale.y;
		return r;
	};
	//	old name for compatibility
	//rat.ui.Element.prototype.getMyBounds = rat.ui.Element.prototype.getBounds;

	//	get my local bounds (x and y are always 0)
	rat.ui.Element.prototype.getLocalBounds = function ()
	{
		var r = new rat.shapes.Rect(0 - this.center.x, 0 - this.center.y, this.size.x, this.size.y);
		return r;
	};
	//	old name for compatibility
	rat.ui.Element.prototype.getMyLocalBounds = rat.ui.Element.prototype.getLocalBounds;

	//	get my global bounds
	rat.ui.Element.prototype.getGlobalBounds = function ()
	{
		var pos = this.getGlobalPos();
		
		//	these approaches are problematic.  For one thing, they don't factor in scale.. :)
		//var r = new rat.shapes.Rect(pos.x - this.center.x, pos.y - this.center.y, this.size.x, this.size.y);
		//var r = new rat.shapes.Rect(pos.x, pos.y, this.size.x, this.size.y);
		
		var botRight = this.getGlobalPos(this.size.x, this.size.y);
		
		var r = new rat.shapes.Rect(pos.x, pos.y, botRight.x - pos.x, botRight.y - pos.y);
		
		return r;
	};

	//
	//	adjust this bounds variable for use in testing touch/move in/out of bounds.
	//	this is different because for some events we'll want to factor in fat fingers
	//
	rat.ui.Element.prototype.adjustBoundsForPointer = function (bounds, ratEvent)
	{
		if (ratEvent && ratEvent.isFromTouch)
		{
			var radX = ratEvent.touchRadiusX;
			var radY = ratEvent.touchRadiusY;
			bounds.x -= radX;
			bounds.y -= radY;
			bounds.w += radX * 2;
			bounds.h += radY * 2;
		}
		return bounds;
	};
	
	//	find deepest subelement that includes this point.
	//	return null if it's not even in me.
	//	return subelement (or sub-sub...) that contains this point.
	//	otherwise return self 
	//	the "pos" passed in is assumed to be in my parent space (e.g. relative to my pos!)
	rat.ui.Element.prototype.findSubElementByPoint = function(pos, requireFlags, ratEvent)
	{
		//	Search subelements first.
		//	Note that we intentionally aren't checking our own bounds first.
		//	I'm chosing to make this mean that we find ANY pane that's in the right place visually,
		//	and not restrict things being properly inside parent bounds to qualify.
		
		//	Make sure subelements are thinking in parent-relative coordinates (we are the parent in that case)
		var relPos = this.parentToLocalContentPos(pos.x, pos.y);
		//	adjust relpos to factor in centering.  We factored it in above in getBounds(),
		//	but need to do it here as well so all sub elements are working with the right position, if we have a centering offset.
		//	why is this not part of parentToLocalContentPos?  I don't know.
		relPos.x += this.center.x;
		relPos.y += this.center.y;
		
		var foundSub = null;
		if (this.subElements)
		{
			for (var i = this.subElements.length-1; i >= 0; i--)
			{
				var elem = this.subElements[i];
				if ((elem.flags & requireFlags) === requireFlags)
				{
					var foundSub = elem.findSubElementByPoint(relPos, requireFlags);
					if (foundSub)
						break;
				}
			}
		}
		if (foundSub)
			return foundSub;	//	was in some sub element
		
		//	in me, at least?
		var myBounds = this.getBounds(this.tempRect);
		if (ratEvent)
			this.adjustBoundsForPointer(myBounds, ratEvent);
		var inBounds = rat.collision2D.pointInRect(pos, myBounds);
		if (!inBounds)
			return null;	//	not in me or my subelements
		
		return this;	//	OK, was at least in me
	};

	//	The cursor newly entered my bounds (regardless of pressed or not)
	//	(called for each element from handleMouseMove below)
	//	Note that this is only called if the mouse is not already inside this element.
	rat.ui.Element.prototype.mouseEnter = function ()
	{
		//console.log("..enter " + this.name);

		if ((this.flags & rat.ui.Element.enabledFlag) === 0)	//	don't process if we're disabled
			return;

		var oldFlags = this.flags;
		this.flags |= rat.ui.Element.mouseInFlag;

		if (this.flags & rat.ui.Element.trackingMouseDownFlag)
		{
			//	pressed state happens again if we were tracking mousedown
			//	e.g. we clicked in, moved out, and moved back in without lifting mouse.
			this.flags |= rat.ui.Element.pressedFlag;
		}
		else
		{
			//console.log("..high " + this.name);
			//	if we were not already tracking a click, use highlight state to highlight that this is clickable
			this.flags |= rat.ui.Element.highlightedFlag;
		}
		this.checkFlagsChanged(oldFlags);

	};

	//	mouse left my bounds, regardless of pressed or not
	//	(called for each element from handleMouseMove below)
	rat.ui.Element.prototype.mouseLeave = function ()
	{
		if ((this.flags & rat.ui.Element.enabledFlag) === 0)	//	don't process if we're disabled
			return;

		//if (this.isVisible())
		//	console.log("..leave " + this.name);
		var oldFlags = this.flags;
		
		this.flags &= ~rat.ui.Element.mouseInFlag;

		//	only unhighlight if we were not tracking a click
		if ((this.flags & rat.ui.Element.trackingMouseDownFlag) === 0)
		{
			//console.log("..unhigh " + this.name);
			this.flags &= ~rat.ui.Element.highlightedFlag;
		}
		this.flags &= ~rat.ui.Element.pressedFlag;	//	not pressed if moved outside
		
		this.checkFlagsChanged(oldFlags);
	};

	//
	//	mouse clicked down in me.
	//	(only called if mouse down happened in my bounds)
	//	pos is in LOCAL space to make local logic easier for classes in this module and for user subclasses
	//	(called for each element from handleMouseDown below)
	//
	//	This is often overridden in subclasses,
	//	but this behavior here is commonly needed - set tracking/pressed flags.
	rat.ui.Element.prototype.mouseDown = function (pos, ratEvent)
	{
		if ((this.flags & rat.ui.Element.enabledFlag) === 0)	//	don't process if we're disabled
			return false;

		if ((this.flags & rat.ui.Element.tracksMouseFlag) === 0)	//	or if we don't track mouse at all...
			return false;
			
		var oldFlags = this.flags;
		this.flags |= rat.ui.Element.trackingMouseDownFlag;
		this.flags |= rat.ui.Element.pressedFlag;
		
		//	in case we're targetable, and we're in a screen of some kind, become target!
		this.targetMe(ratEvent);
		
		this.checkFlagsChanged(oldFlags);

		if (this.clickSound && rat.audio)
			rat.audio.playSound(this.clickSound);
		
		//	return whether we handled this click or not.
		//	Not sure what counts as "handled" in this case...
		//	Currently, we let multiple panes track a click,
		//		especially in the case of a container and its subpanes.
		//	So, let's not claim this click event as exclusively ours.
		return false;
	};

	//	mouse up
	//	called whether the mouseup happened inside this element's bounds or not.
	//	(in case we were tracking)
	//	pos is in LOCAL space to make local logic easier for classes in this module and for user subclasses
	//	(called for each element from handleMouseUp below)
	//	TODO:
	//		If this mouseup event is from touch (ratEvent.isFromTouch, right?)
	//		then after processing this, fake a mousemove event of some kind
	//		(e.g. to -1,-1) since we no longer know where the mouse is.
	//		Some people might want to know where the most recent mouse was, though?
	//		maybe instead leave position where it is, but send a mouseleave event everywhere?
	//		something.
	//		Anyway, the problem is that when you touch a UI button, it keeps highlighting after the
	//		mouseup, since it never gets any new position for the mouse, since you lifted your
	//		finger.
	//		Maybe do this at a higher level, like an earlier dispatcher.
	rat.ui.Element.prototype.mouseUp = function (pos, ratEvent)
	{
		if ((this.flags & rat.ui.Element.enabledFlag) === 0)	//	don't process if we're disabled
			return false;

		var oldFlags = this.flags;

		//	clear relevant flags.
		//  Do this before trigger() below, in case some distant function cares about our flags.
		//  For instance (complicated but likely scenario), a new window is popped up,
		//      and we try to unhighlight this button with mouseLeave(), which checks trackingMouseDownFlag.
		this.flags &= ~rat.ui.Element.trackingMouseDownFlag;
		this.flags &= ~rat.ui.Element.pressedFlag;
		//this.flags &= ~rat.ui.Element.mouseInFlag;
		//this.flags &= ~rat.ui.Element.highlightedFlag;

		//	were we tracking a click?
		var handled = false;
		if (oldFlags & rat.ui.Element.trackingMouseDownFlag)
		{
			//rat.console.log("tmouseup in... " + this.id + " | " + this.name);
			
			var myBounds = this.getLocalBounds();
			this.adjustBoundsForPointer(myBounds, ratEvent);

			//	and was this mouseup in our bounds?  If so, trigger!
			if (rat.collision2D.pointInRect(pos, myBounds))
			{
				//	...  All elements fire a triggered event when they get a mouse up...
				//	But most don't do anything about it...  How to know
				handled = this.trigger();
				if (handled)
					rat.eventMap.fireEvent("uiTriggered", this);
			}
			else	//	were tracking, they let up outside
			{
				//  unhighlight. should maybe do this in either case.
				this.flags &= ~rat.ui.Element.highlightedFlag;
				
				//	We were tracking this - probably should return true here.
				//	(this was our mouse input, and we did handle it)
				//handled = true;
				//	UGH.
				//	Weird problems with this.
				//	Do we let multiple elements track a single click?
				//	e.g. container and buttons inside it?
				//	If so, we CAN'T return handled here,
				//	 or we potentially leave the trackingMouseDown flag set for our subelements,
				//	since returning true means we stop processing this mouseup,
				//	and then the NEXT mouseup will handle this.
				//	TODO: only let one element ever track clicks?
				//	IF SO, then fix a bunch of things:
				//		* return true here
				//		* change tracksmouse flag to default to OFF for most things
				//		* even if a container has tracksmouse false, let its subelements see if they do...
				//		* once ANY element starts tracking a single click, return handled from mousedown,
				//			so nobody else sets their tracking flag.
				//		It has to be one way or the other:	we can't stop processing mouseups if we let multiple people process mousedowns.
				handled = false;
			}
		}

		this.checkFlagsChanged(oldFlags);
		
		//	STT TODO this may need some research and testing here.
		//	Do we sometimes end up tracking mousedown in multiple panes at once, if one's inside another?
		//	does trackingMouseDownFlag get set on more than one pane?
		//	if so, and we return true for any reason above,
		//	does the other pane (e.g. our parent) ever find out it's not tracking any more?
		//	returning true stops us from handing mouseup UP the visual tree...
		
		return handled;
	};

	//
	//	Handle mouse movement to new position.
	//	pass down to subelements.
	//	this position is relative to our parent (parent space)
	//		"pos" is passed in separately from the event so it can be modified locally
	//			(e.g. change coordinate systems) without modifying the original event, and passed down recursively
	//
	//	TODO: correctly deal with "handled" for this and related mousemove functions, like other events.
	//
	//	TODO:  handleMouseMove is called for EVERY element in a screen, currently, which can get really slow,
	//		and affects performance on low-end machines in a painful way.
	//		We need to find a way to support all the funky leave stuff below without even calling this function for
	//		elements that don't care, e.g. they weren't already tracking.  Maybe some "trackingMouse" flag, that's
	//		a superset of trackingMouseDown?
	//		Actually, what we need is a screen-level 'care about mousemove' list, and a set of changes like this:
	//			mousemove should only be called for
	//				+ elements that mouse is really inside (inBounds)
	//				+ and elements in a special 'care about mousemove' list.
	//			elements get added to that list when the mouse moves inside them (e.g. mouseEnter is called)
	//			elements get removed from that list when they decide to let go
	//				(by default, on mouseLeave, but some classes can override)
	//				(e.g. thumb in scrollbar)
	//			elements that get removed from tree or deleted need to get removed from that list - how to do that?
	//				maybe auto-clean-up from that list of we go a frame without calling an element's handleMouseMove? ('cause it's not in the tree)
	//				yes, an auto-clean-up approach seems most robust.
	//			The reason it needs to be a list is that tracking might need to happen deep down the tree, inside a group.
	//				and we'd need to traverse the whole tree to even get to those items, without filtering by inBounds,
	//				if we didn't have a separate list.  Traversing the whole tree and checking every object is what's already causing performance problems.
	//			Note that it should be a list of lists, to handle multiple simultaneous input (e.g. finger) movements, in the future.
	//			Also note that Mouse UP should go through this same prioritized list of handlers.
	//		Actually, I'm no longer sure of this.  It could be really complicated.
	//		And is this the biggest problem we need to solve right now?
	//
	rat.ui.Element.prototype.handleMouseMove = function (newPos, handleLeaveOnly, ratEvent)
	{
		if (!this.isVisible())	//	don't handle mouse if I'm invisible - what do they think they're clicking on or hovering over?
			return false;

		rat.ui.mouseMoveCallCount++;	//	debugging
		
		//	handleLeaveOnly is a way to let subpanes (remember this is a recursive function) let go of mouse tracking, if they need to,
		//	but don't start any new tracking.  This is to support things like items inside a scrollview, and the mouse is inside, then outside the scrollview.
		if (typeof (handleLeaveOnly) === 'undefined')
			handleLeaveOnly = false;

		///@todo	correctly handle rotation?

		var myBounds = this.getBounds(this.tempRect);
		this.adjustBoundsForPointer(myBounds, ratEvent);
		var inBounds = rat.collision2D.pointInRect(newPos, myBounds);

		if (!handleLeaveOnly && inBounds && (this.flags & rat.ui.Element.mouseInFlag) === 0)
			this.mouseEnter();
		if (handleLeaveOnly || (!inBounds && (this.flags & rat.ui.Element.mouseInFlag)))
			this.mouseLeave();

		//	let all subelements handle this, regardless of mouse position.
		//	? Unless we've got clipping on, and this movement is outside my space
		//	in which case the user can't see the thing reacting, so don't even try it.
		//	TODO:  ignore clip flag?  Just never pass down if this move is outside our space?
		//	This still not ideal.  elements that were tracking mouse should get a chance to realize they're not tracking it anymore,
		//		but it depends on element behavior...  See store screen in agent for example.
		//	Also, imagine a scrollbar thumb the user has clicked on, and we want it to track that click until they let go,
		//		regardless of where they drag their mouse.  Gotta keep calling handleMouseMove in that case.
		//if (!inBounds && (this.flags & rat.ui.Element.clipFlag) != 0)
		//	return;
		if (!inBounds && (this.flags & rat.ui.Element.clipFlag) !== 0)
			handleLeaveOnly = true;

		//	Make sure subelements are thinking in parent-relative coordinates (we are the parent in that case)
		var relPos = this.parentToLocalContentPos(newPos.x, newPos.y);

		//	remember that relative pos for later calculations relative to mouse position, like tooltips
		this.mousePos = relPos;

		//	if we have a local mouseMove function, call that now, using local coordinates..
		//	why do we check this here, and not check mouseDown and mouseUp?  inconsistent...?
		//	todo: should center already be factored in here?  PROBABLY!
		//	I haven't tested it.
		//	if it does, just move the relPos adjustment line up before here...
		if (this.mouseMove)
		{
			//	factor in handleLeaveOnly here?
			this.mouseMove(relPos, ratEvent);
		}
		//	adjust relpos to factor in centering.  We factored it in above in getBounds(),
		//	but need to do it here as well so all sub elements are working with the right position, if we have a centering offset.
		relPos.x += this.center.x;
		relPos.y += this.center.y;

		//	why not using callForSubElementsWithPos like others?  Probably should?
		//	Note that callForSubElementsWithPos does the offset/scale calculation above, so we'd pass in newPos in that case...
		//	and it does the center offset as well, now...
		//	and we've have to add a second arg, or support varargs (see callForSubElementsWithPos)
		//	Also, we're changing the behavior a bit, checking some flags here for speed.
		if (this.subElements)
		{
			//	walk through backwards, so elements that draw on top get processed first.
			for (var i = this.subElements.length-1; i >= 0; i--)
			{
				var elem = this.subElements[i];
				if (elem.flags & rat.ui.Element.tracksMouseFlag)
					elem.handleMouseMove(relPos, handleLeaveOnly, ratEvent);
			}
		}
	};
	
	//	OK, several positional events (mousedown, contextmenu, mousewheel)
	//	all behave the same way:
	//		check visibility and clip
	//		recursively look through panes
	//		if the event happened inside a pane, call its pane-specific handler function, if there is one.
	//	So, collect that functionality here!
	//	This is tricky, because we also want subclasses to be able to override
	//		both the tree event handling function (e.g. handleMouseWheel) and the specific pane-space function (e.g. mouseWheelEvent)
	//		so we do that with the function references here.
	//	Also, note that unlike some other event handling, here we're going to say if somebody handles this event,
	//	STOP processing it!
	//	SCENARIO:
	//		in the good editor, you have two panes on top of each other, e.g. two overlapping text panes.
	//		right-clicking should not pop up TWO context menus.  Just one.  So, as soon as somebody handles the right-click
	//		and returns true (handled), stop processing.
	rat.ui.Element.prototype.handlePositionalEvent = function(pos, ratEvent, forChildFunc, forMeFunc)
	{
		//	don't handle positional events if I'm invisible - what do they think they're clicking/acting on?
		if (!this.isVisible())
			return false;
		
		var myBounds = this.getBounds(this.tempRect);
		this.adjustBoundsForPointer(myBounds, ratEvent);
		var inBounds = rat.collision2D.pointInRect(pos, myBounds);
		
		var handled = false;
		//	If clipping is not on, some containers have lazily-defined bounds and we need to let them handle this anyway,
		//	even if technically it's not in their bounds.
		//	If we have real clipping turned on, and it's outside our space, then don't pass down at all.
		//	The logic is this:  If we have real clipping turned on, our bounds have to be accurate,
		//	so it's OK to pay attention to that,
		//	and the user can't see anything outside those bounds anyway, since it's clipped during draw,
		//	So, only pass down clicks if we're in bounds or not clipped.
		//	NOTE:  we should probably just require this all the time and stop babying containers that have been set up wrong...
		if (this.subElements && (inBounds || (this.flags & rat.ui.Element.clipFlag) === 0))
		{
			//	let subelements handle this.  Make sure they're thinking in MY coordinates (parent, to them)
			//	and include my scroll state, if any, since subelements are part of my contents

			var relPos = this.parentToLocalContentPos(pos.x, pos.y);

			//	factor in centering.
			//	why is this not part of parentToLocalContentPos?  I'm not sure,
			//	maybe it should be, but I don't want to screw other stuff up,
			//	without testing everything again and that's a drag...
			relPos.x += this.center.x;
			relPos.y += this.center.y;
			
			// Handle the elements front to back, in case any of our subelements get deleted while being processed.
			//	this is probably good anyway, since we want front panes to react first, since they draw on top.
			for (var i = this.subElements.length - 1; i >= 0; i--)
			{
				var res = forChildFunc(this.subElements[i], relPos, ratEvent);
				if (res)
					return true;
				//	handled = true;
				//	return?  see other thinking about whether this should interrupt...
			}
		}
		
		if (inBounds && !handled)
		{
			//	Convert to local coordinates
			//	Ignore scroll for myself - this position is in "my" space, but not my scrolled content space - worry about that below
			var localPos = this.parentToLocalPos(pos.x, pos.y);
			handled = forMeFunc(this, localPos, ratEvent);
		}
		
		return handled;
	}
	
	//
	//	Handle and pass on mouse down event, by calling appropriate mouseDown function
	//	for whatever pane was clicked in...
	//
	//	todo: maybe change this to postOrder, and let an element say it was handled,
	//		and if it was handled, don't keep passing down.
	//
	//	This is split into two functions (handleMouseDown and mouseDown) so most subclasses
	//	don't have to worry about the recursive logic here, they just implement mouseDown if they care
	//	about clicks inside their space.
	//
	//	POS is relative to our parent (parent space)
	//
	rat.ui.Element.prototype.handleMouseDown = function (pos, ratEvent)
	{
		if (!this.isVisible())	//	don't handle mouse if I'm invisible - what do they think they're clicking on?
			return false;

		var myBounds = this.getBounds(this.tempRect);
		this.adjustBoundsForPointer(myBounds, ratEvent);
		var inBounds = rat.collision2D.pointInRect(pos, myBounds);

		var handled = false;

		//	OK, but if we have real clipping turned on, and it's outside our space, then don't pass down.
		//	The logic is this:  If we have real clipping turned on, our bounds have to be accurate,
		//	so it's OK to pay attention to that,
		//	and the user can't see anything outside those bounds anyway, since it's clipped during draw,
		//	So, only pass down clicks if we're in bounds or not clipped.
		//	NOTE:  we should probably just require this all the time and stop babying containers that have been set up wrong...
		if (inBounds || (this.flags & rat.ui.Element.clipFlag) === 0)
			handled = this.callForSubElementsWithPos(rat.ui.Element.prototype.handleMouseDown, pos, ratEvent);

		if (inBounds && !handled)
		{
			//	Convert to local coordinates
			//	Ignore scroll for myself - this position is in "my" space, but not my scrolled content space - worry about that below
			var localPos = this.parentToLocalPos(pos.x, pos.y);
			handled = this.mouseDown(localPos, ratEvent);
		}
		//else
		//	return;		//	if mousedown is not in my space, don't pass down...  this requires containers to be sized correctly!
		//	STT disabling this now - it's too easy for containers to not be right, and confusing to debug.
		//	maybe reenable later

		return handled;
	};

	//	handle mouse up
	//	pos is in parent space
	rat.ui.Element.prototype.handleMouseUp = function (pos, ratEvent)
	{
		//	don't handle mouse if I'm invisible - what do they think they're clicking on?
		if (!this.isVisible || !this.isVisible())	
			return false;
		//rat.console.log("HMU " + ratEvent.eventID + "(" + this.id + " | " + this.name + "): " + pos.x + "," + pos.y);

		//	always call mouseup, even if it's not in our bounds, so we can stop tracking if we were...

		//	Convert to local coordinates
		//	Ignore scroll for myself - this position is in "my" space, but not my scrolled content space - worry about that below
		var localPos = this.parentToLocalPos(pos.x, pos.y);
		//	see if I handled it myself before passing to children.
		var handled = this.mouseUp(localPos, ratEvent);

		if( !handled )
			handled = this.callForSubElementsWithPos(rat.ui.Element.prototype.handleMouseUp, pos, ratEvent);
		return handled;
	};
	
	//
	//	Handle context menu event (right-click)
	//	This is very much like a mouse down, currently.
	//	sorry for the copied and pasted code.  I'm still kinda exploring how this might work...
	//	todo: refactor with mousedown above, and with scrollwheel!
	/*	OLD
	rat.ui.Element.prototype.handleContextMenu = function (pos, ratEvent)
	{
		if (!this.isVisible())	//	don't handle mouse if I'm invisible - what do they think they're clicking on?
			return false;

		var myBounds = this.getBounds(this.tempRect);
		this.adjustBoundsForPointer(myBounds, ratEvent);
		var inBounds = rat.collision2D.pointInRect(pos, myBounds);

		var handled = false;

		//	OK, but if we have real clipping turned on, and it's outside our space, then don't pass down.
		//	The logic is this:  If we have real clipping turned on, our bounds have to be accurate,
		//	so it's OK to pay attention to that,
		//	and the user can't see anything outside those bounds anyway, since it's clipped during draw,
		//	So, only pass down clicks if we're in bounds or not clipped.
		//	NOTE:  we should probably just require this all the time and stop babying containers that have been set up wrong...
		if (inBounds || (this.flags & rat.ui.Element.clipFlag) === 0)
			handled = this.callForSubElementsWithPos(rat.ui.Element.prototype.handleContextMenu, pos, ratEvent);

		if (inBounds && !handled && this.contextMenuEvent)
		{
			//	Convert to local coordinates
			//	Ignore scroll for myself - this position is in "my" space, but not my scrolled content space - worry about that below
			var localPos = this.parentToLocalPos(pos.x, pos.y);
			handled = this.contextMenuEvent(localPos, ratEvent);
		}
		
		return handled;
	};
	*/
	//
	//	Handle context menu (right-click) events, which are standard positional events.
	//	This is still a little copy-pasty to me, but much better than it was.
	rat.ui.Element.prototype.handleContextMenu = function (pos, ratEvent)
	{
		return this.handlePositionalEvent(pos, ratEvent,
		
			//	function to call for my children
			function(pane, pos, ratEvent)
			{
				return pane.handleContextMenu(pos, ratEvent);
			},
			
			//	function to call for any individual pane
			function(pane, localPos, ratEvent)
			{
				if (pane.contextMenuEvent)
					return pane.contextMenuEvent(localPos, ratEvent);
				return false;
			}
		);
	};
	
	//
	//	Handle mouse wheel events, which are standard positional events.
	//
	rat.ui.Element.prototype.handleMouseWheel = function (pos, ratEvent)
	{
		return this.handlePositionalEvent(pos, ratEvent,
		
			//	function to call for my children
			function(pane, pos, ratEvent)
			{
				return pane.handleMouseWheel(pos, ratEvent);
			},
			
			//	function to call for any individual pane
			function(pane, localPos, ratEvent)
			{
				if (pane.mouseWheelEvent)
					return pane.mouseWheelEvent(localPos, ratEvent);
				return false;
			}
		);
	};

	//	Key handling.
	//	Note that dispatch system sends these to target first, and then up parent tree
	//	todo:  document better (explain handleKeyDown vs. keyDown, maybe rename)
	//		a good name for letting people override would be "myKeyDown" or "keydownself" or something, maybe?
	//	todo:  important: come up with a nicer system for externally handling these events, too, like registering/unregistering event handlers,
	//		so multiple outside modules can register for these events and respond to them.
	//		see also things like flagsChanged()
	rat.ui.Element.prototype.handleKeyDown = function (ratEvent)
	{
		if (this.keyDown)
			return this.keyDown(ratEvent);
		return false;
	};
	rat.ui.Element.prototype.handleKeyUp = function (ratEvent)
	{
		if (this.keyUp)
			return this.keyUp(ratEvent);
		return false;
	};
	//	keypress - generally you probably want keydown/keyup, not keypress.
	//	But this is useful for text entry fields..
	rat.ui.Element.prototype.handleKeyPress = function (ratEvent)
	{
		if (this.keyPress)
			return this.keyPress(ratEvent);
		return false;
	};
	
	//	default key down handling for this one element
	//	expected to be overridden by specific implementations
	//	key code is in ratEvent.which
	/*
	rat.ui.Element.prototype.keyDown = function (ratEvent)
	{
		return false;
	};
	rat.ui.Element.prototype.keyUp = function (ratEvent)
	{
		return false;
	};
	*/

	//	moved above
	//	handle mouse wheel event.  event.wheelDelta tells us amount scrolled, where 1 = 1 click up, -2 = 2 clicks down
	//rat.ui.Element.prototype.handleMouseWheel = function (pos, ratEvent)
	//{
	//	return false;
	//};

	//	controller button down
	rat.ui.Element.prototype.handleButtonDown = function (ratEvent)
	{
		return false;
	};
	
	//	controller button up
	rat.ui.Element.prototype.handleButtonUp = function (ratEvent)
	{
		return false;
	};

	//	Handle a dispatched event from the system.
	//
	//	See rat input module, and screen manager's dispatchEvent function.
	//
	//	This is the first place any ui event of any kind is handled.
	//	We break down event types here and call special subfunctions depending on the type.
	//	Any subclass can override this for very special handling if they want,
	//	but generally they just implement a more specific event function like keyDown.
	rat.ui.Element.prototype.handleEvent = function (ratEvent)
	{
		//	Here is where we split out some specific event types.
		//	We didn't have to do it this way.  Everyone could have just overridden "handlEvent",
		//	but this made it easy for games to just override the behavior they wanted without having to override it all.
		var result = false;
		if (ratEvent.eventType === 'keydown')
			result = this.handleKeyDown(ratEvent);
		else if (ratEvent.eventType === 'keyup')
			result = this.handleKeyUp(ratEvent);
		else if (ratEvent.eventType === 'keypress')
			result = this.handleKeyPress(ratEvent);
		
		//	positional events:
		//	We pass "pos" and event separately here,
		//	so that each function can modify pos locally and pass it recursively, without modifying the original rat event.
		//	(sure, we initially pass a position reference, but these handle functions call recursively with new positions.)
		
		//	I really wish we had done ratEvent as the first arg here, but I think I'd break stuff to switch them now.
		
		if (ratEvent.eventType === 'mousedown')
			result = this.handleMouseDown(ratEvent.pos, ratEvent);
		if (ratEvent.eventType === 'mouseup')
			result = this.handleMouseUp(ratEvent.pos, ratEvent);
		
		rat.ui.mouseMoveCallCount = 0;
		if (ratEvent.eventType === 'mousemove')
			result = this.handleMouseMove(ratEvent.pos, false, ratEvent);

		if (ratEvent.eventType === 'contextmenu')	//	right-click
			result = this.handleContextMenu(ratEvent.pos, ratEvent);
		
		if (ratEvent.eventType === 'mousewheel')
			result = this.handleMouseWheel(ratEvent.pos, ratEvent);

		//	controller buttons
		if (ratEvent.eventType === 'buttondown')
			result = this.handleButtonDown(ratEvent);
		if (ratEvent.eventType === 'buttonup')
			result = this.handleButtonUp(ratEvent);

		if (ratEvent.eventType === 'ui')
			result = this.handleUIInput(ratEvent);

		if (result)
			return result;

		//	This is also where we're going to handle passing events up the command chain, if there is one.
		//	currently, we assume visual parent is command parent... (this has nothing to do with inheritance)
		if (this.parent)
		{
			result = this.parent.handleEvent(ratEvent);
			if (result)
				return result;
		}

		return result;
	};

	//	default:  do nothing with UI input
	rat.ui.Element.prototype.handleUIInput = function (event)
	{
		return false;
	};
	
	//	try to make me the target of whatever inputmap or target system is relevant
	rat.ui.Element.prototype.targetMe = function (ratEvent)
	{
		if (this.isTargetable() && this.isEnabled() && this.isVisible())
		{
			//	find my first ancestor with an inputmap, or just the top-most ancestor.
			var myTop = this;
			while (myTop.parent && !myTop.inputMap)
				myTop = myTop.parent;
			//	and use that element's setCurrentTarget mechanism, if there is one.
			//	for a screen, this means something like telling the inputmap which element is now targeted,
			//	and untargeting the rest.
			if (myTop.setCurrentTarget)
			{
				myTop.setCurrentTarget(this, ratEvent);
				return true;
			}
		}
		return false;
	};

	//	Focus and Blur functions to interact nicely with inputMap system
	//	This is called by the inputmap system, or other system to indicate we're selected.
	//	If you want to target an item, call "targetMe()" function.
	rat.ui.Element.prototype.focus = function ()
	{
		if (this.isTargetable() && this.isEnabled() && this.isVisible())
		{
			var wasHighlighted = this.isHighlighted();
			this.setHighlighted(true);
			if (!wasHighlighted && this.events.onFocus)
				this.events.onFocus(this);
			this.setTargeted(true);
			return true;
		} else
		{
			return false;
		}
	};

	//	This is called by the inputmap system, or other system to indicate we're not selected.
	rat.ui.Element.prototype.blur = function ()
	{
		if (this.isTargetable() && this.isEnabled() && this.isVisible())
		{
			var wasHighlighted = this.isHighlighted();
			this.setHighlighted(false);

			if( wasHighlighted && this.events.onBlur )
				this.events.onBlur(this);
			this.setTargeted(false);
		}
		return true;
	};

	//	this or another function needs to simulate a click visually, e.g. set a timer and show pushed for a few frames.
	rat.ui.Element.prototype.press = function ()
	{
		if (this.trigger())
			rat.eventMap.fireEvent("uiTriggered", this);
	};

	//
	//	Trigger this element.  e.g. if this is a button, act like it got clicked, and send messages or whatever.
	//	This is implemented at the Element level on purpose - maybe you want a sprite or something to trigger - that's fine.
	//
	//	See notes on SetCallback
	//
	rat.ui.Element.prototype.trigger = function ()
	{
		var telem = rat.telemetry;
		var handled = false;
		if (this.command !== 0)
		{
			if (telem && this.name)
			{
				telem.recordUI('UI com', this.name);
			}

			//console.log("trigger " + this.name + " -> " + this.command);
			if (rat.dispatchCommand(this.command, this.commandInfo))
				handled = true;
		}
		if (this.callback)
		{
			if (telem && this.name)
			{
				telem.recordUI('UI cb', this.name);
			}

			var self = this;
			//	callback can specify if this event was handled or not.
			//	but let's interpret an undefined return value as meaning the callback
			//	doesn't really understand what to return, so in that case let's assume just having a callback
			//	was enough to handle this event.
			//	If you want this event to continue being processed, then explicitly return false.
			var res = this.callback(self, this.callbackInfo)	
			if (res || res === void 0)
				handled = true;
		}
		return handled;
	};

	//	set command to dispatch when triggered
	rat.ui.Element.prototype.setCommand = function (command, commandInfo)
	{
		this.command = command;
		this.commandInfo = commandInfo;
	};

	/**
	 * set function to call when triggered (see Trigger code)
	 * callback is called with (element, userInfo) args
	 * callback is expected to return a flag indicating if the event was handled.
	 * if you return false, we keep looking for other ways the event can be handled.
	 * so, generally you probably want to return true.
	 *
	 * @param {function(?, ?)} callback
	 * @param {*=} userInfo
	 */
	rat.ui.Element.prototype.setCallback = function (callback, userInfo)
	{
		this.callback = callback;
		if (typeof(userInfo) !== 'undefined')
			this.callbackInfo = userInfo;
	};
	
	/**
	 * set function to call when flags change, e.g. when element is highlighted
	 * callback is called with (oldflags, userInfo) args (and using element as 'this')
	 * @param {function(?, ?)} callback
	 * @param {*=} userInfo
	 */
	rat.ui.Element.prototype.setFlagsChangedCallback = function (callback, userInfo)
	{
		this.flagsChangedCallback = callback;
		if (typeof(userInfo) !== 'undefined')
			this.callbackInfo = userInfo;
	};

	/**
	 * Set the data provided with the callbacks
	 * @param {?} userInfo
	 */
	rat.ui.Element.prototype.setCallbackInfo = function (userInfo)
	{
		this.callbackInfo = userInfo;
	};

	rat.ui.Element.prototype.setFlag = function (flag, val)
	{
		var oldFlags = this.flags;
		
		if (typeof val === 'undefined')
			val = true;
		if (val)
			this.flags |= flag;
		else
			this.flags &= ~flag;
			
		this.checkFlagsChanged(oldFlags);
	};
	
	//	another name for setFlag(flag, false)
	rat.ui.Element.prototype.clearFlag = function(flag)
	{
		this.setFlag(flag, false);
	};
	
	rat.ui.Element.prototype.setVisible = function (visible)
	{
		this.setFlag(rat.ui.Element.visibleFlag, visible);
	};
	rat.ui.Element.prototype.isVisible = function ()
	{
		return ((this.flags & rat.ui.Element.visibleFlag) !== 0);
	};

	rat.ui.Element.prototype.setHighlighted = function (highlighted)
	{
		this.setFlag(rat.ui.Element.highlightedFlag, highlighted);
	};

	rat.ui.Element.prototype.isHighlighted = function (highlighted)
	{
		return ((this.flags & rat.ui.Element.highlightedFlag) !== 0);
	};

	rat.ui.Element.prototype.setEnabled = function (enabled)
	{
		var oldFlags = this.flags;
		if (typeof enabled === 'undefined')
			enabled = true;
		if (enabled)
		{
			this.flags |= rat.ui.Element.enabledFlag;
		} else
		{
			this.flags &= ~rat.ui.Element.enabledFlag;

			//	also clear other flags, in case we were in the middle of something?
			this.flags &= ~rat.ui.Element.highlightedFlag;
			this.flags &= ~rat.ui.Element.pressedFlag;
			//this.flags &= ~rat.ui.Element.toggledFlag;
			this.flags &= ~rat.ui.Element.mouseInFlag;
			//console.log("SET ENABLED FALSE");
			this.flags &= ~rat.ui.Element.trackingMouseDownFlag;
		}
		this.checkFlagsChanged(oldFlags);
	};
	rat.ui.Element.prototype.isEnabled = function ()
	{
		return ((this.flags & rat.ui.Element.enabledFlag) !== 0);
	};

	rat.ui.Element.prototype.setToggled = function (toggled)
	{
		this.setFlag(rat.ui.Element.toggledFlag, toggled);
	};

	rat.ui.Element.prototype.isToggled = function ()
	{
		return ((this.flags & rat.ui.Element.toggledFlag) !== 0);
	};

	rat.ui.Element.prototype.setClipped = function (toClip)
	{
		this.setFlag(rat.ui.Element.clipFlag, toClip);
	};
	rat.ui.Element.prototype.setClip = rat.ui.Element.prototype.setClipped;
	rat.ui.Element.prototype.isClipped = function (toClip)
	{
		return ((this.flags & rat.ui.Element.clipFlag) !== 0);
	};

	rat.ui.Element.prototype.isPressed = function ()
	{
		//	pressed state happens if we were tracking mousedown
		return ((this.flags & rat.ui.Element.pressedFlag) !== 0);
	};
	
	rat.ui.Element.prototype.setTracksMouse = function (tracks)
	{
		this.setFlag(rat.ui.Element.tracksMouseFlag, tracks);
	};
	
	rat.ui.Element.prototype.isTargetable = function ()
	{
		return ((this.flags & rat.ui.Element.targetableFlag) !== 0);
	};
	rat.ui.Element.prototype.setTargetable = function (targetable)
	{
		this.setFlag(rat.ui.Element.targetableFlag, targetable);
	};
	rat.ui.Element.prototype.canBeTarget = rat.ui.Element.prototype.isTargetable;	//	old name
	
	rat.ui.Element.prototype.isTargeted = function ()
	{
		return ((this.flags & rat.ui.Element.targetedFlag) !== 0);
	};
	rat.ui.Element.prototype.setTargeted = function (targeted)
	{
		this.setFlag(rat.ui.Element.targetedFlag, targeted);
	};

	rat.ui.Element.prototype.setAdjustForScale = function (adjust)
	{
		this.setFlag(rat.ui.Element.adjustForScaleFlag, adjust);
	};
	
	//	Scroll a relative amount...  negative dx means content is moved to left (view scrolled to right)
	rat.ui.Element.prototype.scroll = function (dx, dy)
	{
		//console.log("scroll " + dx + ", " + dy);	
		this.contentOffset.x += dx;
		this.contentOffset.y += dy;
		
		//	todo: see if there was actually a change
		if (this.viewChanged)
			this.viewChanged();
		
		//	TODO:  Deal with content offset changing in offscreen rendering, at some point?
		//	at the very least, this needs to set my dirty flag, right?  Here and anywhere we change contentOffset.
	};
	
	//	directly set content offset (like scroll above, but absolute)
	rat.ui.Element.prototype.setContentOffset = function (x, y)
	{
		if( x !== void 0 )
			this.contentOffset.x = x;
		if( y !== void 0 )
			this.contentOffset.y = y;
		
		//	todo: see if there was actually a change
		if (this.viewChanged)
			this.viewChanged();
	};

	//	get current content offset (scroll) value
	rat.ui.Element.prototype.getContentOffset = function ()
	{
		return this.contentOffset.copy();
	};
	//	alternate name
	rat.ui.Element.prototype.getScroll = rat.ui.Element.prototype.getContentOffset;
	
	//	like above, get content offset, but factor in any animation also happening.
	//	return the content offset we expect to reach.
	rat.ui.Element.prototype.getTargetContentOffset = function()
	{
		var list = rat.ui.getAnimatorsForElement(this, rat.ui.Animator.scroller);
		//	if there's more than one, that's basically a bug, but don't worry about it...
		if (list && list.length > 0)
		{
			return list[0].endValue;
		}
		//	no animator - just return offset
		return this.contentOffset.copy();
	};
	
	//	return true if this point (in local space) is in our view space, factoring in scroll values and bounds
	//	useful for scrolled content
	//	(see scrollToShow below for something similar)
	rat.ui.Element.prototype.pointIsInView = function (pos, xSpace, ySpace)
	{
		if (!xSpace)
			xSpace = 0;
		if (!ySpace)
			ySpace = 0;
		var offset = this.contentOffset;
		var scale = this.contentScale;
		if ((pos.x - xSpace)*scale.x + offset.x < 0
				|| (pos.y - ySpace)*scale.y + offset.y < 0)
			return false;
		if ((pos.x + xSpace)*scale.x + offset.x > this.size.x
				|| (pos.y + ySpace)*scale.y + offset.y > this.size.y)
			return false;
		
		return true;
	};

	//	scroll from current position just enough to show this point plus space around it.
	//	"offset" is optional - if it's passed in, set THAT vector, instead of live offset.
	//	"pos" is a center point, and ySpace and xSpace determine how much space to make on each side (like a radius)
	//	see animateScrollToShowElement for a convenient way to scroll to show a subelement
	rat.ui.Element.prototype.scrollToShow = function (pos, xSpace, ySpace, offset)
	{
		if (!offset)
			offset = this.contentOffset;	//	ref
		var scale = this.contentScale;

		//	what values would barely be showing that point?  Make sure we're at least that far.

		var rightEdge = this.size.x - (pos.x + xSpace) * scale.x;		//	x scroll that would bring right edge of object in view
		var leftEdge = -(pos.x - xSpace) * scale.x;	//	x scroll that would bring left edge of object in view
		if (offset.x > rightEdge)
			offset.x = rightEdge;
		else if (offset.x < leftEdge)
			offset.x = leftEdge;

		var bottomEdge = this.size.y - (pos.y + ySpace) * scale.y;
		var topEdge = -(pos.y - ySpace) * scale.y;
		if (offset.y > bottomEdge)
			offset.y = bottomEdge;
		else if (offset.y < topEdge)
			offset.y = topEdge;

		//	if the view has useful content size info, clamp our scroll to not go outside content.
		//	We do want this here, especially when extra space parameters are set.
		this.clampScroll(offset);
	};

	//
	//	animated version of the above - set up an animator to scroll us, over time, to the appropriate position.
	//	TODO:  Maybe remove all these paired functions and just don't animate if time is 0 or undefined.
	//
	rat.ui.Element.prototype.animateScrollToShow = function (pos, xSpace, ySpace, time)
	{
		var offset = this.contentOffset.copy();
		this.scrollToShow(pos, xSpace, ySpace, offset);	//	calculate desired scroll position

		this.animateScroll(offset, time);
	};

	//
	//	Maybe more convenient - scroll to show a specific element
	//
	rat.ui.Element.prototype.animateScrollToShowElement = function (element, extraXSpace, extraYSpace, time)
	{
		if (typeof (extraXSpace) === 'undefined')
			extraXSpace = 0;
		if (typeof (extraYSpace) === 'undefined')
			extraYSpace = 0;
		if (typeof (time) === 'undefined')
			time = 0;

		var bounds = element.getBounds(this.tempRect);
		
		this.animateScrollToShow(
				{ x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 },
				bounds.w / 2 + extraXSpace,
				bounds.h / 2 + extraYSpace,
				time);
	};

	/**
	* scroll this point to center
	* @param {Object=} offset
	*/
	rat.ui.Element.prototype.scrollToCenter = function (pos, offset)
	{
		if (!offset)
			offset = this.contentOffset;	//	ref
		offset.x = this.size.x / 2 - pos.x * this.contentScale.x;
		offset.y = this.size.y / 2 - pos.y * this.contentScale.y;

		this.clampScroll(offset);
		
		//	todo: see if there was actually a change
		if (this.viewChanged)
			this.viewChanged();
	};

	rat.ui.Element.prototype.animateScrollToCenter = function (pos, time)
	{
		var offset = this.contentOffset.copy();
		this.scrollToCenter(pos, offset);	//	calculate desired scroll position

		this.animateScroll(offset, time);
	};
	
	/**
	* Scroll to center my content automatically
	* @param {Object=} offset
	*/
	rat.ui.Element.prototype.scrollToCenterContent = function (offset)
	{
		if (!offset)
			offset = this.contentOffset;	//	ref
		offset.x = this.size.x / 2 - this.contentSize.x / 2 * this.contentScale.x;
		offset.y = this.size.y / 2 - this.contentSize.y / 2 * this.contentScale.y;

		//	in this case, don't clamp, since half the point is to center content that isn't as large as the view containing it.
	};

	//	animate to a given absolute content offset
	//	(used by other functions above, and directly by some games)
	rat.ui.Element.prototype.animateScroll = function (offset, time)
	{
		//	It seems very unlikely that you'd want to have two scroll animations
		//	active at once.  If this later turns out to be not true,
		//	we can make it optional somehow, or remove this call and depend on caller to decide.
		var hadScroller = rat.ui.killAnimatorsForElement(this, rat.ui.Animator.scroller);
		
		var animator = new rat.ui.Animator(rat.ui.Animator.scroller, this);
		animator.setTimer(time);
		//	todo, scale this by distance, somehow?  pass in pixels per sec speed instead of time?
		var startVal = { x: this.contentOffset.x, y: this.contentOffset.y };
		var endVal = { x: offset.x, y: offset.y };
		animator.setStartEndVectors(startVal, endVal);
		animator.setAutoDie();	//	kill animator when it's done
		
		//	if we were already scrolling, don't bother with ramp up in movement...
		//	this helps is avoid something like:  user holds down scroll key,
		//	and because keep easing in each frame, we only move a tiny bit until they let go.
		if (hadScroller)
			animator.setInterpFilter(rat.ui.Animator.filterEaseOut);
	};

	/**
	//	clamp scroll offset to keep from scrolling past edges of actual content,
	//	based on contentSize being correct.
	//	todo allow optional passing in a potential value, and clamp that instead of my current value.
	* @param {Object=} offset
	*/
	rat.ui.Element.prototype.clampScroll = function (offset)
	{
		if (!offset)	//	if one wasn't passed in, use the live one (set a ref to it)
			offset = this.contentOffset;

		if (this.contentSize.x <= 0 || this.contentSize.y <= 0)
			return;	//	was never set...

		var leftMax = -(this.contentSize.x * this.contentScale.x - this.size.x);	//	the farthest contentoffset.x can go
		var upMax = -(this.contentSize.y * this.contentScale.y - this.size.y);	//	the farthest contentoffset.y can go

		if (offset.x < leftMax)
			offset.x = leftMax;
		if (offset.y < upMax)
			offset.y = upMax;
		if (offset.x > 0)
			offset.x = 0;
		if (offset.y > 0)
			offset.y = 0;
	};
	
	//	Here's how we're going to implement zoom.
	//	Like contentSize and offset, the zoom of a pane will refer to the *contents*
	//		of that pane being zoomed by that value.
	//	Why?  We want to be able to zoom the contents of a scrollview, without
	//		having to make assumptions about the content, like knowing there's only one element.
	//		So, easiest to say "zoom refers to my contents".
	//		Our contents will be oblivious to being zoomed, and our contentSize will still refer
	//		to the natural size of our contents before being scaled.
	//	We're going to use a new "zoom" value instead of the existing scale value.
	//	Why?  Because scale already seems to refer to ME being scaled, including my frame?
	//		and it will correlate better with contentSize,
	//		and it'll be easier to insert in the right place in the draw logic, which is complicated.
	//		currently, scale happens pretty early, as part of the whole frame transform...
	//	Like offset, zoom will be implemented at this Element level rather than in scrollview.
	//	Why?  Because it will let us zoom things without having to make them scrollviews,
	//		and when we need to factor zoom into things like localtoglobal position calculation,
	//		we can do that in the base level functions here without having to override elsewhere.
	//		We also will want to do some nice simultaneous zoom/scroll handling, so let's do it
	//		in the same place.
	
	//	directly set content scale
	rat.ui.Element.prototype.setContentScale = function (x, y)
	{
		if( x !== void 0 )
			this.contentScale.x = x;
		if( y !== void 0 )
			this.contentScale.y = y;
		this.setDirty(true);
		
		//	todo: see if there was actually a change
		if (this.viewChanged)
			this.viewChanged();
	};
	//	add a value to current zoom/scale level
	//		(add instead of multiply so that it can be undone)
	rat.ui.Element.prototype.stepZoom = function(delta)
	{
		this.contentScale.x += delta;
		this.contentScale.y += delta;
		this.clampContentScale();
		this.setDirty(true);
		
		//	todo: see if there was actually a change
		if (this.viewChanged)
			this.viewChanged();
	};
	//	clamp scale to the min/max we set previously.
	rat.ui.Element.prototype.clampContentScale = function()
	{
		//	hey, while we're at it, fix weird rounding problems like getting a scale of 1.2000000000002
		
		function trunc(x) { return (((x+0.001) * 100)|0)/100;}
		
		this.contentScale.x = trunc(this.contentScale.x);
		this.contentScale.y = trunc(this.contentScale.y);
		
		if (this.contentScale.x < this.contentScaleMin.x)
			this.contentScale.x = this.contentScaleMin.x;
		if (this.contentScale.y < this.contentScaleMin.y)
			this.contentScale.y = this.contentScaleMin.y;
		if (this.contentScale.x > this.contentScaleMax.x)
			this.contentScale.x = this.contentScaleMax.x;
		if (this.contentScale.y > this.contentScaleMax.y)
			this.contentScale.y = this.contentScaleMax.y;
	};
	rat.ui.Element.prototype.setContentScaleLimits = function(min, max)
	{
		this.contentScaleMin.x = this.contentScaleMin.y = min;
		this.contentScaleMax.x = this.contentScaleMax.y = max;
	};
	
	//	I deeply question this function.  See notes in Sprite module.
	rat.ui.Element.prototype.drawTiled = function(w, h)
	{
		//	nothing, usually overridden
	};

	//	standard draw function does all the work of putting us in the right space,
	//	drawing subElements, etc.
	//	calls drawSelf() for easy overriding in subclasses
	//	(generally speaking, nobody else will need to override draw().  They can just use drawSelf)
	rat.ui.Element.prototype.draw = function (toOffscreen)
	{
		if (!this.isVisible())	//	don't draw me or sub stuff if I'm invisible
			return;
		if (toOffscreen === void 0)	//	not specified
			toOffscreen = false;
		
		//	Give panes a chance to update our state before we draw
		//	note that we're passing in offscreen flag now, so we'll let preDraw decide if it should respect offscreen flag.
		//if (!toOffscreen && this.preDraw )
		if (this.preDraw)
		{
			//	do this BEFORE we handle dirty pane rendering
			res = this.preDraw(toOffscreen);
			if (res && res.abortDraw)
				return;
		}
		
		//	If we're supposed to be using an offscreen buffer, and it doesn't exist or needs updating, update it now.
		//	this will re-enter this function with toOffscreen set to true, among other things.  :)
		if (this.useOffscreen &&
			(!this.offscreen
			|| this.isDirty
			|| (this.checkDirty && this.checkDirty())
			))
		{
			this.renderOffscreen();
			//	and then continue on below, with a prepared offscreen!
		}

		var ctx = rat.graphics.getContext();
		
		//	Rendering to offscreen?  If so, skip a whole bunch of stuff.
		
		//	if rendering offscreen, don't do save/restore or transforms.
		//	Just render cleanly into correctly-sized offscreen buffer.
		//	This is important - we don't want offscreen buffer size affected by position or rotation.
		
		if (!toOffscreen)
		{
			rat.graphics.save();

			// Use applyTransformation() function if one is present,
			// so subclasses can change transformation behavior, if needed.
			// (i.e. change transformation order, change how centering works, etc.)
			if (this.applyTransformation) {
				this.applyTransformation(ctx);
			}
			else {
				rat.graphics.translate(this.place.pos.x, this.place.pos.y);
				if (this.place.rot.angle)
					rat.graphics.rotate(this.place.rot.angle);
				if (this.scale.x !== 1 || this.scale.y !== 1)
					rat.graphics.scale(this.scale.x, this.scale.y);			
			}
		
			//	include or don't include frame?
			//	Frame drawing could go inside the offscreen buffer,
			//		but we need to commit to whether the frame is exactly aligned, and inside our space, or outside.
			//		if outside, it can't be in the buffer, which is always our exact size.
			
			rat.graphics.frameStats.totalElementsDrawn++;	//	for debugging, track total elements drawn per frame
			
			if (this.opacity < 1)
				ctx.globalAlpha = this.opacity;
			
		}	//	end of !toOffscreen check
		
		//	draw my frame, if any.
		//	One problem with drawing the frame here is that it gets scaled,
		//	if there's a scale.  In lots of other ways, we ignore scale when dealing
		//	with bounds, right?  Are frames and bounds supposed to be the same?
		//	We mostly use frames to debug, so it's nice for them to match bounds...
		//	Frames are weird.
		if (this.frameWidth > 0)
		{
			ctx.strokeStyle = this.frameColor.toString();
			ctx.lineWidth = this.frameWidth;
			ctx.strokeRect(-this.center.x - this.frameOutset, -this.center.y - this.frameOutset,
					this.size.x + 2 * this.frameOutset, this.size.y + 2 * this.frameOutset);
		}

		//	Apply clipping, if needed.
		if (!toOffscreen && this.flags & rat.ui.Element.clipFlag)
		{
			ctx.beginPath();
			ctx.rect(0, 0, this.size.x, this.size.y);
			ctx.clip();
		}
		
		//	render FROM my offscreen image.
		if (!toOffscreen && this.useOffscreen && this.offscreen)
		{
			//	center support here only works this cleanly because we were careful to skip centering when we rendered in renderOffscreen()
			this.offscreen.render(ctx, -this.center.x, -this.center.y);
			
			//	TODO:  If rendering FROM offscreen, and transform is simple, skip the whole save/restore business above as well.
			
		} else {	//	finally, a normal manual draw
			
			if (this.events.beforeDraw)
				this.events.beforeDraw(this);

			if (this.drawSelfPre)
				this.drawSelfPre(this);
			
			//	drawSelf is for self and background, not to be scrolled like subpanes below.
			this.drawSelf();

			if (this.events.onDrawSelf)
				this.events.onDrawSelf(this);

			//	get ready to draw sub elements IF we have any...
			if (this.subElements)
			{
				//	scroll my sub-element content,
				//	and let's factor in centering now, too.
				var offsetX = this.contentOffset.x + -this.center.x;
				var offsetY = this.contentOffset.y + -this.center.y;
				
				//if( this.contentOffset.x !== 0 || this.contentOffset.y !== 0 )
				//	rat.graphics.translate(this.contentOffset.x, this.contentOffset.y);
				if (offsetX !== 0 || offsetY !== 0)
					rat.graphics.translate(offsetX, offsetY);
				
				//	scale my content
				if( this.contentScale.x !== 1 || this.contentScale.y !== 1 )
					rat.graphics.scale(this.contentScale.x, this.contentScale.y);
				
				if (this.events.onPreDrawChildren)
					this.events.onPreDrawChildren(this);
				
				this.drawSubElements();

				if (this.events.onDrawChildren)
					this.events.onDrawChildren(this);
				
				//	untranslate and unscale, in case drawSelfPost and afterDraw need to do something.
				//	Those are expected to operate in the same space as drawSelf!
				if( this.contentScale.x !== 1 || this.contentScale.y !== 1 )
					rat.graphics.scale(1/this.contentScale.x, 1/this.contentScale.y);
				if (offsetX !== 0 || offsetY !== 0)
					rat.graphics.translate(-offsetX, -offsetY);
			}
			
			if (this.drawSelfPost)
				this.drawSelfPost(this);

			if (this.events.afterDraw)
				this.events.afterDraw(this);
		}

		if (!toOffscreen)
			rat.graphics.restore();
	};

	//
	//	Draw self.  Usually overridden.  This is called before our subpanes are drawn.
	//
	rat.ui.Element.prototype.drawSelf = function ()
	{
		//	nothing, usually overridden
	};

	//	draw all subelements
	//	Current context is set up to my local coordinates (including scrolled content offset, if any)
	rat.ui.Element.prototype.drawSubElements = function ()
	{
		if (this.subElements)
		{

			//	our bounds don't change when we're scrolled, but our content does, and we need to factor that in when checking visibility below.
			//	instead of adding offset to every subbounds below, let's just adjust the bounds we check here, once.
			var checkBounds = this.tempRect;
			checkBounds.x = -this.contentOffset.x;
			checkBounds.y = -this.contentOffset.y;
			checkBounds.w = this.size.x / this.contentScale.x;
			checkBounds.h = this.size.y / this.contentScale.y;

			for (var i = 0; i < this.subElements.length; i++)
			{
				var sub = this.subElements[i];
				
				//	an idea for minor performance improvements - skip a few function calls by immediately testing
				//	sub.flags & rat.ui.Element.visibleFlag
				//	here?  Probably not worth it?  Let's try anyway.
				if (!(sub.flags & rat.ui.Element.visibleFlag))
					continue;

				//	If we have clipping turned on, and this item is outside our bounds, then don't draw it.
				//	if there's a rotation, give up - maybe it's rotated partly into view?  todo: real polygon intersect math, in my (I am the parent) space.

				var toDraw = true;
				if (((this.flags & rat.ui.Element.clipFlag) !== 0) && sub.place.rot.angle === 0)
				{
					var subBounds = sub.getBounds(this.tempRect);
					//	factor in scale mathematically so we can do correct overlap check
					/*	Disabling, since getBounds() is factoring in scale now.
					subBounds.x *= sub.scale.x;
					subBounds.y *= sub.scale.y;
					subBounds.w *= sub.scale.x;
					subBounds.h *= sub.scale.y;
					*/
					//	Also, it was wrong to scale x and y by the sub pane's scale!
					//	Those values are in parent space.
					//	We should be scaling them by THIS pane's scale, right?
					//	But since we didn't do it above with checkBounds, don't do it here, either...?
					//	If this ever turns out wrong, be sure to add scale to both calculations (STT 2014.1.21)
					//subBounds.x *= this.scale.x;
					//subBounds.y *= this.scale.y;

					if (!rat.collision2D.rectOverlapsRect(subBounds, checkBounds))
						toDraw = false;
				}
				if (toDraw)
					sub.draw();
			}
		}
	};
	
	//	--- Tooltip support in basic elements ---
	//
	//	TODO:  Move all tooltip code to another module, for cleaner code.
	//	TODO:  rename all the "tooltipX" variables to be inside the toolTip structure
	//
	//	See tooltip handling above: A tooltip does not draw in the normal draw sequence - 
	//	it draws on top of everything else when a screen is drawn.
	//	So, we don't add a tooltip as a subelement or anything...
	//	we just set an element's "toolTip" value for later use.

	//
	//	build an automatic text-based tooltip for this element.
	rat.ui.Element.prototype.addTextToolTip = function (text, textColor, boxColor, screen)
	{
		//console.log("addTextToolTip to " + this.name);

		if (!boxColor)
			boxColor = rat.graphics.black;
		if (!textColor)
			textColor = rat.graphics.white;

		var toolTip = new rat.ui.Shape(rat.ui.squareShape);
		//	position gets set below
		toolTip.setSize(200, 20);	//	rewritten below
		toolTip.setColor(boxColor);
		toolTip.setFrame(1, textColor);	//	use text color as frame color so it matches...

		//	A bunch of these values are just hard-coded for nice placement of a standard textbox.
		//	If you want more control, set up your own graphic (or group of graphics) and use setToolTip below.

		var tbox = new rat.ui.TextBox(text);
		tbox.setFont('calibri');
		//tbox.setFontStyle('italic');
		tbox.setTextValue(text);	//	reset to recalculate content size with font (todo: those functions should do that...)
		tbox.setColor(textColor);
		
		this.sizeTextToolTip(15, toolTip, tbox);
		
		toolTip.appendSubElement(tbox);

		this.setToolTip(toolTip, screen, 'rightHigh', { x: 6, y: 0 });	//	offset the whole thing to the right a little...

		return { container: toolTip, textBox: tbox };	//	return multiple things for client control
	};
	
	//	refactored function so it can be called from above, and used externally to resize text in a text tooltip...
	rat.ui.Element.prototype.sizeTextToolTip = function(fontSize, toolTip, textBox)
	{
		if (!toolTip)
			toolTip = this.toolTip;
		if (!textBox)
			textBox = toolTip.subElements[0];
		
		textBox.setFontSize(fontSize);
		
		var XBUFFERSPACING = 14;
		var YBUFFERSPACING = 4;	//	fontSize/3?
		textBox.setPos(XBUFFERSPACING / 2, YBUFFERSPACING / 2);	//	bump over and down for nicer placement within the tooltip box
		
		//	fix tooltip box to match text size
		toolTip.setSize(textBox.contentSize.x + XBUFFERSPACING, textBox.contentSize.y + YBUFFERSPACING + 2);
		
		//	also make the text box match so it's all positioned nicely
		textBox.autoSizeToContent();
	};

	//	Calculate and set position for our current tooltip
	rat.ui.Element.prototype.positionToolTip = function ( placement, offset, fromMouse )
	{
		var toolTip = this.toolTip;
		if ( !toolTip )
			return;

		if ( typeof offset === 'undefined' )
			offset = { x: 0, y: 0 };

		var tipSize = toolTip.getSize();
		var mySize = this.getSize();

		if ( fromMouse )	//	hmm... use mouse's size
		{
			mySize.x = mySize.y = 16;	//	todo better custom mouse support?
		}

		var x = 0;
		var y = 0;
		if (placement === 'none' || placement === '')	//	normal top left corner, aligned with us
		{
			x = y = 0;
		} else if (placement === 'top')	//	above, centered
		{
			x = ( mySize.x - tipSize.x ) / 2;
			y = -tipSize.y;
		} else if (placement === 'topLeft')	//	right/bottom-aligned with our top-left corner.
		{
			x = -tipSize.x;
			y = -tipSize.y;
		} else if (placement === 'topRight')	//	upper right corner
		{
			x = mySize.x;
			y = -tipSize.y;
		} else if (placement === 'bottom')	//	below, centered
		{
			x = ( mySize.x - tipSize.x ) / 2;
			y = mySize.y;
		} else if (placement === 'bottomLeft')	//	aligned to bottom left corner
		{
			x = -tipSize.x;
			y = mySize.y;
		} else if ( placement === 'bottomRight' )	//	aligned to bottom right corner
		{
			x = mySize.x;
			y = mySize.y;
		} else
		{	//default to 'rightHigh' which means on the right, but shifted up artistically (1/3)
			x = mySize.x;
			y = mySize.y / 3 - tipSize.y / 2;	//	align tip vertical center with a high point inside my height
		}

		if ( fromMouse && this.mousePos )	//	now adjust if we're supposed to track mouse pos, if we have a mouse pos right now
		{
			x += this.mousePos.x;
			y += this.mousePos.y;
		}

		toolTip.setPos( x + offset.x, y + offset.y );	//	position relative to this element's location

		//	store original placement info in case our bounds change and we need to recalculate
		this.toolTipPlacement = placement;
		this.toolTipPlacementOffset = { x: offset.x, y: offset.y };
		this.toolTipPlacementFromMouse = fromMouse;

		this.toolTipOffset = toolTip.getPos().copy();	//	remember our tooltip's calculated position for simplicity later
	};
	
	//	For convenience, this function will create a colored background object inside this element.
	rat.ui.Element.prototype.setBackground = function (color)
	{
		//	background
		var back = new rat.ui.Shape(rat.ui.squareShape);
		back.setColor(color);
		this.insertSubElement(back);
		back.autoSizeToParent();

		this.elementBackground = back;
	};
	//	for convenience, set the element's background frame size and color
	//	not much different from setting the frame for the element, right?  Why is this here?
	rat.ui.Element.prototype.setBackgroundFrame = function (frameWidth, frameColor)
	{
		if (this.elementBackground)
			this.elementBackground.setFrame(frameWidth, frameColor);
	};

	//	base boundsChanged function - called any time position or size changes.
	//	nice for overriding, so various subclasses can react to their pos/size changing.
	//	Remember, though, that any overriding needs to call this inherited function, or do the work it does!
	rat.ui.Element.prototype.boundsChanged = function ()
	{
		//	sometimes overridden, as well, but this function should always get called
		if ( this.toolTip )
			this.positionToolTip( this.toolTipPlacement, this.toolTipPlacementOffset, this.toolTipPlacementFromMouse );
		
		//	TODO: would be nice to know whether it was pos or size.  If pos, don't need to mark dirty!
		this.setDirty(true);
	};
	
	//	base stateChanged function - called any time our main set of flags changes
	//	nice for overriding, so various subclasses can easily react to being highlighted or whatnot,
	//	without having to override every single state handling function and call inherited function in each, etc.
	rat.ui.Element.prototype.flagsChanged = function (oldFlags)
	{
		//console.log("flags changed " + oldFlags + " -> " + this.flags);
	};
	//	check if flags actually did change, and if so, call flagsChanged and registered callbacks
	rat.ui.Element.prototype.checkFlagsChanged = function (oldFlags)
	{
		if (oldFlags !== this.flags)
		{
			//	Whether this changes our look depends on what class we are.
			//	But to make everybody's life easier, we'll do all the work here, based on flagsThatDirtyMe flag.
			//	see comments where that variable is defined above.
			if (((oldFlags ^ this.flags) & this.flagsThatDirtyMe) !== 0)
				this.setDirty(true);
			//	see above, again...  some flags only dirty my parent
			if ((((oldFlags ^ this.flags) & this.flagsThatDirtyParent) !== 0) && this.parent)
				this.parent.setDirty(true, true);
			
			this.flagsChanged(oldFlags);
			//	TODO: more generic system for handling callbacks - register callbacks for any interesting event.  See other notes in this file.
			//	see event system - use that?
			if (this.flagsChangedCallback)
				this.flagsChangedCallback(oldFlags, this.callbackInfo);
		}
	};

	/**
	 * Set this element as our current tooltip.
	 * could be anything - textbox, image, whatever.
	 * @param {Object} toolTip
	 * @param {Object} screen
	 * @param {string} placement
	 * @param {Object=} offset
	 * @param {boolean=} fromMouse
	 */
	rat.ui.Element.prototype.setToolTip = function (toolTip, screen, placement, offset, fromMouse)
	{
		if (typeof offset === 'undefined')
			offset = { x: 0, y: 0 };

		this.toolTip = toolTip;	//	set tooltip

		//	positioning logic...
		this.positionToolTip(placement, offset, fromMouse);

		toolTip.setVisible(false);
		toolTip.timer = 0;

		//	If we weren't given a screen object, find our top-most parent automatically.
		//	note that this means the element must already be added to the tree when this function is called!
		//	but see "assumed" flag below
		if (!screen)
		{
			screen = this.getTopParent();
			
			//	Keep track of whether a screen was explicitly specified here,
			//		and if we weren't given one here, and couldn't find one here (because we weren't added to the tree yet)
			//		then set our toolTipScreen later when we ARE added to the tree.
			//	Yet another argument for adding a parentElement argument to all constructors.
			this.toolTipScreenWasAssumed = true;
		}
		//	todo: look into this - does a loop of references like this mess up garbage collection?
		//	we're already a child of the screen - does pointing at our top parent like this cause trouble?
		//	it shouldn't!
		this.toolTipScreen = screen;	//	need this for adding to draw list later
		
		//	Usually, tooltips only make sense if we use mouse tracking on this object.
		//	So, let's assume they want that, here.
		this.setTracksMouse(true);	//	for tooltips to work
	};

	//
	//	return current tooltip container. May be undefined or null, if one hasn't been set.
	rat.ui.Element.prototype.getToolTip = function ()
	{
		return this.toolTip;
	};

	//	Debug utility to put a random-colored frame on ALL elements and subelements
	rat.ui.Element.prototype.frameAllRandom = function ()
	{
		this.applyRecursively(rat.ui.Element.prototype.setFrameRandom, 1);
		
		//	I think frames are outside offscreens.
		//	so, no dirty.
		//this.setDirty(true);
	};

	/// Fire a trigger on this element.
	///	Compare and contrast with flagsChangedCallback, which is a more generic superset of this idea.
	var customTriggerPhases = ['before_', 'on_', 'after_'];
	/**
	 * @param {string} triggerName
	 * @param {?} triggerArgs
	 */
	rat.ui.Element.prototype.fireCustomTrigger = function (triggerName, triggerArgs)
	{
		var funcName;
		for( var index = 0; index !== customTriggerPhases.length; ++index )
		{
			funcName = customTriggerPhases[index] + triggerName;
			if( this[funcName] )
			{
				var continueTrigger = this[funcName](this, triggerName, triggerArgs);
				if (continueTrigger !== void 0 && !continueTrigger)
					return;
			}
		}
	};
	
	//	set whether we want to use offscreen rendering for this element
	rat.ui.Element.prototype.setUseOffscreen = function (useOff)
	{
		if (!rat.ui.allowOffscreens)	//	global disable of ui offscreens.  See above.
			return;
		
		if (this.useOffscreen !== useOff)
			this.setDirty(true);
		this.useOffscreen = useOff;
	};
	
	//	dirty tracking, so we know when to rebuild offscreen
	//	because any change to me affects the look of my parents, set them dirty as well.
	//	except... if I'm invisible, I don't think I should be marking anyone dirty...
	//	we were having trouble with invisible things (or things inside invisible things)
	//	changing in some way and making somebody way up their chain rebuild their offscreen even though it wasn't needed.
	//	So, now I'm skipping this whole call if I'm invisible.
	//	This means that actual visibility changes need to set dirty before the object is invisible!
	//	see checkFlagsChanged and second argument here, which means force the call
	rat.ui.Element.prototype.setDirty = function (isDirty, force)
	{
		if (!this.isVisible() && !force)
			return;
		
		if (isDirty === void 0)
			isDirty = true;
		this.isDirty = isDirty;
		
		//	temp debug code.
		//if (this.useOffscreen && isDirty && this.id === 'player1')
		//{
		//	rat.console.logOnce("heyp1");
		//}
		
		//	this also means my parent is dirty.
		if (isDirty && this.parent)
			this.parent.setDirty(true);
	};
	
	//	This is a little unusual - normally, when one element is dirty, it just needs its parents to know.
	//	see setDirty above.
	//	But in some systems (e.g. XUI), when one thing changes in a certain way (e.g. opacity for a group)
	//	it means all its children will draw differently...
	//	and if any of them have offscreen rendering, those things need to be rerendered.
	//	so, this function is useful for that.  But don't use it unless you really think you need it.
	rat.ui.Element.prototype.setDirtyRecursive = function (isDirty)
	{
		//	whoah, that sucked!  This is setting each one repeatedly up and down the tree.  Let's  not do that...
		//this.applyRecursively(rat.ui.Element.prototype.setDirty, isDirty);

		this.setDirty(isDirty);
		this.applyRecursively(function mySetDirty(theVal) {
			this.isDirty = theVal;
		}, isDirty);
	};
	
	//	Render offscreen version of this element.
	//	Faster to render a precalculated image than draw every frame.
	rat.ui.Element.prototype.renderOffscreen = function()
	{
		//console.log("renderOffscreen " + this.id);
		
		//console.log("ACTUAL RENDER OFFSCREEN for " + this.name);
		//if (this.elementType === 'textBox')
		//	console.log(this.value);
		//	TODO: more optimal width/height usage, based on contentsize?
		//		would be tricky, with offsets and centering and stuff.
		
		var width = this.size.x;
		var height = this.size.y;
		
		var off;
		if (this.offscreen)	//	already have one, just make sure it's the right size
		{
			off = this.offscreen;
			off.setSize(width, height, true);
		} else	//	need a new one
			off = new rat.Offscreen(width, height);
		
		var ctx = off.getContext();
		
		var oldCtx = rat.graphics.getContext();	//	remember old context
		rat.graphics.setContext(ctx);
		this.useOffscreen = false;	//	force drawSelf to do it the normal way this time
		
		//	TODO:  This ignoreCenter flag was from text drawing.  Figure out how to make this more generic!
		//		at the very least, use toOffscreen flag being passed to draw()?
		//		would have to pass to drawSelf, too...
		//		why is centering not handled  automatically in draw(), anyway?
		//		Why is it in subclasses, like text?
		//		IT SHOULD BE handled in draw.  This is a mistake.  Fix it.
		//		drawSelf for each subclass should not have to factor in this.center.x
		//		like they all do.  :(  But I don't want to break everything right now...  Fix later.
		this.ignoreCenter = true;	//	see alignment calculations
		
		this.draw(true);
		
		if (rat.ui.debugOffscreens)
			off.applyDebugOverlay();
		
		this.ignoreCenter = false;
		
		this.useOffscreen = true;
		rat.graphics.setContext(oldCtx);	//	restore old context
		
		this.offscreen = off;
		
		this.isDirty = false;
		//	and we have now drawn all subelements, too, so set them not dirty, either.
		this.applyRecursively(function mySetDirty(arg){this.isDirty = false;});
	};

	// Support for creation from data
	//id:""
	//frame:{
	//	size:00,
	//	color:{
	//		r:00,
	//		g:00,
	//		b:00,
	//		a:0
	//	}
	//},
	//bounds: {
	//	x: {
	//		percent: true,
	//		centered/centered:true,
	//		fromCenter: true,
	//		fromMyEdge/fromMyFarEdge:true,
	//		fromParentEdge/fromParentFarEdge:true,
	//		val:00
	//	}/x:00,
	//	y: {
	//		percent: true,
	//		centered/centered:true,
	//		fromCenter: true,
	//		fromMyEdge/fromMyFarEdge:true,
	//		fromParentEdge/fromParentFarEdge:true,
	//		val:00
	//	}/y:00,
	//	w:{
	//		fromParent:true,
	//		percent: true,
	//		val:00
	//	}/w:00,
	//	h:{
	//			fromParent:true,
	//			percent: true,
	//			val:00
	//	}/h:00
	//},
	//visible:false,
	//highlighted:true,
	//enabled:false,
	//toggled:true,
	//clip:true,
	//contentOffset:{
	//	x:00,
	//	y:00
	//}
	
	rat.ui.Element.editProperties = [
		{ label: "basic",
			props: [
				{propName:'type', type:'string'},
				{propName:'id', type:'string'},
				{propName:'name', type:'string'},
			],
		},
		{ label: "location",
			props: [
				{label:"pos", propName:'bounds', type:'xyvector', valueType:'float'},
				{label:"size", propName:'bounds', type:'whvector', valueType:'float'},
				//	nobody but scrollview uses this.  So, I'm going to set it there.
				//	Feel free to move this back if you want.
				//{label:"contentSize", propName:'contentSize', type:'sizevector', valueType:'float'},
				{propName:'autoCenter', type:'boolean', tipText:"anchor from center"},
				//	todo: support more explicit anchor values as well!
				{propName:'rotation', type:'float', tipText:"rotation around anchor, in radians"},
			],
		},
		/*	TODO: this is hard to support, and confusing.  :(
		{ label: "autoLocation", defaultClosed:true,
			props: [
				
				{label:"x%", propName:'bounds.x.percent', type:'boolean'},
				{label:"y%", propName:'bounds.y.percent', type:'boolean'},
				{label:"w%", propName:'bounds.w.percent', type:'boolean'},
				{label:"h%", propName:'bounds.h.percent', type:'boolean'},
				{label:"autoFill", propName:'bounds.autoFill', type:'boolean'},
				
				{label:"xVal", propName:'bounds.x.val', type:'float'},
				{label:"yVal", propName:'bounds.y.val', type:'float'},
				{label:"wVal", propName:'bounds.w.val', type:'float'},
				{label:"hVal", propName:'bounds.h.val', type:'float'},
			],
		},
		*/
		{ label: "appearance", defaultClosed:true,
			props: [
				{propName:'color', type:'color', tipText:"content color, depends on type"},
				{propName:'frameSize', type:'float'},
				{propName:'frameColor', type:'color'},
				{propName:'frameOutset', type:'float', tipText:"expand or shrink frame (in pixels)"},
			],
		},
		
		{ label: "flags", defaultClosed:true,
			props: [
				{propName:'visible', type:'boolean'},
				//	highlight is runtime
				{propName:'enabled', type:'boolean'},
				{propName:'toggled', type:'boolean'},
				{propName:'clip', type:'boolean'},
				{propName:'autoSizeAfterLoad', type:'boolean'},
				{propName:'autoScaleAfterLoad', type:'boolean'},
				{propName:'drawTiled', type:'boolean'},
				{propName:'useOffscreen', type:'boolean'},
			],
		},
	];
	/** @suppress {missingProperties} */
	rat.ui.Element.setupFromData = function (pane, data, parentBounds)
	{
		//	set my bounds.
		pane.setBounds(rat.ui.data.calcBounds(data, parentBounds));
		if (data.rotation !== void 0 || data.rot !== void 0)
			pane.setRotation(data.rotation || data.rot);
		
		//	support setting my center values, which is different from just one-time centering position above,
		//	in cases like animating scale, which really needs to know where my conceptual center is, later.
		if (data.autoCenter !== void 0)
			pane.autoCenter(data.autoCenter);
		//	todo: support more explicit centering, or horiz/vert centering separately?
		
		//	Do i want a frame?
		if (data.frame)	//	here's one way to set it, with a "frame" structure.
			pane.setFrame(data.frame.size, data.frame.color, data.frame.outset);
		//	here's another...
		if (data.frameSize !== void 0)
			pane.setFrame(data.frameSize, data.frameColor, data.frameOutset);

		if( data.id !== void 0 )
			pane.setID( data.id );

		//	States/settings
		if (data.color)
			pane.setColor(new rat.graphics.Color(data.color));
		
		//	Flags
		//	todo: support more flexible "flags" value in addition to (instead of?) custom names for each of these flags?
		//		There's value in calling these functions (e.g. setEnabled()) beyond the actual bit setting.
		//		So, we need to do that either way.  Maybe walk through the flags one at a time, and have a list of functions to call for each?
		//		In the mean time, we require custom flag names for each flag, which just adds more coding work each time we add support
		//		for a new flag.
		if( data.visible !== void 0 )
			pane.setVisible(!!data.visible);
		if( data.highlighted !== void 0 )
			pane.setHighlighted(!!data.highlighted);
		if (data.enabled !== void 0)
			pane.setEnabled(!!data.enabled);
		if (data.toggled !== void 0)
			pane.setToggled(!!data.toggled);
		if (data.clip !== void 0)
			pane.setClip(!!data.clip);
		if (data.autoSizeAfterLoad !== void 0)
			pane.setFlag(rat.ui.Element.autoSizeAfterLoadFlag, !!data.autoSizeAfterLoad);
		if (data.autoScaleAfterLoad !== void 0)
			pane.setFlag(rat.ui.Element.autoScaleAfterLoadFlag, !!data.autoScaleAfterLoad);
		if (data.drawTiled !== void 0)
			pane.setFlag(rat.ui.Element.drawTiledFlag, !!data.drawTiled);

		if (data.contentSize && data.contentSize.x)
			pane.setContentSize(data.contentSize.x, data.contentSize.y);
		if (data.contentOffset)
			pane.setContentOffset(data.contentOffset.x, data.contentOffset.y);
		if (data.contentScale)
			pane.setContentScale(data.contentScale.x, data.contentScale.y);
		//	todo: setContentScaleLimits
			
		if (data.callback)
			pane.setCallback(data.callback, data.callbackInfo);

		if (data.onFocus)
			pane.events.onFocus = data.onFocus;
		if (data.onBlur)
			pane.events.onBlur = data.onBlur;
		if (data.beforeDraw)
			pane.events.beforeDraw = data.beforeDraw;
		if (data.onDrawSelf)
			pane.events.onDrawSelf = data.onDrawSelf;
		if (data.onPreDrawChildren)
			pane.events.onPreDrawChildren = data.onPreDrawChildren;
		if (data.onDrawChildren)
			pane.events.onDrawChildren = data.onDrawChildren;
		if (data.afterDraw)
			pane.events.afterDraw = data.afterDraw;
		
		if (data.useOffscreen !== void 0)
			pane.setUseOffscreen(data.useOffscreen);
	};

	//	old naming convention
	//rat.graphics.Element = rat.ui.Element;
} );