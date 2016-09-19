//
//	Test graphics elements (UI)
//
rat.modules.add( "rat.test.r_test",
[], 
function(rat)
{
	rat.test = {
		tests: [],

		update : function (dt)
		{
			if (!rat.test.tests)
				return;
			for (var i = 0; i < rat.test.tests.length; i++)
			{
				if (rat.test.tests[i].update)
					rat.test.tests[i].update(dt, rat.test.tests[i]);
			}
		},
	};
} );