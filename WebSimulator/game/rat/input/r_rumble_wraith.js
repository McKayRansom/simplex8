//
//	Xbox one SRA (Javascript) rumble code
//

//------------ rat.Rumble ----------------
rat.modules.add( "rat.input.r_rumble_wraith",
[
	"rat.input.r_rumble", // generic versions runs AFTER me
	{name: "rat.os.r_system", processBefore: true},
], 
function(rat)
{
	if (!rat.system.has.Wraith)
		return;
	
	(function (rat, Wraith)
	{
		rat.Rumble = rat.Rumble || {};

		//////////////////////////////////////////////////////////////////////////////////////
		///	Set the rumble states for a given platform
		/** @suppress {missingProperties} */
		rat.Rumble.platform_setMotorStates = function (controller, state)
		{
			//	Get the systems controller object
			var states = [];
			for (var index = 0; index !== rat.Rumble.Motors.Count; ++index)
			{
				states[index] = {
					motor: index,
					level: state.newLevel[index]
				};
			}

			Wraith.setVibration(controller.index, states);
		};
	})(rat, Wraith);
	
} );