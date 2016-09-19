// Allow a class to handle a list of timers without having to keep track of each one individually or annoyingly,
//    but without having to deal with the threading issues
//
//	generated js from lua file and hand-edited
//
rat.modules.add( "rat.xuijs.wahooluajs.events.w_timerhandler",
[
	{name: "rat.xuijs.wahooluajs.wahoolua", processBefore: true },
	{name: "rat.xuijs.wahooluajs.system.w_class", processBefore: true },
], 
function(rat)
{
	// local constants
	var DURATION = 'orig_t'
	var TIME_LEFT = 't_left'
	var REPEAT = 'repeat'
	var CALLBACK = 'cb'
	
	var WTimerHandler = wahoolua.class();
	
	//	constructor
	WTimerHandler.prototype.Ctor = function ()
	{
		WTimerHandler.gUpdateList.push(this);	//	prepend instead? what does lua insert do?
		this.paused = false;
		this.timers = {};	//	hash, not list.  see below.
	}
	WTimerHandler.gUpdateList = [];
	
	WTimerHandler.prototype.Dtor = function()
	{
		this.ResetTimers()
		for (var i = 0; i < WTimerHandler.gUpdateList.length; i++)
		{
			if (WTimerHandler.gUpdateList[i] === this)
			{
				WTimerHandler.gUpdateList.splice(i, 1);
				return;
			}
		}
		console.log("WLUA: couldn't find cycleupdater in list on delete");
	}
	
	WTimerHandler.UpdateAllTimerHandlers = function(deltaTime)
	{
	
		//profiler = Profiling.Profiler.new("Update All Timer Handlers")
	
		for (var i = 0; i < WTimerHandler.gUpdateList.length; i++)
		{
			WTimerHandler.gUpdateList[i].UpdateTimers(deltaTime)
		}
		
		//profiler.End()
	 }
	
	WTimerHandler.prototype.UpdateTimers = function(deltaTime)
	{
		if( !this.paused ) {
			for (var key in this.timers) {
				var v = this.timers[key];
				if (!v)	//	has it been cleared?  see StopTimer() below
					continue;
				v[TIME_LEFT] = v[TIME_LEFT] - deltaTime
				if( v[TIME_LEFT] <= 0 ) {	// timer done
					v[CALLBACK]()	// call the callback function
					
					if( v[REPEAT] ) {
						v[TIME_LEFT] = v[DURATION]	//reset and go around again
					} else {
						this.StopTimer(key)
					}
				}
			}
		}
	}
	
	WTimerHandler.prototype.StartTimer = function(name, length, callback, repeated)
	{
		var t = {};
		
		t[DURATION]=length;
		t[TIME_LEFT]=length;
		t[REPEAT]=repeated;
		t[CALLBACK]=callback;
		
		this.timers[name] = t;
	}
	
	WTimerHandler.prototype.GetTimeLeft = function(name)
	{
		if( this.timers[name] ) {
			return [this.timers[name][TIME_LEFT]]
		}
		
		return [-1]
	}
	
	WTimerHandler.prototype.StopTimer = function(name)
	{
		//	remove from the hash entirely.
		//	note that this was a nil assignment in lua, but in JS it needs to be different.
		//	we don't want a nil value, we want it deleted.
		//	UGH, but this is called inside an iterator, and we don't want to mess that up.
		//	So, different behavior in lua:  leave it in the table, but set to null.
		//	delete this.timers[name];
		this.timers[name] = null;
	}
	
	WTimerHandler.prototype.PauseTimers = function()
	{
		this.paused = true
	}
	
	WTimerHandler.prototype.ResumeTimers = function()
	{
		this.paused = false
	}
	
	WTimerHandler.prototype.ResetTimers = function()
	{
		this.timers = {};
	}
	
	//	global access
	wahoolua.WTimerHandler = WTimerHandler;
		
});
