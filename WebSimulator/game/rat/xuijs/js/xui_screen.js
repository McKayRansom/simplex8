//
//	Main screen for handling Xui stuff
//
rat.modules.add( "rat.xuijs.js.xui_screen",
[
	{name: "rat.xuijs.js.xui_api", processBefore: true },
	{name: "rat.utils.r_utils", processBefore: true },
	{name: "rat.ui.r_screen", processBefore: true },
	
	"rat.debug.r_console",
	"rat.debug.r_profiler",
], 
function(rat)
{
	var xuijs = rat.xuijs;
	
	xuijs.XuiScreen = function()
	{
		xuijs.XuiScreen.prototype.parentConstructor.call(this); //	default init
	};
	rat.utils.inheritClassFrom(xuijs.XuiScreen, rat.ui.Screen);
	xuijs.XuiScreen.prototype._screenTag = "XUIScreen";
	
	xuijs.XuiScreen.prototype.updateSelf = function(dt)
	{
		// Call the update callback.
		// The callback should handle calling an appropriate function on the Lua side.
		// This keeps the XuiScreen separated from any Lua interaction.
		if( this.updateCallback ){
			rat.profiler.pushPerfMark( "XUIUpdate CB" );
			this.updateCallback(dt);
			rat.profiler.popPerfMark( "XUIUpdate CB" );
		}
		
		rat.profiler.pushPerfMark( "XUIElem Update" );
	};
	
	xuijs.XuiScreen.prototype.updateSelfPost = function()
	{
		rat.profiler.popPerfMark( "XUIElem Update" );
	};
	
	xuijs.XuiScreen.prototype.handleButtonDown = function (event)
	{
		// Call the buttonDown callback.
		// The callback should handle calling an appropriate function on the Lua side.
		// This keeps the XuiScreen separated from any Lua interaction.
		if( this.buttonDownCallback ){
			this.buttonDownCallback(event);
		}
		return false;
	};
	xuijs.XuiScreen.prototype.handleButtonUp = function (event)
	{
		// Call the buttonUp callback.
		// The callback should handle calling an appropriate function on the Lua side.
		// This keeps the XuiScreen separated from any Lua interaction.
		if( this.buttonUpCallback ){
			this.buttonUpCallback(event);
		}
		return false;
	};
	
	
	xuijs.XuiScreen.prototype.setUpdateCallback = function(updateCallback)
	{
		this.updateCallback = updateCallback;
	};
	
	xuijs.XuiScreen.prototype.setButtonCallbacks = function(buttonDownCallback, buttonUpCallback)
	{
		this.buttonDownCallback = buttonDownCallback;
		this.buttonUpCallback = buttonUpCallback;
	};
	
	xuijs.XuiScreen.prototype.addXuiElement = function(xuiElement)
	{
		this.appendSubElement(xuiElement);
	};
	
});
