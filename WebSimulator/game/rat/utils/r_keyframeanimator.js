//
//	A class for animating values based on a set of keyframes.
//	This is hopefully abstract enough that it can be used in several different scenarios.
//
//	There's probably a lot of opportunity to improve performace in here, if needed.
//
rat.modules.add( "rat.utils.r_keyframeanimator",
[
	"rat.debug.r_console",
	"rat.math.r_vector",
	"rat.utils.r_bezier",
	"rat.math.r_math",
], 
function(rat)
{
	// Constructor.  Kind of involved, but it's meant to be flexible.
	// owner - the object that owns the animated properties.  
	//		Will be used in the default apply function to apply animating values.
	// propertyNames - a list of property names that will be animated.  
	//		The size of this list is used in various places for sizing results, 
	//		and the values will be used in the default apply function to apply animating values.
	//		For instance, if propertyNames contains "foo" and "bar", and animated values are calculated to be "1.5" and "0.4",
	//		then when applying, the equivalent to the following would happen: owner["foo"] = 1.5; owner["bar"] = 0.4;
	//		It is possible to specify a property "path" - i.e. "foo.bar.baz" would find property owner["foo"]["bar"]["baz"],
	//		but it does take extra work to find the property on the owner.
	// keys - an array of key data items.
	//		Each key data item should have the following entries:
	//		time - the time for the key frame (in seconds, can be fractional).
	//		values - an array of values, to match the list of propertyNames.
	//		easing - an object containing "type", from rat.KeyFrameAnimator.EasingType, 
	//			and "params", an array of values that will be passed to the easing function.
	//		NOTE: It is assumed that the keys provided are already ordered by time.
	//		The completed keys parameter should look something like this:
	//		keys = [
	//			{time: key_1_time, values: [prop1_value1, prop2_value1], easing: {type: easing_type1, params: [type1_easeParam1, type1_easeParam2]}},
	//			{time: key_2_time, values: [prop1_value2, prop2_value2], easing: {type: easing_type2, params: [type2_easeParam1, type2_easeParam2]},
	//			...
	//		];
	//		See the rat.KeyFrameData class defined below for a simplified way to set up keyFrame data.
	// valueType - type from rat.KeyFrameAnimator.ValueType (could be custom value too).
	//		Controls how the values will be interpolated and set (as numbers, strings, etc.).
	// options - options for controlling some behavior.  Supported options are:
	//		looping - boolean that controls whether or not the animation will loop. 
	//		paused - boolean that controls whether or not the animation will start in the paused state.
	//		interpFunc - a custom function that will be called to interpolate between two key values.
	//			Should have signature like this: function(t, valueType, keyValue1, keyValue2).
	//			t is the percent between key frames that needs to be calculated.
	//			valueType is the type for the value, as passed into the constructor.  Usually rat.KeyFrameAnimator.ValueType, but custom types could be used.
	//			keyValue1 and keyValue2 are the values for the keys that should be interpolated, as specified in key data.
	//			Should return a value that is the result of interpolating the two input key values.
	//		easingFunc - a custom function that will be called to control how time progresses between keys.
	//			Should have signature like this: function(t, easingOptions).
	//			t is the input percent bewteen key values, based on the current time, and the time of the previous and next key frames.
	//			Should return a new t value (between 0 and 1) that has been "eased" based on whatever criteria is wanted.
	//			An simple example would be out_t = t*t, or out_t = t^n, where n is passed as an ease parameter.
	//		applyFunc - a custom function that will be called to apply an animated value to an owner.
	//			Should have signature like this: function(owner, propertyNames, values, valueType).
	//			owner, propertyNames, and valueType are all just passed from the values provided in the constructor.
	//			values is an array of newly calculated animation values, matching order/contents of propertyNames.
	//			This will be called once an animated value has been calculated, to actually make use of the new value.
	//
	// Here's an example of creating a KeyFrameAnimator:
	//
	// var owner = myOwner;
	
	// var options = {
		// looping: true,
		// paused: false,
		// // The following can be left undefined for default behavior.  Provide function(s) to customize.
		// //interpFunc: myCustomInterpFunction,
		// //easingFunc: myCustomEasingFunction,
		// //applyFunc: myCustomApplyFunc,
	// };

	// // Using generic numeric value type.
	// var valueType = rat.KeyFrameAnimator.ValueType.NUMERIC;
	// var propertyNames = ["propA", "propB"];
	// var keys = [
		// {time: 0.0, values: [1.0, 250], easing: {type: rat.KeyFrameAnimator.EasingType.LINEAR, params:[]}},
		// {time: 1.5, values: [0.25, 300], easing: {type: rat.KeyFrameAnimator.EasingType.BEZIER, params:[0.3, 0.0, 0.7, 1.0]}},
		// {time: 3.0, values: [1.0, 370], easing: {type: rat.KeyFrameAnimator.EasingType.LINEAR, params:[]}},
	// ];
	// // Create the animator. When updating, owner["propA"] and owner["propB"] will be animated.
	// var genericKeyFrameAnimator = new rat.KeyFrameAnimator(owner, propertyNames, keys, valueType, options);

	// // Using specialized RAT_POSITION value type.
	// // owner should be a rat element.
	// valueType = rat.KeyFrameAnimator.ValueType.RAT_POSITION;
	// propertyNames = ["ratPos"]; // Doesn't really matter what name is used in this case.
	// keys = [
		// {time: 0.0, values: [new rat.Position(10, 0, 0)], easing: {type: rat.KeyFrameAnimator.EasingType.BEZIER, params:[0.4, 0.0, 0.6, 1.0]}},
		// {time: 1.5, values: [new rat.Position(300, 25, Math.PI / 2)], easing: {type: rat.KeyFrameAnimator.EasingType.BEZIER, params:[0.4, 0.0, 0.6, 1.0]}},
		// {time: 3.0, values: [new rat.Position(10, 60, 0)], easing: {type: rat.KeyFrameAnimator.EasingType.LINEAR, params:[]}},
	// ];
	// // Create the animator
	// var ratPositionKeyFrameAnimator = new rat.KeyFrameAnimator(owner, propertyNames, keys, valueType, options);
	
	//
	//
	/** @constructor*/
	rat.KeyFrameAnimator = function(owner, propertyNames, keys, valueType, options)
	{
		// Deal with defaults
		options.looping = options.looping || false;
		options.paused = options.paused || false;
		
		// Member variables
		this.mOwner = owner;
		this.mPropertyNames = propertyNames;
		this.mKeys = keys;
		this.mValueType = valueType;
		this.mLooping = options.looping;
		this.mPaused = options.paused;
		this.mInterpFunc = this.defaultInterpFunc;
		this.mEasingFunc = this.defaultEasingFunc;
		this.mApplyFunc = this.defaultApplyFunc;
		this.mEventFunc = null;

		this.mCurrTime = 0;
		this.atEnd = false; // Used to prevent updated when we're at the end of the timeline anyway.
		this.mPrevValues = null;
		
		// Set up functions.
		if( typeof options.interpFunc === "function" ){
			this.mInterpFunc = options.interpFunc;
		}
		if( typeof options.easingFunc === "function" ){
			this.mEasingFunc = options.easingFunc;
		}
		if( typeof options.applyFunc === "function" ){
			this.mApplyFunc = options.applyFunc;
		}
		// Do something like this when we're ready to set up event stuff
		//if( typeof options.eventFunc == "function" ){
		//	this.mEventFunc = options.eventFunc;
		//}
	};
	
	// Enums
	rat.KeyFrameAnimator.ValueType = {
		NUMERIC: 0,
		STRING: 1,
		BOOLEAN: 2,
		RAT_POSITION: 3, // For handling rat.Position (with pos and rotation) as one value.
		EVENT: 4
		// TODO: Should probably have some sort of color type, and maybe a custom type.
	};
	
	rat.KeyFrameAnimator.EasingType = {
		LINEAR: 0, // No ease params needed
		STEP: 1, // No ease params needed
		BEZIER: 2 // Needs four ease params - x and y values for two control points inside 1x1 square (start and end points are assumed (0, 0) and (1, 1)).
	};
	
	rat.KeyFrameAnimator.prototype.update = function(deltaTime)
	{
		// Check paused
		if( this.mPaused || this.atEnd ){
			return;
		}
		
		// Update time
		this.mCurrTime += deltaTime;
		
		// Handle looping, and other edge cases.
		var lastKeyTime = this.mKeys[this.mKeys.length-1].time;
		if( this.mCurrTime > lastKeyTime ){
			if( this.mLooping ){
				this.mCurrTime = this.mCurrTime % lastKeyTime;
			}
			else{
				this.mCurrTime = lastKeyTime;
				// Make it so we pause after we reach the last frame.
				this.atEnd = true;
			}
		}
		
		// TODO: Handle event-type keys.
		// I was going to track if values from this update are different from the previous update, 
		// and use that for event keys somehow, but I don't think that would work quite right.
		// Ideally we sould have the key value for event keys be some sort of useful ID,
		// and those wouldn't be changing as the timeline progresses.
		// Also, what if updates are slow and we jump right past an event key.
		// I think we need to find keyframes for times starting from the previous time, up to new mCurrTime,
		// and iterate through them to trigger the callback for any event keyframes we find.
		// Or something...
		if( this.mValueType === rat.KeyFrameAnimator.ValueType.EVENT ){
			var triggerEvent = false;
			var eventValue = null; // Get this from keyframe stuff below.
			
			// Do keyframe finding/iterating here
			
			if( triggerEvent && this.mEventFunc ){
				this.mEventFunc(eventValue);
			}
		}
		
		
		// Get the value for the new time
		var newValues = this.getValues(this.mCurrTime);
		
		// Check if values have changed.
		// This was mostly going to be for handling event-type keys,
		// but I don't think that'll work quite right.
		// It might be useful for optimization though.
		var valuesChanged = true;
		if( this.mPrevValues ){
			valuesChanged = false;
			for( var i = 0; i < this.mPropertyNames.length; i++ ){
				// If we ever get an undefined value in mPrevValues, mark valuesChanged true, and break out.
				if( typeof this.mPrevValues[i] === "undefined" || this.mPrevValues[i] === null ){
					valuesChanged = true;
					break;
				}
				else if( newValues[i] !== this.mPrevValues[i] ){
					valuesChanged = true;
					break;
				}
			}
		}
		
		// Handle applying newValues
		if( valuesChanged ){
			this.mApplyFunc(this.mOwner, this.mPropertyNames, newValues, this.mValueType);
		}
		
		// Save the values to compare against next time.
		this.mPrevValues = newValues;
		
	};
	
	// Pauses/unpauses the keyframe animation.
	rat.KeyFrameAnimator.prototype.setPaused = function(paused)
	{
		this.mPaused = paused;
	};
	
	// Sets whether animator should loop or not.
	rat.KeyFrameAnimator.prototype.setLooping = function(looping)
	{
		this.mLooping = looping;
	};
	
	// Sets the current time for the animator.
	// Only sets the internal time, does not cause an update.
	rat.KeyFrameAnimator.prototype.setTime = function(time)
	{
		this.mCurrTime = time;
		// Might not be at the end anymore
		this.atEnd = false;
	};
	
	// Returns the time for the last keyframe in the animator
	rat.KeyFrameAnimator.prototype.getLastKeyTime = function()
	{
		if( !this.mKeys || this.mKeys.length === 0 ){
			// I guess return 0 for last time if there are no key frames.
			return 0;
		}
		
		return this.mKeys[this.mKeys.length-1].time;
	};
	
	// Gets the values for the given time.
	// This involves finding the relevant keyframes, and interpolating between them, 
	// with proper interpolation and easing.
	rat.KeyFrameAnimator.prototype.getValues = function(time)
	{
		// Find previous keyframe and next keyframe
		var keyFrameIndices = this.findKeyFramesAroundTime(time);
		if( keyFrameIndices.length < 2 ){
			return [];
		}
		var prevKeyFrame = this.mKeys[keyFrameIndices[0]];
		var nextKeyFrame = this.mKeys[keyFrameIndices[1]];
		
		if( keyFrameIndices[0] === keyFrameIndices[1] ){
			// No need to interpolate, just return keyframe values.
			// Use slice to copy the array.
			return prevKeyFrame.values.slice(0);
		}
		
		// Figure out percent between the two frames based on time.
		var percent = (time - prevKeyFrame.time) / (nextKeyFrame.time - prevKeyFrame.time);
		
		// Adjust percent based on easing function.
		var t = this.mEasingFunc(percent, prevKeyFrame.easing);
		
		// Interpolate based on t value.
		var values = new Array(this.mPropertyNames.length);
		for( var i = 0; i < this.mPropertyNames.length; i++ ){
			values[i] = this.mInterpFunc(t, this.mPropertyNames[i], this.mValueType, prevKeyFrame.values[i], nextKeyFrame.values[i]);
		}
		return values;
	};
	
	// Finds key frames before and after the given time.
	// Returns an array containing the indices of the two relevant key frames.
	// Both entries might be the same index, in some cases.
	rat.KeyFrameAnimator.prototype.findKeyFramesAroundTime = function(time)
	{
		// TODO: Should I return indices, or key objects?
		// I think indices - then we can test if they're the same, and not interpolate.
		var keyIndices = [];
		
		// TODO: Could make this smarter.
		// Maybe test previously used key frames.
		// It's pretty likely that they're either the same ones, or very close to them.
		// Also could do binary search.
		
		// Naive way - iterate over keys and find first one where key time is bigger than time.
		var startIndex = 0;
		var endIndex = this.mKeys.length;
		
		// Start indices at the end - this will be right if no other keys are found.
		var prevIndex = this.mKeys.length-1;
		var nextIndex = this.mKeys.length-1;
		
		for( var i = startIndex; i < endIndex; i++ ){
			if( this.mKeys[i].time === time ){
				// If I'm right on a key frame, I want to use that key frame and the next one.
				prevIndex = i;
				nextIndex = i+1;
				if( nextIndex > this.mKeys.length-1 ){
					nextIndex = this.mKeys.length-1;
				}
				break;
			}
			else if( this.mKeys[i].time > time ){
				// Found key 
				prevIndex = i-1;
				if( prevIndex < 0 ){
					prevIndex = 0;
				}
				nextIndex = i;
				break;
			}
		}
		
		if( prevIndex > -1 && nextIndex > -1 ){
			keyIndices.push(prevIndex);
			keyIndices.push(nextIndex);
		}
		
		return keyIndices;
	};
	
	// Default function for handling the interpolation bewteen two keyframe values.
	rat.KeyFrameAnimator.prototype.defaultInterpFunc = function(t, propName, valueType, keyValue1, keyValue2)
	{
		var result = keyValue1;
		if (propName === "ShortestRotation" )
		{
			if (valueType !== rat.KeyFrameAnimator.ValueType.NUMERIC)
			{
				rat.console.log( "Prop ShortestRotation can only be of type NUMERIC" );
				result = rat.math.PI;
			}
			else if( Array.isArray(keyValue1) || Array.isArray(keyValue2) )
			{
				rat.console.log( "Prop ShortestRotation of NUMERIC type cannot handle array values" );
				result = rat.math.PI;
			}
			else
			{
				//	Find the shorest distance between the two angles.
				//	For example.  from 0degrees -> 270degrees would interp a clockwise rotation of 90degrees
				//				  but 0degrees -> 90degrees would interp a counter-clockwise rotation of 90degrees
				var a1 = keyValue1;
				var a2 = keyValue2;
				while( a1 >= rat.math.PI2 ) a1 = a1 - rat.math.PI2;
				while( a1 < 0 )             a1 = a1 + rat.math.PI2;
				while( a2 >= rat.math.PI2 ) a2 = a2 - rat.math.PI2;
				while( a2 < 0 )             a2 = a2 + rat.math.PI2;
				
				//	What direction should we travel in?
				var ccw = a1-a2;
				var cw = a2-a1;
				if (ccw < 0)
					ccw += rat.math.PI2;
				if (cw < 0)
					cw += rat.math.PI2;
				if( cw > ccw )// We prefer to go ccw (if for example we are going from 0->PI)
				{
					var temp = a2;
					a2 = a1;
					a1 = temp;
					t = 1-t;
				}
				while( a2 < a1 )
					a2 += rat.math.PI2;
				result = a1 + t * (a2 - a1);
			}
		}
		else
		{
			switch(valueType){
				case rat.KeyFrameAnimator.ValueType.NUMERIC:
					if( Array.isArray(keyValue1) && Array.isArray(keyValue2) ){
						result = [];
						for( var i = 0; i < keyValue1.length; i++ ){
							result.push(keyValue1[i] + t * (keyValue2[i] - keyValue1[i]));
						}
					}
					else{
						result = keyValue1 + t * (keyValue2 - keyValue1);
					}
					break;
				case rat.KeyFrameAnimator.ValueType.RAT_POSITION:
					var x = keyValue1.pos.x + t * (keyValue2.pos.x - keyValue1.pos.x);
					var y = keyValue1.pos.y + t * (keyValue2.pos.y - keyValue1.pos.y);
					var angle = keyValue1.rot.angle + t * (keyValue2.rot.angle - keyValue1.rot.angle);
					result = new rat.Position(x, y, angle);
					break;
				case rat.KeyFrameAnimator.ValueType.EVENT:
					// TODO: This is probably not the place for handling event-triggering type keys.
					break;
				// I think all the rest can just do nothing - the result should always be keyValue1.
				// We just need to make sure that when we're exactly on a keyframe,
				// we use the keyframe and keyframe+1 to interpolate between,
				// not the keyframe-1 and keyframe.  Hopefully that makes sense.
				case rat.KeyFrameAnimator.ValueType.STRING:
					break;
				case rat.KeyFrameAnimator.ValueType.BOOLEAN:
					break;
				default:
					rat.console.log("WARNING - rat.KeyFrameAnimator.defaultInterpFunc: Unknown value type \"" + valueType + "\" for prop " + propName + ", first value will be returned.");
			}
		}
		return result;
	};
	
	// Default function for handling easing.
	// The easingOptions argument should contain "type" and "params" properties.
	rat.KeyFrameAnimator.prototype.defaultEasingFunc = function(t, easingOptions)
	{
		var newT = t;
		switch( easingOptions.type ){
			case rat.KeyFrameAnimator.EasingType.LINEAR:
				// Do nothing
				break;
			case rat.KeyFrameAnimator.EasingType.STEP:
				// Always return 0.
				newT = 0;
				break;
			case rat.KeyFrameAnimator.EasingType.BEZIER:
				// params needs to have four control point values,
				// representing x and y values for the two bezier control points. (inside a 1x1 square)
				if( !easingOptions.params || easingOptions.params.length !== 4 ){
					// Not the right parameters.
					rat.console.log("rat.KeyFrameAnimator.defaultEasingFunc: Bad parameters for Bezier type, easing will be linear.");
					break;
				}
				
				// If there's no bezierEase object yet on the easingOptions object, create one.
				// TODO: This seems a little wrong, but where else could we store the bezierEase object?
				var p = easingOptions.params;
				easingOptions.bezierEase = easingOptions.bezierEase || new rat.bezierEase(p[0], p[1], p[2], p[3]);
				newT = easingOptions.bezierEase.calcEaseValue(t);
				break;
			default:
				// No match, do nothing
				rat.console.log("rat.KeyFrameAnimator.defaultEasingFunc: Unknown easing type, easing will be linear.");
		}
		
		return newT;
	};
	
	// Default function for applying resulting animated values.
	rat.KeyFrameAnimator.prototype.defaultApplyFunc = function(owner, propertyNames, values, valueType)
	{
		if( !owner ){
			return;
		}
		
		if( propertyNames.length !== values.length ){
			rat.console.log("WARNING - rat.KeyFrameAnimator.defaultApplyFunc: propertyNames and values arrays don't match!");
			return;
		}
		for( var i = 0; i < propertyNames.length; i++ ){
			if( valueType === rat.KeyFrameAnimator.ValueType.RAT_POSITION ){
				assignRatPos(owner, propertyNames[i], values[i]);
			}
			else{
				assignProp(owner, propertyNames[i], values[i]);
			}
		}
	};
	
	// A utility function to find a property on an object given a property "path" string,
	// and then assign a value to that property.
	// For instance, assignProp(obj "foo.bar.baz") will effectively do "obj.foo.bar.baz = value".
	// This function seems to take a lot of time when there's a lot of animators going.
	function assignProp(obj, propertyPath, value){
		var props = propertyPath.split(".");
		var lastProp = props.pop();
		while(props.length && (obj = obj[props.shift()])){}
		if( obj && typeof obj[lastProp] !== "undefined" ){
			obj[lastProp] = value;
		}
	}
	
	// Utility function for assigning a rat-position (includes pos and angle), on the given object (assumed to be a rat element).
	function assignRatPos(obj, propName, ratPos){
		if( obj && obj.place && ratPos ){
			// Sset individual properties.  Maybe just assign the ratPos object?
			obj.place.pos.x = ratPos.pos.x;
			obj.place.pos.y = ratPos.pos.y;
			obj.place.rot.angle = ratPos.rot.angle;
		}
	}
	
	
	//	A data class for creating/storing keyframe data 
	//	Each key data item should have the following entries:
	//	time - the time for the key frame (in seconds, can be fractional).
	//	values - an array of property values. Needs to match the list of propertyNames for the animator.
	//	easing - an object containing "type", from rat.KeyFrameAnimator.EasingType, 
	//		and "params", an array of values that will be passed to the easing function.
	//	If easeType is null/undefined, then linear easing is assumed.
	//	This class is meant to ease the setup of keyframe data.
	rat.KeyFrameData = function(time, values, easeType, easeParams)
	{
		this.time = time;
		this.values = values;
		this.easing = {};
		this.easing.type = rat.KeyFrameAnimator.EasingType.LINEAR;
		if( typeof easeType !== "undefined" && easeType !== null ){
			this.easing.type = easeType;
		}
		if( typeof easeParams !== "undefined" && easeParams !== null ){
			this.easing.params = easeParams;
		}
	};
	
} );
