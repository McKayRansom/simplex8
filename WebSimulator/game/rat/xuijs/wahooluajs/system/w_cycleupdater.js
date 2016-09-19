// CycleUpdater
// Periodic updates
//
//	generated js from lua file and hand-edited
//
rat.modules.add( "rat.xuijs.wahooluajs.system.w_cycleupdater",
[
	{name: "rat.xuijs.wahooluajs.wahoolua", processBefore: true },
	{name: "rat.xuijs.wahooluajs.system.w_class", processBefore: true },
], 
function(rat)
{
	var WCycleUpdater = wahoolua.class();
	
	//	constructor
	WCycleUpdater.prototype.Ctor = function ()
	{
		WCycleUpdater.gUpdateList.push(this);	//	prepend instead? what does lua insert do?
	}
	WCycleUpdater.paused = false
	WCycleUpdater.gUpdateList = []
	
	WCycleUpdater.prototype.Dtor = function()
	{
		for (var i = 0; i < WCycleUpdater.gUpdateList.length; i++)
		{
			if (WCycleUpdater.gUpdateList[i] === this)
			{
				WCycleUpdater.gUpdateList.splice(i, 1);
				return;
			}
		}
		console.log("WLUA: couldn't find cycleupdater in list on delete");
	}
	
	WCycleUpdater.prototype.CycleUpdate = function(deltaTime)
	{
		assert(false, "CycleUpdater subclass failed to implement CycleUpdate function")
	}
	
	WCycleUpdater.prototype.Pause = function()
	{
		this.paused = true
	}
	
	WCycleUpdater.prototype.Resume = function()
	{
		this.paused = false
	}
	
	WCycleUpdater.CycleUpdateAll = function(deltaTime)
	{
		for (var i = 0; i < WCycleUpdater.gUpdateList.length; i++)
		{
			var u = WCycleUpdater.gUpdateList[i]
			if( u && u.paused != true ) {
				u.CycleUpdate(deltaTime)
			}
		}
	}
	
	WCycleUpdater.PauseAll = function()
	{
		for (var i = 0; i < WCycleUpdater.gUpdateList.length; i++)
		{
			var u = WCycleUpdater.gUpdateList[i]
			if( u ) {
				u.Pause()
			}
		}
	}
	
	WCycleUpdater.ResumeAll = function()
	{
		for (var i = 0; i < WCycleUpdater.gUpdateList.length; i++)
		{
			var u = WCycleUpdater.gUpdateList[i]
			if( u ) {
				u.Resume()
			}
		}
	}
	
	//	global access
	wahoolua.WCycleUpdater = WCycleUpdater;
	
});
