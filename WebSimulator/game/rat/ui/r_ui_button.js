
//----------------------------
//	button Element

//	TODO
//		Improved color state setting functions for color, text, and images.
//		support overlay art?  A second image that shows/doesn't show also based on state.  could be flexible and generic.
//
//		Figure out how to autosize a spritebutton from an image the loads late

//	Notes on Dirty Flags for buttons.
//		First of all, buttons contain images and text,
//			but they aren't classic "subElement" entries.
//			So, one thing we do is let the image or text track its own dirty state like normal
//			(which is useful because they do that carefully on each function)
//			and then we do a special dirty check ourselves by supplying a checkDirty() function, which rat.ui.Element respects.
//		Second, it's tricky because we might have several buttons that could be changing or updating, or whatever,
//			or we might even have images/text that is NOT changing, but we swap out which one is active when our state changes.
//			State changes need to potentially set dirty flag, even if our text or images haven't themselves changed.
//			We solve this with the simple use of flagsThatDirtyMe, which is what it's for.  :)
//		Also note that updateDisplayState is a bad place to check/set dirty, because it's called from drawSelf() which is
//			only called after the rat.ui.Element system has already done its dirty check.
//			So, that's not quite ideal.  the updateDisplayState call should probably get moved to earlier (e.g. draw() override)
//			or happen on state changes instead of in draw loop.
//			But for now, I'm not too worried.  Our other dirty checks should cover it.
//		Also: buttons are not necessarily an ideal place to be using offscreens, since they update often?
//			You might consider setting textUseOffscreen to make the actual text offscreen, which is generally a good idea with text,
//			but leave the button not offscreened?  It's up to you and your specific case, of course.
//
rat.modules.add( "rat.ui.r_ui_button",
[
	{name: "rat.utils.r_utils", processBefore: true },
	{name: "rat.ui.r_ui", processBefore: true },
	{name: "rat.ui.r_ui_textbox", processBefore: true },
	
	"rat.ui.r_ui_bubblebox",
	"rat.ui.r_ui_sprite",
	"rat.graphics.r_image",
	"rat.graphics.r_graphics",
],
function(rat)
{
	/**
	 * @constructor
	 * @extends rat.ui.Element
	 * @param {string=} resource
	 * @param {string=} resourceHi
	 * @param {string=} resourcePressed
	 * @param {string=} resourceDisabled
	 * @param {Object=} extra1 (optional - used for external image formats (see makeImage))
	 * @param {boolean=} extra2 (optional - used for external image formats (see makeImage))
	*/
	rat.ui.Button = function (buttonType, resource, resourceHi, resourcePressed, resourceDisabled, extra1, extra2)
	{
		rat.ui.Button.prototype.parentConstructor.call(this); //	default init

		this.setTargetable(true);
		this.isSetup = false;
		if (buttonType !== void 0)
			this.setupButton(buttonType, resource, resourceHi, resourcePressed, resourceDisabled, extra1, extra2);
	};
	rat.utils.inheritClassFrom(rat.ui.Button, rat.ui.Element);
	rat.ui.Button.prototype.elementType = "button";

	//	these flag changes need to set me dirty, because they change my look!
	//	see rat.ui module, comments above flagsThatDirtyMe variable,
	//	and rat.ui.Element.prototype.checkFlagsChanged function.
	rat.ui.Button.prototype.flagsThatDirtyMe = 
			rat.ui.Element.highlightedFlag |
			rat.ui.Element.enabledFlag |
			rat.ui.Element.pressedFlag |
			rat.ui.Element.toggledFlag;

	rat.ui.Button.prototype.textInset = 8;	//	how far in from edges text is placed, by default
	//	shift text around, e.g. if some fonts naturally hang low, you can change a button's y offset to compensate
	rat.ui.Button.prototype.textOffsetX = 0;
	rat.ui.Button.prototype.textOffsetY = 0;
	
	//	some standard/class-wide values
	rat.ui.Button.spriteType = 1;
	rat.ui.Button.bubbleType = 2;
	rat.ui.Button.cheapType = 3;
	rat.ui.Button.coolType = 4;	//	an attempt at a very nice-looking but still shape-defined button.
	rat.ui.Button.defaultClickSound = 'click';
	
	rat.ui.Button.standardCornerScale = (1/6);	//	use this to come up with standard corner radius from height
	
	//	rat.ui.Button.defaultClickSound;	//	undefined initially, can be set by client to set default click sound for all future elements

	/**
	 * @param {string=} resource
	 * @param {string=} resourceHi
	 * @param {string=} resourcePressed
	 * @param {string=} resourceDisabled
	 * @param {Object=} extra1 (optional - used for external image formats (see makeImage))
	 * @param {boolean=} extra2 (optional - used for external image formats (see makeImage))
	*/
	rat.ui.Button.prototype.setupButton = function(buttonType, resource, resourceHi, resourcePressed, resourceDisabled, extra1, extra2)
	{
		if (this.isSetup)	//	not sure we want this.  But I'm afraid to break anything.
			return;
		this.isSetup = true;

		this.type = buttonType;

		//	create bubble/sprite resource
		if (buttonType === rat.ui.Button.spriteType)
		{
			this.buttonImage = new rat.ui.Sprite();
			
		} else if (buttonType === rat.ui.Button.bubbleType)
		{
			this.buttonImage = new rat.ui.BubbleBox();
		} else if ((buttonType === rat.ui.Button.cheapType || buttonType === rat.ui.Button.coolType) && resource)
		{
			//	cheap buttons support an image thrown in there as well, if one was provided
			this.buttonImage = new rat.ui.Sprite();
		}
		
		//	if image subelement successfully got created above
		if (typeof this.buttonImage !== 'undefined')
		{
			this.appendSubElement(this.buttonImage);
		}
		
		//	we have several frames we explicitly keep track of.
		//	todo: standardize all this state-related rendering stuff.  Have one master array with structs that define
		//	all rendering info (image, colors, text colors, frames, etc.) along with flags for identifying complex state combinations.
		//	Working on this.  see colorStates.  Note that I'm leaving old support in here,
		//	for older projects that still depend on this code.
		
		if (resource)
		{
			this.imageNormal = rat.graphics.makeImage(resource, extra1, extra2);
			//	questionable special case:
			if ((buttonType === rat.ui.Button.spriteType
					|| buttonType === rat.ui.Button.cheapType
					|| buttonType === rat.ui.Button.coolType)
				&& this.imageNormal.size)
			{
				//console.log("trying to set button size from image");
				this.setSize(this.imageNormal.size.x, this.imageNormal.size.y);	//	this will work if the image was already cached...
				//console.log("done trying");
			}
		}
		
		if (resourceHi)
			this.imageHi = rat.graphics.makeImage(resourceHi, extra1, extra2);

		if (resourcePressed)
			this.imagePressed = rat.graphics.makeImage(resourcePressed, extra1, extra2);

		if (resourceDisabled)
			this.imageDisabled = rat.graphics.makeImage(resourceDisabled, extra1, extra2);

		this.toggles = false; //	see rat.ui.Element.toggledFlag - we aren't a toggle button by default

		//	todo: support default click down and click up both
		this.clickSound = rat.ui.Button.defaultClickSound;	//	if there is one

		this.name = "<but>" + this.id;
		
		//	in case this setup happened after our size was set,
		//	then update newly created button image size...
		if (this.buttonImage)
			this.boundsChanged();
		
		//	for cheap/cool, some additional properties
		this.cornerRadius = 10;
		this.cornerRadiusSet = false;	//	we'll adapt this on the fly to size changes, unless somebody sets it explicitly.
		
		this.setDirty(true);
	};

	/**
	* util to make a simple sprite button
	* @param {string=} res
	* @param {string=} resHi
	* @param {string=} resPressed
	* @param {string=} resDisabled
	* @param {Object=} extra1 (optional - used for external image formats (see makeImage))
	* @param {boolean=} extra2 (optional - used for external image formats (see makeImage))
	*/
	rat.ui.makeSpriteButton = function (res, resHi, resPressed, resDisabled, extra1, extra2)
	{
		return new rat.ui.Button(rat.ui.Button.spriteType, res, resHi, resPressed, resDisabled, extra1, extra2);
	};

	/**
	* util to make a simple bubble button
	* @param {string=} resPressed
	* @param {string=} resDisabled
	*/
	rat.ui.makeBubbleButton = function (res, resHi, resPressed, resDisabled)
	{
		return new rat.ui.Button(rat.ui.Button.bubbleType, res, resHi, resPressed, resDisabled);
	};

	//	Create a table of standard color states based on a starting color.
	rat.ui.Button.createStandardColorStates = function(color)
	{
		if (typeof(color) === 'string')
			color = new rat.graphics.Color(color);

		var colorStates = [];
			//	this is a bunch of code to make up colors based on some vaguely mid-range color being passed in.
			//	These are good defaults, and you can override stuff by calling one of the setStateXXX functions below, if you want.
		colorStates[0] = {};
		colorStates[0].flags = rat.ui.Element.enabledFlag; //	normal state
		colorStates[0].color = color.copy();
		colorStates[0].textColor = new rat.graphics.Color(color.r * 4, color.g * 4, color.b * 4, color.a);
		colorStates[0].frameColor = new rat.graphics.Color(color.r / 4, color.g / 4, color.b / 4, color.a);
		colorStates[0].frameWidth = 4;
		
		colorStates[1] = {};
		colorStates[1].flags = rat.ui.Element.enabledFlag | rat.ui.Element.highlightedFlag; //	highlight state
		colorStates[1].color = new rat.graphics.Color(color.r + 50, color.g + 50, color.b + 50, color.a);
		colorStates[1].textColor = new rat.graphics.Color(color.r * 6, color.g * 6, color.b * 6, color.a);
		colorStates[1].frameColor = new rat.graphics.Color(color.r / 5, color.g / 5, color.b / 5, color.a);
		colorStates[1].frameWidth = 4;
		
		colorStates[2] = {};
		colorStates[2].flags = rat.ui.Element.enabledFlag | rat.ui.Element.pressedFlag;
		colorStates[2].color = new rat.graphics.Color(color.r / 2, color.g / 2, color.b / 2, color.a);
		colorStates[2].textColor = new rat.graphics.Color(color.r * 4, color.g * 4, color.b * 4, color.a);
		colorStates[2].frameColor = new rat.graphics.Color(color.r / 5, color.g / 5, color.b / 5, color.a);
		colorStates[2].frameWidth = 4;
		
		colorStates[3] = {};
		colorStates[3].flags = rat.ui.Element.enabledFlag | rat.ui.Element.toggledFlag;
		colorStates[3].color = colorStates[0].color.copy();
		colorStates[3].textColor = new rat.graphics.Color(color.r * 10, color.g * 10, color.b * 10, color.a);
		colorStates[3].frameColor = new rat.graphics.Color(color.r * 4, color.g * 4, color.b * 4, color.a);
		colorStates[3].frameWidth = 4;
		
		colorStates[4] = {};
		colorStates[4].flags = rat.ui.Element.enabledFlag | rat.ui.Element.toggledFlag | rat.ui.Element.highlightedFlag;
		colorStates[4].color = colorStates[1].color.copy();
		colorStates[4].textColor = colorStates[1].textColor.copy();
		colorStates[4].frameColor = new rat.graphics.Color(color.r * 4, color.g * 4, color.b * 4, color.a);
		colorStates[4].frameWidth = 4;
		
		colorStates[5] = {};
		colorStates[5].flags = rat.ui.Element.enabledFlag | rat.ui.Element.toggledFlag | rat.ui.Element.pressedFlag;
		colorStates[5].color = colorStates[2].color.copy();
		colorStates[5].textColor = colorStates[2].textColor.copy();
		colorStates[5].frameColor = new rat.graphics.Color(color.r * 4, color.g * 4, color.b * 4, color.a);
		colorStates[5].frameWidth = 4;
		
		colorStates[6] = {};
		colorStates[6].flags = 0; //	disabled (enabled flag is not set, unlike others)
		colorStates[6].color = new rat.graphics.Color(120, 120, 120, color.a);
		colorStates[6].textColor = new rat.graphics.Color(64, 64, 64, color.a);
		colorStates[6].frameColor = new rat.graphics.Color(64, 64, 64, color.a);
		colorStates[6].frameWidth = 4;
		
		return colorStates;
	}

	//
	//	Make a cheap button - a simple boxy colored button
	//	This makes tons of assumptions, and isn't pretty, but does support many distinct button states.
	//	Useful for prototyping, if nothing else.
	//	I wish I had reversed these arguments, since res is almost always null.
	rat.ui.makeCheapButton = function (res, color)
	{
		var colorStates = rat.ui.Button.createStandardColorStates(color);
		return rat.ui.makeCheapButtonWithColors(res, colorStates);
	};
	
	//	similar, but hopefully a little prettier!
	rat.ui.makeCoolButton = function (res, color)
	{
		var colorStates = rat.ui.Button.createStandardColorStates(color);
		var but = new rat.ui.Button(rat.ui.Button.coolType, res);
		but.colorStates = colorStates;
		return but;
	};
	
	//	make a cheap button, but also specify color states rather than use the defaults.
	//	This is similar to calling makeCheapButton and then setStateColors, I think.
	rat.ui.makeCheapButtonWithColors = function (res, colorStates)
	{
		var button = new rat.ui.Button(rat.ui.Button.cheapType, res);
		button.colorStates = colorStates;

		return button;
	};

	//	special dirty check functionality, since we have image/text subobjects that aren't subelements
	rat.ui.Button.prototype.checkDirty = function()
	{
		if ((this.buttonImage && this.buttonImage.isDirty) || (this.text && this.text.isDirty) || this.isDirty)
			return true;
		return false;
	};

	rat.ui.Button.prototype.setOutline = function (enabled, scale)
	{
		if (this.buttonImage)
			this.buttonImage.setOutline(enabled, scale);
	};

	//	button bounds changed - adjust contents and whatnot accordingly
	rat.ui.Button.prototype.boundsChanged = function ()
	{
		//console.log("button size changed");
		//	make sure our subelements match our size
		//	change this logic depending on type!  (sprite buttons, don't do this)
		if (this.type === rat.ui.Button.bubbleType)
		{
			//console.log("btn: setting image size to " + this.size.x + ", " + this.size.y);
			if (this.buttonImage)
				this.buttonImage.setSize(this.size.x, this.size.y);
			this.setContentSize(this.size.x, this.size.y);
		}
		else if (this.type === rat.ui.Button.spriteType)
		{
			//	This is weird... do we really want the sprite to match our size?
			//console.log("button bounds changed " + this.size.x + " x " + this.size.y);
			if (this.buttonImage)
				this.buttonImage.setSize(this.size.x, this.size.y);
			this.setContentSize(this.size.x, this.size.y);
		}
		else if (this.text)
		{
			//console.log("btn: setting text size to " + this.size.x + ", " + this.size.y);
			this.resizeTextBox();
			//	todo: this isn't called everywhere - and is it right?  shouldn't we only do this if we're ONLY text?  How likely is that?
			this.setContentSize(this.text.contentSize.x, this.text.contentSize.y);
		}
		
		//	if the corner radius hasn't been explicitly set, adapt it!
		if (this.type === rat.ui.Button.coolType && !this.cornerRadiusSet)
		{
			this.cornerRadius = (this.size.y * rat.ui.Button.standardCornerScale)|0;
		}

		rat.ui.Button.prototype.parentPrototype.boundsChanged.call(this);	//	also do inherited behavior
	};

	rat.ui.Button.prototype.centerContent = function ()
	{
		if (this.buttonImage)
		{
			this.buttonImage.centerInParent();
		}
		if (this.text)
		{
			this.text.centerInParent();
		}
	};

	//	if the button is set to not adjust for scale, we need to make sure our bubble box inside knows about it.
	//
	rat.ui.Button.prototype.setAdjustForScale = function (adjust)
	{
		rat.ui.Element.prototype.setAdjustForScale.call(this, adjust);	//	set our flag normally
		if (this.buttonImage)
			this.buttonImage.setAdjustForScale(adjust);
	};

	//	set text inset (how far from edges text is)
	rat.ui.Button.prototype.setTextInset = function(value)
	{
		if (this.textInset != value)
		{
			this.textInset = value;
			this.resizeTextBox();
		}
	};
	
	//	shift text position a little from where it's normally calculated to be,
	//	still respecting inset and centering and whatnot.
	//	This is useful if, for instance, a particular font hangs unusually high or low.
	//	Compare with setTextPosition below, which is absolute and turns off auto centering and ignores.
	rat.ui.Button.prototype.setTextOffset = function(offX, offY)
	{
		if (this.textOffsetX !== offX || this.textOffsetY !== offY)
		{
			this.textOffsetX = offX;
			this.textOffsetY = offY;
			this.resizeTextBox();
		}
	};
	
	//
	//	Place text specifically here.
	//	This means stop centering and put it at this specific location.
	//
	rat.ui.Button.prototype.setTextPosition = function (x, y)
	{
		if (this.text)
		{
			if (this.text.place.pos.x !== x || this.text.place.pos.y !== y)
				this.setDirty(true);
			
			this.text.place.pos.x = x;
			this.text.place.pos.y = y;
			this.text.setAlign(rat.ui.TextBox.alignLeft);
			this.text.setBaseline(rat.ui.TextBox.baselineTop);
		}
	};

	//
	//	get reference to our text box so it can be directly manipulated.
	//
	rat.ui.Button.prototype.getTextBox = function ()
	{
		return this.text;
	};
	
	//	Make sure we have a text box (create it, if needed) and return it.
	rat.ui.Button.prototype.checkAndMakeTextBox = function ()
	{
		if (!this.text)	//	not already built
		{
			//	create text box
			this.text = new rat.ui.TextBox("");
			this.text.setEnabled(false);
			this.resizeTextBox();
			this.appendSubElement(this.text);
			this.text.centerText();		//	center by default
			//this.text.setFrame(1, rat.graphics.white);	//	debug
		}

		return this.text;
	};
	
	//	adjust our textbox's size based on button size and a few adjustment properties.
	rat.ui.Button.prototype.resizeTextBox = function()
	{
		if (this.text)
		{
			this.text.setPos(this.textInset + this.textOffsetX, this.textOffsetY);
			this.text.setSize(this.size.x - 2 * this.textInset, this.size.y);
		}
	};
	
	//	todo: maybe never use this?  Is resizeTextBox enough?
	rat.ui.Button.prototype.removeTextBox = function ()
	{
		if (this.text)
		{
			this.removeSubElement(this.text);
			this.text = null;
		}
	};

	//
	//	get reference to our image, if there is one, so it can be directly manipulated.
	//
	rat.ui.Button.prototype.getImage = function ()
	{
		return this.buttonImage;
	};

	rat.ui.Button.prototype.setTextValue = function (value)
	{
		this.checkAndMakeTextBox().setTextValue(value);
		this.name = "<but>" + this.id + "(" + value + ")";
	};

	rat.ui.Button.prototype.translateAndSetTextValue = function (value)
	{
		this.name = "<but>" + this.id + "(" + value + ")";
		this.checkAndMakeTextBox().translateAndSetTextValue(value);
	};
	
	rat.ui.Button.prototype.setFont = function (font, size, style)
	{
		this.checkAndMakeTextBox().setFont(font, size, style);
	};

	rat.ui.Button.prototype.setFontStyle = function (style)
	{
		this.checkAndMakeTextBox().setFontStyle(style);
	};

	rat.ui.Button.prototype.setFontSize = function (size)
	{
		this.checkAndMakeTextBox().setFontSize(size);
	};
	
	rat.ui.Button.prototype.setCornerRadius = function(rad)
	{
		if (rad != this.cornerRadius)
			this.setDirty(true);
		this.cornerRadius = rad;
		this.cornerRadiusSet = true;
	};
	
	//	set text colors for this button
	//	This is the easy comfortable version, where you specify common colors.
	//	For more control, see setStateTextColors
	rat.ui.Button.prototype.setTextColors = function (color, colorHi, colorPressed, colorDisabled)
	{
		//	provide some defaults if not specified
		//	(todo: do this in a lower-level array-based function so everyone benefits? not sure how to best do that.)
		if (typeof colorHi === 'undefined')
			colorHi = color;
		if (typeof colorPressed === 'undefined')
			colorPressed = color;
		if (typeof colorDisabled === 'undefined')
			colorDisabled = color;

		//	build on top of the function setStateTextColors(), which does what we want in a generic way.
		var RE = rat.ui.Element;	//	for readability
		var statePairs = [
			{state: RE.enabledFlag, textColor: color},	//	normal
			{state: RE.enabledFlag | RE.highlightedFlag, textColor: colorHi},	//	highlighted
			{state: RE.enabledFlag | RE.pressedFlag, textColor: colorPressed},	//	pressed
			{state: RE.enabledFlag | RE.toggledFlag, textColor: colorPressed},	//	toggled
			{state: RE.enabledFlag | RE.toggledFlag | RE.highlightedFlag, textColor: colorHi},	//	toggled highlighted
			{state: RE.enabledFlag | RE.toggledFlag | RE.pressedFlag, textColor: color},	//	toggled pressed
			{state: 0, textColor: colorDisabled},	//	disabled
		];
		this.setStateTextColors(statePairs);
	};
	
	//	A very flexible way to set up text color states that match various possible button states.
	//	This will add text color info to any matching state, or create a new state if it needs to.
	//	We expect to be passed in an array of state+color pairs, like this:
	//	[
	//		{state: rat.ui.Element.enabledFlag, textColor: rat.graphics.white},
	//		{state: rat.ui.Element.enabledFlag | rat.ui.Element.highlightedFlag, textColor: new rat.graphics.Color(10,200,150)},
	//		{state: rat.ui.Element.enabledFlag | rat.ui.Element.toggledFlag | rat.ui.Element.highlightedFlag | , textColor: rat.graphics.gray},
	//	]
	//
	rat.ui.Button.prototype.setStateTextColors = function (stateColorPairs)
	{
		this.setStatesByField(stateColorPairs, 'textColor');
	};
	rat.ui.Button.prototype.setTextColorStates = rat.ui.Button.prototype.setStateTextColors;	//	old name, backwards compat
	
	//	same thing for base color
	rat.ui.Button.prototype.setStateColors = function (stateColorPairs)
	{
		this.setStatesByField(stateColorPairs, 'color');
	};
	
	//	same thing for frame color
	rat.ui.Button.prototype.setStateFrameColors = function (stateColorPairs)
	{
		this.setStatesByField(stateColorPairs, 'frameColor');
	};
	
	//	and for frame width
	rat.ui.Button.prototype.setStateFrameWidth = function (stateValuePairs)
	{
		this.setStatesByField(stateValuePairs, 'frameWidth');
	};
	
	//
	//	A very flexible way to set up images that match various possible button states.
	//	This will work for image buttons, bubble buttons, etc.
	//	This will add image info to any matching state, or create a new state if it needs to.
	//	We expect to be passed in an array of state+resource settings, like this:
	//	[
	//		{state: rat.ui.Element.enabledFlag, resource: "normal.png"},
	//		{state: rat.ui.Element.enabledFlag | rat.ui.Element.highlightedFlag, resource: "high.png"},
	//		{state: rat.ui.Element.enabledFlag | rat.ui.Element.toggledFlag | rat.ui.Element.highlightedFlag, resource: "toggled_and_highlighted.png"},
	//	]
	//	Alternatively, provide in an imageRef directly, instead of a resource, and we'll use that.
	//	Or, set imageRef to null explicitly, if you want us to NOT draw an image in that state.
	//
	//	Use "doUpdate" flag to control whether or not images are automatically updated by this button on each frame.
	//	This is useful, for instance, if you want to use the same image in multiple states, but only want it to be updated once.
	//	By default, doUpdate is set to true for state images, so all images update at the same time, which is nice for keeping state image animations in sync.
	//	If you want to NOT update each image, e.g. if you're reusing the same imageref, then be sure to set doUpdate to false in the data you pass in, e.g.
	//		{ state: rat.ui.Element.enabledFlag, imageRef : myImage, doUpdate : false},
	//	Or, alternatively, use multiple imagerefs, which is kinda what they're for.  They're supposed to be lightweight.
	//	(which might be an argument for removing this "doUpdate" flag stuff entirely anyway)
	//		
	rat.ui.Button.prototype.setStateImages = function (stateImageSets, extra1, extra2)
	{
		//	We're going to set imageRef values below.
		//	But first, for the caller's convenience, let's build imageRef values if they provided a simple resource name instead.
		for (var i = 0; i < stateImageSets.length; i++)
		{
			var set = stateImageSets[i];
			
			//	note:  If imageRef is undefined, go ahead and look for resource.
			//	if imageRef is null, that means they specifically set it that way, and we should respect that, and use null as our value.
			if (typeof(set.imageRef) === "undefined")
			{
				if (!set.resource)
					rat.console.log("Error:  no imageRef or image specified in setStateImages");
				set.imageRef = rat.graphics.makeImage(set.resource, extra1, extra2);
				if (Array.isArray(set.resource))
				{
					//	this is practically guaranteed to be the wrong speed, but at least designer will see it's animating..
					//	The expected way to set the animation speed is something like this:
					//	button.getMatchingState(rat.ui.Element.enabledFlag).imageRef.setAnimSpeed(8);
					//	(after calling setStateImages)
					//	see sample ui code used in rtest
					set.imageRef.setAnimSpeed(1);
				}
			}
			
			//	and if they didn't define "doUpdate" flags, make some up.
			if (typeof(set.doUpdate) === "undefined")
			{
				set.doUpdate = true;
			}
		}
		
		this.setStatesByField(stateImageSets, 'imageRef');
		
		this.setStatesByField(stateImageSets, 'doUpdate');
	};
	
	//
	//	Low-level color state field setting utility, used by all the various "setStateXXXs" functions...
	//	This is an internal function.  In general, you want to instead call
	//		setStateImages
	//		setStateColors
	//		setStateTextColors
	//		setStateFrameColors
	//
	//	This is hopefully the main bottleneck for setting state values.
	//	A very flexible way to set up color states that match various possible button states.
	//	This will add info to any existing matching state, or create a new state if it needs to.
	//	We expect to be passed in an array of state+value pairs.  See other functions for examples and details.
	rat.ui.Button.prototype.setStatesByField = function(statePairs, fieldName)
	{
		if (!this.colorStates)	//	no states?  Create the list.
			this.colorStates = [];
	
		//	would it be better to set up some defaults?
		//if (typeof this.colorStates === 'undefined')
		//	this.setDefaultColorStates();
		
		for (var i = 0; i < statePairs.length; i++)
		{
			var statePair = statePairs[i];
			var stateIndex = this.getMatchingStateIndex(statePair.state, true);
			
			var value = statePair[fieldName];
			//	for any color type, support converting from standard style string, for convenience.
			if (fieldName === 'textColor' || fieldName === 'color' || fieldName === 'frameColor')
			{
				if (typeof(value) === 'string')
					value = rat.graphics.Color.makeFromStyleString(value);
			}
			
			this.colorStates[stateIndex][fieldName] = value;
		}
		
		//	let's assume we're setting them because we're using them immediately to set/change the look of the button.
		this.setDirty(true);
	};
	
	//	find exact matching color state in our list,
	//	create new state entry if there wasn't one.
	//	Note that this is VERY different from findBestStateMatch below!
	//	This function matches only exactly, and creates a new entry, so only use it on button creation/setup...
	/**
	 * @param {?} state
	 * @param {boolean=} createNew
	 */
	rat.ui.Button.prototype.getMatchingStateIndex = function(state, createNew)
	{
		//	look for color state with the exact same flags.
		if (!this.colorStates)
			return -1;
		var foundIndex = -1;
		for (var lookIndex = 0; lookIndex < this.colorStates.length; lookIndex++)
		{
			if (this.colorStates[lookIndex].flags === state)
				return lookIndex;
		}
		if (foundIndex < 0)	//	if not found, add to end
		{
			if (!createNew)
				return -1;
				
			foundIndex = this.colorStates.length;
			this.colorStates[foundIndex] = {
				flags: state,
				textColor: rat.graphics.white,	//	need better system of defaults
			};
		}
		return foundIndex;
	};
	
	//	return state structure reference that matches this state,
	//	e.g. for modification of a particular state of a button, e.g. for changing image animation speed
	rat.ui.Button.prototype.getMatchingState = function(state)
	{
		var index = this.getMatchingStateIndex(state);
		if (index >= 0)
			return this.colorStates[index];
		return null;
	};
	
	rat.ui.Button.prototype.setStroke = function (w, c, d)
	{
		this.checkAndMakeTextBox();
		this.text.setStroke(w, c, d);
	};

	//	utility to find the best match for given state list (or our state list, if none were specified)
	//	todo: add priority, if number of matching flags is the same?
	//		or switch to first-is-best?
	//	todo: prioritize 'pressed' match over 'highlight' match, since that's a more important state to show?
	//	return matching state.
	/** 
	 * @param {?} _flags
	 * @param {?} _states
	 */
	rat.ui.Button.prototype.findBestStateMatch = function (_flags, _states)
	{
		if (typeof _flags === 'undefined')
			_flags = this.flags;
		if (!_states)
			_states = this.colorStates;
		if (!_states)
			return null;
			
		var bestIndex = 0;
		var bestFlags = 0;
		for (var i = 0; i < _states.length; i++)
		{
			var matchFlags = 0;
			for (var b = 0; b < 4; b++)
			{
				var checkBit = 1 << b;
				if ((_flags & checkBit) === (_states[i].flags & checkBit))
					matchFlags++;
			}
			if (matchFlags >= bestFlags)	//	if better or equal (latest is best), remember it
			{
				bestIndex = i;
				bestFlags = matchFlags;
			}
		}
		return _states[bestIndex];
	};

	//	called every frame to make sure we're displaying the way we want.
	//	because it's an every frame thing, this is a bad place to worry about dirty flags.
	//	Dirty note:  We assume our dirty flag is set earlier in other cases, like our display-related flags being changed.
	//		If that turns out to be too loose, we'd better do this work before rat.ui.Element.draw decides we're not dirty...
	//		(which happens before drawSelf is called)
	rat.ui.Button.prototype.updateDisplayState = function ()
	{
		var displayState;
		if (typeof this.colorStates !== 'undefined')
		{
			displayState = this.findBestStateMatch(this.flags, this.colorStates);
			if (this.text)
			{
				if (displayState.textColor)
					this.text.setColor(displayState.textColor);
				if (displayState.font)
				{
					if (displayState.font.font)
						this.text.setFont(displayState.font.font);
					if (displayState.font.size)
						this.text.setFontSize(displayState.font.size);
				}
				if (displayState.stroke)
					this.text.setStroke(displayState.stroke.lineWidth || 0, displayState.stroke.color, displayState.stroke.doCleanup);
			}
		}
		return displayState;
	};

	//	Draw this button
	//	The final look depends on current state
	rat.ui.Button.prototype.drawSelf = function ()
	{
		var ctx = rat.graphics.getContext();
		//	based on state, change which image our bubble box uses to draw...
		//	We have many potential state combinations, and may not have all the possible art,
		//	which is to be allowed,
		//	so just try to pick the best possible image...

		//	see if we have display data (colors, images) based on state, regardless of type.
		//	this gets set up for cheap buttons as well as other types if their text colors are explicitly set.
		var displayState = this.updateDisplayState();

		//	cheap button
		if ((this.type === rat.ui.Button.cheapType) && (typeof displayState !== 'undefined'))
		{
			ctx.fillStyle = displayState.color.toString();
			ctx.fillRect(-this.center.x, -this.center.y, this.size.x, this.size.y);

			var lineWidth = 4;
			if (displayState.frameWidth !== void 0)
				lineWidth = displayState.frameWidth;
			ctx.lineWidth = lineWidth;
			ctx.strokeStyle = displayState.frameColor.toString();
			//ctx.strokeRect(-this.center.x + lineWidth / 2, -this.center.y + lineWidth / 2, this.size.x - lineWidth, this.size.y - lineWidth);
			ctx.strokeRect(-this.center.x - lineWidth / 2, -this.center.y - lineWidth / 2, this.size.x + lineWidth, this.size.y + lineWidth);

		//	cool buttton
		} else if ((this.type === rat.ui.Button.coolType) && (typeof displayState !== 'undefined'))
		{
			rat.graphics.roundRect(
				{x : 0-this.center.x, y : 0-this.center.y, w : this.size.x, h : this.size.y},
				this.cornerRadius
			);
			ctx.fillStyle = displayState.color.toString();
			ctx.fill();

			var lineWidth = 4;
			if (displayState.frameWidth !== void 0)
				lineWidth = displayState.frameWidth;
			ctx.lineWidth = lineWidth;
			ctx.lineCap = 'round';	//	to avoid seams
			ctx.strokeStyle = displayState.frameColor.toString();
			ctx.stroke();

		} else if (typeof this.buttonImage !== 'undefined')
		{
			//	based on state, update our buttonImage, which is a direct reference to a subelement with an image in it. (see above).
			//	so, we change it here, and let it draw itself eventually.

			if (displayState && displayState.imageRef)	//	did we find a nice state match above with an image?
			{
				this.buttonImage.useImageRef(displayState.imageRef);

			} else
			{	//	old - use baked-in variables to update image
				var useRef;
				
				if ((this.flags & rat.ui.Element.enabledFlag) === 0)
				{
					useRef = this.imageDisabled;
				} else if ((this.flags & rat.ui.Element.pressedFlag) || (this.flags & rat.ui.Element.toggledFlag))
				{
					//console.log("drawing pressed " + this.name);
					useRef = this.imagePressed;
				} else if (this.flags & rat.ui.Element.highlightedFlag)
				{
					//console.log("drawing high " + this.name);
					useRef = this.imageHi;
				}
				else
				{
					//console.log("drawing normal " + this.name);
					useRef = this.imageNormal;
				}
				if (!useRef)
					useRef = this.imageNormal;
				if (useRef)
					this.buttonImage.useImageRef(useRef);
			}

		}
	};
	
	//	do we need to update button look?
	rat.ui.Button.prototype.updateSelf = function (dt)
	{
		//	update color states, if any
		if (typeof this.colorStates !== 'undefined')
		{
			//var foundIndex = -1;
			for (var lookIndex = 0; lookIndex < this.colorStates.length; lookIndex++)
			{
				//	update image, if any, and if we're supposed to.
				
				//	In order to avoid double-update, don't update any image that's also our current sprite's image, since that gets updated already.
				//	Is this kludgey?  I'm not sure.  Seems OK for now.
				if (this.buttonImage && this.buttonImage.imageRef && this.buttonImage.imageRef === this.colorStates[lookIndex].imageRef)
					continue;
					
				if (this.colorStates[lookIndex].imageRef && this.colorStates[lookIndex].doUpdate)
					this.colorStates[lookIndex].imageRef.update(dt);
			}
		}
	};
	
	//	This function is called for us if any of our state flags (highlight, etc.) changed.
	rat.ui.Button.prototype.flagsChanged = function (oldFlags)
	{
		//	inherited behavior
		rat.ui.Button.prototype.parentPrototype.flagsChanged.call(this);
		
		//	see if we need to update a state based on this.
		//	(stuff we only want to do at the instant the state changes, not during update/draw)
		var displayState = this.findBestStateMatch();
		if (displayState && displayState.imageRef)
		{
			//	reset any one-shot anims.
			if (displayState.imageRef.isAnimOneShot())
				displayState.imageRef.restartAnim();
		}
		
		//	Note that dirty flag setting here is totally handled by the rat.ui.Element.prototype.checkFlagsChanged function.
	};

	//	handle ui-level input event explicitly, so that "enter" ui event triggers this button.
	rat.ui.Button.prototype.handleUIInput = function (event)
	{
		//rat.console.log("button ui");
		var handled = false;
		if (event.which === 'enter')
		{
			var handled = this.trigger();
			if (handled)
				rat.eventMap.fireEvent("uiTriggered", this);

		}
		return handled;
	};

	//	press me (change my state, trigger my callbacks, etc.)
	rat.ui.Button.prototype.trigger = function ()
	{
		if (this.toggles)
		{
			var oldFlags = this.flags;
			if (this.flags & rat.ui.Element.toggledFlag)
				this.flags &= ~rat.ui.Element.toggledFlag;	//	clear
			else
				this.flags |= rat.ui.Element.toggledFlag;	//	set
			this.checkFlagsChanged(oldFlags);
		}
		return rat.ui.Button.prototype.parentPrototype.trigger.call(this); //	inherited trigger
	};
	
	//	handle mouse down event, so we can clearly mark this event handled (eaten up).
	rat.ui.Button.prototype.mouseDown = function (pos, ratEvent)
	{
		//	call inherited to get correct flags cleared/set
		rat.ui.Button.prototype.parentPrototype.mouseDown.call(this);
		
		if (this.flags & rat.ui.Element.enabledFlag)	//	we're a button - we totally handled this click.
			return true;
			
		return false;
	};
	
	//	internal util: automatically size a button to its art
	function autoSizeButton(button)
	{
		button.setSize(button.buttonImage.size.x, button.buttonImage.size.y);
	}
	
	rat.ui.Button.prototype.autoSize = function ()
	{
		if (this.buttonImage.size.x === 0)
			this.buttonImage.setOnLoad(autoSizeButton, this);
		else
			autoSizeButton(this);
	};
	
	rat.ui.Button.prototype.setToggles = function (toggles)
	{
		this.toggles = toggles;
	};
	
	//	reset the default text inset value for all future buttons
	//	(and for all buttons that haven't been changed from the default, and might get their textbox rebuilt)
	rat.ui.Button.setDefaultTextInset = function(value)
	{
		rat.ui.Button.prototype.textInset = value;
	};

	//	editor properties
	rat.ui.Button.editProperties = [
		{ label: "button",
			props: [
				{propName:'buttonType', type:'integer', defValue:rat.ui.Button.coolType, tipText:"1=sprite,2=bubble,3=cheap,4=cool"},	//	todo: dropdown from supported list
				//{propName:'colorStates', type:'color'},	//	hmm... this is complex...
				{propName:'toggles', type:'boolean'},
				
				{propName:'text', type:'string', tipText:"button text (if needed)"},
				{propName:'textColor', type:'color'},
				{propName:'textInset', type:'float', tipText:"how far in from edges text draws"},
				{propName:'textUseOffscreen', type:'boolean'},
				{propName:'cornerRadius', type:'float', tipText:"for button type 4 (cool)"},
			],
		},
		
		//	resources, only relevant for bubble/sprite types
		{ label: "resources", defaultClosed:true,	//	todo: add tooltip here explaining relevance
			props: [
				{propName:'resource', type:'resource'},
				{propName:'resourceHi', type:'resource'},
				{propName:'resPressed', type:'resource'},
				{propName:'resDisabled', type:'resource'},
				{propName:'extra1', type:'resource'},
				{propName:'extra2', type:'resource'},
			],
		},
		
		rat.ui.TextBox.standardFontEditProperties,	//	standard font stuff
	];
		
	/**
	 * Handle setting this up from data
	 */
	rat.ui.Button.setupFromData = function (pane, data, parentBounds)
	{
		rat.ui.data.callParentSetupFromData(rat.ui.Button, pane, data, parentBounds);

		data.extra1 = data.extra1 || void 0;
		data.extra2 = data.extra2 || void 0;
		
		pane.isSetup = false;	//	override suppression of setup call.
		
		//	support string version of buttontype? like "cheap" and "sprite"?

		if (data.buttonType === rat.ui.Button.cheapType || data.buttonType === rat.ui.Button.coolType)
		{
			pane.setupButton(data.buttonType, void 0, void 0, void 0, void 0, data.extra1, data.extra2);
			pane.colorStates = data.colors || data.color;
			//	if NONE of those was defined, make something up.
			if (pane.colorStates === void 0)
				pane.colorStates = new rat.graphics.Color(140, 140, 140);
			
			if (Array.isArray(pane.colorStates) === false)
				pane.colorStates = rat.ui.Button.createStandardColorStates(pane.colorStates);

			//	MUST happen after we call setupButton
			if (data.toggles !== void 0)
			{
				pane.setToggles(true);
				pane.setToggled(!!data.toggled);
			}
		}
		else if (data.buttonType === rat.ui.Button.bubbleType ||
				 data.buttonType === rat.ui.Button.spriteType)
		{
			pane.setupButton(
				data.buttonType,
				data.res || data.resource,
				data.resHi || data.resourceHi,
				data.resPressed || data.resourcePressed,
				data.resDisabled || data.resourceDisabled,
				data.extra1,
				data.extra2);
			if (data.toggles)
			{
				//	MUST happen AFTER setupButton
				pane.setToggles(true);
				pane.setToggled(!!data.toggled);

				///TODO Support setting the toggle images here.
			}
		}
		
		if (data.cornerRadius !== void 0)
			pane.setCornerRadius(data.cornerRadius);
		else
			pane.cornerRadius = (pane.size.y * rat.ui.Button.standardCornerScale)|0

		//	Setup my text
		//	This font handling is currently the same as rat.ui.TextBox
		if (data.font)
		{
			if (data.font.font)
				pane.setFont(data.font.font);
			if (data.font.size)
				pane.setFontSize(data.font.size);
			if (data.font.style)
				pane.setFontStyle(data.font.style);
			if (data.font.stroke)
				pane.setStroke(data.font.stroke.width, data.font.stroke.color);
		}
		
		if (data.textColor)
		{
			pane.checkAndMakeTextBox().setColor(data.textColor);
			
			//	If you're using a cheap button, support overriding colorset text colors with an explicit color.
			if (data.buttonType === rat.ui.Button.cheapType || data.buttonType === rat.ui.Button.coolType)
			{
				for (var i = 0; i < pane.colorStates.length; i++)
				{
					pane.colorStates[i].textColor = new rat.graphics.Color(data.textColor);
				}
			}
		}
		
		if( data.text )
			pane.translateAndSetTextValue(data.text);
		
		if( data.textInset )
			pane.setTextInset(data.textInset);
		
		if (data.textUseOffscreen !== void 0)
			pane.checkAndMakeTextBox().setUseOffscreen(data.textUseOffscreen);
	};
	
});