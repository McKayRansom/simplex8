//
//	generated js from lua file
//
rat.modules.add( "rat.xuijs.wahooluajs.graphics.w_fake_3d",
[
	{name: "rat.xuijs.wahooluajs.wahoolua", processBefore: true },
	{name: "rat.xuijs.wahooluajs.system.w_class", processBefore: true },
	{name: "rat.xuijs.wahooluajs.graphics.w_graphic_object", processBefore: true },
	"rat.math.r_math",
	"rat.debug.r_console",
], 
function(rat)
{
	// Handles fakinking a 3D environment.
	
	// Handles converting the 3D space into screen space.
	// It's more like an abstract class to allow doing specific kinds of 3d spaces
	// in a cheep way.
	
	wahoolua.WFake3dCamera = wahoolua.class();

	// Converts a WVector3D from the 3D space to screen space.
	// Override this
	wahoolua.WFake3dCamera.prototype.Convert3dSpaceToScreenSpace = function(position) {
		return position
	}
	
	// Converts a WVector3D from the 3D space to screen space.
	// Override this
	wahoolua.WFake3dCamera.prototype.ConvertScreenSpaceTo3dSpace = function(position) {
		return position
	}
	
	// Finds the z-value for a point with the screen position (screenX, screenY) and
	// is at the elevation of spaceY in this fake 3D space.
	// Override this
	wahoolua.WFake3dCamera.prototype.FindZ = function(screenX, screenY, spaceY) {
		return 0
	}
	
	// Converts a WVector3D from the 3D space to screen space.
	// The parameter height3dspace specifies the height of the position in the 3d space.
	wahoolua.WFake3dCamera.prototype.ConvertScreenSpaceTo3dSpaceWithHeight = function(position, height3dspace) {
		position.z = this.FindZ(position.x, position.y, height3dspace)
		return this.ConvertScreenSpaceTo3dSpace(position)
	}
	
	// Converts WGraphicsObject's position from the 3D space to screen space.
	// The optional parameter height specifies the height of the object from the base.
	// The optional parameter groundedHeight specifies the elevation at the base of
	// the WGraphicsObject.
	wahoolua.WFake3dCamera.prototype.ConvertScreenSpaceWithHeightTo3dSpace = function(position, height, groundedHeight) {
		if ( height && groundedHeight ) {
			var elevation = groundedHeight - height
			return this.ConvertScreenSpaceTo3dSpaceWithHeight(position, elevation)
		}
		else {
			return this.ConvertScreenSpaceTo3dSpace(position)
		}
	}
	
	// Converts WGraphicsObject's position from the 3D space to screen space.
	// The optional parameter groundedHeight specifies the elevation at the base of
	// the WGraphicsObject.
	wahoolua.WFake3dCamera.prototype.ConvertWGraphicsObjectTo3dSpace = function(wgraphic, groundedHeight) {
		var position = WVector3D.new.apply(WVector3D, wgraphic.graphic.GetPosition())
		var height = wgraphic.GetHeight()
		return this.ConvertScreenSpaceWithHeightTo3dSpace(position, height, groundedHeight)
	}
	
	// Converts XuiElement's position from the 3D space to screen space.
	// The optional parameter groundedHeight specifies the elevation at the base of
	// the XuiElement.
	wahoolua.WFake3dCamera.prototype.ConvertXuiElementTo3dSpace = function(xuiElement, groundedHeight) {
		var position = WVector3D.new.apply(WVector3D, xuiElement.GetPosition())
		var height = xuiElement.GetHeight()
		return this.ConvertScreenSpaceWithHeightTo3dSpace(position, height, groundedHeight)
	}
	
	
	
	// Handles a graphic object in 3D space
	wahoolua.WFake3dObject = wahoolua.class(wahoolua.WGraphicsObject)
	
	// Sets up the camera to convert from the 3d space to screen space.
	// The optional parameter groundedHeight specifies the elevation at the base.
	wahoolua.WFake3dObject.prototype.SetCamera = function (camera, groundedHeight) {
		this.camera = camera
		this.position3d = camera.ConvertWGraphicsObjectTo3dSpace(this, groundedHeight)
	}
	
	// Gets the position in 3d space.
	// The camera needs to be set before calling this function.
	wahoolua.WFake3dObject.prototype.GetPosition = function () {
		return this.position3d
	}
	
	// Sets the 3d space position.
	// The camera needs to be set before calling this function.
	wahoolua.WFake3dObject.prototype.SetPosition = function (position) {
		this.position3d = position
		var positionScreen = this.camera.Convert3dSpaceToScreenSpace(position)
		this.graphic.SetPosition(positionScreen.x, positionScreen.y, positionScreen.z)
	}
	
	
	
	// The fake 3D enviroment that handles keeping the draw order constistant.
	// Call update after all of the objects have moved.
	wahoolua.WFake3dEnvironment = wahoolua.class()
	
	// Creates the 3d enviroment.
	// The scene is the XuiGroup that holds all of the graphics.
	// The camera is set to added objects to convert between 3d and screen spaces.
	wahoolua.WFake3dEnvironment.prototype.Ctor = function (scene, camera) {
		this.scene = scene;
		this.camera = camera;
		
		this.objects = [];
	}
	
	wahoolua.WFake3dEnvironment.prototype.Dtor = function () {
		if ( this.camera ) {
			this.camera.delete();
			this.camera = false;
		}
	}
	
	// Adds a WFake3dObject.
	// The optional parameter groundedHeight specifies the elevation at the base of the object.
	wahoolua.WFake3dEnvironment.prototype.AddObject = function (object, groundedHeight) {
	
		object.SetCamera(this.camera, groundedHeight);
		if ( !object.scene ) {
			object.scene = object.graphic;
		}
		object.SetXuiParent(this.scene);
		this.objects.push(object);
	
	}
	
	// Adds a XuiElement.
	// The optional parameter groundedHeight specifies the elevation at the base of the object.
	wahoolua.WFake3dEnvironment.prototype.AddXuiObject = function (xuiElement, groundedHeight) {
	
		var object = wahoolua.WFake3dObject.new();
		object.SetGraphic(xuiElement);
		object.SetTimelineObject(xuiElement);
		this.AddObject(object, groundedHeight);
		return object;
	
	}
	
	// Removes a WFake3dObject.
	wahoolua.WFake3dEnvironment.prototype.RemoveObject = function (object) {
	
		var index = this.objects.indexOf( object );
		if(index >= 0) {
			this.objects.splice( index, 1 );
		}
	
	}
	
	// Call Update every frame after all of the WFake3dObjects have moved.
	wahoolua.WFake3dEnvironment.prototype.Update = function (deltaTime) {
		
		// TODO: Think about only updating overlapping objects
		
		/* Idealy, this is only for debugging.
		// Removed dead graphics
		for i=this.length.objects, 1, -1 do
			if ( !this.objects[i].scene ) {
				WStdUtils.ErrPrintf("Warning: Fake 3D graphic "+this.objects[i].wFake3dEnvironmentId+" was not removed properly.")
				table.remove(this.objects, i)
			}
		}
		*/
		
		// Insertion sort since we expect the list to be almost sorted.
		for(var i = 1; i < this.objects.length; ++i) {
			var pivot = this.objects[i];
			var pivotZ = pivot.GetPosition().z;
			var j=i;
			while( j > 0 && this.objects[j-1].GetPosition().z < pivotZ ) {
				this.objects[j] = this.objects[j-1];
				j = j - 1;
			}
			
			if ( j!= i ) {
				pivot.SetDrawOrder(this.objects[j-1]);
				this.objects[j] = pivot;
			}
		}
		
	}
		
});
