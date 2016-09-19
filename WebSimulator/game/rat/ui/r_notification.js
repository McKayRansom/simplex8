// Popup notification class
// Handles tracking state and creation of various rat objects

// base constructor
rat.modules.add( "rat.ui.r_notification",
[
	{ name: "rat.ui.r_ui", processBefore: true },
	{ name: "rat.utils.r_utils", processBefore: true },
	
	"rat.debug.r_console",
	"rat.ui.r_screenmanager",
	"rat.ui.r_ui_animator",
], 
function(rat)
{
	//	constructor for a notification
	/** @constructor
	 * @extends rat.ui.Element */
	rat.ui.Notification = function (creationCallback, deathCallback, passArgs)	
	{
		rat.ui.Notification.prototype.parentConstructor.call(this);

		// setup default values
		this.style = rat.ui.Notification.FADE_TYPE;
		this.fadeInTime = 0.5;
		this.displayTime = 1;
		this.fadeOutTime = 0.5;
		this.minFadeAlpha = 0;
		this.maxFadeAlpha = 1;

		this.onDeath = deathCallback;

		// call the callback so I can be manipulated properly at creation (since I can't be created directly)
		creationCallback(this, passArgs);

		// TODO: make other types (other than fade) and change this code depending on that.
		//	STT: moved this here so the opacity is applied after subelements are created (since we want those affected)
		//	Aaaand now technically it's not needed.  I changed animators to do their thing when start/end is called.
		//this.setOpacityRecursive(0);	// start invisible or we flicker in

		// TODO: probably want to create our own Notification element and draw it explicitly (for flexibility)
		rat.screenManager.getTopScreen().appendSubElement(this);
		this.startAppear();
	};
	rat.utils.inheritClassFrom(rat.ui.Notification, rat.ui.Element);

	rat.ui.Notification.prototype.elementType = "rat_notification";
	// notification constants
	rat.ui.Notification.FADE_TYPE = 1;

	rat.ui.Notification.prototype.startAppear = function ()
	{
		var animator = new rat.ui.Animator(rat.ui.Animator.fader, this);
		animator.setTimer(this.fadeInTime);
		animator.setStartEnd(this.minFadeAlpha, this.maxFadeAlpha);
		animator.setAutoDie();
		animator.setDoneCallback(startDisappear);

		//rat.console.log("starting pop");
	};

	var startDisappear = function (notification, oldAnim)
	{
		var animator = new rat.ui.Animator(rat.ui.Animator.fader, notification);
		animator.setTimer(notification.fadeOutTime);
		animator.setStartEnd(notification.maxFadeAlpha, notification.minFadeAlpha);
		animator.setAutoDie();
		animator.setAutoRemoveTarget();
		animator.delay = notification.displayTime;
		animator.setDoneCallback(killNotification);

		//rat.console.log("ending pop");
	};

	var killNotification = function (notification, oldAnim)
	{
		//rat.console.log("killing pop");
		notification.onDeath(notification);

	};

	rat.ui.Notification.prototype.setDuration = function (duration)
	{
		this.displayTime = duration;
	};

	rat.ui.Notification.prototype.setLeadInOut = function (inTime, outTime)
	{
		this.fadeInTime = inTime;

		if(typeof outTime === "undefined")
			this.fadeOutTime = inTime;
		else
			this.fadeOutTime = outTime;
	};

	rat.ui.Notification.prototype.checkStacksWith = function (other)
	{
		var myPos = this.getPos();
		var theirPos = other.getPos();

		rat.console.log("Comparing two notes: (" + myPos.x + "," + myPos.y + ") and (" + theirPos.x + "," + theirPos.y + ")");
		return (myPos.x === theirPos.x && myPos.y === theirPos.y);
	};

	rat.ui.Notification.prototype.doStackWith = function (other)
	{
		var theirPos = other.getPos();
		var theirSize = other.getSize();

		rat.console.log("before bump: (" + theirPos.x + "," + theirPos.y + ") and height: " + theirSize.h);
		this.setPos(theirPos.x, theirPos.y - theirSize.h);

		var myPos = this.getPos();
		rat.console.log("After bump: (" + myPos.x + "," + myPos.y + ")");
	};
});