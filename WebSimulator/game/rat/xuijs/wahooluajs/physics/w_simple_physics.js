//
//	generated js from lua file
//
rat.modules.add( "rat.xuijs.wahooluajs.physics.w_simple_physics",
[
	{name: "rat.xuijs.wahooluajs.wahoolua", processBefore: true },
	{name: "rat.xuijs.wahooluajs.system.w_class", processBefore: true },
	{name: "rat.xuijs.wahooluajs.graphics.w_graphic_object", processBefore: true },
	"rat.xuijs.wahooluajs.math.w_vector3d",
], 
function(rat)
{

	// The other physics class was annoying me. It's too smart and too complicated. So I wrote this which just stores velocity and accel and uses those in the dumbest way possible to fake physics.
	// You're welcome

	var WSimplePhysics = wahoolua.class(wahoolua.WGraphicsObject);
	
	WSimplePhysics.prototype.Ctor = function (graphicParent) {
		WSimplePhysics.gUpdateList.push(this);

		this.StopAllForces();
		this.SetGravity(new WVector3D(0,0,0));
	};

	// use graphics to store position
	WSimplePhysics.gUpdateList = [];

	WSimplePhysics.prototype.Dtor = function() {
		RemoveItemFromUpdateList(this);
	};

	var RemoveItemFromUpdateList = function (item) {
		WSimplePhysics.gUpdateList = WSimplePhysics.gUpdateList.filter(function (el) {
			return el !== item;
		});
	};

	WSimplePhysics.prototype.UpdateAllPhysicsObjects = function(deltaTime) {
		for (var i=0; i < WSimplePhysics.gUpdateList.length; i++)
		{
			WSimplePhysics.gUpdateList[i].UpdateForces(deltaTime)
		}
	 };
	
	WSimplePhysics.prototype.AddForce = function(force) {
		force = new WVector3D(force.x || 0, force.y || 0, force.z || 0);
		this.Velocity = this.Velocity.Add(force);
	};
	
	WSimplePhysics.prototype.SetVelocity = function(vel) {
		if(this.Velocity == void 0){
			this.Velocity =  new WVector3D(0,0,0);
		}

		if(vel.x != void 0)
		{
			this.Velocity.x = vel.x;
		}
		if(vel.y != void 0)
		{
			this.Velocity.y = vel.y;
		}
		if(vel.z != void 0)
		{
			this.Velocity.z = vel.z;
		}
	};
	
	WSimplePhysics.prototype.GetVelocity = function() {
		return this.Velocity;
	};
	
	WSimplePhysics.prototype.StopAllForces = function() {
		this.Velocity = new WVector3D(0, 0, 0);
	};
	
	WSimplePhysics.prototype.SetGravity = function(g) {

		if(this.Acceleration == void 0){
			this.Acceleration =  new WVector3D(0,0,0);
		}

		if(g.x != void 0)
		{
			this.Acceleration.x = g.x;
		}
		if(g.y != void 0)
		{
			this.Acceleration.y = g.y;
		}
		if(g.z != void 0)
		{
			this.Acceleration.z = g.z;
		}
	};
	
	WSimplePhysics.prototype.GetGravity = function() {
		return this.Acceleration
	};
	
	WSimplePhysics.prototype.UpdateForces = function(deltaTime) {
		this.SetPosition(this.GetPosition().Add(this.Velocity.Scale(deltaTime)));	// do the movement
		this.Velocity = this.Velocity.Add(this.Acceleration.Scale(deltaTime));	// adjust our current velocity
	};

	wahoolua.WSimplePhysics = WSimplePhysics;

});
