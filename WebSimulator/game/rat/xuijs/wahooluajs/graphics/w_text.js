//
//	generated js from lua file, and hand-edited by STT
//

rat.modules.add( "rat.xuijs.wahooluajs.graphics.w_text",
[
	{name: "rat.xuijs.wahooluajs.wahoolua", processBefore: true },
	{name: "rat.utils.r_utils", processBefore: true },
	{name: "rat.xuijs.wahooluajs.graphics.w_graphic_object", processBefore: true },
	
	"rat.xuijs.wahooluajs.graphics.w_scene",
	"rat.xuijs.wahooluajs.math.w_vector3d",
], 
function(rat)
{
	//	constructor?  There isn't one in lua
	var WText = function(refScene, xuiFile, state)
	{
		this.String = [];	//	my characters
		this.Font = null;	//	eventually a font object reference
	};
	rat.utils.inheritClassFrom(WText, wahoolua.WGraphicsObject);
	
	//	These are likely to be offscreens...  make it easy to set myself dirty...
	WText.prototype.setDirty = function(dirty)
	{
		if (this.graphic)
			this.graphic.setDirty(dirty);
	};
	WText.prototype.setUseOffscreen = function(use)
	{
		if (this.graphic)
			this.graphic.setUseOffscreen(use);
	};
	
	// Pools of unused characters when we are done.
	// Indexed by the Font NAME (which is unique to JS port)
	var gGlyphPool = {}
	WText.gGlyphPool = gGlyphPool;	//	STT for debug access
	
	//	destructor
	WText.prototype.Dtor = function()
	{
		this.PoolString();
		//	the code below is a duplicate of PoolString, so why not just call that?
		/*
		for (var index = 0; index < this.String.length; index++)
		{
			var charScene = this.String[index];
			charScene.Unlink();
			gGlyphPool[this.Font.name].push(charScene);	//	put back in pool
		}
		*/
		WText.prototype.parentPrototype.Dtor.call(this); //	default destructor
	};
	
	//	put everything back in pool
	WText.prototype.PoolString = function() {
		while (this.String.length > 0) {
			var glyph = this.String.pop();
			glyph.Unlink();
			if (!glyph.subElements || glyph.subElements.length < 1)
			{
				rat.console.logOnce("ERROR pooling destroyed string.");
			} else {
				gGlyphPool[this.Font.name].push(glyph);
			}
		}
	};
	
	//	not a method - a class function
	WText.GetFontFilePath = function( font ) {
		if (font.file.charAt(0) === "#")
		{
			return font.file+".xur";
		}
		return "#media/"+font.file+".xur";
	};
	
	/*
	
	A bunch of functions not used in slush?  TODO - port
	
	
	WText.prototype.PrecacheCharacter = function( font, quantity, xuiElement ) {
	
		var pool = gGlyphPool[font.name];
		if ( !pool ) {
			pool = {}
			gGlyphPool[font.name] = pool
		}
		
		var fileName = WText.GetFontFilePath(font)
		
		for i=1, quantity do
			table.insert(pool, xuiElement.LoadObject(fileName))
		}
	
	}
	
	WText.prototype.GetPoolQuantity = function(font) {
		var pool = gGlyphPool[font.name]
		if ( !pool ) { return 0 }
		return pool.length;
	};
	
	WText.prototype.DestroyPool = function() {
		
		for font, pool in pairs(gGlyphPool) do
			for i, charScene in ipairs(pool) do
				charScene.DestroyObject()
			}
			gGlyphPool[font] = null		NAME
		}
		
	}
	*/
	
	WText.prototype.Initialize = function() {
	};
	
	WText.prototype.SetAlign = function(align) {
		var align = align || "LEFT";
		if (this.align !== align)
		{
			this.setDirty(true);
			this.align = align;
		}
	};
	
	WText.prototype.GetStartPos = function(parentWidth, lineWidth) {
		var charPos = 0;
	
		if ( this.align == "CENTER" ) {
			charPos = (parentWidth/2) - (lineWidth/2);
		}
		else if ( this.align == "RIGHT" ) {
			charPos = parentWidth - lineWidth;
		}
		
		return charPos;
	}
	
	WText.prototype.SetText = function(text) {
		if ( text === false || text === null || text === void 0) {
			text = "";
		}
		if ( !this.Font ) {
			WStdUtils.ErrPrintf("Error: cannot set text if no font is set. Make sure you are calling SetFont first.")
			return null;
		}
	
		//if ( this.String == null ) {
		//	this.String = []
		//}
	
		var charPos = 0;									// Character's x position
		var charIndex = 0;									// Index of the character as it is displayed
		var parentWidth = this.graphic.GetWidth();			// The width of the textbox
		var lineWidth = this.GetLineWidth(text, parentWidth);	// The pixel width of the current line
	
		charPos = this.GetStartPos(parentWidth, lineWidth);
		var startPos = charPos;								// The starting x position of the line
	
		var newlines = 0; 										// Counts how many new lines have been made
		var hiddenChars = 0; 									// Counts what characters that GetLineWidth counts but are not displayed
		
		var currentStyle = this.defaultStyle || ''; 		// The style of the text, such as bold. Style tags may specify the style.
		var isReadingTag = false; 							// Flag set to true while a style tag is being read
		var isReadingCloseTag = false; 						// Flag set when a close style tag is being read
		var tagName = ''; 									// The name of the style tag to apply
		var justAppliedWordWrap = false;					// Checks the case where we start a new line by word wrap but the text has a \n right there anyway
		var nonWhiteSpaceInLine = false;					// If we are trimming white space, then we want to skip all preceeding white space in the line
		
		var scale = null;									// Vector 3, the scale of the text
		var oneOverScale = null;								// Vector 3, one over the scale
		if ( this.fitPixels ) {
			scale = this.GetScale();
			oneOverScale = new wahoolua.WVector3D(1/scale.x, 1/scale.y, 1/scale.z);
		}
		
		//for ch in text:gmatch"." do
		var chList = WText.GetCharacters(text);
		for (var chIndex = 0; chIndex < chList.length; chIndex++)
		{
			var ch = chList[chIndex];
			var charScene = null;
			//print("CH: ",tostring(ch))
			
			// Check if word wrap is turned on and this is the space where the word wrap was previously calculated to apply.
			if ( this.Font.lineHeight && this.wordwrap && WText.IsWhiteSpace(ch) && (charPos+this.GetGlyph(ch, currentStyle).width-startPos >= lineWidth) ) {	// only make new lines if we have a specified line height
				hiddenChars = hiddenChars + 1;
				newlines = newlines + 1;
				var vars0 = this.ResetCharPos(text, charIndex, hiddenChars, parentWidth);		// need to adjust the starting position to the new center

				lineWidth = vars0[0];
				startPos = vars0[1];
				charPos = vars0[2];
				justAppliedWordWrap = true;												// Mark that we just made a new line by word wrap
				nonWhiteSpaceInLine = false;												// So trim this preceeding white space
			}
			else if ( ch == "\n" ) {
				hiddenChars = hiddenChars + 1
				if ( this.Font.lineHeight ) {	// only make new lines if we have a specified line height
					// Check to see if we did not just make a new line from word wrap
					if ( !justAppliedWordWrap ) {
						newlines = newlines + 1
						nonWhiteSpaceInLine = false
					}		// Otherwise, the line width would have been calculated }ing at this new line, a width of zero.
							// Note that the line width calculation should have return a zero for the case of "\n\n".
							
					// Either way, we would have calculated the width to end at this new line character, so recalculate it.
					var vars1 =  this.ResetCharPos(text, charIndex, hiddenChars, parentWidth);

					lineWidth = vars1[0]
					startPos = vars1[1]
					charPos = vars1[2]
				}
				justAppliedWordWrap = false;
			}
			
			else if ( this.IsWhitespaceTrimmed() && WText.IsWhiteSpace(ch) && !nonWhiteSpaceInLine ) {
				// We are trimming white space and we've only seen white space
				hiddenChars = hiddenChars + 1;
			}
			/* TODO PORT TAGS!
			else if ( ch == "<" ) {
				isReadingTag = true
				hiddenChars = hiddenChars + 1;
			}
			else if ( isReadingTag ) {
				if ( ch == "/" ) {
					isReadingCloseTag = true;
				}
				else if ( ch == ">" ) {
					tagName = string.lower(tagName)
					if ( isReadingCloseTag ) {
						currentStyle = string.gsub(currentStyle, tagName, '', 1)
					}
					else {
						currentStyle = tagName+currentStyle
					}
					isReadingTag = false
					isReadingCloseTag = false
					tagName = ''
				}
				else {
					tagName = tagName+ch
				}
				hiddenChars = hiddenChars + 1
			}
			*/
			else {
				if ( this.String.length > charIndex ) {
					charScene = this.String[charIndex];
					charScene.SetShow(true);
				}
				else {
					if ( gGlyphPool[this.Font.name].length != 0 ) {
						charScene = gGlyphPool[this.Font.name].pop();
						charScene.SetShow(true);//The character may have been hidden by being in the unused portion of a string.
					}
					else {
						var returnFirstChild = false;		// 	need root so we can playtimeline on it?  sad...
						charScene = xuijs.apiUtils.createXuiItemFromFile(WText.GetFontFilePath(this.Font), returnFirstChild);
						//charScene = this.graphic.LoadObject(WText.GetFontFilePath(this.Font));
					}
					this.String.push(charScene);
					this.graphic.AddChild(charScene);
				}
	
				var glyph = this.GetGlyph(ch, currentStyle);
				if ( glyph.end_frame ) {
					charScene.PlayTimeline(glyph.frame, glyph.end_frame, false);
				}
				else {
					//WStdUtils.printf("Character %s format %s named frame %s.", ch, currentStyle, glyph.frame)
					charScene.PlayTimeline(glyph.frame, glyph.frame, false);
				}
				
				// Get the line height from the glyph and then use the correct line position
				var h = this.Font.lineHeight || 0;
				var charHeight = h * newlines;
				
				if ( this.fitPixels ) {
					charPos = rat.math.floor(charPos * scale.x) * oneOverScale.x;
				}
				
				charScene.SetPosition(charPos, charHeight, 0);
				var width = this.fixedWidth || glyph.width;
				charPos = charPos + width;
				charIndex = charIndex + 1;
				justAppliedWordWrap = false;
				nonWhiteSpaceInLine = true;
			}
		}
	
		this.StringLength = charIndex;//charIndex - 1
		for (var i = charIndex; i < this.String.length; i++)
		{
			this.String[i].SetShow(false);
		}
		
		this.setDirty(true);
		this.text = text;
	}
	
	// Function for returning the character position to the begining of the line in SetText.
	WText.prototype.ResetCharPos = function(text, charIndex, hiddenChars, parentWidth) {
		var lineWidth = this.GetLineWidth(text, parentWidth, charIndex + hiddenChars);
		var startPos = this.GetStartPos(parentWidth, lineWidth);
		var charPos = startPos;
		return [lineWidth, startPos, charPos];
	}
	
	WText.prototype.GetText = function(text) {
		return this.text;
	}
	
	WText.prototype.GetTextLength = function() {
		return this.StringLength;
	}
	
	WText.prototype.SetFont = function(fontTable) {
		if (!this.Font || fontTable.name != this.Font.name ) {
			if ( this.String ) {
				this.PoolString();
			}
			
			this.Font = fontTable;
			
			if ( !gGlyphPool[this.Font.name] ) {
				gGlyphPool[this.Font.name] = [];
			}
			
			this.setDirty(true);
		}
	}
	
	WText.prototype.GetGlyph = function(character, textFormat) {
		var glyph = this.Font.glyphs[textFormat+character]
		if ( glyph == null ) {
			glyph = this.Font.glyphs[this.Font.defaultGlyph]
		}
	
		return glyph
	}
	
	WText.prototype.SetFixedWidth = function(width) {
		if (this.fixedWidth != width)
			this.setDirty(true);
		this.fixedWidth = width;
	}
	
	WText.prototype.GetStringWidth = function(text) {
		var width = 0;
		
		var currentStyle = this.defaultStyle || ''
		var isReadingTag = false
		var isReadingCloseTag = false
		var tagName = ''
		
		//for ch in text:gmatch"." do
		var chList = WText.GetCharacters(text);
		for (var chIndex = 0; chIndex < chList.length; chIndex++)
		{
			var ch = chList[chIndex];
			/*	TODO PORT TAGS
			if ( ch == "<" ) {
				isReadingTag = true
			}
			else if ( isReadingTag ) {
				if ( ch == "/" ) {
					isReadingCloseTag = true
				}
				else if ( ch == ">" ) {
					tagName = string.lower(tagName)
					if ( isReadingCloseTag ) {
						currentStyle = string.gsub(currentStyle, tagName, '', 1)
					}
					else {
						currentStyle = tagName+currentStyle
					}
					isReadingTag = false
					isReadingCloseTag = false
					tagName = ''
				}
				else {
					tagName = tagName+ch
				}
			}
			else 
			*/
			{
				var glyph = this.GetGlyph(ch, tagName);
				var glyphWidth = this.fixedWidth || glyph.width;
				width = width + glyphWidth;
			}
		}
		
		return width;
	}
	
	// Gets the length of the specified line within the text.
	// @param text - The String of text to scan.
	// @param parentWidth - The width of the text box
	// @param start - The character index of where to start looking as it is returned by WText.GetCharacters(text). Starts indexing at 1.
	WText.prototype.GetLineWidth = function(text, parentWidth, start) {
		if ( text === false || text === null || text === void 0) {
			return 0;
		}
		
		if ( !this.Font.lineHeight ) {									// If we do not have the information for making multiple lines,
			return this.GetStringWidth(text);								// then simply get the length of the entire text.
		}
		
		var i = 0;//1;															// Character index by the result of WText.GetCharacters(text)
		start = start || 0;//1													// The character index of where to start looking
		var width = 0;														// Keeps track of the total width of the word
		var wordWidth = 0;													// The width of the word currently being iterated over, but has not yet been determined if it is a part of the width for this line.
		var onlyWhitespaceInWord = true;									// Keeps track if this word only has whitespace in it.
		//	TODO: precedence here?
		var maxWidth = parentWidth || this.wordwrap && this.GetWidth();	// The maximum width allowed for this line. Only applies if word wrap is enabled.
		
		var currentStyle = this.defaultStyle || '';						// Keeps track of the current style of the text such as bold.
		var isReadingTag = false;											// Keeps track if a style tag is currently being read.
		var isReadingCloseTag = false;										// Keeps track if the style tag being read is closed.
		var tagName = '';													// The name of the style tag being read.
		
		//for ch in text:gmatch"." do
		var chList = WText.GetCharacters(text);
		for (var chIndex = 0; chIndex < chList.length; chIndex++)
		{
			var ch = chList[chIndex];
			
			/*	TODO PORT TAGS
			if ( ch == "<" ) {
				isReadingTag = true
			}
			else if ( isReadingTag ) {
				if ( ch == "/" ) {
					isReadingCloseTag = true
				}
				else if ( ch == ">" ) {
					tagName = string.lower(tagName)
					if ( isReadingCloseTag ) {
						currentStyle = string.gsub(currentStyle, tagName, '', 1)
					}
					else {
						currentStyle = tagName+currentStyle
					}
					isReadingTag = false
					isReadingCloseTag = false
					tagName = ''
				}
				else {
					tagName = tagName+ch
				}
			}
			else
				*/
			if ( i >= start ) {		// skip past the lines we already used
				if ( ch == "\n" && this.Font.lineHeight ) {
					break;			// return when we hit the } of the current line
				}
				
				var glyph = this.GetGlyph(ch, currentStyle);
				var glyphWidth = this.fixedWidth || glyph.width;
				wordWidth = wordWidth + glyphWidth;
				
				if ( this.wordwrap && (width+wordWidth) > maxWidth ) {
					return width; // return when we hit the } of the current line
				}
				if ( WText.IsWhiteSpace(ch) ) {
					if ( this.IsWhitespaceTrimmed() && width == 0 && onlyWhitespaceInWord ) {		// We are trimming white space, we at the begining of the line, and the word only has white space
						wordWidth = 0;																// So trim our white space
					}
					else {																			// Otherwise, we are counting all white space or we've counted non-white space in this call
						width = width+wordWidth-glyphWidth;											// Add the word minus this white space to the total length
						wordWidth = glyphWidth;														// Start the next word with whitespace
						onlyWhitespaceInWord = true;
					}
				}
				else {
					onlyWhitespaceInWord = false;
				}
			}
			i = i + 1;
		}
		if ( !(this.IsWhitespaceTrimmed() && onlyWhitespaceInWord) ) {							// If we are trimming white space and this word is just white space, then we do not want to count this white space in this line.
			width = width+wordWidth;
		}
	
		return width;
	}
	
	WText.prototype.Reset = function() {
		this.String = []
	};
	
	//	I'm not sure how this worked in Lua.  
	//	does a graphic object normally support SetShow?
	WText.prototype.SetShow = function(show) {
		this.graphic.SetShow(show);
	};
	
	// Checks to see if white space is trimmed from the front and back of a line of text.
	WText.prototype.IsWhitespaceTrimmed = function() {
		return this.wordwrap || this.align == "CENTER";	// To be constistant with XUI, white space is trimmed if word wrap is enabled or the text is centered.
	};
	
	WText.IsWhiteSpace = function(ch) {
		return ch == ' ' || ch == '\t';
	};
	
	//	returns an array of our characters.
	WText.GetCharacters = function(text) {
		var list = [];
		for (var i = 0; i < text.length; i++)
		{
			var ch = text.charAt(i);
			//if (ch !== '\r' && ch !== '\n')
				list.push(ch);
		}
		return list;
		//return [string.gfind(text, "([%z\1-\12\14-\127\194-\244][\128-\191]*)")  // support for unicode strings]
		//																		// Note: Carriage return, \r, \13, is ignored
	}
	
	wahoolua.WText = WText;
		
});
