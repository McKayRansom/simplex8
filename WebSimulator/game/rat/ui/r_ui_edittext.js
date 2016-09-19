
//----------------------------
//	edittext (editable text box)
//

/*
	This approach does our own full handling of everything instead of a DOM object.
	crazy, I know, but...

	REASONS for doing this ourselves instead of using DOM:
		* It's hard to make it look consistent - different browsers and hosts (e.g. win10) use different visual borders, fonts, sizes, rendering
		* Can't control draw order - it's either in front of the whole canvas or behind it.
		* It won't work at all in places like Wraith where there's no DOM
		
	Note about the rat debug console text entry system...
		We used that as reference, but didn't consolidate code.  rat.console doesn't want to know anything about rat UI,
		we need to be able to use the console with as few other systems loaded as possible.  So, we left all that code there,
		and didn't refactor.
		
	Notes on Dirty Flags and offscreen rendering for edit text.
		The dirty flag will change frequently as text gets edited...
			Things like text changing, cursor movement, panning, and even just a blinking carat mean that
			the display needs to be updated.
			However, it's unlikely to update faster than a few times a second,
			so if you still want to use offscreen rendering, that's understandable.
		And for visual changes when highlighting, we use flagsThatDirtyMe, which is what it's for.
		Note that currently, the clipping that happens with offscreened elements makes our highlighting
			not look quite as good...  :(
		In order to fix that, we'd need to change our drawing to inset text a bit,
			to make room for borders drawn INSIDE our space.

	My design target here is basically standard Windows edit text boxes.

	States:
		An edit text box can be highlighted but not actively editing.
			for example, let's say you're typing in one text box, but you move the mouse over another one.
			It needs to highlight to show you can click on it, but the current edittext is still the place where keystrokes go.
			
		Highlighted:
			Moused over, or navigated to in another way
		
		Targeted:
			This is the current input target in an input map (is that all this means?)
			Whenever we're targeted, we'll also be highlighted, I think.
			But not necessarily active.  E.g. you can tab through text boxes,
			and hit ENTER to actually start editing one.
			
			This needs thinking through.  "targeted" may not currently be any more useful than highlighted.
			
		Active:
			Actively being edited, has a blinking carat, etc.
		
	TODO
		
		* Configurable colors for everything
			it's semi-done now, with fields to set, but a client would have to know what to set!
			and we might want to regroup them and rename fields.  Maybe one set of "looks",
			and client can set some and we auto-fill the rest.
			That'd be nice.  setLook() function
		* update pan on bounds change event.  How likely is that?
		
		* Support mid/right aligned text!  Not currently working right, in several ways.
			but oh man, I have been working on this for a couple of days now, and I'm tired of it.
			left-alignment works great.  :)
			
		* ctrl-A should select all.  I use it commonly, and it really bugs me that it doesn't work!
		
		* ctrl-left and right arrows (move word to word) (see how other editors do it - spaces are tricky)
		* shift-ctrl-left and right arrows (extend selection while moving word to word)
		
		* re-test clipboard - it was broken on ctrl-x?
		
		* Rethink pan behavior in some cases?  When you're deleting and cursor is at left edge of box, can't see what you're deleting.
		
	More advanced stuff:
	
		* select text
			* display selection box
			* cursor still has an independent position, and still displays
			* mouse selection
			* shift-arrows
			* shift-home, shift-end
			* typing replaces entire selection
			* tabbing to field selects all text
			* clicking on inactive field selects all text
			* click and drag to select text
			* shift-click to select text
			
			* copy (at the very least, control-C into internal buffer)
			
		* paste (replace selected, insert, etc.)

		* special handling of enter key, like callback? (many use cases will need it)
		* special handling of successful text changes, like callback?

		* control-arrow - skip ahead a whole word
		
		* double-click to select word
			(and then put in selecting-words mode for continued dragging)
		* triple-click to select whole line
		
		* multi-line editing
			* ctrl-enter to put in carriage-return
		
		* support indenting text a little from edge - it's a little hard to read with a frame.
			probably do this in textbox module.
		
		* unicode text entry... is that working somehow?
		* password character mode
		* text filter rules, like
			only allowing numbers or a defined character set
			only allowing a certain length
		* right-to-left text support for things like arabic, depending on font
*/

rat.modules.add( "rat.ui.r_ui_edittext",
[
	{name: "rat.ui.r_ui_textbox", processBefore: true },
	
	"rat.os.r_clipboard",
	
	//{name: "rat.utils.r_utils", processBefore: true },
	//"rat.graphics.r_graphics",
	//"rat.utils.r_wordwrap",
	//"rat.debug.r_console",
	//"rat.ui.r_ui_data",
], 
function(rat)
{
	/**
	 * @constructor
	 * @extends rat.ui.TextBox
	 * like textbox, can construct with parent,value or just one, or neither
	*/
	rat.ui.EditText = function(arg1, arg2)
	{
		//	default configuration
		this.config = {};
		this.config.enters = [
			{action: 'toggleActive'},	//	normal enter with NO MODIFIERS toggles active
			{ctrlKey : true, action: 'insertCR'},	//	ctrl-enter inserts \n
			//	the rest are passed up unhandled
		];
		this.config.maxLength = -1;	//	unlimited text length
		
		//	by default, we expect to be small, and need to clip and pan
		//	set up pan before constructor, since it calls other functions that update pan
		this.supportPan = true;
		this.pan = {x:20, y:0};
		
		rat.ui.EditText.prototype.parentConstructor.call(this, arg1, arg2); //	default init
		
		this.setTracksMouse(true);	//	we do want mouse tracking, highlighting, etc.
		this.setTargetable(true);	//	we're targetable for key input
		
		this.editFrameLook = {
			normalColor : new rat.graphics.Color(180, 180, 180),
			highlightColor : new rat.graphics.Color(255, 255, 180),
			activeColor : new rat.graphics.Color(255, 255, 255),
			lineWidth : 2,
		};
		this.editFillLook = {
			activeColor : new rat.graphics.Color(20, 20, 20, 0.2),	//	very slight box background when editing
		};
		this.editSelectionLook = {
			normalColor : new rat.graphics.Color(200, 200, 180, 0.2),	//	selection when inactive - very light
			activeColor : new rat.graphics.Color(255, 255, 180, 0.8),
			caratColor : new rat.graphics.Color(255, 255, 255),
			caratWidth : 2,
			caratBlinkSpeed : 2,	//	on-blinks per second
		};
		
		this.timer = 0;
		this.active = false;	//	being edited?
		
		this.overrideMaxWidth(-1);	//	use a huge maxwidth so the text doesn't squish
		
		//	set up cursor pos based on initial value
		var cursorPos = 0;
		if (this.value)
			cursorPos = this.value.length;
		else	//	a lot of things below are easier if we assume there's some sort of value
			this.value = "";
		this.setCursorPos(cursorPos);
		
	};
	rat.utils.inheritClassFrom(rat.ui.EditText, rat.ui.TextBox);
	rat.ui.EditText.prototype.elementType = 'editText';
	
	//	these flag changes need to set me dirty, because they change my look!
	//	see rat.ui module, comments above flagsThatDirtyMe variable,
	//	and rat.ui.Element.prototype.checkFlagsChanged function.
	//	This is similar to buttons...
	rat.ui.EditText.prototype.flagsThatDirtyMe = 
			rat.ui.Element.highlightedFlag |
			rat.ui.Element.enabledFlag

	//	set how we should handle enter key.
	//	pass in a list of behaviors like this:
	//		[
	//			{action: 'toggleActive'},	//	normal enter toggles active state
	//			{ctrlKey: true, altKey: true, action: 'insertCR'},	//	ctrl-alt-enter inserts CR
	//			//	other combinations are unhandled
	//		]
	//	or pass empty array or undefined to do no handling of enter key at all.
	//	or pass a single string action and we'll make that the behavior for standard enter, and no others will be handled.
	//		(e.g. setEnterHandling('toggleActive');
	rat.ui.EditText.prototype.setEnterHandling = function(enters)
	{
		if (typeof(enters) === 'string')
			enters = {action:enters};
		if (!enters)
			enters = [];
		if (!Array.isArray(enters))
			enters = [enters];
		this.config.enters = enters;
	};
	
	//	max text width in characters.
	//	-1 means no limit.
	rat.ui.EditText.prototype.setMaxTextLength = function(maxLength)
	{
		this.config.maxLength = maxLength;
	};
	
	//	override set value to fix internal tracking
	//	This function is generally used to replace the whole text value,
	//	so go ahead and move cursor to end.
	//	This is different from textChanged() which is called any time text changes even just a little.
	rat.ui.EditText.prototype.setTextValue = function(text)
	{
		rat.ui.EditText.prototype.parentPrototype.setTextValue.call(this, text);	//	inherited
		var cursorPos = 0;
		if (text)
			cursorPos = text.length;
		this.setCursorPos(cursorPos);
	};
	
	//	override text changed to also recalculate pan
	rat.ui.EditText.prototype.textChanged = function ()
	{
		//	restrict text here.
		//	Is this a good place to do it?
		//	This will cover external setTextValue calls as well as internal insertText calls,
		//	so it seems OK.
		//	todo: filter out disallowed characters (e.g. for a numbers-only field)
		//	TODO: there are bugs.  e.g. typing full width + 1, next backspace is ignored.
		//	so, basically cursor is incorrectly adapting to changed text.
		//	but isn't it about to get adjusted after this function returns, usually?  Look into this.
		
		if (this.config.maxLength > 0 && this.value.length > this.config.maxLength)
		{
			this.value = this.value.substring(0, this.config.maxLength);
		}
		
		if (this.textChangeCallback)
			this.textChangeCallback(this, this.value);
		
		rat.ui.EditText.prototype.parentPrototype.textChanged.call(this);	//	inherited
		
		this.updatePan();
	};
	
	//	set cursor to a new position
	//	this has a few side effects like reset cursor blinking,
	//	and reset selection range, if there was one.
	//	If you need to set cursor pos without changing selection range, don't use this function.
	rat.ui.EditText.prototype.setCursorPos = function(pos)
	{
		this.cursorPos = pos;
		this.selectionAnchor = pos;
		this.selectionEnd = pos;
		this.selectionLeft = pos;
		this.selectionRight = pos;
		this.timer = 0;		
		this.setDirty(true);
		this.updatePan();
	};
	
	rat.ui.EditText.prototype.selectAll = function()
	{
		this.cursorPos = this.value.length;
		this.selectionAnchor = 0;
		this.selectionLeft = 0;
		this.selectionEnd = this.value.length;
		this.selectionRight = this.value.length;
		this.timer = 0;
		this.setDirty(true);	//	cursor/selection may have changed
		this.updatePan();
	};
	
	//	we actively maintain selectionLeft and selectionRight for everyone's convenience,
	//	so we don't have to keep checking the order of anchor and end
	rat.ui.EditText.prototype.updateSelectionLeftRight = function()
	{
		if (this.selectionAnchor < this.selectionEnd)
		{
			this.selectionLeft = this.selectionAnchor;
			this.selectionRight = this.selectionEnd;
		} else {
			this.selectionLeft = this.selectionEnd;
			this.selectionRight = this.selectionAnchor;
		}
		
	};
	
	//	update pan to match edited text and width.
	//	We want to show the cursor, wherever it is.
	//	NOTE:  I have no particular faith in all this math and various condition checking.
	//		It could definitely all be rewritten in a better way.
	//		It does seem to work.
	rat.ui.EditText.prototype.updatePan = function()
	{
		if (this.cursorPos === 0)
		{
			//	simple case - always slam left when cursor is at the start of the string.
			this.pan.x = 0;
			return;
		}
		rat.graphics.ctx.font = this.fontDescriptor;	//	for string measurement
		var s = this.value.substring(0, this.cursorPos);
		var metrics = rat.graphics.ctx.measureText(s);
		var targetX = metrics.width;
		
		//	base new pan partly on where old pan was - only move as much as needed.
		//	This is tricky, because we also don't ever want to show space to the right past the end of our text,
		//	with text being cut off at left.
		
		var newPan;
		
		//	does the old pan work?
		if (this.pan.x < targetX - 4 && this.pan.x + this.size.x > targetX + 4)
		{
			//	keep it, except if it means there's space after the end of our string,
			//	which is silly...
			if (this.pan.x + this.size.x + 4 > this.textWidth)
				newPan = this.textWidth - this.size.x + 4;	//	get end of string in view
			else
				newPan = this.pan.x;
		} else {	//	the old pan doesn't work
			//	this will put the cursor on the right edge
			newPan = targetX - this.size.x + 4;	//	a little extra space so we can see cursor
			if (this.pan.x > newPan)	//	we're panning left..., so pick a spot that puts the cursor on the left.
				newPan = targetX - 4;	//	a little extra space so we can see cursor
		}
		
		this.pan.x = newPan;
		//	but never pan farther left than the start of the string
		if (this.pan.x < 0)
			this.pan.x = 0;
		//	don't bother setting dirty - assume whatever changed our text already did that.
	};
	
	//	Set me active or inactive
	//	activity controls things like blinking cursor, selection display, etc.
	rat.ui.EditText.prototype.setActive = function(active)
	{
		if (active != this.active)
			this.setDirty(true);
		this.active = active;
		if (!this.active)
			this.caratBlinkOn = false;
		else
			this.timer = 0;	//	reset carat blink timer
	};
	
	//	draw frame to show this is editable text, and to help indicate state
	rat.ui.EditText.prototype.drawFrame = function(ctx)
	{
		//	our edit text frame ("editFrame") is separate from rat ui "frame" concept for a couple of reasons:
		//		* it has several states, so needs more info, like multiple colors
		//		* might want to be fancy about how we draw it, like make it look slightly shadowed or something
		var frameLook = this.editFrameLook;
		ctx.lineWidth = frameLook.lineWidth;
		
		var outset = 0;
		
		var targeted = (this.flags & rat.ui.Element.targetedFlag) !== 0;
		var highlighted = (this.flags & rat.ui.Element.enabledFlag) && (this.flags & rat.ui.Element.highlightedFlag);
		
		if (this.active)
			ctx.strokeStyle = frameLook.activeColor.toString();
		else if (highlighted)
			ctx.strokeStyle = frameLook.highlightColor.toString();
		else
			ctx.strokeStyle = frameLook.normalColor.toString();
		
		//	still feeling this out.  Feel free to change it.
		if (highlighted || targeted)
		{
			ctx.lineWidth = frameLook.lineWidth + 1;
			outset = 1;
		}
		
		//	draw frame		
		ctx.strokeRect(-this.center.x - outset, -this.center.y - outset,
					this.size.x + 2 * outset, this.size.y + 2 * outset);
		
	};
	
	//	override draw to draw carat and selection, etc.
	rat.ui.EditText.prototype.drawSelf = function()
	{
		var ctx = rat.graphics.getContext();
		
		//	draw a background
		if (this.active)
		{
			ctx.fillStyle = this.editFillLook.activeColor.toString();
			ctx.fillRect(-this.center.x, -this.center.y, this.size.x, this.size.y);
		}
		//	and a frame
		this.drawFrame(ctx);
		
		//	pan support
		var panned = false;
		if (this.supportPan)
		{
			panned = true;
			ctx.save();
			
			//	panning includes clipping
			//	clip to a slightly smaller space than our box, for looks.
			//	would be nice to clip a little more, but we really need to add support for text inset, first.
			var inset = 1;
			ctx.beginPath();
			//	todo: factor in center values
			ctx.rect(inset -this.center.x, inset -this.center.y, this.size.x - inset*2, this.size.y - inset*2);
			ctx.clip();
			
			ctx.translate(-this.pan.x, -this.pan.y);
		}
		
		//	inherited behavior (draw text)
		rat.ui.EditText.prototype.parentPrototype.drawSelf.call(this);
		
		//	draw selection
		var selectionLook = this.editSelectionLook;
		var alignX = this.setupAlignX(ctx, this.textWidth);
		if (this.selectionAnchor !== this.selectionEnd)
		{
			var y = -this.center.y + 2;
			var h = this.size.y - 4;
			
			var x1 = alignX;
			var s = this.value.substring(0, this.selectionAnchor);
			//rat.graphics.ctx.font = this.fontDescriptor; //	already done for draw above
			var metrics = rat.graphics.ctx.measureText(s);
			x1 += metrics.width;
			
			var x2 = alignX + 1;	//	select a little bit farther...
			s = this.value.substring(0, this.selectionEnd);
			//rat.graphics.ctx.font = this.fontDescriptor; //	already done for draw above
			metrics = rat.graphics.ctx.measureText(s);
			x2 += metrics.width;
			var w = x2 - x1;
			
			if (this.active)
				ctx.fillStyle = selectionLook.activeColor.toString();
			else
				ctx.fillStyle = selectionLook.normalColor.toString();
			ctx.fillRect(x1, y, w, h);
		}
		//	draw carat
		var caratBlinkOn = this.caratBlinkOn;
		if (this.active && caratBlinkOn)
		{
			//	where do we draw the carat?
			var x = alignX + 1;	//	bump slightly so we can see it just inside the left edge of an empty box, which is a common case
			//var y = this.setupAlignY(ctx);
			//var h = this.fontLineHeight;
			var y = -this.center.y + 2;
			var w = selectionLook.caratWidth;
			var h = this.size.y - 4;
			
			//var width = 0;
			//if (this.lineWidths)
			//	width = this.lineWidths[0];
			//var width = this.getTextWidth();
			//	OK, now that we have a cursorpos, it's a little more complicated.
			//	We need to know the width of this particular part of the string.
			var s = this.value.substring(0, this.cursorPos);
			//rat.graphics.ctx.font = this.fontDescriptor; //	already done for draw above
			var metrics = rat.graphics.ctx.measureText(s);
			var width = metrics.width;
			
			x += width;
			
			ctx.fillStyle = selectionLook.caratColor.toString();
			ctx.fillRect(x, y, w, h);
		}
		
		//	undo pan and clip
		if (panned)
		{
			ctx.restore();
		}
	};
	
	rat.ui.EditText.prototype.updateSelf = function(dt)
	{
		if (this.active)
		{
			this.timer += dt;
			
			var oldCaratBlink = this.caratBlinkOn;
			this.caratBlinkOn = ((this.timer * this.editSelectionLook.caratBlinkSpeed * 2) % 2) < 1;
			if (oldCaratBlink != this.caratBlinkOn)
				this.setDirty(true);
		}
	};
	
	//	handle keys
	rat.ui.EditText.prototype.keyDown = function(ratEvent)
	{
		var which = ratEvent.which;
		
		//	Don't eat F keys
		if (ratEvent.which >= rat.keys.f1 && ratEvent.which <= rat.keys.f12)
			return false;
		
		else if (ratEvent.which === rat.keys.esc)
		{
			if (this.active)
			{
				this.setActive(false);
				return true;
			} else
				return false;
		}
		
		//	Much more flexible enter-key handling, according to configuration.
		//	What enter-key behaviors are allowed, and what do they do?
		//	For instance, you can say ctrl-enter adds \n, or you can say nothing does.
		//	see constructor for defaults.
		if (ratEvent.which === rat.keys.enter)
		{
			for (var i = 0; i < this.config.enters.length; i++)
			{
				var ent = this.config.enters[i];
				
				if (!!ratEvent.sysEvent.ctrlKey === !!ent.ctrlKey
					&& !!ratEvent.sysEvent.shiftKey === !!ent.shiftKey
					&& !!ratEvent.sysEvent.altKey === !!ent.altKey)
				{
					if (ent.action === 'toggleActive')
					{
						if (this.active)
							this.setActive(false);
						else
							this.setActive(true);
					} else if (ent.action === 'insertCR')
					{
						//	Note:  This is not really well-supported right now.
						//	It handles input correctly, but doesn't render (pan) correctly,
						//	or handle cursor navigation well.  :(
						this.insertText("\n");
						//	fix cursor pos?
					}
					//	todo: support passing up unhandled?
					return true;
				}
			}
		}
		
		//	some key handling is only if we're active...
		if (this.active)
		{
			var editText = this;
			var delChar = function (index)
			{
				var a = editText.value.slice(0, index);
				var b = editText.value.slice(index + 1, editText.value.length);
				editText.value = a + b;
				editText.textChanged();
			}
			var delSelection = function (index)
			{
				var a = editText.value.slice(0, editText.selectionLeft);
				var b = editText.value.slice(editText.selectionRight, editText.value.length);
				editText.value = a + b;
				editText.textChanged();
			}
			
			//	some behavior below is affected by modifier keys
			var shiftKey = ratEvent.sysEvent.shiftKey;
			
			//	for navigation key handling
			//	track if we handled anything.  If we did, do all of our cursor/selection bounds checking at once below,
			//	and return correct handled flag.
			//	In many cases we just do our changes and return immediately.  this "handled" and cursor updating is really just for navigation...
			//	maybe separate that out to a separate function for clarity...?
			var handled = false;
			var newCursorPos = this.cursorPos;
			
			if (ratEvent.which === rat.keys.c && ratEvent.sysEvent.ctrlKey)
			{
				var value = editText.value.slice(editText.selectionLeft, editText.selectionRight);
				if (value && value.length > 0)
				{
					rat.clipboard.store('text', value);
					console.log("copy " + value);
				}
				return true;
			}
			else if (ratEvent.which === rat.keys.v && ratEvent.sysEvent.ctrlKey)
			{
				var value = rat.clipboard.retrieve('text');
				if (value)
				{
					console.log("paste " + value);
					this.insertText(value);
				}
				return true;
			}
			else if (ratEvent.which === rat.keys.x && ratEvent.sysEvent.ctrlKey)
			{
				var value = editText.value.slice(editText.selectionLeft, editText.selectionRight);
				if (value && value.length > 0)
				{
					rat.clipboard.store('text', value);
					console.log("cut " + value);
					this.insertText("");
				}
				return true;
			}
			else if (ratEvent.which === rat.keys.backspace)
			{
				//	suppress default handling so backspace doesn't navigate back in browser.
				ratEvent.sysEvent.preventDefault();
				if (this.selectionEnd != this.selectionAnchor)
				{
					delSelection();
					newCursorPos = this.selectionLeft;
				}
				else if (this.cursorPos > 0)
				{
					delChar(this.cursorPos-1);
					newCursorPos = this.cursorPos-1;
				}
				shiftKey = false;	//	ignore shift key in this case
				handled = true;
			} else if (ratEvent.which === rat.keys.del)
			{
				if (this.selectionEnd != this.selectionAnchor)
				{
					delSelection();
					newCursorPos = this.selectionLeft;
				}
				else if (this.cursorPos < this.value.length)
				{
					delChar(this.cursorPos);
					//	leave cursorpos where it is
				}
				shiftKey = false;	//	ignore shift key in this case
				handled = true;
			} else if (ratEvent.which === rat.keys.leftArrow)
			{
				//	different editors handle this differently.
				//	This is not standard windows, which moves to anchor and then -1,
				//	But this is like notepad++, which moves to left side of selection.
				if (!shiftKey && this.selectionEnd != this.selectionAnchor)
					newCursorPos = this.selectionLeft;
				else
					newCursorPos = this.cursorPos - 1;
				handled = true;
			} else if (ratEvent.which === rat.keys.rightArrow)
			{
				if (!shiftKey && this.selectionEnd != this.selectionAnchor)
					newCursorPos = this.selectionRight;
				else
					newCursorPos = this.cursorPos + 1;
				handled = true;
			} else if (ratEvent.which === rat.keys.home)
			{
				newCursorPos = 0;
				handled = true;
			} else if (ratEvent.which === rat.keys.end)
			{
				newCursorPos = this.value.length;
				handled = true;
			}
			//	some special char support...?
			
			if (handled)
			{
				newCursorPos = Math.max(newCursorPos, 0);
				newCursorPos = Math.min(newCursorPos, this.value.length);
				
				//	shift key modifier - shrink or extend selection with cursorpos
				//	(see if cursorpos aligned with either begin or end, and if it moved, move begin or end accordingly)
				if (shiftKey)
					this.selectionEnd = newCursorPos;
				else
					this.selectionEnd = this.selectionAnchor = newCursorPos;
				
				this.updateSelectionLeftRight();
				
				this.cursorPos = newCursorPos;
				
				this.updatePan();
				
				this.timer = 0;	//	reset carat timer whenever carat moves
				this.setDirty(true);	//	technically, it's possible nothing changed, but I'm not that picky here.
				
				return true;
			}
		//	some inactive handling...
		} else {
			//	let's turn backspace into a clear,
			//	because it sucks to have backspace go back in browser history.
			if (ratEvent.which === rat.keys.backspace || ratEvent.which === rat.keys.del)
			{
				//	suppress default handling so backspace doesn't navigate back in browser.
				ratEvent.sysEvent.preventDefault();
				this.setTextValue("");
				return true;
			}
		}
		
		return false;
	};
	
	rat.ui.EditText.prototype.keyPress = function(ratEvent)
	{
		if (!this.active)
			return false;
				
		var char = ratEvent.sysEvent.char;
		//console.log("char " + char);
		if (char.charCodeAt(0) < ' '.charCodeAt(0))	//	unprintable character
			return false;
		if (char !== "\n" && char !== "\t")
		{
			this.insertText(char);
		}
		return true;
	};
	
	//	insert this text wherever insertion point (or selection) is.
	//	This is generally a good chokepoint for controlling what gets set as our text.
	rat.ui.EditText.prototype.insertText = function(value)
	{
		//	replace entire selection.
		var a = this.value.slice(0, this.selectionLeft);
		var b = this.value.slice(this.selectionRight, this.value.length);
		
		this.value = a + value + b;
		this.textChanged();
		
		var newCursorPos = this.selectionLeft + value.length;
		this.setCursorPos(newCursorPos);
	};
	
	//	make sure when losing focus that we become inactive if we were!
	rat.ui.EditText.prototype.blur = function()
	{
		this.setActive(false);
		return rat.ui.EditText.prototype.parentPrototype.blur.call(this); //	inherited
	};
	
	rat.ui.EditText.prototype.handleTabbedTo = function(sourceEvent)
	{
		this.setActive(true);
		this.selectAll();
	};
	
	//	convert x value to a character index,
	//	e.g. for clicking on text.
	//	This will pick left or right of a character depending on how far left/right of center you are
	//	Note that this is pretty dang expensive right now, with many calls to measureText(), but we assume that's OK.
	rat.ui.EditText.prototype.pointToCharIndex = function(pos)
	{
		rat.graphics.ctx.font = this.fontDescriptor; //	for measuring
		var bestIndex = this.value.length;
		var lastWidth = 0;
		for (var i = 1; i <= this.value.length; i++)
		{
			var s = this.value.substring(0, i);
			var metrics = rat.graphics.ctx.measureText(s);
			var dWidth = metrics.width - lastWidth;
			if (pos.x + this.center.x + this.pan.x < lastWidth + dWidth/2)
			{
				bestIndex = i-1;
				break;
			}
			lastWidth = metrics.width;
		}
		return bestIndex;
	};
	
	//	like windows ui systems, go active immediately on mousedown,
	//	unless we're already active, in which case start selecting.
	rat.ui.EditText.prototype.mouseDown = function(pos, ratEvent)
	{
		//	call inherited to get correct flags cleared/set
		rat.ui.EditText.prototype.parentPrototype.mouseDown.call(this, pos, ratEvent);
		
		if (!this.active)
		{
			//rat.aeb = this;	debug
			this.setActive(true);
			//this.selectAll();
			
			var newIndex = this.pointToCharIndex(pos);
			this.setCursorPos(newIndex);
			
		} else {
			
			var newIndex = this.pointToCharIndex(pos);
			
			if (ratEvent.sysEvent.shiftKey)
			{
				this.selectionEnd = newIndex;
				this.updateSelectionLeftRight();
			}
			else
				this.selectionEnd = this.selectionAnchor = this.selectionLeft = this.selectionRight = newIndex;
			
			this.cursorPos = newIndex;
		}
		
		this.trackingClick = true;
		
		this.timer = 0;
		this.setDirty(true);	//	cursor/selection may have changed
		
		return true;
	};
	
	rat.ui.EditText.prototype.mouseUp = function(pos, ratEvent)
	{
		//	call inherited to get correct flags cleared/set
		rat.ui.EditText.prototype.parentPrototype.mouseUp.call(this, pos, ratEvent);
		
		if (this.trackingClick)
		{
			this.trackingClick = false;
			return true;
		}
		
		return false;
	};
	
	//	track mouse movement for selection
	rat.ui.EditText.prototype.mouseMove = function(pos, ratEvent)
	{
		//	note that we don't care if cursor is really in our bounds.
		//	It's OK to drag outside our space, as long as it was all
		//	from a click that started in our space.
		if (this.trackingClick)
		{
			var newIndex = this.pointToCharIndex(pos);
			if (newIndex != this.selectionEnd)
				this.setDirty(true);
			this.selectionEnd = newIndex;
			this.cursorPos = newIndex;
			this.updateSelectionLeftRight();
			this.updatePan();
			return true;
		}
		return false;
	};
	
	//	for keyboard/controller support, also go active on trigger (action button) if not already active
	rat.ui.EditText.prototype.trigger = function()
	{
		if (!this.active)
		{
			this.setActive(true);
			this.selectAll();
		}
		return rat.ui.EditText.prototype.parentPrototype.trigger.call(this); //	inherited trigger
	};
	
	// Support for creation from data
	//	TODO: support all the config stuff, like max width, enter key handling, etc.
	rat.ui.EditText.setupFromData = function(pane, data, parentBounds)
	{
		rat.ui.data.callParentSetupFromData( rat.ui.EditText, pane, data, parentBounds );
	};
});