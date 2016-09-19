//
//	An os event registration and dispatch system
//
rat.modules.add( "rat.os.r_events",
[ ], 
function(rat)
{
	rat.events = rat.events || {};
	rat.events.registered = {};	//	key is event name.   value is an array 
	rat.events.firing = {};		//	if we are firing an event, hold the data that will allow safe removal of events.
	rat.events.queued = rat.events.queued || {};
	
	/// Register a new event listener
	rat.addEventListener = function( event, func, ctx )
	{
		if( !func )
			return;
		rat.events.registered[event] = rat.events.registered[event] || [];
		var listeners = rat.events.registered[event];
		listeners.push({
			func: func,
			ctx: ctx
		});
		
		//	Some special handling for events that where queued until we got a listener
		if( rat.events.queued[event] )
		{
			rat.events.fire.apply( rat.events, rat.events.queued[event] ); // queued is an array.  Inlcudes the name of the event.
			rat.events.queued[event] = void 0;
		}
	};
	
	/// UnRegister an event listener
	rat.removeEventListener = function( event, func, ctx )
	{
		if( !func )
			return false;
		var listeners = rat.events.registered[event];
		if( !listeners )
			return false;
		
		//	Search
		var firing = rat.events.firing[event];
		var listener;
		for( var index = 0; index !== listeners.length; ++index )
		{
			listener = listeners[index];
			if( listener.func === func && listener.ctx === ctx )
			{
				//	Make sure that any events that we are already firing are ok
				if( firing )
				{
					if( firing.index <= index )
						--firing.index;
					--firing.stopAt;
				}
				
				//	Remove the event.
				listeners.splice( index, 1 );
				return true;
			}
		}
		
		//	Not found
		return false;
	};
	
	//	Queue an event until we have added a listener
	rat.events.queueEvent = function (event /*,[arg, arg, ...]*/)
	{
		var fireArgs = Array.prototype.slice.call(arguments);
		var listeners = rat.events.registered[event];
		if (listeners && listeners.length)
			rat.events.fire.apply(rat.events, fireArgs);
		else
			rat.events.queued[event] = fireArgs;
	};
	
	//	Fire an event
	rat.events.fire = function (event /*,[arg, arg, ...]*/)
	{
		var listeners = rat.events.registered[event];
		if( !listeners || listeners.length === 0 )
			return false;
		var args = Array.prototype.slice.call(arguments, 1);
		var savedFiring = rat.events.firing[event];
		
		//	We use this object so we can safely remove objects while iterating over an array
		rat.events.firing[event] = {
			index: 0,
			stopAt: listeners.length
		};
		var firing = rat.events.firing[event];
		var listener, func, ctx;
		for( ; firing.index !== firing.stopAt; ++firing.index )
		{
			listener = listeners[firing.index];
			func = listener.func;
			ctx = listener.ctx;
			func.apply( ctx, args );
			
			///TODO Add some system where we can stop any more events from firing..
		}
		
		rat.events.firing[event] = savedFiring;
	};
	
});