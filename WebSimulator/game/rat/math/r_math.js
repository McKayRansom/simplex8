//
//	Rat Math library
//

//------------ rat.math ----------------

///
/// Basic math functions.  Wrapper around the gobal Math object.
///
rat.modules.add("rat.math.r_math",
[],
function (rat)
{
	///
	/// Namespace for math functions
	/// @namespace
	///
	rat.math = {};

	// Some constants

	/// @const 
	rat.math.PI = Math.PI;
	/// @const 
	rat.math.PI2 = Math.PI * 2.0;
	/// @const 
	rat.math.HALFPI = Math.PI / 2.0;
	/// @const 
	rat.math.E = Math.E;
	/// @const 
	rat.math.MAX_NUMBER = Number.MAX_VALUE;
	/// @const 
	rat.math.MIN_NUMBER = Number.MIN_VALUE;
	/// @const 
	rat.math.DegreesToRadians = rat.math.PI / 180.0;
	rat.math.RadiansToDegrees = 180.0 / rat.math.PI;

	// Basic functions that we get from the built in math library
	rat.math.abs = Math.abs;
	rat.math.min = Math.min;
	rat.math.max = Math.max;
	rat.math.ceil = Math.ceil;
	rat.math.floor = Math.floor;
	rat.math.round = Math.round;

	rat.math.cos = Math.cos;
	rat.math.sin = Math.sin;
	rat.math.tan = Math.tan;
	rat.math.acos = Math.acos;
	rat.math.asin = Math.asin;
	rat.math.atan = Math.atan;
	rat.math.atan2 = Math.atan2;

	rat.math.random = Math.random;
	rat.math.sqrt = Math.sqrt;
	rat.math.log = Math.log;
	rat.math.exp = Math.exp;
	rat.math.pow = Math.pow;

	///
	/// random value min >= value >= max
	///
	rat.math.randomRange = function(min, max)
	{
		return (rat.math.random() * (max-min)) + min;
	};
	
	///
	/// Clamps to make sure that low <= a <= high
	/// @param {number} a the given value
	/// @param {number} low the low clamp level
	/// @param {number} high the high clamp level
	/// @return {number} a the clamped value
	///
	rat.math.clamp = function (a, low, high)
	{
		if (a < low)
			return low;
		else if (a > high)
			return high;
		return a;
	};

	///
	/// Interpolate between two numbers
	/// interp = 0 -> valA | interp = 1 -> valB
	/// @param {number} valA 
	/// @param {number} valB 
	/// @param {number} interp 0.0 - 1.0 
	/// @return {number} [valA, valB]
	///
	rat.math.interp = function (valA, valB, interp)
	{
		return valB * interp + valA * (1.0 - interp);
	};

	///
	/// Get the sign of a number
	/// @param {number} num
	/// @return {number} sign -1, 0, 1
	///
	rat.math.signOf = function (num)
	{
		return (num > 0) ? 1 : ((num < 1) ? -1 : 0);
	};

	///
	/// Return a variance of +- v
	/// @param {number} v
	/// @returns {number} [-v, v]
	///
	rat.math.randomVariance = function (v)
	{
		if (!v)
			return 0;
		return v * 2 * rat.math.random() - v;
	};

	///
	/// Finds the center of a circle.
	/// @param {number} x1 x-coordinate of a point on the circle.
	/// @param {number} y1 y-coordinate of a point on the circle.
	/// @param {number} x2 x-coordinate of the other point on the circle.
	/// @param {number} y2 y-coordinate of the other point on the circle.
	/// @param {number} radius of the circle.
	/// @param {?number} centerDirectionX The desired direction of the center on the x-axis. Defaults to 1.
	/// @param {?number} centerDirectionY The desired direction of the center on the y-axis. Defaults to 1.
	/// @return {{x:number, y:number}} The point of the circle's center.
	///
	rat.math.findCircleCenterFromTwoPoints = function (x1, y1, x2, y2, radius, centerDirectionX, centerDirectionY)
	{
		// Find the center of the circle.
		// Based on the formula at: http://mathforum.org/library/drmath/view/53027.html
		var dx = x2 - x1;
		var dy = y2 - y1;
		var lineSegmentDistance = Math.sqrt(dx * dx + dy * dy);
		var midX = (x2 + x1) * 0.5;
		var midY = (y2 + y1) * 0.5;
		var distanceFromMidpoint = Math.sqrt(radius * radius - lineSegmentDistance * lineSegmentDistance * 0.25);

		// Figure out how we want to treat the signs based on the desired direction we want it to be in.
		// First, consider the center in the direction of <dy, -dx>.
		// The dot product with the desired direction is positive if they are both in the same general direction.
		var perpendicularDx = dy;
		var perpendicularDy = -dx;
		var dotProductCenterDirection = perpendicularDx * centerDirectionX - perpendicularDy * centerDirectionY;
		if (dotProductCenterDirection < 0)
		{
			perpendicularDx = -dy;
			perpendicularDy = dx;
		}

		var centerX = midX + distanceFromMidpoint * perpendicularDx / lineSegmentDistance;
		var centerY = midY + distanceFromMidpoint * perpendicularDy / lineSegmentDistance;
		return { x: centerX, y: centerY };
	};

	///
	/// Finds the center of a circle.
	/// @param {number} x x-coordinate of a point on the circle.
	/// @param {number} y y-coordinate of a point on the circle.
	/// @param {number} centerX x-coordinate of the circle's center.
	/// @param {number} centerY y-coordinate of the circle's center.
	/// @return {number} The angle of the circle from the x-axis in radians.
	///
	rat.math.findAngleOnCircle = function (x, y, centerX, centerY)
	{
		var offsetX = x - centerX;
		var offsetY = y - centerY;
		return rat.math.atan2(offsetY, offsetX);
	};

	///
	/// Finds the arc which passes through two points.
	/// @param {number} x1 x-coordinate of a point on the circle.
	/// @param {number} y1 y-coordinate of a point on the circle.
	/// @param {number} x2 x-coordinate of the other point on the circle.
	/// @param {number} y2 y-coordinate of the other point on the circle.
	/// @param {number} centerX  x-coordinate of the circle's center.
	/// @param {number} centerY  y-coordinate of the circle's center.
	/// @param {number} radius of the circle.
	/// @return {{type:string, center:{x:number, y:number}, radius:number, startAngle:number, endAngle:number, anticlockwise:boolean}} Represents the arc.
	///
	rat.math.findArcOnCircle = function (x1, y1, x2, y2, centerX, centerY, radius)
	{
		// Find if the arc goes clockwise or anticlockwise.
		// Check the z-coordinates of the cross product of p1 to center and p1 to p2.
		var anticlockwise = (centerX - x1) * (y2 - y1) - (centerY - y1) * (y2 - x1) > 0;

		var startAngle = rat.math.findAngleOnCircle(x1, y1, centerX, centerY);
		var endAngle = rat.math.findAngleOnCircle(x2, y2, centerX, centerY);

		return {
			type: "arc",
			center: { x: centerX, y: centerY },
			radius: radius,
			startAngle: startAngle,
			endAngle: endAngle,
			anticlockwise: anticlockwise
		};
	};

	///
	/// Finds the arc which passes through two points.
	/// @param {number} x1 x-coordinate of a point on the circle.
	/// @param {number} y1 y-coordinate of a point on the circle.
	/// @param {number} x2 x-coordinate of the other point on the circle.
	/// @param {number} y2 y-coordinate of the other point on the circle.
	/// @param {number} radius of the circle.
	/// @param {?number} centerDirectionX The desired direction of the center on the x-axis. Defaults to 1.
	/// @param {?number} centerDirectionY The desired direction of the center on the y-axis. Defaults to 1.
	/// @return {{center:{x:number, y:number}, radius:number, startAngle:number, endAngle:number, anticlockwise:boolean}} Represents the arc.
	///
	rat.math.findArcFromTwoPoints = function (x1, y1, x2, y2, radius, centerDirectionX, centerDirectionY)
	{
		var center = rat.math.findCircleCenterFromTwoPoints(x1, y1, x2, y2, radius, centerDirectionX, centerDirectionY);
		return rat.math.findArcOnCircle(x1, y1, x2, y2, center.x, center.y, radius);
	};

	///
	/// Finds the perpendicular bisector of two points.
	/// @param {number} x1 x-coordinate of point 1 on the circle.
	/// @param {number} y1 y-coordinate of point 1 on the circle.
	/// @param {number} x2 x-coordinate of point 2 on the circle.
	/// @param {number} y2 y-coordinate of point 2 on the circle.
	/// @return {{a:number, b:number, c:number}} the perpendicular bisector in the form of ax+by=c.
	///
	rat.math.findPerpendicularBisector = function (x1, y1, x2, y2)
	{
		var dx = x2 - x1;
		var dy = y2 - y1;
		var midX = (x2 + x1) * 0.5;
		var midY = (y2 + y1) * 0.5;

		if (dy === 0)
			// The perpendicular bisector is vertical.
			return { a: 1, b: 0, c: midX };

		var slope = -dx / dy;// perpendicular slope
		return { a: -slope, b: 1, c: -slope * midX + midY };
	};

	///
	/// Finds the center of a circle.
	/// @param {number} x1 x-coordinate of point 1 on the circle.
	/// @param {number} y1 y-coordinate of point 1 on the circle.
	/// @param {number} x2 x-coordinate of point 2 on the circle.
	/// @param {number} y2 y-coordinate of point 2 on the circle.
	/// @param {number} x3 x-coordinate of point 3 on the circle.
	/// @param {number} y3 y-coordinate of point 3 on the circle.
	/// @return {{center:{x:number, y:number}, radius:number}|boolean} The point of the circle's center or false if the points are a strait line.
	///
	rat.math.findCircleFromThreePoints = function (x1, y1, x2, y2, x3, y3)
	{
		// The center of the circle is at the intersection of the perpendicular bisectors.
		var line1 = rat.math.findPerpendicularBisector(x1, y1, x2, y2);
		var line2 = rat.math.findPerpendicularBisector(x1, y1, x3, y3);

		// Use line1 and line2 to eliminate y.
		var line3 = void 0;
		if (line1.b === 0)
			line3 = line1;
		else if (line2.b === 0)
			line3 = line2;
		else
		{
			// Eliminate y
			var lineBScalar = -line1.b / line2.b;
			line3 = {
				a: line1.a + line2.a * lineBScalar,
				//b: line1.b + line2.b * lineBScalar, // b should be zero.
				c: line1.c + line2.c * lineBScalar,
			};
		}
		if (line3.a === 0)
			// x was eliminated with y, so the lines must be parallel.
			return false;

		var x = line3.c / line3.a;
		var y = (line1.b !== 0) ? // Solve for y in the equation with y
		(line1.c - line1.a * x) / line1.b :
			(line2.c - line2.a * x) / line2.b;

		// Find the radius
		var dx = x1 - x;
		var dy = y1 - y;
		var radius = rat.math.sqrt(dx * dx + dy * dy);

		return {
			center: { x: x, y: y },
			radius: radius
		};
	};

	///
	/// Finds the arc which passes through three points. The ends are at point 1 and point 3.
	/// @param {number} x1 x-coordinate of point 1 on the circle.
	/// @param {number} y1 y-coordinate of point 1 on the circle.
	/// @param {number} x2 x-coordinate of point 2 on the circle.
	/// @param {number} y2 y-coordinate of point 2 on the circle.
	/// @param {number} x3 x-coordinate of point 3 on the circle.
	/// @param {number} y3 y-coordinate of point 3 on the circle.
	/// @return {{type:string, center:{x:number, y:number}, radius:number, startAngle:number, endAngle:number, anticlockwise:boolean}|{type:string, point1:{x:number, y:number},point2:{x:number, y:number}}} Represents the arc or strait line if the three points line up.
	///
	rat.math.findArcFromThreePoints = function (x1, y1, x2, y2, x3, y3)
	{
		var circle = rat.math.findCircleFromThreePoints(x1, y1, x2, y2, x3, y3);
		if (!circle)
			return {
				type: "seg",
				point1: { x: x1, y: y1 },
				point2: { x: x3, y: y3 },
			};
		return rat.math.findArcOnCircle(x1, y1, x3, y3, circle.center.x, circle.center.y, circle.radius);
	};
});