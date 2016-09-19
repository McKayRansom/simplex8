//
//	rat.Spline
//
//	A spline is a path consisting of several aligned bezier curves.
//	Each curve is defined by 4 control points.
//	endpoints (knots) are shared between curves.
//	The spline passes through all knots.
//	control points are (usually) along the tangent for each knot, for smoothness.
//
rat.modules.add( "rat.utils.r_spline",
[
	"rat.debug.r_console",
	"rat.utils.r_bezier",
], 
function(rat)
{
	/**
	 * @constructor
	 */
	rat.Spline = function ()	//	constructor for Spline
	{
		this.length = 0;
		this.points = [];
		
		this.curves = [];	//	this references points above
	};
	
	//
	//	Construct a spline that passes through these points (knots)
	//
	rat.Spline.prototype.constructFromPoints = function(points)
	{
		var controlInfo = [{}];	//	one blank entry for endpoint that we'll fix later
		
		//	calculate control points
		var pIndex;
		var tvec;
		for (pIndex = 1; pIndex < points.length-1; pIndex++)
		{
			//	tangent based on nearby two points
			var p = points[pIndex];
			var pp = points[pIndex-1];
			var pn = points[pIndex+1];
			tvec = {x:pn.x - pp.x, y:pn.y - pp.y};
			//	normalize
			var len = Math.sqrt(tvec.x * tvec.x + tvec.y * tvec.y);
			tvec.x /= len;
			tvec.y /= len;
			
			//	left side
			var dx = p.x - pp.x;
			var dy = p.y - pp.y;
			len = Math.sqrt(dx * dx + dy * dy);
			
			controlInfo[pIndex] = {};
			controlInfo[pIndex].c1 = {x:p.x - tvec.x * len/3, y:p.y - tvec.y * len/3};
			
			//	right side
			dx = p.x - pn.x;
			dy = p.y - pn.y;
			len = Math.sqrt(dx * dx + dy * dy);
			controlInfo[pIndex].c2 = {x:p.x + tvec.x * len/3, y:p.y + tvec.y * len/3};
		}
		
		//	control points for ends
		function partway(p, p1)
		{
			var dx = p1.x - p.x;
			var dy = p1.y - p.y;
			return {x:p.x + dx/3, y:p.y + dy/3};
		}
		controlInfo[0].c2 = partway(points[0], points[1]);
		controlInfo[points.length-1] = {
			c1 : partway(points[points.length-1], points[points.length-2])
		};
		
		//	now set up continuous curve points for rendering and interpolation
		//	and a separate list of curves for easy access.
		
		this.points = [];
		this.curves = [];
		var cIndex = 0;
		
		var sp = this.points;
		var sIndex = 0;
		sp[sIndex++] = points[0];
		
		this.length = 0;

		for (pIndex = 0; pIndex < points.length-1; pIndex++)
		{
			sp[sIndex++] = controlInfo[pIndex].c2;
			sp[sIndex++] = controlInfo[pIndex+1].c1;
			sp[sIndex++] = points[pIndex+1];
			
			this.curves[cIndex] = {
				points : [
					sp[sIndex-4],
					sp[sIndex-3],
					sp[sIndex-2],
					sp[sIndex-1]]
			};
			this.curves[cIndex].length = rat.bezier.length(this.curves[cIndex].points);
			this.length += this.curves[cIndex].length;
			
			cIndex++;
		}
		
	};	// constructFromPoints
	
	//	given point along spline, return which subcurve this is in, and how far in it is
	//	(return struct with 'curve' and 'curvePos' (0-1)
	rat.Spline.prototype.interpToCurve = function(interp)
	{
		var targetLength = interp * this.length;
		var curLength = 0;
		
		for (var i = 0; i < this.curves.length; i++)
		{
			var curve = this.curves[i];
			if (curLength + curve.length > targetLength)
			{
				var curvePos = targetLength - curLength;
				curvePos /= curve.length;	//	normalized to 0-1
				
				return {curve: i, curvePos: curvePos};
			}
			curLength += curve.length;
		}
		
		return {curve: this.curves.length-1, curvePos: 1};//	very end
	};
	
	//	get point (x,y) at this position (0-1) along the spline
	rat.Spline.prototype.point = function(interp)
	{
		var curveInfo = this.interpToCurve(interp);
		return rat.bezier.point(curveInfo.curvePos, this.curves[curveInfo.curve].points);
	};
	
	//	get tangent vector at this position (0-1) along the spline
	rat.Spline.prototype.tangent = function(t)
	{
		var curveInfo = this.interpToCurve(t);
		return rat.bezier.tangent(curveInfo.curvePos, this.curves[curveInfo.curve].points);
	};
	
} );