//
//	Audio ui button support, tacked on to the end of the global ui object
//
rat.modules.add( "js.ui.ui_audio",
[
	{name: "js.ui.ui", processBefore: true },
]
, function(rat)
{
	//	tack these on to the ui object
	ui.musicButton = null;
	ui.soundButton = null;

	ui.makeOneAudioButton = function(container, resBase, x, y, callback)
	{
		var but = new rat.ui.makeSpriteButton(resBase + "_on.png");
		but.toggles = true;
		but.setPos(x, y);
		but.setSize(64, 64);
		but.setCallback(callback);
		
		//	explicitly set the various image states, since this is a complex case
		var E = rat.ui.Element;	//	shortcut for readability below
		but.setStateImages([
			{state: E.enabledFlag, resource: resBase + "_on.png"},
			{state: E.enabledFlag | E.highlightedFlag, resource: resBase + "_hi.png"},
			{state: E.enabledFlag | E.pressedFlag, resource: resBase + "_press.png"},
			
			{state: E.enabledFlag | E.toggledFlag, resource: resBase + "_off.png"},
			{state: E.enabledFlag | E.toggledFlag | E.highlightedFlag, resource: resBase + "_off_hi.png"},
			{state: E.enabledFlag | E.toggledFlag | E.pressedFlag, resource: resBase + "_off_press.png"},
		]);
		
		container.appendSubElement(but);
		
		return but;
	}

	ui.makeAudioButtons = function(container)
	{
		ui.soundButton = ui.makeOneAudioButton(container, "images/ui/sound_but", rat.graphics.SCREEN_WIDTH - 80, 20, ui.handleSoundButton);
		ui.musicButton = ui.makeOneAudioButton(container, "images/ui/music_but", rat.graphics.SCREEN_WIDTH - (80 + 64 + 10), 20, ui.handleMusicButton);
		
		ui.updateAudioButtons();	//	set initial state
	}

	ui.removeAudioButtons = function(container)
	{
		if (ui.soundButton)
			container.removeSubElement(ui.soundButton);
		if (ui.musicButton)
			container.removeSubElement(ui.musicButton);
		ui.soundButton = null;
		ui.musicButton = null;
	}

	ui.handleSoundButton = function(e, u)
	{
		if (app.settings.soundOn)
			app.settings.soundOn = false;
		else
			app.settings.soundOn = true;
		
		rat.audio.soundOn = app.settings.soundOn;
		
		app.writeSettings();	//	store whether music in on/off
		
		ui.updateAudioButtons();
	}

	ui.handleMusicButton = function(e, u)
	{
		if (app.settings.musicOn)
			app.settings.musicOn = false;
		else
			app.settings.musicOn = true;
		
		//	stop/start music
		//rat.audio.soundOn = app.settings.soundOn;
		
		app.writeSettings();	//	store whether music in on/off
		
		ui.updateAudioButtons();
	};

	//	Update audio buttons to reflect current settings
	ui.updateAudioButtons = function()
	{
		function updateOneAudioButton(but, state)
		{
			if (!but)
				return;
				
			if (state)
				but.setToggled(false);
			else
				but.setToggled(true);
		}
		
		//console.log("update sound button: " + app.settings.soundOn);
		//console.log("update music button: " + app.settings.musicOn);
		updateOneAudioButton(ui.soundButton, app.settings.soundOn);
		updateOneAudioButton(ui.musicButton, app.settings.musicOn);
	}
});
