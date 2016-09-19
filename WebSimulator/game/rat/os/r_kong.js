//
//	Common kongregate system-level support, including initializing the API
//
//	Note that we aggressively fake kong API access when we're not actually running inside Kongregate,
//	for ease of development.  See r_user_kong
//

rat.modules.add( "rat.os.r_kong",
[
	{ name: "rat.os.r_system", processBefore: true},
	{ name: "rat.os.r_user_kong", processBefore: true},
	{ name: "rat.utils.r_timer", processBefore: true},
	"rat.debug.r_console",
],
function(rat)
{
	rat.system.kong = rat.system.kong || {};
	var rkong = rat.system.kong;
	
	init_rat_kong = function()
	{
		rkong.fake = true;	//	let's assume we're faking it until told otherwise
		rkong.status = 'init';
		
		//	kong init
		if (typeof(kongregateAPI) === "undefined")
		{
			rat.console.log("Kong: kong module included, but no kongregateAPI available...");
			rat.console.log("remember to add kongregate API to html file");
			
		} else {
			//	some debugging...
			
			//	IN KONGREGATE SITE,
			//	window top is false, 
			//	window parent is false.
			//	parent is non-null.
			//	(window === window.top) returns false if we're in an iframe, which is what kongregate uses.
			//	So, it's a good way for now to detect kongregate.
			//	TODO: check our URL and see if we are konggames or something?
			//	We need to do this because kongregateAPI.loadAPI() simply never calls our callback if it's not really on kongregate,
			//	and we need to be able to fake the API otherwise.
			//	TODO:  Move all this to an r_kong module that encapsulates this stuff.
			//	better yet... move it to a more abstract r_host API or r_hostService or something.
			
			//rat.console.log("window top? " + (window === window.top));
			//rat.console.log("window parent? " + (window === parent));
			//rat.console.log("parent? " + (!!parent));
			
			if (window !== window.top)
			{
				rat.console.log("Kong: Initializing API...");
				rkong.status = 'pending';
				
				//	this load will take a moment to complete, and call our callback...
				kongregateAPI.loadAPI(function() {
					rkong.kongregate = kongregateAPI.getAPI();
					
					rkong.fake = false;
					rkong.status = 'ready';
				
					rat.console.log("kong API ready.");
					
					//	Init a few other rat kong-specific systems, if they exist.
					//	You can still choose to include a kong-specific module (like r_ads_kong) or not include it, but if it is included,
					//	now is a good time to initialize it.
					
					//	directly init user system
					rat.user.init(rkong);
					
					//	kong ads
					if (rat.ads && rat.ads.enableKong)
						rat.ads.enableKong();		//	why not automatic? probably ads system should listen for this.

					//	licensing (and purchase tracking)
					if (rat.license && rat.license.enableKong)
						rat.license.enableKong();
					
					//	queue or fire event saying the platform is ready.
					rat.events.queueEvent("platformReady", 'kong', null);
					
					rkong.focus();
				});
				
				//	and there's no way to detect an error.
				//	TODO: a timeout that does fake init if this fails?
				//	but it really shouldn't fail when really on kongregate.
				//	Yet it does?
			}
		}
		
		//	and if the above didn't work for any reason,
		//	then we're going to fake things.
		if (rkong.fake && rkong.status === 'init')
		{
			rkong.kongregate = null;
			rkong.fake = true;
			rkong.status = 'pending';
			
			rat.console.log("Kong: Faking it...");
			
			//	let's delay this a bit to more accurately fake delayed kong init.
			var timer = new rat.timer(function(arg)
				{
					rat.console.log("Delayed kong fake init");
					rkong.status = 'ready';
					rat.user.init(rkong);
				}, 0.2, null);
			timer.autoUpdate();
		}
	};
	
	rkong.isReady = function()
	{
		if (rkong.status === 'ready')
			return true;
		return false;
	};
	
	rkong.getUserId = function()
	{
		if (rkong.kongregate)
			return rkong.kongregate.services.getUserId();
		else
			return -1;
	};
	
	rkong.focus = function()
	{
		if (typeof(kongregateAPI) !== "undefined" && rkong.kongregate)
		{
			//	TODO:  Is this all needed, or just some of it?
			
			//rat.console.log("focus test z");
			if (window.top)
				window.top.focus();
			window.focus();
			rat.graphics.canvas.focus();
		}
	};
	
	//	hmm... doing this means we immediately set up kongregateAPI.loadAPI load call above,
	//	which quickly calls user setup code ... maybe this means we should require user_kong module to be processed first?
	init_rat_kong();
	
	
} );