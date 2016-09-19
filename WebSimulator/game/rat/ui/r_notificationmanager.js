// Popup notification manager
// manages notification popups to make sure they activate and operate properly
rat.modules.add( "rat.ui.r_notificationmanager",
[
	{ name: "rat.ui.r_ui", processBefore: true },
	"rat.debug.r_console",
	"rat.ui.r_notification",
], 
function(rat)
{
	/** @constructor */
	rat.ui.NotificationManager = function ()	//	constructor for particle system
	{
		this.active = [];
		this.waiting = [];
		this.maxActive = 1;
	};

	// request a new notification (with a function to customize it
	rat.ui.NotificationManager.prototype.requestNotification = function (callback, passedArgs)
	{
		// create the new notification with it's associated callbacks

		if(this.active.length < this.maxActive)
		{
			// set it active
			this.startNotification(callback, passedArgs);
		}
		else
		{
			// queue up the notification
			this.enqueueNotification(callback, passedArgs);
		}
	};

	rat.ui.NotificationManager.prototype.startNotification = function (callback, passedArgs)
	{
		var newNotification = new rat.ui.Notification(callback, this.killNotification.bind(this), passedArgs);

		// check for stacking behavior
		for(var i = 0; i < this.active.length; i++)
		{
			if(newNotification.checkStacksWith(this.active[i]))
			{
				newNotification.doStackWith(this.active[i]);
			}
		}

		// last add it in to active list
		this.active.splice(this.active.length, 0, newNotification);
	};

	rat.ui.NotificationManager.prototype.enqueueNotification = function (notification, passedArgs)
	{
		this.waiting.splice(this.waiting.length, 0, { callback: notification, args: passedArgs });
	};

	rat.ui.NotificationManager.prototype.dequeueNotification = function ()
	{
		var newNotification = this.waiting[0];
		this.waiting.splice(0, 1);

		return newNotification;
	};

	// request a new notification (with a function to customize it
	rat.ui.NotificationManager.prototype.killNotification = function (notification)
	{
		// delist the notification and remove from parent (removeFromParent)
		for(var i = 0; i < this.active.length; i++)
		{
			if(this.active[i] === notification)
			{
				this.active.splice(i, 1);
				break;
			}
		}

		if(this.waiting.length > 0)
		{
			// dequeue and start the next notification if it exists
			var notif = this.dequeueNotification();
			this.startNotification(notif.callback, notif.args);
		}
	};

	rat.ui.NotificationManager.prototype.setMaxActive = function (active)
	{
		this.maxActive = active;
	};

	rat.ui.NotificationManager.prototype.clearActive = function ()
	{
		this.waiting = [];
	};

	rat.ui.NotificationManager.prototype.clearWaiting = function ()
	{
		this.active = [];
	};

	rat.ui.NotificationManager.prototype.clearAll = function ()
	{
		this.clearActive();
		this.clearWaiting();
	};
	// TODO: handle in other ways (like stacking?)
});
