//
//	generated js from lua file
//
rat.modules.add( "rat.xuijs.wahooluajs.system.w_leaderboards_rat",
[
	{name: "rat.xuijs.wahooluajs.wahoolua", processBefore: true },
	{name: "rat.xuijs.wahooluajs.system.w_leaderboards", processBefore: true },
	
	"rat.xuijs.wahooluajs.system.w_leaderboard_helper_rat",
	"rat.os.r_system",
], 
function(rat)
{
	var ALLOW_INVALID_XML = true;
	var HTTP_STATUS_OK = 200;
	var HTTP_STATUS_ERROR = 404;

	var WLeaderboards = wahoolua.WLeaderboards;

	 WLeaderboards.prototype.Read = function(platform){
		//xuijsAPI.WriteLog("rRead")
		this.leaderboard = this.leaderboard || {};
		this.leaderboard[platform] = this.leaderboard[platform] || [];
	
		var leaderboardPlatform = platform;
		var url = this.BuildURL(true, leaderboardPlatform);
	
		//local result, body = Net.HttpGet(url)
		this.GetDataFromUrl(this, url, "Read")
	};
	
	 WLeaderboards.prototype.ReadTotals = function(platform){
		//xuijsAPI.WriteLog("rReadTotals")
		this.leaderboardTotals = this.leaderboardTotals || {};
		this.leaderboardTotals[platform] = this.leaderboardTotals[platform] || {};
	
		var leaderboardPlatform = platform;
		var url = this.BuildTotalsURL(leaderboardPlatform);
	
		//local result, body = Net.HttpGet(url)
		this.GetDataFromUrl(this, url, "ReadTotals");
	};
	
	 WLeaderboards.prototype.Write = function(entry, gamerTag, score){
		var url = this.BuildURL(false, "xbox", entry, gamerTag);
		
		this.SendDataFromUrl(this, url, "Write", score, gamerTag);
	};
	
	// This does not write anything to the leaderboard, it merely reads and updates local info
	 WLeaderboards.prototype.UpdateRank = function(score, gamerTag){
		//xuijsAPI.WriteLog("rUpdateRank")
		var url = this.BuildRankURL("xbox", score, gamerTag);
		//local result, body = Net.HttpGet(url)
			
		this.GetDataFromUrl(this, url, "UpdateRank");
	};
	
	// This does not write anything to the leaderboard, it merely reads and updates local info
	 WLeaderboards.prototype.UpdateAggregate = function(aggregate, gamerTag){
		//xuijsAPI.WriteLog("rUpdateAggregate")
		if ( (this.aggregate && aggregate && aggregate > this.aggregate) || (aggregate && !this.aggregate) ) {	// store this now so it'll be updated on screens
			this.aggregate = aggregate;
		}
		
		var url = this.BuildAggregateURL("xbox", aggregate, gamerTag);
		if ( !url ) {
			return;
		}
		
		//local result, body = Net.HttpGet(url)
		
		this.GetDataFromUrl(this, url, "UpdateAggregate");
	};
	
	 WLeaderboards.prototype.SetScore = function(score){
		//xuijsAPI.WriteLog("rSetScore")
		this.score = score;
		this.rank = -1;
	
		var url = this.BuildRankURL("xbox", score);
		//local result, body = Net.HttpGet(url)
		
		this.GetDataFromUrl(this, url, "SetScore");
	};

	WLeaderboards.prototype.GetDataFromUrl= function()
	{
		if (arguments.length < 3) {
			throw new Error("xuijs.api.WLeaderboard_GetDataFromUrl(): Not enough args");
		}

		var callingObj = arguments[0];
		var url = arguments[1];
		var callbackName = arguments[2];

		var xmlhttp = new XMLHttpRequest();
		xmlhttp.onreadystatechange = function() {
			// parse XML
			if (xmlhttp.readyState != 4)						// 4 is done for ready state
				return;

			if (xmlhttp.status !== HTTP_STATUS_OK && xmlhttp.readyState == 4) {
				wahoolua.WLeaderboardHelper[callbackName](null, callingObj);
				//xuijs.callLuaFunc("WLeaderboardHelper", callbackName, [null, callingObj], { skipReturnHandling: true });
				return;			// TODO, push error on to the c-stack and send it back, have the calling function check for error
			}

			var parser = new DOMParser();
			var xmlData = parser.parseFromString(xmlhttp.responseText, "text/xml");
			var entryList = xmlData.getElementsByTagName("entry");

			var arr = [];
			for (var i = 0; i < entryList.length; ++i) {
				var entry = entryList[i];
				var values = {};
				for (var j = 0; j < entry.attributes.length; ++j) {
					var attrib = entry.attributes[j];
					values[attrib.name] = attrib.value;
					values.length = j + 1; //this is so that the value has a length attribute this way later it will be counted as an array kind of a quick fix for leaderboards but it works
				}
				arr[i] = values;
			}

			wahoolua.WLeaderboardHelper[callbackName](arr, callingObj);
			//var test = [{ name: "bob", rank: "1", score: "2400" }, { name: "joe", rank: "3", score: "2100" }, { name: "bill", rank: "2", score: "2200" }]
			//xuijs.callLuaFunc("WLeaderboardHelper", callbackName, [arr, callingObj], { skipReturnHandling: true });
		};
		xmlhttp.open("GET", url, true);
		xmlhttp.send();

	}

	WLeaderboards.prototype.SendDataFromUrl = function()
	{
		if (arguments.length < 5) {
			throw new Error("SendDataFromUrl(): Not enough args");
		}

		var callingObj = arguments[0];
		var url = arguments[1];
		var callbackName = arguments[2];
		var gamerTag = arguments[3];
		var refresh =  arguments[4];

		var xmlhttp = new XMLHttpRequest();
		xmlhttp.onreadystatechange = function () {
			if (xmlhttp.readyState != 4)						// 4 is done for ready state
				return;

			if (xmlhttp.status !== HTTP_STATUS_OK && xmlhttp.readyState == 4) {
				wahoolua.WLeaderboardHelper[callbackName](null, callingObj);
				//xuijs.callLuaFunc(helperModule, callbackName, [null, callingObj], { skipReturnHandling: true });
				return;			// TODO, push error on to the c-stack and send it back, have the calling function check for error
			}

			wahoolua.WLeaderboardHelper[callbackName](true, callingObj, gamerTag, refresh);
			//xuijs.callLuaFunc(helperModule, callbackName, [true, callingObj, gamerTag, refresh], { skipReturnHandling: true });
		};  		// nothing really changes whether we succeeded or not
		xmlhttp.open("POST", url, true);
		xmlhttp.send();

	}
		
});
