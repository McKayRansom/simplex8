//
//	Rat event map module
//
//	Handle registering and firing events for the designers to respond to.
//
//	Based somewhat on Wraith, but not as featureful
//
rat.modules.add( "rat.utils.r_eventmap",
[
	"rat.debug.r_console",
], 
function(rat)
{
	rat.eventMap = {};
	
	var events = {};
	
	//	Register new event handler.
	rat.eventMap.register = function( eventName, func )
	{
		//	No point to register if no func.
		if( !func )
			return;
		eventName = eventName.toUpperCase();
		
		//	First handler?
		if( !events[eventName] )
			events[eventName] = [func];
		else
			events[eventName].push( func );
	};
	rat.eventMap.registerHandler = rat.eventMap.register;
	rat.eventMap.add = rat.eventMap.register;
	
	//	Fire an event 
	rat.eventMap.fireEvent = function( eventName, forObj )
	{
		eventName = eventName.toUpperCase();
		var eventList = events[eventName];
		if( !eventList )
			return;
		var args = Array.prototype.slice.call(arguments);
		args.splice(0, 2);
		//	Should i add the eventName?
		var endAt = eventList.length;
		for( var index = 0; index < endAt; ++index )
			eventList[index].apply( forObj, args );
	};
	rat.eventMap.fire = rat.eventMap.fireEvent;
	
} );