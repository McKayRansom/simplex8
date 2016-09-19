//
//	User management
//	This manages system users,
//	e.g. on Xbox, we need to track the playing user among other users that might be signed in
rat.modules.add( "rat.os.r_user_xbo",
[
	{ name: "rat.os.r_user", processBefore: true},
	{ name: "rat.os.r_system", processBefore: true},
	
	"rat.debug.r_console",
], 
function(rat)
{
	if (!rat.system.has.Xbox)
		return;

	rat.user = rat.user || {};

	rat.user.supported = true;
	var xboxGamepadTag = "Windows.Xbox.Input.Gamepad";

	/// Get the list of all system users.
	/** @suppress {missingProperties} */
	rat.user.getUsers = function ()
	{
		var list = new rat.user._internal.UserList();
		var sysList = window.Windows.Xbox.System.User.users;
		var sysUser;
		for (var index = 0; index !== sysList.size; ++index)
		{
			sysUser = sysList.getAt(index);
			list.add(sysUser, {
				id: sysUser.xboxUserId,
				gamerTag: sysUser.displayInfo.gameDisplayName,
				isSignedIn: sysUser.isSignedIn
			});
		}

		return list;
	};

	/** @suppress {missingProperties} */
	rat.user.userIDFromControllerID = function (controllerID)
	{
		if (controllerID === 'keyboard' || controllerID === 'mouse')
			return rat.user.getUsers().at(0).id;

		//	Get the userID bound to this controller
		var cList = window.Windows.Xbox.Input.Controller.controllers;
		for (var cIndex = 0; cIndex < cList.size; cIndex++)
		{
			var cont = cList[cIndex];
			if (cont.id === controllerID)
			{
				if (cont.user)
					return cont.user.xboxUserId;
				else
					return 0;
			}
		}

		return 0;
	};

	rat.user.controllerIDFromUserID = function (userID)
	{
		//	Get the user.
		var user = rat.user.getUser(userID);
		if (!user)
			return 0;
		var sysUser = user.rawData;

		//	Find the controller
		var cList = sysUser.controllers;
		var controller;
		for (var cIndex = 0; cIndex < cList.size; cIndex++)
		{
			//	Only worried about gamepads.
			controller = cList[cIndex];
			if (controller.type !== xboxGamepadTag)
				continue;
			return controller.id;
		}
		//	Not found i guess
		return 0;
	};

	/** @suppress {missingProperties} */
	var XboxSigninChanged = function (type, eventArgs)
	{
		var user = eventArgs.user;
		if (type === rat.user.messageType.SignOut && rat.user.getActiveUser() && user.xboxUserId === rat.user.getActiveUserID())
			rat.user.clearActiveUser();
		rat.user.messages.broadcast(type, user.xboxUserId);
	};

	/// Seems like this should be in r_input except that it is all about the user binding to a controller changing...
	/** @suppress {missingProperties} */
	function addListeners()
	{
		window.Windows.Xbox.Input.Controller.addEventListener("controllerpairingchanged", function (event)
		{
			var controller = event.controller;
			if (controller.type !== xboxGamepadTag)
				return;

			//	Not really much to re-act to here.
			// Tell the game
			var oldUser = (event.previouUser || {}).xboxUserId;
			var newUser = (event.user || {}).xboxUserId;
			rat.user.messages.broadcast(rat.user.messageType.ControllerBindingChanged, controller.id, oldUser, newUser);
		});

		/// Listen for signin changes.  This may change the active user (it should only ever clear it..  Never set it (I guess)
		
		//	TODO:  In order to standardize the API here, let's trigger an infochange event right after the signin change
		//		(review r_user_kong and r_user for related notes)
		window.Windows.Xbox.System.User.addEventListener("userAdded", XboxSigninChanged.bind(void 0, rat.user.messageType.SignIn));
		window.Windows.Xbox.System.User.addEventListener("userRemoved", XboxSigninChanged.bind(void 0, rat.user.messageType.SignOut));
		window.Windows.Xbox.System.User.addEventListener("userDisplayInfoChanged", XboxSigninChanged.bind(void 0, rat.user.messageType.InfoChange));
	}
	addListeners();

	//	How to launch the system UI
	/** @suppress {missingProperties} */
	rat.user.showSigninUI = function (controllerID, ops, doneCB)
	{
		ops = ops || {};
		var contTypes;
		if (ops[rat.user.SigninUIOps.AllowOnlyDistinctControllerTypes])
			contTypes = window.Windows.Xbox.UI.allowOnlyDistinctControllerTypes;
		else if (ops[rat.user.SigninUIOps.AllowGuests])
			contTypes = window.Windows.Xbox.UI.allowGuest;
		else
			contTypes = window.Windows.Xbox.UI.None;
		var controller = rat.input.getControllerByID(controllerID);
		if (controller)
		{
			rat.user._internal.isSigninUIShowing = true;
			window.Windows.Xbox.UI.SystemUI.showAccountPickerAsync(controller.rawData, contTypes).done(function (systemArgs)
			{
				rat.user._internal.isSigninUIShowing = false;
				var args = { rawEventArgs: systemArgs, forControllerID: controllerID };
				rat.user.messages.broadcast(rat.user.messageType.SigninUIClosed, args);
				if (doneCB)
					doneCB(args);
			});
		}
		else
			return false;
	};

	//	let the system set the active user
	/** @suppress {missingProperties} */
	function setStartingActiveUser()
	{
		var signedInUser = window.Windows.Xbox.ApplicationModel.Core.CoreApplicationContext.currentUser;
		if (signedInUser)
			rat.user.setActiveUser(signedInUser.xboxUserId);
	}
	setStartingActiveUser();

} );