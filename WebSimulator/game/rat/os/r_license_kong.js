//
//	App license management and IAP support for kongregate
//
rat.modules.add("rat.os.r_license_kong",
[
	{ name: "rat.os.r_license", processBefore: true },
	{ name: "rat.os.r_kong"},
],
function (rat) {
	
	//	I'm going to make this an explicit switch to turn on,
	//	because actually testing on real kong is a pain,
	//	and the built-in faking in r_license is useful when not actually running on kong,
	//	even for a kong-destined project.
	//	So, if kong is REALLY there, then call this function to turn on real kong licensing.
	//	TODO:  Do this with kong user system, too, instead of assuming it's there, if the module was included.
	
	var license = rat.license;
	var licenseKongEnabled = false;
	license.enableKong = function()
	{
		if (licenseKongEnabled)
			return;
		
		rat.console.log("rat.license: see if we can enable kong");
		
		if (typeof(kongregateAPI) === "undefined")
			return;
		var rkong = rat.system.kong;
		if (!rkong || !rkong.kongregate || !rkong.kongregate.mtx)
			return;
		
		rat.console.log("rat.license: Enabling Kong!");
		
		licenseKongEnabled = true;
		
		///	kong purchase ui?
		///	In the traditional sense (unlock this game), this doesn't exist.
		///	The only UI kong gives us is a kred purchase UI.
		license._OSPurchaseUI = function (userID) {
			var ksys = rat.system.kong.kongregate.mtx;
			ksys.showKredPurchaseDialog("offers");
		};
		
		//	purchase one or more items at once,
		//	and call my callback when done.
		license.purchaseItem = function(idList, metaData, callback)
		{
			rat.console.log("L purchaseItem");
			
			//var ksys = rat.system.kong.kongregate.services;
			var ksys = rat.system.kong.kongregate.mtx;
			
			ksys.purchaseItems(idList, callback);
		};
		
		//	request user item list.
		//	call callback when it's available.
		//	userName null for current player
		license.getUserItemList = function(userName, callback)
		{
			rat.console.log("L getUserItemList");
			//var ksys = rat.system.kong.kongregate.services;
			var ksys = rat.system.kong.kongregate.mtx;
			
			ksys.requestUserItemList(userName, callback);
			//	translate results?  Currently, the rat API matches the kong api.
		};
		
		//	consume an item, using the id from getUserItemList
		license.consumeItem = function(instanceID, callback)
		{
			rat.console.log("L consumeItem");
			
			//var ksys = rat.system.kong.kongregate.services;
			var ksys = rat.system.kong.kongregate.mtx;
			
			ksys.useItemInstance(instanceID, callback);
		};
		
	};
});