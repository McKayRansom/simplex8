rat.modules.add("rat.utils.r_utils_test",
[
	{ name: "rat.utils.r_utils", processBefore: true },
],
function (rat)
{
	if (!rat.system.has.unitTest)
		return;
	
	rat.unitTest.group( "r_utils" );
	
	rat.unitTest.test( "rat.utils.inheritClassFrom", function(assert)
	{
		/// @constructor
		function Parent()
		{
			this.pVal2 = 2;
		}
		Parent.prototype.pVal1 = 1;
		/// @constructor
		function Child()
		{
			Child.prototype.parentConstructor.call(this);
			this.cVal2 = 2;
		}
		Child.prototype.cVal1 = 1;
		
		rat.utils.inheritClassFrom( Child, Parent );
		assert.ok( Child.prototype.pVal1 == 1, "Got parent prototype property" );
		var child = new Child();
		assert.ok( child.pVal2 == 2, "Got parent constructor-assigned property" );
	});

	/*
	//	testing objectToString
	var xx = {name:"hey", count:12, subObject:{x:1, y:null}, ar: [1, 2, 'str'], ar2: [{u:1, v:2}, [8,9,0]]};
	var outxx = rat.utils.objectToString(xx, "xx");
	rat.console.log("----");
	rat.console.log(outxx);
	rat.console.log("----");
	*/
	
	rat.unitTest.group();
});