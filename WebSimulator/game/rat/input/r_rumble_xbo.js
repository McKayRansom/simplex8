//
//	Xbox one SRA (Javascript) rumble code
//

//------------ rat.Rumble ----------------
rat.modules.add( "rat.input.r_rumble_xbo",
[
	"rat.input.r_rumble", // generic versions runs AFTER me
	{name: "rat.os.r_system", processBefore: true},	
], 
function(rat)
{
	if (!rat.system.has.Xbox)
		return;

	rat.Rumble = rat.Rumble || {};
	
	//////////////////////////////////////////////////////////////////////////////////////
	///	Set the rumble states for a given platform
	/** @suppress {missingProperties} */
	rat.Rumble.platform_setMotorStates = function( controller, state )
	{
		var controllerID = controller.id;
		
		//	Get the systems controller object
		var gamepads = window.Windows.Xbox.Input.Gamepad.gamepads;
		var gamepad;
		for (var index = 0; index !== gamepads.length; ++index)
		{
			gamepad = gamepads[index];
			if( gamepad.id === controllerID )
			{
				gamepad.setVibration( {
					leftMotorLevel: state.newLevel[rat.Rumble.Motors.Left],
					rightMotorLevel: state.newLevel[rat.Rumble.Motors.Right],
					leftTriggerLevel: state.newLevel[rat.Rumble.Motors.LeftTrigger],
					rightTriggerLevel: state.newLevel[rat.Rumble.Motors.RightTrigger]
				} );
				return;
			}
		}
	};
	
} );