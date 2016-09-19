//
//	A collection of matrix-related classes and functions
//

//------------ rat.Matrix ----------------
rat.modules.add("rat.math.r_matrix",
[
	{ name: "rat.math.r_math", processBefore: true },
],
function (rat)
{
	var math = rat.math;

	//	Avoid creating temporary array objects
	var tm = [[], [], []]; // This only works because we cannot have to executing code paths in this function
	///
	/// Constructor for Matrix 
	/// @constructor
	/// @param {?} m Setup with this matrix.  Otherwise, ident 
	///
	rat.Matrix = function (m)	//	constructor for Matrix..  Not defined
	{
		this.m = [[], [], []];
		//	Don't just point at was was passed in
		if (m && m.m)
			this.set(m.m);
		else if (m)
			this.set(m);
		else
			this.loadIdent();
	};

	///
	/// Set this matrix to identity
	///
	rat.Matrix.prototype.loadIdent = function ()
	{
		//	Just replace the matrix
		this.m[0][0] = 1; this.m[0][1] = 0; this.m[0][2] = 0;
		this.m[1][0] = 0; this.m[1][1] = 1; this.m[1][2] = 0;
		this.m[2][0] = 0; this.m[2][1] = 0; this.m[2][2] = 1;
	};

	///
	/// transform this matrix
	/// @param {number} x
	/// @param {number} y
	///
	rat.Matrix.prototype.translateSelf = function (x, y)
	{
		var m1 = this.m;
		m1[0][2] = (m1[0][0] * x) + (m1[0][1] * y) + m1[0][2];
		m1[1][2] = (m1[1][0] * x) + (m1[1][1] * y) + m1[1][2];
		m1[2][2] = (m1[2][0] * x) + (m1[2][1] * y) + m1[2][2];

	};

	///
	/// rotate this matrix
	/// @param {number} r
	///
	rat.Matrix.prototype.rotateSelf = function (r)
	{
		var cos = math.cos(r);
		var sin = math.sin(r);
		var nsin = -sin;
		var m1 = this.m;
		//var m = [[cos, -sin, 0],
		//	     [sin, cos, 0],
		//		 [0, 0, 1]];
		var m00 = (m1[0][0] * cos) + (m1[0][1] * sin);
		var m01 = (m1[0][0] * nsin) + (m1[0][1] * cos);
		//m1[0][2] = m1[0][2];
		var m10 = (m1[1][0] * cos) + (m1[1][1] * sin);
		var m11 = (m1[1][0] * nsin) + (m1[1][1] * cos);
		//m1[1][2] = m1[1][2];
		var m20 = (m1[2][0] * cos) + (m1[2][1] * sin);
		var m21 = (m1[2][0] * nsin) + (m1[2][1] * cos);
		//m1[2][2] = m1[2][2];
		m1[0][0] = m00;
		m1[0][1] = m01;
		m1[1][0] = m10;
		m1[1][1] = m11;
		m1[2][0] = m20;
		m1[2][1] = m21;
	};

	///
	/// Scale this matrix
	/// @param {number} x
	/// @param {number} y
	///
	rat.Matrix.prototype.scaleSelf = function (x, y)
	{
		var m1 = this.m;
		m1[0][0] = (m1[0][0] * x);
		m1[0][1] = (m1[0][1] * y);
		//m1[0][2] = m1[0][2];
		m1[1][0] = (m1[1][0] * x);
		m1[1][1] = (m1[1][1] * y);
		//m1[1][2] = m1[1][2];
		m1[2][0] = (m1[2][0] * x);
		m1[2][1] = (m1[2][1] * y);
		//m1[2][2] = m1[2][2];
	};


	///
	/// Multiply this matrix with another
	/// @param {Object} m2 matrix to multiply with
	///
	rat.Matrix.prototype.multSelf = function (m2)
	{
		if (m2.m)
			m2 = m2.m;
		var m1 = this.m;
		tm[0][0] = (m1[0][0] * m2[0][0]) + (m1[0][1] * m2[1][0]) + (m1[0][2] * m2[2][0]);
		tm[0][1] = (m1[0][0] * m2[0][1]) + (m1[0][1] * m2[1][1]) + (m1[0][2] * m2[2][1]);
		tm[0][2] = (m1[0][0] * m2[0][2]) + (m1[0][1] * m2[1][2]) + (m1[0][2] * m2[2][2]);
		tm[1][0] = (m1[1][0] * m2[0][0]) + (m1[1][1] * m2[1][0]) + (m1[1][2] * m2[2][0]);
		tm[1][1] = (m1[1][0] * m2[0][1]) + (m1[1][1] * m2[1][1]) + (m1[1][2] * m2[2][1]);
		tm[1][2] = (m1[1][0] * m2[0][2]) + (m1[1][1] * m2[1][2]) + (m1[1][2] * m2[2][2]);
		tm[2][0] = (m1[2][0] * m2[0][0]) + (m1[2][1] * m2[1][0]) + (m1[2][2] * m2[2][0]);
		tm[2][1] = (m1[2][0] * m2[0][1]) + (m1[2][1] * m2[1][1]) + (m1[2][2] * m2[2][1]);
		tm[2][2] = (m1[2][0] * m2[0][2]) + (m1[2][1] * m2[1][2]) + (m1[2][2] * m2[2][2]);

		// just replace the matrix
		var old = this.m;
		this.m = tm;
		tm = old;
	};

	///
	/// Get the inverse of matrix (in place)
	/// @return {bool} inverted Whether or not the inverse could be taken
	///
	rat.Matrix.prototype.inverseSelf = function ()
	{
		var m = this.m;
		//a1*b2*c3 - a1*b3*c2 - a2*b1*c3 + a2*b3*c1 + a3*b1*c2 - a3*b2*c1
		var d = (m[0][0] * m[1][1] * m[2][2]) - //a1*b2*c3 -
		(m[0][0] * m[1][2] * m[2][1]) - //a1*b3*c2 -
		(m[0][1] * m[1][0] * m[2][2]) + //a2*b1*c3 +
		(m[0][1] * m[1][2] * m[2][0]) + //a2*b3*c1 +
		(m[0][2] * m[1][0] * m[2][1]) - //a3*b1*c2 -
		(m[0][2] * m[1][1] * m[2][0]);  //a3*b2*c1
		if (d === 0)
			return false; // Cannot get the inverse

		//2X2 determinant
		//	a b 
		//	c d
		//	ad - bc

		var inv_d = 1 / d;
		tm[0][0] = inv_d * (m[1][1] * m[2][2] - m[1][2] * m[2][1]);
		tm[0][1] = inv_d * (m[0][2] * m[2][1] - m[0][1] * m[2][2]);
		tm[0][2] = inv_d * (m[0][1] * m[1][2] - m[0][2] * m[1][1]);
		tm[1][0] = inv_d * (m[1][2] * m[2][0] - m[1][0] * m[2][2]);
		tm[1][1] = inv_d * (m[0][0] * m[2][2] - m[0][2] * m[2][0]);
		tm[1][2] = inv_d * (m[0][2] * m[1][0] - m[0][0] * m[1][2]);
		tm[2][0] = inv_d * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
		tm[2][1] = inv_d * (m[0][1] * m[2][0] - m[0][0] * m[2][1]);
		tm[2][2] = inv_d * (m[0][0] * m[1][1] - m[0][1] * m[1][0]);

		var old = this.m;
		this.m = tm;
		tm = old;
		return true;
	};

	///
	/// Set this matrix with an array of arrays
	/// @param {?} m become this matrix
	///
	rat.Matrix.prototype.set = function (m)
	{
		if (m.m)
			m = m.m;
		//	Manual copy to avoid pointing to the matrix passed
		var self = this.m;
		self[0][0] = m[0][0];
		self[0][1] = m[0][1];
		self[0][2] = m[0][2];
		self[1][0] = m[1][0];
		self[1][1] = m[1][1];
		self[1][2] = m[1][2];
		self[2][0] = m[2][0];
		self[2][1] = m[2][1];
		self[2][2] = m[2][2];
	};

	///
	/// Transform a point in place by this matrix 
	/// @param {Object=} p point object
	///
	rat.Matrix.prototype.transformPointSelf = function (p)
	{
		var m = this.m;
		var tx = p.x;
		var ty = p.y;
		p.x = (m[0][0] * tx) + (m[0][1] * ty + m[0][2]);
		p.y = (m[1][0] * tx) + (m[1][1] * ty + m[1][2]);
		return p;
	};

	///
	/// Transform a point by this matrix 
	/// @param {Object=} p point object
	/// @param {Object=} dest point object
	/// @return {Object} point The transformed point
	///
	rat.Matrix.prototype.transformPoint = function (p, dest)
	{
		if (!dest)
			dest = new rat.Vector(p);
		else
		{
			dest.x = p.x;
			dest.y = p.y;
		}
		return this.transformPointSelf(dest);
	};

	///
	///	Static method to allow matrix multiplication
	/// @param {Object} m1 The first matrix
	/// @param {Object} m2 The second matrix
	/// @param {Object=} dest destination matrix
	/// @return {Object} dest the multiplied matrix
	///
	rat.Matrix.matMult = function (m1, m2, dest)
	{
		if (dest)
			dest.set(m1);
		else
			dest = new rat.Matrix(m1);
		dest.multSelf(m2);
		return dest;
	};

	///
	/// Get the inverse of one matrix into another matrix
	/// @param {dest=} The destination of the matrix inverse
	/// @return {dest} The matrix inverse
	///
	rat.Matrix.prototype.inverse = function (dest)
	{
		if (!dest)
			dest = new rat.Matrix(this);
		else
			dest.set(this);
		dest.inverseSelf();
		return dest;
	};
});