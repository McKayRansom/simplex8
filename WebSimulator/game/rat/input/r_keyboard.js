//
//	Keyboard management
//
//	Track what keys are down, and which keys are newly down.
//	Do this with bitfields, because I don't like the idea of so much wasted space.  Don't judge me.
//	Fairly untested?  No, I think it's been a while now...  probably working fine.
//
rat.modules.add( "rat.input.r_keyboard",
[
	{name: "rat.input.r_input", processBefore: true },
], 
function(rat)
{
	rat.input.keyboard = {

		MAX_KEY_CODE: 256,
		KEY_SLOTS: 8,
		//	these are collections of bitfields, for optimal performance and use of space
		rawKeys: [0, 0, 0, 0, 0, 0, 0, 0],
		newKeys: [0, 0, 0, 0, 0, 0, 0, 0],
		lastKeys: [0, 0, 0, 0, 0, 0, 0, 0],

		update : function(dt)
		{
			var kb = rat.input.keyboard;
			for( var i = 0; i < kb.KEY_SLOTS; i++ )
			{
				kb.newKeys[i] = kb.rawKeys[i] & ~kb.lastKeys[i];	//	flag which keys were newly down this frame
				kb.lastKeys[i] = kb.rawKeys[i];
			}
		},

		handleKeyDown: function(e)	//	handle raw system event
		{
			var which = rat.input.getEventWhich(e);
			var slot = rat.math.floor(which / 32);
			var bit = which - slot * 32;

			rat.input.keyboard.rawKeys[slot] |= (1 << bit);
		},

		handleKeyUp: function(e)
		{
			var which = rat.input.getEventWhich(e);
			var slot = rat.math.floor(which / 32);
			var bit = which - slot * 32;

			rat.input.keyboard.rawKeys[slot] &= ~(1 << bit);
		},

		isKeyDown: function(keyCode)
		{
			var slot = rat.math.floor(keyCode / 32);
			var bit = keyCode - slot * 32;
			if (rat.input.keyboard.rawKeys[slot] & (1 << bit))
				return true;
			else
				return false;
		},

		//	think about doing ui event handling instead, which is more reliable and filtered by active screen
		isKeyNewlyDown: function(keyCode)
		{
			var slot = rat.math.floor(keyCode / 32);
			var bit = keyCode - slot * 32;
			if (rat.input.keyboard.newKeys[slot] & (1 << bit))
				return true;
			else
				return false;
		},

	};
});