rat.modules.add( "rat.xuijs.wahooluajs.system.w_signin_rat",
[
	{name: "rat.xuijs.wahooluajs.wahoolua", processBefore: true },
	"rat.os.r_system",
], 
function(rat)
{
	var WSignin = {};
		
	var gCurrentUserIndex = -1;
	var gSigninChangedCallback = false;
	var gOwnerScene = false;
	var gCurrentUserSigninState = false;
	
	//////////////////////////////////////////////////////////
	// Initialize
	WSignin.Initialize = function(updatesPerSecond, scene, signinChangedCallback) {
	
	}
	
	//////////////////////////////////////////////////////////
	// Shutdown
	WSignin.Shutdown = function() {
	
	}
	
	//////////////////////////////////////////////////////////
	// OnTimer
	WSignin.OnTimer = function(target, id) {
	
	}
	
	//////////////////////////////////////////////////////////
	// GetGamertag - get the gamertag from the system
	WSignin.GetGamertag = function() {
		var gamertag = "";
		if (rat.system.has.xboxLE) {
			var userInfo = Maple.getCurrentUser();

			if(userInfo && userInfo.gamertag)
				gamertag = userInfo.gamertag;
		}
		else {
			gamertag = "WWWWWWWWWWWWWWW";	// for testing on the PC - 15 W's
		}

		return gamertag;

	}

	wahoolua.WSignin = WSignin;
});
