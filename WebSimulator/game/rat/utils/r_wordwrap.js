//
//	Word wrapping utils
//	This can get quite complicated depending on the language.
//	So, for now, just supporting English.
//	Later, see http://en.wikipedia.org/wiki/Word_wrap
//	and http://en.wikipedia.org/wiki/Line_breaking_rules_in_East_Asian_language
//	and http://msdn.microsoft.com/en-us/goglobal/bb688158.aspx , which is a pretty good reference.
//	and we might need to change canBreakBetween to take different arguments.
//		e.g. what if we think we can break after a space because the two chars are ' ' and 'T', but BEFORE that,
//		there was a non-allowed end-of-line character (e.g. '*' in chinese)?
//		Though, why would there be a space after non-allowed-end-of-line?  Maybe we can ignore that and assume breaking after a space is always OK.
rat.modules.add( "rat.utils.r_wordwrap",
[
	"rat.debug.r_console",
], 
function(rat)
{
	rat.wordwrap = {

		isWhitespace : function(char)
		{
			//	these characters we consider whitespace.  Are there more?
			//	we should not count non-breaking space as whitespace (0x00a0)
			//	0x3000 is ideographic space
			return (char === ' ' || char === '\t' || char === '\n' || char === '\r' || char === String.fromCharCode(0x3000));
		},

		skipWhitespaceAhead : function(string, pos)
		{
			for (; pos < string.length; pos++)
			{
				if (!rat.wordwrap.isWhitespace(string.charAt(pos)))
					return pos;
			}
			return pos;
		},
		
		//	We need to be able to say generally don't break up Latin/Cyrillic words,
		//	but DO break up anything else.  So, for now, let's try this.  Anything alphabetic should not be broken up.
		//	note: greek is in 0x3FF range
		isAlphabetic : function(charCode)
		{
			return (charCode < 0x1000);
		},

		//	French has annoying rules about two-part punctuation where a space preceeds a mark, like " ?"
		isTwoPartPunctuation : function(charX)
		{
			return (charX === '?' || charX === '!' || charX === ';' || charX === ':');
		},
		
		//	OK, basically, we're going to allow wrapping anywhere there's a whitespace or a hyphen
		//	don't bother checking if char1 is whitespace, since we should have already marked this as breakable when char2 was whitespace
		
		//	TODO:  For french, we need to look farther forward.  :(
		//	e.g. we may be testing "x ", but we can't break there if the next character is "?".
		//	Change this to pass in a full string and offset, or something?
		//	also read up on multi-part wrapping - is there a rule for "! "?
		canBreakBetween : function(char1, char2)
		{
			var code1 = char1.charCodeAt(0);
			var code2 = char2.charCodeAt(0);
			
			//	let's start with the idea that we should not break
			var canBreak = false;
			//	but if we're dealing with CJK, the general rule is it's OK to break anywhere
			if (!rat.wordwrap.isAlphabetic(code1) || !rat.wordwrap.isAlphabetic(code2))
				canBreak = true;
			
			//	or if we're whitespace or hyphen
			if (rat.wordwrap.isWhitespace(char2) || char1 === '-')
				canBreak = true;
			
			//	except for a bunch of exceptions!
			//	I adapted what we've learned from XBLA games.
			//	I haven't explicitly checked these rules against the various online docs.
			if (rat.wordwrap.isNonBeginningChar(code2) ||
					rat.wordwrap.isNonEndingChar(code1)
					//|| (char1 === ' ' && rat.wordwrap.isTwoPartPunctuation(char2))
					//|| (char2 === ' ' && rat.wordwrap.isTwoPartPunctuation(char1))
			)
				canBreak = false;
			
			return canBreak;
		},

		//
		//	break this string into an array of lines, based on various word wrapping rules.  What fun!
		//	It is assumed that the given context is set up correctly with the font we care about.
		//	We do not hyphenate.  If your line simply can't be broken up, we just chop it wherever (currently, after the first char).
		//
		//	return the array of lines.
		wrapString : function(string, maxWidth, ctx)
		{
			var lines = [];
			var curStart = 0;
			var lastBreakEnd = 0;	//	end of line leading up to break
			var lastBreakStart = 0;	//	start of line after break (might not be the same if there's whitespace, which we eat up)

			//	I think this approach is reasonable and robust:
			//	walk through the string.  remember last breakable point.
			//	When string gets bigger than max width, go back and break at last breakable point.
			//	If there was no good breakable point, break where we got too wide.
			//		We have to break *somewhere* rather than go out of bounds, e.g. into non-title-safe area
			
			//	utility to accept this one line into the list of lines
			function takeLine(start, end)
			{
				lines.push(string.substring(start, end));
				//console.log("breaking at " + end + " : " + lines[lines.length-1]);
			}

			//	walk through full text
			for (var i = 0; i < string.length; i++)
			{
				//	always break on manual breaks...
				if (string[i] === '\n')
				{
					takeLine(curStart, i);
					curStart = i+1;	//	skip \n
					lastBreakEnd = lastBreakStart = curStart;	//	just start with some reasonable defaults
					continue;
				}

				//	check if this character puts us over the limit, and we need to break first
				var testString = string.substring(curStart, i+1);
				var metrics = ctx.measureText(testString);
				var testWidth = metrics.width || metrics;
				if (testWidth >= maxWidth)
				{
					if (lastBreakEnd === curStart)	//	we never found a good breaking place!
					{
						//	we are forced to just cut off somewhere else, rather than overlap our bounds.
						//	This is a case where the content creator must change the text or the space we have to work with.
						//	Cut off right before this new character, since it's what put us over.
						rat.console.logOnce("bad textwrap at " + i);
						lastBreakEnd = lastBreakStart = i;
					}
					takeLine(curStart, lastBreakEnd);
					curStart = lastBreakEnd = lastBreakStart;
				}

				//	now check if we can break after this character, and remember that for future use.
				if (i === string.length-1 || //	always can break after final char, and it won't matter - just short-circuit next expression
						rat.wordwrap.canBreakBetween(string.charAt(i), string.charAt(i+1))	//	OK to break here
					)
				{
					lastBreakEnd = i+1;
					//	if we CAN break here, then skip ahead past any whitespace, so we don't start a new line with empty space.
					lastBreakStart = rat.wordwrap.skipWhitespaceAhead(string, i+1);
				}
			}

			//	pick up the rest of the final line, if any
			if (curStart !== string.length)
			{
				takeLine(curStart, string.length);
			}

			return lines;
		},
		
		//	these characters are not allowed to begin a line
		//	c is charCode, not character or string
		//	TODO: These tables don't seem to match http://msdn.microsoft.com/en-us/goglobal/bb688158.aspx
		isNonBeginningChar : function (c)
		{
			return (
				c === 0x0045 ||		//	no hyphens at start of line
				c === 0x00a0 ||		//	no non-breaking spaces at the start of a line
				c === 0xff0c ||		// 
				c === 0xff0e ||		// 
				c === 0xff1a ||		// 
				c === 0xfe30 ||		// 
				c === 0xfe50 ||		// 
				c === 0x00B7 ||		// 
				c === 0xfe56 ||		// 
				c === 0xff5d ||		// 
				c === 0x300F ||		// 
				c === 0xfe5c ||		// 
				c === 0x201D ||		// 
				c === 0x003A ||		// 
				c === 0x005D ||		// 
				c === 0x2022 ||		// 
				c === 0x2027 ||		// 
				c === 0x2026 ||		// 
				c === 0xfe51 ||		// 
				c === 0xfe54 ||		// 
				c === 0xfe57 ||		// 
				c === 0x3011 ||		// 
				c === 0x300D ||		// 
				c === 0xfe5e ||		// 
				c === 0x301E ||		// 
				c === 0x003B ||		// 
				c === 0x007D ||		// 
				c === 0xff1b ||		// 
				c === 0xff01 ||		// 
				c === 0xfe52 ||		// 
				c === 0xfe55 ||		// 
				c === 0x3015 ||		// 
				c === 0x3009 ||		// 
				c === 0xfe5a ||		// 
				c === 0x2019 ||		// 
				c === 0x2032 ||		// 
				c === 0x0025 ||		// 
				c === 0x00B0 ||		// 
				c === 0x2033 ||		// 
				c === 0x2103 ||		// 
				c === 0x300b ||		// 
				c === 0xff05 ||		// 
				c === 0xff3d ||		// 
				c === 0xffe0 ||		// 
				c === 0x2013 ||		// 
				c === 0x2014 ||		// 
				c === 0xff61 ||		// 
				c === 0xff64 ||		// 
				c === 0x3063 ||		// 
				c === 0x3083 ||		// 
				c === 0x3085 ||		// 
				c === 0x3087 ||		// 
				c === 0x30c3 ||		// 
				c === 0x30e3 ||		// 
				c === 0x30e5 ||		// 
				c === 0x30e7 ||		// 
				c === 0x3041 ||		// 
				c === 0x3043 ||		// 
				c === 0x3045 ||		// 
				c === 0x3047 ||		// 
				c === 0x3049 ||		// 
				c === 0x308e ||		// 
				c === 0x30a1 ||		// 
				c === 0x30a3 ||		// 
				c === 0x30a5 ||		// 
				c === 0x30a7 ||		// 
				c === 0x30a9 ||		// 
				c === 0x30ee ||		// 
				c === 0x0022 ||		// Quotation mark
				c === 0x0021 ||		// Exclamation mark
				c === 0x0029 ||		// Right parenthesis
				c === 0x002c ||		// Comma
				c === 0x002e ||		// Full stop (period)
				c === 0x003f ||		// Question mark
				c === 0x3001 ||		// Ideographic comma
				c === 0x3002 ||		// Ideographic full stop
				c === 0x30fc ||		// Katakana-hiragana prolonged sound mark
				c === 0xff01 ||		// Fullwidth exclamation mark
				c === 0xff09 ||		// Fullwidth right parenthesis
				c === 0xff1f ||		// Fullwidth question mark
				c === 0xff70 ||		// Halfwidth Katakana-hiragana prolonged sound mark
				c === 0xff9e ||		// Halfwidth Katakana voiced sound mark
				c === 0xff9f
			);		// Halfwidth Katakana semi-voiced sound mark
		},
		
		//	these characters are not allowed to end a line
		//	c is charCode, not character or string
		isNonEndingChar : function(c)
		{
			return (
				c === 0x3010 ||		// 
				c === 0x300C ||		// 
				c === 0xfe5d ||		// 
				c === 0x301D ||		// 
				c === 0x005B ||		// 
				c === 0x3014 ||		// 
				c === 0x3008 ||		// 
				c === 0xfe59 ||		// 
				c === 0x2018 ||		// 
				c === 0x2035 ||		// 
				c === 0x007B ||		// 
				c === 0xff5b ||		// 
				c === 0x300E ||		// 
				c === 0xfe5b ||		// 
				c === 0x201C ||		// 
				c === 0x005C ||		// 
				c === 0x0024 ||		// 
				c === 0xffe1 ||		// 
				c === 0x300A ||		// 
				c === 0xff04 ||		// 
				c === 0xff3b ||		// 
				c === 0xffe6 ||		// 
				c === 0xffe5 ||		// 
				c === 0x0022 ||		// Quotation mark
				c === 0x0028 ||		// Left parenthesis
				c === 0xff08		// Fullwidth left parenthesis
			);
		},
	};
	
} );