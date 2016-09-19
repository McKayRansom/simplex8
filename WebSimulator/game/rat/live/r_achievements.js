//
//	Achievement/Trophy module
//
rat.modules.add( "rat.live.r_achievements",
[
	"rat.os.r_system",
], 
function(rat)
{
	rat.achievements = {	//	achievements namespace
		//	one-time system-level init
		init: function ()
		{
			var self = rat.achievements;
			if( rat.system.has.Wraith )
				self.updateAchievement = Wraith.UpdateAchievement;
			else
			{
				self.updateAchievement = function()
				{
				
				};
			}
		},
	};

	rat.achievements.init();
} );

