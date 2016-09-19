//
//	rat.shapes
//
//	A list of basic shape objects
//
rat.modules.add( "rat.utils.r_shapes",
[
	"rat.math.r_math",
	"rat.math.r_vector",
], 
function(rat)
{
	rat.shapes = {};

	/**
	 * Circle
	 * @constructor
	 * @param {number|Object} x center.x or def object
	 * @param {number=} y center.y 
	 * @param {number=} r radius
	 */
	rat.shapes.Circle = function (x, y, r)
	{
		//	x may also be an object which defines this circle
		var squaredRadius = 0;
		if(x.x !== void 0)
		{
			y = x.y;
			if (x.squaredRadius !== void 0)
				squaredRadius = x.squaredRadius;
			else
				squaredRadius = (x.r * x.r) || 0;
			if( x.r !== void 0 )
				r = x.r;
			else
				r = rat.math.sqrt(squaredRadius);
			x = x.x;
		}
		this.center = { x:x||0, y:y||0 };
		this.radius = r || 0;
		this.squaredRadius = squaredRadius;
	};

	/**
	 * Rect
	 * @constructor
	 * @param {number|Object=} x
	 * @param {number=} y
	 * @param {number=} w
	 * @param {number=} h
	 */
	rat.shapes.Rect = function (x, y, w, h)	//	constructor for Rect
	{
		if(x === void 0) {
			this.x = 0;
			this.y = 0;
			this.w = 0;
			this.h = 0;
		} else if(x.x !== void 0) {
			this.x = x.x;
			this.y = x.y;
			this.w = x.w;
			this.h = x.h;
		} else {
			this.x = x;
			this.y = y;
			this.w = w;
			this.h = h;
		}
	};

	rat.shapes.Rect.prototype.copy = function ()
	{
		var newRect = new rat.shapes.Rect();
		newRect.x = this.x;
		newRect.y = this.y;
		newRect.w = this.w;
		newRect.h = this.h;
		return newRect;
	};
	
	//	expand this rect (position and w,h) to include all of another rect
	rat.shapes.Rect.prototype.expandToInclude = function (r)
	{
		if(r.x < this.x)
			this.x = r.x;
		if(r.y < this.y)
			this.y = r.y;
		if(r.x + r.w > this.x + this.w)
			this.w = r.x + r.w - this.x;
		if(r.y + r.h > this.y + this.h)
			this.h = r.y + r.h - this.y;
	};

	//	Get the center
	rat.shapes.Rect.prototype.getCenter = function (dest)
	{
		dest = dest || new rat.Vector();
		dest.x = this.x + (this.w / 2);
		dest.y = this.y + (this.h / 2);
		return dest;
	};

	//	Calc (and add to this object) my right and bottom values
	rat.shapes.Rect.prototype.calcEdges = function ()
	{
		this.l = this.x;
		this.t = this.y;
		this.r = this.x + this.w;
		this.b = this.y + this.h;
		return this;
	};
	
	
	
	//	Return if the provided point is in this rect (edges included)
	//	Requires CalcEdges to be called first
	rat.shapes.Rect.prototype.isPointInRect = function( x, y )
	{
		if( x.x != void 0 )
		{
			y = x.y;
			x = x.x;
		}
		return x >= this.l && x <= this.r &&
				 y >= this.t && y <= this.b;
	};
} );