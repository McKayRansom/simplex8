//
//	Audio module
//
//	Eventual Features:
//		Load sounds ready for playing by id
//		Handling of different formats for different browsers/platforms
//		Set up sounds in groups and pick random sounds in those groups when requested
//		Restart sounds when played in succession
//		Master volume.
//			Master fade in/out?
//		Per-sound properties like how far into the sound to get before allowing restarting
//
//		Background music track handling:
//			independent mute/volume for music
//			support automatically looping through a set of tracks?  (not high priority)
//			convenient function for transitioning to new track,
//				which includes fading current track out automatically
//
//		Bug fixing To do:
//
//			Bug:  If browser supports mp3 and extension is not specified, we try m4a but not mp3.
//
//			Check out melonjs - does his audio work with iOS?  He does retry after error like other solutions,
//			but how will that work on iPad?
//
//			How about the trick one guy mentioned where he loads audio without identifying it as audio format,
//			so iOS browsers don't screw with it.
//		very potentially useful:
//			http://stackoverflow.com/questions/3009888/autoplay-audio-files-on-an-ipad-with-html5/8001076#8001076
//		wow, yeah, this could possibly all be fixed by doing the sound load in response to a click?  That'd be interesting...
//			load() then play() in response to a synchronous click handler
//		read http://stackoverflow.com/questions/3619204/how-to-synthesize-audio-using-html5-javascript-on-ipad?rq=1
//		read http://stackoverflow.com/questions/5758719/preloading-html5-audio-in-mobile-safari?rq=1
//
//	References:
//		https://www.scirra.com/blog/44/on-html5-audio-formats-aac-and-ogg
//		http://stackoverflow.com/questions/1007223/which-browsers-support-the-html-5-audio-tag-on-windows-today
//		canplay stuff: http://html5doctor.com/native-audio-in-the-browser/
//		stalling safari audio: http://stackoverflow.com/questions/4201576/html5-audio-files-fail-to-load-in-safari
rat.modules.add( "rat.audio.r_audio",
[
	"rat.debug.r_console",
	"rat.os.r_system",
	{name: "rat.audio.r_audio_single", platform: "PS4Browser"}
], 
function(rat)
{
	function log(txt, eventType)
	{
		if (!eventType)
			eventType = txt;
		rat.console.logOnce( "| r_audio: " + txt, eventType);
	}
	
	rat.audio = {	//	audio namespace
		initialized : false,
		soundOn: true,
		defaultGroup: "sfx",

		globalVolume: 1,

		groupVolumes:{},
		//cacheLoaded: false,

		toLoadCount: 0,
		loadedCount: 0,
		preferedExt: "", // If no extension was provided, try this one first

		//	some systems (e.g. PS4 browser) work better if we load sequentially
		useSequentialLoad : false,
		activeSequentialLoad : false,	//	are we in the middle of handling load jobs?
		loadJobs: [],	//	load jobs queued up
		
		initialDebug : false,
		verboseDebug : false,

		sounds: {},	//	hashtable of sound info, always accessed by literal sound ID (string)
		dukTapeSound : null,	//	see below

		//	music : [],

		/**
		 *@suppress {undefinedVars} - Don't warn about undefined Audio, as it is defined
		 */
		audioConstructor: function ()
		{
			return new Audio();
		},

		//	one-time system-level init
		//	rAudio argument here is optional.  If not supplied, set up global rat.audio object.
		init: function (useAudioSystem)
		{
			var rAudio;
			if (typeof(useAudioSystem) === 'undefined')
				rAudio = rat.audio;
			else
				rAudio = useAudioSystem;

			if (rAudio.initialDebug)
				log("Init");
			
			rAudio.iOSBrowser = rat.system.has.iOSBrowser;
			rAudio.PS4Browser = rat.system.has.PS4Browser;
			
			//	create an audio object so we can query play abilities
			var myAudio = rAudio.audioConstructor();

			if (myAudio.canPlayType)
			{
				// Currently canPlayType(type) returns: "", "maybe" or "probably" 
				rAudio.canPlayMp3 = !!myAudio.canPlayType('audio/mpeg');	//	mp3
				rAudio.canPlayM4a = !!myAudio.canPlayType('audio/mp4; codecs="mp4a.40.5"');	//	aac
				rAudio.canPlayOgg = !!myAudio.canPlayType('audio/ogg; codecs="vorbis"');	//	ogg
				rAudio.canPlayXMA = !!myAudio.canPlayType('audio/xma2;');					//	xma
				rAudio.canPlayWav = true;	// !!myAudio.canPlayType( 'audio/wav' );			//	wav - also tried with adding  ; codecs="1"  -- to no avail, this returns false on IE and XBO when they will indeed play it
				//	todo: 
				
				if (rAudio.PS4Browser)	//	PS4 browser lies about AAC/MP4/M4a playback ability
					rAudio.canPlayM4a = true;

				if (rAudio.initialDebug)
				{
					log("can play: " +
						 "mp3(" + rAudio.canPlayMp3 + ") " +
						 "m4a(" + rAudio.canPlayM4a + ") " +
						 "ogg(" + rAudio.canPlayOgg + ") " +
						 "xma(" + rAudio.canPlayXMA + ") " +
						 "wav(" + rAudio.canPlayWav + ") " +
						 "\n");
				}
			}

			// [JSalmond May 14, 2014] If i don't add this ref here, my dukTape garbage collector dies when i shutdown, and i don't know why.
			// PLEASE don't remove this
			rAudio.dukTapeSound = myAudio;
			
			rAudio.initialized = true;
		},
		
		//	Load (preload) sounds into the audio system.
		//	Here are some examples of the various ways to use this function.
		//	rat.audio.loadSounds([
		//		{id:'fire', resource:"sounds/fire123.m4a"},	//	normal sound with specified id
		//		{id:'hit', resource:"sounds/hit123", volume:0.8}	//	don't need extension, can specify volume
		//		"sounds/bob.m4a"}	//	just specify resource, in which case id is final filename ('bob')
		//		["sounds/cry.m4a", "sounds/cry2.m4a", "sounds/cry3.m4a"],	//	list of sounds, id is first id ('cry'), and a random one is picked when played
		//		[{id:'cry', resource:"sounds/cry.m4a"}, {resource:"sounds/cry2.m4a"}],	//	alternative form
		//	]);
		//	TODO:  Can we support this function being called several times?  We need to, if it doesn't work already.
		loadSounds: function (sounds)
		{
			//	use our loadSoundList utility function, and have it call our actual sound creator function here.
			//	this separates processing and loading functionality, which makes it easier for other modules to build on this one.
			
			function loadTrigger(res, entry)
			{
				var a = rat.audio.audioConstructor();
					
				if (rat.audio.useSequentialLoad)
				{
					rat.audio.loadJobs.push({a:a, res:res, soundInfo:entry});
				} else {
					rat.audio.doSingleLoad(a, res, entry);	//	trigger actual load
				}

				var vol = 1;
				if (entry.volume !== void 0)
					vol = entry.volume;
				a.entryVolume = vol;
				a.group = entry.group || rat.audio.defaultGroup;
				if( rat.audio.groupVolumes[a.group] !== void 0 )
					vol *= rat.audio.groupVolumes[a.group];
				a.volume = vol * rat.audio.globalVolume;
				return a;
			}
			
			rat.audio.sounds = rat.audio.loadSoundList(sounds, loadTrigger);
			
			if (rat.audio.useSequentialLoad && !rat.audio.activeSequentialLoad)	//	if not already loading, and we have loading to do, do it
			{
				rat.audio.processQueuedLoad();
			}
			
		},
		
		//	INTERNAL function - clients use loadSounds above.
		//	This function processes a sound list, like above, but calls another function to actually load/create each sound.
		//	returns an internal list of sounds.
		loadSoundList : function(sounds, loadTrigger)
		{
			if (!rat.audio.initialized)
			{
				//	If you get here, it's probably because you're initializing your audio module too early,
				//	(e.g. you have it self-initializing as its js file is loading),
				//	and as a result you're calling rat.audio.loadSounds before calling rat.init.
				//	rat audio is initialized from rat.init, and you need to call that before initializing your audio.
				log("!!NOT INITIALIZED before loadSounds");
			}
			
			var mySoundList = {};	//	hash of sounds
			
			//	Order of preference
			var ext;
			if( rat.audio.canPlayM4a )
				ext = ".m4a";
			else if( rat.audio.canPlayMp3 )
				ext = ".mp3";
			else if( rat.audio.canPlayOgg )
				ext = ".ogg";
			else if( rat.audio.canPlayXMA )
				ext = ".xma";
			else if( rat.audio.canPlayWav )
				ext = ".wav";
			else
			{
				log( "Unable to find support audio file format.  Defaulting to .m4a" );
				ext = ".m4a";	
			}
			if (rat.audio.initialDebug)
				log("load using " + ext);

			//	Queue up all the sounds we need loaded.
			for (var i = 0; i < sounds.length; i++)
			{
				var pieceList = sounds[i];
				if (!Array.isArray(pieceList))
					pieceList = [sounds[i]];	//	convert each item to an array for convenience

				var id;	//	there will be a single shared id for all sounds in this group
				var list = [];
				var dotPos;
				
				//	loop through all pieces for this ID
				for (var pieceIndex = 0; pieceIndex < pieceList.length; pieceIndex++)
				{
					//	todo put inside another object so we can independently track some runtime variables,
					//	like priority when randomly selecting
					//	right now, we just have actual audio objects.

					var entry = pieceList[pieceIndex];

					var res;
					if (typeof entry === 'string')	//simple case - they just named a resource.  Build an entry object for them.
					{
						res = entry;	//	the resource file name
						dotPos = res.lastIndexOf('.');
						if (dotPos < 0)
						{
							dotPos = res.length;
							if( rat.audio.preferedExt )
							{
								if( rat.audio.preferedExt[0] !== "." )
									res += ".";
								res += rat.audio.preferedExt;
							}
						}
						var slashPos = res.lastIndexOf('/');
						if (slashPos < 0)
							slashPos = 0;	//	there isn't one
						else
							slashPos++;	//	skip it
						var resID = res.substring(slashPos, dotPos);	//	in this case the id is filename without path or extension
						entry = { id: resID, resource: res, volume: 1 };	//	build a full entry to simplify code below
					} else
					{	//	normal
						res = entry.resource;
					}

					//	rewrite extension to our standard extension, if we can't play the type specified.
					//	(if we can play the specified type, then that's fine - use that)
					
					dotPos = res.lastIndexOf('.');
					if (dotPos < 0)
						dotPos = res.length;
					var extString = res.substring(dotPos, res.length);
					//console.log("extString " + extString);
					if (!((extString === '.mp3' && rat.audio.canPlayMp3) ||
							(extString === '.m4a' && rat.audio.canPlayM4a) ||
							(extString === '.ogg' && rat.audio.canPlayOgg) ||
							(extString === '.xma' && rat.audio.canPlayXMA) ||
							(extString === '.wav' && rat.audio.canPlayWav)))
					{
						//console.log("replacing " + extString + " with " + ext + " because !" + rat.audio.canPlayMp3);
						res = res.substring(0, dotPos) + ext;
					}

					res = rat.system.fixPath(res);	//	let rat fix up our path, e.g. if we're in some strange hosted environment
					
					rat.audio.toLoadCount++;
					
					var a = loadTrigger(res, entry);
					
					list[pieceIndex] = a;
					
					if (pieceIndex === 0)	//	if this is the first entry in the list, use the same id for later entries.
						id = entry.id;
					
				}	//	end of piece list loop

				if (mySoundList[id])	//	already defined this sound?  If so, this will screw up counts...
				{
					log("ERROR: " + id + " redefined!", id);
					rat.audio.toLoadCount--;
				}
				mySoundList[id] = list;
			}
			
			return mySoundList;

		},	//	end of loadSounds function
		
		//	handle the next available load job
		processQueuedLoad : function()
		{
			if (!rat.audio.loadJobs || rat.audio.loadJobs.length <= 0)
			{
				if (rat.audio.verboseDebug)
					log("Done with sequential load.");
				rat.audio.activeSequentialLoad = false;
				return;
			}
			
			if (rat.audio.verboseDebug)
				log("rat.audio: New sequential load job...");
			
			rat.audio.activeSequentialLoad = true;
			
			var job = rat.audio.loadJobs[0];
			rat.audio.loadJobs.splice(0, 1);
			rat.audio.doSingleLoad(job.a, job.res, job.soundInfo);	//	trigger actual load
		},
		
		//	load a single sound.
		//	This is an internal call, generally not for external use.
		//	Clients:  use loadSounds above, instead.
		doSingleLoad : function (a, res, soundInfo)
		{
			if (rat.audio.verboseDebug)
				log("triggering load " + soundInfo.id + " : " + res + " at volume " + soundInfo.volume);

			//	iPad is making things really hard.
			//	The behavior we're seeing is this:
			//		sound a starts loading, and is suspended
			//		sound b starts loading, gets to canplaythrough
			//		sound b gets stall event, even though it's fine
			//		sound a never gets another event.
			//	That's the simple case.  If we load lots of files, man, who knows.  Safari goes stupid.
			//	We can't just load() or play() on stall, because it restarts the load, and we loop infinitely?
			//		(plus, we're getting the stall on an object we're already happy with)
			//	2014.06.26	STT:  I found on the PS4 browser that loading in sequence instead of parallel made these problems go away.
			//	That might work on iOS, too, since the problems are the same.
			//	But see above, notes on loading in response to user input.
			
			/**
			 * In this case, this will be the audio object that we bind to the function, but i don't know how to let the linting tool know that
			 * @suppress {globalThis}
			 */
			function on_stalled(e)
			{
				//log('on_stalled');
				//log('. id : ' + soundInfo.id);
				//log('. . . dur: ' + this.duration);
				////log('   error: ' + this.error.code);
				//log('. . . readyState: ' + this.readyState);
			}

			/**
			 * In this case, this will be the audio object that we bind to the function, but i don't know how to let the linting tool know that
			 * @suppress {globalThis}
			 */
			function on_load(e)
			{
				//log('on_load');
				//log('. id : ' + soundInfo.id);
				//log('. . . dur: ' + this.duration);
				////log('   error: ' + this.error.code);
				//log('. . . readyState: ' + this.readyState);

				// the callback gets called twice in Firefox if we don't remove the handler
				this.removeEventListener('canplaythrough', on_load, false);
				this.removeEventListener('error', on_error, false);
				
				//	don't remove stalled event?  We get a stall event for loaded sounds instead of the ones
				//	that aren't loading?  iOS sucks.
				this.removeEventListener('stalled', on_stalled, false);

				//	todo: move this "ratLoaded" flag into an outer object(audioInfo) that contains this audio object.
				//		don't modify standard object types.
				if (!this.ratLoaded)
				{
					this.ratLoaded = true;
					rat.audio.loadedCount++;
					if (rat.audio.verboseDebug)
						log( rat.audio.loadedCount + "/" + rat.audio.toLoadCount + " loaded: "  + this.src);
					
					//	if we're doing sequential loading, trigger the next load
					if (rat.audio.useSequentialLoad)
						rat.audio.processQueuedLoad();
				}
			}

			/**
			 * Called when an audio load failes
			 * @suppress {globalThis}
			 */
			function on_error(e)
			{
				log('encountered error while loading: ' + this.src);
				//log('. . . dur: ' + this.duration);
				////log('   error: ' + this.error.code);
				//log('. . . readyState: ' + this.readyState);

				//	this will mark this one loaded, so we can move on with the game instead of locking up waiting for load.
				var self = this;
				on_load.call(self, e);
			}
			
			a.preload = 'auto';	//	ignored on some systems, e.g. safari ios

			a.addEventListener('canplaythrough', on_load, false);
			a.addEventListener('stalled', on_stalled, false);
			a.addEventListener('error', on_error, false);

			a.src = res;
			
			//	some debug events...

			//	debug function to track events
			//function announce(media, ev)
			//{
			//	var self = media;
			//	media.addEventListener(ev, function(e)
			//	{
			//		log("  # "+ev+" " + self.src);
			//	}, false);
			//}

			/*
			a.addEventListener('loadstart', function (e) {
				//log('loadstart ' + this.src);
				if (this.src.search("chirp") >= 0 || this.src.search("throw") >= 0)
				{
					log("loadstart " + this.src);
					log("duration " + this.duration);
					log("time " + this.currentTime);
					log("error " + (this.error && this.error.code));
					//	Check for our own errors here?
					//	like invalid length...
				}
			}, false)
			a.addEventListener('suspend', function (e) {
				//log('suspend ' + this.src);
				if (this.src.search("chirp") >= 0 || this.src.search("throw") >= 0)
				{
					log("suspend " + this.src);
					log("duration " + this.duration);
					log("time " + this.currentTime);
					log("error " + (this.error && this.error.code));
					//	Check for our own errors here?
					//	like invalid length...
				}
			}, false)
			*/

			/*
			a.addEventListener('canplay', function (e) {
				log('canplay ' + this.src);
			})
		
			a.addEventListener('canplaythrough', function (e) {
				log('canplaythrough' + this.src);
			})
			//log("moving on " + res);
			*/

			//	load() is required for safari on ipad, in order to force load.
			//	otherwise safari will not load this sound until I actually try to play it.
			//	maybe in order to save bandwidth...?
			//	bleah, half the time it still won't load it.
			//	May be required on PS4 as well
			a.load();

		},
		
		//	internal utility to pick a random sound (or only sound or whatever) given a sound ID.
		//	This is how we support playing random sounds from a list that share an ID
		
		selectSound : function(soundID)
		{
			if (!rat.audio.soundOn)
				return null;

			if (!rat.audio.sounds[soundID])
			{
				log("tried to play nonexistent sound " + soundID, soundID);
				return null;
			}

			var soundPossibles = rat.audio.sounds[soundID];
			var sound;
			if (soundPossibles.length <= 0)
			{
				log("tried to play from empty list " + soundID, soundID);
				return null;
			}
			else if (soundPossibles.length > 1)
				sound = soundPossibles[(Math.random() * soundPossibles.length) | 0];
			else
				sound = soundPossibles[0];
				
			return sound;
		},

		//	play a sound by ID
		playSound: function (soundID)
		{
			var sound = rat.audio.selectSound(soundID);
			if (!sound)
				return;
			
			//	todo: only rewind if time is beyond a certain point, configurable per individual sound
			if (!sound.ended && sound.currentTime > 0 && !sound.paused) // sound will resume if paused, not restart
			{
				//console.log("already playing " + soundID + " at " + sound.currentTime + "/" + sound.duration + ", vol " + sound.volume);
				if (rat.system.has.Wraith)
				{
					// We have no set functionality on currentTime in Wraith, so we call the stop function.
					sound.stop();
				}
				else
				{
					// The stop function is not currently a part of HTML5, so set the time to the begining.
					sound.currentTime = 0;
				}
			}

			sound.play();
		},

		pauseSound: function (soundID)
		{
			if (!rat.audio.sounds[soundID])
			{
				log("tried to pause nonexistent sound " + soundID, soundID);
				return;
			}

			//	for now, let's pause them all
			//	an alternative would be to see which (if any) is playing, and pause those...
			var soundPossibles = rat.audio.sounds[soundID];
			for (var i = 0; i < soundPossibles.length; i++)
			{
				var sound = soundPossibles[i];
				if (sound)
					sound.pause();
			}
		},

		// returns a sound to the starting position
		resetSound: function (soundID)
		{
			if (!rat.audio.sounds[soundID])
			{
				log("tried to reset nonexistent sound " + soundID, soundID);
				return;
			}

			var soundPossibles = rat.audio.sounds[soundID];
			
			//	reset them all
			for (var i = 0; i < soundPossibles.length; i++)
			{
				var sound = soundPossibles[i];
				if (sound && sound.currentTime !== 0)
					sound.currentTime = 0;
			}
		},

		//	stop and reset a sound to starting position
		stopSound: function (soundID)
		{
			rat.audio.pauseSound(soundID);
			rat.audio.resetSound(soundID);
		},
		
		//	seek sound to a certain point
		seekSound: function (soundID, toWhence, isNormalized)
		{
			if (!rat.audio.sounds[soundID])
			{
				log("tried to reset nonexistent sound " + soundID, soundID);
				return;
			}
			
			if (typeof(isNormalized) === 'undefined')
				isNormalized = false;
			
			var soundPossibles = rat.audio.sounds[soundID];
			for (var i = 0; i < soundPossibles.length; i++)
			{
				var sound = soundPossibles[i];
				if (!sound)
					continue;
				var dur = sound.duration;
				var target = toWhence;
				if (isNormalized)
					target *= dur;
				sound.currentTime = target;
			}
			
		},
		
		//	get current volume for this sound.
		//	if more than one sound, return first volume.
		//	TODO: support specifying sub-sound in one of several ways
		//		with sound id in a format like 'soundid:2'
		//		or with a struct that includes id and subindex (if not a struct, just assume id)
		//		or with an additional argument?
		//	and then carry that support to all other applicable functions in a generic way, which includes
		//		support for acting on all subsounds, e.g. set volume for all or pause all...
		//		probably through some "apply to sounds" function system where we pass in an anonymous function
		//	NOTE: With sound groups, this returns the volume set for the sound, not the calculated volume.
		getSoundVolume: function (soundID)
		{
			if (!rat.audio.sounds[soundID])
			{
				log("tried to get volume for nonexistent sound " + soundID, soundID);
				return;
			}

			var soundPossibles = rat.audio.sounds[soundID];
			var sound = soundPossibles[0];
			return sound.entryVolume;
		},
		
		//	Set the volume on a single sound.
		setSoundVolume: function (soundID, volume)
		{
			if (!rat.audio.sounds[soundID])
			{
				log("tried to set volume for nonexistent sound " + soundID, soundID);
				return;
			}

			var soundPossibles = rat.audio.sounds[soundID];
			for (var i = 0; i < soundPossibles.length; i++)
			{
				var sound = soundPossibles[i];
				if (!sound)
					continue;
				if (rat.audio.groupVolumes[sound.group] === void 0)
					rat.audio.groupVolumes[sound.group] = 1;
				sound.entryVolume = volume;
				sound.volume = volume * rat.audio.groupVolumes[sound.group] * rat.audio.globalVolume;
			}
		},
		
		//	Set if a sound is a looping sound
		setSoundLooping: function(soundID, loop)
		{
			loop = !!loop;
			if (!rat.audio.sounds[soundID])
			{
				log("tried to call setSoundLooping nonexistent sound " + soundID, soundID);
				return;
			}
			
			var soundPossibles = rat.audio.sounds[soundID];
			for (var i = 0; i < soundPossibles.length; i++)
			{
				var sound = soundPossibles[i];
				if (!sound)
					continue;
				if (sound.loop != loop)
					sound.loop = loop;
			}
		},

		//	Set the volume of a given audio group
		setGroupVolume: function(group, volume)
		{
			var sound;
			var entry;
			if (volume !== rat.audio.groupVolumes[group])
			{
				rat.audio.groupVolumes[group] = volume;
				for (var id in rat.audio.sounds)
				{
					sound = rat.audio.sounds[id];
					for (var index = 0; index !== sound.length; ++index)
					{
						entry = sound[index];
						if (entry.group !== group)
							continue;
						entry.volume = entry.entryVolume * volume * rat.audio.globalVolume;
					}
				}
			}
		},

		//	Set the global volume level
		setGlobalVolume: function(volume)
		{
			if (volume === rat.audio.globalVolume)
				return;
			rat.audio.globalVolume = volume;
			var sound;
			var entry;
			for (var id in rat.audio.sounds)
			{
				sound = rat.audio.sounds[id];
				for (var index = 0; index !== sound.length; ++index)
				{
					entry = sound[index];
					if (rat.audio.groupVolumes[entry.group] === void 0)
						rat.audio.groupVolumes[entry.group] = 1;
					//var volumeWas = entry.volume;
					entry.volume = entry.entryVolume * rat.audio.groupVolumes[entry.group] * rat.audio.globalVolume;
					//log("changed sound " + id +"-" + index + " to volume " + entry.volume + " from " + volumeWas);
				}
			}
		},

		//	do regular maintenance
		update: function (dt)
		{
		},

		//	how many sounds are registered?  mostly for debug?
		getSoundCount: function ()
		{
			var count = 0;
			for (var key in rat.audio.sounds)
			{
				if (rat.audio.sounds.hasOwnProperty(key))
					count++;
			}
			return count;
		},

		//	get nth sound (mostly for debug?)
		getSoundIDByIndex: function (index)
		{
			var count = 0;
			for (var key in rat.audio.sounds)
			{
				if (rat.audio.sounds.hasOwnProperty(key))
				{
					if (count === index)
						return key;
					count++;
				}
			}
			return 'error';	//	bogus index, return bogus ID
		},

		//	get internal info - mostly debug? should probably not depend on this internal structure staying the same.
		//	OR, it should be well documented and standard that this info will stay the same.
		getSoundInfo: function (id)
		{
			var entry = rat.audio.sounds[id];
			if (entry)
			{
				var first = entry[0];
				var info = {
					id: id,
					duration: first.duration,
					source: first.src,
					volume: first.volume,
					currentPos: first.currentTime,
					readyState: first.readyState,
					errorCode: 'none',
				};
				
				if (first.error)
					info.errorCode = first.error.code;

				return info;
			} else
			{
				log("Requested info for nonexistent sound" + id, soundID);
				return null;
			}
		},
		
		//	what time is this sound at
		getSoundCurrentTime: function (id)
		{
			var entry = rat.audio.sounds[id];
			if (entry)
			{
				var first = entry[0];
				return first.currentTime;
			}
			return 0;
		},

		//	Determines if a given sound is loaded.
		//	From Ethan.  STT is not sure how this works, but hasn't asked Ethan.
		//	see code above that skips this now.
		//	(doesn't seem to be correct on iPad)
		isSoundLoaded: function (id)
		{
			var entry = rat.audio.sounds[id];
			if (!entry)
			{
				log("Tried to check if nonexistent audio (" + id + ") is loaded");
				return null;
			}

			if (entry[0].error !== null)
			{
				// there is an 'error'
				return 'error';
			}

			// https://developer.mozilla.org/en-US/docs/DOM/TimeRanges
			// we'll assume that there is only one range
			var range = entry[0].buffered;

			// log(entry, range, entry[0].duration);

			return (range.length === 1 && range.start(0) === 0 && range.end(0) === entry[0].duration);
		},

		//	return true if all sounds listed in cache are loaded
		isCacheLoaded: function ()
		{
			//	note:  This will need some more sophistication if we ever support removing sounds
			//log("audio load checking " + rat.audio.loadedCount + " >= " + rat.audio.toLoadCount);
			if (rat.audio.loadedCount >= rat.audio.toLoadCount)
				return true;
			else
			{
				//if (rat.audio.loadStalled)	//	freaking iPad
				if (rat.audio.iOSBrowser)	//	todo:  fix this with sequential loading?
					return true;
				return false;
			}

			//return rat.audio.cacheLoaded == true;
		},

		//	is this sound actively playing?
		isSoundPlaying: function (id)
		{
			var entry = rat.audio.sounds[id];
			if (entry)
			{
				var first = entry[0];
				//console.log("cp " + first.currentTime);
				if (first.currentTime > 0 && first.currentTime < first.duration)
					return true;
			}
			return false;
		},

		//	what sound listed in cache is not loaded?  mostly debug.
		whatIsMissing: function ()
		{
			var totalCount = 0;
			var missingCount = 0;
			for (var key in rat.audio.sounds)
			{
				if (rat.audio.sounds.hasOwnProperty(key))
				{
					if (!rat.audio.sounds[key][0].ratLoaded)
					{
						console.log("Missing: " + key);
						missingCount++;
					}
					totalCount++;
				}
			}
			log("missing " + missingCount + " of " + totalCount);
		},

	};

	// called from system init now...  rat.audio.init();
	//@TODO Replace with a registered init function in the module
} );

