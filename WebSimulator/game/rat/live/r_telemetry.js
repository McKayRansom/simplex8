//
//	Telemetry
//
//	A wrapper class for storing (somewhere - in this initial case, Firebase) usage data
//
//	March 2013 Steve
//
//	TODO:
//		* at the same level as the timestamp per session (which is separate from session log), store a
//			most recent timestamp (write to this (optionally?) each time you write anything)
//			or even a closing timestamp, if firebase will support that.
//			In fact, better, store the total elapsed time.
//		* new functions to write a user value or a session value without necessarily incrementing it.
//		
rat.modules.add( "rat.live.r_telemetry",
[
	"rat.storage.r_storage",
], 
function(rat)
{

	rat.telemetry = {
		ref : null,
		userRef : null,
		sessionRef : null,
		id : 0,
		enableUIRecording : false,	//	off by default - just set this true to enable all ui event logging

		//	Init telemetry with this firebase address,
		//	and other settings.
		init : function(address, opts)
		{
			rat.telemetry.ref = null;
			if (typeof(Firebase) !== 'undefined')	//	is our firebase stuff reachable?
			{
				rat.telemetry.ref = new Firebase(address);
			}
			if (!rat.telemetry.ref)
				return;
			
			opts = opts || {trackSessionTime:true};
			rat.telemetry.opts = opts;

			//	figure out anonymous user id, generate if it doesn't exist
			var s = rat.storage.getStorage(rat.storage.permanentLocal);
			var id = s.getItem('rat_anon_id');
			if (id)
			{
				//	OK
			} else {
				//	make a new id, using some date elements to help sort it.
				var xd = new Date();
				var y = xd.getUTCFullYear() - 2000;
				var m = '' + (xd.getUTCMonth()+1);
				if (m < 10)
					m = '0' + m;
				var d = '' + xd.getUTCDate();
				if (d < 10)
					d = '0' + d;
				id = 'rid_' + y + m + d + '_' + Math.floor(Math.random() * 100000000);
				s.setItem('rat_anon_id', id);
				console.log(id);
			}
			rat.telemetry.id = id;
			rat.telemetry.userRef = rat.telemetry.ref.child(id);
			
			//	store agent info
			if (typeof navigator !== 'undefined')
			{
				//console.log(navigator);
				var clientInfo = {};
				clientInfo.appCodeName = navigator.appCodeName || 0;
				clientInfo.appName = navigator.appName || 0;
				clientInfo.appVersion = navigator.appVersion || 0;
				//clientInfo.cookieEnabled = navigator.cookieEnabled || 0;	//	who cares?
				clientInfo.platform = navigator.platform || 0;
				clientInfo.userAgent = navigator.userAgent || 0;
				clientInfo.cpuClass = navigator.cpuClass || 0;
				rat.telemetry.userRef.child('clientInfo').set(clientInfo);
			}

			//	start a new session
			var date = new Date();
			var tString = date.toUTCString();
			rat.telemetry.sessionRef = rat.telemetry.userRef.child('sessions').push({timeStart:tString, server_ts:Firebase.ServerValue.TIMESTAMP});
			//	write session end time on exit
			rat.telemetry.sessionRef.child('server_te').onDisconnect().set(Firebase.ServerValue.TIMESTAMP);
			
			this.sLog = "";	//	start with empty session log
		},

		//	increment a count for this user (increments across all sessions)
		userIncrement : function(key, amount)
		{
			if (!rat.telemetry.ref || !rat.telemetry.userRef)
				return;
			if (!amount)
				amount = 1;
			try {
				rat.telemetry.userRef.child(key).transaction(function(curVal) {
					return curVal+amount;
				});
			} catch (e) {}	//	suppress any error, so using telemetry doesn't become annoying
		},
		
		//	set a per-user value for this user (independent of sessions)
		userWrite : function(name, value)
		{
			if (!rat.telemetry.ref || !rat.telemetry.userRef)
				return;
			if (!value)
				value = true;
			rat.telemetry.userRef.child(name).set(value);
		},

		//	increment a count for this user, for this session
		sessionIncrement : function(key, amount)
		{
			if (!rat.telemetry.ref || !rat.telemetry.sessionRef)
				return;
			if (!amount)
				amount = 1;
			
			try {
				rat.telemetry.sessionRef.child(key).transaction(function(curVal) {
					return curVal+amount;
				});
			} catch (e) {}	//	suppress any error
			rat.telemetry.trackSessionTime();
		},
		
		//	append to this session's log, which is assumed to be a single string that grows,
		//	and is written each time this function is called.
		sessionLog : function(value, doWrite)
		{
			if (!rat.telemetry.ref || !rat.telemetry.userRef)
				return;
			this.sLog += ("" + value);
			if (typeof(doWrite) === 'undefined' || doWrite)
				this.sessionWrite("log", this.sLog);
		},
		
		//	write this single value for the session, overwriting whatever else was there in this named space.
		sessionWrite : function(name, value)
		{
			if (!rat.telemetry.ref || !rat.telemetry.userRef)
				return;
			rat.telemetry.sessionRef.child(name).set(value);
			rat.telemetry.trackSessionTime();
		},
		
		//	track right now as the last time the session was updated.
		//	(if our telemetry options are set to do so)
		//	This means 2 writes each time anything is updated, which is why it's optional - maybe that's more traffic
		//	than you wanted.
		trackSessionTime : function()
		{
			if (rat.telemetry.opts.trackSessionTime)
			{
				var date = new Date();
				var tString = date.toUTCString();
				rat.telemetry.sessionRef.child('timeLast').set(tString);
			}
		},

		//	increment a count for all users
		globalIncrement : function(key, amount)
		{
			if (!rat.telemetry.ref)
				return;
			if (!amount)
				amount = 1;
			//try {
				rat.telemetry.ref.child('global').child(key).transaction(function(curVal) {
					return curVal+amount;
				});
			//} catch (e) {}	//	suppress any error
		},
		
		//	record an event, for this session, with a timestamp
		record : function(eventName, value)
		{
			if (!rat.telemetry.ref || !rat.telemetry.sessionRef)
				return;
			try {
				var d = new Date();
				//var tString = d.toUTCString();
				//rat.telemetry.sessionRef.push({event:eventName, value:value, ts:tString});

				//	more compact version, embed timestamp and event name in key, so they're easy to scan visually,
				//	and if their value is a string, it'll show up as one line in Firebase Forge
				var ts = d.getTime();
				var hours = d.getUTCHours();
				var minutes = d.getUTCMinutes();
				var seconds = d.getUTCSeconds();
				var s = ((hours<9)?'0':'') + hours + '_' + ((minutes<9)?'0':'') + minutes + '_' + ((seconds<9)?'0':'') + seconds + '_' + eventName;
				//console.log("TIME: [" + s + "]," + ts);
				rat.telemetry.sessionRef.child(s).setWithPriority(value, ts);
			} catch (e) {
				//	suppress any error
			}
		},

		//	UI record - record a UI event.  This is a way to get fine-tuned data from the user navigating screens.
		//	This is directly supported by the rat UI system, but can be disabled (rat.telemetry.enableUIRecording = false)
		recordUI : function(eventName, value)
		{
			if (!rat.telemetry.enableUIRecording)
				return;
			//console.log("record UI " + eventName + " + " + value);
			rat.telemetry.record(eventName, value);
		},
	};
} );