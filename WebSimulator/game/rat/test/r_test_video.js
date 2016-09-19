//
//	Test graphics elements (UI)
//
rat.modules.add( "rat.test.r_test_video",
[
	{ name: "rat.test.r_test", processBefore: true },
	
	"rat.graphics.r_graphics",
	"rat.graphics.r_video",
	"rat.ui.r_screen",
	"rat.ui.r_screenmanager",
	"rat.ui.r_ui_textbox",
],
function(rat)
{
	var video;
	var time = 0;
	var logBox;
	var logLines = [];
	var updateAdded = false;
	function log(txt)
	{
		if (!logBox)
			return;
		var fullText = "Test: Video\n---------";
		logLines.push(txt);
		if (logLines.length > 25)
			logLines.shift();
		for (var i = 0; i < logLines.length; ++i)
		{
			fullText += "\n";
			fullText += logLines[i];
		}
		logBox.setTextValue(fullText);
	};

	rat.test.video = {
		gotEvent: function( from, type, varargs )
		{
			log( "Got on" + (type || varargs) + " event.." );
		},
		setup: function ()
		{
			if (video)
				video.destroy();
			if( !updateAdded)
			{
				rat.test.tests.push({ update: rat.test.video.update });
				updateAdded = true;
			}
			video = new rat.graphics.Video({
				foreground: false,
				volume: 1,
				onload: rat.test.video.gotEvent,
				onend: rat.test.video.gotEvent,
				ondestroy: rat.test.video.gotEvent,
				onstartbuffering: rat.test.video.gotEvent,
				onendbuffering: rat.test.video.gotEvent,
			});
			video.play("res/video/small");

			var screenWidth = rat.graphics.SCREEN_WIDTH;
			var screenHeight = rat.graphics.SCREEN_HEIGHT;

			//	screens are just UI elements.  Make a container to hold all UI.
			var container = new rat.ui.Screen();
			container.setPos(0, 0);
			container.setSize(screenWidth, screenHeight);

			rat.screenManager.setUIRoot(container);

			logBox = new rat.ui.TextBox("Test: Video");
			logBox.setFont("arial bold");
			logBox.setFontSize(20);
			logBox.setPos(32, 32);
			logBox.setSize(screenWidth, 30);
			logBox.setAlign(rat.ui.TextBox.alignLeft);
			logBox.setBaseline(rat.ui.TextBox.baseLineTop);
			logBox.setColor(new rat.graphics.Color(180, 180, 210));
			container.appendSubElement(logBox);

			log("Test Setup");
		},

		update: function ( deltaTime )
		{
			if (video)
				video.update(deltaTime);

			function justPassed(testTime)
			{ return (was < testTime && time >= testTime); }

			var was = time;
			time += deltaTime;
			if (justPassed(1))
			{
				log("Destroyed");
				video.destroy();
				video = void 0;
			}
			else if (justPassed(2))
			{
				log("Created low vol");
				video = new rat.graphics.Video({
					file: "res/video/small",
					foreground: false,
					volume: 0.1,
					onload: rat.test.video.gotEvent,
					onend: rat.test.video.gotEvent,
					ondestroy: rat.test.video.gotEvent,
					onstartbuffering: rat.test.video.gotEvent,
					onendbuffering: rat.test.video.gotEvent,
				});
				video.play();
			}
			else if (justPassed(3))
			{
				log("Paused");
				video.pause();
			}
			else if (justPassed(4))
			{
				log("Resumed");
				video.resume();
			}
			else if (justPassed(5))
			{
				log("Stopped");
				video.stop();
			}
			else if (justPassed(6))
			{
				log("Played");
				video.play();
			}
		}
	};
	
});