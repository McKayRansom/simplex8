
/*
Generic voice commands support 
*/
rat.modules.add( "rat.input.r_voice",
[
	{name: "rat.os.r_system", processBefore: true},
	
	{name: "rat.input.r_voice_xbo", platform: "xbox"} // platform specific versions run AFTER me
], 
function(rat)
{
	// move this to a platform independent file if/when we generalize this
	rat.voice = {
		commands: {
			Play: "play",				//	The play button. 
			Pause: "pause",				//	The pause button. 
			Stop: "stop",				//	The stop button. 
			Record: "record",			//	The record button. 
			FastForward: "fastForward",	//	The fast forward button. 
			Rewind: "rewind",			//	The rewind button. 
			Next: "next",				//	The next button. 
			Previous: "previous",		//	The previous button. 
			ChannelUp: "channelUp",		//	The channel up button. 
			ChannelDown: "channelDown",	//  The channel down button. 
			Back: "back",				//	The back button. 
			View:  "view",				//	The view button. 
			Menu: "menu",				//	The menu button. 
		},
		
		callbacks: {},	//	Array for each command

		enabled: {}
	};
	
	var firingCB = void 0;
	
	//	Register a callback from a command
	rat.voice.registerCB = function( command, func, ctx )
	{
		var callbacks = rat.voice.callbacks[command];
		if( !callbacks )
			return;
		callbacks.push( {func: func, ctx: ctx} );
	};
	
	//	Unregister a callback from the command
	rat.voice.unregisterCB = function( command, func, ctx )
	{
		var callbacks = rat.voice.callbacks[command];
		if( !callbacks )
			return;
		var cb;
		for( var index = 0; index !== callbacks.length; ++index )
		{
			cb = callbacks[index];
			if( cb.func === func && cb.ctx === ctx )
			{
				if( firingCB && firingCB.index >= index )
					--firingCB.index;
				callbacks.splice( index, 1 );
				return;
			}
		}
	};
	
	//	Fire callbacks for a command
	rat.voice.fireCB = function( command, sys )
	{
		var callbacks = rat.voice.callbacks[command];
		if( !callbacks )
			return;
		var saved = firingCB;
		firingCB = {
			index: 0
		};
		var handled = false;
		var func, ctx;
		for( firingCB.index = 0; firingCB.index !== callbacks.length; ++firingCB.index )
		{
			func = callbacks[firingCB.index].func;
			ctx = callbacks[firingCB.index].ctx;
			handled = func.call(ctx, command);
			if (handled)
				break;
		}
		
		firingCB = saved;
		if (!handled && rat.input)
		{
			var ratEvent = new rat.input.Event(sys, { type: 'voice', defaultControllerID: 'voice', which:command });
			rat.input.dispatchEvent(ratEvent);
		}
		return handled;
	};
	
	rat.voice.enableCommand = function (command, isEnabled)
	{
		if( isEnabled === void 0 )
			isEnabled = true;
		else
			isEnabled = !!isEnabled;
		rat.voice.enabled[command] = isEnabled;
		if( rat.voice._internalEnabledCommand )
			rat.voice._internalEnabledCommand( command, isEnabled );
	};

	//	Disable all callbacks
	rat.voice.resetCommands = function()
	{
		//	Add the array to callbacks for each command
		for( var cmd in rat.voice.commands )
		{
			rat.voice.callbacks[rat.voice.commands[cmd]] = [];
			rat.voice.enableCommand(rat.voice.commands[cmd], false);
		}
	};

} );