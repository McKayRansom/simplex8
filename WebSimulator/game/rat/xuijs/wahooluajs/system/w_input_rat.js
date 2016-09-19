// Handles input for rat-based javascript environment

//	Comments from lua implementation:
// Not sure what's best - 
// a polling-type system, where we call a javascript function to get the current state of all controller buttons, 
// or an event-driven system, where the javascript calls a set of functions when controller down/up events happen.
// Event-driven might not work if we need control stick analog values.
// Also, event driven doesn't really fit in with the current structure of WInput, so let's just set up polling.

//	our new implementation may be more aggresive, since we have direct access to rat, thank you very much.

//
//	generated js from lua file and hand-edited
//
rat.modules.add( "rat.xuijs.wahooluajs.system.w_input_rat",
[
	{name: "rat.utils.r_utils", processBefore: true },
	{name: "rat.xuijs.wahooluajs.wahoolua", processBefore: true },
	{name: "rat.xuijs.wahooluajs.system.w_input", processBefore: true },
], 
function(rat)
{
	//	constructor
	var WInputRat = function()
	{
		WInputRat.prototype.parentConstructor.call(this); //	default init
		this.keyTable_FROM = {
			VK_PAD_A: rat.input.BUTTON_A,
			VK_PAD_B: rat.input.BUTTON_B,
			VK_PAD_X: rat.input.BUTTON_X,
			VK_PAD_Y: rat.input.BUTTON_Y,
			VK_PAD_BACK: rat.input.BUTTON_SELECT,
			VK_PAD_START: rat.input.BUTTON_START,
			VK_PAD_RSHOULDER: rat.input.BUTTON_RB,
			VK_PAD_RTRIGGER: rat.input.BUTTON_RT,
			VK_PAD_LSHOULDER: rat.input.BUTTON_LB,
			VK_PAD_LTRIGGER: rat.input.BUTTON_LT,
			VK_PAD_DPAD_UP: rat.input.BUTTON_DPAD_UP,
			VK_PAD_DPAD_DOWN: rat.input.BUTTON_DPAD_DOWN,
			VK_PAD_DPAD_LEFT: rat.input.BUTTON_DPAD_LEFT,
			VK_PAD_DPAD_RIGHT: rat.input.BUTTON_DPAD_RIGHT,
			VK_PAD_LTHUMB_UP: rat.input.BUTTON_LSTICK_UP,
			VK_PAD_LTHUMB_DOWN: rat.input.BUTTON_LSTICK_DOWN,
			VK_PAD_LTHUMB_LEFT: rat.input.BUTTON_LSTICK_LEFT,
			VK_PAD_LTHUMB_RIGHT: rat.input.BUTTON_LSTICK_RIGHT,
			VK_PAD_LTHUMB_PRESS: rat.input.BUTTON_LEFT_STICK,
			VK_PAD_RTHUMB_UP: rat.input.BUTTON_RSTICK_UP,
			VK_PAD_RTHUMB_DOWN: rat.input.BUTTON_RSTICK_DOWN,
			VK_PAD_RTHUMB_LEFT: rat.input.BUTTON_RSTICK_LEFT,
			VK_PAD_RTHUMB_RIGHT: rat.input.BUTTON_RSTICK_RIGHT,
			VK_PAD_RTHUMB_PRESS: rat.input.BUTTON_RIGHT_STICK,
			VK_BIGBUTTON		: "unsupported",
		};
	
		// Map from rat-based button IDs to wahoolua "VK_PAD" values.
		this.keyTable_TO = {};
		this.keyTable_TO[rat.input.BUTTON_A]			= "VK_PAD_A";
		this.keyTable_TO[rat.input.BUTTON_B]			= "VK_PAD_B";
		this.keyTable_TO[rat.input.BUTTON_X]			= "VK_PAD_X";
		this.keyTable_TO[rat.input.BUTTON_Y]			= "VK_PAD_Y";
		this.keyTable_TO[rat.input.BUTTON_SELECT]		= "VK_PAD_BACK";
		this.keyTable_TO[rat.input.BUTTON_START]		= "VK_PAD_START";
		this.keyTable_TO[rat.input.BUTTON_RB]			= "VK_PAD_RSHOULDER";
		this.keyTable_TO[rat.input.BUTTON_RT]			= "VK_PAD_RTRIGGER";
		this.keyTable_TO[rat.input.BUTTON_LB]			= "VK_PAD_LSHOULDER";
		this.keyTable_TO[rat.input.BUTTON_LT]			= "VK_PAD_LTRIGGER";
		this.keyTable_TO[rat.input.BUTTON_DPAD_UP]		= "VK_PAD_DPAD_UP";
		this.keyTable_TO[rat.input.BUTTON_DPAD_DOWN]	= "VK_PAD_DPAD_DOWN";
		this.keyTable_TO[rat.input.BUTTON_DPAD_LEFT]	= "VK_PAD_DPAD_LEFT";
		this.keyTable_TO[rat.input.BUTTON_DPAD_RIGHT]	= "VK_PAD_DPAD_RIGHT";
		this.keyTable_TO[rat.input.BUTTON_LSTICK_UP]	= "VK_PAD_LTHUMB_UP";
		this.keyTable_TO[rat.input.BUTTON_LSTICK_DOWN]	= "VK_PAD_LTHUMB_DOWN";
		this.keyTable_TO[rat.input.BUTTON_LSTICK_LEFT]	= "VK_PAD_LTHUMB_LEFT";
		this.keyTable_TO[rat.input.BUTTON_LSTICK_RIGHT]= "VK_PAD_LTHUMB_RIGHT";
		this.keyTable_TO[rat.input.BUTTON_LEFT_STICK]	= "VK_PAD_LTHUMB_PRESS";
		this.keyTable_TO[rat.input.BUTTON_RSTICK_UP]	= "VK_PAD_RTHUMB_UP";
		this.keyTable_TO[rat.input.BUTTON_RSTICK_DOWN]	= "VK_PAD_RTHUMB_DOWN";
		this.keyTable_TO[rat.input.BUTTON_RSTICK_LEFT]	= "VK_PAD_RTHUMB_LEFT";
		this.keyTable_TO[rat.input.BUTTON_RSTICK_RIGHT]= "VK_PAD_RTHUMB_RIGHT";
		this.keyTable_TO[rat.input.BUTTON_RIGHT_STICK]	= "VK_PAD_RTHUMB_PRESS";
		//this.keyTable_TOrat.input.VK_BIGBUTTON]		= "VK_BIGBUTTON";
	}
	rat.utils.inheritClassFrom(WInputRat, wahoolua.WInput);
	
	WInputRat.prototype.ResetSupportedButtons = function(vklist) {}	//	not needed

	WInputRat.prototype.PreProcessKey = function(key, value, deltaTime)
	{
		// Not sure we'll need this for anything.
		// Javascript side has already done threshold testing for trigger and analog sticks,
		// so we shouldn't really need to do it here.
		
		return [key, value];
	}
	
	//	Note that we are NOT a CycleUpdater subclass.  This function gets called explicitly by the app somewhere.
	//var ratAPI = xuijsAPI;
	WInputRat.prototype.CycleUpdate = function(deltaTime)
	{
		if(this.players === 1)
		{
			// Get controller state
			//var controllerState = ratAPI.getControllerState();
			//	todo: support individual controllers
			var controllerState = rat.input.getCombinedControllers();
			
			this.UpdateControllerState(controllerState);
		}
		else
		{
			for(var playerIndex = this.players - 1; playerIndex >= 0; --playerIndex)
			{
				this.gTriggered = this.allPlayerInputStates.triggered[ playerIndex ];
				this.gPressed = this.allPlayerInputStates.pressed[ playerIndex ];
				this.gReleased = this.allPlayerInputStates.released[ playerIndex ];
				this.gDelays = this.allPlayerInputStates.delays[ playerIndex ];
				
				if(playerIndex === 0)
				{
					var controllerState = rat.input.getActiveController();
					this.allPlayerInputStates.controllerState[ 0 ] = controllerState;
					this.UpdateControllerState(controllerState);
				}
				else
				{
					this.UpdateNoncurrentPlayer(playerIndex, deltaTime);
				}
			}
		}
	};
	
	WInputRat.prototype.UpdateNoncurrentPlayer = function(playerIndex, deltaTime)
	{
		var userId = this.allPlayerInputStates.userId[ playerIndex ];
		if(userId === null)
		{
			// No user index assigned. Search to see if we get an ith player set up.
			for (var index = 0; index < rat.input.controllers.length; ++index)
			{
				var controller = rat.input.controllers[ index ];
				if(this.IsUserIdUnassigned(controller.id))
				{
					var joinKey = this.IsJoinPressed(controller);
					if(joinKey)
					{
						this.allPlayerInputStates.userId[ playerIndex ] = controller.id;
						this.gTriggered[ joinKey ] = true;
					}
				}
			}
		}
		else
		{
			var controller = rat.input.controllers.getByID(userId);
			this.allPlayerInputStates.controllerState[ playerIndex ] = controller;
			if(controller)
			{
				// Update the input
				this.UpdateControllerState(controller, deltaTime);
			}
			else
			{
				// User dropped. Reset the states.
				this.Reset(playerIndex);
			}
		}
	};
	
	WInputRat.prototype.UpdateControllerState = function(controllerState, deltaTime)
	{
		if( controllerState )
		{
			var rawButtons = controllerState.rawButtons;
			for (var key in this.keyTable_TO)
			{
				var buttonValue = ((rawButtons & key) !== 0);
				this.ProcessKey(key, buttonValue, deltaTime);
			}
		}
	};
	
	WInputRat.prototype.IsUserIdUnassigned = function(userId)
	{
		for(var playerIndex = 0; playerIndex < this.allPlayerInputStates.userId.length; ++playerIndex)
		{
			if(this.GetUserId(playerIndex) === userId)
			{
				return false;
			}
		}
		return true;
	};
	
	WInputRat.prototype.IsJoinPressed = function(controllerState)
	{
		for(var i = 0; i < this.JoinKeys.length; ++i)
		{
			var key = this.JoinKeys[ i ];
			if(this.IsJoinKeyPressed(controllerState, key))
			{
				return key;
			}
		}
	};
	
	WInputRat.prototype.IsJoinKeyPressed = function(controllerState, key)
	{
		var keyMask = this.keyTable_FROM[ key ];
		return ((controllerState.rawButtons & keyMask) !== 0);
	};
	
	// Sets the number of players to track
	WInputRat.prototype.SetPlayers = function(players)
	{
		if(players !== this.players)
		{
			if(players === 1)
			{
				// Return to the default behavior of only tracking the current user
				this.gTriggered = this.allPlayerInputStates.triggered[0];
				this.gPressed = this.allPlayerInputStates.pressed[0];
				this.gReleased = this.allPlayerInputStates.released[0];
				this.gDelays = this.allPlayerInputStates.delays[0];
				
				this.allPlayerInputStates = null;
			}
			else
			{
				// Start up tracking every player's input state as needed.
				if(!this.allPlayerInputStates)
				{
					var controller = rat.input.getActiveController();
					var activeControllerID = controller && controller.id;
					this.allPlayerInputStates = {
						controllerState : [ controller ],
						triggered 		: [ this.gTriggered ],
						pressed 		: [ this.gPressed ],
						released 		: [ this.gReleased ],
						delays 			: [ this.gDelays ],
						userId 			: [ activeControllerID ],
					};
					rat.input.setActiveControllerID(activeControllerID);
				}
				// Set up new players to track
				while(this.allPlayerInputStates.userId.length < players)
				{
					this.allPlayerInputStates.controllerState.push(null);
					this.allPlayerInputStates.triggered.push({});
					this.allPlayerInputStates.pressed.push({});
					this.allPlayerInputStates.released.push({});
					this.allPlayerInputStates.delays.push({});
					this.allPlayerInputStates.userId.push(null);
				}
				// Remove old players to not track
				while(this.allPlayerInputStates.userId.length > players)
				{
					this.allPlayerInputStates.controllerState.pop();
					this.allPlayerInputStates.triggered.pop();
					this.allPlayerInputStates.pressed.pop();
					this.allPlayerInputStates.released.pop();
					this.allPlayerInputStates.delays.pop();
					this.allPlayerInputStates.userId.pop();
				}
				
			}
			this.players = players;
		}
	};
	
	// Get the user ID for the player
	WInputRat.prototype.GetUserId = function(playerIndex)
	{
		if(playerIndex == 0 || !playerIndex)
		{
			var activeController = rat.input.getActiveController();
			return activeController && activeController.id;
		}
		else if(playerIndex < this.players) {
			return this.allPlayerInputStates.userId[ playerIndex ];
		}
		return null;
	};
	
	// Gets the player index from the user ID
	WInputRat.prototype.GetPlayerIndex = function(userId)
	{
		if(this.allPlayerInputStates)
		{
			for(var playerIndex = 0; playerIndex < this.allPlayerInputStates.userId.length; ++playerIndex)
			{
				if(userId === this.GetUserId( playerIndex ))
				{
					return playerIndex;
				}
			}
		}
		else if(userId === rat.input.getActiveController().id)
		{
			return 0;
		}
		return -1;
	};
	
	// Checks to see if a player has a connected controller
	WInputRat.prototype.IsPlayerConnected = function(playerIndex)
	{
		return !!this.GetUserId(playerIndex);
	};
	
	// Checks to see if a player has a connected controller
	WInputRat.prototype.SetUserIndex = function(playerIndex, userId)
	{
		if(playerIndex == 0)
		{
			rat.console.log("Warning: Tried to set the user index of player one. Denied. Will continue to use the current user ID.");
		}
		else if(playerIndex > this.players)
		{
			rat.console.log("Warning: Tried to set "+userId+", but there are only "+self.allPlayerInputStates.userId.length+" players.");
		}
		else if(!userId)
		{
			this.Reset(playerIndex);
		}
		else
		{
			this.allPlayerInputStates.userId[ playerIndex ] = userId;
		}
	};
	
	// Resets/clears the user index for the player.
	WInputRat.prototype.Reset = function(playerIndex)
	{
		this.allPlayerInputStates.controllerState[ playerIndex ] = null;
		this.allPlayerInputStates.triggered[ playerIndex ] = {};
		this.allPlayerInputStates.pressed[ playerIndex ] = {};
		this.allPlayerInputStates.released[ playerIndex ] = {};
		this.allPlayerInputStates.delays[ playerIndex ] = {};
		this.allPlayerInputStates.userId[ playerIndex ] = null;
	};
	
	// Resets/clears the user index for the player.
	WInputRat.prototype.GetControllerState = function(playerIndex)
	{
		if(this.IsPlayerConnected(playerIndex)) {
			return this.allPlayerInputStates.controllerState[ playerIndex ];
		}
		return null;
	};
	
	//	global access
	wahoolua.WInputRat = WInputRat;	//	needed?
	wahoolua.gInput = new WInputRat();

} );
