//
//	backwards compatibility support for rat.
//	This module should be included (in html or bootstrap code or compile lists) AFTER all other rat modules,
//	so it can add a bunch of backwards compatibility references to rat objects.
//	In general, as things move or get renamed, new items will get added to this list, but the oldest ones should get cleaned up as well, as we stop using old names.
//
rat.modules.add( "rat.r_backcompat",
[
	{name: "rat.ui.r_ui", processBefore: true },
	{name: "rat.ui.r_ui_animator", processBefore: true },
	{name: "rat.ui.r_ui_bubblebox", processBefore: true },
	{name: "rat.ui.r_ui_fillbar", processBefore: true },
	{name: "rat.ui.r_ui_scrollview", processBefore: true },
	{name: "rat.ui.r_ui_shape", processBefore: true },
	{name: "rat.ui.r_ui_textbox", processBefore: true },
	{name: "rat.ui.r_notification", processBefore: true },
	{name: "rat.ui.r_notificationmanager", processBefore: true },
], 
function(rat)
{
	rat.graphics.Element = rat.ui.Element;
	rat.graphics.Animator = rat.ui.Animator;
	rat.graphics.BubbleBox = rat.ui.BubbleBox;
	rat.graphics.Button = rat.ui.Button;
	rat.graphics.FillBar = rat.ui.FillBar;
	rat.graphics.ScrollView = rat.ui.ScrollView;
	rat.graphics.ShapeElement = rat.ui.Shape;
	rat.graphics.Sprite = rat.ui.Sprite;
	rat.graphics.TextBox = rat.ui.TextBox;
	rat.graphics.TranslatedTextBox = rat.ui.TranslatedTextBox;

	rat.graphics.Notification = rat.ui.Notification;
	rat.graphics.NotificationManager = rat.ui.NotificationManager;

	rat.graphics.noShape = rat.ui.noShape;
	rat.graphics.circleShape = rat.ui.circleShape;
	rat.graphics.squareShape = rat.ui.squareShape;
	rat.graphics.pathShape = rat.ui.pathShape;
} );
