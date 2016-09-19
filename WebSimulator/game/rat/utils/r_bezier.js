//
//	bezier math and related utils
//	acting on a simple list of points.
//	This matches up with canvas bezier rendering.
//
//	Right now, this is just a namespace and functions, not a Bezier class.
//	Compare and contrast with r_spline
//

/**
 * The bezier module
 */
rat.modules.add( "rat.utils.r_bezier",
[],
function(rat)
{
	rat.bezier = {
		
		//	get a point on a curve
		point : function(t, p)	//	interp, path
		{
			var r = {};
			var inv = 1-t;
			//	(1 - t)^3 * P0 + 3t(1-t)^2 * P1 + 3t^2 (1-t) * P2 + t^3 * P3
			r.x = inv*inv*inv * p[0].x + 3 * t * inv * inv * p[1].x + 3 * t * t * inv * p[2].x + t * t * t * p[3].x;
			r.y = inv*inv*inv * p[0].y + 3 * t * inv * inv * p[1].y + 3 * t * t * inv * p[2].y + t * t * t * p[3].y;
			return r;
		},
		
		//	get forward tangent vector for this point on this curve
		tangent : function(t, p)
		{
			//	dP(t) / dt =  -3(1-t)^2 * P0 + 3(1-t)^2 * P1 - 6t(1-t) * P1 - 3t^2 * P2 + 6t(1-t)???
			//r.x = -3*inv*inv*p[0].x + 3*inv*inv*p[1].x - 6*t*inv*p[1].x - 3 * t*t*p[2].x + 6*t*inv;
			//r.y = -3*inv*inv*p[0].y + 3*inv*inv*p[1].y - 6*t*inv*p[1].y - 3 * t*t*p[2].y + 6*t*inv;
			
			//	dC(t)/dt = T(t) =
			//	-3*P0*(1 - t)^2 + 
			//	P1*(3*(1 - t)^2 - 6*(1 - t)*t) + 
			//	P2*(6*(1 - t)*t - 3*t^2) +
			//	3*P3*t^2

			var r = {};
			var inv = 1-t;
			r.x = -3*p[0].x*inv*inv + p[1].x*(3*inv*inv - 6*inv*t) + p[2].x * (6 * inv * t - 3 * t * t) + 3 * p[3].x*t*t;
			r.y = -3*p[0].y*inv*inv + p[1].y*(3*inv*inv - 6*inv*t) + p[2].y * (6 * inv * t - 3 * t * t) + 3 * p[3].y*t*t;
			
			return r;
		},
		
		//	get length of this curve
		length : function(p)
		{
			var segs = 20;	//	this'll be close enough
			var lastPos;
			var len = 0;
			for (var i = 0; i <= segs; i++)
			{
				var r = rat.bezier.point(i/segs, p);
				if (i === 0)
					lastPos = r;
				var dx = lastPos.x - r.x;
				var dy = lastPos.y - r.y;
				var segLen = Math.sqrt(dx * dx + dy * dy);
				len += segLen;
				lastPos = r;
			}
			return len;
		},	
	};
	
	
	// A class for computing cubic bezier based easing values.
	// The implementation seems really convoluted, but hopefully not cost-prohibitive.
	
	// Ideas/methodology gathered from:
	// http://svn.webkit.org/repository/webkit/trunk/Source/WebCore/platform/graphics/UnitBezier.h 
	// https://github.com/ehsan/mozilla-history/blob/master/content/smil/nsSMILKeySpline.cpp
	
	// Performance seems ok, but probably room for improvement.  Maybe a caching mechanism?
	
	// There might be some more efficient way to calculate this stuff using Taylor Series/forward differencing?
	// http://www.niksula.hut.fi/~hkankaan/Homepages/bezierfast.html
	// I think this might be something like what the Spine runtime (from Esoteric Software) does.
	// But I think they just solve ~10 steps along the bezier and interpolate between those values...hmm,
	// maybe something like that would be good enough.
	
	// Pass in x and y values for the two control points.
	// Start and end points assumed to be (0,0) and (1,1). 
	/**
	 * @constructor
	*/
	rat.bezierEase = function(p1x, p1y, p2x, p2y){
		
		
		// Do some early-out testing.
		// If both of the control points have equal values for X and Y, then it's linear interpolation.
		if( Math.abs(p1x - p1y) < rat.bezierEase.EPSILON &&
			Math.abs(p2x - p2y) < rat.bezierEase.EPSILON ){
			this.isLinear = true;
			return;
		}
		
		// Make sure x values are clamped 0.0 to 1.0
		p1x = p1x < 0.0 ? 0.0 : p1x > 1.0 ? 1.0 : p1x;
		p2x = p2x < 0.0 ? 0.0 : p2x > 1.0 ? 1.0 : p2x;
		
		
		// Calculate polynomial coeffecients, for easier calculations later.
		// Start and end points assumed to be (0,0) and (1,1). 
		this.Cx = 3.0 * p1x;
		this.Bx = 3.0 * p2x - 6.0 * p1x;
		this.Ax = 1.0 - 3.0 * p2x + 3.0 * p1x;
		
		this.Cy = 3.0 * p1y;
		this.By = 3.0 * p2y - 6.0 * p1y;
		this.Ay = 1.0 - 3.0 * p2y + 3.0 * p1y;
		
		// Cache a set of pre-calculated points for x, to give better starting point for Newton-Raphson iterationn later.
		this.preCalcValues = new Array(rat.bezierEase.PRECALC_SIZE);
		for( var i = 0; i < rat.bezierEase.PRECALC_SIZE; i++ ){
			this.preCalcValues[i] = this.calcBezier(this.Ax, this.Bx, this.Cx, i * rat.bezierEase.PRECALC_STEP );
		}
	};
	
	// Some constants
	rat.bezierEase.EPSILON = 1e-6;
	rat.bezierEase.NEWTON_MIN_SLOPE = 0.02;
	rat.bezierEase.NEWTON_ITERATIONS = 4;
	rat.bezierEase.SUBDIVISION_MAX_ITERATIONS = 15;//10;
	rat.bezierEase.PRECALC_SIZE = 11;
	rat.bezierEase.PRECALC_STEP = 1.0 / (rat.bezierEase.PRECALC_SIZE - 1);
	
	rat.bezierEase.prototype.calcBezier = function(A, B, C, t)
	{
		// Calculate the bezier curve at t using Horner's rule.
		return ((A * t + B) * t + C) * t;
	};
	
	rat.bezierEase.prototype.calcBezierDerivative = function(A, B, C, t)
	{
		// Calculate the derivative of the bezier curve at t.
		return (3.0 * A * t + 2.0 * B) * t + C;
	};
	
	// Calculates the "eased" value based on the input.
	// The value of input should be 0 to 1 inclusive.
	rat.bezierEase.prototype.calcEaseValue = function(input)
	{
		// Check if curve is linear, or if we're at an endpoint, and just return the input.
		if( this.isLinear || input < rat.bezierEase.EPSILON || input > 1.0 - rat.bezierEase.EPSILON){
			return input;
		}
		
		// First we need to solve for a value t along the curve so that its x value equals the input value.
		// There doesn't seem to be a nice direct way to do this, so we can do Newton-Raphson iterations to arrive at the value,
		// but there are some cases where that won't work - in those cases, use a binary subdivide approach.
		
		// Find min max values for t, based on precalculated values.
		var tMin = 0.0;
		var tMax = 1.0;
		var tFinal = null;
		var tGuess = input;
		
		for( var i = 0; i < rat.bezierEase.PRECALC_SIZE; i++ ){
			// Find the first cached value that is bigger then input - that'll be tMax.
			var val = this.preCalcValues[i];
			if( val > input ){
				tMax = i * rat.bezierEase.PRECALC_STEP;
				tMin = (i-1) * rat.bezierEase.PRECALC_STEP;
				
				// Interpolate between tMin and tMax for initial guess
				var prevVal = this.preCalcValues[i-1];
				tGuess = tMin + (tMax - tMin) * ((input - prevVal) / (val - prevVal));
				break;
			}
		}
		
		var valAtGuess = null;
		
		// Check the initial slope to see if Newton-Raphson will work
		var slope = this.calcBezierDerivative(this.Ax, this.Bx, this.Cx, tGuess);
		if( slope >= rat.bezierEase.NEWTON_MIN_SLOPE ){
			// Use Newton-Raphson
			// We're trying to find where the curve (on the x axis) equals our input value,
			// which mean we're trying to find where calcBezier(tGuess) - input == zero.
			for( var j = 0; j < rat.bezierEase.NEWTON_ITERATIONS; j++ ){
				valAtGuess = this.calcBezier(this.Ax, this.Bx, this.Cx, tGuess) - input;
				
				if( Math.abs(valAtGuess) < rat.bezierEase.EPSILON ){
					// Found solution
					tFinal = tGuess;
					break;
				}
				
				slope = this.calcBezierDerivative(this.Ax, this.Bx, this.Cx, tGuess);
				
				if( Math.abs(slope) < rat.bezierEase.EPSILON ){
					// Didn't find solution
					break;
				}
				
				tGuess -= valAtGuess / slope;
			}
		}
		
		if( tFinal === null){
			// Need to do binary subdivision to find the solution.
			var subdivideCount = 0;
			do{
				tGuess = tMin + ((tMax - tMin) * 0.5);
				valAtGuess = this.calcBezier(this.Ax, this.Bx, this.Cx, tGuess) - input;
				if( valAtGuess > 0.0 ){
					tMax = tGuess;
				}
				else{
					tMin = tGuess;
				}
			}while(Math.abs(valAtGuess) > rat.bezierEase.EPSILON && ++subdivideCount < rat.bezierEase.SUBDIVISION_MAX_ITERATIONS);
			
			tFinal = tGuess;
		}
		
		// Now that we know the t-value for the input x value,
		// calculate the curve y value for that t value.
		return this.calcBezier(this.Ay, this.By, this.Cy, tFinal);
	};

} );