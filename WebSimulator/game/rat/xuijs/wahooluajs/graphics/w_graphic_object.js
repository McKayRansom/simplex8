//
//	generated js from lua file
//
rat.modules.add( "rat.xuijs.wahooluajs.graphics.w_graphic_object",
[
	{name: "rat.xuijs.wahooluajs.wahoolua", processBefore: true },
	{name: "rat.xuijs.wahooluajs.system.w_class", processBefore: true },
	"rat.xuijs.wahooluajs.graphics.w_scene",
	"rat.xuijs.wahooluajs.math.w_vector3d",
], 
function(rat)
{
		// GraphicsObject
	// Attaches to an Xui Graphics Object

	var gXUITopLevel = null
	
	var WGraphicsObject = wahoolua.class();
	
	WGraphicsObject.prototype.Ctor = function(parent) {
		this.linkedByMe = false;			// we need to know if ( the object was created || move here. if it is ) { its safe to destroy, otherwise the object may still exist and we shouldnt destroy it
		if ( this.asset ) {
			this.LoadGraphic(parent, this.asset)
		}
	};

	WGraphicsObject.gExiting = null;
	
	WGraphicsObject.prototype.Dtor = function() {
		// we need to know if ( the object was created || move here. if it is ) { its safe to destroy, otherwise the object may still exist and we shouldnt destroy it
		// we may want to add a 'force' option here
		if ( this.scene && this.linkedByMe ) {
			//print("destroy object on id " + this.scene.GetId())
			this.scene.Unlink();
			this.scene.DestroyObject();
			this.scene = false;
		}
	};
	
	WGraphicsObject.prototype.LoadGraphic = function(parent, asset) {
		this.scene = wahoolua.WScene.Create( asset );
		this.SetGraphic(this.scene);
		this.SetTimelineObject(this.scene);
		parent.AddChild(this.scene);
		this.linkedByMe = true;
		this.parent = parent
	}
	
	WGraphicsObject.prototype.SetGraphic = function()
	{
		this.frames = [];
		for (var i = 0; i < arguments.length; i++)
		{
			this.frames[i] = arguments[i];
			this.frames[i].SetShow(false)
		}
		this.graphic = this.frames[0];
		this.SetFrame(0);
	}
	
	// Sets the parent to the provided XuiElement
	WGraphicsObject.prototype.SetXuiParent = function(parent) {
		this.scene.Unlink();
		parent.AddChild(this.scene);
		this.linkedByMe = true;
		this.parent = parent;
	}
	
	WGraphicsObject.prototype.Hide = function() {
		if ( WGraphicsObject.gExiting == true )
		{
			return;
		}
	
		this.graphic.SetShow(false)
	};
	
	WGraphicsObject.prototype.Show = function() {
		if ( WGraphicsObject.gExiting == true ) { return }
	
		this.graphic.SetShow(true)
	}
	
	WGraphicsObject.prototype.IsShown = function() {
		if ( WGraphicsObject.gExiting == true ) { return }
		return this.graphic.IsShown()
	}
	
	//	Get position (using pivot point)
	WGraphicsObject.prototype.GetPosition = function() {
		if ( WGraphicsObject.gExiting == true ) { return false; }
	
		var vars0 =  this.graphic.GetPosition();

		x = vars0[0];
		y = vars0[1];
		z = vars0[2];
		var vars1 =  this.graphic.GetPivot();

		px = vars1[0];
		py = vars1[1];
		pz = vars1[2];
		return new WVector3D(x+px, y+py, z+pz);
	}
	
	//	Set position (using pivot point) of all frames in this object
	WGraphicsObject.prototype.SetPosition = function(vector) {
		if ( WGraphicsObject.gExiting == true ) { return }
	
		var vars2 =  this.graphic.GetPivot();

		px = vars2[0];
		py = vars2[1];
		pz = vars2[2];
		var x = vector.x || 0;
		var y = vector.y || 0;
		var z = vector.z || 0;
	
		for(var i=0; i < this.frames.length; i++)
		{
			this.frames[i].SetPosition(x-px, y-py, z-pz);
		}
	}
	
	WGraphicsObject.prototype.GetPivot = function() { return new WVector3D(this.graphic.GetPivot()) }
	
	//	Set pivot offset inside this object's space
	WGraphicsObject.prototype.SetPivot = function(vector) {
		this.graphic.SetPivot(vector.x || 0, vector.y || 0, vector.z || 0)
	}
	
	WGraphicsObject.prototype.SetOpacity = function(opacity) {
		if ( WGraphicsObject.gExiting == true ) { return }
	
		this.graphic.SetOpacity(opacity);
		for( var i=0; i < this.frames.length; i++)
		{
			this.frames[i].SetOpacity(opacity);
		}
	}
	
	WGraphicsObject.prototype.GetOpacity = function() {
		if ( WGraphicsObject.gExiting == true ) { return 0; }
		return this.graphic.GetOpacity();
	}
	
	WGraphicsObject.prototype.SetFrame = function(index) {
		if ( WGraphicsObject.gExiting == true ) { return }
	
		//assert(index >= 0 && index < this.frames.length, "ERROR: Invalid frame index "+index)
		this.graphic.SetShow(false);
		this.graphic = this.frames[index];
		this.graphic.SetShow(true)
	}
	
	WGraphicsObject.prototype.SetScale = function(vector) {
		if ( WGraphicsObject.gExiting == true ) { return }
	
		var x = vector.x || 1;
		var y = vector.y || vector.x;
		var z = vector.z || vector.x;
	
		for(var i=0; i < this.frames.length; i++)
		{
			this.frames[i].SetScale(x, y, z);
		}
	};
	
	WGraphicsObject.prototype.GetScale = function() {
		return new WVector3D(this.graphic.GetScale());
	};
	
	WGraphicsObject.prototype.GetRotation = function() {
		if ( WGraphicsObject.gExiting == true ) { return 0; }
	
		return this.Rotation
	};
	
	WGraphicsObject.prototype.SetRotation = function(rotation) {
		if ( WGraphicsObject.gExiting == true ) { return }
	
		this.Rotation = rotation;
		for(var i=0; i < this.frames.length; i++)
		{
			this.frames[i].SetRotation(rotation.x, rotation.y, rotation.z);
		}
	};
	
	WGraphicsObject.prototype.PlayTimeline = function(startFrame, endFrame, recurse) {
		if ( WGraphicsObject.gExiting == true ) { return }
	
		endFrame = endFrame || startFrame;
		recurse = recurse || false;
	
		if ( this.TimelineObject != false ) {
			this.TimelineObject.PlayTimeline(startFrame, endFrame, recurse);
			//print(string.format("Playing timeline "+startFrame+", "+endFrame+" with recursive=" + recurse)
		}
	}
	
	WGraphicsObject.prototype.SetTimelineObject = function(timelineObject) {
		this.TimelineObject = timelineObject;
	}
	
	
	WGraphicsObject.prototype.GetOffset = function() {
		var topLevel = gXUITopLevel || 'XuiScene1';	//use the default scene if none provided
		// Warning: This will loop forever if it doesn't find the top level
	
		// Returns the offset of this object based on it's groups
		var ox = 0;
		var oy = 0;
		var oz = 0;
		if ( topLevel ) {
			var parent = this.graphic.GetParent();
			while (parent &&  parent.GetId() !== topLevel)
			{
				var vars4 =  parent.GetPosition();

				var tx = vars4[0];
				var ty = vars4[1];
				var tz = vars4[2];
				ox = ox + tx; oy = oy + ty; oz = oz + tz;
					parent = parent.GetParent()
			}
		}
	
		return [ox, oy, oz]
	};
	
	WGraphicsObject.prototype.GetGlobalPosition = function() {
		if ( this.graphic != null ) {
			var vars5 =  this.GetPosition();

		var gx = vars5[0];
		var gy = vars5[1];
		var gz = vars5[2];
		var vars6 =  this.GetOffset();

		var ox = vars6[0];
		var oy = vars6[1];
		var oz = vars6[2];

			return [gx + ox, gy + oy, gz + oz]
		}
	
		return [-1,-1,-1]
	}
	
	WGraphicsObject.prototype.GetWidth = function() {
		if ( this.graphic != null ) {
			return this.graphic.GetWidth()
		}
	
		return -1
	}
	
	WGraphicsObject.prototype.GetHeight = function() {
		if ( this.graphic != null ) {
			return this.graphic.GetHeight()
		}
	
		return -1;
	}
	
	WGraphicsObject.prototype.SetWidth = function(w) {
		if ( this.graphic ) {
			this.graphic.SetWidth(w)
		}
	}
	
	WGraphicsObject.prototype.SetHeight = function(h) {
		if ( this.graphic ) {
			this.graphic.SetHeight(h)
		}
	}
	
	// A cheap trick to reset draw order
	WGraphicsObject.prototype.ResetDrawOrder = function() {
		if ( this.parent && this.scene ) {
			this.scene.Unlink();
			this.parent.AddChild(this.scene);
		}
	}
	
	// Sets the drawing order to be drawn after/over the previousChild.
	// The input previousChild is a WGraphicsObject or the index of the previous
	// child. If it is null, this will be set to draw first/on the bottom.
	WGraphicsObject.prototype.SetDrawOrder = function(previousChild) {
		if ( this.parent && this.scene ) {
			this.scene.Unlink();
			
			var previousChildXui = null;
			if ( typeof(previousChild) == "number" ) {
				// previousChild is the index of the previous child
				var childIterator = this.parent.GetFirstChild();
				if ( previousChild > 1 ) {
					for(var i=1; i <= previousChild; i++)
					{
						childIterator = childIterator.GetNext();
					}
				}
				previousChildXui = childIterator;
			}
			else {
				previousChildXui = previousChild && previousChild.scene || null;
			}
			
			var nextChildXui = previousChildXui && previousChildXui.GetNext() || this.parent.GetFirstChild();
			
			this.parent.InsertChild(this.scene, previousChildXui, nextChildXui);
		}
	}
	wahoolua.WGraphicsObject = WGraphicsObject;

});
