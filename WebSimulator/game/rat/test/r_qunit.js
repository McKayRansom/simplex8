//
//	Rats wrapper around QUnit
//	QUnit homepage: https://qunitjs.com/
//	License: 
//
rat.modules.add( "rat.test.r_qunit",
[], 
function(rat){});

//	Because the base API is in r_base, we can (and should) run this now.  This makes it possible
//	for modules to use unit tests w/out explicity waiting for this module to process
(function(rat){
	//	Ease of use vars.
	var Q = QUnit;
	var test = rat.unitTest;
	
	//	Replace the supported APIs exposed by rat.test (defined in r_base)
	
	//	Define an actual test
	test._test = function(name, code)
	{
		Q.test( name, code  );
	}
	
	//	Create a test group
	test.group = function(name, func)
	{
		if( !name )
			Q.config.currentModule = Q.config.currentModule.parentModule || Q.config.currentModule;
		else
			//	How to undo a global group set?
			Q.module(name, func);
	};
	
	//	Some tests to test the qunit systemLanguage
	
	//	Test rat.unitTest.test.
	var hit = false;
	rat.unitTest.group( "QUnit" );
	rat.unitTest.test( "Setup for test run", function(assert){
		hit = true;
		assert.ok( hit, "Passed" );
	});
	rat.unitTest.test( "Test run", function(assert){
		assert.ok( hit, "Passed" );
	});
	
	//	Test expect
	rat.unitTest.test( "Expect", function(assert){
		assert.expect( 1 );
		assert.ok( true, "Passed" );
	});
	
	//	Test grouping with func
	rat.unitTest.group( "QUnit group 2", function(){
		rat.unitTest.test( true, function(assert){
			assert.ok( true, "inGroup2 Passed" );
		});
	});
		
	//	Test Async
	rat.unitTest.test( "Async", function(assert){
		var doneFunc = assert.async();
		assert.ok( doneFunc !== void 0, "Got done func" );
		setTimeout( function(){
			assert.ok( true, "Passed" );
			doneFunc();
		}, 1 );
	});
	
	//	Clear the QUnit group
	rat.unitTest.group(void 0);
	rat.unitTest.test( "Clear Group", function(assert){
		assert.ok( true, "Group Cleared" );
	});
})(rat);