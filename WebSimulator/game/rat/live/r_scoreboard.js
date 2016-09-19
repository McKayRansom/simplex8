//
//	Scoreboard class
//
//	A couple of subclasses and implementations, including firebase version and local version.
//	2012 Steve Taylor

//
//	A single scoreboard object tracks things like the top scores, the local player's score,
//	and the scores around the local player.
//
//	Basic usage: 
//	Create scoreboard reference like this:
//		var testScores = new rat.Scoreboard(FIREBASE_SCOREBOARD_PATH, rat.Scoreboard.allType);
//	Write like this:
//		testScores.setLocalUserID('Nancy Taylor');
//		testScores.postScore(103, optionalUserData);
//	Read scores like this:
//		var list = testScores.getScores();
//
//	Info about getting scores (from getScores())
//		score entries have these fields:
//			score:  the score
//			name:  the name (local user ID) used when the score was recorded
//			keyName:  database entry name (tries to be unique)
//			rank:  rank in overall scoreboard.  If null, then not valid.
//			data:  a copy of the game-specific data associated with each score
//
//	When you add in the local range of scores, think about not duplicating the same functionality...
//		maybe make each "scoreboard" object just manage one range (e.g. top scores, or bottom scores, or scores near the player)
//		in fact, maybe the "scores around" list needs to be two separate scoreboards, merged.
//
rat.modules.add( "rat.live.r_scoreboard",
[
	"rat.debug.r_console",
	"rat.storage.r_storage",
	{name: "rat.utils.r_utils", processBefore: true},
], 
function(rat)
{
	//------------------------------------------------------------------
	//	Base class used by various scoreboard implementations
	/**
	 * @constructor
	*/
	rat.ScoreBase = function (scoreboardType, localUserID, trackCount)
	{
		this.type = scoreboardType;
		if (typeof(this.type) === 'undefined')
			this.type = rat.Scoreboard.topType;		//	top global scores, by default
		
		if (typeof(localUserID) === 'undefined')
			localUserID = '';
		this.localUserID = localUserID;

		if (typeof(trackCount) === 'undefined')
			trackCount = 10;
		this.trackCount = trackCount;
		
		this.lastWriteKey = null;	//	for later finding our own entry, even if we have multiples
		this.lastWritePriority = null;
		
		this.scoreList = [];	//	initial score list is empty
	};

	rat.ScoreBase.prototype.isValid = function()
	{
		return true;
	};

	rat.ScoreBase.prototype.setLocalUserID = function(localUserID)
	{
		this.localUserID = localUserID;
	};

	//
	//	Get a list of scores in this scoreboard
	//
	rat.ScoreBase.prototype.getScores = function()
	{
		return this.scoreList;	//	may be an empty ist in some cases, but should never be null.
	};

	//
	//	Find score index by key (e.g. username or userID)
	//
	rat.ScoreBase.prototype.findScoreIndexByKey = function(keyName)
	{
		for (var i = 0; i < this.scoreList.length; i++)
		{
			if(this.scoreList[i].keyName === keyName)
				return i;
		}
		return -1;
	};

	//	Make sure ranks are correct for all scores we're tracking.
	rat.ScoreBase.prototype.updateRanks = function()
	{
		for (var i = 0; i < this.scoreList.length; i++)
		{
			this.scoreList[i].rank = i+1;
		}
	};

	//
	//	get the position this score would go if it were posted.
	//  9Jul2013 - PMM - changed this from replacing the high score with a new tied value, to placing a new tied value after the last score of the same value
	//  score - the score wishing to be positioned
	rat.ScoreBase.prototype.getScorePosition = function (score)
	{
		if (!this.isValid())
			return 0;
			
		if(this.scoreList.length === 0)	//	there are no scores yet - our score would go at 0
			return 0;

		//    and for simplicity, skip the search if we'd be at the end.
		if (this.scoreList[this.scoreList.length-1].score >= score)
			return this.scoreList.length;	//	note: this index is off the end of the list, but that's correct.

		//	binary search, but slightly more complex 'cause an identical score may or may not exist.
		var begin = 0;
		var end = this.scoreList.length-1;
		var mid = 0;

		do
		{
			mid = Math.floor((begin + end)/2);
			if (this.scoreList[mid].score >= score)
				begin = mid +1;
			else
				end = mid -1;
		} while (end > begin);
		if(begin === end)	//	normal end case...
		{
			//	now, which slot we want depends on the element at this entry point...
			if (this.scoreList[begin].score >= score)
				mid = begin+1;	//	we're just under that one.
			else
				mid = begin;	//	we're better than that one.
		}

		return mid;
	};

	//	debug:  show scores
	rat.ScoreBase.prototype.debugDumpScores = function()
	{
		/*
		rat.console.log("--");
		for (var i = 0; i < this.scoreList.length; i++)
		{
			var entry = this.scoreList[i];
			rat.console.log("#" + i + " " + entry.name + " : " + entry.score);
		}
		rat.console.log("--");
		*/
	};


	//---------------------------------------------------------------
	//	Firebase version of scoreboard
	//	subclass of base scoreboard class

	/**
	 * @constructor
	 * @extends rat.ScoreBase
	*/
	rat.Scoreboard = function ( address, scoreboardType, localUserID, trackCount )
	{
		rat.Scoreboard.prototype.parentConstructor.call( this, scoreboardType, localUserID, trackCount ); //	default init

		this.address = address;

		this.scoreView = null;	//	call startTracking() below to make this do something

		this.changed = true;	//	track changes for external use - externally set, internally cleared
		//	this is pretty kludgey, but should be sufficient for now.
		var fireBase = rat.Scoreboard.getFirebase();
		if( fireBase )	//	is our firebase stuff reachable?
		{
			this.boardRef = new fireBase();
			this.startTracking();
		}
		else
			return;
	};
	( function () { rat.utils.inheritClassFrom( rat.Scoreboard, rat.ScoreBase ); } )();
	/**
	 * Hide the Firebase type so we can deal with linting warnings relating to it.
	 * @suppress {undefinedVars} - Don't warn about Firebase
	 */
	rat.Scoreboard.getFirebase = function ()
	{
		if (typeof (Firebase) !== 'undefined')
		{
			return Firebase;
		}
		return void 0;
	};

	rat.Scoreboard.topType = 1;
	rat.Scoreboard.aboveType = 2;
	rat.Scoreboard.belowType = 3;
	rat.Scoreboard.allType = 4;

	//	is this scoreboard online and reachable?
	rat.Scoreboard.prototype.isValid = function()
	{
		if (!this.boardRef)
			return false;
		else
			return true;
	};

	/**
	*	start tracking with the current type, ID, etc.
	*	Internal utility function to hook up some firebase stuff.
	*/
	rat.Scoreboard.prototype.startTracking = function()
	{
		if (!this.boardRef)
			return;
			
		//console.log("startTracking");
		var isRelativeType = (this.type === rat.Scoreboard.aboveType || this.type === rat.Scoreboard.belowType);
		if (isRelativeType && this.scoreView)
			return;	//	in this case, one time setup is fine - don't keep resetting it.
		//console.log("startTracking: check lastWritePri");
		if (isRelativeType && this.lastWritePriority)
			return;	//	in this case, we don't have sufficient data to start tracking.

		if (this.scoreView)
		{
			this.scoreView.off();	//	turn off all old events - we're about to rebuild them
		}
		this.scoreList = [];	//	start over on scores.  Todo: store old vals somewhere for drawing while we get new vals?

		//console.log("new setup for type " + this.type + ", lwp " + this.lastWritePriority + ", lwu " + this.lastWriteKey);
		if(this.type === rat.Scoreboard.topType)
			this.scoreView = this.boardRef.limit(this.trackCount);
		else if(this.type === rat.Scoreboard.belowType)
			this.scoreView = this.boardRef.endAt(this.lastWritePriority).limit(this.trackCount);
		else if(this.type === rat.Scoreboard.aboveType)
			this.scoreView = this.boardRef.startAt(this.lastWritePriority).limit(this.trackCount);
		else	//	all
			this.scoreView = this.boardRef;
		//	Note about the above...  startAt() is not working correctly currently if you specify a key in the second arg,
		//	so I'm skipping that.
		//	e.g. this.scoreView = this.boardRef.startAt(this.lastWritePriority, this.lastWriteKey).limit(this.trackCount);
		//	Why does "belowType" use "endAt" instead of "startAt"?  Because low-priority items come first in the list.

		var board = this;
		this.scoreView.on('child_added', function(snap, prevChildName)
		{
			//console.log('$ added: ' + snap.name() + " prevchild: " + prevChildName);
			board.handleScoreAdded(snap, prevChildName);
		});

		this.scoreView.on('child_removed', function(snap)
		{
			//console.log('$ removed')
			board.handleScoreRemoved(snap);
		});

		// handle when a score changes or moves positions.
		var changedCallback = function (scoreSnapshot, prevScoreName) {
			//console.log('$ changed')
			board.handleScoreRemoved(scoreSnapshot);
			board.handleScoreAdded(scoreSnapshot, prevScoreName);
		};
		this.scoreView.on('child_moved', changedCallback);
		this.scoreView.on('child_changed', changedCallback);
	};

	//	Make sure ranks are correct for all scores we're tracking.
	//	override for special firebase behavior
	rat.Scoreboard.prototype.updateRanks = function()
	{
		//	we only know ranks for top-scoreboard types, for now.  A weakness in Firebase.
		if(this.type !== rat.Scoreboard.topType && this.type !== rat.Scoreboard.allType)
			return;
		rat.ScoreBase.prototype.updateRanks.call(this);
	};

	//	A score was added (e.g. from another user).  Deal with it.
	/**
	 * @param {{val:function():Object,name:function():string}} snap
	 * @param {string=} prevChildName
	 */
	rat.Scoreboard.prototype.handleScoreAdded = function(snap, prevChildName)
	{
		var newScore = {};
		var val = snap.val();
		//var pri = snap.getPriority();

		newScore.data = val.data;
		newScore.keyName = snap.name();
		newScore.name = val.name;
		newScore.score = val.score;
		newScore.rank = null;	//	we'll figure it out later
		
		var index = 0;
		if(prevChildName !== null)
		{
			index = this.findScoreIndexByKey(prevChildName);
			if (index < 0)	//	hopefully never hit
				index = 0;	//	no previous child name found in list - put at start
		} else {
			index = this.scoreList.length;	//	no previous child name provided - must be last (remember score db is in low-pri-first order, and we want that flipped)
		}
		this.scoreList.splice(index, 0, newScore);

		this.updateRanks();

		this.changed = true;
	};

	//	A score was removed (e.g. by server).  Deal with it.
	rat.Scoreboard.prototype.handleScoreRemoved = function(snap)
	{
		//console.log("removing " + snap.name());
		var index = this.findScoreIndexByKey(snap.name());

		if(index !== -1)
			this.scoreList.splice(index, 1);

		this.changed = true;
	};

	//
	//	post a score with associated data, game-specific.
	//
	rat.Scoreboard.prototype.postScore = function(score, data)
	{
		if (!this.boardRef)
			return;
			
		//	OK, not using the real priority here is a kludge to work around a bug in Firebase...
		//	when that gets fixed, we need to fix the start/end calls, and remove this pri stuff here.
		//var pri = Math.floor(Math.random() * 10000) + score * 10000;
		//	bleah, that kludge is messing up predictability of score ranks for same scores, and I think we're ignoring that other bug now anyway...
		var pri = score * 10000;
		var entry = {score:score, data:data, name:this.localUserID};

		var ref = this.boardRef.push();	//	get unique entry, but don't set value yet - we need to set with priority
		ref.setWithPriority(entry, pri);	//	actual write.  This will also immediately call our handleScoreAdded function...
		
		//	remember our last actual write so we can find our own score later
		this.lastWriteKey = ref.name();
		this.lastWritePriority = pri;

		//console.log("postScore " + this.lastWritePriority);
		this.startTracking();	//	we can track scores around ours, now that we've posted one
	};

	//	Not implemented - we probably don't want to let a client clear the score list!
	rat.Scoreboard.prototype.clearScores = function()
	{
		if (!this.boardRef)
			return;
	};


	//----------------------------
	//	RelevantScores is a scoreboard that shows top scores as well as local user's scores and scores surrounding that.
	//	It's a sort of shell on top of several smaller scoreboard queries, not a subclass.
	//	Hasn't been used or tested, really.

	/**
	 * @constructor
	*/
	rat.RelevantScores = function(address, localUserID, numTop, numAround)
	{
		//	topscores is our main point of interaction with the leaderboard - post through it, let it store some values for us, etc.
		//	let it get a lot more than we're asked to display, in case we can pick up the user's rank....?
		this.topScores = new rat.Scoreboard(address, rat.Scoreboard.topType, localUserID, 10);
		//	these two are just different views of the same data, but need to be synced in a few ways manually
		this.aboveScores = new rat.Scoreboard(address, rat.Scoreboard.aboveType, localUserID, numAround+1);
		this.belowScores = new rat.Scoreboard(address, rat.Scoreboard.belowType, localUserID, numAround+1);

		this.numTop = numTop;
		this.numAround = numAround;

		this.scoreList = [];	//	gets constructed later (When?) from the results of the other scoreboards.
	};

	rat.RelevantScores.prototype.setLocalUserID = function(localUserID)
	{
		this.topScores.setLocalUserID(localUserID);
		this.aboveScores.setLocalUserID(localUserID);
		this.belowScores.setLocalUserID(localUserID);
	};

	rat.RelevantScores.prototype.postScore = function(score, data)
	{
		this.topScores.postScore(score, data);
		this.aboveScores.lastWriteKey = this.topScores.lastWriteKey;
		this.aboveScores.lastWritePriority = this.topScores.lastWritePriority;
		this.aboveScores.startTracking();
		this.belowScores.lastWriteKey = this.topScores.lastWriteKey;
		this.belowScores.lastWritePriority = this.topScores.lastWritePriority;
		this.belowScores.startTracking();

		//	combined score list needs rebuilding.
		//	Todo: store old version for display until this one gets finished?
		//	or just don't rebuild it unless we have an update (and some valid data) from the other lists?
		//this.scoreList = [];
	};

	rat.RelevantScores.prototype.collateLists = function()
	{
		if (!this.topScores.changed && !this.aboveScores.changed && !this.belowScores.changed)
			return;

		//console.log("collating...");
		this.scoreList = [];
		var topToAdd = this.numTop;
		var i;

		//	First get relative (above/below) scores.
		for (i = 0; i < this.aboveScores.scoreList.length; i++)
		{
			this.scoreList[this.scoreList.length] = this.aboveScores.scoreList[i];
		}

		//	here, start after the first entry, which is presumed to be us.
		for (i = 1; i < this.belowScores.scoreList.length; i++)
		{
			this.scoreList[this.scoreList.length] = this.belowScores.scoreList[i];
		}

		if (this.scoreList.length > 0)
		{
			//	now fix rank if we know it!
			//	just compare known players (in topScores list) with the top player in the relative list we just built.
			//	if one matches up, we can figure out the ranks.
			//	Differentiate between name (display) and keyName (database).  Here it should be keyName...
			for (i = 0; i < this.topScores.scoreList.length; i++)
			{
				if(this.topScores.scoreList[i].keyName === this.scoreList[0].keyName)
				{
					//	fix that rank and all below...
					var rank = this.topScores.scoreList[i].rank;
					for (var rIndex = 0; rIndex < this.scoreList.length; rIndex++)
					{
						this.scoreList[rIndex].rank = rank++;
					}

					//	also check if this matchup is within the top set we were about to add.
					//	if so, shorten that list, since we've already got them...
					if (i < this.numTop)
						topToAdd = i;

					break;
				}
			}
		}

		//	Prepend top scores
		//console.log("prepending " + topToAdd);
		for (i = 0; i < topToAdd && i < this.topScores.scoreList.length; i++)
		{
			this.scoreList.splice(i, 0, this.topScores.scoreList[i]);
		}
		//	with a gap marker if there is a gap
		if (topToAdd === this.numTop && this.scoreList.length > this.numTop)
			this.scoreList[this.numTop].gap = true;

		//	set some special flags
		for (i = 0; i < this.scoreList.length; i++)
		{
			if (this.scoreList[i].keyName === this.topScores.lastWriteKey)
				this.scoreList[i].isUser = true;
			else
				this.scoreList[i].isUser = false;
		}

		//console.log("total list " + this.scoreList.length);
		
		this.topScores.changed = false;
		this.aboveScores.changed = false;
		this.belowScores.changed = false;
	};

	rat.RelevantScores.prototype.getScores = function()
	{
		this.collateLists();	//	update only if needed
		return this.scoreList;
	};

	//---------------------------------------------------------------
	//	LocalScoreboard is a Scoreboard that uses local store (rat store class) instead of firebase.
	//
	//	Currently, we assume that we are the only person writing to this scoreboard.
	//	So, we can read it once on startup, and after that we always have the latest version.
	//
	//	boardName should be fully unique across all apps, e.g. "myFrogGameTopScores".

	/**
	 * @constructor
	 * @extends rat.ScoreBase
	*/
	rat.LocalScoreboard = function ( boardName, scoreboardType, localUserID, trackCount )
	{
		rat.Scoreboard.prototype.parentConstructor.call( this, scoreboardType, localUserID, trackCount ); //	default init

		this.boardName = boardName;

		var s = rat.storage.getStorage( rat.storage.permanentLocal );	//	might take some time

		//	TEMP for debugging empty lists.
		//s.remove(this.boardName);

		this.scoreList = s.getObject( this.boardName );	//	might take some time
		if( !this.scoreList )
			this.scoreList = [];
		this.updateRanks();
	};
	(function(){ rat.utils.inheritClassFrom( rat.LocalScoreboard, rat.ScoreBase ); })();

	//
	//	post a score with associated data
	//
	rat.LocalScoreboard.prototype.postScore = function(score, data)
	{
		var pri = score * 10000;
		var entry = {score:score, data:data, name:this.localUserID};

		//	find index, insert in list, update full list in localstore.

		//	find index
		var index = this.getScorePosition(score);
		//	insert new score
		this.scoreList.splice(index, 0, entry);
		this.updateRanks();

		//	remember our last actual write so we can find our own score later, if needed?
		this.lastWriteKey = this.localUserID;	//	this is actually supposed to be a UNIQUE key in the array, but that's not supported yet...
		this.lastWritePriority = pri;

		//	truncate list based on trackCount
		if (this.scoreList.length > this.trackCount)
			this.scoreList.splice(this.trackCount, this.scoreList.length - this.trackCount);

		//	update full stored version now.
		var s = rat.storage.getStorage(rat.storage.permanentLocal);
		s.setObject(this.boardName, this.scoreList);
	};

	rat.LocalScoreboard.prototype.clearScores = function ()
	{
		this.scoreList = [];
		var s = rat.storage.getStorage(rat.storage.permanentLocal);
		s.setObject(this.boardName, this.scoreList);
	};

} );