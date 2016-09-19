//	
//	Global wrapper around API's exposed to ease integration with Javascript running through wraith 
//	
 
/*global Wraith:true*/
var Wraith = Wraith || {};
(function(Wraith)
{
	/**
	 * Return where we are running this javascript
	 * Maybe add code later to return WHICH browser
	 */
	Wraith.w_isNative = false;
	Wraith.w_onPlatform = "Browser";
	
	/** Avoid linting errors */
	Wraith.PushPerfMark = function(){};
	Wraith.PopPerfMark = function(){};
	Wraith.UpdateAchievement = function(userId, achievementId, delta){};
	
	/**
	 * Set the apps entry function
	 * @param {function()} func
	 * @param {Object=} funcContext
	 */
	Wraith.SetEntryPoint = function( func, funcContext )
	{
		if( funcContext )
			func = func.bind( funcContext );
		window.onload = func;
	};

	/**
	 * Empty function (That we should not be using) to get th DT
	 */
	Wraith.getDeltaTime = function ()
	{
		return 0;
	};
	
	/**
	 * Load in a new JS file
	 */
	Wraith.LoadScript = function ( obj )
	{
		function done()
		{
			obj.complete( this );
		}

		if( !obj )
			return;
		if( !obj.src )
			return;

		//	Create a new script tag
		var script = document.createElement('script');

		//	Set it up.
		script.type = 'text/javascript';
		script.async = obj.async || false;
		script.src = obj.src;
		if( obj.complete )
		{			
			script.onreadystatechange = done;
			script.onload = done;
		}

		//	Add it to the document
		var docHead = document.getElementsByTagName( 'head' )[0];
		docHead.appendChild( script );
	};
})(Wraith);
