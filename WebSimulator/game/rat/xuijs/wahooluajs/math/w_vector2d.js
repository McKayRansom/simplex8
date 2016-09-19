//
//	generated js from lua file
//
rat.modules.add( "rat.xuijs.wahooluajs.math.w_vector2d",
[
	"rat.xuijs.wahooluajs.wahoolua",
	"rat.math.r_math",
], 
function(rat)
{
	WVector2D = function(x, y) {
		if(Array.isArray(x))
		{
			this.x= x[0];
			this.y = x[0];

		}
		else {
			this.x = x;
			this.y = y;
		}
	};
	
	WVector2D.prototype.Dtor = function() {
	};
	
	WVector2D.prototype.Clone = function() {
		return new WVector2D(this.x, this.y);
	};
	
	WVector2D.prototype.Explode = function() {
		return [this.x, this.y];
	};
	
	WVector2D.prototype.Magnitude = function() {
		return rat.math.sqrt(this.Dot(this));
	};
	
	WVector2D.prototype.MagnitudeSquared = function() {
		return this.Dot(this);
	};
	
	WVector2D.prototype.Normalize = function() {
		var m = this.Magnitude();
		return new WVector2D(this.x/m, this.y/m);
	};
	
	WVector2D.prototype.Scale = function(scalar) {
		return new WVector2D(this.x * scalar, this.y * scalar);
	};
	
	WVector2D.prototype.Dot = function(vec) {
		var t1 = 1 * this.x;
		var t2 = 1 * vec.x;
	
		return ((this.x*vec.x) + (this.y*vec.y));
	};
	
	WVector2D.prototype.Cross = function(vec) {
		return (this.x*vec.y) - (this.y*vec.x);
	};
	
	WVector2D.prototype.Add = function(vec) {
		return new WVector2D(this.x + vec.x, this.y + vec.y);
	};
	
	WVector2D.prototype.Subtract = function(vec) {
		return new WVector2D(this.x - vec.x, this.y - vec.y);
	};
	
	WVector2D.prototype.Negate = function() {
		return new WVector2D(-this.x, -this.y);
	};
	
	WVector2D.prototype.Perpendicular = function() {
		return new WVector2D(-this.y, this.x);
	};
	
	WVector2D.prototype.Project = function(vec) {
		vec = vec.Normalize();
		var dp = this.Dot(vec);
		return new WVector2D(
			dp * vec.x,
			dp * vec.y
		);
	};
	
	WVector2D.prototype.Rotate = function(angle) {
		var theta = rat.math.rad(angle);
		var sintheta = rat.math.sin(theta);
		var costheta = rat.math.cos(theta);
		/*
		print("Angle:", angle)
		print("Theta:", theta)
		print("sTheta:", sintheta)
		print("cTheta:", costheta)
		//]]*/
		return new WVector2D(
			(this.x*costheta - this.y*sintheta),
			(this.x*sintheta + this.y*costheta)
		)
	};
	
	WVector2D.prototype.Rotation = function(vec) {
		var dp = this.Dot(vec);
		var m = this.Magnitude() * vec.Magnitude();
		var theta = rat.math.acos(dp/m);
		
		return rat.math.deg(theta);
	};
	
	WVector2D.prototype.Draw = function() {
		console.log("WVector2D: <"+this.x.toString()+", "+this.y.toString()+">")
	};
});
