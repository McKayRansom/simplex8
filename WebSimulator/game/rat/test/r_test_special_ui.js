//
//	Test special ui elements
//

//	build test screen
rat.modules.add( "rat.test.r_test_special_ui",
[
	{ name: "rat.test.r_test", processBefore: true },
	
	"rat.graphics.r_graphics",
	"rat.ui.r_screen",
	"rat.ui.r_screenmanager",
	"rat.ui.r_ui_textbox",
	"rat.ui.r_ui_fillbar",
	"rat.ui.r_ui_spiderchart",
	"rat.ui.r_ui_treeview",
	"rat.ui.r_ui",
],
function(rat)
{
	rat.test.setupSpecialUITest = function ()
	{
		var screenWidth = rat.graphics.SCREEN_WIDTH;
		var screenHeight = rat.graphics.SCREEN_HEIGHT;

		var container = new rat.ui.Screen();
		container.setPos(0, 0);
		container.setSize(screenWidth, screenHeight);

		rat.screenManager.setUIRoot(container);

		var mtbox = new rat.ui.TextBox("Test: Special UI");
		mtbox.setFont("arial bold");
		mtbox.setFontSize(20);
		mtbox.setPos(0, 12);
		mtbox.setSize(screenWidth, 30);
		mtbox.setAlign(rat.ui.TextBox.alignCenter);
		mtbox.setFrame(1, rat.graphics.yellow);
		mtbox.setColor(new rat.graphics.Color(180, 180, 210));
		container.appendSubElement(mtbox);

		//	fillbar
		var fbar = new rat.ui.FillBar();
		fbar.setPos(20, 70);
		fbar.setSize(200, 20);
		fbar.setFill(25, 100);
		//	back, body, frame
		fbar.setColors(rat.graphics.green, rat.graphics.yellow, rat.graphics.red);
		container.appendSubElement(fbar);

		//	spider chart
		var schart = new rat.ui.SpiderChart();
		schart.setPos(20, 100);
		schart.setSize(200, 200);
		schart.setData({
			normalize: true,	//	normalize and fill visual space
			normalizeScale: 0.9,	//	but don't go to full edge - go 90% out

			drawAxes: {
				color: rat.graphics.gray,
				scale: 0.95,	//	just scales total axis lines, not hash marks, which need to use normalizescale above to match data
				hashColor: new rat.graphics.Color(0xA0, 0xA0, 0xA0, 0.3),	//	rat.graphics.lightGray,
				hashCount: 5,
				hashLines: true,	//	draw full lines, or just little marks?
			},

			//	data sets
			sets: [

				{
					fillColor: new rat.graphics.Color(0x80, 0x80, 0xFF, 0.3),
					strokeColor: rat.graphics.blue,
					strokeWidth: 2,
					points: [4, 5, 2, 3, 4, 6],
				},

				/*
				{
					//fillColor: rat.graphics.green,
					strokeColor: rat.graphics.violet,
					strokeWidth: 2,
					points: [3, 6, 3, 3, 4, 5],
				},
				*/

				{
					//fillColor: rat.graphics.yellow,
					fillColor: new rat.graphics.Color(0xFF, 0x80, 0x80, 0.3),
					strokeColor: rat.graphics.red,
					strokeWidth: 2,
					points: [3, 6, 4, 4, 3, 4],
				},


			],
		});

		container.appendSubElement(schart);
		
		//	tree view
		var tview = new rat.ui.TreeView(container);
		tview.setPos(260, 100);
		tview.setSize(200, 200);
		tview.setTreeValues(
			{
				label: "root",
				children:
				[
					{label: '1 - one'},
					{label: '2 - two',
						children: [
							{label: '2a'},
							{label: '2b'},
						],
					},
					{label: '3 - three'},
				],
			}
		);
		
		//	set me up to update...

		rat.test.tests.push({
			update: rat.test.updateSpecialUITest,
			data1: { data: null },
		});

	};

	rat.test.updateSpecialUITest = function (dt, testData)
	{
		//	something?
	};
} );