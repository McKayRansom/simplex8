//
//	Game boot
//
//	This module loads and initializes rat and game code using rat.load()
//
function load()
{
	rat.load({
		//verbose:true,
		exclude : [],
		
		addAsync : [
			//	if dependencies are set up right, we just need to name app.js explicitly here,
			//	and rat will find the rest of the files.
			"js/app.js",
			
			//	you could list explicit rat modules here,
			//	but normally if we've listed dependencies correctly, it's not needed.
			//	and normally you're using a concatenated and compiled rat with everything
			//	loaded at once anyway.
			
			//	and here's where you can load other dependent modules
			//	that know nothing about rat.
			//"js/utils/firebase.js",
		],
		
		addSync : [
			//	you can load files in a synchronous order here, if you don't want to
			//	specify dependencies, and just want to load your files:
			//	js/blah.js
		],
		
		update : function(args)
		{
		},
		
		done : function()
		{
			//	rat load and process is done.  Initialize the app object that we loaded above.
			app.init();
		}
	});
}

// this will happen once all scripts above it have been run
rat.load.setEntryPoint( load );

