//
//	generated js from lua file
//
rat.modules.add( "rat.xuijs.wahooluajs.physics.w_aabb_3d",
[
	{name: "rat.xuijs.wahooluajs.wahoolua", processBefore: true },
	{name: "rat.xuijs.wahooluajs.system.w_class", processBefore: true },
	
	"rat.math.r_math",
], 
function(rat)
{
	// An axis-aligned bounding box for collision in 3d space.
	
	wahoolua.WAabb3d = wahoolua.class();
	var WAabb3d = wahoolua.WAabb3d;

	wahoolua.WAabb3d.type = "AABB3D";
	
	var EPSILON = 0.001
	
	wahoolua.WAabb3d.prototype.Ctor = function() {
		this.halfLengths = wahoolua.WVector3D.new(0,0,0);
		this.type = wahoolua.WAabb3d.type;
	};
	
	// Initializes the collision with the centroid, halfWidth, halfHeight, && halfDepth.
	wahoolua.WAabb3d.prototype.InitCollision = function(centroid, halfWidth, halfHeight, halfDepth) {
		this.InitCentroid(centroid)
		this.halfLengths.x = halfWidth
		this.halfLengths.y = halfHeight
		this.halfLengths.z = halfDepth
	}
	
	// Initializes the collision with the position at the top, left, front corner,
	// then the width, height, && depth.
	wahoolua.WAabb3d.prototype.InitCollisionWithPositionAndDimensions = function(position, width, height, depth) {
		var halfWidth = width * 0.5
		var halfHeight = height * 0.5
		var halfDepth = depth * 0.5
		var centroid = wahoolua.WVector3D.new(position.x + halfWidth, position.y + halfHeight, position.z + halfDepth)
		
		this.InitCollision(centroid, halfWidth, halfHeight, halfDepth)
	}
	
	// Constructs the collision object from a xuiElement.
	// The depth of the object is stored in the z-scale.
	// The optional parameter camera translates the screen position to a 3d position.
	// The optional parameter groundedHeight specifies the elevation of the base of
	// the xuiElement.
	wahoolua.WAabb3d.prototype.InitCollisionFromXui = function(xuiElement, camera, groundedHeight) {
		var position = wahoolua.WVector3D.new(xuiElement.GetPosition())
		var width = xuiElement.GetWidth()
		var height = xuiElement.GetHeight()
		var depth = 0
		if ( xuiElement.depth ) {
			depth = xuiElement.depth.GetHeight()
		}
		else {
			var vars0 =  xuiElement.GetScale()

		sx = vars0[0]
		sy = vars0[1]
		sz = vars0[2]
		depth = sz
		}
		
		if ( camera ) {
			position = camera.ConvertScreenSpaceWithHeightTo3dSpace(position, height, groundedHeight)
		}
		
		this.InitCollisionWithPositionAndDimensions(position, width, height, depth)
	}
	
	// Constructs the collision object from a WFake3dObject.
	// The depth of the object is stored in the z-scale.
	wahoolua.WAabb3d.prototype.InitCollisionFrom3dObject = function(object) {
		this.object3d = object
		
		var position = object.GetPosition()
		
		// Read the dimensions from the collision
		var collision = object.graphic.collision || object.graphic
		var width = collision.GetWidth()
		var height = collision.GetHeight()
		var depth = 0
		if ( collision.depth ) {
			depth = collision.depth.GetHeight()
		}
		else {
			var vars1 =  collision.GetScale()

		scaleX = vars1[0]
		scaleY = vars1[1]
		scaleZ = vars1[2]
		depth = scaleZ
		}
		
		this.InitCollisionWithPositionAndDimensions(position, width, height, depth)
		
		// If the collision is a child, add its position to the collision offset
		if ( object.graphic.collision ) {
			this.centroidOffset = this.centroidOffset.Add(wahoolua.WVector3D.new(collision.GetPosition()))
		}
	}
	
	// Initializes the centroid.
	// Overridable to work with an object that moves its position separatly.
	wahoolua.WAabb3d.prototype.InitCentroid = function(centroid) {
		if ( this.object3d ) {
			// If this is attached to a 3d object, initialize the centroid offset.
			this.centroidOffset = centroid.Subtract(this.object3d.GetPosition())
		}
		else {
			this.SetCentroid(centroid)
		}
	}
	
	// Sets the position to have the centroid at the provided location.
	wahoolua.WAabb3d.prototype.SetCentroid = function(centroid) {
		if ( this.object3d ) {
			this.object3d.SetPosition(centroid.Subtract(this.centroidOffset))
		}
		else {
			this.centroid = centroid
		}
	}
	
	wahoolua.WAabb3d.prototype.GetDepth = function() {
		return this.halfLengths.z * 2
	}
	
	// Gets the centroid.
	// Overridable to work with an object that moves its position separatly.
	wahoolua.WAabb3d.prototype.GetCentroid = function() {
		if ( this.object3d ) {
			return this.centroidOffset.Add(this.object3d.GetPosition())
		}
		else {
			return this.centroid
		}
	}
	
	wahoolua.WAabb3d.prototype.ShouldSweep = function() {
		return false
	}
	
	// Return the bounds of the collision as two WVector3Ds: the minimum for the
	// bounds, then the maximum for the bounds.
	wahoolua.WAabb3d.prototype.GetBounds = function() {
		var centroid = this.GetCentroid()
		return [wahoolua.WVector3D.prototype.Subtract.call(centroid,this.halfLengths),
			   wahoolua.WVector3D.prototype.Add.call(centroid,this.halfLengths)]
	}
	
	// Returns if this is overlapping the given bounds.
	wahoolua.WAabb3d.prototype.IsOverlappingBounds = function(minBounds, maxBounds) {
		var centroid = this.GetCentroid()
		if( minBounds['x'] > centroid['x'] + this.halfLengths['x'] ||
				maxBounds['x'] < centroid['x'] - this.halfLengths['x'] )
			return false
		if( minBounds['y'] > centroid['y'] + this.halfLengths['y'] ||
				maxBounds['y'] < centroid['y'] - this.halfLengths['y'] )
			return false
		if( minBounds['z'] > centroid['z'] + this.halfLengths['z'] ||
				maxBounds['z'] < centroid['z'] - this.halfLengths['z'] )
			return false
		return true
	}
	
	wahoolua.WAabb3d.prototype.TestIntersection = function(other, deltaTime) {
		
		if ( other.type == WAabb3d.type ) {
			return this.TestIntersectionAabb(other, deltaTime)
		}
		else {
			// Run the test on the other object
			var mtv = other.TestIntersection(this, deltaTime)
			// If we got an mtv, flip it so it would show how to move this object out
			if ( mtv ) {
				mtv = mtv.Scale(-1)
			}
			return mtv
		}
		
	}
	
	wahoolua.WAabb3d.prototype.TestIntersectionAabb = function(other, deltaTime) {
		if ( !this.GetVelocity && !other.GetVelocity ) {
			return this.TestIntersectionStationaryAabb(other)
		}
		else {
			return this.TestIntersectionDynamicAabb(other, deltaTime)
		}
	}
	
	wahoolua.WAabb3d.prototype.TestIntersectionStationaryAabb = function(other) {
		var minimalTranslationDistance = false
		var minimalTranslationAxis = 'none'
		
		var  selfCentroid =  this.GetCentroid()
		var otherCentroid = other.GetCentroid()
		
		var axes = ['x', 'y', 'z'];
		for(var i = 0; i < axes.length; ++i) {
			var axis = axes[ i ];
			var offset = rat.math.abs(selfCentroid[axis]-otherCentroid[axis])
			var maxDistanceToOverlap = this.halfLengths[axis] + other.halfLengths[axis]
			var overlap = maxDistanceToOverlap - offset
			
			if ( overlap < EPSILON ) {
				return false
			}
			
			if ( !minimalTranslationDistance || overlap < minimalTranslationDistance ) {
				minimalTranslationDistance = overlap
				minimalTranslationAxis = axis
			}
		}
		
		if ( selfCentroid[minimalTranslationAxis] < otherCentroid[minimalTranslationAxis] ) {
			minimalTranslationDistance = -minimalTranslationDistance
		}
		
		var mtv = wahoolua.WVector3D.new(0, 0, 0)
		mtv[minimalTranslationAxis] = minimalTranslationDistance
		return mtv
	
	}
	
	wahoolua.WAabb3d.prototype.TestIntersectionDynamicAabb = function(other, deltaTime) {
		// NOTE: The velocities are in pixels per frame and the time is in frames.
		var myVelocity = !this.GetVelocity && wahoolua.WVector3D.new(0,0,0) || this.GetVelocity().Scale(deltaTime);
		var myCentroid = this.GetCentroid();
		var otherVelocity = !other.GetVelocity &&wahoolua.WVector3D.new(0,0,0) || other.GetVelocity().Scale(deltaTime);
		var otherCentroid = other.GetCentroid();
		
		var enterTime = -rat.math.MAX_NUMBER;
		var exitTime = rat.math.MAX_NUMBER;
	
		var myOldCentroid = 0;
		var myMinBounds = 0;
		var myMaxBounds = 0;
		
		var otherOldCentroid = 0;
		var otherMinBounds = 0;
		var otherMaxBounds = 0;
		
		var relativeVelocity = 0;
		
		var axes = ['x', 'y', 'z'];
		for(var i = 0; i < axes.length; ++i) {
			var axis = axes[ i ];
			relativeVelocity = otherVelocity[axis] - myVelocity[axis];
			if ( rat.math.abs(relativeVelocity) < EPSILON ) {
				if ( rat.math.abs(myCentroid[axis] - otherCentroid[axis]) > (this.halfLengths[axis] + other.halfLengths[axis]) ) {
					// The objects are not moving on this axis and are not overlapping on this axis.
					return false;
				}
			}
			else {
				myOldCentroid = myCentroid[axis] - myVelocity[axis];
				myMinBounds = myOldCentroid - this.halfLengths[axis];
				myMaxBounds = myOldCentroid + this.halfLengths[axis];
				
				otherOldCentroid = otherCentroid[axis] - otherVelocity[axis];
				otherMinBounds = otherOldCentroid - other.halfLengths[axis];
				otherMaxBounds = otherOldCentroid + other.halfLengths[axis];
				
				if ( relativeVelocity < 0 ) {
					enterTime = rat.math.max((myMaxBounds-otherMinBounds)/relativeVelocity, enterTime);
					exitTime = rat.math.min((myMinBounds-otherMaxBounds)/relativeVelocity, exitTime);
				}
				else {
					enterTime = rat.math.max((myMinBounds-otherMaxBounds)/relativeVelocity, enterTime);
					exitTime = rat.math.min((myMaxBounds-otherMinBounds)/relativeVelocity, exitTime);
				}
				
				if ( enterTime > exitTime ) {
					// Exits on one axis before entering on another.
					return false;
				}
			}
		}
		
		if ( enterTime > 1 ) {
			// They collide some time in the future
			return [false, enterTime];
		}
		else if ( exitTime < 0 ) {
			// They separated before the frame
			return [false, enterTime];
		}
		else if ( exitTime < 1 ) {
			// They collide in the frame, but not at the end of the frame
			return [wahoolua.WVector3D.new(0, 0, 0), enterTime];
		}
		
		var mtv = this.TestIntersectionStationaryAabb(other);
		return [mtv, enterTime];
	};
	
	wahoolua.WAabb3d.prototype.TestIntersectionPoint = function(otherPoint, otherVelocity) {
	
		if ( !this.GetVelocity && !otherVelocity ) {
			return this.TestIntersectionStaticPoint(otherPoint)
		}
		else {
			this.TestIntersectionDynamicPoint(otherPoint, otherVelocity)
		}
	
	}
	
	wahoolua.WAabb3d.prototype.TestIntersectionStaticPoint = function(otherPoint) {
	
		var epsilon = -0.001
	
		var centroid = this.GetCentroid()
		var mtv = wahoolua.WVector3D.new(0, 0, 0)
		var mtvDimension = false
		var mtvLength = rat.math.huge
		var axes = ['x', 'y', 'z'];
		for(var i = 0; i < axes.length; ++i) {
			var dimension = axes[ i ];
			var centroidOffset = centroid[dimension] - otherPoint[dimension]
			var absDimensionMtv = this.halfLengths[dimension] - rat.math.abs(centroidOffset)
			if ( absDimensionMtv > epsilon ) {
				if ( absDimensionMtv < mtvLength ) {
					if ( mtvDimension ) {
						mtv[mtvDimension] = 0
					}
					mtvDimension = dimension
					mtvLength = absDimensionMtv
					if ( centroidOffset > 0 ) {
						mtv[dimension] = absDimensionMtv
					}
					else {
						mtv[dimension] = -absDimensionMtv
					}
				}
			}
			else {
				return false
			}
		}
		
		return mtv
	
	}
	
	wahoolua.WAabb3d.prototype.TestIntersectionDynamicPoint = function(otherPoint, otherVelocity) {
	
		var myVelocity = ! this.GetVelocity && wahoolua.WVector3D.new(0,0,0) || this.GetVelocity()
		var relativeVelocity = otherVelocity.Subtract(myVelocity)
		
		if ( relativeVelocity.MagnitudeSquared() > EPSILON ) {
			return [this.TestIntersectionRay(otherPoint.Subtract(otherVelocity), relativeVelocity)]
		}
		else {
			return this.TestIntersectionStaticPoint(otherPoint)
		}
		
	}
	
	wahoolua.WAabb3d.prototype.TestIntersectionRay = function(start, offset) {
	
		var centroid = this.GetCentroid()
		var rayOffset = start.Subtract(centroid)
		
		var vars5 = [ 0, 0]

		axisEnterTime = vars5[0]
		axisExitTime = vars5[1]
	var vars6 = [ -rat.math.huge, rat.math.huge]

		enterTime = vars6[0]
		exitTime = vars6[1]
	var lastAxisToEnter = 'x'
		var axes = ['x', 'y', 'z'];
		for(var i = 0; i < axes.length; ++i) {
			var axis = axes[ i ];
			if ( rat.math.abs(offset[axis]) < EPSILON ) {
				if ( rat.math.abs(start[axis]-centroid[axis]) > this.halfLengths[axis] ) {
					// Not moving on an axis && that axis separates
					return false
				}
			}
			else {
				axisExitTime = (this.halfLengths[axis]-rayOffset[axis])/offset[axis]
				axisEnterTime = (-this.halfLengths[axis]-rayOffset[axis])/offset[axis]
				if ( axisEnterTime > axisExitTime ) {
					var realEnterTime = axisExitTime
					axisExitTime = axisEnterTime
					axisEnterTime = realEnterTime
				}
				if ( axisEnterTime > enterTime ) {
					enterTime = axisEnterTime
					lastAxisToEnter = axis
				}
				exitTime = rat.math.min(exitTime, axisExitTime)
			}
		}
		
		if ( exitTime < enterTime ) {
			// Will ! hit
			return false
		}
		else if ( exitTime < 0 ) {
			// The ray points away
			return false
		}
		
		var surfaceNormal = { x:0, y:0, z:0, }
		surfaceNormal[lastAxisToEnter] = offset[lastAxisToEnter] > 0 && -1 || 1
		if ( enterTime > 1 ) {
			// The ray points to the box, but falls short
			return [false, enterTime, surfaceNormal]
		}
		else if ( exitTime < 1 ) {
			// The ray hits the box, but }s outside
			return [wahoolua.WVector3D.new(0, 0, 0), enterTime, surfaceNormal]
		}
		
		// The ray hits the box && }s in the box
		
		var mtv = wahoolua.WVector3D.new(0, 0, 0)
		if ( enterTime < 0 ) {
			// The objects were colliding before the frame, so use the statitionary check for the mtv.
			mtv = this.TestIntersectionStaticPoint(start.Add(offset))
		}
		else {
			// The best way to simply separate by moving this is to pull this back on
			// the last axis to collide to where the point is just entering.
			mtv[lastAxisToEnter] = offset[lastAxisToEnter] * (1-enterTime)
		}
		
		return [mtv, enterTime, surfaceNormal]
	
	}
	
	wahoolua.WAabb3d.prototype.NewExpandedSelf = function(addedHalfLengths) {
	
		var expandedSelf = WAabb3d.new()
		var halfLengths = this.halfLengths.Add(addedHalfLengths)
		expandedSelf.InitCollision(this.GetCentroid(), halfLengths.x, halfLengths.y, halfLengths.z)
		if ( this.GetVelocity ) {
			expandedSelf.velocity = this.GetVelocity()
			expandedSelf.GetVelocity = this.velocity
		}
		return expandedSelf
	
	}
		
});
