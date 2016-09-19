//
//	generated js from lua file and hand-edited
//
rat.modules.add( "rat.xuijs.wahooluajs.system.w_input",
[
	{name: "rat.utils.r_utils", processBefore: true },
	{name: "rat.xuijs.wahooluajs.wahoolua", processBefore: true },
	"rat.xuijs.wahooluajs.system.w_input_rat",
], 
function(rat)
{
	//	constructor
	var WInput = function()
	{
		this.upEventHandler = null;
		this.downEventHandler = null;
	
		this.gAnalogState = {packet: 0,}
	
		this.gTriggered = {}
		this.gPressed = {}
		this.gReleased = {}
		this.gDelays = {}
		this.gPressedDelay = 0.25		// gap in press repeats
		this.players = 1
		this.JoinKeys = [ "VK_PAD_A", "VK_PAD_START" ]
	
		// Key mappings should be provided by sub-classes
		this.keyTable_FROM = {}
		this.keyTable_TO = {}
	
		this.oppositeKeys = {
			"VK_PAD_DPAD_UP"		: "VK_PAD_DPAD_DOWN",
			"VK_PAD_DPAD_DOWN"	: "VK_PAD_DPAD_UP",
			"VK_PAD_DPAD_LEFT"	: "VK_PAD_DPAD_RIGHT",
			"VK_PAD_DPAD_RIGHT"	: "VK_PAD_DPAD_LEFT",
			"VK_PAD_LTHUMB_UP"	: "VK_PAD_LTHUMB_DOWN",
			"VK_PAD_LTHUMB_DOWN"	: "VK_PAD_LTHUMB_UP",
			"VK_PAD_LTHUMB_LEFT"	: "VK_PAD_LTHUMB_RIGHT",
			"VK_PAD_LTHUMB_RIGHT"	: "VK_PAD_LTHUMB_LEFT",
			"VK_PAD_RTHUMB_UP"	: "VK_PAD_RTHUMB_DOWN",
			"VK_PAD_RTHUMB_DOWN"	: "VK_PAD_RTHUMB_UP",
			"VK_PAD_RTHUMB_LEFT"	: "VK_PAD_RTHUMB_RIGHT",
			"VK_PAD_RTHUMB_RIGHT"	: "VK_PAD_RTHUMB_LEFT",
		}
	}
		
	WInput.prototype.ConvertFromKeyCode = function(key)
	{
		return this.keyTable_FROM[key]
	}
	
	WInput.prototype.PreProcessKey = function(key, value, deltaTime)
	{
		// Should be implemented in sub-classes
		return [key, value];
	}
	
	WInput.prototype.ProcessKey = function(key, value, deltaTime, translatedKeyCode)
	{
		// Allow sub-classes to preprocess input keys and values
		//WPerformance.Start( "PreProcessKey" );
		var vars0 =  this.PreProcessKey(key, value, deltaTime);
		key = vars0[0]
		value = vars0[1]
		//WPerformance.End();
		
		//WPerformance.Start( "translate" );
		var keyCode;
		if( translatedKeyCode ) {
			keyCode = translatedKeyCode;
		} else {
			keyCode = this.keyTable_TO[key];
		}
		if( !keyCode ) {
			// No key conversion found, so don't do anything.
			//if( value ) {
			//	WStdUtils.printf("ProcessKey: No key code mapping - key: "+key+", keyCode: "+keycode )
			//}
			//WPerformance.End();
			return
		}
		//WPerformance.End();
		
		if( value ) {
			//WPerformance.Start( "value=true" );
					
			var opKey = this.oppositeKeys[keyCode];
			if( opKey ) { 
				this.gTriggered[opKey] = false
				this.gPressed[opKey] = false
				this.gReleased[opKey] = true
			}
		
			if( this.gTriggered[keyCode] != true && this.gPressed[keyCode] != true ) {
				this.gTriggered[keyCode] = true
				this.gPressed[keyCode] = true
				this.gReleased[keyCode] = false
				this.gDelays[keyCode] = this.gPressedDelay
			} else if( this.gTriggered[keyCode] == true ) {
				this.gTriggered[keyCode] = false
				this.gPressed[keyCode] = true
				this.gReleased[keyCode] = false
			}
			
			//WPerformance.End();
		} else {
			//WPerformance.Start( "not value" );
			this.gTriggered[keyCode] = false
			this.gPressed[keyCode] = false
			this.gReleased[keyCode] = true
			//WPerformance.End();
		}
	
		//WPerformance.Start( "Delay" );
		if( this.gDelays[keyCode] != null ) {
			this.gDelays[keyCode] = this.gDelays[keyCode] - deltaTime
		}
		//WPerformance.End();
	}
	
	//	Note that we are NOT a CycleUpdater subclass.  This gets called (in a subclass) explicitly.
	WInput.prototype.CycleUpdate = function(deltaTime)
	{
		// Should be implemented in sub-classes
	}
	
	WInput.prototype.Pause = function()
	{
	}
	
	// if ignoreRepeat is true you'll get the raw pressed value (writing this down so I'll stop forgetting, haha)
	// otherwise you get a pattern of true and falses based on the press delay value
	WInput.prototype.IsKeyPressed = function(key, ignoreRepeat)
	{
		if( this.gDelays[key] != null ) {
			if( ignoreRepeat != true && this.gDelays[key] > 0 ) {
				return false
			}
		}
	
		if( this.gPressed != null ) {
			// todo: this needs to be moved, otherwise you can only call this function once per frame (which maybe is okay)
			this.gDelays[key] = this.gPressedDelay
			return this.gPressed[key]
		}
	
		return false
	}
	
	WInput.prototype.IsKeyTriggered = function(key)
	{
		if( this.gTriggered != null ) {
			return this.gTriggered[key]
		}
	
		return false
	}
	
	WInput.prototype.IsPressingLeft = function(right)
	{
		var res = false
		if( this.IsKeyPressed("VK_PAD_LTHUMB_LEFT", true) || this.IsKeyPressed("VK_PAD_DPAD_LEFT", true) || (right == true && this.IsKeyPressed("VK_PAD_RTHUMB_LEFT", true)) )
		{
			res = true
		}
		return res
	}
	
	WInput.prototype.IsPressingRight = function(right)
	{
		var res = false
		if( this.IsKeyPressed("VK_PAD_LTHUMB_RIGHT", true) || this.IsKeyPressed("VK_PAD_DPAD_RIGHT", true) || (right == true && this.IsKeyPressed("VK_PAD_RTHUMB_RIGHT", true)) )
		{
			res = true
		}
		return res
	}
	
	WInput.prototype.IsPressingUp = function(right)
	{
		var res = false
		if( this.IsKeyPressed("VK_PAD_LTHUMB_UP", true) || this.IsKeyPressed("VK_PAD_DPAD_UP", true) || (right == true && this.IsKeyPressed("VK_PAD_RTHUMB_UP", true)) )
		{
			res = true
		}
		return res
	}
	
	WInput.prototype.IsPressingDown = function(right)
	{
		var res = false
		if( this.IsKeyPressed("VK_PAD_LTHUMB_DOWN", true) || this.IsKeyPressed("VK_PAD_DPAD_DOWN", true) || (right == true && this.IsKeyPressed("VK_PAD_RTHUMB_DOWN", true)) )
		{
			res = true
		}
		return res
	}
	
	//Is Triggering functions
	WInput.prototype.IsTriggeringLeft = function(right)
	{
		var res = false
		if( this.IsKeyTriggered("VK_PAD_LTHUMB_LEFT", true) || this.IsKeyTriggered("VK_PAD_DPAD_LEFT", true) || (right == true && this.IsKeyTriggered("VK_PAD_RTHUMB_LEFT", true)) )
		{
			res = true
		}
		return res
	}
	
	WInput.prototype.IsTriggeringRight = function(right)
	{
		var res = false
		if( this.IsKeyTriggered("VK_PAD_LTHUMB_RIGHT", true) || this.IsKeyTriggered("VK_PAD_DPAD_RIGHT", true) || (right == true && this.IsKeyTriggered("VK_PAD_RTHUMB_RIGHT", true)) )
		{
			res = true
		}
		return res
	}
	
	WInput.prototype.IsTriggeringUp = function(right)
	{
		var res = false
		if( this.IsKeyTriggered("VK_PAD_LTHUMB_UP", true) || this.IsKeyTriggered("VK_PAD_DPAD_UP", true) || (right == true && this.IsKeyTriggered("VK_PAD_RTHUMB_UP", true)) )
		{
			res = true
		}
		return res
	}
	
	WInput.prototype.IsTriggeringDown = function(right)
	{
		var res = false
		if( this.IsKeyTriggered("VK_PAD_LTHUMB_DOWN", true) || this.IsKeyTriggered("VK_PAD_DPAD_DOWN", true) || (right == true && this.IsKeyTriggered("VK_PAD_RTHUMB_DOWN", true)) )
		{
			res = true
		}
		return res
	}
	
	// Turns a triggered table into a list
	//	(utility function)
	var GetTriggeredList = function(triggeredTable)
	{
		var triggered = [];
		for (var k in triggeredTable) {
			var v = triggeredTable[k];
			if( v ) {
				triggered.push(k);
			}
		}
		return triggered;
	}
	
	WInput.prototype.GetTriggered = function()
	{
		return GetTriggeredList(this.gTriggered)
	}
	
	// Gets the triggered input for the specified player as a list
	WInput.prototype.GetPlayerTriggered = function(playerIndex)
	{
		if( playerIndex == null || playerIndex == 0 )
		{
			return GetTriggeredList(this.gTriggered);
		}
		else if( playerIndex > this.players || !this.allPlayerInputStates )
		{
			return [];
		}
		return GetTriggeredList(this.allPlayerInputStates.triggered[playerIndex]);
	};
	
	WInput.prototype.GetPressed = function()
	{
		var pressed = []
		for (var k in this.keyTable_TO) {
			var v = this.keyTable_TO[k];
			if( this.IsKeyPressed(v,true) ) {
				pressed.push(v);
			}
		}
		return pressed
	}
	
	//	Set the place to dispatch key up and down events
	WInput.prototype.RegisterEventHandlers = function( up, down )
	{
		if( up != null ) {
			this.upEventHandler = up;
		}
		if( down != null ) {
			this.downEventHandler = down;
		}
	}
	
	//	Dispatch a down event
	WInput.prototype.DispatchKeyDown = function( keycode )
	{
		if( this.downEventHandler ) {
			this.downEventHandler( keycode );
		}
	}
	
	//	Dispatch an up event
	WInput.prototype.DispatchKeyUp = function( keycode )
	{
		if( this.upEventHandler ) {
			this.upEventHandler( keycode );
		}
	}
	
	//	global access to this class (not to gInput, which is in w_input_rat)
	wahoolua.WInput = WInput;

});
