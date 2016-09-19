//
//	generated js from lua file
//
rat.modules.add( "rat.xuijs.wahooluajs.system.w_timeline",
[
	{name: "rat.xuijs.wahooluajs.wahoolua", processBefore: true },
	{name: "rat.xuijs.wahooluajs.system.w_class", processBefore: true },
	"rat.math.r_math",
	"rat.debug.r_console",
	"rat.xuijs.js.xui_element",
], 
function(rat)
{
	var WTimeline = wahoolua.class();
	wahoolua.WTimeline = WTimeline;

	// A timeline object that can be set up through code to manipulate values.
	
	var WTIMELINE_ON_FRAME_END = "end";
	
	wahoolua.WTimeline.prototype.Ctor = function(frames, header) {
		this.SetData(frames, header);
		
		this.onChangeCallbacks = {};
		this.xuiTimelineData = {};
		
		// While WTimeline is making callbacks in the update function, do not start the update function again.
		this.updating = false;
		// If new frame data was set during an update, call the update function again to apply any frame at time zero.
		this.shouldUpdateNewData = false;
	};
	
	wahoolua.WTimeline.prototype.Dtor = function() {
	}
	
	wahoolua.WTimeline.prototype.SetXuiTimelineData = function( xuiTimelineData ) {
		this.xuiTimelineData = xuiTimelineData;
	};
	
	// Sets up the data. Automatically resets the time.
	// Input frames is a table of tables of values indexed by the frame of the timeline.
	// For example, {[1]={vel:{y:-20,}}, [2]={vel:{y:0,}}}
	// TODO: Use the header when tweening || something is introduced.
	wahoolua.WTimeline.prototype.SetData = function(frames, header) {
		this.frames = frames;
		this.header = header || {};
		
		// Make sure the data has the frame times in seconds.
		for(var i = 0; i < frames.length; ++i) {
			var frameData = frames[ i ];
			if(!frameData.time) {
				// Lua starts indexing at 1, but the frame at 1 should apply right away in JavaScript.
				// Set that to time 0.
				if(frameData.frame === 1) {
					frameData.time = 0;
				}
				else if(frameData.frame){
					// Otherwise, get the time using rat.
					frameData.time = rat.xuijs.getTimeForFrame(frameData.frame);
				}
				else {
					rat.console.log("WARNING: Could not find any time value for a WTimeline.");
					frameData.time = 0;
				}
			}
		}
		
		if(this.updating) {
			this.shouldUpdateNewData = true;
		}
		else {
			this.ResetCurrentValues();
			this.ResetTime();
		}
	}
	
	// Resets the current values
	wahoolua.WTimeline.prototype.ResetCurrentValues = function() {
		this.currentValues = {};
		this.currentValuesSetTimes = {};
	}
	
	// Resets the time.
	wahoolua.WTimeline.prototype.ResetTime = function() {
		this.time = 0;
		this.nextFrameDataIndex = 0;
	}
	
	// Updates the timeline.
	wahoolua.WTimeline.prototype.Update = function(deltaTime) {
		this.time += deltaTime;
		
		if(this.updating) {
			// Already updating and making callbacks. Do nothing.
			return;
		}
		this.updating = true;
		this.shouldUpdateNewData = false;
		
		if(this.nextFrameDataIndex < this.frames.length) {
			var currentFrameData = this.frames[this.nextFrameDataIndex];
			
			if(this.time >= currentFrameData.time) {
				for(var key in currentFrameData) {
					this.Set(key, currentFrameData[ key ]);
				}
				
				if(++this.nextFrameDataIndex === this.frames.length && !this.shouldUpdateNewData) {
					this.CallCallback(WTIMELINE_ON_FRAME_END);
				}
			}
		}
		
		this.updating = false;
		
		if(this.shouldUpdateNewData) {
			// New data was set during this update. Update the new data to apply any frame at time zero.
			this.shouldUpdateNewData = false;
			
			this.ResetCurrentValues();
			this.ResetTime();
			this.Update(0);
		}
	}
	
	// Gets the value by its name, key.
	wahoolua.WTimeline.prototype.GetValue = function(key) {
		if(this.time === 0 && this.frames[0] && this.frames[0].time === 0) {
			return this.frames[0][key];
		}
		return this.currentValues[key];
	}
	
	wahoolua.WTimeline.prototype.SetMuteXuiSounds = function(isMuted) {
		// Look for XuiSounds to mute
		var timelineCallback = this.onChangeCallbacks["timeline"];
		if ( timelineCallback ) {
			// The arg is a XuiGroup || WGraphic in order for it to play timelines.
			// Look for any XuiSounds that may be playing
			var xuiGroup = timelineCallback.arg1;
			xuiGroup = xuiGroup.scene || xuiGroup;
			
			var xuiIterator = xuiGroup.GetFirstChild();
			while( xuiIterator ) {
				if(xuiIterator.Mute) {
					xuiIterator.Mute(isMuted);
				}
				xuiIterator = xuiIterator.GetNext();
			}
		}
		// Check to see if there is sound playing in the sound group that may differ from the timeline group
		var currentlyPlayingSoundId = this.GetValue("play");
		var playCallback = this.onChangeCallbacks["play"];
		if( currentlyPlayingSoundId && playCallback &&
				// Check to see that the sound has not been stopped.
				(!this.currentValuesSetTimes["stop"] ||
				this.GetValue("stop") != currentlyPlayingSoundId ||
				this.currentValuesSetTimes["play"] > this.currentValuesSetTimes["stop"]) ) {
			var soundGroup = playCallback.arg1;
			var sound = soundGroup[currentlyPlayingSoundId];
			if ( sound ) {
				sound.Mute(isMuted);
			}
		}
	}
	
	wahoolua.WTimeline.prototype.GetTimelineTarget = function() {
		var timelineData = this.GetValue("timeline");
		if(timelineData) {
			var timelineTarget = this.onChangeCallbacks.timeline.arg1;
			timelineTarget = wahoolua.WTimeline.GetXuiElement(timelineTarget, timelineData.group);
			if(timelineTarget.TimelineObject) {
				timelineTarget = timelineTarget.TimelineObject;
			}
			return timelineTarget;
		}
		return null;
	}
	
	// Pauses the XUI animation.
	wahoolua.WTimeline.prototype.PauseXuiTimelineAnimation = function() {
		var timelineTarget = this.GetTimelineTarget();
		if(timelineTarget) {
			var timelineData = this.GetValue("timeline");
			var currentFrame = timelineTarget.mCurrAnimTime / rat.xuijs.getTimeForFrame(1);
			timelineTarget.PlayTimeline(currentFrame, currentFrame, timelineData.recursive || false);
		}
	};
	
	// Pauses a XUI timeline.
	wahoolua.WTimeline.prototype.PauseXuiTimeline = function() {
		this.PauseXuiTimelineAnimation();
		this.SetMuteXuiSounds(true);
	}
	
	// Resumes the XUI animation.
	wahoolua.WTimeline.prototype.ResumesXuiTimelineAnimation = function() {
		var timelineTarget = this.GetTimelineTarget();
		if(timelineTarget) {
			var timelineData = this.GetValue("timeline");
			var currentFrame = timelineTarget.mCurrAnimTime / rat.xuijs.getTimeForFrame(1);
			timelineTarget.PlayTimeline(currentFrame, timelineData.endFrame || currentFrame, timelineData.recursive || false);
		}
	}
	
	// Resumes a XUI timeline.
	wahoolua.WTimeline.prototype.ResumeXuiTimeline = function() {
		this.ResumesXuiTimelineAnimation();
		this.SetMuteXuiSounds(false);
	}
	
	// Sets a callback for when a values is changed.
	// The key is the name of the value.
	// The callback is a function that takes callbackArg1, the value, then the key.
	wahoolua.WTimeline.prototype.SetOnValueChanged = function(key, callback, callbackArg1) {
		this.onChangeCallbacks[key] = {callback:callback, arg1:callbackArg1,};
	}
	
	// Sets a callback for the timeline }ing.
	wahoolua.WTimeline.prototype.SetOnTimelineEnd = function(callback, callbackArg1) {
		this.SetOnValueChanged(WTIMELINE_ON_FRAME_END, callback, callbackArg1);
	}
	
	wahoolua.WTimeline.GetXuiElement = function(xuiElement, groupIds) {
		if ( groupIds ) {
			for(var i=0; i < groupIds.length; ++i) {
				var groupName = groupIds[i];
				if ( !xuiElement.GetId && xuiElement.scene ) {
					xuiElement = xuiElement.scene;
				}
				if ( !xuiElement[groupName] ) {
					var id = xuiElement.GetId && xuiElement.GetId() || "unnamed";
					rat.console.log("ERROR: Could not find "+groupName+" in the XuiElement "+id+".");
					break;
				}
				xuiElement = xuiElement[groupName];
			}
		}
		return xuiElement;
	}
	
	wahoolua.WTimeline.PlayTimeline = function(timelineData, key) {
		var wGraphicsObject = wahoolua.WTimeline.GetXuiElement(this, timelineData.group);
		wGraphicsObject.PlayTimeline(timelineData.startFrame, timelineData.endFrame || timelineData.startFrame, timelineData.recursive || false);
	}
	
	// Sets up playing timelines when the key 'timeline' comes up.
	// The value in the frames should be a table with a the string startFrame &&
	// optionally a string endFrame && boolean recursive.
	wahoolua.WTimeline.prototype.SetPlayTimelineCallback = function(wGraphicsObject) {
		this.SetOnValueChanged("timeline", wahoolua.WTimeline.PlayTimeline, wGraphicsObject)
	}
	
	// Sets up events for a WGraphicObject.
	wahoolua.WTimeline.prototype.SetWGraphicObjectCallbacks = function(wGraphicsObject) {
		this.SetPlayTimelineCallback(wGraphicsObject)
		this.SetOnValueChanged("show", wGraphicsObject.graphic.SetShow, wGraphicsObject.graphic)
		
		// TODO: Fill out the rest
	}
	
	WTimeline.Play = function(timelineData, key) {
		if ( this[timelineData] ) {
			this[timelineData].Play()
		}
		else {
			rat.console.log("ERROR: Could not find audio "+ timelineData +" to play.");
		}
	}
	WTimeline.Stop = function(timelineData, key) {
		if ( this[timelineData] ) {
			this[timelineData].Stop()
		}
		else {
			rat.console.log("ERROR: Could not find audio "+ timelineData +" to stop.");
		}
	}
	
	// Sets up events for playing a sound || other media with a play function
	wahoolua.WTimeline.prototype.SetXuiMediaCallbacks = function(xuiGroup) {
		this.SetOnValueChanged("play", WTimeline.Play, xuiGroup)
		this.SetOnValueChanged("stop", WTimeline.Stop, xuiGroup)
	}
	
	wahoolua.WTimeline.prototype.SetXuiTextCallback = function(xuiText) {
		this.SetOnValueChanged("text", xuiText.SetText, xuiText)
	}
	
	// Sets up using physics timeline events.
	wahoolua.WTimeline.prototype.SetWPhysicsCallbacks = function(wPhysics) {
		this.SetOnValueChanged("velocity", wPhysics.SetVelocity, wPhysics)
		this.SetOnValueChanged("vel", wPhysics.SetVelocity, wPhysics)
		
		this.SetOnValueChanged("gravity", wPhysics.SetGravity, wPhysics)
		this.SetOnValueChanged("acceleration", wPhysics.SetGravity, wPhysics)
		this.SetOnValueChanged("acc", wPhysics.SetGravity, wPhysics)
		
		// TODO: Does this need anything } else {?
	}
	
	wahoolua.WTimeline.prototype.Set = function(key, value) {
		this.currentValues[key] = value;
		this.currentValuesSetTimes[key] = this.time;
		this.CallCallback(key, value);
	};
	
	wahoolua.WTimeline.prototype.CallCallback = function(key, value) {
		var callbackInfo = this.onChangeCallbacks[key];
		if ( callbackInfo ) {
			callbackInfo.callback.call(callbackInfo.arg1, value, key);
		}
	};
	
});
