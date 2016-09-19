//
//	Input handling.
//
//	This includes
//		handling input events (keyboard, mouse, touch, controller, whatever)
//		dispatching of input events through screens
//		translation of UI events
//		tracking "allowed controller"
//		associating controllers (and, indirectly, users) with events
//
//	An example scenario for "allowed" tracking
//		Two players sit in front of a single-player game.
//		Each has NUI tracking and a gamepad.  Only one player's inputs should be allowed.
//		The other player then picks up the first player's controller.  Now only his inputs should be allowed.
//		Weird, I know.
//
//	controller IDs are tracked differently depending on system.
//	On a browser, and other systems by default, mouse+keyboard are ID 0
//	On an Xbox, controller ID is the Xbox Controller ID
//	We do not track indices, in case one input is added or another removed.

//	Rat events vs. system events:
//		Once events come in from the system, we create a "ratEvent", which usually includes the original
//		system event ("sysEvent"), and some extra info.  We pass that rat event around from then on,
//		instead of a raw system event.
//		This lets us pass extra rat-specific and augmentive data around with the event,
//		and doesn't require us to modify the system event, which really should be read only.
//
//	DefaultEvents and prevention (2016.2.4)
//		Normally, we allow default event handling by the browser.
//			(though, you can change that base behavior by simply calling rat.input.setStandardPreventFlag())
//
//		Also, if you explicitly say you didn't handle an event (returned false from handler), then we allow default,
//			because if YOU didn't handle it, then you don't care about it, and it's OK for the browser to handle it.
//
//		If you set the allowBrowserDefault variable on the rat event, then we respect whatever you set it to, and do that.
//
//		So, if you want to explicitly say you handled the event and ALSO control whether default browser handling is allowed,
//		then return true from handler, and set the rat event's "allowBrowserDefault" variable.
//
//		see "handlePreventDefault()"!
//		This is all very confusing, and we're OK with rethinking it, but we think it's pretty good for now!
//		Talk to STT or JHS
//		

// Uses:
// rat.system, rat.graphics, rat.screenManager, rat.audio
rat.modules.add( "rat.input.r_input",
[
	"rat.debug.r_console",
	"rat.os.r_system",
	"rat.math.r_math",
	"rat.utils.r_utils",
	"rat.graphics.r_graphics",
	"rat.input.r_voice",
	"rat.input.r_keyboard",
], 
function(rat)
{	
	//rat.console.log("SLD rat.input");
	rat.input = {};
	
	var useLEGamepadAPI = false;
	var fakeGamepadAPI = false;

	//  this is the beginning of an attempt to track input type used by the user
	//  and automate a few things more nicely by looking at that.
	//  For instance, if the user is actively using keyboard to navigate UI,
	//      then we should select a button by default in an input map.
	//      But if they're using the mouse, we should not, so it won't highlight before they mouse over it.
	//  This feature is not yet thoroughly implemented.  Feel free to work on it!  :)
	//  (for now, I'm trying to get mouse/keyboard swapping to work well)
	//  Note that this just tracks UI input for now, since a mouse+keyboard combo may be desired,
	//  and we don't want to keep flopping modes, and it's easier to understand what UI navigation inputs are.
	//  Also, this feature has to be turned on explicitly, since a particular game may not want this at all,
	//  e.g. if they use arrow keys for something other than UI tracking, and mouse for UI.
	//
	//  Right now we assume ANY mouse input means use mouse UI.
	//
	//  This is actually pretty complicated... if the game doesn't support full keyboard UI,
	//      then this doesn't work well, 'cause mouse movement resets to mouse mode.
	rat.input.useLastUIInputType = false;
	rat.input.lastUIInputType = 'mouse';  //  'mouse', 'keyboard', 'controller', 'voice'

	// allow holding a button down to continue getting the same event - currently only checked in XBO the keyboard seems to handle
	// things differently and forces out a new event no matter what without checking previous states
	rat.input.allowRepeatEvents = {
		buttons: false,  /// I think most games don't want buttons to repeat.
		directions: true /// but almost all games do want directions to repeat
	};

	//	Allow preventing default on current event being handled
	
	//	this one is a way to set all of rat's event handling - do we normally prevent default or not?  By default, we DO prevent default
	//	(because default handling often messes with games)
	rat.input.standardPreventDefaultOnEvents = false;
	
	//	and this one says what to do with the current event (changed on an event by event basis)
	//	Why is this a separate variable instead of being part of the current rat event object?
	//	because in some cases below, that rat event object doesn't exist yet, or doesn't exist outside a certain context,
	//	so, another approach here would be to create the rat event pretty early and always have it to flag instead of using this var...
	//rat.input.preventDefaultOnEvents = rat.input.standardPreventDefaultOnEvents;
	
	rat.input.allowedControllers = [];				//	which controller inputs are allowed to trigger standard UI events.  blank list = allow all.

	//	this "active controller" concept is questionable - what about local multiplayer?   Use your own userIDs and controllerIDs instead
	rat.input.activeControllerID = 0;				//	by default, keyboard/mouse

	/**
	 * Array of currently connected controllers
	 * @type Array.<rat.input.Controller>
	 */
	rat.input.controllers = [];
	rat.input.controllers.getByID = function (id)
	{
		for (var index = 0; index < rat.input.controllers.length; ++index)
		{
			if (rat.input.controllers[index].id === id)
				return rat.input.controllers[index];
		}
		return void 0;
	};
	
	//	fake controller inputs from keyboard?  See below.
	rat.input.gamepadKeyFakeEnabled = false;

	//	standard rat button definitions; in order to generically support controllers independent of system
	rat.input.BUTTON_UP = 0x00000001;		//	simple mapped inputs, could be from dpad or from (left) stick
	rat.input.BUTTON_DOWN = 0x00000002;
	rat.input.BUTTON_LEFT = 0x00000004;
	rat.input.BUTTON_RIGHT = 0x00000008;

	rat.input.BUTTON_START = 0x00000010;
	rat.input.BUTTON_SELECT = 0x00000020;

	rat.input.BUTTON_A = 0x00000100;
	rat.input.BUTTON_B = 0x00000200;
	rat.input.BUTTON_C = 0x00000400;
	rat.input.BUTTON_D = 0x00000800;
	rat.input.BUTTON_X = rat.input.BUTTON_C;
	rat.input.BUTTON_Y = rat.input.BUTTON_D;

	rat.input.BUTTON_LT = 0x00001000;
	rat.input.BUTTON_LB = 0x00002000;
	rat.input.BUTTON_RT = 0x00004000;
	rat.input.BUTTON_RB = 0x00008000;

	rat.input.BUTTON_DPAD_UP = 0x00010000;		//	these are explicitly from a dpad; not ever mapped from stick
	rat.input.BUTTON_DPAD_DOWN = 0x00020000;
	rat.input.BUTTON_DPAD_LEFT = 0x00040000;
	rat.input.BUTTON_DPAD_RIGHT = 0x00080000;
	
	rat.input.BUTTON_LEFT_STICK = 0x00100000;
	rat.input.BUTTON_RIGHT_STICK = 0x00200000;
	
	rat.input.BUTTON_LSTICK_UP		= 0x01000000;
	rat.input.BUTTON_LSTICK_DOWN	= 0x02000000;
	rat.input.BUTTON_LSTICK_LEFT	= 0x04000000;
	rat.input.BUTTON_LSTICK_RIGHT	= 0x08000000;
	rat.input.BUTTON_RSTICK_UP		= 0x10000000;
	rat.input.BUTTON_RSTICK_DOWN	= 0x20000000;
	rat.input.BUTTON_RSTICK_LEFT	= 0x40000000;
	rat.input.BUTTON_RSTICK_RIGHT	= 0x80000000;

	rat.input.BUTTON_COUNT = 32;	//	bits/buttons supported

	// gamePadAPI button mapping (matches the gamepad.buttons order)
	// Axis/button mapping came from here
	// http://www.html5rocks.com/en/tutorials/doodles/gamepad/
	// Says index 1 is button 2 and index 2 is button 3 even though it's pointing is switched from that.
	// But testing the gamepad at http://html5gamepad.com/
	// in Chrome Version 35.0 and Firefox 30.0 shows that B is 1 and X is 2.
	rat.input.GAMEPAD_CONTROLLER_MAPPING = {
		//	Order matches the order the gamepad.buttons field
		//	positive values are in the buttons array
		//	negative values are in the axes array and negative one (not zero) based.
		BUTTON_A: 0,
		BUTTON_B: 1,
		BUTTON_C: 2,
		BUTTON_X: 2,// Same as C
		BUTTON_D: 3,
		BUTTON_Y: 3,// Same as D
		BUTTON_LB: 4,
		BUTTON_RB: 5,
		BUTTON_LT: 6,
		BUTTON_RT: 7,
		BUTTON_SELECT: 8,
		BUTTON_START: 9,
		BUTTON_LEFT_STICK: 10,
		BUTTON_RIGHT_STICK: 11,
		BUTTON_DPAD_UP: 12,
		BUTTON_DPAD_DOWN: 13,
		BUTTON_DPAD_LEFT: 14,
		BUTTON_DPAD_RIGHT: 15,
		leftStick: {
			x: -1,
			y: -2
		},
		rightStick: {
			x: -3,
			y: -4,
		},
		leftTrigger: 6,
		rightTrigger: 7
	};

	/**
	 * Enum for controller change type
	 */
	rat.input.ControllerChangeType = {
		REMOVED: 0,
		ADDED: 1,
		UPDATED: 2
	};

	/**
	 * @suppress {missingProperties}
	 */
	rat.input.init = function ()
	{
		// Polling is running... Yet
		var rInput = rat.input;
		var rHas = rat.system.has;
		rInput.controllers.pollingForced = false;
		rInput.controllers.pollingAllowed = false;

		//	TODO: break this out into xbox specific source module
		if(rHas.xbox)
		{
			rInput.controllers.pollingAllowed = true;
			rInput.controllers.pollingForced = true;
			//window.Windows.Xbox.Input.Controller.addEventListener("controlleradded", function(e){
			//});
			//window.Windows.Xbox.Input.Controller.addEventListener("controllerremoved", function(e){
			//});
			var xboxGamepadSort = function (a, b)
			{
				if (!a.user && !b.user)
					return 0;
				else if (!a.user)
					return 1;
				else if (!b.user)
					return -1;
				else
					return b.id - a.id;
			};
			rInput.controllers.getSystemControllers = function ()
			{
				var gamepads = window.Windows.Xbox.Input.Gamepad.gamepads;
				
				//	Get gamepads as a true array
				if (Array.isArray(gamepads) === false)
				{
					var newList = [];
					for (var index = gamepads.length - 1; index >= 0; --index)
						newList.unshift(gamepads[index]);
					gamepads = newList;
				}

				//	Sort
				//	User controllers first.
				gamepads.sort(xboxGamepadSort);

				return gamepads;
			};

			//	user-to-controller pairing change event, which we're required to 'reflect'
			//	see XR 30, I think.
			//Windows.Xbox.Input.Controller.addEventListener("controllerpairingchanged", onControllerPairingChanged);
			//Windows.Xbox.Input.Controller.removeEventListener("controllerpairingchanged", onControllerPairingChanged);

			//Windows.Xbox.Input.Controller.removeEventListener("controlleradded", rat.input.onControllerAdded);
		}
		else if(rHas.xboxLE)
		{
			if (useLEGamepadAPI)
			{
				rInput.controllers.pollingAllowed = true;
				//	Process all current controllers
				var onConnectedControllersChanged = function(eventArgs)
				{
					rat.console.log( "Connected Controllers changed" );
					eventArgs.gamepad = eventArgs.gamepad || {};
					eventArgs.gamepad.user = eventArgs.gamepad.user || {};
					var sysGP = {
						id: eventArgs.gamepad.id,
						index: eventArgs.gamepad.id,
						connected: !eventArgs.removed,
						hasReading: false,
						reading: void 0,
						timestamp: eventArgs.timestamp || Date.now()
					};
									
					//	Get the rat version of the controller
					var ratGP = rInput.buildRatControllerObject("xle", sysGP);
					if (sysGP.connected)
						rInput.onControllerChange(rInput.ControllerChangeType.ADDED, ratGP);
					else
						rInput.onControllerChange(rInput.ControllerChangeType.REMOVED, ratGP);
				}

				Ormma.addEventListener( MAPLE_EVENT_GAMEPAD_READING_CHANGED, function(eventArgs)
				{
					rat.console.log( "Left stick " + eventArgs.reading.leftThumbstickX + ", " + eventArgs.reading.leftThumbstickY );
					if (eventArgs.reading.isAPressed)
						rat.console.log( "A" );
					eventArgs.target.user = eventArgs.target.user || {};
					var sysGP = {
						id: eventArgs.target.id,
						index: eventArgs.target.id,
						connected: true,
						hasReading: true,
						reading: eventArgs.reading,
						timestamp: Date.now()
					};
					var ratGP = rInput.buildRatControllerObject("xle", sysGP);
					rInput.onControllerChange(rInput.ControllerChangeType.UPDATED, ratGP);
				});
				
				var list = Ormma.getGamepads();
				var event = {
					removed: false,
					gamepad: void 0,
					timestamp: Date.now()
				};
				var gp;
				for( var i = 0; i < list.length; ++i )
				{
					event.gamepad = list[i];
					onConnectedControllersChanged( event );
				}
				Ormma.addEventListener( MAPLE_EVENT_GAMEPADS_CHANGED, onConnectedControllersChanged );
			}
		}
			//	include gamepad support if we are not getting it from the xbox
		else if(rHas.gamepadAPI)
		{
			rInput.controllers.pollingAllowed = true;
			if(rHas.gamepadAPIEvent)
			{
				window.addEventListener("gamepadconnected", rInput.onSysControllerAdded);
				window.addEventListener("gamepaddisconnected", rInput.onSysControllerRemoved);
			}
			else
				rInput.controllers.pollingForced = true;

			//	Assign the function that we use to get the controller list
			var nav = navigator;
			var platformGetGamepadsFunc = nav.getGamepads ||
							nav.mozGetGamepads ||
							nav.webkitGetGamepads ||
							function ()
							{
								return nav.gamepads ||
									   nav.mozGamepads ||
									   nav.webkitGamepads ||
										[];
							};
			var getGamepadsFunc = platformGetGamepadsFunc;
			
			//  Derek: For builds that names controllers of the same type with the same id, append the controller id with the index.
			if(rat.system.has.chromeBrowser)
			{
				getGamepadsFunc = function()
				{
					var gamepads = platformGetGamepadsFunc.call(this);
					var gamepadsWithUniqueId = [];
					
					for(var i = 0; i < gamepads.length; ++i) {
						var gamepad = gamepads[ i ];
						if(gamepad != null) {
							var gamepadWithUniqueId = {}; // Since the system's gamepad data cannot be modified, copy the data to a new object.
							for(var key in gamepad) {
								gamepadWithUniqueId[ key ] = gamepad[ key ];
							}
							gamepadWithUniqueId.id += gamepadWithUniqueId.index; // Modify the id to make it unique.
							gamepadsWithUniqueId.push(gamepadWithUniqueId);
						}
						else {
							gamepadsWithUniqueId.push(null);
						}
					}
					
					return gamepadsWithUniqueId;
				};
			}
							
			var wraithGamepadSort = function(a, b)
			{
				return (!a) ? -1 : (!b) ? 1 : b.index - a.index;
			};
			
			rInput.controllers.getSystemControllers = function ()
			{
				var gamepads = getGamepadsFunc.call(nav);

				//	Get gamepads as a true array
				if (Array.isArray(gamepads) === false)
				{
					var newList = [];
					for (var index = gamepads.length - 1; index >= 0; --index)
						newList.unshift(gamepads[index]);
					gamepads = newList;
				}

				//	optional fake gamepad support
				if (rat.input.gamepadKeyFakeEnabled && !rat.console.state.consoleActive )
				{
					gamepads.push(rat.input.buildGamepadKeyFake());
				}

				//////////////////////////////////////////////////
				/// Most of the time we sort the gamepad list
				//	Sort the list of gamepads from the system by their index (higher indexes go last)
				if (!rat.system.has.Wraith)
				{
					gamepads = gamepads.sort(wraithGamepadSort);
				}

				return gamepads;
			};
		}
		else
		{
			rInput.controllers.pollingAllowed = true;
			rInput.controllers.pollingForced = true;
			fakeGamepadAPI = true;
			rInput.controllers.getSystemControllers = function ()
			{
				var gamepads = [];
				if (rat.input.gamepadKeyFakeEnabled)
				{
					gamepads.push(rat.input.buildGamepadKeyFake());
				}
				return gamepads;
			}
		}
	};

	//	add mouse handler to get called whenever we get any mouse or translated touch event,
	//	right before it's handed off to the screen manager.
	//	This is useful for filtering out click events for some reason (return true to indicate handled)
	//	or for getting clicks outside our UI space, etc.
	rat.input.setMouseHandler= function (callback)
	{
		rat.input.mouseHandler = callback;
	};

	// translate XBO gamepad inputs into out rat input style
	/**
	 * @param {?} gamepadInput
	 * @suppress {missingProperties}
	 */
	//rat.input.translateGamepadToInput = function (gamepadInput)
	//{
	//	// PMM since theres only one input couldn't we turn this into a hash instead for easier access?
	//	var translate = [
	//				{ from: Windows.Xbox.Input.GamepadButtons.dpadUp, to: rat.input.BUTTON_UP | rat.input.BUTTON_DPAD_UP },
	//				{ from: Windows.Xbox.Input.GamepadButtons.dpadDown, to: rat.input.BUTTON_DOWN | rat.input.BUTTON_DPAD_DOWN },
	//				{ from: Windows.Xbox.Input.GamepadButtons.dpadLeft, to: rat.input.BUTTON_LEFT | rat.input.BUTTON_DPAD_LEFT },
	//				{ from: Windows.Xbox.Input.GamepadButtons.dpadRight, to: rat.input.BUTTON_RIGHT | rat.input.BUTTON_DPAD_RIGHT },

	//				{ from: Windows.Xbox.Input.GamepadButtons.a, to: rat.input.BUTTON_A },
	//				{ from: Windows.Xbox.Input.GamepadButtons.b, to: rat.input.BUTTON_B },
	//				{ from: Windows.Xbox.Input.GamepadButtons.x, to: rat.input.BUTTON_X },
	//				{ from: Windows.Xbox.Input.GamepadButtons.y, to: rat.input.BUTTON_Y },

	//				{ from: Windows.Xbox.Input.GamepadButtons.leftShoulder, to: rat.input.BUTTON_LB },
	//				{ from: Windows.Xbox.Input.GamepadButtons.rightShoulder, to: rat.input.BUTTON_RB },

	//				{ from: Windows.Xbox.Input.GamepadButtons.view, to: rat.input.BUTTON_SELECT },
	//				{ from: Windows.Xbox.Input.GamepadButtons.menu, to: rat.input.BUTTON_START }
	//	];

	//	for(var tIndex = 0; tIndex < translate.length; tIndex++)
	//	{
	//		if(gamepadInput === translate[tIndex].from)
	//			return translate[tIndex].to;
	//	}
	//	return null;
	//};

	// translate XBO keyboard inputs into our rat inputs
	/**
	 * @param {?} keyboardInput
	 * @suppress {missingProperties}
	 */
	var winJSKeyTranslations = {};
	if (window.WinJS)
	{
		var winJSKeys = window.WinJS.Utilities.Key;
		winJSKeyTranslations[winJSKeys.gamepadDPadUp] = rat.input.BUTTON_DPAD_UP;
		winJSKeyTranslations[winJSKeys.gamepadDPadDown] = rat.input.BUTTON_DPAD_DOWN;
		winJSKeyTranslations[winJSKeys.gamepadDPadLeft] = rat.input.BUTTON_DPAD_LEFT;
		winJSKeyTranslations[winJSKeys.gamepadDPadRight] = rat.input.BUTTON_DPAD_RIGHT;
		
		winJSKeyTranslations[winJSKeys.gamepadLeftThumbstickUp] = rat.input.BUTTON_LSTICK_UP;
		winJSKeyTranslations[winJSKeys.gamepadLeftThumbstickDown] = rat.input.BUTTON_LSTICK_DOWN;
		winJSKeyTranslations[winJSKeys.gamepadLeftThumbstickLeft] = rat.input.BUTTON_LSTICK_LEFT;
		winJSKeyTranslations[winJSKeys.gamepadLeftThumbstickRight] = rat.input.BUTTON_LSTICK_RIGHT;
		
		winJSKeyTranslations[winJSKeys.gamepadRightThumbstickUp] = rat.input.BUTTON_RSTICK_UP;
		winJSKeyTranslations[winJSKeys.gamepadRightThumbstickDown] = rat.input.BUTTON_RSTICK_DOWN;
		winJSKeyTranslations[winJSKeys.gamepadRightThumbstickLeft] = rat.input.BUTTON_RSTICK_LEFT;
		winJSKeyTranslations[winJSKeys.gamepadRightThumbstickRight] = rat.input.BUTTON_RSTICK_RIGHT;
		
		winJSKeyTranslations[winJSKeys.gamepadA] = rat.input.BUTTON_A;
		winJSKeyTranslations[winJSKeys.gamepadB] = rat.input.BUTTON_B;
		winJSKeyTranslations[winJSKeys.gamepadX] = rat.input.BUTTON_X;
		winJSKeyTranslations[winJSKeys.gamepadY] = rat.input.BUTTON_Y;
		
		winJSKeyTranslations[winJSKeys.gamepadLeftShoulder] = rat.input.BUTTON_LB;
		winJSKeyTranslations[winJSKeys.gamepadRightShoulder] = rat.input.BUTTON_RB,
		
		winJSKeyTranslations[winJSKeys.gamepadLeftTrigger] = rat.input.BUTTON_LT;
		winJSKeyTranslations[winJSKeys.gamepadRightTrigger] = rat.input.BUTTON_RT,

		winJSKeyTranslations[winJSKeys.gamepadLeftTrigger] = rat.input.BUTTON_LT;
		winJSKeyTranslations[winJSKeys.gamepadRightTrigger] = rat.input.BUTTON_RT,

		winJSKeyTranslations[winJSKeys.gamepadView] = rat.input.BUTTON_SELECT;
		winJSKeyTranslations[winJSKeys.gamepadMenu] = rat.input.BUTTON_START,
		
		winJSKeyTranslations[winJSKeys.gamepadLeftThumbstick] = rat.input.BUTTON_LEFT_STICK;
		winJSKeyTranslations[winJSKeys.gamepadRightThumbstick] = rat.input.BUTTON_RIGHT_STICK;
	};
	rat.input.translateKeyToInput = function (keyboardInput)
	{
		var winJSKeys = window.WinJS.Utilities.Key;
		var found = winJSKeyTranslations[keyboardInput];
		if (found)
		{
			//rat.console.log( "LE Found keyboard->Controller input translation" );
			//rat.console.log( "   " + keyboardInput + "->" + found );
			if (found == rat.input.BUTTON_DPAD_UP || found == rat.input.BUTTON_LSTICK_UP)
				found |= rat.input.BUTTON_UP;
			if (found == rat.input.BUTTON_DPAD_DOWN || found ==rat.input.BUTTON_LSTICK_DOWN)
				found |= rat.input.BUTTON_DOWN;
			if (found == rat.input.BUTTON_DPAD_LEFT || found ==rat.input.BUTTON_LSTICK_LEFT)
				found |= rat.input.BUTTON_LEFT;
			if (found == rat.input.BUTTON_DPAD_RIGHT || found ==rat.input.BUTTON_LSTICK_RIGHT)
				found |= rat.input.BUTTON_RIGHT;
		}
		else
			found = null;
		return found;
	};

	//	Update input handling.
	rat.input.update = function (dt)
	{
		var rInput = rat.input;
		//	Update the controllers if we need to.
		if(rInput.controllers.pollingAllowed &&
			(rInput.controllers.pollingForced || rInput.controllers.length > 0))
		{
			rInput.updateControllers(dt);
		}
		//	update keyboard.
		rat.input.keyboard.update(dt);
	};

		//	debounce buttons (find which are new)
	rat.input.debounceButtons = function (cont)
	{
		cont.newButtons = cont.rawButtons & ~cont.lastButtons;
		cont.lastButtons = cont.rawButtons;
	};

	// Get a controller by its ID
	rat.input.getControllerByID = function (id)
	{
		var controller;
		for (var ecIndex = 0; ecIndex < rat.input.controllers.length; ecIndex++)
		{
			controller = rat.input.controllers[ecIndex];
			if (controller.id === id)
				return controller;
		}
		return void 0;
	};

	//	get "current" active single player controller.  This is pretty questionable, but let's do it for now,
	//	until we have better code for really knowing which user is playing, and which controller is his.
	rat.input.getActiveController = function ()
	{
		//	if no controllers, return null
		if(rat.input.controllers.length <= 0)
			return null;

		//	First, try to find the currently set active controller
		var ecIndex;
		if (rat.input.activeControllerID !== 0)
		{
			for (ecIndex = 0; ecIndex < rat.input.controllers.length; ecIndex++)
			{
				if (rat.input.controllers[ecIndex].id === rat.input.activeControllerID)
					return rat.input.controllers[ecIndex];
			}
		}

		//	If we cannot find it, or if we don't have an active controller
		//	temp - handle the case of no active controller id by returning the first one.
		//	NOT good for long-term use.  TODO: fix this.  tighten up allowed/active controllers.
		var found = void 0;
		for (ecIndex = 0; ecIndex < rat.input.controllers.length; ecIndex++)
		{
			if (!found || found.index > rat.input.controllers[ecIndex].index)
				found = rat.input.controllers[ecIndex];
		}

		//	Return the controller with the lowest index
		return found;
	};

	function accumulateControllerInput( masterObject, addedObject )
	{
		masterObject.lastButtons |= addedObject.lastButtons;
		masterObject.newButtons |= addedObject.newButtons;
		masterObject.rawButtons |= addedObject.rawButtons;

		masterObject.leftStick.x += addedObject.leftStick.x;
		masterObject.leftStick.y += addedObject.leftStick.y;
		masterObject.rightStick.x += addedObject.rightStick.x;
		masterObject.rightStick.y += addedObject.rightStick.y;
		if (addedObject.leftTrigger > masterObject.leftTrigger)
			masterObject.leftTrigger = addedObject.leftTrigger;
		if (addedObject.rightTrigger > masterObject.rightTrigger)
			masterObject.rightTrigger = addedObject.rightTrigger;
		// handle averaging left and right stick? trigger buttons?
	};
	
	function normalizeStick( stick )
	{
		stick.x = rat.math.clamp( stick.x, -1, 1 );
		stick.y = rat.math.clamp( stick.y, -1, 1 );
		var len = rat.math.sqrt(stick.x * stick.x + stick.y * stick.y);
		if (len > 1)
		{
			stick.x /= len;
			stick.y /= len;
		}
	}
	
	rat.input.getCombinedControllers = function ( controllerIdList )
	{
		//	if no controllers, return null
		if(rat.input.controllers.length <= 0)
			return null;
			
		var combinedControllerObj = new rat.input.Controller({}, "COMBINED", -1, true, 0);
				
		// if there is no passed in controller list, then make the list the allowed controllers
		if( !controllerIdList || controllerIdList.length === 0 )
			controllerIdList = rat.input.allowedControllers;
			
		if( controllerIdList && controllerIdList.length > 0 )
		{
			for (var i = 0; i < controllerIdList.length; i++)
			{
				var cntrl = rat.input.controllers.getByID(controllerIdList[i]);
				accumulateControllerInput(combinedControllerObj, cntrl);
				
			}
		}
		else if( rat.input.allowedControllers.length === 0 || rat.input.activeControllerID === 0 )
		{
			// if no list was passed in and all controllers are allowed, the list will still be empty, so handle that case
			for (var j = 0; j < rat.input.controllers.length; j++)
				accumulateControllerInput(combinedControllerObj, rat.input.controllers[j]);
		}
		
		normalizeStick( combinedControllerObj.leftStick );
		normalizeStick( combinedControllerObj.rightStick );

		return combinedControllerObj;
	};
	
	rat.input.getActiveControllerID = function ()
	{
		//	if no controllers, return null
		var controller = rat.input.getActiveController();

		if(!controller)
			return null;

		return controller.id;
	};

	//	Set the active controller ID
	rat.input.setActiveControllerID = function ( id )
	{
		id = id || 0;
		if (!id)
		{
			rat.console.log("Cleared active controller");
			rat.input.activeControllerID = id;
			return true;
		}
		else
		{
			for (var cIndex = 0; cIndex < rat.input.controllers.length; cIndex++)
			{
				if (rat.input.controllers[cIndex].id === id)
				{
					rat.console.log("Setting active controller to " + id);
					rat.input.activeControllerID = id;
					return true;
				}
			}
		}
		
		rat.console.log("WARNING! Attempting to set active controller ID for controller "+ id +" which cannot be found in the system" );
		rat.input.activeControllerID = 0;
		return false;
	};

	rat.input.getActiveControllerRawButtons = function ()
	{
		var buttons = 0;
		var controller = rat.input.getActiveController();
		if(controller)
			buttons = controller.rawButtons;
		return buttons;
	};

	//
	//	Get mouse position relative to context.
	//	This factors in browser differences...
	//http://answers.oreilly.com/topic/1929-how-to-use-the-canvas-and-draw-elements-in-html5/
	//http://developer.appcelerator.com/question/55121/html5-canvas-drawing-in-webview
	//
	rat.input.getRealMousePosition = function (e)
	{
		var pos = new rat.Vector();

		if(e.pageX || e.pageY)
		{
			pos.x = e.pageX;
			pos.y = e.pageY;
		}
		else
		{
			pos.x = e.clientX + document.body.scrollLeft +
					document.documentElement.scrollLeft;
			pos.y = e.clientY + document.body.scrollTop +
					document.documentElement.scrollTop;
		}
		pos.x -= rat.graphics.canvas.offsetLeft;
		pos.y -= rat.graphics.canvas.offsetTop;

		//	apply global translation
		if(rat.graphics.globalTranslate)
		{
			pos.x -= rat.graphics.globalTranslate.x;
			pos.y -= rat.graphics.globalTranslate.y;
		}

		//	apply global scale if there is one
		//	(this goes backwards because the user is moving in screen space and needs to be translated out to our virtual space)
		if (rat.graphics.hasGlobalScale())
		{
			pos.x /= rat.graphics.globalScale.x / rat.graphics.canvasPixelRatio;
			pos.y /= rat.graphics.globalScale.y / rat.graphics.canvasPixelRatio;
		}

		//	keep constant track of last known global (within context) mouse pos
		rat.mousePos.x = pos.x;
		rat.mousePos.y = pos.y;

		return pos;
	};

	//	see if this controller id is in our list of allowed controller ids
	rat.input.controllerIDAllowed = function (id)
	{
		if(rat.input.allowedControllers.length === 0)	//	no list means all allowed
			return true;

		for(var i = 0; i < rat.input.allowedControllers.length; i++)
		{
			if(rat.input.allowedControllers[i] === id)
				return true;
		}
		return false;
	};

	// check the current controllers to see if the ID matches any of them
	/**
	 * @param {?} id
	 * @suppress {missingProperties}
	 */
	rat.input.controllerIDValid = function (id)
	{
		// check gamepads
		var gamepads = window.Windows.Xbox.Input.Gamepad.gamepads;
		for(var i = 0; i < gamepads.size; i++)
		{
			var gamepad = gamepads[i];
			if(gamepad.id === id)
				return true;
		}

		// check other controllers??

		// didn't find any current controllers with this ID -> it must have disconnected!
		return false;
	};

	/// Get the which value from a system event object
	rat.input.getEventWhich = function (e)
	{
		if (rat.system.has.xbox )
		{
			//	Several keys on the xbox map to strange values.  We fix that mapping here.
			switch( e.which )
			{
				case 222: return 220;
				case 223: return 192;
				case 192: return 222;
			}
		}
		return e.which || 0;
	};

	/**
	 * Create a new rat event object
	 * @param {?} sysEvent
	 * @param {Object=} options
	 * @constructor
	 */
	rat.input.Event = function (sysEvent, options)
	{
		this.sysEvent = sysEvent;
		options = options || {};
		sysEvent = sysEvent || {};

		if (options.translatedFrom)
		{
			var savedSysEvent = options.translatedFrom.sysEvent;
			options.translatedFrom.sysEvent = void 0;
			rat.utils.extendObject(this, [options.translatedFrom], false);
			options.translatedFrom.sysEvent = savedSysEvent;

			this.translatedFrom = options.translatedFrom;

			//	Allow overwriting the which value
			if (options.which !== void 0)
				this.which = options.which;
		}

		//	Set this AFTER we extended so we can override anything we copied.
		this.eventType = options.type || '';

		if (this.controllerID === void 0)
			this.controllerID = sysEvent.deviceSessionId || sysEvent.controllerID || options.defaultControllerID || 0;
		if (this.index === void 0)
			this.index = options.index || 0;
		if (this.which === void 0)
		{
			this.which = options.which;
			if (this.which === void 0)
				this.which = rat.input.getEventWhich( sysEvent );
		}
		if (this.repeat === void 0)
			this.repeat = options.repeat || false;
		
		//	for debugging(?), track unique event ID
		this.eventID = rat.input.Event.nextID++;
	};
	rat.input.Event.nextID = 1;


	//	if this controller's inputs suggest it, then dispatch events
	rat.input.checkAndDispatchControllerEvents = function (controller, dt)
	{
		//	Here is the place to NOT dispatch events for non-allowed controllers
		if(!rat.input.controllerIDAllowed(controller.id))
			return;

		var ratEvent = void 0;
		//	Type and which are set later
		var btnFlag;
		var btnStr;
		var fullStr = "00000000";
		var bIndex;

		//	If any are newly pressed or released, re-set the repeat timer.
		if (controller.rawButtons !== controller.lastButtons || controller.rawButtons === 0)
			controller.repeatTimer.fullReset();
		else
			controller.repeatTimer.elapsed(dt);

		//	Fire all the new button events
		if(controller.newButtons)
		{
			for(bIndex = 0; bIndex < rat.input.BUTTON_COUNT; bIndex++)
			{
				btnFlag = (1 << bIndex);
				if((controller.newButtons & btnFlag) !== 0)
				{
					btnStr = btnFlag.toString(16);
					btnStr = fullStr.substr(fullStr.length - btnStr.length - 1) + btnStr;

					//	Create the first time only.
					ratEvent = ratEvent || new rat.input.Event({ controllerID: controller.id }, { index: controller.index });

					//	Fire the appropriate event.
					ratEvent.eventType = 'buttondown';
					ratEvent.which = btnFlag;
					//rat.console.log("Firing " + ratEvent.eventType + " for btn 0x" + btnStr);
					rat.input.dispatchEvent(ratEvent);
				}
			}
		}

		//	Find out which buttons just got released by comparing raw with last
		var isDown, wasDown;
		if(controller.rawButtons !== controller.lastButtons)
		{
			for(bIndex = 0; bIndex < rat.input.BUTTON_COUNT; bIndex++)
			{
				btnFlag = (1 << bIndex);
				isDown = (controller.rawButtons & btnFlag) !== 0;
				wasDown = (controller.lastButtons & btnFlag) !== 0;
				if(wasDown === true && isDown === false)
				{
					//btnStr = btnFlag.toString(16);
					//btnStr = fullStr.substr(fullStr.length - btnStr.length - 1) + btnStr;

					//	Create the first time only.
					ratEvent = ratEvent || new rat.input.Event({ controllerID: controller.id }, { index: controller.index });

					//	Fire the appropriate event.
					ratEvent.eventType = 'buttonup';
					ratEvent.which = btnFlag;
					//rat.console.log("Firing " + ratEvent.eventType + " for btn " + btnFlag.toString(16));
					rat.input.dispatchEvent(ratEvent);
				}
			}
		}


		//	Now trigger repeat events if the timers allow it
		var repeatButtons = controller.repeatTimer.buttons <= 0 && rat.input.allowRepeatEvents.buttons;
		var repeatDirections = controller.repeatTimer.directions <= 0 && rat.input.allowRepeatEvents.directions;
		if (repeatButtons || repeatDirections)
		{
			var ops = {};
			if (repeatButtons)
				ops.buttons = true;
			if (repeatDirections)
				ops.directions = true;
			controller.repeatTimer.repeatReset(ops);

			if (ratEvent)
				ratEvent.repeat = true;
			for (bIndex = 0; bIndex < rat.input.BUTTON_COUNT; bIndex++)
			{
				btnFlag = (1 << bIndex);
				isDown = (controller.rawButtons & btnFlag) !== 0;
				if (!isDown)
					continue;
				var isDirection = (btnFlag & (rat.input.BUTTON_UP | rat.input.BUTTON_DOWN | rat.input.BUTTON_LEFT | rat.input.BUTTON_RIGHT)) !== 0;
				if ((isDirection && !repeatDirections) ||
					(!isDirection && !repeatButtons))
					continue;

				//	Create the first time only.
				if (!ratEvent)
				{
					ratEvent = new rat.input.Event({ controllerID: controller.id }, { index: controller.index });
					ratEvent.repeat = true;
				}

				ratEvent.eventType = 'buttondown';
				ratEvent.which = btnFlag;
				rat.input.dispatchEvent(ratEvent);
			}
		}
	};

	//	People who want to handle events from rat
	var eventHandlers = [];
	
	//	Add a new event handler
	/** @param {Object=} thisObj */
	rat.input.registerEventHandler = function (func, thisObj)
	{
		if (func)
			eventHandlers.push({ func: func, thisObj: thisObj });
	};

	//	Remove an event handler
	/** @param {Object=} thisObj */
	rat.input.unRegisterEventHandler = function (func, thisObj)
	{
		if (func)
		{
			for (var index = 0; index !== eventHandlers.length; ++index)
			{
				if (eventHandlers[index].func === func && eventHandlers[index].thisObj === thisObj)
				{
					eventHandlers.splice(index, 1);
					return;
				}
			}
		}
	};

	//	Dispatch this event to screen manager or anyone else registered as an eventhandler.
	//	(see screemanager class)
	//	Try sending event.  If it's not handled, translate to UI event and try again.
	//	(this is the main job of this function).
	// PMM: for good measure I added checks so we can let the caller know if the event was consumed by this dispatch
	rat.input.dispatchEvent = function (ratEvent)
	{
		//	First pass.  Let everyone try to handle the raw event
		var handler;
		var gotHandledFALSE = false;
		for (var index = -1; index !== eventHandlers.length; ++index)
		{
			if (index === -1)
			{
				if (rat.console.state.consoleAllowed)
					handler = { func: rat.console.handleEvent };
				else
					continue;
			}
			else
				handler = eventHandlers[index];

			//	If it is handled, abort.
			var handled = handler.func.call(handler.thisObj, ratEvent);
			if (handled)
				return true;
			else if(handled !== void 0)
				gotHandledFALSE = true;
		}

		//	If it wasn't handled yet, see if this can be interpreted as UI input,
		//  and if so, try again (dispatch again)
		if (ratEvent.eventType !== "ui")
		{
			var uiEvent = rat.input.translateToUIEvent(ratEvent);
			if (uiEvent)
				return rat.input.dispatchEvent(uiEvent);
		}

		//	This has to do with if we want to prevent default browser event handling
		//	See comments at the top of the file, and handlePreventDefault
		if( gotHandledFALSE)
			return false;
		else
			return void 0;
	};

	//	process this key event and make sure event.which has the key code in it, regardless of browser.
	//	TODO:  Is it OK to modify the system event like this?  Instead move this value to rat event,
	//		which already is set up to have a copy of "which"
	rat.input.standardizeKeyEvent = function (event)
	{
		//	see http://unixpapa.com/js/key.html which seems to be definitive
		//	and http://stackoverflow.com/questions/7542358/actual-key-assigned-to-javascript-keycode
		//	and http://stackoverflow.com/questions/4471582/javascript-keycode-vs-which among others

		if(event.which === null)
		{
			if(event.charCode)
				event.which = event.charCode;
			else if(event.keyCode)
				event.which = event.keyCode;
			else
				event.which = 0;	//	special key of some kind... ignore - could be shift/control key, for instance, for a keypress
		}
		//else {
		//	event.which is OK
		//}
	};

	//	give me a character code from this event
	//	(useful instead of hard-coded key codes)
	//	also note:  use keypress when you can, since it works better with non-US keyboards
	//	assumes standardizeKeyEvent has been called, or event.which is otherwise valid
	rat.input.charCodeFromEvent = function (event)
	{
		return String.fromCharCode(event.which).toLowerCase();
	};

	/**
	 * Convert a mouse event to a rat mouse event
	 * @param {?} e systemEventObject
	 * @param {string} eventType
	 * @param {boolean=} isFromTouch  Is this a touch event.
	 * @suppress {missingProperties} 
	 */
	rat.input.mouseToRatEvent = function (e, eventType, isFromTouch)
	{
		isFromTouch = isFromTouch || false;
		var pos = rat.getRealMousePosition(e);
		rat.graphics.cursorPos.x = pos.x;
		rat.graphics.cursorPos.y = pos.y;

		//	set up a rat event, with system event attached.
		//	This is a cleaner approach than tacking my own variables on to
		//	a system event, which really ought to be read-only.
		var ratEvent = new rat.input.Event(e, { type: eventType, defaultControllerID: 'mouse' });
		ratEvent.pos = pos;
		ratEvent.isFromTouch = isFromTouch;//	remember if this was translated from touch
		//	pointerID distinguishes between multiple touches (fingers) or from devices.
		if (e.pointerId !== void 0)
			ratEvent.pointerID = e.pointerId;
		else
			ratEvent.pointerID = -1;

		//	handle touch radius stuff...
		if(isFromTouch)
		{
			// units are not documented...  Let's say they're pixels
			//	pick a decent default for finger size.
			//	This is totally kludged.  Should be based on tons of things, like pixel density on device...
			var defRadius = 12;
			//	factor in UI scale
			if(rat.graphics.hasGlobalScale())
				defRadius /= rat.graphics.globalScale.x / rat.graphics.canvasPixelRatio;

			var rx = e.webkitRadiusX;
			if(!rx || rx === 1)	//	this is not very useful
				rx = defRadius;
			ratEvent.touchRadiusX = rx;
			var ry = e.webkitRadiusY;
			if(!ry || ry === 1)	//	this is not very useful
				ry = defRadius;
			ratEvent.touchRadiusY = ry;
		}

		var handled = false;
		//	check for custom global mouse handler (See setMouseHandler above)
		if(rat.input.mouseHandler)
		{
			handled = rat.input.mouseHandler(ratEvent);
		}

		if (!handled)
			handled = rat.input.dispatchEvent(ratEvent);
		
		//	in order to pass back both the "handled" concept AND the event,
		//	let's put handled status in the event and return the event.
		//	we might also later want that "handled" to be in there anyway, later.
		ratEvent.handled = handled;
		return ratEvent;
	};

	//	my built-in event handling functions
	rat.input.onMouseMove = function (e)
	{
		//	this is a little bit of a kludge.
		//	TODO:  Figure this out.  But I already spent hours on it...
		//	In Win 8, we get mouse move events on the whole screen even when app bar is active.
		//		but we don't get mouse up/down, which ends up looking pretty broken (buttons highlight but don't click)
		//		and it causes other problems.
		//		So, support explicit appbar check here...
		//	What would be a lot better would be to GET the dang down/up events for space outside the appbar div itself,
		//	but I can't figure out how to get those events.  They just get eaten by the system.  :(
		//	TODO:  Look at WinJS code?  For whatever reason, it must be calling preventDefault, or otherwise not passing on that event,
		//		but why it does it for up/down and not for move, I have no idea.
		if (rat.input.appBar && !rat.input.appBar.hidden)
			return;

		//  track what was last used.  Note:  This could instead be set when the user clicks on a UI element,
		//  instead of any mouse motion?  But probably any mouse movement right now means don't be assuming keyboard UI.
		//  see useLastUIInputType
		rat.input.lastUIInputType = 'mouse';
		var isTouch = e.pointerType === "touch" || e.pointerType === 0x00000002 || e.pointerType === 0x00000003;
		var ratEvent = rat.input.mouseToRatEvent(e, 'mousemove', isTouch);
		
		rat.input.handlePreventDefault(ratEvent, ratEvent.handled);
	};
	rat.input.onMouseDown = function (e)
	{
		if (rat.input.appBar && !rat.input.appBar.hidden)
			return;
		
		//	sad, but if we're targetting kong, need to try to maintain focus on every click.
		if (rat.system.kong)
			rat.system.kong.focus();
		
		var isTouch = e.pointerType === "touch" || e.pointerType === 0x00000002 || e.pointerType === 0x00000003;
		var ratEvent = rat.input.mouseToRatEvent(e, 'mousedown', isTouch);
		rat.input.handlePreventDefault(ratEvent, ratEvent.handled);
	};
	rat.input.onMouseUp = function (e)
	{
		if (rat.input.appBar && !rat.input.appBar.hidden)
			return;
		var isTouch = e.pointerType === "touch" || e.pointerType === 0x00000002 || e.pointerType === 0x00000003;
		var ratEvent = rat.input.mouseToRatEvent(e, 'mouseup', isTouch);
		rat.input.handlePreventDefault(ratEvent, ratEvent.handled);
	};

	rat.input.onMouseWheel = function (e)
	{
		var event = window.event || e; // old IE support

		//	calculate a number of clicks.
		//	See http://www.javascriptkit.com/javatutors/onmousewheel.shtml among other descriptions of how this works.
		//	This has changed over time.  Various browsers return various scales and values.
		//	This could use some more research.  Find out what the latest standard is (maybe "wheel"?)
		//	and use that.  Note that even then, the values returned are inconsistent...
		//	chrome returns in "wheelDelta" 120 per click, +120 being up
		//	We normalize to 1 per click, and we treat +1 as "up")
		//
		var delta = 0;
		if (event.wheelDelta)
			delta = event.wheelDelta / (120);
		else if (event.deltaY)
			delta = -event.deltaY/3;
		else if (event.detail !== void 0)
			delta = -event.detail;
		else
			delta = 0;

		//console.log("delta " + delta + "(" + event.wheelDelta + ")");

		var ratEvent = new rat.input.Event(e, { type: 'mousewheel', defaultControllerID: 'mouse' });
		ratEvent.wheelDelta = delta;
		//	we want wheel events to get handled based on visual target,
		//	e.g. what user is hovering over.
		//	wheel events (at least in chrome) don't have a pos.
		//	so, use whatever we know!
		ratEvent.pos = {x:rat.mousePos.x, y:rat.mousePos.y};
		rat.input.dispatchEvent(ratEvent);
	};

	rat.input.onKeyPress = function (e)
	{
		e.char = e.char || String.fromCharCode(e.keyCode || e.charCode);
		if (!e.char)
			return;
		var ratEvent = new rat.input.Event(e, { type: 'keypress', defaultControllerID: 'keyboard' });
		var handled = rat.input.dispatchEvent(ratEvent);

		rat.input.handlePreventDefault(ratEvent, handled);
	};

	rat.input.onKeyDown = function (e)
	{
		// console.log("key down " + e.which);
		// update keyboard info if applicable
		rat.input.keyboard.handleKeyDown(e);			//	track keyboard state
		var ratEvent = new rat.input.Event(e, { type: 'keydown', defaultControllerID: 'keyboard' });
		var handled = rat.input.dispatchEvent(ratEvent);

		// update key presses for gamepad info if applicable
		if (!useLEGamepadAPI)
		{
			if (e.deviceSessionId && rat.system.has.xboxLE)
			{
				var ourController = rat.input.getControllerInfo(e.deviceSessionId);
				if(ourController)
					rat.input.handleGamepadDownEvent(ratEvent, ourController);
			}
		}

		rat.input.handlePreventDefault(ratEvent, handled);
	};

	rat.input.onKeyUp = function (e)
	{
		// console.log("key up " + e.which);
		rat.input.keyboard.handleKeyUp(e);
		var ratEvent = new rat.input.Event(e, { type: 'keyup', defaultControllerID: 'keyboard' });
		var handled = rat.input.dispatchEvent(ratEvent);

		if (!useLEGamepadAPI)
		{
			//update key presses for gamepad info if applicable	NOTE: we may want to check to see if dispatched used the event, otherwise we risk doing 2 events.
			if (e.deviceSessionId && rat.system.has.xboxLE)
			{
				var ourController = rat.input.getControllerInfo(e.deviceSessionId);
				if(ourController)
					rat.input.handleGamepadUpEvent(ratEvent, ourController);
			}
		}
		
		rat.input.handlePreventDefault(ratEvent, handled);
	};
	
	//	context menu (e.g. right-click) event handling
	rat.input.onContextMenu = function (e)
	{
		//	sad, but if we're targetting kong, need to try to maintain focus on every click.
		//if (rat.system.kong)
		//	rat.system.kong.focus();
		
		//	TODO: figure out how to trigger context menu on long-press?  Is that a whole separate thing?
		//var isTouch = e.pointerType === "touch" || e.pointerType === 0x00000002 || e.pointerType === 0x00000003;
		var isTouch = false;
		var ratEvent = rat.input.mouseToRatEvent(e, 'contextmenu', isTouch);
		rat.input.handlePreventDefault(ratEvent, ratEvent.handled);
	};

	// given a sessionId on a 'keyboard' device, find which controller the sessionID belongs to and then get our rat representation of that controllers inputs
	/** @suppress {checkTypes} */
	rat.input.getControllerInfo = function (sessionId)
	{
		var controller;
		if(rat.system.has.xbox)
		{				// I believe that this only gets called via XBO anyways, but this is precautionary just in case
			try
			{
				var inputManager = window.Windows.Xbox.Input.ControllerInputManager();
				controller = inputManager.getControllerFromIndex(sessionId);
			}
			catch(err)
			{
				rat.console.log("r_input err'd: " + err.message);
			}
		}
		else if(rat.system.has.xboxLE)
		{
			
			// when in an LE we dont get user specific controllers, so make a controller up
			controller = { id: 0xDEADBEEF + sessionId, user: {} };
		}

		if(!controller)
			return null;

		//	find associated controller we're tracking.
		var ourControllerIndex = -1;
		for(var ecIndex = 0; ecIndex < rat.input.controllers.length; ecIndex++)
		{
			if(rat.input.controllers[ecIndex].id === controller.id)
			{
				ourControllerIndex = ecIndex;
				break;
			}
		}
		if(ourControllerIndex < 0)	//	not found - add to list
		{
			// Xbox LE specific code, probably want to rename it so it is less specific?
			var newController = rat.input.buildRatControllerObject("xle", { type: 'gamepad', id: controller.id, user: controller.user, rawButtons: 0, newButtons: 0, lastButtons: 0 });
			rat.input.controllers.push(newController);
			ourControllerIndex = rat.input.controllers.length - 1;
		}
		var ourController = rat.input.controllers[ourControllerIndex];

		return ourController;
	};

	// when continuing a series of gameloads we may want to force the controllers to be the same IDs and indicies they were the last time we loaded the game
	// making a version specific to XBO LE's for now
	// TODO: Fix to work with all game types
	rat.input.setControllerInfoByIndex = function (controllerId, index)
	{
		if(rat.system.has.xboxLE)
		{
			if(typeof controllerId === typeof "")
				controllerId = parseInt(controllerId);
			var newController = rat.input.buildRatControllerObject("xle", { type: 'gamepad', id: controllerId, user: {}, rawButtons: 0, newButtons: 0, lastButtons: 0 });
			rat.input.controllers[index] = newController;
		}
	};
	
	// given a sessionId on a 'keyboard' device, find which controller the sessionID belongs to and then get our rat representation of that controllers inputs
	rat.input.clearAllControllerButtons = function ()
	{
		//rat.input.controllers.push({ type: 'gamepad', id: controller.id, user: controller.user, rawButtons: 0, newButtons: 0, lastButtons: 0 });
		var controller;
		for(var ecIndex = 0; ecIndex < rat.input.controllers.length; ecIndex++)
		{
			controller = rat.input.controllers[ecIndex];
			controller.rawButtons = 0;
			controller.newButtons = 0;
			controller.lastButtons = 0;
			controller.repeatTimer.fullReset();
		}
	};

	// got a keyboard down event from the event system, but it's for a gamepad!
	rat.input.handleGamepadDownEvent = function (ratEvent, controller)
	{
		var ratInput = rat.input.translateKeyToInput(ratEvent.which);
		if(ratInput)
		{
			var isDirection = (ratInput & (rat.input.BUTTON_UP | rat.input.BUTTON_DOWN | rat.input.BUTTON_LEFT | rat.input.BUTTON_RIGHT)) !== 0;
			var repeatAllowed = isDirection ? rat.input.allowRepeatEvents.directions : rat.input.allowRepeatEvents.buttons;

			// if its not a repeated event, or we allow repeat events, then set the button in newButtons again
			if (repeatAllowed || !(controller.rawButtons & ratInput))
				controller.newButtons = ratInput;
			else
				controller.newButtons = 0;

			controller.rawButtons |= ratInput;
			controller.repeatTimer.fullReset();
			
			// if (isDirection)
			// {
				// var u = ((controller.rawButtons & rat.input.BUTTON_LSTICK_UP) !== 0) ? 1 : 0;
				// var d = ((controller.rawButtons & rat.input.BUTTON_LSTICK_DOWN) !== 0) ? 1 : 0;
				// var l = ((controller.rawButtons & rat.input.BUTTON_LSTICK_LEFT) !== 0) ? 1 : 0;
				// var r = ((controller.rawButtons & rat.input.BUTTON_LSTICK_RIGHT) !== 0) ? 1 : 0;
				// var report = "LS: " + r + u + l + d;
				// u = ((controller.rawButtons & rat.input.BUTTON_RSTICK_UP) !== 0) ? 1 : 0;
				// d = ((controller.rawButtons & rat.input.BUTTON_RSTICK_DOWN) !== 0) ? 1 : 0;
				// l = ((controller.rawButtons & rat.input.BUTTON_RSTICK_LEFT) !== 0) ? 1 : 0;
				// r = ((controller.rawButtons & rat.input.BUTTON_RSTICK_RIGHT) !== 0) ? 1 : 0;
				// report += "  RS: " + r + u + l + d;
				// u = ((controller.rawButtons & rat.input.BUTTON_DPAD_UP) !== 0) ? 1 : 0;
				// d = ((controller.rawButtons & rat.input.BUTTON_DPAD_DOWN) !== 0) ? 1 : 0;
				// l = ((controller.rawButtons & rat.input.BUTTON_DPAD_LEFT) !== 0) ? 1 : 0;
				// r = ((controller.rawButtons & rat.input.BUTTON_DPAD_RIGHT) !== 0) ? 1 : 0;
				// report += "  DP: " + r + u + l + d;
				// rat.console.log( report );
			// }
		}
		if(ratInput)
			rat.input.checkAndDispatchControllerEvents(controller, 0);
	};
	// got a keyboard up event from the events system, but its for a gamepad!
	rat.input.handleGamepadUpEvent = function (ratEvent, controller)
	{
		var ratInput = rat.input.translateKeyToInput(ratEvent.which);
		if(ratInput)
		{
			controller.rawButtons &= ~ratInput;
			controller.newButtons = 0;
			controller.repeatTimer.fullReset();
		}
		// we don't need to dispatch button ups do we? (yet)
		//if (ratInput)
		//	rat.input.checkAndDispatchControllerEvents(controller, 0);
	};

	// On devices which do not set a position for touch events, copy over the touch position.
	rat.input.setTouchPositionOnEvent = function (touch, e)
	{
		// TODO: See how this works on Windows 8
		var newE = rat.utils.copyObject(e);
		//	if there's ever a specific pageX and pageY for the individual touch, use that.
		//	This is important for events with multiple touchChanges, in which case we must get
		//	the unique position values from there!
		//	If there's no such value, leave the pageX pageY values we had.
		if (touch.pageX !== void 0 || touch.pageY !== void 0)
		//if(!e.clientX && e.pageX === 0 && e.pageY === 0 && (touch.pageX !== 0 || touch.pageY !== 0))
		{
			newE.pageX = touch.pageX;
			newE.pageY = touch.pageY;
		}
		if (touch.identifier !== void 0)
			newE.pointerId = touch.identifier;
		else if (e.pointerId !== void 0)
			newE.pointerId = e.pointerId;
		return newE;
	};

	/* jshint -W082 */ //	Allow this function in a conditional
	function handleTouch(e)
	{
		var transEvent = 'mousedown';

		if (e.type === 'touchmove') transEvent = 'mousemove';
		else if (e.type === 'touchstart') transEvent = 'mousedown';
		else if (e.type === 'touchend') transEvent = 'mouseup';
		
		//var line = "" + e.type + " frame " + rat.graphics.frameIndex + ": ";
		var handled = false;
		for (var i = 0; i !== e.changedTouches.length; ++i)
		{
			var touch = e.changedTouches[i];
			var newE = rat.input.setTouchPositionOnEvent(touch, e);
			var ratEvent = rat.input.mouseToRatEvent(newE, transEvent, true);
			handled = handled || ratEvent.handled;	//	did *anyone* handle this?
			//line += "   " + touch.identifier + "(" + (touch.pageX|0) + "," + (touch.pageY|0) + ")";
		}
		var fakeRatEvent = {sysEvent: e};
		rat.input.handlePreventDefault(fakeRatEvent, handled);
		//console.log(line);
	}

	//	automatically hook up a bunch of standard UI handling functions to events.
	rat.input.autoHandleEvents = function ()
	{
		//	keys
		rat.addOSKeyEventListener(window, 'keydown', rat.input.onKeyDown, false);
		rat.addOSKeyEventListener(window, 'keyup', rat.input.onKeyUp, false);
		rat.addOSKeyEventListener(window, 'keypress', rat.input.onKeyPress, false);
		
		//	handle pointer/mouse events, including multi-touch
		
		//	This solution is extensively tested now in Chrome, IE10+, and Windows 8 Host.
		//	Don't rewrite this without retesting those!
		
		//	If the navigator says it's going to give us MSPointer events, fine, listen to those.
		//	Those will come for mouse and touch and pen.
		//	This is the case for IE10+ and for Windows 8 host
		//	TODO:  IE11 changes these to "pointermove", etc., and threatens to take the old names away.
		if (navigator.msPointerEnabled || typeof (Windows) !== 'undefined')
		{
			//console.log("listening for MS Pointer");
			
			// MS specific pointer stuff
			rat.addOSEventListener(window, 'MSPointerMove', rat.input.onMouseMove, false);
			rat.addOSEventListener(window, 'MSPointerDown', rat.input.onMouseDown, false);
			rat.addOSEventListener(window, 'MSPointerUp', rat.input.onMouseUp, false);
		}
		else	//	otherwise, listen explicitly for mouse events, and touch separately
		{
			//console.log("listening for mouse");
			
			//	listen for mouse
			rat.addOSEventListener(window, 'mousemove', rat.input.onMouseMove, false);
			rat.addOSEventListener(window, 'mousedown', rat.input.onMouseDown, false);
			rat.addOSEventListener(window, 'mouseup', rat.input.onMouseUp, false);
			
			rat.addOSEventListener(window, 'contextmenu', rat.input.onContextMenu, false);
		
			//	listen for touch
			
			//	Under wraith, document.body does not exist.  In addition, we don't need the touch events
			//	As wraith will fire them as mousemoves.
			if (document.body)	
			{
				//console.log("listening for touches");
				
				document.body.addEventListener('touchmove', handleTouch, false);
				document.body.addEventListener('touchstart', handleTouch, false);
				document.body.addEventListener('touchend', handleTouch, false);
				
				/*	OLD duplicated code which was hard to work with.
					remove when the above has been tested.
				document.body.addEventListener('touchmove', function (e)
				{
					e.preventDefault();
					var line = "tm frame " + rat.graphics.frameIndex + ": ";
					for (var i = 0; i !== e.changedTouches.length; ++i)
					{
						var touch = e.changedTouches[i];
						//	just pass on to mouse handler
						e = rat.input.setTouchPositionOnEvent(touch, e);
						var ratEvent = rat.input.mouseToRatEvent(e, 'mousemove', true);
						
						line += "   " + touch.identifier + "(" + (touch.pageX|0) + "," + (touch.pageY|0) + ")";
					}
					console.log(line);
				}, false);
				document.body.addEventListener('touchstart', function (e)
				{
					e.preventDefault();
					var line = "ts frame " + rat.graphics.frameIndex + ": ";
					for (var i = 0; i !== e.changedTouches.length; ++i)
					{
						var touch = e.changedTouches[i];
						e = rat.input.setTouchPositionOnEvent(touch, e);
						var ratEvent = rat.input.mouseToRatEvent(e, 'mousedown', true);
						
						line += "   " + touch.identifier + "(" + (touch.pageX|0) + "," + (touch.pageY|0) + ")";
					}
					console.log(line);
				}, false);
				document.body.addEventListener('touchend', function (e)
				{
					e.preventDefault();
					var line = "te frame " + rat.graphics.frameIndex + ": ";
					for (var i = 0; i !== e.changedTouches.length; ++i)
					{
						var touch = e.changedTouches[i];
						e = rat.input.setTouchPositionOnEvent(touch, e);
						var ratEvent = rat.input.mouseToRatEvent(e, 'mouseup', true);
						
						line += "   " + touch.identifier + "(" + (touch.pageX|0) + "," + (touch.pageY|0) + ")";
					}
					console.log(line);
				}, false);
				*/
			}
		}
		
		/*
		//	suppress drag?  Not working...
		// do nothing in the event handler except canceling the event
		rat.graphics.canvas.ondragstart = function(e) {
			if (e && e.preventDefault) { e.preventDefault(); }
			if (e && e.stopPropagation) { e.stopPropagation(); }
			return false;
		}

		// do nothing in the event handler except canceling the event
		rat.graphics.canvas.onselectstart = function(e) {
			if (e && e.preventDefault) { e.preventDefault(); }
			if (e && e.stopPropagation) { e.stopPropagation(); }
			return false;
		}
		*/

		//	mouse wheel
		
		//	firefox support (see https://developer.mozilla.org/en-US/docs/Web/Events/wheel)
		if (rat.system.has.firefoxBrowser)
		{
			//rat.addOSEventListener(window, 'DOMMouseScroll', rat.input.onMouseWheel, false);
			rat.addOSEventListener(window, 'wheel', rat.input.onMouseWheel, false);
		} else {
			rat.addOSEventListener(window, 'mousewheel', rat.input.onMouseWheel, false);
		}
	};

	rat.input.translateGamePadKeys = void 0;

	/**
	 * return ui event if successful translation.
	 * otherwise, return null
	 * @suppress {missingProperties} - This is needed to avoid warnings baout k.* variables
	 */
	//	util to translate key to ui event
	function translateKeyToUI(which)
	{
		
		//	support any custom translations that were set up.
		//	Do these first so an app can completely override default stuff if needed.
		//	TODO:  Hmm... these are just keyboard.  So, either name this appropriately,
		//		or add a "type" field to the structure below (maybe assume keyboard if not specified)
		/*
		How to use this:  for now, just set it directly in your app.  Something like this:
			rat.input.customUIEventTranslations = [
				{which: rat.keys.w, result: 'up'},
				{which: rat.keys.a, result: 'left'},
				{which: rat.keys.s, result: 'down'},
				{which: rat.keys.d, result: 'right'},
				{which: rat.keys.space, result: 'enter'},
			];
		*/
		if (rat.input.customUIEventTranslations)
		{
			for (var i = 0; i < rat.input.customUIEventTranslations.length; i++)
			{
				var trans = rat.input.customUIEventTranslations[i];
				if (which === trans.which)
					return trans.result;
			}
		}

		//	TODO: rename these to rat.input.uiLeft or something...
		if(which === rat.keys.leftArrow) return 'left';
		if(which === rat.keys.upArrow) return 'up';
		if(which === rat.keys.rightArrow) return 'right';
		if(which === rat.keys.downArrow) return 'down';
		if(which === rat.keys.enter) return 'enter';
		if(which === rat.keys.esc || which === rat.keys.backspace) return 'back';
		if (which === rat.keys.leftSys || which === rat.keys.rightSys) return 'menu';
		if (which === rat.keys.selectKey) return 'view';

		//	I prefer "enter" to "select" because select sometimes means "highlight".  "act" or "press" or something would also be OK.

		if(rat.system.has.xbox && rat.input.translateGamePadKeys)	//	only translate these if we were asked to
		{
			var k = window.WinJS.Utilities.Key;
			if(which === k.gamepadDPadLeft || which === k.gamepadLeftThumbstickLeft) return 'left';
			if(which === k.gamepadDPadUp || which === k.gamepadLeftThumbstickUp) return 'up';
			if(which === k.gamepadDPadRight || which === k.gamepadLeftThumbstickRight) return 'right';
			if(which === k.gamepadDPadDown || which === k.gamepadLeftThumbstickDown) return 'down';
			if(which === k.gamepadA) return 'enter';
			if(which === k.gamepadB) return 'back';
		}
		
		return null;
	}
	//	util to translate controller button to ui event
	function translateButtonToUI(which)
	{
		if(which === rat.input.BUTTON_LEFT) return 'left';
		if(which === rat.input.BUTTON_UP) return 'up';
		if(which === rat.input.BUTTON_RIGHT) return 'right';
		if(which === rat.input.BUTTON_DOWN) return 'down';
		if(which === rat.input.BUTTON_A) return 'enter';
		if(which === rat.input.BUTTON_B) return 'back';
		if(which === rat.input.BUTTON_START) return 'menu';
		if(which === rat.input.BUTTON_SELECT) return 'view';
		//	I prefer "enter" to "select" because select sometimes means "highlight".  "act" or "press" or something would also be OK.

		return null;
	}

	function translateVoiceToUI(which)
	{
		if (which === rat.voice.commands.Back)
			return 'back';
		else if (which === rat.voice.commands.Menu)
			return 'menu';
		else if (which === rat.voice.commands.view)
			return 'view';
		else
			return null;
	}
	rat.input.translateToUIEvent = function (ratEvent)
	{
		var uiEventCode = 0;
		if (ratEvent.eventType === 'keydown')
		{
			uiEventCode = translateKeyToUI(ratEvent.which);
			if (uiEventCode)
				rat.input.lastUIInputType = 'keyboard';
		}
		else if (ratEvent.eventType === 'buttondown')
		{
			uiEventCode = translateButtonToUI(ratEvent.which);
			if (uiEventCode)
				rat.input.lastUIInputType = 'controller';
		}
		else if (ratEvent.eventType === 'voice')
		{
			uiEventCode = translateVoiceToUI(ratEvent.which);
			if (uiEventCode)
				rat.input.lastUIInputType = 'voice';
		}
		if (uiEventCode) {
			return new rat.input.Event(ratEvent.sysEvent, {translatedFrom: ratEvent, type: 'ui', which: uiEventCode});
		}
		return null;
	};

	//
	//	Get the "direction" to "go" based on the stick and dpad values
	rat.input.getControllerDirection = function( controller )
	{
		var pos = {
			x: 0,
			y: 0
		};
		
		if( controller )
		{
			if( controller.rawButtons & rat.input.BUTTON_LEFT )
				pos.x -= 1;
			else if( controller.rawButtons & rat.input.BUTTON_RIGHT )
				pos.x += 1;
			else
				pos.x += controller.leftStick.x;
			if( controller.rawButtons & rat.input.BUTTON_UP )
				pos.y -= 1;
			else if( controller.rawButtons & rat.input.BUTTON_DOWN )
				pos.y += 1;
			else
				pos.y += controller.leftStick.y;
		}
		return pos;
	};
	
	//
	//	Given a key code, translate to direction vector
	//	if key is NOT a direction, return null,
	//	so it's also easy to just use this to test whether it's an arrow key.
	rat.input.keyToDirection = function (keyCode)
	{
		if (keyCode === rat.keys.leftArrow)
			return {x:-1, y:0};
		else if (keyCode === rat.keys.rightArrow)
			return {x:1, y:0};
		else if (keyCode === rat.keys.upArrow)
			return {x:0, y:-1};
		else if (keyCode === rat.keys.downArrow)
			return {x:0, y:1};
		return null;
	};

	/**
	 * Helper function to detect if a button is currently being pressed.
	 * Based on https://developer.mozilla.org/en-US/docs/Web/Guide/API/Gamepad#Using_button_information
	 * @param {?} button In the current web Gamepad API as of Jun 14, 2014 12:26:10 AM, it is an object with the properties pressed and value.
	 * 			  It used to be a number value, so the type check is for browser compatability.
	 * @return {number}
	 */
	rat.input.getButtonValue = function(button)
	{
		if(typeof(button) === "object")
			return button.value;
		return button;
	};

	/**
	 * Build a rat controller object from a system controller object
	 * @param {string} fromSystem - like "xbox" or "gamepadAPI"
	 * @param {?} obj system controller object
	 * @return {rat.input.Controller}
	 * @suppress {missingProperties}
	 */
	rat.input.buildRatControllerObject = function (fromSystem, obj)
	{
		var rInput = rat.input;

		// Rat controller object format
		//{
		//	id: id unique to this controller,
		//	index: index of this controller.  Unique to the currently active controllers
		//	connected: {boolean} is this controller connected
		//	timestamp: obj.timestamp, Last updated when
		//	rawButtons: 0, Flagset of rat button flags for what button is currently down
		//	leftStick: {x:0, y:0}, raw values of the left stick
		//	rightStick: {x:0, y:0}, raw values of the right stick
		//	leftTrigger: 0, raw value of the left trigger
		//	rightTrigger: 0, raw value of the right trigger
		//  newButtons: built by rat after the conversion
		//  lastButtons: built by rat after the conversion
		//}
		var mapping;
		var rButtons = rat.input;
		var ratObj;
		switch(fromSystem)
		{
			// Mapping from gamepadAPI
			case "gamepadAPI":
				var axes = obj.axes;
				var buttons = obj.buttons;

				//	Build a unified value array where the axes are -1 -> -len
				var full = buttons.concat();
				for(var axesIndex = 0; axesIndex < axes.length; axesIndex++)
				{
					full[-(axesIndex + 1)] = axes[axesIndex];
				}

				// Axis/button mapping came from here
				// http://www.html5rocks.com/en/tutorials/doodles/gamepad/
				mapping = rInput.GAMEPAD_CONTROLLER_MAPPING;
				//	if obj.connected is undefined, assume it to be true.
				if(obj.connected === void 0)
					obj.connected = true;
				ratObj = new rInput.Controller(obj, obj.id, obj.index, obj.connected, obj.timestamp);
				ratObj.rawButtons =
					(rat.input.getButtonValue(full[mapping.BUTTON_A]) ? rButtons.BUTTON_A : 0) |
					(rat.input.getButtonValue(full[mapping.BUTTON_B]) ? rButtons.BUTTON_B : 0) |
					(rat.input.getButtonValue(full[mapping.BUTTON_C]) ? rButtons.BUTTON_C : 0) |
					(rat.input.getButtonValue(full[mapping.BUTTON_D]) ? rButtons.BUTTON_D : 0) |
					(rat.input.getButtonValue(full[mapping.BUTTON_LB]) ? rButtons.BUTTON_LB : 0) |
					(rat.input.getButtonValue(full[mapping.BUTTON_RB]) ? rButtons.BUTTON_RB : 0) |
					//(rat.input.getButtonValue(full[mapping.BUTTON_LT]) ? rButtons.BUTTON_LT : 0) | // We let rat take care of these
					//(rat.input.getButtonValue(full[mapping.BUTTON_RT]) ? rButtons.BUTTON_RT : 0) | // We let rat take care of these
					(rat.input.getButtonValue(full[mapping.BUTTON_SELECT]) ? rButtons.BUTTON_SELECT : 0) |
					(rat.input.getButtonValue(full[mapping.BUTTON_START]) ? rButtons.BUTTON_START : 0) |
					(rat.input.getButtonValue(full[mapping.BUTTON_LEFT_STICK]) ? rButtons.BUTTON_LEFT_STICK : 0) |
					(rat.input.getButtonValue(full[mapping.BUTTON_RIGHT_STICK]) ? rButtons.BUTTON_RIGHT_STICK : 0) |
					(rat.input.getButtonValue(full[mapping.BUTTON_DPAD_UP]) ? rButtons.BUTTON_DPAD_UP : 0) |
					(rat.input.getButtonValue(full[mapping.BUTTON_DPAD_DOWN]) ? rButtons.BUTTON_DPAD_DOWN : 0) |
					(rat.input.getButtonValue(full[mapping.BUTTON_DPAD_LEFT]) ? rButtons.BUTTON_DPAD_LEFT : 0) |
					(rat.input.getButtonValue(full[mapping.BUTTON_DPAD_RIGHT]) ? rButtons.BUTTON_DPAD_RIGHT : 0);
				ratObj.leftStick.x = full[mapping.leftStick.x] || 0;
				ratObj.leftStick.y = full[mapping.leftStick.y] || 0;
				ratObj.rightStick.x = full[mapping.rightStick.x] || 0;
				ratObj.rightStick.y = full[mapping.rightStick.y] || 0;
				ratObj.leftTrigger = full[mapping.leftTrigger] || 0;
				ratObj.rightTrigger = full[mapping.rightTrigger] || 0;
				return ratObj;
			case "xle":
				//							(rawData, id, 	index, 		connected, 	timestamp)
				ratObj = new rInput.Controller(obj, obj.id, obj.index, obj.connected, obj.timestamp);
				if (obj.hasReading)
				{
					var sysRaw = obj.reading;
					ratObj.rawButtons =
						(sysRaw.isAPressed ? rButtons.BUTTON_A : 0) |
						(sysRaw.isBPressed ? rButtons.BUTTON_B : 0) |
						(sysRaw.isXPressed ? rButtons.BUTTON_C : 0) |
						(sysRaw.isYPressed ? rButtons.BUTTON_D : 0) |
						(sysRaw.isLeftShoulderPressed ? rButtons.BUTTON_LB : 0) |
						(sysRaw.isRightShoulderPressed ? rButtons.BUTTON_RB : 0) |
						(sysRaw.isViewPressed ? rButtons.BUTTON_SELECT : 0) |
						(sysRaw.isMenuPressed ? rButtons.BUTTON_START : 0) |
						(sysRaw.isLeftThumbstickPressed ? rButtons.BUTTON_LEFT_STICK : 0) |
						(sysRaw.isRightThumbstickPressed ? rButtons.BUTTON_RIGHT_STICK : 0) |
						(sysRaw.isDPadUpPressed ? rButtons.BUTTON_DPAD_UP : 0) |
						(sysRaw.isDPadDownPressed ? rButtons.BUTTON_DPAD_DOWN : 0) |
						(sysRaw.isDPadLeftPressed ? rButtons.BUTTON_DPAD_LEFT : 0) |
						(sysRaw.isDPadRightPressed ? rButtons.BUTTON_DPAD_RIGHT : 0);
					ratObj.leftStick.x = sysRaw.leftThumbstickX;
					ratObj.leftStick.y = -sysRaw.leftThumbstickY;
					ratObj.rightStick.x = sysRaw.rightThumbstickX;
					ratObj.rightStick.y = -sysRaw.rightThumbstickY;
					ratObj.leftTrigger = sysRaw.leftTrigger;
					ratObj.rightTrigger = sysRaw.rightTrigger;
				}
				return ratObj
			case "xbox":
				var connected = true;
				var sysRaw = obj.getCurrentReading();
				obj.raw = sysRaw;
				obj.index = obj.id;
				ratObj = new rInput.Controller(obj, obj.id, obj.index, connected, sysRaw.timestamp);
				ratObj.rawButtons =
					(sysRaw.isAPressed ? rButtons.BUTTON_A : 0) |
					(sysRaw.isBPressed ? rButtons.BUTTON_B : 0) |
					(sysRaw.isXPressed ? rButtons.BUTTON_C : 0) |
					(sysRaw.isYPressed ? rButtons.BUTTON_D : 0) |
					(sysRaw.isLeftShoulderPressed ? rButtons.BUTTON_LB : 0) |
					(sysRaw.isRightShoulderPressed ? rButtons.BUTTON_RB : 0) |
					(sysRaw.isViewPressed ? rButtons.BUTTON_SELECT : 0) |
					(sysRaw.isMenuPressed ? rButtons.BUTTON_START : 0) |
					(sysRaw.isLeftThumbstickPressed ? rButtons.BUTTON_LEFT_STICK : 0) |
					(sysRaw.isRightThumbstickPressed ? rButtons.BUTTON_RIGHT_STICK : 0) |
					(sysRaw.isDPadUpPressed ? rButtons.BUTTON_DPAD_UP : 0) |
					(sysRaw.isDPadDownPressed ? rButtons.BUTTON_DPAD_DOWN : 0) |
					(sysRaw.isDPadLeftPressed ? rButtons.BUTTON_DPAD_LEFT : 0) |
					(sysRaw.isDPadRightPressed ? rButtons.BUTTON_DPAD_RIGHT : 0);
				ratObj.leftStick.x = sysRaw.leftThumbstickX;
				ratObj.leftStick.y = -sysRaw.leftThumbstickY;
				ratObj.rightStick.x = sysRaw.rightThumbstickX;
				ratObj.rightStick.y = -sysRaw.rightThumbstickY;
				ratObj.leftTrigger = sysRaw.leftTrigger;
				ratObj.rightTrigger = sysRaw.rightTrigger;
				return ratObj;
			default:
				return new rInput.Controller(obj, 0, -1, false, 0);
		}
	};
	
	/**
	 * Build a fake controller object,
	 *	matching the chrome (webkit) gamePadAPI format,
	 *	based on keyboard state.
	 *	Very useful for developing projects that depend on controller inputs
	 *	(like lua games) when you don't have a controller connected,
	 *	or are tired of dealing with how flaky chrome's controller support is.
	 */
	rat.input.buildGamepadKeyFake = function ()
	{
		var fake = {
			id: 'GAMEPAD_KEYFAKE',
			index: 4,
			//mapping
			//connected
			//timestamp
			axes: [],
			buttons: [
				//	this list matches the standard gamePadAPI mapping,
				//	which is what we're going to fake here.
				rat.input.keyboard.isKeyDown(rat.keys.a) | rat.input.keyboard.isKeyDown(rat.keys.enter),
				rat.input.keyboard.isKeyDown(rat.keys.b) | rat.input.keyboard.isKeyDown(rat.keys.esc),
				rat.input.keyboard.isKeyDown(rat.keys.x),
				rat.input.keyboard.isKeyDown(rat.keys.y),
				rat.input.keyboard.isKeyDown(rat.keys.leftBracket),	//	lb
				rat.input.keyboard.isKeyDown(rat.keys.rightBracket),	//	rb
				rat.input.keyboard.isKeyDown(rat.keys.l) | rat.input.keyboard.isKeyDown(rat.keys.semicolon),	//	lt
				rat.input.keyboard.isKeyDown(rat.keys.r) | rat.input.keyboard.isKeyDown(rat.keys.singleQuote),	//	rt
				0,0,	//	sel,start
				0,0,	//	stick button, stick button
				rat.input.keyboard.isKeyDown(rat.keys.i),	//	dpad
				rat.input.keyboard.isKeyDown(rat.keys.k),
				rat.input.keyboard.isKeyDown(rat.keys.j),
				rat.input.keyboard.isKeyDown(rat.keys.l)
			],
		};
		
		//	ijkl map to analog stick
		if (rat.input.keyboard.isKeyDown(rat.keys.upArrow))
			fake.axes[1] = -1;
		else if (rat.input.keyboard.isKeyDown(rat.keys.downArrow))
			fake.axes[1] = 1;
		if (rat.input.keyboard.isKeyDown(rat.keys.leftArrow))
			fake.axes[0] = -1;
		else if (rat.input.keyboard.isKeyDown(rat.keys.rightArrow))
			fake.axes[0] = 1;
		
		return fake;
	};

	/**
	 * event called when a controller is added
	 * @param {?} e
	 * @return {?rat.input.Controller}
	 * @suppress {missingProperties}
	 */
	rat.input.onSysControllerAdded = function (e)
	{
		var rInput = rat.input;
		if(rat.system.has.xbox)
		{
			return null;
		}
			/// GamepadAPI
		else
		{
			var sysGP = e.gamepad;
			//	Get the rat version of the controller
			var ratGP = rInput.buildRatControllerObject("gamepadAPI", sysGP);

			//	Handle this controller being added
			return rInput.onControllerChange(rInput.ControllerChangeType.ADDED, ratGP);
		}
	};

	/**
	 * event called when a controller is removed
	 * @param {?} e
	 * @return {?rat.input.Controller}
	 * @suppress {missingProperties}
	 */
	rat.input.onSysControllerRemoved = function (e)
	{
		var rInput = rat.input;
		if(rat.system.has.xbox)
		{
			return null;
		}
			/// GamepadAPI
		else
		{
			var sysGP = e.gamepad;
			//	Get the rat version of the controller
			var ratGP = rInput.buildRatControllerObject("gamepadAPI", sysGP);

			//	Handle it being removed
			return rInput.onControllerChange(rInput.ControllerChangeType.REMOVED, ratGP);
		}
	};

	/**
	 * Called when a controller is added, remove, or generally updated
	 * @param {number} reason Why was this method called
	 * @param {!rat.input.Controller} controller The controller data
	 * @return {!rat.input.Controller}
	 */
	rat.input.onControllerChange = function (reason, controller)
	{
		//	Find this controller's index if it is in the controllers list
		var rInput = rat.input;
		var foundAtIndex = -1;
		var list = rInput.controllers;
		for(var searchIndex = list.length - 1; searchIndex >= 0; --searchIndex)
		{
			if(list[searchIndex].id === controller.id)
			{
				foundAtIndex = searchIndex;
				break;
			}
		}

		//	Some general state handling
		if(reason === rInput.ControllerChangeType.REMOVED)
		{
			//	If we didn't find it, then we have nothing to do
			if(foundAtIndex === -1)
				return controller;

			//	The controller is not active in any way.
			controller.rawButtons = 0;
			controller.leftStick.x = 0;
			controller.leftStick.y = 0;
			controller.rightStick.x = 0;
			controller.rightStick.y = 0;
			controller.connected = false;
			controller.leftTrigger = 0;
			controller.rightTrigger = 0;
			controller.repeatTimer.fullReset();
		}
		else if(reason === rInput.ControllerChangeType.ADDED)
		{
			controller.connected = true;
		}

		//	Get the lastButtons if we found it, and make sure that this object is in the list
		if(foundAtIndex === -1)
		{
			controller.lastButtons = 0;
			foundAtIndex = list.length;
			list.push(controller);
			//rat.console.log("Controller " + controller.id + " added");
			//rat.console.log("   FullInfo");
			//rat.console.log(JSON.stringify(controller));
			//rat.console.log("\n");
		}
		else
		{
			controller.repeatTimer = list[foundAtIndex].repeatTimer;
			controller.lastButtons = list[foundAtIndex].lastButtons;
			list[foundAtIndex] = controller;
		}

		return controller;
	};

	/**
	 * Update the users controllers, if any
	 * @param {number} dt Delta time
	 */
	rat.input.updateControllers = function (dt)
	{
		var rInput = rat.input;
		var list = rInput.controllers;
		var thresholds = rInput.thresholds;
		
		if (rInput.controllers.getSystemControllers)
		{
			//	If we are a pollingForced system for controllers, find any changes to what we have and call
			//	the correct onController* method
			var gamepads = rInput.controllers.getSystemControllers();
			var index;

			var found;
			var searchIndex;
			var newController;
			var changeType;
			if (rInput.controllers.pollingForced)
			{
				//	gamepad API polling.
				if (rat.system.has.gamepadAPI || fakeGamepadAPI)// NOTE: The xbox does set this.
				{
					//	Process the currently list of gamepads from the system
					var system = "gamepadAPI";
					if (rat.system.has.xbox)
						system = "xbox";
					for (index = gamepads.length - 1; index >= 0; --index)
					{
						if (!gamepads[index])
							continue;

						//	Get the RAT version of the controller object
						newController = rInput.buildRatControllerObject(system, gamepads[index]);

						//	Find the controller
						for (searchIndex = list.length - 1; searchIndex >= 0; --searchIndex)
						{
							if (list[searchIndex].id === newController.id)
							{
								found = true;
								break;
							}
						}

						//	If it is not connected now, it has been removed
						if (!newController.connected)
							changeType = rInput.ControllerChangeType.REMOVED;
						else if (!found)
							changeType = rInput.ControllerChangeType.ADDED;
						else
							changeType = rInput.ControllerChangeType.UPDATED;
						newController = rInput.onControllerChange(changeType, newController);
					}
				}
			}
		}

		//	Rat level event detection and dispatch
		var controller;
		for(index = list.length - 1; index >= 0; --index)
		{
			controller = list[index];

			//	Translate left stick values to direction
			if (controller.leftStick.y <= -thresholds.PRESSED)
				controller.rawButtons |= rInput.BUTTON_LSTICK_UP;
			if (controller.leftStick.y >= thresholds.PRESSED)
				controller.rawButtons |= rInput.BUTTON_LSTICK_DOWN;
			if (controller.leftStick.x <= -thresholds.PRESSED)
				controller.rawButtons |= rInput.BUTTON_LSTICK_LEFT;
			if (controller.leftStick.x >= thresholds.PRESSED)
				controller.rawButtons |= rInput.BUTTON_LSTICK_RIGHT;
				
			//	Translate right stick values to direction
			if (controller.rightStick.y <= -thresholds.PRESSED)
				controller.rawButtons |= rInput.BUTTON_RSTICK_UP;
			if (controller.rightStick.y >= thresholds.PRESSED)
				controller.rawButtons |= rInput.BUTTON_RSTICK_DOWN;
			if (controller.rightStick.x <= -thresholds.PRESSED)
				controller.rawButtons |= rInput.BUTTON_RSTICK_LEFT;
			if (controller.rightStick.x >= thresholds.PRESSED)
				controller.rawButtons |= rInput.BUTTON_RSTICK_RIGHT;
				
			//	Left stick and dpad values map to BUTTON_<DIRECTION> to make input dectection easier
			//	NOTE that the right stick is NOT Part of this because we often have special behavior for the right stick
			if ((controller.rawButtons & (rInput.BUTTON_DPAD_UP | rInput.BUTTON_LSTICK_UP)) !== 0)
				controller.rawButtons |= rInput.BUTTON_UP;
			if ((controller.rawButtons & (rInput.BUTTON_DPAD_DOWN | rInput.BUTTON_LSTICK_DOWN)) !== 0)
				controller.rawButtons |= rInput.BUTTON_DOWN;
			if ((controller.rawButtons & (rInput.BUTTON_DPAD_LEFT | rInput.BUTTON_LSTICK_LEFT)) !== 0)
				controller.rawButtons |= rInput.BUTTON_LEFT;
			if ((controller.rawButtons & (rInput.BUTTON_DPAD_RIGHT | rInput.BUTTON_LSTICK_RIGHT)) !== 0)
				controller.rawButtons |= rInput.BUTTON_RIGHT;
			
			//	And the triggers
			if(rat.input.getButtonValue(controller.leftTrigger) >= thresholds.PRESSED)
				controller.rawButtons |= rInput.BUTTON_LT;
			if(rat.input.getButtonValue(controller.rightTrigger) >= thresholds.PRESSED)
				controller.rawButtons |= rInput.BUTTON_RT;

			// What buttons are newly pressed.
			controller.newButtons = controller.rawButtons & ~controller.lastButtons;

			//	Fire events
			rInput.checkAndDispatchControllerEvents(controller, dt);

			//	Remember what the buttons where last frame.
			controller.lastButtons = controller.rawButtons;

			//	If it isn't connected, remove it.
			if (!controller.connected)
			{
				list.splice(index, 1);
				rat.console.log("Controller " + controller.id + " removed");
			}
		}
	};

	rat.input.setOneAllowedController = function (id)
	{
		if (id === 'keyboard' || id === 'mouse')
			return;
		rat.console.log("Allowing only controller " + id);
		rat.input.allowedControllers = [id];
	};
	rat.input.allowAllControllers = function ()
	{
		rat.input.allowedControllers = [];
	};

	rat.input.setAllowRepeatEvents = function (allowed)
	{
		if (allowed === true || allowed === false)
		{
			rat.input.allowRepeatEvents.buttons = allowed;
			rat.input.allowRepeatEvents.directions = allowed;
		}
		else
		{
			if (allowed.buttons !== void 0)
				rat.input.allowRepeatEvents.buttons = !!allowed.buttons;
			if (allowed.directions !== void 0)
				rat.input.allowRepeatEvents.directions = !!allowed.directions;
		}
	};

	/**
	 * A basic repeat timer for controller
	 * @constructor
	 */
	var RepeatTimer = function (rate, delay)
	{
		this.defaults = {
			rate: rate,
			delay: delay
		};
		this.buttons = 0;
		this.directions = 0;
		this.fullReset();
	};
	RepeatTimer.prototype.fullReset = function ()
	{
		this.buttons = this.defaults.delay.buttons;
		this.directions = this.defaults.delay.directions;
	};
	RepeatTimer.prototype.repeatReset = function (ops)
	{
		if (ops === void 0)
			ops = { buttons: true, directions: true };
		if (ops.buttons)
			this.buttons = this.defaults.rate.buttons;
		if (ops.directions)
			this.directions = this.defaults.rate.directions;
	};
	RepeatTimer.prototype.elapsed = function (dt)
	{
		this.buttons -= dt;
		this.directions -= dt;
		if (this.buttons < 0)
			this.buttons = 0;
		if (this.directions < 0)
			this.directions = 0;
	};

	/**
	 * The rat controller type
	 * @constructor
	 * @param {?} id unique ID assigned to each controller
	 * @param {number} index of the controller in the system.  Unique for currently connected controllers
	 * @param {boolean} connected is it currently connected 
	 * @param {?} timestamp
	 */
	rat.input.Controller = function (rawData, id, index, connected, timestamp)
	{
		this.rawData = rawData || {};
		this.id = id;
		this.index = index;
		this.connected = connected;
		this.timestamp = timestamp;
		this.rawButtons = 0;
		this.leftStick = {
			x: 0,
			y: 0
		};
		this.rightStick = {
			x: 0,
			y: 0
		};
		this.leftTrigger = 0;
		this.rightTrigger = 0;
		this.newButtons = 0;
		this.lastButtons = 0;
		this.repeatTimer = new RepeatTimer(rat.input.Controller.repeatRate, rat.input.Controller.repeatDelay);
	};

	/// How fast should event repeats happen
	rat.input.Controller.repeatRate = {
		buttons: 0.2,	/// For buttons
		directions: 0.2	/// For directions
	};
	/// What is the delay before we start to repeat
	rat.input.Controller.repeatDelay = {
		buttons: 0.5,	/// For buttons
		directions: 0.5	/// For directions
	};

	/**
	 * Thresholds for analog values
	 * @enum {number}
	 */
	rat.input.thresholds = {
		LOW: 0.2,
		NORM: 0.5,
		HIGH: 0.8,
		PRESSED: 0.7, // We use this to know if a stick is pushing in a direction
	};


	//	a bunch of more convenient names, especially for backward compatibility.

	rat.getRealMousePosition = rat.input.getRealMousePosition;
	//rat.dispatchMouseMove = rat.input.dispatchMouseMove;
	//rat.dispatchMouseDown = rat.input.dispatchMouseDown;
	//rat.dispatchMouseUp = rat.input.dispatchMouseUp;
	rat.standardizeKeyEvent = rat.input.standardizeKeyEvent;
	rat.charCodeFromEvent = rat.input.charCodeFromEvent;

	rat.autoHandleEvents = rat.input.autoHandleEvents;


	//	common key definitions so we can stop using numbers everywhere
	//	TODO: move this to rat.keyboard?
	rat.keys = {
		leftArrow: 37,
		upArrow: 38,
		rightArrow: 39,
		downArrow: 40,

		enter: 13,
		esc: 27,
		backspace: 8,
		del: 46,
		space: 32,
		home: 36,
		end: 35,
		' ': 32,
		tab: 9,
		pageUp: 33,
		pageDown: 34,
		period: 190,
		semicolon : 186,
		singleQuote : 222,
		comma : 188,
		shift: 16,
		
		'0' : 48,
		'1' : 49,
		'2' : 50,
		'3' : 51,
		'4' : 52,
		'5' : 53,
		'6' : 54,
		'7' : 55,
		'8' : 56,
		'9' : 57,
		
		numPad0 : 96,
		numPad1 : 97,
		numPad2 : 98,
		numPad3 : 99,
		numPad4 : 100,
		numPad5 : 101,
		numPad6 : 102,
		numPad7 : 103,
		numPad8 : 104,
		numPad9 : 105,
		
		numPadPlus : 107,
		numPadMinus : 109,

		a: 65, b: 66, c: 67, d: 68, e: 69, f: 70, g: 71, h: 72,
		i: 73, j: 74, k: 75, l: 76, m: 77, n: 78, o: 79, p: 80,
		q: 81, r: 82, s: 83, t: 84, u: 85, v: 86, w: 87, x: 88,
		y: 89, z: 90,

		'~': 192,
		'`': 192,
		
		'-': 189,
		'=': 187,

		leftSys: 91, // Systems key (like the window key)
		rightSys: 92,

		selectKey: 93,
		
		'/' : 191,
		forwardSlash: 191,
		'\\' : 220,
		backslash : 220,
		
		leftBracket : 219,
		rightBracket: 221,

		f1: 112,
		f2: 113,
		f3: 114,
		f4: 115,
		f5: 116,
		f6: 117,
		f7: 118,
		f8: 119,
		f9: 120,
		f10: 121,
		f11: 122,
		f12: 123,
	};
	
	//	if this key code corresponds with a real number, return that, otherwise -1
	rat.input.keyCodeToNumber = function(which)
	{
		if (which >= rat.keys['0'] && which <= rat.keys['9'])
			return which - rat.keys['0'];
		if (which >= rat.keys.numPad0 && which <= rat.keys.numPad9)
			return which - rat.keys.numPad0;
			
		return -1;
	};
	
	//	Handle calling the system event's preventDefault (or not based on flags)
	//	presumably called only after everybody's had a chance to express their opinion on whether or not the default should happen.
	rat.input.handlePreventDefault = function(ratEvent, handled)
	{
		var prevent = rat.input.standardPreventDefaultOnEvents;
		
		if (handled === void 0)
		{
			//	leave default above (by default, prevent!)
		} else if (handled)
		{
			//	STOP the browser default handling
			prevent = true;
		} else {	//	false!
			//	ALLOW the browser default handling
			//	you didn't handle it, so we're allowing to flow up, regardless of what the standard is.
			prevent = false;
		}
		
		//	Regardless of what the "handled" state was, IF allowBrowserDefault has been
		//	set, respect the value.
		if (ratEvent.allowBrowserDefault !== void 0)
			prevent = !ratEvent.allowBrowserDefault;
		
		//	if prevent defaults is desired, do it.  Unless we're in qunit, in which case never prevent default.
		if (prevent && !rat.system.has.QUnit )
		{
			if( ratEvent.sysEvent && ratEvent.sysEvent.preventDefault )
			{
				ratEvent.sysEvent.preventDefault();
			}
		}
		
	};
	
	//	a hopefully sensical way to set this global
	rat.input.setStandardPreventFlag = function(prevent)
	{
		rat.input.standardPreventDefaultOnEvents = prevent;
	};
	
} );
