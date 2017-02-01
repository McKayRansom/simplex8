//
//	Game specific audio
//
//	Here's the list of sounds that we register with the rat audio system,
//	and some related support functions.
//
rat.modules.add( "js.audio",
[
	"rat.audio.r_audio",
],
function(rat)
{
	var audio = {

		init : function()
		{
			//	load sounds.  Can just list the resource (in which case id is filename) or explicitly specify ID.
			
			rat.audio.loadSounds([
				
				{id:'click', resource:"audio/click.mp3", volume:0.8},
				
				{id:'hit', resource:"audio/hit.mp3", volume:0.8},

				/*
				[	//	list several, audio system will randomly pick one
					{id:'collect', resource:"audio/whistle.mp3", volume:0.6},
					{id:'collect', resource:"audio/whistle2.mp3", volume:0.6},
					{id:'collect', resource:"audio/whistle3.mp3", volume:0.6},
					{id:'collect', resource:"audio/whistle4.mp3", volume:0.6},
				],
				*/
				
				{id:'rumble', resource:"audio/low_rumble.mp3", volume:0.7},
			]);
			
			rat.ui.Button.defaultClickSound = 'click';
		},

		playSound : function(soundID)
		{
			//	special case...  since rat audio system only supports one on/off switch right now,
			//	we need to override it.  :)
			if (soundID == 'music')
			{
				var oldOnOff = rat.audio.soundOn;
				rat.audio.soundOn = true;
				rat.audio.playSound(soundID);
				rat.audio.soundOn = rat.audio.soundOn;
			} else
				rat.audio.playSound(soundID);
		},
		
		stopSound : function(soundID)
		{
			rat.audio.stopSound(soundID);
		},

	};
	
	//	global access
	window.audio = audio;
});