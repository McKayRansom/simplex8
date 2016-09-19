/**
 * Javascript functions for the CORE of LE related things
 * TODO - make it so this doesnt even get included unless you're on xboxLE platform
 */
 
 /**
  * Global wrapper around API's exposed to ease integration with Javascript running through XBO LEs 
  */
/* jshint ignore:start */
var XMLHttpRequest;
/* jshint ignore:end */

/*global XMLHttpRequest:true */
rat.modules.add( "rat.os.r_le_core",
[
	{ name: "rat.os.r_system", processBefore: true},
	"rat.debug.r_console",
], 
function(rat)
{
	if (!rat.system.has.xboxLE)
		return;
	/**
	 * Return where we are running this javascript
	 * Maybe add code later to return WHICH browser
	 */
	var UNSENT = 0;
	var OPENED = 1;
	var HEADERS_RECEIVED = 2;
	//var LOADING = 3;
	var DONE = 4;
	
	/**
	 * Define the XMLHttpRequest class
	 */
	XMLHttpRequest = function()
	{
		this.readyState = UNSENT;
	};
	XMLHttpRequest.prototype.nativeResource = void 0;
	// Open
	XMLHttpRequest.prototype.open = function(method, url, async, user, password)
	{
		this.method = method;
		this.url = rat.system.fixPath(url);
		this.async = async;
		this.user = user;
		this.password = password;
		this.readyState = OPENED;
		this.success = this.handleSuccess.bind(this);
		this.error = this.handleError.bind(this);
	};
	// Send
	XMLHttpRequest.prototype.send = function(data)
	{
		this.readyState = HEADERS_RECEIVED;
		Maple.addEventListener(ORMMA_EVENT_RESPONSE, this.success);
		Maple.addEventListener(ORMMA_EVENT_ERROR, this.error);
		Maple.request(this.url, "proxy", this.method);
	};
	
	//ErrorHandlers to set state
	XMLHttpRequest.prototype.handleError = function (message, action) {
		this.status = 404;
		this.readyChangeFinished();
		rat.console.log("ERROR!  Page or File request failed. " + message);
	};

	XMLHttpRequest.prototype.handleSuccess = function(url, data) {
		// may need a if( url == this.url ) - as the call may be synchronous
		if (url !== this.url)
			return;
		this.status = 200;
		this.responseText = data;
		this.readyChangeFinished();
		//rat.console.log("URL success: " + url);
	};
	
	XMLHttpRequest.prototype.readyChangeFinished = function() {
		this.readyState = DONE;
		Maple.removeEventListener(ORMMA_EVENT_RESPONSE, this.success);
		Maple.removeEventListener(ORMMA_EVENT_ERROR, this.error);
		this.onreadystatechange();
	};
	
	//AddJSResourceProperties( "XMLHttpRequest", XMLHttpRequest, ["load","error"] );
	//AddJSResourceProperties( "XMLHttpRequest", XMLHttpRequest, ["readystatechange","error"], {"readystatechange":"load"} );
} );