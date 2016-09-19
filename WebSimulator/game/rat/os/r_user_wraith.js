//
//	User management
//	This manages system users,
//	e.g. on Xbox, we need to track the playing user among other users that might be signed in
rat.modules.add( "rat.os.r_user_wraith",
[
	{ name: "rat.os.r_user", processBefore: true},
	"rat.debug.r_console",
], 
function(rat)
{
	(function (rat, Wraith)
	{
		rat.user = rat.user || {};
		rat.user.supported = true;

		/// Get the list of all system users.
		/** @suppress {missingProperties} */
		rat.user.getUsers = function ()
		{
			var list = new rat.user._internal.UserList();
			var sysList = Wraith.getUsers();
			var sysUser;
			for (var index = 0; index !== sysList.length; ++index)
			{
				sysUser = sysList[index];
				list.add(sysUser, {
					id: sysUser.id,
					gamerTag: sysUser.gamerTag,
					isSignedIn: true
				});
			}
			return list;
		};

		///	Get a users ID from their controller ID
		/** @suppress {missingProperties} */
		rat.user.userIDFromControllerID = function (controllerID)
		{
			if (controllerID === 'keyboard' || controllerID === 'mouse')
				controllerID = Wraith.getKeyboardControllerID();
			var userId = Wraith.getUserIdFromControllerId(controllerID);
			return userId;
		};

		///	Get the controller ID being used by the user
		rat.user.controllerIDFromUserID = function (userID)
		{
			//	Get the user.
			var user = rat.user.getUser(userID);
			if (!user)
				return 0;
			var sysUser = user.rawData;

			//	Get the controllerID set in the sys object
			return sysUser.controllerID;
		};

		/// Seems like this should be in r_input except that it is all about the user binding to a controller changing...
		/** @suppress {missingProperties} */
		function onBindingChanged(event)
		{
			var oldUserID = event.previousUserId || 0;
			var newUserID = event.userId || 0;
			var controllerId = event.controllerId;

			//	Force an update of the input system first?

			// Tell the game
			rat.user.messages.broadcast(rat.user.messageType.ControllerBindingChanged, controllerId, oldUserID, newUserID);
		}
	
		///	Called when wraith detects a signin change
		/** @suppress {checkTypes} */
		function WraithSigninChanged(type, eventArgs)
		{
			var userID = eventArgs.userId || {};
			rat.console.log("Got " + eventArgs.type + "for " + rat.user.getUser(userID).gamerTag);
			var activeUser = rat.user.getActiveUser();
			if (type === rat.user.messageType.SignOut && activeUser && rat.user.getActiveUserID() === activeUser.id)
				rat.user.clearActiveUser();
			rat.user.messages.broadcast(type, userID);
		}

		/// Listen for signin changes.  This may change the active user (it should only ever clear it..  Never set it (I guess)
		/** @suppress {missingProperties} */
		function addListeners()
		{
			Wraith.addEventListener("controllerBindingChanged", onBindingChanged);
			Wraith.addEventListener("userSignIn", WraithSigninChanged.bind(void 0, rat.user.messageType.SignIn));
			Wraith.addEventListener("userSignOut", WraithSigninChanged.bind(void 0, rat.user.messageType.SignOut));
			Wraith.addEventListener("userInfoChanged", WraithSigninChanged.bind(void 0, rat.user.messageType.InfoChange));
		}

		addListeners();

	})(rat, Wraith);
} );