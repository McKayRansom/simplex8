//
//	Rat timers.  A timer calls a provided function after the specified time.
//	USAGE:
//
//		var myTimer = new rat.timer(function(theTimer, theParam) {...}, 3, "myCustomData");
//		myTimer.autoUpdate();
//
//	This "autoUpdate()" is interesting.  It'd be easier if that happened by default.
//		and you could optionally pass an argument saying you don't want that?
//		how often do we not want timers to automatically update?
//		maybe we need a simple "makeTimer" function that does it automatically?
//
///	@todo: make autoUpdate the default, and support another argument suppressing that, since that's the exception.
//
//	@todo: since this is a constructable object, should use capital "Timer"

//------------ rat.cycleUpdate ----------------
rat.modules.add( "rat.utils.r_timer",
[
	"rat.debug.r_console",
], 
function(rat)
{
	/**
	 * A timer that calls the function at the specified delay.
	 * @param {function(rat.timer, ?)} func the function to call. The first
	 *	argument is the timer that went off. The second is param2 provided here.
	 * @param {number} delay when, from now, will the function be called.
	 * @param {?} param2 the second parameter of the function to call.
	 * @constructor
	 */
	rat.timer = function(func, delay, param2)
	{
		this.func = func;
		this.param2 = param2;
		this.currentTime = 0;
		this.delay = delay;
		this.flags = 0;
	};
	
	/**
	 * Sets a function to be called after the delay.
	 * @param {function(rat.timer, ?)} func the function to call. The first
	 *	argument is the timer that went off. The second is param2 provided here.
	 * @param {number} delay when, from now, will the function be called.
	 * @param {?} param2 the second parameter of the function to call.
	 * @return {rat.timer} timer to handle the delayed call.
	 */
	rat.setTimeout = function(func, delay, param2)
	{
		var timer = new rat.timer(func, delay, param2);
		timer.autoUpdate();
		return timer;
	};
	
	/**
	 * Sets a function to be called repeatedly with a fixed time between calls.
	 * @param {function(rat.timer, ?)} func the function to call. The first
	 *	argument is the timer that went off. The second is param2 provided here.
	 * @param {number} delay fixed time between calls.
	 * @param {?} param2 the second parameter of the function to call.
	 * @return {rat.timer} timer to handle the calls.
	 */
	rat.setInterval = function(func, delay, param2)
	{
		var timer = new rat.timer(func, delay, param2);
		timer.setRepeat(true);
		timer.autoUpdate();
		return timer;
	};
	
	/**
	 * Flag constants
	 */
	var FLAG_REPEAT = 0x0001; // Tells the timer to repeate.
	var FLAG_PAUSED = 0x0002; // Pauses the timer.
	var FLAG_FIRED = 0x4000; // Marks that the timer has fired.
	var FLAG_DEAD = 0x8000; // Marks that the timer to be removed from auto updating.
	
	/**
	 * Sets if the timer should repeate.
	 * @param {boolean} repeat
	 */
	rat.timer.prototype.setRepeat = function(repeat)
	{
		if(repeat)
			this.flags |= FLAG_REPEAT;
		else
			this.flags &= ~FLAG_REPEAT;
	};
	
	/**
	 * Sets if the timer is paused.
	 * @param {boolean} pause
	 */
	rat.timer.prototype.setPause = function(pause)
	{
		if(pause)
			this.flags |= FLAG_PAUSED;
		else
			this.flags &= ~FLAG_PAUSED;
	};
	
	/**
	 * Updates the timer's time.
	 * @param {number} deltaTime
	 */
	rat.timer.prototype.update = function(deltaTime)
	{
		if(!(this.flags & (FLAG_PAUSED | FLAG_FIRED | FLAG_DEAD)))
		{
			this.currentTime += deltaTime;
			if(this.currentTime >= this.delay)
				this.callNow();
		}
	};
	
	/**
	 * Sets the timer to automatically update.
	 * These timers are not guaranteed to update in any order.
	 */
	rat.timer.prototype.autoUpdate = function()
	{
		// If we are adding a dead timer to automatically update, I think the
		// caller wants it to be called again.
		this.flags &= ~FLAG_DEAD;
		this.flags &= ~FLAG_FIRED;
		
		rat.timerUpdater.timers.push(this);
	};
	
	/**
	 * Sets the timer to stop automatically updating.
	 * (marks dead - will get removed from autoupdate list when that list is next processed)
	 * It's OK to call this from within the timer's update function.
	 */
	rat.timer.prototype.endAutoUpdate = function()
	{
		
		this.flags |= FLAG_DEAD;
	};
	
	/**
	 * Sets off the timer now to run the function.
	 */
	rat.timer.prototype.callNow = function()
	{
		this.func(this, this.param2);
		
		if(this.flags & FLAG_REPEAT)
			this.currentTime = 0;
		else
		{
			this.flags |= FLAG_DEAD;
			this.flags |= FLAG_FIRED;
		}
	};
	
	/**
	 * Tracks which timers to automatically update.
	 */
	rat.timerUpdater = {
		/**
		 * @type {Array.<rat.timer>} Holds the timers to automatically update.
		 */
		timers: [],
	};
	
	/**
	 * Run all of the auto-updating timers.
	 * @param {number} deltaTime
	 */
	rat.timerUpdater.updateAll = function (deltaTime)
	{
		for(var index = this.timers.length - 1; index >= 0; --index)
		{
			var timer = this.timers[index];
			
			//	Update timer.  Note that paused/dead timers don't really update (see update function)
			//	STT note: maybe do that check here in case somebody overrides update function?
			timer.update(deltaTime);
			
			//	if the timer is now dead (e.g. from the update step, or something else)
			//	then remove it from our update list.
			if(timer.flags & FLAG_DEAD)
			{
				// remove the dead timer by switching it with the one at the
				// end of the list and popping.
				this.timers[index] = this.timers[this.timers.length - 1];
				this.timers.pop();
			}
		}
	};
	
	/**
	 * Tests the timers.
	 */
	rat.timerUpdater.test = function()
	{
		rat.setTimeout(function(){ rat.console.log("2 seconds once"); }, 2);
		rat.setInterval(function(timer, string){ rat.console.log(string); }, 3, "Every 3 seconds.");
	};
} );