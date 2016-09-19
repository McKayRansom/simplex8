//
//	App license management (Is the game owned)
//
rat.modules.add("rat.os.r_license_winjs",
[
	{ name: "rat.os.r_license", processBefore: true },
],
function (rat) {
	//	Only valid under winjs
	if (!rat.system.has.winJS)
		return;

	var useCustomInGameBuy = true;
	var haveAddedLiceseEventListener = false;

	var license = rat.license;

	///	Check if the app is licensed
	license._updateLicense = function () {
		if (!currentApp)
			return;

		//	Let me know when we get a license change
		var licenseInformation = currentApp.licenseInformation;

		var isLicensed;
		if (useCustomInGameBuy) {
			//	My custom in-app-purchase approach
			if (licenseInformation.productLicenses.lookup("unlockfull").isActive)
				isLicensed = true;
			else
				isLicensed = false;
		}
		else {
			//	According to MSDN docs, isActive is only false when there's an error.
			//	According to articles online from developers, isActive is always false on windows phone.
			//	I'm going to ignore isActive and see how that goes.
			if (1)//licenseInformation.isActive)
			{
				if (licenseInformation.isTrial) {
					isLicensed = false;
				} else {
					isLicensed = true;
				}
			} else {
				isLicensed = false;//	? inactive license
			}
		}

		//	Once licensed, stay licensed
		if (isLicensed) {
			license.osIsLicensed = true;
			license.onLicenseChange();
		}

		if (!haveAddedLiceseEventListener)
			currentApp.licenseInformation.addEventListener("licensechanged", license._updateLicense);
	};

	///	Win8 function for launching the purchase API
	/// TODO Need support for buying things other than the game
	license._OSPurchaseUI = function (userID) {

		if (useCustomInGameBuy) {
			currentApp.requestProductPurchaseAsync("unlockfull", false).then(
				//	Success
				function () {
					license._updateLicense();
				},
				//	Error?
				function () {
					rat.console.log("LICENSE: transaction error");
				});
		}
		else {
			currentApp.requestAppPurchaseAsync(false).done(
			function () {	//	success
				license._updateLicense();
			},
			function () {	//	error
				//	update transaction failed - still in trial
				rat.console.log("LICESNSE: Transaction error");
			});
		}
	};

	///
	///	Inital setup
	///
	var currentApp;
	if (0)	//	RELEASE ONLY
		currentApp = Windows.ApplicationModel.Store.CurrentApp;
	else {
		currentApp = Windows.ApplicationModel.Store.CurrentAppSimulator;

		Windows.ApplicationModel.Package.current.installedLocation.getFolderAsync("res").done(
			function (folder) {
				folder.getFileAsync("in-app-purchase.xml").done(
					//	Success
					function (file) {
						Windows.ApplicationModel.Store.CurrentAppSimulator.reloadSimulatorAsync(file).done();
						license._updateLicense();
					},
					//	Error
					function () {
						rat.console.log("LICENSE: ERROR! Failed to open res folder looking for in-app-purchase.xml.  Not using custom in-game purchase.");
						useCustomInGameBuy = false;
						license._updateLicense();
					});
			},
			//	Error
			function () {
				rat.console.log("LICENSE: ERROR! Failed to open in-app-purchase.xml file in res folder.  Not using custom in-game purchase.");
				useCustomInGameBuy = false;
				license._updateLicense();
			});

	}
});