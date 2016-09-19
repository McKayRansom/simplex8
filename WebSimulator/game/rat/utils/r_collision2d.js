//
//	Rat 2D Collision math library
// Requires rat.Shapes
//

//------------ rat.collision.2D ----------------
rat.modules.add( "rat.utils.r_collision2d",
[
	"rat.graphics.r_graphics",
	"rat.debug.r_console",
	"rat.math.r_math",
	"rat.utils.r_shapes",
], 
function(rat)
{
	/** Collision module */
	rat.collision2D = {};
	
	/**
	 * Test if a point is in a rectangle
	 * @param {Object} v The vector {x, y}
	 * @param {Object} r The rect {x, y, w, h}
	 * @return {boolean} True if the point is in the rect
	 */
	rat.collision2D.pointInRect = function(/*rat.Vector*/ v, /*rat.shapes.Rect*/ r)
	{
		return !(v.x < r.x || v.y < r.y || v.x > r.x + r.w || v.y > r.y + r.h);
	};
	
	/**
	 * modify this point to keep it in a rectangle space.
	 * Like rat.Vector.prototype.limitToRect, but without a real point or rect object needed
	 */
	rat.collision2D.limitPointToSpace = function (point, x, y, w, h)
	{
		if (point.x < x)
			point.x = x;
		if (point.y < y)
			point.y = y;
		if (point.x > x + w)
			point.x = x + w;
		if (point.y > y + h)
			point.y = y + h;
	};

	/**
	 * Test if two rects collide
	 * @param {Object} r1 a rat rectable object {x,y,w,h}
	 * @param {Object} r2 a rat rectable object {x,y,w,h}
	 * @return {boolean} True if the rects collide
	 */
	rat.collision2D.rectOverlapsRect = function(/*rat.shapes.Rect*/ r1, /*rat.shapes.Rect*/ r2)
	{
		//	It's easier to think of this as "when do two rects not overlap?"  answer:  when one rect is entirely above, left, below, right.
		return !(r1.y + r1.h < r2.y	||	//	r1 is above
				 r1.y > r2.y + r2.h	||	//	r1 is below
				 r1.x + r1.w < r2.x	||	//	r1 is left
				 r1.x > r2.x + r2.w	);	//	r1 is right
	};

	
	/**
	 * Test if two circles collide.  This support offsetting the circles
	 */
	rat.collision2D.circlesCollide_Offset = function (c1, at1, c2, at2)
	{
		if (!c1 || !c2)
			return void 0; // False-ish

		//	Combined radius
		var radii = c1.radius + c2.radius;

		//	distance between the two centers
		var deltaX = (c2.center.x + at2.x) - (c1.center.x + at1.x);
		var deltaY = (c2.center.y + at2.y) - (c1.center.y + at1.y);
		var dist = rat.math.sqrt((deltaX * deltaX) + (deltaY * deltaY));

		//	The collide if the distance is <= the combine radii
		if (dist > radii)
			return void 0; // again, false-ish
		else
			return { dist: dist, radii: radii };
	};

	/**
	 * Test if two circles collide
	 */
	rat.collision2D.circlesCollide = function( c1, c2 )
	{
		if( !c1 || !c2 )
			return void 0; // False-ish
		
		//	Combined radius
		var radii = c1.radius + c2.radius;

		//	distance between the two centers
		var deltaX = (c2.center.x - c1.center.x);
		var deltaY = (c2.center.y - c1.center.y);
		var dist = rat.math.sqrt( (deltaX * deltaX) + (deltaY * deltaY) );

		//	The collide if the distance is <= the combine radii
		if( dist > radii )
			return void 0; // again, false-ish
		else
			return {dist:dist, radii:radii};
	};

	/**
	 * Test if two rects collide.  Supports offset.
	 */
	rat.collision2D.rectsCollide_Offset = function (r1, at1, r2, at2)
	{
		//	It's easier to think of this as "when do two rects not overlap?"
		//	answer:  when one rect is entirely above, left, below, right.
		var r1x = r1.x + at1.x;
		var r1y = r1.y + at1.y;
		var r2x = r2.x + at2.x;
		var r2y = r2.y + at2.y;
		return !(r1y + r1.h < r2y ||	//	r1 is above
				 r1y > r2y + r2.h ||	//	r1 is below
				 r1x + r1.w < r2x ||	//	r1 is left
				 r1x > r2x + r2.w);	//	r1 is right
	};

	/**
	 * Test if two rects collide
	 */
	rat.collision2D.rectsCollide = rat.collision2D.rectOverlapsRect;

	/**
	 * do a circle and a rect collide.  Supports offset
	 */
	rat.collision2D.circlesAndRectCollide_Offset = function (c, cAt, r, rAt)
	{
		/* Based on code in the native engine*/
		var s, d = 0;
		var rr;
		if (c.squaredRadius)
			rr = c.squaredRadius;
		else
			rr = c.radius * c.radius;
		var spherePos = { x: c.center.y + cAt.x, y: c.center.y + cAt.y };
		var boxMin = { x: r.x + rAt.x, y: r.y + rAt.y }; // We only really care about the min here
		var boxMax = { x: boxMin.x + r.w, y: boxMin.y + r.h  };
		// In X?
		if (spherePos.x < boxMin.x)
		{
			s = spherePos.x - boxMin.x;
			d += s * s;
		}
		else if (spherePos.x > boxMax.x)
		{
			s = spherePos.x - boxMax.x;
			d += s * s;
		}

		// In Y?
		if (spherePos.y < boxMin.y)
		{
			s = spherePos.y - boxMin.y;
			d += s * s;
		}
		else if (spherePos.y > boxMax.y)
		{
			s = spherePos.y - boxMax.y;
			d += s * s;
		}

		if (d <= rr)
			return {};
		else
			return void 0;
	};

	/**
	 * do a circle and a rect collide
	 */
	rat.collision2D.circlesAndRectCollide = function (c, r)
	{
		/* Based on code in the native engine*/
		var s, d = 0;
		var rr;
		if (c.squaredRadius)
			rr = c.squaredRadius;
		else
			rr = c.radius * c.radius;
		var spherePos = c.center;
		var boxMin = r; // We only really care about the min here
		var boxMax = { x: r.x + r.w, y: r.y + r.h };
		// In X?
		if (spherePos.x < boxMin.x)
		{
			s = spherePos.x - boxMin.x;
			d += s * s;
		}
		else if (spherePos.x > boxMax.x)
		{
			s = spherePos.x - boxMax.x;
			d += s * s;
		}

		// In Y?
		if (spherePos.y < boxMin.y)
		{
			s = spherePos.y - boxMin.y;
			d += s * s;
		}
		else if (spherePos.y > boxMax.y)
		{
			s = spherePos.y - boxMax.y;
			d += s * s;
		}

		if (d <= rr)
			return {};
		else
			return void 0;
	};

	/**
	 * Test if two shapes collide
	 */
	rat.collision2D.shapesCollide = function (shape1, at1, shape2, at2)
	{
		switch (shape1.type)
		{
			case 'circle':
				switch (shape2.type)
				{
					case 'circle':
						return rat.collision2D.circlesCollide_Offset(shape1, at1, shape2, at2);
					case 'rect':
						return rat.collision2D.circlesAndRectCollide_Offset(shape1, at1, shape2, at2);
					default:
						return void 0;
				}
				break;
			case 'rect':
				switch (shape2.type)
				{
					case 'circle':
						return rat.collision2D.circlesAndRectCollide_Offset(shape2, at2, shape1, at1);
					case 'rect':
						return rat.collision2D.rectsCollide_Offset(shape1, at1, shape2, at2);
					default:
						return void 0;
				}
				break;
			default:
				return void 0;
		}
	};

	/**
	 * Test if a shape collides with a list of shapes
	 */
	rat.collision2D.shapeAndShapeListCollide = function (shape, shapeAt, list, listAt)
	{
		var res;
		var child;
		var iHaveChildren = shape.children && shape.children.length;
		var childHasChildren;
		for (var childIndex = 0, len = list.length; childIndex !== len; ++childIndex)
		{
			//	Do i collide with this child
			child = list[childIndex];
			res = rat.collision2D.shapesCollide(shape, shapeAt, child, listAt);

			//	Did i collide?
			if( res )
			{
				childHasChildren = child.children && child.children.length;
				//	If i have no children, AND child has no children
				//	The this is a collision
				if ( !iHaveChildren && !childHasChildren )
					return res;

				//	If I have children, and he does not, then He needs to be compared vs my children
				if (iHaveChildren && !childHasChildren)
				{
					res = rat.collision2D.shapeAndShapeListCollide(child, listAt, shape.children, shapeAt);
					//	He hit my leaf node
					//	collision because he is also a leaf
					if (res)
						return res;
				}
				else
				{
					//	Test me vs. the childs children
					//	This tells me that I collide with a leaf node.
					res = rat.collision2D.shapeAndShapeListCollide(shape, shapeAt, child.children, listAt);

					// Did I hit a leaf node?
					if (res)
					{
						//	IF I do collide with a leaf node, and I have no children, then I collide
						if (!iHaveChildren)
							return res;

						//	Check my children vs the childs children
						res = rat.collision2D.shapeListsCollide(shape.children, shapeAt, child.children, listAt);
						//	Did one of my leaf nodes collide with one of their leaf nodes
						if (res)
							return res;
					}
				}
			}
		}

		//	Must not have collided
		return void 0;
	};

	/**
	 * Test if two lists of shape objects collide
	 */
	rat.collision2D.shapeListsCollide = function (list1, at1, list2, at2)
	{
		var res;
		for (var childIndex = 0, len = list1.length; childIndex !== len; ++childIndex)
		{
			// A^x -> B^n
			res = rat.collision2D.shapeAndShapeListCollide(list1[childIndex], at1, list2, at2);

			//	They collided!
			if (res)
				return res;
		}

		//	Must not have collided
		return void 0;
	};

	/**
	 * Test if two bounding shapes collide
	 */
	rat.collision2D.BoundingShapesCollide = function(shape1, at1, shape2, at2)
	{
		//	Only continue if their two circles collide
		var collided = rat.collision2D.circlesCollide_Offset(shape1.mBounding, at1, shape2.mBounding, at2 );
		if( !collided )
			return collided;

		//	Test shapes for collision
		//	Shape list vs shape list
		// A^n -> B^n
		return rat.collision2D.shapeListsCollide(shape1.mShapes, at1, shape2.mShapes, at2);
	};
	
	// This portion of the collision2D system requires rat.shapes
	/**
	 * Hidden function used to create a shape from a data structure. used by BoundingShape
	 */
	function CreateShape(data, limits)
	{
		//	Create the correct object
		var newShape;
		switch(data.type)
		{
			case 'circle': // Fall through
			case 'Circle':
			{
				newShape = new rat.shapes.Circle(data);
				newShape.type = 'circle';
				var c  = newShape.center;
				var r = newShape.radius;
				if (limits.left === void 0 || limits.left > c.x - r)
					limits.left = c.x - r;
				if (limits.right === void 0 || limits.right < c.x + r)
					limits.right = c.x + r;
				if (limits.top === void 0 || limits.top > c.y - r)
					limits.top = c.y - r;
				if (limits.bottom === void 0 || limits.bottom < c.y + r)
					limits.bottom = c.y + r;
				break;
			}

			case 'rect': // Fall through
			case 'Rect': // Fall through
			case 'box': // Fall through
			case 'box':
			{
				newShape = new rat.shapes.Rect(data);
				newShape.type = 'rect';
				if (limits.left === void 0 || limits.left > newShape.x)
					limits.left = newShape.x;
				if (limits.right === void 0 || limits.right < newShape.x + newShape.w)
					limits.right = newShape.x + newShape.w;
				if (limits.top === void 0 || limits.top > newShape.y)
					limits.top = newShape.y;
				if (limits.bottom === void 0 || limits.bottom < newShape.y + newShape.h)
					limits.bottom = newShape.y + newShape.h;
				break;
			}

			default:
				rat.console.log("ERROR: Un-supported shape found in bounding shape data: " + data.type);
				return void 0;
		}

		//	Make sure that the shape has its type.
		newShape.type = data.type;

		if (data.name)
			newShape.name = data.name;

		//	Create this shape's children
		newShape.children = [];
		if(data.children)
		{
			for(var index = 0, len = data.children.length; index !== len; ++index)
			{
				newShape.children.push(CreateShape(data.children[index], limits));
			}
		}

		//	return the created shape (and its children)
		return newShape;
	}

	/**
		* Type data structure layout defines a bounding shape (with the options of shape groups)
		* @constructor
		* @param {Array} data
		* The layout of data is [
		* <{
		*		type: 'circle',
		*		x:,
		*		y:,
		*		radius:,
		*		<inDegrees:>,
		*		children:[ <subshapes of either circle or rect> ]
		* }>
		* <{
		*		type: 'rect',
		*		x:,
		*		y:,
		*		w:,
		*		h:,
		*		children:[ <subshapes of either circle or rect> ]
		* }>
		* ]
		*/
	rat.collision2D.BoundingShape = function (data)
	{
		//	Process default to array
		if(Array.isArray(data) === false)
			data = [data];

		this.mLimits = {
			left: void 0,
			right: void 0,
			top: void 0,
			bottom: void 0
		};

		//	Create my shapes
		//	Get the extends of the shapes here.

		this.mShapes = [];
		for(var index = 0, len = data.length; index !== len; ++index)
			this.mShapes.push(CreateShape(data[index], this.mLimits));

		//	Sanity on the limits
		this.mLimits.left = this.mLimits.left || 0;
		this.mLimits.right = this.mLimits.right || 0;
		this.mLimits.top = this.mLimits.top || 0;
		this.mLimits.bottom = this.mLimits.bottom || 0;

		//	What is a wrapper size
		this.mSize = {
			x: this.mLimits.right - this.mLimits.left,
			y: this.mLimits.bottom - this.mLimits.top,
		};

		//	extract calculations
		var halfSize = {
			x: this.mSize.x/2,
			y: this.mSize.y/2
		};

		//	What is our bounding circle
		this.mBounding = new rat.shapes.Circle({
			x: this.mLimits.left + halfSize.x,
			y: this.mLimits.top + halfSize.y,
			squaredRadius: (halfSize.x * halfSize.x) + (halfSize.y * halfSize.y),
		});
	};

	/**
	 * Draw this bounding shape.
	 * @param {Object} at
	 * @param {Object} boundingColor
	 * @param {Object} shapesColor
	 */
	rat.collision2D.BoundingShape.prototype.debugDraw = function (at, boundingColor, shapesColor)
	{
		rat.graphics.save();
		var ctx = rat.graphics.ctx;
		var colorString = boundingColor.toString();
		ctx.strokeStyle = colorString;
		ctx.lineWidth = 1;
		rat.graphics.translate(at.x, at.y);

		//	Draw the bounding rectangle.
		var limits = this.mLimits;
		var size = this.mSize;
		rat.graphics.ctx.strokeRect(limits.left, limits.top, size.x, size.y);

		//	Draw the bounding circle
		rat.graphics.drawCircle(this.mBounding);

		colorString = shapesColor.toString();
		ctx.strokeStyle = colorString;

		//	Draw the shape list
		rat.graphics.drawShapeList(this.mShapes);

		rat.graphics.restore();
	};
	
			
	//
	//	Find the distance from this point to this line.
	//	If the nearest point is within the segment given, give the point where it is closest, and return true.
	//	If the nearest point is NOT on the segment given, still give the point where it's closest, but return false.
	//	(either way, return distance)
	//
	//	This code is adapted from another adaptation of an approach by Damian Coventry:
	//	http://astronomy.swin.edu.au/~pbourke/geometry/pointline/
	//	http://astronomy.swin.edu.au/~pbourke/geometry/pointline/source.c
	//
	//	NOTE: UNTESTED CODE!  I ported this and then decided not to use it.
	rat.collision2D.pointToLine = function(point, lineA, lineB) {
		var res = {onLine : false};
		
		var dx = lineA.x - lineB.x;
		var dy = lineA.y - lineB.y;
		var lenSq = dx*dx+dy*dy;

		var u = ( ( ( point.x - lineA.x ) * ( lineB.x - lineA.x ) ) +
			( ( point.y - lineA.y ) * ( lineB.y - lineA.y ) ) ) /
			( lenSq );

		var intersection = {};
		intersection.x = lineA.x + u * ( lineB.x - lineA.x );
		intersection.y = lineA.y + u * ( lineB.y - lineA.y );
		res.closePoint = intersection;

		var idx = point.x - intersection.x;
		var idy = point.y - intersection.y;
		res.distanceSquared = idx*idx+idy*idy;
		
		res.onLine = (u >= 0.0 && u <= 1.0);
		
		return res;
	};
	
} );