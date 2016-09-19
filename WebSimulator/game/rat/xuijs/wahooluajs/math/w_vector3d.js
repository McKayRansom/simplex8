
rat.modules.add( "rat.xuijs.wahooluajs.math.w_vector3d",
[
	{name: "rat.xuijs.wahooluajs.wahoolua", processBefore: true },
	{name: "rat.math.r_math", processBefore: true },
], 
function(rat)
{
    WVector3D = function(x, y, z)
    {
        if(Array.isArray(x))
        {
            this.x = x[0];
            this.y = x[1];
            this.z = x[2];
        }
        else {

            this.x = x;
            this.y = y;
            this.z = z;
        }
    }
	
	WVector3D.new = function(x, y, z)
	{
		return new WVector3D(x, y, z);
	}

    WVector3D.prototype.Dtor = function() {
    }

    WVector3D.prototype.Explode = function() {
        return [this.x, this.y, this.z]
    }

    WVector3D.prototype.Clone = function() {
        return new WVector3D(this.x, this.y, this.z)
    }

    WVector3D.prototype.Magnitude = function() {
        return rat.math.sqrt(this.Dot(this))
    }

    WVector3D.prototype.MagnitudeSquared = function() {
        return this.Dot(this)
    }

    WVector3D.prototype.Normalize = function() {
        var m = this.Magnitude()
        return new WVector3D(this.x/m, this.y/m, this.z/m)
    }

    WVector3D.prototype.Scale = function(scalar) {
        return new WVector3D(this.x * scalar, this.y * scalar, this.z * scalar)
    }

    WVector3D.prototype.Dot = function(vec) {
        return ((this.x*vec.x) + (this.y*vec.y) + (this.z*vec.z))
    }

    WVector3D.prototype.Cross = function(vec) {
        return new WVector3D(
            (this.y*vec.z) - (vec.y*this.z),
            (this.z*vec.x) - (vec.z*this.x),
            (this.x*vec.y) - (vec.x*this.y)
        )
    }

    WVector3D.prototype.Add = function(vec) {
        return new WVector3D(this.x + vec.x, this.y + vec.y, this.z + vec.z)
    }

    WVector3D.prototype.Subtract = function(vec) {
        return new WVector3D(this.x - vec.x, this.y - vec.y, this.z - vec.z)
    }

    //piecewise multiply
    WVector3D.prototype.Multiply = function(vec) {
        return new WVector3D(this.x*vec.x, this.y*vec.y, this.z*vec.z)
    }

    WVector3D.prototype.Negate = function() {
        return new WVector3D(-this.x, -this.y, -this.z)
    }

    WVector3D.prototype.Perpendicular = function(vec) {
        return new WVector3D(
            this.y * vec.z - this.z * vec.y,
            this.z * vec.x - this.x * vec.z,
            this.x * vec.y - this.y * vec.x
        )
    }

    WVector3D.prototype.Project = function(vec) {
        vec = vec.Normalize();
        var dp = this.Dot(vec);
        return new WVector3D(
            dp * vec.x,
            dp * vec.y,
            dp * vec.z
        )
    }

    WVector3D.prototype.Reflect = function(vec) {
        vec = vec.Normalize();
        var dp = this.Dot(vec);
        vec = vec.Scale(2 * dp);
        return this.Subtract(vec);
    }

    WVector3D.prototype.RotateAxisAngle = function(axis, angle) {
        axis = axis.Normalize();
        var dp = axis.Dot(this);
        var cp = axis.Cross(this);
        var theta = rat.math.rad(angle);
        var ctheta = rat.math.cos(theta);
        var stheta = rat.math.sin(theta);

        return this.Scale(ctheta).Add(cp.Scale(stheta)).Add(axis.Scale(dp).Scale(1-ctheta))
    }

    WVector3D.prototype.Draw = function() {
        //PORT:TODO: print("WVector3D: <"+this.x.toString()+", "+this.y.toString()+", "+this.z.toString()+">");
    }

    WVector3D.XAxis = new WVector3D(1,0,0)
    WVector3D.YAxis = new WVector3D(0,1,0)
    WVector3D.ZAxis = new WVector3D(0,0,1)

    wahoolua.WVector3D = WVector3D;

} );