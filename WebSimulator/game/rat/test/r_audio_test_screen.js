//
//	audio test screen for rat engine
//
//	Feb 2013, Steve Taylor
//
rat.modules.add( "rat.test.r_audio_test_screen",
[
	{ name: "rat.audio.r_audio", processBefore: true },
	
	"rat.math.r_math",
	"rat.ui.r_screen",
	"rat.ui.r_ui_button",
	"rat.ui.r_ui_shape",
	"rat.ui.r_ui_textbox",
	"rat.ui.r_screenmanager",
	"rat.graphics.r_graphics",
	"rat.input.r_input",
],
function(rat)
{
	//
	//	Set up this screen's UI elements, push it on screen stack...
	//
	rat.audio.initTestScreen = function ()
	{
		if (rat.audio.testScreen)
			return;

		rat.audio.testScreen = new rat.ui.Screen();	//	this screen is a container, and has a bunch of custom properties, too.

		rat.audio.testScreen.modal = true;	//	don't click below me
		rat.audio.testScreen.fullOpaque = true;	//	don't draw below me

		rat.audio.testScreen.name = '<ui>Home';	//	debugging

		rat.audio.rememberDefaultClick = rat.ui.Button.defaultClickSound;
		rat.ui.Button.defaultClickSound = null;

		rat.audio.buildTestScreenUI();

		rat.screenManager.pushScreen(rat.audio.testScreen);
		//	todo: I would really like to get keys as well... not sure best way to insert myself there...
		//	register additional key handler with rat system?  store old handlers and restore later?
		//	do elements get keys?  they should!  We could be a subclass of element.
	};

	rat.audio.killTestScreen = function ()
	{
		rat.ui.Button.defaultClickSound = rat.audio.rememberDefaultClick;
		rat.screenManager.popScreen();
		rat.audio.testScreen = null;
	};

	rat.audio.buildTestScreenUI = function ()
	{
		var screen = rat.audio.testScreen;

		//	start clean
		screen.removeAllSubElements();
		screen.setPos(0, 0);
		screen.setSize(rat.graphics.SCREEN_WIDTH, rat.graphics.SCREEN_HEIGHT);

		//	background
		var back = new rat.ui.Shape(rat.ui.squareShape);
		back.setPos(0, 0);
		back.setSize(rat.graphics.SCREEN_WIDTH, rat.graphics.SCREEN_HEIGHT);
		back.setColor(new rat.graphics.Color(50, 0, 0));
		screen.appendSubElement(back);

		//	title
		var tbox = new rat.ui.TextBox("Audio Test");
		tbox.setPos(0, 0);
		tbox.setSize(rat.graphics.SCREEN_WIDTH, 40);

		tbox.setFont('Arial');
		tbox.setFontSize(24);
		tbox.setColor(rat.graphics.yellow);

		tbox.centerText();
		screen.appendSubElement(tbox);

		//	current text
		tbox = new rat.ui.TextBox("[current]");
		tbox.setPos(50, 40);
		tbox.setSize(rat.graphics.SCREEN_WIDTH - 50 * 2, 200);

		tbox.setFont('Arial');
		tbox.setFontSize(18);
		tbox.setColor(rat.graphics.white);

		//tbox.centerText();
		screen.appendSubElement(tbox);
		screen.curText = tbox;

		screen.curIndex = 0;
		screen.soundCount = rat.audio.getSoundCount();
		
		//var info = rat.audio.getSoundInfo(0);
		//if (!info.source)
		//	screen.curIndex = 1;

		function setCurText()
		{
			//screen.curIndex
			var id = rat.audio.getSoundIDByIndex(screen.curIndex);
			var info = rat.audio.getSoundInfo(id);
			var sourceText = info.source;
			if (!sourceText)
				sourceText = "[Load was never triggered]";
				
			var volume = rat.math.floor(info.volume * 100) / 100;
			screen.curText.setTextValue("#" + (screen.curIndex+1) + "/" + screen.soundCount + ": " + id + "\n" +
				"source: " + sourceText + "\n" +
				"duration: " + info.duration + "\n" +
				"volume: " + volume + "\n" +
				"loaded: " + rat.audio.isSoundLoaded(id) + "\n" +
				"current time: " + info.currentPos + "\n" +
				"ready State: " + info.readyState + "\n" +
				"error: " + info.errorCode
			);
		}
		setCurText();

		// for some reason, overriding tbox's update didn't work
		//	Override screen's update
		//	Do we need to call the old screen.update still?
		//	We do, if we want subelements to update.  Right now, none of them are doing anything useful.
		screen.update = function (dt)
		{
			setCurText();
		};

		//	Override screen's keydown
		screen.keyDown = function (keyInfo)
		{
			if (keyInfo.keyCode === rat.keys.leftArrow)
				screen.prevSound();
			else if (keyInfo.keyCode === rat.keys.rightArrow)
				screen.nextSound();
			else if (keyInfo.keyCode === rat.keys[' '])
				screen.playSound();
			else
				return false;

			return true;
		};

		screen.prevSound = function ()
		{
			screen.curIndex--;
			if (screen.curIndex < 0)
				screen.curIndex = screen.soundCount - 1;	//	wrap
			setCurText();
		};

		screen.nextSound = function ()
		{
			screen.curIndex++;
			if (screen.curIndex >= screen.soundCount)
				screen.curIndex = 0;	//	wrap
			setCurText();
		};

		screen.playSound = function ()
		{
			var id = rat.audio.getSoundIDByIndex(screen.curIndex);
			rat.audio.playSound(id);
		};

		function addButton(text, x, y, id, func)
		{
			var b = rat.ui.makeCheapButton(null, new rat.graphics.Color(150, 150, 200));
			b.setTextValue(text);
			b.setSize(90, 20);
			b.setPos(x, y);
			b.setCallback(func, id);
			
			//	current
			var tbox = new rat.ui.TextBox("[current]");
			tbox.setPos(50, 100);
			tbox.setSize(rat.graphics.SCREEN_WIDTH - 50 * 2, 200);

			tbox.setFont('Arial');
			tbox.setFontSize(18);
			tbox.setColor(rat.graphics.white);
			screen.appendSubElement(b);
		}

		//var left_margin = (rat.graphics.SCREEN_WIDTH - (90 + 20) * 6) - 100; // each button is 90 wide;
		var left_margin = 30;
		function getSpot()
		{
			var x = left_margin + 45;
			left_margin += 90 + 20;
			return x;
		}

		/*
		function (e, info)
			{
				if (info === 'prev')
				{
					
				} else if (info === 'next')
				{
					screen.nextSound();
				} else if (info === 'play')
				{
					screen.playSound();
				} else if (info === 'pause')
				{
					audioID = rat.audio.getSoundIDByIndex(screen.curIndex);
					rat.audio.pauseSound(audioID);
				} else if (info === 'stop')
				{
					audioID = rat.audio.getSoundIDByIndex(screen.curIndex);
					rat.audio.pauseSound(audioID);
					rat.audio.resetSound(audioID);

				} else if (info === 'done')
				{
					rat.audio.killTestScreen();
					//	weird - how does game know we're done?
					//	send back command instead of calling killtestscreen here...  make them call it.
				}
				
				else if (info === 'tostart')
				{
					
				} else if (info === 'toonefourth')
				{
					
				} else if (info === 'tohalf')
				{
					
				} else if (info === 'tothreefourths')
				{
					
				} else if (info === 'toend')
				{
					
				}
			}, id);
			*/
			
		var audioID;
		var yPos = rat.graphics.SCREEN_HEIGHT - 76;
		addButton('Prev', getSpot(), yPos, 'prev', function(e, eid) {screen.prevSound();});
		addButton('Next', getSpot(), yPos, 'next', function(e, eid) {screen.nextSound();});
		addButton('Play', getSpot(), yPos, 'play', function(e, eid) {screen.playSound();});
		addButton('Pause', getSpot(), yPos, 'pause', function(e, eid) {
			var id = rat.audio.getSoundIDByIndex(screen.curIndex);
			rat.audio.pauseSound(id);
		});
		addButton('Stop', getSpot(), yPos, 'stop', function(e, eid) {
			audioID = rat.audio.getSoundIDByIndex(screen.curIndex);
			rat.audio.pauseSound(audioID);
			rat.audio.resetSound(audioID);
		});

		addButton('Done', getSpot(), yPos, 'done', function(e, eid) {rat.audio.killTestScreen();});
		
		//	skipping around in sound tests
		left_margin = 30;
		yPos -= 34;
		addButton("|<", getSpot(), yPos, 'tostart', function(e, eid) {
			audioID = rat.audio.getSoundIDByIndex(screen.curIndex);
			rat.audio.pauseSound(audioID);
			rat.audio.seekSound(audioID, 0);
			rat.audio.playSound(audioID);
		});
		addButton("1/4", getSpot(), yPos, 'toonefourth', function(e, eid) {
			audioID = rat.audio.getSoundIDByIndex(screen.curIndex);
			rat.audio.pauseSound(audioID);
			rat.audio.seekSound(audioID, 0.25, true);
			rat.audio.playSound(audioID);
		});
		addButton("2/4", getSpot(), yPos, 'tohalf', function(e, eid) {
			audioID = rat.audio.getSoundIDByIndex(screen.curIndex);
			rat.audio.pauseSound(audioID);
			rat.audio.seekSound(audioID, 0.5, true);
			rat.audio.playSound(audioID);
		});
		addButton("3/4", getSpot(), yPos, 'tothreefourths', function(e, eid) {
			audioID = rat.audio.getSoundIDByIndex(screen.curIndex);
			rat.audio.pauseSound(audioID);
			rat.audio.seekSound(audioID, 0.75, true);
			rat.audio.playSound(audioID);
		});
		addButton(">|", getSpot(), yPos, 'toend', function(e, eid) {
			audioID = rat.audio.getSoundIDByIndex(screen.curIndex);
			rat.audio.seekSound(audioID, 1, true);
		});
		
		//	volume and other effects
		left_margin = 30;
		yPos -= 34;
		addButton("< vol", getSpot(), yPos, 'voldown', function(e, eid) {
			audioID = rat.audio.getSoundIDByIndex(screen.curIndex);
			var vol = rat.audio.getSoundVolume(audioID);
			vol -= 0.1;
			if (vol < 0)
				vol = 0;
			rat.audio.setSoundVolume(audioID, vol);
		});
		addButton("vol >", getSpot(), yPos, 'volup', function(e, eid) {
			audioID = rat.audio.getSoundIDByIndex(screen.curIndex);
			var vol = rat.audio.getSoundVolume(audioID);
			vol += 0.1;
			if (vol > 1)
				vol = 1;
			rat.audio.setSoundVolume(audioID, vol);
		});
		
	};
} );