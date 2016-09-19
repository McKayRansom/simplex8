//
//	Rat cycle updating library. Registers function to call once per frame
//
//	Note that the order in which functions will be called in NOT guaranteed.
//

//------------ rat.cycleUpdate ----------------
rat.modules.add( "rat.utils.r_cycleupdate",
[], 
function(rat)
{
	/** CycleUpdate module */
	rat.cycleUpdate = {
		updaters: []/* Holds {func:<func>, withThis:<thisObj>}*/
	};
	var updaters = rat.cycleUpdate.updaters;
	var cUpdating = false;
	
	/**
	 * Register a function that will be ran once per frame
	 * @param {function(number)} updateFunc
	 */
	rat.cycleUpdate.addUpdater = function (updateFunc)
	{
		if( updateFunc )
			updaters.push(updateFunc);
	};

	/**
	 * Unregister the update function
	 * @param {function(number)} updateFunc that was previously registered
	 */
	rat.cycleUpdate.removeUpdater = function (updateFunc)
	{
		if(updateFunc)
		{
			//	Search
			var atIndex = updaters.indexOf(updateFunc);

			//	Found? Only clear it if we are updating, or remove it now
			if(atIndex !== -1)
			{
				if(!cUpdating)
					updaters.splice(atIndex, 1);
				else
					updaters[atIndex] = void 0;
			}
		}
	};

	/**
	 * Run all of the registered update functions
	 * @param {number} deltaTime
	 */
	rat.cycleUpdate.updateAll = function (deltaTime)
	{
		cUpdating = true;
		for(var index = updaters.length - 1; index >= 0; --index)
		{
			//	If we hit a non-existent updater, it was remove, so remove it now
			if(!updaters[index])
				updaters.splice(index, 1);
			else
				updaters[index](deltaTime);
		}
		cUpdating = false;
	};

	
} );