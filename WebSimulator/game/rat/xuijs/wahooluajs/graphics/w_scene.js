
//
//	WScene implementation
//	Just maps directly to a rat-supported xui element!
//

rat.modules.add( "rat.xuijs.wahooluajs.graphics.w_scene",
[
	{name: "rat.xuijs.wahooluajs.wahoolua", processBefore: true },
	
	"rat.xuijs.js.xui_api",
], 
function(rat)
{
	var WScene = {};
	WScene.Create = function(xuiFile)
	{
		var xuiElement = xuijs.apiUtils.createXuiItemFromFile(xuiFile, true);
		return xuiElement;
	};

	//	more global access
	wahoolua.WScene = WScene;
	
});