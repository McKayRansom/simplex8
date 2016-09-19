//
// rat color classes and utils
//

rat.modules.add("rat.graphics.r_color",
[
	{ name: "rat.graphics.r_graphics", processBefore: true },
],
function (rat)
{
	var math = rat.math; // for quick local access below

	/**
	 * @constructor
	 * @param {number=} r red (or several other options, including constructing from string or other color object)
	 * @param {number=} g green
	 * @param {number=} b blue
	 * @param {number=} a optional alpha value (assumed to be 1)
	 */
	rat.graphics.Color = function (r, g, b, a)
	{
		//	we support various forms of constructing a color,
		
		//	if nothing was passed in...
		if (typeof r === 'undefined')
		{
			this.r = 255;
			this.g = 255;
			this.b = 255;
			this.a = 1;
		//	if a style string was passed in
		} else if (typeof r === 'string')
		{
			this.copyFrom(rat.graphics.Color.makeFromStyleString(r));
		//	if an object with r,g,b properties was passed in
		} else if (r.r !== void 0)
		{
			this.r = r.r;
			this.g = r.g;
			this.b = r.b;
			if (r.a === void 0)	//	still OK to not define a explicitly, in which case it's considered 1
				this.a = 1;
			else
				this.a = r.a;
			this.applyLimits();
		}
		//	otherwise, expect individual r,g,b,a values
		else
		{
			this.r = r;
			this.g = g;
			this.b = b;
			if (a === void 0)	//	still OK to not define a explicitly, in which case it's considered 1
				this.a = 1;
			else
				this.a = a;
			this.applyLimits();
		}
	};

	/**
	 * Multiply this with another color
	 */
	rat.graphics.Color.prototype.mult = function (r, g, b, a, dest)
	{
		//	allow first argument to be a color object instead of separate "r" value
		if (r.r !== void 0)
		{
			dest = g;	//	in which case, second arg is "destination"
			a = r.a;
			b = r.b;
			g = r.g;
			r = r.r;
		}

		var r = this.r * (r / 255);
		var g = this.g * (g / 255);
		var b = this.b * (b / 255);
		var a = this.a * a;

		if (!dest)
			dest = new rat.graphics.Color(r, g, b, a);
		else
			dest.set(r, g, b, a);
		dest.applyLimits();
		return dest;
	};
	
	//	scale this color (multiply by scalar)
	rat.graphics.Color.prototype.scale = function (val)
	{
		this.r *= val;
		this.g *= val;
		this.b *= val;
		this.applyLimits();
	};

	/**
	 * Make sure that all fields of the color respect their limit (0-255, 0-1)
	 */
	rat.graphics.Color.prototype.applyLimits = function ()
	{
		// CLAMP
		if (this.r < 0) this.r = 0;
		else if (this.r > 255) this.r = 255;
			// Floor.  This only works for numbers >= 0
		else this.r = this.r | 0;

		// CLAMP
		if (this.g < 0) this.g = 0;
		else if (this.g > 255) this.g = 255;
			// Floor.  This only works for numbers >= 0
		else this.g = this.g | 0;

		// CLAMP
		if (this.b < 0) this.b = 0;
		else if (this.b > 255) this.b = 255;
			// Floor.  This only works for numbers >= 0
		else this.b = this.b | 0;

		// CLAMP
		if (this.a < 0) this.a = 0;
		else if (this.a > 1) this.a = 1;
	};

	rat.graphics.Color.prototype.toString = function ()
	{
		return "rgba(" + this.r + "," + this.g + "," + this.b + "," + this.a + ")";
	};

	rat.graphics.Color.prototype.setWhite = function ()
	{
		this.r = 255;
		this.g = 255;
		this.b = 255;
		this.a = 1;
	};

	rat.graphics.Color.prototype.setRandom = function (rng)
	{
		if (!rng)
			rng = math;
		this.r = ((rng.random() * 200) | 0) + 54;
		this.g = ((rng.random() * 200) | 0) + 54;
		this.b = ((rng.random() * 200) | 0) + 54;
		this.a = 1;
	};

	rat.graphics.Color.prototype.copy = function ()
	{
		return new rat.graphics.Color(this.r, this.g, this.b, this.a);
	};

	rat.graphics.Color.prototype.set = function (r, g, b, a)
	{
		if (a === void 0)
			a = 1;
		this.r = r;
		this.g = g;
		this.b = b;
		this.a = a;
	};

	rat.graphics.Color.prototype.copyFrom = function (c)
	{
		this.set(c.r, c.g, c.b, c.a);
	};

	rat.graphics.Color.prototype.equal = function (other)
	{
		if (this.r === other.r && this.g === other.g && this.b === other.b && this.a === other.a)
			return true;
		else
			return false;
	};

	rat.graphics.Color.prototype.distanceSq = function (other)
	{
		var dr = this.r - other.r;
		var dg = this.g - other.g;
		var db = this.b - other.b;
		return dr * dr + dg * dg + db * db;
	};
	
	rat.graphics.Color.prototype.luminance = function ()
	{
		return 0.2126 * this.r/255 + 0.7152 * this.g/255 + 0.0722 * this.b/255;
	};
	rat.graphics.Color.luminanceRGB = function (r, g, b)
	{
		return 0.2126 * r/255 + 0.7152 * g/255 + 0.0722 * b/255;
	};
	rat.graphics.Color.prototype.luminancePerceived = function ()
	{
		return 0.299 * this.r/255 + 0.587 * this.g/255 + 0.114 * this.b/255;
	};
	rat.graphics.Color.luminancePerceivedRGB = function (r, g, b)
	{
		return 0.299 * r/255 + 0.587 * g/255 + 0.114 * b/255;
	};
	rat.graphics.Color.prototype.luminancePerceived2 = function ()
	{
		return Math.sqrt(0.299 * this.r * this.r / (255*255) + 0.587 * this.g * this.g / (255*255) + 0.114 * this.b * this.b / (255*255));
	};
	
	//	using this existing color, pick the nearest color that matches this target's luminance.
	rat.graphics.Color.prototype.matchLuminanceTo = function(refColor)
	{
		var startLum = refColor.luminancePerceived();
		
		var passCount = 20;
		for (var pass = 0; pass < passCount; pass++)
		{
			var lum = this.luminancePerceived();	//	test
			var dlum = startLum - lum;
			if (dlum < 0)
			{
				this.r -= 10;
				this.g -= 10;
				this.b -= 10;
			} else {
				this.r += 10;
				this.g += 10;
				this.b += 10;
			}
			this.applyLimits();
		}
		
		/*	another attempt...
		var startLum = refColor.luminancePerceived();
		
		//	fix luminance by adjusting colors, and do that in random order.
		//	This pretty much sucks.
		//	Need real math to find closest color that matches luminance, but uses the same HUE.
		//	Need Hue Saturation Luminance, basically.  (HSP?)  Keep hue, move lum, then convert to rgb.
		//	Can HSV do this?  I don't think so!  It's not the same!
		//	maybe http://stackoverflow.com/questions/6478284/whats-the-formula-to-increase-the-luminance-in-an-image-in-a-similar-way-how-th
		//	https://en.wikipedia.org/wiki/HSL_and_HSV
		//	(look for "From luma/chroma/hue")
		//	http://colormine.org/convert/rgb-to-lab
		//	but we really just want luminance, not luma.
		//	I need a color model that uses luminance.
		
		var values = this;
		
		var LUM_R = 0.299;
		var LUM_G = 0.587;
		var LUM_B = 0.114;
		
		var passCount = 20;
		for (var pass = 0; pass < passCount; pass++)
		{
			var order = [
				{name:'r', ratio: LUM_R},
				{name:'g', ratio: LUM_G},
				{name:'b', ratio: LUM_B},
			];
			rat.utils.randomizeList(order);
		
			for (var i = 0; i < 3; i++)
			{
				var o = order[i];
				
				var oldVal = values[o.name];
				
				var newLum = startLum;
				for (var otherIndex = 0; otherIndex < 3; otherIndex++)
				{
					if (otherIndex === i)
						continue;
					newLum -= order[otherIndex].ratio * values[order[otherIndex].name]/255;
				}
				var fixed = newLum / o.ratio;
				values[o.name] = fixed * 255 / 8 + oldVal * 7/8;	//	only partway there each pass
				
				//	old:
				//var fixed = (startLum - LUM_R * newColor.r/255 - LUM_B * newColor.b/255) / LUM_G;
				//newColor.g = fixed * 255;
				this.applyLimits();
			}
		}
		
		//	check it...
		var lum = this.luminancePerceived();	//	test
		var dlum = lum - startLum;
		if (dlum < -0.1 || dlum > 0.1)
		{
			console.log("dlum = " + (lum - startLum));
		}
		*/
		
		/*
		//	Old: convert to LUV and adjusting L and convert back.
		//	Technically wrong?  Yeah, 
		var refLuv = rgb2luv(refColor.r, refColor.g, refColor.b);
		var luv = rgb2luv(this.r, this.g, this.b);
		
		luv.l = refLuv.l;
		//luv.v = refLuv.v;
		
		var rgb = luv2rgb(luv);
		this.r = rgb.r;
		this.g = rgb.g;
		this.b = rgb.b;
		this.applyLimits();
		*/
	};

	//	create a new color by interpolating between these colors
	rat.graphics.Color.interp = function (from, to, ival, dest)
	{
		var invIVal = 1 - ival;
		var r = to.r * ival + invIVal * from.r;
		var g = to.g * ival + invIVal * from.g;
		var b = to.b * ival + invIVal * from.b;
		var a = to.a * ival + invIVal * from.a;
		r = ((r < 0) ? 0 : ((r > 255) ? 255 : (r | 0)));
		g = ((g < 0) ? 0 : ((g > 255) ? 255 : (g | 0)));
		b = ((b < 0) ? 0 : ((b > 255) ? 255 : (b | 0)));
		a = ((a < 0) ? 0 : ((a > 1) ? 1 : a));
		if (dest)
		{
			dest.r = r;
			dest.g = g;
			dest.b = b;
			dest.a = a;
		}
		else
		{
			dest = new rat.graphics.Color(r, g, b, a);
		}
		return dest;
	};

	///JHS adding a dest field to avoid new5
	/** @param {Object=} dest */
	rat.graphics.Color.prototype.randomVariance = function (variance, dest)
	{
		//c.r = clamp(color.r + math.random() * variance.r - variance.r/2, 0, 255);
		//var r = this.r + math.randomVariance(variance.r);
		//var g = this.g + math.randomVariance(variance.g);
		//var b = this.b + math.randomVariance(variance.b);
		//var a = this.a + math.randomVariance(variance.a);
		var r = this.r;
		var g = this.g;
		var b = this.b;
		var a = this.a;
		if (variance.r)
		{
			r += (variance.r * 2 * math.random() - variance.r);
			r = ((r < 0) ? 0 : ((r > 255) ? 255 : (r | 0)));
		}
		if (variance.g)
		{
			g += (variance.g * 2 * math.random() - variance.g);
			g = ((g < 0) ? 0 : ((g > 255) ? 255 : (g | 0)));
		}
		if (variance.b)
		{
			b += (variance.b * 2 * math.random() - variance.b);
			b = ((b < 0) ? 0 : ((b > 255) ? 255 : (b | 0)));
		}
		if (variance.a)
		{
			a += (variance.a * 2 * math.random() - variance.a);
			a = ((a < 0) ? 0 : ((a > 1) ? 1 : a));
		}



		if (dest)
		{
			dest.r = r;
			dest.g = g;
			dest.b = b;
			dest.a = a;
		}
		else
		{
			dest = new rat.graphics.Color(r, g, b, a);
		}
		return dest;
	};

	//	convert hsv color to rgb color
	function hsv2rgb(h, s, v)
	{
		h = (h % 1 + 1) % 1; // wrap hue
		if (s > 1)
			s = 1;
		if (v > 1)
			v = 1;

		//var i = Math.floor(h * 6),
		var i = ((h * 6)|0),
		f = h * 6 - i,
		p = v * (1 - s),
		q = v * (1 - s * f),
		t = v * (1 - s * (1 - f));

		switch (i)
		{
			case 0: return [v, t, p];
			case 1: return [q, v, p];
			case 2: return [p, v, t];
			case 3: return [p, q, v];
			case 4: return [t, p, v];
			case 5: return [v, p, q];
		}
	}

	//	create a rat color object from hsv values
	rat.graphics.makeColorFromHSV = function (h, s, v)
	{
		var vals = hsv2rgb(h, s, v);
		var c = new rat.graphics.Color(vals[0] * 255, vals[1] * 255, vals[2] * 255);
		c.applyLimits();
		return c;
	};
	
	//	todo: expose these rgb and luv functions
	
	//	http://framewave.sourceforge.net/Manual/fw_function_020_0060_00330.html
	
	function rgb2xyz(ir, ig, ib)
	{
		var r = ir/255;
		var g = ig/255;
		var b = ib/255;
		return {
			x: 0.412453*r + 0.35758 *g + 0.180423*b,
			y: 0.212671*r + 0.71516 *g + 0.072169*b,
			z: 0.019334*r + 0.119193*g + 0.950227*b
		};
	};
	
	//	Computed L component values are in the range [0 to 100].
	//	Computed U component values are in the range [-124 to 220].
	//	Computed V component values are in the range [-140 to 116].
	function xyz2luv(xyz)
	{
		var xn = 0.312713;
		var yn = 0.329016;
		var bigYN = 1.0;

		var un = 4*xn / (-2*xn + 12*yn + 3);
		var vn = 9*yn / (-2*xn + 12*yn + 3);
		var u = 4*xyz.x / (xyz.x + 15*xyz.y + 3*xyz.z);
		var v = 9*xyz.y / (xyz.x + 15*xyz.y + 3*xyz.z);
		//var L = 116 * (Y/bigYN)^(1/3) - 16;
		var L = 116 * Math.pow(xyz.y/bigYN, 1/3) - 16;
		var U = 13*L*(u-un);
		var V = 13*L*(v-vn);
		return {
			l:L,
			u:U,
			v:V
		};
	};
	
	//	http://framewave.sourceforge.net/Manual/fw_function_020_0060_00340.html
	function luv2xyz(luv)
	{
		var xn = 0.312713;
		var yn = 0.329016;
		var bigYN = 1.0;
		
		var un = 4*xn / (-2*xn + 12*yn + 3);	//	these should be constants.
		var vn = 9*yn / (-2*xn + 12*yn + 3);
		
		var l = luv.l;//luv.l/100;
		var u = luv.u;//(luv.u+134)/354;	//	this seems off by 10, but it's what everyone does
		var v = luv.v;//(luv.v+140)/256;
		
		var up = u / ( 13 * l) + un;
		var vp = v / ( 13 * l) + vn;
		
		var Y = Math.pow(bigYN * (( l + 16 ) / 116 ), 3);
		var X = - 9 * Y * up / (( up - 4 ) * vp - up*vp );
		var Z = ( 9 * Y - 15 * vp * Y - vp * X ) / (3 * vp);
		
		return {x:X, y:Y, z:Z};
	};
	function xyz2rgb(luv)
	{
		return {
			r: (3.240479*luv.x + -1.537150 *luv.y + -0.498535*luv.z) * 255,
			g: (-0.969256*luv.x + 1.875992 *luv.y + 0.041556*luv.z) * 255,
			b: (0.055648*luv.x + -0.204043*luv.y + 1.057311*luv.z) * 255
		};
	};
	
	function rgb2luv(ir, ig, ib)
	{
		return xyz2luv(rgb2xyz(ir, ig, ib));
	};
	function luv2rgb(luv)
	{
		return xyz2rgb(luv2xyz(luv));
	};
	
	/*	test code
	var xyz = rgb2xyz(64, 1, 95);
	var luv = xyz2luv(xyz);
	
	var xyz2 = luv2xyz(luv);
	var xtmp = xyz2rgb(xyz2);
	console.log("color test " + xtmp.r + "," + xtmp.g + "," + xtmp.b);
	*/

	//	a bunch of standard colors
	rat.graphics.transparent = new rat.graphics.Color(0, 0, 0, 0.0);
	rat.graphics.black = new rat.graphics.Color(0, 0, 0);
	rat.graphics.white = new rat.graphics.Color(255, 255, 255);
	rat.graphics.gray = new rat.graphics.Color(128, 128, 128);
	rat.graphics.lightGray = new rat.graphics.Color(190, 190, 190);
	rat.graphics.darkGray = new rat.graphics.Color(64, 64, 64);

	rat.graphics.red = new rat.graphics.Color(255, 0, 0);
	rat.graphics.green = new rat.graphics.Color(0, 255, 0);
	rat.graphics.blue = new rat.graphics.Color(0, 0, 255);

	rat.graphics.yellow = new rat.graphics.Color(255, 255, 0);
	rat.graphics.cyan = new rat.graphics.Color(0, 255, 255);
	rat.graphics.violet = new rat.graphics.Color(255, 0, 255);
	rat.graphics.magenta = rat.graphics.violet;
	
	rat.graphics.lightRed = new rat.graphics.Color(255, 128, 128);
	rat.graphics.darkRed = new rat.graphics.Color(128, 0, 0);

	rat.graphics.lightGreen = new rat.graphics.Color(128, 255, 128);
	rat.graphics.darkGreen = new rat.graphics.Color(0, 128, 0);

	rat.graphics.lightBlue = new rat.graphics.Color(128, 128, 256);
	rat.graphics.darkBlue = new rat.graphics.Color(0, 0, 128);

	rat.graphics.darkYellow = new rat.graphics.Color(128, 128, 0);
	rat.graphics.darkCyan = new rat.graphics.Color(0, 128, 128);
	rat.graphics.darkViolet = new rat.graphics.Color(128, 0, 128);
	rat.graphics.darkMagenta = rat.graphics.darkViolet;

	rat.graphics.lightYellow = new rat.graphics.Color(255, 255, 128);
	rat.graphics.lightCyan = new rat.graphics.Color(128, 255, 255);
	rat.graphics.lightViolet = new rat.graphics.Color(255, 128, 255);
	rat.graphics.lightMagenta = rat.graphics.lightViolet;

	rat.graphics.orange = new rat.graphics.Color(255, 128, 0);

	rat.graphics.brown = new rat.graphics.Color(128, 96, 0);
	rat.graphics.darkBrown = new rat.graphics.Color(96, 64, 0);

	//	make a rat color from rgb style string
	rat.graphics.Color.makeFromStyleString = function (styleString)
	{
		var r, g, b;
		r = g = b = 255;
		var a = 1.0;
		if (styleString.substring(0,3) === 'rgb')
		{
			var startIndex = styleString.indexOf('(');
			if (startIndex)	//	make sure
			{
				styleString = styleString.substring(startIndex + 1);
				var nextIndex = styleString.indexOf(',');
				r = parseInt(styleString.substring(0, nextIndex), 10);
				styleString = styleString.substring(nextIndex + 1);

				nextIndex = styleString.indexOf(',');
				g = parseInt(styleString.substring(0, nextIndex), 10);
				styleString = styleString.substring(nextIndex + 1);

				nextIndex = styleString.indexOf(',');
				if (nextIndex < 0)
					nextIndex = styleString.indexOf(')');
				else // there's an alpha value - just grab it now, and let parseFloat ignore trailing ); whatever
					a = parseFloat(styleString.substring(nextIndex + 1));

				b = parseInt(styleString.substring(0, nextIndex), 10);
			}
			//rgba(23, 86, 89, 1)

		} else if (rat.graphics.Color.isStandard(styleString))
		{
			return rat.graphics.Color.standard(styleString);
		} else
		{
			// default to hex color style string like #FF8020
			//	We support an optional leading #, but some browsers do not support leaving that off,
			//	so don't it's best to include the # as a habit.
			if (styleString.charAt(0) === '#')
				styleString = styleString.substring(1, 7);
			r = parseInt(styleString.substring(0, 2), 16);
			g = parseInt(styleString.substring(2, 4), 16);
			b = parseInt(styleString.substring(4, 6), 16);
		}
		
		return new rat.graphics.Color(r, g, b, a);
	};
	rat.graphics.Color.makeFromHexString = rat.graphics.Color.makeFromStyleString;	//	variant name for this function

	//	standard style colors by name
	rat.graphics.Color.standardColorTable = {
			"aliceblue": "#f0f8ff", "antiquewhite": "#faebd7", "aqua": "#00ffff", "aquamarine": "#7fffd4", "azure": "#f0ffff", "beige": "#f5f5dc",
			"bisque": "#ffe4c4", "black": "#000000", "blanchedalmond": "#ffebcd", "blue": "#0000ff", "blueviolet": "#8a2be2", "brown": "#a52a2a",
			"burlywood": "#deb887", "cadetblue": "#5f9ea0", "chartreuse": "#7fff00", "chocolate": "#d2691e", "coral": "#ff7f50", "cornflowerblue": "#6495ed",
			"cornsilk": "#fff8dc", "crimson": "#dc143c", "cyan": "#00ffff", "darkblue": "#00008b", "darkcyan": "#008b8b", "darkgoldenrod": "#b8860b",
			"darkgray": "#a9a9a9", "darkgreen": "#006400", "darkkhaki": "#bdb76b", "darkmagenta": "#8b008b", "darkolivegreen": "#556b2f",
			"darkorange": "#ff8c00", "darkorchid": "#9932cc", "darkred": "#8b0000", "darksalmon": "#e9967a", "darkseagreen": "#8fbc8f",
			"darkslateblue": "#483d8b", "darkslategray": "#2f4f4f", "darkturquoise": "#00ced1", "darkviolet": "#9400d3", "deeppink": "#ff1493",
			"deepskyblue": "#00bfff", "dimgray": "#696969", "dodgerblue": "#1e90ff", "firebrick": "#b22222", "floralwhite": "#fffaf0",
			"forestgreen": "#228b22", "fuchsia": "#ff00ff", "gainsboro": "#dcdcdc", "ghostwhite": "#f8f8ff", "gold": "#ffd700", "goldenrod": "#daa520",
			"gray": "#808080", "green": "#008000", "greenyellow": "#adff2f", "honeydew": "#f0fff0", "hotpink": "#ff69b4", "indianred ": "#cd5c5c",
			"indigo ": "#4b0082", "ivory": "#fffff0", "khaki": "#f0e68c", "lavender": "#e6e6fa", "lavenderblush": "#fff0f5", "lawngreen": "#7cfc00",
			"lemonchiffon": "#fffacd", "lightblue": "#add8e6", "lightcoral": "#f08080", "lightcyan": "#e0ffff", "lightgoldenrodyellow": "#fafad2",
			"lightgray": "#d3d3d3", "lightgreen": "#90ee90", "lightpink": "#ffb6c1", "lightsalmon": "#ffa07a", "lightseagreen": "#20b2aa",
			"lightskyblue": "#87cefa", "lightslategray": "#778899", "lightsteelblue": "#b0c4de", "lightyellow": "#ffffe0", "lime": "#00ff00",
			"limegreen": "#32cd32", "linen": "#faf0e6", "magenta": "#ff00ff", "maroon": "#800000", "mediumaquamarine": "#66cdaa", "mediumblue": "#0000cd",
			"mediumorchid": "#ba55d3", "mediumpurple": "#9370d8", "mediumseagreen": "#3cb371", "mediumslateblue": "#7b68ee",
			"mediumspringgreen": "#00fa9a", "mediumturquoise": "#48d1cc", "mediumvioletred": "#c71585", "midnightblue": "#191970", "mintcream": "#f5fffa",
			"mistyrose": "#ffe4e1", "moccasin": "#ffe4b5", "navajowhite": "#ffdead", "navy": "#000080",
			"oldlace": "#fdf5e6", "olive": "#808000", "olivedrab": "#6b8e23", "orange": "#ffa500", "orangered": "#ff4500", "orchid": "#da70d6",
			"palegoldenrod": "#eee8aa", "palegreen": "#98fb98", "paleturquoise": "#afeeee", "palevioletred": "#d87093", "papayawhip": "#ffefd5",
			"peachpuff": "#ffdab9", "peru": "#cd853f", "pink": "#ffc0cb", "plum": "#dda0dd", "powderblue": "#b0e0e6", "purple": "#800080",
			"red": "#ff0000", "rosybrown": "#bc8f8f", "royalblue": "#4169e1", "saddlebrown": "#8b4513", "salmon": "#fa8072", "sandybrown": "#f4a460",
			"seagreen": "#2e8b57", "seashell": "#fff5ee", "sienna": "#a0522d", "silver": "#c0c0c0", "skyblue": "#87ceeb", "slateblue": "#6a5acd",
			"slategray": "#708090", "snow": "#fffafa", "springgreen": "#00ff7f", "steelblue": "#4682b4", "tan": "#d2b48c", "teal": "#008080",
			"thistle": "#d8bfd8", "tomato": "#ff6347", "turquoise": "#40e0d0", "violet": "#ee82ee", "wheat": "#f5deb3", "white": "#ffffff",
			"whitesmoke": "#f5f5f5", "yellow": "#ffff00", "yellowgreen": "#9acd32"
		};
	
	//	Is this a standard color name?
	//	If so, return the hex version of its style string.
	//	otherwise, return null (so it behaves like a boolean test, if you want)
	rat.graphics.Color.isStandard = function (colorName)
	{
		var cName = colorName.toLowerCase();
		var colors = rat.graphics.Color.standardColorTable;
		if (colors[cName])
			return colors[cName];
		return null;
	};
	
	//	return a rat graphics color from a standard style name
	rat.graphics.Color.standard = function (colorName)
	{
		var colors = rat.graphics.Color.standardColorTable;
		
		var cName = colorName.toLowerCase();
		if (colors[cName])
			return rat.graphics.Color.makeFromHexString(colors[cName]);

		return rat.graphics.gray;
	};
});
