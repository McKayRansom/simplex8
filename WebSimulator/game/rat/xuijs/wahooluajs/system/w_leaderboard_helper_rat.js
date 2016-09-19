//
//	generated js from lua file
//
rat.modules.add( "rat.xuijs.wahooluajs.system.w_leaderboard_helper_rat",
[
	{name: "rat.xuijs.wahooluajs.wahoolua", processBefore: true },
	"rat.math.r_math",
], 
function(rat)
{
	wahoolua.WLeaderboardHelper = {};

	var WLeaderboardHelper = wahoolua.WLeaderboardHelper;

	// this expects app.MainGame to be set to the destination scene somewhere in consts so that all this magic works.
	//print("loaded leaderboard helper")
	WLeaderboardHelper.Read = function( data, originalCaller ) {
		//print("ReadHelper")
		//print("Data? " + tostring(data))
		//print("caller? " + tostring(originalCaller))
		
		var mainLdb = GetLdbByCaller(originalCaller);
		var platform = "xbox";
		if ( data == null ) {
			console.log("no Data");
			WLeaderboardHelper.SetupNullData(originalCaller);
			if ( mainLdb.leaderboard[platform].length < 10 ) {
				//update with the default
				mainLdb.PopulateEmptyLeaderboard(platform)
			}
			return;
		}
		for (var key in data) {
			if (!data.hasOwnProperty(key)) continue;

			//table.insert(mainLdb.leaderboard[platform], tonumber(key, 10) + 1, {value.name, tonumber(value.score, 10)}) //this is the old version left here for reference I guess? previously this tried to pre-sort it however this is not nesesary because that is done later (and it didn't work)
			mainLdb.leaderboard[platform].push([data[key].name, Number(data[key].score)]); //the string.sub is to stop the xui magicall entities from stretching the name to fit the box not sure why this happens. doesn't happen for xbox 360
		}
		mainLdb.SortLeaderboard(mainLdb.leaderboard, platform); //sorting of leaderboard
		if ( mainLdb.leaderboard[platform].length < 10 ) {
			//update with the default
			mainLdb.PopulateEmptyLeaderboard(platform)
		}
	}
	
	WLeaderboardHelper.ReadTotals = function( data, originalCaller ) {
		//print("ReadTotalsHelper")
		
		var mainLdb = GetLdbByCaller(originalCaller);
		var platform = "xbox";
		
		if ( data == null ) {
			//print("no Data")
			mainLdb.leaderboardTotals[platform] = {};
			WLeaderboardHelper.SetupNullData(originalCaller);
			return;
		}
	
		// we have data, so clear out the old entries
		mainLdb.leaderboardTotals[platform] = {};
	
		// insert all the new entries
		for (var key in data) {
			if (!data.hasOwnProperty(key)) continue;
			mainLdb.leaderboardTotals[platform].push(Number(key), [value.name, Number(data[key].score)]);
		}
		
		mainLdb.SortLeaderboard(mainLdb.leaderboardTotals, platform);
			
		if ( mainLdb.leaderboardTotals[platform].length < 10 ) {
			//update with the default
			mainLdb.PopulateEmptyLeaderboard(platform);
		}
	}
	
	WLeaderboardHelper.Write = function( success, originalCaller, score, gamerTag ) {
		//print("WriteHelper")
		
		var mainLdb = GetLdbByCaller(originalCaller);
		var platform = "xbox";
		
		if ( !success ) {
			console.log("no write Data");
			return;
		}
		
		if ( !success ) {
			return
		}
		
		mainLdb.UpdateRank(score, gamerTag)	;	// move this to after the write finishes so that it is up to date and query doesnt arrive before write finishes
		mainLdb.UpdateAggregate(null, gamerTag);
		if ( mainLdb.leaderboardTotals ) {
			mainLdb.ReadTotals(platform);
		}
	};
	
	WLeaderboardHelper.UpdateRank = function( data, originalCaller ) {
		//print("UpdateRankHelper")
		if ( data == null ) {
			console.log("no Data");
			WLeaderboardHelper.SetupNullData(originalCaller);
			return;
		}
	
		var mainLdb = GetLdbByCaller(originalCaller);
		var platform = "xbox";
		
		if ( !mainLdb.score ) {		// avoid arithmetic on null/bool
			mainLdb.score = 0;
		}
		
		if ( data["1"] && data["1"].score ) {
			mainLdb.score = rat.math.max(mainLdb.score, data["1"].score);
			var rank = Number(data["1"].rank);
			//print("UpdatedRank " + tostring(mainLdb.rank) + "   " + rank)
	
			if ( !mainLdb.rank || mainLdb.rank <= 0 ) {
				mainLdb.rank = rank;
			}
			else {
				mainLdb.rank = rat.math.min(mainLdb.rank, rank);
			}
		}
	
		if ( !mainLdb.score ) {
			mainLdb.score = 0;
		}
		if ( !mainLdb.rank ) {		// previously every query returned a rank of 1, that has been fixed for all except when we have no data
			mainLdb.rank = 0;
		}
	}
	
	WLeaderboardHelper.UpdateAggregate = function( data, originalCaller ) {
		//print("UpdateAggregateHelper")
		if ( data == null ) {
			console.log("no Data");
			WLeaderboardHelper.SetupNullData(originalCaller);
			return;
		}
		
		var mainLdb = GetLdbByCaller(originalCaller);
	
		if ( !mainLdb.aggregate ) {		// avoid arithmetic on null/bool
			mainLdb.aggregate = 0;
		}
		if ( data["1"] && data["1"].score ) {
			mainLdb.aggregate = rat.math.max(mainLdb.aggregate, data["1"].score);
		}
	};
	
	WLeaderboardHelper.SetScore = function( data, originalCaller ) {	
		var mainLdb = GetLdbByCaller(originalCaller);
		var platform = "xbox";
		
		//print("SetScoreHelper")
		if ( data == null ) {
			console.log("no Data");
			WLeaderboardHelper.SetupNullData(originalCaller);
			return;
		}
		
		if ( data["1"] && data["1"].rank ) {
			mainLdb.rank = data["1"].rank;
		}
	};
	
	// this doesnt quite belong in the engine... too many game specific calls, however it works for now :(
	WLeaderboardHelper.GetLdbByCaller = function( originalCaller ) {
		if ( originalCaller.toString() == app.MainGame.gLeaderboards.toString() ) {
			return app.MainGame.gLeaderboards;
		}
		
		// if there are multiple leaderboards we have to be able to talk to them
		// there has to be a better way to talk between the sides and still call the correct object...
		
		//if ( tostring(originalCaller) == tostring(app.MainGame.gExperience) ) {
		//	return app.MainGame.gExperience
		//}
		
		//print(" ERROR caller not found: " + tostring(originalCaller))
	};
	
	WLeaderboardHelper.SetupNullData = function(originalCaller) {
		var mainLdb = GetLdbByCaller(originalCaller);
		
		if ( !mainLdb.score ) {
			mainLdb.score = 0;
		}
		if ( !mainLdb.aggregate ) {
			mainLdb.aggregate = 0;
		}
		if ( !mainLdb.rank ) {
			mainLdb.rank = -2;
		}
	};

	var GetLdbByCaller = WLeaderboardHelper.GetLdbByCaller;
});
