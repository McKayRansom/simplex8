//
//	Advertising management.
//	This includes several kinds of ads, potentially, like banner ads and opt-in video ads.
//
//	This is the generic implementation that pretends like there are ads and they're being played.
//	include the proper module for the target OS you want, like r_ads_kong for kongregate.
//
//	TODO: Look at other Ad APIs and expand/improve this wrapper.
//
rat.modules.add("rat.os.r_ads",
[
	{ name: "rat.os.r_system", processBefore: true },
	{ name: "rat.os.r_events", processBefore: true },
	{ name: "rat.utils.r_messenger", processBefore: true},
	{ name: "rat.utils.r_timer", processBefore: true},
	"rat.debug.r_console",
],
function (rat) {
	var ads = {	//	ads namespace
		
		adPlaying : false,
		
		//	Note: all this "info" structure stuff is totally fake and placeholder,
		//	and I have no idea if it'll be useful later, but I wanted to make room.
		//	Feel free to add fields or use it how you like.
		curAdInfo : null,
		curAdTimer : null,
	};
	rat.ads = ads;
	rat.ads.messages = new rat.Messenger();
	var messageType = {
		AdsAvailable: "adsAvailable",
		AdsUnavailable: "adsUnavailable",
		AdOpened: "adOpened",
		AdCompleted: "adCompleted",
		AdAbandoned: "adAbandoned",
	};
	rat.ads.messageType = messageType;
	
	///	Return true if there are ads available, as far as we know.
	ads.adsAvailable = function () {
		return true;
	};

	///	called when an ad is completed (and player should be rewarded)
	ads.onAdCompleted = function (info) {
		ads.adPlaying = false;
		ads.curAdInfo = null;
		ads.curAdTimer = null;
		rat.ads.messages.broadcast("adCompleted", info);
	};
	
	///	called when an ad is abandoned
	ads.onAdAbandoned = function (info) {
		ads.adPlaying = false;
		if (ads.curAdTimer)
			ads.curAdTimer.endAutoUpdate();
		ads.curAdInfo = null;
		ads.curAdTimer = null;
		rat.ads.messages.broadcast("adAbandoned", info);
	};
	
	///	get information about the ad that's currently playing.
	///	This implementation is unclear - right now, I think "time" is the only semi-dependable variable here...
	ads.getAdPlaying = function()
	{
		if (ads.adPlaying)
		{
			if (ads.curAdTimer)
				ads.curAdInfo.time = ads.curAdTimer.currentTime;
			else
				ads.curAdInfo.time = 0;
			return ads.curAdInfo;
		}
		else
			return null;
	};

	///	start playing an ad video.
	///	returns ad info.
	ads.openAd = function () {
		ads.adPlaying = true;
		
		ads.curAdInfo = {id:0};
		
		//	since this mdule fakes ads by default, set up a timer to end playback
		rat.console.log("fake ad: start");
		var timer = new rat.timer(function()
			{
				//	fake complete
				rat.console.log("fake ad: complete.");
				ads.onAdCompleted(ads.curAdInfo);
				
				//	fake abandoned
				//rat.console.log("fake ad: abandon.");
				//ads.onAdAbandoned(ads.curAdInfo);
			}, 2, null);
		timer.autoUpdate();
		ads.curAdTimer = timer;
		
		return ads.curAdInfo;
	};
	
	//	explicitly abandon this ad.
	//	This is not supported by some systems (e.g. kongregate), since that's a user choice.
	//	But it's useful at least for testing.
	ads.abandonAd = function () {
		if (ads.adPlaying && ads.curAdInfo)
		{
			ads.onAdAbandoned(ads.curAdInfo);
		}
	};
	
	///	mostly for debugging and faking ads
	ads.renderFrame = function(ctx)
	{
		//	draw fake ad with countdown timer?
	};
	
	///	need update function?
	
});