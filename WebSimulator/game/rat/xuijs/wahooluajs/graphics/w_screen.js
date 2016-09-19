
rat.modules.add( "rat.xuijs.wahooluajs.graphics.w_screen",
[
	{name: "rat.xuijs.wahooluajs.wahoolua", processBefore: true },
	{name: "rat.utils.r_utils", processBefore: true },
	{name: "rat.xuijs.wahooluajs.system.w_cycleupdater", processBefore: true },
	
	"rat.xuijs.js.xui_api",
	"rat.xuijs.wahooluajs.system.w_inputmap",

	{name: "rat.xuijs.wahooluajs.graphics.w_graphic_object", processBefore: true },
	"rat.xuijs.wahooluajs.graphics.w_scene",
	"rat.xuijs.wahooluajs.math.w_vector3d",
], 
function(rat)
{
	//	TODO: Subclass of WCycleUpdater (or some other solution)
	//	Note:  This class is NOT a subclass of any xui element or other visual class - it HAS a scene, but isn't one.
	
	var WScreen = wahoolua.class(wahoolua.WCycleUpdater);
	
	var ACTION_DO_NOTHING = "DO NOTHING";
	/**
	 * @constructor WScreen Ctor
	 */
	WScreen.prototype.Ctor = function (parentScene, asset)
	{
		//	asset is normally a property that's set earlier?  Weird.  Not sure how that works.
		//	maybe something strange about how class inheritance is handled in wahoolua
		this.name = "Screen";
		this.isDeactivated = true;	//	We start deactivated because we are not yet on the screens stack
		
		asset = this.asset || asset;
		if (asset)
		{
			//	use xuiscene stuff
			var xuiElement = xuijs.apiUtils.createXuiItemFromFile(asset, true);
			this.scene = xuiElement;
			
			if (parentScene)
			{
				this.parentScene = parentScene;
				this.parentScene.AddChild(this.scene);
			}
		}
	
		this.attachedButtonMap = null;
	};

	//	Destroy and cleanup this screen
	WScreen.prototype.Dtor = function()
	{
		//	Clean up our input map if we have one.
		this.ClearInputMap()

		//	Take us out of the screen scene
		if (this.scene) {
			this.scene.Unlink()
			this.scene.DestroyObject();
			this.scene = null;
		}
	};

	//	Setup the input map for this screen
	WScreen.prototype.SetupInputMap = function( buttonMap, buttonsPane )
	{
		/*	PORT: todo: this stuff
		if not buttonsPane {
			buttonsPane = this.scene.Buttons;
		}
		if this.attachedButtonMap == buttonMap {
			return;
		}
		this.attachedButtonMap = buttonMap;
		if this.inputMap {
			this.inputMap:delete();
		}
		if this.attachedButtonMap {
			this.inputMap = WInputMap:new(this.attachedButtonMap, buttonsPane);
		}
		*/
	};

	WScreen.prototype.ClearInputMap = function()
	{
		if (this.inputMap) {
			this.inputMap.Dtor();
			this.attachedButtonMap = null;
			this.inputMap = null;
		}
	};

	//	Setup the legend
	WScreen.prototype.SetupLegend = function( map )
	{
		/*	PORT: todo: this stuff
		this.legendInfo = map or {};
		// if we're active right now, update our legend on the screen immediately.
		if not this.isDeactivated {
			this.UpdateLegend();
		}
		*/
	};

	//	Update the legend to be correct
	WScreen.prototype.UpdateLegend = function ( map )
	{
		/*	PORT: todo: this stuff
		if this.legendInfo {
			for button, text in pairs(this.legendInfo) do
				WScreenStack.SetLegend( button, text );
			}
		}
		*/
	};

	//	Update this screen
	WScreen.prototype.CycleUpdate = function(deltaTime)
	{
	};

	//	Is this screen ready to close
	WScreen.prototype.ShouldExit = function()
	{
		return (this.exitScreen == true);
	};

	//	Called to tell the screen it is ready to close
	WScreen.prototype.ExitScreen = function()
	{
		this.exitScreen = true;
	};

	//	Called to indicate that we have handled the exit screen
	WScreen.prototype.HaveExited = function()
	{
		this.exitScreen = false;
	};

	// a place to do screen specific stuff (to get it out of the main scene
	WScreen.prototype.Update = function(deltaTime)
	{
	};

	//	Umm..> Not sure what this is for
	WScreen.prototype.SetDefaultControl = function()
	{ 
	};

	//	Called when we are no longer the top screen
	WScreen.prototype.DeactivateScreen = function()
	{
		this.isDeactivated = true;
	};

	//	Called when we become the top screen
	WScreen.prototype.ActivateScreen = function()
	{
		this.isDeactivated = false;
		this.UpdateLegend();
	};

	//	Execute the given action
	WScreen.prototype.ExecuteCommand = function(action, actionParam, varargs)
	{
		/*
		//	PORT: TODO: varargs support here!  array.split or whatever
		this.exit = action;
		this.exitParam = actionParam;
		this.exitArgs = {unpack(arg)};
		//WStdUtils.printf( "ExecuteCommand called for " + this.screenName );
		this.ExitScreen();
		*/
	};

	//	Handle key presses
	WScreen.prototype.HandleKeyDown = function(keycode)
	{
		if (this.ShouldExit()) {
			return true;
		}

		// Check for input
		//	TODO: modal/nonmodal support - if we're modal, always eat up all key events.
		
		var handled;
		if (this.inputMap) {
			handled = this.inputMap.HandleKeyDown(keycode);
			if (handled) {
				return handled;
			}

			//	Trigger the button?
			if (keycode === "VK_PAD_A" || keycode === "VK_PAD_START") {
				var button = this.inputMap.GetButton();
				//	Watch for the doNothing action
				if (button.action && button.action !== ACTION_DO_NOTHING) {
					this.ExecuteCommand( button.action, button.actionParam, unpack(button.actionArgs) );
					return true;
				}
			}
		}

		return false;
	};

	//	Handle released keys
	WScreen.prototype.HandleKeyUp = function(keycode)
	{
		if (this.ShouldExit()) {
			return true;
		}
		
		return false;
	};

	//	Change the default target of the input map to whatever button we are targeting now
	WScreen.prototype.RememberTarget = function()
	{
		/*	PORT: todo: this?
		//	No map?
		if (!this.attachedButtonMap) {
			return;
		}
		
		//	No button?
		var button = this.inputMap.GetButton();
		if (!button) {
			return;
		};
		
		//	Change the default
		//	TODO: fix default var
		this.attachedButtonMap.default = button.indexInButtonMap;
		*/
	};

	//	more globally accessible class
	wahoolua.WScreen = WScreen;

});