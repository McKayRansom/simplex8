/**
 * @license
 * Rat Game Engine
 *
 * Copyright 2013-2015 Wahoo Studios, Inc. and Steven H. Taylor.
 * All rights reserved.
 */
/**
 * Not QUITE ready to release publicly yet.  When we do, this will be the right license block...
 *
 * Rat Game Engine
 *
 * http://www.wahoo.com/rat/
 *
 * Copyright 2013-2015 Wahoo Studios, Inc. and Steven H. Taylor.
 * Released under the MIT license
 * http://www.wahoo.com/rat/license/
 *
 */

//-----------------------------------------------------------------------------------------------------------
//	r_base
//
// The base module has the bare minimum to start loading rat.
// Most of the rest of rat is in other modules.
//
// @TODO:  This module is too much stuff shoved together.  It's better than nothing - it's at least just one file to mention in the html,
// but it'd be nice to somehow have it reference these things instead of include them all...
// JHS: I totally agree.  If we had some kind of build process, it could assemble this file... but that would require running the build process which is not ideal.
// 


///////////////////////////////////////////////////////////////
// Set up a bunch of core rat elements that we need to start everything else up

// WinJS support
if (typeof (WinJS) !== "undefined")
	window.WinJS.Binding.optimizeBindingReferences = true;

///////////////////////////////////////////////////////////////
/// Define the core RAT engine object
/// 
/// @export 
/// @namespace
///
var rat = rat || {};
rat.loaded = false;  // Is rat loaded yet?

/// Get the global app
/// Rat uses this method to get the global app objects (If it exists)
/// @todo document what this is used for.
rat.getGlobalApp = function ()
{
	if (typeof (app) !== "undefined")
		return app;
	return void 0;
};

///////////////////////////////////////////////////////////////
/// rat.console (debugging, logging, etc.)
/// this is the bare minimum rat.console support in r_base.  The rest is defined in r_console
/// @namespace
rat.console = {
	output: [],
	saveOutputToLocalStorage: false, // Save all log entries to local storage
	copyToSystem: true,
	logRemotely: false,
	remoteURL: false,
	maxLogLines: 150,
	onceRecord: {},

	lastText: "",
	repeat: 0,

	//	log text
	log: function (text)
	{
		var rconsole = rat.console;
		var out = rconsole.output;

		if (text === rconsole.lastText)
		{
			rconsole.repeat = rconsole.repeat + 1;
			out[out.length - 1] = "|(X" + rconsole.repeat + ") " + rconsole.lastText;
		}
		else
		{
			rconsole.lastText = text;
			rconsole.repeat = 1;
			out.push('| ' + text);
			if (out.length > rconsole.maxLogLines)
				out.splice(0, 1);	//	kill oldest
		}

		if( rat.console.saveOutputToLocalStorage && window.localStorage )
			window.localStorage.setItem("RAT_LOG", JSON.stringify(out));
		
		//	copy to standard output?
		if (rconsole.copyToSystem)
		{
		    var data = '|' + text;
			console.log('|' + text);
			if( rat.system.has.xboxLE || rat.system.has.xbox )
			    Debug.writeln(data);
		}

		//	send to a remote server?
		if (rconsole.logRemotely && rconsole.remoteURL)
		{
			var xmlhttp = new XMLHttpRequest();
			//xmlhttp.onreadystatechange=function(){};
			xmlhttp.open("GET", rconsole.remoteURL + text, true);
			xmlhttp.send();
		}
	}
};

///////////////////////////////////////////////////////////////
/// initial rat.system object, e.g. platform capabilities
/// @namespace
rat.system = {
	has: {},		//  system supported feature list
	onPlatform: "",	// What platform are we on.
	applyCacheBuster: false // When loading, include a cache buster.
};
rat.events = { queued: {} };

///
/// detect platform and capabilities
/// this accesses variables to determine if they exist, but this throws warnings in JSLint.
/// @suppress {undefinedVars | missingProperties} - Don't warn about the Windows variable or the XboxJS variable
///
rat.detectPlatform = function ()
{
	if (rat.detectPlatform.detected)
		return;

	rat.detectPlatform.detected = true;
	rat.console.log("Detecting platform...");
	rat.system.has.pointer = true;	// assume this for starters.  This means mouse or finger.
	if (typeof Windows !== 'undefined' && typeof winJS !== 'undefined')
	{
		rat.system.has.windows8 = true;
		rat.system.has.winJS = true;
		//var isWinJS = !!window.Windows && /^ms-appx:/.test(location.href);

		if (window.Windows.Xbox !== void 0)
		{
			rat.system.has.xbox = true;
			rat.system.has.pointer = false; // sure, it could be Kinect, but we don't support that at all right now.
		}
		else
		{
			rat.system.has.realWindows8 = true;
		}
		//	Note:  Detecting Windows 8.1 (vs. windows 8.0) at runtime is evidently nontrivial.
		//	If you build a win8.0 app, everbody reports everything the same as 8.0 even if you're actually hosted in 8.1.
	}
	else if (typeof XboxJS !== 'undefined')
	{
		rat.system.has.xboxLE = true;
		rat.system.has.pointer = false;		// should be true when we support Kinect
	}

	// Are we running in wraith.
	if (typeof Wraith !== 'undefined' && Wraith && Wraith.w_isNative)
	{
		rat.system.has.Wraith = true;
		rat.system.onPlatform = Wraith.w_onPlatform;
	}

	//	browser/navigator/host stuff
	var nav = navigator;

	//	Do we currently support the gamepad API
	// Based on http://www.html5rocks.com/en/tutorials/doodles/gamepad/
	rat.system.has.gamepadAPI =
		!!nav.getGamepads ||
		!!nav.gamepads ||
		!!nav.mozGetGamepads ||
		!!nav.mozGamepads ||
		!!nav.webkitGetGamepads ||
		!!nav.webkitGamepads;
	if (rat.system.has.gamepadAPI && rat.system.has.xboxLE)
		rat.system.has.gamepadAPI = false;
	//	Does it support the event driven API.  Note that Wraith does not.
	rat.system.has.gamepadAPIEvent = rat.system.has.gamepadAPI && (navigator.userAgent.indexOf('Firefox/') !== -1) && !rat.system.has.Wraith;
	//rat.console.log("Gamepad API Support: " + rat.system.has.gamepadAPI + "  gamepadAPIEvents:" + rat.system.has.gamepadAPIEvent);

	//	iOS Browser
	if (nav && (nav.userAgent.search("iPad") >= 0 || nav.userAgent.search("iPod") >= 0 || nav.userAgent.search("iPhone") >= 0))
		rat.system.has.iOSBrowser = true;
	else
		rat.system.has.iOSBrowser = false;

	//	PS4 Browser
	if (nav && (nav.userAgent.search("PlayStation 4") >= 0))
		rat.system.has.PS4Browser = true;
	else
		rat.system.has.PS4Browser = false;

	//	Chrome browser
	if (nav && (nav.userAgent.search("Chrome") >= 0))
		rat.system.has.chromeBrowser = true;
	else
		rat.system.has.chromeBrowser = false;

	//	IE browser
	//	see http://www.useragentstring.com/pages/Internet%20Explorer/
	if (nav && ((nav.userAgent.search("MSIE") >= 0) || (nav.userAgent.search("Edge") >= 0)) )
		rat.system.has.IEBrowser = true;
	else
		rat.system.has.IEBrowser = false;

	if (nav && (nav.userAgent.search("Edge/12")) >= 0)
		rat.system.has.IEVersion = 12;
	else if (nav && (nav.userAgent.search("like Gecko") >= 0))
		rat.system.has.IEVersion = 11;
	else if (nav && (nav.userAgent.search("MSIE 10") >= 0))
		rat.system.has.IEVersion = 10;
	else if (nav && (nav.userAgent.search("MSIE 9") >= 0))
		rat.system.has.IEVersion = 9;
	else
		rat.system.has.IEVersion = 0;	//	unknown

	if (nav && nav.userAgent.indexOf('Firefox/') !== -1)
		rat.system.has.firefoxBrowser = true;
	else
		rat.system.has.firefoxBrowser = false;

	if (nav && nav.userAgent.indexOf('Gecko/') !== -1)	//	a more generic form of firefox
		rat.system.has.geckoBrowser = true;
	else
		rat.system.has.geckoBrowser = false;

	if (typeof(chrome) !== "undefined" && chrome.app && chrome.app.runtime)
	{
		//	note: there's some interesting stuff in chrome.runtime, like chrome.runtime.PlatformOs
		rat.system.has.chromeApp = true;
	}
	
	//	CPU class stuff
	if (nav && nav.cpuClass)	//	ARM, x64, others..
		rat.system.has.cpuClass = nav.cpuClass;
	else
		rat.system.has.cpuClass = 'unknown';
	
	//	Library detection
	if (typeof(QUnit) !== "undefined" )
	{
		rat.system.has.QUnit = true;
		rat.system.has.unitTest = true;
	}
};

///////////////////////////////////////////////////////////////
//	Parse the URL to get the vars out
(function(rat)
{
	//only if we actually have window.location. This is to avoid errors in Wraith where window.location is undefined
	if (window.location){
		var loc = window.location.href;
		
		//	don't include extra stuff in base URL
		rat.system.baseURL = loc.slice( 0, loc.indexOf("?") );

		//	Pull values out of the URL		
		rat.system.URLVars = {};
		loc.replace(/[?&]+([^=&]+)=([^&]*)/gi, function(m,key,value) {
			rat.system.URLVars[key] = value; //returns parts
		});
	}
})(rat);

///////////////////////////////////////////////////////////////
/// For images that deal with pulling from an external server we may need to
/// fully qualify our path before sending out the request.
/// @suppress {missingProperties}
rat.system.fixPath = function (urlPath)
{
	// don't do anything if the path was already empty to begin with
	if (urlPath.length === 0)
		return urlPath;

	var isProperAddress = urlPath.search(/^http/) > -1;		// we want to exclude any requests that are already properly formed

	// project is running a landing experience, prepend with the base URL and randomness to break up caching
	var newPath = urlPath;
	if( !isProperAddress )
	{
		//	Here are a bunch of path modifications that rat supports:
		
		//	project is running from a subfolder, e.g. for the intelXDK to keep crap out of top level.
		if (rat.system.rootFolder)
		{
			newPath = rat.system.rootFolder + newPath;
			if (rat.utils.cleanPath)
				newPath = rat.utils.cleanPath(newPath);
		}
		//	check for rat itself being in an alternate path (separate from everything else)
		if (rat.system.ratAltFolder && newPath.substring(0,4) === "rat/")
			newPath = rat.system.ratAltFolder + newPath.substring(4);
		//	rootSubFolder is just a boolean flag that says go up one directory
		if (rat.system.rootSubFolder)
			newPath = "../" + newPath;
		//	cache buster support (append random number so host caching is avoided, and newest version of file is always loaded)
		if (rat.system.has.xboxLE || rat.system.applyCacheBuster)
			newPath = newPath + "?_=" + Math.random();
		//	in real LE environment, load from correct hosted path
		if (rat.system.has.xboxLE)
			newPath = window.adParams._projectBase + newPath;
	}
	return newPath;
};

///////////////////////////////////////////////////////////////
// We need to add this event right now so we can detect when the app is activated
if (window.WinJS !== void 0)
{
	var activation;
	if (window.Windows && window.Windows.ApplicationModel)
		var activation = window.Windows.ApplicationModel.Activation;
	if (!activation)
		activation = {};
	if (!activation.ActivationKind)
		activation.ActivationKind = {};
	if (!activation.ApplicationExecutionState)
		activation.ApplicationExecutionState = {};

	window.WinJS.Application.onactivated = function (event)
	{
		var eventArgs = {};
		//	see https://msdn.microsoft.com/en-us/library/ie/windows.applicationmodel.activation.activationkind
		switch (event.detail.kind)
		{
			case activation.ActivationKind.launch: eventArgs.kind = "launched"; break;
			case activation.ActivationKind.search: eventArgs.kind = "searchWith"; break;
			case activation.ActivationKind.shareTarget: eventArgs.kind = "shareTarget"; break;
				// Launched via file association
			case activation.ActivationKind.file: eventArgs.kind = "file"; break;
			case activation.ActivationKind.protocol: eventArgs.kind = "protocol"; break;
			case activation.ActivationKind.fileOpenPicker: eventArgs.kind = "fileOpenPicker"; break;
			case activation.ActivationKind.fileSavePicker: eventArgs.kind = "fileSavePicker"; break;
			case activation.ActivationKind.cachedFileUpdater: eventArgs.kind = "cachedFileUpdater"; break;
			case activation.ActivationKind.ContactPicker: eventArgs.kind = "contactPicker"; break;
			case activation.ActivationKind.device: eventArgs.kind = "autoplay"; break;
			case activation.ActivationKind.printTaskSettings: eventArgs.kind = "print"; break;
			case activation.ActivationKind.cameraSettings: eventArgs.kind = "camera"; break;
			case activation.ActivationKind.restrictedLaunch: eventArgs.kind = "launched-restricted"; break;
			case activation.ActivationKind.appointmentsProvider: eventArgs.kind = "appointmentsProvider"; break;
			case activation.ActivationKind.Contact: eventArgs.kind = "contact"; break;
			case activation.ActivationKind.lockScreenCall: eventArgs.kind = "launch-locked"; break;
			default:
				eventArgs.kind = "unknown";
				break;
		}

		// The previous app state
		// https://msdn.microsoft.com/en-us/library/ie/windows.applicationmodel.activation.applicationexecutionstate
		switch (event.detail.previousExecutionState)
		{
			case activation.ApplicationExecutionState.notRunning: eventArgs.prevState = "notRunning"; break;
			case activation.ApplicationExecutionState.running: eventArgs.prevState = "running"; break;
			case activation.ApplicationExecutionState.suspended: eventArgs.prevState = "suspended"; break;
				// Terminated after a suspend.
			case activation.ApplicationExecutionState.terminated: eventArgs.prevState = "terminated"; break;
				// Closed by the user
			case activation.ApplicationExecutionState.closedByUser: eventArgs.prevState = "closed"; break;
			default:
				eventArgs.prevState = "unknown";
				break;
		}

		// Get the session data if there is any
		eventArgs.sessionState = (window.WinJS.Application.sessionState || {})["savedState"];

		// win8 version of starting up - do this after WinJS.UI.processAll has been called
		// for one thing, this lets us access any weird win8 specific UI
		// for another it means the above code has been run, which lets us access session data.
		event.setPromise(window.WinJS.UI.processAll().then(function ()
		{
			//	Queue up the activate event to be fired to the first listener
			//	Also queue a resume from terminate event if we were terminated
			//	Have we loaded the events module
			rat.events.queued["activated"] = ["activated", eventArgs];
			if (eventArgs.prevState === "terminated")
				rat.events.queued["resumeFromTerminated"] = ["resumeFromTerminated", eventArgs];
		}));
	};

	window.WinJS.Application.start();
}
	//	If we don't have WinJS, always queue the activated event
else
{
	rat.events.queued["activated"] = ["activated", {
		kind: "launched",
		prevState: "notRunning",
		sessionState: void 0
	}];
}

///////////////////////////////////////////////////////////////
// Provides requestAnimationFrame/cancelAnimationFrame in a cross browser way.
window.requestAnimationFrame =
	window.requestAnimationFrame ||
	window.webkitRequestAnimationFrame ||
	window.mozRequestAnimationFrame ||
	window.oRequestAnimationFrame ||
	window.msRequestAnimationFrame ||
	function ( /* function FrameRequestCallback */ callback, /* DOMElement Element */ element)
	{
		return window.setTimeout(callback, 1000 / 60);
	};
window.cancelAnimationFrame =
	window.cancelAnimationFrame ||
	window.webkitCancelAnimationFrame ||
	window.mozCancelAnimationFrame ||
	window.oCancelAnimationFrame ||
	window.msCancelAnimationFrame ||
	clearTimeout; // The params of cancelAnimationFrame and clearTimeout match, so I don't need a wrapper around this function

///////////////////////////////////////////////////////////////
/// Util functions necessary for loading rat
/// @namespace 
rat.utils = {
	// List of all JS files that are either queued to load, loading, or loaded
	// Key is full file path
	// value is either "pending", "downloading", "loaded" or "error"
	// Pending is we are going to call loadScriptWithCallback
	// Downloading is loadScriptWithCallback has been called..  File is downloading.
	// Loaded is file is downloaded
	// Error is a failure
	loadedScripts: {
		length: 0
	},
};
// Keep this from becoming a global
(function (rat)
{
	/// Formation an exception for output to the log
	rat.utils.dumpException = function (msg, e) {
		if (!e)
			rat.console.log("Unable to dump undefined exception");
		else {
			rat.console.log("=======================================================");
			rat.console.log("ERROR!  " + msg );
			rat.console.log("->   Got Exception " + e.name + "(" + (e.number || "???") + ")");
			rat.console.log("->   " + e.description || e.message);

			delete e.message;
			delete e.description;
			delete e.name;
			delete e.number;
			var fullText = JSON.stringify(e);
			var lines = fullText.split("\\n");
			for (var index = 0; index < lines.length; ++index) {
				rat.console.log("->" + lines[index]);
			}
		}
	};

	///
	/// Load in a list of resources (JS, JSON, XML(Not yet supported), with a callback when they are all completed
	/// @param {?} options 
	rat.utils.loadResources = function (list, callback, options)
	{
		var resourceList = list;
		if (!Array.isArray(resourceList))
			resourceList = [resourceList];
		options = options || {};
		if (options.async === void 0)
			options.async = true;
		var updateCB = options.update;
		var totalLoads = resourceList.length;
		var loadsLeft = resourceList.length;

		//	Fix the types in the list
		var index;
		var len;
		for (index = 0, len = resourceList.length; index !== len; ++index)
		{
			//	Entries in the resourceList may be raw strings..  change them to objects
			if (typeof (resourceList[index]) === 'string')
				resourceList[index] = { source: resourceList[index] };
			resourceList[index].loaded = false;
		}

		if (updateCB)
			updateCB({ left: totalLoads, loaded: 0, of: totalLoads });
		if (loadsLeft <= 0)
		{
			if (callback)
				callback();
			return;
		}

		/// Callback used by loadResource
		/// defined in this function so it can access the variables like loadsLeft
		function resourceLoadDone(obj, data)
		{
			if (obj)
			{
				if (obj.loaded)
					return;
				obj.loaded = true;
				if (obj.callback)
					obj.callback(data);
			}

			--loadsLeft;
			//rat.console.log("...loaded " + obj.source + ".  Loads left:" + loadsLeft);
			if (updateCB)
				updateCB({ left: loadsLeft, loaded: (totalLoads - loadsLeft), of: totalLoads });
			if (loadsLeft <= 0 && callback)
				callback();
		}

		var entry;
		for (index = 0, len = resourceList.length; index !== len; ++index)
		{
			//	Entries in the resourceList may be raw strings..  change them to objects
			entry = resourceList[index];
			//	If the objects type is not set, get it from the resource ext.
			if (entry.type === void 0)
			{
				var dotAt = entry.source.lastIndexOf(".");
				if (dotAt === -1)
					entry.type = "UNKNOWN";
				else
					entry.type = entry.source.substr(dotAt + 1).toUpperCase();
			}

			if (entry.type === "JS" && !rat.utils.loadedScripts[entry.source])
			{
				rat.utils.loadedScripts[entry.source] = "pending";
				++rat.utils.loadedScripts.length;
			}
		}

		for (index = 0, len = resourceList.length; index !== len; ++index)
		{
			entry = resourceList[index];

			//	Process based on type
			//	rat.console.log( "...loading " + entry.source + "..." );
			switch (entry.type)
			{
				// Load Javascript
				case 'JS':
					// All JS loads need to go through loadScriptWithCallback
					rat.utils.loadScriptWithCallback(entry.source, !!options.async, resourceLoadDone.bind(void 0, entry));
					break;

					// Load JSON
				case 'JSON':
					if (!options.async)
						rat.console.log("ERROR!  Unable to load JSON files synchronously");
					else
						rat.utils.loadJSON(entry.source, resourceLoadDone.bind(void 0, entry));
					break;

				default:
					rat.console.log("WARNING! Attempting to load un-recognized resource " + entry.source);
					resourceLoadDone(entry, void 0);
					break;
			}
		}
	};

	///
	/// Load in a series of files (or file sets) in a synchronous manner.  This will load one set and then the next.
	/// This differs from rat.utils.loadResources in that each file (or file set) is downloaded and processed one at a time
	/// @param {Object=} options 
	rat.utils.loadResourcesSync = function (list, callback, options)
	{
		if (typeof (list) === "string")
			list = [list];
		list = list || [];

		var onIndex = -1; // What index of item are we on.
		options = options || {};
		function loadNextList()
		{
			++onIndex;

			if (options.update)
			{
				//	How to stop this load process 
				var abort = options.update({ index: onIndex, list: list, startAgain: loadNextList });
				if (abort)
					return;
			}

			//	When to stop.
			if (onIndex >= list.length)
			{
				if (callback)
					callback();
				return;
			}

			var entry = list[onIndex];
			if (options.verbose)
				rat.console.log("Sync load of list item " + onIndex + ":" + JSON.stringify(entry));

			rat.utils.loadResources(entry, loadNextList, { async: false });
		}

		loadNextList();
	};

	///
	/// load one script with this callback
	/// (generally, you want to use loadResources() above)
	/// @param {?} errorCallback 
	rat.utils.loadScriptWithCallback = function (filename, async, completeCallback, errorCallback)
	{
		//	Report of we ever try to re-load a scripts
		if (rat.utils.loadedScripts[filename] !== void 0 && rat.utils.loadedScripts[filename] !== "pending")
		{
			rat.console.log("WARNING:  File " + filename + " is getting loaded twice!");
			filename += Math.random();
		}
		if (!rat.utils.loadedScripts[filename])
			++rat.utils.loadedScripts.length;
		rat.utils.loadedScripts[filename] = "downloading";

		//rat.console.log("load script with callback " + filename + ", " + async);
		//	Fix the path
		var src = rat.system.fixPath(filename);

		//	When we are done, call this
		function loadDone(obj)
		{
			//rat.console.log( "Script file " + filename + " loaded." );
			// Is this is load event or did we get a ready-state change to complete.
			if (obj && (obj.type === "load" || obj.readyState === "complete"))
			{
				//rat.console.log( "Script file " + filename + " state " + obj.type + " has cb " + (!!completeCallback));
				rat.utils.loadedScripts[filename] = "loaded";
				if (completeCallback)
					completeCallback(filename);
			}
		}
		// console.log("starting wraith load for " + filename);

		// Load in the script (Using wraith if we can)
		if (rat.system.has.Wraith)
		{
			//rat.console.log( "Loading script " + src + " with wraith:" + (async ? "Async" : "Sync") );
			Wraith.LoadScript({
				src: src,
				async: async,
				complete: loadDone,
			});
		}
		else
		{
			//rat.console.log( "Loading script " + src + " with DOM:" + (async ? "Async" : "Sync") );

			//	Create a new script tag
			var script = document.createElement('script');

			//	Set it up
			script.async = async || false;
			script.type = "text/javascript";
			script.onreadystateChange = loadDone;
			script.onload = loadDone;
			script.onerror = function ()
			{
				rat.utils.loadedScripts[filename] = "error";
				rat.console.log("Failed to load file " + src);
				if (errorCallback)
					errorCallback(filename);
			};
			script.src = src;

			//	Add it to the document
			var docHead = document.getElementsByTagName('head')[0];
			docHead.appendChild(script);
			//rat.console.log( "Added script tag for " + src );
		}
	};
	
	//	Load in the QUnit testing framework.
	rat.utils.loadQUnit = function(onDone)
	{
		function continueIfDone()
		{
			if( !haveCSS || !haveJS )
				return;
			var canvas = document.getElementsByTagName("canvas")[0];
			//canvas.style.postion = "absolute";
			var body = document.getElementsByTagName("body")[0];
			body.style.overflow = "visible";
			function createDiv(id){
				var div = document.createElement("div");
				div.id = id;
				//div.style.position = "absolute";
				body.insertBefore( div, canvas );
			}
			createDiv( "qunit" );
			createDiv( "qunit-fixture" );
			
			onDone();
		}
			
		var haveCSS = false, haveJS = false;
		
		//	Load the QUnit JS file
		rat.utils.loadScriptWithCallback( "http://code.jquery.com/qunit/qunit-1.20.0.js", true, function(){
			haveJS = true;
			continueIfDone();
		});
		
		//	Load the QUnit CSS file
		var fileref=document.createElement("link");
		fileref.setAttribute("rel", "stylesheet");
		fileref.setAttribute("type", "text/css");
		fileref.onload = function() {
			haveCSS = true;
			continueIfDone();
		};
		fileref.setAttribute("href", "http://code.jquery.com/qunit/qunit-1.20.0.css");
		document.getElementsByTagName("head")[0].appendChild(fileref);
	};
})(rat);

///////////////////////////////////////////////////////////////
// rat.load
// Keep this from becoming a global
(function (rat)
{
	///
	/// @namespace
	rat.modules = {};

	// Rats full modules list
	rat.modules.byName = {}; // Key is module name
	rat.modules.length = 0;
	rat.modules.pending = []; // Array version of any of the above that we have not yet processed

	///////////////////////////////////////////////////////////////
	rat.modules.moduleFileLookup = {};
	rat.modules.moduleRequiresList = {};
	rat.modules.addModulesToFileLookup = function (obj)
	{
		for (var name in obj)
		{
			if (obj.hasOwnProperty(name))
			{
				if (rat.modules.moduleFileLookup[name] && rat.modules.moduleFileLookup[name] !== obj[name])
					rat.console.log("Module name " + name + " duplicated. in file lookup for " + rat.modules.moduleFileLookup[name] + "/" + obj[name]);
				else
					rat.modules.moduleFileLookup[name] = obj[name];
			}
		}
	};
	rat.modules.addModulesToRequiresLookup = function (obj)
	{
		for (var name in obj)
		{
			if (obj.hasOwnProperty(name))
			{
				if (rat.modules.moduleRequiresList[name])
					rat.console.log("Module name " + name + " duplicated. in requires lookup");
				else
					rat.modules.moduleRequiresList[name] = obj[name];
			}
		}
	};

	/// This is a list of files that need to be loaded in response to modules that have been added
	rat.modules.missingFiles = {
		list: [],
		byPath: {}
	};

	//
	// Convert a module name to a path
	function moduleNameToPath(module)
	{
		module = module.replace(/\./g, "/");
		module = module + ".js";
		//module = module.toLowerCase();
		return module;
	}

	//
	//	Add a file that needs to be loaded before we can continue processing
	function addModuleMissingFiles(module, ops)
	{
		var out_fileList = [];
		var index;
		var foundFiles;

		//	If this is an array of modules, 
		if (Array.isArray(module))
		{
			for (index = 0; index !== module.length; ++index)
			{
				foundFiles = addModuleMissingFiles(module[index], ops);
				out_fileList = out_fileList.concat(foundFiles);
			}
			return out_fileList;
		}

		if (typeof (module) === "object")
		{
			if (module.platform && !rat.system.has[module.platform])
				return [];
			module = module.name;
		}

		//	Is this a file and not a module?
		var file;
		var isFile = module.substr(-3).toLowerCase() === ".js";
		if (isFile)
			file = module;
		else
		{
			//	Does the module already exist?  Don't need to load any file
			if (rat.modules.byName[module])
				return [];

			//	If it isn't a file, try to find the file it is in..
			file = rat.modules.moduleFileLookup[module];

			//	If we don't have a lookup for it, then build the file path from the module name
			if (!file)
				file = moduleNameToPath(module);
		}

		// Is it already a pending load, or already loaded.
		// We assume that if this is the case, that we don't need to find their dependencies...
		if (!rat.modules.missingFiles.byPath[file] && !rat.utils.loadedScripts[file])
		{
			if (!ops || !ops.justGenFileList)
			{
				rat.modules.missingFiles.byPath[file] = true;
				rat.modules.missingFiles.list[rat.modules.missingFiles.list.length] = file;
			}
			out_fileList[out_fileList.length] = file;

			//	Now handle getting other files that we know we will need (see moduleRequiresList)
			var lookup = rat.modules.moduleRequiresList[module];
			if (lookup && lookup.length)
			{
				foundFiles = addModuleMissingFiles(lookup, ops);
				out_fileList = out_fileList.concat(foundFiles);
			}
		}
		return file;
	}

	//
	//	Get the list of modules required by another module.
	//	NOTE: This is NOT recursive.  We only go one level deep
	//		It also takes into account platform restrictions
	//		This can take either a module name, or a moduleOps object
	//	Returned is a list of module names.
	function getModuleRequires(moduleName, ops)
	{
		if (!moduleName)
			return [];
		var list;
		var module = moduleName;
		ops = ops || {};
		if (typeof (moduleName) === "string")
			module = rat.modules.byName[moduleName];
		list = module.requires;
		var out_list = [];
		//	From the full list, build the applicable list
		for (var index = 0; index !== list.length; ++index)
		{
			var entry = list[index];
			//	is this a platform that we don't care about
			if (entry.platform && !rat.system.has[entry.platform])
				continue;
			if (ops.forFiles || !entry.fileOnly)
				out_list[out_list.length] = entry.name;
		}
		return out_list;
	}

	//	Modules that rat will ALWAYS load
	var requiredModules = [
		"rat.os.r_system",
		"rat.os.r_events",
		"rat.debug.r_console",
		"rat.debug.r_profiler",
		"rat.utils.r_utils",
		"rat.math.r_math",
		"rat.math.r_vector",
		"rat.math.r_matrix",
		{ name: "rat.test.r_qunit", platform: "QUnit" }
	];

	//
	//	Register a new rat modules
	//
	rat.modules.add = function (name, requires, code)
	{
		// Extract param..  We support two different types of calls
		// Pure param (name, requires, code)
		// and Named param ({name:"", requires:[], code:function(){}});
		// @TODO Add an initFunc phase so different systems can register their own init functions
		var ops, index;
		if (typeof (name) !== "object")
		{
			ops = {
				name: name,
				requires: requires,
				code: code
			};
		}
		else
			ops = name;

		// Validation
		if (!ops.name)
		{
			rat.console.log("ERROR: Modules must be given a name");
			ops.name = "_" + ((Math.random() * 10000) | 0);
		}

		// Flag that we still need to execute any affiliated code
		// NOTE: Even if no code is provided, this will not get set
		// Until all required modules have loaded
		ops.hasBeenProcessed = false;

		//	Cleanup the requires list
		if (!ops.requires)
			ops.requires = [];
		else if (!Array.isArray(ops.requires))
			ops.requires = [ops.requires];
		for (index = 0; index !== ops.requires.length; ++index)
		{
			var entry = ops.requires[index];
			if (!entry.name)
			{
				//	Default behavior is file only dependency
				entry = {
					name: entry,
					platform: void 0,
					processBefore: false,
					fileOnly: true
				};
			}

			//	If we have the processBefore flag, set fileOnly to be the reverse of the flag
			if (entry.processBefore !== void 0)
				entry.fileOnly = !entry.processBefore;
				//	If we done have the processBefore flag, but do have the fileOnly, processBefore is the reverse of fileOnly
			else if (entry.fileOnly !== void 0)
				entry.processBefore = !entry.fileOnly;
			else
			{
				entry.fileOnly = true;
				entry.processBefore = false;
			}
			//entry.name = entry.name.toLowerCase(),
			ops.requires[index] = entry;
		}

		// does this modules already exist?
		if (rat.modules.byName[ops.name])
		{
			rat.console.log("ERROR: Attempting to re-define module " + ops.name);
			return;
		}

		// Add the module to the defined list.
		rat.modules.byName[ops.name] = ops;
		rat.modules.pending[rat.modules.pending.length] = ops;
		++rat.modules.length; // Inc total number of modules

		// queue any dependent JS files that are not loaded (or getting loaded)
		var list = getModuleRequires(ops, { forFiles: true });
		addModuleMissingFiles(list);
	};

	//
	// Return if a given module is ready to be processed
	rat.modules.isReadyToProcess = function (moduleOps, outList)
	{
		if (!moduleOps)
			return false;
		outList = outList || [];
		var modules = rat.modules.byName;
		var module = moduleOps;
		if (!module)
		{
			rat.console.log("Testing if undefined module is ready to process");
			return false;
		}
		//	If we have already processed this module, then the answer is no.
		if (module.hasBeenProcessed)
			return false;

		//	test all required modules
		var list = getModuleRequires(module);
		for (var index = 0; index !== list.length; ++index)
		{
			var depOn = list[index];
			depOn = modules[depOn];
			if (depOn && depOn.fileOnly)
				continue;
			if (!depOn)
				outList.push({ name: list[index], hasBeenProcessed: false, isMissing: true });
			else if (!depOn.hasBeenProcessed)
				outList.push(depOn);
		}

		//	Must be all good
		return outList.length === 0;
	};

	//
	//	Execute all modules in the order specified by their requirements
	rat.modules.process = function (ops)
	{
		ops = ops || {};
		var maxToCall = ops.maxToCall || 0;
		var noError = !!ops.noError;

		//	Keep looping until we have no more pending modules.
		//	NOTE: By the time we reach this code, all required files should be loaded.
		var pending = rat.modules.pending;
		while (pending.length > 0)
		{
			//	Loop back->front because we will be removing items from the list
			++rat.modules.process.passes;
			var index = pending.length - 1;
			var oldPending = pending.length;
			while (index >= 0)
			{
				//	If this module is ready, process it.
				var module = pending[index];
				if (rat.modules.isReadyToProcess(module))
				{
					if (ops.verbose)
						rat.console.log("rat module processing : " + module.name);
					//	Execute the code if it exists
					//	Pass rat, and if it exists the app objecct.
					if (module.code) {
						try {
							module.code(rat, rat.getGlobalApp());
						} catch (e) {
							rat.utils.dumpException("Failed to process module " + module.name + ".", e);
							throw e;
						}
					}
					if (ops.verbose)
						rat.console.log("done with : " + module.name);

					//	Flag processed
					module.hasBeenProcessed = true;

					//	Remove from the pending list.
					pending.splice(index, 1);

					//	We may only want to call so many items per frame
					//	to avoid a large FPS spike
					//	Currently, only wraith does this.
					if (maxToCall > 0 && pending.length > 0)
					{
						--maxToCall;
						if (maxToCall <= 0)
							return "HIT_LIMIT";
					}
				}
				//	Loop backwards
				--index;
			}

			//	If the number of pending modules did not change, we have a problem
			if (pending.length === oldPending)
			{
				if (!noError)
				{
					rat.console.log("ERROR! BAD REQUIRES TREE!  Unable to process " + pending.length + " modules.  (circular or missing dependencies?)");
					for (index = 0; index !== pending.length; ++index)
					{
						rat.console.log(">" + pending[index].name);
						var list = [];
						rat.modules.isReadyToProcess(pending[index], list);
						for (var reqIndex = 0; reqIndex !== list.length; ++reqIndex)
							rat.console.log("  >" + list[reqIndex].name + (list[reqIndex].isMissing ? " MISSING!" : ""));
					}
					return "ERROR";
				}
				else
					return "PENDING";
			}
		}
	};
	rat.modules.process.passes = 0;

	//
	//	Load the rat engine by listing the modules that will be used.
	//	Modules are defined by using rat.modules.add (see above)
	rat.load = function (loadOptions)
	{
		rat.console.log("rat.load Verbose=" + !!loadOptions.verbose);
		rat.load.numLoadPasses = 0; // How many load passes have we done so far

		var loadLog = function (text)
		{
			if (loadOptions.verbose)
				rat.console.log(text);
		};

		loadOptions = loadOptions || {};
		if (loadOptions.async !== void 0 && !loadOptions.async)
			loadOptions.async = false;
		else
			loadOptions.async = true;

		// loadOptions.update = function
		// loadOptions.done = function
		var addAsync = loadOptions.addAsync || [];
		var addSync = loadOptions.addSync || [];
		var fileLists = [addAsync, addSync];

		// Start by detecting the platform
		rat.detectPlatform();

		// Adjust all of the module lists to the same format
		for (var fileListIndex = 0; fileListIndex !== fileLists.length; ++fileListIndex)
		{
			var singleList = fileLists[fileListIndex];
			for (var fileIndex = singleList.length - 1; fileIndex >= 0; --fileIndex)
			{
				if (!singleList[fileIndex])
					singleList.splice(fileIndex, 1);
				else if (!singleList[fileIndex].name)
					singleList[fileIndex] = { name: singleList[fileIndex] };
			}
		}

		// Find out if we have already loaded the wraith_core file
		// Note: wraith_core may be loaded in situations where the Wraith engine is not being used.
		var loadedWraithCore = typeof (Wraith) === "object";

		// If we are not in wraith, but we want wraith files loaded, then add the required files
		if (!rat.system.has.Wraith && rat.load.addWraith)
		{
			var wraithPath = "rat/wraithjs/web/";
			if (!loadOptions.skipLoad)
			{
				if (!loadedWraithCore)
					addModuleMissingFiles(wraithPath + "wraith_core.js");
				addModuleMissingFiles([wraithPath + "wraith_dom.js", wraithPath + "wraith_canvas.js"]);
			}
		}

		var loadsLeft, loadsDone;
		var framesOfSameState = 0;
		var lastFramesState = void 0;
		var fileLoadDone = false;
		var fileProcessDone = false;
		var requestAnimationFrameID;
		var syncStarted = false, syncDone = false;

		if (!loadOptions.skipLoad)
		{
			//	Add rat's required modules
			addModuleMissingFiles(requiredModules);

			//	Any modules listed in the addAsync get added now
			addModuleMissingFiles(addAsync);

			loadLog("Initial file pass selected the following " + rat.modules.missingFiles.list.length + " files to load:");
			for (var index = 0; index < rat.modules.missingFiles.list.length; ++index)
				loadLog("-->" + rat.modules.missingFiles.list[index]);
		}
		else
		{
			//	Avoid all other loads.  NOT PROCESS calls
			loadsLeft = 0;
			loadsDone = 0;
			fileLoadDone = true;
			syncStarted = true;
			syncDone = true;
		}

		// Update while loading/processing files
		function update()
		{
			if (rat.load.failed)
				return;
			var percent;
			++framesOfSameState;

			//	Still loading files
			if (!fileLoadDone)
				percent = (loadsDone / rat.utils.loadedScripts.length) * 100;

				//	TODO@ The file load may be done, but we may need to do another loading pass for fiels that we are missing

				//	Done loading files, but still processing
			else if (!fileProcessDone)
			{
				var maxToCall = (rat.system.has.Wraith && loadOptions.async) ? 1 : 0;
				var processRes = rat.modules.process({ maxToCall: maxToCall, verbose:loadOptions.verbose }); // Max to process per frame
				if (processRes === "ERROR")
				{
					rat.load.failed = true;
					return;
				}
				if (rat.modules.pending.length <= 0)
				{
					fileProcessDone = true;
					lastFramesState = void 0;
					rat.console.log("rat.modules.process finished.  Took " + rat.modules.process.passes + " passes.");
				}

				percent = ((rat.modules.length - rat.modules.pending.length) / rat.modules.length) * 100;
			}

			//	Keep track of the number of frames nothing has changed.
			if (percent !== lastFramesState)
			{
				lastFramesState = percent;
				framesOfSameState = 0;
			}

			//	IF we have too many frames with no change, report what we are waiting on
			if (framesOfSameState >= 6000)	//	was 60, was way too spewy...
			{
				framesOfSameState = 0;
				if (fileLoadDone)
					rat.console.log("How did we go \"idle\" while trying to process files?!?  Modules left to proccess: " + rat.modules.pending.length);
				else
				{
					rat.console.log("Went \"idle\" waiting for " + loadsLeft + " of " + rat.utils.loadedScripts.length + " file(s) to load.");
					for (var file in rat.utils.loadedScripts)
					{
						if (rat.utils.loadedScripts[file] === "pending" || rat.utils.loadedScripts[file] === "downloading")
							rat.console.log("--->" + file);
					}
				}
			}

			//	Fire the update callback if one was provided
			if (loadOptions.update)
			{
				loadOptions.update({
					load: {
						done: loadsDone,
						left: loadsLeft,
						total: rat.utils.loadedScripts.length,
						isDone: fileLoadDone
					},
					process: {
						done: rat.modules.length - rat.modules.pending.length,
						left: rat.modules.pending.length,
						total: rat.modules.length,
						isDone: fileProcessDone
					},
				});
			}

			//	Are we ready to move onto the sync phase (if we need to?)
			if (fileLoadDone && fileProcessDone)
			{
				//	Are we ready to start the sync load pass
				if (!syncStarted)
				{
					syncStarted = true;
					if (!addSync.length)
						syncDone = true;
					else
					{
						loadLog("Starting sync load of " + addSync.length + " files.");
						var fileList = addModuleMissingFiles(addSync, { justGenFileList: true });
						var singleFileLoaded = function (fields)
						{
							if (rat.modules.missingFiles.list.length > 0)
							{
								if (!singleFileLoaded.paused)
								{
									singleFileLoaded.paused = true;
									rat.console.log("Pause sync loading after " + (fields.index) + " of " + fields.list.length + " files...");
								}
								else
									rat.console.log("Keep sync loading paused.  More missing files...");
								loadMissingFiles(function ()
								{
									singleFileLoaded(fields);
								}, { logTag: "paused sync" });
								return "abort";
							}
							else
							{
								rat.modules.process({ noError: true });
								if (singleFileLoaded.paused)
								{
									rat.console.log("Resume sync loading " + (fields.list.length - (fields.index + 1)) + " of " + fields.list.length + " files...");
									singleFileLoaded.paused = false;
									fields.startAgain();
								}
								return false;
							}
						};
						singleFileLoaded.paused = false;
						rat.utils.loadResourcesSync(
							fileList,
							function () { syncDone = true; },
							{ update: singleFileLoaded, verbose: loadOptions.verbose }
						);
					}
				}

				// Is everything loaded and processed
				if (syncDone)
				{
					//	Make sure that we have no pending modules from the sync block
					rat.modules.process();
					rat.loaded = true;

					if (requestAnimationFrameID)
					{
						window.cancelAnimationFrame(requestAnimationFrameID);
						requestAnimationFrameID = 0;
					}
					if (loadOptions.done)
						loadOptions.done(rat, rat.getGlobalApp());
				}
				else
				{
					if (!requestAnimationFrameID)
						requestAnimationFrameID = window.requestAnimationFrame(updateFromAnimationFrame);
				}
			}
			else
			{
				if (!requestAnimationFrameID)
					requestAnimationFrameID = window.requestAnimationFrame(updateFromAnimationFrame);
			}
		}

		// This is how we update
		function updateFromAnimationFrame()
		{
			requestAnimationFrameID = 0;
			update();
		}

		function loadMissingFiles(doneCB, ops)
		{
			ops = ops || {};
			ops.logTag = ops.logTag || "";
			++rat.load.numLoadPasses;
			var list = rat.modules.missingFiles.list;
			rat.modules.missingFiles.list = [];
			rat.modules.missingFiles.byPath = {};
			rat.console.log("WARNING!  Another " + ops.logTag + " load phase (" + rat.load.numLoadPasses + ") is needed to get " + list.length + " required file(s).");
			for (var index = 0; index !== list.length; ++index)
				loadLog("-->" + list[index]);
			rat.utils.loadResources(list, doneCB, {
				update: ops.update
			});
		}

		// Called when a file loading pass is done
		function loadFinished()
		{
			//	Once all files have been loaded, check if there are other files that we need to queue
			if (rat.modules.missingFiles.list.length > 0)
			{
				loadMissingFiles(loadFinished,
						  {
						  	update: function (fields)
						  	{
						  		loadsLeft = fields.left;
						  		loadsDone = rat.utils.loadedScripts.length - fields.left;
						  		update();
						  	}
						  });
			}
			else
			{
				loadLog("File load finished.  " + rat.modules.pending.length + " Modules to process.");

				fileLoadDone = true;

				//	If not async, run now.
				if (!loadOptions.async)
					update();
			}
		}

		var fileList = rat.modules.missingFiles.list;
		rat.modules.missingFiles.list = [];
		rat.modules.missingFiles.byPath = {};

		// Async load path
		if (!loadOptions.skipLoad)
		{
			if (loadOptions.async)
			{
				requestAnimationFrameID = window.requestAnimationFrame(updateFromAnimationFrame);

				loadLog("Starting async file load...");
				++rat.load.numLoadPasses;
				rat.utils.loadResources(fileList, loadFinished, {
					update: function (fields)
					{
						loadsLeft = fields.left;
						loadsDone = rat.utils.loadedScripts.length - fields.left;
						update();
					}
				});
				loadLog("... Load Started.");
			}
				//	Sync load path
			else
			{
				loadLog("Starting synchronous file load...");
				rat.utils.loadResources(fileList, loadFinished, { async: false });
			}
		}
		else
		{
			if (loadOptions.async)
				requestAnimationFrameID = window.requestAnimationFrame(updateFromAnimationFrame);
			loadFinished();
		}
	};

	/// Sync loading utility wrapper
	/// @param {?} doneFunc
	///
	rat.simpleLoad = function (list, doneFunc)
	{
		rat.load({
			addSync: list,
			done: doneFunc
		});
	};
	rat.simpleload = rat.simpleLoad;	//	alt name

	/// Set the entry point for the application
	/// @param {Object=} context 
	rat.load.setEntryPoint = function (func, context)
	{
		if (typeof (Wraith) === "object" && Wraith.SetEntryPoint)
			Wraith.SetEntryPoint(func, context);
		else
		{
			if (context)
				func = func.bind(context);
			window.onload = func;
		}
	};

	//	Allow an external function to call our entry point manually if it is needed
	rat.ExternalEntryPoint = function ()
	{
		if (window.onload)
			window.onload(null); //- This NULL is to fix google closure compiler linting errors.
	};

})(rat);

///////////////////////////////////////////////////
///	Unit testing API
(function(rat)
{
	//	Empty functions for unit testing
	rat.unitTest= {
		
		//	Are unit tests enabled.
		enabled: true,
		
		//	Create a test group
		//	platform specific code
		group: function(name, func) {},
		
		//	Define an actual test
		//	Platform genric.  Specific version is _test
		test: function(name, code) {
			//	only conintue if we are enabled and have a _test func
			if( rat.unitTest.enabled && rat.unitTest._test )
				rat.unitTest._test(name, code);
		},
		
		//	Utility to have a single test in a group
		testGroup: function( grpName, testName, testCode )
		{
			rat.unitTest.group( grpName, function(){
				rat.unitTest.test( testName, testCode );
			});
		}
	};
})(rat);
