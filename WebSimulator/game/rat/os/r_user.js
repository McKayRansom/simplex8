//
//	User and profile management
//	Find active users, get information about them like user name, gamer picture, list of friends, gamerscore, etc.
//
//	This is a generic API, with system specifics implemented in dependent modules (e.g. r_user_xbo.js)
//
//
/*	NOTES from Steve 2015.12.18
	r_user's getUsers() system is strange...
	It seems to be designed to reconstruct a list of users, including building a new user object for each user, each time it's called.
	So I thought maybe it was a sort of one-time setup thing, but the results aren't tracked by r_user, and it does seem to get called in other places on the fly...
	Seems not ideal at all.
	Shouldn't we have a single user list that's built once and maintained?
	I don't want to break xbox user management support, of course, so I don't want to change this stuff...
	for instance, calling setActiveUser() calls getUser() which calls getUsers() which rebuilds the list.
	All I wanted to do was set the active user...
	
	Talked to John about this...
	he agrees that the best way to do this is to TRACK the user list when it changes, rather than reconstruct it each time getUser() is called.
	TODO:  do that on various platforms.
*/

rat.modules.add( "rat.os.r_user",
[
	{ name: "rat.utils.r_messenger", processBefore: true},
	
	{ name: "rat.os.r_user_xbo", platform: "xbox" },
	{ name: "rat.os.r_user_wraith", platform: "Wraith" },
	//{ name: "rat.os.r_user_kong" }//, platform: "kong" },	//	hmm...  I want to fake it when I'm not really on kong, though...
	"rat.debug.r_console",
], 
function(rat)
{
	//rat.console.log("SLD rat.user");

	/// Rat user object
	/** @constructor */
	var User = function (rawData, fields)
	{
		this.rawData = rawData;
		this.id = fields.id;
		this.gamerTag = fields.gamerTag;
		this.isSignedIn = fields.isSignedIn || false;
		this.userImageSource = fields.userImageSource;
		this.friendsList = fields.friendsList;
	};
	
	//	Rat user list.
	/** @constructor */
	var UserList = function ()
	{
		this.list = [];
		this.byId = {};
		this.length = 0;
	};
	UserList.prototype.add = function (rawData, fields)
	{
		var usr = new User(rawData, fields);
		this.list.push(usr);
		this.length = this.list.length;
		this.byId[usr.id] = usr;
		return usr;
	};
	UserList.prototype.at = function (index)
	{
		return this.list[index];
	};

	// Rat.user namespace
	rat.user = rat.user || {};
	rat.user.supported = rat.user.supported || false;
	rat.user.messages = new rat.Messenger();
	var messageType = {
		ActiveUserChanged: "activeUserChanged",
		SignIn: "signIn",
		SignOut: "signOut",
		InfoChange: "infoChange",
		SigninUIClosed: "signinUIClosed",
		ControllerBindingChanged: "controllerBindingChanged",
		
		FriendsInfoAvailable: "friendsInfoAvailable",
		AchievementInfoAvailable: "achievementInfoAvailable",
	};
	rat.user.messageType = messageType;
	var SigninUIOps = {
		NoGuests: "", //<DEFAULT
		AllowGuests: "allowGuests",
		AllowOnlyDistinctControllerTypes: "allowOnlyDistinctControllerTypes"
	};
	rat.user.SigninUIOps = SigninUIOps;

	var activeUser = void 0;
	
	rat.user._internal = {
		UserList: UserList,
		User: User,
		isSigninUIShowing: false
	};

	//	NULL function to get a controllerID for a given userID
	rat.user.userIDFromControllerID = function (controllerID)
	{
		if (controllerID === 'keyboard' || controllerID === 'mouse')
			return rat.user.getUsers().at(0).id;
		return 0;
	};

	// NULL function to get the controller ID tied to a user ID
	rat.user.controllerIDFromUserID = function (userID)
	{
		return 0;
	};

	// NULL function to get the list of users interacting with the local system
	rat.user.getUsers = function ()
	{
		return new UserList();
	};
	
	rat.user.requestFriendsInfo = function(user)
	{
		//	by default, there is no such service
		return;
	};

	// NULL function for showing the signin UI
	//	Signature MUST be controllerID, ops, (see rat.user.SigninOps), doneCB and return true/false if the UI was requested
	//- NOTE We do this in a function so i can provide information to the google closure compiler w/out changing the state for the entire file
	/** @suppress {checkTypes} */
	function setNULLSigninUI()
	{
		rat.user.showSigninUI = void 0;	//	This is VOID 0 so code can detect when platforms don't support this
	}
	setNULLSigninUI();

	//	Find out if the signinUI is up.
	rat.user.isSigninUIShowing = function ()
	{
		return rat.user._internal.isSigninUIShowing;
	};

	//	Get a user by the user's ID
	rat.user.getUser = function (id)
	{
		//	Find the user.
		var users = rat.user.getUsers();
		return users.byId[id];
	};

	//	Function to clear the currently set active user.
	/** @param {Object=} options */
	rat.user.clearActiveUser = function (options)
	{
		rat.user.setActiveUser(void 0, options);
	};

	// Function to set who the active user is
	/**
	 * @param {?} id 
	 * @param {Object=} options
	 */
	rat.user.setActiveUser = function (id, options)
	{
		options = options || {};

		//	Allow passing the user object
		if (id !== void 0 && id.id !== void 0)
			id = id.id;

		//	Is there a change?
		var isChange;
		if (id !== void 0)
			isChange = activeUser === void 0 || activeUser.id !== id;
		else
			isChange = activeUser !== void 0;
		if (!isChange && !options.force)
			return;

		//	Find the user.
		var old = activeUser;
		if (id !== void 0)
			activeUser = rat.user.getUser(id);
		else
			activeUser = void 0;
		rat.console.log("Active user set to:" + JSON.stringify(activeUser));
		if (isChange)
			rat.user.messages.broadcast(messageType.ActiveUserChanged, activeUser, old);
	};

	//	Get the active user object (if any)
	rat.user.getActiveUser = function ()
	{
		return activeUser;
	};

	//	Get the user ID of the active user (if any)
	rat.user.getActiveUserID = function ()
	{
		var user = rat.user.getActiveUser() || {};
		return user.id || 0;
	};

	//	Get the active user's name
	rat.user.getActiveUserName = function ()
	{
		var user = rat.user.getActiveUser() || {};
		return user.gamerTag || "";
	};
	
	//	Get the active user's image (e.g. avatar),
	//	in a simple data source or URL format,
	//	e.g. suitable for creating a rat image
	rat.user.getActiveUserImageSource = function ()
	{
		var user = rat.user.getActiveUser() || {};
		return user.userImageSource || void 0;
	};
	
	//	todo: user switched controllers?  Wraith handles this, but I don't know about anyone else.
	//	todo: user signed out
} );