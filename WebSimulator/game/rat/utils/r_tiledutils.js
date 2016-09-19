//
//	Tiled utils (for tiled map editor)
//

rat.modules.add( "rat.utils.r_tiledutils",
[
	"rat.debug.r_console",
], 
function(rat)
{
	
	rat.tiledUtils = {
	};
	
	rat.tiledUtils.getNamedLayerIndex = function(data, name)
	{
		var layers = data['layers'];
		for (var i = 0; i < layers.length; i++)
		{
			if (layers[i]['name'] === name)
				return i;
		}
		
		return -1;	//	not found
	};
	
} );