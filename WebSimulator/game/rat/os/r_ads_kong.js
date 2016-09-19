//
//	Advertisement management for Kongregate API
//	Note that we aggressively fake this data when we're not actually running inside Kongregate,
//	for ease of development.
//
rat.modules.add( "rat.os.r_ads_kong",
[
	{ name: "rat.os.r_ads", processBefore: true},
	{ name: "rat.os.r_kong"},
	
	"rat.debug.r_console",
],
function(rat)
{
	rat.ads = rat.ads || {};
	
	var ads = rat.ads;
	var adsKongEnabled = false;
	ads.enableKong = function()
	{
		if (adsKongEnabled)	//	already enabled?
			return;
		rat.console.log("rat.ads: see if we can enable kong");
		
		if (typeof(kongregateAPI) === "undefined")
			return;
		var rkong = rat.system.kong;
		if (!rkong || !rkong.kongregate || !rkong.kongregate.mtx)
			return;
		
		rat.console.log("rat.ads: Enabling Kong!");
		
		adsKongEnabled = true;
		
		//	initialize some internal state
		ads.adsAreAvailable = false;	//	need to get event to tell us they're available
		
		//	turn on event listeners for kong ad events
		var mtx = rkong.kongregate.mtx;
		mtx.addEventListener("adsAvailable", function()
		{
			ads.adsAreAvailable = true;
		});
		mtx.addEventListener("adsUnavailable", function()
		{
			ads.adsAreAvailable = false;
		});
		mtx.addEventListener("adOpened", function()
		{
			ads.adPlaying = true;
		});
		mtx.addEventListener("adCompleted", function()
		{
			ads.onAdCompleted(ads.curAdInfo);
		});
		mtx.addEventListener("adAbandoned", function()
		{
			ads.onAdAbandoned(ads.curAdInfo);
		});
		
		//	now replace standard ads functions with kong ones.
		
		//	ads available?
		ads.adsAvailable = function()
		{
			return ads.adsAreAvailable;
		};
		
		//	start playing an ad
		ads.openAd = function () {
			rat.console.log("kong ad: openAd");
			ads.curAdInfo = {id:0};
			mtx.showIncentivizedAd();
			return ads.curAdInfo;
		};
		
		//	and turn on the system
		mtx.initializeIncentivizedAds();
	};
} );