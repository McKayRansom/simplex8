//
//	Video player wrapper
//
rat.modules.add( "rat.graphics.r_video",
[
	{name: "rat.graphics.r_graphics", processBefore: true},
	
	"rat.debug.r_console",
	"rat.os.r_system",
	"rat.os.r_events",
	"rat.math.r_math",
], 
function(rat)
{
	var BUFFERING_CHECK_INTERVAL = 2/10;
	var BUFFERING_VIDEO_VARIANCE = BUFFERING_CHECK_INTERVAL * 0.5;

	var lastVidID = 0;
	function log(txt)
	{
		//rat.console.log("VIDEO: " + txt);
	};

	//	Supported format, in order of preference
	var formats = {
		MP4: { type: "mp4", ext:"mp4" },
		WebM: { type: "webm", ext: "wemb" },
		Ogg: { type: "ogg", ext:"ogg" }
	};
	//	Find out what formats we support
	function querySupportedFormats(tag)
	{
		if (formats.queried)
			return;
		for( var format in formats )
		{
			formats[format].supported = !!tag.canPlayType("video/" + formats[format].type);
			log("Format " + format + ".supported = " + formats[format].supported);
		}
		formats.queried = true;
	};
	//	Get the format for a given extension
	function getFormatFromExt(ext)
	{
		if (ext[0] === ".")
			ext = ext.slice(1);
		if (ext)
		{
			for (var format in formats)
			{
				if (formats[format].ext === ext)
					return formats[format];
			}
		}
		return { supported: false };
	};

	//	Given the following file, and the supported formats, generate the file path to use
	function genFilePath( video, file)
	{
		if (!file)
			return file;
		querySupportedFormats(video.htmlTag);

		//	Find the preferred extension
		var ext;
		for( var key in formats )
		{
			if (formats[key].supported)
			{
				ext = formats[key].ext;
				break;
			}
		}
		if (!ext)
		{
			rat.console.log("Unable to find supported video file format.  Defaulting to .mp4");
			ext = formats.MP4.ext;
		}

		var dotPos = file.lastIndexOf('.');
		if (dotPos < 0)
			dotPos = file.length;
		var extString = file.slice(dotPos);
		var format = getFormatFromExt(extString);
		//console.log("extString " + extString);
		if (!format.supported )
		{
			file = file.slice(0, dotPos) + "." + ext;
		}
		return rat.system.fixPath(file);	//	let rat fix up our path, e.g. if we're in some strange hosted environment
	};

	//	Create a new video
	var Video = function( ops )
	{
		ops = ops || {};
		var file = ops.file;
		var foreground = ops.foreground;
		this._playOnLoad = false;	//	This is set if we want to be playing as soon as possible
		this._pauseOnLoad = false	//	This is set if we want to be playing as soon as possible, but paused
		this._pauseOnDoneBuffering = false; // This is set if we want to pause the video as soon as we are done buffering
		this._isPlaying = false;
		this._isLoading = true;		//	Still in the initial load
		this._isBuffering = false;	//	Buffering after starting playback
		this._isMuted = false;		//	is the video muted
		this.events = {};	//	Key is event type, each event is an array of functions to call
		this._loadingDoneWaitingForBufferedData = false;// After we get the canplaythrough event, make sure that we have buffering data.
		
		this._accredBufferingCheck = 0; // How much time has passed sence our last buffering check
		this._lastBufferingCheckTime = 0; // what was the video time at the last buffering check.
		
		
		//	Add any events defined in ops
		this.runningEvents = [];
		this.addEventListener( 'load', ops.onLoad||ops.onload);
		this.addEventListener( 'destroy', ops.onDestroy ||ops.ondestroy );
		this.addEventListener( 'startbuffering', ops.onStartBuffering || ops.onstartbuffering );
		this.addEventListener( 'endbuffering', ops.onEndBuffering || ops.onendbuffering );
		this.addEventListener( 'end', ops.onEnd || ops.onend );
		
		//	NOTE: The video should never be loading and buffering...
		this._isForeground = foreground || false;
		this.htmlTagID = (++lastVidID);
		this.mSrc = "";
		this.mVolume = 1;
		this.createHTMLTag();
		this.setFile(file || "");

		this.buffered = []; // What times were buffered last update.
		
		if (ops.volume !== void 0)
			this.setVolume(ops.volume);
	};
	Video.prototype.disabled = false;
	Video.numberOfActiveBGVideos = 0;
	
	//	Add a new event hanlder = function()
	Video.prototype.addEventListener = function( type, cb, context )
	{
		if (!type || !cb)
			return;
		if (!this.events[type])
			this.events[type] = [];
		this.events[type].push( {cb: cb, context:context} );
	};
	
	//	Remove a registered event handler
	Video.prototype.removeEventListener = function( type, cb, context )
	{
		if (!type || !cb || !this.events[type])
			return;
		var list = this.events[type];
		var entry;
		var running;
		for( var index=0; index < list.length; ++index )
		{
			entry = list[index];
			if (entry.cb === cb && entry.context === context)
			{
				//	Make removing listeners while firing events safe
				for( var rIndex = 0; rIndex < this.runningEvents.length; ++rIndex )
				{
					running = this.runningEvents[rIndex];
					if (running.type == type)
					{
						if (running.onIndex >= rIndex)
							--running.onIndex;
						--running.endIndex;
					}
				}
				list.splice( index, 1 );
				break;
			}
		}
		if (list.length <= 0)
			this.events[type] = void 0;
	};
	
	//	Fire off an events
	Video.prototype.fireEvent = function( type, varArgs )
	{
		if (!type || !this.events[type])
			return;

		//	Same args to all cbs
		//	First param is ALWAYS the video.
		var args = Array.prototype.slice.call(arguments);
		args.unshift(this);
		log( "Video firing event " + type );
		var list = this.events[type];
		var running = {
			type: type,
			onIndex: 0,
			endIndex: list.length-1
		};
		this.runningEvents.push(running);
		var entry;
		for( ;running.onIndex <= running.endIndex; ++running.onIndex )
		{
			entry = list[running.onIndex];
			//	First param is ALWAYS the video, second param is always type.
			entry.cb.apply( entry.context, args );
		}
		this.runningEvents.pop();
	};

	//	State query
	Video.prototype.isPlaying = function ()
	{ 
		if (this.isLoading())
			return this._playOnLoad;
		else
		{
			return this._isPlaying;
		}
	};
	
	Video.prototype.isPaused = function ()
	{
		if (!this.isPlaying())
			return false;
		if (this.isLoading())
			return this._pauseOnLoad;
		else if (this.isBuffering())
			return this._pauseOnDoneBuffering;
		else
			return this.htmlTag.paused;
	};

	Video.prototype.isLoading= function ()
	{ return this._isLoading; };

	Video.prototype.isBuffering = function ()
	{ return this._isBuffering; };

	//	Cleanup this video
	Video.prototype.destroy = function()
	{
		this.fireEvent( "destroy" );
		this.stop();

		//	Trick to get the browser to stop downloading the media
		this.htmlTag.pause();
		this.htmlTag.src = "";
		this.htmlTag.parentNode.removeChild(this.htmlTag);
		this.htmlTag = void 0;
	};

	//	Get the file
	Video.prototype.getFile = function()
	{
		return this.mSrc;
	};
	
	//	Set the source
	Video.prototype.setFile = function (file)
	{
		if (file !== this.mSrc)
		{
			this.mSrc = file;

			//	Get the format provided (if any)
			var fullFile = genFilePath(this, file);
			this.mFullFile = fullFile;
			this.htmlTag.src = this.mFullFile;
			log( "VIDEO source set to " + this.htmlTag.src);
			this._isLoading = true;
			this.htmlTag.load();
		}
		this.stop();
	};
	
	//	Create the html video tag
	Video.prototype.createHTMLTag = function()
	{
		if (this.disabled)
			return;
		
		this.htmlTag = document.createElement("video");
		this.htmlTag.id = this.htmlTagID;
		this.htmlTag.style.position = "absolute";
		var canvas = rat.graphics.canvas;
		canvas.parentNode.appendChild(this.htmlTag);
		if (!canvas.style.zIndex && canvas.style.zIndex !== 0)
			canvas.style.zIndex = 0;
		if (this._isForeground)
			this.htmlTag.style.zIndex = canvas.style.zIndex + (100-(this.htmlTagID));
		else
			this.htmlTag.style.zIndex = canvas.style.zIndex - (100-(this.htmlTagID));
		this.htmlTag.style.backgroundColor = rat.graphics.autoClearColor;
		this.htmlTag.style.objectFit = "contain";

		this.onResize();
		rat.addEventListener("resize", this.onResize.bind(this));
		this.htmlTag.preload = "auto";
		this.htmlTag.oncanplaythrough = this.onLoaded.bind(this);
		//this.htmlTag.oncanplay = this.onLoaded.bind(this);
		this.htmlTag.onended = this.onEnded.bind(this);
		log("created");
	};

	//	Called when the video tag
	Video.prototype.onLoaded = function ()
	{
		if (!this.isLoading())
			return;
		//	The next update will start checking the buffered data.
		this._loadingDoneWaitingForBufferedData = true;
	}

	//	When the video is over
	Video.prototype.onEnded = function ()
	{
		log("Done");
		this.stop();
		this.fireEvent( "end" );
	};

	//	Play the video
	Video.prototype.play = function (file)
	{
		if (file)
			this.setFile(file);
		else if (this.isPlaying())
			return;
		if (!this.mSrc)
		{
			rat.console.log("Attempting to play a video with no source");
			return;
		}

		if (this.isLoading())
		{
			log("->Queue Play");
			this._playOnLoad = true;
		}
		else
		{
			log("->Play");
			this.activateVideo();
			this.htmlTag.play();
			this._isPlaying = true;
		}
	};

	//	Stop the video (it gets hidden)
	Video.prototype.stop = function ()
	{
		if (!this.isPlaying())
			return;

		if (this.isLoading())
		{
			log("->Unqueue play");
			this._playOnLoad = false;
		}
		else
		{
			log("->Stop");
			this.deactivateVideo();
			this.htmlTag.pause();
			this._isPlaying = false;
			if (this.isBuffering())
				this.fireEvent( "endbuffering" );
			this._isBuffering = false;
			this.htmlTag.currentTime = 0;
		}
	};

	//	Pause the video
	Video.prototype.pause = function ()
	{
		if (!this.isPlaying() || this.isPaused())
			return;

		if (this.isLoading())
		{
			log("->Queue Pause");
			this._pauseOnLoad = true;
		}
		//	If we are buffering, don't pause because I won't know when we are done buffering.
		else if (this.isBuffering())
		{
			log("->Queue Pause");
			this._pauseOnDoneBuffering = true;
		}
		else
		{
			this._pauseOnDoneBuffering = false;
			this._pauseOnLoad = false;
			log("->Pause");
			this.htmlTag.pause();
		}
	};
	
	//	Resume the video
	Video.prototype.resume = function ()
	{
		if (!this.isPlaying() || !this.isPaused())
			return;
		if (this.isLoading())
		{
			log("->Unqueue Pause");
			this._pauseOnLoad = false;
		}
		else
		{
			log("->Resume");
			this.htmlTag.play();
		}
	};

	//	Activate a video
	Video.prototype.activateVideo = function ()
	{
		if (!this._isForeground)
			++Video.numberOfActiveBGVideos;
	};

	//	Deactivate a video
	Video.prototype.deactivateVideo = function ()
	{
		if (!this._isForeground)
			--Video.numberOfActiveBGVideos;
	};

	//	Fit the video to canvas.   TODO: Support setting video position/size
	Video.prototype.onResize = function ()
	{
		log("Correcting video element size to match canvas" );
		var canvas = rat.graphics.canvas;
		this.htmlTag.width = canvas.width;
		this.htmlTag.height = canvas.height;
		this.htmlTag.style.left = canvas.style.left;
		this.htmlTag.style.top = canvas.style.top;
	};

	//	Frame-by-frame update
	var UPDATE_EVERY = 0;//(1 / 20);
	Video.prototype.update = function (deltaTime)
	{
		//	Get what pieces of the video we have buffered.  Only do this for videos that have source.
		if (this.mSrc)
		{
			//var buffered = "";
			this.buffered = [];
			if (this.htmlTag.buffered.length)
			{
				for( var i = 0; i < this.htmlTag.buffered.length; ++i )
				{
					var times = {start: this.htmlTag.buffered.start(i), end: this.htmlTag.buffered.end(i)};
					this.buffered.push(times);
					//buffered += times.start + "->" + times.end + " ";
				}
				//rat.console.log( buffered );
			}
		}
		
		//	Have we recived the canplaythrough event but not yet verified that we have buffered data to play?
		if (this._loadingDoneWaitingForBufferedData)
		{
			//	Is there ANY buffered data.
			if (this.htmlTag.buffered.length > 0)
			{
				//	Is the buffered data beyond the 0th second.
				if (this.htmlTag.buffered.end(0) > 0.1)
				{
					//	Yep.  Video is really loaded.
					this._loadingDoneWaitingForBufferedData = false;
					var start = this.htmlTag.buffered.start(0);
					var end = this.htmlTag.buffered.end(0);
					log( this.htmlTagID +  " Loaded.  Initial buffered range is " +start+ " - " +end+ " ." );
					this._isLoading = false;
					this.fireEvent( "load" );
					
					if (this._playOnLoad)
						this.play();
					if (this._pauseOnLoad)
						this.pause();
					this._playOnLoad = false;
					this._pauseOnLoad = false;
				}
				//else
				//	rat.console.log( "Have buffered data... do we have enough? " + this.htmlTag.buffered.end(0));
			}
			//else
			//	rat.console.log( "Looking for buffered data..." );
		}
		else if (!this.isLoading())
			this._updateBuffering(deltaTime);
	};

	//	Update if the video is buffering...
	//	I would prefer to use the onwaiting and onplay events, but for whatever reason, i only seem to get onwaiting once, and then never the play
	var lastReportedTime = void 0;
	Video.prototype._updateBuffering = function (deltaTime)
	{
		//	See http://stackoverflow.com/questions/21399872/how-to-detect-whether-html5-video-has-paused-for-buffering
		this._accredBufferingCheck += deltaTime;
		var nowBuffering = false;
		var currentTime = this.getCurrentTime({useRaw:true});
		if (lastReportedTime !== rat.math.floor(currentTime) )
		{
			lastReportedTime = rat.math.floor(currentTime);
		
			log( "CURTIME: " + lastReportedTime );
		}
			
		//	If the video is paused, don't think we are buffering.
		if (this.htmlTag.paused)
		{
			this._accredBufferingCheck = 0;
			this._lastBufferingCheckTime = this.getCurrentTime({useRaw:true});
			nowBuffering = false;
		}
		//	Is it time to check the buffering again?
		else if (this._accredBufferingCheck > BUFFERING_CHECK_INTERVAL)
		{			
			var last = this._lastBufferingCheckTime;
			var time = this.getCurrentTime({useRaw:true});
			this._lastBufferingCheckTime = time;
			var deltaTime = (time-last);
			nowBuffering = deltaTime < (this._accredBufferingCheck - BUFFERING_VIDEO_VARIANCE);
			this._accredBufferingCheck = 0;
		}
		else
			nowBuffering = this.isBuffering();

		//	If we are in any state were we don't care if we are buffering, then don't update, but 
		//	Also remember to firing the endBuffering event.
		if (this.isLoading() || (this.isPaused() && !this._pauseOnDoneBuffering) || !this.isPlaying())
		{
			//	NOTE: We may be "pause" but only because we are buffering
			//	and a pause was requested
			if (this._pauseOnDoneBuffering)
			{
				//	 Do nothing?
			}
			else
			{
				if (this.isBuffering())
				{
					this.fireEvent( "endbuffering" );
					this._isBuffering = false;
				}
			}
			return;
		}
		
		//rat.console.log( "TB: " + currentTime + "(" + this.isBuffering() + " vs " + nowBuffering + ")" );
		if (this.isBuffering() !== nowBuffering)
		{
			this._isBuffering = nowBuffering;
			if (this.isBuffering() )
				this.fireEvent( "startbuffering" );
			else
			{
				//	Are we suppose to pause now that we are done buffering?
				if (this._pauseOnDoneBuffering)
				{
					this._pauseOnDoneBuffering = false;
					this.pause();
				}
				this.fireEvent( "endbuffering" );
			}
			log((this._isBuffering ? "Is buffering..." : "Is done buffering") +  " at time " + currentTime);
		}
	};

	//	Get how long the video is
	Video.prototype.getDurration = function ()
	{
		if (this.isLoading())
			return -1;
		else
			return this.htmlTag.duration;
	};

	//	Get the current time in the video
	Video.prototype.getCurrentTime = function (ops)
	{
		//	Allow code to directly access the HTML Video tag current time.
		if ( !this.isLoading() || (ops && ops.useRaw))
			return this.htmlTag.currentTime;
		else
			return 0;
	};
	
	//	Set the current time in the video
	Video.prototype.setCurrentTime = function (seekToTime)
	{
		if( seekToTime < 0 || seekToTime > this.htmlTag.duration ) 
		{
			rat.console.log( "Unable to seek to invalid time " + seekToTime );
			return;
		}
		if ( !this.isLoading() )
		{
			log( "Seeking to time " + seekToTime + " while loading..." );
			if (!this.isBuffering())
			{
				this._isBuffering = true;
				if (this.isBuffering() )
					this.fireEvent( "startbuffering" );
				this._lastBufferingCheckTime = seekToTime;
				this._accredBufferingCheck = 0;
			}

			this.htmlTag.currentTime = seekToTime;
		}
		else
			rat.console.log( "Unable to seek to time " + seekToTime + " while loading..." );
	};

	//	Set/get the video volume
	Video.prototype.setVolume = function (vol)
	{
		if (vol < 0)
			vol = 0;
		else if (vol > 1)
			vol = 1;
		if (this.getVolume() !== vol)
		{
			this.mVolume = vol;
			if (!this.isMuted())
				this.htmlTag.volume = vol;
		}
	};

	//	Get the current volume
	Video.prototype.getVolume = function ()
	{
		return this.mVolume;
	};

	//	Get if the video is muted
	Video.prototype.isMuted = function ()
	{
		return this._isMuted;
	};

	//	Mute/unmute the video
	Video.prototype.mute = function (shouldMute)
	{
		if (shouldMute === void 0)
			shouldMute = true;
		if (shouldMute === this.isMuted())
			return;
		this._isMuted = shouldMute;
		if (this.isMuted())
			this.htmlTag.volume = 0;
		else
			this.htmlTag.volume = this.mVolume;
	};
	
	//	We don't support this module (yet) under wraith
	if (rat.system.has.Wraith)
	{
		rat.console.log("r_video not yet ported for wraith support!");
		Video.prototype.disabled = true;
	}

	rat.graphics.Video = Video;
} );
