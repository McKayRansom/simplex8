//
//	Test graphics elements (UI)
//
rat.modules.add( "rat.test.r_test_ui",
[
	{ name: "rat.test.r_test", processBefore: true },
	
	"rat.debug.r_console",
	"rat.graphics.r_graphics",
	"rat.ui.r_screen",
	"rat.ui.r_ui",
	"rat.ui.r_ui_textbox",
	"rat.ui.r_ui_animator",
	"rat.ui.r_ui_shape",
	"rat.ui.r_ui_button",
	"rat.ui.r_ui_sprite",
	"rat.ui.r_ui_scrollview",
	"rat.ui.r_screenmanager",
],
function(rat)
{
	//	UI tests
	rat.test.setupUITest = function ()
	{
		//	empty element as group
		//	empty element just empty?  debug frame?
		//	sprite (animated)
		//	text box, especially labeling various text things
		//	buttons of various kinds
		//	moving UI screens on top of other UI screens
		//	tooltips

		//	screens, screen registering
		//	screen stack, moving screens

		var screenWidth = rat.graphics.SCREEN_WIDTH;
		var screenHeight = rat.graphics.SCREEN_HEIGHT;

		//	screens are just UI elements.  Make a container to hold all UI.
		var container = new rat.ui.Screen();
		container.setPos(0, 0);
		container.setSize(screenWidth, screenHeight);

		rat.screenManager.setUIRoot(container);

		var mtbox = new rat.ui.TextBox("Test: Main UI");
		mtbox.setFont("arial bold");
		mtbox.setFontSize(20);
		mtbox.setPos(0, 12);
		mtbox.setSize(screenWidth, 30);
		mtbox.setAlign(rat.ui.TextBox.alignCenter);
		mtbox.setFrame(1, rat.graphics.yellow);
		mtbox.setColor(new rat.graphics.Color(180, 180, 210));
		container.appendSubElement(mtbox);

		//	make a sub screen to push on the stack over that.
		//	(this helps test the screen stack)
		var EDGE = 40;
		var s = new rat.ui.Screen();
		s.setPos(EDGE, EDGE);
		s.setSize(screenWidth - 2 * EDGE, screenHeight - 2 * EDGE);

		s.setBackground(new rat.graphics.Color(100, 50, 50, 0.8));
		s.setBackgroundFrame(1, new rat.graphics.Color(250, 250, 250, 1.0));

		rat.screenManager.pushScreen(s);

		//	subscreen title text
		var title = new rat.ui.TextBox("Test: Subscreen");
		title.setFont("arial");
		title.setFontSize(18);
		title.setPos(30, 4);
		title.setSize(200, 20);
		title.setAlign(rat.ui.TextBox.alignLeft);
		title.setColor(new rat.graphics.Color(180, 180, 210));
		//title.setUseOffscreen(true);
		s.appendSubElement(title);

		//	a box for testing tooltips
		var tipBox1 = new rat.ui.TextBox("(tip)");
		tipBox1.setFont("arial");
		tipBox1.setFontSize(18);
		tipBox1.setPos(200, 80);
		tipBox1.setSize(60, 60);
		tipBox1.setColor(new rat.graphics.Color(180, 180, 210));
		tipBox1.setFrame(1, rat.graphics.white);
		s.appendSubElement(tipBox1);

		tipBox1.setCallback(function (element, userData)
		{
			rat.console.log("tip click");
			//	let's cycle through known tooltip placements...
			var placements = ['none', 'topLeft', 'top', 'topRight', 'bottomLeft', 'bottom', 'bottomRight', 'rightHigh'];
			//	userData is my desired position index, starting at -1 (below)
			userData = (userData + 1) % placements.length;	//	advance to next in list, looping if needed
			tipBox1.positionToolTip(placements[userData], { x: 0, y: 0 }, true);	//	reposition, and set mouse pos flag
			tipBox1.setCallbackInfo(userData);	//	update modified userData
		}, -1);

		//	this will by default create a simple 15-point calibri line of text in a framed box.
		var tipInfo = tipBox1.addTextToolTip("this is a\nmulti-line\ntooltip test", rat.graphics.gray, rat.graphics.black, s);

		//	a test of changing that text style...
		tipInfo.textBox.setFontStyle('italic');	//	Big changes won't work well, but italic is a simple change

		//	a test of repositioning that tooltip
		tipBox1.setToolTip(tipInfo.container, s, 'topRight', { x: -5, y: -5 }, false);

		//	a test of a moving element with tooltips
		/*
		var animator = new rat.ui.Animator(rat.ui.Animator.mover, tipBox1);
		animator.setTimer(10);	//	10 seconds slow move
		var pos = tipBox1.getPos().copy();
		var startVal = pos;
		var endVal = {x:pos.x + 300, y:pos.y + 20};
		animator.setStartEndVectors(startVal, endVal);
		animator.setAutoDie();	//	kill animator when it's done
		*/

		//	another box for testing tooltips
		var tbox = new rat.ui.TextBox("(tip 2)");
		tbox.setFont("arial");
		tbox.setFontSize(18);
		tbox.setPos(250, 120);
		tbox.setSize(60, 60);
		tbox.setColor(new rat.graphics.Color(180, 180, 210));
		tbox.setFrame(1, rat.graphics.white);
		s.appendSubElement(tbox);

		//	test custom tooltips...
		var cont = new rat.ui.Shape(rat.ui.circleShape);
		cont.setSize(40, 40);
		cont.setColor(new rat.graphics.Color(250, 250, 90));
		cont.setFrame(1, new rat.graphics.Color(250, 250, 250, 1.0));
		tbox.setToolTip(cont, s, 'bottom');

		//	manual wrap text
		tbox = new rat.ui.TextBox("...");
		tbox.setFont("arial");
		tbox.setFontSize(14);
		tbox.setPos(10, 40);
		tbox.setSize(200, 100);
		tbox.setAlign(rat.ui.TextBox.alignRight);
		tbox.setBaseline(rat.ui.TextBox.baselineMiddle);
		tbox.setColor(new rat.graphics.Color(280, 280, 210));
		tbox.setFrame(1, rat.graphics.white);
		//tbox.setUseOffscreen(true);
		s.appendSubElement(tbox);

		//	auto wrap text
		var autotextbox = new rat.ui.TextBox("...");
		autotextbox.setAutoWrap(true);
		autotextbox.setFont("calibri");
		autotextbox.setFontStyle("italic");
		autotextbox.setFontSize(17);
		autotextbox.setPos(10, 150);
		autotextbox.setSize(200, 110);
		//autotextbox.setAlign(rat.ui.TextBox.alignCenter);
		//autotextbox.setBaseline(rat.ui.TextBox.baselineMiddle);
		autotextbox.setAlign(rat.ui.TextBox.alignLeft);
		autotextbox.setBaseline(rat.ui.TextBox.baselineTop);
		autotextbox.setColor(new rat.graphics.Color(280, 280, 210));
		autotextbox.setFrame(1, rat.graphics.white);
		//autotextbox.setUseOffscreen(true);
		s.appendSubElement(autotextbox);
		
		//	auto wrap text in a small box ("some text which will squish[..]")
		var shortbox = new rat.ui.TextBox("...");
		shortbox.setAutoWrap(true);
		shortbox.setFont("arial");
		shortbox.setFontSize(14);
		shortbox.setPos(360, 140);
		shortbox.setSize(200, 40);
		shortbox.setAlign(rat.ui.TextBox.alignRight);
		shortbox.setBaseline(rat.ui.TextBox.baselineMiddle);
		shortbox.setColor(new rat.graphics.Color(280, 280, 210));
		shortbox.setFrame(1, rat.graphics.white);
		//shortbox.setUseOffscreen(true);
		s.appendSubElement(shortbox);

		//	scrollview
		var scrollView = new rat.ui.ButtonScrollView();
		scrollView.setPos(10, 270);
		scrollView.setSize(200, 200);
		var SV_SIZE_W = 1200;
		var SV_SIZE_H = 400;
		scrollView.setContentSize(SV_SIZE_W, SV_SIZE_H);
		scrollView.setFrame(1, rat.graphics.white);
		s.appendSubElement(scrollView);

		//	put some crap inside the scrollview
		var svbox = new rat.ui.Shape(rat.ui.squareShape);
		svbox.setColor(new rat.graphics.Color(50, 150, 50));
		svbox.setPos(10, 10);
		svbox.setSize(SV_SIZE_W - 20, SV_SIZE_H - 20);
		svbox.setFrame(5, rat.graphics.green);
		scrollView.appendSubElement(svbox);

		for(var x = 20; x < SV_SIZE_W; x += 40)
		{
			var littleBox = new rat.ui.Shape(rat.ui.squareShape);
			littleBox.setPos(x, 20);
			littleBox.setSize(30, 30);
			var boxColor = new rat.graphics.Color(50 + Math.floor(Math.random() * 200), 50 + Math.floor(Math.random() * 200), 50 + Math.floor(Math.random() * 200));
			littleBox.setColor(boxColor);
			littleBox.addTextToolTip("thing " + boxColor.toString(), rat.graphics.cyan, rat.graphics.darkGray, s);
			scrollView.appendSubElement(littleBox);
		}
		
		//	button in scrollview
		var but = rat.ui.makeCheapButton(null, new rat.graphics.Color(200, 150, 150));
		but.setPos(10, 80);
		but.setSize(100, 40);
		but.setTextValue("me");
		scrollView.appendSubElement(but);
		but.addTextToolTip("test button inside scrollview");	//	leaving out args works if button was already added to parent.
		but.setCallback(function (element, userData)
		{
			rat.console.log("HIT BUTTON IN SCROLLVIEW");
		});
		
		//	button
		but = rat.ui.makeCheapButton(null, rat.graphics.gray);
		but.setPos(230, 12);
		but.setSize(100, 40);
		but.setTextValue("button\ntest");
		s.appendSubElement(but);
		but.addTextToolTip("Funky button color testing", rat.graphics.cyan, rat.graphics.darkGray, s);
		but.setCallback(function (element, userData)
		{
			rat.console.log("HIT");
		});
		//	set up a bunch of custom colors!
		but.setTextColors("#FFFF80", "rgb(255,255,255)", new rat.graphics.Color(255, 255, 255, 0.5), void 0);
		var RE = rat.ui.Element;	//	for readability
		var statePairs = [
			{state: RE.enabledFlag, color:"#A08080", frameColor:"#F0A0A0"},
			{state: RE.enabledFlag | RE.highlightedFlag, color:"#A0A080", frameColor:"#FFFF80"},
			{state: RE.enabledFlag | RE.pressedFlag, color:"#A04040", frameColor:"#802080"},
			{state: RE.enabledFlag | RE.toggledFlag, color:"#8080A0", frameColor:"#A0A0F0"},	//	toggled normal
			{state: RE.enabledFlag | RE.toggledFlag | RE.highlightedFlag, color:"#80A0F0", frameColor:"#A0F0F0"},
			{state: RE.enabledFlag | RE.toggledFlag | RE.pressedFlag, color:"#6040A0", frameColor:"#6020F0"},
			//{state: 0, color:"#404040", frameColor:"#a0a0a0"},	//	disabled
		];
		but.setStateColors(statePairs);
		but.setStateFrameColors(statePairs);
		but.setToggles(true);
		//but.setEnabled(false);

		//	button 2
		but = rat.ui.makeCheapButton(null, new rat.graphics.Color(90, 180, 90));
		but.setPos(350, 12);
		but.setSize(100, 40);
		but.setTextValue("Close");
		s.appendSubElement(but);
		but.addTextToolTip("simple tooltip 2", rat.graphics.cyan, rat.graphics.darkGray, s);
		but.setCallback(function (element, userData)
		{
			//rat.screenManager.setUIRoot(null);
			rat.screenManager.popScreen();
		});

		//	sprite button
		but = rat.ui.makeSpriteButton("res/images/love.png", "res/images/love2.png", "res/images/love3.png");
		but.setPos(280, 90);
		but.setSize(16, 16);	//	this would not be needed if the image were preloaded...
		but.setScale(2, 2);	//	test
		s.appendSubElement(but);
		but.addTextToolTip("scaled sprite button", rat.graphics.cyan, rat.graphics.darkGray, s);
		but.setFrame(1, rat.graphics.red);

		//	bubble button
		but = new rat.ui.Button(rat.ui.Button.bubbleType, "res/images/bubblebox_normal.png", "res/images/bubblebox_high.png", "res/images/bubblebox_low.png");
		but.setPos(240, 200);
		but.setSize(69 * 2.7, 69);
		//but.setScale(2, 2);	//	test
		s.appendSubElement(but);
		but.addTextToolTip("bubble button", rat.graphics.cyan, rat.graphics.darkGray, s);
		but.setTextValue("Flip Global Scale");
		but.setCallback(function (element, userData)
		{
			if(rat.graphics.hasGlobalScale())
			{
				rat.graphics.clearGlobalScale();
			} else
			{
				rat.graphics.setGlobalScale(1.5, 1.5);
			}
		});

		//	simple sprite, animated
		var sp = new rat.ui.Sprite(["res/images/love.png", "res/images/love2.png", "res/images/love3.png"]);
		sp.setPos(200, 15);
		sp.imageRef.animSpeed = 10;
		s.appendSubElement(sp);
		sp.autoCenter();
		//console.log(sp.center.x);
		//console.log(sp.center.y);
		//sp.setClip(true);	//	broken

		//	animate test button
		but = new rat.ui.Button(rat.ui.Button.bubbleType, "res/images/bubblebox_normal.png", "res/images/bubblebox_high.png", "res/images/bubblebox_low.png");
		but.setPos(260, 300);	//	see below - we're using autoCenter
		but.setSize(140, 50);
		but.setScale(1.25, 1.25);	//	test scale
		//but.autoCenter();	//	test autocentering bubble boxes - broken
		s.appendSubElement(but);
		but.addTextToolTip("bubble button", rat.graphics.cyan, rat.graphics.darkGray, s);
		but.setTextValue("Animate");
		but.setCallback(function (element, userData)
		{
			var animator = new rat.ui.Animator(rat.ui.Animator.rotator, s);
			animator.setTimer(1);
			animator.setStartEnd(0, Math.PI / 8);
			animator.setAutoDie();	//	kill animator when it's done

			animator = new rat.ui.Animator(rat.ui.Animator.rotator, s);
			animator.setDelay(1);
			animator.setTimer(1);
			animator.setStartEnd(Math.PI / 8, 0);
			animator.setAutoDie();	//	kill animator when it's done
		});

		//	animate test button 2 - animate the button itself, and test button text colors
		but = new rat.ui.Button(rat.ui.Button.bubbleType, "res/images/bubblebox_normal.png", "res/images/bubblebox_high.png", "res/images/bubblebox_low.png");
		//var but = rat.ui.makeSpriteButton("res/images/love.png", "res/images/love2.png", "res/images/love3.png");
		//var but = rat.ui.makeCheapButton(null, new rat.graphics.Color(90, 180, 90));
		but.setPos(440, 200);
		but.setSize(140, 50);
		but.setTextColors(rat.graphics.gray, rat.graphics.yellow, rat.graphics.red);
		s.appendSubElement(but);
		but.addTextToolTip("click to animate me", rat.graphics.cyan, rat.graphics.darkGray, s);
		but.setTextValue("Animate Me");
		but.setCallback(function (element, userData)
		{
			var animator = new rat.ui.Animator(rat.ui.Animator.scaler, element);
			animator.setTimer(1);
			animator.setStartEnd(1, 2);
			animator.setAutoDie();	//	kill animator when it's done

			animator = new rat.ui.Animator(rat.ui.Animator.scaler, element);
			animator.setDelay(1);
			animator.setTimer(1);
			animator.setStartEnd(2, 1);
			animator.setAutoDie();	//	kill animator when it's done

			//	hey, let's also animate the sprite test we did...
			animator = new rat.ui.Animator(rat.ui.Animator.rotator, sp);
			animator.setTimer(2);
			animator.setStartEnd(0, 4 * Math.PI);
			animator.setAutoDie();	//	kill animator when it's done
		});
		//	test custom image function, but just set the same ones...
		//	Oh, hey, let's test animated state here..
		var stateImagePairs = [
			{state: RE.enabledFlag, resource:[
				"res/images/bubblebox_normal_f1.png",
				"res/images/bubblebox_normal_f2.png",
				"res/images/bubblebox_normal_f3.png"]},
			//	test passing in an existing imageref, as an alternative
			{state: RE.enabledFlag | RE.highlightedFlag, imageRef:rat.graphics.makeImage("res/images/bubblebox_high.png")},
			{state: RE.enabledFlag | RE.pressedFlag, resource:"res/images/bubblebox_low.png"},
		];
		but.setStateImages(stateImagePairs);
		var state = but.getMatchingState(RE.enabledFlag);
		if (state)
		{
			state.imageRef.setAnimSpeed(8);
			//state.imageRef.setAnimAutoReverse(true);
			state.imageRef.setAnimOneShot(true);	//	test
		}

		//	scaled container test
		var scont = new rat.ui.Screen();
		scont.setPos(450, 300);
		scont.setSize(100, 100);
		scont.setScale(1.5, 1.5);
		scont.setFrame(1, rat.graphics.yellow);
		//scont.addTextToolTip("box scaled 1.5", rat.graphics.cyan, rat.graphics.darkGray, s);
		s.appendSubElement(scont);

		mtbox = new rat.ui.TextBox("123");
		mtbox.setFont("arial bold");
		mtbox.setFontSize(20);
		mtbox.setPos(0, 80);
		mtbox.setSize(100, 20);
		mtbox.autoCenter();
		mtbox.setAlign(rat.ui.TextBox.alignCenter);
		mtbox.setFrame(1, rat.graphics.green);
		mtbox.setColor(new rat.graphics.Color(180, 180, 210));
		scont.appendSubElement(mtbox);

		but = rat.ui.makeCheapButton(null, rat.graphics.gray);
		but.setPos(20, 20);
		but.setSize(100, 20);
		but.setScale(1.2, 1.5);
		but.setTextValue("in scaled box");
		scont.appendSubElement(but);
		but.addTextToolTip("Test buttons inside scaled containers", rat.graphics.cyan, rat.graphics.darkGray, s);
		but.setCallback(function (element, userData)
		{
			rat.console.log("SSUB hit");
		});
		
		//	EditText
		//	auto center these, as a test of centering position of text boxes.
		var etX = 480 + 90;
		var etY = 20 + 12;
		var etbox = new rat.ui.EditText("Editable Text");
		etbox.setFont("Impact");
		etbox.setFontSize(20);
		etbox.setPos(etX, etY);
		etbox.setSize(180, 24);
		etbox.autoCenter();
		//etbox.setAlign(rat.ui.TextBox.alignRight);
		//etbox.setBaseline(rat.ui.TextBox.baselineMiddle);
		etbox.setColor(new rat.graphics.Color(220, 180, 180));
		s.appendSubElement(etbox);
		etbox.addTextToolTip("Editable Text", rat.graphics.cyan, rat.graphics.darkGray, s);
		//etbox.setUseOffscreen(true);
		
		//	EditText 2
		etbox = new rat.ui.EditText("");
		etbox.setFont("arial");
		etbox.setFontSize(30);
		etbox.setPos(etX, etY + 40);
		etbox.setSize(180, 34);
		etbox.autoCenter();
		etbox.setColor(new rat.graphics.Color(180, 180, 220));
		s.appendSubElement(etbox);
		etbox.addTextToolTip("Editable Text 2", rat.graphics.cyan, rat.graphics.darkGray, s);
		//	upside down text.  Pretty funny, but not very useful and not correct.
		//etbox.setRotation(Math.PI);

		//	done adding stuff!
		//	build input map for key/controller support
		s.autoBuildInputMap();

		//	let's animate this whole screen in.
		//	Do this AFTER we've set up everything, because this animation kicks in immediately,
		//	and we don't want all the positioning logic (and input map setup) to be affected by this animation.
		var animator = new rat.ui.Animator(rat.ui.Animator.mover, s);
		animator.setTimer(0.5);
		var startVal = { x: -200, y: -100 };
		var endVal = { x: EDGE, y: EDGE };
		animator.setStartEndVectors(startVal, endVal);
		animator.setAutoDie();	//	kill animator when it's done

		animator = new rat.ui.Animator(rat.ui.Animator.scaler, s);
		animator.setTimer(0.5);
		animator.setStartEndVectors({ x: 0.1, y: 0.1 }, { x: 1, y: 1 });
		animator.setAutoDie();	//	kill animator when it's done

		animator = new rat.ui.Animator(rat.ui.Animator.rotator, s);
		animator.setTimer(0.5);
		animator.setStartEnd(-Math.PI, 0);
		animator.setAutoDie();	//	kill animator when it's done


		//	set me up to update...

		rat.test.tests.push({
			update: rat.test.updateUITest,
			wrapTest1: { tbox: tbox, timer: 0, pos: 0, fullText:
				"This is a test\nof CR handling, especially\nwhen the text is changing\nover time\n..." },
			
			//wrapTest2: { tbox: autotextbox, timer: 0, pos: 0, fullText:
			//	"This is a test of autowrapping with one manual break here.\nThe rest is autowrapped by code..." },
			
			wrapTest2: { tbox: autotextbox, timer: 0, pos: 0, fullText:
				"借助煙霧彈隱身，隱去你. ?的蹤跡並在敵人間穿行。每次使用可獲得POWERUP_XP_GAIN點經驗。每局遊戲最多可使用ITEM_CAPACITY次。"},
			
			wrapTest3: { tbox: shortbox, timer: 0, pos: 0, fullText: "Some text which will squish when it's just barely too long, vertically.  But if it's way too long, it just eventually adds a line." },
		});

		//	temp debug- set global
		//gt = tbox;

		//	hide whole group..
		//s.setVisible(false);
	};

	rat.test.updateUITest = function (dt, testData)
	{
		function testText(data)
		{
			data.timer += dt;
			if(data.timer > 0.1)
			{
				data.timer = 0;
				data.pos++;

				var textValue = data.fullText.slice(0, data.pos);

				data.tbox.setTextValue(textValue);

				var len = data.fullText.length;
				if(data.pos === len)
					data.pos = 0;
			}
		}

		testText(testData.wrapTest1);
		testText(testData.wrapTest2);
		testText(testData.wrapTest3);
	};
} );