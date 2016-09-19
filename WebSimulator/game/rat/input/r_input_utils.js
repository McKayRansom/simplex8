//
//	Input utilities
//
//	This is a collection of functions that we end up needing in many games.
//	An example of this, is Is this UIEvent a direction, or get a vec for the direction pressed
//
rat.modules.add( "rat.input.r_input_utils",
[
	{name: "rat.input.r_input", processBefore: true},
	
	"rat.debug.r_console",
], 
function(rat)
{
	//rat.console.log("SLD rat.input.utils");

	rat.input.utils = {};
	
	/// Return if the given rat event is a UI direction event.
	rat.input.utils.isUIDirection = function(ratEvent)
	{
		if( ratEvent.eventType !== "ui" )
			return false;
		var which = ratEvent.which;
		return	which === "left" ||
				which === "right" ||
				which === "up" ||
				which === "down";
	};
	
	/// Map a ui event to a value
	rat.input.utils.mapUIEventToValue = function( ratEvent, mapping )
	{
		if( ratEvent.eventType !== "ui" )
			return mapping.defaultVal;
		return mapping[ratEvent.which] || mapping.defaultVal;
	};

	/// Mapping of UI direction to direction vector
	var uiDirectionMapping = {
		"left":		{ x: -1, y:  0},
		"right":	{ x:  1, y:  0},
		"up":		{ x:  0, y: -1},
		"down":		{ x:  0, y:  1},
		"default":	{ x:  0, y:  0}
	};
	
	/// Return a direction (x,y) based on a UI event
	rat.input.utils.getUIEventDirection = function(ratEvent)
	{
		return rat.input.utils.mapUIEventToValue( ratEvent, uiDirectionMapping );
	};
	
} );
