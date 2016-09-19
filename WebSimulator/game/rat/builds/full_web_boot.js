//
//	A load call for loading all of standard rat for web/browser.  This is used to generate full_web_modules, and then rat.js
//
//	This is probably never actually called - it's just a convenient way for our toolset to understand what to start with in terms of
//	tracking dependencies and knowing what files to include in a final concatenated js file.
//

function full_web_boot()
{
	if( !rat.system.has.minified )
	{
		rat.load({
			//verbose:true,
			exclude:[],
			
			//	standard rat modules
			//
			//	note: r_base is the only module assumed to always be needed.
			//	note: I'm leaning on dependencies here so I don't have to list *everything*, which would be difficult to maintain.
			//	I am trying to get a "full" version of rat here, without explicitly naming all the files.  This should work.

			addAsync:[
				"rat/audio/r_audio.js",
				
				"rat/debug/r_console.js",
				"rat/debug/r_profiler.js",
				
				"rat/graphics/r_graphics.js",
				"rat/graphics/r_image.js",
				"rat/graphics/r_offscreen.js",
				"rat/graphics/r_particle.js",
				"rat/graphics/r_rectlist.js",
				"rat/graphics/r_video.js",
				
				"rat/input/r_input.js",
				//"rat/input/r_rumble.js",	//	hmm...
				
				"rat/live/r_achievements.js",
				"rat/live/r_scoreboard.js",
				"rat/live/r_telemetry.js",
				
				//	math modules always load
				
				"rat/os/r_events.js",
				"rat/os/r_user.js",
				
				"rat/storage/r_settings.js",
				"rat/storage/r_storage.js",
				"rat/storage/r_storage_firebase.js",
				
				//	no test folder
				
				"rat/ui/r_notificationmanager.js",
				"rat/ui/r_screenmanager.js",
				
				"rat/ui/r_ui.js",
				"rat/ui/r_ui_animator.js",
				"rat/ui/r_ui_bubblebox.js",
				"rat/ui/r_ui_button.js",
				"rat/ui/r_ui_data.js",
				"rat/ui/r_ui_fill.js",
				"rat/ui/r_ui_fillbar.js",
				"rat/ui/r_ui_fillsprite.js",
				"rat/ui/r_ui_offscreenimage.js",
				"rat/ui/r_ui_scrollview.js",
				"rat/ui/r_ui_shape.js",
				"rat/ui/r_ui_spiderchart.js",
				"rat/ui/r_ui_sprite.js",
				"rat/ui/r_ui_textbox.js",
				
				"rat/utils/r_bezier.js",
				"rat/utils/r_collision2d.js",
				"rat/utils/r_cycleupdate.js",
				"rat/utils/r_hexgrid.js",
				"rat/utils/r_keyframeanimator.js",
				"rat/utils/r_messenger.js",
				"rat/utils/r_nodegraph.js",
				"rat/utils/r_preload.js",
				"rat/utils/r_shapes.js",
				"rat/utils/r_spline.js",
				"rat/utils/r_string.js",
				"rat/utils/r_timer.js",
				"rat/utils/r_utils.js",
				"rat/utils/r_wordwrap.js",
				
				//	no wraith
				//	no xuijs :(
				
			],
			
			update:function(args)
			{
			
			},
			done: function()
			{
				
			}
		});
	}
	else
	{
		rat.modules.process();
	}
}

// this will happen once all scripts above it have been run
//rat.load.setEntryPoint( full_web_boot );
