
/*

voice commands for the XBO - specifically global system commands 

XR-028: Global Speech Commands:
Required global speech commands
“Xbox Show Menu” and “Xbox Change View”: At a minimum, the title must map these actions to their equivalent controller input. 
“Xbox Pause”: Must be used to pause in supported scenarios.
“Xbox Play”: Must be used to resume in supported scenarios.
“Xbox Go Back”: Must be used for UI navigation in scenarios where the B button is used to return to a prior screen. 

*/
rat.modules.add( "rat.input.r_voice_xbo",
[
	{name: "rat.input.r_voice", processBefore: true }, // generic r_voice must be run first
	{name: "rat.os.r_system", processBefore: true },
], 
function(rat)
{
	if (!rat.system.has.Xbox)
		return;
		
	var systemControls = void 0;
	var commands = rat.voice.commands;
	var transportControls = window.Windows.Media.SystemMediaTransportControlsButton;

	//function convertToXbox(ratCommand)
	//{
	//	switch (ratCommand)
	//	{
	//		case commands.Play:			return transportControls.play;
	//		case commands.Pause:		return transportControls.pause;
	//		case commands.Stop:			return transportControls.stop;
	//		case commands.Record:		return transportControls.record;
	//		case commands.FastForward:	return transportControls.fastForward;
	//		case commands.Rewind:		return transportControls.rewind;
	//		case commands.Next:			return transportControls.next;
	//		case commands.Previous:		return transportControls.previous;
	//		case commands.ChannelUp:	return transportControls.channelUp;
	//		case commands.ChannelDown:	return transportControls.channelDown;
	//		case commands.Back:			return transportControls.back;
	//		case commands.View:			return transportControls.view;
	//		case commands.Menu:			return transportControls.menu;
	//		default:
	//			return void 0;
	//	}
	//}

	function convertToRat(xboCommand)
	{
		switch (xboCommand)
		{
			case transportControls.play:		return commands.Play;
			case transportControls.pause:		return commands.Pause;
			case transportControls.stop:		return commands.Stop;
			case transportControls.record:		return commands.Record;
			case transportControls.fastForward:	return commands.FastForward;
			case transportControls.rewind:		return commands.Rewind;
			case transportControls.next:		return commands.Next;
			case transportControls.previous:	return commands.Previous;
			case transportControls.channelUp:	return commands.ChannelUp;
			case transportControls.channelDown:	return commands.ChannelDown;
			case transportControls.back:		return commands.Back;
			case transportControls.view:		return commands.View;
			case transportControls.menu:		return commands.Menu;
			default:
				return void 0;
		}
	}

	//	Enabled/disable a callback.
	rat.voice._internalEnabledCommand = function (command, isEnabled)
	{
		switch (command)
		{
			case commands.Play:			systemControls.isPlayEnabled = isEnabled;		break;
			case commands.Pause:		systemControls.isPauseEnabled = isEnabled;		break;
			case commands.Stop:			systemControls.isStopEnabled = isEnabled;		break;
			case commands.Record:		systemControls.isRecordEnabled = isEnabled;		break;
			case commands.FastForward:	systemControls.isFastForwardEnabled = isEnabled;break;
			case commands.Rewind:		systemControls.isRewindEnabled = isEnabled;		break;
			case commands.Next:			systemControls.isNextEnabled = isEnabled;		break;
			case commands.Previous:		systemControls.isPreviousEnabled = isEnabled;	break;
			case commands.ChannelUp:	systemControls.isChannelUpEnabled = isEnabled;	break;
			case commands.ChannelDown:	systemControls.isChannelDownEnabled = isEnabled;break;
			case commands.Back:			systemControls.isBackEnabled = isEnabled;		break;
			case commands.View:			systemControls.isViewEnabled = isEnabled;		break;
			case commands.Menu:			systemControls.isMenuEnabled = isEnabled;		break;
		}
	};

	function executeCallback(args)
	{
		var ratCmd = convertToRat(args.button);
		rat.voice.fireCB(ratCmd, args);
	}

	//	return a reference to the given storage system
	systemControls = window.Windows.Media.SystemMediaTransportControls.getForCurrentView();
	systemControls.onbuttonpressed = executeCallback;

	rat.voice.resetCommands();

} );