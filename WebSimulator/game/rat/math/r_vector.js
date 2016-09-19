///
///	A collection of geometry-related classes and functions
///
///------------ rat.Vector ----------------
rat.modules.add("rat.math.r_vector",
[
	{ name: "rat.math.r_math", processBefore: true },
],
function (rat)
{
	//var math = rat.math;

	///
	/// standard 2D Vector
	/// @constructor
	/// @param {number|Object=} x rat.Vector
	/// @param {number=} y
	///
	rat.Vector = function (x, y)
	{
		if (x !== void 0 && x.x !== void 0)
		{
			y = x.y;
			x = x.x;
		}
		this.x = x || 0;
		this.y = y || 0;
	};

	///
	/// Makes a copy of this vector and returns it
	/// @return {Object} newVec rat.Vector
	///
	rat.Vector.prototype.copy = function ()
	{
		var newVec = new rat.Vector();
		newVec.x = this.x;
		newVec.y = this.y;
		return newVec;
	};

	/// 
	/// Sets a vector equal to another vector, or to param x, y values 
	/// @param {Object|number} x rat.Vector
	/// @param {number=} y 
	///
	rat.Vector.prototype.set = function (x, y)
	{
		// Paul wants this to say that this duplicates the copyFrom behavior
		if (x.x !== void 0)
		{
			y = x.y;
			x = x.x;
		}
		this.x = x;
		this.y = y;
	};

	///
	/// Sets this vector to be the same as the input vector
	/// @param {Object} vec rat.Vector
	///
	rat.Vector.prototype.copyFrom = function (vec)
	{
		this.x = vec.x;
		this.y = vec.y;
	};

	///
	/// Returns the length of the vector
	/// @return {number} length
	///
	rat.Vector.prototype.length = function ()
	{
		return rat.math.sqrt(this.x * this.x + this.y * this.y);
	};

	///
	/// Returns the the length of the vector squared
	/// @return {number} length_squared
	///
	rat.Vector.prototype.lengthSq = function ()
	{
		return this.x * this.x + this.y * this.y;
	};

	///
	/// Returns the distance squared from this vector to another
	/// @param {Object} v rat.Vector
	/// @return {number} distance_squared
	///
	rat.Vector.prototype.distanceSqFrom = function (v)
	{
		var dx = v.x - this.x;
		var dy = v.y - this.y;
		return dx * dx + dy * dy;
	};

	///
	/// Returns the distance from this vector to another
	/// @param {Object} v rat.Vector
	/// @return {number} distance
	///
	rat.Vector.prototype.distanceFrom = function (v)
	{
		return rat.math.sqrt(this.distanceSqFrom(v));
	};

	///
	/// Get a delta vector from this to v
	/// @param {Object} v rat.Vector
	/// @param {Object=} dest rat.Vector
	/// @return {Object} delta rat.Vector
	///
	rat.Vector.prototype.deltaTo = function (v, dest)
	{
		dest = dest || new rat.Vector();
		dest.set(v.x - this.x, v.y - this.y);
		return dest;
	};

	///
	/// Normalizes the vector (Scales to 1)
	///
	rat.Vector.prototype.normalize = function ()
	{
		var mag = this.length();
		this.x /= mag;
		this.y /= mag;
	};

	///
	/// Multiplies the vector by a constant scaler
	/// @param {number} newScale
	///
	rat.Vector.prototype.scale = function (newScale)
	{
		this.x *= newScale;
		this.y *= newScale;
	};

	///
	/// Scales the vector to be a specific length
	/// @param {number} newLength
	///
	rat.Vector.prototype.setLength = function (newLength)
	{
		this.normalize();
		this.scale(newLength);
	};

	///
	/// Adds another vector to this one
	/// @param {Object} vec rat.Vector
	///
	rat.Vector.prototype.add = function (vec)
	{
		this.x += vec.x;
		this.y += vec.y;
	};

	///
	/// Multiplies vec by scale and adds it to this vector
	/// @param {Object} vec rat.Vector
	/// @param {number} scale
	///
	rat.Vector.prototype.addScaled = function (vec, scale)
	{
		this.x += vec.x * scale;
		this.y += vec.y * scale;
	};

	///
	/// Subtracts another vector to this one
	/// @param {Object} vec rat.Vector
	///
	rat.Vector.prototype.subtract = function (vec)
	{
		this.x -= vec.x;
		this.y -= vec.y;
	};

	///
	/// Sets a vector from an angle (in radians)
	///	NOTE:  this assumes a default vector of x=1,y=0
	/// @param {number} angle
	///
	rat.Vector.prototype.setFromAngle = function (angle)
	{
		var cos = rat.math.cos(angle);
		var sin = rat.math.sin(angle);

		this.x = cos;
		this.y = sin;
	};

	///
	/// Returns the dot product of two vectors
	/// @param {Object} a rat.Vector
	/// @param {Object} b rat.Vector
	/// @return {number} dotProduct
	///
	rat.Vector.dot = function (a, b)
	{
		return a.x * b.x + a.y * b.y;
	};

	///
	/// Returns the cross product of two vectors
	/// @param {Object} a rat.Vector
	/// @param {Object} b rat.Vector
	/// @return {number} crossProduct
	///
	rat.Vector.cross = function (a, b)
	{
		// In 2d, the cross product is just a value in Z, so return that value.
		return (a.x * b.y) - (a.y * b.x);
	};

	///
	/// Build a string that display this vectors values
	/// @return {string} vector rat.Vector
	///
	rat.Vector.prototype.toString = function ()
	{
		return "(" + this.x + ", " + this.y + ")";
	};

	///
	/// Clips vector to fit within a rectangle
	/// @param {Object} r rat.shapes.Rect 
	///
	rat.Vector.prototype.limitToRect = function (/*rat.shapes.Rect*/ r)
	{
		if (this.x < r.x)
			this.x = r.x;
		if (this.y < r.y)
			this.y = r.y;
		if (this.x > r.x + r.w)
			this.x = r.x + r.w;
		if (this.y > r.y + r.h)
			this.y = r.y + r.h;
	};

	///---------------- rat.Angle ---------------------
	///	I know, we're just tracking a single value here, why is this a class?
	///	1. so we can assign references to it, and multiple objects can have a single changing value to share
	///	2. for ease in performing custom operations on the object, like conversions and math

	///
	/// @constructor
	/// @param {number|Object=} angle rat.Angle
	///
	rat.Angle = function (angle)
	{
		this.angle = angle || 0;
	};

	///
	/// Returns a copy of this angle
	/// @return {Object} angle rat.Angle
	///
	rat.Angle.prototype.copy = function ()
	{
		var newAngle = new rat.Angle();
		newAngle.angle = this.angle;
		return newAngle;
	};

	///
	///	set angle from vector.  This means a 0 angle correlates with a vector to the right
	/// @param {Object} v rat.Vector
	/// @return {Object} angle rat.Vector
	///
	rat.Angle.prototype.setFromVector = function (/*rat.Vector*/ v)
	{
		this.angle = rat.math.atan2(v.y, v.x);
		return this;
	};

	///
	///	set an angle facing from source to target
	/// @param {Object} source rat.Vector
	/// @param {Object} target rat.Vector
	/// @return {Object} this rat.Angle
	///
	rat.Angle.prototype.setFromSourceTarget = function (/*rat.Vector*/ source, /*rat.Vector*/ target)
	{
		this.angle = rat.math.atan2(target.y - source.y, target.x - source.x);
		return this;
	};

	///
	/// Rotate the provided vector, in place by this angle
	/// @param {Object} v rat.Vector
	/// @return {Object} v rat.Vector
	///
	rat.Angle.prototype.rotateVectorInPlace = function (/*rat.Vector*/ v)
	{
		var cos = rat.math.cos(this.angle);
		var sin = rat.math.sin(this.angle);
		var x = v.x * cos - v.y * sin;
		var y = v.x * sin + v.y * cos;
		v.x = x;
		v.y = y;
		return v;
	};

	///
	/// Returns a vector rotated by this angle
	/// @param {Object} v rat.Vector
	/// @param {Object=} dest rat.Vector
	/// @return {Object} dest rat.Vector
	///
	rat.Angle.prototype.rotateVector = function (/*rat.Vector*/ v, /*rat.Vector*/dest)
	{
		if (dest)
		{
			dest.x = v.x;
			dest.y = v.y;
		}
		else
			dest = new rat.Vector(v);
		return this.rotateVectorInPlace(dest);
	};

	///------ rat.Position --------------
	///	utility:  combine position and angle for a single object, for convenience.
	///	I'm not super comfortable with this name, since it's not clear why a "position" has an angle...
	///	Would love a better name, but don't have one.  What word means "position and orientation"?  Place?  Location?
	///	We do use Place in other places.  At least one example online uses "Position" http://www.cs.sbu.edu/roboticslab/Simulator/kRobotWebPage/doc/Position.html
	///	Also, maybe should just reimplement all the above, and track x,y,angle instead of breaking them up?
	///	or store them both ways somehow?  could be unnecessary overhead for that.
	///	Another idea - just push all this functionality into Vector, but add 'angle' to vector on the fly...?

	///
	/// Constructor for position
	/// @constructor
	/// @param {number} x
	/// @param {number} y
	/// @param {number|Object} angle rat.Angle 
	///
	rat.Position = function (x, y, angle)
	{
		this.pos = new rat.Vector(x, y);
		this.rot = new rat.Angle(angle);
	};
});