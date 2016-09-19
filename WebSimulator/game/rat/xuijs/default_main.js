//
//	Entry point for the test application
//	07/21/2014 2012
//	John Salmond
//

//	This module either:
//	A)loads in the game by fully integrating into the rat.load system
//	B)loads in the game with the rat.js file and just starts the game
//	NOTE: This is really a sample file.  If your project has ANY specific files to load, you will need to make your own main.js

//
//	Load in my app using rat.load
//
function main()
{
	if( !rat.system.has.minified )
	{
		rat.load({
			exclude:[],
			addAsync:[
				"rat.xuijs.js.xui_api",
				"rat.xuijs.js.xui_parser",
				//gameSpecificJS.js,
			],
			update:function(args)
			{
			
			},
			done: function()
			{
				//rat.console.allow();
				XuiJSAppInit();
			}
		});
	}
	else
	{
		XuiJSAppInit();
	}
}

rat.load.setEntryPoint(main);
