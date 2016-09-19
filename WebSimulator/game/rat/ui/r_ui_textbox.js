
//----------------------------
//	textbox Element (subclass of Element)
//	renders with built-in text support
//
//	TODO:  It might be cleaner to use this.lines everywhere, instead of this.value.
//		In too many places we switch between them...
//
//	TODO:  specialDraw system:
//		A callback system for drawing special characters/images in the middle of text.
//		First, set a call back function (setSpecialDraw())
//		Then, support an embedded special control character (rat.ui.TextBox.specialCharacter) followed by an argument character,
//		and when that pair is reached during drawing, don't draw them - instead call specialDraw() callback with those as arguments.
//		This will all happen during normal draw so that if we're drawing offscreen, this special drawing will also happen offscreen, which is good.
//		We might need to preprocess text looking for these special characters when we do line break processing... we need these special characters
//		to be included correctly in line width measurement, which is tricky.  So, yeah, we might need a second callback like specialMeasure,
//		or have specialDraw take an argument saying whether to actually draw?
//
//		specialDraw gets a single argument object with properties:
//			textBox: the textbox object currently drawing
//			ctx: context to draw to
//			argCode: the special argument character embedded in text after special code
//			x, y: the current drawing position. Is this top left, bottom left, center, what?  can't be center, I guess...
//			doDraw : false if we're just measuring.  See results below.
//			
//		specialDraw returns results in an object with these properties:
//			width: width of drawn image
//			height: height of drawn image
//			dirty: true if we should mark the textbox dirty again, e.g. if the drawing is going to animate every frame
//
//		Note:  If we don't already support explicitly overriding line height, we should, since some special characters will be tall,
//			but it'll be too late to change the height of a line when we've drawn the first few characters and then get to a tall special character.
//
rat.modules.add( "rat.ui.r_ui_textbox",
[
	{name: "rat.ui.r_ui", processBefore: true },
	{name: "rat.utils.r_utils", processBefore: true },
	
	"rat.graphics.r_graphics",
	"rat.utils.r_wordwrap",
	"rat.debug.r_console",
	"rat.ui.r_ui_data",
], 
function(rat)
{
	/**
	 * @constructor
	 * @extends rat.ui.Element
	 * can construct with parent,value or just one, or neither.
	 * first argument is generally expected to be parent
	*/
	rat.ui.TextBox = function (value1, value2)
	{
		//	moving toward a new brighter world where you can pass parent in to rat ui element constructors...
		var initParent;
		var initText;
		if (typeof(value1) === 'string')
			initText = value1;
		else
		{
			initParent = value1;
			initText = value2;
		}
		
		rat.ui.TextBox.prototype.parentConstructor.call(this, initParent); //	default init
		if (initText === void 0)
			this.value = "";
		else
			this.value = initText;

		//	reasonable defaults
		this.font = "Calibri";
		this.fontStyle = "";	//	e.g. "bold"
		this.fontSize = 15;
		this.fontLineSpacing = 2;
		this.fontLineHeight = 16;  //	not sure how to get this accurately... evidently, it's a tough problem.
		//	fontLineHeight should be ascent + descent but no leading.
		this.fontDescriptor = "15px Calibri";

		this.strokeWidth = -1;
		this.strokeColor = null;
		
		this.textShadowEnabled = false;
		this.textShadowColor = new rat.graphics.Color( 0, 0, 0, .5 );
		this.textShadowOffset = { 
			x: 1,
			y: 1
		};
		
		//	by default, squish text instead of wrapping.  Little labels are more common than big text boxes.
		this.autoWrap = false;

		//	temp defaults - user usually sets this to what they want
		this.size.x = 100;
		//	maxWidth is a way to override how much of the box gets filled by text.
		//	by default, fill the whole box.
		//	maxWidth is also what controls text squishing, usually.
		this.maxWidth = this.size.x;
		this.overriddenMaxWidth = false;
		this.size.y = this.fontLineHeight;
		
		//	our actual text width, calculated later
		this.textWidth = 0;
		
		//	similarly, in a multi-line solution, track the width of each line
		this.lineWidths = [];

		//	default alignments
		this.align = rat.ui.TextBox.alignLeft;
		this.baseline = rat.ui.TextBox.baselineMiddle;

		//console.log("width " + this.size.x);

		this.name = "<txt>" + this.id + "(" + this.value + ")";

		this.textChanged();	//	this updates multi-lines, and sets content size
		
		this.setTracksMouse(false);	//	no mouse tracking, highlight, tooltip, etc. including subelements.

		//	auto-set my size from content if a flag tells us to?  or just have them call another function....
	};
	rat.utils.inheritClassFrom(rat.ui.TextBox, rat.ui.Element);
	rat.ui.TextBox.prototype.elementType = 'textBox';
	
	rat.ui.TextBox.alignLeft = 0;
	rat.ui.TextBox.alignCenter = 1;
	rat.ui.TextBox.alignRight = 2;

	rat.ui.TextBox.baselineTop = 0;
	rat.ui.TextBox.baselineMiddle = 1;
	rat.ui.TextBox.baselineBottom = 2;

	rat.ui.TextBox.prototype.setTextValue = function (value)
	{
		//console.log("setText " + value);
		var oldValue = this.value;
		this.value = "" + value; // Make sure that it is a string

		if (oldValue !== this.value)
			this.textChanged();
	};
	rat.ui.TextBox.prototype.getTextValue = function (trimmed)
	{
		var text = this.value;
		if (text && trimmed)
			text = text.trim();
		return text;
	};

	rat.ui.TextBox.prototype.translateAndSetTextValue = function (value)
	{
		//	NOTE: We CANNOT call setTextValue because some of our classes override that to call translateAndSetTextValue which would cause infinite recursion
		if (rat.string)
			value = rat.string.getString(value);
		if (value !== this.value)
		{
			this.value = value;
			this.textChanged();
		}
	};

	//	mostly internal - rebuild full font descriptor based on individual values
	rat.ui.TextBox.prototype.updateFontDescriptor = function ()
	{
		var oldDescriptor = this.fontDescriptor;
		this.fontDescriptor = ("" + this.fontStyle + " " + this.fontSize + "px " + this.font).trim();
		///@todo	px vs. pt NOT interchangeable!  Switching back to px.  I vaguely remember some browsers not supporting px - was I imagining it?
		///@todo	autocenter if flagged to?

		//	re-measure if needed, e.g. if we have text at all.
		//	for one thing, wrapping code needs to know size of text,
		//	and also this updates our contentSize variable,
		//	which some outside systems (e.g. tooltips) depend on being accurate.
		if (oldDescriptor !== this.fontDescriptor && this.value && this.value.length > 0)
			this.textChanged();
	};

	/**
	 * set font (just font name, or optionally size and style as well)
	 * @param {string} font
	 * @param {number=} size
	 * @param {string=} style
	 */
	rat.ui.TextBox.prototype.setFont = function (font, size, style)
	{
		this.font = font;
		if(size)
			this.setFontSize(size);
		if(style)
			this.setFontStyle(style);
		this.updateFontDescriptor();
	};

	rat.ui.TextBox.prototype.setFontStyle = function (fontStyle)
	{
		this.fontStyle = fontStyle;
		this.updateFontDescriptor();
	};

	rat.ui.TextBox.prototype.setFontSize = function (fontSize)
	{
		this.fontSize = fontSize;
		this.fontLineHeight = fontSize + 1;	//	not sure how to get this accurately - evidently it's a problem
		this.updateFontDescriptor();
	};

	rat.ui.TextBox.prototype.setAutoWrap = function (autoWrap)
	{
		var oldWrap = this.autoWrap;
		this.autoWrap = autoWrap;
		if (oldWrap !== autoWrap)
			this.textChanged();	//	rewrap with new setting
	};
	
	rat.ui.TextBox.prototype.overrideMaxWidth = function (newMaxWidth)
	{
		if (newMaxWidth == -1)
			newMaxWidth = 9999;//Number.MAX_VALUE;	//	ie doesn't like MAX_VALUE here.  :)  Just pick a big one.
		this.maxWidth = newMaxWidth;
		this.overriddenMaxWidth = true;	//	remember in case our size changes - we probably still want to reapply it.
	};

	//	todo: why is this different from autoCenter?  Are we giving up on autoCenter?  It's confusing...
	//	does it mean auto-center CONTENT within our bounds, or does it mean change our bounds?
	//	probably rework that whole system and rename functions to something like
	//	autoCenterContent and centerInParent or whatever.  Does that autocenter children, too?

	//	center text
	rat.ui.TextBox.prototype.centerText = function ()
	{
		//console.log("center text");
		this.align = rat.ui.TextBox.alignCenter;
		this.baseline = rat.ui.TextBox.baselineMiddle;
	};
	
	//	left align text (convenience function that does the same as calling SetAlign)
	rat.ui.TextBox.prototype.leftAlignText = function ()
	{
		this.setAlign(rat.ui.TextBox.alignLeft);
	};
	//	right align text (convenience function that does the same as calling SetAlign)
	rat.ui.TextBox.prototype.rightAlignText = function ()
	{
		this.setAlign(rat.ui.TextBox.alignRight);
	};

	rat.ui.TextBox.prototype.setAlign = function (align)
	{
		if (typeof(align) === 'string')
		{
			if (align === 'left') align = rat.ui.TextBox.alignLeft;
			else if (align === 'center') align = rat.ui.TextBox.alignCenter;
			else if (align === 'right') align = rat.ui.TextBox.alignRight;
		}
		
		if (align !== this.align)
			this.setDirty(true);
		this.align = align;
		
		//	note: we assume that doesn't affect wrapping or squish, so don't need to call textChanged()
	};

	rat.ui.TextBox.prototype.setBaseline = function (baseline)
	{
		//	support alternative arg types (simple text like 'top') for convenience...
		if (typeof(baseline) === 'string')
		{
			if (baseline === 'top') baseline = rat.ui.TextBox.baselineTop;
			else if (baseline === 'middle') baseline = rat.ui.TextBox.baselineMiddle;
			else if (baseline === 'bottom') baseline = rat.ui.TextBox.baselineBottom;
		}
		
		if (baseline !== this.baseline)
			this.setDirty(true);
		this.baseline = baseline;
		
		//	note: we assume that doesn't affect wrapping or squish, so don't need to call textChanged()
	};

	rat.ui.TextBox.prototype.setStroke = function (width, color, doCleanup)
	{
		if (width && color === void 0 && doCleanup === void 0 && typeof(width) !== "number")
		{
			doCleanup = width.doCleanup;
			color = width.color;
			width = width.lineWidth || width.width;
		}

		if (doCleanup === void 0)
			doCleanup = false;

		if (width !== this.strokeWidth || this.strokeCleanup !== doCleanup)
			this.setDirty(true);

		if (this.strokeColor !== color || (this.strokeColor && color && this.strokeColor.equal && !this.strokeColor.equal(color)))
			this.setDirty(true);

		this.strokeWidth = width;
		this.strokeColor = color;
		this.strokeCleanup = doCleanup;
	};
	
	rat.ui.TextBox.prototype.setShadowEnabled = function( enable )
	{
		if (enable === void 0)
			enable = true;
		else
			enable = !!enable;
		if (this.textShadowEnabled !== enable)
		{
			this.textShadowEnabled = enable;
			this.setDirty(true);
		}
	};
	
	//	Set if we should be using a shadow
	rat.ui.TextBox.prototype.setShadow = function( color, offsetX, offsetY )
	{
		var changed = false;
		if ( color && !this.textShadowColor.equal(color) )
		{
			changed = true;
			this.textShadowColor.copyFrom( color );
		}
		
		if (offsetX !== void 0 && offsetX !== this.textShadowOffset.x)
		{
			changed = true;
			this.textShadowOffset.x = offsetX;
		}
		if (offsetY !== void 0 && offsetY !== this.textShadowOffset.y)
		{
			changed = true;
			this.textShadowOffset.y = offsetY;
		}
		
		if (changed && this.textShadowEnabled)
			this.setDirty(true);
	};
	
	//	return correct X positioning for text, based on desired alignment.
	//	and set render context to use that alignment
	rat.ui.TextBox.prototype.setupAlignX = function (ctx, lineWidth)
	{		
		var x = 0;
		
		//	Note:  Stroked text technically draws outside the space given.  This is not ideal.  See comment below in drawLine().
		//	We make a "maxWidth" adjustment below.  We need a tiny left/right adjustment here, as well, depending on alignment.
		//	e.g. if text is left-aligned, bump in a tiny bit so the stroke doesn't go outside our bounds!
		
		//	Note:  Instead of using context's textAlign, we could do the math ourselves and always use left or center or something.
		//	But this is working fine.
		
		//	OK, actually, it's useful in really obscure cases (like typewriter text) to force left alignment,
		//	and do the math ourselves.  Let's support that here.
		if (this.forceLeftRender && lineWidth)
		{
			ctx.textAlign = "left";
			if (this.align === rat.ui.TextBox.alignLeft)
				x = 0 + this.strokeWidth / 2;
			else if(this.align === rat.ui.TextBox.alignCenter)
				x = this.size.x / 2 - lineWidth/2 + this.strokeWidth / 2;
			else
				x = this.size.x - lineWidth;// + this.strokeWidth / 2;
			
		} else {
			if(this.align === rat.ui.TextBox.alignLeft)
			{
				ctx.textAlign = "left";
				x = 0 + this.strokeWidth / 2;
			} else if(this.align === rat.ui.TextBox.alignCenter)
			{
				ctx.textAlign = "center";
				x = this.size.x / 2;
			} else
			{
				ctx.textAlign = "right";
				x = this.size.x - this.strokeWidth / 2;
			}
		}
		
		if (!this.ignoreCenter)	//	 a little hacky...  see buildOffscreen
			x -= this.center.x;

		return x;
	};

	rat.ui.TextBox.prototype.setupAlignY = function (ctx)
	{
		var y = 0;
		if(this.baseline === rat.ui.TextBox.baselineTop)
		{
			ctx.textBaseline = "top";
			y = 0;
		} else if(this.baseline === rat.ui.TextBox.baselineMiddle)
		{
			ctx.textBaseline = "middle";
			y = this.size.y / 2;
		} else
		{
			ctx.textBaseline = "bottom";
			y = this.size.y;
		}
		if (!this.ignoreCenter)	//	 a little hacky...  see buildOffscreen
			y -= this.center.y;
		return y;
	};
	
	//
	//	our text has changed.
	//	do some preflighting - figure out if we have more than one line to draw.
	//	also, a good place for optional rendering optimization.
	//
	rat.ui.TextBox.prototype.textChanged = function ()
	{
		this.setDirty();
		
		if(!this.value || this.value.length <= 0 || !rat.graphics.ctx)
		{
			this.lines = [];
			this.lineWidths[0] = 0;
			this.textWidth = 0;
			this.setContentSize(0, 0);
			return;
		}

		//	for any measuring that needs to happen, make sure we've got the right font set up in the ctx
		rat.graphics.ctx.font = this.fontDescriptor; //	for measuring
		
		//	In some circumstances, we're going to do this repeatedly until things fit...
		//	but let's limit that.
		var totalHeight = this.fontLineHeight;
		var squishForHeight = 1;
		var fitVertically = false;
		for (var vFitIndex = 0; !fitVertically && vFitIndex < 4; vFitIndex++)
		{
			//	if autowrap is set, do that.
			if(this.autoWrap)
			{
				this.lines = rat.wordwrap.wrapString(this.value, this.maxWidth * squishForHeight, rat.graphics.ctx);
			} else
			{	//	otherwise, check for manual wrapping
				//	could use string.split() here, but I want to maybe handle things differently - clean up whitespace? handle tab indents?
				this.lines = this.value.split('\n');
			}

			//	some problem?
			if(!this.lines || this.lines.length < 1)	//	can this even happen?
			{
				this.lines = [];
				this.setContentSize(0, 0);
				return;
			}
			
			//	see if we fit vertically.
			//	TODO:  Factor in vertical alignment!  I think it's significant.  This might currently assume baselineMiddle?
			//	Note that we say a single line always fits, no matter what our bounds say. We can't get shorter than one line.
			totalHeight = this.fontLineHeight * this.lines.length + this.fontLineSpacing * (this.lines.length - 1);
			if (this.lines.length > 1 && totalHeight > this.size.y)	//	too big
				squishForHeight += 0.1;	//	allow more text in each line, each time through
			else
				fitVertically = true;
		}

		//	measure us...
		var widest = 0;
		rat.graphics.ctx.font = this.fontDescriptor; //	for measuring
		for (var i = 0; i < this.lines.length; i++)
		{
			try
			{
				var metrics = rat.graphics.ctx.measureText(this.lines[i]);
				if (metrics.width > widest)
					widest = metrics.width;
				this.lineWidths[i] = metrics.width;
			}
			catch(err)
			{
				rat.console.log("r_ui_textbox error: " + err.message);
			}
		}

		if (this.lines.length === 1)	//	single line
		{
			this.lines = [];	//	just use this.value instead of array
			this.setContentSize(widest, this.fontLineHeight);
		} else
		{
			this.setContentSize(widest, totalHeight);
		}
		
		//	remember how wide our widest line was, in case somebody else wants it.
		this.textWidth = widest;
	};
	
	//	get actual drawing width of my current text, as calculated when it was set.
	//	We factor in this.maxWidth here, so the caller is for sure finding out how wide the text will be
	//	when it is drawn!
	rat.ui.TextBox.prototype.getTextWidth = function()
	{
		if (this.maxWidth < this.textWidth)
			return this.maxWidth;
		else
			return this.textWidth;
	};
	
	//	todo: getLineWidths()
	
	//	get actual height of my text
	//	This may not be super accurate, but we try.
	rat.ui.TextBox.prototype.getTextHeight = function()
	{
		var lineCount = this.lines.length || 1;
		totalHeight = this.fontLineHeight * lineCount + this.fontLineSpacing * (lineCount - 1);
		return totalHeight;
	};
	
	//	util to draw a single line of text
	//	useful to subclasses.  This function assumes x and y have been correctly calculated based on alignment, multi-lines, etc.
	rat.ui.TextBox.prototype.drawLine = function (ctx, x, y, text)
	{
		//console.log("tsize " + this.size.x + ", " + this.size.y);
		//ctx.strokeStyle = "FF40F0";
		//ctx.strokeRect(-this.center.x, -this.center.y, this.size.x, this.size.y);

		if(!text)
			return;

		ctx.font = this.fontDescriptor;

		// this was previously using color.toString(), which prevents us from setting gradients as fillstyles, 
		//	also color does appear to work even though its a rat-object, possibly because its already listed in distinct 'rgba' fields
		// TODO - redo this fillStyle to take a rat FillStyle class that can have color or gradient or pattern as defined by 
		//			the example here - http://www.w3schools.com/tags/canvas_fillstyle.asp
		// TODO ALSO: along the same lines we'd want to fix things like button and fillbar that also use color instead of style
		// FIXME ! hackety foo for now! boo! :(
		if (this.color.a)
			ctx.fillStyle = this.color.toString();		// if it has a rat.Color alpha field, assume it's a color
		else
			ctx.fillStyle = this.color;					// otherwise assume its not a rat color object and that it may be a proper style object instead

		var maxWidth = this.maxWidth;
		if (this.strokeWidth > 0 && this.strokeColor)
		{
			//	stroked text technically goes outside "maxWidth", which is undesirable in 2 ways.
			//	1: it means text is going outside carefully measured spaces, by a few pixels.
			//	2: it means if we have text offscreen buffer rendering enabled, the stroked edges get clipped off.
			//	A solid way to correct this, then, is to use a narrower maxWidth when there's a stroke involved.
			//	This means stroked text will be slightly more squished than non-stroked text, if squishing is happening at all,
			//	but we judge that to be correct behavior.
			//	And note that this maxWidth adjustment here means all text below uses this new adjusted maxWidth;
			//	(adjust our width by half the stroke, on both left and right, so whole stroke.)
			maxWidth -= this.strokeWidth;
		
			ctx.strokeStyle = this.strokeColor.toString();
			ctx.lineWidth = this.strokeWidth;
			ctx.strokeText(text, x, y, maxWidth);
		}
		
		//	Shadow support
		if (this.textShadownEnabled &&
			this.textShadowColor.a > 0 &&
			this.textShadowOffset.x !== 0 && 
			this.textShadowOffset.y !== 0 )
		{
			ctx.shadowColor = this.textShadowColor.toString();
			ctx.shadowOffsetX = this.textShadowOffset.x;
			ctx.shadowOffsetY = this.textShadowOffset.y;
		}

		ctx.fillText(text, x, y, maxWidth);

		//	if we're doing a stroke, do a thin stroke inside as well - it cleans up the edges of the normal text rendering
		if (this.strokeCleanup && this.strokeWidth >= 0 && this.strokeColor)
		{
			var tempColor = new rat.graphics.Color(this.strokeColor);
			tempColor.a = 0.3;

			ctx.strokeStyle = tempColor.toString();
			ctx.lineWidth = 1;
			ctx.strokeText(text, x, y, maxWidth);
		}
	};

	rat.ui.TextBox.prototype.drawSelf = function ()
	{
		var ctx = rat.graphics.getContext();
		
		var x, y;
		if(this.lines.length > 0)	//	multi-line version
		{
			y = this.setupAlignY(ctx);
			var lineHeight = this.fontLineHeight + this.fontLineSpacing;	//	font size plus padding - don't have an easy way to get text height
			var height = this.lines.length * lineHeight;

			if(this.baseline === rat.ui.TextBox.baselineMiddle)
			{
				y -= (height - lineHeight) / 2;	//	text is already aligned middle, so only move up for lines beyond first
			} else if(this.baseline === rat.ui.TextBox.baselineBottom)
			{
				y -= (height - lineHeight);	//	text is aligned to bottom, so only go up a line for each additional line beyond first
			}

			for(var i = 0; i < this.lines.length; i++)
			{
				x = this.setupAlignX(ctx, this.lineWidths[i]);
				this.drawLine(ctx, x, y, this.lines[i]);
				y += lineHeight;
			}

		} else
		{	//	simple single-line version
			x = this.setupAlignX(ctx, this.textWidth);
			y = this.setupAlignY(ctx);

			this.drawLine(ctx, x, y, this.value);
		}
	};

	rat.ui.TextBox.prototype.boundsChanged = function ()
	{
		if (!this.overriddenMaxWidth)
			this.maxWidth = this.size.x;	//	auto-apply new size as our new max width for drawing
		
		rat.ui.TextBox.prototype.parentPrototype.boundsChanged.call(this);	//	inherited normal func

		//	TODO:  I would like to not do either of these if our SIZE didn't change, but I don't have a way to know.
		//	should probably pass in old bounds to this function!
		
		this.textChanged();	//	rewrap/squish text with new setting
		this.setDirty(true);
	};

	// Support for creation from data
	//
	//text: ""
	//font:{
	//	font:"",
	//	size: 00,
	//	style"",
	//	stroke:{
	//		width:
	//		color:{
	//			r:0
	//			g:0
	//			b:0,
	//			a:0
	//		}
	//	},
	//	align:"",
	//	baseline:""
	//}
	//
	
	//	properties which are editable in the ui editor,
	//	and will be understood by setupFromData().
	//	This list is located here for convenient editing along with the functionality of this module,
	//	and this setupFromData call.
	//
	//	Ideally, when you are adding supported properties to this class,
	//	add them here, too, so they can easily be edited in the editor!
	//
	
	//	some standard reused groups of props...
	rat.ui.TextBox.standardFontEditProperties =
	{
		label: "font",
		props: [
			{label: 'font', propName:'font.font', type:'string', defValue : 'impact'},
			{label: 'size', propName:'font.size', type:'float', defValue : 40},
			{label: 'style', propName:'font.style', type:'string'},
		],
	};
	rat.ui.TextBox.standardFontStrokeEditProperties =
	{ label: "stroke",
		props: [
			{label: 'width', propName:'font.stroke.width', type:'float'},
			{label: 'color', propName:'font.stroke.color', type:'color'},
			{label: 'cleanup', propName:'font.stroke.doCleanup', type:'boolean', tipText:"expensive way to try to make edges nicer"},
		],
	};
	
	//	the list for textbox
	rat.ui.TextBox.editProperties = [
		{ label: "text",
			props: [
				{propName:'text', type:'string'},
				{propName:'translateText', type:'string', tipText:"overrides text, tries to translate first"},
				{propName:'autoWrap', type:'boolean'},
			],
		},
		
		rat.ui.TextBox.standardFontEditProperties,	//	include the above, but in a flexible way (so other classes can use it, too)
		
		{ label: "align",
			props: [
				//	todo: change to combo box with values
				{propName:'align', type:'string', defValue : 'left'},
				{propName:'baseline', type:'string', defValue : 'middle', tipText:"vertical alignment"},
			],
		},
		
		rat.ui.TextBox.standardFontStrokeEditProperties,	//	holy property name, batman...
	];
	
	rat.ui.TextBox.setupFromData = function (pane, data, parentBounds)
	{
		rat.ui.data.callParentSetupFromData( rat.ui.TextBox, pane, data, parentBounds );

		//	todo: generalize this to read from editProperties above
		if (data.font)
		{
			if (data.font.font )
				pane.setFont(data.font.font);
			if (data.font.size)
				pane.setFontSize( data.font.size );
			if (data.font.style)
				pane.setFontStyle(data.font.style);
			if (data.font.stroke)
			{
				pane.setStroke(data.font.stroke.width, data.font.stroke.color, data.font.stroke.doCleanup);
			}
		}
		if (data.align === "left" )
			pane.setAlign(rat.ui.TextBox.alignLeft);
		else if (data.align === "center" )
			pane.setAlign(rat.ui.TextBox.alignCenter);
		else if (data.align === "right" )
			pane.setAlign(rat.ui.TextBox.alignRight);

		if (data.baseline === "top" )
			pane.setBaseline(rat.ui.TextBox.baselineTop);
		else if (data.baseline === "middle" || data.baseline === "center")
			pane.setBaseline(rat.ui.TextBox.baselineMiddle);
		else if (data.baseline === "bottom" )
			pane.setBaseline(rat.ui.TextBox.baselineBottom);

		if (data.autoWrap !== void 0)
			pane.setAutoWrap(!!data.autoWrap);
		if (data.translateText)
			pane.translateAndSetTextValue(data.translateText || "");
		else
			pane.setTextValue(data.text || "");
		
	};

	///
	/// Special version of textbox that default to localizing text
	/// @constructor
	/// @extends rat.ui.TextBox
	///
	rat.ui.TranslatedTextBox = function (value)
	{
		if (rat.string)
			value = rat.string.getString(value);
		rat.ui.TranslatedTextBox.prototype.parentConstructor.call(this, value); //	default init
	};
	rat.utils.inheritClassFrom(rat.ui.TranslatedTextBox, rat.ui.TextBox);

	/*
	 * Set the value with the translated version of the text
	 */
	rat.ui.TranslatedTextBox.prototype.setTextValue = function (value)
	{
		rat.ui.TranslatedTextBox.prototype.parentPrototype.translateAndSetTextValue.call(this, value);
	};

	/*
	 * Bypass the translation step
	 */
	rat.ui.TranslatedTextBox.prototype.setTextValueRaw = function (value)
	{
		rat.ui.TranslatedTextBox.prototype.parentPrototype.setTextValue.call(this, value);
	};

});