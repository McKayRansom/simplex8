//
//	User management and information collection for Kongregate API
//	Note that we aggressively fake this data when we're not actually running inside Kongregate,
//	for ease of development.
//
rat.modules.add( "rat.os.r_user_kong",
[
	{ name: "rat.os.r_user", processBefore: true},
	{ name: "rat.os.r_system", processBefore: true},
	{ name: "rat.os.r_kong"},
	
	"rat.debug.r_console",
], 
function(rat)
{
	rat.user = rat.user || {};

	rat.user.supported = true;
	
	//	utility to get the right kind of information request built...
	function makeRequestObject(reqString)
	{
		var rkong = rat.system.kong;
		var xhttp;
		if (window.XMLHttpRequest)
			xhttp = new XMLHttpRequest();
		else
			xhttp = new ActiveXObject("Microsoft.XMLHTTP");
		
		var fake = false;
		if (!rkong || rkong.fake || !rkong.isReady())
			fake = true;
		
		var path = reqString;
		
		//	Cross origin crap.  :(
		//	During development, we want to query user information from kongregate even when we're running locally,
		//	and we run into security errors.  So we need to use CORS, but kongregate doesn't support it.
		//	So, use a proxy.
		//	For a while, cors.io proxy worked.
		//	Switching to https://crossorigin.me/ now.
		
		//	That's not working now, either.
		//	In some cases, serve a file locally.
		
		if (fake)
		{
			//	can we serve any of this locally?
			//var place = reqString.search("username=")
			//if (0)//place >= 0)
			//{
				//path = "fake_data/user_info_gostay.json";
				
			//} else
			{
				xhttp.crossOrigin = "Anonymous";
				
				//	custom solution:
				//	http://104.236.146.97:9186/cdn4.kongcdn.com/assets/kongpanion_icons/0000/0231/blargh.png
				var rOffset = reqString.indexOf("://");
				reqString = path.substring(rOffset+3);
				
				path = "http://104.236.146.97:9186/" + reqString;
				//console.log(path);
				
				//	crossorigin.me solution:
				//path = "https://crossorigin.me/" + reqString;
				
			
				//	older cors.io solution, which also required escaped ampersand:
				////	and use escaped ampersand
				//reqString = reqString.replace(/\&/g, "%26");
				//path = "http://cors.io/?u=" + reqString;
			}
		}
		
		return {xhttp:xhttp, path:path};
	}
	
	//	start a REST request for user data.
	function requestKongUserInfo(user, callback, customData)
	{
		var rkong = rat.system.kong;
		var pname = user.gamerTag;
		rat.console.log("requesting kong user data for " + pname);
		
		user.userInfoStatus = 'pending';

		var req = makeRequestObject("http://api.kongregate.com/api/user_info.json?username=" + pname + "&friends=true");
		
		req.xhttp.onload = function(e) {callback(req.xhttp, user, customData, e);};
		
		req.xhttp.open("GET", req.path, true);	//	async
		req.xhttp.send();
	};
	
	//	normal handling of user info request
	function handleKongUserInfo(xhttp, user, customData, e)
	{
		//	when I get the file locally, this status is 0...  Fix this.
		if (xhttp.readyState === 4 && xhttp.responseText) //&& xhttp.status  === 200)
		{
			rat.console.log("got kong user data");
			var obj = JSON.parse(xhttp.responseText);
			if (obj.success)
			{
				user.kongUserInfo = obj;
				user.userInfoStatus = 'ready';
				
				user.userImageSource = obj.user_vars.avatar_url;
				user.friendsList = [];
				for (var i = 0; i < obj.friends.length; i++)
				{
					user.friendsList.push({
						//	note: this username field needs to be named the same as the user's name,
						//	so we can use this object in similar functions...
						//	I wish we weren't using "gamerTag" as a standard username variable name...
						gamerTag : obj.friends[i],
						id : obj.friend_ids[i],
						userInfo : null,
					});
				}
				
				//	info is available now.  broadcast that it changed.
				rat.user.messages.broadcast(rat.user.messageType.InfoChange, user);
			}
			
		} else {
			user.userInfoStatus = 'error';
		}
	
	};
	
	/// Get the list of all system users, which on Kongregate is just the current user.
	/** @suppress {missingProperties} */
	rat.user.getUsers = function ()
	{
		var list = new rat.user._internal.UserList();
		var userFields = {};
		var rkong = rat.system.kong;
		if (rkong && rkong.kongregate)
		{
			userFields.id = rkong.kongregate.services.getUserId();
			userFields.gamerTag = rkong.kongregate.services.getUsername();
			
			userFields.isGuest = rkong.kongregate.services.isGuest();
			
			userFields.isSignedIn = true;
			userFields.userImageSource = null;	//	todo
			userFields.friendsList = null;	//	todo
			
		} else {
			//	fake user data
			
			userFields.id = -1;
			//	test with gostay, generally.
			//	other test names:
			//		weeozy has 355 friends, zeeg has 20, aquagamer 76, jimgreer has 500 (max)
			userFields.gamerTag = "gostay";
			userFields.isGuest = false;
			userFields.isSignedIn = true;
			userFields.userImageSource = null;	//	todo
			userFields.friendsList = null;	//	todo
		}
		var user = list.add(userFields, userFields);	//	use userfields as raw data and as setupdata both...
		
		//	start a request for some user info
		//	STT this is failing - disabled until we know why.
		//requestKongUserInfo(user, handleKongUserInfo);

		return list;
	};

	/** @suppress {missingProperties} */
	//	Will we need this?  We might.
	/*
	var kongSigninChanged = function (type, eventArgs)
	{
		var user = eventArgs.user;
		if (type === rat.user.messageType.SignOut && rat.user.getActiveUser() && user.xboxUserId === rat.user.getActiveUserID())
			rat.user.clearActiveUser();
		rat.user.messages.broadcast(type, user.xboxUserId);
	};
	*/

	/// Seems like this should be in r_input except that it is all about the user binding to a controller changing...
	/** @suppress {missingProperties} */
	/*
	//	This, too...
	function addListeners()
	{
		//	something about listening to kongregate when signin changes?
	}
	addListeners();
	*/

	//	except the actual kong API is not available until a callback is called, some time after startup.
	//	so, in pracice, we can't do much here.
	//function defaultKongUserSetup()
	//{
	//}
	//defaultKongUserSetup();
	
	//	request details for all friends
	//	Kongregate specifically has an API for requesting multiple user's info at once...
	//	So, we'll use that.  Oddly, it only supports 50 at a time, so we have to break up our requests.
	rat.user.requestFriendsInfo = function(user)
	{
		if (!user.friendsList)
			return;
		
		rat.console.log("requesting info for " + user.friendsList.length + " friends");
		
		var requestList = [];
		for (var i = 0; i < user.friendsList.length; i++)
		{
			user.friendsList[i].userInfoStatus = 'pending';
			requestList.push(user.friendsList[i].id);
			if (requestList.length >= 50)
			{
				requestFriendGroup(user, requestList);
				requestList = [];
			}
		}
		if (requestList.length)
			requestFriendGroup(user, requestList);
	};
	
	//	make the actual request for a group of ids
	function requestFriendGroup(user, list)
	{
		rat.console.log("requestFriendGroup count " + list.length);
		
		var reqString = "http://api.kongregate.com/api/user_info.json?user_ids=";
		for (var i = 0; i < list.length; i++)
		{
			reqString += "" + list[i];
			if (i < list.length-1)
				reqString += ",";
		}
		
		var req = makeRequestObject(reqString);
		
		req.xhttp.onload = function(e) {handleFriendInfo(req.xhttp, user, null, e);};
		
		req.xhttp.open("GET", req.path, true);	//	async
		req.xhttp.send();
	};
	
	//	handling of user info results for a group of friends
	function handleFriendInfo(xhttp, origUser, customData, e)
	{
		if (xhttp.readyState === 4 && xhttp.status  === 200)
		{
			rat.console.log("got kong friend data");
			var obj = JSON.parse(xhttp.responseText);
			
			//	match up the results one by one
			for (var i = 0; i < obj.users.length; i++)
			{
				for (var fIndex = 0; fIndex < origUser.friendsList.length; fIndex++)
				{
					if (obj.users[i].user_id === origUser.friendsList[fIndex].id)
					{
						origUser.friendsList[fIndex].userInfo = obj.users[i];
						origUser.friendsList[fIndex].userInfoStatus = 'ready';
						origUser.friendsList[fIndex].userImageSource = obj.users[i].user_vars.avatar_url;
					}
				}
			}
			
		} else {
			//user.userInfoStatus = 'error';
		}
		
		for (var fIndex = 0; fIndex < origUser.friendsList.length; fIndex++)
		{
			if (origUser.friendsList[fIndex].userInfoStatus !== 'ready')
				return;
		}
		
		//	info is available now.  broadcast that it changed.
		rat.user.messages.broadcast(rat.user.messageType.FriendsInfoAvailable, origUser);
	};
	
	//	Init user access, once it's available.
	//	So, we expect this function to get called at some point after kong API is actually hooked up,
	//	some time after startup.
	rat.user.init = function(rkong)
	{
		rat.console.log("rat.user.init kong");
		
		var localUserID = rkong.getUserId();
		rat.user.setActiveUser(localUserID);
		
		//	todo: (though, maybe do these on setActiveUser?)
		//	start user info query.
		//	start kongpanion list query (optional?)
		//	start friend list query (optional?)
		//	start user picture query? (optional?)
	};
	
	//	write stat for the active user (which is all kong supports anyway)
	rat.user.writeStat = function(statName, value)
	{
		var rkong = rat.system.kong;
		if (rkong && !rkong.fake && rkong.isReady())
		{
			rkong.kongregate.stats.submit(statName, value);
		} else {
			rat.console.log("non-kong stat write attemp:  " + statName + " : " + value);
		}
	};


} );