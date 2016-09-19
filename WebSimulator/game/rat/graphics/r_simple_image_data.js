//
//	This is VERY simple, limited replacement of the built-in html5 getImageData system,
//	since that system is very slow per call.  If we're just getting and setting bits, or drawing simple lines,
//	this can be a lot faster.
//	In particular, this was hugely helpful for speeding up drawpig.
//
//	This includes some really simple ability to set line width and "draw" into the bits.
//	
//	We also only currently track alpha, not colors.
//
//	Todo:
//		* automatic assumed border support so we don't overflow edges when drawing or reading
//			* 	or optional bounds-checked versions of get/set functions, which will be slower?
//		* use Uint8ClampedArray if supported?

rat.modules.add( "rat.graphics.r_simple_image_data",
[
	{name: "rat.graphics.r_graphics", processBefore: true },
	
	//"rat.debug.r_console",
	//"rat.os.r_system",
], 
function(rat)
{
	///
	/// SimpleImageData Object
	/// @constructor
	///
	var SimpleImageData = function (width, height)
	{
		this.pixelScale = 1;
		this.data = [];
		
		this.width = (width / this.pixelScale) | 0;
		this.height = (height / this.pixelScale) | 0;
		this.len = this.width * this.height;
		this.clear();
	};
	
	//	clear out all my data
	//	keep size, etc.
	SimpleImageData.prototype.clear = function()
	{
		for (var i = 0; i < this.len; i++)
		{
			this.data[i] = 0;
		}
	};
	
	//	getImageData matches the standard getImageData call in HTML5 - we return our own structure,
	//	which includes a ".data" field that callers expect us to have.
	SimpleImageData.prototype.getImageData = function(x, y, width, height)
	{
		return this;	//	we're in the right form, just do it.  We have a .data field.
	};

	//	set my line width for later draw calls.
	//	this picks appropriate stamp mask values, closest available ones anyway.
	SimpleImageData.prototype.setLineWidth = function(lineWidth)
	{
		var targetSize = lineWidth / this.pixelScale;
		
		for (var potential = 0; potential < masks.length; potential++)
		{
			var	potMask = masks[potential];
			//	if it fits or it's our last (universal) option...
			if (targetSize <= potMask.useForSize || potMask.useForSize === -1)
			{
				rat.console.log("setLineWidth " + potMask.useForSize + " from " + lineWidth);
				this.mask = potMask;
				break;
			}
		}
	}

	//	set pixels in our image data based on previously set pixel shape.
	//	x y w h are in normal pixels (before being scaled by us)
	//	This may get called quite a bit and needs to be fast.
	SimpleImageData.prototype.setPixels = function(ix, iy)
	{
		var x = (ix / this.pixelScale) | 0;
		var y = (iy / this.pixelScale) | 0;
		var offset = y * this.width + x;

		var xpts = this.mask.xPts;
		var ypts = this.mask.yPts;
		var avals = this.mask.aVals;

		for (var i = 0; i < xpts.length; i++)
		{
			//	todo: how are we masking this, keeping pixels from wrapping and flowing off top or bottom?
			offset = (y + ypts[i]) * this.width + x + xpts[i];
			//this.data[offset] = 255;
			this.data[offset] += avals[i];
		}
	}

	//	get our stored value at this location
	//	This may get called quite a bit and needs to be fast.
	SimpleImageData.prototype.getValue = function(ix, iy)
	{
		var x = (ix / this.pixelScale) | 0;
		var y = (iy / this.pixelScale) | 0;
		var offset = y * this.width + x;
		return this.data[offset];
	}

	SimpleImageData.prototype.pack = function()
	{
		var str = '';
		var len = this.width * this.height;
		for (var i = 0; i < len; i += 2)
		{
			str += String.fromCharCode(this.data[i] << 8 | this.data[i+1]);
		}
		return str;
	}

	SimpleImageData.prototype.unpack = function(str)
	{
		var len = this.width * this.height;
		var offset = 0;
		for (var cPos = 0; cPos < len; cPos++)
		{
			var e1 = str.charCodeAt(cPos);	//	each value represents 2 values
			
			this.data[offset] = (e1 >> 8) & 0xFF;
			this.data[offset+1] = e1 & 0xFF;
			offset += 2;
		}
	}

	//	internal class mask data
	//	(line/dot shapes for various line widths)
	var masks = [
		{useForSize : 2,	//	3x3, really...
			//xPts : [-1, 0,  -1, 0],	//	no good..
			//yPts : [ 0, 0,   1, 1],
			xPts : [-1, 0, 1,  0, 0],	//	still no good, really.  Don't use this.
			yPts : [0, 0, 0,  -1, 1],
			aVals : [127, 255, 127, 127, 127],
		},
		{useForSize : 3,	//	3x3?
			//xPts : [-1, 0, 1,  0, 0],
			//yPts : [0, 0, 0,  -1, 1],
			//	much better.  the above is too small, lets pigs jump over lines.
			xPts : [-1, 0, 1,  -1, 0, 1,  -1, 0, 1],
			yPts : [0, 0, 0,  -1, -1, -1,  1, 1, 1],
			//	alpha in the corners here helps with not getting stuck too soon.  Occasionally jumps lines more.
			aVals : [255, 255, 255, 127, 255, 127, 127, 255, 127],
			//aVals : [255, 255, 255, 255, 255, 255, 255, 255, 255],
		},
		{useForSize : 6,
			xPts : [-2, -2, -2,  -1, -1, -1,  0, 0, 0,  1, 1, 1,  2, 2, 2,  -1, 0, 1,  -1, 0, 1],
			yPts : [-1, 0, 1,    -1, 0, 1,   -1, 0, 1, -1, 0, 1, -1, 0, 1,  -2, -2, -2,  2, 2, 2],
			aVals : [255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255],
		},
		{useForSize : 10,
			xPts : [-1, 0, 1, 
					-2, -1, 0, 1, 2,
					-3, -2, -1, 0, 1, 2, 3, 
					-4, -3, -2, -1, 0, 1, 2, 3, 4,
					-4, -3, -2, -1, 0, 1, 2, 3, 4,
					-4, -3, -2, -1, 0, 1, 2, 3, 4,
					-3, -2, -1, 0, 1, 2, 3, 
					-2, -1, 0, 1, 2,
					-1, 0, 1],
			yPts : [-4, -4, -4,
					-3, -3, -3, -3, -3,
					-2, -2, -2, -2, -2, -2, -2,
					-1, -1, -1, -1, -1, -1, -1, -1, -1,
					0, 0, 0, 0, 0, 0, 0, 0, 0,
					1, 1, 1, 1, 1, 1, 1, 1, 1,
					2, 2, 2, 2, 2, 2, 2,
					3, 3, 3, 3, 3,
					4, 4, 4],
			aVals : [255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
					255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
					255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255],

		},
		{useForSize : -1,	//	use for any other size.
			xPts : [-1, 0, 1, 
						-3, -2, -1, 0, 1, 2, 3, 
						-4, -3, -2, -1, 0, 1, 2, 3, 4,
						-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5,
						-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6,
						-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6,
						-7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7,
						-7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7,
						-7, -6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6, 7,
						-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6,
						-6, -5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5, 6,
						-5, -4, -3, -2, -1, 0, 1, 2, 3, 4, 5,
						-4, -3, -2, -1, 0, 1, 2, 3, 4,
						-3, -2, -1, 0, 1, 2, 3, 
						-1, 0, 1],
			yPts : [-7, -7, -7,
						-6, -6, -6, -6, -6, -6, -6,
						-5, -5, -5, -5, -5, -5, -5, -5, -5,
						-4, -4, -4, -4, -4, -4, -4, -4, -4, -4, -4,
						-3, -3, -3, -3, -3, -3, -3, -3, -3, -3, -3, -3, -3,
						-2, -2, -2, -2, -2, -2, -2, -2, -2, -2, -2, -2, -2,
						-1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1, -1,
						0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,
						1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1,
						2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2, 2,
						3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3, 3,
						4, 4, 4, 4, 4, 4, 4, 4, 4, 4, 4,
						5, 5, 5, 5, 5, 5, 5, 5, 5,
						6, 6, 6, 6, 6, 6, 6,
						7, 7, 7
						],
			aVals : [255, 255, 255,
						255, 255, 255, 255, 255, 255, 127,
						255, 255, 255, 255, 255, 255, 255, 255, 255,
						255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
						255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 127,
						255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
						255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
						255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
						255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
						255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
						255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 127,
						255, 255, 255, 255, 255, 255, 255, 255, 255, 255, 255,
						255, 255, 255, 255, 255, 255, 255, 255, 255,
						255, 255, 255, 255, 255, 255, 127,
						255, 255, 255],
		},
	];


	//	make this class accessible
	rat.graphics.SimpleImageData = SimpleImageData;
	
} );
