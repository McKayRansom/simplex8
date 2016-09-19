//
//	generated js from lua file
//
rat.modules.add( "rat.xuijs.wahooluajs.system.w_leaderboards",
[
	{name: "rat.xuijs.wahooluajs.wahoolua", processBefore: true },
	{name: "rat.xuijs.wahooluajs.system.w_signin_rat", processBefore: true },
	{name: "rat.xuijs.wahooluajs.system.w_stdutils", processBefore: true },
], 
function(rat)
{

	var WSignin = wahoolua.WSignin;
	var WStdUtils = wahoolua.WStdUtils;

	var WLeaderboards = function(programId, platform, game, func, service) {
		WStdUtils.printf( "Creating leaderboard module for "+programId.toString()+"-"+game.toString()+"("+platform.toString()+") using " + service.toString() );
		this.rank = false;
		this.score = false;
		this.aggregate = false		;	// these were false so we knew when they got initialized, but that causes issues with crossplatform code at the moment, so defaulting them to appropriate values
		this.Create(programId, platform, game, func, service);
	}
	
	WLeaderboards.prototype.Create = function(programId, platform, game, func, service) {
		this.programId = programId;
		this.platform = platform;
		this.game = game;
		this.service = service;
		this.CompareFunc = func;
	}
	
	// we don't want to init in our create because our full gLeaderboard object hasn't been assigned yet
	WLeaderboards.prototype.Init = function(platform) {
		if ( platform != null ) {
			this.Read(platform)
		}
		else {
			for(var i=0; i < LEADERBOARD_PLATFORMS.length; i ++){
				var leaderboardInfo = LEADERBOARD_PLATFORMS[i]
				this.Read(leaderboardInfo[0])
			}
	
		}
	
		this.UpdateRank(null, WSignin.GetGamertag());
		this.UpdateAggregate(null, WSignin.GetGamertag());
	}
	
	WLeaderboards.prototype.PopulateEmptyLeaderboard = function(platform, entryTable) {
		//print("PopulateEmptyLeaderboard")
		entryTable = entryTable || this.leaderboard; //this basically makes this.leaderboard the default entryTable (it is ussually right)
		for(var i= 0;i <  10; i++){
			entryTable[platform].push(["ABC", 0]);
		}
	}
	
	WLeaderboards.prototype.SortLeaderboard = function(tableInfo, platform) {
		var func = this.CompareFunc;
		if ( !func ) {
			func = function(first,second) { 
				if ( !first && second ) {
					return false
				}
				if ( !second && first ) {
					return true
				}
				if ( first && second ) {
					return first[1] > second[1]
				}
				return true
			}
		}
		tableInfo[platform].sort(func);
	};
	
	WLeaderboards.prototype.Update = function(platform, name, score, gamerTag) {
		var entry = [name, score];
		var updateLocal = this.IsHighScore(platform, score);
		
		if ( updateLocal ) {
			this.leaderboard[platform].splice( this.leaderboard[platform].length-1, 1);
			this.leaderboard[platform].push(entry);
			this.SortLeaderboard(this.leaderboard, platform);
		}
		
		WStdUtils.printf( "Writing "+score+" for "+gamerTag+" to "+name+"("+platform+")...");
		this.Write(entry, gamerTag, score);
		
		// these will be proper accurate values (and should be the same) after the write finishes and calls the update reads: UpdateRank and UpdateAggregate
		if ( (this.score && score && score > this.score) || (score && !this.score) ) {	// store this now so it'll be updated on screens
			this.score = score
		}
	};
	
	WLeaderboards.prototype.BuildURL = function(reading, platform, entry, gamerTag) {
		if ( this.service && this.service == "wahoo" ) {
			return this.BuildURLWahoo(reading, platform, entry, gamerTag)
		}
		else {
			return this.BuildURLGMR(reading, platform, entry, gamerTag)
		}
	};
	
	WLeaderboards.prototype.BuildTotalsURL = function(platform) {
		if ( this.service && this.service == "wahoo" ) {
			return this.BuildTotalsURLWahoo(platform);
		}
		else {
			return null;
		}
	};
	
	WLeaderboards.prototype.BuildURLGMR = function(reading, platform, entry, gamerTag) {
		var url = null;
		if ( reading == true ) {
			url = "https://bdewebservices.com/MsBdeService.svc/rest/GetTopTenLeaderboard?"
		}
		else {
			url = "https://bdewebservices.com/MsBdeService.svc/rest/AddToLeaderboard?"
		}
	
		url = url + "programId="+this.programId;
		if ( platform != null ) { url = url + "&platform="+platform }
		if ( this.game != null ) { url = url + "&game="+this.game }
		if ( entry != null ) {
			url = url + "&name="+entry[0];
			url = url + "&score="+entry[1];
		}
		if ( gamerTag != null ) { url = url + "&GamerTag="+gamerTag }

		url = url.replace(" ", "%20");
		//WStdUtils.printf("GMR URL: " + url)
		return url;
	};
	
	WLeaderboards.prototype.BuildURLWahoo = function(reading, platform, entry, gamerTag) {
		var url = null;
		if ( reading == true ) {
			url = "https://wahoowebservices2.azurewebsites.net/server.js/leaderboard/"+this.programId+"/"+this.game+"?count=10&format=xml"
		}
		else {
			url = "https://wahoowebservices2.azurewebsites.net/server.js/leaderboard/"+this.programId+"/"+this.game+"?format=xml"
		}
	
		if ( platform != null ) { url = url + "&platform="+platform }
		if ( entry != null ) {
			url = url + "&name="+entry[0];
			url = url + "&score="+entry[1];
		}
		//if ( gamerTag != null ) { url = url + "&GamerTag="+gamerTag }

		url = url.replace(" ", "%20");
		WStdUtils.printf("wahooURL: " + url);
		return url;
	};
	
	WLeaderboards.prototype.BuildRankURL = function(platform, score, gamerTag) {
		if ( this.service && this.service == "wahoo" ) {
			return this.BuildRankURLWahoo(platform, score, gamerTag);
		}
		else {
			return this.BuildRankURLGMR(platform, score, gamerTag);
		}
	};
	
	// aggregate will aggregate all the players scores
	WLeaderboards.prototype.BuildAggregateURL = function(platform, score, gamerTag) {
		if ( this.service && this.service == "wahoo" ) {
			return this.BuildAggregateURLWahoo(platform, score, gamerTag);
		}
		else {
			return null;		// NOT IMPLEMENTED FOR BDEs ON GMR
		}
	};
	
	WLeaderboards.prototype.BuildRankURLGMR = function(platform, score, gamerTag) {
		var url = "https://bdewebservices.com/MsBdeService.svc/rest/CheckRank?";
	
		url = url + "programId="+this.programId;
		if ( platform != null ) { url = url + "&platform="+platform }
		if ( this.game != null ) { url = url + "&game="+this.game }
		if ( score ) { url = url + "&score="+score }
		if ( gamerTag ) { url = url + "&GamerTag="+gamerTag }

		url = url.replace(" ", "%20");
		return url;
	}
	
	WLeaderboards.prototype.BuildRankURLWahoo = function(platform, score, gamerTag) {
		var url = "https://wahoowebservices2.azurewebsites.net/server.js/leaderboard/"+this.programId+"/"+this.game+"?format=xml";
	
		if ( platform != null ) { url = url + "&platform="+platform }
		if ( gamerTag ) { url = url + "&name="+gamerTag }

		url = url.replace(" ", "%20");
		//print("wahooRankURL: " + url)
		return url;
	}
	
	WLeaderboards.prototype.BuildAggregateURLWahoo = function(platform, score, gamerTag) {
		var url = "https://wahoowebservices2.azurewebsites.net/server.js/leaderboard/"+this.programId+"/"+this.game+"?format=xml&aggregate=true";
	
		if ( platform != null ) { url = url + "&platform="+platform }
		if ( gamerTag ) { url = url + "&name="+gamerTag }

		url = url.replace(" ", "%20");
		//print("wahooAggregateURL: " + url)
		return url;
	}
	
	WLeaderboards.prototype.BuildTotalsURLWahoo = function(platform) {
		var url = null;
		url = "https://wahoowebservices2.azurewebsites.net/server.js/leaderboard/"+this.programId+"/"+this.game+"?count=10&aggregate=true&format=xml";
	
		if ( platform != null ) { url = url + "&platform="+platform }

		url = url.replace(" ", "%20");
		//print("wahooTotalURL: " + url)
		return url
	}
	
	WLeaderboards.prototype.IsHighScore = function(platform, score) {
		var count = this.leaderboard[platform].length;
		var entry = this.leaderboard[platform][count -1];
		
		if ( !entry ) {
			return true;
		}
		
		if ( this.CompareFunc ) {
			return this.CompareFunc(score, entry[1]);
		}
		return score > entry[1];
	}
	
	WLeaderboards.prototype.GetEntry = function(platform, index) {
		var entry = this.leaderboard[platform];
		if ( index ) {
			entry = entry[index]
		}
		return entry;
	}
	
	WLeaderboards.prototype.GetTotalsEntry = function(platform, index) {
		var entry = this.leaderboardTotals[platform];
		if ( index ) {
			entry = entry[index]
		}
		return entry
	}
	
	WLeaderboards.prototype.GetRank = function() {
		return this.rank;
	}
	
	WLeaderboards.prototype.GetHighscore = function() {
		return this.score;
	}
	
	WLeaderboards.prototype.GetAggregate = function() {
		return this.aggregate;
	}

	wahoolua.WLeaderboards = WLeaderboards;
		
});
