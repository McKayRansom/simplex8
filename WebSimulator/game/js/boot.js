//
//	Game boot
//
//	This module either:
//	A)loads in the game by fully integrating into the rat.load system
//	B)loads in the game with the rat.js file and just starts the game

//
//	Load in my app using rat.load
//
function load()
{
	if( !rat.system.has.minified )
	{
		
		rat.load({
			//verbose:true,
			exclude:[],
			//	this is the lazy  (and incorrect) approach to specifying dependencies all at once instead of per module.
			addAsync:[
				"rat/ui/r_screen.js",
				"rat/ui/r_ui_scrollview.js",
				"rat/graphics/r_particle.js",
				"rat/live/r_telemetry.js",
				"rat/audio/r_audio.js",

				//"rat/utils/r_hexgrid.js",
			],
			
			//	TODO:  load these async, and correctly set up dependencies!
			
			addSync:[
				"js/app.js",
				"js/audio.js",
				//"js/graphics/gfx.js",
				
				"js/graphics/effects.js",
				"js/game.js",
				"js/simulation.js",
				
				"js/ui/ui.js",
				"js/ui/ui_audio.js",
				"js/ui/game_screen.js",
				
				"js/utils/firebase.js",
			],
			update:function(args)
			{
			
			},
			done: function()
			{
				app.init();
			}
		});
	}
	else
	{
		rat.modules.process();
		app.init();
	}
}

// this will happen once all scripts above it have been run
rat.load.setEntryPoint( load );

