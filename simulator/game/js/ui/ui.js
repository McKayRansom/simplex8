//
//	General ui functionality and data shared by various screens
//

rat.modules.add( "js.ui.ui",
[
	{name:"rat.graphics.r_color", processBefore:true},
	"rat.ui.r_ui",
],
function(rat)
{
	var ui = {
		
		//	fonts to use:
		//	banksiabold
		
		menus : {
			buttonHeight: 96,	//	height of actual button art, and therefore buttons
			buttonGap: 32,		//	space between buttons
			buttonWidth: 520,	//	width of normal button
			
			buttonColor : new rat.graphics.Color(255, 133, 0),
			
			buttonFont: {font:'banksiabold', style:'bold', size:80, color:new rat.graphics.Color(77, 40, 0)},
			titleFont: {
				font:'banksiabold', style:'', size:196, color:new rat.graphics.Color(175, 188, 255),
				stroke: {width:8, color:new rat.graphics.Color(0, 12, 72), doCleanup:false},
			},
			headingFont: {font:'banksiabold', style:'bold', size:46, color:new rat.graphics.Color(255, 186, 112)},
			mainFont: {font:'banksiabold', style:'', size:56, color:new rat.graphics.Color(175, 188, 255)},	//	normal text
			
			tipFont: {font:'banksiabold', style:'', size:36, color:new rat.graphics.Color(220, 220, 200)},	//	normal text
			
			titleOffset : 80,
			backButtonOffset : 300,	//	how far up from bottom to put a back button
		},
		
		curScreen: null,
		snapScreen: null,
		
		lastSize : {x:rat.graphics.SCREEN_WIDTH, y:rat.graphics.SCREEN_HEIGHT},
		
		screenColor : new rat.graphics.Color(32, 67, 255),
		screenBorderColor : new rat.graphics.Color(130, 130, 130),
		
	};
	ui.menuButtonSpacing = {x:ui.menus.buttonWidth + ui.menus.buttonGap, y:ui.menus.buttonHeight + ui.menus.buttonGap};
	
	//	one-time game ui init
	ui.init = function()
	{
		//	override global button inset amount for all buttons
		rat.ui.Button.setDefaultTextInset(40);
	};

	//	Create a standard button
	ui.makeButtonAt = function(container, title, x, y, optColor)
	{
		var uiSet = ui.menus;
		var color = optColor;
		if (!color)
			color = uiSet.buttonColor;
		
		var but = rat.ui.makeCheapButton(null, color);
		//	center at this pos
		but.setPos(x - uiSet.buttonWidth/2, y - uiSet.buttonHeight/2);
		but.setSize(uiSet.buttonWidth, uiSet.buttonHeight);
		but.setTextValue(title);
		
		but.setFont(uiSet.buttonFont.font);
		but.setFontStyle(uiSet.buttonFont.style);
		but.setFontSize(uiSet.buttonFont.size);
		but.setTextColors(uiSet.buttonFont.color, uiSet.buttonFont.color, uiSet.buttonFont.color);
		
		container.appendSubElement(but);
		
		return but;
	};
	
	//	Create a standard title box
	ui.makeTitleBox = function(container, titleText)
	{
		var uiSet = ui.menus;
		
		var tfont = uiSet.titleFont;
		
		var tbox = new rat.ui.TextBox(titleText);
		tbox.setPos(0, uiSet.titleOffset);
		tbox.setSize(container.getSize().w, tfont.size);

		tbox.setFont(tfont.font);
		tbox.setFontStyle(tfont.style);
		tbox.setFontSize(tfont.size);
		tbox.setColor(tfont.color);
		
		if (tfont.stroke)
			tbox.setStroke(tfont.stroke.width, tfont.stroke.color, tfont.stroke.doCleanup);

		tbox.centerText();
		container.appendSubElement(tbox);
		return tbox;
	};
	
	//	Create a standard heading text box
	ui.makeHeading = function(container, titleText, x, y)
	{
		var uiSet = ui.menus;
		
		var tbox = new rat.ui.TextBox(titleText);
		tbox.setPos(x - 300/2, y - 40/2);	//center here
		tbox.setSize(300, 40);

		tbox.setFont(uiSet.headingFont.font);
		tbox.setFontStyle(uiSet.headingFont.style);
		tbox.setFontSize(uiSet.headingFont.size);
		tbox.setColor(uiSet.headingFont.color);

		tbox.centerText();
		container.appendSubElement(tbox);
		return tbox;
	};
	
	//	make a standard text object
	ui.makeText = function(container, text, x, y)
	{
		var uiSet = ui.menus;
		
		var edgeSpace = 50;
		var tbox = new rat.ui.TextBox(text);
		var w = container.getSize().w - edgeSpace*2;
		if (typeof x !== 'undefined')
			tbox.setPos(x - w/2, y - edgeSpace);	//center here
		tbox.setSize(w, uiSet.mainFont.size);

		tbox.setFont(uiSet.mainFont.font);
		tbox.setFontStyle(uiSet.mainFont.style);
		tbox.setFontSize(uiSet.mainFont.size);
		tbox.setColor(uiSet.mainFont.color);

		tbox.centerText();
		container.appendSubElement(tbox);
		return tbox;
	};
	
	//	global ui resize handler - may be useful
	ui.resizeHandler = function()
	{
		//console.log("resize handler");
	};

	//	globally accessible namespace
	window.ui = ui;

});
