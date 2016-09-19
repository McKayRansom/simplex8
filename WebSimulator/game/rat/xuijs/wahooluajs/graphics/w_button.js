//
//	generated js from lua file
//
rat.modules.add( "rat.xuijs.wahooluajs.graphics.w_button",
[
	{name: "rat.xuijs.wahooluajs.wahoolua", processBefore: true },
	{name: "rat.utils.r_utils", processBefore: true },
	{name: "rat.xuijs.wahooluajs.graphics.w_graphic_object", processBefore: true },
	
	"rat.xuijs.wahooluajs.graphics.w_scene",
	"rat.xuijs.wahooluajs.math.w_vector3d",
], 
function(rat)
{
	//	constructor
	var WButton = function(refScene, xuiFile, state)
	{
		//	no parent given us, so don't pass one to graphicsobject constructor
		WButton.prototype.parentConstructor.call(this, null); //	parent class constructor
		
		//console.log("WLUA: === new button");
		
		if ( this.asset ) {
			this.scene = this.graphic // preloaded by WGraphicsObject
		}
		else if ( xuiFile ) {
			this.scene = WScene.Create( xuiFile )
			this.parent = refScene.GetParent()
			this.parent.AddChild(this.scene)
			
			this.SetGraphic(this.scene)
			var pos =  refScene.GetPosition()

			var x = pos.x;
			var y = pos.y;
			//var _ = pos.z;
			this.SetPosition(new WVector3D(x,y,0))	//	port: using WVector3D for quick fix.
		}
		else {
			this.scene = refScene
			this.SetGraphic(this.scene)
		}
	
		this.SetTimelineObject(this.scene)	// set this up initially for buttons without enable/disable
		this.Enable()
		this.SetState(state)	//	this will jump to the } of the focus state timeline, which is what we want.
	
		//	Hi there!  I wrote some code to go stop all sounds if we were getting created focused,
		//	But it turns out we can just do that in data, since SetState() jumps to the } of that timeline (doesn't play the whole timeline)
		//	I'm going to leave this commented-out code here in case we want something fancier later...
		//if ( (state == "focus" && this.scene && this.scene.enabled) ) {
		//	this.StopAllSounds(this.scene.enabled);
		//}	
	}
	rat.utils.inheritClassFrom(WButton, wahoolua.WGraphicsObject);
	
	//	destructor
	WButton.prototype.Dtor = function() {
		WButton.prototype.parentPrototype.Dtor.call(this); //	default destructor
	}
	
	//	Given a scene in the button (e.g. enabled or disabled scene) stop any sound we find at that level.
	//	Kinda useful generic function?  And an example of using GetXuiElementType()
	WButton.prototype.StopAllSounds = function(scene) {
		//local sound = this.scene.enabled.GetChildById("select");	//	for some reason, I can't just access this by field name.
	
		var child = scene.GetFirstChild();
		while (child) {
			//print("thing: " + child.GetId());
			var xtype = WStdUtils.GetXuiElementType(child);
			//print("xui type: " + xtype);
			if ( (xtype == "XuiSound") ) {
				//print("stopping sound");
				child.Stop();
			}
			child = child.GetNext();
		}
	}
	
	WButton.prototype.Enable = function() {
		if ( this.scene["enabled"] ) {
			this.scene["enabled"].SetShow(true)
			this.scene["disabled"].SetShow(false)
			this.SetTimelineObject(this.scene["enabled"])
			this.SetState(this.state)
		}
		this.enabled = true
	}
	
	WButton.prototype.IsEnabled = function() {
		return this.enabled
	}
	
	WButton.prototype.Disable = function() {
		if ( this.scene["disabled"] ) {
			this.scene["disabled"].SetShow(true)
			this.scene["enabled"].SetShow(false)
			this.SetTimelineObject(this.scene["disabled"])
			this.SetState(this.state)
		}
		this.enabled = false
	}
	
	WButton.prototype.GetState = function() {
		return this.state
	}
	
	WButton.prototype.SetState = function(state) {
		state = state || "blur"
		this.state = state
		state = state + "_stop"
		this.PlayTimeline(state, state, false)
	}
	
	WButton.prototype.Focus = function() {
		this.PlayTimeline("focus_start", "focus_stop", false)
		this.state = "focus"
	}
	
	WButton.prototype.Blur = function() {
		// TODO: make sure we're not pressed?
		this.PlayTimeline("blur_start", "blur_stop", false)
		this.state = "blur"
	}
	
	WButton.prototype.Press = function() {
		this.PlayTimeline("select_start", "select_stop", false)
		this.state = "select"
	}
	
	WButton.prototype.Up = function() {
		this.PlayTimeline("up_start", "up_stop", false)
		this.state = "blur"
	}
	
	WButton.prototype.Down = function() {
		this.PlayTimeline("down_start", "down_stop", false)
		this.state = "blur"
	}
	
	WButton.prototype.Left = function() {
		this.PlayTimeline("left_start", "left_stop", false)
		this.state = "blur"
	}
	
	WButton.prototype.Right = function() {
		this.PlayTimeline("right_start", "right_stop", false)
		this.state = "blur"
	}
	
	wahoolua.WButton = WButton;
	
});
