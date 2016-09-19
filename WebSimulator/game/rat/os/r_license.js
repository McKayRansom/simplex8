//
//	App license and in-app-purchase (IAP) management.
//	This module also includes some fake purchase support for testing IAP outside of an actual platform.
//
rat.modules.add("rat.os.r_license",
[
	{ name: "rat.os.r_user", processBefore: true },
	{ name: "rat.os.r_system", processBefore: true },
	{ name: "rat.os.r_events", processBefore: true },
	{ name: "rat.utils.r_timer", processBefore: true},

	{ name: "rat.os.r_license_winjs", platform: "winJS" },
	"rat.debug.r_console",
],
function (rat) {
	var license = {
		osIsLicensed: false,
		forceLicenseTo: void 0
	};
	rat.license = license;
	rat.License = license;	//	old naming for backcompat - should have been lowercase namespace, right?

	//	fake list of potentially purchasable stuff.
	//	Modeled after kongregate.  uses 0 means infinite use.  normal consumable stuff should have 1 use.
	var fakeCatalog = [
		{identifier:'frogbuddy', name:"Frog Buddy", description: "A frog buddy that will be your best friend forever", uses:0},
		{identifier:'acorn1', name:"Acorn", description: "A consumable acorn", uses:1},
	];
	var fakeInventory = [];	//	fake inventory of owned stuff.
	var fakeInventoryNextInstanceID = 1;

	//	Return if the game is owned
	license.isOwned = function () {
		if (license.forceLicenseTo !== void 0)
			return license.forceLicenseTo;
		else
			return license.osIsLicensed;
	};

	///	called when the License state changes
	var lastOwned = false;
	license.onLicenseChange = function () {
		var owned = license.isOwned();
		if (lastOwned === owned)
			return;

		rat.events.fire("licenseChanged", owned, lastOwned);
		lastOwned = owned;
	};

	///	Force the game as licensed or not..
	///	an undefined value (void 0) means use real system state (don't force)
	license.forceLicenseState = function (isOwned) {
		license.forceLicenseTo = isOwned;
		license.onLicenseChange();
	};
	///	unforce license state - the same as calling forceLicenseState(void 0), just a clearer way to do it.
	license.unforceLicenseState = function () {
		license.forceLicenseState(void 0);
	};

	///	launch the purchase UI
	license.launchPurchaseUI = function (forUserID) {
		forUserID = forUserID || rat.user.getActiveUserID();
		license._OSPurchaseUI(forUserID);
	};
	
	//	purchase one or more items at once,
	//	and call my callback when done.
	//	Should be overridden by real implementations.  This one is a generic fake API.
	license.purchaseItem = function(idList, metaData, callback)
	{
		//	fake it, with just the first item in the list.
		//	(todo: support fake-purchasing the full list)
		
		var timer = new rat.timer(function()
			{
				for (var i = 0; i < fakeCatalog.length; i++)
				{
					if (fakeCatalog[i].identifier === idList[0])
					{
						fakeInventory.push(
							//	this structure matches kong's requestUserItemList API
							{id:fakeInventoryNextInstanceID++,	//	instance id
							identifier:fakeCatalog[i].identifier,
							data:metaData,
							remaining_uses:fakeCatalog[i].uses}
						);
				
						rat.console.log("rat.license: fake purchase succeeded");
						callback({success:true});
						return;
					}
				}
				
				rat.console.log("rat.license: fake purchase failed");
				callback({success:false});
			}, 0.2, null);
		timer.autoUpdate();
	};
	
	//	request user item list.
	//	call callback when it's available.
	//	userName null for current player
	//	Should be overridden by real implementations.  This one is a generic fake API.
	license.getUserItemList = function(userName, callback)
	{
		//	simulation
		var timer = new rat.timer(function(arg)
			{
				rat.console.log("rat.license: delayed fake item list callback");
				callback({success:true, data:fakeInventory});
			}, 0.2, null);
		timer.autoUpdate();
	};
	
	//	consume an item, using the id from getUserItemList
	//	Should be overridden by real implementations.  This one is a generic fake API.
	license.consumeItem = function(instanceID, callback)
	{
		//	simulation
		var timer = new rat.timer(function(arg)
			{
				for (var i = 0; i < fakeInventory.length; i++)
				{
					if (fakeInventory[i].id === instanceID)
					{
						rat.console.log("rat.license: delayed fake item consume " + instanceID);
						if (fakeInventory[i].remaining_uses == 0)	//	(null or 0) infinite - not consumable.
							callback({success:false});
						else
						{
							fakeInventory[i].remaining_uses--;
							if (fakeInventory[i].remaining_uses <= 0)
							{
								fakeInventory.splice(i, 1);	//	delete it.
							}
						}

						callback({success:true, id:instanceID});
						return;
					}
				}
				
				callback({success:false});
				
			}, 0.2, null);
		timer.autoUpdate();
	},
	
	//	To add: some higher level functions:
	//		request simple count of a particular type of item (id list?) (e.g. consumables)
	//		consume N items of a particular type
	license.consumeItemType = function(id, count, callback)
	{
		//	consume this many of this type, using up multiple items if needed.
		//	e.g. if user has purchased a 10-gem pack and a 5-gem pack,
		//	we really want to just present that as 15 gems, and let them spend all 15 at once.
		//	potentially really complicated?  What if half the transaction fails?
		//	And do we return a list of ids consumed?
		//	At the very least, we need to pre-check to see if all exist in our known inventory.
		//	also, we probably need to request the latest inventory right now and act only when that's received.
		
		//	for now, let's just make this an easy way to consume an item by type instead of instance id.
		//	I'm implementing this on top of rat.license UI in the hope that it doesn't need to be reimplemented in platform-specific code.
		if (count > 1)
		{
			rat.console.log("rat.license: error: consumeItemType doesn't support count other than 1");
			return;
		}
		license.getUserItemList(null, function(result)
		{
			if (!result.success)
			{
				callback({success:false});
				return;
			}
			for (var i = 0; i < result.data.length; i++)
			{
				if (result.data[i].identifier === id)
				{
					license.consumeItem(result.data[i].id, callback);
					return;
				}
			}
			callback({success:false});
			return;
		});
	},
	
	///	NULL function for launching the purchase API
	license._OSPurchaseUI = function (userID) {

		function buyGame() {
			license.osIsLicensed = true;
			license.onLicenseChange();
		}

		if (window.confirm) {
			var res = window.confirm("Buy the game?");
			if (res == true)
				buyGame()
		} else if (rat.system.has.winJS) {
			// Create the message dialog and set its content
			var msg = new Windows.UI.Popups.MessageDialog(
				"Buy the game?");

			// Add commands and set their command handlers
			var cmd = new Windows.UI.Popups.UICommand(
				"Yes",
				buyGame);
			cmd.Id = 0;
			msg.commands.append(cmd);

			cmd = new Windows.UI.Popups.UICommand(
				"No",
				function () { });
			cmd.Id = 1;
			msg.commands.append(cmd);

			msg.defaultCommandIndex = 0;
			msg.cancelCommandIndex = 1;
			msg.showAsync();

		}
	};
});