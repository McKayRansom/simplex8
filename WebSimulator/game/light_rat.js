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
var rat = {};
rat.loaded = false;  // Is rat loaded yet?

/// Get the global app
/// Rat uses this method to get the global app objects (If it exists)
/// @todo document what this is used for.
rat.getGlobalApp = function ()
{
	if (typeof (app) !== "undefined")
		return app;
	return void 0;
}

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

		if (text == rconsole.lastText)
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

	if (nav && (nav.userAgent.search("Edge\12")) >= 0)
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

	//	CPU class stuff
	if (nav && nav.cpuClass)	//	ARM, x64, others..
		rat.system.has.cpuClass = nav.cpuClass;
	else
		rat.system.has.cpuClass = 'unknown';
};

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
		//	project is running from a subfolder, e.g. for the intelXDK to keep crap out of top level.
		if (rat.system.rootSubFolder)
			newPath = "../" + newPath;
		if (rat.system.has.xboxLE || rat.system.applyCacheBuster)
			newPath = newPath + "?_=" + Math.random();
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
		var subIndex;

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

			//	If it isn't a file, try to fine the file it is in..
			var file = rat.modules.moduleFileLookup[module];

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
	};

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
		var missing = [];
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
		}

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
						function singleFileLoaded(fields)
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
						}
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
		};

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

//
//	r_minified
//
//	Used with rat.js so we know that RAT is minified
//

/**
 * Define that we are using a minified rat
 */
rat.system.has.minified = true;
//
//	@todo	move a bunch of graphics stuff to r_graphics...
//
rat.modules.add( "rat.os.r_system",
[
	"rat.graphics.r_graphics",
	"rat.debug.r_console",
	"rat.debug.r_profiler",
	"rat.math.r_math",
	
	{ name: "rat.os.r_le_core", platform: "xboxLE" } // Platform file
], 
function(rat)
{
	rat.paused = false; // For Cheats
	
	//	todo move to "debug" subobject, and move to r_debug module
	//	and rename functions and variables = it's confusing how they conflict/contrast
	rat.system.debugDrawTiming = false;
	rat.system.debugDrawStats = false;
	rat.system.debugDrawFramerateGraph = false;
	rat.system.debugDrawMemoryGraph = false;
	rat.system.debugFramerateGraphSettings = {
		bounds: {}
	};
	rat.system.debugDrawConsole = false;

	rat.system.load = null;
	rat.system.commandHandler = null;
	rat.system.hasFocus = true;
	if (window.hasFocus)
		rat.system.hasFocus = window.hasFocus();
	else if (document.hasFocus)
		rat.system.hasFocus = document.hasFocus();
	rat.preLoadTimer = null;

	rat.mousePos = {x:0, y:0};

	/**
	* @param {string=} canvasID
	* @suppress {uselessCode} - rat.system.load may not exist.
	*/
	rat.init = function (canvasID)
	{
		rat.console.log("Initalizing Rat...");
		//rat.console.log("rs: " +rat.system);

		if(rat.system.load)
			rat.system.load();
		canvasID = canvasID || "canvas";

		rat.detectPlatform();	//	detect platform and capabilities
		rat.profiler.init();
		rat.graphics.init(canvasID);
		if( rat.particle )
			rat.particle.init();
		if( rat.audio )
			rat.audio.init();

		//	eventually, call cycle, which will set itself up repeatedly.
		//setInterval(rat.system.cycle, 1000 / 60);
		//setTimeout(rat.system.cycle, 1000 / 60);
		window.requestAnimationFrame(rat.system.cycle);

		if( rat.input )
		{
			rat.input.init();
			rat.input.autoHandleEvents();
		}
		
		rat.console.registerCommand("showMemory", function (cmd, args)
		{
			var on = rat.system.debugDrawMemoryGraph;
			rat.system.debugDrawMemoryGraph = !on;
		}, ["showMemory", "memory"]);
	};

	rat.preLoadImages = function (imageList, postLoadFunction)
	{
		rat.postLoadFunction = postLoadFunction;
		rat.graphics.preLoadImages(imageList);	//	start the loading process
		rat.preLoadTimer = setInterval(rat.processPreLoad, 1000 / 60);	//	check back from time to time
	};

	rat.processPreLoad = function ()
	{
		if(rat.graphics.isCacheLoaded())
		{
			rat.console.log("rat preload done.");
			clearInterval(rat.preLoadTimer);
			rat.preLoadTimer = null;
			if(typeof rat.postLoadFunction !== 'undefined')
				rat.postLoadFunction();
		}
	};

	rat.setDraw = function (f)
	{
		rat.draw = f;
	};

	rat.setPostUIDraw = function (f)
	{
		rat.postUIDraw = f;
	};

	rat.setUpdate = function (f)
	{
		rat.update = f;
	};

	//
	//	main engine loop - do all updates and draw everything
	//
	rat.system.lastCycleTime = 0;
	rat.system.cycle = function ()
	{
		//	John:  This makes things harder for me when working in chrome - 
		//	I want chrome to give me the exception, not rat.  :)
		//	We could move all this code into a subroutine and then maybe optionally support a try/catch around it,
		//	based on platform or config or something?
		//try
		//{
			//	begin new frame
			rat.graphics.beginFrame();

			rat.profiler.pushPerfMark("Rat.System.Cycle");
			window.requestAnimationFrame(rat.system.cycle);	//	request next cycle immediately

			//	This is a system for capping framerate.  This avoids those super high spikes we get when the system
			//	suddenly gives us an update again very quickly.  Is this desirable?  I'm not sure.
			//if (0)
			//{
			//	var now = new Date().getTime();//Date().now();
			//	var elapsed = now - rat.system.lastCycleTime;

			//	var fpsInterval = rat.math.floor(1000/15);	//	1000/60 = 60 fps interval
			//	if (elapsed < fpsInterval)
			//		return;

			//	rat.system.lastCycleTime = now;// - (elapsed % fpsInterval);
			//}

			//	TODO:  move the above, and update deltatime into a new rat module, r_timing
			//		split timing loops into update and rendering?
			//		have updateDeltaTime tell us whether we've hit the minimum threshold for processing (to incorporate the above minimum check)

			

			//	update
			rat.profiler.pushPerfMark("updateDeltaTime");
			rat.system.updateDeltaTime();
			rat.profiler.popPerfMark("updateDeltaTime");

			if(rat.update)
			{
				rat.profiler.pushPerfMark("GameUpdate");
				rat.update(rat.deltaTime);
				rat.profiler.popPerfMark("GameUpdate");
			}

			if( rat.input )
			{
				rat.profiler.pushPerfMark("input.update");
				rat.input.update(rat.deltaTime);
				rat.profiler.popPerfMark("input.update");
			}

			if( rat.ui )
			{
				rat.profiler.pushPerfMark("ui.updateAnimators");
				rat.ui.updateAnimators(rat.deltaTime);
				rat.profiler.popPerfMark("ui.updateAnimators");
			}

			rat.profiler.pushPerfMark("updateScreens");
			rat.screenManager.updateScreens();
			rat.profiler.popPerfMark("updateScreens");
			
			if (rat.audio.update)
				rat.audio.update(rat.deltaTime);

			if(rat.cycleUpdate)
			{
				rat.profiler.pushPerfMark("cycleupdate");
				rat.cycleUpdate.updateAll(rat.deltaTime);
				rat.profiler.popPerfMark("cycleupdate");
			}
			
			if(rat.timerUpdater)
			{
				rat.profiler.pushPerfMark("timerUpdate");
				rat.timerUpdater.updateAll(rat.deltaTime);
				rat.profiler.popPerfMark("timerUpdate");
			}

			if (rat.Rumble && rat.Rumble.supported)
				rat.Rumble.frameUpdate(rat.deltaTime);

			//	draw, starting with global transform if any, and then installed draw routine
			rat.profiler.pushPerfMark("Rendering");
			rat.graphics.save();

			rat.graphics.setupMatrixForRendering();
			if(rat.graphics.autoClearCanvas)
			{
				rat.profiler.pushPerfMark("Clearing Canvas");
				rat.graphics.clearCanvas();
				rat.profiler.popPerfMark("Clearing Canvas");
			}

			if (rat.graphics.canvas.style && rat.graphics.canvas.style.backgroundImage && rat.system.has.Wraith)
			{
				rat.graphics.canvas.style.backgroundImage.drawTiled(rat.graphics.canvas.width, rat.graphics.canvas.height);
			}

			if (rat.beforeDraw)
			{
				rat.profiler.pushPerfMark("BEFORE draw");
				rat.beforeDraw();
				rat.profiler.popPerfMark("BEFORE draw");
			}
			
			if(rat.draw)
			{
				rat.profiler.pushPerfMark("rat.draw");
				rat.draw();
				rat.profiler.popPerfMark("rat.draw");
			}

			if( rat.screenManager )
			{
				rat.profiler.pushPerfMark("screen draw");
				rat.screenManager.drawScreens();
				rat.profiler.popPerfMark("screen draw");

				if (rat.postUIDraw)
				{
					rat.profiler.pushPerfMark("post UI draw");
					rat.postUIDraw();
					rat.profiler.popPerfMark("post UI draw");
				}
			}

			//	draw debug display, if it's turned on
			//	We used to do this after scale/translate, so we can be sure to be in the bottom corner...
			//	but that's lame.  For one thing, it makes it hard to see on high-res displays!
			//	Also, these variable names are ridiculous, but they're sort of embedded in many apps at this point.
			//	could at least rename the functions...  Or deprecate the old names but keep supporting them...?
			rat.profiler.pushPerfMark("Debug Rendering");
			rat.console.drawConsole();
			if(rat.system.debugDrawTiming)
				rat.system.drawDebugTiming();
			if(rat.system.debugDrawStats)
				rat.system.drawDebugStats();
			if (rat.system.debugDrawFramerateGraph)
				rat.system.drawDebugFramerateGraph();
			if (rat.system.debugDrawMemoryGraph)
				rat.system.drawDebugMemoryGraph();
			if(rat.system.debugDrawConsole)
				rat.console.drawLog();
			if (rat.profiler && rat.profiler.displayStats)
			{
				rat.profiler.pushPerfMark("Profiler draw");
				rat.profiler.displayStats();
				rat.profiler.popPerfMark("Profiler draw");
			}
			rat.profiler.popPerfMark("Debug Rendering");

			rat.graphics.restore();	//	restore after scaling, translating, etc.
			rat.profiler.popPerfMark("Rendering");

			if (rat.afterDraw)
			{
				rat.profiler.pushPerfMark("After Draw");
				rat.afterDraw();
				rat.profiler.popPerfMark("After Draw");
			}
			
			rat.profiler.popPerfMark("Rat.System.Cycle");

			rat.graphics.endFrame();
		//}
		//catch (err)
		//{
		//	rat.console.log( "EXCEPTION: " + err.toString() );
		//}
	};

	//	timing globals - move this stuff to rat namespace
	rat.deltaTimeRaw = 1 / 60.0;	//	deltatime.  see calculation near framerate update
	rat.deltaTimeRawSmoothed = rat.deltaTimeRaw;
	rat.deltaTimeMod = 1;
	rat.deltaTimeUnsmoothed = rat.deltaTime;
	rat.deltaTime = rat.deltaTimeRaw;
	rat.runningFpsUnsmoothed = 1 / rat.deltaTimeUnsmoothed;
	rat.runningFps = 1 / rat.deltaTime;
	rat.runningTime = 0;

	function getDeltaTimeStamp()
	{
		if (rat.system.has.Wraith)
			return 0;
		else if (window.performance)
			return window.performance.now()/1000;
		else
			return new Date().getTime()/1000;
	}

	var lastTimeStamp = getDeltaTimeStamp();
	//	This array is used to generate the smoothed deltaTimeRaw
	var gDeltaTimeRawSmoother = [];
	rat.SMOOTHING_SAMPLE_SIZE = 25;
	var gSmootherIndex = 0;

	//	These arrays are used by the FPS Debug graph
	var gDeltaTimeRawRecord = [];
	var gDeltaTimeRawSmoothedRecord = [];
	var FPS_RECORD_SIZE = 100;
	rat.system.FPS_RECORD_SIZE = FPS_RECORD_SIZE;
	var gFPSRecordIndex = 0;
	

	//	update deltatime calculation
	var gHighDeltaTime; // The highest delta time over the last amount of time.  This means the slowest FPS
	var gHighFor = 0;// How long as the high delta time been the hi
	rat.system.updateDeltaTime = function ()
	{
		//	Things break down with a delta time mode <= 0
		if (rat.deltaTimeMod <= 0)
			rat.deltaTimeMod = 0.0000000001;
		var now;

		//	Get the rat.deltaTimeRaw
		//	a bunch of timing stuff, both for debug display and for deltatime (DT) calculations
		//	todo: use higher precision timing.
		if (rat.system.has.Wraith)
			rat.deltaTimeRaw = Wraith.getDeltaTime();
		else
		{
			now = getDeltaTimeStamp();
			rat.deltaTimeRaw = now - lastTimeStamp;
			lastTimeStamp = now;
		}

		//	Force?
		if (rat.paused)
			rat.deltaTimeRaw = 0;

		//	artificial limit of dt for systems running so slowly that an accurate dt would be ridiculous.
		if (rat.deltaTimeRaw > 0.1 && !rat.paused)	//	10fps
			rat.deltaTimeRaw = 0.1;

		//	Include the deltaTimeMod in rat.deltaTime
		rat.deltaTimeUnsmoothed = rat.deltaTimeRaw * rat.deltaTimeMod;

		//	Get the raw FPS
		rat.runningFpsUnsmoothed = 1 / rat.deltaTimeUnsmoothed;

		//	Figure out the smoothed deltaTime
		//	this controls how quickly average frame rate matches immediate frame rate.  1 = just use current frame.  5 = average out over 5 frames.
		//	The value was 5 for a long time.  I'm just not sure that's right.
		var totalTimeRaw = 0;
		gDeltaTimeRawSmoother[gSmootherIndex] = rat.deltaTimeRaw;
		gSmootherIndex = (gSmootherIndex + 1) % rat.SMOOTHING_SAMPLE_SIZE;
		var recordSize = gDeltaTimeRawSmoother.length < rat.SMOOTHING_SAMPLE_SIZE ? gDeltaTimeRawSmoother.length : rat.SMOOTHING_SAMPLE_SIZE;
		for (var index = 0; index !== recordSize; ++index)
			totalTimeRaw += gDeltaTimeRawSmoother[index];
		rat.deltaTimeRawSmoothed = totalTimeRaw / recordSize;

		rat.deltaTime = rat.deltaTimeRawSmoothed * rat.deltaTimeMod;

		rat.runningFps = 1 / rat.deltaTime;

		gDeltaTimeRawRecord[gFPSRecordIndex] = rat.deltaTimeRaw;
		gDeltaTimeRawSmoothedRecord[gFPSRecordIndex] = rat.deltaTimeRawSmoothed;
		gFPSRecordIndex = (gFPSRecordIndex + 1) % FPS_RECORD_SIZE;
		rat.runningTime += rat.deltaTimeRaw;

		if (gHighDeltaTime === void 0 || (gHighFor += rat.deltaTimeRaw) > 2.0 || gHighDeltaTime < rat.deltaTimeRaw)
		{
			gHighDeltaTime = rat.deltaTimeRaw;
			gHighFor = 0;
		}
	};

	//	draw some debug timing info (framerate info)
	rat.system.drawDebugTiming = function ()
	{
		//var dispFps = rat.math.floor(rat.runningFps * 10)/10;
		var dispFps = rat.math.floor(rat.runningFps);
		var dispDT = rat.math.floor(rat.deltaTime * 1000) / 1000;
		var ctx = rat.graphics.getContext();
		ctx.fillStyle = "#F08030";
		var fontSize = rat.math.floor(12 * 1/rat.graphics.globalScale.x);
		ctx.font = "bold " + fontSize + "px monospace";
		var yPos = rat.graphics.SCREEN_HEIGHT - fontSize;
		ctx.fillText("fps: " + dispFps + "  DT: " + dispDT, 30, yPos);
	};

	//	draw debug stats - particle counts, for instance
	//	TODO: use offscreen for this and only update when it changes?
	//	fillText is slow and affects the performance we're trying to measure.  :(
	//	I'm hesitant to introduce a dependency here from rat.system to rat.ui or rat.offscreen
	//	do we already have a ui dependency?
	rat.system.drawDebugStats = function ()
	{
		var atX = 30;
		
		var ctx = rat.graphics.getContext();
		ctx.fillStyle = "#F08030";
		var fontSize = rat.math.floor(12 * 1/rat.graphics.globalScale.x);
		ctx.font = "bold " + fontSize + "px monospace";
		var yShift = fontSize;
		var yPos = rat.graphics.SCREEN_HEIGHT - 3 * fontSize;

		//	particle stats
		if( rat.particle )
		{
			var totalSystems = rat.particle.getSystemCount();
			var totalEmitters = rat.particle.getAllEmitterCount();
			var totalParticles = rat.particle.getAllParticleCount();
			var totalCachedStates = rat.particle.State.cacheSize;
			var totalParticleStateObjects = rat.particle.State.count;
			
			//	Particle system stats.
			if(rat.particle.stateCaching.enabled)
			{
				ctx.fillText("   states(cached): " + totalParticleStateObjects + "(" + totalCachedStates + ")", atX, yPos);
				yPos -= yShift;
			}
			ctx.fillText("P: sys: " + totalSystems + "  em: " + totalEmitters + "  p: " + totalParticles, atX, yPos);
			yPos -= yShift;
		}
		
		//	UI stats
		if (rat.graphics && rat.graphics.frameStats && rat.ui )
		{
			ctx.fillText("UI: elem: " + rat.graphics.frameStats.totalElementsDrawn
				+ ", mcalls " + rat.ui.mouseMoveCallCount
				+ ", ucalls " + rat.ui.updateCallCount,
				atX, yPos);
			yPos -= yShift;
		}
		
		//	image draw calls
		if (rat.graphics && rat.graphics.Image && rat.graphics.Image.perFrameDrawCount )
		{
			ctx.fillText("Images: " + rat.graphics.Image.perFrameDrawCount, atX, yPos);
			yPos -= yShift;
		}

		//	XUI element renders
		if (rat.xuijs)
		{
			var total = 0;
			for( var key in rat.xuijs.XuiElementsDrawnThisFrame)
			{
				total += rat.xuijs.XuiElementsDrawnThisFrame[key];
				var skippedText = (
					(rat.xuijs.XuiElementsSkippedThisFrame[key])
					? " (/" + rat.xuijs.XuiElementsSkippedThisFrame[key] + ")"
					: "");
				ctx.fillText( "   "+ key +": "
					+ rat.xuijs.XuiElementsDrawnThisFrame[key]
					+ skippedText
					, atX, yPos );
				yPos -= yShift;
			}
			ctx.fillText( "XUI Elem: " + total, atX, yPos );
			yPos -= yShift;
			
			rat.xuijs.XuiElementsDrawnThisFrame = {};
			rat.xuijs.XuiElementsSkippedThisFrame = {};
		}
	};

	//	show debug memory graph (if we can)
	rat.system.drawDebugMemoryGraph = function ()
	{
		if( !rat.system.debugMemoryGraphSettings)
			rat.system.debugMemoryGraphSettings = {bounds:{}, history:[]};
		var settings = rat.system.debugMemoryGraphSettings;
		var ctx = rat.graphics.getContext();
		var space = {width : rat.graphics.SCREEN_WIDTH, height : rat.graphics.SCREEN_HEIGHT};
		if( !settings.bounds || !settings.bounds.x )
		{
			settings.bounds = {};
			settings.bounds.w = space.width/4;
			settings.bounds.h = space.height/8;
			settings.bounds.x = space.width * 0.90 - settings.bounds.w;
			settings.bounds.y = (space.height * 0.95 - (settings.bounds.h * 2))-16;
		}
		var bounds = settings.bounds;
		
		ctx.save();
		ctx.fillStyle = "white";
		ctx.translate(bounds.x, bounds.y);
		var fontSize = rat.math.floor(12 * 1/rat.graphics.globalScale.x);
		ctx.font = "bold " + fontSize + "px monospace";
		
		//	the marks
		var x, y;
		for( var markIndex = 0; markIndex < 3; ++markIndex )
		{
			ctx.lineWidth = 1;
			ctx.strokeStyle = (["red", "yellow", "blue"])[markIndex];
			ctx.beginPath();
			y = (markIndex/2) * bounds.h;
			ctx.moveTo(0, y);
			ctx.lineTo(bounds.w, y);
			ctx.stroke();
		}
		
		//	We need two records to draw.
		if( !window.performance || !window.performance.memory )
		{
			ctx.textAlign = "start";
			ctx.textBaseline = "hanging";
			ctx.fillText("Memory unavailable.", 0, bounds.h+1);
		}
		else
		{
			var ttl = window.performance.memory.totalJSHeapSize || 1;
			var used= window.performance.memory.usedJSHeapSize || 0;
			var percent = (used/ttl)*100;
			settings.history.push( used );
			if( settings.history.length > rat.system.FPS_RECORD_SIZE )
				settings.history.shift();
			ctx.textAlign = "start";
			ctx.textBaseline = "hanging";
			ctx.fillText("Memory: " + percent.toFixed(2) + "% of " + (ttl / 1024 / 1024).toFixed(2) + "MB", 0, bounds.h+1);
			
			ctx.strokeStyle = "green";
			ctx.save();
			ctx.beginPath();
			for( var index = 0; index < settings.history.length && index < rat.system.FPS_RECORD_SIZE; ++index )
			{
				var visualIndex = index;
				if( settings.history.length < rat.system.FPS_RECORD_SIZE )
					visualIndex += (rat.system.FPS_RECORD_SIZE -settings.history.length);
				var record = settings.history[index];
				var x = bounds.w * (visualIndex/(rat.system.FPS_RECORD_SIZE-1));
				var y = bounds.h * (1.0-(record/ttl));
				if( index == 0 )
					ctx.moveTo( x, y );
				else
					ctx.lineTo( x, y );
			}
			ctx.stroke();
			ctx.restore();
		}
		ctx.restore();
	};
		
	//	show debug frame rate graph
	rat.system.drawDebugFramerateGraph = function ()
	{
		//	We need two records to draw.
		var recordCount = gDeltaTimeRawRecord.length;
		if (recordCount <= 1)
			return;

		var ctx = rat.graphics.getContext();
		//var canvas = rat.graphics.canvas;
		var space = {width : rat.graphics.SCREEN_WIDTH, height : rat.graphics.SCREEN_HEIGHT};
		var graph = rat.system.debugFramerateGraphSettings;
		//	STT changed this 2015.3.3
		//	It had the problem that it was only getting set the first time, so if screen resized, it wasn't updating, so it ended up in lame placs.
		//	But I want to respect the idea of having defined settings or not.
		//	So, now we check if there were any settings and recalculate local values ourselves each frame instead of setting the globals.
		//	Another approach would be to copy whatever is set in debugFramerateGraphSettings and just fill in what's missing each frame.
		//	Also note that if some project is actually using debugFramerateGraphSettings, they'd better be adapting to resizes!  :)
		if (!graph || !graph.bounds || !graph.bounds.x)
		{
			graph = {bounds:{}};	//	make a new local temp settings object
			graph.bounds.w = space.width/4;
			graph.bounds.h = space.height/8;
			graph.bounds.x = space.width * 0.90 - graph.bounds.w;
			graph.bounds.y = space.height * 0.95 - graph.bounds.h;
		}
		
		ctx.translate(graph.bounds.x, graph.bounds.y);

		//	the marks
		ctx.lineWidth = 1;
		ctx.strokeStyle = "#F02040";
		ctx.beginPath();
		ctx.moveTo(0, 0);
		ctx.lineTo(graph.bounds.w, 0);
		ctx.stroke();

		ctx.beginPath();
		ctx.moveTo(0, graph.bounds.h / 2);
		ctx.lineTo(graph.bounds.w, graph.bounds.h / 2);
		ctx.stroke();

		ctx.beginPath();
		ctx.moveTo(0, graph.bounds.h);
		ctx.lineTo(graph.bounds.w, graph.bounds.h);
		ctx.stroke();

		//	What is the top mark
		var topMark = 120; // 120 fps

		function drawChart(vals, startIndex)
		{
			ctx.beginPath();
			var point = {
				x: 0,
				y: 0
			};
			var len = vals.length;
			var xShift = graph.bounds.w / (FPS_RECORD_SIZE-1);
			var p;
			for (var index = 0; index !== len; ++index)
			{
				p = vals[(index + startIndex) % len];
				p = (1 / p) / topMark;
				point.y = graph.bounds.h - (p * graph.bounds.h);
				
				if (index === 0)
					ctx.moveTo(point.x, point.y);
				else
					ctx.lineTo(point.x, point.y);

				point.x += xShift;
			}
			ctx.stroke();
		}

		ctx.lineWidth = 2;

		//	Draw profile markers if we are using rat.profiler and have some
		var p;
		if (rat.profiler.perfmarkers.length > 0)
		{
			ctx.save();

			var list = rat.profiler.perfmarkers;

			//	What is the current frame
			var curFrame = rat.graphics.frameIndex;

			var marker;
			var tx;
			for (var index = 0; index !== list.length; ++index)
			{
				marker = list[index];
				p = 1-((curFrame - marker.frame) / FPS_RECORD_SIZE);

				ctx.strokeStyle = marker.color;
				ctx.beginPath();
				tx = graph.bounds.w * p;
				ctx.moveTo(tx, 0);
				ctx.lineTo(tx, graph.bounds.h);
				ctx.stroke();
			}

			ctx.restore();
		}
		
		//	Draw the FPS records
		//	Second - raw
		ctx.strokeStyle = "#808000";
		drawChart(gDeltaTimeRawRecord, gFPSRecordIndex);

		//	Draw the FPS records
		//	First - smoothed
		ctx.strokeStyle = "#8080FF";
		drawChart(gDeltaTimeRawSmoothedRecord, gFPSRecordIndex);

		//	FPS text
		//	Scale this up to be legible by default in high res.
		var fontSize = rat.math.floor(12 * 1/rat.graphics.globalScale.x);
		var dispFps = ((rat.runningFps*100)|0)/100;
		var dispDT = ((rat.deltaTime * 1000) | 0) / 1000;
		var lowFPS = 1/gHighDeltaTime;
		ctx.fillStyle = "#F0F0F0";
		ctx.font = "bold " + fontSize + "px monospace";
		ctx.textBaseline = "hanging";
		ctx.TextAlign = "left";
		dispFps = "" + dispFps.toFixed(2);
		dispDT = "" + dispDT.toFixed(3);
		lowFPS = "" + lowFPS.toFixed(2);
		var padder = "     ";
		dispFps = padder.substr(0, padder.length - dispFps.length) + dispFps;
		dispDT = padder.substr(0, padder.length - dispDT.length) + dispDT;

		ctx.fillText("fps: " + dispFps + " (low "+ lowFPS+")  DT: " + dispDT, 0, graph.bounds.h);

		ctx.translate(-graph.bounds.x, -graph.bounds.y);
	};

	//
	//	send a rat/game command down the screen stack.
	//	This lets any screen step in and handle the command.
	//	todo:  merge with the above functions
	//
	rat.dispatchCommand = function (command, info)
	{
		//	first see if any screen in the stack is going to handle this.
		//	this is for popups, for example.
		if( rat.screenManager )
		{
			for(var i = rat.screenManager.screenStack.length - 1; i >= 0; i--)
			{
				var screen = rat.screenManager.screenStack[i];
				if(typeof screen.handleCommand !== 'undefined')
				{
					var handled = screen.handleCommand(command, info);
					//	note that the screen might have popped itself, but the way we're handling this in reverse order is OK.
					if(handled)
						return;
				}
			}
		}
		
		//	then hand to whatever registered command handler there is.
		if(rat.system.commandHandler)
			rat.system.commandHandler(command, info);
	};

	/**
	* util to use the proper event handling for IE and other browsers
	* @param {boolean=} capture optional
	*/
	rat.addOSEventListener = function (element, event, func, capture)
	{
		if (element && element.addEventListener)
			return element.addEventListener(event, func, !!capture);
		else if (element && element.attachEvent)
			return element.attachEvent(event, func);
		else if (typeof (window) !== 'undefined' && window.addEventListener)
			return window.addEventListener(event, func, !!capture);
	};

	/**
	* util to remove the proper event handling for IE and other browsers
	* @param {boolean=} capture optional
	*
	* If an event listener retains any data (such as inside a closure), use this
	* function to remove that data reference. Called with the same parameters as
	* rat.addOSEventListener that added it.
	*/
	rat.removeOSEventListener = function (element, event, func, capture)
	{
		if (element.removeEventListener)
			element.removeEventListener(event, func, !!capture);
		else if (element.detachEvent)
			element.detachEvent(event, func);
		else if (typeof window !== 'undefined' && window.removeEventListener)
			window.removeEventListener(event, func, !!capture);
	};

	/**
	* add key event listener, and standardize some values in event
	* @param {boolean=} capture optional
	*/
	rat.addOSKeyEventListener = function (element, event, func, capture)
	{
		rat.addOSEventListener(element, event, function (e)
		{
			if( rat.input )
				rat.input.standardizeKeyEvent(e);
			func(e);
		}, capture);
	};

	////////////////////////////////////////////////////////////////////////////////
	/// Handle event dispatches for error, suspend and resume as fired by WinJS apps

	//	Fire on any error
	// A global error handler that will catch any errors that are not caught and handled by your application's code.
	// Ideally the user should never hit this function because you have gracefully handled the error before it has 
	// had a chance to bubble up to this point. In case the error gets this far, the function below will display an
	// error dialog informing the user that an error has occurred.
	function onError(event)
	{
		rat.console.log("JS ERROR! " + JSON.stringify(event));
		if (rat.events && rat.events.fire)
			rat.events.fire("error", { sysEvent: event });

		var errorDialog = new window.Windows.UI.Popups.MessageDialog(
			event.detail.errorUrl +
				"\n\tLine:\t" + event.detail.errorLine +
				"\tCharacter:\t" + event.detail.errorCharacter +
				"\nMessage: " + (event.detail.message || event.detail.errorMessage),
			(event.type === "error") ? "Unhanded Error!" : event.type);
		errorDialog.cancelCommandIndex = 0;
		errorDialog.defaultCommandIndex = 0;
		errorDialog.showAsync();
		return true;
	}

	//	Fired when we are resumed from a suspend.
	function onResume(event)
	{
		var args = { sysEvent: event };
		if (rat.events && rat.events.fire)
			rat.events.fire("resume", args);
		//	How did we get a resume before we finished loading in rat...
	}

	//	Fired when the app is going to be suspended
	function onSuspend(event)
	{
		var sysEvent = event;	//	Cannot leave this as a param or it isn't available to our sub-functions

		//	If we have async stuff to do...
		var busyCount = 0;
		var promise;
		function setBusy()
		{
			++busyCount;
			if (busyCount === 1 && rat.system.has.winJS)
			{
				sysEvent.setPromise(
					new window.WinJS.Promise(function (completeDispatch, errorDispatch, progressDispatch)
					{
						promise = completeDispatch;
					})
				);
			}
		}

		//	Set that we are done with our work.
		function setDone()
		{
			if (busyCount <= 0)
				return;

			--busyCount;
			if (busyCount === 0 && promise)
				promise("Done");
		}

		//	Set what to save with the suspend.
		var sessionData = {};
		function storeData(data)
		{
			sessionData = data;
		}

		//	Start busy.
		setBusy();

		//	Firing the event out into the world.
		var args = { store: storeData, setBusy: setBusy, setDone: setDone, sysEvent: sysEvent };
		if (rat.events && rat.events.fire)
			rat.events.fire("suspend", args);

		//	Save any data set
		if (rat.system.has.winJS)
			window.WinJS.Application.sessionState["savedState"] = sessionData;

		//	And we are done working in this file... Note that we may still be pending elsewhere.
		setDone();
	}

	var hasSuspendResume = false;
	if (rat.detectPlatform.detected)
		hasSuspendResume = rat.system.has.winJS;
	else
		hasSuspendResume = !!window.Windows;

	///TODO Wraith will need to fire similar (or the same) events if we event ship a JS app running in wraith under Windows 8 or as an XboxOne app
	if (hasSuspendResume && window.WinJS)
	{
		/// [JSH 1/20/2015] most of this is copied and modified from what was found in agent.

		window.WinJS.Application.onerror = onError;
		window.WinJS.Application.oncheckpoint = onSuspend;
		window.Windows.UI.WebUI.WebUIApplication.addEventListener("resuming", onResume, false);
	}

	////////////////////////////////////////////////////////////////////////////////
	///	Handle focus/blur events so we can now if the app is in focus
	rat.addOSEventListener( window, "focus", function ()
	{
		if (!rat.system.hasFocus)
		{
			//rat.console.log("App has focus");
			rat.system.hasFocus = true;
			if (rat.events && rat.events.fire)
				rat.events.fire("focus");
		}
	});

	rat.addOSEventListener(window, "blur", function ()
	{
		if (rat.system.hasFocus)
		{
			//rat.console.log("App does NOT have focus");
			rat.system.hasFocus = false;
			if (rat.events && rat.events.fire)
				rat.events.fire("blur");
		}
	});

});
//
//	An os event registration and dispatch system
//
rat.modules.add( "rat.os.r_events",
[ ], 
function(rat)
{
	rat.events = rat.events || {};
	rat.events.registered = {};	//	key is event name.   value is an array 
	rat.events.firing = {};		//	if we are firing an event, hold the data that will allow safe removal of events.
	rat.events.queued = rat.events.queued || {};
	
	/// Register a new event listener
	rat.addEventListener = function( event, func, ctx )
	{
		if( !func )
			return;
		rat.events.registered[event] = rat.events.registered[event] || [];
		var listeners = rat.events.registered[event];
		listeners.push({
			func: func,
			ctx: ctx
		});
		
		//	Some special handling for events that where queued until we got a listener
		if( rat.events.queued[event] )
		{
			rat.events.fire.apply( rat.events, rat.events.queued[event] ); // queued is an array.  Inlcudes the name of the event.
			rat.events.queued[event] = void 0;
		}
	};
	
	/// UnRegister a new event listener
	rat.removeEventListener = function( event, func, ctx )
	{
		if( !func )
			return false;
		var listeners = rat.events.registered[event];
		if( !listeners )
			return false;
		
		//	Search
		var firing = rat.events.firing[event];
		var listener;
		for( var index = 0; index !== listeners.length; ++index )
		{
			listener = listeners[index];
			if( listener.func === func && listener.ctx === ctx )
			{
				//	Make sure that any events that we are already firing are ok
				if( firing )
				{
					if( firing.index <= index )
						--firing.index;
					--firing.stopAt;
				}
				
				//	Remove the event.
				listeners.splice( index, 1 );
				return true;
			}
		}
		
		//	Not found
		return false;
	};
	
	//	Queue an event until we have added a listener
	rat.events.queueEvent = function (event /*,[arg, arg, ...]*/)
	{
		var fireArgs = Array.prototype.slice.call(arguments);
		var listeners = rat.events.registered[event];
		if (listeners && listeners.length)
			rat.events.fire.apply(rat.events, fireArgs);
		else
			rat.events.queued[event] = fireArgs;
	};
	
	//	Fire an event
	rat.events.fire = function (event /*,[arg, arg, ...]*/)
	{
		var listeners = rat.events.registered[event];
		if( !listeners || listeners.length === 0 )
			return false;
		var args = Array.prototype.slice.call(arguments, 1);
		var savedFiring = rat.events.firing[event];
		
		//	We use this object so we can safely remove objects while iterating over an array
		rat.events.firing[event] = {
			index: 0,
			stopAt: listeners.length
		};
		var firing = rat.events.firing[event];
		var listener, func, ctx;
		for( ; firing.index !== firing.stopAt; ++firing.index )
		{
			listener = listeners[firing.index];
			func = listener.func;
			ctx = listener.ctx;
			func.apply( ctx, args );
			
			///TODO Add some system where we can stop any more events from firing..
		}
		
		rat.events.firing[event] = savedFiring;
	};
	
});
//
//	console and debug utils
//
//	(move debug utils to r_debug maybe)
 
//	console namespace
rat.modules.add( "rat.debug.r_console",
[
	"rat.os.r_system", 
	"rat.math.r_math", 
	"rat.graphics.r_graphics", 
	"rat.utils.r_utils", 
	"rat.input.r_input",
], 
function(rat)
{
	var logLineHeight = 14;
	
	rat.console.bounds = {x:0, y:0, w:{fromParent:true, val:0}, h:{percent:true, val:0.5}};
	rat.console.textColor = "#90B090";
	rat.console.bgColor = "rgba(0,0,0,0.5)";
	rat.console.state = {
		consoleAllowed:	false,
		consoleActive: false,
		cursorPos: 0,
		pulseTimer: 0,
		currentCommand: "",

		//	Registered commands
		nextCommandID: 0,			//	The next ID to provide to a registered command
		commandList: [],			//	The list of available commands
		commandHistory: [],			//	History of entered commands
		commandHistoryIndex: -1,	//	What history item am i accessing (up/down)  -1 is im not
		commandHistoryMax: 100,		//	Remember up to 100 commands

		//	For auto-complete
		autoComplete: [],			//	List of currently built auto-completion options
		accessingAutoComplete: -1,	//	where are we in the auto-completion list

		logOffset: 0,				// How to shift the log display
		
		consoleKey: '/'				// What key to use to open the console
	};
	var state = rat.console.state;

	//	Load the command history from local storage if it is there
	var storage = window.localStorage;
	var storageCmdHistoryKey = "rat_commandHistory";
	if (storage && storage.getItem(storageCmdHistoryKey))
		rat.console.state.commandHistory = JSON.parse(storage.getItem(storageCmdHistoryKey));

	rat.console.setBounds = function(x, y, w, h)
	{
		rat.console.bounds.x = x;
		rat.console.bounds.y = y;	//	ignored, currently
		rat.console.bounds.w = w;	//	ignored, currently
		rat.console.bounds.h = h;	//	ignored, currently
	};

	//	Utility for resetting auto-complete
	function resetAutoComplete()
	{
		state.autoComplete = [];
		state.accessingAutoComplete = -1;
	}

	//	Utility function to handle setting the current command
	function setCurCommand(cmd, resetHistory, resetAutocomplete)
	{
		state.currentCommand = cmd;
		state.cursorPos = rat.math.min( rat.math.max(0, state.cursorPos), state.currentCommand.length);
		if (resetHistory)
			state.commandHistoryIndex = -1;
		if (resetAutocomplete)
			resetAutoComplete();
	}

	function getGlobalVar(name)
	{
		return rat.utils.get(this, name);
	}

	//	Build the auto-complete list
	function buildAutocomplete(cmd)
	{
		//	Start with an empty list.
		state.autoComplete = [];

		//	The commands must START with cmd to fit.
		var upperCmd = cmd.toUpperCase();
		var commandCount = state.commandList.length;
		for (var commandIndex = 0; commandIndex !== commandCount; ++commandIndex)
		{
			//	Is this the matching command
			//	If the command matches, do NOT put its aliases in the list
			var curCmd = state.commandList[commandIndex];
			if (curCmd.name.slice(0, upperCmd.length) === upperCmd )
			{
				state.autoComplete.push(curCmd.name);
				continue;
			}

			//	Check its aliases
			var aliasCount = curCmd.alias.length;
			for (var aliasIndex = 0; aliasIndex !== aliasCount; ++aliasIndex)
			{
				if (curCmd.alias[aliasIndex].slice(0, upperCmd.length) === upperCmd )
					state.autoComplete.push(curCmd.alias[aliasIndex]);
			}
		}

		//	IF we found nothing, maybe we are entering javascript..   Variable name completion
		if (state.autoComplete.length <= 0)
		{
			//	Find the leading variable name...
			//	Do this by finding the last '.'
			var fullVarNameEndsAt = cmd.lastIndexOf('.');
			if (fullVarNameEndsAt > 1)//	We MUST find something (app or rat or some other global)
			{
				var fullVarName = cmd.substring(0, fullVarNameEndsAt);
				var mustStartWith = cmd.substring(fullVarNameEndsAt + 1);
				//if( mustStartWith )
				//	rat.console.log("Auto complete for variables in '" + fullVarName + "' starting with '" + mustStartWith + "'");
				//else
				//	rat.console.log("Auto complete for variables in '" + fullVarName + "'");

				//	get the variable
				var variable = getGlobalVar(fullVarName);
				if (variable !== void 0)
				{
					for (var key in variable)
					{
						if( key )
						{
							if( mustStartWith )
							{
								var startsWith = key.substring(0, mustStartWith.length);
								if (startsWith !== mustStartWith)
									continue;
							}

							state.autoComplete.push(fullVarName + "." + key);
						}
					}
				}
			}
				

		}

		//	Alphabetical order
		state.autoComplete.sort();
		state.accessingAutoComplete = 0;
	}

	//	Allow the console
	rat.console.allow = function (allow)
	{
		if (allow === void 0)
			allow = true;
		rat.console.state.consoleAllowed = !!allow;
	};
	
	//	Log this (type of) output once, recording that we've logged it,
	//	so we can suppress future messages of that type.
	rat.console.logOnce = function (text, name, count)
	{
		if (!name)	//	if name not specified, use full text message to identify it
			name = text;
		
		if (!count)	//	optional count (to allow this message more than once, but still limited)
			count = 1;
		
		if (!rat.console.onceRecord[name])
			rat.console.onceRecord[name] = 0;
		rat.console.onceRecord[name]++;
		if (rat.console.onceRecord[name] <= count)
		{
			rat.console.log(text);
		}
	};

	//	Draw the console
	rat.console.drawConsole = function ()
	{
		//	Bail if we are either not allowed or not active.
		if (!rat.console.state.consoleAllowed ||
			!rat.console.state.consoleActive)
			return;

		//	Draw at the bounds set.
		//	This includes drawing the log and any input that we have
		//	Find out what the bounds mean
		var bounds = rat.console.bounds;
		if (rat.ui && rat.ui.data && rat.ui.data.calcBounds)
		{
			var ratBounds = {
				x: 0,
				y: 0,
				w: rat.graphics.SCREEN_WIDTH,
				h: rat.graphics.SCREEN_HEIGHT
			};
			bounds = rat.ui.data.calcBounds({ bounds: bounds }, ratBounds);
		}

		//	Draw the BG
		rat.graphics.drawRect(
			bounds,
			{ fill: true, color: rat.console.bgColor });
		rat.graphics.drawRect(
			bounds,
			{ color: rat.console.bgColor, lineWidth:2 });

		//	Draw the log
		var logBounds = rat.utils.copyObject( bounds );
		logBounds.h -= 24;
		rat.console.drawLog(logBounds);

		//	Draw the line between the log and the input
		logBounds.y = logBounds.h;
		logBounds.h = bounds.h - logBounds.h;
		rat.graphics.drawRect(logBounds, { color: rat.console.bgColor, lineWidth: 2 });

		//	Draw the running time
		logBounds.x += 4;
		logBounds.y += 4;

		var time = rat.runningTime || 0;
		var hours = (time/60/60)|0;
		time -= hours * 60 * 60;
		var minutes = (time/60)|0;
		time -= minutes * 60;
		var seconds = time|0;
		var timeText = "" + hours + ":" + minutes + ":" + seconds;
		var width = rat.graphics.ctx.measureText(timeText);
		if (width.width !== void 0)
			width = width.width;
		rat.graphics.drawText(timeText, logBounds.x + logBounds.w - width - 8, logBounds.y);

		//	Draw the current console text
		
		rat.graphics.drawText("> " + state.currentCommand, logBounds.x, logBounds.y);

		//	Draw the cursor
		state.pulseTimer += rat.deltaTime;
		if (state.pulseTimer > 0.6)
			state.pulseTimer = 0;
		if (state.pulseTimer < 0.3)
		{
			var subCmd = state.currentCommand.slice(0, state.cursorPos);
			width = rat.graphics.ctx.measureText("> " + subCmd);
			width = width.width || width;
			logBounds.x += width;
			rat.graphics.ctx.fillStyle = "white";
			rat.graphics.ctx.font = " bold" + rat.graphics.ctx.font;
			rat.graphics.drawText("|", logBounds.x, logBounds.y );
		}
	};

	//	display log lines of text
	/** @param {Object=} bounds */
	rat.console.drawLog = function (bounds)
	{
		bounds = bounds || rat.console.bounds;
		var out = rat.console.output;
		var ctx = rat.graphics.ctx;
		
		//	make a copy of my bounds so I can mess with it, if it's not set up.
		var myBounds = {x:bounds.x, y:bounds.y, w:bounds.w, h:bounds.h};
		if (myBounds.w < 0)
			myBounds.w = rat.graphics.SCREEN_WIDTH - myBounds.x - 10;
		if (myBounds.h < 0)
			myBounds.h = rat.graphics.SCREEN_HEIGHT - myBounds.y - 10;

		ctx.font = '12px Arial';
		ctx.textAlign = 'left';
		ctx.fillStyle = rat.console.textColor;//"#B0FFA0";

		//	start high enough so that our last line is at the bottom.
		
		var yPos = myBounds.h - 0 - logLineHeight * out.length;
		var bottom = myBounds.h + myBounds.y;
		yPos += (rat.console.state.logOffset-1) * logLineHeight;
		ctx.textBaseline = "top";//"bottom";
		for (var i = 0; i < out.length; i++)
		{
			if( (yPos + logLineHeight) > myBounds.y )
				ctx.fillText(out[i], myBounds.x, yPos, myBounds.w);
			yPos += logLineHeight;
			if( (yPos + logLineHeight) >= bottom && rat.console.state.logOffset > 0 )
			{
				ctx.fillText("...", myBounds.x, yPos, myBounds.w);
				yPos += logLineHeight;
			}
			if( yPos >= bottom )
				break;
		}
		
		//ctx.strokeStyle = "#FFFFFF";
		//ctx.strokeRect(myBounds.x, myBounds.y, myBounds.w, myBounds.h);
	};

	//	Get events
	rat.console.handleEvent = function (ratEvent)
	{
		if (ratEvent.eventType !== "keydown" && ratEvent.eventType !== "keypress")
			return;

		//	Done eat F12
		if (ratEvent.eventType === "keydown")
		{
			if (ratEvent.which === rat.keys.f12)
				return false;

			//	I really want the esc key to be able to close the console as well as the console key
			if (ratEvent.which === rat.keys[state.consoleKey] ||
				(ratEvent.which === rat.keys.esc && rat.console.state.consoleActive) )
			{
				rat.console.state.consoleActive = !rat.console.state.consoleActive;
				return true;
			}

			//	Not active means not handled.
			if (!rat.console.state.consoleActive)
				return false;

			//	Run the cmd.
			if (ratEvent.which === rat.keys.enter)
			{
				ratEvent.sysEvent.preventDefault();
				state.currentCommand = state.currentCommand.trim();
				if (state.currentCommand && state.commandHistory[state.commandHistory.length] !== state.currentCommand)
				{
					state.commandHistory.unshift(state.currentCommand);
					if (state.commandHistory.length > state.commandHistoryMax)
						state.commandHistory.pop();
					if (window.localStorage)
						window.localStorage.setItem(storageCmdHistoryKey, JSON.stringify(state.commandHistory));
				}
				if( state.currentCommand )
					rat.console.parseCommand(state.currentCommand.trim());
				setCurCommand("", true, true);
			}

			//	Erase
			else if (ratEvent.which === rat.keys.backspace)
			{
				ratEvent.sysEvent.preventDefault();
				if (state.cursorPos > 0)
				{
					--state.cursorPos;
					setCurCommand(state.currentCommand.slice(0, state.cursorPos) + state.currentCommand.slice(state.cursorPos + 1), false, true);
				}
			}
			else if (ratEvent.which === rat.keys.del)
			{
				ratEvent.sysEvent.preventDefault();
				if (state.cursorPos < state.currentCommand.length)
				{
					setCurCommand(state.currentCommand.slice(0, state.cursorPos) + state.currentCommand.slice(state.cursorPos + 1), false, true);
				}
			}

			//	History access
			else if (ratEvent.which === rat.keys.upArrow || ratEvent.which === rat.keys.downArrow)
			{
				ratEvent.sysEvent.preventDefault();
				setCurCommand(state.currentCommand.trim(), false, false);
				if (ratEvent.which === rat.keys.upArrow)
					++state.commandHistoryIndex;
				else
					--state.commandHistoryIndex;

				//	 If we are less then our current, stay at our current
				if (state.commandHistoryIndex < -1)
					state.commandHistoryIndex = -1;

					//	Did we try to go up with no history
				else if (state.commandHistoryIndex === 0 && state.commandHistory.length === 0)
					setCurCommand("", true, true);

					//	Did we go off the top.
				else if (state.commandHistoryIndex >= state.commandHistory.length)
				{
					state.commandHistoryIndex = state.commandHistory.length - 1;
					setCurCommand(state.commandHistory[state.commandHistoryIndex], false, false);
				}

					//	leaving the history
				else if (state.commandHistoryIndex === -1)
				{
					setCurCommand("", false, false);
				}

					//	We are accessing the history
				else
				{
					setCurCommand(state.commandHistory[state.commandHistoryIndex], false, true);
					state.cursorPos = state.currentCommand.length;
				}
			}
			
			//	Cursor position change
			else if (ratEvent.which === rat.keys.leftArrow || ratEvent.which === rat.keys.rightArrow)
			{
				ratEvent.sysEvent.preventDefault();
				if (ratEvent.which === rat.keys.leftArrow)
					--state.cursorPos;
				else
					++state.cursorPos;
				state.cursorPos = rat.math.max(0, state.cursorPos);
				state.cursorPos = rat.math.min(state.cursorPos, state.currentCommand.length);
			}
			else if (ratEvent.which === rat.keys.home)
			{
				ratEvent.sysEvent.preventDefault();
				state.cursorPos = 0;
			}
			else if (ratEvent.which === rat.keys.end)
			{
				ratEvent.sysEvent.preventDefault();
				state.cursorPos = state.currentCommand.length;
			}

			//	TAB for auto-completion
			else if (ratEvent.which === rat.keys.tab)
			{
				ratEvent.sysEvent.preventDefault();

				//	Find the commands that will complete the current.
				if (state.accessingAutoComplete === -1)
				{
					setCurCommand(state.currentCommand.trim(), false, false);
					buildAutocomplete(state.currentCommand);
				}

				//	Auto-complete only does something if there is something to change to.
				if (state.autoComplete.length > 0)
				{
					setCurCommand(state.autoComplete[state.accessingAutoComplete], true, false);
					state.cursorPos = state.currentCommand.length;
					if (rat.input.keyboard.isKeyDown(rat.keys.shift)) {
						state.accessingAutoComplete--;
						if (state.accessingAutoComplete < 0)
							state.accessingAutoComplete = state.autoComplete.length - 1;
					}
					else {
						state.accessingAutoComplete++;
						if (state.accessingAutoComplete >= state.autoComplete.length)
							state.accessingAutoComplete = 0;
					}
				}
			}
			
			//	PageUp/PageDown to change log offset
			else if (ratEvent.which === rat.keys.pageUp || ratEvent.which === rat.keys.pageDown )
			{
				ratEvent.sysEvent.preventDefault();
				
				if( ratEvent.which === rat.keys.pageUp )
					++rat.console.state.logOffset;
				else
					--rat.console.state.logOffset;
				if( rat.console.state.logOffset >= rat.console.output.length )
					rat.console.state.logOffset = rat.console.output.length-1;
				if( rat.console.state.logOffset < 0 )
					rat.console.state.logOffset = 0;
			}
			else
			{
				//	Let the browser do default handling on this event (so I can get a keypress event)
				ratEvent.allowBrowserDefault = true;
			}
		}
		else if (ratEvent.eventType === "keypress" )
		{
			//	Not active means not handled.
			if (!rat.console.state.consoleActive)
				return false;
			var char = ratEvent.sysEvent.char;
			if (char.charCodeAt(0) < ' '.charCodeAt(0))
				return false;
			if (state.consoleActive && char !== "\n" && char !== "\t" && char !== state.consoleKey)
			{
				if (state.cursorPos === state.currentCommand.length)
					state.currentCommand += char;
				else if (state.cursorPos === 0)
					state.currentCommand = char + state.currentCommand;
				else
					state.currentCommand = state.currentCommand.slice(0, state.cursorPos) + char + state.currentCommand.slice(state.cursorPos);
				state.cursorPos++;
				resetAutoComplete();
			}
		}
		return true; // Handled
	};

	//	Register new commands into the console
	rat.console.registerCommand = function (name, func, aliasList)
	{
		//	Init the new cmd
		var newCmd = {};
		newCmd.name = name.toUpperCase();
		newCmd.func = func;
		newCmd.id = state.nextCommandID++;
		newCmd.alias = aliasList || [];

		//	All commands and alias are uppercase
		var aliasCount = newCmd.alias.length;
		for (var aliasIndex = 0; aliasIndex < aliasCount; aliasIndex++)
			newCmd.alias[aliasIndex] = newCmd.alias[aliasIndex].toUpperCase();

		//	Add it to the cmd list
		state.commandList.push(newCmd);
		return newCmd.id;
	};

	//	Unregister a commands from the console
	rat.console.unregisterCommand = function (id)
	{
		//	Find the command that goes with this
		var commandCount = state.commandList.length;
		for (var commandIndex = 0; commandIndex < commandCount; commandIndex++)
		{
			if (state.commandList[commandIndex].id === id)
			{
				state.commandList.splice(commandIndex, 1);
				return true;
			}
		}

		return false;
	};

	//	Get a command by its name
	rat.console.getCommand = function (cmd)
	{
		var upperCmd = cmd.toUpperCase();
		var count = state.commandList.length;
		for (var index = 0; index !== count; ++index)
		{
			var curCmd = state.commandList[index];
			if (curCmd.name === upperCmd)
				return curCmd;

			for (var aliasIndex = 0; aliasIndex !== curCmd.alias.length; ++aliasIndex)
			{
				if (curCmd.alias[aliasIndex] === upperCmd)
					return curCmd;
			}
		}

		//	Not found
		return void 0;
	};

	/**
	  *	@method	Run the provided command
	  * @returns True if the command successfully parsed
	  */
	rat.console.parseCommand = function (cmd)
	{
		//	Get the command from the args
		var fullCmd = cmd;
		var cmdArgs = cmd.split(/\s/);
		cmd = cmdArgs[0];
		cmdArgs.splice(0, 1);
		var foundCmd = rat.console.getCommand(cmd);
		if (foundCmd)
		{
			//	Call the command
			foundCmd.func(cmd, cmdArgs);
			return true;
		}
		else
		{
			//	Is the string a full variable?  If so, dump its members or value to the log
			var gblVar = getGlobalVar(fullCmd);
			var dumpVar = fullCmd + "=";
			if (gblVar !== void 0)
			{
				switch( typeof(gblVar) )
				{
					case "object":
					{
						if (gblVar === null)
							dumpVar += "NULL";
						else
						{
							dumpVar += "OBJECT:";
							rat.console.log(dumpVar);
							dumpVar = void 0;
							var longestName = 0;
							var vals = [];
							var key;
							for (key in gblVar)
							{
								//	We skip some things
								if (key !== "parentClass" && key !== "parentConstructor" && key !== "parent" && key !== "parentPrototype" && key !== "constructor")
								{
									vals.push(key);
									if (key.length > longestName)
										longestName = key.length;
								}
							}

							//	Sort
							vals.sort();
							for (var i = 0; i < vals.length; ++i)
							{
								key = vals[i];
								var type = typeof (gblVar[key]);
								while (key.length < longestName)
									key += " ";
								rat.console.log(key + "=" + type);
							}
						}
						break;
					}
					case "boolean":
						dumpVar += gblVar.toString();
						break;
					case "number":
						dumpVar += gblVar.toString();
						break;
					case "string":
						dumpVar += gblVar.toString();
						break;
					case "function":
						dumpVar += "function";
						break;
				}
				if( dumpVar )
					rat.console.log(dumpVar);
			}
			else
			{
				//	We assume this to be raw javascript
				try
				{
					rat.console.log(fullCmd);
					/* jshint -W061 */
					eval(fullCmd);
				}
				catch (e)
				{
					rat.console.log("ERROR: Execution of JS Failed: " + e.description);
				}
			}
		}

		return true;
	};

	//	Add the LOG command
	rat.console.registerCommand("log", function (cmd, args)
	{
		rat.console.log( args.join(" ") );
	});

	//	Toggle the saveLog feature
	rat.console.registerCommand("saveLog", function (cmd, args)
	{
		rat.console.saveOutputToLocalStorage = !rat.console.saveOutputToLocalStorage;
		rat.console.log( "Log will "+ (rat.console.saveOutputToLocalStorage?"":" not ") + " save." );
	});
	
	//	Toggle the saveLog feature
	rat.console.registerCommand("restoreLog", function (cmd, args)
	{
		if( !window.localStorage )
			rat.console.log( "ERROR! localStorage not supported" );
		else
		{
			var out = JSON.parse( window.localStorage.getItem( "RAT_LOG" ) );
			if( out && Array.isArray(out) )
			{
				rat.console.output = out;
				rat.console.log( "Log restored" );
			}
			else
				rat.console.log( "Failed to restore log" );
		}
	});
	
	//	Add the clear command
	rat.console.registerCommand("clear", function (cmd, args)
	{
		rat.console.output = [];
	}, ["cls", "clearLog"]);

	//	Add the Alias command
	rat.console.registerCommand("Alias", function (cmd, args)
	{
		var aliasCmd = args[0];
		if (aliasCmd)
		{
			args.splice(0, 1);
			rat.console.registerCommand(aliasCmd, function (cmd, args)
			{
				var foundCmd = rat.console.getCommand(cmd);
				rat.console.parseCommand(foundCmd.aliasedTo + " " + args.join(" "));
			});
			var foundCmd = rat.console.getCommand(aliasCmd);
			foundCmd.aliasedTo = args.join(" ");
			rat.console.log("Added alias " + aliasCmd + "=" + foundCmd.aliasedTo);
		}
	});

	rat.console.registerCommand("frames", function (cmd, args)
	{
		rat.dframe();
	}, ["showFrames", "dframe"]);

	rat.console.registerCommand("showFPSGraph", function (cmd, args)
	{
		var on = rat.system.debugDrawFramerateGraph;
		rat.system.debugDrawFramerateGraph = !on;
		rat.system.debugDrawTiming = !on;
	}, ["showFPS", "fps"]);

	//------
	//	These debug commands are intended to be accepted in the javascript console,
	//	e.g. the developer can type "rat.dframe()" to use one.  So they're intentionally short, but consistent.

	//	put debug frame around everything
	rat.dframe = function ()
	{
		if( rat.screenManager )
		{
			var s = rat.screenManager.getTopScreen();
			if (s)
				s.frameAllRandom();
		}
	};
	
	rat.dtree = function ()
	{
		if( rat.screenManager )
		{
			var s = rat.screenManager.getTopScreen();
			if (s)
			{
				var data = s.dumpTree();
				//	actually output that text...
				for (var i = 0; i < data.lines.length; i++)
				{
					rat.console.log(data.lines[i]);
				}
				rat.console.log("total:" + data.totalCount + " (vis: " + (data.totalCount - data.hiddenCount) + ", hid: " + data.hiddenCount + ")");
			} else {
				rat.console.log("no top screen in stack to dump.");
			}
		}
	};
});
//
//	A performance profiling calls.
//		Most of these are currently only implemented under Wraith
//

//------------ rat.profiler ----------------

//
// The profiler module
rat.modules.add( "rat.debug.r_profiler",
[
	"rat.debug.r_console",
	"rat.os.r_system",
	"rat.graphics.r_graphics",
	"rat.input.r_input",
], 
function(rat)
{
	rat.profiler = {
		enableProfiler: false,		//	Set to true to enable the profiler code
		usingRatProfiler: false,	//	Are we using the profiler built into rat
		
		//	The following are used when we are using the profiler built into rat
		profileTrees: [
			void 0, 
			void 0
		],
		curNode: void 0,
		enableStatsDisplay: false,
		selectedNode: ["ROOT"],
		displayInfo: {
			atX: 64,			//	Where to draw the profiler information
			atY: 64,
			lineHeight: 22,		//	How high is a single line of profiler information
			tab: "  ",			//	What is a tab
			font: "12px arial",	//	What font
			color: void 0,		//	What color
			highlightColor: void 0,// Color of highlighted node
			shadowColor: "black",// Shadow color
			curY: 0,			//	Runtime value used to draw
			cols: [0, 150, 225, 300, 375, 450], // NAME, % PARENT, % TOTAL, ttl MS, MS/call, # of calls
		},
		highlightedNode: void 0,

		//	For profiler marks in the FPS graph
		perfmarkers: [],
	};

	var perfmarkers = rat.profiler.perfmarkers;

	var topMark = {
		last: void 0,
		name: void 0
	};


	/** Empty perf function
	 * @param {?} name
	 */
	function noAction(name)
	{
	}

	//////////////////////////////////////////////////////////////////////////////////////////////////
	///	Code for rats embedded profiler

	//	A single profiler node
	function RatProfilerNode(name, parent)
	{
		this._stats = {
			name: name,
			parent: parent,
			time: 0,
			lastTick: void 0,
			calls: 0,
			hasChildren: false
		};
		this._children = {};
	}

	//	Get a child node (or create it if it does not exist)
	RatProfilerNode.prototype.getChild = function( name )
	{
		if (!this._children[name])
		{
			this._children[name] = new RatProfilerNode(name, this);
			this._stats.hasChildren = true;
		}
		return this._children[name];
	};

	//	Clear any held times
	RatProfilerNode.prototype.clear = function()
	{
		this._stats.time = 0;
		this._stats.calls = 0;
		for( var key in this._children )
			this._children[key].clear();
	};

	//	Get the current tick
	RatProfilerNode.prototype.getTick = function()
	{
		if (rat.profiler.usingRatProfiler)
			return window.performance.now();
		else
			return 0;
	};

	//	Store the current tick
	RatProfilerNode.prototype.storeTick = function()
	{
		this._stats.lastTick = this.getTick();
	};

	//	Get the amount of elapsed time
	RatProfilerNode.prototype.updateElapsed = function ()
	{
		this._stats.time += (this.getTick() - this._stats.lastTick) / 1000;
		this._stats.lastTick = void 0;
	};

	//	Starting a new frame
	function ratLevelBeginFrame()
	{
		
	}

	//	Ending a frame
	function ratLevelEndFrame()
	{
		if (rat.profiler.curNode.parent)
		{
			rat.console.log("ERROR!  profiler.push does not match profiler.pop");
			rat.profiler.curNode = rat.profiler.profileTrees[0];
			rat.profiler.curNode._stats.abortProfilerForFrame = true;
		}

		if( !rat.profiler.curNode._stats.abortProfilerForFrame )
		{
			// Should be the full frame time.
			if( rat.profiler.curNode._stats.lastTick !== void 0 )
				rat.profiler.curNode.updateElapsed();
		}

		//	Swap our tree buffers
		var oldTree = rat.profiler.profileTrees[0];
		rat.profiler.profileTrees[0] = rat.profiler.profileTrees[1];
		rat.profiler.profileTrees[1] = oldTree;

		//	Setup for a new pass
		rat.profiler.curNode = rat.profiler.profileTrees[0];
		rat.profiler.curNode.clear();
		rat.profiler.curNode.storeTick();
		++rat.profiler.curNode._stats.calls;
		rat.profiler.curNode._stats.abortProfilerForFrame = false;

		//	Setup the old tree to be ready to display
		oldTree._stats.built = true;
	}

	//	Push a new timing block
	function ratLevelPushPerfMark(name)
	{
		if( rat.profiler.curNode._stats.abortProfilerForFrame )
			return;
		rat.profiler.curNode = rat.profiler.curNode.getChild(name);
		rat.profiler.curNode.storeTick();
		++rat.profiler.curNode._stats.calls;
	}

	//	Pop the last timing block
	function ratLevelPopPerfMark(name)
	{
		if( rat.profiler.curNode._stats.abortProfilerForFrame )
			return;
		if (rat.profiler.curNode._stats.name !== name || rat.profiler.curNode._stats.parent === void 0)
		{
			
			rat.console.log("ERROR!  profiler.push does not match profiler.pop");
			rat.profiler.curNode = rat.profiler.profileTrees[0];
			rat.profiler.curNode._stats.abortProfilerForFrame = true;
			
		}
		else
		{
			rat.profiler.curNode.updateElapsed();
			rat.profiler.curNode = rat.profiler.curNode._stats.parent;
		}
	}

	//	Display some next on the current line.
	function displayProfilerLine(text, atCol, indent)
	{
		indent = indent || 0;
		atCol = atCol || 0;
		var ctx = rat.graphics.ctx;
		while (indent--)
			text = rat.profiler.displayInfo.tab + text;
		if (atCol >= rat.profiler.displayInfo.cols.length)
			atCol = rat.profiler.displayInfo.cols.length - 1;
		var x = rat.profiler.displayInfo.atX + rat.profiler.displayInfo.cols[atCol];
		ctx.fillText(text, x, rat.profiler.displayInfo.curY);
	}

	//	Go down one line
	function gotoNextDisplayLine()
	{
		rat.profiler.displayInfo.curY += rat.profiler.displayInfo.lineHeight;
	}

	//	Get the string version of a percent
	function getPercentDisplay(val, max)
	{
		return (val / max * 100).toFixed(2) + "%";
	}

	//	Get the string version of a time
	function getTimeDisplay(val)
	{
		return val.toFixed(4);
	}

	//	Get the node that is currently being displayed
	function getSelectedNode(node)
	{
		for (var index = 1; index < rat.profiler.selectedNode.length; ++index)
			node = node.getChild(rat.profiler.selectedNode[index]);
		return node;
	}

	//	Dump the profiling information
	function ratLevelDisplayPerfStats()
	{
		if (!rat.profiler.enableStatsDisplay)
			return;
		var ctx = rat.graphics.ctx;
		if (!ctx)
			return;
		ctx.save();

		ctx.font = rat.profiler.displayInfo.font;
		ctx.fillStyle = rat.profiler.displayInfo.color;
		// Draw text shadows is expensive...  Turning this on has serios effects on the FPS, which
		//	When using rat's profiler matters.
		//	So i turned these off.
		// ctx.shadowOffsetX = 1.5;
		// ctx.shadowOffsetY = 1.5;
		// ctx.shadowColor = rat.profiler.displayInfo.shadowColor;

		rat.profiler.displayInfo.curY = rat.profiler.displayInfo.atY;

		var root = rat.profiler.profileTrees[1];
		if (root._stats.abortProfilerForFrame)
			displayProfilerLine("***ERROR WITH PROFILER USAGE***", 0);
		else if (!root._stats.built)
			displayProfilerLine("***STATS PENDING***", 0);
		else
		{
			//	Dump this node
			var node = getSelectedNode(root);
			var parent = node._stats.parent;
			var foundTime = 0;

			//	Header row
			displayProfilerLine("NAME",		0, 2);
			displayProfilerLine("% Parent",	1, 2);
			displayProfilerLine("% Total",	2, 2);
			displayProfilerLine("MS Total",	3, 2);
			displayProfilerLine("MS/call", 4, 2);
			displayProfilerLine("calls", 5, 2);
			gotoNextDisplayLine();
						
			// NAME, % PARENT, % TOTAL, ttl MS, MS/call
			if (parent)
			{
				displayProfilerLine("-" + node._stats.name, 0);	//	Name
				displayProfilerLine(getPercentDisplay(node._stats.time, parent._stats.time), 1);	//	% Parent
			}
			else
				displayProfilerLine(" " + node._stats.name, 0);	//	Name
			displayProfilerLine(getPercentDisplay(node._stats.time,root._stats.time), 2);	//	% Total
			displayProfilerLine(getTimeDisplay(node._stats.time), 3); // TTL MS
			if (node._stats.calls)
			{
				displayProfilerLine(getTimeDisplay(node._stats.time / node._stats.calls), 4); // MS/call
				displayProfilerLine(node._stats.calls, 5); // # of calls
			}
			gotoNextDisplayLine();

			var child;
			for (var key in node._children)
			{
				//	Make sure we have a set highlighted node
				if (!rat.profiler.highlightedNode)
					rat.profiler.highlightedNode = key;
				
				child = node._children[key];
				if (key === rat.profiler.highlightedNode)
					ctx.fillStyle = rat.profiler.displayInfo.highlightColor;
				var preName = " ";
				if( child._stats.hasChildren )
					preName = "+";
				displayProfilerLine(preName + child._stats.name, 0, 1);	//	Name
				displayProfilerLine(getPercentDisplay(child._stats.time, node._stats.time), 1);	//	% Parent
				displayProfilerLine(getPercentDisplay(child._stats.time, root._stats.time), 2);	//	% Total
				displayProfilerLine(getTimeDisplay(child._stats.time), 3); // TTL MS
				if (node._stats.calls)
				{
					displayProfilerLine(getTimeDisplay(child._stats.time / child._stats.calls), 4); // MS/call
					displayProfilerLine(child._stats.calls, 5); // # of calls
				}
				gotoNextDisplayLine();
				if (key === rat.profiler.highlightedNode)
					ctx.fillStyle = rat.profiler.displayInfo.color;
				foundTime += child._stats.time;
			}

			gotoNextDisplayLine();
			displayProfilerLine(" MISSING TIME", 0, 1);	//	Name
			var missingTime = node._stats.time - foundTime;
			displayProfilerLine(getPercentDisplay(missingTime, node._stats.time), 1);	//	% Parent
			displayProfilerLine(getPercentDisplay(missingTime, root._stats.time), 2);	//	% Total
			displayProfilerLine(getTimeDisplay(missingTime), 3); // TTL MS

			//rat.console.log("DUMP STATS FOR NODE " + node._stats.name);
			//displayInfo
		}

		ctx.restore();
	}

	//	Event handling for the profiler
	function ratLevelEventHandler(ratEvent)
	{
		var selected, key;
		if (ratEvent.eventType === "keydown")
		{
			if (rat.profiler.enableStatsDisplay)
			{
				if (ratEvent.which === rat.keys.j)
				{
					if (rat.profiler.selectedNode.length > 1)
						rat.profiler.highlightedNode = rat.profiler.selectedNode.splice(rat.profiler.selectedNode.length - 1, 1)[0];

					return true;
				}
				else if (ratEvent.which === rat.keys.l)
				{
					selected = getSelectedNode( rat.profiler.profileTrees[1] );
					if (selected._children[rat.profiler.highlightedNode] && selected._children[rat.profiler.highlightedNode]._stats.hasChildren)
					{
						rat.profiler.selectedNode.push(rat.profiler.highlightedNode);
						rat.profiler.highlightedNode = void 0;
					}
					return true;
				}
				else if (ratEvent.which === rat.keys.i)
				{
					selected = getSelectedNode(rat.profiler.profileTrees[1]);
					//	Find which child this is
					var lastKey = "";
					for (key in selected._children)
					{
						if (key === rat.profiler.highlightedNode)
						{
							rat.profiler.highlightedNode = lastKey;
							break;
						}
						lastKey = key;
					}
					return true;
				}
				else if (ratEvent.which === rat.keys.k)
				{
					//	Find which child this is
					var useNextKey = false;
					selected = getSelectedNode(rat.profiler.profileTrees[1]);
					for (key in selected._children)
					{
						if (key === rat.profiler.highlightedNode)
							useNextKey = true;
						else if(useNextKey)
						{
							rat.profiler.highlightedNode = key;
							break;
						}
					}
					return true;
				}
			}
			if (ratEvent.which === rat.keys.p)
			{
				rat.profiler.enableStatsDisplay = !rat.profiler.enableStatsDisplay;
				return true;
			}
		}

		return false;
	}

	/// Add a "profiler mark" to the FPS graph
	rat.profiler.addPerfMarker = function (name, color)
	{
		if( rat.system.debugDrawFramerateGraph && rat.graphics )
		{
			if (rat.graphics)
				perfmarkers.unshift({ name: name, color: color.toString(), frame: rat.graphics.frameIndex });
		}
	};

	/**
	 * Setup the profiler module
	 */
	//@TODO Replace with module registered init function
	rat.profiler.init = function ()
	{
		var self = rat.profiler;
		if (!rat.profiler.enableProfiler)
		{
			self.pushPerfMark = noAction;
			self.popPerfMark = noAction;
		}
		else
		{
			if(rat.system.has.Wraith)
			{
				rat.console.log("Using Wraith Profiler");
				self.pushPerfMark = Wraith.PushPerfMark;
				self.popPerfMark = Wraith.PopPerfMark;
			}
			else if (window.performance && window.performance.now)
			{
				rat.console.log("Using RAT Profiler");
				self.pushPerfMark = ratLevelPushPerfMark;
				self.popPerfMark = ratLevelPopPerfMark;
				var oldBeginFrame = self.beginFrame;
				var oldEndFrame = self.endFrame;
				self.beginFrame = function () { oldBeginFrame(); ratLevelBeginFrame(); };
				self.endFrame = function () { oldEndFrame(); ratLevelEndFrame(); };
				self.displayStats = ratLevelDisplayPerfStats;

				//	Some data setup
				for( var index = 0; index < rat.profiler.profileTrees.length; ++index )
					rat.profiler.profileTrees[index] = new RatProfilerNode("ROOT", void 0);
				rat.profiler.curNode = rat.profiler.profileTrees[0];

				rat.profiler.displayInfo.color = rat.profiler.displayInfo.color || rat.graphics.white;
				rat.profiler.displayInfo.highlightColor = rat.profiler.displayInfo.highlightColor || rat.graphics.yellow;

				rat.input.registerEventHandler(ratLevelEventHandler);
				rat.profiler.usingRatProfiler = true;
			}
			else
			{
				rat.console.log("No Profiler");
				self.pushPerfMark = noAction;
				self.popPerfMark = noAction;
			}
		}
	};

	rat.profiler.beginFrame = function ()
	{
		if( rat.system.debugDrawFramerateGraph && rat.graphics && perfmarkers.length )
		{
			//	Remove frame markers that are now too old
			//	What is our current frame
			var lastValidFrame = rat.graphics.frameIndex - rat.system.FPS_RECORD_SIZE;
			var removeFrom = perfmarkers.length;
			for (var index = perfmarkers.length-1; index >= 0; --index)
			{
				if (perfmarkers[index].frame < lastValidFrame)
					removeFrom = index;
				else
					break;
			}
			if (removeFrom < perfmarkers.length)
				perfmarkers.splice(removeFrom);
		}
	};

	rat.profiler.endFrame = function ()
	{

	};

	rat.profiler.push = function (name)
	{
		var mark = { name: name, last: topMark };
		topMark = mark;
		rat.profiler.pushPerfMark(name);
	};

	rat.profiler.pop = function ()
	{
		var name = topMark.name;
		topMark = topMark.last;
		rat.profiler.popPerfMark(name);
	};

	rat.profiler.perf = function (name, func, ctx)
	{
		rat.profiler.pushPerfMark(name);
		var res;
		if (ctx)
			res = func.call(ctx);
		else
			res = func();
		rat.profiler.popPerfMark(name);
		return res;
	};

});

rat.modules.add("rat.utils.r_utils",
[
	{ name: "rat.math.r_math", processBefore: true },

	"rat.debug.r_console",
	"rat.os.r_system",
	"rat.os.r_user",
],
function (rat)
{
	var math = rat.math;
	//rat.utils = {};  Created as part of r_base

	///
	/// @constructor
	function _subclassOf() { }	//	used below

	///
	///	general inheritance support
	///	Usage:
	///	 declare constructor for class A
	///	 then declare constructor for class B
	///	 then AFTER B constructor function, do this:
	///	 (function(){ Rat.inheritClassFrom(B,A); })();
	///	Also recommended:
	///	 In B constructor, call B.prototype.parentConstructor.call(this);
	/// @param {Object} childClass
	/// @param {Object} parentClass
	/// @return {Object} childClass
	///
	rat.utils.inheritClassFrom = function (childClass, parentClass)
	{
		// Normal Inheritance 
		// this.prototype = new parentClass; // hmm... this instantiates one of the objects.  Do we really want this?

		// Let's try this...  See http://stackoverflow.com/questions/1595611/how-to-properly-create-a-custom-object-in-javascript/1598077#1598077
		// this avoids instantiating an actual new parentClass.
		// instead, it transfers all the prototype values of the base class to a new temp object,
		// and instantiates one of those as our new prototype.
		// This is still weird, but doesn't end up calling parentClass's constructor,
		// which is the key lame thing we want to avoid.
		if (parentClass === void 0)
		{
			rat.console.log("Error inheriting from undefined...");
			var str = childClass.toString();
			str = str.substring(0,1000);
			rat.console.log(str);
			//	and then we'll crash below...
		}
		_subclassOf.prototype = parentClass.prototype;
		childClass.prototype = new _subclassOf();

		childClass.prototype.constructor = childClass;
		childClass.prototype.parentClass = parentClass;
		childClass.prototype.parentConstructor = parentClass;	//	alternative name
		childClass.prototype.parent = parentClass.prototype;
		childClass.prototype.parentPrototype = parentClass.prototype;	//	alternative name
		return childClass;
	};

	///
	///	Extend a class with another class (sorta-multi inheritance)
	/// @param {Object} childClass
	/// @param {Object} parentClass
	///
	rat.utils.extendClassWith = function (childClass, parentClass)
	{
		var parentProto = parentClass.prototype;
		var childProto = childClass.prototype;
		rat.utils.extendObject(childProto, [parentProto], true);
	};

	///
	/// util to load xml doc
	/// @param {string} dname the domain name
	/// @return {Object} responseXML The xml response from a get request
	///
	rat.utils.loadXMLDoc = function (dname)
	{
		var xhttp;
		if (window.XMLHttpRequest)
		{
			xhttp = new XMLHttpRequest();
		}
		else
		{
			xhttp = new ActiveXObject("Microsoft.XMLHTTP");
		}
		//xhttp.overrideMimeType('text/xml');
		xhttp.open("GET", rat.system.fixPath(dname), false);
		xhttp.send();
		return xhttp.responseXML;
	};

	///
	/// util to load json file SYNCHRONOUSLY
	///	Generally, you should use loadJSONObjectAsync instead.
	/// @todo refactor with function above - which is more correct?
	/// @param {string} dname domain name
	/// @return {Object} my_JSON_object
	///
	rat.utils.loadJSONObject = function (dname)
	{
		var my_JSON_object = {};

		var xhttp;
		if (window.XMLHttpRequest)
		{
			xhttp = new XMLHttpRequest();
		}
		else
		{
			xhttp = new ActiveXObject("Microsoft.XMLHTTP");
		}
		// xhttp.overrideMimeType('text/plain');
		xhttp.open("GET", rat.system.fixPath(dname), false);
		xhttp.send();

		my_JSON_object = JSON.parse(xhttp.responseText);

		return my_JSON_object;
	};
	
	///
	/// util to load json doc asynchronously
	///	Callback will be called with status (true if OK, false if error) and data object.
	///
	rat.utils.loadJSONObjectAsync = function (path, callback)
	{
		var xhttp;
		if (window.XMLHttpRequest)
			xhttp = new XMLHttpRequest();
		else
			xhttp = new ActiveXObject("Microsoft.XMLHTTP");
		xhttp.onload = function(e) {
			if (xhttp.readyState === 4 &&
				(xhttp.status === 200 || (xhttp.status === 0 && xhttp.statusText === "")))
			{
				var data = JSON.parse(xhttp.responseText);
				callback(true, data);
			}
			else {
				rat.console.log("error loading " + path + " : " + xhttp.statusText);
				callback(false, null);
			}
		};

		xhttp.open("GET", rat.system.fixPath(path), true);
		xhttp.send();
	};

	///
	/// copy this object
	/// useful if you don't want a reference.
	/// 		Do the recursion and array support here work?
	/// @param {Object} o Object to copy
	/// @param {boolean=} deep perform a deep copy (recursive) (default is false)
	/// @return {Object} newO new Object
	///
	rat.utils.copyObject = function (o, deep)
	{
		// If we got something other than an object (or array), then we cannot really copy it.
		// note that null is technically an object, but should not be processed below, but just returned.
		if (typeof (o) !== "object" || o === null)
			return o;

		deep = deep || false;
		var newO;
		if (Array.isArray(o))
			newO = [];
		else
			newO = {};
		var src;
		for (var e in o)
		{
			src = o[e];
			//	Skip undefined fields
			if (src !== void 0 && o.hasOwnProperty(e))
			{
				// Perform a deep copy if we want to, and need to on this field.
				// We only copy arrays or objects..  NOT functions
				// This also includes constructors.
				if (deep && typeof (src) === "object") // Note that arrays will return their type as Object
					newO[e] = rat.utils.copyObject(src, true);
				else
					newO[e] = src;
			}
		}

		return newO;
	};
	//	alternative name
	rat.utils.deepCopy = function (o) { return rat.utils.copyObject(o, true); }

	///
	/// Extend one object with another data (possibly doing a deep copy of that data
	/// @param {Object} dest
	/// @param {Object} sources
	/// @param {boolean=} deepCopy (default is false)
	/// @return {Object} dest
	///
	rat.utils.extendObject = function (dest, sources, deepCopy)
	{
		deepCopy = deepCopy || false;

		// Always work with an array
		if (Array.isArray(sources) === false)
			sources = [sources];

		var src;
		var source;
		// For each source object, in order.
		for (var index = 0, len = sources.length; index !== len; ++index)
		{
			// These should ALL be objects.
			source = sources[index];
			// Skip undefined sources
			if (source === void 0)
				continue;

			// Skip sources that are the dest
			if (source === dest)
				continue;

			// If dest === void 0, then just run a copy of the source object
			if (dest === void 0 || dest === null)
			{
				dest = rat.utils.copyObject(source, deepCopy);
			}

				// process each field of source
			else
			{
				// For each field in source
				for (var field in source)
				{
					src = source[field];
					// Skip undefined values
					if (src === void 0)
						continue;

					// dest does not exist.
					if (dest[field] === void 0)
					{
						// If src is an object, and we want a deep copy, then copy
						if (typeof (src) === "object" && deepCopy)
							dest[field] = rat.utils.copyObject(src, true);
							// Otherwise, copy the raw types, and point to the objects
						else
							dest[field] = src;
					}
						// dest exists as an object, and src is also an object
						// then make sure my dest's sub objects are not missing any properties
					else if (typeof (dest[field]) === "object" && typeof (src) === "object")
					{
						// Run extend on this object, getting any missing properties
						rat.utils.extendObject(dest[field], [src], deepCopy);
					}
				}
			}
		}
		return dest;
	};

	///
	/// Util function to add props to an object
	/// @param {Object} obj
	/// @param {string} name
	/// @param {?} setter
	/// @param {?} getter
	/// @param {Object=} ops
	/// @return {Object} obj
	///
	rat.utils.addProp = function (obj, name, setter, getter, ops)
	{
		var props = rat.utils.extendObject((ops || {}), { enumerable: true, configurable: false });
		if (setter) props.set = setter;
		if (getter) props.get = getter;
		Object.defineProperty(obj || {}, name, props);
		return obj;
	};
	
	///
	///	Write this object to a string.
	///	Is this useful?  Consider using JSON utils instead!
	/// @param {Object} o
	/// @param {string=} name
	/// @param {string=} addToString
	/// @param {number=} depth
	/// @return {string} addToString
	///
	rat.utils.objectToString = function (o, name, addToString, depth)
	{
		if (typeof (addToString) === 'undefined')
			addToString = "";
		if (!depth)
			depth = 0;

		function indent()
		{
			for (var i = 0; i < depth; i++)
				addToString += "\t";
		}

		function dumpSingle(val, valName)
		{
			if (typeof (val) === 'undefined')
				return;

			indent();

			if (valName !== '')
			{
				addToString += "" + valName + " : ";

				//if (typeof (val) !== 'undefined')
				// addToString += " : ";
			}

			if (Array.isArray(val))
			{
				// array handling
				addToString += "[\n";

				depth++;
				for (var aIndex = 0; aIndex < val.length; aIndex++)
				{
					dumpSingle(val[aIndex], '');
				}
				depth--;

				indent();
				addToString += "],\n";
			} else if (val === null)
			{
				addToString += "null,\n";
			} else if (typeof (val) === 'function')
			{
				addToString += "/*function*/,\n";
			} else if (typeof (val) === 'object')
			{
				addToString += "{\n";
				addToString = rat.utils.objectToString(val, '', addToString, depth);
				indent();
				addToString += "},\n";
			} else if (typeof (val) === 'string')
			{
				addToString += "'" + val.toString() + "'" + ",\n";
			} else if (typeof (val) === 'undefined')
			{
				addToString += "x_x_undefined,\n";
			} else
			{
				addToString += val.toString() + ",\n";
			}
		}

		if (name !== '') // name passed in - currently this means top level...?
		{
			indent();
			addToString += name + " = {\n";
		}
		depth++;
		for (var e in o)
		{
			if (o.hasOwnProperty(e))
			{
				dumpSingle(o[e], e);
			}
		}
		depth--;
		if (name !== '')
		{
			indent();
			addToString += "};\n";
		}

		return addToString;
	};

	/*
	//	testing objectToString
	var xx = {name:"hey", count:12, subObject:{x:1, y:null}, ar: [1, 2, 'str'], ar2: [{u:1, v:2}, [8,9,0]]};
	var outxx = rat.utils.objectToString(xx, "xx");
	rat.console.log("----");
	rat.console.log(outxx);
	rat.console.log("----");
	*/

	// These utils get and set values deep in an object structure
	// e.g.:  rat.utils.set(bob, 'home.kitchen.sink', 'yes') is like bob.home.kitchen.sink = 'yes';
	//	and rat.utils.get(bob, 'home.kitchen.sink') returns the final "sink" value (or object).

	///
	/// get a deep value in an object, returning undefined if the desired path doesn't match the object
	/// @param {Object} obj
	/// @param {string} path
	/// @return {?} value deep value in object 
	///
	rat.utils.get = function (obj, path)
	{
		path = path.split('.');
		for (var i = 0, len = path.length; i < len - 1; i++)
		{
			obj = obj[path[i]];
			if (typeof (obj) === 'undefined')
				return obj;	//	undefined
		}

		return obj[path[len - 1]];
	};

	///
	/// set a deep value in an object, adding subobject structure if necessary
	/// @param {Object} obj
	/// @param {string} path
	/// @param {?} value deep value in object to set
	///
	rat.utils.set = function (obj, path, value)
	{
		path = path.split('.');
		for (var i = 0, len = path.length; i < len - 1; i++)
		{
			var sobj = obj[path[i]];
			//	handle the case where the structure doesn't exist yet - add subobjects as necessary
			if (typeof (sobj) === 'undefined' || sobj === null)
				sobj = obj[path[i]] = {};
			obj = sobj;
		}

		obj[path[len - 1]] = value;
	};

	///
	/// given an interpolation value from 0 to 1, find the appropriate blend of a and b
	/// @param {number} a
	/// @param {number} b
	/// @param {number} i [0.0, 1.0]
	/// @return {number} interpolated_value [a, b]
	///
	rat.utils.interpolate = function (a, b, i)
	{
		return b * i + (1 - i) * a;
	};

	///
	/// given an interpolation value from 0 to 1, find the appropriate point between A and B
	/// @param {Object} posA
	/// @param {Object} posB
	/// @param {number} [0.0, 1.0]
	/// @return {Object} interpolated_position [posA, posB]
	///
	rat.utils.interpolatePos = function (posA, posB, i)
	{
		return { x: posB.x * i + (1 - i) * posA.x, y: posB.y * i + (1 - i) * posA.y, };
	};

	///
	/// limit to these values, inclusive
	/// @param {number} x
	/// @param {number} min
	/// @param {number} max
	/// @return {number} x [min, max]
	///
	rat.utils.limit = function (x, min, max)
	{
		// could use Math.max and Math.min, but that'd be more function calls, which we like to avoid
		if (x < min) return min;
		if (x > max) return max;
		return x;
	};

	///
	///	reorder this list randomly
	/// @param {Array} list
	/// @return {Array} list
	///
	rat.utils.randomizeList = function (list)
	{
		for (var i = 0; i < list.length; i++)
		{
			var targ = Math.floor(Math.random() * list.length);
			var temp = list[i];
			list[i] = list[targ];
			list[targ] = temp;
		}
		return list;
	};

	///
	/// return random entry in this array (pick random)
	/// if a "skip" is provided, avoid that entry when picking a random entry.
	/// (skip can be an individual index, or an array of indices to skip, or not provided)
	/// @param {Array} list
	/// @param {Array|number=} skip
	/// @return {?} list_item
	///
	rat.utils.randomInList = function (list, skip)
	{
		if (skip === void 0) // not specified
		{
			// quick easy version, let's just do that now.
			var targ = Math.floor(Math.random() * list.length);
			return list[targ];
		}

		// more complex version supporting skip
		if (Array.isArray(skip) === false)
			skip = [skip];
		skip.sort(function (a, b)
		{
			return b - a;
		});
		var len = list.length - skip.length;
		var targ = Math.floor(Math.random() * len);
		for (var index = 0; index !== skip.length; ++index)
			if (skip[index] <= targ)
			{
				++targ;
			}
		return list[targ];
	};

	///
	/// Get a random number between a certain range
	/// TODO: make sure these do what we want...
	/// @param {number} min
	/// @param {number} max
	/// @return {number} random_number
	///
	rat.utils.randomInRange = function (min, max)
	{
		var difference = max - min;
		return (Math.random() * difference) + min;
	};

	///
	/// Get a random whole number between a certain range
	/// limit to these values, inclusive
	/// @param {number} min
	/// @param {number} max
	/// @return {number} random_number
	///
	rat.utils.randomIntInRange = function (min, max)
	{
		var difference = max - min;
		return Math.round(Math.random() * difference) + min;
	};

	///
	/// utility to make a random ID out of characters and numbers
	/// @param {length} len
	/// @return {string} text
	///
	rat.utils.makeID = function (len)
	{
		var text = "";
		var possible = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";

		for (var i = 0; i < len; i++)
			text += possible.charAt(Math.floor(Math.random() * possible.length));

		return text;
	};

	///
	/// get current browser window size
	/// this is usually what we want - just usable space, not including things like menu bar or chrome debugger panel
	/// @suppress {missingProperties}
	/// @return {Object} windowSize (w, h | x, y)
	///
	rat.utils.getWindowSize = function ()
	{
		// http://stackoverflow.com/questions/3437786/how-to-get-web-page-size-browser-window-size-screen-size-in-a-cross-browser-wa
		var w = window;
		var d = document;
		var e = d.documentElement;
		if (!e && d.getDocumentElement)
			e = d.getDocumentElement();
		var g = {};
		if (d.getElementsByTagName)
			g = d.getElementsByTagName('body')[0];
		var x = w.innerWidth || e.clientWidth || g.clientWidth;
		var y = w.innerHeight || e.clientHeight || g.clientHeight;

		//rat.console.log("------------------------");
		//rat.console.log("Window Size Info:");
		//rat.console.log("ch = " + e.clientHeight);

		/*
		  STT: sometimes we're one pixel too big.  Detect this by watching clientheight,
		  but don't use that value, since it's a scrollbar size sometimes?
		  Pretty dang kludgey, but fixes a scaling problem in chrome...
		  STT UPDATE 2015.01.04:  A much better fix is to add this to your css:
		  
		  body {
		  overflow-y:hidden;
		  }
		  
		  I tried various other things, like border-box sizing and setting every margin/border to 0,
		  and they didn't work because... who the heck knows?  HTML and CSS suck grandma donkey feet.
		  
		  http://stackoverflow.com/questions/14673912/remove-vertical-scrollbar-that-is-clearly-not-necessary
		  http://www.paulirish.com/2012/box-sizing-border-box-ftw/
		  http://w3schools.invisionzone.com/index.php?showtopic=40135
		  
		  anyway, here's what we used to be doing here in code,
		  which sometimes seemed to help (e.g. on initial load) but not always (e.g. on later resize)
		  
		  if (rat.system.has.chromeBrowser && e.clientHeight && w.innerHeight && e.clientHeight < w.innerHeight)
		  y = w.innerHeight-1;
		  
		  //	Same thing, but with width - this has been commented out for a while - not recommended?
		  //if (e.clientWidth && w.innerWidth && e.clientWidth < w.innerWidth)
		  //	x = e.clientWidth;
		  */

		return { x: x, y: y, w: x, h: y };	//	so caller can use x,y or w,h names
	};

	///
	/// Dynamic script loading support
	/// Note that for this to work in chrome locally, you might need to launch chrome with --allow-file-access-from-files.
	/// That won't be a problem for a version of the game hosted on line.
	///
	/// This is the function you generally want to use:
	/// Pass in either a single filename or an array of files to load
	/// @param {string|Array.<string>} scripts the scripts to load
	/// @param {function()=} clientCallback
	/// @param {Object=} options  {async = true}
	///
	rat.utils.loadScripts = function (scripts, clientCallback, options)
	{
		if (!clientCallback)
			clientCallback = void 0;
		if (!Array.isArray(scripts))
			scripts = [scripts];
		var async = true;
		if (options && options.async !== void 0)
			async = options.async || false;

		//	add these all to the global script list first, so we know how many we're going to be waiting for.
		//		(if we add and load at the same time, it's possible for one script to immediately load,
		//		and the client will call allScriptsAreLoaded and see that 1/1 scripts are loaded, and move on,
		//		even if several scripts were passed in here.
		var startCount = rat.utils.scripts.length;
		var curCount = startCount;
		var i;
		for (i = 0; i < scripts.length; i++)
		{
			//	add to my list.
			//	first filter out duplicates!  This happens sometimes (accidentally, but commonly) so we need to protect against it.
			if (rat.utils.scriptIndex(scripts[i]) >= 0)
			{
				rat.console.log("warning:  already loaded script " + scripts[i]);
				continue;
			}
			rat.utils.scripts[curCount++] = { filename: scripts[i], state: 'none', type: 'script', clientCallback: clientCallback };
		}

		//	THEN trigger the loads for those we just added, with our standard dynamicLoadCompleteCallback function
		// No, if a script adds other scripts this will fail spectacularly. Need to only run on the scripts we actually just added
		for (i = startCount; i < curCount; i++)
		{
			// console.log("starting loadScriptWithCallback: " + rat.utils.scripts[i].filename);
			rat.utils.loadScriptWithCallback(rat.utils.scripts[i].filename, async, rat.utils.dynamicLoadCompleteCallback);
		}
	};

	//	list of scripts/data we should be loading or should have loaded.
	rat.utils.scripts = [];
	rat.utils.scriptsLoadedCount = 0;	//	count of successful loads

	//	let's piggyback on that to read JSON files, too.
	//	Add to the same list so the client can wait generally for requested JSON files to be done.

	///
	/// load one JSON file with this callback on success
	/// This is the function clients should use, one at a time for desired JSON files.
	/// This is different from the above, I know.  The thing is, each time we load a JSON file, it needs to get assigned to
	/// a variable, which implies the completion callback really needs to be unique per item...
	/// e.g. rat.utils.loadJSON("mydata.json", function(data) { myvar = data; });
	/// @param {string} filename
	/// @param {function} completeCallback
	///
	rat.utils.loadJSON = function (filename, completeCallback)
	{
		var completeWrapper = function (unparsedData)
		{
			var parsed = unparsedData ? JSON.parse(unparsedData) : {};
			completeCallback(parsed);
		};

		rat.utils.getResource(filename, completeWrapper, 'json');
	};

	///
	/// Loads an XML file
	/// @param {string} filename
	/// @param {function} completeCallback
	///
	rat.utils.loadXML = function (filename, completeCallback)
	{
		// not neccesary here as maybe it is more platform specific
		// but in some cases you may want to parse the XML data using the following code.
		//var parser = new DOMParser();
		//var xmlData = parser.parseFromString(xmlData, "text/xml");

		rat.utils.getResource(filename, completeCallback, 'xml');
	};


	// PMM - refactoring out so we can make this usable by more than just JSON

	///
	/// generic function that will go out and get a file of any type
	///	it does use the script system callback to make sure all file loads are complete
	/// @param {string} filename
	/// @param {function} completeCallback
	/// @param {string} fileType
	///
	rat.utils.getResource = function (filename, completeCallback, fileType)
	{
		rat.utils.scripts[rat.utils.scripts.length] = { filename: filename, state: 'none', type: fileType };

		var xhr = new XMLHttpRequest();

		// not really sure this is platform independent at this point.
		// Maybe use jquery.  :)
		var complete = function ()
		{
			if (xhr.readyState === 4)
			{
				rat.utils.dynamicLoadCompleteCallback(filename); // mark loaded for tracking
				completeCallback(xhr.responseText);
			}
		};
		xhr.onreadystatechange = complete; // IE?  (actually this is the standard and onload is not -pkk)
		//xhr.onload = complete; // others

		xhr.open("GET", rat.system.fixPath(filename), true);
		//console.log("FILE: " + filename);
		try
		{
			xhr.send();
		}
		catch (exception)
		{ }
	};

	///
	/// return index of script in list to load, or -1 if not found
	/// @param {string} filename
	/// @return {number} j
	///
	rat.utils.scriptIndex = function (filename)
	{
		for (var j = 0; j < rat.utils.scripts.length; j++)
		{
			if (rat.utils.scripts[j].filename === filename)
				return j;
		}
		return -1;
	};

	///
	/// callback when a script is loaded
	/// @param {string} filename
	///
	rat.utils.dynamicLoadCompleteCallback = function (filename)
	{
		//	todo: check ready state to really see if it's loaded?
		var index = rat.utils.scriptIndex(filename);
		if (index >= 0)
		{
			var entry = rat.utils.scripts[index];
			if (entry.state !== 'done')
			{
				entry.state = 'done';
				rat.utils.scriptsLoadedCount++;

				if (entry.clientCallback)
					entry.clientCallback(filename);
			}
		}
	};

	///
	/// returns true if all queued up script loads are done
	/// @return {bool} loaded
	///
	rat.utils.allScriptsAreLoaded = function ()
	{
		var count = rat.utils.scripts.length;
		if (rat.utils.scriptsLoadedCount === count)
		{
			//console.log("dynamic scripts done: " + rat.utils.scripts.length);
			return true;
		} else
		{
			//console.log("dynamic script load: waiting for " + (rat.utils.scripts.length-rat.utils.scriptsLoadedCount) + " / " + rat.utils.scripts.length);
			//for (var j = 0; j < rat.utils.scripts.length; j++)
			//{
			//	if (rat.utils.scripts[j].state !== 'done')
			//		rat.console.log("-->" + rat.utils.scripts[j].filename);
			//}
			return false;
		}
	};

	///
	/// Launches Help UI
	/// @param forUserID
	///
	rat.utils.launchSystemHelpUI = function (forUserID)
	{
		if (rat.system.has.xbox)
		{
			rat.console.log("Launching system help ui for the Xbox");
			var user = rat.user.getUser(forUserID);
			if (user)
				window.Windows.Xbox.ApplicationModel.Help.show(user.rawData);
		}
	};
	
	///
	///	Grab filename without path (strip path from filename)
	///
	rat.utils.stripPath = function(path)
	{
		var end = path.lastIndexOf("/");
		var end2 = path.lastIndexOf("\\");
		if (end2 > end)
			end = end2;
		if (end < 0)	//	no path, just return original name
			return path;
		return path.substring(end+1);
	};
	
	///
	///	Grab just the path from a filename
	///
	rat.utils.getPath = function(path, includeFinalSlash)
	{
		if (includeFinalSlash === void 0)
			includeFinalSlash = true;
		
		var end = path.lastIndexOf("/");
		var end2 = path.lastIndexOf("\\");
		if (end2 > end)
			end = end2;
		if (end < 0)	//	no path
			return "";//includeFinalSlash ? "/" : "";
		if (includeFinalSlash)
			end++;
		return path.substring(0, end);
	};
	
	///
	///	Clean up a path name.  collapse ../ references and ./ references and fix slashes.
	///	Note that we can only collapse ../ references if there's a path above that in the string.
	///
	rat.utils.cleanPath = function(path)
	{
		//	todo: fix \\ to /
		//	todo: fix ./ ?  easier, but not ever used?
		
		var checkAgain;
		do {
			checkAgain = false;
			var fixIndex = path.indexOf("/../");
			if (fixIndex > 0)
			{
				//	grab the string before that...
				var before = path.substring(0, fixIndex);
				//	find the last path there, if there is one...
				var prevEnd = before.lastIndexOf('/');
				prevEnd++;	//	skip past / (keep it)
				//	now splice back together
				path = before.substring(0, prevEnd) + path.substring(fixIndex + 4);
				
				checkAgain = true;
			}
		} while (checkAgain);
		
		return path;
	};
	
});
//
//	Rat Math library
//

//------------ rat.math ----------------

///
/// Basic math functions.  Wrapper around the gobal Math object.
///
rat.modules.add("rat.math.r_math",
[],
function (rat)
{
	///
	/// Namespace for math functions
	/// @namespace
	///
	rat.math = {};

	// Some constants

	/// @const 
	rat.math.PI = Math.PI;
	/// @const 
	rat.math.PI2 = Math.PI * 2.0;
	/// @const 
	rat.math.HALFPI = Math.PI / 2.0;
	/// @const 
	rat.math.E = Math.E;
	/// @const 
	rat.math.MAX_NUMBER = Number.MAX_VALUE;
	/// @const 
	rat.math.MIN_NUMBER = Number.MIN_VALUE;
	/// @const 
	rat.math.DegreesToRadians = rat.math.PI / 180.0;
	rat.math.RadiansToDegrees = 180.0 / rat.math.PI;

	// Basic functions that we get from the built in math library
	rat.math.abs = Math.abs;
	rat.math.min = Math.min;
	rat.math.max = Math.max;
	rat.math.ceil = Math.ceil;
	rat.math.floor = Math.floor;
	rat.math.round = Math.round;

	rat.math.cos = Math.cos;
	rat.math.sin = Math.sin;
	rat.math.tan = Math.tan;
	rat.math.acos = Math.acos;
	rat.math.asin = Math.asin;
	rat.math.atan = Math.atan;
	rat.math.atan2 = Math.atan2;

	rat.math.random = Math.random;
	rat.math.sqrt = Math.sqrt;
	rat.math.log = Math.log;
	rat.math.exp = Math.exp;
	rat.math.pow = Math.pow;

	///
	/// Clamps to make sure that low <= a <= high
	/// @param {number} a the given value
	/// @param {number} low the low clamp level
	/// @param {number} high the high clamp level
	/// @return {number} a the clamped value
	///
	rat.math.clamp = function (a, low, high)
	{
		if (a < low)
			return low;
		else if (a > high)
			return high;
		return a;
	};

	///
	/// Interpolate between two numbers
	/// interp = 0 -> valA | interp = 1 -> valB
	/// @param {number} valA 
	/// @param {number} valB 
	/// @param {number} interp 0.0 - 1.0 
	/// @return {number} [valA, valB]
	///
	rat.math.interp = function (valA, valB, interp)
	{
		return valB * interp + valA * (1.0 - interp);
	};

	///
	/// Get the sign of a number
	/// @param {number} num
	/// @return {number} sign -1, 0, 1
	///
	rat.math.signOf = function (num)
	{
		return (num > 0) ? 1 : ((num < 1) ? -1 : 0);
	};

	///
	/// Return a variance of +- v
	/// @param {number} v
	/// @returns {number} [-v, v]
	///
	rat.math.randomVariance = function (v)
	{
		if (!v)
			return 0;
		return v * 2 * rat.math.random() - v;
	};

	///
	/// Finds the center of a circle.
	/// @param {number} x1 x-coordinate of a point on the circle.
	/// @param {number} y1 y-coordinate of a point on the circle.
	/// @param {number} x2 x-coordinate of the other point on the circle.
	/// @param {number} y2 y-coordinate of the other point on the circle.
	/// @param {number} radius of the circle.
	/// @param {?number} centerDirectionX The desired direction of the center on the x-axis. Defaults to 1.
	/// @param {?number} centerDirectionY The desired direction of the center on the y-axis. Defaults to 1.
	/// @return {{x:number, y:number}} The point of the circle's center.
	///
	rat.math.findCircleCenterFromTwoPoints = function (x1, y1, x2, y2, radius, centerDirectionX, centerDirectionY)
	{
		// Find the center of the circle.
		// Based on the formula at: http://mathforum.org/library/drmath/view/53027.html
		var dx = x2 - x1;
		var dy = y2 - y1;
		var lineSegmentDistance = Math.sqrt(dx * dx + dy * dy);
		var midX = (x2 + x1) * 0.5;
		var midY = (y2 + y1) * 0.5;
		var distanceFromMidpoint = Math.sqrt(radius * radius - lineSegmentDistance * lineSegmentDistance * 0.25);

		// Figure out how we want to treat the signs based on the desired direction we want it to be in.
		// First, consider the center in the direction of <dy, -dx>.
		// The dot product with the desired direction is positive if they are both in the same general direction.
		var perpendicularDx = dy;
		var perpendicularDy = -dx;
		var dotProductCenterDirection = perpendicularDx * centerDirectionX - perpendicularDy * centerDirectionY;
		if (dotProductCenterDirection < 0)
		{
			perpendicularDx = -dy;
			perpendicularDy = dx;
		}

		var centerX = midX + distanceFromMidpoint * perpendicularDx / lineSegmentDistance;
		var centerY = midY + distanceFromMidpoint * perpendicularDy / lineSegmentDistance;
		return { x: centerX, y: centerY };
	};

	///
	/// Finds the center of a circle.
	/// @param {number} x x-coordinate of a point on the circle.
	/// @param {number} y y-coordinate of a point on the circle.
	/// @param {number} centerX x-coordinate of the circle's center.
	/// @param {number} centerY y-coordinate of the circle's center.
	/// @return {number} The angle of the circle from the x-axis in radians.
	///
	rat.math.findAngleOnCircle = function (x, y, centerX, centerY)
	{
		var offsetX = x - centerX;
		var offsetY = y - centerY;
		return rat.math.atan2(offsetY, offsetX);
	};

	///
	/// Finds the arc which passes through two points.
	/// @param {number} x1 x-coordinate of a point on the circle.
	/// @param {number} y1 y-coordinate of a point on the circle.
	/// @param {number} x2 x-coordinate of the other point on the circle.
	/// @param {number} y2 y-coordinate of the other point on the circle.
	/// @param {number} centerX  x-coordinate of the circle's center.
	/// @param {number} centerY  y-coordinate of the circle's center.
	/// @param {number} radius of the circle.
	/// @return {{type:string, center:{x:number, y:number}, radius:number, startAngle:number, endAngle:number, anticlockwise:boolean}} Represents the arc.
	///
	rat.math.findArcOnCircle = function (x1, y1, x2, y2, centerX, centerY, radius)
	{
		// Find if the arc goes clockwise or anticlockwise.
		// Check the z-coordinates of the cross product of p1 to center and p1 to p2.
		var anticlockwise = (centerX - x1) * (y2 - y1) - (centerY - y1) * (y2 - x1) > 0;

		var startAngle = rat.math.findAngleOnCircle(x1, y1, centerX, centerY);
		var endAngle = rat.math.findAngleOnCircle(x2, y2, centerX, centerY);

		return {
			type: "arc",
			center: { x: centerX, y: centerY },
			radius: radius,
			startAngle: startAngle,
			endAngle: endAngle,
			anticlockwise: anticlockwise
		};
	};

	///
	/// Finds the arc which passes through two points.
	/// @param {number} x1 x-coordinate of a point on the circle.
	/// @param {number} y1 y-coordinate of a point on the circle.
	/// @param {number} x2 x-coordinate of the other point on the circle.
	/// @param {number} y2 y-coordinate of the other point on the circle.
	/// @param {number} radius of the circle.
	/// @param {?number} centerDirectionX The desired direction of the center on the x-axis. Defaults to 1.
	/// @param {?number} centerDirectionY The desired direction of the center on the y-axis. Defaults to 1.
	/// @return {{center:{x:number, y:number}, radius:number, startAngle:number, endAngle:number, anticlockwise:boolean}} Represents the arc.
	///
	rat.math.findArcFromTwoPoints = function (x1, y1, x2, y2, radius, centerDirectionX, centerDirectionY)
	{
		var center = rat.math.findCircleCenterFromTwoPoints(x1, y1, x2, y2, radius, centerDirectionX, centerDirectionY);
		return rat.math.findArcOnCircle(x1, y1, x2, y2, center.x, center.y, radius);
	};

	///
	/// Finds the perpendicular bisector of two points.
	/// @param {number} x1 x-coordinate of point 1 on the circle.
	/// @param {number} y1 y-coordinate of point 1 on the circle.
	/// @param {number} x2 x-coordinate of point 2 on the circle.
	/// @param {number} y2 y-coordinate of point 2 on the circle.
	/// @return {{a:number, b:number, c:number}} the perpendicular bisector in the form of ax+by=c.
	///
	rat.math.findPerpendicularBisector = function (x1, y1, x2, y2)
	{
		var dx = x2 - x1;
		var dy = y2 - y1;
		var midX = (x2 + x1) * 0.5;
		var midY = (y2 + y1) * 0.5;

		if (dy === 0)
			// The perpendicular bisector is vertical.
			return { a: 1, b: 0, c: midX };

		var slope = -dx / dy;// perpendicular slope
		return { a: -slope, b: 1, c: -slope * midX + midY };
	};

	///
	/// Finds the center of a circle.
	/// @param {number} x1 x-coordinate of point 1 on the circle.
	/// @param {number} y1 y-coordinate of point 1 on the circle.
	/// @param {number} x2 x-coordinate of point 2 on the circle.
	/// @param {number} y2 y-coordinate of point 2 on the circle.
	/// @param {number} x3 x-coordinate of point 3 on the circle.
	/// @param {number} y3 y-coordinate of point 3 on the circle.
	/// @return {{center:{x:number, y:number}, radius:number}|boolean} The point of the circle's center or false if the points are a strait line.
	///
	rat.math.findCircleFromThreePoints = function (x1, y1, x2, y2, x3, y3)
	{
		// The center of the circle is at the intersection of the perpendicular bisectors.
		var line1 = rat.math.findPerpendicularBisector(x1, y1, x2, y2);
		var line2 = rat.math.findPerpendicularBisector(x1, y1, x3, y3);

		// Use line1 and line2 to eliminate y.
		var line3 = void 0;
		if (line1.b === 0)
			line3 = line1;
		else if (line2.b === 0)
			line3 = line2;
		else
		{
			// Eliminate y
			var lineBScalar = -line1.b / line2.b;
			line3 = {
				a: line1.a + line2.a * lineBScalar,
				//b: line1.b + line2.b * lineBScalar, // b should be zero.
				c: line1.c + line2.c * lineBScalar,
			};
		}
		if (line3.a === 0)
			// x was eliminated with y, so the lines must be parallel.
			return false;

		var x = line3.c / line3.a;
		var y = (line1.b !== 0) ? // Solve for y in the equation with y
		(line1.c - line1.a * x) / line1.b :
			(line2.c - line2.a * x) / line2.b;

		// Find the radius
		var dx = x1 - x;
		var dy = y1 - y;
		var radius = rat.math.sqrt(dx * dx + dy * dy);

		return {
			center: { x: x, y: y },
			radius: radius
		};
	};

	///
	/// Finds the arc which passes through three points. The ends are at point 1 and point 3.
	/// @param {number} x1 x-coordinate of point 1 on the circle.
	/// @param {number} y1 y-coordinate of point 1 on the circle.
	/// @param {number} x2 x-coordinate of point 2 on the circle.
	/// @param {number} y2 y-coordinate of point 2 on the circle.
	/// @param {number} x3 x-coordinate of point 3 on the circle.
	/// @param {number} y3 y-coordinate of point 3 on the circle.
	/// @return {{type:string, center:{x:number, y:number}, radius:number, startAngle:number, endAngle:number, anticlockwise:boolean}|{type:string, point1:{x:number, y:number},point2:{x:number, y:number}}} Represents the arc or strait line if the three points line up.
	///
	rat.math.findArcFromThreePoints = function (x1, y1, x2, y2, x3, y3)
	{
		var circle = rat.math.findCircleFromThreePoints(x1, y1, x2, y2, x3, y3);
		if (!circle)
			return {
				type: "seg",
				point1: { x: x1, y: y1 },
				point2: { x: x3, y: y3 },
			};
		return rat.math.findArcOnCircle(x1, y1, x3, y3, circle.center.x, circle.center.y, circle.radius);
	};
});
///
///	A collection of geometry-related classes and functions
///
///------------ rat.Vector ----------------
rat.modules.add("rat.math.r_vector",
[
	{ name: "rat.math.r_math", processBefore: true },
],
function (rat)
{
	var math = rat.math;

	///
	/// standard 2D Vector
	/// @constructor
	/// @param {number|Object=} x rat.Vector
	/// @param {number=} y
	///
	rat.Vector = function (x, y)
	{
		if (x !== void 0 && x.x !== void 0)
		{
			y = x.y;
			x = x.x;
		}
		this.x = x || 0;
		this.y = y || 0;
	};

	///
	/// Makes a copy of this vector and returns it
	/// @return {Object} newVec rat.Vector
	///
	rat.Vector.prototype.copy = function ()
	{
		var newVec = new rat.Vector();
		newVec.x = this.x;
		newVec.y = this.y;
		return newVec;
	};

	/// 
	/// Sets a vector equal to another vector, or to param x, y values 
	/// @param {Object|number} x rat.Vector
	/// @param {number=} y 
	///
	rat.Vector.prototype.set = function (x, y)
	{
		// Paul wants this to say that this duplicates the copyFrom behavior
		if (x.x !== void 0)
		{
			y = x.y;
			x = x.x;
		}
		this.x = x;
		this.y = y;
	};

	///
	/// Sets this vector to be the same as the input vector
	/// @param {Object} vec rat.Vector
	///
	rat.Vector.prototype.copyFrom = function (vec)
	{
		this.x = vec.x;
		this.y = vec.y;
	};

	///
	/// Returns the length of the vector
	/// @return {number} length
	///
	rat.Vector.prototype.length = function ()
	{
		return rat.math.sqrt(this.x * this.x + this.y * this.y);
	};

	///
	/// Returns the the length of the vector squared
	/// @return {number} length_squared
	///
	rat.Vector.prototype.lengthSq = function ()
	{
		return this.x * this.x + this.y * this.y;
	};

	///
	/// Returns the distance squared from this vector to another
	/// @param {Object} v rat.Vector
	/// @return {number} distance_squared
	///
	rat.Vector.prototype.distanceSqFrom = function (v)
	{
		var dx = v.x - this.x;
		var dy = v.y - this.y;
		return dx * dx + dy * dy;
	};

	///
	/// Returns the distance from this vector to another
	/// @param {Object} v rat.Vector
	/// @return {number} distance
	///
	rat.Vector.prototype.distanceFrom = function (v)
	{
		return rat.math.sqrt(this.distanceSqFrom(v));
	};

	///
	/// Get a delta vector from this to v
	/// @param {Object} v rat.Vector
	/// @param {Object=} dest rat.Vector
	/// @return {Object} delta rat.Vector
	///
	rat.Vector.prototype.deltaTo = function (v, dest)
	{
		dest = dest || new rat.Vector();
		dest.set(v.x - this.x, v.y - this.y);
		return dest;
	};

	///
	/// Normalizes the vector (Scales to 1)
	///
	rat.Vector.prototype.normalize = function ()
	{
		var mag = this.length();
		this.x /= mag;
		this.y /= mag;
	};

	///
	/// Multiplies the vector by a constant scaler
	/// @param {number} newScale
	///
	rat.Vector.prototype.scale = function (newScale)
	{
		this.x *= newScale;
		this.y *= newScale;
	};

	///
	/// Scales the vector to be a specific length
	/// @param {number} newLength
	///
	rat.Vector.prototype.setLength = function (newLength)
	{
		this.normalize();
		this.scale(newLength);
	};

	///
	/// Adds another vector to this one
	/// @param {Object} vec rat.Vector
	///
	rat.Vector.prototype.add = function (vec)
	{
		this.x += vec.x;
		this.y += vec.y;
	};

	///
	/// Multiplies vec by scale and adds it to this vector
	/// @param {Object} vec rat.Vector
	/// @param {number} scale
	///
	rat.Vector.prototype.addScaled = function (vec, scale)
	{
		this.x += vec.x * scale;
		this.y += vec.y * scale;
	};

	///
	/// Subtracts another vector to this one
	/// @param {Object} vec rat.Vector
	///
	rat.Vector.prototype.subtract = function (vec)
	{
		this.x -= vec.x;
		this.y -= vec.y;
	};

	///
	/// Sets a vector from an angle (in radians)
	///	NOTE:  this assumes a default vector of x=1,y=0
	/// @param {number} angle
	///
	rat.Vector.prototype.setFromAngle = function (angle)
	{
		var cos = rat.math.cos(angle);
		var sin = rat.math.sin(angle);

		this.x = cos;
		this.y = sin;
	};

	///
	/// Returns the dot product of two vectors
	/// @param {Object} a rat.Vector
	/// @param {Object} b rat.Vector
	/// @return {number} dotProduct
	///
	rat.Vector.dot = function (a, b)
	{
		return a.x * b.x + a.y * b.y;
	};

	///
	/// Returns the cross product of two vectors
	/// @param {Object} a rat.Vector
	/// @param {Object} b rat.Vector
	/// @return {number} crossProduct
	///
	rat.Vector.cross = function (a, b)
	{
		// In 2d, the cross product is just a value in Z, so return that value.
		return (a.x * b.y) - (a.y * b.x);
	};

	///
	/// Build a string that display this vectors values
	/// @return {string} vector rat.Vector
	///
	rat.Vector.prototype.toString = function ()
	{
		return "(" + this.x + ", " + this.y + ")";
	};

	///
	/// Clips vector to fit within a rectangle
	/// @param {Object} r rat.shapes.Rect 
	///
	rat.Vector.prototype.limitToRect = function (/*rat.shapes.Rect*/ r)
	{
		if (this.x < r.x)
			this.x = r.x;
		if (this.y < r.y)
			this.y = r.y;
		if (this.x > r.x + r.w)
			this.x = r.x + r.w;
		if (this.y > r.y + r.h)
			this.y = r.y + r.h;
	};

	///---------------- rat.Angle ---------------------
	///	I know, we're just tracking a single value here, why is this a class?
	///	1. so we can assign references to it, and multiple objects can have a single changing value to share
	///	2. for ease in performing custom operations on the object, like conversions and math

	///
	/// @constructor
	/// @param {number|Object=} angle rat.Angle
	///
	rat.Angle = function (angle)
	{
		this.angle = angle || 0;
	};

	///
	/// Returns a copy of this angle
	/// @return {Object} angle rat.Angle
	///
	rat.Angle.prototype.copy = function ()
	{
		var newAngle = new rat.Angle();
		newAngle.angle = this.angle;
		return newAngle;
	};

	///
	///	set angle from vector.  This means a 0 angle correlates with a vector to the right
	/// @param {Object} v rat.Vector
	/// @return {Object} angle rat.Vector
	///
	rat.Angle.prototype.setFromVector = function (/*rat.Vector*/ v)
	{
		this.angle = rat.math.atan2(v.y, v.x);
		return this;
	};

	///
	///	set an angle facing from source to target
	/// @param {Object} source rat.Vector
	/// @param {Object} target rat.Vector
	/// @return {Object} this rat.Angle
	///
	rat.Angle.prototype.setFromSourceTarget = function (/*rat.Vector*/ source, /*rat.Vector*/ target)
	{
		this.angle = rat.math.atan2(target.y - source.y, target.x - source.x);
		return this;
	};

	///
	/// Rotate the provided vector, in place by this angle
	/// @param {Object} v rat.Vector
	/// @return {Object} v rat.Vector
	///
	rat.Angle.prototype.rotateVectorInPlace = function (/*rat.Vector*/ v)
	{
		var cos = rat.math.cos(this.angle);
		var sin = rat.math.sin(this.angle);
		var x = v.x * cos - v.y * sin;
		var y = v.x * sin + v.y * cos;
		v.x = x;
		v.y = y;
		return v;
	};

	///
	/// Returns a vector rotated by this angle
	/// @param {Object} v rat.Vector
	/// @param {Object=} dest rat.Vector
	/// @return {Object} dest rat.Vector
	///
	rat.Angle.prototype.rotateVector = function (/*rat.Vector*/ v, /*rat.Vector*/dest)
	{
		if (dest)
		{
			dest.x = v.x;
			dest.y = v.y;
		}
		else
			dest = new rat.Vector(v);
		return this.rotateVectorInPlace(dest);
	};

	///------ rat.Position --------------
	///	utility:  combine position and angle for a single object, for convenience.
	///	I'm not super comfortable with this name, since it's not clear why a "position" has an angle...
	///	Would love a better name, but don't have one.  What word means "position and orientation"?  Place?  Location?
	///	We do use Place in other places.  At least one example online uses "Position" http://www.cs.sbu.edu/roboticslab/Simulator/kRobotWebPage/doc/Position.html
	///	Also, maybe should just reimplement all the above, and track x,y,angle instead of breaking them up?
	///	or store them both ways somehow?  could be unnecessary overhead for that.
	///	Another idea - just push all this functionality into Vector, but add 'angle' to vector on the fly...?

	///
	/// Constructor for position
	/// @constructor
	/// @param {number} x
	/// @param {number} y
	/// @param {number|Object} angle rat.Angle 
	///
	rat.Position = function (x, y, angle)
	{
		this.pos = new rat.Vector(x, y);
		this.rot = new rat.Angle(angle);
	};
});
//
//	A collection of matrix-related classes and functions
//

//------------ rat.Matrix ----------------
rat.modules.add("rat.math.r_matrix",
[
	{ name: "rat.math.r_math", processBefore: true },
],
function (rat)
{
	var math = rat.math;

	//	Avoid creating temporary array objects
	var tm = [[], [], []]; // This only works because we cannot have to executing code paths in this function
	///
	/// Constructor for Matrix 
	/// @constructor
	/// @param {?} m Setup with this matrix.  Otherwise, ident 
	///
	rat.Matrix = function (m)	//	constructor for Matrix..  Not defined
	{
		this.m = [[], [], []];
		//	Don't just point at was was passed in
		if (m && m.m)
			this.set(m.m);
		else if (m)
			this.set(m);
		else
			this.loadIdent();
	};

	///
	/// Set this matrix to identity
	///
	rat.Matrix.prototype.loadIdent = function ()
	{
		//	Just replace the matrix
		this.m[0][0] = 1; this.m[0][1] = 0; this.m[0][2] = 0;
		this.m[1][0] = 0; this.m[1][1] = 1; this.m[1][2] = 0;
		this.m[2][0] = 0; this.m[2][1] = 0; this.m[2][2] = 1;
	};

	///
	/// transform this matrix
	/// @param {number} x
	/// @param {number} y
	///
	rat.Matrix.prototype.translateSelf = function (x, y)
	{
		var m1 = this.m;
		m1[0][2] = (m1[0][0] * x) + (m1[0][1] * y) + m1[0][2];
		m1[1][2] = (m1[1][0] * x) + (m1[1][1] * y) + m1[1][2];
		m1[2][2] = (m1[2][0] * x) + (m1[2][1] * y) + m1[2][2];

	};

	///
	/// rotate this matrix
	/// @param {number} r
	///
	rat.Matrix.prototype.rotateSelf = function (r)
	{
		var cos = math.cos(r);
		var sin = math.sin(r);
		var nsin = -sin;
		var m1 = this.m;
		//var m = [[cos, -sin, 0],
		//	     [sin, cos, 0],
		//		 [0, 0, 1]];
		var m00 = (m1[0][0] * cos) + (m1[0][1] * sin);
		var m01 = (m1[0][0] * nsin) + (m1[0][1] * cos);
		//m1[0][2] = m1[0][2];
		var m10 = (m1[1][0] * cos) + (m1[1][1] * sin);
		var m11 = (m1[1][0] * nsin) + (m1[1][1] * cos);
		//m1[1][2] = m1[1][2];
		var m20 = (m1[2][0] * cos) + (m1[2][1] * sin);
		var m21 = (m1[2][0] * nsin) + (m1[2][1] * cos);
		//m1[2][2] = m1[2][2];
		m1[0][0] = m00;
		m1[0][1] = m01;
		m1[1][0] = m10;
		m1[1][1] = m11;
		m1[2][0] = m20;
		m1[2][1] = m21;
	};

	///
	/// Scale this matrix
	/// @param {number} x
	/// @param {number} y
	///
	rat.Matrix.prototype.scaleSelf = function (x, y)
	{
		var m1 = this.m;
		m1[0][0] = (m1[0][0] * x);
		m1[0][1] = (m1[0][1] * y);
		//m1[0][2] = m1[0][2];
		m1[1][0] = (m1[1][0] * x);
		m1[1][1] = (m1[1][1] * y);
		//m1[1][2] = m1[1][2];
		m1[2][0] = (m1[2][0] * x);
		m1[2][1] = (m1[2][1] * y);
		//m1[2][2] = m1[2][2];
	};


	///
	/// Multiply this matrix with another
	/// @param {Object} m2 matrix to multiply with
	///
	rat.Matrix.prototype.multSelf = function (m2)
	{
		if (m2.m)
			m2 = m2.m;
		var m1 = this.m;
		tm[0][0] = (m1[0][0] * m2[0][0]) + (m1[0][1] * m2[1][0]) + (m1[0][2] * m2[2][0]);
		tm[0][1] = (m1[0][0] * m2[0][1]) + (m1[0][1] * m2[1][1]) + (m1[0][2] * m2[2][1]);
		tm[0][2] = (m1[0][0] * m2[0][2]) + (m1[0][1] * m2[1][2]) + (m1[0][2] * m2[2][2]);
		tm[1][0] = (m1[1][0] * m2[0][0]) + (m1[1][1] * m2[1][0]) + (m1[1][2] * m2[2][0]);
		tm[1][1] = (m1[1][0] * m2[0][1]) + (m1[1][1] * m2[1][1]) + (m1[1][2] * m2[2][1]);
		tm[1][2] = (m1[1][0] * m2[0][2]) + (m1[1][1] * m2[1][2]) + (m1[1][2] * m2[2][2]);
		tm[2][0] = (m1[2][0] * m2[0][0]) + (m1[2][1] * m2[1][0]) + (m1[2][2] * m2[2][0]);
		tm[2][1] = (m1[2][0] * m2[0][1]) + (m1[2][1] * m2[1][1]) + (m1[2][2] * m2[2][1]);
		tm[2][2] = (m1[2][0] * m2[0][2]) + (m1[2][1] * m2[1][2]) + (m1[2][2] * m2[2][2]);

		// just replace the matrix
		var old = this.m;
		this.m = tm;
		tm = old;
	};

	///
	/// Get the inverse of matrix (in place)
	/// @return {bool} inverted Whether or not the inverse could be taken
	///
	rat.Matrix.prototype.inverseSelf = function ()
	{
		var m = this.m;
		//a1*b2*c3 - a1*b3*c2 - a2*b1*c3 + a2*b3*c1 + a3*b1*c2 - a3*b2*c1
		var d = (m[0][0] * m[1][1] * m[2][2]) - //a1*b2*c3 -
		(m[0][0] * m[1][2] * m[2][1]) - //a1*b3*c2 -
		(m[0][1] * m[1][0] * m[2][2]) + //a2*b1*c3 +
		(m[0][1] * m[1][2] * m[2][0]) + //a2*b3*c1 +
		(m[0][2] * m[1][0] * m[2][1]) - //a3*b1*c2 -
		(m[0][2] * m[1][1] * m[2][0]);  //a3*b2*c1
		if (d === 0)
			return false; // Cannot get the inverse

		//2X2 determinant
		//	a b 
		//	c d
		//	ad - bc

		var inv_d = 1 / d;
		tm[0][0] = inv_d * (m[1][1] * m[2][2] - m[1][2] * m[2][1]);
		tm[0][1] = inv_d * (m[0][2] * m[2][1] - m[0][1] * m[2][2]);
		tm[0][2] = inv_d * (m[0][1] * m[1][2] - m[0][2] * m[1][1]);
		tm[1][0] = inv_d * (m[1][2] * m[2][0] - m[1][0] * m[2][2]);
		tm[1][1] = inv_d * (m[0][0] * m[2][2] - m[0][2] * m[2][0]);
		tm[1][2] = inv_d * (m[0][2] * m[1][0] - m[0][0] * m[1][2]);
		tm[2][0] = inv_d * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);
		tm[2][1] = inv_d * (m[0][1] * m[2][0] - m[0][0] * m[2][1]);
		tm[2][2] = inv_d * (m[0][0] * m[1][1] - m[0][1] * m[1][0]);

		var old = this.m;
		this.m = tm;
		tm = old;
		return true;
	};

	///
	/// Set this matrix with an array of arrays
	/// @param {?} m become this matrix
	///
	rat.Matrix.prototype.set = function (m)
	{
		if (m.m)
			m = m.m;
		//	Manual copy to avoid pointing to the matrix passed
		var self = this.m;
		self[0][0] = m[0][0];
		self[0][1] = m[0][1];
		self[0][2] = m[0][2];
		self[1][0] = m[1][0];
		self[1][1] = m[1][1];
		self[1][2] = m[1][2];
		self[2][0] = m[2][0];
		self[2][1] = m[2][1];
		self[2][2] = m[2][2];
	};

	///
	/// Transform a point in place by this matrix 
	/// @param {Object=} p point object
	///
	rat.Matrix.prototype.transformPointSelf = function (p)
	{
		var m = this.m;
		var tx = p.x;
		var ty = p.y;
		p.x = (m[0][0] * tx) + (m[0][1] * ty + m[0][2]);
		p.y = (m[1][0] * tx) + (m[1][1] * ty + m[1][2]);
		return p;
	};

	///
	/// Transform a point by this matrix 
	/// @param {Object=} p point object
	/// @param {Object=} dest point object
	/// @return {Object} point The transformed point
	///
	rat.Matrix.prototype.transformPoint = function (p, dest)
	{
		if (!dest)
			dest = new rat.Vector(p);
		else
		{
			dest.x = p.x;
			dest.y = p.y;
		}
		return this.transformPointSelf(dest);
	};

	///
	///	Static method to allow matrix multiplication
	/// @param {Object} m1 The first matrix
	/// @param {Object} m2 The second matrix
	/// @param {Object=} dest destination matrix
	/// @return {Object} dest the multiplied matrix
	///
	rat.Matrix.matMult = function (m1, m2, dest)
	{
		if (dest)
			dest.set(m1);
		else
			dest = new rat.Matrix(m1);
		dest.multSelf(m2);
		return dest;
	};

	///
	/// Get the inverse of one matrix into another matrix
	/// @param {dest=} The destination of the matrix inverse
	/// @return {dest} The matrix inverse
	///
	rat.Matrix.prototype.inverse = function (dest)
	{
		if (!dest)
			dest = new rat.Matrix(this);
		else
			dest.set(this);
		dest.inverseSelf();
		return dest;
	};
});
//
//	Single screen class.
//	See r_screenmanager for screen stack management (I moved things around)
//
//	TODO:  
//		This and rat.screenManager should be in rat.ui folder,
//		and this class should be in rat.ui namespace, or at least just rat.Screen

//----------------------------
//	Screen
rat.modules.add( "rat.ui.r_screen",
[
	{ name: "rat.utils.r_utils", processBefore: true },
	{ name: "rat.ui.r_ui", processBefore: true },
	{ name: "rat.graphics.r_graphics", processBefore: true },
	
	"rat.ui.r_ui_shape",
	"rat.ui.r_screenmanager",
	"rat.input.r_input",
	"rat.input.r_inputmap",
], 
function(rat)

{
	/**@constructor
	 * @extends rat.ui.Element
	 * @param {?} shapeType */
	rat.ui.Screen = function ( shapeType )	//	unused param?  Huh?
	{
		rat.ui.Screen.prototype.parentConstructor.call(this); //	default init
		this.setBounds(0, 0, rat.graphics.SCREEN_WIDTH, rat.graphics.SCREEN_HEIGHT);
	};
	rat.utils.inheritClassFrom(rat.ui.Screen, rat.ui.Element);

	//	Default class properties (DO NOT ADD OBJECTS/ARRAYS HERE!  THEY BECOMRE STATIC!)
	rat.ui.Screen.prototype.modal = false;
	rat.ui.Screen.prototype.targets = null;	//	need to fix this - maybe a reference to a class "targetSet" or something, so non-screens can use it.
	rat.ui.Screen.prototype.inputMap = null;
	rat.ui.Screen.prototype.allowClickAway = false;	//	allow a click outside the screen to dismiss it.  useful for touch UI.
	rat.ui.Screen.prototype.allowBackClose = false;	//	automatically support 'back' ui button (e.g. ESC key) to close a window, like clickAway
	//	Variables modified and managed via the screen manager
	rat.ui.Screen.prototype.isDeactivated = true;	//	Screens do not start active.
	rat.ui.Screen.prototype.isOverlay = true;		//	Old functionality seems to indicate that all screens were overlay screen
	rat.ui.Screen.prototype.isSuspended = true;	//	screen start suspended...  Note that IF 
	rat.ui.Screen.prototype.savedTarget = void 0;	//	When the current target gets saved, save it here.

	//	Add a prop to screen to support the old var name fullOpaque which is the reverse of isOverlay
	rat.utils.addProp(rat.ui.Screen.prototype, 'fullOpaque',
		function (v)
		{
			this.setOverlay( !v );
		},
		function ()
		{
			return !this.isOverlay;
		});

	//	Cleanup the screen
	rat.ui.Screen.prototype.destroy = function()
	{
	};

	/// Set if this screen is currently an overlay screen
	rat.ui.Screen.prototype.setOverlay = function (isOverlay)
	{
		this.isOverlay = isOverlay;
	};

	/// Deactivate this screen if is is not already deactivated
	rat.ui.Screen.prototype.deactivate = function (options)
	{
		if (options === true)
			options = { allowOnlySuspend: true };
		else
			options = options || {};
		
		//	Handle a "light" deactivate
		if (!this.isSuspended)
		{
			this.isSuspended = true;
			if (this.screenSuspend)
			{
				this.screenSuspend();
			}
		}

		//	Only suspend only works if the screen HAS a suspend
		if (options.allowOnlySuspend && this.screenSuspend)
			return;

		//	Now deactivate
		if (!this.isDeactivated)
		{
			this.isDeactivated = true;
			if (this.screenDeactivate)
			{
				this.screenDeactivate();
			}
		}	
	};

	/// Activate this screen if is is not already active
	rat.ui.Screen.prototype.activate = function ()
	{
		if (this.isDeactivated)
		{
			this.isDeactivated = false;
			if (this.screenActivate)
			{
				this.screenActivate();
			}
		}

		//	Don't forget to resume
		if (this.isSuspended)
		{
			this.isSuspended = false;
			if (this.screenResume)
			{
				this.screenResume();
			}
		}
	};

	rat.ui.Screen.prototype.setModal = function (isModal)
	{
		this.modal = isModal;
	};
	rat.ui.Screen.prototype.isModal = function ()
	{
		return this.modal;
	};

	rat.ui.Screen.prototype.setAllowClickAway = function (allowClickAway)
	{
		this.allowClickAway = allowClickAway;
	};
	rat.ui.Screen.prototype.setAllowBackClose = function (allowBackClose)
	{
		this.allowBackClose = allowBackClose;
	};

	//	expand me to full screen display
	rat.ui.Screen.prototype.expandToDisplay = function ()
	{
		this.setPos(0, 0);
		this.setSize(rat.graphics.SCREEN_WIDTH, rat.graphics.SCREEN_HEIGHT);
	};
	
	//	center me in full screen display
	rat.ui.Screen.prototype.centerInDisplay = function ()
	{
		var size = this.getSize();
		var x = Math.floor((rat.graphics.SCREEN_WIDTH - size.w)/2);
		var y = Math.floor((rat.graphics.SCREEN_HEIGHT - size.h)/2);
		this.setPos(x, y);
	};
	
	//	position me in standard good spot for popup (top 1/3 of screen)
	rat.ui.Screen.prototype.centerHighInDisplay = function ()
	{
		var size = this.getSize();
		var x = Math.floor((rat.graphics.SCREEN_WIDTH - size.w)/2);
		var y = Math.floor((rat.graphics.SCREEN_HEIGHT - size.h)/3);
		this.setPos(x, y);
	};

	//	For convenience, this function will create a colored background.
	rat.ui.Screen.prototype.setBackground = function (color)
	{
		//	background
		var back = new rat.ui.Shape(rat.ui.squareShape);
		back.setColor(color);
		this.appendSubElement(back);
		back.autoSizeToParent();

		this.screenBackground = back;
	};
	//	for convenience, set the screen background's frame size and color
	rat.ui.Screen.prototype.setBackgroundFrame = function (frameWidth, frameColor)
	{
		if (this.screenBackground)
			this.screenBackground.setFrame(frameWidth, frameColor);
	};

	//	Save the current target.
	rat.ui.Screen.prototype.saveCurrentTarget = function () {
		if (this.inputMap) {
			this.savedTarget = this.inputMap.map[this.inputMap.index];
		}
	};

	//	Restore the saved target (if there isn't one, select the first)
	rat.ui.Screen.prototype.restoreSavedTarget = function () {
		if (!this.inputMap)
			return;
		var index = 0;
		var saved = this.savedTarget;
		this.savedTarget = void 0;
		if (saved) {
			var map = this.inputMap.map;
			for (var testIndex = 0; testIndex !== map.length; ++testIndex) {
				if (map[testIndex] === saved) {
					index = testIndex;
					break;
				}
			}
		}
		this.inputMap.focusButton(index, true);
	};

	rat.ui.Screen.prototype.handleUIInput = function (event)
	{
		function isUIDirection(which)
		{
			if (which === 'up' || which === 'down' || which === 'left' || which === 'right' || which === 'enter')
				return true;
			else
				return false;
		}

		//console.log("screen ui " + event.which);

		//	See if we have an input map.  If so, let's behave like a screen.
		//	TODO:  We're ignoring ratInputIndex here?
		//	and what's up with targets here?
		//	only give inputMap UI navigation events, and only directions.
		//	we handle 'enter' key presses ourselves in button event handling code.
		if (this.inputMap && event.eventType === 'ui' && isUIDirection(event.which))
		{
			//	KLUDGE:  This is temp... translate 'enter' to 'select'
			//	note that I'm going to remove that entirely from this solution, as soon as I have targeting working,
			//	since I want that to be handled elsewhere.
			if (event.which === 'enter')
				event.which = 'select';
			return this.inputMap.handleDirection(event.which);
		} else if (event.which === 'back' && this.allowBackClose)
		{
			rat.screenManager.popScreen();
			return true;    //  handled (closed)
		}
		return false;
	};

	var targetList;
	function addToList()
	{
		//	OK to use "this" here?  this function is being called with "call", so it should be OK.
		//	Seems to work.
		var el = this;
		if (el.canBeTarget && el.isEnabled() && el.isVisible())
		{
			var entry = {
				globalPos: el.getGlobalPos(),
				rect: el.getBounds(el.tempRect),
				el: el
			};
			entry.pos = {
				x: entry.globalPos.x + entry.rect.w / 2,
				y: entry.globalPos.y + entry.rect.h / 2,
			};
			targetList.push( entry );
		}
	}

	//	do a single pass looking for best option in one direction.
	function singlePass(skipIndex, startPos, skipMe, searchAngleRatio, dir, directionPreference)
	{
		var bestDist = 0;
		var bestIndex = -1;
		var arcSize = 1 / searchAngleRatio;
		for (var i = 0; i !== targetList.length; ++i)
		{
			//	don't target self?
			if (skipMe && i === skipIndex)
				continue;

			var e = targetList[i];
			var tpos = e.pos;

			var dx = tpos.x - startPos.x;
			var dy = tpos.y - startPos.y;
			var arcSizeDy = (dy < 0 ? -dy : dy) * arcSize;
			var arcSizeDx = (dx < 0 ? -dy : dx) * arcSize;

			//	this value is somewhat arbitrary - it narrows the size of our arc,
			//	by increasing the opposite direction we're competing against...
			//	arcSize 1 = 45-degree angle, 2 = narrow
			//	so, convert from "searchAngleRatio" to arcSize
			if ( (dir === 'right' && dx > 0 && dx > arcSizeDy) ||
				 (dir === 'left' && dx < 0 && -dx > arcSizeDy) ||
				 (dir === 'down' && dy > 0 && dy > arcSizeDx) ||
				(dir === 'up' && dy < 0 && -dy > arcSizeDx) )
			{
				//	experiment:  I don't want to narrow the arc too tight and eliminate buttons,
				//	but let's give a higher weight to the x/y value that matches the direction we're looking,
				//	e.g. if we're looking left, count x values as closer than y values.
				//	e.g. if directionPreference is 2, then we count aligned directions twice as strongly
				//	Initial tests are good.  This is an effective approach.
				if (dir === 'right' || dir === 'left')
					dx /= directionPreference;
				else
					dy /= directionPreference;

				var dist2 = dx * dx + dy * dy;
				if (bestIndex < 0 || dist2 < bestDist)
				{
					bestIndex = i;
					bestDist = dist2;
				}
			}
		}

		return bestIndex;
	}

	function findNearestTargetInDirection(skipIndex, pos, dir, searchAngleRatio, directionPreference, wrapHoriz, wrapVert, screen)
	{
		//	do our first pass normally - look from where we are in the given direction.
		var bestIndex = singlePass(skipIndex, pos, true, searchAngleRatio, dir, directionPreference);

		//	if near button not found, and we support wrapping around,
		//	search a second time with our point reset to the appropriate opposite edge.
		if (bestIndex < 0 && (wrapHoriz || wrapVert))
		{
			//	important:  This needs to happen in global space, like everything else here,
			//	and keeping in mind the fact that the screen may not be at 0,0.
			//var screenPos = screen.getGlobalPos();
			//	hmm...  to get to opposite side, just add/subtract screen size.
			//	this puts us PAST the edge, which is good anyway, since it gives us leeway for our arc check to find things nearby,
			//	instead of starting right at the edge and not finding reasonably nearby stuff.
			//	If you do want to change that, you'll need screenPos above, to be in the right global space.

			//	Note:  This does not currently work well at all with buttons inside a big scrollview.
			//		In that case, what we really should be doing is factoring in the content size of the scrollview,
			//		but that's complicated here since we're in GLOBAL space, not parent content space, and who knows how many levels up
			//		the scrollview might be...  Find a way to fix this.

			var pos2 = { x: pos.x, y: pos.y };
			//	wrap
			if (dir === 'right' && wrapHoriz)
				pos2.x -= screen.size.x;	//	left edge
			if (dir === 'left' && wrapHoriz)
				pos2.x += screen.size.x;	//	right edge
			if (dir === 'down' && wrapVert)
				pos2.y -= screen.size.y;	//	top edge
			if (dir === 'up' && wrapVert)
				pos2.y += screen.size.y;	//	bottom edge

			//	This is subtle, but when wrapping, this button might really be its own best target,
			//		rather than another button near it.
			//		For instance, imagine a simple aligned column of buttons...
			//		you'd want left/right wrapping to just go to the same button rather than one above/below it.
			//	So, when wrapping, allow me to be my own target, if that really does turn out best.

			//	do second (wrapped) pass
			bestIndex = singlePass(skipIndex, pos2, false, searchAngleRatio, dir, directionPreference);
		}

		//	did we get something with either pass?
		if (bestIndex >= 0)
		{
			return targetList[bestIndex].el;
		}

		return null;
	}

	//	given a bunch of elements inside this screen,
	//	build an input map automatically based on positions.
	//	Notable issues: the positioning relies on e.size,
	//		so if an element's size is image-based,
	//		and the image has not yet fully loaded by the time this function
	//		is called, the size ends up being 0,0 and causing issues
	rat.ui.Screen.prototype.autoBuildInputMap = function (wrapHoriz, wrapVert, searchAngleRatio, directionPreference)
	{
		var screen = this;
		this.inputMap = null;
		
		if (!this.subElements)	//	no controls at all, don't bother
			return;
		
		//	some argument defaults
		if (wrapHoriz === void 0)
			wrapHoriz = true;
		if (wrapVert === void 0)
			wrapVert = true;
		if (searchAngleRatio === void 0)
			searchAngleRatio = 1;	//	see below - specify a large searchAngleRatio to allow nearby buttons to be tested at all.
		if (directionPreference === void 0)
			directionPreference = 2;	//	see below
		
		//	build target list first, recursively.
		targetList = []; // This is a hidden variable so it can be exposed to other functions in this file
	
		this.applyRecursively(addToList,targetList);
		if (targetList.length <= 0)
			return;
			
		
		
		//	now check each control, looking for up/left/right/down controls.
		var map = [];
		for (var i = 0; i < targetList.length; i++)
		{
			var e = targetList[i];
			var entry = {currObj : e.el};
			var pos = e.pos;//getGlobalPos();
			//pos.x += e.getBounds().w / 2;
			//pos.y += e.getBounds().h / 2;
			
			entry.up = findNearestTargetInDirection(i, pos, 'up', searchAngleRatio, directionPreference, wrapHoriz, wrapVert, screen);
			entry.down = findNearestTargetInDirection(i, pos, 'down', searchAngleRatio, directionPreference, wrapHoriz, wrapVert, screen);
			entry.left = findNearestTargetInDirection(i, pos, 'left', searchAngleRatio, directionPreference, wrapHoriz, wrapVert, screen);
			entry.right = findNearestTargetInDirection(i, pos, 'right', searchAngleRatio, directionPreference, wrapHoriz, wrapVert, screen);
			
			map.push(entry);
			
			//console.log("map " + i);
			//console.log(entry);
		}
		//	create that input map (and try to guess at correct default)
		var defaultItem = -1;
		if (rat.input.useLastUIInputType && (rat.input.lastUIInputType === 'keyboard' || rat.input.lastUIInputType === 'controller'))
			defaultItem = 0;
		this.inputMap = new rat.InputMap(map, defaultItem);
		
		/*
		//	for now, let's pretend they're vertical, just to get things going!
		//	reference:
		//  var buttonBack = { currObj: this.backButton, down: this.adsButton, right: this.adsButton }
		//  var buttonAds = { currObj: this.adsButton, up: this.backButton, left: this.backButton }
		//  var map = [buttonBack, buttonAds]

		var map = [];
		for (var i = 0; i < targetList.length; i++)
		{
			var up = null;
			var down = null;
			if (i > 0)
				up = targetList[i-1];
			else
				up = targetList[targetList.length-1];
			if (i < targetList.length-1)
				down = targetList[i+1];
			else
				down = targetList[0];
			var entry = {currObj : targetList[i], up: up, down: down};
			map.push(entry);
		}
		this.inputMap = new rat.InputMap(map, -1);
		*/

		targetList = void 0;

		return this.inputMap;
	};

	//	OK, here's some trickiness.
	//	Until we have a functional "target" system, I'm going to do this.
	//	Look for a scroll view inside this screen.  Is there one?  If so, send mouse wheel events to that.  :)
	//	If you need different behavior in your screen, just override this function.
	rat.ui.Screen.prototype.handleMouseWheel = function (event)
	{
		var found = this.applyRecursively(function ()
		{
			if (this.elementType === 'scrollView')
				return this;
			return false;
		});

		if (found)
			return found.handleMouseWheel(event);
		return false;
	};
});
//----------------------------
//	ScrollView UI Element
//
//		A UI element for showing a scissored (cropped) view of possibly scrolled content.
//		handles user interaction (clicking and dragging to scroll, events from attached scrollbar (to be implemented)), etc.
//
//	works off of basic content scroll support in Element (see r_ui.js, and the "contentOffset" field in standard elements).
//	In fact, if you want a non-interactive view that clips and scrolls, you can use a standard Element instead,
//		and set clipping true.
//
//	todo: momentum, fling... are these done?
//
//	todo: zoom (with mouse wheel and pinch support)
//
//	TODO:  Offscreen and Dirty support?  Tricky...
//
rat.modules.add( "rat.ui.r_ui_scrollview",
[
	{name: "rat.ui.r_ui", processBefore: true },
	{name: "rat.utils.r_utils", processBefore: true },
	
	"rat.math.r_math",
	"rat.math.r_vector",
	"rat.graphics.r_graphics",
	"rat.debug.r_console",
	"rat.os.r_system",
], 
function(rat)
{
	/**
	 * @constructor
	 * @extends rat.ui.Element
	*/
	rat.ui.ScrollView = function ()
	{
		rat.ui.ScrollView.prototype.parentConstructor.call(this); //	default init
		this.setClip(true);	//	scroll views aren't very interesting unless they clip
		this.lastMousePos = new rat.Vector(0, 0);
		this.grabPos = new rat.Vector(0, 0);
		this.grabOffset = new rat.Vector(0, 0);
		//	sensitivity is number of pixels per scrollWheel unit.  1 is never useful, so I'm setting it to something higher just as a guess as to what will be useful
		//	Most UI designers will want to change this (which they can do directly)
		this.wheelSensitivity = 32;
		this.wheelAffects = 'y';	//	default to wheel scrolling vertically.
		this.allowPinchZoom = false;	//	allow zoom (e.g. pinch to zoom)
		//	todo: pinch zoom tracking values.
		//		do pinch zoom/scroll like chrome does on mobile.  It's pretty slick.
		//		you can add finger touches on the fly and it handles it nicely.

		//this.allowDrag = true;

		//	fling handling
		this.allowFling = true;
		this.flingMouse = {x:0, y:0};
		this.flingTrack = [];
		for (var i = 0; i < rat.ui.ScrollView.flingTrackFrames; i++)
			this.flingTrack[i] = {x:0, y:0};
		this.flingTrackIndex = 0;
		this.flingVelocity = {x:0, y:0};
	};
	rat.utils.inheritClassFrom(rat.ui.ScrollView, rat.ui.Element);
	rat.ui.ScrollView.flingTrackFrames = 4;
	
	//	default values for scrollview objects
	rat.ui.ScrollView.prototype.elementType = "scrollView";
	
	//	drag interpretation thresholds.
	//	These default values are not super useful
	//		the appropriate thresholds depend on resolution, gui scale, size of view, desired user experience, etc.
	//		most games should override these. (like:  myView.minimumDragThreshold = 50;)
	rat.ui.ScrollView.prototype.minimumDragThreshold = 10;	//	how far before we even respect drag attempt
	rat.ui.ScrollView.prototype.meaningfulDragThreshold = 15;	//	how far before we tell everybody else we got this
	
	//	a quick way to do standard wheel-zooming support
	rat.ui.ScrollView.prototype.supportZoom = function ()
	{
		this.wheelAffects = 'z';
		this.wheelSensitivity = 0.1;
		this.allowPinchZoom = true;
	};

	//	Scroll view handle mouse wheel
	rat.ui.ScrollView.prototype.handleMouseWheel = function (event)
	{
		if (this.wheelAffects === 'y' || this.wheelAffects === 'x')
		{
			if (this.wheelAffects === 'y')
				this.contentOffset.y += event.wheelDelta * this.wheelSensitivity;
			else
				this.contentOffset.x += event.wheelDelta * this.wheelSensitivity;
			//console.log("scroll " + this.wheelEventsThisFrame);

			//	Make sure we haven't moved outside actual content
			this.clampScroll();
			return true;	//	handled
			
		} else if (this.wheelAffects === 'z')	//	zoom
		{
			var deltaScale = event.wheelDelta * this.wheelSensitivity;
			
			this.stepZoomAnchored(deltaScale, this.mousePos);
			
			return true;
		}
		
		return false;
	};
	
	//	Zoom using an anchor point in CONTENT space.
	//	todo: move to rat.ui.Element?
	rat.ui.ScrollView.prototype.stepZoomAnchored = function(deltaScale, anchorPos)
	{
		//	Factor in position of mouse, and scroll to account for that.
		//	so we zoom like google maps and supreme commander - focusing on mouse position.
		//	The basic idea is we want the mouse to be pointing at the sme spot (in content space) when we're done.
		//	So, the easy way to do this is to remember where we were pointing, in content space,
		//	and figure out how much that content-space point moved when we scaled.
		//	deltaX = oldX * newScal - oldX * oldScale
		//	It's stupid, but it took me hours to work out.  :(
		
		//	Another problem is that we may be in the middle of a scroll at the same time,
		//	and not only will parentToLocalContentPos below give the wrong target value,
		//	but also the direct setting of offset below will be bogus, since a scroller is actively
		//	changing that value...
		//	Anyway... since we don't animate zoom right now anyway,
		//	let's just kill any scrollers we had going...  :)
		//	also, let's jump to the target immediately, so that effort wasn't lost.
		//	todo: when animated zoom is implemented, redo this.
		var targetOffset = this.getTargetContentOffset();
		this.contentOffset.x = targetOffset.x;
		this.contentOffset.y = targetOffset.y;
		rat.ui.killAnimatorsForElement(this, rat.ui.Animator.scroller);
		
		if (!anchorPos)
		{
			//	use whatever center of view currently points at.
			anchorPos = this.parentToLocalContentPos(this.place.pos.x + this.size.x / 2, this.place.pos.y + this.size.y / 2);
		}
		//	these are in pure local content space coordinates
		var oldX = anchorPos.x;
		var oldY = anchorPos.y;
		
		//	remember our old scale
		var oldZoomX = this.contentScale.x;
		var oldZoomY = this.contentScale.y;
		
		//	do the zoom
		this.stepZoom(deltaScale);
		
		//	and adjust offset (which is in pixels in parent space, I think)
		this.contentOffset.x -= oldX * this.contentScale.x - oldX * oldZoomX;
		this.contentOffset.y -= oldY * this.contentScale.y - oldY * oldZoomY;
		
		this.clampScroll();
	};

	//	todo: move this last pos current pos tracking stuff up to element level?
	//	could be useful for lots of classes
	//	todo: move scroll limits to element class, too?

	//	mouse down
	//	pos is in local space
	rat.ui.ScrollView.prototype.mouseDown = function (pos)
	{
		if (!this.isEnabled())
			return;

		//	all this logic in this function and related functions happens in parent space.
		//	I'm not sure why, but it seemed like a good idea at the time, and probably is.
		//	so, since mouseDown is in local space, convert to parent space for dealing with later
		this.lastMousePos.x = pos.x + this.place.pos.x;	//	last known mouse pos
		this.lastMousePos.y = pos.y + this.place.pos.y;
		this.grabPos.x = pos.x + this.place.pos.x;	//	starting grab point
		this.grabPos.y = pos.y + this.place.pos.y;
		this.grabOffset.x = this.contentOffset.x;	//	remember what offset we had when we first grabbed
		this.grabOffset.y = this.contentOffset.y;
		//console.log("grab " + this.grabPos.x + "," + this.grabPos.y);
		//console.log("  graboff " + this.grabOffset.x +"," +this.grabOffset.y);
		
		//	reset fling tracking
		this.flingMouse.x = rat.mousePos.x;
		this.flingMouse.y = rat.mousePos.y;
		this.flingVelocity.x = this.flingVelocity.y = 0;
		for (var i = 0; i < rat.ui.ScrollView.flingTrackFrames; i++)
			this.flingTrack[i].x = this.flingTrack[i].y = 0;
		
		rat.ui.ScrollView.prototype.parentPrototype.mouseDown.call(this, pos);	//	inherited behavior
	};

	//	mouse up
	//	called whether the mouseup happened in this element or not,
	//	in case we were tracking the mouse.
	//	pos is in local space
	rat.ui.ScrollView.prototype.mouseUp = function (pos)
	{
		var wasTracking = (this.flags & rat.ui.Element.trackingMouseDownFlag) !== 0;
		
		var handled = rat.ui.ScrollView.prototype.parentPrototype.mouseUp.call(this, pos);	//	inherited behavior
		
		//	apply fling
		if (wasTracking && this.allowFling)
		{
			//	calculate average of last few frames
			this.flingVelocity.x = this.flingVelocity.y = 0;
			for (var i = 0; i < rat.ui.ScrollView.flingTrackFrames; i++)
			{
				this.flingVelocity.x += this.flingTrack[i].x;
				this.flingVelocity.y += this.flingTrack[i].y;
			}
			this.flingVelocity.x /= rat.ui.ScrollView.flingTrackFrames;
			this.flingVelocity.y /= rat.ui.ScrollView.flingTrackFrames;
			var MAX_FLING_VEL = 2000;
			if (this.flingVelocity.x > MAX_FLING_VEL)
				this.flingVelocity.x = MAX_FLING_VEL;
			if (this.flingVelocity.x < -MAX_FLING_VEL)
				this.flingVelocity.x = -MAX_FLING_VEL;
			if (this.flingVelocity.y > MAX_FLING_VEL)
				this.flingVelocity.y = MAX_FLING_VEL;
			if (this.flingVelocity.y < -MAX_FLING_VEL)
				this.flingVelocity.y = -MAX_FLING_VEL;
				
			//console.log("fling! " + this.flingVelocity.x);
		}
		
		//	"handled" is better determined by parent function, which checks where mouseup happened.
		return handled;
	};

	//
	//	Handle mouse move, including passing to sub elements.
	//	This is a good time to track dragging.
	//	pos is in parent coordinates
	//
	rat.ui.ScrollView.prototype.handleMouseMove = function (newPos, handleLeaveOnly, ratEvent)
	{
		//	inherited normal func
		rat.ui.ScrollView.prototype.parentPrototype.handleMouseMove.call(this, newPos, handleLeaveOnly, ratEvent);

		if (this.flags & rat.ui.Element.trackingMouseDownFlag)
		{
			//var myBounds = this.getBounds();	//	in parent space
			//var inBounds = PointInRect(newPos, myBounds);
			//if (inBounds)
				
			var deltaX = newPos.x - this.grabPos.x;
			var deltaY = newPos.y - this.grabPos.y;
			//rat.console.log("ButtonScrollView mouse move delta = (" + deltaX + ", " + deltaY + ")");
			
			if (Math.abs(deltaX) > this.minimumDragThreshold || Math.abs(deltaY) > this.minimumDragThreshold)
			{
				//	figure out offset from original grabPos
				//	and set that offset directly.
				
				var offsetX = this.grabOffset.x + deltaX;
				var offsetY = this.grabOffset.y + deltaY;
				//console.log("scroll " + offsetX + "," + offsetY);

				this.contentOffset.x = offsetX;
				this.contentOffset.y = offsetY;

				//	todo: that bouncy snap thing when you try to drag a scrolly view past its content edges
				this.clampScroll();
				
				//	now, adjust lastmousepos only to match dx and dy,
				//	so we lock where the source position is in the scrollview and I know that made no sense but trust me it's good...
				this.lastMousePos.x = newPos.x;
				this.lastMousePos.y = newPos.y;
			}
			
			//	if we're being dragged, then we don't want any of our subelements,
			//	like buttons, to keep tracking this set of inputs, since it's obviously
			//	a scrollview drag.
			//	This is the behavior that used to be in buttonScrollView,
			//	but that was lame to have a whole module and class for this little bit of functionality.
			
			var threshold = this.meaningfulDragThreshold;
			if (Math.abs(deltaX) > threshold || Math.abs(deltaY) > threshold)
			{
				//console.log("canceling mouse tracking for scrollview drag with thresh " + threshold);
				// Call the stopMouseTrackingRecurse() function for all subelements of the scroll view.
				this.callForSubElements(stopMouseTrackingRecurse);
			}
		}
	};
	
	// Function for canceling mouse tracking state.
	//	(used above)
	//	todo: move to rat element class?  Generally useful?
	function doStopMouseTracking(){
		var elem = this;
		// Disable then re-enable the element.
		//	This results in lots of flags being cleared, including tracking, highlight, pressed, etc.
		// Kind of dumb, but maybe better than mucking around with internal flags?
		if (elem.isEnabled())
		{
			elem.setEnabled(false);
			elem.setEnabled(true);
		}
		//	and support a custom function to handle this case, as well, if anyone wants it.
		if (elem.stopMouseTracking)
			elem.stopMouseTracking();
	}
	// Function used for recursion
	function stopMouseTrackingRecurse(){
		doStopMouseTracking.call(this);
		this.callForSubElements(stopMouseTrackingRecurse);
	}
	
	//
	//	Update every frame.  A good time to handle animation,
	//	particularly flinging.
	//
	rat.ui.ScrollView.prototype.updateSelf = function (dt)
	{
		//	get info about mouse velocity.
		if (this.allowFling)
		{
			if (this.flags & rat.ui.Element.trackingMouseDownFlag)
			{
				//	in case a mouseup is coming, track velocity for fling.
				//	average over several frames, but only a few.
				//	If the user comes to a stop and lets up, we want no velocity...
				var newPos = rat.mousePos;
				
				var dx = (newPos.x - this.flingMouse.x) / dt;
				var dy = (newPos.y - this.flingMouse.y) / dt;
				this.flingMouse.x = newPos.x;
				this.flingMouse.y = newPos.y;
				
				var spot = this.flingTrackIndex;
				this.flingTrack[spot].x = dx;
				this.flingTrack[spot].y = dy;
				this.flingTrackIndex = (spot + 1) % rat.ui.ScrollView.flingTrackFrames;
				
			//	if mouse NOT down, and we did have fling info, do fling movement update
			} else if (this.flingVelocity.x !== 0 || this.flingVelocity.y !== 0) {
				
				//console.log("dx " + this.flingVelocity.x);
				
				//	scroll directly
				this.contentOffset.x += this.flingVelocity.x * dt;
				this.contentOffset.y += this.flingVelocity.y * dt;
				
				this.clampScroll();
				
				//	this number controls how far a fling coasts...
				var decay = dt * 3000;	//	todo: make this configurable?
				//	decay velocity
				if (this.flingVelocity.x < 0)
				{
					this.flingVelocity.x += decay;
					if (this.flingVelocity.x > 0)
						this.flingVelocity.x = 0;
				} else if (this.flingVelocity.x > 0)
				{
					this.flingVelocity.x -= decay;
					if (this.flingVelocity.x < 0)
						this.flingVelocity.x = 0;
				}
				if (this.flingVelocity.y < 0)
				{
					this.flingVelocity.y += decay;
					if (this.flingVelocity.y > 0)
						this.flingVelocity.y = 0;
				} else if (this.flingVelocity.y > 0)
				{
					this.flingVelocity.y -= decay;
					if (this.flingVelocity.y < 0)
						this.flingVelocity.y = 0;
				}
			}
		}
		
		//rat.ui.ScrollView.prototype.parentPrototype.updateSelf.call(this, dt);	//	inherited behavior (there isn't one!)
	};
	
	//	old variant name
	rat.ui.ButtonScrollView = rat.ui.ScrollView;
	
});


//	Particle system
//
//	Basic idea:
//		particle systems are objects, so you can have more than one particle system in existence.
//		system contains emitters
//		emitters manage particles
//
//

//	TO DO:
//		* finish start/various/end state blending ideas
//		* allow user to tag emitters for later debugging or finding?
//		* general tag system - in fact, just assume everything has a "tag" variable?  no need for special per-class code.
//		* once we know the type of an emitter, set its draw function so we don't do branching in draw loop,
//			though this will have function call overhead
//		* custom draw function (combined with the above)
//		* specific support for flashups (text? or any type?) (dedicated emitter, created if needed?)
//		* for particles that are not changing color each frame, store color in string form so we don't convert every time we draw.
//			that's a lot of converting.
//

//	NOTE: Variance is generally assumed to be +/- value.
//	e.g. a variance of 10 means from -10 to +10
rat.modules.add( "rat.graphics.r_particle",
[
	{name: "rat.math.r_math", processBefore: true},
	
	"rat.debug.r_console",
	"rat.debug.r_profiler",
	"rat.graphics.r_graphics",
	"rat.math.r_vector",
	"rat.graphics.r_image"
], 
function(rat)
{
	var math = rat.math;
	//var clamp = math.clamp;
	//var Interp = math.interp;
	var RandomVariance = math.randomVariance;
	
	rat.particle = {
		systems: [],
		stateCaching: {
			enabled: true,		//	Will rat cache the particle state objects
			minObjectCount: 0,	// If caching state objects, the system will create this number of state objects to populate the cached when you launch the game
			createPerFrame: 0	// If rat is trying to meet the minObjectCount for the state objects, how many will we create per frame.  0 = all.  If not zero, rat.cycleUpdate is required
		},
	};

	//===============================================
	//------------- particle systems ----------------
	//===============================================

	/**
	 * @constructor
	 */
	rat.particle.System = function (options)	//	constructor for particle system
	{
		this.options = options;
		this.emitters = [];
	};

	//	Some event style callbacks for adding an emitter, removeing an emitter and creating an emitter
	rat.particle.System.prototype.onRemoveEmitter = void 0;
	rat.particle.System.prototype.onAddEmitter = void 0;
	rat.particle.System.prototype.emitterConstructor = void 0;

	//	particle system constants
	rat.particle.System.infinite = -1;
	rat.particle.System.statusDead = 0;
	rat.particle.System.statusActive = 1;
	rat.particle.System.statusAlive = 1;

	rat.particle.System.emitTypeUnknown = 0;
	rat.particle.System.emitTypeSingle = 1;
	rat.particle.System.emitTypeBurst = 2;
	rat.particle.System.emitTypeStream = 3;

	rat.particle.System.killParticles = true;	//	argument to killAllEmitters() below

	rat.particle.System.RENDER_UNKNOWN = 0;	//	hasn't been correctly set up yet.
	rat.particle.System.RENDER_DOT = 1;
	rat.particle.System.RENDER_TRIANGLE = 2;
	rat.particle.System.RENDER_BOX = 3;
	rat.particle.System.RENDER_SPRITE = 4;
	rat.particle.System.RENDER_TEXT = 5;
	rat.particle.System.RENDER_CUSTOM = 10;

	//-------------
	//	create new emitter in this system
	rat.particle.System.prototype.newEmitter = function ()
	{
		var Ctor = this.emitterConstructor || rat.particle.Emitter;
		var emitter = new Ctor();
		this.emitters.push(emitter);
		if (this.options && this.options.trackBounds)
			emitter.trackBounds = this.options.trackBounds;
		
		//alert("ecount: " + this.emitters.length);
		if (this.onAddEmitter)
			this.onAddEmitter(emitter);
		return emitter;
	};

	//-------------
	//	return total emitter count in this system
	rat.particle.System.prototype.getEmitterCount = function ()
	{
		return this.emitters.length;
	};

	//-------------
	//	kill all emitters in this system
	rat.particle.System.prototype.killAllEmitters = function (killParticles)
	{
		if(killParticles === void 0)
			killParticles = true;	//	let's assume you usually want to clear everything out...
		for(var i = this.emitters.length - 1; i >= 0; i--)
		{
			this.emitters[i].die(killParticles);
		}
	};

	//-------------
	//	kill all particles in this whole system without killing the emitters.
	//	e.g. if they're still emitting, there will be more soon.
	//	NOTE:  You might want killAllEmitters() above, instead.
	rat.particle.System.prototype.killAllParticles = function ()
	{
		for(var i = this.emitters.length - 1; i >= 0; i--)
		{
			this.emitters[i].killAllParticles();
		}
	};

	//-------------
	//	move this emitter to the top visually (last in list)
	rat.particle.System.prototype.moveEmitterToTop = function (emitter)
	{
		for(var i = this.emitters.length - 1; i >= 0; i--)
		{
			if(this.emitters[i] === emitter)
			{
				this.emitters.splice(i, 1);
				this.emitters.push(emitter);
				return;
			}
		}
	};
	
	//-------------
	//	remove this emitter from the system.
	//	Note that you generally want something else, like to mark an emitter as dead.
	//	This is a specialized function for yanking an emitter out of the system (not deleting it)
	//	useful for things like storing it and putting it back in later, or putting it in another system.
	rat.particle.System.prototype.removeEmitter = function (emitter)
	{
		for(var i = this.emitters.length - 1; i >= 0; i--)
		{
			if(this.emitters[i] === emitter)
			{
				if (this.onRemoveEmitter)
					this.onRemoveEmitter(this.emitters[i]);
				this.emitters.splice(i, 1);
				return;
			}
		}
	};
	
	//-------------
	//	Explicitly append this existing emitter to this system's list.
	//	This is a specialized function that assumes correct creation of the emitter.
	//	Generally, you want newEmitter() instead.
	rat.particle.System.prototype.appendEmitter = function (emitter)
	{
		this.emitters.push(emitter);
		if (this.onAddEmitter)
			this.onAddEmitter(emitter);
	};

	//-------------
	//
	//	Update all emitters in this system
	//
	rat.particle.System.prototype.update = function (dt)
	{
		rat.profiler.pushPerfMark("PSystem:Update");
		for(var i = this.emitters.length - 1; i >= 0; i--)
		{
			var status = this.emitters[i].update(dt);
			if(status === rat.particle.System.statusDead)
			{
				this.emitters[i].destroy();
				if (this.onRemoveEmitter)
					this.onRemoveEmitter(this.emitters[i]);
				this.emitters.splice(i, 1);
			}
		}
		rat.profiler.popPerfMark("PSystem:Update");
	};

	//-------------
	//	Render this entire particle system, all emitters and particles.
	rat.particle.System.prototype.draw = function (options)
	{
		rat.profiler.pushPerfMark("PSystem:draw");
		var useCtx;
		if (options && options.ctx)
			useCtx = options.ctx;
		else
			useCtx = rat.graphics.getContext();
		var oldCtx = rat.graphics.getContext();
		rat.graphics.setContext(useCtx);
		rat.graphics.save({ ignoreRatMat: true });
		
		for(var i = 0; i < this.emitters.length; i++)
		{
			this.emitters[i].draw(useCtx);
		}
		
		rat.graphics.restore();
		rat.graphics.setContext(oldCtx);
		rat.profiler.popPerfMark("PSystem:draw");
	};
	
	//-------------
	//	translate all my emitter bounds to rectangle list (e.g. dirtyRects list) info.
	rat.particle.System.prototype.applyBoundsToRectList = function(rectList)
	{
		for(var i = 0; i < this.emitters.length; i++)
		{
			var e = this.emitters[i];
			if (e.trackBounds)
			{
				//if (e.prevBounds.w > 0 && e.prevBounds.h > 0)
				//	rectList.add(e.prevBounds);
				if (e.bounds.w > 0 && e.bounds.h > 0)
					rectList.add(e.bounds);
			}
		}
	};
	//	old deprecated name
	rat.particle.System.prototype.applyToDirtyRects = rat.particle.System.prototype.applyBoundsToRectList;

	//=======================================
	//------------- emitters ----------------
	//=======================================

	//-------------
	//	emitter constructor
	//var createdEmitters = 0;
	/**
	 * @constructor
	 */
	rat.particle.Emitter = function ()
	{
		//rat.console.log( "Created " + ( ++createdEmitters ) + " Emitters!" );
		this.pos = new rat.Vector(100, 100);	//	default, should be set externally
		this.angle = new rat.Angle();	//	default create our own, may be replaced with ref to some external angle
		this.startState = rat.particle.State.create();	//	to be set up externally, we presume.
		this.startVariance = rat.particle.State.create();	//	empty, default 0 values, no variance!

		this.asset = [];
		this.stateSets = [];	//	list of states and variances {state: state, variance: variance}
		this.stateSets[0] = { state: this.startState, variance: this.startVariance };

		//	by default, end and start the same, and if one changes, change the other.  If client wants end state unique,
		//	then need to do something like myEmitter.endState = myEmitter.startState.copy() or call initEndState...
		//	Note:  this is less and less useful?  It may just be a shortcut for clients at this point.
		this.endState = this.startState;

		//	some more reasonable start values, for debugging ease, mostly, so client doesn't have to be perfect to see anything...
		//this.startState.color.setWhite();	//	includes 1.0 alpha, which is important for ease of setup
		this.startState.color.a = 1.0;
		this.startState.color.r = 255;
		this.startState.color.g = 255;
		this.startState.color.b = 255;
		this.startState.ageLimit = 1;

		//	prepare to track total bounds of my particles, if requested.
		this.prevBounds = {x : this.pos.x, y : this.pos.y, w : 0, h : 0};
		this.bounds = {x : this.pos.x, y : this.pos.y, w : 0, h : 0};
		this.trackBounds = false;	//	but assume it's not desired, yet

		this.particles = [];	//	list of particles, starting empty
	};

	//	flags for emitters
	rat.particle.Emitter.fAutoDie = 0x0001;					//	auto die if we're ever out of particles
	rat.particle.Emitter.fAutoDieAfterAgeLimit = 0x0004;	//	after hitting age limit, set autodie flag (probably usually desired, if age limit)
	rat.particle.Emitter.fRadialStartVelocity = 0x0008;		//	start velocity is radial instead of x/y
	rat.particle.Emitter.fRadialStartOffset = 0x0010;		//	start position offset is radial distance instead of x/y
	rat.particle.Emitter.fEmitting = 0x0100;				//	start/stop emitting
	rat.particle.Emitter.fEmitImmediately = 0x0200;			//	start timer advanced to emit point
	rat.particle.Emitter.fStroke = 0x0800;					//	text: stroke
	rat.particle.Emitter.fGlobalVelocity = 0x1000;			//	global velocity for initial particles, not emitter relative
	rat.particle.Emitter.fGlobalOffset = 0x2000;			//	global offset for initial particle position, not emitter relative

	// Initial state of emitters.   ONLY PUT VALUES THAT ARE COPIED BY VALUE, NOT REFERENCE(like objects)
	rat.particle.Emitter.prototype.flags = rat.particle.Emitter.fEmitting;	// behavior flags: by default, no autodie, etc.
	rat.particle.Emitter.prototype.emitType = rat.particle.System.emitTypeStream;
	rat.particle.Emitter.prototype.renderType = rat.particle.System.RENDER_UNKNOWN;	//	by default, render boxes
	rat.particle.Emitter.prototype.rate = 10.0;		//	emit/burst per second (default, should be set externally)
	rat.particle.Emitter.prototype.burstCount = 1;	//	for burst types, how many times to burst, usually 1
	rat.particle.Emitter.prototype.burstAmount = 0;	//	for burst types, how much to burst at once
	rat.particle.Emitter.prototype.emitCounter = 0;	//	current counter (time) to next emit time
	rat.particle.Emitter.prototype.status = rat.particle.System.statusActive;	//	start alive
	rat.particle.Emitter.prototype.ageLimit = rat.particle.System.infinite;	//	emitter last forever by default
	rat.particle.Emitter.prototype.age = 0;	//	current age (time)
	rat.particle.Emitter.prototype.font = "";
	rat.particle.Emitter.prototype.fontSize = 0;
	rat.particle.Emitter.prototype.createEvent = null;	//	event (function) to call for each particle on create:  f(emitter, particle)
	rat.particle.Emitter.prototype.updateEvent = null;	//	event (function) to call for each particle on update
	rat.particle.Emitter.prototype.deathEvent = null;		//	event (function) to call for each particle on death
	rat.particle.Emitter.prototype.customDraw = null;		//	function to call to draw particle, if type is set to CUSTOM
	rat.particle.Emitter.prototype.isReadyForUse = false;//	so we know to do some optimizations/calculations before using for the first time

	//-------------
	//	set/clear flags
	rat.particle.Emitter.prototype.setFlag = function (flag)
	{
		this.flags |= flag;
	};
	rat.particle.Emitter.prototype.clearFlag = function (flag)
	{
		this.flags &= ~flag;
	};
	rat.particle.Emitter.prototype.isFlag = function (flag)
	{
		return ((this.flags & flag) !== 0);
	};

	//-------------
	//	start/stop emitting
	rat.particle.Emitter.prototype.startEmitting = function ()
	{
		this.setFlag(rat.particle.Emitter.fEmitting);
	};
	rat.particle.Emitter.prototype.stopEmitting = function ()
	{
		this.clearFlag(rat.particle.Emitter.fEmitting);
	};
	rat.particle.Emitter.prototype.isEmitting = function ()
	{
		return this.isFlag(rat.particle.Emitter.fEmitting);
	};

	//-------------
	//	Kill all my particles instantly.
	//	But leave me in whatever state I was in (e.g. still emitting)
	rat.particle.Emitter.prototype.killAllParticles = function ()
	{
		//	Cache the states from my particles
		if(rat.particle.stateCaching.enabled)
		{
			for(var index = 0, len = this.particles.length; index !== len; index++)
			{
				if(this.particles[index].destroy)
					this.particles[index].destroy();
			}
		}
		this.particles = [];
	};

	//-------------
	//	die - stop emitting, and delete emitter from system when particles are dead.
	//	that could be done manually by client, but this function makes it easy and obvious.
	rat.particle.Emitter.prototype.die = function (killParticles)
	{
		this.stopEmitting();
		this.setFlag(rat.particle.Emitter.fAutoDie);
		if(killParticles)
			this.killAllParticles();//	no more particles - will die next update because of autodie flag.
	};

	//-------------
	//	add an intermediate state
	//	keyTime and keyFlags can be undefined, in which case a defaults are assigned when readyForUse ends up getting called, eventually.
	//	See readyForUse() for more info.
	//	note:  keyTime here is actually an interpolation value from 0 to 1, not a literal time in seconds.
	//		also, keyTime is a START point for the given state.  state lengths are calculated automatically later.
	rat.particle.Emitter.prototype.addState = function (keyTime, keyFlags)
	{
		var newState = this.stateSets[this.stateSets.length - 1].state.copy();
		newState.keyTime = keyTime;
		newState.keyFlags = keyFlags;
		var entry = { state: newState, variance: rat.particle.State.create() };
		this.stateSets.push(entry);

		//rat.console.log("rpe: addstate " + this.stateSets.length);

		return entry;
	};

	//-------------
	//	get full initial state set with variance and key values and stuff
	rat.particle.Emitter.prototype.getInitState = function ()
	{
		return this.stateSets[0];
	};

	//-------------
	//
	//	Make the endstate different from the start state
	//	Convenience function, might make more sense to an outsider than doing things by hand.
	//
	rat.particle.Emitter.prototype.initEndState = function (keyTime, keyFlags)
	{
		var entry = this.addState(keyTime, keyFlags);
		this.endState = entry.state;
		return entry;
	};

	//-------------
	//	set up for standard burst
	rat.particle.Emitter.prototype.setupStandardBurst = function (amount)
	{
		this.emitType = rat.particle.System.emitTypeBurst;
		this.rate = 1;	//	not important for burst
		this.emitCounter = 1 / this.rate + 0.0001;	//	advance counter to do it right away at next update
		this.burstCount = 1;	//	burst once
		this.burstAmount = amount;	//	count per burst
	};

	//-------------
	//	return total number of particles being handled by this emitter
	rat.particle.Emitter.prototype.getParticleCount = function ()
	{
		return this.particles.length;
	};

	//-------------
	//	do some cleanup, calculations, etc. that can happen one time after setup and before use,
	//	to avoid doing it every frame, or on every setup call (e.g. flag setting)
	rat.particle.Emitter.prototype.readyForUse = function ()
	{
		//var	lastState;
		var state;
		var i;
		for(i = 0; i < this.stateSets.length; i++)
		{
			state = this.stateSets[i].state;

			//	put in key times if they weren't specified.
			//	These are spread evenly out, from 0 to 1.  E.g. if you have 4 keys (including start and end) you get 0.0, 0.33, 0.66, 1.0
			//	if a given key time has been specified, we leave it, and just set the others.
			if(typeof (state.keyTime) === 'undefined')
				state.keyTime = i / (this.stateSets.length - 1);	//	by default, even key times
			if(typeof (state.keyFlags) === 'undefined')
				state.keyFlags = 0;

			//	check if a numeric angle was specified...
			if(typeof(state.angle) !== 'object')
				state.angle = new rat.Angle(state.angle);
			
			//	detect if colors change over time at all.  Eventually, do this with other animated state vars.

			//	TODO:  Hmmm!  If the user sets an initial color with variance,
			//		and then doesn't want to override that calculated color later, how does he do so?  We kinda need something like "undefined" values
			//		for state variables, to mean "leave it like it is".
			//		This would apply to colors, and also things like angle.
			//			If an angle is defined in each key, then fine, interpolate (animate).  If not, then leave angle (or let it roll or whatever).

			//lastState = {state:this.state
		}
		//	check my own angle
		if(typeof(this.angle) !== 'object')
			this.angle = new rat.Angle(this.angle);

		//	calculate the length of time allocated to each key for convenience later
		//	(figure each one but the last one, which is always 0)
		for(i = 0; i < this.stateSets.length - 1; i++)
		{
			state = this.stateSets[i].state;
			state.keyTimeLength = this.stateSets[i + 1].state.keyTime - state.keyTime;
			//rat.console.log("key tl[" + i + "] " + state.keyTimeLength);
		}
		this.stateSets[this.stateSets.length - 1].state.keyTimeLength = 0;
		//	unless there's only 1 key, in which case its time length is simply 1
		if(this.stateSets.length === 1)
			this.stateSets[this.stateSets.length - 1].state.keyTimeLength = 1;
		//rat.console.log("key tl[" + (this.stateSets.length-1) + "] " + this.stateSets[this.stateSets.length-1].state.keyTimeLength);
		
		if (this.isFlag(rat.particle.Emitter.fEmitImmediately))
			this.emitCounter = 1 / this.rate + 0.0001;	//	advance counter to spawn right away on next update
		
		this.isReadyForUse = true;
	};

	//-------------
	//
	//	Update emitter, updates the emitter's particles
	//	return status.
	//
	rat.particle.Emitter.prototype.update = function (dt)
	{
		if(this.renderType === rat.particle.System.RENDER_UNKNOWN)	//	the emitter has not been set up.  Just kill it.
			return rat.particle.System.statusDead;

		var emitterStatus;

		rat.profiler.pushPerfMark("Emitter.update");

		if(!this.isReadyForUse)
			this.readyForUse();
		var i;
		
		if (this.trackBounds)
		{
			this.prevBounds = this.bounds;
			this.bounds = {x:this.pos.x, y:this.pos.y, w:0, h:0};	//	todo: hrm... set to some clearly identified "not set yet" value instead?  is pos legit here?
		}

		if(this.rate > 0 && this.isEmitting())	//	if we're emitting, handle emission at our rate
		{
			this.emitCounter += dt;
			if(this.emitCounter > 1 / this.rate)
			{
				rat.profiler.pushPerfMark("Emitting");
				//	reset counter
				this.emitCounter -= 1 / this.rate;	//	don't just set to 0, factor in how far we actually progressed
				///@todo support emitting more if the rate was faster than our DT.  Right now we're assuming 1.
				///@todo support retroactively putting the particles in the right place, retroactively, and setting their life correctly, etc...
				///@todo support applying emit rate variance every time counter is calculated again.

				//	emit, depending on type
				if(this.emitType === rat.particle.System.emitTypeStream)
				{
					this.spawnNewParticle();

				} else if(this.emitType === rat.particle.System.emitTypeBurst && this.burstCount > 0)
				{
					for(i = 0; i < this.burstAmount; i++)
					{
						this.spawnNewParticle();
					}
					this.burstCount--;
					if(this.burstCount <= 0)
					{
						this.rate = 0;	//	done with our burst count, don't burst any more
						this.stopEmitting();	//	just in case, but generally not used with burst emitters?
					}
				}
				rat.profiler.popPerfMark("Emitting");
			}
		}

		//	Update my particles, including deleting dead ones.
		rat.profiler.pushPerfMark("p.update");
		var curP;
		for (i = this.particles.length - 1; i >= 0; i--)
		{
			curP = this.particles[i];
			var status = curP.update(dt, this);
			if (status === rat.particle.System.statusDead)
			{
				if (this.deathEvent)	//	is there a registered create event function to call?
				{
					this.deathEvent(this, curP);
				}
				
				if (this.particles[i].destroy )
					this.particles[i].destroy();
				this.particles.splice(i, 1);
			} else {	//	not dead
				//	track bounds.  We could be rotated, so be generous.
				//	but rotation worst case will add sqrt(2)... or about 1.414,
				//	thus the 1.5 values below.
				//	and we subtract half that for x/y pos
				if (this.trackBounds)
				{
					this.addToBounds(curP.state.pos.x - curP.state.size*0.75, curP.state.pos.y - curP.state.size*0.75,
							curP.state.size * 1.5, curP.state.size * 1.5);
				}

				/*	this should all be handled in update() call above.
				//	this is hardcoded for now... start/end states only.
				//	heck, let's just hack colors and a few other things for now...
				var interp = curat.particle.age / curat.particle.ageLimit;
				interp = clamp(interp, 0, 1);
				curat.particle.color.a = Interp(this.startState.color.a, this.endState.color.a, interp);
			
				//	would also be nice to animate emitter values like rate...!
				//	think about more general animation systems for sets of values?  an animated keyframed set of values just spits out
				//	automatically into a new struct, and people just access the struct?  Don't overdo it... 
			
				//	update stuff
				curat.particle.angle.angle += curat.particle.roll * dt;
				*/
			}
			
		}
		rat.profiler.popPerfMark("p.update");

		///@todo	check for particle death event support
		///@todo	check for particle update event support

		//	check for emitter age death
		rat.profiler.pushPerfMark("statusUpdate");
		this.age += dt;
		//	age limit stops an emitter from emitting when it has reached this age
		if(this.ageLimit > 0 && this.age > this.ageLimit)
		{
			//this.rate = 0;	//	stop spawning
			this.stopEmitting();	//	use new flag instead so isEmitting can be used to detect this.

			if(this.flags & rat.particle.Emitter.fAutoDieAfterAgeLimit)
				this.flags |= rat.particle.Emitter.fAutoDie;	//	now, autodie when our particles are finished

			//	maybe support a flag that instantly kills on age limit?
			//return rat.particle.System.statusDead;
		}

		//	check for emitter autodeath if no particles are left.
		//	note that this happens after emitter checks above, so a newly created emitter has a chance to create particles first.
		if(this.flags & rat.particle.Emitter.fAutoDie)
		{
			if(this.particles.length <= 0)
			{
				//rat.console.log("*** autodie!");
				emitterStatus = rat.particle.System.statusDead;
			}
		}
		else
		{
			emitterStatus = rat.particle.System.statusActive;
		}
		rat.profiler.popPerfMark("statusUpdate");

		//	by default, we're still alive
		rat.profiler.popPerfMark("Emitter.update");
		return emitterStatus;
	};

	//-------------
	//
	//	Destroy this emitter
	//
	rat.particle.Emitter.prototype.destroy = function ()
	{
		this.killAllParticles();
		if(rat.particle.stateCaching.enabled)
		{
			for(var index = 0, len = this.stateSets.length; index !== len; ++index)
			{
				rat.particle.State.destroy(this.stateSets[index].state);
				rat.particle.State.destroy(this.stateSets[index].variance);
			}
			this.stateSets = [];
		}
	};

	//-------------
	//
	//	Spawn new particle from this emitter
	//
	rat.particle.Emitter.prototype.spawnNewParticle = function ()
	{
		rat.profiler.pushPerfMark("spawnNewParticle");

		var particle = new rat.particle.One();
		var asset;
		var rad;

		//	OK, let's generate this particle's various state variables right now, based on emitter's state list and variances
		var sets = this.stateSets;
		var state, base, variance;
		rat.profiler.pushPerfMark("setupStates");
		for(var i = 0, len = sets.length; i !== len; ++i)
		{

			state = rat.particle.State.create();
			//	for easy access in particle later - could use emitter's values, but this leads to shorter code
			base = sets[i].state;
			variance = sets[i].variance;

			//	build the state
			state.keyTime = base.keyTime;
			state.keyTimeLength = base.keyTimeLength;
			state.size = base.size;
			state.grow = base.grow;
			state.roll = base.roll;
			state.friction = base.friction;
			state.color.r = base.color.r;
			state.color.g = base.color.g;
			state.color.b = base.color.b;
			state.color.a = base.color.a;

			//	Handle variance of the state fields
			if(variance.size)
				state.size += (variance.size * 2 * math.random() - variance.size);
			if(variance.grow)
				state.grow += (variance.grow * 2 * math.random() - variance.grow);
			if(variance.roll)
				state.roll += (variance.roll * 2 * math.random() - variance.roll);
			if(variance.friction)
				state.friction += (variance.friction * 2 * math.random() - variance.friction);
			if(variance.color.r)
			{
				state.color.r += (variance.color.r * 2 * math.random() - variance.color.r);
				state.color.r = ((state.color.r < 0) ? 0 : ((state.color.r > 255) ? 255 : (state.color.r | 0)));
			}
			if(variance.color.g)
			{
				state.color.g += (variance.color.g * 2 * math.random() - variance.color.g);
				state.color.g = ((state.color.g < 0) ? 0 : ((state.color.g > 255) ? 255 : (state.color.g | 0)));
			}
			if(variance.color.b)
			{
				state.color.b += (variance.color.b * 2 * math.random() - variance.color.b);
				state.color.b = ((state.color.b < 0) ? 0 : ((state.color.b > 255) ? 255 : (state.color.b | 0)));
			}
			if(variance.color.a)
			{
				state.color.a += (variance.color.a * 2 * math.random() - variance.color.a);
				state.color.a = ((state.color.a < 0) ? 0 : ((state.color.a > 1) ? 1 : state.color.a));
			}

			// This state is part of the particle
			particle.states[i] = state;
		}
		rat.profiler.popPerfMark("setupStates");

		//	and set initial "now" state
		rat.profiler.pushPerfMark("initialState");
		particle.state.size = particle.states[0].size;
		particle.state.grow = particle.states[0].grow;

		// was this, but sometimes we failed to receive a proper new Color object, so setting this manually for now

		//particle.state.color.copyFrom(particle.states[0].color);
		particle.state.color.a = particle.states[0].color.a;
		particle.state.color.r = particle.states[0].color.r;
		particle.state.color.g = particle.states[0].color.g;
		particle.state.color.b = particle.states[0].color.b;

		particle.state.friction = particle.states[0].friction;
		particle.state.roll = particle.states[0].roll;

		//	Set a bunch of properties for the new particle based on emitter flags, startState, and startVariance.
		//	These properties don't animate based on keyframes - they're initialized here and modified over time with
		//	unique logic, like acceleration being gravity...

		//	start at emitter position
		//	ref...
		//particle.state.pos = new rat.Vector(this.pos.x, this.pos.y)
		//	pos already exists, and might be being tracked.  Don't create new one.
		particle.state.pos.x = this.pos.x;
		particle.state.pos.y = this.pos.y;
		//	note that emitter pos may not be a Vector, depending on client usage

		//	offset based on emitter properties
		var offset = new rat.Vector();
		if(this.flags & rat.particle.Emitter.fRadialStartOffset)	//	radial space for offset
		{
			//	find a random radial vector, and then scale it with just the X value
			rad = math.random() * math.PI2;
			offset.setFromAngle(rad);
			offset.scale(this.startState.offset.x + RandomVariance(this.startVariance.offset.x));
		} else
		{
			offset.x = this.startState.offset.x + RandomVariance(this.startVariance.offset.x);
			offset.y = this.startState.offset.y + RandomVariance(this.startVariance.offset.y);
		}
		if(!this.isFlag(rat.particle.Emitter.fGlobalOffset))
			offset = this.angle.rotateVector(offset);
		particle.state.pos.x += offset.x;
		particle.state.pos.y += offset.y;

		particle.state.angle.angle = this.angle.angle;//	start by matching emitter angle
		//	then add state settings
		particle.state.angle.angle += this.startState.angle.angle + RandomVariance(this.startVariance.angle.angle);
		//	todo: support a flag to use absolute angles instead of emitter relative?

		if(this.flags & rat.particle.Emitter.fRadialStartVelocity)	//	radial space
		{
			//	so, how do we do this?
			//	find a random radial vector, and then scale it with just the X value and x variance...?
			rad = math.random() * math.PI2;
			particle.state.vel = new rat.Vector();
			particle.state.vel.setFromAngle(rad);
			particle.state.vel.scale(this.startState.vel.x + RandomVariance(this.startVariance.vel.x));

		} else
		{	//	normal square space
			particle.state.vel = new rat.Vector(
					this.startState.vel.x + RandomVariance(this.startVariance.vel.x)
					, this.startState.vel.y + RandomVariance(this.startVariance.vel.y)
					);	//	in units (pixels) per second
		}

		particle.state.accel = new rat.Vector(
				this.startState.accel.x + RandomVariance(this.startVariance.accel.x)
				, this.startState.accel.y + RandomVariance(this.startVariance.accel.y)
				);	//	in units (pixels) per second per second

		//	rotate calculated vel to match emitter angle at this instant.
		if(!this.isFlag(rat.particle.Emitter.fGlobalVelocity))
			particle.state.vel = this.angle.rotateVector(particle.state.vel);
		//	note: do NOT rotate accel, which is assumed to be in world space, not emitter space.
		//	if we need support for that later, we can add it.  TODO:  relative accel, also radial accel!

		particle.ageLimit = this.startState.ageLimit + RandomVariance(this.startVariance.ageLimit);
		rat.profiler.popPerfMark("initialState");

		//	set up particle asset reference, e.g. sprite for sprite particles.
		//	for now, if asset hasn't loaded yet, set null asset.
		particle.asset = null;
		if(this.renderType === rat.particle.System.RENDER_SPRITE)
		{
			asset = this.asset;
			if(this.assetSpawnFunction)
			{
				asset = this.assetSpawnFunction(this);
			}

			if(Array.isArray(asset))	//	allow the emitter's asset to be a list of assets
				asset = asset[(math.random() * asset.length) | 0];

			particle.setImageAsset(asset);

		} else if(this.renderType === rat.particle.System.RENDER_TEXT)
		{
			//	for text, asset is string (or list of strings)
			asset = this.asset;
			if(Array.isArray(this.asset))
				asset = this.asset[(math.random() * this.asset.length) | 0];
			particle.text = asset;
		}

		if(this.createEvent)	//	is there a registered create event function to call?
		{
			rat.profiler.pushPerfMark("createEvent");
			var res = this.createEvent(this, particle);
			rat.profiler.popPerfMark("createEvent");
			if(res === false)
			{
				//	OK, just kidding!  don't add this to our list.  Lose it.
				rat.profiler.popPerfMark("spawnNewParticle");
				return;
			}
		}
		
		//	track space used (add to bounds)
		//	see other call to addToBounds for notes.
		if (this.trackBounds)
		{
			this.addToBounds(particle.state.pos.x - particle.state.size*0.75, particle.state.pos.y - particle.state.size*0.75,
					particle.state.size * 1.5, particle.state.size * 1.5);
		}

		//	add to my particle list
		this.particles.push(particle);

		rat.profiler.popPerfMark("spawnNewParticle");
	};
	
	//-------------
	//	util to add a point (with space) to the bounds we're tracking.
	rat.particle.Emitter.prototype.addToBounds = function (x, y, w, h)
	{
		//	faster approach to this math?  Or store differently?
		//	This seems unoptimal...
		if (x < this.bounds.x)
		{
			this.bounds.w += (this.bounds.x - x);
			this.bounds.x = x;
		}
		if (y < this.bounds.y)
		{
			this.bounds.h += (this.bounds.y - y);
			this.bounds.y = y;
		}
		if (x + w > this.bounds.x + this.bounds.w)
			this.bounds.w = x + w - this.bounds.x;
		if (y + h > this.bounds.y + this.bounds.h)
			this.bounds.h = y + h - this.bounds.y;
	};
	
	//-------------
	//	explicitly spawn N new particles from this emitter.
	rat.particle.Emitter.prototype.spawn = function (count)
	{
		if(typeof (count) === 'undefined')
			count = 1;
		for(var i = 0; i < count; i++)
		{
			this.spawnNewParticle();
		}
	};

	//	Utility function to calculate start value +/- variance for a named member of the particle structure
	//	This function accesses normal object properties by string name,
	//	which confuses the google compiler.
	//	So... let's try this a different way.  Ugh, can't come up with a better way.
	//	I'm replacing all use of this function for now... see above.
	// intead do: this.foo.startState.bar + RandomVariance(this.foo.startVariance.bar);
	//rat.particle.Emitter.prototype.startWithVar = function(field)
	//{
	//	return this.startState[field] + RandomVariance(this.startVariance[field]);
	//}

	//-------------
	//
	//	Draw my particles.
	//
	rat.particle.Emitter.prototype.draw = function (ctx)
	{
		rat.profiler.pushPerfMark("Emitter.Draw");

		if(this.preDraw)
			this.preDraw(ctx, this);
		var scale;

		//	setup that's universal for all particles
		var stroke = false;
		if(this.renderType === rat.particle.System.RENDER_TEXT)
		{
			ctx.textBaseline = 'middle';
			ctx.textAlign = 'center';
			if(this.flags & rat.particle.Emitter.fStroke)
				stroke = true;
		}

		//	actual draw for each particle
		rat.profiler.pushPerfMark("particle.Draw");
		for(var i = 0; i < this.particles.length; i++)
		{
			
			//	if this ever gets too slow, maybe collapse the draw function into this one?
			//	would make polymorphism a lot harder...  probably won't be slow.
			//	Hmm...  actually, we really should have the behavior of these particles determined by the emitter.
			//	so, the draw should be here anyway, even if it's a separate function, which may not be necessary.
			//this.particles[i].draw(ctx);

			//	context save/restore is necessary so we can rotate below and have it be relative to particle
			//	Although...  An alternative might be to rotate, and then rotate back.
			//	this context save/restore is theoretically expensive.
			//	Also, we could first test if rotate is being used?
			var p = this.particles[i];
			var ps = p.state;
			//	Bypass the rat gfx and directly access the context here.
			ctx.save();
			ctx.translate(ps.pos.x, ps.pos.y);
			
			//	temp test...
			/*
			if (ps.pos.x < this.bounds.x || ps.pos.y < this.bounds.y
				|| ps.pos.x > this.bounds.x + this.bounds.w
				|| ps.pos.y > this.bounds.y + this.bounds.h)
			{
				console.log("ugh");
			}
			*/
			
			if(ps.angle.angle)
				ctx.rotate (ps.angle.angle);
			//rat.graphics.save();
			//rat.graphics.translate(ps.pos.x, ps.pos.y, ctx);
			//if(ps.angle.angle)
			//	rat.graphics.rotate(ps.angle.angle, ctx);

			///@todo	switch this to function reference or lambda, to avoid check every time through loop...
			if(this.renderType === rat.particle.System.RENDER_BOX)
			{
				scale = ps.size;
				ctx.fillStyle = ps.color.toString();//"#6040FF";
				ctx.fillRect(-scale / 2, -scale / 2, scale, scale);

			} else if(this.renderType === rat.particle.System.RENDER_TRIANGLE)	//	maybe generic RENDER_POLYGON instead
			{
				var radius = ps.size / 2;
				var rotInc = math.PI2 / 3;	//	3 sides
				ctx.fillStyle = ps.color.toString();

				ctx.beginPath();

				ctx.moveTo(radius, 0);
				ctx.lineTo(math.cos(rotInc) * radius, math.sin(rotInc) * radius);
				ctx.lineTo(math.cos(2 * rotInc) * radius, math.sin(2 * rotInc) * radius);

				ctx.closePath();
				ctx.fill();

			} else if(this.renderType === rat.particle.System.RENDER_DOT)
			{
				ctx.fillStyle = ps.color.toString();//"#6040FF";
				ctx.beginPath();
				scale = ps.size / 2;	//	radius! (half size)
				ctx.arc(0, 0, scale, 0, math.PI * 1.9999, false);
				ctx.closePath();
				ctx.fill();

			} else if(this.renderType === rat.particle.System.RENDER_SPRITE)
			{
				if(p.asset)	//	if particle has valid asset reference, use that.
				{
					ctx.globalAlpha = ps.color.a;

					//	scale to the size of the particle, not the image size.
					//	(these scaleWidth factors are usually 1, but can be something else if the image is not square)
					var sw = ps.size * p.scaleWidth;
					var sh = ps.size * p.scaleHeight;

					if(p.asset.isImageRef)
					{
						//	The following code is an extracted and optimized version of the draw call.
						////p.asset.draw(ctx, 0, 0, sw, sh);
						//p.asset.image.draw(ctx, p.asset.frame, 0, 0, sw, sh, p.asset.flags);
						var img = p.asset.image;
						var frameNum = p.asset.frame;
						var flags = p.asset.flags;
						var sheetStyle = !!(img.frames);	//	is this a spritesheet style image?
						var frameImage = img.getImageFrame(sheetStyle ? 0 : frameNum);
						var offsetX = 0;
						var offsetY = 0;
						//	easy version - single frame
						if(frameImage)
						{
							if(!sheetStyle)
							{
								if(flags & rat.graphics.Image.centeredX)
									offsetX = -sw / 2;
								if(flags & rat.graphics.Image.centeredY)
									offsetY = -sh / 2;
								ctx.drawImage(frameImage, offsetX, offsetY, sw, sh);
								
								//	temp debug - show space we're drawing in
								//ctx.strokeStyle = "#FF80FF";
								//ctx.lineWidth = 2;
								//ctx.strokeRect(offsetX, offsetY, sw, sh);
							}
							else
							{
								var curFrame = img.frames[frameNum];

								//	adapt w and h to relative w/h based on trimmed size
								
								//	first, how much does client want to scale from the original source image size?
								var wscale = sw / curFrame.origSize.w;
								var hscale = sh / curFrame.origSize.h;
								//	and, since we'll be drawing from a smaller space in the sheet, if the image was trimmed,
								//	then figure out effective width of that...
								var ew = curFrame.box.w * wscale;
								var eh = curFrame.box.h * hscale;

								offsetX = curFrame.trimRect.x * wscale;	//	account for trim
								offsetY = curFrame.trimRect.y * hscale;
								if(flags & rat.graphics.Image.centeredX)
									offsetX -= sw / 2;	//	center based on desired render size, not trimmed image
								if(flags & rat.graphics.Image.centeredY)
									offsetY -= sh / 2;
								ctx.drawImage(frameImage, curFrame.drawBox.x, curFrame.drawBox.y, curFrame.drawBox.w, curFrame.drawBox.h, offsetX, offsetY, ew, eh);
							}
						}
					}
					else
					{
						ctx.drawImage(p.asset, 0, 0, p.asset.width, p.asset.height, -sw / 2, -sh / 2, sw, sh);
					}
				}

			} else if(this.renderType === rat.particle.System.RENDER_TEXT)
			{
				ctx.font = (ps.size * this.fontSize) + 'pt ' + this.font;//(p.size * this.fontSize) + this.font;
				//	or?
				//rat.graphics.scale(p.size * this.fontSize, ctx);

				if(stroke)
				{
					//	todo - support second color per particle for this kind of thing
					//	and it needs to be animated, fade, etc...
					//	for now, stroke at a much darker color of the same
					ctx.strokeStyle = "rgba(" + (ps.color.r >> 3) + "," + (ps.color.g >> 3) + "," + (ps.color.b >> 3) + "," + ps.color.a + ")";
					ctx.lineWidth = 3;
					ctx.strokeText(p.text, -ps.size / 2, 0);
				}
				ctx.fillStyle = ps.color.toString();
				ctx.fillText(p.text, -ps.size / 2, 0);

			} else if(this.renderType === rat.particle.System.RENDER_CUSTOM)
			{
				//	don't draw.  See customDraw call below
				//	I'm making that separate so you can have a custom draw in addition to build-in draw.
			} else
			{
				//alert("unknown render type");
				rat.console.log("Error:  Unknown particle render type");
			}

			if(this.customDraw)
			{
				var emitter = this;
				this.customDraw(ctx, p, emitter);	//	note: custom draw happens in translated/rotated space	
			}

			//rat.graphics.restore();
			ctx.restore();
		}
		rat.profiler.popPerfMark("particle.Draw");
		
		//	temp debug - show emitter location
		//ctx.fillStyle = "#FFFF80";
		//ctx.fillRect(this.pos.x - 10, this.pos.y - 10, 20, 20);

		if(this.postDraw)
			this.postDraw(ctx, this);

		rat.profiler.popPerfMark("Emitter.Draw");
	};

	//-------------
	//	convenience function to set additive pre/post draw functions
	rat.particle.Emitter.prototype.setAdditive = function ()
	{
		this.preDraw = rat.particle.Emitter.preDrawAdditive;
		this.postDraw = rat.particle.Emitter.postDrawAdditive;
	};

	//	some standard useful predraw stuff
	rat.particle.Emitter.preDrawAdditive = function (ctx, emitter)
	{
		emitter.oldOperation = ctx.globalCompositeOperation;
		ctx.globalCompositeOperation = 'lighter';
	};
	rat.particle.Emitter.postDrawAdditive = function (ctx, emitter)
	{
		ctx.globalCompositeOperation = emitter.oldOperation;
	};

	//===========================================================================
	//-------------- classes for individual particles and states ----------------
	//===========================================================================

	//	state variables - these are initial, intermediate, or end states for a particle,
	//	as well as a particle's current state,
	//	or variance values for those same states.
	//var createdStates = 0;
	/**
	 * @constructor
	 */
	rat.particle.State = function ()
	{
		//rat.console.log( "Created " + ( ++createdStates ) + " Particle States!" );
		this.pos = new rat.Vector();
		this.offset = new rat.Vector();
		this.angle = new rat.Angle();
		this.vel = new rat.Vector();
		this.accel = new rat.Vector();
		this.color = new rat.graphics.Color(0, 0, 0, 0);
		this.protoObject = rat.particle.State.prototype;
	};
	rat.particle.State.prototype.size = 0;
	rat.particle.State.prototype.grow = 0;
	rat.particle.State.prototype.roll = 0;
	rat.particle.State.prototype.ageLimit = 0;
	rat.particle.State.prototype.friction = 0;
	rat.particle.State.prototype.nextInCache = void 0;
	/**
	 * Reset this state object as though it had just been newed
	 */
	rat.particle.State.prototype.reset = function()
	{
		// By val types.
		this.size = this.protoObject.size;
		this.grow = this.protoObject.grow;
		this.roll = this.protoObject.roll;
		this.ageLimit = this.protoObject.ageLimit;
		this.friction = this.protoObject.friction;
		this.nextInCache = void 0;
		
		//	we depend on keyTime and keyLength starting undefined,
		//	so we can know if the user has set them explicitly.
		//	That was undocumented, and the new state caching broke that.  My fault, really. (STT)
		//	let's try this to reset them to undefined...
		//	Alternatively, we could set up new values that mean "undefined", like -1
		var uu;	//	undefined
		this.keyTime = uu;
		this.keyFlags = uu;

		//	Objects created during the initialization process
		this.pos.x = 0;
		this.pos.y = 0;
		this.offset.x = 0;
		this.offset.y = 0;
		this.angle.angle = 0;
		this.vel.x = 0;
		this.vel.y = 0;
		this.accel.x = 0;
		this.accel.y = 0;
		this.color.r = 0;
		this.color.g = 0;
		this.color.b = 0;
		this.color.a = 0;
	};
	rat.particle.State.prototype.copy = function ()
	{
		var p = rat.particle.State.create();

		//	copy all atomic variables automatically
		// JHS This destroys the different vectors/angles/colors and makes us re-create the
		//for (var e in this) {
		//  p[e] = this[e];
		//}
		//	Simple By-Val copy
		p.size = this.size;
		p.grow = this.grow;
		p.roll = this.roll;
		p.ageLimit = this.ageLimit;
		p.friction = this.friction;
		p.keyTime = this.keyTime;
		p.keyFlags = this.keyFlags;

		//	Complex types need to be copied field by field
		p.pos.x = this.pos.x;
		p.pos.y = this.pos.y;
		p.offset.x = this.offset.x;
		p.offset.y = this.offset.y;
		p.angle.angle = this.angle.angle;
		p.vel.x = this.vel.x;
		p.vel.y = this.vel.y;
		p.accel.x = this.accel.x;
		p.accel.y = this.accel.y;
		p.color.r = this.color.r;
		p.color.g = this.color.g;
		p.color.b = this.color.b;
		p.color.a = this.color.a;

		return p;
	};
	/** The cache of state objects for the particle system */
	rat.particle.State.cache = void 0;
	/** The number of cached objects */
	rat.particle.State.cacheSize = 0;
	/** The of state objects that exist */
	rat.particle.State.count = 0;

	/// JHS Cache of state objects
	/**
	 * Get a new state object, either from the cache or create one
	 */
	rat.particle.State.create = function ()
	{
		if(rat.particle.State.cache)
		{
			var state = rat.particle.State.cache;
			rat.particle.State.cache = state.nextInCache;
			--rat.particle.State.cacheSize;
			state.reset();

			return state;
		}
		else
		{
			++rat.particle.State.count;
			return new rat.particle.State();
		}
	};
	/**
	 * Destroy a state object, and cache it.
	 */
	rat.particle.State.destroy = function (state)
	{
		if(state)
		{
			state.nextInCache = rat.particle.State.cache;
			rat.particle.State.cache = state;
			++rat.particle.State.cacheSize;
		}
	};

	/**
	 * Called once per frame in an attempt to fill the cache with some state objects to avoid hits to our framerate when creating lots of particles
	 * @param {number} deltaTime
	 */
	rat.particle.State.FillCache = function (deltaTime)
	{
		//	Create some state objects
		var leftToCreate = rat.particle.stateCaching.minObjectCount - rat.particle.State.count;
		if(leftToCreate > 0)
		{
			//	How many are we going to create?
			var howManyToCreate = math.min(leftToCreate, rat.particle.stateCaching.createPerFrame);
			for(var left = howManyToCreate; left > 0; --left)
			{	
				rat.particle.State.destroy(new rat.particle.State()); // If i use create, i get it from the cache I am trying to fill which is NOT what i want.
				++rat.particle.State.count;
			}
			leftToCreate -= howManyToCreate;
		}

		if( leftToCreate <= 0 )
		{
			//	We don't need to update anymore
			if( rat.cycleUpdate )
				rat.cycleUpdate.removeUpdater(rat.particle.State.FillCache);
		}
	};

	//
	//	A single particle
	//	This has a current state ("this.state"), and its own copy of a state array for interpolation over time.
	//	This is so we can calculate states with variance values from the emitter, but then stick to those calculated
	//	values when interpolating.
	//
	/**
	 * @constructor
	 */
	rat.particle.One = function ()
	{
		this.state = rat.particle.State.create();	//	my current state
		this.states = [];	//	my list of state keys (may be refs to emitter's state keys, if possible) (no variances)
		this.age = 0;
		this.ageLimit = 0;

		//	set up refs for convenience and external access?
		this.pos = this.state.pos;//new rat.Vector();	//	why not in "state"? maybe for easier external access
		//this.angle = this.state.angle;

		this.curKeyIndex = 0;	//	if we have state keyframes, start with first one
	};

	//	This may currently be unused?
	rat.particle.One.prototype.copy = function ()
	{
		var p = new rat.particle.One();

		//	copy all atomic variables automatically
		// JHS Again, this destroy vector and states forcing us to re-create them
		for(var e in this)
		{
			p[e] = this[e];
		}

		//	some things (complex types) need to be copied explicitly
		p.pos = this.pos.copy();
		p.state = this.state.copy();

		//	copy list of states
		var numStates = this.states.length;
		p.states = [];
		for(var i = 0; i < numStates; i++)
		{
			p.states[i] = this.states[i].copy();
		}

		return p;
	};

	//	single particle update function
	rat.particle.One.prototype.update = function (dt, e)
	{
		var s = this.state;

		s.size += s.grow * dt;
		if(s.size < 0)
			s.size = 0;

		//	decay velocity because of friction, if any (should be from emitter?)
		var vel = s.vel;
		var fric = s.friction;
		if(fric > 0)
		{
			fric = 1.0 - fric * dt;
			vel.x *= fric;
			vel.y *= fric;
		}

		//	apply new acceleration, if any (should be from emitter?)
		var accel = s.accel;
		vel.x += accel.x * dt;
		vel.y += accel.y * dt;

		//	apply velocity to position
		var pos = s.pos;
		pos.x += vel.x * dt;
		pos.y += vel.y * dt;

		//	roll
		s.angle.angle += s.roll * dt;

		//	interp some values based on keyframes.
		//	figure out how far long in time we are, and find the two appropriate keyframes to use
		//	todo:  curve interp somehow - maybe just use ease in/out
		//	todo:  optimize?  See note about skipping calculations below.
		//	todo:  optimize: skip all this calculation if there ARE no state keys.  Just keep our state and move on.  that happens often enough, right?

		var interp;	//	interp between appropriate key states
		var keyInterp = this.age / this.ageLimit;	//	total interp over life
		//keyInterp = clamp(interp, 0, 1);
		var stateCount = this.states.length;
		var segs = stateCount - 1;

		//starting with the current segment, see if our time is past the next segment's key time start,
		//	and if so, move our "current segment" marker up...
		for(var segIndex = this.curKeyIndex + 1; segIndex < segs; segIndex++)
		{
			if(keyInterp >= this.states[segIndex].keyTime)
				this.curKeyIndex = segIndex;
		}

		//var indexA = math.floor(segs * keyInterp);	//	this didn't allow for custom key timing
		var indexA = this.curKeyIndex;
		var indexB = indexA + 1;
		if(indexB > segs)
		{
			indexB = indexA;
			interp = 0;
		} else
		{
			//	calculate how far past A and toward B we are
			interp = (keyInterp - this.states[indexA].keyTime) / this.states[indexA].keyTimeLength;
			interp = ((interp < 0) ? 0 : ((interp > 1) ? 1 : interp));
		}

		//	Currently, this is the only thing that animates, really, for particles.
		//	todo - detect at setup if colors are ever changing, and skip calculations if not (set flag)
		//	See readyForUse function above, which would be a good time to do that.
		var invIVal = 1 - interp;
		var from = this.states[indexA];
		var to = this.states[indexB];
		if(to.color.r !== from.color.r) {
			var r = to.color.r * interp + invIVal * from.color.r;
			r = ((r < 0) ? 0 : ((r > 255) ? 255 : (r | 0)));
			s.color.r = r;
		} else {
			s.color.r = to.color.r;
		}
		if(to.color.g !== from.color.g) {
			var g = to.color.g * interp + invIVal * from.color.g;
			g = ((g < 0) ? 0 : ((g > 255) ? 255 : (g | 0)));
			s.color.g = g;
		} else {
			s.color.g = to.color.g;
		}
		if(to.color.b !== from.color.b) {
			var b = to.color.b * interp + invIVal * from.color.b;
			b = ((b < 0) ? 0 : ((b > 255) ? 255 : (b | 0)));
			s.color.b = b;
		} else {
			s.color.b = to.color.b;
		}
		if(to.color.a !== from.color.a) {
			var a = to.color.a * interp + invIVal * from.color.a;
			a = ((a < 0) ? 0 : ((a > 1) ? 1 : a));
			s.color.a = a;
		}else {
			s.color.a = to.color.a;
		}
				
		//	would also be nice to animate emitter values like rate...!
		//	think about more general animation systems for sets of values?  an animated keyframed set of values just spits out
		//	automatically into a new struct, and people just access the struct?  Don't overdo it... 

		if(this.asset && this.asset.isImageRef)
			this.asset.update(dt);

		this.age += dt;

		var status;
		if(this.age >= this.ageLimit)
		{
			status = rat.particle.System.statusDead;
		}
		else
			status = rat.particle.System.statusActive;
		
		return status;
	};

	/**
	 *	Set the rendering asset for this one particle to be this image.
	 * @param {?} asset
	 * @param {Object=} emitter
	 */
	rat.particle.One.prototype.setImageAsset = function (asset, emitter)
	{
		if (asset.isImageRef)
		{
			//	OK, half the point of imageRef is to support light references to images that can have their own
			//	animation timing!  So, let's do this right, and copy the imageref.
			this.asset = new rat.graphics.ImageRef(asset);
			//particle.assetIsImageRef = true;
			var size = asset.getSize();
			//	remember some values for proper scaling
			this.scaleWidth = 1;	//	by default, match width
			this.scaleHeight = size.h / size.w;

		} else
		{	//	normal image
			if(asset.width > 0 && asset.height > 0)	//	loaded and ready?
			{
				this.asset = asset;
				//	remember some values for proper scaling
				this.scaleWidth = 1;	//	by default, match width
				this.scaleHeight = asset.width / asset.height;
			}
		}
	};

	/*
	see above - currently we let the emitter draw its particles, so we don't have the overhead of a function call.
	rat.particle.One.prototype.draw = function(ctx)
	{
		//ctx.fillStyle = "rgba(100, 100, 200," + this.color.a + ")";
		ctx.fillStyle = this.color.toString();//"#6040FF";
		ctx.beginPath();
		var scale = 5;
		ctx.arc(this.pos.x, this.pos.y, scale, 0, math.PI * 2, true);
		ctx.closePath();
		ctx.fill();
	}
	*/

	/**
	 * Cleanup this single particle
	 */
	rat.particle.One.prototype.destroy = function ()
	{
		rat.particle.State.destroy(this.state);
		this.state = void 0;

		for(var i = 0, len = this.states.length; i !== len; ++i)
		{
			rat.particle.State.destroy(this.states[i]);
		}
		this.states = [];
	};

	//	system utility functions

	rat.particle.createSystem = function (options)
	{
		var ps = new rat.particle.System(options);
		rat.particle.systems[rat.particle.systems.length] = ps;
		return ps;
	};
	
	//	createSystem adds to a master list, which could mean references sticking around...
	//	So if you call createSystem, you probably eventually want to call removeSystem as well.
	rat.particle.removeSystem = function (sys)
	{
		var totalSystems = rat.particle.systems.length;
		for(var i = 0; i < totalSystems; i++)
		{
			if (rat.particle.systems[i] === sys)
			{
				rat.particle.systems.splice(i, 1);
				return;
			}
		}
	};

	rat.particle.getSystemCount = function () { return rat.particle.systems.length; };

	rat.particle.getAllEmitterCount = function ()
	{
		var totalEmitters = 0;
		var totalSystems = rat.particle.systems.length;
		for(var i = 0; i < totalSystems; i++)
		{
			var emitterCount = rat.particle.systems[i].getEmitterCount();
			totalEmitters += emitterCount;
		}
		return totalEmitters;
	};

	rat.particle.getAllParticleCount = function ()
	{
		var totalSystems = rat.particle.systems.length;
		var totalParticles = 0;
		for(var i = 0; i < totalSystems; i++)
		{
			var emitterCount = rat.particle.systems[i].getEmitterCount();
			for(var j = 0; j < emitterCount; j++)
			{
				totalParticles += rat.particle.systems[i].emitters[j].getParticleCount();
			}
		}
		return totalParticles;
	};

	/**
	 * Initialize the particle system
	 * @param {Object=} options used to setup the particle system
	 */
	rat.particle.init = function (options)
	{
		//	Are we caching state objects?
		if(rat.particle.stateCaching.enabled)
		{
			//	Create them all?
			if(rat.particle.stateCaching.createPerFrame <= 0)
			{
				rat.particle.stateCaching.createPerFrame = rat.particle.stateCaching.minObjectCount;
				rat.particle.State.FillCache(0);
				rat.particle.stateCaching.createPerFrame = 0;
			}
			//	Create them over time?
			if(rat.cycleUpdate)
			{
				rat.cycleUpdate.addUpdater(rat.particle.State.FillCache);
			}
		}
		else
		{
			rat.particle.stateCaching.minObjectCount = 0;
			rat.particle.stateCaching.createPerFrame = 0;
		}		
	};
} );
//
//	Telemetry
//
//	A wrapper class for storing (somewhere - in this initial case, Firebase) usage data
//
//	March 2013 Steve
//
//	TODO:
//		* at the same level as the timestamp per session (which is separate from session log), store a
//			most recent timestamp (write to this (optionally?) each time you write anything)
//			or even a closing timestamp, if firebase will support that.
//			In fact, better, store the total elapsed time.
//		* new functions to write a user value or a session value without necessarily incrementing it.
//		
rat.modules.add( "rat.live.r_telemetry",
[
	"rat.storage.r_storage",
], 
function(rat)
{

	rat.telemetry = {
		ref : null,
		userRef : null,
		sessionRef : null,
		id : 0,
		enableUIRecording : false,	//	off by default - just set this true to enable all ui event logging

		//	Init telemetry with this firebase address,
		//	and other settings.
		init : function(address, opts)
		{
			rat.telemetry.ref = null;
			if (typeof(Firebase) !== 'undefined')	//	is our firebase stuff reachable?
			{
				rat.telemetry.ref = new Firebase(address);
			}
			if (!rat.telemetry.ref)
				return;
			
			opts = opts || {trackSessionTime:true};
			rat.telemetry.opts = opts;

			//	figure out anonymous user id, generate if it doesn't exist
			var s = rat.storage.getStorage(rat.storage.permanentLocal);
			var id = s.getItem('rat_anon_id');
			if (id)
			{
				//	OK
			} else {
				//	make a new id, using some date elements to help sort it.
				var xd = new Date();
				var y = xd.getUTCFullYear() - 2000;
				var m = '' + (xd.getUTCMonth()+1);
				if (m < 10)
					m = '0' + m;
				var d = '' + xd.getUTCDate();
				if (d < 10)
					d = '0' + d;
				id = 'rid_' + y + m + d + '_' + Math.floor(Math.random() * 100000000);
				s.setItem('rat_anon_id', id);
				console.log(id);
			}
			rat.telemetry.id = id;
			rat.telemetry.userRef = rat.telemetry.ref.child(id);
			
			//	store agent info
			if (typeof navigator !== 'undefined')
			{
				//console.log(navigator);
				var clientInfo = {};
				clientInfo.appCodeName = navigator.appCodeName || 0;
				clientInfo.appName = navigator.appName || 0;
				clientInfo.appVersion = navigator.appVersion || 0;
				//clientInfo.cookieEnabled = navigator.cookieEnabled || 0;	//	who cares?
				clientInfo.platform = navigator.platform || 0;
				clientInfo.userAgent = navigator.userAgent || 0;
				clientInfo.cpuClass = navigator.cpuClass || 0;
				rat.telemetry.userRef.child('clientInfo').set(clientInfo);
			}

			//	start a new session
			var date = new Date();
			var tString = date.toUTCString();
			rat.telemetry.sessionRef = rat.telemetry.userRef.child('sessions').push({timeStart:tString, server_ts:Firebase.ServerValue.TIMESTAMP});
			//	write session end time on exit
			rat.telemetry.sessionRef.child('server_te').onDisconnect().set(Firebase.ServerValue.TIMESTAMP);
			
			this.sLog = "";	//	start with empty session log
		},

		//	increment a count for this user (increments across all sessions)
		userIncrement : function(key, amount)
		{
			if (!rat.telemetry.ref || !rat.telemetry.userRef)
				return;
			if (!amount)
				amount = 1;
			try {
				rat.telemetry.userRef.child(key).transaction(function(curVal) {
					return curVal+amount;
				});
			} catch (e) {}	//	suppress any error, so using telemetry doesn't become annoying
		},
		
		//	set a per-user value for this user (independent of sessions)
		userWrite : function(name, value)
		{
			if (!rat.telemetry.ref || !rat.telemetry.userRef)
				return;
			if (!value)
				value = true;
			rat.telemetry.userRef.child(name).set(value);
		},

		//	increment a count for this user, for this session
		sessionIncrement : function(key, amount)
		{
			if (!rat.telemetry.ref || !rat.telemetry.sessionRef)
				return;
			if (!amount)
				amount = 1;
			
			try {
				rat.telemetry.sessionRef.child(key).transaction(function(curVal) {
					return curVal+amount;
				});
			} catch (e) {}	//	suppress any error
			rat.telemetry.trackSessionTime();
		},
		
		//	append to this session's log, which is assumed to be a single string that grows,
		//	and is written each time this function is called.
		sessionLog : function(value, doWrite)
		{
			if (!rat.telemetry.ref || !rat.telemetry.userRef)
				return;
			this.sLog += ("" + value);
			if (typeof(doWrite) === 'undefined' || doWrite)
				this.sessionWrite("log", this.sLog);
		},
		
		//	write this single value for the session, overwriting whatever else was there in this named space.
		sessionWrite : function(name, value)
		{
			if (!rat.telemetry.ref || !rat.telemetry.userRef)
				return;
			rat.telemetry.sessionRef.child(name).set(value);
			rat.telemetry.trackSessionTime();
		},
		
		//	track right now as the last time the session was updated.
		//	(if our telemetry options are set to do so)
		//	This means 2 writes each time anything is updated, which is why it's optional - maybe that's more traffic
		//	than you wanted.
		trackSessionTime : function()
		{
			if (rat.telemetry.opts.trackSessionTime)
			{
				var date = new Date();
				var tString = date.toUTCString();
				rat.telemetry.sessionRef.child('timeLast').set(tString);
			}
		},

		//	increment a count for all users
		globalIncrement : function(key, amount)
		{
			if (!rat.telemetry.ref)
				return;
			if (!amount)
				amount = 1;
			//try {
				rat.telemetry.ref.child('global').child(key).transaction(function(curVal) {
					return curVal+amount;
				});
			//} catch (e) {}	//	suppress any error
		},
		
		//	record an event, for this session, with a timestamp
		record : function(eventName, value)
		{
			if (!rat.telemetry.ref || !rat.telemetry.sessionRef)
				return;
			try {
				var d = new Date();
				//var tString = d.toUTCString();
				//rat.telemetry.sessionRef.push({event:eventName, value:value, ts:tString});

				//	more compact version, embed timestamp and event name in key, so they're easy to scan visually,
				//	and if their value is a string, it'll show up as one line in Firebase Forge
				var ts = d.getTime();
				var hours = d.getUTCHours();
				var minutes = d.getUTCMinutes();
				var seconds = d.getUTCSeconds();
				var s = ((hours<9)?'0':'') + hours + '_' + ((minutes<9)?'0':'') + minutes + '_' + ((seconds<9)?'0':'') + seconds + '_' + eventName;
				//console.log("TIME: [" + s + "]," + ts);
				rat.telemetry.sessionRef.child(s).setWithPriority(value, ts);
			} catch (e) {
				//	suppress any error
			}
		},

		//	UI record - record a UI event.  This is a way to get fine-tuned data from the user navigating screens.
		//	This is directly supported by the rat UI system, but can be disabled (rat.telemetry.enableUIRecording = false)
		recordUI : function(eventName, value)
		{
			if (!rat.telemetry.enableUIRecording)
				return;
			//console.log("record UI " + eventName + " + " + value);
			rat.telemetry.record(eventName, value);
		},
	};
} );
//
//	Audio module
//
//	Eventual Features:
//		Load sounds ready for playing by id
//		Handling of different formats for different browsers/platforms
//		Set up sounds in groups and pick random sounds in those groups when requested
//		Restart sounds when played in succession
//		Master volume.
//			Master fade in/out?
//		Per-sound properties like how far into the sound to get before allowing restarting
//
//		Background music track handling:
//			independent mute/volume for music
//			support automatically looping through a set of tracks?  (not high priority)
//			convenient function for transitioning to new track,
//				which includes fading current track out automatically
//
//		Bug fixing To do:
//
//			Bug:  If browser supports mp3 and extension is not specified, we try m4a but not mp3.
//
//			Check out melonjs - does his audio work with iOS?  He does retry after error like other solutions,
//			but how will that work on iPad?
//
//			How about the trick one guy mentioned where he loads audio without identifying it as audio format,
//			so iOS browsers don't screw with it.
//		very potentially useful:
//			http://stackoverflow.com/questions/3009888/autoplay-audio-files-on-an-ipad-with-html5/8001076#8001076
//		wow, yeah, this could possibly all be fixed by doing the sound load in response to a click?  That'd be interesting...
//			load() then play() in response to a synchronous click handler
//		read http://stackoverflow.com/questions/3619204/how-to-synthesize-audio-using-html5-javascript-on-ipad?rq=1
//		read http://stackoverflow.com/questions/5758719/preloading-html5-audio-in-mobile-safari?rq=1
//
//	References:
//		https://www.scirra.com/blog/44/on-html5-audio-formats-aac-and-ogg
//		http://stackoverflow.com/questions/1007223/which-browsers-support-the-html-5-audio-tag-on-windows-today
//		canplay stuff: http://html5doctor.com/native-audio-in-the-browser/
//		stalling safari audio: http://stackoverflow.com/questions/4201576/html5-audio-files-fail-to-load-in-safari
rat.modules.add( "rat.audio.r_audio",
[
	"rat.debug.r_console",
	"rat.os.r_system",
	{name: "rat.audio.r_audio_single", platform: "PS4Browser"}
], 
function(rat)
{
	function log(txt, eventType)
	{
		if (!eventType)
			eventType = txt;
		rat.console.logOnce( "| r_audio: " + txt, eventType);
	}
	
	rat.audio = {	//	audio namespace
		initialized : false,
		soundOn: true,
		defaultGroup: "sfx",

		globalVolume: 1,

		groupVolumes:{},
		//cacheLoaded: false,

		toLoadCount: 0,
		loadedCount: 0,
		preferedExt: "", // If no extension was provided, try this one first

		//	some systems (e.g. PS4 browser) work better if we load sequentially
		useSequentialLoad : false,
		activeSequentialLoad : false,	//	are we in the middle of handling load jobs?
		loadJobs: [],	//	load jobs queued up
		
		verboseDebug : false,

		sounds: {},	//	hashtable of sound info, always accessed by literal sound ID (string)
		dukTapeSound : null,	//	see below

		//	music : [],

		/**
		 *@suppress {undefinedVars} - Don't warn about undefined Audio, as it is defined
		 */
		audioConstructor: function ()
		{
			return new Audio();
		},

		//	one-time system-level init
		//	rAudio argument here is optional.  If not supplied, set up global rat.audio object.
		init: function (useAudioSystem)
		{
			var rAudio;
			if (typeof(useAudioSystem) === 'undefined')
				rAudio = rat.audio;
			else
				rAudio = useAudioSystem;

			log("Init");
			
			rAudio.iOSBrowser = rat.system.has.iOSBrowser;
			rAudio.PS4Browser = rat.system.has.PS4Browser;
			
			//	create an audio object so we can query play abilities
			var myAudio = rAudio.audioConstructor();

			if (myAudio.canPlayType)
			{
				// Currently canPlayType(type) returns: "", "maybe" or "probably" 
				rAudio.canPlayMp3 = !!myAudio.canPlayType('audio/mpeg');	//	mp3
				rAudio.canPlayM4a = !!myAudio.canPlayType('audio/mp4; codecs="mp4a.40.5"');	//	aac
				rAudio.canPlayOgg = !!myAudio.canPlayType('audio/ogg; codecs="vorbis"');	//	ogg
				rAudio.canPlayXMA = !!myAudio.canPlayType('audio/xma2;');					//	xma
				rAudio.canPlayWav = true;	// !!myAudio.canPlayType( 'audio/wav' );			//	wav - also tried with adding  ; codecs="1"  -- to no avail, this returns false on IE and XBO when they will indeed play it
				//	todo: 
				
				if (rAudio.PS4Browser)	//	PS4 browser lies about AAC/MP4/M4a playback ability
					rAudio.canPlayM4a = true;

				log("can play: " +
					 "mp3(" + rAudio.canPlayMp3 + ") " +
					 "m4a(" + rAudio.canPlayM4a + ") " +
					 "ogg(" + rAudio.canPlayOgg + ") " +
					 "xma(" + rAudio.canPlayXMA + ") " +
					 "wav(" + rAudio.canPlayWav + ") " +
					 "\n");
			}

			// [JSalmond May 14, 2014] If i don't add this ref here, my dukTape garbage collector dies when i shutdown, and i don't know why.
			// PLEASE don't remove this
			//	STT 2014.06.26:  Can we at least not put it in the main list?
			//rAudio.sounds[0] = [myAudio];
			rAudio.dukTapeSound = myAudio;
			
			rAudio.initialized = true;
		},
		
		//	Load (preload) sounds into the audio system.
		//	Here are some examples of the various ways to use this function.
		//	rat.audio.loadSounds([
		//		{id:'fire', resource:"sounds/fire123.m4a"},	//	normal sound with specified id
		//		{id:'hit', resource:"sounds/hit123", volume:0.8}	//	don't need extension, can specify volume
		//		"sounds/bob.m4a"}	//	just specify resource, in which case id is final filename ('bob')
		//		["sounds/cry.m4a", "sounds/cry2.m4a", "sounds/cry3.m4a"],	//	list of sounds, id is first id ('cry'), and a random one is picked when played
		//		[{id:'cry', resource:"sounds/cry.m4a"}, {resource:"sounds/cry2.m4a"}],	//	alternative form
		//	]);
		//	TODO:  Can we support this function being called several times?  We need to, if it doesn't work already.
		loadSounds: function (sounds)
		{
			//	use our loadSoundList utility function, and have it call our actual sound creator function here.
			//	this separates processing and loading functionality, which makes it easier for other modules to build on this one.
			
			function loadTrigger(res, entry)
			{
				var a = rat.audio.audioConstructor();
					
				if (rat.audio.useSequentialLoad)
				{
					rat.audio.loadJobs.push({a:a, res:res, soundInfo:entry});
				} else {
					rat.audio.doSingleLoad(a, res, entry);	//	trigger actual load
				}

				var vol = 1;
				if (entry.volume !== void 0)
					vol = entry.volume;
				a.entryVolume = vol;
				a.group = entry.group || rat.audio.defaultGroup;
				if( rat.audio.groupVolumes[a.group] !== void 0 )
					vol *= rat.audio.groupVolumes[a.group];
				a.volume = vol * rat.audio.globalVolume;
				return a;
			}
			
			rat.audio.sounds = rat.audio.loadSoundList(sounds, loadTrigger);
			
			if (rat.audio.useSequentialLoad && !rat.audio.activeSequentialLoad)	//	if not already loading, and we have loading to do, do it
			{
				rat.audio.processQueuedLoad();
			}
			
		},
		
		//	INTERNAL function - clients use loadSounds above.
		//	This function processes a sound list, like above, but calls another function to actually load/create each sound.
		//	returns an internal list of sounds.
		loadSoundList : function(sounds, loadTrigger)
		{
			if (!rat.audio.initialized)
			{
				//	If you get here, it's probably because you're initializing your audio module too early,
				//	(e.g. you have it self-initializing as its js file is loading),
				//	and as a result you're calling rat.audio.loadSounds before calling rat.init.
				//	rat audio is initialized from rat.init, and you need to call that before initializing your audio.
				log("!!NOT INITIALIZED before loadSounds");
			}
			
			var mySoundList = {};	//	hash of sounds
			
			//	Order of preference
			var ext;
			if( rat.audio.canPlayM4a )
				ext = ".m4a";
			else if( rat.audio.canPlayMp3 )
				ext = ".mp3";
			else if( rat.audio.canPlayOgg )
				ext = ".ogg";
			else if( rat.audio.canPlayXMA )
				ext = ".xma";
			else if( rat.audio.canPlayWav )
				ext = ".wav";
			else
			{
				log( "Unable to find support audio file format.  Defaulting to .m4a" );
				ext = ".m4a";	
			}
			log("load using " + ext);

			//	Queue up all the sounds we need loaded.
			for (var i = 0; i < sounds.length; i++)
			{
				var pieceList = sounds[i];
				if (!Array.isArray(pieceList))
					pieceList = [sounds[i]];	//	convert each item to an array for convenience

				var id;	//	there will be a single shared id for all sounds in this group
				var list = [];
				var dotPos;
				
				//	loop through all pieces for this ID
				for (var pieceIndex = 0; pieceIndex < pieceList.length; pieceIndex++)
				{
					//	todo put inside another object so we can independently track some runtime variables,
					//	like priority when randomly selecting
					//	right now, we just have actual audio objects.

					var entry = pieceList[pieceIndex];

					var res;
					if (typeof entry === 'string')	//simple case - they just named a resource.  Build an entry object for them.
					{
						res = entry;	//	the resource file name
						dotPos = res.lastIndexOf('.');
						if (dotPos < 0)
						{
							dotPos = res.length;
							if( rat.audio.preferedExt )
							{
								if( rat.audio.preferedExt[0] !== "." )
									res += ".";
								res += rat.audio.preferedExt;
							}
						}
						var slashPos = res.lastIndexOf('/');
						if (slashPos < 0)
							slashPos = 0;	//	there isn't one
						else
							slashPos++;	//	skip it
						var resID = res.substring(slashPos, dotPos);	//	in this case the id is filename without path or extension
						entry = { id: resID, resource: res, volume: 1 };	//	build a full entry to simplify code below
					} else
					{	//	normal
						res = entry.resource;
					}

					//	rewrite extension to our standard extension, if we can't play the type specified.
					//	(if we can play the specified type, then that's fine - use that)
					
					dotPos = res.lastIndexOf('.');
					if (dotPos < 0)
						dotPos = res.length;
					var extString = res.substring(dotPos, res.length);
					//console.log("extString " + extString);
					if (!((extString === '.mp3' && rat.audio.canPlayMp3) ||
							(extString === '.m4a' && rat.audio.canPlayM4a) ||
							(extString === '.ogg' && rat.audio.canPlayOgg) ||
							(extString === '.xma' && rat.audio.canPlayXMA) ||
							(extString === '.wav' && rat.audio.canPlayWav)))
					{
						//console.log("replacing " + extString + " with " + ext + " because !" + rat.audio.canPlayMp3);
						res = res.substring(0, dotPos) + ext;
					}

					res = rat.system.fixPath(res);	//	let rat fix up our path, e.g. if we're in some strange hosted environment
					
					rat.audio.toLoadCount++;
					
					var a = loadTrigger(res, entry);
					
					list[pieceIndex] = a;
					
					if (pieceIndex === 0)	//	if this is the first entry in the list, use the same id for later entries.
						id = entry.id;
					
				}	//	end of piece list loop

				if (mySoundList[id])	//	already defined this sound?  If so, this will screw up counts...
				{
					log("ERROR: " + id + " redefined!", id);
					rat.audio.toLoadCount--;
				}
				mySoundList[id] = list;
			}
			
			return mySoundList;

		},	//	end of loadSounds function
		
		//	handle the next available load job
		processQueuedLoad : function()
		{
			if (!rat.audio.loadJobs || rat.audio.loadJobs.length <= 0)
			{
				if (rat.audio.verboseDebug)
					log("Done with sequential load.");
				rat.audio.activeSequentialLoad = false;
				return;
			}
			
			if (rat.audio.verboseDebug)
				log("rat.audio: New sequential load job...");
			
			rat.audio.activeSequentialLoad = true;
			
			var job = rat.audio.loadJobs[0];
			rat.audio.loadJobs.splice(0, 1);
			rat.audio.doSingleLoad(job.a, job.res, job.soundInfo);	//	trigger actual load
		},
		
		//	load a single sound.
		//	This is an internal call, generally not for external use.
		//	Clients:  use loadSounds above, instead.
		doSingleLoad : function (a, res, soundInfo)
		{
			if (rat.audio.verboseDebug)
				log("triggering load " + soundInfo.id + " : " + res + " at volume " + soundInfo.volume);

			//	iPad is making things really hard.
			//	The behavior we're seeing is this:
			//		sound a starts loading, and is suspended
			//		sound b starts loading, gets to canplaythrough
			//		sound b gets stall event, even though it's fine
			//		sound a never gets another event.
			//	That's the simple case.  If we load lots of files, man, who knows.  Safari goes stupid.
			//	We can't just load() or play() on stall, because it restarts the load, and we loop infinitely?
			//		(plus, we're getting the stall on an object we're already happy with)
			//	2014.06.26	STT:  I found on the PS4 browser that loading in sequence instead of parallel made these problems go away.
			//	That might work on iOS, too, since the problems are the same.
			//	But see above, notes on loading in response to user input.
			
			/**
			 * In this case, this will be the audio object that we bind to the function, but i don't know how to let the linting tool know that
			 * @suppress {globalThis}
			 */
			function on_stalled(e)
			{
				//log('on_stalled');
				//log('. id : ' + soundInfo.id);
				//log('. . . dur: ' + this.duration);
				////log('   error: ' + this.error.code);
				//log('. . . readyState: ' + this.readyState);
			}

			/**
			 * In this case, this will be the audio object that we bind to the function, but i don't know how to let the linting tool know that
			 * @suppress {globalThis}
			 */
			function on_load(e)
			{
				//log('on_load');
				//log('. id : ' + soundInfo.id);
				//log('. . . dur: ' + this.duration);
				////log('   error: ' + this.error.code);
				//log('. . . readyState: ' + this.readyState);

				// the callback gets called twice in Firefox if we don't remove the handler
				this.removeEventListener('canplaythrough', on_load, false);
				this.removeEventListener('error', on_error, false);
				
				//	don't remove stalled event?  We get a stall event for loaded sounds instead of the ones
				//	that aren't loading?  iOS sucks.
				this.removeEventListener('stalled', on_stalled, false);

				//	todo: move this "ratLoaded" flag into an outer object(audioInfo) that contains this audio object.
				//		don't modify standard object types.
				if (!this.ratLoaded)
				{
					this.ratLoaded = true;
					rat.audio.loadedCount++;
					if (rat.audio.verboseDebug)
						log( rat.audio.loadedCount + "/" + rat.audio.toLoadCount + " loaded: "  + this.src);
					
					//	if we're doing sequential loading, trigger the next load
					if (rat.audio.useSequentialLoad)
						rat.audio.processQueuedLoad();
				}
			}

			/**
			 * Called when an audio load failes
			 * @suppress {globalThis}
			 */
			function on_error(e)
			{
				log('encountered error while loading: ' + this.src);
				//log('. . . dur: ' + this.duration);
				////log('   error: ' + this.error.code);
				//log('. . . readyState: ' + this.readyState);

				//	this will mark this one loaded, so we can move on with the game instead of locking up waiting for load.
				var self = this;
				on_load.call(self, e);
			}
			
			a.preload = 'auto';	//	ignored on some systems, e.g. safari ios

			a.addEventListener('canplaythrough', on_load, false);
			a.addEventListener('stalled', on_stalled, false);
			a.addEventListener('error', on_error, false);

			a.src = res;
			
			//	some debug events...

			//	debug function to track events
			//function announce(media, ev)
			//{
			//	var self = media;
			//	media.addEventListener(ev, function(e)
			//	{
			//		log("  # "+ev+" " + self.src);
			//	}, false);
			//}

			/*
			a.addEventListener('loadstart', function (e) {
				//log('loadstart ' + this.src);
				if (this.src.search("chirp") >= 0 || this.src.search("throw") >= 0)
				{
					log("loadstart " + this.src);
					log("duration " + this.duration);
					log("time " + this.currentTime);
					log("error " + (this.error && this.error.code));
					//	Check for our own errors here?
					//	like invalid length...
				}
			}, false)
			a.addEventListener('suspend', function (e) {
				//log('suspend ' + this.src);
				if (this.src.search("chirp") >= 0 || this.src.search("throw") >= 0)
				{
					log("suspend " + this.src);
					log("duration " + this.duration);
					log("time " + this.currentTime);
					log("error " + (this.error && this.error.code));
					//	Check for our own errors here?
					//	like invalid length...
				}
			}, false)
			*/

			/*
			a.addEventListener('canplay', function (e) {
				log('canplay ' + this.src);
			})
		
			a.addEventListener('canplaythrough', function (e) {
				log('canplaythrough' + this.src);
			})
			//log("moving on " + res);
			*/

			//	load() is required for safari on ipad, in order to force load.
			//	otherwise safari will not load this sound until I actually try to play it.
			//	maybe in order to save bandwidth...?
			//	bleah, half the time it still won't load it.
			//	May be required on PS4 as well
			a.load();

		},
		
		//	internal utility to pick a random sound (or only sound or whatever) given a sound ID.
		//	This is how we support playing random sounds from a list that share an ID
		
		selectSound : function(soundID)
		{
			if (!rat.audio.soundOn)
				return null;

			if (!rat.audio.sounds[soundID])
			{
				log("tried to play nonexistent sound " + soundID, soundID);
				return null;
			}

			var soundPossibles = rat.audio.sounds[soundID];
			var sound;
			if (soundPossibles.length <= 0)
			{
				log("tried to play from empty list " + soundID, soundID);
				return null;
			}
			else if (soundPossibles.length > 1)
				sound = soundPossibles[(Math.random() * soundPossibles.length) | 0];
			else
				sound = soundPossibles[0];
				
			return sound;
		},

		//	play a sound by ID
		playSound: function (soundID)
		{
			var sound = rat.audio.selectSound(soundID);
			if (!sound)
				return;
			
			//	todo: only rewind if time is beyond a certain point, configurable per individual sound
			if (!sound.ended && sound.currentTime > 0 && !sound.paused) // sound will resume if paused, not restart
			{
				//console.log("already playing " + soundID + " at " + sound.currentTime + "/" + sound.duration + ", vol " + sound.volume);
				if (rat.system.has.Wraith)
				{
					// We have no set functionality on currentTime in Wraith, so we call the stop function.
					sound.stop();
				}
				else
				{
					// The stop function is not currently a part of HTML5, so set the time to the begining.
					sound.currentTime = 0;
				}
			}

			sound.play();
		},

		pauseSound: function (soundID)
		{
			if (!rat.audio.sounds[soundID])
			{
				log("tried to pause nonexistent sound " + soundID, soundID);
				return;
			}

			//	for now, let's pause them all
			//	an alternative would be to see which (if any) is playing, and pause those...
			var soundPossibles = rat.audio.sounds[soundID];
			for (var i = 0; i < soundPossibles.length; i++)
			{
				var sound = soundPossibles[i];
				if (sound)
					sound.pause();
			}
		},

		// returns a sound to the starting position
		resetSound: function (soundID)
		{
			if (!rat.audio.sounds[soundID])
			{
				log("tried to reset nonexistent sound " + soundID, soundID);
				return;
			}

			var soundPossibles = rat.audio.sounds[soundID];
			
			//	reset them all
			for (var i = 0; i < soundPossibles.length; i++)
			{
				var sound = soundPossibles[i];
				if (sound && sound.currentTime !== 0)
					sound.currentTime = 0;
			}
		},

		//	stop and reset a sound to starting position
		stopSound: function (soundID)
		{
			rat.audio.pauseSound(soundID);
			rat.audio.resetSound(soundID);
		},
		
		//	seek sound to a certain point
		seekSound: function (soundID, toWhence, isNormalized)
		{
			if (!rat.audio.sounds[soundID])
			{
				log("tried to reset nonexistent sound " + soundID, soundID);
				return;
			}
			
			if (typeof(isNormalized) === 'undefined')
				isNormalized = false;
			
			var soundPossibles = rat.audio.sounds[soundID];
			for (var i = 0; i < soundPossibles.length; i++)
			{
				var sound = soundPossibles[i];
				if (!sound)
					continue;
				var dur = sound.duration;
				var target = toWhence;
				if (isNormalized)
					target *= dur;
				sound.currentTime = target;
			}
			
		},
		
		//	get current volume for this sound.
		//	if more than one sound, return first volume.
		//	TODO: support specifying sub-sound in one of several ways
		//		with sound id in a format like 'soundid:2'
		//		or with a struct that includes id and subindex (if not a struct, just assume id)
		//		or with an additional argument?
		//	and then carry that support to all other applicable functions in a generic way, which includes
		//		support for acting on all subsounds, e.g. set volume for all or pause all...
		//		probably through some "apply to sounds" function system where we pass in an anonymous function
		//	NOTE: With sound groups, this returns the volume set for the sound, not the calculated volume.
		getSoundVolume: function (soundID)
		{
			if (!rat.audio.sounds[soundID])
			{
				log("tried to get volume for nonexistent sound " + soundID, soundID);
				return;
			}

			var soundPossibles = rat.audio.sounds[soundID];
			var sound = soundPossibles[0];
			return sound.entryVolume;
		},
		
		//	Set the volume on a single sound.
		setSoundVolume: function (soundID, volume)
		{
			if (!rat.audio.sounds[soundID])
			{
				log("tried to set volume for nonexistent sound " + soundID, soundID);
				return;
			}

			var soundPossibles = rat.audio.sounds[soundID];
			for (var i = 0; i < soundPossibles.length; i++)
			{
				var sound = soundPossibles[i];
				if (!sound)
					continue;
				if (rat.audio.groupVolumes[sound.group] === void 0)
					rat.audio.groupVolumes[sound.group] = 1;
				sound.entryVolume = volume;
				sound.volume = volume * rat.audio.groupVolumes[sound.group] * rat.audio.globalVolume;
			}
		},
		
		//	Set if a sound is a looping sound
		setSoundLooping: function(soundID, loop)
		{
			loop = !!loop;
			if (!rat.audio.sounds[soundID])
			{
				log("tried to call setSoundLooping nonexistent sound " + soundID, soundID);
				return;
			}
			
			var soundPossibles = rat.audio.sounds[soundID];
			for (var i = 0; i < soundPossibles.length; i++)
			{
				var sound = soundPossibles[i];
				if (!sound)
					continue;
				if (sound.loop != loop)
					sound.loop = loop;
			}
		},

		//	Set the volume of a given audio group
		setGroupVolume: function(group, volume)
		{
			var sound;
			var entry;
			if (volume !== rat.audio.groupVolumes[group])
			{
				rat.audio.groupVolumes[group] = volume;
				for (var id in rat.audio.sounds)
				{
					sound = rat.audio.sounds[id];
					for (var index = 0; index !== sound.length; ++index)
					{
						entry = sound[index];
						if (entry.group !== group)
							continue;
						entry.volume = entry.entryVolume * volume * rat.audio.globalVolume;
					}
				}
			}
		},

		//	Set the global volume level
		setGlobalVolume: function(volume)
		{
			if (volume === rat.audio.globalVolume)
				return;
			rat.audio.globalVolume = volume;
			var sound;
			var entry;
			for (var id in rat.audio.sounds)
			{
				sound = rat.audio.sounds[id];
				for (var index = 0; index !== sound.length; ++index)
				{
					entry = sound[index];
					if (rat.audio.groupVolumes[entry.group] === void 0)
						rat.audio.groupVolumes[entry.group] = 1;
					//var volumeWas = entry.volume;
					entry.volume = entry.entryVolume * rat.audio.groupVolumes[entry.group] * rat.audio.globalVolume;
					//log("changed sound " + id +"-" + index + " to volume " + entry.volume + " from " + volumeWas);
				}
			}
		},

		//	do regular maintenance
		update: function (dt)
		{
		},

		//	how many sounds are registered?  mostly for debug?
		getSoundCount: function ()
		{
			var count = 0;
			for (var key in rat.audio.sounds)
			{
				if (rat.audio.sounds.hasOwnProperty(key))
					count++;
			}
			return count;
		},

		//	get nth sound (mostly for debug?)
		getSoundIDByIndex: function (index)
		{
			var count = 0;
			for (var key in rat.audio.sounds)
			{
				if (rat.audio.sounds.hasOwnProperty(key))
				{
					if (count === index)
						return key;
					count++;
				}
			}
			return 'error';	//	bogus index, return bogus ID
		},

		//	get internal info - mostly debug? should probably not depend on this internal structure staying the same.
		//	OR, it should be well documented and standard that this info will stay the same.
		getSoundInfo: function (id)
		{
			var entry = rat.audio.sounds[id];
			if (entry)
			{
				var first = entry[0];
				var info = {
					id: id,
					duration: first.duration,
					source: first.src,
					volume: first.volume,
					currentPos: first.currentTime,
					readyState: first.readyState,
					errorCode: 'none',
				};
				
				if (first.error)
					info.errorCode = first.error.code;

				return info;
			} else
			{
				log("Requested info for nonexistent sound" + id, soundID);
				return null;
			}
		},

		//	Determines if a given sound is loaded.
		//	From Ethan.  STT is not sure how this works, but hasn't asked Ethan.
		//	see code above that skips this now.
		//	(doesn't seem to be correct on iPad)
		isSoundLoaded: function (id)
		{
			var entry = rat.audio.sounds[id];
			if (!entry)
			{
				log("Tried to check if nonexistent audio (" + id + ") is loaded");
				return null;
			}

			if (entry[0].error !== null)
			{
				// there is an 'error'
				return 'error';
			}

			// https://developer.mozilla.org/en-US/docs/DOM/TimeRanges
			// we'll assume that there is only one range
			var range = entry[0].buffered;

			// log(entry, range, entry[0].duration);

			return (range.length === 1 && range.start(0) === 0 && range.end(0) === entry[0].duration);
		},

		//	return true if all sounds listed in cache are loaded
		isCacheLoaded: function ()
		{
			//	note:  This will need some more sophistication if we ever support removing sounds
			//log("audio load checking " + rat.audio.loadedCount + " >= " + rat.audio.toLoadCount);
			if (rat.audio.loadedCount >= rat.audio.toLoadCount)
				return true;
			else
			{
				//if (rat.audio.loadStalled)	//	freaking iPad
				if (rat.audio.iOSBrowser)	//	todo:  fix this with sequential loading?
					return true;
				return false;
			}

			//return rat.audio.cacheLoaded == true;
		},

		//	is this sound actively playing?
		isSoundPlaying: function (id)
		{
			var entry = rat.audio.sounds[id];
			if (entry)
			{
				var first = entry[0];
				//console.log("cp " + first.currentTime);
				if (first.currentTime > 0 && first.currentTime < first.duration)
					return true;
			}
			return false;
		},

		//	what sound listed in cache is not loaded?  mostly debug.
		whatIsMissing: function ()
		{
			var totalCount = 0;
			var missingCount = 0;
			for (var key in rat.audio.sounds)
			{
				if (rat.audio.sounds.hasOwnProperty(key))
				{
					if (!rat.audio.sounds[key][0].ratLoaded)
					{
						console.log("Missing: " + key);
						missingCount++;
					}
					totalCount++;
				}
			}
			log("missing " + missingCount + " of " + totalCount);
		},

	};

	// called from system init now...  rat.audio.init();
	//@TODO Replace with a registered init function in the module
} );


//
// Graphics objects and utilities
//
rat.modules.add("rat.graphics.r_graphics",
[
	{ name: "rat.math.r_math", processBefore: true },

	"rat.os.r_system",
	"rat.os.r_events",
	"rat.debug.r_console",
	"rat.debug.r_profiler",
	"rat.math.r_matrix",
	"rat.utils.r_utils",
	"rat.utils.r_shapes",
],
function (rat)
{
	var math = rat.math; // for quick local access below

	/// Update our held view state.
	function getViewState()
	{
		if (rat.system.has.winJS)
		{
			//	see https://msdn.microsoft.com/en-US/library/windows/apps/windows.ui.viewmanagement.applicationviewstate
			var states = window.Windows.UI.ViewManagement.ApplicationViewState;
			switch (rat.graphics.winJSAppView.value)
			{
				case states.fullScreenLandscape:
					rat.graphics.viewState = "fullscreen";
					break;
				case states.filled:
					rat.graphics.viewState = "filled";
					break;
				case states.snapped:
					rat.graphics.viewState = "snapped";
					break;
				case states.fullscreenPortrait:
					rat.graphics.viewState = "fullscreenPortrait";
					break;
				default:
					rat.graphics.viewState = "unknown";
					break;
			}
			rat.graphics.viewState = rat.graphics.winJSAppView.value;	//	for convenience later
		}
		else
			rat.graphics.viewState = "fullscreen";
	}

	// remember old known size, so we know whether to bother informing anyone.
	var oldSize = { x: 0, y: 0 };
	/// our screen size changed.  Tell people about it.
	function screenSizeChanged()
	{
		var newSize = { x: rat.graphics.SCREEN_WIDTH, y: rat.graphics.SCREEN_HEIGHT };

		if (oldSize.x !== newSize.x || oldSize.y !== newSize.y)
		{
			rat.events.fire("resize", newSize, oldSize);
			oldSize.x = newSize.x;
			oldSize.y = newSize.y;
		}
	}

	///
	///	rat graphics module
	/// @namespace
	///
	rat.graphics = {

		SCREEN_WIDTH: 760, //	gets reset correctly later
		SCREEN_HEIGHT: 600, //	gets reset correctly later

		// auto scaling to match desired display as closely as we can
		globalScale: { x: void 0, y: void 0 },	// current scale, if there is one
		globalTranslate: null,	// current shift, if there is one
		autoTargetSize: { x: 0, y: 0 },	// ideal size
		autoResizeCanvas: true,	// turn on/off auto resizing system
		autoFillOnResize: false, // once we resize close enough, go ahead and accept the window size (see below)
		autoCenterCanvas: false, // turn on/off style-based canvas centering inside its parent

		// factor in high-DPI devices when sizing
		// A reason this is off by default is that on high-DPI devices we'll do a lot more rendering work, slowing us down.
		// If performance is a concern, don't turn this on!
		autoScaleWithDevicePixelRatio: false,
		canvasPixelRatio: 1,

		autoClearCanvas: false,	// whether or not we should clear canvas automatically each frame
		autoClearColor: "#000",	// color to which we should autoclear, or "" if we should clear to transparent.

		frameIndex: 0,		// current frame since launch of application
		ctx: null,

		frameStats: { totalElementsDrawn: 0 },	// for debug, some stats about what we've drawn this frame

		cursorPos: { x: -1, y: -1 },	// last known cursor pos, in canvas space

		minAutoScale: 0.0000001, // Minimum auto scale defaults to 0.00000001

		mTransform: void 0,	// our internally tracked transformation matrix
		mStateStack: [],

		viewState: "fullscreen"
	};

	var mIgnoreRatTransform = false; // Should matrix calculations ignore the rat matrix.  Set via rat.graphics.save

	//	not needed by default - we grab it above.
	//	Use this if you want to override or whatever...?
	//	or above function may change, since it's kinda hardcoded.
	rat.graphics.setContext = function (ctx)
	{
		rat.graphics.ctx = ctx;
	};

	rat.graphics.getContext = function ()
	{
		return rat.graphics.ctx;
	};



	/// 
	/// Init rat.graphics
	/// @param {string} canvasID
	/// @suppress {missingProperties | checkTypes}
	/// Again, suppress in favor of a registered init func
	/// 
	rat.graphics.init = function (canvasID)
	{
		var rGraphics = rat.graphics;

		// set the transform up
		rGraphics.mTransform = new rat.Matrix();
		///@todo use canvas object passed to us, don't assume names.
		// pkonneker - passed in an id, and made it default to the old style if none is passed
		//	Don't know if we'd rather just use the canvas object itself instead, though
		rGraphics.canvas = document.getElementById(canvasID);
		if (rat.system.has.Wraith && Wraith.w_onPlatform === "PS4")
		{
			rGraphics.canvas.style = {};
		}
		rGraphics.ctx = rGraphics.canvas.getContext("2d");
		rGraphics.SCREEN_WIDTH = rGraphics.canvas.width;
		rGraphics.SCREEN_HEIGHT = rGraphics.canvas.height;

		rGraphics.winJSAppView = void 0;
		if (rat.system.has.winJS)
			rGraphics.winJSAppView = window.Windows.UI.ViewManagement.ApplicationView;

		// set up a normal window resize callback
		getViewState();
		rat.addOSEventListener(window, 'resize', rGraphics.resizeCallback);
		screenSizeChanged();
	};

	// This is our callback for screen resize events from the browser/os... this is where we first learn about resizes.
	rat.graphics.resizeCallback = function (eventArgs)
	{
		getViewState();

		rat.events.fire("before_resize", eventArgs);
		//console.log("resizeCallback " + rat.graphics.callAutoScale);
		if (rat.graphics.callAutoScale)
			rat.graphics.autoScaleCallback();
	};

	rat.graphics.setAutoClear = function (doAutoClear, autoClearStyle)
	{
		rat.graphics.autoClearCanvas = doAutoClear;
		if (typeof (autoClearStyle !== 'undefined'))
			rat.graphics.autoClearColor = autoClearStyle;
	};

	//	clear canvas to autoclear color
	rat.graphics.clearCanvas = function ()
	{
		var ctx = rat.graphics.getContext();
		if (rat.graphics.autoClearColor === "" || (rat.graphics.Video && rat.graphics.Video.numberOfActiveBGVideos > 0))
			ctx.clearRect(0, 0, rat.graphics.SCREEN_WIDTH, rat.graphics.SCREEN_HEIGHT);
		else
		{
			ctx.fillStyle = rat.graphics.autoClearColor;
			ctx.fillRect(0, 0, rat.graphics.SCREEN_WIDTH, rat.graphics.SCREEN_HEIGHT);
		}
	};

	//	begin a new frame (mostly just for counting and tracking purposes, currently)
	rat.graphics.beginFrame = function ()
	{
		rat.graphics.frameIndex++;
		rat.graphics.frameStats.totalElementsDrawn = 0;

		if (rat.profiler && rat.profiler.beginFrame)
			rat.profiler.beginFrame();
	};

	//	end the current frame
	rat.graphics.endFrame = function ()
	{
		if (rat.profiler && rat.profiler.endFrame)
			rat.profiler.endFrame();
	};

	//
	//	Set global scale for shrinking or expanding rendering
	//	e.g. to fit our larger screen in a smaller space, like my sad laptop.
	//
	rat.graphics.setGlobalScale = function (x, y)
	{
		x = x || 1;
		y = y || 1;
		// Ugh...  this is getting complicated.
		// the problem now is that sometimes the scale isn't changing, e.g. if rat.graphics.autoFillOnResize,
		// but SCREEN_WIDTH and SCREEN_HEIGHT are not being fixed...
		// So, why was this check here, anyway?  If it's needed, better work out some other solution for autoFillOnResize, or check that flag here?
		//if (x !== rat.graphics.globalScale.x ||
		// y !== rat.graphics.globalScale.y )
		{
			rat.graphics.globalScale.x = x;
			rat.graphics.globalScale.y = y;
			//rat.console.log("RAT: Global scale set to " + JSON.stringify(rat.graphics.globalScale));

			//	the idea is to pretend like we have a bigger space than we do.
			//	so, if we're scaling down, scale internal effective screen size variables up.
			rat.graphics.SCREEN_WIDTH = (rat.graphics.canvas.width / rat.graphics.globalScale.x) | 0;
			rat.graphics.SCREEN_HEIGHT = (rat.graphics.canvas.height / rat.graphics.globalScale.y) | 0;

			screenSizeChanged();
		}
	};
	rat.graphics.clearGlobalScale = function ()
	{
		rat.graphics.globalScale.x = void 0;
		rat.graphics.globalScale.y = void 0;
		rat.graphics.SCREEN_WIDTH = rat.graphics.canvas.width;
		rat.graphics.SCREEN_HEIGHT = rat.graphics.canvas.height;
		screenSizeChanged();
	};

	rat.graphics.setGlobalTranslate = function (x, y)
	{
		rat.graphics.globalTranslate = { x: x, y: y };
	};
	rat.graphics.clearGlobalTranslate = function ()
	{
		rat.graphics.globalTranslate = { x: 0, y: 0 };
	};

	//	return true if we're currently applying a global scale
	rat.graphics.hasGlobalScale = function ()
	{
		var gblScale = rat.graphics.globalScale;
		var hasGlobalScale = gblScale.x && gblScale.y && (gblScale.x !== 1.0 || gblScale.y !== 1.0);
		return hasGlobalScale;
	};

	//	and if you want to temporarily ignore global scale and translation (e.g. to match real screen coordinates)...
	//	Use these like this:
	//	rat.graphics.save();
	//	rat.graphics.counterGlobalScale(ctx);
	//	rat.graphics.counterGlobalTranslate(ctx);
	//	... my drawing ...
	//	rat.graphics.restore();
	rat.graphics.counterGlobalScale = function (tctx)
	{
		if (rat.graphics.hasGlobalScale())
			rat.graphics.scale(1 / rat.graphics.globalScale.x, 1 / rat.graphics.globalScale.y, tctx);
	};
	rat.graphics.counterGlobalTranslate = function (tctx)
	{
		if (rat.graphics.globalTranslate)
			rat.graphics.translate(-rat.graphics.globalTranslate.x, -rat.graphics.globalTranslate.y, tctx);
	};

	//	autoscale to an ideal target window size.
	//	this is only used if enabled, and only when window is resized
	rat.graphics.autoScaleCallback = function ()
	{
		var winSize = rat.utils.getWindowSize();
		var scale = winSize.w / rat.graphics.autoTargetSize.w;	//	in order to fit horiz
		var altScale = winSize.h / rat.graphics.autoTargetSize.h;	//	in order to fit vert
		if (altScale < scale)	//	use whichever is smaller
			scale = altScale;

		//	support minimum scale down.
		//	This is useful for things like not scaling down to super-mini-size in snap state.
		if (scale < rat.graphics.minAutoScale)
			scale = rat.graphics.minAutoScale;

		//	Cap scale.  Could change to allow this by default?
		//	It's not a big problem, just not what I want right now.  Anyway, changeable with flag.
		if (!rat.graphics.allowAutoUpscale && scale > 1)
			scale = 1;

		if (rat.graphics.autoResizeCanvas && rat.graphics.canvas)
		{
			var width = math.floor(rat.graphics.autoTargetSize.w * scale);
			var height = math.floor(rat.graphics.autoTargetSize.h * scale);
			var remainingWidth = winSize.w - width;
			var remainingHeight = winSize.h - height;

			//	OK, but for systems like win8, we don't want ugly black bars on the sides...
			if (rat.graphics.autoFillOnResize)
			{
				//	We got as close as we could for game logic to match its internal scale.
				//	Now just fill in any leftover space in canvas, with this new scale.
				//	Note that this leaves rat.graphics.SCREEN_HEIGHT and SCREEN_WIDTH at new values,
				//	(and aspect ratio will have changed)
				//	which the game needs to expect, and do its own centering to deal with.
				//	If you want a simpler solution, consider autoCenterCanvas below
				width = winSize.w;
				height = winSize.h;
			}

			//	check for some incompatible flags...
			if (rat.graphics.autoScaleWithDevicePixelRatio && !rat.graphics.allowAutoUpscale)
			{
				//	scaling to device pixel ratio requires an upscale, usually.
				//	though...  hmm...
				//	TODO:  Get rid of this warning and check below.
				//		Instead, check !allowAutoUpscale below and specifically check if scale is > 1
				//		and if so, limit our scale back down again.
				rat.console.log("WARNING: autoScaleWithDevicePixelRatio is not compatible with rat.graphics.allowAutoUpscale being false.");
			}

			//	on top of all that, factor in device pixel ratio, if requested.
			//	This is to adapt to high-DPI devices,
			//	like a new iPad, or the Helix, or the 2in1 Intel laptop
			//	This is relatively new code, and hasn't been tested on various browsers, host environments,
			//	etc., and I don't know how well it will interact with other flags like centering, max scaling, filling, etc.
			//
			//	It makes things look really nice in Chrome on high-end devices,
			//	at some performance cost.
			//	Also works in IE 10+, with a slightly more noticeable performance cost with lots of text.
			//	Works in Win8 now (see custom code below), but there we have weird clip problems, so not using it in any apps yet.
			//
			if (rat.graphics.autoScaleWithDevicePixelRatio && rat.graphics.allowAutoUpscale)
			{
				var ctx = rat.graphics.canvas.getContext('2d');

				//	BROWSER version
				var devicePixelRatio = window.devicePixelRatio || 1;

				var backingStoreRatio = ctx.webkitBackingStorePixelRatio ||
							ctx.mozBackingStorePixelRatio ||
							ctx.msBackingStorePixelRatio ||
							ctx.oBackingStorePixelRatio ||
							ctx.backingStorePixelRatio || 1;

				//	WINDOWS 8+ implementation
				if (rat.system.has.windows8 && Windows && Windows.Graphics && Windows.Graphics.Display)
				{
					//	see https://github.com/yoik/cordova-yoik-screenorientation/issues/35 for correctly dealing with this in Win 8 and Win8.1,
					//	since things changed!
					var displayInformation = (Windows.Graphics.Display.DisplayInformation) ? Windows.Graphics.Display.DisplayInformation.getForCurrentView() : Windows.Graphics.Display.DisplayProperties;

					if (displayInformation)
					{
						//var logicalDPI = displayInformation.logicalDpi;	//	interesting...
						backingStoreRatio = 100;
						devicePixelRatio = displayInformation.resolutionScale;
					}
				}

				var ratio = devicePixelRatio / backingStoreRatio;
				rat.graphics.canvasPixelRatio = ratio;
				//	todo: support capping this value for performance reasons?

				//	tell style to scale us down to fit in the same browser space
				rat.graphics.canvas.style.width = "" + width + "px";
				rat.graphics.canvas.style.height = "" + height + "px";
				//	but render big!
				width *= ratio;
				height *= ratio;
				scale *= ratio;

				if (ratio !== 1)
				{
					rat.console.log("device pixel ratio " + ratio + " : " + devicePixelRatio + " / " + backingStoreRatio);
				}
			}

			rat.graphics.canvas.width = width;
			rat.graphics.canvas.height = height;

			//	alternatively, accept the black bars, but make sure everything is centered.
			//	(in contrast with autoFillOnResize, which is generally preferred for a few reasons)
			//	This is a new attempt, useful for quicker development.
			//	Makes certain assumptions about html setup.
			if (rat.graphics.autoCenterCanvas)
			{
				var dw = math.floor(remainingWidth / 2);
				var dh = math.floor(remainingHeight / 2);
				rat.graphics.canvas.style["margin-left"] = "" + dw + "px";
				rat.graphics.canvas.style["margin-top"] = "" + dh + "px";
			}

		}

		//	STT moved this here from above 2013.6.6
		//	This is correct, I think, so rat.graphics.SCREEN_xxx is set correctly
		rat.graphics.setGlobalScale(scale, scale);

		rat.console.log("autoScaleCallback: " + scale + " canvas: " + rat.graphics.canvas.width + "," + rat.graphics.canvas.height);
	};

	//	set up automated scaling when user resizes window
	//	This mostly just sets a bunch of globals for how to deal with resizes,
	//	and triggers one call now to force setup.
	rat.graphics.setAutoScaleFromIdeal = function (targetW, targetH, resizeCanvas, allowAutoUpscale)
	{
		//	remember desired values
		rat.graphics.autoTargetSize.w = targetW;
		rat.graphics.autoTargetSize.h = targetH;
		if (typeof resizeCanvas !== 'undefined')
			rat.graphics.autoResizeCanvas = resizeCanvas;
		rat.graphics.allowAutoUpscale = allowAutoUpscale;
		rat.graphics.callAutoScale = true;	//	remember to call autoscale function later on resize event

		//	also call once now just to get things right to start with
		rat.graphics.autoScaleCallback();
	};

	//	This is a set of routines to modify the transformation of the given context.
	//	These will apply the change, but also track it internally so that we can do some extra stuff,
	//	like ask for the current transformation at any given time, do our own transform math, etc.
	//	the ctx argument here is last, so that it can be optional, in which case we use the current rat ctx
	/**
	 * Rotate the current matrix
	 * @param {number} r
	 * @param {Object=} tctx
	 */
	rat.graphics.rotate = function (r, tctx)
	{
		var ctx = tctx || rat.graphics.ctx;
		if (!mIgnoreRatTransform)
			rat.graphics.mTransform.rotateSelf(r);
		ctx.rotate(r);
	};

	/**
	 * Scale the current matrix
	 * @param {number} x
	 * @param {number} y
	 * @param {Object=} tctx
	 */
	rat.graphics.scale = function (x, y, tctx)
	{
		if (y === void 0)
			y = x;
		var ctx = tctx || rat.graphics.ctx;
		if (!mIgnoreRatTransform)
			rat.graphics.mTransform.scaleSelf(x, y);
		ctx.scale(x, y);
	};

	/**
	 * Translate the current matrix
	 * @param {number} x
	 * @param {number} y
	 * @param {Object=} tctx
	 */
	rat.graphics.translate = function (x, y, tctx)
	{
		var ctx = tctx || rat.graphics.ctx;
		if (!mIgnoreRatTransform)
			rat.graphics.mTransform.translateSelf(x, y);
		ctx.translate(x, y);
	};

	rat.graphics.transform = function (m11, m12, m21, m22, dx, dy, tctx)
	{
		if (Array.isArray(m11.m))
			m11 = m11.m;
		if (Array.isArray(m11))
		{
			//	m11, m12, m21, m22, dx, dy, tctx
			//	m11, dx, dy, tctx
			tctx = m22;
			m12 = m11[1][0];
			m21 = m11[0][1];
			m22 = m11[1][1];
			dx = m11[0][2];
			dy = m11[1][2];
			m11 = m11[0][0];
		}
		var ctx = tctx || rat.graphics.ctx;
		if (!mIgnoreRatTransform)
		{
			var m = [[m11, m12, dx], [m21, m22, dy], [0, 0, 1]];
			rat.graphics.mTransform.multSelf(m);// = rat.Matrix.matMult(rat.graphics.mTransform, m);
		}
		ctx.transform(m11, m12, m21, m22, dx, dy);
	};

	rat.graphics.setTransform = function (m11, m12, m21, m22, dx, dy, tctx)
	{
		rat.graphics.resetTransform();
		rat.graphics.transform(m11, m12, m21, m22, dx, dy, tctx);
	};

	/**
	 * Reset the transformation matrix
	 * @param {Object=} tctx
	 */
	rat.graphics.resetTransform = function (tctx)
	{
		var ctx = tctx || rat.graphics.ctx;
		if (!mIgnoreRatTransform)
			rat.graphics.mTransform.loadIdent();
		ctx.setTransform(1, 0, 0, 1, 0, 0);
	};

	/** 
	 * Save the current rendering state
	 * @param {Object=} options  {ignoreRatMat:true}  You can never set ignoreRatMat to false if it was true.  it goes back to false after a .restore
	 */
	rat.graphics.save = function (options)
	{
		var ctx = rat.graphics.ctx;
		options = options || {};
		if (options.ignoreRatMat === void 0)
			options.ignoreRatMat = mIgnoreRatTransform;
		else
		{
			//once ignoreRatMat is set to true, it only goes to false with a restore.  You cannot set it to false with a save!
			options.ignoreRatMat = mIgnoreRatTransform || options.ignoreRatMat || false;
		}
		ctx.save();
		var state = {
			ignoreRatMat: mIgnoreRatTransform,
			transform: void 0
		};
		mIgnoreRatTransform = options.ignoreRatMat;

		//	Get a new version of the .m so that we are not pointing to the same thing
		// We only need to do this if we care about the rat matrix.
		if (!mIgnoreRatTransform)
		{
			state.transform = rat.graphics.mTransform.m;
			rat.graphics.mStateStack.push(state);
			// DON'T POINT at the old matrix.
			var m = rat.graphics.mTransform.m;
			// THIS IS A COPY!
			m = [[m[0][0], m[0][1], m[0][2]],
			 [m[1][0], m[1][1], m[1][2]],
			 [m[2][0], m[2][1], m[2][2]]];
			rat.graphics.mTransform.m = m;
		}
		else
		{
			rat.graphics.mStateStack.push(state);// DON'T POINT at the old matrix.
		}
	};

	/// Restore a saved rendering state
	rat.graphics.restore = function ()
	{
		var ctx = rat.graphics.ctx;
		ctx.restore();
		var state = rat.graphics.mStateStack.pop();
		mIgnoreRatTransform = state.ignoreRatMat;
		if (state.transform)
			rat.graphics.mTransform.m = state.transform;
	};

	rat.graphics.getTransform = function ()
	{
		return rat.graphics.mTransform;
	};

	/** @param {Object=} dest */
	rat.graphics.transformPoint = function (p, dest)
	{
		return rat.graphics.mTransform.transformPoint(p, dest);
	};

	/** Push a gfx profiling mark.   Only works under wraith */
	rat.graphics.pushPerfMark = function (label, ctx)
	{
		if (!ctx)
			ctx = rat.graphics.ctx;
		if (ctx.pushPerfMark)
			ctx.pushPerfMark(label);
	};

	/** Pop off a gfx profiling mark.   Only works under wraith */
	rat.graphics.popPerfMark = function (ctx)
	{
		if (!ctx)
			ctx = rat.graphics.ctx;
		if (ctx.popPerfMark)
			ctx.popPerfMark();

	};

	/**
	 * Draw a line
	 * @param {Object|Number} p1
	 * @param {Object|Number} p2
	 * @param {Object|Number=} p3
	 * @param {Number=} p4
	 */
	rat.graphics.drawLine = function (p1, p2, p3, p4, ops)
	{
		var point1 = { x: 0, y: 0 };
		var point2 = { x: 0, y: 0 };
		if (p1.x !== void 0)
		{
			point1 = p1;
			if (p2.x !== void 0)
			{
				point2 = p2;
				ops = p3;
			}
			else
			{
				point2.x = p2;
				point2.y = p3;
				ops = p4;
			}
		}
		else
		{
			point1.x = p1;
			point1.y = p2;
			if (p3.x !== void 0)
			{
				point2 = p3;
				ops = p4;
			}
			else
			{
				point2.x = p3;
				point2.y = p4;
			}
		}
		var ctx = rat.graphics.ctx;

		if (ops)
		{
			if (ops.color)
				ctx.strokeStyle = ops.color.toString();
			if (ops.lineWidth !== void 0)
				ctx.lineWidth = ops.lineWidth;
		}

		ctx.beginPath();
		ctx.moveTo(point1.x, point1.y);
		ctx.lineTo(point2.x, point2.y);
		ctx.stroke();
	};

	/**
	 * Draw some text
	 * @param {string} text
	 * @param {number=} x
	 * @param {number=} y
	 * @param {number=} maxWidth
	 */
	rat.graphics.drawText = function (text, x, y, maxWidth)
	{
		x = x || 0;
		y = y || 0;
		if (maxWidth)
			rat.graphics.ctx.fillText(text, x, y, maxWidth);
		else
			rat.graphics.ctx.fillText(text, x, y);
	};

	/**
	 * Draw a text in an arc
	 */
	///	 See http://www.html5canvastutorials.com/labs/html5-canvas-text-along-arc-path/
	rat.graphics.drawTextArc = function (str, centerX, centerY, radius, angle, options)
	{
		options = options || {};
		var len;
		if (!angle)
		{
			len = rat.graphics.ctx.measureText(str);
			if (len.width !== void 0)
				len = len.width;
			angle = rat.math.min(len / radius);
			if (options.angleScale)
				angle *= options.angleScale;
		}
		var context = rat.graphics.ctx;

		if (options.stroke)
		{
			if (options.lineWidth)
				context.lineWidth = options.lineWidth;
		}

		var s;
		len = str.length;
		context.save();
		context.translate(centerX, centerY);
		context.rotate(-1 * angle / 2);
		context.rotate(-1 * (angle / len) / 2);
		for (var n = 0; n < len; n++)
		{
			context.rotate(angle / len);
			context.save();
			context.translate(0, -1 * radius);
			s = str[n];
			if (options.stroke)
				context.strokeText(s, 0, 0);
			else
				context.fillText(s, 0, 0);
			context.restore();
		}
		context.restore();
	};

	/**
	 * Draw an open (not filled) circle (rat.shapes.Circle)
	 * @param {Object|number} circ
	 * @param {number=} y
	 * @param {number=} r
	 */
	rat.graphics.drawCircle = function (circ, y, r, ops)
	{
		var ctx = rat.graphics.ctx;
		ctx.beginPath();
		if (circ.center !== void 0)
		{
			ops = y;
			r = circ.radius;
			y = circ.center.y;
			circ = circ.center.x;
		}
		else if (circ.x !== void 0)
		{
			if (circ.r !== void 0)
			{
				ops = y;
				r = circ.r;
				y = circ.y;
				circ = circ.x;
			}
			else
			{
				ops = r;
				r = y;
				y = circ.y;
				circ = circ.x;
			}
		}

		if (ops !== void 0)
		{
			if (ops.color)
			{
				if (ops.fill)
					ctx.fillStyle = ops.color.toString();
				else
					ctx.strokeStyle = ops.color.toString();
			}
			if (!ops.fill && ops.lineWidth !== void 0)
				ctx.lineWidth = ops.lineWidth;
		}
		ctx.arc(circ, y, r, 0, rat.math.PI2, true);
		ctx.closePath();

		if (ops && ops.fill)
			ctx.fill();
		else
			ctx.stroke();
	};

	/**
	 * Draw a rectangle (rat.shapes.Rect)
	 * @param {Object} rect
	 * @param {Object=} ops
	 */
	rat.graphics.drawRect = function (rect, ops)
	{
		ops = ops || {};
		if (ops.fill)
		{
			if (ops.color)
				rat.graphics.ctx.fillStyle = ops.color.toString();
			rat.graphics.ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
		}
		else
		{
			if (ops.lineWidth)
				rat.graphics.ctx.lineWidth = ops.lineWidth;
			if (ops.color)
				rat.graphics.ctx.stokeStyle = ops.color.toString();
			rat.graphics.ctx.strokeRect(rect.x, rect.y, rect.w, rect.h);
		}
	};

	/**
	 * Draw a list of shapes (see r_collision2d)
	 * @param {Array} list
	 */
	rat.graphics.drawShapeList = function (list)
	{
		if (!list || list.length <= 0)
			return;
		var shape;
		for (var index = 0; index !== list.length; ++index)
		{
			shape = list[index];
			switch (shape.type)
			{
				case 'circle':
					rat.graphics.drawCircle(shape);
					break;
				case 'rect':
					rat.graphics.drawRect(shape);
					break;
				default:
					rat.console.log("Unable able to identify shape for drawing\n");
					break;
			}

			//	Draw the children
			rat.graphics.drawShapeList(shape.children);
		}
	};

	//todo	move to simpler rat.color namespace
	//	and another separate module, dang it.

	/**
	 * @constructor
	 * @param {number=} r red
	 * @param {number=} g green
	 * @param {number=} b blue
	 * @param {number=} a optional alpha value (assumed to be 1)
	 */
	rat.graphics.Color = function (r, g, b, a)
	{
		if (typeof r === 'undefined')
		{
			this.r = 255;
			this.g = 255;
			this.b = 255;
			this.a = 1;
		} else if (typeof r === 'string')
		{
			this.copyFrom(rat.graphics.Color.makeFromStyleString(r));
		} else if (r.r !== void 0)
		{
			this.r = r.r;
			this.g = r.g;
			this.b = r.b;
			if (r.a === void 0)	//	still OK to not define a explicitly, in which case it's considered 1
				this.a = 1;
			else
				this.a = r.a;
			this.applyLimits();
		}
		else
		{
			this.r = r;
			this.g = g;
			this.b = b;
			if (a === void 0)	//	still OK to not define a explicitly, in which case it's considered 1
				this.a = 1;
			else
				this.a = a;
			this.applyLimits();
		}
	};

	/**
	 * Multiply this with another color
	 */
	rat.graphics.Color.prototype.mult = function (r, g, b, a, dest)
	{
		if (r.r !== void 0)
		{
			dest = g;
			a = r.a;
			b = r.b;
			g = r.g;
			r = r.r;
		}

		var r = this.r * (r / 255);
		var g = this.g * (g / 255);
		var b = this.b * (b / 255);
		var a = this.a * a;

		if (!dest)
			dest = new rat.graphics.Color(r, g, b, a);
		else
			dest.set(r, g, b, a);
		dest.applyLimits();
		return dest;
	};

	/**
	 * Make sure that all fields of the color respect their limit (0-255, 0-1)
	 */
	rat.graphics.Color.prototype.applyLimits = function ()
	{
		// CLAMP
		if (this.r < 0) this.r = 0;
		else if (this.r > 255) this.r = 255;
			// Floor.  This only works for numbers >= 0
		else this.r = this.r | 0;

		// CLAMP
		if (this.g < 0) this.g = 0;
		else if (this.g > 255) this.g = 255;
			// Floor.  This only works for numbers >= 0
		else this.g = this.g | 0;

		// CLAMP
		if (this.b < 0) this.b = 0;
		else if (this.b > 255) this.b = 255;
			// Floor.  This only works for numbers >= 0
		else this.b = this.b | 0;

		// CLAMP
		if (this.a < 0) this.a = 0;
		else if (this.a > 1) this.a = 1;
	};

	rat.graphics.Color.prototype.toString = function ()
	{
		return "rgba(" + this.r + "," + this.g + "," + this.b + "," + this.a + ")";
	};

	rat.graphics.Color.prototype.setWhite = function ()
	{
		this.r = 255;
		this.g = 255;
		this.b = 255;
		this.a = 1;
	};

	rat.graphics.Color.prototype.setRandom = function ()
	{
		this.r = ((math.random() * 200) | 0) + 54;
		this.g = ((Math.random() * 200) | 0) + 54;
		this.b = ((Math.random() * 200) | 0) + 54;
		this.a = 1;
	};

	rat.graphics.Color.prototype.copy = function ()
	{
		return new rat.graphics.Color(this.r, this.g, this.b, this.a);
	};

	rat.graphics.Color.prototype.set = function (r, g, b, a)
	{
		if (a === void 0)
			a = 1;
		this.r = r;
		this.g = g;
		this.b = b;
		this.a = a;
	};

	rat.graphics.Color.prototype.copyFrom = function (c)
	{
		this.set(c.r, c.g, c.b, c.a);
	};

	rat.graphics.Color.prototype.equal = function (other)
	{
		if (this.r === other.r && this.g === other.g && this.b === other.b && this.a === other.a)
			return true;
		else
			return false;
	};

	rat.graphics.Color.prototype.distanceSq = function (other)
	{
		var dr = this.r - other.r;
		var dg = this.g - other.g;
		var db = this.b - other.b;
		return dr * dr + dg * dg + db * db;
	};

	//	create a new color by interpolating between these colors
	rat.graphics.Color.interp = function (from, to, ival, dest)
	{
		var invIVal = 1 - ival;
		var r = to.r * ival + invIVal * from.r;
		var g = to.g * ival + invIVal * from.g;
		var b = to.b * ival + invIVal * from.b;
		var a = to.a * ival + invIVal * from.a;
		r = ((r < 0) ? 0 : ((r > 255) ? 255 : (r | 0)));
		g = ((g < 0) ? 0 : ((g > 255) ? 255 : (g | 0)));
		b = ((b < 0) ? 0 : ((b > 255) ? 255 : (b | 0)));
		a = ((a < 0) ? 0 : ((a > 1) ? 1 : a));
		if (dest)
		{
			dest.r = r;
			dest.g = g;
			dest.b = b;
			dest.a = a;
		}
		else
		{
			dest = new rat.graphics.Color(r, g, b, a);
		}
		return dest;
	};

	///JHS adding a dest field to avoid new5
	/** @param {Object=} dest */
	rat.graphics.Color.prototype.randomVariance = function (variance, dest)
	{
		//c.r = clamp(color.r + math.random() * variance.r - variance.r/2, 0, 255);
		//var r = this.r + math.randomVariance(variance.r);
		//var g = this.g + math.randomVariance(variance.g);
		//var b = this.b + math.randomVariance(variance.b);
		//var a = this.a + math.randomVariance(variance.a);
		var r = this.r;
		var g = this.g;
		var b = this.b;
		var a = this.a;
		if (variance.r)
		{
			r += (variance.r * 2 * math.random() - variance.r);
			r = ((r < 0) ? 0 : ((r > 255) ? 255 : (r | 0)));
		}
		if (variance.g)
		{
			g += (variance.g * 2 * math.random() - variance.g);
			g = ((g < 0) ? 0 : ((g > 255) ? 255 : (g | 0)));
		}
		if (variance.b)
		{
			b += (variance.b * 2 * math.random() - variance.b);
			b = ((b < 0) ? 0 : ((b > 255) ? 255 : (b | 0)));
		}
		if (variance.a)
		{
			a += (variance.a * 2 * math.random() - variance.a);
			a = ((a < 0) ? 0 : ((a > 1) ? 1 : a));
		}



		if (dest)
		{
			dest.r = r;
			dest.g = g;
			dest.b = b;
			dest.a = a;
		}
		else
		{
			dest = new rat.graphics.Color(r, g, b, a);
		}
		return dest;
	};

	function hsv2rgb(h, s, v)
	{
		h = (h % 1 + 1) % 1; // wrap hue
		if (s > 1)
			s = 1;
		if (v > 1)
			v = 1;

		var i = Math.floor(h * 6),
		f = h * 6 - i,
		p = v * (1 - s),
		q = v * (1 - s * f),
		t = v * (1 - s * (1 - f));

		switch (i)
		{
			case 0: return [v, t, p];
			case 1: return [q, v, p];
			case 2: return [p, v, t];
			case 3: return [p, q, v];
			case 4: return [t, p, v];
			case 5: return [v, p, q];
		}
	}

	rat.graphics.makeColorFromHSV = function (h, s, v)
	{
		var vals = hsv2rgb(h, s, v);
		var c = new rat.graphics.Color(vals[0] * 255, vals[1] * 255, vals[2] * 255);
		c.applyLimits();
		return c;
	};

	//	a bunch of standard colors
	rat.graphics.transparent = new rat.graphics.Color(0, 0, 0, 0.0);
	rat.graphics.black = new rat.graphics.Color(0, 0, 0);
	rat.graphics.white = new rat.graphics.Color(255, 255, 255);
	rat.graphics.gray = new rat.graphics.Color(128, 128, 128);
	rat.graphics.lightGray = new rat.graphics.Color(190, 190, 190);
	rat.graphics.darkGray = new rat.graphics.Color(64, 64, 64);

	rat.graphics.red = new rat.graphics.Color(255, 0, 0);
	rat.graphics.green = new rat.graphics.Color(0, 255, 0);
	rat.graphics.blue = new rat.graphics.Color(0, 0, 255);

	rat.graphics.yellow = new rat.graphics.Color(255, 255, 0);
	rat.graphics.cyan = new rat.graphics.Color(0, 255, 255);
	rat.graphics.violet = new rat.graphics.Color(255, 0, 255);
	rat.graphics.magenta = rat.graphics.violet;

	rat.graphics.lightRed = new rat.graphics.Color(255, 128, 128);
	rat.graphics.darkRed = new rat.graphics.Color(128, 0, 0);

	rat.graphics.lightGreen = new rat.graphics.Color(128, 255, 128);
	rat.graphics.darkGreen = new rat.graphics.Color(0, 128, 0);

	rat.graphics.lightBlue = new rat.graphics.Color(128, 128, 256);
	rat.graphics.darkBlue = new rat.graphics.Color(0, 0, 128);

	rat.graphics.orange = new rat.graphics.Color(255, 128, 0);

	rat.graphics.brown = new rat.graphics.Color(128, 96, 0);
	rat.graphics.darkBrown = new rat.graphics.Color(96, 64, 0);

	//	make a rat color from rgb style string
	rat.graphics.Color.makeFromStyleString = function (hexString)
	{
		var r, g, b;
		r = g = b = 255;
		var a = 1.0;
		if (hexString.charAt(0) === 'r')
		{
			var startIndex = hexString.indexOf('(');
			if (startIndex)	//	make sure
			{
				hexString = hexString.substring(startIndex + 1);
				var nextIndex = hexString.indexOf(',');
				r = parseInt(hexString.substring(0, nextIndex), 10);
				hexString = hexString.substring(nextIndex + 1);

				nextIndex = hexString.indexOf(',');
				g = parseInt(hexString.substring(0, nextIndex), 10);
				hexString = hexString.substring(nextIndex + 1);

				nextIndex = hexString.indexOf(',');
				if (nextIndex < 0)
					nextIndex = hexString.indexOf(')');
				else // there's an alpha value - just grab it now, and let parseFloat ignore trailing ); whatever
					a = parseFloat(hexString.substring(nextIndex + 1));

				b = parseInt(hexString.substring(0, nextIndex), 10);
			}
			//rgba(23, 86, 89, 1)

		} else
		{ // hex string
			if (hexString.charAt(0) === '#')
				hexString = hexString.substring(1, 7);
			r = parseInt(hexString.substring(0, 2), 16);
			g = parseInt(hexString.substring(2, 4), 16);
			b = parseInt(hexString.substring(4, 6), 16);
		}
		return new rat.graphics.Color(r, g, b, a);
	};
	rat.graphics.Color.makeFromHexString = rat.graphics.Color.makeFromStyleString;

	//	return a rat graphics color from a standard style name
	rat.graphics.Color.standard = function (colorName)
	{
		var colors = {
			"aliceblue": "#f0f8ff", "antiquewhite": "#faebd7", "aqua": "#00ffff", "aquamarine": "#7fffd4", "azure": "#f0ffff", "beige": "#f5f5dc",
			"bisque": "#ffe4c4", "black": "#000000", "blanchedalmond": "#ffebcd", "blue": "#0000ff", "blueviolet": "#8a2be2", "brown": "#a52a2a",
			"burlywood": "#deb887", "cadetblue": "#5f9ea0", "chartreuse": "#7fff00", "chocolate": "#d2691e", "coral": "#ff7f50", "cornflowerblue": "#6495ed",
			"cornsilk": "#fff8dc", "crimson": "#dc143c", "cyan": "#00ffff", "darkblue": "#00008b", "darkcyan": "#008b8b", "darkgoldenrod": "#b8860b",
			"darkgray": "#a9a9a9", "darkgreen": "#006400", "darkkhaki": "#bdb76b", "darkmagenta": "#8b008b", "darkolivegreen": "#556b2f",
			"darkorange": "#ff8c00", "darkorchid": "#9932cc", "darkred": "#8b0000", "darksalmon": "#e9967a", "darkseagreen": "#8fbc8f",
			"darkslateblue": "#483d8b", "darkslategray": "#2f4f4f", "darkturquoise": "#00ced1", "darkviolet": "#9400d3", "deeppink": "#ff1493",
			"deepskyblue": "#00bfff", "dimgray": "#696969", "dodgerblue": "#1e90ff", "firebrick": "#b22222", "floralwhite": "#fffaf0",
			"forestgreen": "#228b22", "fuchsia": "#ff00ff", "gainsboro": "#dcdcdc", "ghostwhite": "#f8f8ff", "gold": "#ffd700", "goldenrod": "#daa520",
			"gray": "#808080", "green": "#008000", "greenyellow": "#adff2f", "honeydew": "#f0fff0", "hotpink": "#ff69b4", "indianred ": "#cd5c5c",
			"indigo ": "#4b0082", "ivory": "#fffff0", "khaki": "#f0e68c", "lavender": "#e6e6fa", "lavenderblush": "#fff0f5", "lawngreen": "#7cfc00",
			"lemonchiffon": "#fffacd", "lightblue": "#add8e6", "lightcoral": "#f08080", "lightcyan": "#e0ffff", "lightgoldenrodyellow": "#fafad2",
			"lightgray": "#d3d3d3", "lightgreen": "#90ee90", "lightpink": "#ffb6c1", "lightsalmon": "#ffa07a", "lightseagreen": "#20b2aa",
			"lightskyblue": "#87cefa", "lightslategray": "#778899", "lightsteelblue": "#b0c4de", "lightyellow": "#ffffe0", "lime": "#00ff00",
			"limegreen": "#32cd32", "linen": "#faf0e6", "magenta": "#ff00ff", "maroon": "#800000", "mediumaquamarine": "#66cdaa", "mediumblue": "#0000cd",
			"mediumorchid": "#ba55d3", "mediumpurple": "#9370d8", "mediumseagreen": "#3cb371", "mediumslateblue": "#7b68ee",
			"mediumspringgreen": "#00fa9a", "mediumturquoise": "#48d1cc", "mediumvioletred": "#c71585", "midnightblue": "#191970", "mintcream": "#f5fffa",
			"mistyrose": "#ffe4e1", "moccasin": "#ffe4b5", "navajowhite": "#ffdead", "navy": "#000080",
			"oldlace": "#fdf5e6", "olive": "#808000", "olivedrab": "#6b8e23", "orange": "#ffa500", "orangered": "#ff4500", "orchid": "#da70d6",
			"palegoldenrod": "#eee8aa", "palegreen": "#98fb98", "paleturquoise": "#afeeee", "palevioletred": "#d87093", "papayawhip": "#ffefd5",
			"peachpuff": "#ffdab9", "peru": "#cd853f", "pink": "#ffc0cb", "plum": "#dda0dd", "powderblue": "#b0e0e6", "purple": "#800080",
			"red": "#ff0000", "rosybrown": "#bc8f8f", "royalblue": "#4169e1", "saddlebrown": "#8b4513", "salmon": "#fa8072", "sandybrown": "#f4a460",
			"seagreen": "#2e8b57", "seashell": "#fff5ee", "sienna": "#a0522d", "silver": "#c0c0c0", "skyblue": "#87ceeb", "slateblue": "#6a5acd",
			"slategray": "#708090", "snow": "#fffafa", "springgreen": "#00ff7f", "steelblue": "#4682b4", "tan": "#d2b48c", "teal": "#008080",
			"thistle": "#d8bfd8", "tomato": "#ff6347", "turquoise": "#40e0d0", "violet": "#ee82ee", "wheat": "#f5deb3", "white": "#ffffff",
			"whitesmoke": "#f5f5f5", "yellow": "#ffff00", "yellowgreen": "#9acd32"
		};

		var cName = colorName.toLowerCase();
		if (colors[cName])
			return rat.graphics.Color.makeFromHexString(colors[cName]);

		return rat.graphics.gray;
	};

	//
	//--------- more graphics utils ----------------
	//

	//	@todo: move to graphics utils (separate module)?
	//	maybe r_draw, and call them rat.draw_whatever...?
	//	and rename - what's with the underscore?
	rat.graphics.draw_fillbar = function (x, y, w, h, fillCur, fillTotal, backColor, bodyColor, frameColor)
	{
		var fillPoint = fillCur * w / fillTotal;
		var ctx = rat.graphics.getContext();
		ctx.fillStyle = backColor;
		ctx.fillRect(x, y, w, h);

		ctx.fillStyle = bodyColor;
		ctx.fillRect(x, y, fillPoint, h);

		ctx.lineWidth = 1;
		ctx.strokeStyle = frameColor;
		ctx.strokeRect(x, y, w, h);
	};

	// Don't make or use global functions.
	//draw_fillbar = rat.graphics.draw_fillbar;	//	shorter name for backwards compat

	//	util to make a unilateral polygon (e.g. triangle) shape.
	//	rotate of 0 results in a point on the right hand side
	//	You probably want to call fillPolygon or strokePolygon
	rat.graphics.makePolygonShape = function (centerX, centerY, radius, rotate, sides)
	{
		if (typeof (sides) === 'undefined')
			sides = 3;
		if (typeof (rotate) === 'undefined')
			rotate = 0;
		var rotInc = Math.PI * 2 / sides;

		rat.graphics.ctx.beginPath();
		for (var i = 0; i < sides; i++)
		{
			var x = Math.cos(rotate + i * rotInc) * radius;
			var y = Math.sin(rotate + i * rotInc) * radius;
			if (i === 0)
				rat.graphics.ctx.moveTo(centerX + x, centerY + y);
			else
				rat.graphics.ctx.lineTo(centerX + x, centerY + y);
		}
		rat.graphics.ctx.closePath();
	};

	rat.graphics.fillPolygon = function (centerX, centerY, radius, rotate, sides)
	{
		rat.graphics.makePolygonShape(centerX, centerY, radius, rotate, sides);
		rat.graphics.ctx.fill();
	};

	rat.graphics.strokePolygon = function (centerX, centerY, radius, rotate, sides)
	{
		rat.graphics.makePolygonShape(centerX, centerY, radius, rotate, sides);
		rat.graphics.ctx.stroke();
	};

	rat.graphics.drawMiniArrow = function (x, y, color)
	{
		var ctx = rat.graphics.ctx;

		ctx.strokeStyle = color;
		ctx.lineWidth = 3;
		ctx.beginPath();
		ctx.moveTo(x - 2, y);
		ctx.lineTo(x + 7, y);
		ctx.closePath();
		ctx.stroke();
		ctx.beginPath();

		ctx.lineWidth = 2;
		ctx.moveTo(x + 4, y - 3);
		ctx.lineTo(x + 8, y);
		ctx.lineTo(x + 4, y + 3);
		ctx.closePath();
		ctx.stroke();
	};

	//	Draw arrow.  This is centered near the base of the arrow...
	//	baseX/Y indicate base of arrow
	//	tx/ty indicate target position
	rat.graphics.drawArrow = function (baseX, baseY, tx, ty, fillStyle, strokeStyle, thick)
	{
		var ctx = rat.graphics.ctx;

		var dx = tx - baseX;
		var dy = ty - baseY;
		var s = Math.sqrt(dx * dx + dy * dy);	//	Length.
		var angle = Math.atan2(dy, dx);
		var t = s / 4;
		//if (typeof thick !== 'undefined')
		//	t = thick;

		rat.graphics.save();
		rat.graphics.translate(baseX, baseY);
		rat.graphics.rotate(angle);

		ctx.beginPath();
		ctx.moveTo(-t, -t);
		ctx.lineTo(-t, t);
		ctx.lineTo(t, t);
		ctx.lineTo(t, 2 * t);
		ctx.lineTo(3 * t, 0);
		ctx.lineTo(t, -2 * t);
		ctx.lineTo(t, -t);
		ctx.closePath();
		ctx.fillStyle = fillStyle;
		ctx.fill();
		ctx.lineWidth = 1;
		ctx.strokeStyle = strokeStyle;
		ctx.stroke();

		rat.graphics.restore();
	};

	//	these suck, and are placeholder for more useful functions
	rat.graphics.drawPlus = function ()
	{
		var ctx = rat.graphics.ctx;
		ctx.fillStyle = "#70B070";
		ctx.fillRect(-7, -3, 14, 6);
		ctx.fillRect(-3, -7, 6, 14);
	};

	rat.graphics.drawMinus = function ()
	{
		var ctx = rat.graphics.ctx;
		ctx.fillStyle = "#C07070";
		ctx.fillRect(-7, -3, 14, 6);
		//ctx.fillRect(-3, -7, 6, 14);
	};

	//	draw parallelogram
	//	upper left position
	//	this is a pretty customized function for Jared, but might be useful in general.
	//	"fillAmount" (0-1) indicates how far up from the bottom to draw the parallelogram, which is a little weird.
	//	"angle" is in radians
	rat.graphics.drawParallelogram = function (x, y, w, h, angle, fillStyle, fillAmount)
	{
		if (typeof (fillAmount) === 'undefined')
			fillAmount = 1;
		if (fillAmount === 0)
			return;

		var ctx = rat.graphics.ctx;

		var xShift = Math.tan(angle) * h;

		var topX = (x + xShift * (1 - fillAmount));
		var topY = (y + (1 - fillAmount) * h);

		ctx.beginPath();
		ctx.moveTo(topX, topY);
		ctx.lineTo(topX + w, topY);

		ctx.lineTo(x + w + xShift, y + h);
		ctx.lineTo(x + xShift, y + h);
		ctx.closePath();

		ctx.fillStyle = fillStyle;
		ctx.fill();

		//ctx.lineWidth = 1;
		//ctx.strokeStyle = strokeStyle;
		//ctx.stroke();

	};

	/**
	 * Draws the line segment or arc.
	 * @param {{center:{x:number, y:number}, radius:number, startAngle:number, endAngle:number, anticlockwise:boolean}|{point1:{x:number, y:number},point2:{x:number, y:number}}} segment represents the arc or strait line.
	 * @param {string|Object} color of the segment.
	 * @param {number=} width of the segment.
	 */
	rat.graphics.drawSegmentOrArc = function (segment, color, width)
	{
		if (color.toString())
			color = color.toString();
		width = width || 1;
		var ctx = rat.graphics.ctx;
		ctx.beginPath();
		if (segment.type === "arc")
			// We are drawing an arc
			ctx.arc(segment.center.x, segment.center.y, segment.radius, segment.startAngle, segment.endAngle, segment.anticlockwise);
		else
		{
			// Line segment
			ctx.moveTo(segment.point1.x, segment.point1.y);
			ctx.lineTo(segment.point2.x, segment.point2.y);
			ctx.closePath();
		}
		//rat.graphics.save();
		ctx.lineWidth = width;
		ctx.strokeStyle = color;
		ctx.stroke();
		//rat.graphics.restore();
	};

	/**
	 * Setup the matrix to have any global translation or scale wanted by the game.
	 */
	rat.graphics.setupMatrixForRendering = function ()
	{
		if (rat.graphics.globalTranslate)
			rat.graphics.translate(rat.graphics.globalTranslate.x, rat.graphics.globalTranslate.y);
		if (rat.graphics.hasGlobalScale())
			rat.graphics.scale(rat.graphics.globalScale.x, rat.graphics.globalScale.y);
	};
});

//
//	Input handling.
//
//	This includes
//		handling input events (keyboard, mouse, touch, controller, whatever)
//		dispatching of input events through screens
//		translation of UI events
//		tracking "allowed controller"
//		associating controllers (and, indirectly, users) with events
//
//	An example scenario for "allowed" tracking
//		Two players sit in front of a single-player game.
//		Each has NUI tracking and a gamepad.  Only one player's inputs should be allowed.
//		The other player then picks up the first player's controller.  Now only his inputs should be allowed.
//		Weird, I know.
//
//	controller IDs are tracked differently depending on system.
//	On a browser, and other systems by default, mouse+keyboard are ID 0
//	On an Xbox, controller ID is the Xbox Controller ID
//	We do not track indices, in case one input is added or another removed.

//	Rat events vs. system events:
//		Once events come in from the system, we create a "ratEvent", which usually includes the original
//		system event ("sysEvent"), and some extra info.  We pass that rat event around from then on,
//		instead of a raw system event.
//		This lets us pass extra rat-specific and augmentive data around with the event,
//		and doesn't require us to modify the system event, which really should be read only.
//

// Uses:
// rat.system, rat.graphics, rat.screenManager, rat.audio
rat.modules.add( "rat.input.r_input",
[
	"rat.debug.r_console",
	"rat.os.r_system",
	"rat.math.r_math",
	"rat.utils.r_utils",
	"rat.graphics.r_graphics",
	"rat.input.r_voice",
	"rat.input.r_keyboard",
], 
function(rat)
{	
	//rat.console.log("SLD rat.input");
	rat.input = {};
	
	var useLEGamepadAPI = false;
	var fakeGamepadAPI = false;

	//  this is the beginning of an attempt to track input type used by the user
	//  and automate a few things more nicely by looking at that.
	//  For instance, if the user is actively using keyboard to navigate UI,
	//      then we should select a button by default in an input map.
	//      But if they're using the mouse, we should not, so it won't highlight before they mouse over it.
	//  This feature is not yet thoroughly implemented.  Feel free to work on it!  :)
	//  (for now, I'm trying to get mouse/keyboard swapping to work well)
	//  Note that this just tracks UI input for now, since a mouse+keyboard combo may be desired,
	//  and we don't want to keep flopping modes, and it's easier to understand what UI navigation inputs are.
	//  Also, this feature has to be turned on explicitly, since a particular game may not want this at all,
	//  e.g. if they use arrow keys for something other than UI tracking, and mouse for UI.
	//
	//  Right now we assume ANY mouse input means use mouse UI.
	//
	//  This is actually pretty complicated... if the game doesn't support full keyboard UI,
	//      then this doesn't work well, 'cause mouse movement resets to mouse mode.
	rat.input.useLastUIInputType = false;
	rat.input.lastUIInputType = 'mouse';  //  'mouse', 'keyboard', 'controller', 'voice'

	// allow holding a button down to continue getting the same event - currently only checked in XBO the keyboard seems to handle
	// things differently and forces out a new event no matter what without checking previous states
	rat.input.allowRepeatEvents = {
		buttons: false,  /// I think most games don't want buttons to repeat.
		directions: true /// but almost all games do want directions to repeat
	};

	rat.input.allowedControllers = [];				//	which controller inputs are allowed to trigger standard UI events.  blank list = allow all.

	//	this "active controller" concept is questionable - what about local multiplayer?   Use your own userIDs and controllerIDs instead
	rat.input.activeControllerID = 0;				//	by default, keyboard/mouse

	/**
	 * Array of currently connected controllers
	 * @type Array.<rat.input.Controller>
	 */
	rat.input.controllers = [];
	rat.input.controllers.getByID = function (id)
	{
		for (var index = 0; index < rat.input.controllers.length; ++index)
		{
			if (rat.input.controllers[index].id === id)
				return rat.input.controllers[index];
		}
		return void 0;
	};
	
	//	fake controller inputs from keyboard?  See below.
	rat.input.gamepadKeyFakeEnabled = false;

	//	standard rat button definitions; in order to generically support controllers independent of system
	rat.input.BUTTON_UP = 0x00000001;		//	simple mapped inputs, could be from dpad or from (left) stick
	rat.input.BUTTON_DOWN = 0x00000002;
	rat.input.BUTTON_LEFT = 0x00000004;
	rat.input.BUTTON_RIGHT = 0x00000008;

	rat.input.BUTTON_START = 0x00000010;
	rat.input.BUTTON_SELECT = 0x00000020;

	rat.input.BUTTON_A = 0x00000100;
	rat.input.BUTTON_B = 0x00000200;
	rat.input.BUTTON_C = 0x00000400;
	rat.input.BUTTON_D = 0x00000800;
	rat.input.BUTTON_X = rat.input.BUTTON_C;
	rat.input.BUTTON_Y = rat.input.BUTTON_D;

	rat.input.BUTTON_LT = 0x00001000;
	rat.input.BUTTON_LB = 0x00002000;
	rat.input.BUTTON_RT = 0x00004000;
	rat.input.BUTTON_RB = 0x00008000;

	rat.input.BUTTON_DPAD_UP = 0x00010000;		//	these are explicitly from a dpad; not ever mapped from stick
	rat.input.BUTTON_DPAD_DOWN = 0x00020000;
	rat.input.BUTTON_DPAD_LEFT = 0x00040000;
	rat.input.BUTTON_DPAD_RIGHT = 0x00080000;
	
	rat.input.BUTTON_LEFT_STICK = 0x00100000;
	rat.input.BUTTON_RIGHT_STICK = 0x00200000;
	
	rat.input.BUTTON_LSTICK_UP		= 0x01000000;
	rat.input.BUTTON_LSTICK_DOWN	= 0x02000000;
	rat.input.BUTTON_LSTICK_LEFT	= 0x04000000;
	rat.input.BUTTON_LSTICK_RIGHT	= 0x08000000;
	rat.input.BUTTON_RSTICK_UP		= 0x10000000;
	rat.input.BUTTON_RSTICK_DOWN	= 0x20000000;
	rat.input.BUTTON_RSTICK_LEFT	= 0x40000000;
	rat.input.BUTTON_RSTICK_RIGHT	= 0x80000000;

	rat.input.BUTTON_COUNT = 32;	//	bits/buttons supported

	// gamePadAPI button mapping (matches the gamepad.buttons order)
	// Axis/button mapping came from here
	// http://www.html5rocks.com/en/tutorials/doodles/gamepad/
	// Says index 1 is button 2 and index 2 is button 3 even though it's pointing is switched from that.
	// But testing the gamepad at http://html5gamepad.com/
	// in Chrome Version 35.0 and Firefox 30.0 shows that B is 1 and X is 2.
	rat.input.GAMEPAD_CONTROLLER_MAPPING = {
		//	Order matches the order the gamepad.buttons field
		//	positive values are in the buttons array
		//	negative values are in the axes array and negative one (not zero) based.
		BUTTON_A: 0,
		BUTTON_B: 1,
		BUTTON_C: 2,
		BUTTON_X: 2,// Same as C
		BUTTON_D: 3,
		BUTTON_Y: 3,// Same as D
		BUTTON_LB: 4,
		BUTTON_RB: 5,
		BUTTON_LT: 6,
		BUTTON_RT: 7,
		BUTTON_SELECT: 8,
		BUTTON_START: 9,
		BUTTON_LEFT_STICK: 10,
		BUTTON_RIGHT_STICK: 11,
		BUTTON_DPAD_UP: 12,
		BUTTON_DPAD_DOWN: 13,
		BUTTON_DPAD_LEFT: 14,
		BUTTON_DPAD_RIGHT: 15,
		leftStick: {
			x: -1,
			y: -2
		},
		rightStick: {
			x: -3,
			y: -4,
		},
		leftTrigger: 6,
		rightTrigger: 7
	};

	/**
	 * Enum for controller change type
	 */
	rat.input.ControllerChangeType = {
		REMOVED: 0,
		ADDED: 1,
		UPDATED: 2
	};

	/**
	 * @suppress {missingProperties}
	 */
	rat.input.init = function ()
	{
		// Polling is running... Yet
		var rInput = rat.input;
		var rHas = rat.system.has;
		rInput.controllers.pollingForced = false;
		rInput.controllers.pollingAllowed = false;

		//	TODO: break this out into xbox specific source module
		if(rHas.xbox)
		{
			rInput.controllers.pollingAllowed = true;
			rInput.controllers.pollingForced = true;
			//window.Windows.Xbox.Input.Controller.addEventListener("controlleradded", function(e){
			//});
			//window.Windows.Xbox.Input.Controller.addEventListener("controllerremoved", function(e){
			//});
			var xboxGamepadSort = function (a, b)
			{
				if (!a.user && !b.user)
					return 0;
				else if (!a.user)
					return 1;
				else if (!b.user)
					return -1;
				else
					return b.id - a.id;
			};
			rInput.controllers.getSystemControllers = function ()
			{
				var gamepads = window.Windows.Xbox.Input.Gamepad.gamepads;
				
				//	Get gamepads as a true array
				if (Array.isArray(gamepads) === false)
				{
					var newList = [];
					for (var index = gamepads.length - 1; index >= 0; --index)
						newList.unshift(gamepads[index]);
					gamepads = newList;
				}

				//	Sort
				//	User controllers first.
				gamepads.sort(xboxGamepadSort);

				return gamepads;
			};

			//	user-to-controller pairing change event, which we're required to 'reflect'
			//	see XR 30, I think.
			//Windows.Xbox.Input.Controller.addEventListener("controllerpairingchanged", onControllerPairingChanged);
			//Windows.Xbox.Input.Controller.removeEventListener("controllerpairingchanged", onControllerPairingChanged);

			//Windows.Xbox.Input.Controller.removeEventListener("controlleradded", rat.input.onControllerAdded);
		}
		else if(rHas.xboxLE)
		{
			if (useLEGamepadAPI)
			{
				rInput.controllers.pollingAllowed = true;
				//	Process all current controllers
				function onConnectedControllersChanged(eventArgs)
				{
					rat.console.log( "Connected Controllers changed" );
					eventArgs.gamepad = eventArgs.gamepad || {};
					eventArgs.gamepad.user = eventArgs.gamepad.user || {};
					var sysGP = {
						id: eventArgs.gamepad.id,
						index: eventArgs.gamepad.id,
						connected: !eventArgs.removed,
						hasReading: false,
						reading: void 0,
						timestamp: eventArgs.timestamp || Date.now()
					};
									
					//	Get the rat version of the controller
					var ratGP = rInput.buildRatControllerObject("xle", sysGP);
					if (sysGP.connected)
						rInput.onControllerChange(rInput.ControllerChangeType.ADDED, ratGP);
					else
						rInput.onControllerChange(rInput.ControllerChangeType.REMOVED, ratGP);
				}

				Ormma.addEventListener( MAPLE_EVENT_GAMEPAD_READING_CHANGED, function(eventArgs)
				{
					rat.console.log( "Left stick " + eventArgs.reading.leftThumbstickX + ", " + eventArgs.reading.leftThumbstickY );
					if (eventArgs.reading.isAPressed)
						rat.console.log( "A" );
					eventArgs.target.user = eventArgs.target.user || {};
					var sysGP = {
						id: eventArgs.target.id,
						index: eventArgs.target.id,
						connected: true,
						hasReading: true,
						reading: eventArgs.reading,
						timestamp: Date.now()
					};
					var ratGP = rInput.buildRatControllerObject("xle", sysGP);
					rInput.onControllerChange(rInput.ControllerChangeType.UPDATED, ratGP);
				});
				
				var list = Ormma.getGamepads();
				var event = {
					removed: false,
					gamepad: void 0,
					timestamp: Date.now()
				};
				var gp;
				for( var i = 0; i < list.length; ++i )
				{
					event.gamepad = list[i];
					onConnectedControllersChanged( event );
				}
				Ormma.addEventListener( MAPLE_EVENT_GAMEPADS_CHANGED, onConnectedControllersChanged );
			}
		}
			//	include gamepad support if we are not getting it from the xbox
		else if(rHas.gamepadAPI)
		{
			rInput.controllers.pollingAllowed = true;
			if(rHas.gamepadAPIEvent)
			{
				window.addEventListener("gamepadconnected", rInput.onSysControllerAdded);
				window.addEventListener("gamepaddisconnected", rInput.onSysControllerRemoved);
			}
			else
				rInput.controllers.pollingForced = true;

			//	Assign the function that we use to get the controller list
			var nav = navigator;
			var platformGetGamepadsFunc = nav.getGamepads ||
							nav.mozGetGamepads ||
							nav.webkitGetGamepads ||
							function ()
							{
								return nav.gamepads ||
									   nav.mozGamepads ||
									   nav.webkitGamepads ||
										[];
							};
			var getGamepadsFunc = platformGetGamepadsFunc;
			
			//  Derek: For builds that names controllers of the same type with the same id, append the controller id with the index.
			if(rat.system.has.chromeBrowser)
			{
				getGamepadsFunc = function()
				{
					var gamepads = platformGetGamepadsFunc.call(this);
					var gamepadsWithUniqueId = [];
					
					for(var i = 0; i < gamepads.length; ++i) {
						var gamepad = gamepads[ i ];
						if(gamepad != null) {
							var gamepadWithUniqueId = {}; // Since the system's gamepad data cannot be modified, copy the data to a new object.
							for(var key in gamepad) {
								gamepadWithUniqueId[ key ] = gamepad[ key ];
							}
							gamepadWithUniqueId.id += gamepadWithUniqueId.index; // Modify the id to make it unique.
							gamepadsWithUniqueId.push(gamepadWithUniqueId);
						}
						else {
							gamepadsWithUniqueId.push(null);
						}
					}
					
					return gamepadsWithUniqueId;
				};
			}
							
			var wraithGamepadSort = function(a, b)
			{
				return (!a) ? -1 : (!b) ? 1 : b.index - a.index;
			};
			
			rInput.controllers.getSystemControllers = function ()
			{
				var gamepads = getGamepadsFunc.call(nav);

				//	Get gamepads as a true array
				if (Array.isArray(gamepads) === false)
				{
					var newList = [];
					for (var index = gamepads.length - 1; index >= 0; --index)
						newList.unshift(gamepads[index]);
					gamepads = newList;
				}

				//	optional fake gamepad support
				if (rat.input.gamepadKeyFakeEnabled && !rat.console.state.consoleActive )
				{
					gamepads.push(rat.input.buildGamepadKeyFake());
				}

				//////////////////////////////////////////////////
				/// Most of the time we sort the gamepad list
				//	Sort the list of gamepads from the system by their index (higher indexes go last)
				if (!rat.system.has.Wraith)
				{
					gamepads = gamepads.sort(wraithGamepadSort);
				}

				return gamepads;
			};
		}
		else
		{
			rInput.controllers.pollingAllowed = true;
			rInput.controllers.pollingForced = true;
			fakeGamepadAPI = true;
			rInput.controllers.getSystemControllers = function ()
			{
				var gamepads = [];
				if (rat.input.gamepadKeyFakeEnabled)
				{
					gamepads.push(rat.input.buildGamepadKeyFake());
				}
				return gamepads;
			}
		}
	};

	//	add mouse handler to get called whenever we get any mouse or translated touch event,
	//	right before it's handed off to the screen manager.
	//	This is useful for filtering out click events for some reason (return true to indicate handled)
	//	or for getting clicks outside our UI space, etc.
	rat.input.setMouseHandler= function (callback)
	{
		rat.input.mouseHandler = callback;
	};

	// translate XBO gamepad inputs into out rat input style
	/**
	 * @param {?} gamepadInput
	 * @suppress {missingProperties}
	 */
	//rat.input.translateGamepadToInput = function (gamepadInput)
	//{
	//	// PMM since theres only one input couldn't we turn this into a hash instead for easier access?
	//	var translate = [
	//				{ from: Windows.Xbox.Input.GamepadButtons.dpadUp, to: rat.input.BUTTON_UP | rat.input.BUTTON_DPAD_UP },
	//				{ from: Windows.Xbox.Input.GamepadButtons.dpadDown, to: rat.input.BUTTON_DOWN | rat.input.BUTTON_DPAD_DOWN },
	//				{ from: Windows.Xbox.Input.GamepadButtons.dpadLeft, to: rat.input.BUTTON_LEFT | rat.input.BUTTON_DPAD_LEFT },
	//				{ from: Windows.Xbox.Input.GamepadButtons.dpadRight, to: rat.input.BUTTON_RIGHT | rat.input.BUTTON_DPAD_RIGHT },

	//				{ from: Windows.Xbox.Input.GamepadButtons.a, to: rat.input.BUTTON_A },
	//				{ from: Windows.Xbox.Input.GamepadButtons.b, to: rat.input.BUTTON_B },
	//				{ from: Windows.Xbox.Input.GamepadButtons.x, to: rat.input.BUTTON_X },
	//				{ from: Windows.Xbox.Input.GamepadButtons.y, to: rat.input.BUTTON_Y },

	//				{ from: Windows.Xbox.Input.GamepadButtons.leftShoulder, to: rat.input.BUTTON_LB },
	//				{ from: Windows.Xbox.Input.GamepadButtons.rightShoulder, to: rat.input.BUTTON_RB },

	//				{ from: Windows.Xbox.Input.GamepadButtons.view, to: rat.input.BUTTON_SELECT },
	//				{ from: Windows.Xbox.Input.GamepadButtons.menu, to: rat.input.BUTTON_START }
	//	];

	//	for(var tIndex = 0; tIndex < translate.length; tIndex++)
	//	{
	//		if(gamepadInput === translate[tIndex].from)
	//			return translate[tIndex].to;
	//	}
	//	return null;
	//};

	// translate XBO keyboard inputs into our rat inputs
	/**
	 * @param {?} keyboardInput
	 * @suppress {missingProperties}
	 */
	var winJSKeyTranslations = {};
	if (window.WinJS)
	{
		var winJSKeys = window.WinJS.Utilities.Key;
		winJSKeyTranslations[winJSKeys.gamepadDPadUp] = rat.input.BUTTON_DPAD_UP;
		winJSKeyTranslations[winJSKeys.gamepadDPadDown] = rat.input.BUTTON_DPAD_DOWN;
		winJSKeyTranslations[winJSKeys.gamepadDPadLeft] = rat.input.BUTTON_DPAD_LEFT;
		winJSKeyTranslations[winJSKeys.gamepadDPadRight] = rat.input.BUTTON_DPAD_RIGHT;
		
		winJSKeyTranslations[winJSKeys.gamepadLeftThumbstickUp] = rat.input.BUTTON_LSTICK_UP;
		winJSKeyTranslations[winJSKeys.gamepadLeftThumbstickDown] = rat.input.BUTTON_LSTICK_DOWN;
		winJSKeyTranslations[winJSKeys.gamepadLeftThumbstickLeft] = rat.input.BUTTON_LSTICK_LEFT;
		winJSKeyTranslations[winJSKeys.gamepadLeftThumbstickRight] = rat.input.BUTTON_LSTICK_RIGHT;
		
		winJSKeyTranslations[winJSKeys.gamepadRightThumbstickUp] = rat.input.BUTTON_RSTICK_UP;
		winJSKeyTranslations[winJSKeys.gamepadRightThumbstickDown] = rat.input.BUTTON_RSTICK_DOWN;
		winJSKeyTranslations[winJSKeys.gamepadRightThumbstickLeft] = rat.input.BUTTON_RSTICK_LEFT;
		winJSKeyTranslations[winJSKeys.gamepadRightThumbstickRight] = rat.input.BUTTON_RSTICK_RIGHT;
		
		winJSKeyTranslations[winJSKeys.gamepadA] = rat.input.BUTTON_A;
		winJSKeyTranslations[winJSKeys.gamepadB] = rat.input.BUTTON_B;
		winJSKeyTranslations[winJSKeys.gamepadX] = rat.input.BUTTON_X;
		winJSKeyTranslations[winJSKeys.gamepadY] = rat.input.BUTTON_Y;
		
		winJSKeyTranslations[winJSKeys.gamepadLeftShoulder] = rat.input.BUTTON_LB;
		winJSKeyTranslations[winJSKeys.gamepadRightShoulder] = rat.input.BUTTON_RB,
		
		winJSKeyTranslations[winJSKeys.gamepadLeftTrigger] = rat.input.BUTTON_LT;
		winJSKeyTranslations[winJSKeys.gamepadRightTrigger] = rat.input.BUTTON_RT,

		winJSKeyTranslations[winJSKeys.gamepadLeftTrigger] = rat.input.BUTTON_LT;
		winJSKeyTranslations[winJSKeys.gamepadRightTrigger] = rat.input.BUTTON_RT,

		winJSKeyTranslations[winJSKeys.gamepadView] = rat.input.BUTTON_SELECT;
		winJSKeyTranslations[winJSKeys.gamepadMenu] = rat.input.BUTTON_START,
		
		winJSKeyTranslations[winJSKeys.gamepadLeftThumbstick] = rat.input.BUTTON_LEFT_STICK;
		winJSKeyTranslations[winJSKeys.gamepadRightThumbstick] = rat.input.BUTTON_RIGHT_STICK;
	};
	rat.input.translateKeyToInput = function (keyboardInput)
	{
		var winJSKeys = window.WinJS.Utilities.Key;
		var found = winJSKeyTranslations[keyboardInput];
		if (found)
		{
			//rat.console.log( "LE Found keyboard->Controller input translation" );
			//rat.console.log( "   " + keyboardInput + "->" + found );
			if (found == rat.input.BUTTON_DPAD_UP || found == rat.input.BUTTON_LSTICK_UP)
				found |= rat.input.BUTTON_UP;
			if (found == rat.input.BUTTON_DPAD_DOWN || found ==rat.input.BUTTON_LSTICK_DOWN)
				found |= rat.input.BUTTON_DOWN;
			if (found == rat.input.BUTTON_DPAD_LEFT || found ==rat.input.BUTTON_LSTICK_LEFT)
				found |= rat.input.BUTTON_LEFT;
			if (found == rat.input.BUTTON_DPAD_RIGHT || found ==rat.input.BUTTON_LSTICK_RIGHT)
				found |= rat.input.BUTTON_RIGHT;
		}
		else
			found = null;
		return found;
	};

	//	Update input handling.
	rat.input.update = function (dt)
	{
		var rInput = rat.input;
		//	Update the controllers if we need to.
		if(rInput.controllers.pollingAllowed &&
			(rInput.controllers.pollingForced || rInput.controllers.length > 0))
		{
			rInput.updateControllers(dt);
		}
		//	update keyboard.
		rat.input.keyboard.update(dt);
	};

		//	debounce buttons (find which are new)
	rat.input.debounceButtons = function (cont)
	{
		cont.newButtons = cont.rawButtons & ~cont.lastButtons;
		cont.lastButtons = cont.rawButtons;
	};

	// Get a controller by its ID
	rat.input.getControllerByID = function (id)
	{
		var controller;
		for (var ecIndex = 0; ecIndex < rat.input.controllers.length; ecIndex++)
		{
			controller = rat.input.controllers[ecIndex];
			if (controller.id === id)
				return controller;
		}
		return void 0;
	};

	//	get "current" active single player controller.  This is pretty questionable, but let's do it for now,
	//	until we have better code for really knowing which user is playing, and which controller is his.
	rat.input.getActiveController = function ()
	{
		//	if no controllers, return null
		if(rat.input.controllers.length <= 0)
			return null;

		//	First, try to find the currently set active controller
		var ecIndex;
		if (rat.input.activeControllerID !== 0)
		{
			for (ecIndex = 0; ecIndex < rat.input.controllers.length; ecIndex++)
			{
				if (rat.input.controllers[ecIndex].id === rat.input.activeControllerID)
					return rat.input.controllers[ecIndex];
			}
		}

		//	If we cannot find it, or if we don't have an active controller
		//	temp - handle the case of no active controller id by returning the first one.
		//	NOT good for long-term use.  TODO: fix this.  tighten up allowed/active controllers.
		var found = void 0;
		for (ecIndex = 0; ecIndex < rat.input.controllers.length; ecIndex++)
		{
			if (!found || found.index > rat.input.controllers[ecIndex].index)
				found = rat.input.controllers[ecIndex];
		}

		//	Return the controller with the lowest index
		return found;
	};

	function accumulateControllerInput( masterObject, addedObject )
	{
		masterObject.lastButtons |= addedObject.lastButtons;
		masterObject.newButtons |= addedObject.newButtons;
		masterObject.rawButtons |= addedObject.rawButtons;

		masterObject.leftStick.x += addedObject.leftStick.x;
		masterObject.leftStick.y += addedObject.leftStick.y;
		masterObject.rightStick.x += addedObject.rightStick.x;
		masterObject.rightStick.y += addedObject.rightStick.y;
		if (addedObject.leftTrigger > masterObject.leftTrigger)
			masterObject.leftTrigger = addedObject.leftTrigger;
		if (addedObject.rightTrigger > masterObject.rightTrigger)
			masterObject.rightTrigger = addedObject.rightTrigger;
		// handle averaging left and right stick? trigger buttons?
	};
	
	function normalizeStick( stick )
	{
		stick.x = rat.math.clamp( stick.x, -1, 1 );
		stick.y = rat.math.clamp( stick.y, -1, 1 );
		var len = rat.math.sqrt(stick.x * stick.x + stick.y * stick.y);
		if (len > 1)
		{
			stick.x /= len;
			stick.y /= len;
		}
	}
	
	rat.input.getCombinedControllers = function ( controllerIdList )
	{
		//	if no controllers, return null
		if(rat.input.controllers.length <= 0)
			return null;
			
		var combinedControllerObj = new rat.input.Controller({}, "COMBINED", -1, true, 0);
				
		// if there is no passed in controller list, then make the list the allowed controllers
		if( !controllerIdList || controllerIdList.length === 0 )
			controllerIdList = rat.input.allowedControllers;
			
		if( controllerIdList && controllerIdList.length > 0 )
		{
			for (var i = 0; i < controllerIdList.length; i++)
			{
				var cntrl = rat.input.controllers.getByID(controllerIdList[i]);
				accumulateControllerInput(combinedControllerObj, cntrl);
				
			}
		}
		else if( rat.input.allowedControllers.length === 0 || rat.input.activeControllerID === 0 )
		{
			// if no list was passed in and all controllers are allowed, the list will still be empty, so handle that case
			for (var j = 0; j < rat.input.controllers.length; j++)
				accumulateControllerInput(combinedControllerObj, rat.input.controllers[j]);
		}
		
		normalizeStick( combinedControllerObj.leftStick );
		normalizeStick( combinedControllerObj.rightStick );

		return combinedControllerObj;
	};
	
	rat.input.getActiveControllerID = function ()
	{
		//	if no controllers, return null
		var controller = rat.input.getActiveController();

		if(!controller)
			return null;

		return controller.id;
	};

	//	Set the active controller ID
	rat.input.setActiveControllerID = function ( id )
	{
		id = id || 0;
		if (!id)
		{
			rat.console.log("Cleared active controller");
			rat.input.activeControllerID = id;
			return true;
		}
		else
		{
			for (var cIndex = 0; cIndex < rat.input.controllers.length; cIndex++)
			{
				if (rat.input.controllers[cIndex].id === id)
				{
					rat.console.log("Setting active controller to " + id);
					rat.input.activeControllerID = id;
					return true;
				}
			}
		}
		
		rat.console.log("WARNING! Attempting to set active controller ID for controller "+ id +" which cannot be found in the system" );
		rat.input.activeControllerID = 0;
		return false;
	};

	rat.input.getActiveControllerRawButtons = function ()
	{
		var buttons = 0;
		var controller = rat.input.getActiveController();
		if(controller)
			buttons = controller.rawButtons;
		return buttons;
	};

	//
	//	Get mouse position relative to context.
	//	This factors in browser differences...
	//http://answers.oreilly.com/topic/1929-how-to-use-the-canvas-and-draw-elements-in-html5/
	//http://developer.appcelerator.com/question/55121/html5-canvas-drawing-in-webview
	//
	rat.input.getRealMousePosition = function (e)
	{
		var pos = new rat.Vector();

		if(e.pageX || e.pageY)
		{
			pos.x = e.pageX;
			pos.y = e.pageY;
		}
		else
		{
			pos.x = e.clientX + document.body.scrollLeft +
					document.documentElement.scrollLeft;
			pos.y = e.clientY + document.body.scrollTop +
					document.documentElement.scrollTop;
		}
		pos.x -= rat.graphics.canvas.offsetLeft;
		pos.y -= rat.graphics.canvas.offsetTop;

		//	apply global translation
		if(rat.graphics.globalTranslate)
		{
			pos.x -= rat.graphics.globalTranslate.x;
			pos.y -= rat.graphics.globalTranslate.y;
		}

		//	apply global scale if there is one
		//	(this goes backwards because the user is moving in screen space and needs to be translated out to our virtual space)
		if (rat.graphics.hasGlobalScale())
		{
			pos.x /= rat.graphics.globalScale.x / rat.graphics.canvasPixelRatio;
			pos.y /= rat.graphics.globalScale.y / rat.graphics.canvasPixelRatio;
		}

		//	keep constant track of last known global (within context) mouse pos
		rat.mousePos.x = pos.x;
		rat.mousePos.y = pos.y;

		return pos;
	};

	//	see if this controller id is in our list of allowed controller ids
	rat.input.controllerIDAllowed = function (id)
	{
		if(rat.input.allowedControllers.length === 0)	//	no list means all allowed
			return true;

		for(var i = 0; i < rat.input.allowedControllers.length; i++)
		{
			if(rat.input.allowedControllers[i] === id)
				return true;
		}
		return false;
	};

	// check the current controllers to see if the ID matches any of them
	/**
	 * @param {?} id
	 * @suppress {missingProperties}
	 */
	rat.input.controllerIDValid = function (id)
	{
		// check gamepads
		var gamepads = window.Windows.Xbox.Input.Gamepad.gamepads;
		for(var i = 0; i < gamepads.size; i++)
		{
			var gamepad = gamepads[i];
			if(gamepad.id === id)
				return true;
		}

		// check other controllers??

		// didn't find any current controllers with this ID -> it must have disconnected!
		return false;
	};

	/// Get the which value from a system event object
	rat.input.getEventWhich = function (e)
	{
		if (rat.system.has.xbox )
		{
			//	Several keys on the xbox map to strange values.  We fix that mapping here.
			switch( e.which )
			{
				case 222: return 220;
				case 223: return 192;
				case 192: return 222;
			}
		}
		return e.which || 0;
	};

	/**
	 * Create a new rat event object
	 * @param {?} sysEvent
	 * @param {Object=} options
	 * @constructor
	 */
	rat.input.Event = function (sysEvent, options)
	{
		this.sysEvent = sysEvent;
		options = options || {};
		sysEvent = sysEvent || {};

		if (options.translatedFrom)
		{
			var savedSysEvent = options.translatedFrom.sysEvent;
			options.translatedFrom.sysEvent = void 0;
			rat.utils.extendObject(this, [options.translatedFrom], false);
			options.translatedFrom.sysEvent = savedSysEvent;

			this.translatedFrom = options.translatedFrom;

			//	Allow overwriting the which value
			if (options.which !== void 0)
				this.which = options.which;
		}

		//	Set this AFTER we extended so we can override anything we copied.
		this.eventType = options.type || '';

		if (this.controllerID === void 0)
			this.controllerID = sysEvent.deviceSessionId || sysEvent.controllerID || options.defaultControllerID || 0;
		if (this.index === void 0)
			this.index = options.index || 0;
		if (this.which === void 0)
		{
			this.which = options.which;
			if (this.which === void 0)
				this.which = rat.input.getEventWhich( sysEvent );
		}
		if (this.repeat === void 0)
			this.repeat = options.repeat || false;
	};


	//	if this controller's inputs suggest it, then dispatch events
	rat.input.checkAndDispatchControllerEvents = function (controller, dt)
	{
		//	Here is the place to NOT dispatch events for non-allowed controllers
		if(!rat.input.controllerIDAllowed(controller.id))
			return;

		var ratEvent = void 0;
		//	Type and which are set later
		var btnFlag;
		var btnStr;
		var fullStr = "00000000";
		var bIndex;

		//	If any are newly pressed or released, re-set the repeat timer.
		if (controller.rawButtons !== controller.lastButtons || controller.rawButtons === 0)
			controller.repeatTimer.fullReset();
		else
			controller.repeatTimer.elapsed(dt);

		//	Fire all the new button events
		if(controller.newButtons)
		{
			for(bIndex = 0; bIndex < rat.input.BUTTON_COUNT; bIndex++)
			{
				btnFlag = (1 << bIndex);
				if((controller.newButtons & btnFlag) !== 0)
				{
					btnStr = btnFlag.toString(16);
					btnStr = fullStr.substr(fullStr.length - btnStr.length - 1) + btnStr;

					//	Create the first time only.
					ratEvent = ratEvent || new rat.input.Event({ controllerID: controller.id }, { index: controller.index });

					//	Fire the appropriate event.
					ratEvent.eventType = 'buttondown';
					ratEvent.which = btnFlag;
					//rat.console.log("Firing " + ratEvent.eventType + " for btn 0x" + btnStr);
					rat.input.dispatchEvent(ratEvent);
				}
			}
		}

		//	Find out which buttons just got released by comparing raw with last
		var isDown, wasDown;
		if(controller.rawButtons !== controller.lastButtons)
		{
			for(bIndex = 0; bIndex < rat.input.BUTTON_COUNT; bIndex++)
			{
				btnFlag = (1 << bIndex);
				isDown = (controller.rawButtons & btnFlag) !== 0;
				wasDown = (controller.lastButtons & btnFlag) !== 0;
				if(wasDown === true && isDown === false)
				{
					//btnStr = btnFlag.toString(16);
					//btnStr = fullStr.substr(fullStr.length - btnStr.length - 1) + btnStr;

					//	Create the first time only.
					ratEvent = ratEvent || new rat.input.Event({ controllerID: controller.id }, { index: controller.index });

					//	Fire the appropriate event.
					ratEvent.eventType = 'buttonup';
					ratEvent.which = btnFlag;
					//rat.console.log("Firing " + ratEvent.eventType + " for btn " + btnFlag.toString(16));
					rat.input.dispatchEvent(ratEvent);
				}
			}
		}


		//	Now trigger repeat events if the timers allow it
		var repeatButtons = controller.repeatTimer.buttons <= 0 && rat.input.allowRepeatEvents.buttons;
		var repeatDirections = controller.repeatTimer.directions <= 0 && rat.input.allowRepeatEvents.directions;
		if (repeatButtons || repeatDirections)
		{
			var ops = {};
			if (repeatButtons)
				ops.buttons = true;
			if (repeatDirections)
				ops.directions = true;
			controller.repeatTimer.repeatReset(ops);

			if (ratEvent)
				ratEvent.repeat = true;
			for (bIndex = 0; bIndex < rat.input.BUTTON_COUNT; bIndex++)
			{
				btnFlag = (1 << bIndex);
				isDown = (controller.rawButtons & btnFlag) !== 0;
				if (!isDown)
					continue;
				var isDirection = (btnFlag & (rat.input.BUTTON_UP | rat.input.BUTTON_DOWN | rat.input.BUTTON_LEFT | rat.input.BUTTON_RIGHT)) !== 0;
				if ((isDirection && !repeatDirections) ||
					(!isDirection && !repeatButtons))
					continue;

				//	Create the first time only.
				if (!ratEvent)
				{
					ratEvent = new rat.input.Event({ controllerID: controller.id }, { index: controller.index });
					ratEvent.repeat = true;
				}

				ratEvent.eventType = 'buttondown';
				ratEvent.which = btnFlag;
				rat.input.dispatchEvent(ratEvent);
			}
		}
	};

	//	People who want to handle events from rat
	var eventHandlers = [];
	
	//	Add a new event handler
	/** @param {Object=} thisObj */
	rat.input.registerEventHandler = function (func, thisObj)
	{
		if (func)
			eventHandlers.push({ func: func, thisObj: thisObj });
	};

	//	Remove an event handler
	/** @param {Object=} thisObj */
	rat.input.unRegisterEventHandler = function (func, thisObj)
	{
		if (func)
		{
			for (var index = 0; index !== eventHandlers.length; ++index)
			{
				if (eventHandlers[index].func === func && eventHandlers[index].thisObj === thisObj)
				{
					eventHandlers.splice(index, 1);
					return;
				}
			}
		}
	};

	//	Dispatch this event to screen manager
	//	Try sending event.  If it's not handled, translate to UI event and try again.
	//	(this is the main job of this function).
	// PMM: for good measure I added checks so we can let the caller know if the event was consumed by this dispatch
	rat.input.dispatchEvent = function (ratEvent)
	{
		//	First pass.  Let everyone try to handle the raw event
		var handler;
		for (var index = -1; index !== eventHandlers.length; ++index)
		{
			if (index === -1)
			{
				if (rat.console.state.consoleAllowed)
					handler = { func: rat.console.handleEvent };
				else
					continue;
			}
			else
				handler = eventHandlers[index];

			//	If it is handled, abort.
			if (handler.func.call(handler.thisObj, ratEvent))
				return true;
		}

		//	If it wasn't handled yet, see if this can be interpreted as UI input,
		//  and if so, try again (dispatch again)
		if (ratEvent.eventType !== "ui")
		{
			var uiEvent = rat.input.translateToUIEvent(ratEvent);
			if (uiEvent)
				return rat.input.dispatchEvent(uiEvent);
		}

		return false;
	};

	//	process this key event and make sure event.which has the key code in it, regardless of browser.
	//	TODO:  Is it OK to modify the system event like this?  Instead move this value to rat event,
	//		which already is set up to have a copy of "which"
	rat.input.standardizeKeyEvent = function (event)
	{
		//	see http://unixpapa.com/js/key.html which seems to be definitive
		//	and http://stackoverflow.com/questions/7542358/actual-key-assigned-to-javascript-keycode
		//	and http://stackoverflow.com/questions/4471582/javascript-keycode-vs-which among others

		if(event.which === null)
		{
			if(event.charCode)
				event.which = event.charCode;
			else if(event.keyCode)
				event.which = event.keyCode;
			else
				event.which = 0;	//	special key of some kind... ignore - could be shift/control key, for instance, for a keypress
		}
		//else {
		//	event.which is OK
		//}
	};

	//	give me a character code from this event
	//	(useful instead of hard-coded key codes)
	//	also note:  use keypress when you can, since it works better with non-US keyboards
	//	assumes standardizeKeyEvent has been called, or event.which is otherwise valid
	rat.input.charCodeFromEvent = function (event)
	{
		return String.fromCharCode(event.which).toLowerCase();
	};

	/**
	 * Convert a mouse event to a rat mouse event
	 * @param {?} e systemEventObject
	 * @param {string} eventType
	 * @param {boolean=} isFromTouch  Is this a touch event.
	 * @suppress {missingProperties} 
	 */
	rat.input.mouseToRatEvent = function (e, eventType, isFromTouch)
	{
		isFromTouch = isFromTouch || false;
		var pos = rat.getRealMousePosition(e);
		rat.graphics.cursorPos.x = pos.x;
		rat.graphics.cursorPos.y = pos.y;

		//	set up a rat event, with system event attached.
		//	This is a cleaner approach than tacking my own variables on to
		//	a system event, which really ought to be read-only.
		var ratEvent = new rat.input.Event(e, { type: eventType, defaultControllerID: 'mouse' });
		ratEvent.pos = pos;
		ratEvent.isFromTouch = isFromTouch;//	remember if this was translated from touch
		if (e.pointerId !== void 0)
			ratEvent.pointerID = e.pointerId;
		else
			ratEvent.pointerID = -1;

		//	handle touch radius stuff...
		if(isFromTouch)
		{
			// units are not documented...  Let's say they're pixels
			//	pick a decent default for finger size.
			//	This is totally kludged.  Should be based on tons of things, like pixel density on device...
			var defRadius = 12;
			//	factor in UI scale
			if(rat.graphics.hasGlobalScale())
				defRadius /= rat.graphics.globalScale.x / rat.graphics.canvasPixelRatio;

			var rx = e.webkitRadiusX;
			if(!rx || rx === 1)	//	this is not very useful
				rx = defRadius;
			ratEvent.touchRadiusX = rx;
			var ry = e.webkitRadiusY;
			if(!ry || ry === 1)	//	this is not very useful
				ry = defRadius;
			ratEvent.touchRadiusY = ry;
		}

		//	check for custom global mouse handler (See setMouseHandler above)
		if(rat.input.mouseHandler)
		{
			var res = rat.input.mouseHandler(ratEvent);
			if(res)	//	handled
				return;
		}

		rat.input.dispatchEvent(ratEvent);
		//rat.screenManager.dispatchEvent(ratEvent);
	};

	//	my built-in event handling functions
	rat.input.onMouseMove = function (e)
	{
		//	this is a little bit of a kludge.
		//	TODO:  Figure this out.  But I already spent hours on it...
		//	In Win 8, we get mouse move events on the whole screen even when app bar is active.
		//		but we don't get mouse up/down, which ends up looking pretty broken (buttons highlight but don't click)
		//		and it causes other problems.
		//		So, support explicit appbar check here...
		//	What would be a lot better would be to GET the dang down/up events for space outside the appbar div itself,
		//	but I can't figure out how to get those events.  They just get eaten by the system.  :(
		//	TODO:  Look at WinJS code?  For whatever reason, it must be calling preventDefault, or otherwise not passing on that event,
		//		but why it does it for up/down and not for move, I have no idea.
		if (rat.input.appBar && !rat.input.appBar.hidden)
			return;

		//  track what was last used.  Note:  This could instead be set when the user clicks on a UI element,
		//  instead of any mouse motion?  But probably any mouse movement right now means don't be assuming keyboard UI.
		//  see useLastUIInputType
		rat.input.lastUIInputType = 'mouse';

		e.preventDefault();
		var isTouch = e.pointerType === "touch" || e.pointerType === 0x00000002 || e.pointerType === 0x00000003;
		rat.input.mouseToRatEvent(e, 'mousemove', isTouch);
	};
	rat.input.onMouseDown = function (e)
	{
		if (rat.input.appBar && !rat.input.appBar.hidden)
			return;
		e.preventDefault();
		var isTouch = e.pointerType === "touch" || e.pointerType === 0x00000002 || e.pointerType === 0x00000003;
		rat.input.mouseToRatEvent(e, 'mousedown', isTouch);
	};
	rat.input.onMouseUp = function (e)
	{
		if (rat.input.appBar && !rat.input.appBar.hidden)
			return;
		e.preventDefault();
		var isTouch = e.pointerType === "touch" || e.pointerType === 0x00000002 || e.pointerType === 0x00000003;
		rat.input.mouseToRatEvent(e, 'mouseup', isTouch);
	};

	rat.input.onMouseWheel = function (e)
	{
		var event = window.event || e; // old IE support

		//	calculate a number of clicks.
		//	See http://www.javascriptkit.com/javatutors/onmousewheel.shtml among other descriptions of how this works.
		//	This has changed over time.  Various browsers return various scales and values.
		//	This could use some more research.  Find out what the latest standard is (maybe "wheel"?)
		//	and use that.  Note that even then, the values returned are inconsistent...
		//	chrome returns in "wheelDelta" 120 per click, +120 being up
		//	We normalize to 1 per click, and we treat +1 as "up")
		//
		var delta = 0;
		if (event.wheelDelta)
			delta = event.wheelDelta / (120);
		else if (event.deltaY)
			delta = -event.deltaY/3;
		else if (event.detail !== void 0)
			delta = -event.detail;
		else
			delta = 0;

		//console.log("delta " + delta + "(" + event.wheelDelta + ")");

		var ratEvent = new rat.input.Event(e, { type: 'mousewheel', defaultControllerID: 'mouse' });
		ratEvent.wheelDelta = delta;
		rat.input.dispatchEvent(ratEvent);
	};

	rat.input.onKeyPress = function (e)
	{
		e.char = e.char || String.fromCharCode(e.keyCode || e.charCode);
		if (!e.char)
			return;
		//e.preventDefault();
		var ratEvent = new rat.input.Event(e, { type: 'keypress', defaultControllerID: 'keyboard' });
		var handled = rat.input.dispatchEvent(ratEvent);
		if( handled && !ratEvent.allowBrowserDefault )
			e.preventDefault();
	};

	rat.input.onKeyDown = function (e)
	{
		//e.preventDefault();
		//console.log("key down " + e.which);
		// update keyboard info if applicable
		rat.input.keyboard.handleKeyDown(e);			//	track keyboard state
		var ratEvent = new rat.input.Event(e, { type: 'keydown', defaultControllerID: 'keyboard' });
		var handled = rat.input.dispatchEvent(ratEvent);

		// update key presses for gamepad info if applicable
		if (!useLEGamepadAPI)
		{
			if (e.deviceSessionId && rat.system.has.xboxLE)
			{
				var ourController = rat.input.getControllerInfo(e.deviceSessionId);
				if(ourController)
					rat.input.handleGamepadDownEvent(ratEvent, ourController);
			}
		}
		
		if (handled && !ratEvent.allowBrowserDefault)
			e.preventDefault();
	};

	rat.input.onKeyUp = function (e)
	{
		//e.preventDefault();
		//console.log("key up " + e.which);
		rat.input.keyboard.handleKeyUp(e);
		var ratEvent = new rat.input.Event(e, { type: 'keyup', defaultControllerID: 'keyboard' });
		var handled = rat.input.dispatchEvent(ratEvent);

		if (!useLEGamepadAPI)
		{
			//update key presses for gamepad info if applicable	NOTE: we may want to check to see if dispatched used the event, otherwise we risk doing 2 events.
			if (e.deviceSessionId && rat.system.has.xboxLE)
			{
				var ourController = rat.input.getControllerInfo(e.deviceSessionId);
				if(ourController)
					rat.input.handleGamepadUpEvent(ratEvent, ourController);
			}
		}
		
		if (handled && !ratEvent.allowBrowserDefault)
			e.preventDefault();
	};

	// given a sessionId on a 'keyboard' device, find which controller the sessionID belongs to and then get our rat representation of that controllers inputs
	/** @suppress {checkTypes} */
	rat.input.getControllerInfo = function (sessionId)
	{
		var controller;
		if(rat.system.has.xbox)
		{				// I believe that this only gets called via XBO anyways, but this is precautionary just in case
			try
			{
				var inputManager = window.Windows.Xbox.Input.ControllerInputManager();
				controller = inputManager.getControllerFromIndex(sessionId);
			}
			catch(err)
			{
				rat.console.log("r_input err'd: " + err.message);
			}
		}
		else if(rat.system.has.xboxLE)
		{
			
			// when in an LE we dont get user specific controllers, so make a controller up
			controller = { id: 0xDEADBEEF + sessionId, user: {} };
		}

		if(!controller)
			return null;

		//	find associated controller we're tracking.
		var ourControllerIndex = -1;
		for(var ecIndex = 0; ecIndex < rat.input.controllers.length; ecIndex++)
		{
			if(rat.input.controllers[ecIndex].id === controller.id)
			{
				ourControllerIndex = ecIndex;
				break;
			}
		}
		if(ourControllerIndex < 0)	//	not found - add to list
		{
			// Xbox LE specific code, probably want to rename it so it is less specific?
			var newController = rat.input.buildRatControllerObject("xle", { type: 'gamepad', id: controller.id, user: controller.user, rawButtons: 0, newButtons: 0, lastButtons: 0 });
			rat.input.controllers.push(newController);
			ourControllerIndex = rat.input.controllers.length - 1;
		}
		var ourController = rat.input.controllers[ourControllerIndex];

		return ourController;
	};

	// when continuing a series of gameloads we may want to force the controllers to be the same IDs and indicies they were the last time we loaded the game
	// making a version specific to XBO LE's for now
	// TODO: Fix to work with all game types
	rat.input.setControllerInfoByIndex = function (controllerId, index)
	{
		if(rat.system.has.xboxLE)
		{
			if(typeof controllerId === typeof "")
				controllerId = parseInt(controllerId);
			var newController = rat.input.buildRatControllerObject("xle", { type: 'gamepad', id: controllerId, user: {}, rawButtons: 0, newButtons: 0, lastButtons: 0 });
			rat.input.controllers[index] = newController;
		}
	};
	
	// given a sessionId on a 'keyboard' device, find which controller the sessionID belongs to and then get our rat representation of that controllers inputs
	rat.input.clearAllControllerButtons = function ()
	{
		//rat.input.controllers.push({ type: 'gamepad', id: controller.id, user: controller.user, rawButtons: 0, newButtons: 0, lastButtons: 0 });
		var controller;
		for(var ecIndex = 0; ecIndex < rat.input.controllers.length; ecIndex++)
		{
			controller = rat.input.controllers[ecIndex];
			controller.rawButtons = 0;
			controller.newButtons = 0;
			controller.lastButtons = 0;
			controller.repeatTimer.fullReset();
		}
	};

	// got a keyboard down event from the event system, but it's for a gamepad!
	rat.input.handleGamepadDownEvent = function (ratEvent, controller)
	{
		var ratInput = rat.input.translateKeyToInput(ratEvent.which);
		if(ratInput)
		{
			var isDirection = (ratInput & (rat.input.BUTTON_UP | rat.input.BUTTON_DOWN | rat.input.BUTTON_LEFT | rat.input.BUTTON_RIGHT)) !== 0;
			var repeatAllowed = isDirection ? rat.input.allowRepeatEvents.directions : rat.input.allowRepeatEvents.buttons;

			// if its not a repeated event, or we allow repeat events, then set the button in newButtons again
			if (repeatAllowed || !(controller.rawButtons & ratInput))
				controller.newButtons = ratInput;
			else
				controller.newButtons = 0;

			controller.rawButtons |= ratInput;
			controller.repeatTimer.fullReset();
			
			// if (isDirection)
			// {
				// var u = ((controller.rawButtons & rat.input.BUTTON_LSTICK_UP) !== 0) ? 1 : 0;
				// var d = ((controller.rawButtons & rat.input.BUTTON_LSTICK_DOWN) !== 0) ? 1 : 0;
				// var l = ((controller.rawButtons & rat.input.BUTTON_LSTICK_LEFT) !== 0) ? 1 : 0;
				// var r = ((controller.rawButtons & rat.input.BUTTON_LSTICK_RIGHT) !== 0) ? 1 : 0;
				// var report = "LS: " + r + u + l + d;
				// u = ((controller.rawButtons & rat.input.BUTTON_RSTICK_UP) !== 0) ? 1 : 0;
				// d = ((controller.rawButtons & rat.input.BUTTON_RSTICK_DOWN) !== 0) ? 1 : 0;
				// l = ((controller.rawButtons & rat.input.BUTTON_RSTICK_LEFT) !== 0) ? 1 : 0;
				// r = ((controller.rawButtons & rat.input.BUTTON_RSTICK_RIGHT) !== 0) ? 1 : 0;
				// report += "  RS: " + r + u + l + d;
				// u = ((controller.rawButtons & rat.input.BUTTON_DPAD_UP) !== 0) ? 1 : 0;
				// d = ((controller.rawButtons & rat.input.BUTTON_DPAD_DOWN) !== 0) ? 1 : 0;
				// l = ((controller.rawButtons & rat.input.BUTTON_DPAD_LEFT) !== 0) ? 1 : 0;
				// r = ((controller.rawButtons & rat.input.BUTTON_DPAD_RIGHT) !== 0) ? 1 : 0;
				// report += "  DP: " + r + u + l + d;
				// rat.console.log( report );
			// }
		}
		if(ratInput)
			rat.input.checkAndDispatchControllerEvents(controller, 0);
	};
	// got a keyboard up event from the events system, but its for a gamepad!
	rat.input.handleGamepadUpEvent = function (ratEvent, controller)
	{
		var ratInput = rat.input.translateKeyToInput(ratEvent.which);
		if(ratInput)
		{
			controller.rawButtons &= ~ratInput;
			controller.newButtons = 0;
			controller.repeatTimer.fullReset();
		}
		// we don't need to dispatch button ups do we? (yet)
		//if (ratInput)
		//	rat.input.checkAndDispatchControllerEvents(controller, 0);
	};

	// On devices which do not set a position for touch events, copy over the touch position.
	rat.input.setTouchPositionOnEvent = function (touch, e)
	{
		// TODO: See how this works on Windows 8
		var newE = rat.utils.copyObject(e);
		//	if there's ever a specific pageX and pageY for the individual touch, use that.
		//	This is important for events with multiple touchChanges, in which case we must get
		//	the unique position values from there!
		//	If there's no such value, leave the pageX pageY values we had.
		if (touch.pageX !== void 0 || touch.pageY !== void 0)
		//if(!e.clientX && e.pageX === 0 && e.pageY === 0 && (touch.pageX !== 0 || touch.pageY !== 0))
		{
			newE.pageX = touch.pageX;
			newE.pageY = touch.pageY;
		}
		if (touch.identifier !== void 0)
			newE.pointerId = touch.identifier;
		else if (e.pointerId !== void 0)
			newE.pointerId = e.pointerId;
		return newE;
	};

	/* jshint -W082 */ //	Allow this function in a conditional
	function handleTouch(e)
	{
		var transEvent = 'mousedown';

		if (e.type === 'touchmove') transEvent = 'mousemove';
		else if (e.type === 'touchstart') transEvent = 'mousedown';
		else if (e.type === 'touchend') transEvent = 'mouseup';
		
		e.preventDefault();
		//var line = "" + e.type + " frame " + rat.graphics.frameIndex + ": ";
		for (var i = 0; i !== e.changedTouches.length; ++i)
		{
			var touch = e.changedTouches[i];
			var newE = rat.input.setTouchPositionOnEvent(touch, e);
			rat.input.mouseToRatEvent(newE, transEvent, true);

			//line += "   " + touch.identifier + "(" + (touch.pageX|0) + "," + (touch.pageY|0) + ")";
		}
		//console.log(line);
	}

	//	automatically hook up a bunch of standard UI handling functions to events.
	rat.input.autoHandleEvents = function ()
	{
		//	keys
		rat.addOSKeyEventListener(window, 'keydown', rat.input.onKeyDown, false);
		rat.addOSKeyEventListener(window, 'keyup', rat.input.onKeyUp, false);
		rat.addOSKeyEventListener(window, 'keypress', rat.input.onKeyPress, false);
		
		//	handle pointer/mouse events, including multi-touch
		
		//	This solution is extensively tested now in Chrome, IE10+, and Windows 8 Host.
		//	Don't rewrite this without retesting those!
		
		//	If the navigator says it's going to give us MSPointer events, fine, listen to those.
		//	Those will come for mouse and touch and pen.
		//	This is the case for IE10+ and for Windows 8 host
		//	TODO:  IE11 changes these to "pointermove", etc., and threatens to take the old names away.
		if (navigator.msPointerEnabled || typeof (Windows) !== 'undefined')
		{
			//console.log("listening for MS Pointer");
			
			// MS specific pointer stuff
			rat.addOSEventListener(window, 'MSPointerMove', rat.input.onMouseMove, false);
			rat.addOSEventListener(window, 'MSPointerDown', rat.input.onMouseDown, false);
			rat.addOSEventListener(window, 'MSPointerUp', rat.input.onMouseUp, false);
		}
		else	//	otherwise, listen explicitly for mouse events, and touch separately
		{
			//console.log("listening for mouse");
			
			//	listen for mouse
			rat.addOSEventListener(window, 'mousemove', rat.input.onMouseMove, false);
			rat.addOSEventListener(window, 'mousedown', rat.input.onMouseDown, false);
			rat.addOSEventListener(window, 'mouseup', rat.input.onMouseUp, false);
		
			//	listen for touch
			
			//	Under wraith, document.body does not exist.  In addition, we don't need the touch events
			//	As wraith will fire them as mousemoves.
			if (document.body)	
			{
				//console.log("listening for touches");
				
				document.body.addEventListener('touchmove', handleTouch, false);
				document.body.addEventListener('touchstart', handleTouch, false);
				document.body.addEventListener('touchend', handleTouch, false);
				
				/*	OLD duplicated code which was hard to work with.
					remove when the above has been tested.
				document.body.addEventListener('touchmove', function (e)
				{
					e.preventDefault();
					var line = "tm frame " + rat.graphics.frameIndex + ": ";
					for (var i = 0; i !== e.changedTouches.length; ++i)
					{
						var touch = e.changedTouches[i];
						//	just pass on to mouse handler
						e = rat.input.setTouchPositionOnEvent(touch, e);
						rat.input.mouseToRatEvent(e, 'mousemove', true);
						
						line += "   " + touch.identifier + "(" + (touch.pageX|0) + "," + (touch.pageY|0) + ")";
					}
					console.log(line);
				}, false);
				document.body.addEventListener('touchstart', function (e)
				{
					e.preventDefault();
					var line = "ts frame " + rat.graphics.frameIndex + ": ";
					for (var i = 0; i !== e.changedTouches.length; ++i)
					{
						var touch = e.changedTouches[i];
						e = rat.input.setTouchPositionOnEvent(touch, e);
						rat.input.mouseToRatEvent(e, 'mousedown', true);
						
						line += "   " + touch.identifier + "(" + (touch.pageX|0) + "," + (touch.pageY|0) + ")";
					}
					console.log(line);
				}, false);
				document.body.addEventListener('touchend', function (e)
				{
					e.preventDefault();
					var line = "te frame " + rat.graphics.frameIndex + ": ";
					for (var i = 0; i !== e.changedTouches.length; ++i)
					{
						var touch = e.changedTouches[i];
						e = rat.input.setTouchPositionOnEvent(touch, e);
						rat.input.mouseToRatEvent(e, 'mouseup', true);
						
						line += "   " + touch.identifier + "(" + (touch.pageX|0) + "," + (touch.pageY|0) + ")";
					}
					console.log(line);
				}, false);
				*/
			}
		}
		
		/*
		//	suppress drag?  Not working...
		// do nothing in the event handler except canceling the event
		rat.graphics.canvas.ondragstart = function(e) {
			if (e && e.preventDefault) { e.preventDefault(); }
			if (e && e.stopPropagation) { e.stopPropagation(); }
			return false;
		}

		// do nothing in the event handler except canceling the event
		rat.graphics.canvas.onselectstart = function(e) {
			if (e && e.preventDefault) { e.preventDefault(); }
			if (e && e.stopPropagation) { e.stopPropagation(); }
			return false;
		}
		*/

		//	mouse wheel
		
		//	firefox support (see https://developer.mozilla.org/en-US/docs/Web/Events/wheel)
		if (rat.system.has.firefoxBrowser)
		{
			//rat.addOSEventListener(window, 'DOMMouseScroll', rat.input.onMouseWheel, false);
			rat.addOSEventListener(window, 'wheel', rat.input.onMouseWheel, false);
		} else {
			rat.addOSEventListener(window, 'mousewheel', rat.input.onMouseWheel, false);
		}
	};

	rat.input.translateGamePadKeys = void 0;

	/**
	 * return ui event if successful translation.
	 * otherwise, return null
	 * @suppress {missingProperties} - This is needed to avoid warnings baout k.* variables
	 */
	//	util to translate key to ui event
	function translateKeyToUI(which)
	{
		
		//	support any custom translations that were set up.
		//	Do these first so an app can completely override default stuff if needed.
		//	TODO:  Hmm... these are just keyboard.  So, either name this appropriately,
		//		or add a "type" field to the structure below (maybe assume keyboard if not specified)
		/*
		How to use this:  for now, just set it directly in your app.  Something like this:
			rat.input.customUIEventTranslations = [
				{which: rat.keys.w, result: 'up'},
				{which: rat.keys.a, result: 'left'},
				{which: rat.keys.s, result: 'down'},
				{which: rat.keys.d, result: 'right'},
				{which: rat.keys.space, result: 'enter'},
			];
		*/
		if (rat.input.customUIEventTranslations)
		{
			for (var i = 0; i < rat.input.customUIEventTranslations.length; i++)
			{
				var trans = rat.input.customUIEventTranslations[i];
				if (which === trans.which)
					return trans.result;
			}
		}

		//	TODO: rename these to rat.input.uiLeft or something...
		if(which === rat.keys.leftArrow) return 'left';
		if(which === rat.keys.upArrow) return 'up';
		if(which === rat.keys.rightArrow) return 'right';
		if(which === rat.keys.downArrow) return 'down';
		if(which === rat.keys.enter) return 'enter';
		if(which === rat.keys.esc || which === rat.keys.backspace) return 'back';
		if (which === rat.keys.leftSys || which === rat.keys.rightSys) return 'menu';
		if (which === rat.keys.selectKey) return 'view';

		//	I prefer "enter" to "select" because select sometimes means "highlight".  "act" or "press" or something would also be OK.

		if(rat.system.has.xbox && rat.input.translateGamePadKeys)	//	only translate these if we were asked to
		{
			var k = window.WinJS.Utilities.Key;
			if(which === k.gamepadDPadLeft || which === k.gamepadLeftThumbstickLeft) return 'left';
			if(which === k.gamepadDPadUp || which === k.gamepadLeftThumbstickUp) return 'up';
			if(which === k.gamepadDPadRight || which === k.gamepadLeftThumbstickRight) return 'right';
			if(which === k.gamepadDPadDown || which === k.gamepadLeftThumbstickDown) return 'down';
			if(which === k.gamepadA) return 'enter';
			if(which === k.gamepadB) return 'back';
		}
		
		return null;
	}
	//	util to translate controller button to ui event
	function translateButtonToUI(which)
	{
		if(which === rat.input.BUTTON_LEFT) return 'left';
		if(which === rat.input.BUTTON_UP) return 'up';
		if(which === rat.input.BUTTON_RIGHT) return 'right';
		if(which === rat.input.BUTTON_DOWN) return 'down';
		if(which === rat.input.BUTTON_A) return 'enter';
		if(which === rat.input.BUTTON_B) return 'back';
		if(which === rat.input.BUTTON_START) return 'menu';
		if(which === rat.input.BUTTON_SELECT) return 'view';
		//	I prefer "enter" to "select" because select sometimes means "highlight".  "act" or "press" or something would also be OK.

		return null;
	}

	function translateVoiceToUI(which)
	{
		if (which === rat.voice.commands.Back)
			return 'back';
		else if (which === rat.voice.commands.Menu)
			return 'menu';
		else if (which === rat.voice.commands.view)
			return 'view';
		else
			return null;
	}
	rat.input.translateToUIEvent = function (ratEvent)
	{
		var uiEventCode = 0;
		if (ratEvent.eventType === 'keydown')
		{
			uiEventCode = translateKeyToUI(ratEvent.which);
			if (uiEventCode)
				rat.input.lastUIInputType = 'keyboard';
		}
		else if (ratEvent.eventType === 'buttondown')
		{
			uiEventCode = translateButtonToUI(ratEvent.which);
			if (uiEventCode)
				rat.input.lastUIInputType = 'controller';
		}
		else if (ratEvent.eventType === 'voice')
		{
			uiEventCode = translateVoiceToUI(ratEvent.which);
			if (uiEventCode)
				rat.input.lastUIInputType = 'voice';
		}
		if (uiEventCode) {
			return new rat.input.Event(ratEvent.sysEvent, {translatedFrom: ratEvent, type: 'ui', which: uiEventCode});
		}
		return null;
	};

	//
	//	Get the "direction" to "go" based on the stick and dpad values
	rat.input.getControllerDirection = function( controller )
	{
		var pos = {
			x: 0,
			y: 0
		};
		
		if( controller )
		{
			if( controller.rawButtons & rat.input.BUTTON_LEFT )
				pos.x -= 1;
			else if( controller.rawButtons & rat.input.BUTTON_RIGHT )
				pos.x += 1;
			else
				pos.x += controller.leftStick.x;
			if( controller.rawButtons & rat.input.BUTTON_UP )
				pos.y -= 1;
			else if( controller.rawButtons & rat.input.BUTTON_DOWN )
				pos.y += 1;
			else
				pos.y += controller.leftStick.y;
		}
		return pos;
	};
	
	//
	//	Given a key code, translate to direction vector
	//	if key is NOT a direction, return null,
	//	so it's also easy to just use this to test whether it's an arrow key.
	rat.input.keyToDirection = function (keyCode)
	{
		if (keyCode === rat.keys.leftArrow)
			return {x:-1, y:0};
		else if (keyCode === rat.keys.rightArrow)
			return {x:1, y:0};
		else if (keyCode === rat.keys.upArrow)
			return {x:0, y:-1};
		else if (keyCode === rat.keys.downArrow)
			return {x:0, y:1};
		return null;
	};

	/**
	 * Helper function to detect if a button is currently being pressed.
	 * Based on https://developer.mozilla.org/en-US/docs/Web/Guide/API/Gamepad#Using_button_information
	 * @param {?} button In the current web Gamepad API as of Jun 14, 2014 12:26:10 AM, it is an object with the properties pressed and value.
	 * 			  It used to be a number value, so the type check is for browser compatability.
	 * @return {number}
	 */
	rat.input.getButtonValue = function(button)
	{
		if(typeof(button) === "object")
			return button.value;
		return button;
	};

	/**
	 * Build a rat controller object from a system controller object
	 * @param {string} fromSystem - like "xbox" or "gamepadAPI"
	 * @param {?} obj system controller object
	 * @return {rat.input.Controller}
	 * @suppress {missingProperties}
	 */
	rat.input.buildRatControllerObject = function (fromSystem, obj)
	{
		var rInput = rat.input;

		// Rat controller object format
		//{
		//	id: id unique to this controller,
		//	index: index of this controller.  Unique to the currently active controllers
		//	connected: {boolean} is this controller connected
		//	timestamp: obj.timestamp, Last updated when
		//	rawButtons: 0, Flagset of rat button flags for what button is currently down
		//	leftStick: {x:0, y:0}, raw values of the left stick
		//	rightStick: {x:0, y:0}, raw values of the right stick
		//	leftTrigger: 0, raw value of the left trigger
		//	rightTrigger: 0, raw value of the right trigger
		//  newButtons: built by rat after the conversion
		//  lastButtons: built by rat after the conversion
		//}
		var mapping;
		var rButtons = rat.input;
		var ratObj;
		switch(fromSystem)
		{
			// Mapping from gamepadAPI
			case "gamepadAPI":
				var axes = obj.axes;
				var buttons = obj.buttons;

				//	Build a unified value array where the axes are -1 -> -len
				var full = buttons.concat();
				for(var axesIndex = 0; axesIndex < axes.length; axesIndex++)
				{
					full[-(axesIndex + 1)] = axes[axesIndex];
				}

				// Axis/button mapping came from here
				// http://www.html5rocks.com/en/tutorials/doodles/gamepad/
				mapping = rInput.GAMEPAD_CONTROLLER_MAPPING;
				//	if obj.connected is undefined, assume it to be true.
				if(obj.connected === void 0)
					obj.connected = true;
				ratObj = new rInput.Controller(obj, obj.id, obj.index, obj.connected, obj.timestamp);
				ratObj.rawButtons =
					(rat.input.getButtonValue(full[mapping.BUTTON_A]) ? rButtons.BUTTON_A : 0) |
					(rat.input.getButtonValue(full[mapping.BUTTON_B]) ? rButtons.BUTTON_B : 0) |
					(rat.input.getButtonValue(full[mapping.BUTTON_C]) ? rButtons.BUTTON_C : 0) |
					(rat.input.getButtonValue(full[mapping.BUTTON_D]) ? rButtons.BUTTON_D : 0) |
					(rat.input.getButtonValue(full[mapping.BUTTON_LB]) ? rButtons.BUTTON_LB : 0) |
					(rat.input.getButtonValue(full[mapping.BUTTON_RB]) ? rButtons.BUTTON_RB : 0) |
					//(rat.input.getButtonValue(full[mapping.BUTTON_LT]) ? rButtons.BUTTON_LT : 0) | // We let rat take care of these
					//(rat.input.getButtonValue(full[mapping.BUTTON_RT]) ? rButtons.BUTTON_RT : 0) | // We let rat take care of these
					(rat.input.getButtonValue(full[mapping.BUTTON_SELECT]) ? rButtons.BUTTON_SELECT : 0) |
					(rat.input.getButtonValue(full[mapping.BUTTON_START]) ? rButtons.BUTTON_START : 0) |
					(rat.input.getButtonValue(full[mapping.BUTTON_LEFT_STICK]) ? rButtons.BUTTON_LEFT_STICK : 0) |
					(rat.input.getButtonValue(full[mapping.BUTTON_RIGHT_STICK]) ? rButtons.BUTTON_RIGHT_STICK : 0) |
					(rat.input.getButtonValue(full[mapping.BUTTON_DPAD_UP]) ? rButtons.BUTTON_DPAD_UP : 0) |
					(rat.input.getButtonValue(full[mapping.BUTTON_DPAD_DOWN]) ? rButtons.BUTTON_DPAD_DOWN : 0) |
					(rat.input.getButtonValue(full[mapping.BUTTON_DPAD_LEFT]) ? rButtons.BUTTON_DPAD_LEFT : 0) |
					(rat.input.getButtonValue(full[mapping.BUTTON_DPAD_RIGHT]) ? rButtons.BUTTON_DPAD_RIGHT : 0);
				ratObj.leftStick.x = full[mapping.leftStick.x] || 0;
				ratObj.leftStick.y = full[mapping.leftStick.y] || 0;
				ratObj.rightStick.x = full[mapping.rightStick.x] || 0;
				ratObj.rightStick.y = full[mapping.rightStick.y] || 0;
				ratObj.leftTrigger = full[mapping.leftTrigger] || 0;
				ratObj.rightTrigger = full[mapping.rightTrigger] || 0;
				return ratObj;
			case "xle":
				//							(rawData, id, 	index, 		connected, 	timestamp)
				ratObj = new rInput.Controller(obj, obj.id, obj.index, obj.connected, obj.timestamp);
				if (obj.hasReading)
				{
					var sysRaw = obj.reading;
					ratObj.rawButtons =
						(sysRaw.isAPressed ? rButtons.BUTTON_A : 0) |
						(sysRaw.isBPressed ? rButtons.BUTTON_B : 0) |
						(sysRaw.isXPressed ? rButtons.BUTTON_C : 0) |
						(sysRaw.isYPressed ? rButtons.BUTTON_D : 0) |
						(sysRaw.isLeftShoulderPressed ? rButtons.BUTTON_LB : 0) |
						(sysRaw.isRightShoulderPressed ? rButtons.BUTTON_RB : 0) |
						(sysRaw.isViewPressed ? rButtons.BUTTON_SELECT : 0) |
						(sysRaw.isMenuPressed ? rButtons.BUTTON_START : 0) |
						(sysRaw.isLeftThumbstickPressed ? rButtons.BUTTON_LEFT_STICK : 0) |
						(sysRaw.isRightThumbstickPressed ? rButtons.BUTTON_RIGHT_STICK : 0) |
						(sysRaw.isDPadUpPressed ? rButtons.BUTTON_DPAD_UP : 0) |
						(sysRaw.isDPadDownPressed ? rButtons.BUTTON_DPAD_DOWN : 0) |
						(sysRaw.isDPadLeftPressed ? rButtons.BUTTON_DPAD_LEFT : 0) |
						(sysRaw.isDPadRightPressed ? rButtons.BUTTON_DPAD_RIGHT : 0);
					ratObj.leftStick.x = sysRaw.leftThumbstickX;
					ratObj.leftStick.y = -sysRaw.leftThumbstickY;
					ratObj.rightStick.x = sysRaw.rightThumbstickX;
					ratObj.rightStick.y = -sysRaw.rightThumbstickY;
					ratObj.leftTrigger = sysRaw.leftTrigger;
					ratObj.rightTrigger = sysRaw.rightTrigger;
				}
				return ratObj
			case "xbox":
				var connected = true;
				var sysRaw = obj.getCurrentReading();
				obj.raw = sysRaw;
				obj.index = obj.id;
				ratObj = new rInput.Controller(obj, obj.id, obj.index, connected, sysRaw.timestamp);
				ratObj.rawButtons =
					(sysRaw.isAPressed ? rButtons.BUTTON_A : 0) |
					(sysRaw.isBPressed ? rButtons.BUTTON_B : 0) |
					(sysRaw.isXPressed ? rButtons.BUTTON_C : 0) |
					(sysRaw.isYPressed ? rButtons.BUTTON_D : 0) |
					(sysRaw.isLeftShoulderPressed ? rButtons.BUTTON_LB : 0) |
					(sysRaw.isRightShoulderPressed ? rButtons.BUTTON_RB : 0) |
					(sysRaw.isViewPressed ? rButtons.BUTTON_SELECT : 0) |
					(sysRaw.isMenuPressed ? rButtons.BUTTON_START : 0) |
					(sysRaw.isLeftThumbstickPressed ? rButtons.BUTTON_LEFT_STICK : 0) |
					(sysRaw.isRightThumbstickPressed ? rButtons.BUTTON_RIGHT_STICK : 0) |
					(sysRaw.isDPadUpPressed ? rButtons.BUTTON_DPAD_UP : 0) |
					(sysRaw.isDPadDownPressed ? rButtons.BUTTON_DPAD_DOWN : 0) |
					(sysRaw.isDPadLeftPressed ? rButtons.BUTTON_DPAD_LEFT : 0) |
					(sysRaw.isDPadRightPressed ? rButtons.BUTTON_DPAD_RIGHT : 0);
				ratObj.leftStick.x = sysRaw.leftThumbstickX;
				ratObj.leftStick.y = -sysRaw.leftThumbstickY;
				ratObj.rightStick.x = sysRaw.rightThumbstickX;
				ratObj.rightStick.y = -sysRaw.rightThumbstickY;
				ratObj.leftTrigger = sysRaw.leftTrigger;
				ratObj.rightTrigger = sysRaw.rightTrigger;
				return ratObj;
			default:
				return new rInput.Controller(obj, 0, -1, false, 0);
		}
	};
	
	/**
	 * Build a fake controller object,
	 *	matching the chrome (webkit) gamePadAPI format,
	 *	based on keyboard state.
	 *	Very useful for developing projects that depend on controller inputs
	 *	(like lua games) when you don't have a controller connected,
	 *	or are tired of dealing with how flaky chrome's controller support is.
	 */
	rat.input.buildGamepadKeyFake = function ()
	{
		var fake = {
			id: 'GAMEPAD_KEYFAKE',
			index: 4,
			//mapping
			//connected
			//timestamp
			axes: [],
			buttons: [
				//	this list matches the standard gamePadAPI mapping,
				//	which is what we're going to fake here.
				rat.input.keyboard.isKeyDown(rat.keys.a) | rat.input.keyboard.isKeyDown(rat.keys.enter),
				rat.input.keyboard.isKeyDown(rat.keys.b) | rat.input.keyboard.isKeyDown(rat.keys.esc),
				rat.input.keyboard.isKeyDown(rat.keys.x),
				rat.input.keyboard.isKeyDown(rat.keys.y),
				0,0,	//	lb,rb
				rat.input.keyboard.isKeyDown(rat.keys.l),rat.input.keyboard.isKeyDown(rat.keys.r),	//	lt,rt
				0,0,	//	sel,start
				0,0,	//	stick button, stick button
				rat.input.keyboard.isKeyDown(rat.keys.i),	//	dpad
				rat.input.keyboard.isKeyDown(rat.keys.k),
				rat.input.keyboard.isKeyDown(rat.keys.j),
				rat.input.keyboard.isKeyDown(rat.keys.l)
			],
		};
		
		//	ijkl map to analog stick
		if (rat.input.keyboard.isKeyDown(rat.keys.upArrow))
			fake.axes[1] = -1;
		else if (rat.input.keyboard.isKeyDown(rat.keys.downArrow))
			fake.axes[1] = 1;
		if (rat.input.keyboard.isKeyDown(rat.keys.leftArrow))
			fake.axes[0] = -1;
		else if (rat.input.keyboard.isKeyDown(rat.keys.rightArrow))
			fake.axes[0] = 1;
		
		return fake;
	};

	/**
	 * event called when a controller is added
	 * @param {?} e
	 * @return {?rat.input.Controller}
	 * @suppress {missingProperties}
	 */
	rat.input.onSysControllerAdded = function (e)
	{
		var rInput = rat.input;
		if(rat.system.has.xbox)
		{
			return null;
		}
			/// GamepadAPI
		else
		{
			var sysGP = e.gamepad;
			//	Get the rat version of the controller
			var ratGP = rInput.buildRatControllerObject("gamepadAPI", sysGP);

			//	Handle this controller being added
			return rInput.onControllerChange(rInput.ControllerChangeType.ADDED, ratGP);
		}
	};

	/**
	 * event called when a controller is removed
	 * @param {?} e
	 * @return {?rat.input.Controller}
	 * @suppress {missingProperties}
	 */
	rat.input.onSysControllerRemoved = function (e)
	{
		var rInput = rat.input;
		if(rat.system.has.xbox)
		{
			return null;
		}
			/// GamepadAPI
		else
		{
			var sysGP = e.gamepad;
			//	Get the rat version of the controller
			var ratGP = rInput.buildRatControllerObject("gamepadAPI", sysGP);

			//	Handle it being removed
			return rInput.onControllerChange(rInput.ControllerChangeType.REMOVED, ratGP);
		}
	};

	/**
	 * Called when a controller is added, remove, or generally updated
	 * @param {number} reason Why was this method called
	 * @param {!rat.input.Controller} controller The controller data
	 * @return {!rat.input.Controller}
	 */
	rat.input.onControllerChange = function (reason, controller)
	{
		//	Find this controller's index if it is in the controllers list
		var rInput = rat.input;
		var foundAtIndex = -1;
		var list = rInput.controllers;
		for(var searchIndex = list.length - 1; searchIndex >= 0; --searchIndex)
		{
			if(list[searchIndex].id === controller.id)
			{
				foundAtIndex = searchIndex;
				break;
			}
		}

		//	Some general state handling
		if(reason === rInput.ControllerChangeType.REMOVED)
		{
			//	If we didn't find it, then we have nothing to do
			if(foundAtIndex === -1)
				return controller;

			//	The controller is not active in any way.
			controller.rawButtons = 0;
			controller.leftStick.x = 0;
			controller.leftStick.y = 0;
			controller.rightStick.x = 0;
			controller.rightStick.y = 0;
			controller.connected = false;
			controller.leftTrigger = 0;
			controller.rightTrigger = 0;
			controller.repeatTimer.fullReset();
		}
		else if(reason === rInput.ControllerChangeType.ADDED)
		{
			controller.connected = true;
		}

		//	Get the lastButtons if we found it, and make sure that this object is in the list
		if(foundAtIndex === -1)
		{
			controller.lastButtons = 0;
			foundAtIndex = list.length;
			list.push(controller);
			//rat.console.log("Controller " + controller.id + " added");
			//rat.console.log("   FullInfo");
			//rat.console.log(JSON.stringify(controller));
			//rat.console.log("\n");
		}
		else
		{
			controller.repeatTimer = list[foundAtIndex].repeatTimer;
			controller.lastButtons = list[foundAtIndex].lastButtons;
			list[foundAtIndex] = controller;
		}

		return controller;
	};

	/**
	 * Update the users controllers, if any
	 * @param {number} dt Delta time
	 */
	rat.input.updateControllers = function (dt)
	{
		var rInput = rat.input;
		var list = rInput.controllers;
		var thresholds = rInput.thresholds;
		
		if (rInput.controllers.getSystemControllers)
		{
			//	If we are a pollingForced system for controllers, find any changes to what we have and call
			//	the correct onController* method
			var gamepads = rInput.controllers.getSystemControllers();
			var index;

			var found;
			var searchIndex;
			var newController;
			var changeType;
			if (rInput.controllers.pollingForced)
			{
				//	gamepad API polling.
				if (rat.system.has.gamepadAPI || fakeGamepadAPI)// NOTE: The xbox does set this.
				{
					//	Process the currently list of gamepads from the system
					var system = "gamepadAPI";
					if (rat.system.has.xbox)
						system = "xbox";
					for (index = gamepads.length - 1; index >= 0; --index)
					{
						if (!gamepads[index])
							continue;

						//	Get the RAT version of the controller object
						newController = rInput.buildRatControllerObject(system, gamepads[index]);

						//	Find the controller
						for (searchIndex = list.length - 1; searchIndex >= 0; --searchIndex)
						{
							if (list[searchIndex].id === newController.id)
							{
								found = true;
								break;
							}
						}

						//	If it is not connected now, it has been removed
						if (!newController.connected)
							changeType = rInput.ControllerChangeType.REMOVED;
						else if (!found)
							changeType = rInput.ControllerChangeType.ADDED;
						else
							changeType = rInput.ControllerChangeType.UPDATED;
						newController = rInput.onControllerChange(changeType, newController);
					}
				}
			}
		}

		//	Rat level event detection and dispatch
		var controller;
		for(index = list.length - 1; index >= 0; --index)
		{
			controller = list[index];

			//	Translate left stick values to direction
			if (controller.leftStick.y <= -thresholds.PRESSED)
				controller.rawButtons |= rInput.BUTTON_LSTICK_UP;
			if (controller.leftStick.y >= thresholds.PRESSED)
				controller.rawButtons |= rInput.BUTTON_LSTICK_DOWN;
			if (controller.leftStick.x <= -thresholds.PRESSED)
				controller.rawButtons |= rInput.BUTTON_LSTICK_LEFT;
			if (controller.leftStick.x >= thresholds.PRESSED)
				controller.rawButtons |= rInput.BUTTON_LSTICK_RIGHT;
				
			//	Translate right stick values to direction
			if (controller.rightStick.y <= -thresholds.PRESSED)
				controller.rawButtons |= rInput.BUTTON_RSTICK_UP;
			if (controller.rightStick.y >= thresholds.PRESSED)
				controller.rawButtons |= rInput.BUTTON_RSTICK_DOWN;
			if (controller.rightStick.x <= -thresholds.PRESSED)
				controller.rawButtons |= rInput.BUTTON_RSTICK_LEFT;
			if (controller.rightStick.x >= thresholds.PRESSED)
				controller.rawButtons |= rInput.BUTTON_RSTICK_RIGHT;
				
			//	Left stick and dpad values map to BUTTON_<DIRECTION> to make input dectection easier
			//	NOTE that the right stick is NOT Part of this because we often have special behavior for the right stick
			if ((controller.rawButtons & (rInput.BUTTON_DPAD_UP | rInput.BUTTON_LSTICK_UP)) !== 0)
				controller.rawButtons |= rInput.BUTTON_UP;
			if ((controller.rawButtons & (rInput.BUTTON_DPAD_DOWN | rInput.BUTTON_LSTICK_DOWN)) !== 0)
				controller.rawButtons |= rInput.BUTTON_DOWN;
			if ((controller.rawButtons & (rInput.BUTTON_DPAD_LEFT | rInput.BUTTON_LSTICK_LEFT)) !== 0)
				controller.rawButtons |= rInput.BUTTON_LEFT;
			if ((controller.rawButtons & (rInput.BUTTON_DPAD_RIGHT | rInput.BUTTON_LSTICK_RIGHT)) !== 0)
				controller.rawButtons |= rInput.BUTTON_RIGHT;
			
			//	And the triggers
			if(rat.input.getButtonValue(controller.leftTrigger) >= thresholds.PRESSED)
				controller.rawButtons |= rInput.BUTTON_LT;
			if(rat.input.getButtonValue(controller.rightTrigger) >= thresholds.PRESSED)
				controller.rawButtons |= rInput.BUTTON_RT;

			// What buttons are newly pressed.
			controller.newButtons = controller.rawButtons & ~controller.lastButtons;

			//	Fire events
			rInput.checkAndDispatchControllerEvents(controller, dt);

			//	Remember what the buttons where last frame.
			controller.lastButtons = controller.rawButtons;

			//	If it isn't connected, remove it.
			if (!controller.connected)
			{
				list.splice(index, 1);
				rat.console.log("Controller " + controller.id + " removed");
			}
		}
	};

	rat.input.setOneAllowedController = function (id)
	{
		if (id === 'keyboard' || id === 'mouse')
			return;
		rat.console.log("Allowing only controller " + id);
		rat.input.allowedControllers = [id];
	};
	rat.input.allowAllControllers = function ()
	{
		rat.input.allowedControllers = [];
	};

	rat.input.setAllowRepeatEvents = function (allowed)
	{
		if (allowed === true || allowed === false)
		{
			rat.input.allowRepeatEvents.buttons = allowed;
			rat.input.allowRepeatEvents.directions = allowed;
		}
		else
		{
			if (allowed.buttons !== void 0)
				rat.input.allowRepeatEvents.buttons = !!allowed.buttons;
			if (allowed.directions !== void 0)
				rat.input.allowRepeatEvents.directions = !!allowed.directions;
		}
	};

	/**
	 * A basic repeat timer for controller
	 * @constructor
	 */
	var RepeatTimer = function (rate, delay)
	{
		this.defaults = {
			rate: rate,
			delay: delay
		};
		this.buttons = 0;
		this.directions = 0;
		this.fullReset();
	};
	RepeatTimer.prototype.fullReset = function ()
	{
		this.buttons = this.defaults.delay.buttons;
		this.directions = this.defaults.delay.directions;
	};
	RepeatTimer.prototype.repeatReset = function (ops)
	{
		if (ops === void 0)
			ops = { buttons: true, directions: true };
		if (ops.buttons)
			this.buttons = this.defaults.rate.buttons;
		if (ops.directions)
			this.directions = this.defaults.rate.directions;
	};
	RepeatTimer.prototype.elapsed = function (dt)
	{
		this.buttons -= dt;
		this.directions -= dt;
		if (this.buttons < 0)
			this.buttons = 0;
		if (this.directions < 0)
			this.directions = 0;
	};

	/**
	 * The rat controller type
	 * @constructor
	 * @param {?} id unique ID assigned to each controller
	 * @param {number} index of the controller in the system.  Unique for currently connected controllers
	 * @param {boolean} connected is it currently connected 
	 * @param {?} timestamp
	 */
	rat.input.Controller = function (rawData, id, index, connected, timestamp)
	{
		this.rawData = rawData || {};
		this.id = id;
		this.index = index;
		this.connected = connected;
		this.timestamp = timestamp;
		this.rawButtons = 0;
		this.leftStick = {
			x: 0,
			y: 0
		};
		this.rightStick = {
			x: 0,
			y: 0
		};
		this.leftTrigger = 0;
		this.rightTrigger = 0;
		this.newButtons = 0;
		this.lastButtons = 0;
		this.repeatTimer = new RepeatTimer(rat.input.Controller.repeatRate, rat.input.Controller.repeatDelay);
	};

	/// How fast should event repeats happen
	rat.input.Controller.repeatRate = {
		buttons: 0.2,	/// For buttons
		directions: 0.2	/// For directions
	};
	/// What is the delay before we start to repeat
	rat.input.Controller.repeatDelay = {
		buttons: 0.5,	/// For buttons
		directions: 0.5	/// For directions
	};

	/**
	 * Thresholds for analog values
	 * @enum {number}
	 */
	rat.input.thresholds = {
		LOW: 0.2,
		NORM: 0.5,
		HIGH: 0.8,
		PRESSED: 0.7, // We use this to know if a stick is pushing in a direction
	};


	//	a bunch of more convenient names, especially for backward compatibility.

	rat.getRealMousePosition = rat.input.getRealMousePosition;
	//rat.dispatchMouseMove = rat.input.dispatchMouseMove;
	//rat.dispatchMouseDown = rat.input.dispatchMouseDown;
	//rat.dispatchMouseUp = rat.input.dispatchMouseUp;
	rat.standardizeKeyEvent = rat.input.standardizeKeyEvent;
	rat.charCodeFromEvent = rat.input.charCodeFromEvent;

	rat.autoHandleEvents = rat.input.autoHandleEvents;


	//	common key definitions so we can stop using numbers everywhere
	//	TODO: move this to rat.keyboard?
	rat.keys = {
		leftArrow: 37,
		upArrow: 38,
		rightArrow: 39,
		downArrow: 40,

		enter: 13,
		esc: 27,
		backspace: 8,
		del: 46,
		space: 32,
		home: 36,
		end: 25,
		' ': 32,
		tab: 9,
		pageUp: 33,
		pageDown: 34,
		period: 190,
		shift: 16,
		
		'0' : 48,
		'1' : 49,
		'2' : 50,
		'3' : 51,
		'4' : 52,
		'5' : 53,
		'6' : 54,
		'7' : 55,
		'8' : 56,
		'9' : 57,
		
		numPad0 : 96,
		numPad1 : 97,
		numPad2 : 98,
		numPad3 : 99,
		numPad4 : 100,
		numPad5 : 101,
		numPad6 : 102,
		numPad7 : 103,
		numPad8 : 104,
		numPad9 : 105,
		
		numPadPlus : 107,
		numPadMinus : 109,

		a: 65, b: 66, c: 67, d: 68, e: 69, f: 70, g: 71, h: 72,
		i: 73, j: 74, k: 75, l: 76, m: 77, n: 78, o: 79, p: 80,
		q: 81, r: 82, s: 83, t: 84, u: 85, v: 86, w: 87, x: 88,
		y: 89, z: 90,

		'~': 192,
		'`': 192,
		
		'-': 189,
		'=': 187,

		leftSys: 91, // Systems key (like the window key)
		rightSys: 92,

		selectKey: 93,
		
		'/' : 191,
		fowardSlash: 191,
		'\\' : 220,
		backslash : 220,
		
		leftBracket : 219,
		rightBracket: 221,

		f1: 112,
		f2: 113,
		f3: 114,
		f4: 115,
		f5: 116,
		f6: 117,
		f7: 118,
		f8: 119,
		f9: 120,
		f10: 121,
		f11: 122,
		f12: 123,
	};
	
	//	if this key code corresponds with a real number, return that, otherwise -1
	rat.input.keyCodeToNumber = function(which)
	{
		if (which >= rat.keys['0'] && which <= rat.keys['9'])
			return which - rat.keys['0'];
		if (which >= rat.keys.numPad0 && which <= rat.keys.numPad9)
			return which - rat.keys.numPad0;
			
		return -1;
	};
	
} );

//
//	User and profile management
//	Find active users, get information about them like user name, gamer picture, list of friends, gamerscore, etc.
//
//	This is a generic API, with system specifics implemented in dependent modules (e.g. r_user_xbo.js)
//
//
/*	NOTES from Steve 2015.12.18
	r_user's getUsers() system is strange...
	It seems to be designed to reconstruct a list of users, including building a new user object for each user, each time it's called.
	So I thought maybe it was a sort of one-time setup thing, but the results aren't tracked by r_user, and it does seem to get called in other places on the fly...
	Seems not ideal at all.
	Shouldn't we have a single user list that's built once and maintained?
	I don't want to break xbox user management support, of course, so I don't want to change this stuff...
	for instance, calling setActiveUser() calls getUser() which calls getUsers() which rebuilds the list.
	All I wanted to do was set the active user...
	
	Talked to John about this...
	he agrees that the best way to do this is to TRACK the user list when it changes, rather than reconstruct it each time getUser() is called.
	TODO:  do that on various platforms.
*/

rat.modules.add( "rat.os.r_user",
[
	{ name: "rat.utils.r_messenger", processBefore: true},
	
	{ name: "rat.os.r_user_xbo", platform: "xbox" },
	{ name: "rat.os.r_user_wraith", platform: "Wraith" },
	//{ name: "rat.os.r_user_kong" }//, platform: "kong" },	//	hmm...  I want to fake it when I'm not really on kong, though...
	"rat.debug.r_console",
], 
function(rat)
{
	//rat.console.log("SLD rat.user");

	/// Rat user object
	/** @constructor */
	var User = function (rawData, fields)
	{
		this.rawData = rawData;
		this.id = fields.id;
		this.gamerTag = fields.gamerTag;
		this.isSignedIn = fields.isSignedIn || false;
		this.userImageSource = fields.userImageSource;
		this.friendsList = fields.friendsList;
	};
	
	//	Rat user list.
	/** @constructor */
	var UserList = function ()
	{
		this.list = [];
		this.byId = {};
		this.length = 0;
	};
	UserList.prototype.add = function (rawData, fields)
	{
		var usr = new User(rawData, fields);
		this.list.push(usr);
		this.length = this.list.length;
		this.byId[usr.id] = usr;
		return usr;
	};
	UserList.prototype.at = function (index)
	{
		return this.list[index];
	};

	// Rat.user namespace
	rat.user = rat.user || {};
	rat.user.supported = rat.user.supported || false;
	rat.user.messages = new rat.Messenger();
	var messageType = {
		ActiveUserChanged: "activeUserChanged",
		SignIn: "signIn",
		SignOut: "signOut",
		InfoChange: "infoChange",
		SigninUIClosed: "signinUIClosed",
		ControllerBindingChanged: "controllerBindingChanged",
		
		FriendsInfoAvailable: "friendsInfoAvailable",
		AchievementInfoAvailable: "achievementInfoAvailable",
	};
	rat.user.messageType = messageType;
	var SigninUIOps = {
		NoGuests: "", //<DEFAULT
		AllowGuests: "allowGuests",
		AllowOnlyDistinctControllerTypes: "allowOnlyDistinctControllerTypes"
	};
	rat.user.SigninUIOps = SigninUIOps;

	var activeUser = void 0;
	
	rat.user._internal = {
		UserList: UserList,
		User: User,
		isSigninUIShowing: false
	};

	//	NULL function to get a controllerID for a given userID
	rat.user.userIDFromControllerID = function (controllerID)
	{
		if (controllerID === 'keyboard' || controllerID === 'mouse')
			return rat.user.getUsers().at(0).id;
		return 0;
	};

	// NULL function to get the controller ID tied to a user ID
	rat.user.controllerIDFromUserID = function (userID)
	{
		return 0;
	};

	// NULL function to get the list of users interacting with the local system
	rat.user.getUsers = function ()
	{
		return new UserList();
	};
	
	rat.user.requestFriendsInfo = function(user)
	{
		//	by default, there is no such service
		return;
	};

	// NULL function for showing the signin UI
	//	Signature MUST be controllerID, ops, (see rat.user.SigninOps), doneCB and return true/false if the UI was requested
	//- NOTE We do this in a function so i can provide information to the google closure compiler w/out changing the state for the entire file
	/** @suppress {checkTypes} */
	function setNULLSigninUI()
	{
		rat.user.showSigninUI = void 0;	//	This is VOID 0 so code can detect when platforms don't support this
	}
	setNULLSigninUI();

	//	Find out if the signinUI is up.
	rat.user.isSigninUIShowing = function ()
	{
		return rat.user._internal.isSigninUIShowing;
	};

	//	Get a user by the user's ID
	rat.user.getUser = function (id)
	{
		//	Find the user.
		var users = rat.user.getUsers();
		return users.byId[id];
	};

	//	Function to clear the currently set active user.
	/** @param {Object=} options */
	rat.user.clearActiveUser = function (options)
	{
		rat.user.setActiveUser(void 0, options);
	};

	// Function to set who the active user is
	/**
	 * @param {?} id 
	 * @param {Object=} options
	 */
	rat.user.setActiveUser = function (id, options)
	{
		options = options || {};

		//	Allow passing the user object
		if (id !== void 0 && id.id !== void 0)
			id = id.id;

		//	Is there a change?
		var isChange;
		if (id !== void 0)
			isChange = activeUser === void 0 || activeUser.id !== id;
		else
			isChange = activeUser !== void 0;
		if (!isChange && !options.force)
			return;

		//	Find the user.
		var old = activeUser;
		if (id !== void 0)
			activeUser = rat.user.getUser(id);
		else
			activeUser = void 0;
		rat.console.log("Active user set to:" + JSON.stringify(activeUser));
		if (isChange)
			rat.user.messages.broadcast(messageType.ActiveUserChanged, activeUser, old);
	};

	//	Get the active user object (if any)
	rat.user.getActiveUser = function ()
	{
		return activeUser;
	};

	//	Get the user ID of the active user (if any)
	rat.user.getActiveUserID = function ()
	{
		var user = rat.user.getActiveUser() || {};
		return user.id || 0;
	};

	//	Get the active user's name
	rat.user.getActiveUserName = function ()
	{
		var user = rat.user.getActiveUser() || {};
		return user.gamerTag || "";
	};
	
	//	Get the active user's image (e.g. avatar),
	//	in a simple data source or URL format,
	//	e.g. suitable for creating a rat image
	rat.user.getActiveUserImageSource = function ()
	{
		var user = rat.user.getActiveUser() || {};
		return user.userImageSource || void 0;
	};
	
	//	todo: user switched controllers?  Wraith handles this, but I don't know about anyone else.
	//	todo: user signed out
} );
//
//	UI support (for game UI and for general graphics usefulness)
//
//	This module defines the rat.ui space and the rat.ui.Element class.
//	Subclasses are defined in their own modules, but this module is still big and complicated
//		because the ui.Element class handles a ton of ui functionality all at the base class level.

//	TODO:
//		Fix all use of global ctx in various ui modules


//	DIRTY and OFFSCREEN
//		The offscreen system is a way to optimize rendering - if an element is not changing every frame, then
//		it's faster to render changes once to an offscreen canvas,
//		and then render that canvas from then on whenever the ui element is drawn.
//		
//		So, we support setting a "useOffscreen" flag on any element.
//
//		We then need to keep track of when the offscreen render needs updating, so this is what the "Dirty" flag is for.
//		A ton of different actions can potentially set the dirty flag for a given element.  It depends on the element.
//		For instance, highlighting a button makes it dirty.  Changing text makes a textbox dirty.
//
//		The actual rendering of the offscreen buffer happens right before an element normally needs to be drawn
//		(in the "draw" function below)
//		This is a good place because it means a dirty flag can get set by lots of operations,
//		but the offscreen re-render (which we assume is expensive) only happens once.
//
//		There are all kinds of subtle aspects of this process.  It's tricky.  See implementation below.
//		Because it may not always be exactly what you want, offscreen rendering is off by default.
//		It is assumed that each game will turn this flag on on a case-by-case and element-by-element basis,
//		and confirm that the desired results are achieved.
//
//		Offscreen support is also not 100% implemented yet.
//		It's not working yet for scrollviews, and in some cases like rotation, I suspect...?
//		It's working for containers, buttons, and text boxes, assuming these don't have custom code that fails to setDirty() properly,
//		and assuming they don't contain something that also fails to setDirty() properly.
//
//		But where it does work, it works nicely.  It's really easy to turn on for a container and get an immediate performance boost.
//
//		rat.ui.debugOffscreens = true
//		will turn on a really neat visual debug indication of where offscreen buffers are being used, and when they change.
//
//

//	TOOLTIPS
//		Why doesn't my tooltip show up?
//			* Is your element enabled and visible?
//			* Is it the kind of element that tracks mouse movement (e.g. button)?  If not, you'll need to call setTracksMouse(true)
//			* you either need to explicitly set an element's toolTipScreen value to the top-level screen it's in,
//				or make sure the tooltip is added AFTER the element is added to its screen.  See below.

//	CENTERING:
//		Currently, the way this works is we track a separate center offset (x and y).
//		When drawing, we include that offset.  When calculating things like bounds, we include that offset.
//		A different approach would be to only center once when an element is being set up, e.g. when autoCenter is called.
//			In that case, we'd immediately change this.place.pos, and move on, and never look at centering again.
//			Pros:  Less math and fiddling with "center" value later!
//			Cons:  Couldn't keep centering when the object changes size?  We don't do that, currently.
//				we don't remember later that we were autocentered, and adjust when size changes.
//				but we do, naturally, keep centered when "pos" changes.
//				Hmm...  this makes it easier to do things like centering an object and applying an animator.  Which we do in Agent, for instance.
//			Note that we already do the one-time approach in some functions like centerInParent.
//		Centering is currently broken with bubblebox buttons - doesn't call autocenter on its children.  should it?  see below.
//		Centering is currently broken with clipping
//		What we OUGHT to do is apply center.x and center.y in draw() below, in the translate call.
//		Except then I started thinking maybe this whole centering thing is wrong.
//			is autocenter supposed to MOVE the element, really?  Shouldn't it do type-specific logic to center in the space given?
//			moving the position should just happen in calls like centerinparent, and maybe we should add centeratpos.
//
// Uses r_collision2d
//------------------------------------------------------------------------------------
rat.modules.add( "rat.ui.r_ui",
[
	{ name: "rat.os.r_events", processBefore: true },
	{ name: "rat.graphics.r_offscreen", processBefore: true },
	
	"rat.debug.r_console",
	"rat.os.r_system",
	"rat.math.r_vector",
	"rat.graphics.r_graphics",
	"rat.utils.r_shapes",
	"rat.ui.r_ui_animator",
	"rat.math.r_math",
	"rat.utils.r_collision2d",
	"rat.ui.r_ui_textbox",
	"rat.ui.r_ui_data",
	"rat.utils.r_eventmap"
], 
function(rat)
{
    // @namespace
	rat.ui = {};

	rat.ui.TOOL_TIP_TIME = 0.5;
	rat.ui.nextElementID = 1;	//	incrementing unique ID for each element we create
	rat.ui.mouseMoveCallCount = 0;	//	debug
	rat.ui.updateCallCount = 0;	//	debug
	
	rat.ui.debugOffscreens = false;	//	global offscreen debug display system which is pretty awesome
	//	global disable for rat ui system offscreen usage!  This is important for systems like Wraith,
	//	where offscreen canvas rendering is not yet supported.
	//	This is a good flag for game-specific offscreen rendering to check as well.
	//	Allowed by default, of course.
	rat.ui.allowOffscreens = true && rat.Offscreen.allowOffscreens;
	
	//------------------------------------------------------------------------------------
	//	basic ui element.

	//	constructor for ui Element
	/**
	 * @constructor
	*/
	rat.ui.Element = function ()
	{
		//	Have we already been constructed?
		//	This can happen with diamond inheritance
		//	See r_ui_fillSprite
		if (this.id !== void 0)
			return;

		//console.log("Element cons");
		this.id = rat.ui.nextElementID++;
		//	consider:  also set a 'uniqueID' property that doesn't change, so ALL panes have some truly unique identifier, which is needed in a few cases.
		//		(use the same initial value, since nextElementID is unique)
		
		///@todo	replace with standard position tracker object...  (pos + rot)
		this.place = new rat.Position(0, 0, 0);
		this.center = new rat.Vector(0, 0); //	default to draw from upper left
		this.color = new rat.graphics.Color(); //	dang, this is useless for images, currently... TODO: set to null and only set if needed.
		this.size = new rat.Vector(0, 0);
		this.scale = new rat.Vector(1, 1); 	//	overall scale for rendering and interacting with content.
		this.opacity = 1.0;

		this.tempRect = new rat.shapes.Rect();

		this.contentOffset = new rat.Vector(0, 0);	//	for scrolling internal content around
		this.contentSize = new rat.Vector(0, 0);	//	for limiting scrolling and other stuff
		this.contentScale = new rat.Vector(1, 1);	//	scaling content, e.g. zoom
		this.contentScaleMin = new rat.Vector(0.1, 0.1);
		this.contentScaleMax = new rat.Vector(10, 10);

		this.flags = 0;
		this.flags |= rat.ui.Element.enabledFlag;	//	everything is enabled by default
		this.flags |= rat.ui.Element.visibleFlag;	//	everything is visible by default
		this.flags |= rat.ui.Element.adjustForScaleFlag;	//	normally, some element subclasses will try to fix bugs that come up when scaled
		this.flags |= rat.ui.Element.tracksMouseFlag;	//	most elements track mouse.  we'll clear this on a case by case basis.
		//	tracksmouse is different from enabled.  !tracksmouse means don't even process mouse.
		//	enabled might change over time, unlike tracksmouse, and we might track disabled elements for things like tooltips?
		
		this.name = "<elem>" + this.id; //	name is useful for debugging

		this.command = 0;	//	for triggering, e.g. buttons
		this.commandInfo = 0;

		this.callback = null;	//	call this when element is "hit" or triggered, or whatever.  like command, above.
		this.callbackInfo = null;
		//	see also flagsChangedCallback

		this.events = {};

		this.frameWidth = 0;
		this.frameColor = new rat.graphics.Color(0, 0, 0);
		this.frameOutset = 0;	//	push frame out a bit - helps with thick frames around content

		//	optional offscreen rendering optimization
		this.offscreen = null;
		this.useOffscreen = false;
		this.isDirty = true;	//	offscreen always dirty when first created
		
		//	update optimization - we assume everybody wants an update,
		//	but you can turn this off on a per-object basis, to disable updating for the pane and all subelements.
		//	It's generally expected that you would turn this off in your updateSelf() function, or externally.
		//	Turn off on single objects at a time.  Their parents will figure out if they can turn themselves off as well.
		//	But when you turn ON the flag, you need to call setNeedsUpdate(), so it can reenable the whole parent chain.
		//	See update() and setNeedsUpdate() below.
		//	Note that this whole system is not generally used in rat games, currently - but IS used in the Xui system,
		//	So, it's easy to ignore this stuff entirely and only dig into it if you feel you need to optimize update calls
		//	for a complex game/scene.
		this.needsUpdate = true;

		//this.subElements = undefined
		//this.palette = undefined

		this.parent = null;

		this.toolTip = null;
	};
	rat.ui.Element.prototype.elementType = 'element';	//	various subclasses change this

	//	state flags for elements
	rat.ui.Element.highlightedFlag = 0x0001;
	rat.ui.Element.enabledFlag = 0x0002;
	rat.ui.Element.pressedFlag = 0x0004;
	rat.ui.Element.toggledFlag = 0x0008;
	rat.ui.Element.visibleFlag = 0x0010;
	rat.ui.Element.clipFlag = 0x0020;		//	should we clip to our bounds when drawing?

	rat.ui.Element.mouseInFlag = 0x0100;	//	mouse is currently in my bounds (useful for tooltips)
	rat.ui.Element.trackingMouseDownFlag = 0x0200;	//	actively tracking mouse down
	rat.ui.Element.tracksMouseFlag = 0x0400;	//	track mouse at all.  If false, don't even try to track.

	rat.ui.Element.autoSizeAfterLoadFlag = 0x1000;	//	after loading, set our size to match content
	rat.ui.Element.autoCenterAfterLoadFlag = 0x2000;	//	after loading, automatically center content (not finished)
	rat.ui.Element.autoScaleAfterLoadFlag = 0x4000;	//	after loading, automatically scale so content matches existing size
	
	rat.ui.Element.adjustForScaleFlag = 0x00010000;	//	some elements need to fiddle with rendering to make them look good when scaled.  See BubbleBox
	
	rat.ui.Element.drawTiledFlag = 0x00100000;	//	automatically draw me tiled.  Useful for sprites, if nothing else.
	
	//	by default, no flag changes should set me dirty, because my look doesn't change when my flags change.
	//	even "visible", because that just means I don't get drawn at all!
	//	We may want to add something here, though, like the clip flag?  Not sure about that one yet.
	//	This is an inheritable property that various classes can change.  E.g. buttons display differently based on flags!
	rat.ui.Element.prototype.flagsThatDirtyMe = 0;
	
	//	on the other hand, some flags should always dirty my parent, like "visible".
	//	This may actually be the only one?  note that flagsthatdirtyme above also applies to parents,
	//	so this list is just flags that dirty parent that aren't already included in flagsThatDirtyMe...
	rat.ui.Element.prototype.flagsThatDirtyParent = rat.ui.Element.visibleFlag;
	
	rat.ui.Element.prototype.appendSubElement_unsafe = function (g)
	{
		//	add to sub elements
		if (!this.subElements)
			this.subElements = [g];
		else
			this.subElements.push(g);

		//	and set parent for this subelement
		g.parent = this;
		
		//	fix up tooltip parentage, if needed
		if (g.toolTip && g.toolTipScreenWasAssumed)
			g.toolTipScreen = g.getTopParent();
		
		this.setDirty(true);
	};

	//	add sub elements to this element
	rat.ui.Element.prototype.appendSubElement = function (g)
	{
		//	debug:
		if (this.findSubElementByID(g.id, false))
		{
			rat.console.logOnce("WARNING: appending subelement with duplicate ID:  " + g.id, 'dupID');
		}
		
		this.appendSubElement_unsafe(g);
	};

	//	insert sub element in this element, before a given index
	rat.ui.Element.prototype.insertSubElement = function (g, beforeIndex)
	{
		//	debug:
		if (this.findSubElementByID(g.id))
		{
			rat.console.logOnce("WARNING: appending subelement with duplicate ID:  " + g.id, 'dupID');
		}

		if (beforeIndex === void 0)
			beforeIndex = 0;
		//	add to sub elements
		if (!this.subElements)
			this.subElements = [g];
		else
			this.subElements.splice(beforeIndex, 0, g);
		//	and set parent for this subelement
		g.parent = this;
		
		this.setDirty(true);
	};
	
	//	insert sub element before another element
	rat.ui.Element.prototype.insertSubElementBefore = function (g, beforeElement)
	{
		var index = this.getSubElementIndex(beforeElement);
		if (index < 0)
		{
			rat.console.logOnce("ERROR: attempting insert before element not in tree: " + beforeElement.id, 'noBeforeElem');
			index = 0;
		}
		
		this.insertSubElement(g, index);
	};
	
	//	get this element's parent pane
	rat.ui.Element.prototype.getParent = function ()
	{
		return this.parent;
	};
	
	//	get the most-parent parent of this pane.
	//	walk through parentage until we find a pane with no parent.
	rat.ui.Element.prototype.getTopParent = function ()
	{
		var elem = this; // Start from the current element, and find the root element.
		while (elem.parent)
			elem = elem.parent;
		return elem;
	};

	//	remove a sub element by id
	//	including a recursive check
	//	note that this and all the other "removesub" functions don't clear parent ref for the removed item.
	//	todo: should they?  probably...
	rat.ui.Element.prototype.removeSubElementByID = function (id)
	{
		if (this.subElements)
		{
			var i;
			for (i = 0; i < this.subElements.length; i++)
			{
				if (this.subElements[i].id === id)
				{
					//	some cleanup function?
					this.subElements.splice(i, 1);
					this.setDirty(true);
					return true;
				}
			}

			//	not found? look recursively deeper.
			for (i = 0; i < this.subElements.length; i++)
			{
				if (this.subElements[i].removeSubElementByID(id))
				{
					this.setDirty(true);
					return true;
				}
			}
		}

		return false;
	};

	//	remove a sub element by object reference
	//	recursive (see above)
	rat.ui.Element.prototype.removeSubElement = function (element)
	{
		return this.removeSubElementByID(element.id);
	};

	//	remove this element from its own parent
	rat.ui.Element.prototype.removeFromParent = function ()
	{
		if (typeof this.parent !== 'undefined')
			this.parent.removeSubElement(this);
	};

	//	Detach all of my children from me.  Returns the array of gfx
	rat.ui.Element.prototype.detachAllChildren = function ()
	{
		var detached = this.subElements || [];
		this.subElements = void 0;

		for (var index = 0; index !== detached.length; ++index)
			detached[index].parent = null;
		
		this.setDirty(true);
		
		return detached;
	};

	//	remove all subelements of this element
	rat.ui.Element.prototype.removeAllSubElements = function (killMe)
	{
		if (this.subElements)
		{
			for (var i = 0; i < this.subElements.length; i++)
			{
				this.subElements[i].removeAllSubElements(true);	//	kill subelements even if we ourselves are not dying
			}
		}

		if (killMe)
		{
			//console.log("try to kill...");
			//	clear stuff?  animators are sort of external to me, actually.  What do we kill here?
			//	maybe find animators that drive me (look them up) and kill them.  Yeah.  TODO.
			this.killMyAnimators();
		}

		this.subElements = [];
		
		this.setDirty(true);

		//	OLD
		//this.subElements = [];
		//	this is pretty simple for now, but in the future we might need to clear parent refs,
		//	and stuff.  It would be nice to kill animators, for instance, which have callbacks...
		//	which would make this more complex and would possibly need to be recursive?
	};

	rat.ui.Element.prototype.killMyAnimators = function ()
	{
		rat.ui.killAnimatorsForElement(this);
	};

	//	find a sub element by id
	/**
	 * @param {?} id
	 * @param {boolean=} recursive
	 */
	rat.ui.Element.prototype.findSubElementByID = function (id, recursive)
	{
		if (recursive === void 0)
			recursive = true;
		//	search my sub elements.
		var res;
		var elem;
		if (this.subElements)
		{
			for (var i = 0; i !== this.subElements.length; ++i)
			{
				elem = this.subElements[i];
				if (!elem)
					continue;
				if (elem.id === id)
					return elem;
				if (recursive)
				{
					res = this.subElements[i].findSubElementByID(id, recursive);
					if (res)
						return res;
				}
			}
		}

		//	Not found i guess
		return void 0;
	};
	
	//	return a sub element by index
	/**
	 * @param {?} index
	 */
	rat.ui.Element.prototype.getSubElement = function (index)
	{
		if (!this.subElements || this.subElements.length < index)
			return null;
		return this.subElements[index];
	};
	
	//	return the index of this subelement.
	//	Probably an internal-use-only function!  This index is going to be valid only until the list next changes...
	//	return -1 if not found.
	rat.ui.Element.prototype.getSubElementIndex = function (elem)
	{
		if (this.subElements)
		{
			for (var i = 0; i < this.subElements.length; ++i)
			{
				var checkElem = this.subElements[i];
				if (checkElem === elem)
					return i;
			}
		}
		return -1;
	};
	
	//	return the number of my subelements
	rat.ui.Element.prototype.getSubElementCount = function (elem)
	{
		if (this.subElements)
			return this.subElements.length;
			
		return 0;
	};
	
	//	debug - dump info about this element and all subelements.
	//	return object with some extra info like total number of items...
	rat.ui.Element.prototype.dumpTree = function(depth, collectData)
	{
		if (typeof(depth) === 'undefined')
			depth = 0;
		
		var meVisible = this.isVisible();
		
		//	if we didn't get handed collectData, we're presumably first.  Initialize it.
		if (!collectData)
		{
			collectData = {
				lines : [],
				totalCount : 0,
				hiddenCount : 0,
				updateCount : 0,
				parentHidden : false,
			};
		}
		
		//	add my counts
		collectData.totalCount++;
		var oldTotal = collectData.totalCount;
		
		if (this.needsUpdate)
			collectData.updateCount++;
		
		//	if my parent was hidden, I count as hidden in totals
		if (!meVisible || collectData.parentHidden)
			collectData.hiddenCount++;
		
		//	set up my output line to reserve space, but don't fill it out yet.
		var myLineNumber = collectData.lines.length;
		collectData.lines.push("");
		
		//	now collect data from everybody under me
		if (this.subElements)
		{
			//	remember if our parent was hidden, but then set for all my children if I am hidden
			var parentWasHidden = collectData.parentHidden;
			if (!meVisible)
				collectData.parentHidden = true;
			if (this.useOffscreen)	//	if I'm an offscreen render, count my children as being under hidden parent
				collectData.parentHidden = true;
			
			for (i = 0; i < this.subElements.length; i++)
			{
				this.subElements[i].dumpTree(depth+1, collectData);
			}
			
			//	restore old hidden value
			collectData.parentHidden = parentWasHidden;
		}
		
		//	and set up my line
		var out = "";
		var i;
		for (i = 0; i < depth; i++)
		{
			out += "._";
		}
		var bounds = this.getBounds();
		
		//	convert bounds to short strings for more concise display
		bounds.x = "" + rat.math.floor(bounds.x * 100)/100;
		bounds.y = "" + rat.math.floor(bounds.y * 100)/100;
		bounds.w = "" + rat.math.floor(bounds.w * 100)/100;
		bounds.h = "" + rat.math.floor(bounds.h * 100)/100;
		
		//	add xui object subtype if it exists
		//	todo - function instead so other classes can do this as well,
		//	like "getSubTypeString()" or something
		var xuiTypeString = "";
		if (this.xuiElemType)
			xuiTypeString = " " + this.xuiElemType;
		
		//	add total subcount if there was one
		var subCountString = "";
		if (collectData.totalCount > oldTotal)
			subCountString = " subCount: " + (collectData.totalCount - oldTotal);
		
		var visString = (meVisible ? "Visible" : "Hidden");
		if (this.useOffscreen)
			visString = "Offscreen";	//	call this out specifically in the dump - sort of visible
		if (collectData.parentHidden)
			visString = "(" + visString + ")";	//	in some way show that we're actually hidden
		var upString = (this.needsUpdate ? "ups" : "noup");
		collectData.lines[myLineNumber] =
			out
			+ this.id + ":" + this.name
			+ xuiTypeString
			+ " : " + visString
			+ " : " + upString
			+ " : " + bounds.x + ", " + bounds.y + " (" + bounds.w + " x " + bounds.h + ")"
			+ subCountString
		
		//	and we're done
		return collectData;
	};

	rat.ui.Element.prototype.setColor = function (c)
	{
		if (typeof(c) === "string")
			c = new rat.graphics.Color(c);
		this.color = c;
	};

	rat.ui.Element.prototype.setSize = function (w, h)
	{
		this.size.x = w;
		this.size.y = h;
		this.boundsChanged();
	};

	rat.ui.Element.prototype.setWidth = function (w)
	{
		this.size.x = w;
		this.boundsChanged();
	};

	/// Set the position and size of this element
	/**
	 * @param {number|Object} x
	 * @param {number=} y
	 * @param {number=} w
	 * @param {number=} h
	 */
	rat.ui.Element.prototype.setBounds = function (x, y, w, h)
	{
		if (x.x !== void 0)	//	support a single argument which is an object with x,y,w,h
		{
			this.place.pos.x = x.x;
			this.place.pos.y = x.y;
			this.size.x = x.w;
			this.size.y = x.h;
		}
		else	//	handle 4 arguments
		{
			this.place.pos.x = x;
			this.place.pos.y = y;
			this.size.x = w;
			this.size.y = h;
		}
		this.boundsChanged();
	};

	rat.ui.Element.prototype.setHeight = function (h)
	{
		this.size.y = h;
		this.boundsChanged();
	};

	rat.ui.Element.prototype.getSize = function ()
	{
		var theSize = {};
		theSize.x = this.size.x;
		theSize.y = this.size.y;
		theSize.w = this.size.x;	//	alternative names, for convenience
		theSize.h = this.size.y;
		return theSize;
	};

	rat.ui.Element.prototype.getWidth = function ()
	{
		return this.size.x;
	};

	rat.ui.Element.prototype.getHeight = function ()
	{
		return this.size.y;
	};

	//	content size is for managing scroll limits in a scrollview.
	//	most of the time, you want setSize()
	rat.ui.Element.prototype.setContentSize = function (w, h)
	{
		this.contentSize.x = w;
		this.contentSize.y = h;
	};

	//
	//	automatically calculate and set our content size from the position/size of all our subelements.
	//
	rat.ui.Element.prototype.setContentSizeFromSubElements = function ()
	{
		var space = this.calculateContentBounds();
		
		//	intentionally ignoring the potential for space.x and space.y to be other than 0
		//	we're just setting our SIZE here
		this.setContentSize(space.w, space.h);
	};
	
	//	automatically calculate the bounding space of our contained elements.
	//	including factoring in rotation.
	//	This assumes that each subelement bounding box is correct for that element
	rat.ui.Element.prototype.calculateContentBounds = function ()
	{
		var xmin = 9999;
		var xmax = -9999;
		var ymin = 9999;
		var ymax = -9999;
		
		for (var i = 0; this.subElements && i < this.subElements.length; i++)
		{
			var elem = this.subElements[i];
			var bounds = elem.getBounds(elem.tempRect);
			var basePos = elem.place.pos;	//	here's what we'd change if we had a "center"

			//	Handle rotation and scale.
			//if (1)//elem.place.rot.angle != 0)
			{
				//	probably wrong if we have a center offset...
				var cosa = Math.cos(elem.place.rot.angle);
				var sina = Math.sin(elem.place.rot.angle);
				
				//	for each point, transform by rotation of object and find if it changes our min/max x and y
				function checkP(x, y)
				{
					var xp = basePos.x + x * cosa - y * sina;
					var yp = basePos.y + x * sina + y * cosa;
					if (xp < xmin) xmin = xp;
					if (xp > xmax) xmax = xp;
					if (yp < ymin) ymin = yp;
					if (yp > ymax) ymax = yp;
				}
				checkP(0, 0);
				checkP(elem.size.x * elem.scale.x, 0);
				checkP(elem.size.x * elem.scale.x, elem.size.y * elem.scale.y);
				checkP(0, elem.size.y * elem.scale.y);
				
			}
		}
		
		return {x:xmin, y:ymin, w:xmax-xmin, h:ymax-ymin};
	};

	//	automatically reset our bounds to include all our content
	rat.ui.Element.prototype.setBoundsFromContent = function (borderSpace)
	{
		var space = this.calculateContentBounds();
		
		//	since space could have negative xy values here, we have to be prepared to
		//	reposition ourselves and shift all our subelements in the opposite direction to match!
		var bumpX = space.x - borderSpace;
		var bumpY = space.y - borderSpace;
		this.setPos(this.place.pos.x + bumpX, this.place.pos.y + bumpY);
		
		for (var i = 0; this.subElements && i < this.subElements.length; i++)
		{
			var elem = this.subElements[i];
			elem.setPos(elem.place.pos.x - bumpX, elem.place.pos.y - bumpY);
		}
		
		this.setSize(space.w + 2 * borderSpace, space.h + 2 * borderSpace);
	};

	rat.ui.Element.prototype.getContentSize = function ()
	{
		return this.contentSize.copy();
	};

	rat.ui.Element.prototype.setPos = function (x, y)
	{
		this.place.pos.x = x;
		this.place.pos.y = y;
		this.boundsChanged();
	};

	rat.ui.Element.prototype.getPos = function ()
	{
		return this.place.pos;	//	note - returning a REF... usually they'll want to call getPos().copy()
	};

	rat.ui.Element.prototype.getPosX = function () { return this.place.pos.x; };
	rat.ui.Element.prototype.getPosY = function () { return this.place.pos.y; };

	rat.ui.Element.prototype.setPosX = function (x)
	{
		this.place.pos.x = x;
		this.boundsChanged();
	};
	rat.ui.Element.prototype.setPosY = function (y)
	{
		this.place.pos.y = y;
		this.boundsChanged();
	};

	//	Set this ui element's scale.
	rat.ui.Element.prototype.setScale = function (x, y)
	{
		this.scale.x = x;
		this.scale.y = y;
		
		//	This doesn't change my bounds.  And for most (all?) cases, that's fine.
		//	Scaling at this level happens without an element knowing about it, generally.
		//	We just apply a context scale and then draw the element normally,
		//	so the bounds of the element didn't change, from the element's point of view.
		
		//	similarly, we don't set a dirty flag here for the element itself,
		//	because it doesn't change the rendering of that element.
		//	Scaled content does, however, change the look of the element that contains it,
		//	so the parent element needs to be set dirty.
		//	Same concept applies below in setting rotation and opacity and stuff...
		if (this.parent)
			this.parent.setDirty(true);
	};

	rat.ui.Element.prototype.getScale = function ()
	{
		return this.scale;
	};

	rat.ui.Element.prototype.setRotation = function (angle)
	{
		this.place.rot.angle = angle;
		
		//	see setScale notes above
		if (this.parent)
			this.parent.setDirty(true);
	};

	rat.ui.Element.prototype.getRotation = function ()
	{
		return this.place.rot.angle;
	};

	rat.ui.Element.prototype.setOpacity = function (alpha)
	{
		this.opacity = alpha;
		
		//	see setScale notes above
		if (this.parent)
			this.parent.setDirty(true);
	};
	
	rat.ui.Element.prototype.getOpacity = function ()
	{
		return this.opacity;
	};

	rat.ui.Element.prototype.setOpacityRecursive = function (alpha)
	{
		this.applyRecursively(rat.ui.Element.prototype.setOpacity, alpha);
	};

	rat.ui.Element.prototype.setID = function (id)
	{
		this.id = id;
	};

	/**
	 * Set the frame on this element
	 * @param {number} frameWidth how wide is the frame
	 * @param {Object=} frameColor
	 * @param {?} frameOutset
	 */
	rat.ui.Element.prototype.setFrame = function (frameWidth, frameColor, frameOutset)
	{
		this.frameWidth = frameWidth;
		if (typeof frameColor !== 'undefined')
		{
			if (typeof frameColor === 'string')	//	support style string
				this.frameColor.copyFrom(rat.graphics.Color.makeFromStyleString(frameColor));
			else
				this.frameColor.copyFrom(frameColor);
		}
		else if( frameColor === void 0 )
			this.frameColor.copyFrom(rat.graphics.white);
		
		if (typeof frameOutset !== 'undefined')
			this.frameOutset = frameOutset;
		
		//	we consider "frame" rendering to happen outside offscreen buffers,
		//	so, this does not mark US as dirty, but we do need to re-render our parent.
		if (this.parent)
			this.parent.setDirty(true);
	};

	rat.ui.Element.prototype.setFrameRandom = function (frameWidth)
	{
		this.frameWidth = frameWidth;
		this.frameColor.setRandom();
		//	leave outset whatever it was
		
		//	see setFrame notes above
		if (this.parent)
			this.parent.setDirty(true);
	};

	/**
	//	get global coordinates from local coordinates relative to me.  Compare with getGlobalContentPos below.
	//	this involves processing the chain from parent to parent, to the top level.
	//	But we do that locally, instead of recursively, to avoid extra function calls and overhead.
	* @param {number=} x
	* @param {number=} y
	*/
	rat.ui.Element.prototype.getGlobalPos = function (x, y)
	{
		if (x === void 0)
		{
			x = 0;
			y = 0;
		}

		var pane = this;
		do
		{	
			//	factor in my scale
			x *= pane.scale.x;
			y *= pane.scale.y;

			//	move to parent space
			x += pane.place.pos.x;
			y += pane.place.pos.y;

			if (pane.parent)
			{
				//	factor in scrolled/scaled content
				x *= pane.parent.contentScale.x;
				y *= pane.parent.contentScale.y;
				x += pane.parent.contentOffset.x;
				y += pane.parent.contentOffset.y;
			}
			pane = pane.parent;
		} while (pane);
		
		//return new rat.Vector(x, y);
		return {x:x, y:y};
	};

	//	get global coordinates from a point inside my content.
	//	This is different from above if MY content itself is scrolled.
	//	So, this is useful mostly for scrollview content
	rat.ui.Element.prototype.getGlobalContentPos = function (x, y)
	{
		if (typeof x === 'undefined')
		{
			x = 0;
			y = 0;
		}
		//	factor in scrolled/scaled content
		x *= this.contentScale.x;
		y *= this.contentScale.y;
		x += this.contentOffset.x;
		y += this.contentOffset.y;
		
		return this.getGlobalPos(x, y);
	};

	//	convert parent-space point to local space point.
	//	this factors in:
	//		my location inside parent
	//		my scale, if any
	rat.ui.Element.prototype.parentToLocalPos = function (x, y)
	{
		var relPos = new rat.Vector(x, y);
		relPos.x -= (this.place.pos.x);// - this.center.x);
		relPos.y -= (this.place.pos.y);// - this.center.y);

		//	factor in my scale
		//	(this is a divide because we draw scaled up,
		//		so a point on the screen is bigger than logical points inside me and my subelements,
		//		who know nothing about my scale)
		relPos.x /= this.scale.x;
		relPos.y /= this.scale.y;

		return relPos;
	};

	//	convert parent-space point to local content space point.
	//	The difference here is that we factor in our content scroll, which is useful for scrollviews.
	//	So, this factors in:
	//		my location inside parent
	//		my scale
	//		my content scroll, if any
	//		my content scale, if any
	rat.ui.Element.prototype.parentToLocalContentPos = function (x, y)
	{
		var pos = this.parentToLocalPos(x, y);

		pos.x -= this.contentOffset.x;
		pos.y -= this.contentOffset.y;
		pos.x /= this.contentScale.x;
		pos.y /= this.contentScale.y;
		
		return pos;
	};
	
	//	TODO:  Why are there no globalToLocalPos and globalToLocalContentPos functions?
	//	they're tricky, but need to exist.  Walk through parent chain from global to self, converting space using parentToLocal function.
	//	probably do this with postorder recursion.

	//
	//	Utility function to apply this function (as a "call") to all subelements recursively (with arg), including this one.
	//	If any element returns non-false it means it handled everything, and we should stop calling.
	//
	//	NOTE:  This will call this specific function on each element, but won't handle polymorphism!  If you just want to apply a utility function, great.
	//		if you want to give every subpane a chance to override and handle in their own way, this is not the approach you want.
	//	We could support that by using a function NAME instead of a function.  That'd be a different utility, I think, though similar to this.
	//
	//	todo: use this in more places?
	//	todo: varargs
	/**
	 * @param {?} func
	 * @param {?} arg
	 */
	rat.ui.Element.prototype.applyRecursively = function (func, arg)
	{
		//	do my own handling
		var res = func.call(this, arg);
		if (res)
			return res;

		//	now handle for all children
		if (this.subElements)
		{
			for (var i = 0; i < this.subElements.length; i++)
			{
				//	call this recursive utility on each subelement
				res = this.subElements[i].applyRecursively(func, arg);
				if (res)
					return res;
			}
		}
		return false;
	};

	//
	//	Utility function to pass this call down to all subelements,
	//	This is not inherently recursive, but will recurse if the applied function also calls this function again, which is often the case.
	//
	rat.ui.Element.prototype.callForSubElements = function (func, arg)
	{
		if (this.subElements)
		{
			for (var i = 0, len = this.subElements.length; i !== len; ++i)
			{
				var res = func.call(this.subElements[i], arg);
				if (res)
					return res;
			}
		}
		return false;
	};

	//
	//	Utility function to pass this call down to all subelements,
	//	with relative pos calculated...
	//	This is not inherently recursive, but will recurse if the applied function also calls this function again, which is often the case.
	//	TODO:  There must be a better way to do all this in JS.
	//		at the very least, use varargs here.
	//
	rat.ui.Element.prototype.callForSubElementsWithPos = function (func, pos, arg1)
	{
		if (this.subElements)
		{
			//	let subelements handle this.  Make sure they're thinking in MY coordinates (parent, to them)
			//	and include my scroll state, if any, since subelements are part of my contents

			var relPos = this.parentToLocalContentPos(pos.x, pos.y);

			//var relPos = pos.copy();
			//relPos.x -= (this.place.pos.x + this.contentOffset.x); // - this.center.x);
			//relPos.y -= (this.place.pos.y + this.contentOffset.y); // - this.center.y);

			// Handle the elements front to back
			for (var i = this.subElements.length - 1; i >= 0; i--)
				//for (var i = 0; i < this.subElements.length; i++)
			{
				var res = func.call(this.subElements[i], relPos, arg1);
				if (res)
					return res;
			}
		}
		return false;
	};

	//
	//	update me and my subelements
	//	(e.g. animate sprites, jiggle, whatever.)
	//	compare and contrast with animator class...
	//	this is for more internal class-specific animation, like changing my internal appearance over time.
	//	animator class is for pushing around elements externally.
	//
	rat.ui.Element.prototype.update = function (dt)
	{
		rat.ui.updateCallCount++;	//	debug
		
		//	let's hope nobody (me, and my children) needed an update, and we'll correct that assumption below if needed.
		//	the only way for my needsUpdate flag to get turned off is if my own update functions (updateSelf, updateSelfPost)
		//	report back that they didn't need an update, and my children also don't need one.
		var neededUpdate = false;
		
		//	if I have an updateself, call that.  (convenience for subclasses and game use)
		if (this.updateSelf)
		{
			var res = this.updateSelf(dt);
			if (res === void 0 || res === true)	//	either doesn't understand update system or explicitly needs update
				neededUpdate = true;
		}

		//	New approach:  don't use callForSubElements, do my own loop.
		//	update() is taking a lot of time in some games.  I'd like to minimize this.
		//	More importantly, we now do some flag checking as we loop through...
		if (this.subElements)
		{
			var len = this.subElements.length;
			for (var i = 0; i < len; ++i)
			{
				var e = this.subElements[i];
				if (e.needsUpdate)
				{
					var res = e.update(dt);
					if (res === void 0 || res === true)	//	either doesn't understand update system or explicitly needs update
						neededUpdate = true;
				}
			}
		}
		
		//	old way
		//this.callForSubElements(rat.ui.Element.prototype.update, dt);

		//	tooltip processing - is this a good place?  Update my own tooltip...
		if (this.toolTip)
		{
			neededUpdate = true;	//	let's assume if we have a tooltip at all, we need to update it frequently.
			
			if ((this.flags & rat.ui.Element.mouseInFlag)
					&& (this.flags & rat.ui.Element.visibleFlag))
			{
				this.toolTip.timer += dt;
				if (this.toolTip.timer > rat.ui.TOOL_TIP_TIME)
				{
					//console.log("show tooltip");
					//	eh... don't bother with visibility flag - they explicitly get drawn from elsewhere
					//this.toolTip.setVisible(true);

					//	if this is a mouse-tracking tooltip, update position every frame...
					if (this.toolTipPlacementFromMouse)
					{
						this.positionToolTip(this.toolTipPlacement, this.toolTipPlacementOffset, this.toolTipPlacementFromMouse);
					}

					//	convert tooltip pos to global space, in case something has moved
					var globalPos = this.getGlobalPos(this.toolTipOffset.x, this.toolTipOffset.y);
					this.toolTip.setPos(globalPos.x, globalPos.y);
					this.toolTipScreen.activeToolTip = this.toolTip;	//	set each frame - gets drawn and cleared later
				}
			} else
			{
				this.toolTip.setVisible(false);
				this.toolTip.timer = 0;
			}
		}
		
		//	updateSelfPost (optional, of course) is for panes to update after their subpanes have updated.
		if (this.updateSelfPost)
		{
			var res = this.updateSelfPost(dt);
			if (res === void 0 || res === true)	//	either doesn't understand update system or explicitly needs update
				neededUpdate = true;
		}

		//	OK, finally, if we got through that without anybody needing an update (or just not really telling us)
		//	let's turn off our needsUpdate flag.
		//	This will stay off until somebody explicitly sets it again,
		//	or calls setNeedsUpdate() on us or a child.
		if (!neededUpdate)
			this.needsUpdate = false;
		
		return this.needsUpdate;
	};
	
	//	needs update tracking
	rat.ui.Element.prototype.setNeedsUpdate = function (needs)
	{
		if (needs === void 0)
			needs = true;
		this.needsUpdate = needs;
		
		if (!needs)	//	if clearing, just apply to us
			return;
		
		//	this also means my whole parent chain needs update.
		//	do this all directly in a loop here to save some time
		var e = this.parent;
		while (e)
		{
			e.needsUpdate = true;
			e = e.parent;
		}
	};

	rat.ui.Element.prototype.autoCenter = function ()
	{
		this.center.x = this.size.x / 2;
		this.center.y = this.size.y / 2;
	};
	
	rat.ui.Element.prototype.setCenter = function (x, y)
	{
		this.center.x = x;
		this.center.y = y;
		
		//	see setScale notes above
		if (this.parent)
			this.parent.setDirty(true);
	};

	//	assuming our size is correct, center this pane at this position.
	//	(the point given needs to be in my parent space)
	rat.ui.Element.prototype.centerAt = function (atX, atY)
	{
		var x = atX - this.size.x / 2;
		var y = atY - this.size.y / 2;
		this.setPos(x, y);
	};
	
	//	assuming our size is correct, center us in parent
	rat.ui.Element.prototype.centerInParent = function ()
	{
		if (!this.parent)
			return;

		//console.log("centerInParent: " + this.size.x + " p " + this.parent.size.x);

		this.place.pos.x = (this.parent.size.x - this.size.x) / 2;
		this.place.pos.y = (this.parent.size.y - this.size.y) / 2;
		
		//	see setScale notes above
		this.parent.setDirty(true);
	};

	//	assuming our size is correct, center us horizontally in parent
	rat.ui.Element.prototype.centerInParentHorizontally = function ()
	{
		if (!this.parent)
			return;

		this.place.pos.x = (this.parent.size.x - this.size.x) / 2;
		
		this.parent.setDirty(true);
	};

	//	assuming our size is correct, center us vertically in parent
	rat.ui.Element.prototype.centerInParentVertically = function ()
	{
		if (!this.parent)
			return;

		this.place.pos.y = (this.parent.size.y - this.size.y) / 2;
		
		this.parent.setDirty(true);
	};

	//
	//	resize to parent size.
	//	todo maybe rename this function to resizeToParent, or fitToParentSize or something?
	//	why "auto"?  Well, it does seem to be the first thing I think of when I imagine this function...  maybe leave it.
	rat.ui.Element.prototype.autoSizeToParent = function ()
	{
		if (!this.parent)
			return;

		//console.log("autoSizeToParent: " + this + " p " + this.parent);
		this.setBounds(0, 0, this.parent.size.x, this.parent.size.y);
	};

	rat.ui.Element.prototype.autoSizeToContent = function ()
	{
		this.size.x = this.contentSize.x;
		this.size.y = this.contentSize.y;

		this.boundsChanged();
	};

	//	get my bounds in parent space
	//	Factor in my own scale automatically, if I'm scaled, because various things like tooltip highlights make more sense this way.
	rat.ui.Element.prototype.getBounds = function (dest)
	{
		var r = dest || new rat.shapes.Rect();
		r.x = this.place.pos.x - this.center.x;
		r.y = this.place.pos.y - this.center.y;
		r.w = this.size.x * this.scale.x;
		r.h = this.size.y * this.scale.y;
		return r;
	};
	//	old name for compatibility
	//rat.ui.Element.prototype.getMyBounds = rat.ui.Element.prototype.getBounds;

	//	get my local bounds (x and y are always 0)
	rat.ui.Element.prototype.getLocalBounds = function ()
	{
		var r = new rat.shapes.Rect(0 - this.center.x, 0 - this.center.y, this.size.x, this.size.y);
		return r;
	};
	//	old name for compatibility
	rat.ui.Element.prototype.getMyLocalBounds = rat.ui.Element.prototype.getLocalBounds;

	//	get my global bounds
	rat.ui.Element.prototype.getGlobalBounds = function ()
	{
		var pos = this.getGlobalPos();

		var r = new rat.shapes.Rect(pos.x - this.center.x, pos.x - this.center.y, this.size.x, this.size.y);
		return r;
	};

	//
	//	adjust this bounds variable for use in testing touch/move in/out of bounds.
	//	this is different because for some events we'll want to factor in fat fingers
	//
	rat.ui.Element.prototype.adjustBoundsForPointer = function (bounds, ratEvent)
	{
		if (ratEvent && ratEvent.isFromTouch)
		{
			var radX = ratEvent.touchRadiusX;
			var radY = ratEvent.touchRadiusY;
			bounds.x -= radX;
			bounds.y -= radY;
			bounds.w += radX * 2;
			bounds.h += radY * 2;
		}
		return bounds;
	};

	//	The cursor newly entered my bounds (regardless of pressed or not)
	//	(called for each element from handleMouseMove below)
	//	Note that this is only called if the mouse is not already inside this element.
	rat.ui.Element.prototype.mouseEnter = function ()
	{
		//console.log("..enter " + this.name);

		if ((this.flags & rat.ui.Element.enabledFlag) === 0)	//	don't process if we're disabled
			return;

		var oldFlags = this.flags;
		this.flags |= rat.ui.Element.mouseInFlag;

		if (this.flags & rat.ui.Element.trackingMouseDownFlag)
		{
			//	pressed state happens if we were tracking mousedown
			this.flags |= rat.ui.Element.pressedFlag;
		}
		else
		{
			//console.log("..high " + this.name);
			//	if we were not already tracking a click, use highlight state to highlight that this is clickable
			this.flags |= rat.ui.Element.highlightedFlag;
		}
		this.checkFlagsChanged(oldFlags);

	};

	//	mouse left my bounds, regardless of pressed or not
	//	(called for each element from handleMouseMove below)
	rat.ui.Element.prototype.mouseLeave = function ()
	{
		if ((this.flags & rat.ui.Element.enabledFlag) === 0)	//	don't process if we're disabled
			return;

		//if (this.isVisible())
		//	console.log("..leave " + this.name);
		var oldFlags = this.flags;
		
		this.flags &= ~rat.ui.Element.mouseInFlag;

		//	only unhighlight if we were not tracking a click
		if ((this.flags & rat.ui.Element.trackingMouseDownFlag) === 0)
		{
			//console.log("..unhigh " + this.name);
			this.flags &= ~rat.ui.Element.highlightedFlag;
		}
		this.flags &= ~rat.ui.Element.pressedFlag;	//	not pressed if moved outside
		
		this.checkFlagsChanged(oldFlags);
	};

	//
	//	mouse clicked down 
	//	only called if mouse down happened in my bounds
	//	pos is in LOCAL space to make local logic easier for classes in this module and for user subclasses
	//	(called for each element from handleMouseDown below)
	rat.ui.Element.prototype.mouseDown = function (pos, ratEvent)
	{
		if ((this.flags & rat.ui.Element.enabledFlag) === 0)	//	don't process if we're disabled
			return false;

		var oldFlags = this.flags;
		this.flags |= rat.ui.Element.trackingMouseDownFlag;
		this.flags |= rat.ui.Element.pressedFlag;
		this.checkFlagsChanged(oldFlags);

		if (this.clickSound && rat.audio)
			rat.audio.playSound(this.clickSound);
		
		//	return whether we handled this click or not.
		//	Not sure what counts as "handled" in this case...
		//	Currently, we let multiple panes track a click,
		//		especially in the case of a container and its subpanes.
		//	So, let's not claim this click event as exclusively ours.
		return false;
	};

	//	mouse up
	//	called whether the mouseup happened inside this element's bounds or not.
	//	(in case we were tracking)
	//	pos is in LOCAL space to make local logic easier for classes in this module and for user subclasses
	//	(called for each element from handleMouseUp below)
	rat.ui.Element.prototype.mouseUp = function (pos, ratEvent)
	{
		if ((this.flags & rat.ui.Element.enabledFlag) === 0)	//	don't process if we're disabled
			return false;

		var oldFlags = this.flags;

		//	clear relevant flags.
		//  Do this before trigger() below, in case some distant function cares about our flags.
		//  For instance (complicated but likely scenario), a new window is popped up,
		//      and we try to unhighlight this button with mouseLeave(), which checks trackingMouseDownFlag.
		this.flags &= ~rat.ui.Element.trackingMouseDownFlag;
		this.flags &= ~rat.ui.Element.pressedFlag;
		//this.flags &= ~rat.ui.Element.mouseInFlag;
		//this.flags &= ~rat.ui.Element.highlightedFlag;

		//	were we tracking a click,
		var handled = false;
		if (oldFlags & rat.ui.Element.trackingMouseDownFlag)
		{
			var myBounds = this.getLocalBounds();
			this.adjustBoundsForPointer(myBounds, ratEvent);

			//	and was this mouseup in our bounds?  If so, trigger!
			if (rat.collision2D.pointInRect(pos, myBounds))
			{
				//	...  All elements fire a triggere when they get a mouse up.. 
				//	But most don't do anything about it...  How to know
				handled = this.trigger();
				if (handled)
					rat.eventMap.fireEvent("uiTriggered", this);
			}
			else	//	were tracking, they let up outside
			{
				//  unhighlight. should maybe do this in either case.
				this.flags &= ~rat.ui.Element.highlightedFlag;
				//	We were tracking this - probably should return true here.
				//	(this was our mouse input, and we did handle it)
				handled = true;
			}
		}

		this.checkFlagsChanged(oldFlags);

		return handled;
	};

	//
	//	Handle mouse movement to new position.
	//	pass down to subelements.
	//	this position is relative to our parent (parent space)
	//		"pos" is passed in separately from the event so it can be modified locally
	//			(e.g. change coordinate systems) without modifying the original event, and passed down recursively
	//
	//	TODO: correctly deal with "handled" for this and related mousemove functions, like other events.
	//
	//	TODO:  handleMouseMove is called for EVERY element in a screen, currently, which can get really slow,
	//		and affects performance on low-end machines in a painful way.
	//		We need to find a way to support all the funky leave stuff below without even calling this function for
	//		elements that don't care, e.g. they weren't already tracking.  Maybe some "trackingMouse" flag, that's
	//		a superset of trackingMouseDown?
	//		Actually, what we need is a screen-level 'care about mousemove' list, and a set of changes like this:
	//			mousemove should only be called for
	//				+ elements that mouse is really inside (inBounds)
	//				+ and elements in a special 'care about mousemove' list.
	//			elements get added to that list when the mouse moves inside them (e.g. mouseEnter is called)
	//			elements get removed from that list when they decide to let go
	//				(by default, on mouseLeave, but some classes can override)
	//				(e.g. thumb in scrollbar)
	//			elements that get removed from tree or deleted need to get removed from that list - how to do that?
	//				maybe auto-clean-up from that list of we go a frame without calling an element's handleMouseMove? ('cause it's not in the tree)
	//				yes, an auto-clean-up approach seems most robust.
	//			The reason it needs to be a list is that tracking might need to happen deep down the tree, inside a group.
	//				and we'd need to traverse the whole tree to even get to those items, without filtering by inBounds,
	//				if we didn't have a separate list.  Traversing the whole tree and checking every object is what's already causing performance problems.
	//			Note that it should be a list of lists, to handle multiple simultaneous input (e.g. finger) movements, in the future.
	//			Also note that Mouse UP should go through this same prioritized list of handlers.
	//		Actually, I'm no longer sure of this.  It could be really complicated.
	//		And is this the biggest problem we need to solve right now?
	//
	rat.ui.Element.prototype.handleMouseMove = function (newPos, handleLeaveOnly, ratEvent)
	{
		if (!this.isVisible())	//	don't handle mouse if I'm invisible - what do they think they're clicking on or hovering over?
			return false;

		rat.ui.mouseMoveCallCount++;	//	debugging
		
		//	handleLeaveOnly is a way to let subpanes (remember this is a recursive function) let go of mouse tracking, if they need to,
		//	but don't start any new tracking.  This is to support things like items inside a scrollview, and the mouse is inside, then outside the scrollview.
		if (typeof (handleLeaveOnly) === 'undefined')
			handleLeaveOnly = false;

		///@todo	correctly handle rotation?

		var myBounds = this.getBounds(this.tempRect);
		this.adjustBoundsForPointer(myBounds, ratEvent);
		var inBounds = rat.collision2D.pointInRect(newPos, myBounds);

		if (!handleLeaveOnly && inBounds && (this.flags & rat.ui.Element.mouseInFlag) === 0)
			this.mouseEnter();
		if (handleLeaveOnly || (!inBounds && (this.flags & rat.ui.Element.mouseInFlag)))
			this.mouseLeave();

		//	let all subelements handle this, regardless of mouse position.
		//	? Unless we've got clipping on, and this movement is outside my space
		//	in which case the user can't see the thing reacting, so don't even try it.
		//	TODO:  ignore clip flag?  Just never pass down if this move is outside our space?
		//	This still not ideal.  elements that were tracking mouse should get a chance to realize they're not tracking it anymore,
		//		but it depends on element behavior...  See store screen in agent for example.
		//	Also, imagine a scrollbar thumb the user has clicked on, and we want it to track that click until they let go,
		//		regardless of where they drag their mouse.  Gotta keep calling handleMouseMove in that case.
		//if (!inBounds && (this.flags & rat.ui.Element.clipFlag) != 0)
		//	return;
		if (!inBounds && (this.flags & rat.ui.Element.clipFlag) !== 0)
			handleLeaveOnly = true;

		//	Make sure subelements are thinking in parent-relative coordinates (we are the parent in that case)
		var relPos = this.parentToLocalContentPos(newPos.x, newPos.y);

		//	remember that relative pos for later calculations relative to mouse position, like tooltips
		this.mousePos = relPos;

		//	if we have a local mouseMove function, call that now, using local coordinates..
		//	why do we check this here, and not check mouseDown and mouseUp?  inconsistent...?
		if (this.mouseMove)
		{
			//	factor in handleLeaveOnly here?
			this.mouseMove(relPos, ratEvent);
		}

		//	why not using callForSubElementsWithPos like others?  Probably should?
		//	Note that callForSubElementsWithPos does the offset/scale calculation above, so we'd pass in newPos in that case...
		//	and we've have to add a second arg, or support varargs (see callForSubElementsWithPos)
		//	Also, we're changing the behavior a bit, checking some flags here for speed.
		if (this.subElements)
		{
			//	walk through backwards, so elements that draw on top get processed first.
			for (var i = this.subElements.length-1; i >= 0; i--)
			{
				var elem = this.subElements[i];
				if (elem.flags & rat.ui.Element.tracksMouseFlag)
					elem.handleMouseMove(relPos, handleLeaveOnly, ratEvent);
			}
		}
	};

	//
	//	Handle and pass on mouse down event, by calling appropriate mouseDown function
	//	for whatever pane was clicked in...
	//
	//	todo: maybe change this to postOrder, and let an element say it was handled,
	//		and if it was handled, don't keep passing down.
	//
	//	This is split into two functions (handleMouseDown and mouseDown) so most subclasses
	//	don't have to worry about the recursive logic here, they just implement mouseDown if they care.
	//
	//	POS is relative to our parent (parent space)
	//
	rat.ui.Element.prototype.handleMouseDown = function (pos, ratEvent)
	{
		if (!this.isVisible())	//	don't handle mouse if I'm invisible - what do they think they're clicking on?
			return false;

		var myBounds = this.getBounds(this.tempRect);
		this.adjustBoundsForPointer(myBounds, ratEvent);
		var inBounds = rat.collision2D.pointInRect(pos, myBounds);

		var handled = false;

		//	OK, but if we have real clipping turned on, and it's outside our space, then don't pass down.
		//	The logic is this:  If we have real clipping turned on, our bounds have to be accurate,
		//	so it's OK to pay attention to that,
		//	and the user can't see anything outside those bounds anyway, since it's clipped during draw,
		//	So, only pass down clicks if we're in bounds or not clipped.
		//	NOTE:  we should probably just require this all the time and stop babying containers that have been set up wrong...
		if (inBounds || (this.flags & rat.ui.Element.clipFlag) === 0)
			handled = this.callForSubElementsWithPos(rat.ui.Element.prototype.handleMouseDown, pos, ratEvent);

		if (inBounds && !handled)
		{
			//	Convert to local coordinates
			//	Ignore scroll for myself - this position is in "my" space, but not my scrolled content space - worry about that below
			var localPos = this.parentToLocalPos(pos.x, pos.y);
			handled = this.mouseDown(localPos, ratEvent);
		}
		//else
		//	return;		//	if mousedown is not in my space, don't pass down...  this requires containers to be sized correctly!
		//	STT disabling this now - it's too easy for containers to not be right, and confusing to debug.
		//	maybe reenable later

		return handled;
	};

	//	handle mouse up
	//	pos is in parent space
	rat.ui.Element.prototype.handleMouseUp = function (pos, ratEvent)
	{
		//	don't handle mouse if I'm invisible - what do they think they're clicking on?
		if (!this.isVisible || !this.isVisible())	
			return false;
		//rat.console.log("HMU (" + this.name + "): " + pos.x + "," + pos.y);

		//	always call mouseup, even if it's not in our bounds, so we can stop tracking if we were...

		//	Convert to local coordinates
		//	Ignore scroll for myself - this position is in "my" space, but not my scrolled content space - worry about that below
		var localPos = this.parentToLocalPos(pos.x, pos.y);
		//	see if I handled it myself before passing to children.
		var handled = this.mouseUp(localPos, ratEvent);

		if( !handled )
			handled = this.callForSubElementsWithPos(rat.ui.Element.prototype.handleMouseUp, pos, ratEvent);
		return handled;
	};

	//	Key handling.
	//	todo:  Rethink this, now that we have key down dispatching to target...  we don't need to go DOWN any more...
	//	todo:  document better (explain handleKeyDown vs. keyDown, maybe rename)
	//		a good name for letting people override would be "myKeyDown" or "keydownself" or something, maybe?
	//	todo:  important: come up with a nicer system for externally handling these events, too, like registering/unregistering event handlers,
	//		so multiple outside modules can register for these events and respond to them.
	//		see also things like flagsChanged()
	//	todo:
	//		start with active element?  Do we have a target system?
	//		stop when somebody handles it!
	rat.ui.Element.prototype.handleKeyDown = function (keyInfo)
	{
		/*
		var res = this.applyRecursively(rat.ui.Element.prototype.handleKeyDown, keyInfo);
		if (res)
			return res;
		*/
		return this.keyDown(keyInfo);
	};
	rat.ui.Element.prototype.handleKeyUp = function (keyInfo)
	{
		//return this.applyRecursively(rat.ui.Element.prototype.handleKeyUp, keyInfo);
		return this.keyUp(keyInfo);
	};
	//	default key down handling for this one element
	//	expected to be overridden by specific implementations
	//	key code is in keyInfo.which
	rat.ui.Element.prototype.keyDown = function (keyInfo)
	{
		return false;
	};
	rat.ui.Element.prototype.keyUp = function (keyInfo)
	{
		return false;
	};

	//	handle mouse wheel event.  event.wheelDelta tells us amount scrolled, where 1 = 1 click up, -2 = 2 clicks down
	rat.ui.Element.prototype.handleMouseWheel = function (event)
	{
		return false;
	};

	//	controller button down
	rat.ui.Element.prototype.handleButtonDown = function (ratEvent)
	{
		return false;
	};
	
	//	controller button up
	rat.ui.Element.prototype.handleButtonUp = function (ratEvent)
	{
		return false;
	};

	//	Handle a dispatched event from the system.
	//	This could be various event types, mostly stuff that would get passed to a target,
	//	so things like key/controller/voice input/wheel
	//	The various event types are all handled here so we didn't have to write several versions
	//	of event translating/dispatching code. (see screenmanager)
	rat.ui.Element.prototype.handleEvent = function (ratEvent)
	{
		//	Here is where we split out some specific event types.
		//	We didn't have to do it this way.  Everyone could have just overridden "handlEvent" or "myEvent" or something...
		//	but this made it easy for games to just override the behavior they wanted without having to override it all.
		var result = false;
		if (ratEvent.eventType === 'keydown')
			result = this.handleKeyDown(ratEvent);
		if (ratEvent.eventType === 'keyup')
			result = this.handleKeyUp(ratEvent);
		//	todo: unique keypress handling in addition to keydown/up?

		if (ratEvent.eventType === 'mousewheel')
			result = this.handleMouseWheel(ratEvent);

		//	mouse up/down events
		//	We pass "pos" and event separately here,
		//	so that each function can modify pos locally and pass it recursively, without modifying the original rat event.
		if (ratEvent.eventType === 'mousedown')
			result = this.handleMouseDown(ratEvent.pos, ratEvent);
		if (ratEvent.eventType === 'mouseup')
			result = this.handleMouseUp(ratEvent.pos, ratEvent);
		rat.ui.mouseMoveCallCount = 0;
		if (ratEvent.eventType === 'mousemove')
			result = this.handleMouseMove(ratEvent.pos, false, ratEvent);

		//	controller buttons
		if (ratEvent.eventType === 'buttondown')
			result = this.handleButtonDown(ratEvent);
		if (ratEvent.eventType === 'buttonup')
			result = this.handleButtonUp(ratEvent);

		if (ratEvent.eventType === 'ui')
			result = this.handleUIInput(ratEvent);

		if (result)
			return result;

		//	This is also where we're going to handle passing events up the command chain, if there is one.
		//	currently, we assume visual parent is command parent... (this has nothing to do with inheritance)
		if (this.parent)
		{
			result = this.parent.handleEvent(ratEvent);
			if (result)
				return result;
		}

		return result;
	};

	//	default:  do nothing with UI input
	rat.ui.Element.prototype.handleUIInput = function (event)
	{
		return false;
	};

	//	Focus and Blur functions to interact nicely with inputMap system
	rat.ui.Element.prototype.focus = function ()
	{
		if (this.canBeTarget && this.isEnabled() && this.isVisible)
		{
			var wasHighlighted = this.isHighlighted();
			this.setHighlighted(true);
			if (!wasHighlighted && this.events.onFocus)
				this.events.onFocus(this);
			return true;
		} else
		{
			return false;
		}
	};

	rat.ui.Element.prototype.blur = function ()
	{
		if (this.canBeTarget && this.isEnabled() && this.isVisible)
		{
			var wasHighlighted = this.isHighlighted();
			this.setHighlighted(false);

			if( wasHighlighted && this.events.onBlur )
				this.events.onBlur(this);
		}
		return true;
	};

	//	this or another function needs to simulate a click visually, e.g. set a timer and show pushed for a few frames.
	rat.ui.Element.prototype.press = function ()
	{
		if (this.trigger())
			rat.eventMap.fireEvent("uiTriggered", this);
	};

	//
	//	Trigger this element.  e.g. if this is a button, act like it got clicked, and send messages or whatever.
	//	This is implemented a the Element level on purpose - maybe you want a sprite or something to trigger - that's fine.
	//
	rat.ui.Element.prototype.trigger = function ()
	{
		var telem = rat.telemetry;
		var handled = false;
		if (this.command !== 0)
		{
			if (telem && this.name)
			{
				telem.recordUI('UI com', this.name);
			}

			//console.log("trigger " + this.name + " -> " + this.command);
			if (rat.dispatchCommand(this.command, this.commandInfo))
				handled = true;
		}
		if (this.callback)
		{
			if (telem && this.name)
			{
				telem.recordUI('UI cb', this.name);
			}

			var self = this;
			if (this.callback(self, this.callbackInfo))
				handled = true;
		}
		return handled;
	};

	//	set command to dispatch when triggered
	rat.ui.Element.prototype.setCommand = function (command, commandInfo)
	{
		this.command = command;
		this.commandInfo = commandInfo;
	};

	/**
	 * set function to call when triggered
	 * callback is called with (element, userInfo) args
	 * @param {function(?, ?)} callback
	 * @param {*=} userInfo
	 */
	rat.ui.Element.prototype.setCallback = function (callback, userInfo)
	{
		this.callback = callback;
		if (typeof(userInfo) !== 'undefined')
			this.callbackInfo = userInfo;
	};
	
	/**
	 * set function to call when flags change, e.g. when element is highlighted
	 * callback is called with (oldflags, userInfo) args (and using element as 'this')
	 * @param {function(?, ?)} callback
	 * @param {*=} userInfo
	 */
	rat.ui.Element.prototype.setFlagsChangedCallback = function (callback, userInfo)
	{
		this.flagsChangedCallback = callback;
		if (typeof(userInfo) !== 'undefined')
			this.callbackInfo = userInfo;
	};

	/**
	 * Set the data provided with the callbacks
	 * @param {?} userInfo
	 */
	rat.ui.Element.prototype.setCallbackInfo = function (userInfo)
	{
		this.callbackInfo = userInfo;
	};

	rat.ui.Element.prototype.setFlag = function (flag, val)
	{
		var oldFlags = this.flags;
		
		if (typeof val === 'undefined')
			val = true;
		if (val)
			this.flags |= flag;
		else
			this.flags &= ~flag;
			
		this.checkFlagsChanged(oldFlags);
	};
	
	//	another name for setFlag(flag, false)
	rat.ui.Element.prototype.clearFlag = function(flag)
	{
		this.setFlag(flag, false);
	};
	
	rat.ui.Element.prototype.setVisible = function (visible)
	{
		this.setFlag(rat.ui.Element.visibleFlag, visible);
	};
	rat.ui.Element.prototype.isVisible = function ()
	{
		return ((this.flags & rat.ui.Element.visibleFlag) !== 0);
	};

	rat.ui.Element.prototype.setHighlighted = function (highlighted)
	{
		this.setFlag(rat.ui.Element.highlightedFlag, highlighted);
	};

	rat.ui.Element.prototype.isHighlighted = function (highlighted)
	{
		return ((this.flags & rat.ui.Element.highlightedFlag) !== 0);
	};

	rat.ui.Element.prototype.setEnabled = function (enabled)
	{
		var oldFlags = this.flags;
		if (typeof enabled === 'undefined')
			enabled = true;
		if (enabled)
		{
			this.flags |= rat.ui.Element.enabledFlag;
		} else
		{
			this.flags &= ~rat.ui.Element.enabledFlag;

			//	also clear other flags, in case we were in the middle of something?
			this.flags &= ~rat.ui.Element.highlightedFlag;
			this.flags &= ~rat.ui.Element.pressedFlag;
			//this.flags &= ~rat.ui.Element.toggledFlag;
			this.flags &= ~rat.ui.Element.mouseInFlag;
			//console.log("SET ENABLED FALSE");
			this.flags &= ~rat.ui.Element.trackingMouseDownFlag;
		}
		this.checkFlagsChanged(oldFlags);
	};
	rat.ui.Element.prototype.isEnabled = function ()
	{
		return ((this.flags & rat.ui.Element.enabledFlag) !== 0);
	};

	rat.ui.Element.prototype.setToggled = function (toggled)
	{
		this.setFlag(rat.ui.Element.toggledFlag, toggled);
	};

	rat.ui.Element.prototype.isToggled = function ()
	{
		return ((this.flags & rat.ui.Element.toggledFlag) !== 0);
	};

	rat.ui.Element.prototype.setClipped = function (toClip)
	{
		this.setFlag(rat.ui.Element.clipFlag, toClip);
	};
	rat.ui.Element.prototype.setClip = rat.ui.Element.prototype.setClipped;
	rat.ui.Element.prototype.isClipped = function (toClip)
	{
		return ((this.flags & rat.ui.Element.clipFlag) !== 0);
	};

	rat.ui.Element.prototype.isPressed = function ()
	{
		//	pressed state happens if we were tracking mousedown
		return ((this.flags & rat.ui.Element.pressedFlag) !== 0);
	};
	
	rat.ui.Element.prototype.setTracksMouse = function (tracks)
	{
		this.setFlag(rat.ui.Element.tracksMouseFlag, tracks);
	};

	rat.ui.Element.prototype.setAdjustForScale = function (adjust)
	{
		this.setFlag(rat.ui.Element.adjustForScaleFlag, adjust);
	};
	
	//	Scroll a relative amount...  negative dx means content is moved to left (view scrolled to right)
	rat.ui.Element.prototype.scroll = function (dx, dy)
	{
		//console.log("scroll " + dx + ", " + dy);	
		this.contentOffset.x += dx;
		this.contentOffset.y += dy;
		
		//	TODO:  Deal with content offset changing in offscreen rendering, at some point?
		//	at the very least, this needs to set my dirty flag, right?  Here and anywhere we change contentOffset.
	};
	
	//	directly set content offset (like scroll above, but absolute)
	rat.ui.Element.prototype.setContentOffset = function (x, y)
	{
		if( x !== void 0 )
			this.contentOffset.x = x;
		if( y !== void 0 )
			this.contentOffset.y = y;
	};

	//	get current content offset (scroll) value
	rat.ui.Element.prototype.getContentOffset = function ()
	{
		return this.contentOffset.copy();
	};
	//	alternate name
	rat.ui.Element.prototype.getScroll = rat.ui.Element.prototype.getContentOffset;
	
	//	like above, get content offset, but factor in any animation also happening.
	//	return the content offset we expect to reach.
	rat.ui.Element.prototype.getTargetContentOffset = function()
	{
		var list = rat.ui.getAnimatorsForElement(this, rat.ui.Animator.scroller);
		//	if there's more than one, that's basically a bug, but don't worry about it...
		if (list && list.length > 0)
		{
			return list[0].endValue;
		}
		//	no animator - just return offset
		return this.contentOffset.copy();
	};
	
	//	return true if this point (in local space) is in our view space, factoring in scroll values and bounds
	//	useful for scrolled content
	//	(see scrollToShow below for something similar)
	rat.ui.Element.prototype.pointIsInView = function (pos, xSpace, ySpace)
	{
		if (!xSpace)
			xSpace = 0;
		if (!ySpace)
			ySpace = 0;
		var offset = this.contentOffset;
		var scale = this.contentScale;
		if ((pos.x - xSpace)*scale.x + offset.x < 0
				|| (pos.y - ySpace)*scale.y + offset.y < 0)
			return false;
		if ((pos.x + xSpace)*scale.x + offset.x > this.size.x
				|| (pos.y + ySpace)*scale.y + offset.y > this.size.y)
			return false;
		
		return true;
	};

	//	scroll from current position just enough to show this point plus space around it.
	//	"offset" is optional - if it's passed in, set THAT vector, instead of live offset.
	//	"pos" is a center point, and ySpace and xSpace determine how much space to make on each side (like a radius)
	//	see animateScrollToShowElement for a convenient way to scroll to show a subelement
	rat.ui.Element.prototype.scrollToShow = function (pos, xSpace, ySpace, offset)
	{
		if (!offset)
			offset = this.contentOffset;	//	ref
		var scale = this.contentScale;

		//	what values would barely be showing that point?  Make sure we're at least that far.

		var rightEdge = this.size.x - (pos.x + xSpace) * scale.x;		//	x scroll that would bring right edge of object in view
		var leftEdge = -(pos.x - xSpace) * scale.x;	//	x scroll that would bring left edge of object in view
		if (offset.x > rightEdge)
			offset.x = rightEdge;
		else if (offset.x < leftEdge)
			offset.x = leftEdge;

		var bottomEdge = this.size.y - (pos.y + ySpace) * scale.y;
		var topEdge = -(pos.y - ySpace) * scale.y;
		if (offset.y > bottomEdge)
			offset.y = bottomEdge;
		else if (offset.y < topEdge)
			offset.y = topEdge;

		//	if the view has useful content size info, clamp our scroll to not go outside content.
		//	We do want this here, especially when extra space parameters are set.
		this.clampScroll(offset);
	};

	//
	//	animated version of the above - set up an animator to scroll us, over time, to the appropriate position.
	//	TODO:  Maybe remove all these paired functions and just don't animate if time is 0 or undefined.
	//
	rat.ui.Element.prototype.animateScrollToShow = function (pos, xSpace, ySpace, time)
	{
		var offset = this.contentOffset.copy();
		this.scrollToShow(pos, xSpace, ySpace, offset);	//	calculate desired scroll position

		this.animateScroll(offset, time);
	};

	//
	//	Maybe more convenient - scroll to show a specific element
	//
	rat.ui.Element.prototype.animateScrollToShowElement = function (element, extraXSpace, extraYSpace, time)
	{
		if (typeof (extraXSpace) === 'undefined')
			extraXSpace = 0;
		if (typeof (extraYSpace) === 'undefined')
			extraYSpace = 0;
		if (typeof (time) === 'undefined')
			time = 0;

		var bounds = element.getBounds(this.tempRect);
		
		this.animateScrollToShow(
				{ x: bounds.x + bounds.w / 2, y: bounds.y + bounds.h / 2 },
				bounds.w / 2 + extraXSpace,
				bounds.h / 2 + extraYSpace,
				time);
	};

	/**
	* scroll this point to center
	* @param {Object=} offset
	*/
	rat.ui.Element.prototype.scrollToCenter = function (pos, offset)
	{
		if (!offset)
			offset = this.contentOffset;	//	ref
		offset.x = this.size.x / 2 - pos.x * this.contentScale.x;
		offset.y = this.size.y / 2 - pos.y * this.contentScale.y;

		this.clampScroll(offset);
	};

	rat.ui.Element.prototype.animateScrollToCenter = function (pos, time)
	{
		var offset = this.contentOffset.copy();
		this.scrollToCenter(pos, offset);	//	calculate desired scroll position

		this.animateScroll(offset, time);
	};
	
	/**
	* Scroll to center my content automatically
	* @param {Object=} offset
	*/
	rat.ui.Element.prototype.scrollToCenterContent = function (offset)
	{
		if (!offset)
			offset = this.contentOffset;	//	ref
		offset.x = this.size.x / 2 - this.contentSize.x / 2 * this.contentScale.x;
		offset.y = this.size.y / 2 - this.contentSize.y / 2 * this.contentScale.y;

		//	in this case, don't clamp, since half the point is to center content that isn't as large as the view containing it.
	};

	//	animate to a given absolute content offset
	//	(used by other functions above, and directly by some games)
	rat.ui.Element.prototype.animateScroll = function (offset, time)
	{
		//	It seems very unlikely that you'd want to have two scroll animations
		//	active at once.  If this later turns out to be not true,
		//	we can make it optional somehow, or remove this call and depend on caller to decide.
		var hadScroller = rat.ui.killAnimatorsForElement(this, rat.ui.Animator.scroller);
		
		var animator = new rat.ui.Animator(rat.ui.Animator.scroller, this);
		animator.setTimer(time);
		//	todo, scale this by distance, somehow?  pass in pixels per sec speed instead of time?
		var startVal = { x: this.contentOffset.x, y: this.contentOffset.y };
		var endVal = { x: offset.x, y: offset.y };
		animator.setStartEndVectors(startVal, endVal);
		animator.setAutoDie();	//	kill animator when it's done
		
		//	if we were already scrolling, don't bother with ramp up in movement...
		//	this helps is avoid something like:  user holds down scroll key,
		//	and because keep easing in each frame, we only move a tiny bit until they let go.
		if (hadScroller)
			animator.setInterpFilter(rat.ui.Animator.filterEaseOut);
	};

	/**
	//	clamp scroll offset to keep from scrolling past edges of actual content,
	//	based on contentSize being correct.
	//	todo allow optional passing in a potential value, and clamp that instead of my current value.
	* @param {Object=} offset
	*/
	rat.ui.Element.prototype.clampScroll = function (offset)
	{
		if (!offset)	//	if one wasn't passed in, use the live one (set a ref to it)
			offset = this.contentOffset;

		if (this.contentSize.x <= 0 || this.contentSize.y <= 0)
			return;	//	was never set...

		var leftMax = -(this.contentSize.x * this.contentScale.x - this.size.x);	//	the farthest contentoffset.x can go
		var upMax = -(this.contentSize.y * this.contentScale.y - this.size.y);	//	the farthest contentoffset.y can go

		if (offset.x < leftMax)
			offset.x = leftMax;
		if (offset.y < upMax)
			offset.y = upMax;
		if (offset.x > 0)
			offset.x = 0;
		if (offset.y > 0)
			offset.y = 0;
	};
	
	//	Here's how we're going to implement zoom.
	//	Like contentSize and offset, the zoom of a pane will refer to the *contents*
	//		of that pane being zoomed by that value.
	//	Why?  We want to be able to zoom the contents of a scrollview, without
	//		having to make assumptions about the content, like knowing there's only one element.
	//		So, easiest to say "zoom refers to my contents".
	//		Our contents will be oblivious to being zoomed, and our contentSize will still refer
	//		to the natural size of our contents before being scaled.
	//	We're going to use a new "zoom" value instead of the existing scale value.
	//	Why?  Because scale already seems to refer to ME being scaled, including my frame?
	//		and it will correlate better with contentSize,
	//		and it'll be easier to insert in the right place in the draw logic, which is complicated.
	//		currently, scale happens pretty early, as part of the whole frame transform...
	//	Like offset, zoom will be implemented at this Element level rather than in scrollview.
	//	Why?  Because it will let us zoom things without having to make them scrollviews,
	//		and when we need to factor zoom into things like localtoglobal position calculation,
	//		we can do that in the base level functions here without having to override elsewhere.
	//		We also will want to do some nice simultaneous zoom/scroll handling, so let's do it
	//		in the same place.
	
	//	directly set content scale
	rat.ui.Element.prototype.setContentScale = function (x, y)
	{
		if( x !== void 0 )
			this.contentScale.x = x;
		if( y !== void 0 )
			this.contentScale.y = y;
		this.setDirty(true);
	};
	//	add a value to current zoom/scale level
	//		(add instead of multiply so that it can be undone)
	rat.ui.Element.prototype.stepZoom = function(delta)
	{
		this.contentScale.x += delta;
		this.contentScale.y += delta;
		this.clampContentScale();
		this.setDirty(true);
	};
	//	clamp scale to the min/max we set previously.
	rat.ui.Element.prototype.clampContentScale = function()
	{
		if (this.contentScale.x < this.contentScaleMin.x)
			this.contentScale.x = this.contentScaleMin.x;
		if (this.contentScale.y < this.contentScaleMin.y)
			this.contentScale.y = this.contentScaleMin.y;
		if (this.contentScale.x > this.contentScaleMax.x)
			this.contentScale.x = this.contentScaleMax.x;
		if (this.contentScale.y > this.contentScaleMax.y)
			this.contentScale.y = this.contentScaleMax.y;
	};
	rat.ui.Element.prototype.setContentScaleLimits = function(min, max)
	{
		this.contentScaleMin.x = this.contentScaleMin.y = min;
		this.contentScaleMax.x = this.contentScaleMax.y = max;
	};
	
	//	I deeply question this function.  See notes in Sprite module.
	rat.ui.Element.prototype.drawTiled = function(w, h)
	{
		//	nothing, usually overridden
	};

	//	standard draw function does all the work of putting us in the right space,
	//	drawing subElements, etc.
	//	calls drawSelf() for easy overriding in subclasses
	//	(generally speaking, nobody else will need to override draw().  They can just use drawSelf)
	rat.ui.Element.prototype.draw = function (toOffscreen)
	{
		if (!this.isVisible())	//	don't draw me or sub stuff if I'm invisible
			return;
		if (toOffscreen === void 0)	//	not specified
			toOffscreen = false;
		
		//	Give panes a chance to update our state before we draw
		//	note that we're passing in offscreen flag now, so we'll let preDraw decide if it should respect offscreen flag.
		//if (!toOffscreen && this.preDraw )
		if (this.preDraw)
		{
			//	do this BEFORE we handle dirty pane rendering
			res = this.preDraw(toOffscreen);
			if (res && res.abortDraw)
				return;
		}
		
		//	If we're supposed to be using an offscreen buffer, and it doesn't exist or needs updating, update it now.
		//	this will re-enter this function with toOffscreen set to true, among other things.  :)
		if (this.useOffscreen &&
			(!this.offscreen
			|| this.isDirty
			|| (this.checkDirty && this.checkDirty())
			))
		{
			this.renderOffscreen();
			//	and then continue on below, with a prepared offscreen!
		}

		var ctx = rat.graphics.getContext();
		
		//	Rendering to offscreen?  If so, skip a whole bunch of stuff.
		
		//	if rendering offscreen, don't do save/restore or transforms.
		//	Just render cleanly into correctly-sized offscreen buffer.
		//	This is important - we don't want offscreen buffer size affected by position or rotation.
		
		if (!toOffscreen)
		{
			rat.graphics.save();

			// Use applyTransformation() function if one is present,
			// so subclasses can change transformation behavior, if needed.
			// (i.e. change transformation order, change how centering works, etc.)
			if (this.applyTransformation) {
				this.applyTransformation(ctx);
			}
			else {
				rat.graphics.translate(this.place.pos.x, this.place.pos.y);
				if (this.place.rot.angle)
					rat.graphics.rotate(this.place.rot.angle);
				if (this.scale.x !== 1 || this.scale.y !== 1)
					rat.graphics.scale(this.scale.x, this.scale.y);			
			}
		
			//	include or don't include frame?
			//	Frame drawing could go inside the offscreen buffer,
			//		but we need to commit to whether the frame is exactly aligned, and inside our space, or outside.
			//		if outside, it can't be in the buffer, which is always our exact size.
			
			rat.graphics.frameStats.totalElementsDrawn++;	//	for debugging, track total elements drawn per frame
			
			if (this.opacity < 1)
				ctx.globalAlpha = this.opacity;
			
		}	//	end of !toOffscreen check
		
		//	draw my frame, if any.
		//	One problem with drawing the frame here is that it gets scaled,
		//	if there's a scale.  In lots of other ways, we ignore scale when dealing
		//	with bounds, right?  Are frames and bounds supposed to be the same?
		//	We mostly use frames to debug, so it's nice for them to match bounds...
		//	Frames are weird.
		if (this.frameWidth > 0)
		{
			ctx.strokeStyle = this.frameColor.toString();
			ctx.lineWidth = this.frameWidth;
			ctx.strokeRect(-this.center.x - this.frameOutset, -this.center.y - this.frameOutset,
					this.size.x + 2 * this.frameOutset, this.size.y + 2 * this.frameOutset);
		}

		//	Apply clipping, if needed.
		if (!toOffscreen && this.flags & rat.ui.Element.clipFlag)
		{
			ctx.beginPath();
			/*
			ctx.moveTo(0, 0);
			ctx.lineTo(this.size.x, 0);
			ctx.lineTo(this.size.x, this.size.y);
			ctx.lineTo(0, this.size.y);
			ctx.lineTo(0, 0);
			*/
			ctx.rect(0, 0, this.size.x, this.size.y);
			ctx.clip();
		}
		
		//	render FROM my offscreen image.
		if (!toOffscreen && this.useOffscreen && this.offscreen)
		{
			//	center support here only works this cleanly because we were careful to skip centering when we rendered in renderOffscreen()
			this.offscreen.render(ctx, -this.center.x, -this.center.y);
			
			//	TODO:  If rendering FROM offscreen, and transform is simple, skip the whole save/restore business above as well.
			
		} else {	//	finally, a normal manual draw
			
			if (this.events.beforeDraw)
				this.events.beforeDraw(this);

			if (this.drawSelfPre)
				this.drawSelfPre(this);
			
			//	drawSelf is for self and background, not to be scrolled like subpanes below.
			this.drawSelf();

			if (this.events.onDrawSelf)
				this.events.onDrawSelf(this);

			//	get ready to draw sub elements IF we have any...
			if (this.subElements)
			{
				//	scroll my sub-element content,
				//	and let's factor in centering now, too.
				var offsetX = this.contentOffset.x + -this.center.x;
				var offsetY = this.contentOffset.y + -this.center.y;
				
				//if( this.contentOffset.x !== 0 || this.contentOffset.y !== 0 )
				//	rat.graphics.translate(this.contentOffset.x, this.contentOffset.y);
				if (offsetX !== 0 || offsetY !== 0)
					rat.graphics.translate(offsetX, offsetY);
				
				//	scale my content
				if( this.contentScale.x !== 1 || this.contentScale.y !== 1 )
					rat.graphics.scale(this.contentScale.x, this.contentScale.y);
				
				this.drawSubElements();

				if (this.events.onDrawChildren)
					this.events.onDrawChildren(this);
				
				//	todo: untranslate and unscale?
			}
			
			if (this.drawSelfPost)
				this.drawSelfPost(this);

			if (this.events.afterDraw)
				this.events.afterDraw(this);
		}

		if (!toOffscreen)
			rat.graphics.restore();
	};

	//
	//	Draw self.  Usually overridden.  This is called before our subpanes are drawn.
	//
	rat.ui.Element.prototype.drawSelf = function ()
	{
		//	nothing, usually overridden
	};

	//	draw all subelements
	//	Current context is set up to my local coordinates (including scrolled content offset, if any)
	rat.ui.Element.prototype.drawSubElements = function ()
	{
		if (this.subElements)
		{

			//	our bounds don't change when we're scrolled, but our content does, and we need to factor that in when checking visibility below.
			//	instead of adding offset to every subbounds below, let's just adjust the bounds we check here, once.
			var checkBounds = this.tempRect;
			checkBounds.x = -this.contentOffset.x;
			checkBounds.y = -this.contentOffset.y;
			checkBounds.w = this.size.x / this.contentScale.x;
			checkBounds.h = this.size.y / this.contentScale.y;

			for (var i = 0; i < this.subElements.length; i++)
			{
				var sub = this.subElements[i];
				
				//	an idea for minor performance improvements - skip a few function calls by immediately testing
				//	sub.flags & rat.ui.Element.visibleFlag
				//	here?  Probably not worth it?  Let's try anyway.
				if (!(sub.flags & rat.ui.Element.visibleFlag))
					continue;

				//	If we have clipping turned on, and this item is outside our bounds, then don't draw it.
				//	if there's a rotation, give up - maybe it's rotated partly into view?  todo: real polygon intersect math, in my (I am the parent) space.

				var toDraw = true;
				if (((this.flags & rat.ui.Element.clipFlag) !== 0) && sub.place.rot.angle === 0)
				{
					var subBounds = sub.getBounds(this.tempRect);
					//	factor in scale mathematically so we can do correct overlap check
					/*	Disabling, since getBounds() is factoring in scale now.
					subBounds.x *= sub.scale.x;
					subBounds.y *= sub.scale.y;
					subBounds.w *= sub.scale.x;
					subBounds.h *= sub.scale.y;
					*/
					//	Also, it was wrong to scale x and y by the sub pane's scale!
					//	Those values are in parent space.
					//	We should be scaling them by THIS pane's scale, right?
					//	But since we didn't do it above with checkBounds, don't do it here, either...?
					//	If this ever turns out wrong, be sure to add scale to both calculations (STT 2014.1.21)
					//subBounds.x *= this.scale.x;
					//subBounds.y *= this.scale.y;

					if (!rat.collision2D.rectOverlapsRect(subBounds, checkBounds))
						toDraw = false;
				}
				if (toDraw)
					sub.draw();
			}
		}
	};
	
	//	--- Tooltip support in basic elements ---
	//
	//	TODO:  Move all tooltip code to another module, for cleaner code.
	//	TODO:  rename all the "tooltipX" variables to be inside the toolTip structure
	//
	//	See tooltip handling above: A tooltip does not draw in the normal draw sequence - 
	//	it draws on top of everything else when a screen is drawn.
	//	So, we don't add a tooltip as a subelement or anything...
	//	we just set an element's "toolTip" value for later use.

	//
	//	build an automatic text-based tooltip for this element.
	rat.ui.Element.prototype.addTextToolTip = function (text, textColor, boxColor, screen)
	{
		//console.log("addTextToolTip to " + this.name);

		if (!boxColor)
			boxColor = rat.graphics.black;
		if (!textColor)
			textColor = rat.graphics.white;

		var toolTip = new rat.ui.Shape(rat.ui.squareShape);
		//	position gets set below
		toolTip.setSize(200, 20);	//	rewritten below
		toolTip.setColor(boxColor);
		toolTip.setFrame(1, textColor);	//	use text color as frame color so it matches...

		//	A bunch of these values are just hard-coded for nice placement of a standard textbox.
		//	If you want more control, set up your own graphic (or group of graphics) and use setToolTip below.

		var tbox = new rat.ui.TextBox(text);
		tbox.setFont('calibri');
		//tbox.setFontStyle('italic');
		tbox.setTextValue(text);	//	reset to recalculate content size with font (todo: those functions should do that...)
		tbox.setColor(textColor);
		
		this.sizeTextToolTip(15, toolTip, tbox);
		
		toolTip.appendSubElement(tbox);

		this.setToolTip(toolTip, screen, 'rightHigh', { x: 6, y: 0 });	//	offset the whole thing to the right a little...

		return { container: toolTip, textBox: tbox };	//	return multiple things for client control
	};
	
	//	refactored function so it can be called from above, and used externally to resize text in a text tooltip...
	rat.ui.Element.prototype.sizeTextToolTip = function(fontSize, toolTip, textBox)
	{
		textBox.setFontSize(fontSize);
		
		var XBUFFERSPACING = 14;
		var YBUFFERSPACING = 4;	//	fontSize/3?
		textBox.setPos(XBUFFERSPACING / 2, YBUFFERSPACING / 2);	//	bump over and down for nicer placement within the tooltip box
		
		//	fix tooltip box to match text size
		toolTip.setSize(textBox.contentSize.x + XBUFFERSPACING, textBox.contentSize.y + YBUFFERSPACING + 2);
		
		//	also make the text box match so it's all positioned nicely
		textBox.autoSizeToContent();
	};

	//	Calculate and set position for our current tooltip
	rat.ui.Element.prototype.positionToolTip = function ( placement, offset, fromMouse )
	{
		var toolTip = this.toolTip;
		if ( !toolTip )
			return;

		if ( typeof offset === 'undefined' )
			offset = { x: 0, y: 0 };

		var tipSize = toolTip.getSize();
		var mySize = this.getSize();

		if ( fromMouse )	//	hmm... use mouse's size
		{
			mySize.x = mySize.y = 16;	//	todo better custom mouse support?
		}

		var x = 0;
		var y = 0;
		if (placement === 'none' || placement === '')	//	normal top left corner, aligned with us
		{
			x = y = 0;
		} else if (placement === 'top')	//	above, centered
		{
			x = ( mySize.x - tipSize.x ) / 2;
			y = -tipSize.y;
		} else if (placement === 'topLeft')	//	right/bottom-aligned with our top-left corner.
		{
			x = -tipSize.x;
			y = -tipSize.y;
		} else if (placement === 'topRight')	//	upper right corner
		{
			x = mySize.x;
			y = -tipSize.y;
		} else if (placement === 'bottom')	//	below, centered
		{
			x = ( mySize.x - tipSize.x ) / 2;
			y = mySize.y;
		} else if (placement === 'bottomLeft')	//	aligned to bottom left corner
		{
			x = -tipSize.x;
			y = mySize.y;
		} else if ( placement === 'bottomRight' )	//	aligned to bottom right corner
		{
			x = mySize.x;
			y = mySize.y;
		} else
		{	//default to 'rightHigh' which means on the right, but shifted up artistically (1/3)
			x = mySize.x;
			y = mySize.y / 3 - tipSize.y / 2;	//	align tip vertical center with a high point inside my height
		}

		if ( fromMouse && this.mousePos )	//	now adjust if we're supposed to track mouse pos, if we have a mouse pos right now
		{
			x += this.mousePos.x;
			y += this.mousePos.y;
		}

		toolTip.setPos( x + offset.x, y + offset.y );	//	position relative to this element's location

		//	store original placement info in case our bounds change and we need to recalculate
		this.toolTipPlacement = placement;
		this.toolTipPlacementOffset = { x: offset.x, y: offset.y };
		this.toolTipPlacementFromMouse = fromMouse;

		this.toolTipOffset = toolTip.getPos().copy();	//	remember our tooltip's calculated position for simplicity later
	};


	//	base boundsChanged function - called any time position or size changes.
	//	nice for overriding, so various subclasses can react to their pos/size changing.
	//	Remember, though, that any overriding needs to call this inherited function, or do the work it does!
	rat.ui.Element.prototype.boundsChanged = function ()
	{
		//	sometimes overridden, as well, but this function should always get called
		if ( this.toolTip )
			this.positionToolTip( this.toolTipPlacement, this.toolTipPlacementOffset, this.toolTipPlacementFromMouse );
		
		//	TODO: would be nice to know whether it was pos or size.  If pos, don't need to mark dirty!
		this.setDirty(true);
	};
	
	//	base stateChanged function - called any time our main set of flags changes
	//	nice for overriding, so various subclasses can easily react to being highlighted or whatnot,
	//	without having to override every single state handling function and call inherited function in each, etc.
	rat.ui.Element.prototype.flagsChanged = function (oldFlags)
	{
		//console.log("flags changed " + oldFlags + " -> " + this.flags);
	};
	//	check if flags actually did change, and if so, call flagsChanged and registered callbacks
	rat.ui.Element.prototype.checkFlagsChanged = function (oldFlags)
	{
		if (oldFlags !== this.flags)
		{
			//	Whether this changes our look depends on what class we are.
			//	But to make everybody's life easier, we'll do all the work here, based on flagsThatDirtyMe flag.
			//	see comments where that variable is defined above.
			if (((oldFlags ^ this.flags) & this.flagsThatDirtyMe) !== 0)
				this.setDirty(true);
			//	see above, again...  some flags only dirty my parent
			if ((((oldFlags ^ this.flags) & this.flagsThatDirtyParent) !== 0) && this.parent)
				this.parent.setDirty(true, true);
			
			this.flagsChanged(oldFlags);
			//	TODO: more generic system for handling callbacks - register callbacks for any interesting event.  See other notes in this file.
			if (this.flagsChangedCallback)
				this.flagsChangedCallback(oldFlags, this.callbackInfo);
		}
	};

	/**
	 * Set this element as our current tooltip.
	 * could be anything - textbox, image, whatever.
	 * @param {Object} toolTip
	 * @param {Object} screen
	 * @param {string} placement
	 * @param {Object=} offset
	 * @param {boolean=} fromMouse
	 */
	rat.ui.Element.prototype.setToolTip = function (toolTip, screen, placement, offset, fromMouse)
	{
		if (typeof offset === 'undefined')
			offset = { x: 0, y: 0 };

		this.toolTip = toolTip;	//	set tooltip

		//	positioning logic...
		this.positionToolTip(placement, offset, fromMouse);

		toolTip.setVisible(false);
		toolTip.timer = 0;

		//	If we weren't given a screen object, find our top-most parent automatically.
		//	note that this means the element must already be added to the tree when this function is called!
		//	but see "assumed" flag below
		if (!screen)
		{
			screen = this.getTopParent();
			
			//	Keep track of whether a screen was explicitly specified here,
			//		and if we weren't given one here, and couldn't find one here (because we weren't added to the tree yet)
			//		then set our toolTipScreen later when we ARE added to the tree.
			//	Yet another argument for adding a parentElement argument to all constructors.
			this.toolTipScreenWasAssumed = true;
		}
		//	todo: look into this - does a loop of references like this mess up garbage collection?
		//	we're already a child of the screen - does pointing at our top parent like this cause trouble?
		//	it shouldn't!
		this.toolTipScreen = screen;	//	need this for adding to draw list later
	};

	//
	//	return current tooltip container. May be undefined or null, if one hasn't been set.
	rat.ui.Element.prototype.getToolTip = function ()
	{
		return this.toolTip;
	};

	//	Debug utility to put a random-colored frame on ALL elements and subelements
	rat.ui.Element.prototype.frameAllRandom = function ()
	{
		this.applyRecursively(rat.ui.Element.prototype.setFrameRandom, 1);
		
		//	I think frames are outside offscreens.
		//	so, no dirty.
		//this.setDirty(true);
	};

	/// Fire a trigger on this element.
	///	Compare and contrast with flagsChangedCallback, which is a more generic superset of this idea.
	var customTriggerPhases = ['before_', 'on_', 'after_'];
	/**
	 * @param {string} triggerName
	 * @param {?} triggerArgs
	 */
	rat.ui.Element.prototype.fireCustomTrigger = function (triggerName, triggerArgs)
	{
		var funcName;
		for( var index = 0; index !== customTriggerPhases.length; ++index )
		{
			funcName = customTriggerPhases[index] + triggerName;
			if( this[funcName] )
			{
				var continueTrigger = this[funcName](this, triggerName, triggerArgs);
				if (continueTrigger !== void 0 && !continueTrigger)
					return;
			}
		}
	};
	
	//	set whether we want to use offscreen rendering for this element
	rat.ui.Element.prototype.setUseOffscreen = function (useOff)
	{
		if (!rat.ui.allowOffscreens)	//	global disable of ui offscreens.  See above.
			return;
		
		if (this.useOffscreen !== useOff)
			this.setDirty(true);
		this.useOffscreen = useOff;
	};
	
	//	dirty tracking, so we know when to rebuild offscreen
	//	because any change to me affects the look of my parents, set them dirty as well.
	//	except... if I'm invisible, I don't think I should be marking anyone dirty...
	//	we were having trouble with invisible things (or things inside invisible things)
	//	changing in some way and making somebody way up their chain rebuild their offscreen even though it wasn't needed.
	//	So, now I'm skipping this whole call if I'm invisible.
	//	This means that actual visibility changes need to set dirty before the object is invisible!
	//	see checkFlagsChanged and second argument here, which means force the call
	rat.ui.Element.prototype.setDirty = function (isDirty, force)
	{
		if (!this.isVisible() && !force)
			return;
		
		if (isDirty === void 0)
			isDirty = true;
		this.isDirty = isDirty;
		
		//	temp debug code.
		//if (this.useOffscreen && isDirty && this.id === 'player1')
		//{
		//	rat.console.logOnce("heyp1");
		//}
		
		//	this also means my parent is dirty.
		if (isDirty && this.parent)
			this.parent.setDirty(true);
	};
	
	//	This is a little unusual - normally, when one element is dirty, it just needs its parents to know.
	//	see setDirty above.
	//	But in some systems (e.g. XUI), when one thing changes in a certain way (e.g. opacity for a group)
	//	it means all its children will draw differently...
	//	and if any of them have offscreen rendering, those things need to be rerendered.
	//	so, this function is useful for that.  But don't use it unless you really think you need it.
	rat.ui.Element.prototype.setDirtyRecursive = function (isDirty)
	{
		//	whoah, that sucked!  This is setting each one repeatedly up and down the tree.  Let's  not do that...
		//this.applyRecursively(rat.ui.Element.prototype.setDirty, isDirty);

		this.setDirty(isDirty);
		this.applyRecursively(function mySetDirty(theVal) {
			this.isDirty = theVal;
		}, isDirty);
	};
	
	//	Render offscreen version of this element.
	//	Faster to render a precalculated image than draw every frame.
	rat.ui.Element.prototype.renderOffscreen = function()
	{
		//console.log("renderOffscreen " + this.id);
		
		//console.log("ACTUAL RENDER OFFSCREEN for " + this.name);
		//if (this.elementType === 'textBox')
		//	console.log(this.value);
		//	TODO: more optimal width/height usage, based on contentsize?
		//		would be tricky, with offsets and centering and stuff.
		
		var width = this.size.x;
		var height = this.size.y;
		
		var off;
		if (this.offscreen)	//	already have one, just make sure it's the right size
		{
			off = this.offscreen;
			off.setSize(width, height, true);
		} else	//	need a new one
			off = new rat.Offscreen(width, height);
		
		var ctx = off.getContext();
		
		var oldCtx = rat.graphics.getContext();	//	remember old context
		rat.graphics.setContext(ctx);
		this.useOffscreen = false;	//	force drawSelf to do it the normal way this time
		
		//	TODO:  This ignoreCenter flag was from text drawing.  Figure out how to make this more generic!
		//		at the very least, use toOffscreen flag being passed to draw()?
		//		would have to pass to drawSelf, too...
		//		why is centering not handled  automatically in draw(), anyway?
		//		Why is it in subclasses, like text?
		//		IT SHOULD BE handled in draw.  This is a mistake.  Fix it.
		//		drawSelf for each subclass should not have to factor in this.center.x
		//		like they all do.  :(  But I don't want to break everything right now...  Fix later.
		this.ignoreCenter = true;	//	see alignment calculations
		
		this.draw(true);
		
		if (rat.ui.debugOffscreens)
			off.applyDebugOverlay();
		
		this.ignoreCenter = false;
		
		this.useOffscreen = true;
		rat.graphics.setContext(oldCtx);	//	restore old context
		
		this.offscreen = off;
		
		this.isDirty = false;
		//	and we have now drawn all subelements, too, so set them not dirty, either.
		this.applyRecursively(function mySetDirty(arg){this.isDirty = false;});
	};

	// Support for creation from data
	//id:""
	//frame:{
	//	size:00,
	//	color:{
	//		r:00,
	//		g:00,
	//		b:00,
	//		a:0
	//	}
	//},
	//bounds: {
	//	x: {
	//		percent: true,
	//		centered/centered:true,
	//		fromCenter: true,
	//		fromMyEdge/fromMyFarEdge:true,
	//		fromParentEdge/fromParentFarEdge:true,
	//		val:00
	//	}/x:00,
	//	y: {
	//		percent: true,
	//		centered/centered:true,
	//		fromCenter: true,
	//		fromMyEdge/fromMyFarEdge:true,
	//		fromParentEdge/fromParentFarEdge:true,
	//		val:00
	//	}/y:00,
	//	w:{
	//		fromParent:true,
	//		percent: true,
	//		val:00
	//	}/w:00,
	//	h:{
	//			fromParent:true,
	//			percent: true,
	//			val:00
	//	}/h:00
	//},
	//visible:false,
	//highlighted:true,
	//enabled:false,
	//toggled:true,
	//clip:true,
	//contentOffset:{
	//	x:00,
	//	y:00
	//}
	/** @suppress {missingProperties} */
	rat.ui.Element.setupFromData = function (pane, data, parentBounds)
	{
		//	set my bounds.
		pane.setBounds(rat.ui.data.calcBounds(data, parentBounds));
		if (data.rotation || data.rot)
			pane.setRotation(data.rotation || data.rot);
		
		//	support setting my center values, which is different from just one-time centering position above,
		//	in cases like animating scale, which really needs to know where my conceptual center is, later.
		if (data.autoCenter)
			pane.autoCenter();
		//	todo: support more explicit centering, or horiz/vert centering separately?
		
		//	Do i want a frame?
		if (data.frame)
			pane.setFrame(data.frame.size, data.frame.color);

		if( data.id !== void 0 )
			pane.setID( data.id );

		//	States/settings
		if (data.color)
			pane.setColor(new rat.graphics.Color(data.color));
		
		//	Flags
		//	todo: support more flexible "flags" value in addition to (instead of?) custom names for each of these flags?
		//		There's value in calling these functions (e.g. setEnabled()) beyond the actual bit setting.
		//		So, we need to do that either way.  Maybe walk through the flags one at a time, and have a list of functions to call for each?
		//		In the mean time, we require custom flag names for each flag, which just adds more coding work each time we add support
		//		for a new flag.
		if( data.visible !== void 0 )
			pane.setVisible(!!data.visible);
		if( data.highlighted !== void 0 )
			pane.setHighlighted(!!data.highlighted);
		if (data.enabled !== void 0)
			pane.setEnabled(!!data.enabled);
		if (data.toggled !== void 0)
			pane.setToggled(!!data.toggled);
		if (data.clip !== void 0)
			pane.setClip(!!data.clip);
		if (data.autoSizeAfterLoad !== void 0)
			pane.setFlag(rat.ui.Element.autoSizeAfterLoadFlag, !!data.autoSizeAfterLoad);
		if (data.autoScaleAfterLoad !== void 0)
			pane.setFlag(rat.ui.Element.autoScaleAfterLoadFlag, !!data.autoScaleAfterLoad);
		if (data.drawTiled !== void 0)
			pane.setFlag(rat.ui.Element.drawTiledFlag, !!data.drawTiled);

		if (data.contentOffset)
			pane.setContentOffset(data.contentOffset.x, data.contentOffset.y);
		if (data.contentScale)
			pane.setContentScale(data.contentScale.x, data.contentScale.y);
		//	todo: setContentScaleLimits
			
		if (data.callback)
			pane.setCallback(data.callback, data.callbackInfo);

		if (data.onFocus)
			pane.events.onFocus = data.onFocus;
		if (data.onBlur)
			pane.events.onBlur = data.onBlur;
		if (data.beforeDraw)
			pane.events.beforeDraw = data.beforeDraw;
		if (data.onDrawSelf)
			pane.events.onDrawSelf = data.onDrawSelf;
		if (data.onDrawChildren)
			pane.events.onDrawChildren = data.onDrawChildren;
		if (data.afterDraw)
			pane.events.afterDraw = data.afterDraw;
		
		if (data.useOffscreen !== void 0)
			pane.setUseOffscreen(data.useOffscreen);
	};

	//	old naming convention
	//rat.graphics.Element = rat.ui.Element;
} );

//----------------------------
//	shape Element
//	uses built-in shape drawing system
//
//	TODO:  Offscreen and Dirty support
//
rat.modules.add( "rat.ui.r_ui_shape",
[
	{name: "rat.ui.r_ui", processBefore: true },
	{name: "rat.utils.r_utils", processBefore: true },
	"rat.debug.r_console",
	"rat.ui.r_ui_data",
	"rat.graphics.r_graphics",
	"rat.math.r_math",
], 
function(rat)
{
	/**
	 * @constructor
	 * @extends rat.ui.Element
	 * @param {Object} shapeType (one of rat.ui.noShape, rat.ui.circleShape, rat.ui.squareShape, or rat.ui.pathShape)
	*/
	rat.ui.Shape = function (shapeType)
	{
		rat.ui.Shape.prototype.parentConstructor.call(this); //	default init
		//	for now, we're going to put all shape types in a single Element class rather than make
		//	a bunch of classes.
		if(shapeType === void 0)
			this.shapeType = rat.ui.circleShape;
		else
			this.shapeType = shapeType;
		//	shapes are often used as containers, so don't turn off mouse tracking
	};
	rat.utils.inheritClassFrom(rat.ui.Shape, rat.ui.Element);
	rat.ui.Shape.prototype.elementType = 'shape';

	rat.ui.noShape = 0;
	rat.ui.circleShape = 1;
	rat.ui.squareShape = 2;
	rat.ui.pathShape = 3;

	rat.ui.Shape.prototype.drawSelf = function ()
	{
		//this.prototype.parentClass.prototype.drawSelf.call or whatever();	//	inherited draw self, if it were needed...
		var ctx = rat.graphics.getContext();
		ctx.fillStyle = this.color.toString();
		if(this.shapeType === rat.ui.circleShape)
		{
			ctx.beginPath();
			var radius = rat.math.min(this.size.x, this.size.y)/2;
			var offset = {x: (this.size.x/2)-radius, y:(this.size.y/2)-radius};
			ctx.translate(offset.x, offset.y);
			ctx.arc(radius, radius, radius, 0, Math.PI * 2, true);
			ctx.translate(-offset.x, -offset.y);
			ctx.closePath();
			ctx.fill();
		} else if(this.shapeType === rat.ui.squareShape)
		{
			ctx.fillRect(0, 0, this.size.x, this.size.y);
		} else
		{
			//	todo: path - maybe with anon function set from outside?
		}
	};

	rat.ui.Shape.setupFromData = function (pane, data, parentBounds)
	{
		rat.ui.data.callParentSetupFromData(rat.ui.Shape, pane, data, parentBounds);

		if (data.shapeType !== void 0)
			pane.shapeType = data.shapeType;
	};
});
//
//	Screen management (screen stack, etc.)
//
//	Uses r_collision2d
rat.modules.add( "rat.ui.r_screenmanager",
[
	{ name: "rat.os.r_events", processBefore: true },
	{ name: "rat.input.r_input", processBefore: true },
	
	"rat.debug.r_console",
	"rat.debug.r_profiler",
	"rat.graphics.r_graphics",
	"rat.ui.r_screen",
	"rat.ui.r_ui_textbox",
	"rat.ui.r_ui_button",
	"rat.utils.r_collision2d",
	"rat.utils.r_shapes",
	"rat.math.r_math",
], 
function(rat)
{
	//	some common command numbers
	//	todo - move to rat.event namespace, or something like that.  system, at least.
	rat.OK_COMMAND = -100;
	rat.CANCEL_COMMAND = -99;

	rat.screenManager = {
		screenStack: [],	//	current active screens and popups

		regScreens: {},	//	(hash) optional screen registration system for easier switching between screens

		//	set root UI - replace all screens (if any) with a single current screen
		/** @suppress {missingProperties} - for screenDeactivate */
		setUIRoot: function (uiRoot)
		{
			//	Remove all of the current screens.
			rat.screenManager.popAllScreens();

			//	note:  if uiRoot is null, we're just being asked to clear stack, not put a new screen up.  That's fine.
			if(uiRoot)
			{
				//	set this as our only screen.  Use pushScreen function so we get side effects, like activation functions being called.
				rat.screenManager.pushScreen(uiRoot);
			}
		},

		//	get topmost screen
		getTopScreen: function ()
		{
			if(rat.screenManager.screenStack.length > 0)
				return rat.screenManager.screenStack[rat.screenManager.screenStack.length - 1];
			else
				return null;
		},

		//	push a screen onto the stack of screens
		pushScreen: function (screen)
		{
			if (!screen)
				return;

			//	Let the current screen save their target.
			var topScreen = rat.screenManager.getTopScreen();
			if (topScreen)
				topScreen.saveCurrentTarget();

			//	If we are not overlay screen, walk down the stack suspending any screens that are not yet suspended
			if (!screen.isOverlay)
			{
				var curScreen;
				for (var index = rat.screenManager.screenStack.length - 1; index >= 0; --index)
				{
					curScreen = rat.screenManager.screenStack[index];
					if (curScreen.isSuspended)
						break;
					curScreen.deactivate({ allowOnlySuspend: true });
				}
			
			} else if (screen.isModal) {
				//	let's clear tooltips so they don't draw or pop later...
				//	todo: flags to support/suppress this?
				var curScreen;
				for (var index = rat.screenManager.screenStack.length - 1; index >= 0; --index)
				{
					curScreen = rat.screenManager.screenStack[index];
					//	I can't just clear activeTooltip for a few reasons,
					//	including the fact that it's NULLed out every frame by this point.
					//	Anyway, this is what we want to do so we don't draw mouse tracking graphics
					//	when the mouse really isn't in lower-level screens any more.
					//	This is close to correct, but we still have some things like buttons behaving wrong...
					//	We either need them to respect mouseLeave(),
					//	or we need some new concept of let-go-of-mouse-tracking.
					//	see notes in r_ui.js about optimizing mouse tracking, and handleMouseLeave.
					curScreen.applyRecursively(function (arg){
						if (this.toolTip)
							this.toolTip.timer = 0;
						this.mouseLeave();
					});
				}
			}

			//	Put me on the top of the screen stack, and activate me

			rat.screenManager.screenStack.push(screen);
			screen.activate();
		},

		//	insert a screen into the stack of screens
		insertScreen: function (screen)
		{
			// not the top screen, so tell it to suspend until it's on top
			if (rat.screenManager.screenStack.length)
			{
				screen.deactivate({ allowOnlySuspend: true });
				rat.screenManager.screenStack.unshift(screen);
				//rat.console.log("insertScreen: " + rat.screenManager.screenStack.length);
			}

			//	It really is the only screen, so add it.
			else
				rat.screenManager.pushScreen(screen);
			
		},

		//	remove a screen from the stack by matching ids
		removeScreen: function (screen)
		{
			for(var i = 0; i < rat.screenManager.screenStack.length; ++i)
			{
				if(rat.screenManager.screenStack[i].id === screen.id)
				{
					//	If it is the top screen, call pop
					if (i === rat.screenManager.screenStack.length - 1)
						return rat.screenManager.popScreen();
					else
						return rat.screenManager.removeScreenAtIndex(i);
					break;
				}
			}

			//	Nothing to remove
			return void 0;
		},

		// Remove a screen at the given index
		removeScreenAtIndex: function( stackIndex )
		{
			if (stackIndex < 0 || stackIndex >= rat.screenManager.screenStack.length)
				return void 0;
			var screen = rat.screenManager.screenStack[stackIndex];
			rat.screenManager.screenStack.splice(stackIndex, 1);
			screen.deactivate();
			screen.destroy();
			return screen;
		},

		//
		//	pop top-most screen off stack
		//
		popScreen: function ()
		{
			//	Remove the top screen
			var screen = rat.screenManager.removeScreenAtIndex(rat.screenManager.screenStack.length - 1);

			//	Reactive (or resume) the screen until a non-overlay
			var curScreen;
			for (var i = rat.screenManager.screenStack.length-1; i >= 0; --i)
			{
				curScreen = rat.screenManager.screenStack[i];
				if( curScreen )
				{
					curScreen.activate();

					//	Only activate until we hit a screen that covers the rest
					if( !curScreen.isOverlay )
						break;
				}
			}

			//	Get the new top of stack and restore their target
			var topScreen = rat.screenManager.getTopScreen();
			if (topScreen)
				topScreen.restoreSavedTarget();

			//	Return the removed screen
			return screen;
		},

		///	Remove all screens
		popAllScreens: function ()
		{
			//	Not using removeScreenAtIndex so we don't have to deal with changing the array.
			for (var i = rat.screenManager.screenStack.length-1; i >= 0; --i)
			{
				rat.screenManager.screenStack[i].deactivate();
			}

			//	No more screens.
			rat.screenManager.screenStack = [];
		},

		//	register a standard screen for easy creation/switching later
		registerScreen: function (name, creator)
		{
			rat.screenManager.regScreens[name] = { creator: creator };
		},

		//	switch to a registered screen
		//	pushOn (which defaults to undefined) indicates that we want to push this new screen on the stack instead of replacing.
		switchToScreen: function (name, pushOn, args)
		{
			args = args || [];
			//	Find the registered screen.
			var regScreen = rat.screenManager.regScreens[name];
			if(!regScreen)
			{
				rat.console.log("ERROR: no such registered screen: " + name);
				return null;
			}

			//	Create the screen.
			var screen = regScreen.creator.apply(void 0, args);
			if(!screen)
			{
				rat.console.log("Error: screen creator failed " + name);
				return null;
			}
			screen._screenTag = name;

			//	If we are replacing the current, pop it off.
			if(!pushOn)	//	not pushing - kill old screen first
				rat.screenManager.popScreen();

			//	finally, push new screen
			rat.screenManager.pushScreen(screen);
			return screen;
		},

		//	pop up a standard yes/no dialog, using this setup structure.
		doConfirmDialog: function (setup)
		{
			//	we can add many things to this setup structure over time.  It's pretty minimal so far.
			//	But even better would be reading from a resource.

			//	a bunch of defaults...

			var width = setup.width;
			var height = setup.height;
			if(typeof width === 'undefined')
				width = 420;
			if(typeof height === 'undefined')
				height = 200;
			if(typeof setup.title === 'undefined')
				setup.title = "";
			if(typeof setup.body === 'undefined')
				setup.body = "";
			if(typeof setup.yesText === 'undefined')
				setup.yesText = "Yes";
			if(typeof setup.yesCommand === 'undefined')
				setup.yesCommand = rat.OK_COMMAND;
			if(typeof setup.noText === 'undefined')
				setup.noText = "";
			if(typeof setup.noCommand === 'undefined')
				setup.noCommand = rat.CANCEL_COMMAND;
			if(typeof setup.userData === 'undefined')
				setup.userData = null;
			if (!setup.bgColor)
				setup.bgColor = { r: 80, g: 80, b: 80 };
			if (!setup.frameColor)
				setup.frameColor = { r: 120, g: 120, b: 120 };
			if (!setup.pos)
				setup.pos = { x: rat.graphics.SCREEN_WIDTH / 2 - width, y: rat.graphics.SCREEN_WIDTH / 3 - height / 2 };
			if (!setup.titleFont)
				setup.titleFont = setup.font;
			if (!setup.bodyFont)
				setup.bodyFont = setup.font;
			if (!setup.buttonFont)
				setup.buttonFont = setup.font;
			if (!setup.titleFont) {
				setup.titleFont = {
					font: "Impact",
					size: 14
				};
			}
			if (!setup.bodyFont) {
				setup.titleFont = {
					font: "Arial",
					size: 12
				};
			}

			//	screen
			var screen = new rat.ui.Screen();
			screen.setModal(true);

			screen.setPos(setup.pos.x, setup.pos.y);
			screen.setSize(width, height);

			screen.setBackground(new rat.graphics.Color(setup.bgColor.r, setup.bgColor.g, setup.bgColor.b));

			screen.setFrame(4, new rat.graphics.Color(120, 120, 120));
			var b;
			var tbox;

			//	title
			if(setup.title !== "")
			{
				tbox = new rat.ui.TextBox(setup.title);
				tbox.setFont(setup.titleFont.font || setup.titleFont);
				tbox.setFontSize(setup.titleFont.size || 14);
				tbox.setPos(0, 0);
				tbox.setSize(screen.size.x, 14);
				tbox.setAlign(rat.ui.TextBox.alignCenter);
				tbox.setColor(new rat.graphics.Color(250, 250, 220));
				screen.appendSubElement(tbox);
			}

			//	body
			if(setup.body !== "")
			{
				tbox = new rat.ui.TextBox(setup.body);
				tbox.setFont(setup.bodyFont.font || setup.bodyFont);
				tbox.setFontSize(setup.bodyFont.size || 12);
				tbox.setPos(0, 40);
				tbox.setSize(screen.size.x, 14);
				//tbox.setAlign(rat.ui.TextBox.alignLeft);
				tbox.setAlign(rat.ui.TextBox.alignCenter);
				tbox.setColor(new rat.graphics.Color(190, 190, 190));
				screen.appendSubElement(tbox);
			}

			//	button
			var buttonPosY = screen.size.y * 2 / 3 - 30;
			if(setup.yesText !== "")
			{
				b = rat.ui.makeCheapButton(null, new rat.graphics.Color(150, 200, 150));
				b.setTextValue(setup.yesText);
				b.setSize(70, 30);
				b.setPos(50, buttonPosY);
				b.setCommand(setup.yesCommand, setup.userData);
				screen.appendSubElement(b);
			}

			//	button
			if(setup.noText !== "")
			{
				b = rat.ui.makeCheapButton(null, new rat.graphics.Color(150, 200, 150));
				b.setTextValue(setup.noText);
				b.setSize(70, 30);
				b.setPos(screen.size.x - 30 - 70, buttonPosY);
				b.setCommand(setup.noCommand, setup.userData);
				screen.appendSubElement(b);
			}

			rat.screenManager.pushScreen(screen);

			screen.handleCommand = function (command, info)
			{
				rat.screenManager.popScreen();	//	get rid of screen
				return false;	//	let the command continue to get passed up to somebody who will respond to it.
			};

			//	we can't really do modal, so just set it up, and let commands do their work.

			return screen;
		},

		//	dispatch an event down the screen stack.
		//	This means the usual walk through screens, top to bottom, but stop if one is modal,
		//	and send the event to the target of that screen.
		//	Note that "ratEvent" here has a controllerID value attached to it so we know which input device this came from.
		//	If anybody handles this event (returns true) stop dispatching it!
		//	return true if we handled it.
		//	This is a higher-level "ratEvent".  If you need system event info, get it from event.sysEvent
		dispatchEvent: function (event)
		{
			if (rat.console.state.consoleActive === true || rat.console.state.consoleActive === "target" )
				return;
			var result = false;

			//console.log("screenmanager dispatchEvent " + event.eventType);
			//console.log("  which " + event.which);

			for(var i = rat.screenManager.screenStack.length - 1; i >= 0; i--)
			{
				//	sometimes, all of (or many of) the screens might get killed in response to an event in this loop,
				//	so it's possible to end up trying to dispatch to a screen that no longer exists.
				//	If we detect that case, stop dispatching.  Really, the people who handled the event should have returned that it was handled,
				//	but not every game is perfectly behaved in this way.
				if (i > rat.screenManager.screenStack.length - 1)
					return true;
				
				var screen = rat.screenManager.screenStack[i];
				if (typeof(screen) === 'undefined')
				{
					console.log("bogus screen at " + i);
					return;
				}
				var wasModal = screen.modal;
				//	If this screen is suspended, then don't handle events
				if (screen.isSuspended && !screen.forceScreenActive)
					break; // All other screens should be suspended.

				//	see if this is a positional event (e.g. mouse click),
				//	because we don't want to use the targeting system for things like that.
				var isPositionalEvent = (event.eventType === "mousedown" ||
										event.eventType === "mouseup" ||
										event.eventType === "mousemove" ||
										event.eventType === "touchstart" ||
										event.eventType === "touchend" ||
										event.eventType === "touchmove" );
				if(!isPositionalEvent && screen.targets)	//	target list?  Send the event to that guy!
				{
					//var index = event.inputIndex;
					//if (!index)
					//	index = 0;
					var index = 0;	//	TODO:  FIX THIS to get index from id or something?
					result = screen.targets[index].handleEvent(event);
				} else
				{	//	no target list - just send to screen
					result = screen.handleEvent(event);
				}
				if(result)	//	handled?  stop looking.
					break;

				if(wasModal)	//	stop if we hit a modal screen
				{
					//	support clicking away from popup to dismiss
					if((event.eventType === 'mousedown' || event.eventType === 'touchstart') &&
						screen.allowClickAway && !rat.collision2D.pointInRect(event.pos, screen.getBounds()))
					{
						if(screen.clickAwaySound && rat.audio)
							rat.audio.playSound(screen.clickAwaySound);
						rat.screenManager.popScreen();
						result = true;	//	handled, in the form of a close
					}

					break;	//	done handling
				}
			}
			return result;
		},

		updateScreens: function ()
		{
			rat.ui.updateCallCount = 0;	//	debug - count total update calls
			var screen;
			for (var i = rat.screenManager.screenStack.length-1; i >= 0; --i)
			{
				screen = rat.screenManager.screenStack[i];
				if (!screen)
					continue;
				if (screen.isSuspended && !screen.forceScreenActive)
					break;
				rat.profiler.pushPerfMark(screen._screenTag || "???");
				rat.screenManager.screenStack[i].update(rat.deltaTime);
				rat.profiler.popPerfMark(screen._screenTag || "???");
			}
		},

		//
		//	draw all screens in our stack
		//
		drawScreens: function ()
		{

			//	STT rewriting this... now...  Let's get rid of this separation of root and postdraw and stack...
			//	we can move postdraw functionality to a per-screen thing, if needed.
			/*
			if (rat.screenManager.uiRoot != null)
			{
				rat.screenManager.uiRoot.draw();
				rat.screenManager.drawTooltips(rat.screenManager.uiRoot);
			}

			//	need a way better system for handling this post-draw thing.
			if (typeof rat.postUIDraw !== 'undefined')
				rat.postUIDraw();
			*/

			//	draw all screens bottom up
			var i;
			var screen;
			var stack = rat.screenManager.screenStack;
			for(i = 0; i < stack.length; i++)
			{
				screen = stack[i];
				if( screen.isSuspended && !screen.forceScreenActive )
					continue;
				
				rat.profiler.pushPerfMark(screen._screenTag || "???");
				
				//console.log("> screen " + i);
				screen.draw();
				//	only draw tooltips for topmost screen, by default.
				//	if you need something different (e.g. a tooltip up when there's some higher screen?)
				//	then you'll need to add flags to change the default behavior, like
				//	screen.alwaysDrawTooltips or something.
				if (i === stack.length-1)
					rat.screenManager.drawTooltips(screen);
				
				rat.profiler.popPerfMark(screen._screenTag || "???");
				//	post-draw?
			}
		},

		//
		//	Draw the current tooltip, if any, for this screen for this drawing frame.
		//	This list gets cleared every frame, and active elements set up new tooltips to draw as needed.
		//	(this puts tooltips under control of elements, so they can figure out their own location, visible state, etc.,
		//	and so it's easy to clean up when an element dies.)
		//	We draw here so that it happens after all other stuff draws, so tooltips show up on top of everything.
		//
		drawTooltips: function (screen)
		{
			if(screen.activeToolTip)
			{
				//	convert global to screen space (tooltips are always given here in global space)
				//	Why add screen position here?  these positions are already global!
				//screen.activeToolTip.place.pos.x += screen.place.pos.x;
				//screen.activeToolTip.place.pos.y += screen.place.pos.y;

				//	fix up (constrain) location if it's off our total canvas space
				//	todo: configurable buffer space away from edges.
				//	todo: this should happen when position is first calculated, not here at draw time!
				var rect = new rat.shapes.Rect(0, 0, rat.graphics.SCREEN_WIDTH - screen.activeToolTip.size.x, rat.graphics.SCREEN_HEIGHT - screen.activeToolTip.size.y);
				screen.activeToolTip.place.pos.limitToRect(rect);

				//	draw
				screen.activeToolTip.setVisible(true);
				screen.activeToolTip.draw();
				//	and clear for next frame
				screen.activeToolTip = null;
			}
		},

		//	Fired when we get a resize from the graphics system.
		//	This will attempt to call onWindowResize for any active (not deflated) screens
		onWindowResize: function()
		{
			var curScreen;
			for (var index = rat.screenManager.screenStack.length - 1; index >= 0; --index)
			{
				curScreen = rat.screenManager.screenStack[index];
				if (curScreen.isSuspended && !curScreen.forceScreenActive)
					break;
				if (curScreen.onWindowResize)
					curScreen.onWindowResize();
			}
		},
		
		//	Walk through screen stack, centering all screens based on their stated size and rat's understanding of screen size.
		centerAllScreens: function()
		{
			var curScreen;
			for (var index = rat.screenManager.screenStack.length - 1; index >= 0; --index)
			{
				curScreen = rat.screenManager.screenStack[index];
				curScreen.centerInDisplay();
			}
		}
	};

	rat.addEventListener("resize", rat.screenManager.onWindowResize);
	
	//	Always have the screen manager.
	rat.input.registerEventHandler(rat.screenManager.dispatchEvent);

	//	aliases for convenience with old code
	// rat.graphics.setUIRoot = rat.screenManager.setUIRoot;
	// rat.graphics.getTopScreen = rat.screenManager.getTopScreen;
	// rat.graphics.pushScreen = rat.screenManager.pushScreen;
	// rat.graphics.popScreen = rat.screenManager.popScreen;
	// rat.graphics.doConfirmDialog = rat.screenManager.doConfirmDialog;

});
//
//	Input map class for handling on screen buttons
//
//  To use this mapping, whatever button class you use simply needs to implement an interface that allows the following functions:
//      Press()
//      Focus() - returns boolean as to whether it succeeded or not
//      Blur() -- defocus
//
//  Also each entry in the inputMap needs to include a reference to that button object itself. I named this 'currObj'
//
//  Example code for creating a mapping:
//
//  // there are two buttons 'back', and 'ads'
//  var buttonBack = { currObj: this.backButton, down: this.adsButton, right: this.adsButton }
//  var buttonAds = { currObj: this.adsButton, up: this.backButton, left: this.backButton }
//  var map = [buttonBack, buttonAds]
//
//  You can auto-build inputmaps for a screen by using the functions in the rat.Screen class.
//
//	TODO - really nothing external should know about the index, so the 'startIndex' should probably be changed in the future to 'startButton' and have it save the index based on the object it finds
//		Maybe remove the concept of a current index entirely.  If we need to support multi-target systems (e.g. multiple controllers, like Wraith does),
//		it'll all have to change anyway, and a cTargets system like Wraith might be more flexible.
//	TODO:  rename press/focus/blur functions to not have capital names.
//	TODO:  Not everything in an input map has to be a "button"
//	TODO:  Tab and shift-tab support
//	TODO:  Automated building of inputMaps based on contents of a screen
//	

//------------ rat.InputMap ----------------
rat.modules.add( "rat.input.r_inputmap",
[
	"rat.input.r_input"
], 
function(rat)
{
	/**
	 * @constructor
	 */
	rat.InputMap = function (map, startIndex) {
		this.events = {};
		this.map = map;

		if ((!startIndex || startIndex === 0) && this.checkBounds(startIndex) && this.map[startIndex]) {
			this.defaultIndex = startIndex;
			this.index = startIndex;
		}
		else{
			this.defaultIndex = -1;
			this.index = -1;
		}

		this.validateMap();

		if (this.index >= 0)
			this.focusButton(this.index, true);
	};

	///	Set the on change event callback
	rat.InputMap.prototype.setOnChange = function (cb) {
		this.events.onChange = cb;
	};

	//	run through input map we were given, and fix up any problems.
	//	Why?  To make defining input maps easier and less error prone.
	//	For instance, we might define an input map that refers to a button that may or may not be there.
	//	Instead of having complex input map creation logic, we'll just leave all our up/down/left/right references,
	//	but just not include it in the map, and fix that here.
	//	This would be less necessary if we used automated input map generation more often.
	rat.InputMap.prototype.validateMap = function()
	{
		var dIndex;
		for (var i = 0; i < this.map.length; ++i)
		{
			var curEntry = this.map[i];
			var directions = ["up", "left", "right", "down", "select"];
			for (dIndex = 0; dIndex < directions.length; dIndex++)
			{
				var target = curEntry[directions[dIndex]];	//	TODO: this (and similar index-by-name code below) will fail with closure compiler)
				if (target)
				{
					var found = null;
					for (var tIndex = 0; tIndex < this.map.length; ++tIndex)
					{
						if (this.map[tIndex].currObj === target)
							found = target;
					}
					if (!found)
						curEntry[directions[dIndex]] = null;	//	clear that bogus reference out
				}
			}	//	end of direction loop
		}
	};

	rat.InputMap.prototype.handleKeyDown = function (keyCode) {
		var direction;
		// may also add directions for controller inputs?

		switch (keyCode) {
			case rat.keys.leftArrow:
				direction = "left";
				break;
			case rat.keys.upArrow:
				direction = "up";
				break;
			case rat.keys.rightArrow:
				direction = "right";
				break;
			case rat.keys.downArrow:
				direction = "down";
				break;
			case rat.keys.enter:
				direction = "select";
				break;
			default:
				return;
		}

		return this.handleDirection(direction);
	};

	rat.InputMap.prototype.handleDirection = function (direction) {
		if (this.checkBounds(this.index)) {
			var currentButton = this.map[this.index];

			if (direction === "select")
				this.doPress(this.map[this.index].currObj);
			else if (currentButton && currentButton[direction] && currentButton.currObj !== currentButton[direction]) {
				// blur current button so we can change the index
				//var oldIndex = this.index
				var newIndex;
				// get handle to new button
				var newfocus = currentButton[direction];
				// find index for new handle
				for (var i = 0; i < this.map.length; ++i) {
					if(this.map[i].currObj === newfocus)
						newIndex = i;
				}
				this.focusButton(newIndex);
				return true;
			}
			else if (currentButton)
			{
				// wasn't a direction to go to, rehighlight self
				//	But tell the button about the direction
				this.doFocus(currentButton.currObj);
				if (currentButton.currObj.handleDirection)
				{
					if (currentButton.currObj.handleDirection(direction))
						return true;
				}
			}
		}
		else if (this.index === -1)   // was currently not a valid index
		{
			// then set the index to default
			if(this.defaultIndex === -1 && this.map.length > 0)
				this.index = 0;
			else if(this.checkBounds(this.defaultIndex))
				this.index = this.defaultIndex;

			if (this.checkBounds(this.index))
			{
				this.doFocus(this.map[this.index].currObj);
				return true;
			}
		}

		return false;
	};

	//	wrapper for setting button focus
	//	currently, helps us use new function names,
	//	but could also be used later to do fancier focus handling with target system
	rat.InputMap.prototype.doFocus = function(button)
	{
		if (button.Focus)
			return button.Focus();
		else if (button.focus)
			return button.focus();
		else
			return false;
	};

	//	wrapper for setting button blue
	//	currently, helps us use new function names,
	//	but could also be used later to do fancier focus handling with target system
	rat.InputMap.prototype.doBlur = function(button)
	{
		if (button.Blur)
			return button.Blur();
		else if (button.blur)
			return button.blur();
		else
			return false;
	};

	//	wrapper for setting button pressing
	//	currently, helps us use new function names,
	//	but could also be used later to do fancier focus handling with target system
	rat.InputMap.prototype.doPress = function(button)
	{
		if (button.Press)
			return button.Press();
		else if (button.press)
			return button.press();
		else
			return false;
	};
	
	rat.InputMap.prototype.getButtonCount = function () {
		return this.map.length;
	};

	rat.InputMap.prototype.getButton = function (index) {
		if (this.checkBounds(index))
			return this.map[index].currObj;
		return null;
	};

	rat.InputMap.prototype.getCurrIndexButton = function ()
	{
		if(this.checkBounds(this.index))
			return this.map[this.index].currObj;
		return null;
	};
	//	a slightly more consistent name for that...
	rat.InputMap.prototype.getCurrentFocusedButton = rat.InputMap.prototype.getCurrIndexButton;

	//	get the index for this button.
	//	if not found, return null (which is weird?)
	rat.InputMap.prototype.getIndexByButton = function (button) {
		for (var i = 0; i < this.map.length; ++i) {
			if (this.map[i].currObj === button)
				return i;
		}
		return null;
	};

	//
	//	Focus on this button by index.
	//	"force" is a way to force the new button to get a focus() call, even if it's already the currrent.
	//	Also blur the old button
	/** 
	 * @param {number|undefined} index
	 * @param {boolean=} force
	 */
	rat.InputMap.prototype.focusButton = function (index, force) {
		var oldIndex = this.index;

		if (index === this.index)   //  already at this index
		{
			if (force)  //  but support forcing anyway
				oldIndex = -1;  //  in which case don't blur!
			else
				return;
		}

		if (this.checkBounds(index) && this.map[index]) {
			if (this.doFocus(this.map[index].currObj))
			{
				//  blur old button
				if (this.checkBounds(oldIndex) && this.map[oldIndex])
					this.doBlur(this.map[oldIndex].currObj);
			}
			this.index = index;

			if (this.events.onChange)
				this.events.onChange(this.map[index].currObj, this.map[oldIndex] ? this.map[oldIndex].currObj : void 0);
		}
	};
	
	//
	//	Focus on this button by button reference.
	//	"FocusByIndex" would be a better name for the above function.
	//
	rat.InputMap.prototype.focusByButton = function (button, force) {
		var index = this.getIndexByButton(button);
		if (typeof(index) === null)
			return;
		this.focusButton(index, force);
	};

	rat.InputMap.prototype.clearIndex = function ()
	{
		this.index = -1;
	};

	rat.InputMap.prototype.reset = function ()
	{
		if(this.index !== this.defaultIndex)
		{
			if(this.checkBounds(this.index))
				this.doBlur(this.map[this.index].currObj);
			if(this.checkBounds(this.defaultIndex))
				this.doFocus(this.map[this.defaultIndex].currObj);

			this.index = this.defaultIndex;
		}
	};

	rat.InputMap.prototype.checkBounds = function (index)
	{
		if(index >= 0 && index < this.map.length)
			return true;
		return false;
	};
} );
// Image loading, caching, sharing, animating, and other stuff
//
// Image:  an object to store all data needed for an image, including tracking multiple frames
//  this is for the image data, not information about rendering it (e.g. location, etc.)
//
// ImageRef:  a reference to an image, with runtime rendering info like which frame we're on in an animation.
//  this is separate so that each use can have its own current frame, but still collect
//  all the logic in one place instead of in each chunk of code using images, and make it easy
//  to intermix animated and nonanimated images
//
// Image Cache:  a cache of images...
//  Some browsers might cache images, but in practice I've found that they generally don't.  (e.g. chrome 24)
//  amd even then we'd still have to wait for it to call our onload function to get details like size.
//  so, for our convenience in being able to preload stuff and later use it immediately,
//  we preload into a cache (preLoadImages) and keep those images around.
//  maybe could have worked around the details, but this means we don't have to worry about
//  some implementations not caching images, or dumping them on a whim, or whatever.
//
// Hmm...  We do need some kind of way to queue up a bunch of loads, show a loading screen,
// and then move on.  Should that support be here?
// this per-image onLoad stuff is annoying...
//
// TODO:  Rewrite to use or support sprite sheets (atlases)
//------------------------------------------------------------------------------------
rat.modules.add("rat.graphics.r_image",
[
	{ name: "rat.graphics.r_graphics", processBefore: true },

	{ name: "rat.debug.r_console", processBefore: true},
	"rat.os.r_system",
],
function (rat)
{
	///
	/// Image Object
	/// @constructor
	///
	rat.graphics.Image = function ()
	{
		this.imageFrames = []; // separate list of Image() objects
		this.frames = null; // this is used for spritesheet-based images - a list of spritesheet frame info
		this.frameEvents = void 0;
		this.loadedCount = 0;
		this.loadedTargetCount = 0;
	};
	rat.graphics.Image.prototype.isImage = true; // for ease of detection
	
	rat.graphics.Image.centeredX = 0x0001;
	rat.graphics.Image.centeredY = 0x0002;
	rat.graphics.Image.flipX = 0x0004;
	rat.graphics.Image.flipY = 0x0008;

	// some system-wide properties (see below)
	rat.graphics.Image.lastRenderFrameIndex = -1;
	rat.graphics.Image.perFrameDrawCount = 0;

	// todo:  rename these "varName" or something, for clarity below.  These are all JSON file variable names,
	// Very indirect and kinda confusing.  I don't think they change, but by referring to them with variable names, we avoid problems with compilers renaming stuff
	//  which would then not match literal names in JSON files.
	// For some variable names (e.g. 'x', 'y', 'w', 'h') I use the literal names below, instead of using an indirect variable here.  Maybe do that everywhere?
	var frameName = 'frame'; // this is the name of the variable in a spritesheet file that holds frame info.
	var framesName = 'frames'; // this is the name of the variable in a spritesheet file that holds the list of frames
	var fileNameName = 'filename';
	var srcSizeName = 'spriteSourceSize'; // this is the size of the section of image we want to render?  different from "frame" if trimmed...
	var origSizeName = 'sourceSize'; // this is the *original* size of the original-pre-packed image.  Important to know to make spritesheet usage transparent.

	// note:  don't use flip, if you can avoid it.
	//  see http://stackoverflow.com/questions/7918803/flip-a-sprite-in-canvas and http://jsperf.com/ctx-flip-performance/5

	/// get the image for this frame, if it exists and is ready to draw.
	/// otherwise return null
	/// @method
	/// @param {number} frameNum 
	/// @param {Object=} options 
	///
	rat.graphics.Image.prototype.getImageFrame = function (frameNum, options)
	{
		if (!this.imageFrames)
		{
			return null;
		}
		if (frameNum < 0 || frameNum >= this.imageFrames.length)
		{
			if (!options || !options.noWarn)
			{
				if (this.imageFrames.length <= 0)
					rat.console.log("Bad image frame! Failed to specify/load any images?");
				else
					rat.console.log("Bad image frame! " + frameNum + " / " + this.imageFrames.length);
			}
			return null;
		}

		if (!this.imageFrames[frameNum].valid)
		{
			return null;
		}

		return this.imageFrames[frameNum];
	};

	rat.graphics.Image.prototype.isLoaded = function ()
	{
		for (var i = 0; i < this.imageFrames.length; i++)
		{
			//	check valid or error to know if load attempt is done.
			if (!this.imageFrames[i].valid && !this.imageFrames[i].error)
				return false;
		}
		return true;
	};

	//
	//	Add these frames to this image's frame list
	//	This is really the main chokepoint for loading, for images, single-frame or multi-frame.
	//	(start things loading)
	//
	rat.graphics.Image.prototype.appendFrames = function (inList)
	{
		if (!inList)
			return;
		
		//	handle list of sources or single source
		var sourceList = inList;
		if (!Array.isArray(inList))
		{
			sourceList = [inList];
		}
		//	what type of thing are we being given, here?  Could be resource name or canvas...
		var sourceType = typeof (sourceList[0]);
		
		//	set debug name for convenience
		if (sourceType === 'string')
			this.debugName = sourceList[0];

		//	can we find this in already loaded sprite sheets?
		if (sourceType === 'string' && this.findAndBuildFromSpriteSheets(sourceList))
			return;

		function onImgLoadComplete(img)
		{
			//console.log("loaded " + img.src + "\n");
			img.onload = null;	//	don't let anyone call me again.  See logic below.  Depends on browser.
			img.valid = true;
			this.loadedCount++;
			if (this.loadedCount >= this.loadedTargetCount && this.onLoad)
			{
				//console.log("finished loading " + this.loadedCount + " images");
				//console.log("first is " + this.frames[0].valid);
				//console.log("length is " + this.frames.length);

				this.onLoad(img); //	done loading all frames
			}
		}

		function onImgLoadError(img)
		{
			img.onerror = null;
			rat.console.log("ERROR loading image " + img.src);
			this.loadedCount++;
			img.error = true;	//	so we can skip it or track back problems later
		}

		//	load normally through cached images
		this.loadedTargetCount = sourceList.length;
		for (var i = 0; i < sourceList.length; i++)
		{
			//console.log("loading... " + sourceList[i] + "\n");

			var image = rat.graphics.findInCache(sourceList[i]);
			if (image !== null)
			{
				//	already in cache - just use that.
				//console.log("   found in cache " + image.origSrc + "\n");
				this.loadedCount++;
			} else
			{
				if (sourceType === 'string')
				{
					//console.log( "   making new image... "+sourceList[i]+"\n" );
					image = new Image();
					image.valid = false;	//	not yet loaded
					image.error = false;

					image.onload = onImgLoadComplete.bind(this, image);
					image.origSrc = sourceList[i];	//	remember original relative source
					image.onerror = onImgLoadError.bind(this, image);
					//rat.console.log("Loading image " + image.origSrc + "...");

					image.src = rat.system.fixPath(sourceList[i]);	//	will eventually get changed to full source path

					//console.log( "   Set src " + image.src + "\n" );

					//	a quick test.  does this work?
					//	If this image is already loaded, it might be nice to use it now instead of wait until onload gets called,
					//	because sometimes onload is not immediately called, even if the image is loaded.
					//	confirm this by checking width.
					if (image.width > 0 && image.onload)
						onImgLoadComplete.call(this, image); // this will clear the onload method

					//	todo: consider adding this to cache automatically
					//	currently, this function is already being used by cache to create new entries, so be careful with that.

				} else
				{
					//	support canvases.  Let's start by assuming that's what this is.
					//	TODO: step back a level - store an object that contains this canvas, or image,
					//		and has custom fields at THAT level instead of adding fields to a system canvas/image object,
					//		as we do here and above.  :(  Pretty bogus.

					//	UGH, this is really not ideal.  If the canvas we're loading comes from an image we have to wait for,
					//	then all kinds of things are wrong here... :(
					console.log("Trying to load non-string-resource image...");
					image = sourceList[i];	//	canvas
					image.valid = true;
					//	origSrc = leave it empty to force a different check...
					this.loadedCount++;
				}
			}

			this.imageFrames.push(image);
		}
	};
	
	rat.graphics.Image.spriteSheets = [];
	rat.graphics.Image.spriteSheets.numInMemory = 0;

	function SpriteSheet(image, tpjs, opts)
	{
		this.image = image;
		this.tpjs = tpjs;
		this.opts = opts;
		if (tpjs['meta'] && tpjs['meta'])
			this.scaledBy = Number(tpjs['meta']['scale']) || 1;
		else
			this.scaledBy = 1;
		this.undoScaler = 1/this.scaledBy;
		++rat.graphics.Image.spriteSheets.numInMemory;
	}
	SpriteSheet.prototype.inMemory = true;
	
	//	Load/unload a spritesheet from memory
	SpriteSheet.prototype.setActive = function( active )
	{
		if( active === void 0 )
			active = true;
		if( active == this.inMemory )
			return;
		
		if( !active )
		{
			this.inMemory = false;
			rat.graphics.clearFromCache( this.image );
			--rat.graphics.Image.spriteSheets.numInMemory;
		}
		else
		{
			rat.graphics.preLoadImages([this.image]);
			this.inMemory = true;
			++rat.graphics.Image.spriteSheets.numInMemory;
		}
		rat.console.log( (active ? "" : "UN-") + "loading spritesheet " + this.image );
	};
	
	//	load and register multi-part image from texturepacker js file
	//	this caches the image (if it's not already cached)
	//	and records all the frame info, which can be used later on a frame by frame basis
	rat.graphics.Image.registerSpriteSheet = function (image, tpjs, opts)
	{
		if (rat.graphics.Image.getSpriteSheetIndex(tpjs) >= 0)	//	already here
			return;
		if( !opts )
			opts = {};
		var sheet = new SpriteSheet( image, tpjs, opts );

		//	we support two kinds of tpjs files:  array of frames, and object with each frame named.
		//	Since most of the code in this module is designed to work with an array of frames, adapt the other type now.
		//	Note that it would be a lot more optimal to use the other approach (named variables instead of array) when searching for images,
		//	but for now I'm not going to worry about it - it's usually a one-time thing.
		//	If needed, we could later support them both more aggressively throughout this file, instead of translating here.

		var frameList = tpjs[framesName];
		if (!Array.isArray(frameList))
		{
			tpjs.namedFrames = frameList;	//	store for future reference in original form
			tpjs[framesName] = [];
			//	and build an array instead...
			for (var prop in frameList)	//	go through all properties in frame list (e.g. frame names.  "prop" here is just the property name)
			{
				if (frameList.hasOwnProperty(prop))
				{
					if (opts.forceLowerCase)
						frameList[prop][fileNameName] = prop.toLowerCase();
					else
						frameList[prop][fileNameName] = prop;
					
					tpjs[framesName].push(frameList[prop]);
				}
			}
		}
		
		if (opts.forceLowerCase)
		{
			var texPath = tpjs['meta']['image'];
			if (texPath)
				tpjs['meta']['image'] = texPath.toLowerCase();
		}
		
		if (opts.verbose)
		{
			rat.console.log("loaded spritesheet with " + sheet.tpjs[framesName].length + " frames");
		}
		rat.graphics.Image.spriteSheets.push(sheet);
	};
	
	//	Get how many sprite sheets exist
	//	This can be setup to only include sheets that are in memory
	rat.graphics.Image.getSpriteSheetCount = function(opts)
	{
		if( opts && opts.inMemory )
			return rat.graphics.Image.spriteSheets.numInMemory
		else
			return rat.graphics.Image.spriteSheets.length;
	};
	
	//	Get the nth spritesheet
	//	This can be setup to only include sheets that are in memory
	rat.graphics.Image.getNthSpriteSheet = function(nth, opts)
	{
		var sheets = rat.graphics.Image.spriteSheets;
		if( opts && opts.inMemory )
		{
			for( var index = 0; index < sheets.length; ++index)
			{
				var sheet = rat.graphics.Image.spriteSheets[index];
				if( sheet.inMemory )
				{
					--nth;
					if( nth < 0 )
						return sheet;
				}
			}
			return void 0;
		}
		else
			return sheets[nth];
	};
	
	//	Operate on each spritesheet that we have
	//	Can be setup to only run on sheets that are in memory
	rat.graphics.Image.forEachSpriteSheet = function( func, opts )
	{
		if( !func )
			return;
		var nth = 0;
		var sheet;
		while( (sheet = rat.graphics.Image.getNthSpriteSheet( nth, opts )) )
		{
			++nth;
			func( sheet, opts );
		}
	};

	//	find sprite sheet index by reference to tpjs
	rat.graphics.Image.getSpriteSheetIndex = function (tpjs)
	{
		for (var sheetIndex = 0; sheetIndex < rat.graphics.Image.spriteSheets.length; sheetIndex++)
		{
			if (rat.graphics.Image.spriteSheets[sheetIndex].tpjs === tpjs)
				return sheetIndex;
		}
		return -1;
	};

	//	Find this list of resources in one of our loaded sprite sheets.
	//	If found, return sprite sheet index and an array of indices into the frame list
	//	Note:  We access texture sheet (tpjs) vars (e.g. "spriteSourceSize") by literal name,
	//	since they're defined that way in the js files...  more convenient this way,
	//	rather than rewriting those files...  (though, it makes the code hard to read.  would be nice to clean up somehow)
	//	NOTE:  We only support finding them all in one sheet, not across sheets, currently.
	rat.graphics.Image.findInSpriteSheet = function (origResList)
	{
		//	simple case - we never loaded spritesheets.
		if (!rat.graphics.Image.spriteSheets || rat.graphics.Image.spriteSheets.length < 1)
			return null;
		
		//	We're going to search twice.  Once with full name matching including path, and then again without path (if needed).
		//	Why?
		//	We do the first path with full path matching so we can have several spritesheets with similar names,
		//	e.g. if two characters each have a "death_1.png" file, we need to be able to distinguish between them.
		//	We do the second search without full path matching as a fallback, to make it easier to set up spriteSheets
		//	with a bunch of files just thrown into them without any concern about where they came from.
		
		//	so, here's a search function we can use...
		function searchSheets(resList, doMatchPath)
		{
			for (var sheetIndex = 0; sheetIndex !== rat.graphics.Image.spriteSheets.length; ++sheetIndex)
			{
				var sheetEntry = rat.graphics.Image.spriteSheets[sheetIndex];
				var tpjs = sheetEntry.tpjs;
				var frames = tpjs[framesName];	//	list of frames in spritesheet to search
				
				var frameIndexList;	//	list of collected frames that match
				frameIndexList = [];
				
				var prefix = "";
				if (doMatchPath)
				{
					//	todo: when registering spritesheets, support manually setting an alternative search prefix path.
					var texPath = tpjs['meta'];
					if (!texPath)
						continue;
					var texPath = texPath['image'];
					if (!texPath)
						continue;	//	no image path, so we can't use it as a prefix, so don't bother
					
					prefix = rat.utils.getPath(texPath, true);
					
				} else {	//	match without path?
					//	if this sheet requires path matching, skip it.
					if (sheetEntry.opts.requirePath)
						continue;
				}
				
				for (resIndex = 0; resIndex !== resList.length; ++resIndex)
				{
					var lowerRes = null;	//	only created if needed below
					
					for (var frameIndex = 0; frameIndex !== frames.length; ++frameIndex)
					{
						//	Note: sprite sheets sometimes store a simple file name, and sometimes a partial path,
						//	e.g. if texturePacker is using "smartFolders".
						
						var res;
						if (sheetEntry.opts.forceLowerCase)
						{
							if (!lowerRes)	//	first time we needed this?
								lowerRes = resList[resIndex].toLowerCase();
							res = lowerRes;
						} else
							res = resList[resIndex];

						if (prefix + frames[frameIndex][fileNameName] === res)
						{
							frameIndexList.push(frameIndex);
							break;	//	got it, don't keep searching for this one
						}
					}
				}
				
				//	did we find them all?  NOTE:  We seem to only support finding them all in one sheet, not across sheets, currently.
				if (frameIndexList.length === resList.length)
					return { sheetIndex: sheetIndex, frameIndexList: frameIndexList };
				else
					frameIndexList = [];
			}
			return null;
		}
		
		//	search first with paths
		//	Build list of fixed names in case they have .. in them.
		var newResList = [];
		for (var resIndex = 0; resIndex !== origResList.length; ++resIndex)
		{
			newResList[resIndex] = rat.utils.cleanPath(origResList[resIndex]);
			
			//	temp debug stuff
			if (newResList[resIndex].indexOf("out/media/img/char/lvl1_m/attack_1.png") >= 0)
				rat.console.log("will be searching for " + newResList[resIndex]);
		}
		var res = searchSheets(newResList, true);
		if (res)
			return res;
		
		//	temp debug
		//if (newResList[0].indexOf("Lvl1_m/attack_1.png") >= 0)
		//	rat.console.logOnce("!couldn't find " + newResList[0], 'nofind');
		
		//	then without...
		//	Build a version of resList that does not include path.
		var shortResList = [];
		for (var resIndex = 0; resIndex !== origResList.length; ++resIndex)
		{
			shortResList[resIndex] = rat.utils.stripPath(origResList[resIndex]);
		}
		
		return searchSheets(shortResList, false);
	};

	//	Attempt to build my frames from one of the registered spritesheets
	//	the list passed in is a list of resource names
	rat.graphics.Image.prototype.findAndBuildFromSpriteSheets = function (resList)
	{
		var foundInfo = rat.graphics.Image.findInSpriteSheet(resList);
		if (!foundInfo)
			return false;

		this.buildFramesFromSpriteSheets(foundInfo.sheetIndex, foundInfo.frameIndexList);
		return true;
	};

	//
	//	Build my frames from this specified sheet in our list, and this frame index list.
	//
	rat.graphics.Image.prototype.buildFramesFromSpriteSheets = function (sheetIndex, frameIndexList)
	{
		var sheetEntry = rat.graphics.Image.spriteSheets[sheetIndex];
		var tpjs = sheetEntry.tpjs;

		this.appendFrames(sheetEntry.image);	//	set our one image to be the one for this sheet.  will use cached image if possible.

		//	copy a bunch of data over.  See note above about tpjs literal field name access
		this.frames = [];	//	multi-frame from internal list
		for (var fIndex = 0; fIndex < frameIndexList.length; fIndex++)
		{
			var frame = {};

			var tpFrameIndex = frameIndexList[fIndex];
			var tpFrame = tpjs[framesName][tpFrameIndex];

			var name = tpFrame[fileNameName];
			frame.name = name.substring(0, name.length - 4);
			frame.scaledBy = sheetEntry.scaledBy;
			frame.undoScaler = sheetEntry.undoScaler;

			frame.drawBox = {
				x: tpFrame[frameName]['x'],
				y:	tpFrame[frameName]['y'],
				w:	tpFrame[frameName]['w'],
				h:	tpFrame[frameName]['h']
			};
			
			frame.box = {};
			frame.box.x = frame.drawBox.x * sheetEntry.undoScaler;
			frame.box.y = frame.drawBox.y * sheetEntry.undoScaler;
			frame.box.w = frame.drawBox.w * sheetEntry.undoScaler;
			frame.box.h = frame.drawBox.h * sheetEntry.undoScaler;

			var trimFrame = tpFrame[srcSizeName];
			frame.trimRect = {
				x: trimFrame['x'] * sheetEntry.undoScaler,
				y: trimFrame['y'] * sheetEntry.undoScaler,
				w: trimFrame['w'] * sheetEntry.undoScaler,
				h: trimFrame['h'] * sheetEntry.undoScaler };

			var sourceSize = tpFrame[srcSizeName];
			frame.sourceSize = { w: sourceSize['w'], h: sourceSize['h'] };

			//	original size of original image before being packed.  This is the size we'll report if anyone asks how big we are.
			var origSize = tpFrame[origSizeName];
			var oW, wH;
			if( origSize['w'] )
				oW = origSize['w'] * sheetEntry.undoScaler;
			else
				oW = frame.box.w;
			if( origSize['h'] )
				oH = origSize['h'] * sheetEntry.undoScaler;
			else
				oH = frame.box.h;
			frame.origSize = {
				w: oW,
				h: oH
			};

			//var name = tpFrame['filename'];
			//frame.name = name.substring(0, name.length-4);

			this.frames.push(frame);
		}
	};

	//
	//	build this image automatically from all the frames in a tpjs (by tpjs reference passed in)
	//	(so, this is useful if the entire spritesheet is a single animation, in order)
	//
	rat.graphics.Image.prototype.buildFromSpriteSheet = function (tpjs)
	{
		var sheetIndex = rat.graphics.Image.getSpriteSheetIndex(tpjs);
		if (sheetIndex < 0)
			return;

		//	just make a list of indices and use our function above.
		var frameIndexList = [];
		for (var i = 0; i < tpjs[framesName].length; i++) // I assume that this is ['frames'] because the JSON is not minimized?
		{
			frameIndexList[i] = i;
		}

		this.buildFramesFromSpriteSheets(sheetIndex, frameIndexList);
	};

	//	return frame count for this image
	rat.graphics.Image.prototype.frameCount = function ()
	{
		//	multi-part?  if so, return that count
		if (this.frames)
			return this.frames.length;

		//	otherwise return raw image count, since those are our frames
		return this.imageFrames.length;
	};

	//	return the index of the frame with this name, if any
	//	otherwise return -1
	rat.graphics.Image.prototype.getNamedFrame = function (name)
	{
		//	multi-part?  if so, return that count
		if (this.frames)
		{
			for (var i = 0; i < this.frames.length; i++)
			{
				if (this.frames[i].name === name)
					return i;
			}
		}

		//	TODO:  look through our images and see if one has the right name.
		//this.imageFrames.length;
		return -1;
	};

	//	return frame size
	//	returned object is in the form {w:..., h:...}
	rat.graphics.Image.prototype.getFrameSize = function (frameIndex)
	{
		if (this.frames)	//	sprite sheet based, with a list of frames?  Return the size from that frame info.
		{
			//	STT 2015.1.9:  Use ORIGINAL size of image.  This is important for complete transparency with spritesheet usage.
			return this.frames[frameIndex].origSize;
			//return this.frames[frameIndex].sourceSize;
		}
		else
		{
			var frameImage = this.getImageFrame(frameIndex);
			if (frameImage)
			{
				return { w: frameImage.width, h: frameImage.height };
			} else
			{	//	no image loaded?
				var debugName = this.debugName || "";
				rat.console.logOnce("r_image: error:  asking for size of image that hasn't been loaded : " + debugName, 'imageSizeError');
				return { w: 32, h: 32 };	//	fake it so we don't crash
			}
		}
	};

	//	set function to call when all frames are loaded
	rat.graphics.Image.prototype.setOnLoad = function (func)
	{
		this.onLoad = func;
		if( !func )
			return;
		//	already done?  I don't think this ever happens, even if image is cached.
		if (this.loadedCount >= this.loadedTargetCount)
		{
			//console.log("finished(pre) loading " + this.loadedCount + " images");
			this.onLoad(this.imageFrames[0]);
		}/* else
		{
			rat.console.log("waiting...");
		}
		*/
	};

	/**
	*	Draw.
	*	This hides internals, like whether we're single-frame, sprite-sheet, multi-sheet, etc.
	*
	*	IMPORTANT!
	*		This functionality is also extracted and rewritten in the particle system, for speed.
	*		Maybe not the best approach, since that has already broken at least once.
	*		As far as I can tell, it's to save one function call per draw.
	*		Anyway, if you change code here, you have to change it in the particle system, too.
	*		todo: Find some way to do macros instead of duplicating code?
	*
	*	@param {Object=} ctx
	*	@param {number=} frameNum
	*	@param {number=} x
	*	@param {number=} y
	*	@param {number=} w
	*	@param {number=} h
	*	@param {number=} flags
	*	@param {number=} clipX
	*	@param {number=} clipY
	*	@param {number=} clipWidth
	*	@param {number=} clipHeight
	*/
	rat.graphics.Image.prototype.draw = function (ctx, frameNum, x, y, w, h, flags, clipX, clipY, clipWidth, clipHeight)
	{
		ctx = ctx || rat.graphics.ctx;
		var offsetX;
		var offsetY;
		var frameImage;
		var offsetMultX = 1;
		var offsetMultY = 1;
		var saved = false;

		x = x || 0;
		y = y || 0;

		if (!this.frames)	//	easy version - single frame
		{
			frameImage = this.getImageFrame(frameNum);
			if (!frameImage)
				return;

			if (w === void 0)
				w = frameImage.width;
			if (h === void 0)
				h = frameImage.height;
			if (clipX === void 0)
				clipX = 0;
			if (clipY === void 0)
				clipY = 0;
			if (clipWidth === void 0)
				clipWidth = frameImage.width;
			if (clipHeight === void 0)
				clipHeight = frameImage.height;

			offsetX = 0;
			offsetY = 0;
			if (flags & rat.graphics.Image.centeredX)
				offsetX = -w / 2;
			if (flags & rat.graphics.Image.centeredY)
				offsetY = -h / 2;

			if (flags & rat.graphics.Image.flipX)
			{
				saved = true;
				ctx.save();
				offsetMultX = -1;
				ctx.translate(w, 0);
				ctx.scale(-1, 1);
			}
			if (flags & rat.graphics.Image.flipY)
			{
				if (!saved)
				{
					saved = true;
					ctx.save();
				}

				offsetMultY = -1;
				ctx.translate(0, h);
				ctx.scale(1, -1);
			}

			ctx.drawImage(frameImage, clipX, clipY, clipWidth, clipHeight, (x + offsetX) * offsetMultX, (y + offsetY) * offsetMultY, w, h);

		} else
		{	//	sprite sheet version (todo: consolidate common elements! yes...)
			// TODO! support clipping for sprite sheets - EG clipX, clipY, clipWidth, clipHeight

			frameImage = this.getImageFrame(0);
			if (!frameImage)
				return;

			var curFrame = this.frames[frameNum];

			if (typeof w === 'undefined')
				w = curFrame.origSize.w;	//	use original image size, as if this had never been packed in a sprite sheet
			if (typeof h === 'undefined')
				h = curFrame.origSize.h;

			//	figure out scale, and thus effective width and height in the trimmed "box" space...

			//var wscale = w / curFrame.sourceSize.w;	//	how much client wants to scale
			//var hscale = h / curFrame.sourceSize.h;
			var wscale = w / curFrame.origSize.w;	//	how much client wants to scale from original size
			var hscale = h / curFrame.origSize.h;
			var ew = curFrame.box.w * wscale;
			var eh = curFrame.box.h * hscale;

			offsetX = curFrame.trimRect.x * wscale;	//	account for trim
			offsetY = curFrame.trimRect.y * hscale;

			if (flags & rat.graphics.Image.flipX)
			{
				saved = true;
				ctx.save();
				offsetMultX = -1;
				ctx.translate(ew, 0);
				offsetX = (curFrame.origSize.w - (curFrame.trimRect.x + curFrame.box.w)) * wscale;
				ctx.scale(-1, 1);
			}
			if (flags & rat.graphics.Image.flipY)
			{
				if (!saved)
				{
					saved = true;
					ctx.save();
				}
				offsetMultY = -1;
				ctx.translate(0, eh);
				offsetX = (curFrame.origSize.h - (curFrame.trimRect.y + curFrame.box.h)) * hscale;
				ctx.scale(1, -1);
			}

			if (flags & rat.graphics.Image.centeredX)
				offsetX -= w / 2;	//	center based on desired render size, not trimmed image
			if (flags & rat.graphics.Image.centeredY)
				offsetY -= h / 2;

			ctx.drawImage(
				frameImage,
				curFrame.drawBox.x,	// use x in image
				curFrame.drawBox.y,	//	use y in image
				curFrame.drawBox.w,	//	use w in image
				curFrame.drawBox.h, // use h in image
				(x + offsetX) * offsetMultX,			//	Draw to x
				(y + offsetY) * offsetMultY,			//	Draw to y
				ew,											//	Draw to w
				eh);											//	Draw to h

			//	The image should draw in this frame
			//ctx.strokeRect(x, y, w*wscale, h*wscale);
		}

		if (saved)
			ctx.restore();

		//	for debugging purposes, count how many images we've drawn this frame.
		if (rat.graphics.frameIndex !== rat.graphics.Image.lastRenderFrameIndex)
		{
			rat.graphics.Image.lastRenderFrameIndex = rat.graphics.frameIndex;
			rat.graphics.Image.perFrameDrawCount = 0;
		}
		rat.graphics.Image.perFrameDrawCount++;
	};

	//------------------------------
	//	ImageRef class

	///
	/// Image Ref
	/// track a reference to an image, and track unique rendering info like current frame.
	/// @constructor
	/// @param {Array.<string>|string=} sources
	///
	rat.graphics.ImageRef = function (sources)
	{
		//console.log("imageref constructor");

		if (typeof (sources) === 'object' && sources.isImageRef)	//	support copying from existing imageref
		{
			this.copyFrom(sources);
			return;

		} else if (typeof (sources) === 'object' && sources.isImage)	//	support construction from existing image object
		{
			this.image = sources;
		} else
		{
			this.image = new rat.graphics.Image();
			if (sources)
				this.image.appendFrames(sources);
		}

		//	note:  if you add fields to this list, remember to update copyFrom() below.
		//	this is an argument for using "flags" instead of adding separate named flag fields,
		//	since "flags" is already copied.

		this.frame = 0;
		this.animSpeed = 0; //	by default, not animated
		this.animDir = 1; //	by default, forward
		this.animPaused = false; // Is the animation paused

		//	todo move to a more flexible set of start/end action flags?
		//	use flags value below instead of named properties here.
		this.animAutoReverse = false;	//	if this is set, don't loop - reverse and bounce back and forth
		this.animStopAtEnd = false;	//	if this is set, don't loop or reverse, just play and stop.

		this.time = 0;

		this.flags = 0;
	};
	rat.graphics.ImageRef.prototype.isImageRef = true;	//	for ease of detection

	//	Set up all my values as a copy from this other imageRef's values.
	rat.graphics.ImageRef.prototype.copyFrom = function (source)
	{
		this.image = source.image;
		this.frame = source.frame;
		this.animSpeed = source.animSpeed;
		this.animDir = source.animDir;
		this.animPaused = source.animPaused;
		this.animAutoReverse = source.animAutoReverse;
		this.animStopAtEnd = source.animStopAtEnd;
		this.time = source.time;
		this.flags = source.flags;
		this.frameEvents = source.frameEvents;
	};

	//	Assign the frame events
	rat.graphics.ImageRef.prototype.setFrameEvents = function (events) {
		this.frameEvents = events;
	};

	//	Fire any event assigned to the current frame
	rat.graphics.ImageRef.prototype.fireEventsForFrame = function (frame) {
		if (!this.frameEvents || !this.frameEvents[frame] || !rat.eventMap)
			return;
		rat.eventMap.fire(this.frameEvents[frame], this);
	};

	//
	//	given a sprite sheet, register it and build an imageref that uses all its frames.
	rat.graphics.ImageRef.buildFromSpriteSheet = function (res, tpjs)
	{
		rat.graphics.Image.registerSpriteSheet(res, tpjs);
		var imageRef = new rat.graphics.ImageRef();
		imageRef.image.buildFromSpriteSheet(tpjs);
		return imageRef;
	};

	//	given a sprite sheet already registered, build a collection of imagerefs with the proper animation frames,
	//	judging by frame name.
	//
	//	This is a very high level function intended to automatically build all the animations in a spritesheet,
	//	using the frame names to figure out what animations are distinct.
	//	Since we assume the spritesheet is already registered and loaded, don't worry about caching - just create all the imagerefs we need.
	//	Lots of assumptions about names, currently.  We assume names like "walk_0001.png"
	//	if there's no extension or the name is all numbers, this code will crash and burn.  I haven't bothered doing error checking yet.
	//
	//	This has been tested, and works in at least my test case, but it may have limited use.
	//	It doesn't tell us crucial things about the animations we collect, including animation speed.
	rat.graphics.ImageRef.constructAllFromSpriteSheet = function (tpjs)
	{
		//	get entry in our list of registered spritesheets
		var sheetIndex = rat.graphics.Image.getSpriteSheetIndex(tpjs);
		if (sheetIndex < 0)
			return null;

		var collection = {};

		function finishSequence(name, sequence)
		{
			if (sequence.length <= 0)
				return;

			//	trim trailing _ if any, for final name in our collection object
			var len = name.length;
			if (name.charAt(len - 1) === '_')
				name = name.substring(0, len - 1);

			var imageRef = new rat.graphics.ImageRef();
			imageRef.image.buildFramesFromSpriteSheets(sheetIndex, sequence);

			collection[name] = imageRef;

			//	add in both named and list form?
			//collection.list.push(imageRef);
		}

		//	walk through all the frames for that guy.  For now, let's maybe just assume they're sequential,
		//	and switch when the new one has a new name.
		var lastName = "";
		var sequence = [];
		var frames = rat.graphics.Image.spriteSheets[sheetIndex].tpjs[framesName];
		for (var frameIndex = 0; frameIndex < frames.length; frameIndex++)
		{
			var name = frames[frameIndex][fileNameName];
			//	examine that name.  deconstruct the numbering part with the base name part.
			//var len = name.length;
			var check = name.lastIndexOf(".");	//	skip past .png part
			name = name.substring(0, check);	//	cut that part off
			while (check >= 0)
			{
				if (isNaN(name.charAt(check)))	//	not a number
				{
					check++;	//	don't include bogus char in our number part
					break;
				}
				check--;
			}

			var number;
			if (check <= 0 || check >= name.length)	//	all number or no number part
				number = 0;
			else
			{
				var numPart = name.substring(check);
				name = name.substring(0, check);
				number = parseInt(numPart);
			}

			// OK!  Now, if the name changed, start a new list
			if (lastName !== name)
			{
				finishSequence(lastName, sequence);
				sequence = [];
			}

			//	add the original frame index to our existing list.
			sequence.push(frameIndex);
			lastName = name;
		}
		finishSequence(lastName, sequence);

		return collection;
	};

	rat.graphics.ImageRef.prototype.setOnLoad = function (func)
	{
		this.image.setOnLoad(func);
	};

	rat.graphics.ImageRef.prototype.isLoaded = function ()
	{
		return this.image.isLoaded();
	};

	//	get the current image, if it exists and is ready to draw.
	//	otherwise return null
	rat.graphics.ImageRef.prototype.getImage = function ()
	{
		return this.image.getImageFrame(this.frame);
	};

	rat.graphics.ImageRef.prototype.getNamedFrame = function (name)
	{
		return this.image.getNamedFrame(name);
	};

	//	get frame count
	//	todo: inconsistent names - "frameCount()" should probably be "getFrameCount()" in image.
	rat.graphics.ImageRef.prototype.getFrameCount = function ()
	{
		return this.image.frameCount();
	};

	rat.graphics.ImageRef.prototype.setFrame = function (index)
	{
		var frameCount = this.image.frameCount();
		if (index < 0)
			index = 0;
		index = index % frameCount;	//	let's just wrap to make sure we're in the right range

		var oldFrame = this.frame;
		this.frame = index;

		if (oldFrame !== this.frame && this.frameEvents)
			this.fireEventsForFrame(this.frame);
	};

	rat.graphics.ImageRef.prototype.setFrameByName = function (name)
	{
		this.setFrame(this.getNamedFrame(name));
	};

	//	get current frame index
	rat.graphics.ImageRef.prototype.getFrame = function ()
	{
		return this.frame;
	};

	//	get size for this given frame
	//	returned object is in the form {w:..., h:...}
	rat.graphics.ImageRef.prototype.getFrameSize = function (frameIndex)
	{
		return this.image.getFrameSize(frameIndex);
	};

	//	get current frame size
	//	returned object is in the form {w:..., h:...}
	rat.graphics.ImageRef.prototype.getSize = function ()
	{
		return this.getFrameSize(this.frame);
	};

	rat.graphics.ImageRef.prototype.setAnimSpeed = function (animSpeed)
	{
		this.animSpeed = animSpeed;
	};
	rat.graphics.ImageRef.prototype.setAnimAutoReverse = function (autoReverse)
	{
		this.animAutoReverse = autoReverse;
	};
	rat.graphics.ImageRef.prototype.setAnimOneShot = function (oneShot)
	{
		this.animOneShot = oneShot;
	};
	/** @param {boolean=} paused */
	rat.graphics.ImageRef.prototype.setAnimPaused = function (pause)
	{
		this.animPaused = (pause === void 0) ? true : pause;
	};
	rat.graphics.ImageRef.prototype.setAnimFinished = function ()
	{
		this.time = this.image.frameCount();
		this.update(0);	//	immediately reflect this correctly in current frame, rather than wait for next update
	};
	rat.graphics.ImageRef.prototype.isAnimFinished = function ()
	{
		return (this.time >= this.image.frameCount());
	};
	rat.graphics.ImageRef.prototype.isAnimOneShot = function ()
	{
		return this.animOneShot;
	};
	rat.graphics.ImageRef.prototype.restartAnim = function ()
	{
		this.time = 0;
		this.update(0);	//	immediately reflect this correctly in current frame, rather than wait for next update
	};
	rat.graphics.ImageRef.prototype.setRandomTime = function ()
	{
		this.time = Math.random() * this.image.frameCount();
		this.update(0);	//	immediately reflect this correctly in current frame, rather than wait for next update
	};

	//	update our state, mostly dealing with animation
	rat.graphics.ImageRef.prototype.update = function (dt)
	{
		if (this.animSpeed > 0)
		{
			var frameCount = this.image.frameCount();
			if (!this.animPaused)
			{
				this.time += this.animSpeed * this.animDir * dt;
				var timeLen = frameCount;
				if (this.animAutoReverse)	//	bounce back and forth
				{
					if (this.time > timeLen)
					{
						var delta = this.time - timeLen;	//	go back as much as we went over
						this.time = timeLen - delta;
						this.animDir = -1;
					}
					if (this.time < 0)
					{
						if (this.animOneShot)
						{
							this.time = 0;	//	Stay at the front.
						}
						else
						{
							this.time = -this.time;	//	go forward as much as we went too far back
							this.animDir = 1;
						}
					}
				} else if (this.animOneShot)
				{
					if (this.time > timeLen)
					{
						this.time = timeLen;	//	stay at end
					}
				} else
				{	//	loop back to start
					while (this.time > timeLen)	//	could have gone way past end, need to keep looping back
					{
						this.time -= timeLen; //	back to start, factoring in how much we overshot
					}
				}
			}

			//	update frame based on time
			//	(being paused but animating doesn't mean that someone else isn't changing our time explicitly.  Let them.)
			var oldFrame = this.frame;
			this.frame = (this.time) | 0;

			//	clamp to valid space
			if (this.frame < 0)
				this.frame = 0;
			if (this.frame >= frameCount)
				this.frame = frameCount - 1;

			if (oldFrame !== this.frame && this.frameEvents)
				this.fireEventsForFrame(this.frame);
		}
		//	otherwise leave it alone - maybe somebody manually controls current frame
	};

	/**
	*	draw!  See image draw above.  This just picks correct frame.
	*	@param {Object=} ctx
	*	@param {number=} x
	*	@param {number=} y
	*	@param {number=} w
	*	@param {number=} h
	*	@param {number=} clipX
	*	@param {number=} clipY
	*	@param {number=} clipWidth
	*	@param {number=} clipHeight
	*/
	rat.graphics.ImageRef.prototype.draw = function (ctx, x, y, w, h, clipX, clipY, clipWidth, clipHeight)
	{
		this.image.draw(ctx, this.frame, x, y, w, h, this.flags, clipX, clipY, clipWidth, clipHeight);
	};

	rat.graphics.ImageRef.prototype.setCentered = function (centeredX, centeredY)
	{
		if (typeof centeredY === 'undefined')
			centeredY = centeredX;
		if (centeredX)
			this.flags |= rat.graphics.Image.centeredX;
		else
			this.flags &= ~rat.graphics.Image.centeredX;
		if (centeredY)
			this.flags |= rat.graphics.Image.centeredY;
		else
			this.flags &= ~rat.graphics.Image.centeredY;

		//	Allow chaining calls
		return this;
	};

	rat.graphics.ImageRef.prototype.setFlipped = function (flipX, flipY)
	{
		if (flipX)
			this.flags |= rat.graphics.Image.flipX;
		else
			this.flags &= ~rat.graphics.Image.flipX;
		if (flipY)
			this.flags |= rat.graphics.Image.flipY;
		else
			this.flags &= ~rat.graphics.Image.flipY;
	};

	//--------------- Caching images -----------------

	//	this is a cache of images, in the form of rat.graphics.Image obects.
	rat.graphics.imageCache = [];
	rat.graphics.imageCache.leftToLoad = 0;

	//	explicitly preload (start caching) a bunch of images.
	//	The argument here can be either a single image
	//		rat.graphics.preLoadImages("bob.png");
	//	or a list
	//		rat.graphics.preLoadImages(["bob.png", "sally.png", "frank.png"]);
	//	This will start those images loading, and register them in our internal cache for easy use later.
	//	More importantly, when you try to use them later, they'll be loaded and have width/height info available.
	//	You can check if preloading is done by calling isCacheLoaded below.
	//	You can call this as many times as you want.
	rat.graphics.preLoadImages = function (list)
	{
		if (!Array.isArray(list))	//	for convenience, allow a single string to be passed in
			list = [list];

		//	we now skip preloads if they're already found in spritesheets.
		//	todo:  also skip if they were preloaded normally?  What if we have duplicates in this list?
		//	or had a previous call to preLoadImages?
		
		var alreadyInSheetsCount = 0;
		//console.log("preloading this many images: " + list.length + "\n");
		for (var i = 0; i < list.length; i++)
		{
			if (rat.graphics.Image.findInSpriteSheet([list[i]]))
			{
				alreadyInSheetsCount++;
				continue;
			}
			
			rat.graphics.imageCache.leftToLoad += 1;
			
			//console.log( "    preloading image " + (i+1) + " of " + list.length + "\n" );
			//	just add each one as a rat.graphics.Image
			var image = new rat.graphics.Image();
			image.appendFrames(list[i]);
			image.setOnLoad( function(image, data)
			{
				image.setOnLoad(void 0);
				--rat.graphics.imageCache.leftToLoad;
				if( rat.graphics.imageCache.leftToLoad < 0 )
					rat.graphics.imageCache.leftToLoad = 0;
			}.bind(void 0, image));
			rat.graphics.imageCache.push(image);

			//console.log("    precaching " + list[i]);
		}
		//console.log("precaching " + rat.graphics.imageCache.leftToLoad + " images, " + alreadyInSheetsCount + " were already in sheets.");
		//console.log("done queueing up cache.");
	};
	
	//	Remove an image from the cache
	rat.graphics.clearFromCache = function(path)
	{
		var foundOut = {};
		var found = rat.graphics.findInCache(path, foundOut);
		if( !found )
			return;
		
		//	Remove from the cache
		rat.graphics.imageCache.splice( foundOut.index, 1 );
		
		//	This may be over kill, but i want to make sure that the image is gone
		//	Because the image object in the cache is shared with rat.graphics.images that
		//	Use it, i cannot modify the actual image object.
		//found.cleanup();
	};
	
	//	see if entire cache is loaded (e.g. match call to preLoadImages above)
	//	todo: return info about progress, at least percentage or something.
	rat.graphics.isCacheLoaded = function ()
	{
		for (var i = 0; i < rat.graphics.imageCache.length; i++)
		{
			if (!rat.graphics.imageCache[i].isLoaded())
			{
				//console.log("image cache waiting for " + rat.graphics.imageCache[i].imageFrames[0].src);
				return false;
			}
		}
		return true;
	};

	//	Report what imgaes are in the cache
	rat.graphics.reportCache = function ()
	{
			var cached = rat.graphics.imageCache;
			rat.console.log( "-----------------------------------" );
			rat.console.log( "" + cached.length + " images in cache." );
			for (var i = 0; i < cached.length; i++)
			{
				var img = cached[i].getImageFrame(0, { noWarn: true });
				rat.console.log( "\t " + i.toFixed(2) + ">" + img.origSrc  );
			}
			rat.console.log( "-----------------------------------" );
	};
	rat.console.registerCommand( "imageCache", rat.graphics.reportCache, ["reportImageCache", "showImageCache"] )
	
	//	see if this image is already in cache
	//	return low level Image directly, if found.
	//	otherwise, return null.
	//	STT: adding canvas support, so "resource" here could be asset string or canvas object
	rat.graphics.findInCache = function (resource, out)
	{
		//console.log("find in cache " + resource);
		//console.log("cache is this long: " + rat.graphics.imageCache.length);
		for (var i = 0; i < rat.graphics.imageCache.length; i++)
		{
			///	todo:  We currently assume all frames are cached independently,
			//	but will that be the case?  Do we need to walk through all frames?
			var img = rat.graphics.imageCache[i].getImageFrame(0, { noWarn: true });
			if (img !== null)
			{
				//console.log("checking " + img.origSrc);
				if ((img.origSrc && img.origSrc === resource) || img === resource)
				{
					if( out )
						out.index = i;
					return img;
				}
			}
		}
		//console.log("not found: " + resource);
		return null;
	};

	//---------------- support for external image systems to use our api ------------------

	rat.graphics.externalSpriteMaker = null;

	//	a sort of light factory.  Make images.
	//	if we have an external image creator and extra arguments were supplied, then use that creator.
	//	todo: support variable args instead of fixed 2.
	rat.graphics.makeImage = function (resource, extra1, extra2)
	{
		if (extra1 && rat.graphics.externalSpriteMaker)
		{
			return rat.graphics.externalSpriteMaker(resource, extra1, extra2);
		} else
		{
			return new rat.graphics.ImageRef(resource);
		}
	};

	//	set up an external sprite creation function.
	//	This is basically for bridging other image-handling libraries in to rat.
	//		or providing a way to have very different image creation support on a game by game basis.
	//	Any image created with this external sprite maker (see makeImage() above!) must respect the same basic API
	//		that we support with ImageRef, particularly draw(), update(), getFrameSize(), isLoaded(), and more.
	//		see usage in r_ui_sprite
	rat.graphics.setExternalSpriteMaker = function (f)
	{
		rat.graphics.externalSpriteMaker = f;
	};
});
//
//	storage layer
//
//	The idea is to wrap access to a few storage options...
//	Use a single common API,
//	and be able to prototype and test things like win8 storage while developing in a browser
//
//	Usage:
//		var storage = rat.storage.getStorage(rat.storage.permanentLocal);
//		storage.setItem("hey", 12);
//		var x = storage.getItem("hey");
//		storage.setObject("frank", { age: 12, friends: 3 });
//
//	todo:  Support encryption and decryption on all things, since they're all just strings.
//		should be pretty easy, actually...  just xor or something.  See drawpig...
//		maybe add a few weird chars in for kicks, like before and after, and strip them off later, so single-char values are not obvious
//	todo:  Support encryption/decryption of key as well!
//	todo:  Since this will be open-source, let the client app set the encryption parameters.

//	storage namespace
rat.modules.add("rat.storage.r_storage",
[
	{ name: "rat.utils.r_utils", processBefore: true },

	{ name: "rat.storage.r_storage_xbo", platform: "xbox" },
	{ name: "rat.storage.r_storage_firebase"/*, platform: void 0*/ }, // How to get this one to load.
	"rat.os.r_system",
	"rat.os.r_user",
	"rat.debug.r_console",
],
function (rat)
{
	rat.storage = {
		storageObjects: {
			byUser: {}, // Each user also has a byType
			byType: {}
		}
	};

	/**
	 * Debug function to Clear any held data.
	 * @suppress {missingProperties}
	 */
	rat.storage.clear = function ()
	{
		function clearData(store)
		{
			var fields = store.values;
			for (var key in fields)
			{
				if (fields.hasOwnProperty(key))
				{
					store.values.remove(key);
				}
			}
		}

		if (window.Windows !== void 0)
		{
			clearData(window.Windows.Storage.ApplicationData.current.localSettings);
			clearData(window.Windows.Storage.ApplicationData.current.roamingSettings);
		}

		if (rat.system.has.xbox)
			rat.storage.XboxOne.clear();

		if (window.localStorage)
		{
			if (window.localStorage.clear)
				window.localStorage.clear();
			else if (rat.system.has.Wraith)
				rat.console.log("To clear user settings under wraith, use the wraith cheat \"resetPrefs\"");
		}
	};

	//	return a new reference to the given storage system
	/**
	 * @param {number} storeType
	 * @param {Object=} user
	 * @suppress {checkTypes}
	 */
	rat.storage.getStorage = function (storeType, userID)
	{
		//	Only have one storage per type per user ever
		// we don't want to kick off the startup calls each time we look for a storage object, so save it off
		if (userID !== void 0 && userID.id !== void 0)
			userID = userID.id;
		else
			userID = userID || "";
		var storageObjects = rat.storage.storageObjects.byType;
		if (userID)
		{
			rat.storage.storageObjects.byUser[userID] = rat.storage.storageObjects.byUser[userID] || {};
			storageObjects = rat.storage.storageObjects.byUser[userID];
		}
		if (storageObjects && storageObjects[storeType])
			return storageObjects[storeType];

		//	create the proper object depending on requested service and host system.
		//	Each type of object we instantiate supports all the same API.  See below.

		//	for xbox, send this call off to xbox specific code in another module.
		if (rat.system.has.xbox)
			storageObjects[storeType] = rat.storage.XboxOne.getStorage(storeType, userID);

		else if (rat.system.has.realWindows8)
		{
			if (storeType === rat.storage.permanentLocal)
				storageObjects[storeType] = new rat.Win8AppStorage('', true);
			else if (storeType === rat.storage.permanentRoaming)
				storageObjects[storeType] = new rat.Win8AppStorage('', false);
			else if (storeType === rat.storage.suspendLocal)
				storageObjects[storeType] = new rat.Win8SessionStorage('');
		}
		else
		{
			if (storeType === rat.storage.permanentLocal)
				storageObjects[storeType] = new rat.LocalStore('');
			else if (storeType === rat.storage.suspendLocal)
				storageObjects[storeType] = new rat.LocalStore('_sus_');
		}

		return storageObjects[storeType];
	};

	rat.storage.permanentLocal = 1;	//	e.g. local store - store on local device
	rat.storage.permanentRoaming = 2;	//	store in cloud
	rat.storage.permanentServer = 3;	//	store on our game server per user
	rat.storage.suspendLocal = 4;		//	temp during suspend

	//--------------------- generic implementation - base class -----------------------------

	///
	/// BasicStorage for basic storage class
	/// @constructor 
	rat.BasicStorage = function (prefix)
	{
		this.prefix = prefix;
		this._onReady = [];	//	Functions to fire when the storage is ready
		this.defaultData = void 0;
	};

	/// Add a new on ready function
	rat.BasicStorage.prototype.onReady = function (func, ctx)
	{
		if (!func)
			return;
		if (this.hasData())
			func.call(ctx);
		else
			this._onReady.push({ func: func, ctx: ctx });
	};

	//	Fire all of the registered onReady functions
	rat.BasicStorage.prototype._fireOnReady = function ()
	{
		var list = this._onReady;
		this._onReady = [];
		var func, ctx;
		for (var index = 0; index !== list.length; ++index)
		{
			func = list[index].func;
			ctx = list[index].ctx;
			func.call(ctx);
		}
	};

	//	set prefix for all accesses
	rat.BasicStorage.prototype.setPrefix = function (prefix)
	{
		this.prefix = prefix;
	};

	//	set object by packing it up and setting a single value
	rat.BasicStorage.prototype.setObject = function (key, value)
	{
		this.setItem(key, JSON.stringify(value));	//	don't use prefix here - setItem will do that.
	};

	//	get object by unpacking value, if it's there
	rat.BasicStorage.prototype.getObject = function (key)
	{
		var thing = this.getItem(key);	//	don't use prefix here - getItem will do that
		//rat.console.log("Got storage value for " + key);
		if (thing === "{")
			return {};
		if (typeof (thing) !== "string" || thing === "")
			return thing;
		return JSON.parse(thing);
	};

	// Empty save function  Platforms which support this can implement it.
	rat.BasicStorage.prototype.save = function (func, ctx)
	{
		if (this.hasData())
		{
			if (this._internalSave)
				this._internalSave(func, ctx);
			else
			{
				if (func)
					func.call(ctx);
			}
		}
		else
		{
			this.onReady(this.save.bind(this, func, ctx), void 0);
		}
	};

	// Empty hasData function  Platforms which support this can implement it.
	rat.BasicStorage.prototype.hasData = function ()
	{
		return true;
	};

	///	set our default data - if we desire - currently unused
	rat.BasicStorage.prototype.setDefaults = function (defaults)
	{
		this.defaultData = defaults;
	};

	/// Set a value through this storage.
	rat.BasicStorage.prototype.setItem = function (key, value)
	{
		if (typeof (value) !== "string")
			value = JSON.stringify(value);

		if (key === "save")
		{
			rat.console.log("ERROR! You cannot save items to local storage with the key 'save'.  That keyword is reserved!");
			return;
		}

		if (!this.hasData())
		{
			rat.console.log("WARNING: Setting item on storage object that is not ready.  Set delayed...");
			this.onReady(this.setItem.bind(this, key, value), void 0);
			return;
		}

		this._internalSetItem(key, value);
	};

	//	Each of my subclasses should define a _internalSetItem function
	rat.BasicStorage.prototype._internalSetItem = void 0;
	//function( key, value )
	//{
	//};

	//	Each of my subclasses should define an _internalGetItem function
	rat.BasicStorage.prototype._internalGetItem = void 0;
	//function( key )
	//{
	//};

	//	Get a value out
	rat.BasicStorage.prototype.getItem = function (key)
	{
		if (!this.hasData())
		{
			rat.console.log("ERROR! Attempting to ready storage when it is not ready!");
			return void 0;
		}
		if (key === "save")
		{
			rat.console.log("ERROR! You cannot load items from local storage with the key 'save'.  That keyword is reserved!");
			return void 0;
		}
		var val = this._internalGetItem(key);
		if (val === void 0 && this.defaultData && this.defaultData[key] !== void 0)
			val = this.defaultData.key;
		return val;
	};

	//--------------------- local store implementation -----------------------------

	///
	/// Local Store
	/// @constructor 
	/// @extends rat.BasicStorage
	///
	rat.LocalStore = function (prefix)
	{
		rat.LocalStore.prototype.parentConstructor.call(this, prefix); //	default init
	};
	rat.utils.inheritClassFrom(rat.LocalStore, rat.BasicStorage);

	function getActiveUserID()
	{
		if (rat.user)
			return rat.user.getActiveUserID() || void 0;
		return void 0;
	}

	//	just map the simple calls
	// We suppress checkTypes because Wraith does take three args even if windows only takes 2
	/** @suppress {checkTypes} */
	rat.LocalStore.prototype._internalSetItem = function (key, value)
	{
		if (window.localStorage)
			window.localStorage.setItem(this.prefix + key, value, getActiveUserID());
	};
	// We suppress checkTypes because Wraith does take three args even if windows only takes 2
	/** @suppress {checkTypes} */
	rat.LocalStore.prototype._internalGetItem = function (key)
	{
		var res = null;
		if (window.localStorage)
			res = window.localStorage.getItem(this.prefix + key, getActiveUserID());
		return res;
	};
	// We suppress checkTypes because Wraith does take three args even if windows only takes 2
	/** @suppress {checkTypes} */
	rat.LocalStore.prototype.remove = function (key)
	{
		if (window.localStorage)
			window.localStorage.removeItem(this.prefix + key, getActiveUserID());
	};
	// We suppress checkTypes because Wraith does take three args even if windows only takes 2
	/** @suppress {checkTypes} */
	rat.LocalStore.prototype.hasData = function ()
	{
		if (window.localStorage && window.localStorage.hasData)
			return window.localStorage.hasData(getActiveUserID());
		return true;
	};
	// We suppress missingProperties save may exist (as it does under Wraith)
	/** @suppress {missingProperties} */
	rat.LocalStore.prototype._internalSave = function (func, ctx)
	{
		var res;
		if (window.localStorage && window.localStorage.save && typeof (window.localStorage.save) === "function")
		{
			rat.console.log("Saving storage.");
			res = window.localStorage.save(getActiveUserID());
			rat.console.log("...Done");
		}
		if (func)
			func.call(ctx);
		return res;
	};

	//--------------------- win8 implementation -----------------------------
	///@todo	move to separate module!

	///
	/// Win8SessionStorage for winjs session storage, which is useful for suspend/resume!
	/// @constructor 
	/// @extends rat.BasicStorage
	///
	rat.Win8SessionStorage = function (prefix)
	{
		rat.Win8SessionStorage.prototype.parentConstructor.call(this, prefix); //	default init
	};
	rat.utils.inheritClassFrom(rat.Win8SessionStorage, rat.BasicStorage);

	/**
	 * Wrapper around getting the session state from the WinJS.Appliation object
	 */
	rat.Win8SessionStorage.prototype.getSessionStateObj = function ()
	{
		if (window.WinJS && window.WinJS.Application)
			return window.WinJS.Application.sessionState;
		else
			return {};
	};


	/**
	* @suppress {missingProperties}
	*/
	rat.Win8SessionStorage.prototype._internalSetItem = function (key, value)
	{
		this.getSessionStateObj()[this.prefix + key] = value;
	};

	/**
	* @suppress {missingProperties}
	*/
	rat.Win8SessionStorage.prototype._internalGetItem = function (key)
	{
		return this.getSessionStateObj()[this.prefix + key];
	};
	/**
	* @suppress {missingProperties}
	*/
	rat.Win8SessionStorage.prototype.remove = function (key)
	{
		this.getSessionStateObj()[this.prefix + key] = null;
	};


	///
	/// WinJS application storage (local or cloud)
	/// @constructor
	/// @extends rat.BasicStorage
	/// @suppress {missingProperties}
	///
	rat.Win8AppStorage = function (prefix, useLocal)
	{
		rat.Win8AppStorage.prototype.parentConstructor.call(this, prefix); //	default init
		if (useLocal)
			this.settings = window.Windows.Storage.ApplicationData.current.localSettings;
		else
			this.settings = window.Windows.Storage.ApplicationData.current.roamingSettings;
	};
	rat.utils.inheritClassFrom(rat.Win8AppStorage, rat.BasicStorage);

	/**
	* @suppress {missingProperties}
	*/
	rat.Win8AppStorage.prototype._internalSetItem = function (key, value)
	{
		this.settings.values[this.prefix + key] = value;
	};
	/**
	* @suppress {missingProperties}
	*/
	rat.Win8AppStorage.prototype._internalGetItem = function (key)
	{
		return this.settings.values[this.prefix + key];
	};
	/**
	* @suppress {missingProperties}
	*/
	rat.Win8AppStorage.prototype.remove = function (key)
	{
		this.settings.values.remove(this.prefix + key);
	};

});
//
//	rat.shapes
//
//	A list of basic shape objects
//
rat.modules.add( "rat.utils.r_shapes",
[
	"rat.math.r_math",
	"rat.math.r_vector",
], 
function(rat)
{
	rat.shapes = {};

	/**
	 * Circle
	 * @constructor
	 * @param {number|Object} x center.x or def object
	 * @param {number=} y center.y 
	 * @param {number=} r radius
	 */
	rat.shapes.Circle = function (x, y, r)
	{
		//	x may also be an object which defines this circle
		var squaredRadius = 0;
		if(x.x !== void 0)
		{
			y = x.y;
			if (x.squaredRadius !== void 0)
				squaredRadius = x.squaredRadius;
			else
				squaredRadius = (x.r * x.r) || 0;
			if( x.r !== void 0 )
				r = x.r;
			else
				r = rat.math.sqrt(squaredRadius);
			x = x.x;
		}
		this.center = { x:x||0, y:y||0 };
		this.radius = r || 0;
		this.squaredRadius = squaredRadius;
	};

	/**
	 * Rect
	 * @constructor
	 * @param {number|Object=} x
	 * @param {number=} y
	 * @param {number=} w
	 * @param {number=} h
	 */
	rat.shapes.Rect = function (x, y, w, h)	//	constructor for Rect
	{
		if(x === void 0) {
			this.x = 0;
			this.y = 0;
			this.w = 0;
			this.h = 0;
		} else if(x.x !== void 0) {
			this.x = x.x;
			this.y = x.y;
			this.w = x.w;
			this.h = x.h;
		} else {
			this.x = x;
			this.y = y;
			this.w = w;
			this.h = h;
		}
	};

	rat.shapes.Rect.prototype.copy = function ()
	{
		var newRect = new rat.shapes.Rect();
		newRect.x = this.x;
		newRect.y = this.y;
		newRect.w = this.w;
		newRect.h = this.h;
		return newRect;
	};
	
	//	expand this rect (position and w,h) to include all of another rect
	rat.shapes.Rect.prototype.expandToInclude = function (r)
	{
		if(r.x < this.x)
			this.x = r.x;
		if(r.y < this.y)
			this.y = r.y;
		if(r.x + r.w > this.x + this.w)
			this.w = r.x + r.w - this.x;
		if(r.y + r.h > this.y + this.h)
			this.h = r.y + r.h - this.y;
	};

	//	Get the center
	rat.shapes.Rect.prototype.getCenter = function (dest)
	{
		dest = dest || new rat.Vector();
		dest.x = this.x + (this.w / 2);
		dest.y = this.y + (this.h / 2);
		return dest;
	};

	//	Calc (and add to this object) my right and bottom values
	rat.shapes.Rect.prototype.calcEdges = function ()
	{
		this.l = this.x;
		this.t = this.y;
		this.r = this.x + this.w;
		this.b = this.y + this.h;
		return this;
	};
	
} );

/*
Generic voice commands support 
*/
rat.modules.add( "rat.input.r_voice",
[
	{name: "rat.os.r_system", processBefore: true},
	
	{name: "rat.input.r_voice_xbo", platform: "xbox"} // platform specific versions run AFTER me
], 
function(rat)
{
	// move this to a platform independent file if/when we generalize this
	rat.voice = {
		commands: {
			Play: "play",				//	The play button. 
			Pause: "pause",				//	The pause button. 
			Stop: "stop",				//	The stop button. 
			Record: "record",			//	The record button. 
			FastForward: "fastForward",	//	The fast forward button. 
			Rewind: "rewind",			//	The rewind button. 
			Next: "next",				//	The next button. 
			Previous: "previous",		//	The previous button. 
			ChannelUp: "channelUp",		//	The channel up button. 
			ChannelDown: "channelDown",	//  The channel down button. 
			Back: "back",				//	The back button. 
			View:  "view",				//	The view button. 
			Menu: "menu",				//	The menu button. 
		},
		
		callbacks: {},	//	Array for each command

		enabled: {}
	};
	
	var firingCB = void 0;
	
	//	Register a callback from a command
	rat.voice.registerCB = function( command, func, ctx )
	{
		var callbacks = rat.voice.callbacks[command];
		if( !callbacks )
			return;
		callbacks.push( {func: func, ctx: ctx} );
	};
	
	//	Unregister a callback from the command
	rat.voice.unregisterCB = function( command, func, ctx )
	{
		var callbacks = rat.voice.callbacks[command];
		if( !callbacks )
			return;
		var cb;
		for( var index = 0; index !== callbacks.length; ++index )
		{
			cb = callbacks[index];
			if( cb.func === func && cb.ctx === ctx )
			{
				if( firingCB && firingCB.index >= index )
					--firingCB.index;
				callbacks.splice( index, 1 );
				return;
			}
		}
	};
	
	//	Fire callbacks for a command
	rat.voice.fireCB = function( command, sys )
	{
		var callbacks = rat.voice.callbacks[command];
		if( !callbacks )
			return;
		var saved = firingCB;
		firingCB = {
			index: 0
		};
		var handled = false;
		var func, ctx;
		for( firingCB.index = 0; firingCB.index !== callbacks.length; ++firingCB.index )
		{
			func = callbacks[firingCB.index].func;
			ctx = callbacks[firingCB.index].ctx;
			handled = func.call(ctx, command);
			if (handled)
				break;
		}
		
		firingCB = saved;
		if (!handled && rat.input)
		{
			var ratEvent = new rat.input.Event(sys, { type: 'voice', defaultControllerID: 'voice', which:command });
			rat.input.dispatchEvent(ratEvent);
		}
		return handled;
	};
	
	rat.voice.enableCommand = function (command, isEnabled)
	{
		if( isEnabled === void 0 )
			isEnabled = true;
		else
			isEnabled = !!isEnabled;
		rat.voice.enabled[command] = isEnabled;
		if( rat.voice._internalEnabledCommand )
			rat.voice._internalEnabledCommand( command, isEnabled );
	};

	//	Disable all callbacks
	rat.voice.resetCommands = function()
	{
		//	Add the array to callbacks for each command
		for( var cmd in rat.voice.commands )
		{
			rat.voice.callbacks[rat.voice.commands[cmd]] = [];
			rat.voice.enableCommand(rat.voice.commands[cmd], false);
		}
	};

} );
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
//
//	A system for broadcasting messages to registered listeners
//
rat.modules.add( "rat.utils.r_messenger",
[], 
function(rat)
{
	/**
	 * @constructor
	 */
	rat.Messenger = function ()
	{
		this.handlers = [];
	};

	// Returned by listeners to tell the system to remove them.
	rat.Messenger.remove = "REMOVE"; 

	rat.Messenger.prototype.broadcast = function (name)
	{
		var handlers = this.handlers[name];
		if(handlers)
		{
			var funcsToRemove = [];
			var index;

			Array.prototype.splice.call(arguments, 0, 1);
			for(index in handlers)
			{
				if(handlers.hasOwnProperty(index))
				{
					//We do not work with contexts in this system,
					// using null in apply will provide the global object
					// in place of 'this'
					//handlers[index].apply(null, arguments);
					// However, this does mean that if i have use a bind to provide the handler, then it gets lost.
					// Instead, store the func in  var, and call it
					var func = handlers[index];
					//func();
					var res = func.apply(this, arguments);
					if (res === rat.Messenger.remove)
						funcsToRemove.push(func);
				}
			}
			for (index = 0; index !== funcsToRemove.length; ++index)
				this.stopListening(name, funcsToRemove[index]);
		}
	};

	rat.Messenger.prototype.listen = function (name, callback) {
		if (typeof callback === 'function') {
			this.handlers[name] = this.handlers[name] || [];
			var index = this.handlers[name].indexOf(callback);
			if (index === -1) {
				this.handlers[name].push(callback);
			}
		}
	};

	rat.Messenger.prototype.stopListening = function (name, callback) {
		if (typeof callback === 'function') {
			var index = this.handlers[name].indexOf(callback);
			if(index !== -1)
				this.handlers[name].splice(index, 1);
		}
	};

} );
/*

	rat.Offscreen
	
	This is an offscreen buffer (canvas) that you can draw to once (or at least less frequently)
	and then render into a normal scene.
	
	This is useful for performance optimization, among other things.
	
	Simple Use Case 1:
		* create an Offscreen
		* draw to it once
		* render to your scene each frame after that
		
		var off = new rat.Offscreen(200, 200);
		var ctx = off.getContext();
		ctx.fillStyle = "#FF0000";
		ctx.fillRect(0, 0, 200, 200);
		...
		off.render(mainCTX);
		
	Use Case 2:
		* create an Offscreen
		* redraw it only when its content changes
		* render to your scene each frame
		
	Use Case 3:
		* create an Offscreen
		* use the dirty rectangle feature to limit drawing to parts that need redrawing
		* render to your scene each frame

Implementation Notes:

The basic idea:

* create this thing (an offscreen buffer (canvas))
* do a bunch of drawing to it
*   ... only once, if that's an option!  (e.g. a static scene)
*   ... or only when things change
*   	... and only the part that changes
* and then draw it into the main canvas every frame

objective:  faster rendering most of the time, on screens where most things aren't changing.

useful for the main display, but also for things like individual UI screens or panels or parts of a display.
so, we expect several of these to exist, but also probably a rat.graphics.mainOffscreen, or something.

Features:

Dirty Rectangles
* provide an API to say when a rectangular piece of the image has changed
* track all these rectangles
* coalesce them when two overlap or one includes another, etc.
* provide an API to check against this set of rectangles, so we know if something needs to be drawn.
* do this in a separate module.  A general rectlist handling module or something, that's good at dirty rects,
	but also for whatever reason, general management of a list of rects

Rat UI integration
* given dirty rectangle info (as described above), only redraw the UI elements that changed
* ... will require the coders/designers to get serious about ui element sizes, wherever they want to use this feature effectively
* won't quite allow automatic optimization of UI screens, since we'll still need to know what is *changing*
* ... but that could be a future feature: track changes within rat.ui elements, for fully automated ui screen optimizations

Background Image Handling
* support identifying an image or set of images as "background" images
* only draw the part of the image that intersects with dirty rect (doing sub-image drawing)

Scrolling Support
* support a bigger offscreen area than eventually used, so we can have a moving camera without rebuilding the whole image every frame
* ... (until they get outside that bigger area, at which point we'll have to bump things over and draw the newly revealed part)

*/
rat.modules.add( "rat.graphics.r_offscreen",
[
	{name: "rat.graphics.r_graphics", processBefore: true },
	
	"rat.debug.r_console",
	"rat.os.r_system",
	"rat.graphics.r_rectlist",
], 
function(rat)
{
	///
	/// Offscreen Object
	/// @constructor
	///
	rat.Offscreen = function (width, height)
	{
		this.canvas = document.createElement("canvas");
		this.canvas.width = this.width = width;
		this.canvas.height = this.height = height;
		this.ctx = this.canvas.getContext("2d");
		
		this.dirtyRects = new rat.RectList();
		this.dirtyRects.snapEven = true;
		
		if (rat.ui && !rat.ui.allowOffscreens)	//	double-check with rat ui global disable flag
		{
			rat.console.log("WARNING!  You're trying to use an OffscreenImage() object, but offscreens are not allowed by this host!");
		}
	};
	//rat.Offscreen.prototype.blah = true;	//	whatever

	//	STATIC vars
	rat.Offscreen.allowOffscreens = !rat.system.has.Wraith;
	
	rat.Offscreen.prototype.setSize = function (w, h, force)
	{
		if (!force && this.width === w && this.height === h)
			return;	//	don't resize (which also erases) if we're already the right size.
		
		this.canvas.width = this.width = w;
		this.canvas.height = this.height = h;
	};
	
	//	return context for drawing to
	rat.Offscreen.prototype.getContext = function ()
	{
		return this.ctx;
	};
	//	return canvas object.  Useful if you're doing your own drawImage call, for example.
	rat.Offscreen.prototype.getCanvas = function ()
	{
		return this.canvas;
	};
	
	//	render this canvas to another context
	rat.Offscreen.prototype.render = function (targetContext, x, y, drawWidth, drawHeight)
	{
		if (!targetContext)
			targetContext = rat.graphics.getContext();
		if (!x)
			x = 0;
		if (!y)
			y = 0;
		if (!drawWidth)
			drawWidth = this.canvas.width;
		if (!drawHeight)
			drawHeight = this.canvas.height;

		targetContext.drawImage(this.canvas, x, y, drawWidth, drawHeight);
	};
	
	//	erase any space hit by dirty rects.
	//	An alternative is to set clipping and use erase() below, but see notes there.
	rat.Offscreen.prototype.eraseDirty = function()
	{
		this.dirtyRects.eraseList(this.ctx);
	};
	
	//	Erase the whole offscreen.  Again, unusual, but useful for testing.
	//	If you're using clipToDirty() below, this is not a bad approach.
	//
	//	IMPORTANT NOTE!
	//	On IE10, and therefore Windows 8.0,
	//	This erase call fails with a clip region more complex than a single rect.
	//	https://connect.microsoft.com/IE/feedback/details/782736/canvas-clearrect-fails-with-non-rectangular-yet-simple-clipping-paths
	//	So, don't use this in windows 8 or IE 10 with a complex clip region.
	//	(which is the whole point of dirty rect lists, so it's likely you'll have trouble)
	rat.Offscreen.prototype.erase = function()
	{
		if (rat.system.has.IEVersion === 10 && !rat.Offscreen.warnedAboutIE10)
		{
			rat.console.log("!! Warning:  This clearRect() call will fail in IE10 if you're using fancy clipping.");
			rat.Offscreen.warnedAboutIE10 = true;
		}
		
		this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
	};

	//	So, to hide those problems, let's give a single function that tries to do the right thing.
	//	Note that this will start a save() call either way, so you definitely need to unclip() later.
	rat.Offscreen.prototype.clipAndEraseDirty = function ()
	{
		if (rat.system.has.IEVersion === 10) {
			this.eraseDirty();
			this.clipToDirty();
		} else {
			this.clipToDirty();
			this.erase();
		}
	};
	
	//	set offscreen clip region to the total dirty space.
	rat.Offscreen.prototype.clipToDirty = function()
	{
		this.dirtyRects.clipToList(this.ctx);
	};
	rat.Offscreen.prototype.unclip = function()
	{
		this.dirtyRects.unclip(this.ctx);
	};
	
	rat.Offscreen.prototype.dirtyToPath = function(ctx, list)
	{
		if (!ctx)
			ctx = this.ctx;
		if (!list)
			list = this.dirtyRects.list;
		this.dirtyRects.listToPath(ctx, list);
	};
	
	//	for debugging purposes, draw an overlay effect to clearly indicate what is an offscreen buffer.
	//	pick cycling color/effect, so we can see when it changes.
	//	This is normally done right after the offscreen is rendered or updated.
	//
	rat.Offscreen.debugColors = [rat.graphics.orange, rat.graphics.darkGreen, rat.graphics.cyan, rat.graphics.blue, rat.graphics.violet];
	rat.Offscreen.prototype.applyDebugOverlay = function()
	{
		var ctx;
		//	make debug pattern if we don't have it already
		if (!rat.Offscreen.checkerImages)
		{
			rat.Offscreen.checkerImages = [];
			var colors = rat.Offscreen.debugColors;
			for (var i = 0; i < colors.length; i++)
			{
				var color = colors[i];
				var square = 16;
			
				rat.Offscreen.checkerImages[i] = document.createElement("canvas");
				rat.Offscreen.checkerImages[i].width = 2 * square;
				rat.Offscreen.checkerImages[i].height = 2 * square;
				ctx = rat.Offscreen.checkerImages[i].getContext("2d");
				ctx.fillStyle = "#FFFFFF";
				ctx.fillRect(0, 0, 2 * square, 2 * square);
				ctx.fillStyle = color.toString();//"#000000";
				ctx.fillRect(0, 0, square, square);
				ctx.fillRect(square, square, square, square);
			}
		}
		
		if (!this.debugOffscreenCycle)
			this.debugOffscreenCycle = 0;
		var cycleLength = rat.Offscreen.debugColors.length;
		ctx = this.ctx;
		//if (!this.pat)
			this.pat = ctx.createPattern(rat.Offscreen.checkerImages[this.debugOffscreenCycle], "repeat");
		
		var oldAlpha = ctx.globalAlpha;
		ctx.globalAlpha = 0.3;
		
		//ctx.fillStyle = color.toString();
		
		ctx.fillStyle = this.pat;
		
		ctx.fillRect(0, 0, this.width, this.height);
		
		this.debugOffscreenCycle = (this.debugOffscreenCycle+1) % cycleLength;
		ctx.globalAlpha = oldAlpha;
	};
		
	
} );


//----------------------------
//	Animators for ui elements
//	(can be used to animate other stuff, too, as long as function names match up)
//
//	Usage:
//		* create one of these, attaching to a UI element.
//			the animator will get put in a global animators list that's updated every frame.
//
//		* for timed animation from a to b, use setTimer and setStartEnd
//		* for continuous increasing/decreasing animation, use setSpeed instead.
//
rat.modules.add( "rat.ui.r_ui_animator",
[
	{ name: "rat.ui.r_ui", processBefore: true },
	
	"rat.debug.r_console",
	"rat.math.r_vector",
	"rat.utils.r_utils",
], 
function(rat)
{
	rat.ui.animators = [];

	/**
	 * @constructor
	*/
	rat.ui.Animator = function (type, targetElement, id, relative)
	{
		if (typeof (id) === "boolean" && arguments.length === 3) {
			relative = id;
			id = void 0;
		}
		this.id = id; // Possible custom ID
		this.type = type;
		this.relative = !!relative;
		this.target = targetElement;
		this.startValue = new rat.Vector(0, 0); //	initial value for animation, e.g. move, scale
		this.endValue = new rat.Vector(0, 0); //	destination for animation, e.g. move, scale

		this.startTime = -1;
		this.time = -1;
		this.delay = 0;
		//this.interp = 0;
		//	default to ease in/out, since usually that's what we'll want, I proclaim.
		//	if this is not desired, call clearInterpFilter.
		this.interpFilter = rat.ui.Animator.filterEaseInOut;

		this.flags = 0;
		this.setAutoDie(true);				//	this is almost always desired - go away when you're done animating.

		this.speed = 1; 					//	units per second - used when there's no timer (continuous)

		this.continuousVal = 0;				//	Continuous animation value.  Used to make repeating back-and-forth/in-out effect.
		this.continuousSign = 1;			//	Continuous animation "direction". Used to make repeating back-and-forth/in-out effect.
		
		this.delayCallback = null;
		this.doneCallback = null;

		if (!this.target)
		{
			rat.console.log("No target input for animator! Bad juju! Not adding it to the animator list");
			return;
		}

		this.targetStartState = {
			x: this.target.place.pos.x,
			y: this.target.place.pos.y,
			cx: this.target.contentOffset.x,
			cy: this.target.contentOffset.y,
			sx: this.target.scale.x,
			sy: this.target.scale.y,
			w: this.target.size.x,
			h: this.target.size.y,
			r: this.target.place.rot.angle,
			opacity: this.target.opacity
		};

		rat.ui.animators.push(this);
		//console.log("animator");
	};

	//	some constants for animators.
	//	animation types:
	rat.ui.Animator.mover = 1; //	move (use element place.pos)
	rat.ui.Animator.rotator = 2; //	rotate (use element place.rot)
	rat.ui.Animator.rotater = rat.ui.Animator.rotator;	//	alternate (more consistent) name
	rat.ui.Animator.scaler = 3; //	scale (use element scale)
	rat.ui.Animator.resizer = 4; //	resize (use element size)
	rat.ui.Animator.fader = 5; //	fade (use opacity)
	rat.ui.Animator.scroller = 6; //	scroll  (use element contentoffset)
	//	todo: support rotate from center, or a new centerRotator?  or is that what centering code above was supposed to support? *sigh*
	//	todo: it'd be cool to have an animator that applies a rat ui flag (remembering the old flag setting) for a set time.  E.g. fake pressed for 1 second.

	rat.ui.Animator.autoDieFlag = 0x01; //	kill this animator as soon as its timer runs out
	rat.ui.Animator.autoRemoveTargetFlag = 0x02; //	when this animator is done, remove target from parent

	//	animator functions
	rat.ui.Animator.prototype.setAutoDie = function (sense)
	{
		if (sense || sense === void 0)
			this.flags |= rat.ui.Animator.autoDieFlag;
		else
			this.flags &= ~rat.ui.Animator.autoDieFlag;
	};

	rat.ui.Animator.prototype.setAutoRemoveTarget = function (sense)
	{
		if (sense || sense === void 0)
			this.flags |= rat.ui.Animator.autoRemoveTargetFlag;
		else
			this.flags &= ~rat.ui.Animator.autoRemoveTargetFlag;
	};

	rat.ui.Animator.prototype.setDoneCallback = function (f)	//	call after done
	{
		this.doneCallback = f;
	};

	rat.ui.Animator.prototype.setDelayDoneCallback = function (f)	//	call after delay
	{
		this.delayCallback = f;
	};

	rat.ui.Animator.prototype.setTimer = function (time)
	{
		this.startTime = time;
		this.time = time;
	};

	rat.ui.Animator.prototype.setDelay = function (time)
	{
		this.delay = time;
	};

	rat.ui.Animator.prototype.setSpeed = function (speed)
	{
		this.speed = speed;
	};

	//	set start and end interpolation values in scalar form, for things like fade
	rat.ui.Animator.prototype.setStartEnd = function (startVal, endVal)
	{
		this.startValue.x = startVal;
		this.startValue.y = startVal;	//	copy to y as well, useful for things like uniform scale
		this.endValue.x = endVal;
		this.endValue.y = endVal;

		this.update(0);	//	start out at the start value now
	};

	//	set start and end interpolation values in vector form (for things like move)
	rat.ui.Animator.prototype.setStartEndVectors = function (startVal, endVal)
	{
		//	make this a little easier to call - if no startval is specified, try to figure out current value,
		//	and use that as start value.
		if (!startVal)
		{
			var curVal = this.getCurrentValueForType();
			this.startValue.x = curVal.x;
			this.startValue.y = curVal.y;
		} else {
			this.startValue.x = startVal.x;
			this.startValue.y = startVal.y;
		}
		this.endValue.x = endVal.x;
		this.endValue.y = endVal.y;

		this.update(0);	//	start out at the start value now
	};
	
	//
	//	Filter functions.
	//
	//	You can think of these as speed modifiers.
	//	"ease in", for instance, means start out at a speed of 0, and ease in to full speed.
	//	Each filter function takes input from 0-1 and returns output from 0-1,
	//	so they're easy to mix in to existing logic.
	//	There's nothing specific to the rat.ui.Animator module about these functions, just
	//	that they're convenient here.  You can use them in other modules,
	//	or move them some day to another place.
	//	Todo: Another module would be a good idea.
	
	//	For similar stuff, see:
	//	http://robertpenner.com/easing/
	//	http://easings.net/
	//	https://github.com/danro/jquery-easing/blob/master/jquery.easing.js
	//	http://gizma.com/easing/
	//	these robert penner functions take:
	//	cur interp, start value, change in value, total interp.
	//	or... 
	//	t = f
	//	b = 0
	//	c = 1
	//	d = 1
	//	So, you can take any penner function, plug in those values, and simplify.
	
	//	Don't change
	rat.ui.Animator.filterNone = function (f) {
		return 0;
	};

	//	Linear
	rat.ui.Animator.filterLinear = function (f) {
		return f;
	};

	//	Ease in and ease out.
	rat.ui.Animator.filterEaseInOut = function (f)
	{
		//return 3 * (f * f) - 2 * (f * f * f);
		return (f * f) * (3 - 2 * f);
	};
	//s(x) = sin(x*PI/2)^2 is slightly smoother?
	//s(x) = x - sin(x*2*PI) / (2*PI) is noticeably smoother?
	//see also http://gizma.com/easing/

	//	ease in, but then full speed to end
	rat.ui.Animator.filterEaseIn = function (f)
	{
		return (f * f);
	};
	
	//	full speed at start, then ease out speed at end.
	rat.ui.Animator.filterEaseOut = function (f)
	{
		return f * (2 - f);
	};
	
	//	ease in, ease out at destination halfway through time, and then ease back to start!
	//	this is nice for things like briefly scaling an object up and down with just one scaler animator.
	rat.ui.Animator.filterEaseThereAndBack = function (f)
	{
		if (f < 0.5)
			return rat.ui.Animator.filterEaseInOut(f*2);
		else
			return 1 - rat.ui.Animator.filterEaseInOut((f-0.5)*2);
	};
	
	//	these would be nice.  :)
	rat.ui.Animator.filterEaseInElastic = function (f)
	{
		return f;
	},
	
	rat.ui.Animator.filterEaseOutElastic = function(f)
	{
		if (f <= 0)
			return 0;
		if (f >= 1)
			return 1;
		
		//	how many times we bounce, basically. (how much we cut down on sin() frequency below)
		//	0.5 = very few bounces, 0.2 = lots of bounces.  0.3 was original.
		var p = 0.4;	//	0.3
		
		var s = p/(2*Math.PI) * 1.5707;//Math.asin (1);
		return Math.pow(2,-10*f) * Math.sin( (f-s)*(2*Math.PI)/p ) + 1;
	},
	
	rat.ui.Animator.prototype.setInterpFilter = function(filterFunc)
	{
		this.interpFilter = filterFunc;
	};
	rat.ui.Animator.prototype.clearInterpFilter = function()
	{
		this.setInterpFilter(null);
	};
	
	//	Update this animator
	rat.ui.Animator.prototype.update = function (dt)
	{
		if (!this.target)
			return false;

		if (this.delay > 0)
		{
			this.delay -= dt;
			if (this.delay > 0)
				return false;
			///@todo	subtract leftover from timer as well? (for accuracy)
			
			if (this.delayCallback)
				this.delayCallback(this);
		}

		var done = false;

		var interp = null;

		//	first figure out how much to change animation value, based on timer and timer type
		if (this.time < 0)	//	continuous mode
		{
			if (this.type === rat.ui.Animator.rotator)
				// For rotations, just do a continuous rotation, using this.speed as radians per second
				this.target.place.rot.angle += this.speed * dt;
			else
			{
				// For other types, calculate an interpolation value, and let the code below handle the rest.
				// Set up a "back-and-forth" type animation from 0 to 1 and back.
				// this.continuousVal is the current value in the 0 to 1 range.
				// this.continuousSign controls whether it's increasing or decreasing.
				this.continuousVal += this.continuousSign * this.speed * dt;
				if (this.continuousVal > 1)
				{
					this.continuousVal = 1;
					this.continuousSign = -this.continuousSign;
				}
				else if (this.continuousVal < 0)
				{
					this.continuousVal = 0;
					this.continuousSign = -this.continuousSign;
				}

				interp = this.continuousVal;
			}

		} else
		{	//	timer mode
			this.time -= dt;
			if (this.time < 0)
			{
				this.time = 0;
				done = true;
			}

			// Calculate interpolation value
			if (this.startTime <= 0)	//	somehow we were asked to take 0 seconds to animate...
				interp = 1;
			else
				interp = 1 - (this.time / this.startTime);

		}

		// Use interpolation value to set appropriate target values.
		if (interp !== null)
		{
			if (this.interpFilter !== void 0)
				interp = this.interpFilter(interp);
			var xVal = rat.utils.interpolate(this.startValue.x, this.endValue.x, interp);
			var yVal = rat.utils.interpolate(this.startValue.y, this.endValue.y, interp);

			//	then set target element's values based on animator type
			if (this.type === rat.ui.Animator.mover)
			{
				if (this.relative) {
					xVal += this.targetStartState.x;
					yVal += this.targetStartState.y;
				}

				this.target.place.pos.x = xVal;
				this.target.place.pos.y = yVal;
				
				//	this changes look of parent.  see element setScale
				if (this.target.parent)
					this.target.parent.setDirty(true);
			}
			else if (this.type === rat.ui.Animator.rotator)
			{
				if (this.relative)
					xVal += this.targetStartState.r;

				this.target.place.rot.angle = xVal;
				//	this changes look of parent.  see element setScale
				if (this.target.parent)
					this.target.parent.setDirty(true);
			}
			else if (this.type === rat.ui.Animator.scaler)
			{
				if (this.relative) {
					xVal += this.targetStartState.sx;
					yVal += this.targetStartState.sy;
				}
				this.target.setScale(xVal, yVal);
			}
			else if (this.type === rat.ui.Animator.resizer)
			{
				if (this.relative) {
					xVal += this.targetStartState.w;
					yVal += this.targetStartState.h;
				}
				this.target.setSize(xVal, yVal);
			}
			else if (this.type === rat.ui.Animator.fader)
			{
				if (this.relative)
					xVal += this.targetStartState.opacity;
				this.target.setOpacityRecursive(xVal);
			}
			else if (this.type === rat.ui.Animator.scroller)
			{
				if (this.relative) {
					xVal += this.targetStartState.cx;
					yVal += this.targetStartState.cy;
				}
				this.target.contentOffset.x = xVal;
				this.target.contentOffset.y = yVal;
				//	clamp?  Let's assume they know what they're doing...
				//	set dirty?  see element scroll function
			}
		}

		if (done && this.doneCallback)
		{
			//	warning - if you have a doneCallback and you don't autodie this animator, it'll get called over and over?
			var self = this;
			this.doneCallback(this.target, self);
		}

		if (done && (this.flags & rat.ui.Animator.autoRemoveTargetFlag))
		{
			this.target.removeFromParent();
		}

		if (done && (this.flags & rat.ui.Animator.autoDieFlag))
		{
			return true;
		}

		return false;
	};
	
	//	utility: given our type, get whatever our target's current value is.
	rat.ui.Animator.prototype.getCurrentValueForType = function()
	{
		if (this.type === rat.ui.Animator.mover)
			return this.target.place.pos;
		else if (this.type === rat.ui.Animator.rotator)
			return this.target.place.rot.angle;
		else if (this.type === rat.ui.Animator.scaler)
			return this.target.scale;
		else if (this.type === rat.ui.Animator.resizer)
			return this.target.size;
		else if (this.type === rat.ui.Animator.fader)
			return this.target.opacity;
		else if (this.type === rat.ui.Animator.scroller)
			return this.target.contentOffset;
		else
			return null;
	};

	rat.ui.Animator.prototype.die = function (dt)
	{
		this.target = null;	// remove target so I die next update
	};

	rat.ui.Animator.prototype.getElapsed = function (dt)
	{
		return this.startTime - this.time;
	};
	
	//	Finish an animation
	rat.ui.Animator.prototype.finish = function () {
		if (this.time < 0) {
			//rat.console.log("WARNING! Attempting to finish endless animator");
			return;	
		}
		else
		{
			this.delay = 0;
			this.update(this.time + 0.0001);
		}
	};

	//	Reset the targets properties to what they were BEFORE this changed them
	rat.ui.Animator.prototype.resetTargetState = function () {
		//	Only reset the things i change
		var startState = this.targetStartState;
		switch (this.type) {
			case rat.ui.Animator.mover:
				this.target.setPos(startState.x, startState.y);
				break;
			case rat.ui.Animator.rotator:
				this.target.setRotation(startState.r);
				break;
			case rat.ui.Animator.scaler:
				this.target.setScale(startState.sx, startState.sy);
				break;
			case rat.ui.Animator.resizer:
				this.target.setSize(startState.w, startState.h);
				break;
			case rat.ui.Animator.fader:
				this.target.setOpacity(startState.opacity);
				break;
			case rat.ui.Animator.scroller:
				this.target.setContentOffset(startState.cx, startState.cy);
				break;
		}
	};
	
	var updatingAnimators = 0;
	rat.ui.updateAnimators = function (dt)
	{
		++updatingAnimators;
		for (var i = rat.ui.animators.length - 1; i >= 0; i--)
		{
			var kill = rat.ui.animators[i].update(dt);
			if (kill)
			{
				//rat.console.log("killed");
				rat.ui.animators.splice(i, 1);
			}
		}
		--updatingAnimators;
	};

	//	Reset Start state for all running animators on an element
	rat.ui.resetStateStateForAllAnimatorsForElement = function (element, animatorType) {
		//	todo refactor with function below
		for (var i = rat.ui.animators.length - 1; i >= 0; i--) {
			var anim = rat.ui.animators[i];
			if (!anim.target) {
				rat.console.log("JS FAILURE: animator is missing target! check that on construction all objects have a target!\n");
				rat.ui.animators.splice(i, 1);			// there is no target and thus should be no animator, purge it with fire!
				continue;
			}

			//	we check for equality by comparing objects here, instead of ID, since duplicate IDs might exist.
			//	If this is a problem, I recommend we have a new uniqueID property for each ui element, and compare that.  I think I've wanted that before for other things anyway...
			if (anim.target === element && (animatorType === void 0 || anim.type === animatorType)) {
				anim.resetTargetState();
			}
		}
	};

	//	Finish all running animators on an element
	rat.ui.finishAnimatorsForElement = function (element, animatorType, kill) {
		//	todo refactor with function below
		for (var i = rat.ui.animators.length - 1; i >= 0; i--) {
			var anim = rat.ui.animators[i];
			if (!anim.target) {
				rat.console.log("JS FAILURE: animator is missing target! check that on construction all objects have a target!\n");
				rat.ui.animators.splice(i, 1);			// there is no target and thus should be no animator, purge it with fire!
				continue;
			}

			//	we check for equality by comparing objects here, instead of ID, since duplicate IDs might exist.
			//	If this is a problem, I recommend we have a new uniqueID property for each ui element, and compare that.  I think I've wanted that before for other things anyway...
			if ( anim.target === element && (animatorType === void 0 || anim.type === animatorType) ) {
				anim.finish();

				if( kill && !updatingAnimators )
					rat.ui.animators.splice(i, 1);
			}
		}
	};

	//	kill any animators (with optional animator type check) attached to this element
	//	return number killed.
	rat.ui.killAnimatorsForElement = function (element, animatorType)
	{
		var killCount = 0;
		
		//	todo refactor with function below
		for (var i = rat.ui.animators.length - 1; i >= 0; i--)
		{
			var anim = rat.ui.animators[i];
			if (!anim.target)
			{
				// this really needs to be an assert
				rat.console.log("JS FAILURE: animator is missing target! check that on construction all objects have a target!\n");
				rat.ui.animators.splice(i, 1);			// there is no target and thus should be no animator, purge it with fire!
				continue;
			}

			//	we check for equality by comparing objects here, instead of ID, since duplicate IDs might exist.
			//	If this is a problem, I recommend we have a new uniqueID property for each ui element, and compare that.  I think I've wanted that before for other things anyway...
			if (
				anim.target === element &&
					(animatorType === void 0 || anim.type === animatorType)
			)
			{
				//rat.console.log("killed for " + element.id);
				rat.ui.animators.splice(i, 1);
				killCount++;
			}
		}
		
		return killCount;
	};
	
	//	get a list of animators for this element, possibly filtered to an ID
	rat.ui.getAnimatorsForElement = function (element, animatorType, id)
	{
		var list = [];
		for (var i = rat.ui.animators.length - 1; i >= 0; i--)
		{
			var anim = rat.ui.animators[i];
			if (anim.target === element
				&& (animatorType === void 0 || anim.type === animatorType)
				&& (id === void 0 || anim.id === id))
			{
				list.push(anim);
			}
		}
		return list;
	};

	//
	//	kill any registered animators
	//	(useful for cleanly getting rid of continuous ones...)
	rat.ui.killAnimators = function ()
	{
		//console.log("killing animators.  There are " + rat.ui.animators.length);
		rat.ui.animators = [];
	};

	//	lots to do...
	/*

	add to log.txt

	finish bubble box
	bubble bar support inside bubble box
	bubble button!
	various button details (highlights, etc.)

	ooh... cheats!  we should have a cheat dialog system somehow...
	frames for debugging
	more element subclasses
	sprite
	make them work
	sizes/centering for all
	shape graphic - work for circles, squares, paths

	add panes, UI, see notes on paper
	design better on paper - highlights - how do they work?  active, target, etc., like wraith?
	buttons, with frames, that highlight.
	bubble boxes
	buttons
	bubble buttons

	eventually, support tinting by drawing element to offscreen canvas with fancy canvas operations?
	It'll be slow, but for UI maybe it's OK.
	Won't work well for particles, because of speed concerns.  :(

	add more animator support, clean up and fix


	*/

	//
	//--------- utils
	//
} );
//
//	Rat 2D Collision math library
// Requires rat.Shapes
//

//------------ rat.collision.2D ----------------
rat.modules.add( "rat.utils.r_collision2d",
[
	"rat.graphics.r_graphics",
	"rat.debug.r_console",
	"rat.math.r_math",
	"rat.utils.r_shapes",
], 
function(rat)
{
	/** Collision module */
	rat.collision2D = {};
	
	/**
	 * Test if a point is in a rectangle
	 * @param {Object} v The vector {x, y}
	 * @param {Object} r The rect {x, y, w, h}
	 * @return {boolean} True if the point is in the rect
	 */
	rat.collision2D.pointInRect = function(/*rat.Vector*/ v, /*rat.shapes.Rect*/ r)
	{
		return !(v.x < r.x || v.y < r.y || v.x > r.x + r.w || v.y > r.y + r.h);
	};
	
	/**
	 * modify this point to keep it in a rectangle space.
	 * Like rat.Vector.prototype.limitToRect, but without a real point or rect object needed
	 */
	rat.collision2D.limitPointToSpace = function (point, x, y, w, h)
	{
		if (point.x < x)
			point.x = x;
		if (point.y < y)
			point.y = y;
		if (point.x > x + w)
			point.x = x + w;
		if (point.y > y + h)
			point.y = y + h;
	};

	/**
	 * Test if two rects collide
	 * @param {Object} r1 a rat rectable object {x,y,w,h}
	 * @param {Object} r2 a rat rectable object {x,y,w,h}
	 * @return {boolean} True if the rects collide
	 */
	rat.collision2D.rectOverlapsRect = function(/*rat.shapes.Rect*/ r1, /*rat.shapes.Rect*/ r2)
	{
		//	It's easier to think of this as "when do two rects not overlap?"  answer:  when one rect is entirely above, left, below, right.
		return !(r1.y + r1.h < r2.y	||	//	r1 is above
				 r1.y > r2.y + r2.h	||	//	r1 is below
				 r1.x + r1.w < r2.x	||	//	r1 is left
				 r1.x > r2.x + r2.w	);	//	r1 is right
	};

	
	/**
	 * Test if two circles collide.  This support offsetting the circles
	 */
	rat.collision2D.circlesCollide_Offset = function (c1, at1, c2, at2)
	{
		if (!c1 || !c2)
			return void 0; // False-ish

		//	Combined radius
		var radii = c1.radius + c2.radius;

		//	distance between the two centers
		var deltaX = (c2.center.x + at2.x) - (c1.center.x + at1.x);
		var deltaY = (c2.center.y + at2.y) - (c1.center.y + at1.y);
		var dist = rat.math.sqrt((deltaX * deltaX) + (deltaY * deltaY));

		//	The collide if the distance is <= the combine radii
		if (dist > radii)
			return void 0; // again, false-ish
		else
			return { dist: dist, radii: radii };
	};

	/**
	 * Test if two circles collide
	 */
	rat.collision2D.circlesCollide = function( c1, c2 )
	{
		if( !c1 || !c2 )
			return void 0; // False-ish
		
		//	Combined radius
		var radii = c1.radius + c2.radius;

		//	distance between the two centers
		var deltaX = (c2.center.x - c1.center.x);
		var deltaY = (c2.center.y - c1.center.y);
		var dist = rat.math.sqrt( (deltaX * deltaX) + (deltaY * deltaY) );

		//	The collide if the distance is <= the combine radii
		if( dist > radii )
			return void 0; // again, false-ish
		else
			return {dist:dist, radii:radii};
	};

	/**
	 * Test if two rects collide.  Supports offset.
	 */
	rat.collision2D.rectsCollide_Offset = function (r1, at1, r2, at2)
	{
		//	It's easier to think of this as "when do two rects not overlap?"
		//	answer:  when one rect is entirely above, left, below, right.
		var r1x = r1.x + at1.x;
		var r1y = r1.y + at1.y;
		var r2x = r2.x + at2.x;
		var r2y = r2.y + at2.y;
		return !(r1y + r1.h < r2y ||	//	r1 is above
				 r1y > r2y + r2.h ||	//	r1 is below
				 r1x + r1.w < r2x ||	//	r1 is left
				 r1x > r2x + r2.w);	//	r1 is right
	};

	/**
	 * Test if two rects collide
	 */
	rat.collision2D.rectsCollide = rat.collision2D.rectOverlapsRect;

	/**
	 * do a circle and a rect collide.  Supports offset
	 */
	rat.collision2D.circlesAndRectCollide_Offset = function (c, cAt, r, rAt)
	{
		/* Based on code in the native engine*/
		var s, d = 0;
		var rr;
		if (c.squaredRadius)
			rr = c.squaredRadius;
		else
			rr = c.radius * c.radius;
		var spherePos = { x: c.center.y + cAt.x, y: c.center.y + cAt.y };
		var boxMin = { x: r.x + rAt.x, y: r.y + rAt.y }; // We only really care about the min here
		var boxMax = { x: boxMin.x + r.w, y: boxMin.y + r.h  };
		// In X?
		if (spherePos.x < boxMin.x)
		{
			s = spherePos.x - boxMin.x;
			d += s * s;
		}
		else if (spherePos.x > boxMax.x)
		{
			s = spherePos.x - boxMax.x;
			d += s * s;
		}

		// In Y?
		if (spherePos.y < boxMin.y)
		{
			s = spherePos.y - boxMin.y;
			d += s * s;
		}
		else if (spherePos.y > boxMax.y)
		{
			s = spherePos.y - boxMax.y;
			d += s * s;
		}

		if (d <= rr)
			return {};
		else
			return void 0;
	};

	/**
	 * do a circle and a rect collide
	 */
	rat.collision2D.circlesAndRectCollide = function (c, r)
	{
		/* Based on code in the native engine*/
		var s, d = 0;
		var rr;
		if (c.squaredRadius)
			rr = c.squaredRadius;
		else
			rr = c.radius * c.radius;
		var spherePos = c.center;
		var boxMin = r; // We only really care about the min here
		var boxMax = { x: r.x + r.w, y: r.y + r.h };
		// In X?
		if (spherePos.x < boxMin.x)
		{
			s = spherePos.x - boxMin.x;
			d += s * s;
		}
		else if (spherePos.x > boxMax.x)
		{
			s = spherePos.x - boxMax.x;
			d += s * s;
		}

		// In Y?
		if (spherePos.y < boxMin.y)
		{
			s = spherePos.y - boxMin.y;
			d += s * s;
		}
		else if (spherePos.y > boxMax.y)
		{
			s = spherePos.y - boxMax.y;
			d += s * s;
		}

		if (d <= rr)
			return {};
		else
			return void 0;
	};

	/**
	 * Test if two shapes collide
	 */
	rat.collision2D.shapesCollide = function (shape1, at1, shape2, at2)
	{
		switch (shape1.type)
		{
			case 'circle':
				switch (shape2.type)
				{
					case 'circle':
						return rat.collision2D.circlesCollide_Offset(shape1, at1, shape2, at2);
					case 'rect':
						return rat.collision2D.circlesAndRectCollide_Offset(shape1, at1, shape2, at2);
					default:
						return void 0;
				}
				break;
			case 'rect':
				switch (shape2.type)
				{
					case 'circle':
						return rat.collision2D.circlesAndRectCollide_Offset(shape2, at2, shape1, at1);
					case 'rect':
						return rat.collision2D.rectsCollide_Offset(shape1, at1, shape2, at2);
					default:
						return void 0;
				}
				break;
			default:
				return void 0;
		}
	};

	/**
	 * Test if a shape collides with a list of shapes
	 */
	rat.collision2D.shapeAndShapeListCollide = function (shape, shapeAt, list, listAt)
	{
		var res;
		var child;
		var iHaveChildren = shape.children && shape.children.length;
		var childHasChildren;
		for (var childIndex = 0, len = list.length; childIndex !== len; ++childIndex)
		{
			//	Do i collide with this child
			child = list[childIndex];
			res = rat.collision2D.shapesCollide(shape, shapeAt, child, listAt);

			//	Did i collide?
			if( res )
			{
				childHasChildren = child.children && child.children.length;
				//	If i have no children, AND child has no children
				//	The this is a collision
				if ( !iHaveChildren && !childHasChildren )
					return res;

				//	If I have children, and he does not, then He needs to be compared vs my children
				if (iHaveChildren && !childHasChildren)
				{
					res = rat.collision2D.shapeAndShapeListCollide(child, listAt, shape.children, shapeAt);
					//	He hit my leaf node
					//	collision because he is also a leaf
					if (res)
						return res;
				}
				else
				{
					//	Test me vs. the childs children
					//	This tells me that I collide with a leaf node.
					res = rat.collision2D.shapeAndShapeListCollide(shape, shapeAt, child.children, listAt);

					// Did I hit a leaf node?
					if (res)
					{
						//	IF I do collide with a leaf node, and I have no children, then I collide
						if (!iHaveChildren)
							return res;

						//	Check my children vs the childs children
						res = rat.collision2D.shapeListsCollide(shape.children, shapeAt, child.children, listAt);
						//	Did one of my leaf nodes collide with one of their leaf nodes
						if (res)
							return res;
					}
				}
			}
		}

		//	Must not have collided
		return void 0;
	};

	/**
	 * Test if two lists of shape objects collide
	 */
	rat.collision2D.shapeListsCollide = function (list1, at1, list2, at2)
	{
		var res;
		for (var childIndex = 0, len = list1.length; childIndex !== len; ++childIndex)
		{
			// A^x -> B^n
			res = rat.collision2D.shapeAndShapeListCollide(list1[childIndex], at1, list2, at2);

			//	They collided!
			if (res)
				return res;
		}

		//	Must not have collided
		return void 0;
	};

	/**
	 * Test if two bounding shapes collide
	 */
	rat.collision2D.BoundingShapesCollide = function(shape1, at1, shape2, at2)
	{
		//	Only continue if their two circles collide
		var collided = rat.collision2D.circlesCollide_Offset(shape1.mBounding, at1, shape2.mBounding, at2 );
		if( !collided )
			return collided;

		//	Test shapes for collision
		//	Shape list vs shape list
		// A^n -> B^n
		return rat.collision2D.shapeListsCollide(shape1.mShapes, at1, shape2.mShapes, at2);
	};
	
	// This portion of the collision2D system requires rat.shapes
	/**
	 * Hidden function used to create a shape from a data structure. used by BoundingShape
	 */
	function CreateShape(data, limits)
	{
		//	Create the correct object
		var newShape;
		switch(data.type)
		{
			case 'circle': // Fall through
			case 'Circle':
			{
				newShape = new rat.shapes.Circle(data);
				newShape.type = 'circle';
				var c  = newShape.center;
				var r = newShape.radius;
				if (limits.left === void 0 || limits.left > c.x - r)
					limits.left = c.x - r;
				if (limits.right === void 0 || limits.right < c.x + r)
					limits.right = c.x + r;
				if (limits.top === void 0 || limits.top > c.y - r)
					limits.top = c.y - r;
				if (limits.bottom === void 0 || limits.bottom < c.y + r)
					limits.bottom = c.y + r;
				break;
			}

			case 'rect': // Fall through
			case 'Rect': // Fall through
			case 'box': // Fall through
			case 'box':
			{
				newShape = new rat.shapes.Rect(data);
				newShape.type = 'rect';
				if (limits.left === void 0 || limits.left > newShape.x)
					limits.left = newShape.x;
				if (limits.right === void 0 || limits.right < newShape.x + newShape.w)
					limits.right = newShape.x + newShape.w;
				if (limits.top === void 0 || limits.top > newShape.y)
					limits.top = newShape.y;
				if (limits.bottom === void 0 || limits.bottom < newShape.y + newShape.h)
					limits.bottom = newShape.y + newShape.h;
				break;
			}

			default:
				rat.console.log("ERROR: Un-supported shape found in bounding shape data: " + data.type);
				return void 0;
		}

		//	Make sure that the shape has its type.
		newShape.type = data.type;

		if (data.name)
			newShape.name = data.name;

		//	Create this shape's children
		newShape.children = [];
		if(data.children)
		{
			for(var index = 0, len = data.children.length; index !== len; ++index)
			{
				newShape.children.push(CreateShape(data.children[index], limits));
			}
		}

		//	return the created shape (and its children)
		return newShape;
	}

	/**
		* Type data structure layout defines a bounding shape (with the options of shape groups)
		* @constructor
		* @param {Array} data
		* The layout of data is [
		* <{
		*		type: 'circle',
		*		x:,
		*		y:,
		*		radius:,
		*		<inDegrees:>,
		*		children:[ <subshapes of either circle or rect> ]
		* }>
		* <{
		*		type: 'rect',
		*		x:,
		*		y:,
		*		w:,
		*		h:,
		*		children:[ <subshapes of either circle or rect> ]
		* }>
		* ]
		*/
	rat.collision2D.BoundingShape = function (data)
	{
		//	Process default to array
		if(Array.isArray(data) === false)
			data = [data];

		this.mLimits = {
			left: void 0,
			right: void 0,
			top: void 0,
			bottom: void 0
		};

		//	Create my shapes
		//	Get the extends of the shapes here.

		this.mShapes = [];
		for(var index = 0, len = data.length; index !== len; ++index)
			this.mShapes.push(CreateShape(data[index], this.mLimits));

		//	Sanity on the limits
		this.mLimits.left = this.mLimits.left || 0;
		this.mLimits.right = this.mLimits.right || 0;
		this.mLimits.top = this.mLimits.top || 0;
		this.mLimits.bottom = this.mLimits.bottom || 0;

		//	What is a wrapper size
		this.mSize = {
			x: this.mLimits.right - this.mLimits.left,
			y: this.mLimits.bottom - this.mLimits.top,
		};

		//	extract calculations
		var halfSize = {
			x: this.mSize.x/2,
			y: this.mSize.y/2
		};

		//	What is our bounding circle
		this.mBounding = new rat.shapes.Circle({
			x: this.mLimits.left + halfSize.x,
			y: this.mLimits.top + halfSize.y,
			squaredRadius: (halfSize.x * halfSize.x) + (halfSize.y * halfSize.y),
		});
	};

	/**
	 * Draw this bounding shape.
	 * @param {Object} at
	 * @param {Object} boundingColor
	 * @param {Object} shapesColor
	 */
	rat.collision2D.BoundingShape.prototype.debugDraw = function (at, boundingColor, shapesColor)
	{
		rat.graphics.save();
		var ctx = rat.graphics.ctx;
		var colorString = boundingColor.toString();
		ctx.strokeStyle = colorString;
		ctx.lineWidth = 1;
		rat.graphics.translate(at.x, at.y);

		//	Draw the bounding rectangle.
		var limits = this.mLimits;
		var size = this.mSize;
		rat.graphics.ctx.strokeRect(limits.left, limits.top, size.x, size.y);

		//	Draw the bounding circle
		rat.graphics.drawCircle(this.mBounding);

		colorString = shapesColor.toString();
		ctx.strokeStyle = colorString;

		//	Draw the shape list
		rat.graphics.drawShapeList(this.mShapes);

		rat.graphics.restore();
	};
	
} );

//----------------------------
//	textbox Element (subclass of Element)
//	renders with built-in text support
//
//	TODO:  It might be cleaner to use this.lines everywhere, instead of this.value.
//		In too many places we switch between them...
//
//	TODO:  specialDraw system:
//		A callback system for drawing special characters/images in the middle of text.
//		First, set a call back function (setSpecialDraw())
//		Then, support an embedded special control character (rat.ui.TextBox.specialCharacter) followed by an argument character,
//		and when that pair is reached during drawing, don't draw them - instead call specialDraw() callback with those as arguments.
//		This will all happen during normal draw so that if we're drawing offscreen, this special drawing will also happen offscreen, which is good.
//		We might need to preprocess text looking for these special characters when we do line break processing... we need these special characters
//		to be included correctly in line width measurement, which is tricky.  So, yeah, we might need a second callback like specialMeasure,
//		or have specialDraw take an argument saying whether to actually draw?
//
//		specialDraw gets a single argument object with properties:
//			textBox: the textbox object currently drawing
//			ctx: context to draw to
//			argCode: the special argument character embedded in text after special code
//			x, y: the current drawing position. Is this top left, bottom left, center, what?  can't be center, I guess...
//			doDraw : false if we're just measuring.  See results below.
//			
//		specialDraw returns results in an object with these properties:
//			width: width of drawn image
//			height: height of drawn image
//			dirty: true if we should mark the textbox dirty again, e.g. if the drawing is going to animate every frame
//
//		Note:  If we don't already support explicitly overriding line height, we should, since some special characters will be tall,
//			but it'll be too late to change the height of a line when we've drawn the first few characters and then get to a tall special character.
//
rat.modules.add( "rat.ui.r_ui_textbox",
[
	{name: "rat.ui.r_ui", processBefore: true },
	{name: "rat.utils.r_utils", processBefore: true },
	
	"rat.graphics.r_graphics",
	"rat.utils.r_wordwrap",
	"rat.debug.r_console",
	"rat.ui.r_ui_data",
], 
function(rat)
{
	/**
	 * @constructor
	 * @extends rat.ui.Element
	*/
	rat.ui.TextBox = function (value)
	{
		rat.ui.TextBox.prototype.parentConstructor.call(this); //	default init
		if (value === void 0)
			this.value = "";
		else
			this.value = value;

		//	reasonable defaults
		this.font = "Calibri";
		this.fontStyle = "";	//	e.g. "bold"
		this.fontSize = 15;
		this.fontLineSpacing = 2;
		this.fontLineHeight = 16;  //	not sure how to get this accurately... evidently, it's a tough problem.
		//	fontLineHeight should be ascent + descent but no leading.
		this.fontDescriptor = "15px Calibri";

		this.strokeWidth = -1;
		this.strokeColor = null;
		
		this.textShadowEnabled = false;
		this.textShadowColor = new rat.graphics.Color( 0, 0, 0, .5 );
		this.textShadowOffset = { 
			x: 1,
			y: 1
		};
		
		//	by default, squish text instead of wrapping.  Little labels are more common than big text boxes.
		this.autoWrap = false;

		//	temp defaults - user usually sets this to what they want
		this.size.x = 100;
		//	maxWidth is a way to override how much of the box gets filled by text.
		//	by default, fill the whole box.
		this.maxWidth = this.size.x;
		this.size.y = this.fontLineHeight;
		
		//	our actual text width, calculated later
		this.textWidth = 0;
		
		//	similarly, in a multi-line solution, track the width of each line
		this.lineWidths = [];

		//	default alignments
		this.align = rat.ui.TextBox.alignLeft;
		this.baseline = rat.ui.TextBox.baselineMiddle;

		//console.log("width " + this.size.x);

		this.name = "<txt>" + this.id + "(" + value + ")";

		this.textChanged();	//	this updates multi-lines, and sets content size
		
		this.setTracksMouse(false);	//	no mouse tracking, highlight, tooltip, etc. including subelements.

		//	auto-set my size from content if a flag tells us to?  or just have them call another function....
	};
	rat.utils.inheritClassFrom(rat.ui.TextBox, rat.ui.Element);
	rat.ui.TextBox.prototype.elementType = 'textBox';
	
	rat.ui.TextBox.alignLeft = 0;
	rat.ui.TextBox.alignCenter = 1;
	rat.ui.TextBox.alignRight = 2;

	rat.ui.TextBox.baselineTop = 0;
	rat.ui.TextBox.baselineMiddle = 1;
	rat.ui.TextBox.baselineBottom = 2;

	rat.ui.TextBox.prototype.setTextValue = function (value)
	{
		//console.log("setText " + value);
		var oldValue = this.value;
		this.value = "" + value; // Make sure that it is a string

		if (oldValue !== this.value)
			this.textChanged();
	};

	rat.ui.TextBox.prototype.translateAndSetTextValue = function (value)
	{
		//	NOTE: We CANNOT call setTextValue because some of our classes override that to call translateAndSetTextValue which would cause infinite recursion
		if (rat.string)
			value = rat.string.getString(value);
		if (value !== this.value)
		{
			this.value = value;
			this.textChanged();
		}
	};

	//	mostly internal - rebuild full font descriptor based on individual values
	rat.ui.TextBox.prototype.updateFontDescriptor = function ()
	{
		var oldDescriptor = this.fontDescriptor;
		this.fontDescriptor = ("" + this.fontStyle + " " + this.fontSize + "px " + this.font).trim();
		///@todo	px vs. pt NOT interchangeable!  Switching back to px.  I vaguely remember some browsers not supporting px - was I imagining it?
		///@todo	autocenter if flagged to?

		//	re-measure if needed, e.g. if we have text at all.
		//	for one thing, wrapping code needs to know size of text,
		//	and also this updates our contentSize variable,
		//	which some outside systems (e.g. tooltips) depend on being accurate.
		if (oldDescriptor !== this.fontDescriptor && this.value && this.value.length > 0)
			this.textChanged();
	};

	/**
	 * set font (just font name, or optionally size and style as well)
	 * @param {string} font
	 * @param {number=} size
	 * @param {string=} style
	 */
	rat.ui.TextBox.prototype.setFont = function (font, size, style)
	{
		this.font = font;
		if(size)
			this.setFontSize(size);
		if(style)
			this.setFontStyle(style);
		this.updateFontDescriptor();
	};

	rat.ui.TextBox.prototype.setFontStyle = function (fontStyle)
	{
		this.fontStyle = fontStyle;
		this.updateFontDescriptor();
	};

	rat.ui.TextBox.prototype.setFontSize = function (fontSize)
	{
		this.fontSize = fontSize;
		this.fontLineHeight = fontSize + 1;	//	not sure how to get this accurately - evidently it's a problem
		this.updateFontDescriptor();
	};

	rat.ui.TextBox.prototype.setAutoWrap = function (autoWrap)
	{
		var oldWrap = this.autoWrap;
		this.autoWrap = autoWrap;
		if (oldWrap !== autoWrap)
			this.textChanged();	//	rewrap with new setting
	};

	//	todo: why is this different from autoCenter?  Are we giving up on autoCenter?  It's confusing...
	//	does it mean auto-center CONTENT within our bounds, or does it mean change our bounds?
	//	probably rework that whole system and rename functions to something like
	//	autoCenterContent and centerInParent or whatever.  Does that autocenter children, too?

	//	center text
	rat.ui.TextBox.prototype.centerText = function ()
	{
		//console.log("center text");
		this.align = rat.ui.TextBox.alignCenter;
		this.baseline = rat.ui.TextBox.baselineMiddle;
	};
	
	//	left align text (convenience function that does the same as calling SetAlign)
	rat.ui.TextBox.prototype.leftAlignText = function ()
	{
		this.setAlign(rat.ui.TextBox.alignLeft);
	};
	//	right align text (convenience function that does the same as calling SetAlign)
	rat.ui.TextBox.prototype.rightAlignText = function ()
	{
		this.setAlign(rat.ui.TextBox.alignRight);
	};

	rat.ui.TextBox.prototype.setAlign = function (align)
	{
		if (typeof(align) === 'string')
		{
			if (align === 'left') align = rat.ui.TextBox.alignLeft;
			else if (align === 'center') align = rat.ui.TextBox.alignCenter;
			else if (align === 'right') align = rat.ui.TextBox.alignRight;
		}
		
		if (align !== this.align)
			this.setDirty(true);
		this.align = align;
		
		//	note: we assume that doesn't affect wrapping or squish, so don't need to call textChanged()
	};

	rat.ui.TextBox.prototype.setBaseline = function (baseline)
	{
		//	support alternative arg types (simple text like 'top') for convenience...
		if (typeof(baseline) === 'string')
		{
			if (baseline === 'top') baseline = rat.ui.TextBox.baselineTop;
			else if (baseline === 'middle') baseline = rat.ui.TextBox.baselineMiddle;
			else if (baseline === 'bottom') baseline = rat.ui.TextBox.baselineBottom;
		}
		
		if (baseline !== this.baseline)
			this.setDirty(true);
		this.baseline = baseline;
		
		//	note: we assume that doesn't affect wrapping or squish, so don't need to call textChanged()
	};

	rat.ui.TextBox.prototype.setStroke = function (width, color, doCleanup)
	{
		if (width && color === void 0 && doCleanup === void 0 && typeof(width) !== "number")
		{
			doCleanup = width.doCleanup;
			color = width.color;
			width = width.lineWidth || width.width;
		}

		if (doCleanup === void 0)
			doCleanup = false;

		if (width !== this.strokeWidth || this.strokeCleanup !== doCleanup)
			this.setDirty(true);

		if (this.strokeColor !== color || (this.strokeColor && color && !this.strokeColor.equal(color)))
			this.setDirty(true);

		this.strokeWidth = width;
		this.strokeColor = color;
		this.strokeCleanup = doCleanup;
	};
	
	rat.ui.TextBox.prototype.setShadowEnabled = function( enable )
	{
		if (enable === void 0)
			enable = true;
		else
			enable = !!enable;
		if (this.textShadowEnabled !== enable)
		{
			this.textShadowEnabled = enable;
			this.setDirty(true);
		}
	};
	
	//	Set if we should be using a shadow
	rat.ui.TextBox.prototype.setShadow = function( color, offsetX, offsetY )
	{
		var changed = false;
		if ( color && !this.textShadowColor.equal(color) )
		{
			changed = true;
			this.textShadowColor.copyFrom( color );
		}
		
		if (offsetX !== void 0 && offsetX !== this.textShadowOffset.x)
		{
			changed = true;
			this.textShadowOffset.x = offsetX;
		}
		if (offsetY !== void 0 && offsetY !== this.textShadowOffset.y)
		{
			changed = true;
			this.textShadowOffset.y = offsetY;
		}
		
		if (changed && this.textShadowEnabled)
			this.setDirty(true);
	};
	
	//	return correct X positioning for text, based on desired alignment.
	//	and set render context to use that alignment
	rat.ui.TextBox.prototype.setupAlignX = function (ctx, lineWidth)
	{		
		var x = 0;
		
		//	Note:  Stroked text technically draws outside the space given.  This is not ideal.  See comment below in drawLine().
		//	We make a "maxWidth" adjustment below.  We need a tiny left/right adjustment here, as well, depending on alignment.
		//	e.g. if text is left-aligned, bump in a tiny bit so the stroke doesn't go outside our bounds!
		
		//	Note:  Instead of using context's textAlign, we could do the math ourselves and always use left or center or something.
		//	But this is working fine.
		
		//	OK, actually, it's useful in really obscure cases (like typewriter text) to force left alignment,
		//	and do the math ourselves.  Let's support that here.
		if (this.forceLeftRender && lineWidth)
		{
			ctx.textAlign = "left";
			if (this.align === rat.ui.TextBox.alignLeft)
				x = 0 + this.strokeWidth / 2;
			else if(this.align === rat.ui.TextBox.alignCenter)
				x = this.size.x / 2 - lineWidth/2 + this.strokeWidth / 2;
			else
				x = this.size.x - lineWidth;// + this.strokeWidth / 2;
			
		} else {
			if(this.align === rat.ui.TextBox.alignLeft)
			{
				ctx.textAlign = "left";
				x = 0 + this.strokeWidth / 2;
			} else if(this.align === rat.ui.TextBox.alignCenter)
			{
				ctx.textAlign = "center";
				x = this.size.x / 2;
			} else
			{
				ctx.textAlign = "right";
				x = this.size.x - this.strokeWidth / 2;
			}
		}
		
		if (!this.ignoreCenter)	//	 a little hacky...  see buildOffscreen
			x -= this.center.x;

		return x;
	};

	rat.ui.TextBox.prototype.setupAlignY = function (ctx)
	{
		var y = 0;
		if(this.baseline === rat.ui.TextBox.baselineTop)
		{
			ctx.textBaseline = "top";
			y = 0;
		} else if(this.baseline === rat.ui.TextBox.baselineMiddle)
		{
			ctx.textBaseline = "middle";
			y = this.size.y / 2;
		} else
		{
			ctx.textBaseline = "bottom";
			y = this.size.y;
		}
		if (!this.ignoreCenter)	//	 a little hacky...  see buildOffscreen
			y -= this.center.y;
		return y;
	};
	
	//
	//	our text has changed.
	//	do some preflighting - figure out if we have more than one line to draw.
	//	also, a good place for optional rendering optimization.
	//
	rat.ui.TextBox.prototype.textChanged = function ()
	{
		this.setDirty();
		
		if(!this.value || this.value.length <= 0 || !rat.graphics.ctx)
		{
			this.lines = [];
			this.setContentSize(0, 0);
			return;
		}

		//	for any measuring that needs to happen, make sure we've got the right font set up in the ctx
		rat.graphics.ctx.font = this.fontDescriptor; //	for measuring
		
		//	In some circumstances, we're going to do this repeatedly until things fit...
		//	but let's limit that.
		var totalHeight = this.fontLineHeight;
		var squishForHeight = 1;
		var fitVertically = false;
		for (var vFitIndex = 0; !fitVertically && vFitIndex < 4; vFitIndex++)
		{
			//	if autowrap is set, do that.
			if(this.autoWrap)
			{
				this.lines = rat.wordwrap.wrapString(this.value, this.maxWidth * squishForHeight, rat.graphics.ctx);
			} else
			{	//	otherwise, check for manual wrapping
				//	could use string.split() here, but I want to maybe handle things differently - clean up whitespace? handle tab indents?
				this.lines = this.value.split('\n');
			}

			//	some problem?
			if(!this.lines || this.lines.length < 1)	//	can this even happen?
			{
				this.lines = [];
				this.setContentSize(0, 0);
				return;
			}
			
			//	see if we fit vertically.
			//	TODO:  Factor in vertical alignment!  I think it's significant.  This might currently assume baselineMiddle?
			//	Note that we say a single line always fits, no matter what our bounds say. We can't get shorter than one line.
			totalHeight = this.fontLineHeight * this.lines.length + this.fontLineSpacing * (this.lines.length - 1);
			if (this.lines.length > 1 && totalHeight > this.size.y)	//	too big
				squishForHeight += 0.1;	//	allow more text in each line, each time through
			else
				fitVertically = true;
		}

		//	measure us...
		var widest = 0;
		rat.graphics.ctx.font = this.fontDescriptor; //	for measuring
		for (var i = 0; i < this.lines.length; i++)
		{
			try
			{
				var metrics = rat.graphics.ctx.measureText(this.lines[i]);
				if (metrics.width > widest)
					widest = metrics.width;
				this.lineWidths[i] = metrics.width;
			}
			catch(err)
			{
				rat.console.log("r_ui_textbox error: " + err.message);
			}
		}

		if (this.lines.length === 1)	//	single line
		{
			this.lines = [];	//	just use this.value instead of array
			this.setContentSize(widest, this.fontLineHeight);
		} else
		{
			this.setContentSize(widest, totalHeight);
		}
		
		//	remember how wide our widest line was, in case somebody else wants it.
		this.textWidth = widest;
	};
	
	//	get actual width of my current text, as calculated when it was set.
	//	We factor in this.maxWidth here, so the caller is for sure finding out how wide the text will be
	//	when it is drawn!
	rat.ui.TextBox.prototype.getTextWidth = function()
	{
		if (this.maxWidth < this.textWidth)
			return this.maxWidth;
		else
			return this.textWidth;
	};
	
	//	todo: getLineWidths()
	
	//	get actual height of my text
	//	This may not be super accurate, but we try.
	rat.ui.TextBox.prototype.getTextHeight = function()
	{
		var lineCount = this.lines.length || 1;
		totalHeight = this.fontLineHeight * lineCount + this.fontLineSpacing * (lineCount - 1);
		return totalHeight;
	};
	
	//	util to draw a single line of text
	//	useful to subclasses.  This function assumes x and y have been correctly calculated based on alignment, multi-lines, etc.
	rat.ui.TextBox.prototype.drawLine = function (ctx, x, y, text)
	{
		//console.log("tsize " + this.size.x + ", " + this.size.y);
		//ctx.strokeStyle = "FF40F0";
		//ctx.strokeRect(-this.center.x, -this.center.y, this.size.x, this.size.y);

		if(!text)
			return;

		ctx.font = this.fontDescriptor;

		// this was previously using color.toString(), which prevents us from setting gradients as fillstyles, 
		//	also color does appear to work even though its a rat-object, possibly because its already listed in distinct 'rgba' fields
		// TODO - redo this fillStyle to take a rat FillStyle class that can have color or gradient or pattern as defined by 
		//			the example here - http://www.w3schools.com/tags/canvas_fillstyle.asp
		// TODO ALSO: along the same lines we'd want to fix things like button and fillbar that also use color instead of style
		// FIXME ! hackety foo for now! boo! :(
		if (this.color.a)
			ctx.fillStyle = this.color.toString();		// if it has a rat.Color alpha field, assume it's a color
		else
			ctx.fillStyle = this.color;					// otherwise assume its not a rat color object and that it may be a proper style object instead

		var maxWidth = this.maxWidth;
		if (this.strokeWidth > 0)
		{
			//	stroked text technically goes outside "maxWidth", which is undesirable in 2 ways.
			//	1: it means text is going outside carefully measured spaces, by a few pixels.
			//	2: it means if we have text offscreen buffer rendering enabled, the stroked edges get clipped off.
			//	A solid way to correct this, then, is to use a narrower maxWidth when there's a stroke involved.
			//	This means stroked text will be slightly more squished than non-stroked text, if squishing is happening at all,
			//	but we judge that to be correct behavior.
			//	And note that this maxWidth adjustment here means all text below uses this new adjusted maxWidth;
			//	(adjust our width by half the stroke, on both left and right, so whole stroke.)
			maxWidth -= this.strokeWidth;
		
			ctx.strokeStyle = this.strokeColor.toString();
			ctx.lineWidth = this.strokeWidth;
			ctx.strokeText(text, x, y, maxWidth);
		}
		
		//	Shadow support
		if (this.textShadownEnabled &&
			this.textShadowColor.a > 0 &&
			this.textShadowOffset.x !== 0 && 
			this.textShadowOffset.y !== 0 )
		{
			ctx.shadowColor = this.textShadowColor.toString();
			ctx.shadowOffsetX = this.textShadowOffset.x;
			ctx.shadowOffsetY = this.textShadowOffset.y;
		}

		ctx.fillText(text, x, y, maxWidth);

		//	if we're doing a stroke, do a thin stroke inside as well - it cleans up the edges of the normal text rendering
		if (this.strokeCleanup && this.strokeWidth >= 0)
		{
			var tempColor = this.strokeColor.copy();
			tempColor.a = 0.3;

			ctx.strokeStyle = tempColor.toString();
			ctx.lineWidth = 1;
			ctx.strokeText(text, x, y, maxWidth);
		}
	};

	rat.ui.TextBox.prototype.drawSelf = function ()
	{
		var ctx = rat.graphics.getContext();
		
		var x, y;
		if(this.lines.length > 0)	//	multi-line version
		{
			y = this.setupAlignY(ctx);
			var lineHeight = this.fontLineHeight + this.fontLineSpacing;	//	font size plus padding - don't have an easy way to get text height
			var height = this.lines.length * lineHeight;

			if(this.baseline === rat.ui.TextBox.baselineMiddle)
			{
				y -= (height - lineHeight) / 2;	//	text is already aligned middle, so only move up for lines beyond first
			} else if(this.baseline === rat.ui.TextBox.baselineBottom)
			{
				y -= (height - lineHeight);	//	text is aligned to bottom, so only go up a line for each additional line beyond first
			}

			for(var i = 0; i < this.lines.length; i++)
			{
				x = this.setupAlignX(ctx, this.lineWidths[i]);
				this.drawLine(ctx, x, y, this.lines[i]);
				y += lineHeight;
			}

		} else
		{	//	simple single-line version
			x = this.setupAlignX(ctx, this.textWidth);
			y = this.setupAlignY(ctx);

			this.drawLine(ctx, x, y, this.value);
		}
	};

	rat.ui.TextBox.prototype.boundsChanged = function ()
	{
		this.maxWidth = this.size.x;
		rat.ui.TextBox.prototype.parentPrototype.boundsChanged.call(this);	//	inherited normal func

		//	TODO:  I would like to not do either of these if our SIZE didn't change, but I don't have a way to know.
		//	should probably pass in old bounds to this function!
		
		this.textChanged();	//	rewrap/squish text with new setting
		this.setDirty(true);
	};

	// Support for creation from data
	//
	//text: ""
	//font:{
	//	font:"",
	//	size: 00,
	//	style"",
	//	stroke:{
	//		width:
	//		color:{
	//			r:0
	//			g:0
	//			b:0,
	//			a:0
	//		}
	//	},
	//	align:"",
	//	baseline:""
	//}
	//
	rat.ui.TextBox.setupFromData = function (pane, data, parentBounds)
	{
		rat.ui.data.callParentSetupFromData( rat.ui.TextBox, pane, data, parentBounds );

		if (data.font)
		{
			if (data.font.font )
				pane.setFont(data.font.font);
			if (data.font.size)
				pane.setFontSize( data.font.size );
			if (data.font.style)
				pane.setFontStyle(data.font.style);
			if (data.font.stroke)
			{
				pane.setStroke(data.font.stroke.width, data.font.stroke.color, data.font.stroke.doCleanup);
			}
		}
		if (data.align === "left" )
			pane.setAlign(rat.ui.TextBox.alignLeft);
		else if (data.align === "center" )
			pane.setAlign(rat.ui.TextBox.alignCenter);
		else if (data.align === "right" )
			pane.setAlign(rat.ui.TextBox.alignRight);

		if (data.baseline === "top" )
			pane.setBaseline(rat.ui.TextBox.baselineTop);
		else if (data.baseline === "middle" || data.baseline === "center")
			pane.setBaseline(rat.ui.TextBox.baselineMiddle);
		else if (data.baseline === "bottom" )
			pane.setBaseline(rat.ui.TextBox.baselineBottom);

		if (data.autoWrap !== void 0)
			pane.setAutoWrap(!!data.autoWrap);
		if (data.translateText)
			pane.translateAndSetTextValue(data.translateText || "");
		else
			pane.setTextValue(data.text || "");
		
	};

	///
	/// Special version of textbox that default to localizing text
	/// @constructor
	/// @extends rat.ui.TextBox
	///
	rat.ui.TranslatedTextBox = function (value)
	{
		if (rat.string)
			value = rat.string.getString(value);
		rat.ui.TranslatedTextBox.prototype.parentConstructor.call(this, value); //	default init
	};
	rat.utils.inheritClassFrom(rat.ui.TranslatedTextBox, rat.ui.TextBox);

	/*
	 * Set the value with the translated version of the text
	 */
	rat.ui.TranslatedTextBox.prototype.setTextValue = function (value)
	{
		rat.ui.TranslatedTextBox.prototype.parentPrototype.translateAndSetTextValue.call(this, value);
	};

	/*
	 * Bypass the translation step
	 */
	rat.ui.TranslatedTextBox.prototype.setTextValueRaw = function (value)
	{
		rat.ui.TranslatedTextBox.prototype.parentPrototype.setTextValue.call(this, value);
	};

});
//
//	Support for creating UI elements from data
//
rat.modules.add( "rat.ui.r_ui_data",
[
	{name: "rat.utils.r_utils", processBefore: true },
	{name: "rat.ui.r_ui", processBefore: true },
	
	"rat.debug.r_console",
	"rat.utils.r_shapes",
], 
function(rat)
{
	//	Namespace for all of this functionality
	rat.ui.data = {};

	function calcSizeFromFlags(val, parent)
	{
		if (val.val !== void 0)
		{
			if (val.percent)
				val.val *= parent;
			if (val.fromParent)
				val.val += parent;
			val = val.val;
		}
		return val;
	}

	/** @suppress {missingProperties} */
	function calcPosFromFlags(val, parentSize, mySize)
	{
		if (val.val === void 0)
			val = { val: val };


		{
			//	Percentage of parent size
			if (val.percent)
				val.val *= parentSize;

			//	From the center of the parent
			if (val.fromCenter)
				val.val += (parentSize / 2);
				//	From the edge of the parent
			else if (val.fromParentEdge || val.fromParentFarEdge)
				val.val = parentSize - val.val;

			//	centered (not the same as setting center values, see elsewhere)
			if (val.centered || val.drawCentered || val.center)
				val.val -= mySize / 2;
			else if (val.fromMyEdge || val.fromMyFarEdge)
				val.val -= mySize;
			val = val.val;
		}
		return val;
	}

	// Calculate bounds based on flags, data, and parent bounds
	//	Supported flags
	//	noChange
	//	autoFill
	//	Per size field flags
	//		percent
	//		fromParent
	//	Per pos field flags
	//		percent
	//		center
	rat.ui.data.calcBounds = function (data, parentBounds)
	{
		var bounds = rat.utils.copyObject(data.bounds || {}, true);
		bounds.x = bounds.x || 0;
		bounds.y = bounds.y || 0;
		bounds.w = bounds.w || 0;
		bounds.h = bounds.h || 0;


		//	No change flag set
		if (bounds.noChange)
		{
			if (bounds.x.val !== void 0)
				bounds.x.val = bounds.x.val;
			if (bounds.y.val !== void 0)
				bounds.y.val = bounds.y.val;
			if (bounds.w.val !== void 0)
				bounds.w.val = bounds.w.val;
			if (bounds.h.val !== void 0)
				bounds.h.val = bounds.h.val;
			return bounds;
		}

		//	Auto fill always auto-fills
		if (bounds.autoFill)
			return { x: 0, y: 0, w: parentBounds.w, h: parentBounds.h };

		//	Find the size I will be.
		bounds.w = calcSizeFromFlags(bounds.w, parentBounds.w);
		bounds.h = calcSizeFromFlags(bounds.h, parentBounds.h);
		bounds.x = calcPosFromFlags(bounds.x, parentBounds.w, bounds.w);
		bounds.y = calcPosFromFlags(bounds.y, parentBounds.h, bounds.h);
		
		return bounds;
	};

	//	Create any pane from data
	rat.ui.data.createPaneFromData = function( data, parent )
	{
		var parentBounds;
		if( parent )
			parentBounds = parent.getBounds();
		else
			parentBounds = {x: 0, y:0, w:0, h:0};

		var paneType = data.type;
		if (paneType === "Container")
			paneType = "Element";
		if( !rat.ui[paneType] )
		{
			rat.console.log( "WARNING! Unknown pane type '" + paneType + "' hit in createPaneFromData.  Falling back to Eelement." );
			paneType = "Element";
		}
		
		//	Find the create function, falling back to parent types if we need to.
		var elementClass = rat.ui[paneType];
		//	If we did not find anything, then use the the Element one as we know that it does (or atleast should) exist
		if (!elementClass)
		{
			rat.console.log("WARNING! Unable to find createFromData for element of type " + paneType + ".  Reverting to rat.ui.Element.createFromData");
			elementClass = rat.ui.Element;
		}

		//	get the setupFromData func
		var setupClass = elementClass;
		while (setupClass && !setupClass.setupFromData)
		{
			if (setupClass.prototype)
				setupClass = setupClass.prototype.parentConstructor;
			else
				setupClass = void 0;
		}
			
		//	If we did not find anything, then use the the Element one as we know that it does (or atleast should) exist
		if (!setupClass)
		{
			rat.console.log( "WARNING! Unable to find createFromData for element of type "+paneType+".  Reverting to rat.ui.Element.createFromData" );
			setupClass = rat.ui.Element;
		}
		
		//	Create it.
		var pane = new elementClass();
		if (setupClass.setupFromData)
			setupClass.setupFromData(pane, data, parentBounds);

		//	Now create its children
		rat.ui.data.createChildrenFromData(pane, data.children);

		//	Call any onCreate callback
		if (data.onCreate)
			data.onCreate(pane);
		return pane;
	};

	/// Create the children of an element
	rat.ui.data.createChildrenFromData = function (parent, children)
	{
		if (!parent)
			return;
		if (!children)
			return;
		for (var index = 0; index !== children.length; ++index)
			parent.appendSubElement(rat.ui.data.createPaneFromData(children[index], parent));
	};

	// Call setupFromData on the types parent type
	rat.ui.data.callParentSetupFromData = function (type, pane, data, parentBounds)
	{
		var setupClass = type;
		do
		{
			if (setupClass)
			{
				if (setupClass.prototype)
					setupClass = setupClass.prototype.parentConstructor;
				else
					setupClass = void 0;
			}
		} while (setupClass && !setupClass.setupFromData);

		//	If we did not find anything there is nothing else to call
		if (!setupClass)
			return;
		setupClass.setupFromData(pane, data, parentBounds);
	};
	
	//	A function that will create a given graphical structure from "JSON" data
	//	Note that in some cases, we may violate the strict JSON structure by allowing functions 
	/**
	 * @param {Object} data
	 * @param {Object=} bounds
	 */
	rat.ui.data.createTreeFromData = function (data, bounds)
	{
		//	Create the root pane
		var parent = {
			getBounds: function(){
				if (bounds)
					return bounds;
				else
					return new rat.shapes.Rect(0, 0, rat.graphics.SCREEN_WIDTH, rat.graphics.SCREEN_HEIGHT);
			}
		};
		return rat.ui.data.createPaneFromData(data, parent); // Just creates the given pane, not its children
	};
} );
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

//----------------------------
//	button Element
//	for now, the implementation auto-creates a bubble box/bar and a textbox.
//	this has been problematic in other engines - maybe need to change around a bit...

//	TODO
//		Improved color state setting functions for color, text, and images.
//		support overlay art?  A second image that shows/doesn't show also based on state.  could be flexible and generic.
//
//		Figure out how to autosize a spritebutton from an image the loads late

//	Notes on Dirty Flags for buttons.
//		First of all, buttons contain images and text,
//			but they aren't classic "subElement" entries.
//			So, one thing we do is let the image or text track its own dirty state like normal
//			(which is useful because they do that carefully on each function)
//			and then we do a special dirty check ourselves by supplying a checkDirty() function, which rat.ui.Element respects.
//		Second, it's tricky because we might have several buttons that could be changing or updating, or whatever,
//			or we might even have images/text that is NOT changing, but we swap out which one is active when our state changes.
//			State changes need to potentially set dirty flag, even if our text or images haven't themselves changed.
//			We solve this with the simple use of flagsThatDirtyMe, which is what it's for.  :)
//		Also note that updateDisplayState is a bad place to check/set dirty, because it's called from drawSelf() which is
//			only called after the rat.ui.Element system has already done its dirty check.
//			So, that's not quite ideal.  the updateDisplayState call should probably get moved to earlier (e.g. draw() override)
//			or happen on state changes instead of in draw loop.
//			But for now, I'm not too worried.  Our other dirty checks should cover it.
//		Also: buttons are not necessarily an ideal place to be using offscreens, since they update often?
//			You might consider setting textUseOffscreen to make the actual text offscreen, which is generally a good idea with text,
//			but leave the button not offscreened?  It's up to you and your specific case, of course.
//
rat.modules.add( "rat.ui.r_ui_button",
[
	{name: "rat.utils.r_utils", processBefore: true },
	{name: "rat.ui.r_ui", processBefore: true },
	{name: "rat.ui.r_ui_bubblebox", processBefore: true },
	
	"rat.ui.r_ui_sprite",
	"rat.graphics.r_image",
	"rat.graphics.r_graphics",
	"rat.ui.r_ui_textbox",
], 
function(rat)
{
	/**
	 * @constructor
	 * @extends rat.ui.BubbleBox
	 * @param {string=} resource
	 * @param {string=} resourceHi
	 * @param {string=} resourcePressed
	 * @param {string=} resourceDisabled
	 * @param {Object=} extra1 (optional - used for external image formats (see makeImage))
	 * @param {boolean=} extra2 (optional - used for external image formats (see makeImage))
	*/
	rat.ui.Button = function (buttonType, resource, resourceHi, resourcePressed, resourceDisabled, extra1, extra2)
	{
		rat.ui.Button.prototype.parentConstructor.call(this); //	default init

		this.canBeTarget = true;
		this.isSetup = false;
		if (buttonType !== void 0)
			this.setupButton(buttonType, resource, resourceHi, resourcePressed, resourceDisabled, extra1, extra2);
	};
	rat.utils.inheritClassFrom(rat.ui.Button, rat.ui.BubbleBox);
	rat.ui.Button.prototype.elementType = "button";

	//	these flag changes need to set me dirty, because they change my look!
	//	see rat.ui module, comments above flagsThatDirtyMe variable,
	//	and rat.ui.Element.prototype.checkFlagsChanged function.
	rat.ui.Button.prototype.flagsThatDirtyMe = 
			rat.ui.Element.highlightedFlag |
			rat.ui.Element.enabledFlag |
			rat.ui.Element.pressedFlag |
			rat.ui.Element.toggledFlag;

	rat.ui.Button.prototype.textInset = 8;	//	how far in from edges text is placed, by default

	/**
	 * @param {string=} resource
	 * @param {string=} resourceHi
	 * @param {string=} resourcePressed
	 * @param {string=} resourceDisabled
	 * @param {Object=} extra1 (optional - used for external image formats (see makeImage))
	 * @param {boolean=} extra2 (optional - used for external image formats (see makeImage))
	*/
	rat.ui.Button.prototype.setupButton = function(buttonType, resource, resourceHi, resourcePressed, resourceDisabled, extra1, extra2)
	{
		if (this.isSetup)
			return;
		this.isSetup = true;

		this.type = buttonType;

		//	create bubble/sprite resource
		if (buttonType === rat.ui.Button.spriteType)
		{
			this.buttonImage = new rat.ui.Sprite();
			
		} else if (buttonType === rat.ui.Button.bubbleType)
		{
			this.buttonImage = new rat.ui.BubbleBox();
		} else if (buttonType === rat.ui.Button.cheapType && resource)
		{
			//	cheap buttons support an image thrown in there as well, if one was provided
			this.buttonImage = new rat.ui.Sprite();
		}
		
		//	if image subelement successfully got created above
		if (typeof this.buttonImage !== 'undefined')
		{
			this.appendSubElement(this.buttonImage);
		}
		
		//	we have several frames we explicitly keep track of.
		//	todo: standardize all this state-related rendering stuff.  Have one master array with structs that define
		//	all rendering info (image, colors, text colors, frames, etc.) along with flags for identifying complex state combinations.
		//	Working on this.  see colorStates.  Note that I'm leaving old support in here,
		//	for older projects that still depend on this code.
		
		if (resource)
		{
			this.imageNormal = rat.graphics.makeImage(resource, extra1, extra2);
			//	questionable special case:
			if ((buttonType === rat.ui.Button.spriteType || buttonType === rat.ui.Button.cheapType) && this.imageNormal.size)
			{
				//console.log("trying to set button size from image");
				this.setSize(this.imageNormal.size.x, this.imageNormal.size.y);	//	this will work if the image was already cached...
				//console.log("done trying");
			}
		}
		
		if (resourceHi)
			this.imageHi = rat.graphics.makeImage(resourceHi, extra1, extra2);

		if (resourcePressed)
			this.imagePressed = rat.graphics.makeImage(resourcePressed, extra1, extra2);

		if (resourceDisabled)
			this.imageDisabled = rat.graphics.makeImage(resourceDisabled, extra1, extra2);

		this.toggles = false; //	see rat.ui.Element.toggledFlag - we aren't a toggle button by default

		//	todo: support default click down and click up both
		this.clickSound = rat.ui.Button.defaultClickSound;	//	if there is one

		//	not used?  see setTextOffset
		//this.textOffset = new rat.Vector(0, 0);

		this.name = "<but>" + this.id;
		
		this.setDirty(true);
	};

	rat.ui.Button.spriteType = 1;
	rat.ui.Button.bubbleType = 2;
	rat.ui.Button.cheapType = 3;
	rat.ui.Button.defaultClickSound = 'click';
	
	//	rat.ui.Button.defaultClickSound;	//	undefined initially, can be set by client to set default click sound for all future elements

	/**
	* util to make a simple sprite button
	* @param {string=} res
	* @param {string=} resHi
	* @param {string=} resPressed
	* @param {string=} resDisabled
	* @param {Object=} extra1 (optional - used for external image formats (see makeImage))
	* @param {boolean=} extra2 (optional - used for external image formats (see makeImage))
	*/
	rat.ui.makeSpriteButton = function (res, resHi, resPressed, resDisabled, extra1, extra2)
	{
		return new rat.ui.Button(rat.ui.Button.spriteType, res, resHi, resPressed, resDisabled, extra1, extra2);
	};

	/**
	* util to make a simple bubble button
	* @param {string=} resPressed
	* @param {string=} resDisabled
	*/
	rat.ui.makeBubbleButton = function (res, resHi, resPressed, resDisabled)
	{
		return new rat.ui.Button(rat.ui.Button.bubbleType, res, resHi, resPressed, resDisabled);
	};

	//	Create a table of standard color states based on a starting color.
	rat.ui.Button.createStandardColorStates = function(color)
	{
		var colorStates = [];
			//	this is a bunch of code to make up colors based on some vaguely mid-range color being passed in.
			//	These are good defaults, and you can override stuff by calling one of the setStateXXX functions below, if you want.
		colorStates[0] = {};
		colorStates[0].flags = rat.ui.Element.enabledFlag; //	normal state
		colorStates[0].color = color.copy();
		colorStates[0].frameColor = new rat.graphics.Color(color.r / 4, color.g / 4, color.b / 4, color.a);
		colorStates[0].textColor = new rat.graphics.Color(color.r * 4, color.g * 4, color.b * 4, color.a);

		colorStates[1] = {};
		colorStates[1].flags = rat.ui.Element.enabledFlag | rat.ui.Element.highlightedFlag; //	highlight state
		colorStates[1].color = new rat.graphics.Color(color.r + 50, color.g + 50, color.b + 50, color.a);
		colorStates[1].frameColor = new rat.graphics.Color(color.r / 5, color.g / 5, color.b / 5, color.a);
		colorStates[1].textColor = new rat.graphics.Color(color.r * 6, color.g * 6, color.b * 6, color.a);

		colorStates[2] = {};
		colorStates[2].flags = rat.ui.Element.enabledFlag | rat.ui.Element.pressedFlag;
		colorStates[2].color = new rat.graphics.Color(color.r / 2, color.g / 2, color.b / 2, color.a);
		colorStates[2].frameColor = new rat.graphics.Color(color.r / 5, color.g / 5, color.b / 5, color.a);
		colorStates[2].textColor = new rat.graphics.Color(color.r * 4, color.g * 4, color.b * 4, color.a);

		colorStates[3] = {};
		colorStates[3].flags = rat.ui.Element.enabledFlag | rat.ui.Element.toggledFlag;
		colorStates[3].color = colorStates[0].color.copy();
		colorStates[3].frameColor = new rat.graphics.Color(color.r * 4, color.g * 4, color.b * 4, color.a);
		colorStates[3].textColor = new rat.graphics.Color(color.r * 10, color.g * 10, color.b * 10, color.a);

		colorStates[4] = {};
		colorStates[4].flags = rat.ui.Element.enabledFlag | rat.ui.Element.toggledFlag | rat.ui.Element.highlightedFlag;
		colorStates[4].color = colorStates[1].color.copy();
		colorStates[4].frameColor = new rat.graphics.Color(color.r * 4, color.g * 4, color.b * 4, color.a);
		colorStates[4].textColor = colorStates[1].textColor.copy();

		colorStates[5] = {};
		colorStates[5].flags = rat.ui.Element.enabledFlag | rat.ui.Element.toggledFlag | rat.ui.Element.pressedFlag;
		colorStates[5].color = colorStates[2].color.copy();
		colorStates[5].frameColor = new rat.graphics.Color(color.r * 4, color.g * 4, color.b * 4, color.a);
		colorStates[5].textColor = colorStates[2].textColor.copy();

		colorStates[6] = {};
		colorStates[6].flags = 0; //	disabled (enabled flag is not set, unlike others)
		colorStates[6].color = new rat.graphics.Color(120, 120, 120, color.a);
		colorStates[6].frameColor = new rat.graphics.Color(64, 64, 64, color.a);
		colorStates[6].textColor = new rat.graphics.Color(64, 64, 64, color.a);

		return colorStates;
	}

	//
	//	Make a cheap button - a simple boxy colored button
	//	This makes tons of assumptions, and isn't pretty, but does support many distinct button states.
	//	Useful for prototyping, if nothing else.
	//
	rat.ui.makeCheapButton = function (res, color)
	{
		var colorStates = rat.ui.Button.createStandardColorStates(color);
		return rat.ui.makeCheapButtonWithColors(res, colorStates);
	};
	
	//	make a cheap button, but also specify color states rather than use the defaults.
	//	This is similar to calling makeCheapButton and then setStateColors, I think.
	rat.ui.makeCheapButtonWithColors = function (res, colorStates)
	{
		var button = new rat.ui.Button(rat.ui.Button.cheapType, res);
		button.colorStates = colorStates;

		return button;
	};

	//	special dirty check functionality, since we have image/text subobjects that aren't subelements
	rat.ui.Button.prototype.checkDirty = function()
	{
		if ((this.buttonImage && this.buttonImage.isDirty) || (this.text && this.text.isDirty) || this.isDirty)
			return true;
		return false;
	};

	rat.ui.Button.prototype.setOutline = function (enabled, scale)
	{
		if (this.buttonImage)
			this.buttonImage.setOutline(enabled, scale);
	};

	//	button bounds changed - adjust contents and whatnot accordingly
	rat.ui.Button.prototype.boundsChanged = function ()
	{
		//console.log("button size changed");
		//	make sure our subelements match our size
		//	change this logic depending on type!  (sprite buttons, don't do this)
		if (this.type === rat.ui.Button.bubbleType)
		{
			//console.log("btn: setting image size to " + this.size.x + ", " + this.size.y);
			if (this.buttonImage)
				this.buttonImage.setSize(this.size.x, this.size.y);
			this.setContentSize(this.size.x, this.size.y);
		}
		else if (this.type === rat.ui.Button.spriteType)
		{
			//	This is weird... do we really want the sprite to match our size?
			//console.log("button bounds changed " + this.size.x + " x " + this.size.y);
			if (this.buttonImage)
				this.buttonImage.setSize(this.size.x, this.size.y);
			this.setContentSize(this.size.x, this.size.y);
		}
		else if (this.text)
		{
			//console.log("btn: setting text size to " + this.size.x + ", " + this.size.y);
			this.resizeTextBox();
			//	todo: this isn't called everywhere - and is it right?  shouldn't we only do this if we're ONLY text?  How likely is that?
			this.setContentSize(this.text.contentSize.x, this.text.contentSize.y);
		}

		rat.ui.Button.prototype.parentPrototype.boundsChanged.call(this);	//	also do inherited behavior
	};

	rat.ui.Button.prototype.centerContent = function ()
	{
		if (this.buttonImage)
		{
			this.buttonImage.centerInParent();
		}
		if (this.text)
		{
			this.text.centerInParent();
		}
	};

	//	if the button is set to not adjust for scale, we need to make sure our bubble box inside knows about it.
	//
	rat.ui.Button.prototype.setAdjustForScale = function (adjust)
	{
		rat.ui.Element.prototype.setAdjustForScale.call(this, adjust);	//	set our flag normally
		if (this.buttonImage)
			this.buttonImage.setAdjustForScale(adjust);
	};

	//	set text inset (how far from edges text is)
	rat.ui.Button.prototype.setTextInset = function(value)
	{
		if (this.textInset != value)
		{
			this.textInset = value;
			this.resizeTextBox();
		}
	};

	//
	//	get reference to our text box so it can be directly manipulated.
	//
	rat.ui.Button.prototype.getTextBox = function ()
	{
		return this.text;
	};
	
	rat.ui.Button.prototype.checkAndMakeTextBox = function ()
	{
		if (!this.text)	//	not already built
		{
			//	create text box
			this.text = new rat.ui.TextBox("");
			this.resizeTextBox();
			this.appendSubElement(this.text);
			this.text.centerText();		//	center by default
			//this.text.setFrame(1, rat.graphics.white);	//	debug
		}

		return this.text;
	};
	
	rat.ui.Button.prototype.resizeTextBox = function()
	{
		if (this.text)
		{
			this.text.setPos(this.textInset, 0);
			this.text.setSize(this.size.x - 2 * this.textInset, this.size.y);
		}
	};
			
	
	//	todo: maybe never use this?  Is resizeTextBox enough?
	rat.ui.Button.prototype.removeTextBox = function ()
	{
		if (this.text)
		{
			this.removeSubElement(this.text);
			this.text = null;
		}
	};

	//
	//	get reference to our image, if there is one, so it can be directly manipulated.
	//
	rat.ui.Button.prototype.getImage = function ()
	{
		return this.buttonImage;
	};

	rat.ui.Button.prototype.setTextValue = function (value)
	{
		this.checkAndMakeTextBox().setTextValue(value);
		this.name = "<but>" + this.id + "(" + value + ")";
	};

	rat.ui.Button.prototype.translateAndSetTextValue = function (value)
	{
		this.name = "<but>" + this.id + "(" + value + ")";
		this.checkAndMakeTextBox().translateAndSetTextValue(value);
	};
	
	rat.ui.Button.prototype.setFont = function (font)
	{
		this.checkAndMakeTextBox().setFont(font);
	};

	rat.ui.Button.prototype.setFontStyle = function (style)
	{
		this.checkAndMakeTextBox().setFontStyle(style);
	};

	rat.ui.Button.prototype.setFontSize = function (size)
	{
		this.checkAndMakeTextBox().setFontSize(size);
	};

	//	set text colors for this button
	//	This is the easy comfortable version, where you specify common colors.
	//	For more control, see setStateTextColors
	rat.ui.Button.prototype.setTextColors = function (color, colorHi, colorPressed, colorDisabled)
	{
		//	provide some defaults if not specified
		//	(todo: do this in a lower-level array-based function so everyone benefits? not sure how to best do that.)
		if (typeof colorHi === 'undefined')
			colorHi = color;
		if (typeof colorPressed === 'undefined')
			colorPressed = color;
		if (typeof colorDisabled === 'undefined')
			colorDisabled = color;

		//	build on top of the function setStateTextColors(), which does what we want in a generic way.
		var RE = rat.ui.Element;	//	for readability
		var statePairs = [
			{state: RE.enabledFlag, textColor: color},	//	normal
			{state: RE.enabledFlag | RE.highlightedFlag, textColor: colorHi},	//	highlighted
			{state: RE.enabledFlag | RE.pressedFlag, textColor: colorPressed},	//	pressed
			{state: RE.enabledFlag | RE.toggledFlag, textColor: colorPressed},	//	toggled
			{state: RE.enabledFlag | RE.toggledFlag | RE.highlightedFlag, textColor: colorHi},	//	toggled highlighted
			{state: RE.enabledFlag | RE.toggledFlag | RE.pressedFlag, textColor: color},	//	toggled pressed
			{state: 0, textColor: colorDisabled},	//	disabled
		];
		this.setStateTextColors(statePairs);
	};
	
	//	A very flexible way to set up text color states that match various possible button states.
	//	This will add text color info to any matching state, or create a new state if it needs to.
	//	We expect to be passed in an array of state+color pairs, like this:
	//	[
	//		{state: rat.ui.Element.enabledFlag, textColor: rat.graphics.white},
	//		{state: rat.ui.Element.enabledFlag | rat.ui.Element.highlightedFlag, textColor: new rat.graphics.Color(10,200,150)},
	//		{state: rat.ui.Element.enabledFlag | rat.ui.Element.toggledFlag | rat.ui.Element.highlightedFlag | , textColor: rat.graphics.gray},
	//	]
	//
	rat.ui.Button.prototype.setStateTextColors = function (stateColorPairs)
	{
		this.setStatesByField(stateColorPairs, 'textColor');
	};
	rat.ui.Button.prototype.setTextColorStates = rat.ui.Button.prototype.setStateTextColors;	//	old name, backwards compat
	
	//	same thing for base color
	rat.ui.Button.prototype.setStateColors = function (stateColorPairs)
	{
		this.setStatesByField(stateColorPairs, 'color');
	};
	
	//	same thing for frame color
	rat.ui.Button.prototype.setStateFrameColors = function (stateColorPairs)
	{
		this.setStatesByField(stateColorPairs, 'frameColor');
	};
	
	//
	//	A very flexible way to set up images that match various possible button states.
	//	This will work for image buttons, bubble buttons, etc.
	//	This will add image info to any matching state, or create a new state if it needs to.
	//	We expect to be passed in an array of state+resource settings, like this:
	//	[
	//		{state: rat.ui.Element.enabledFlag, resource: "normal.png"},
	//		{state: rat.ui.Element.enabledFlag | rat.ui.Element.highlightedFlag, resource: "high.png"},
	//		{state: rat.ui.Element.enabledFlag | rat.ui.Element.toggledFlag | rat.ui.Element.highlightedFlag, resource: "toggled_and_highlighted.png"},
	//	]
	//	Alternatively, provide in an imageRef directly, instead of a resource, and we'll use that.
	//	Or, set imageRef to null explicitly, if you want us to NOT draw an image in that state.
	//
	//	Use "doUpdate" flag to control whether or not images are automatically updated by this button on each frame.
	//	This is useful, for instance, if you want to use the same image in multiple states, but only want it to be updated once.
	//	By default, doUpdate is set to true for state images, so all images update at the same time, which is nice for keeping state image animations in sync.
	//	If you want to NOT update each image, e.g. if you're reusing the same imageref, then be sure to set doUpdate to false in the data you pass in, e.g.
	//		{ state: rat.ui.Element.enabledFlag, imageRef : myImage, doUpdate : false},
	//	Or, alternatively, use multiple imagerefs, which is kinda what they're for.  They're supposed to be lightweight.
	//	(which might be an argument for removing this "doUpdate" flag stuff entirely anyway)
	//		
	rat.ui.Button.prototype.setStateImages = function (stateImageSets, extra1, extra2)
	{
		//	We're going to set imageRef values below.
		//	But first, for the caller's convenience, let's build imageRef values if they provided a simple resource name instead.
		for (var i = 0; i < stateImageSets.length; i++)
		{
			var set = stateImageSets[i];
			
			//	note:  If imageRef is undefined, go ahead and look for resource.
			//	if imageRef is null, that means they specifically set it that way, and we should respect that, and use null as our value.
			if (typeof(set.imageRef) === "undefined")
			{
				if (!set.resource)
					rat.console.log("Error:  no imageRef or image specified in setStateImages");
				set.imageRef = rat.graphics.makeImage(set.resource, extra1, extra2);
				if (Array.isArray(set.resource))
					set.imageRef.setAnimSpeed(1);	//	this is practically guaranteed to be the wrong speed, but at least designer will see it's animating..
			}
			
			//	and if they didn't define "doUpdate" flags, make some up.
			if (typeof(set.doUpdate) === "undefined")
			{
				set.doUpdate = true;
			}
		}
		
		this.setStatesByField(stateImageSets, 'imageRef');
		
		this.setStatesByField(stateImageSets, 'doUpdate');
	};
	
	//
	//	Low-level color state field setting utility, used by all the various "setStateXXXs" functions...
	//	This is an internal function.  In general, you want to instead call
	//		setStateImages
	//		setStateColors
	//		setStateTextColors
	//		setStateFrameColors
	//
	//	This is hopefully the main bottleneck for setting state values.
	//	A very flexible way to set up color states that match various possible button states.
	//	This will add info to any existing matching state, or create a new state if it needs to.
	//	We expect to be passed in an array of state+value pairs.  See other functions for examples and details.
	rat.ui.Button.prototype.setStatesByField = function(statePairs, fieldName)
	{
		if (!this.colorStates)	//	no states?  Create the list.
			this.colorStates = [];
	
		//	would it be better to set up some defaults?
		//if (typeof this.colorStates === 'undefined')
		//	this.setDefaultColorStates();
		
		for (var i = 0; i < statePairs.length; i++)
		{
			var statePair = statePairs[i];
			var stateIndex = this.getMatchingStateIndex(statePair.state, true);
			
			var value = statePair[fieldName];
			//	for any color type, support converting from standard style string, for convenience.
			if (fieldName === 'textColor' || fieldName === 'color' || fieldName === 'frameColor')
			{
				if (typeof(value) === 'string')
					value = rat.graphics.Color.makeFromStyleString(value);
			}
			
			this.colorStates[stateIndex][fieldName] = value;
		}
		
		//	let's assume we're setting them because we're using them immediately to set/change the look of the button.
		this.setDirty(true);
	};
	
	//	find exact matching color state in our list,
	//	create new state entry if there wasn't one.
	//	Note that this is VERY different from findBestStateMatch below!
	//	This function matches only exactly, and creates a new entry, so only use it on button creation/setup...
	/**
	 * @param {?} state
	 * @param {boolean=} createNew
	 */
	rat.ui.Button.prototype.getMatchingStateIndex = function(state, createNew)
	{
		//	look for color state with the exact same flags.
		if (!this.colorStates)
			return -1;
		var foundIndex = -1;
		for (var lookIndex = 0; lookIndex < this.colorStates.length; lookIndex++)
		{
			if (this.colorStates[lookIndex].flags === state)
				return lookIndex;
		}
		if (foundIndex < 0)	//	if not found, add to end
		{
			if (!createNew)
				return -1;
				
			foundIndex = this.colorStates.length;
			this.colorStates[foundIndex] = {
				flags: state,
				textColor: rat.graphics.white,	//	need better system of defaults
			};
		}
		return foundIndex;
	};
	
	//	return state structure reference that matches this state,
	//	e.g. for modification of a particular state of a button, e.g. for changing image animation speed
	rat.ui.Button.prototype.getMatchingState = function(state)
	{
		var index = this.getMatchingStateIndex(state);
		if (index >= 0)
			return this.colorStates[index];
		return null;
	};
	
	//
	//	Position text at this offset.
	//	This means stop centering and put it at this specific location.
	//
	rat.ui.Button.prototype.setTextOffset = function (x, y)
	{
		//this.textOffset.x = x;
		//this.textOffset.y = y;

		if (this.text)
		{
			if (this.text.place.pos.x !== x || this.text.place.pos.y !== y)
				this.setDirty(true);
			
			this.text.place.pos.x = x;
			this.text.place.pos.y = y;
			this.text.setAlign(rat.ui.TextBox.alignLeft);
			this.text.setBaseline(rat.ui.TextBox.baselineTop);
		}
	};

	rat.ui.Button.prototype.setStroke = function (w, c, d)
	{
		this.checkAndMakeTextBox();
		this.text.setStroke(w, c, d);
	};

	//	utility to find the best match for given state list (or our state list, if none were specified)
	//	todo: add priority, if number of matching flags is the same?
	//		or switch to first-is-best?
	//	todo: prioritize 'pressed' match over 'highlight' match, since that's a more important state to show?
	//	return matching state.
	/** 
	 * @param {?} _flags
	 * @param {?} _states
	 */
	rat.ui.Button.prototype.findBestStateMatch = function (_flags, _states)
	{
		if (typeof _flags === 'undefined')
			_flags = this.flags;
		if (!_states)
			_states = this.colorStates;
		if (!_states)
			return null;
			
		var bestIndex = 0;
		var bestFlags = 0;
		for (var i = 0; i < _states.length; i++)
		{
			var matchFlags = 0;
			for (var b = 0; b < 4; b++)
			{
				var checkBit = 1 << b;
				if ((_flags & checkBit) === (_states[i].flags & checkBit))
					matchFlags++;
			}
			if (matchFlags >= bestFlags)	//	if better or equal (latest is best), remember it
			{
				bestIndex = i;
				bestFlags = matchFlags;
			}
		}
		return _states[bestIndex];
	};

	//	called every frame to make sure we're displaying the way we want.
	//	because it's an every frame thing, this is a bad place to worry about dirty flags.
	//	Dirty note:  We assume our dirty flag is set earlier in other cases, like our display-related flags being changed.
	//		If that turns out to be too loose, we'd better do this work before rat.ui.Element.draw decides we're not dirty...
	//		(which happens before drawSelf is called)
	rat.ui.Button.prototype.updateDisplayState = function ()
	{
		var displayState;
		if (typeof this.colorStates !== 'undefined')
		{
			displayState = this.findBestStateMatch(this.flags, this.colorStates);
			if (this.text)
			{
				if (displayState.textColor)
					this.text.setColor(displayState.textColor);
				if (displayState.font)
				{
					if (displayState.font.font)
						this.text.setFont(displayState.font.font);
					if (displayState.font.size)
						this.text.setFontSize(displayState.font.size);
				}
				if (displayState.stroke)
					this.text.setStroke(displayState.stroke.lineWidth || 0, displayState.stroke.color, displayState.stroke.doCleanup);
			}
		}
		return displayState;
	};

	//	Draw this button
	//	The final look depends on current state
	rat.ui.Button.prototype.drawSelf = function ()
	{
		var ctx = rat.graphics.getContext();
		//	based on state, change which image our bubble box uses to draw...
		//	We have many potential state combinations, and may not have all the possible art,
		//	which is to be allowed,
		//	so just try to pick the best possible image...

		//	see if we have display data (colors, images) based on state, regardless of type.
		//	this gets set up for cheap buttons as well as other types if their text colors are explicitly set.
		var displayState = this.updateDisplayState();

		//	cheap button
		if ((this.type === rat.ui.Button.cheapType) && (typeof displayState !== 'undefined'))
		{
			ctx.fillStyle = displayState.color.toString();
			ctx.fillRect(-this.center.x, -this.center.y, this.size.x, this.size.y);

			var lineWidth = 4;
			ctx.lineWidth = lineWidth;
			ctx.strokeStyle = displayState.frameColor.toString();
			//ctx.strokeRect(-this.center.x + lineWidth / 2, -this.center.y + lineWidth / 2, this.size.x - lineWidth, this.size.y - lineWidth);
			ctx.strokeRect(-this.center.x - lineWidth / 2, -this.center.y - lineWidth / 2, this.size.x + lineWidth, this.size.y + lineWidth);

		} else if (typeof this.buttonImage !== 'undefined')
		{
			//	based on state, update our buttonImage, which is a direct reference to a subelement with an image in it. (see above).
			//	so, we change it here, and let it draw itself eventually.

			if (displayState && displayState.imageRef)	//	did we find a nice state match above with an image?
			{
				this.buttonImage.imageRef = displayState.imageRef;

			} else
			{	//	old - use baked-in variables to update image
				if ((this.flags & rat.ui.Element.enabledFlag) === 0)
				{
					this.buttonImage.imageRef = this.imageDisabled;
				} else if ((this.flags & rat.ui.Element.pressedFlag) || (this.flags & rat.ui.Element.toggledFlag))
				{
					//console.log("drawing pressed " + this.name);
					this.buttonImage.imageRef = this.imagePressed;
				} else if (this.flags & rat.ui.Element.highlightedFlag)
				{
					//console.log("drawing high " + this.name);
					this.buttonImage.imageRef = this.imageHi;
				}
				else
				{
					//console.log("drawing normal " + this.name);
					this.buttonImage.imageRef = this.imageNormal;
				}
			}

		}
	};
	
	//	do we need to update button look?
	rat.ui.Button.prototype.updateSelf = function (dt)
	{
		//	update color states, if any
		if (typeof this.colorStates !== 'undefined')
		{
			//var foundIndex = -1;
			for (var lookIndex = 0; lookIndex < this.colorStates.length; lookIndex++)
			{
				//	update image, if any, and if we're supposed to.
				
				//	In order to avoid double-update, don't update any image that's also our current sprite's image, since that gets updated already.
				//	Is this kludgey?  I'm not sure.  Seems OK for now.
				if (this.buttonImage && this.buttonImage.imageRef && this.buttonImage.imageRef === this.colorStates[lookIndex].imageRef)
					continue;
					
				if (this.colorStates[lookIndex].imageRef && this.colorStates[lookIndex].doUpdate)
					this.colorStates[lookIndex].imageRef.update(dt);
			}
		}
	};
	
	//	This function is called for us if any of our state flags (highlight, etc.) changed.
	rat.ui.Button.prototype.flagsChanged = function (oldFlags)
	{
		//	inherited behavior
		rat.ui.Button.prototype.parentPrototype.flagsChanged.call(this);
		
		//	see if we need to update a state based on this.
		//	(stuff we only want to do at the instant the state changes, not during update/draw)
		var displayState = this.findBestStateMatch();
		if (displayState && displayState.imageRef)
		{
			//	reset any one-shot anims.
			if (displayState.imageRef.isAnimOneShot())
				displayState.imageRef.restartAnim();
		}
		
		//	Note that dirty flag setting here is totally handled by the rat.ui.Element.prototype.checkFlagsChanged function.
	};

	//	handle ui-level input event explicitly, so that "enter" ui event triggers this button.
	rat.ui.Button.prototype.handleUIInput = function (event)
	{
		rat.console.log("button ui");
		if (event.which === 'enter')
		{
			if (this.trigger())
				rat.eventMap.fireEvent("uiTriggered", this);

		}
	};

	//	press me (change my state, trigger my callbacks, etc.)
	rat.ui.Button.prototype.trigger = function ()
	{
		if (this.toggles)
		{
			var oldFlags = this.flags;
			if (this.flags & rat.ui.Element.toggledFlag)
				this.flags &= ~rat.ui.Element.toggledFlag;	//	clear
			else
				this.flags |= rat.ui.Element.toggledFlag;	//	set
			this.checkFlagsChanged(oldFlags);
		}
		return rat.ui.Button.prototype.parentPrototype.trigger.call(this); //	inherited trigger
	};
	
	//	handle mouse down event, so we can clearly mark this event handled (eaten up).
	rat.ui.Button.prototype.mouseDown = function (pos, ratEvent)
	{
		//	call inherited to get correct flags cleared/set
		rat.ui.Button.prototype.parentPrototype.mouseDown.call(this);
		
		if (this.flags & rat.ui.Element.enabledFlag)	//	we're a button - we totally handled this click.
			return true;
			
		return false;
	};
	
	//	internal util: automatically size a button to its art
	function autoSizeButton(button)
	{
		button.setSize(button.buttonImage.size.x, button.buttonImage.size.y);
	}
	
	rat.ui.Button.prototype.autoSize = function ()
	{
		if (this.buttonImage.size.x === 0)
			this.buttonImage.setOnLoad(autoSizeButton, this);
		else
			autoSizeButton(this);
	};
	
	rat.ui.Button.prototype.setToggles = function (toggles)
	{
		this.toggles = toggles;
	};
	
	//	reset the default text inset value for all future buttons
	//	(and for all buttons that haven't been changed from the default, and might get their textbox rebuilt)
	rat.ui.Button.setDefaultTextInset = function(value)
	{
		rat.ui.Button.prototype.textInset = value;
	};

	/**
	 * Handle setting this up from data
	 */
	rat.ui.Button.setupFromData = function (pane, data, parentBounds)
	{
		rat.ui.data.callParentSetupFromData(rat.ui.Button, pane, data, parentBounds);

		data.extra1 = data.extra1 || void 0;
		data.extra2 = data.extra2 || void 0;

		if (data.buttonType === rat.ui.Button.cheapType)
		{
			pane.setupButton(data.buttonType, void 0, void 0, void 0, void 0, data.extra1, data.extra2);
			pane.colorStates = data.colors || data.color;
			if (Array.isArray(pane.colorStates) === false)
				pane.colorStates = rat.ui.Button.createStandardColorStates(pane.colorStates);

			//	MUST happen after we call setupButton
			if (data.toggles !== void 0)
			{
				pane.setToggles(true);
				pane.setToggled(!!data.toggled);
			}
		}
		else if (data.buttonType === rat.ui.Button.bubbleType ||
				 data.buttonType === rat.ui.Button.spriteType)
		{
			pane.setupButton(
				data.buttonType,
				data.res || data.resource,
				data.resHi || data.resourceHi,
				data.resPressed || data.resourcePressed,
				data.resDisabled || data.resourceDisabled,
				data.extra1,
				data.extra2);
			if (data.toggles)
			{
				//	MUST happen AFTER setupButton
				pane.setToggles(true);
				pane.setToggled(!!data.toggled);

				///TODO Support setting the toggle images here.
			}
		}

		//	Setup my text
		//	This font handling is currently the same as rat.ui.TextBox
		if (data.font)
		{
			if (data.font.font)
				pane.setFont(data.font.font);
			if (data.font.size)
				pane.setFontSize(data.font.size);
			if (data.font.style)
				pane.setFontStyle(data.font.style);
			if (data.font.stroke)
				pane.setStroke(data.font.stroke.width, data.font.stroke.color);
		}
		//- Note that if you are using a cheap button, this setColor call will make no difference,
		//	because cheap buttons have a text color per button state, not just one color.
		//	see rat.ui.Button.createStandardColorStates() function.
		if (data.textColor)
			pane.checkAndMakeTextBox().setColor(data.textColor);
		
		if( data.text )
			pane.translateAndSetTextValue(data.text);
		
		if (data.textUseOffscreen !== void 0)
			pane.checkAndMakeTextBox().setUseOffscreen(data.textUseOffscreen);
	};
	
});
//
//	Firebase implementation of our standard storage API.
//
//	Usage:
//
//		get a firstbase storage reference explicitly.
//		Unlike other storage implementations, we don't hand one of these back from rat.storage.getStorage(),
//		because it's a more specialized case.  So, just create your own reference like this:
//
//			var storage = new rat.FirebaseStorage('address', 'prefix', userID);
//
//		address should be something like : "https://holiday.firebaseio.com/whatever/storage/"
//		
//		very important that you provide a reasonable specific path there, because we immediately request all data under that path.
//
//		if user ID is not specified, a common shared storage is used.
//			todo: support automatic user ID assignment like r_telemetry?
//
//		then use normally:
//
//			storage.setItem("hey", 12);
//			var x = storage.getItem("hey");
//			storage.setObject("frank", { age: 12, friends: 3 });
//
rat.modules.add("rat.storage.r_storage_firebase",
[
	{ name: "rat.storage.r_storage", processBefore: true },

	"rat.debug.r_console",

	//Would it be possible to somehow list firebase as a module here.
	//	Would need firebase to be in rat

],
function (rat)
{
	///
	/// Firebase storage object
	/// @constructor 
	/// @extends rat.BasicStorage
	///
	rat.FirebaseStorage = function (address, prefix, userID)
	{
		rat.FirebaseStorage.prototype.parentConstructor.call(this, prefix); //	default init

		//	TODO:  UserID support.
		//		if a userID is supplied (and only if it's supplied), do everything in a subfolder of the storage firebase,
		//		instead of at the top level.  For now, this is unimplemented.
		//	TODO:  also optionally support rat_anon_id like telemetry module does.

		this.ref = null;
		if (typeof (Firebase) !== 'undefined')	//	is firebase even reachable?
		{
			var fullAddress = address;
			if (prefix && prefix !== '')
				fullAddress += "/" + prefix;
			this.ref = new Firebase(fullAddress);
		}
		if (!this.ref)
		{
			//	failed for one reason or another.  error message?  error state?
			return;
		}

		var self = this;
		this.data = void 0;	//	initially undefined.  Later, this will either have data, or be null (meaning there WAS no data)
		this.ref.once('value', function (snap)
		{
			//	grab data
			self.data = snap.val();
			//	tell people we got it
			self._fireOnReady();
		});

	};
	rat.utils.inheritClassFrom(rat.FirebaseStorage, rat.BasicStorage);

	/**
	* @suppress {missingProperties}
	*/
	rat.FirebaseStorage.prototype._internalSetItem = function (key, value)
	{
		if (!this.ref)
			return;
		var ref = this.ref;
		if (key && key !== '')
			ref = ref.child(key);
		ref.set(value);
	};

	/**
	* @suppress {missingProperties}
	*/
	rat.FirebaseStorage.prototype._internalGetItem = function (key)
	{
		//	we already requested data.  Let's hope we have it.
		if (!this.hasData())
			return null;

		if (key && key !== '')
			return this.data[key];
		else
			return this.data;
	};
	/**
	* @suppress {missingProperties}
	*/
	rat.FirebaseStorage.prototype.remove = function (key)
	{
		//	remove data at this location.
		var ref = this.ref;
		if (key && key !== '')
			ref = ref.child(key);
		ref.remove();
		this.data = null;
	};

	/** @suppress {checkTypes} */
	rat.FirebaseStorage.prototype.hasData = function ()
	{
		//	have I ever gotten my data from firebase?
		if (typeof (this.data) === 'undefined')
			return false;
		return true;
	};

});
/*

	rectangle list manager.

	Collect and manage a list of 2D rectangles.
	Handle adding, removing, coalescing overlapping rects, etc.
	
	useful for dirty rectangle lists, among other things.
*/
rat.modules.add("rat.graphics.r_rectlist",
[],
function (rat)
{
	///
	/// RectList object
	/// @constructor
	///
	rat.RectList = function ()
	{
		this.list = [];
	};
	//rat.RectList.prototype.blah = true;	//	whatever

	//	clear rect list
	rat.RectList.prototype.clear = function ()
	{
		this.list = [];
	};

	//	snap this rectangle to an even pixel alignment, one pixel around.
	//	This is important for some uses, when rectangles have fractional xywh values,
	//	particularly when we're dealing with antialiasing.
	//	The usage of this is optional, and handled automatically if turned on - see "snapEven" flag.
	//	Odd note:  When graphics are being scaled up (see rat.graphics.globalScale), this still has problems when we clip... :(
	//		How to fix that?  We ideally need these things to align to the final pixel, not to some value that later gets scaled anyway...
	//		One way to fix this is to use bigger target resolutions, instead of targetting small space and scaling up (target big space and scale down).
	//		Can we hack this for now by using bigger numbers?  Nope, it doesn't solve the problem with the final clip being misaligned when graphics applies its scale...
	rat.RectList.prototype.snap = function (addR)
	{
		var r = {};

		r.x = (addR.x - 1 | 0);	//	hmm... why is this -1 necessary?  It seems to be.  Maybe something about pixel scale?
		r.y = (addR.y - 1 | 0);
		r.w = ((addR.w + 1 + (addR.x - r.x) + 0.999999999) | 0);
		r.h = ((addR.h + 1 + (addR.y - r.y) + 0.999999999) | 0);

		return r;
	};

	//	add rect
	//	todo: maintain in some kind of binary searchable order
	rat.RectList.prototype.add = function (addR)
	{
		var r;
		//	if we're supposed to, then snap to outside even boundaries,
		//	to avoid problems with precision errors resulting in bad drawing.
		if (this.snapEven)
			r = this.snap(addR);
		else
			r = { x: addR.x, y: addR.y, w: addR.w, h: addR.h };	//	copy, so we don't get changed when original changes

		//	do some optimizations, based on this rectangle being similar to others already in the list.
		//	TODO: make this optional, based on flag during setup.
		for (var i = this.list.length - 1; i >= 0; i--)
		{
			var t = this.list[i];
			//	short names for right/bottom edges
			var rright = r.x + r.w;
			var rbottom = r.y + r.h;
			var tright = t.x + t.w;
			var tbottom = t.y + t.h;

			//	see if new rectangle is fully included already in another rectangle.
			//	if so, bail now! (don't add r at all)
			if (r.x >= t.x && r.y >= t.y && rright <= tright && rbottom <= tbottom)
			{
				//console.log("add rect inside existing");
				return;
			}
			//	If new rectangle fully includes an existing rectangle, remove *that* rectangle.
			//	keep looping, in case we end up including more than one!
			//	This means a new rectangle could eat up several existing ones, which is good.
			//	At the end of this loop, the new one will be added (or otherwise resolved).
			if (r.x <= t.x && r.y <= t.y && rright >= tright && rbottom >= tbottom)
			{
				//console.log("add rect outside existing");
				this.list.splice(i, 1);
				continue;
			}

			//	OK, the above checks are good and basically no-brainers.  Certainly effective.
			//	Here's where it's a little more heuristic.
			//	How much are these rects overlapping?  If a lot, merge them into one!
			//	Note that this is a very common case, because a moving object will almost always
			//		have a new bounds slightly shifted from previous bounds.
			//	We might need to make this optional, and configurable in how aggressive it is.
			//	TODO: deal with a need for multiple passes.  Merging rects could mean another existing rect is suddenly partly overlapped/consumed.
			//	TODO: optimize all this logic, especially combined with the above?  Maybe not a performance concern.
			//		e.g. quick check to see if there's any overlap at all, and if not, move on,
			//			and if so, then find out what kind, or entirely containing/contained, etc.
			//	TODO: yikes, lots of individual checks below.  Can somehow be simplified?
			var horizOverlap = 0;
			var vertOverlap = 0;
			var left, right, top, bottom;

			//	horizontal checks
			//	make sure there's *some* overlap
			if (!(rright < t.x || tright < r.x) && !(rbottom < t.y || tbottom < r.y))
			{
				if (r.x < t.x)	//	left edge of r is farther left
				{
					left = r.x;
					if (rright > tright)	//	r includes t entirely
					{
						horizOverlap = t.w;
						right = rright;
					} else
					{	//	r overlaps on left
						horizOverlap = rright - t.x;
						right = tright;
					}
				} else
				{
					left = t.x;
					if (tright > rright)	//	t includes r entirely
					{
						horizOverlap = r.w;
						right = tright;
					} else
					{	//	r overlaps on right
						horizOverlap = tright - r.x;
						right = rright;
					}
				}

				//	now vertical cases
				if (r.y < t.y)	//	top edge of r is farther up
				{
					top = r.y;
					if (rbottom > tbottom)	//	r includes t entirely
					{
						vertOverlap = t.h;
						bottom = rbottom;
					} else
					{	//	r overlaps on top
						vertOverlap = rbottom - t.y;
						bottom = tbottom;
					}
				} else
				{
					top = t.y;
					if (tbottom > rbottom)	//	t includes r entirely
					{
						vertOverlap = r.h;
						bottom = tbottom;
					} else
					{	//	r overlaps on bottom
						vertOverlap = tbottom - r.y;
						bottom = rbottom;
					}
				}

				//	now, is that overlap worth it?  At this point we assume horizOverlap and vertOverlap are defined.
				//	For now, require our overlap to be X% of r, but could also check t.
				//	The idea here is that we don't want to always merge.  If 2 rects are barely touching, merging them might resulting
				//	in a lot of things being dirtied that don't really need it.  So, just merge if they're pretty close...
				if (horizOverlap * vertOverlap > r.w * r.h * 0.7)
				{
					//	Huh?
					if (t.x + t.w > right)
					{
						console.log("LOSS");
					}

					//	merge into new r
					r.x = left;
					r.y = top;
					r.w = right - left;
					r.h = bottom - top;
					//	like above, let's kill t in the list and continue looping.
					this.list.splice(i, 1);
				}

			}	//	end of total overlap check


		}	//	end of loop through existing rects

		//	we made it through with r intact - go ahead and add it.
		this.list.push(r);
	};
	//	remove rect, judging from position/size
	//rat.RectList.prototype.remove = function (r)
	//{
	//	//	NOT IMPLEMENTED.
	//};

	//	return true if this rect intersects at all with any rect in my list.
	rat.RectList.prototype.hits = function (r)
	{
		if (this.snapEven)
			r = this.snap(r);

		for (var i = 0; i < this.list.length; i++)
		{
			var t = this.list[i];
			if (r.x + r.w >= t.x
					&& r.x <= t.x + t.w
					&& r.y + r.h >= t.y
					&& r.y <= t.y + t.h)
				return true;
		}

		return false;
	};

	//	Useful utilities - not always needed, but when this rectlist is used as a dirty list, these are nice.

	//	erase all our rects from this ctx
	rat.RectList.prototype.eraseList = function (ctx)
	{
		for (var i = 0; i < this.list.length; i++)
		{
			var t = this.list[i];
			ctx.clearRect(t.x, t.y, t.w, t.h);
		}
	};

	//	set ctx clip region to the total dirty space.
	//	!!
	//		This does a context save, so you MUST CALL unclip() below when you're done with this clipping operation.
	//	!!
	//	useList here is optional, and generally not useful outside debugging.  Usually, you want to use this rectList's list.
	rat.RectList.prototype.clipToList = function (ctx, useList)
	{
		ctx.save();
		this.listToPath(ctx, useList);
		ctx.clip();

	};
	rat.RectList.prototype.unclip = function (ctx)
	{
		ctx.restore();
	};

	//	make a path in the given ctx using our rect list
	//	(or another list, if one was given to us - mostly useful for debugging)
	rat.RectList.prototype.listToPath = function (ctx, list)
	{
		if (!list)
			list = this.list;
		ctx.beginPath();
		for (var i = 0; i < list.length; i++)
		{
			var t = list[i];
			//ctx.rect(t.x, t.y, t.w, t.h);
			ctx.moveTo(t.x, t.y);
			ctx.lineTo(t.x + t.w, t.y);
			ctx.lineTo(t.x + t.w, t.y + t.h);
			ctx.lineTo(t.x, t.y + t.h);
			ctx.lineTo(t.x, t.y);
		}
	};

});

//
//	Word wrapping utils
//	This can get quite complicated depending on the language.
//	So, for now, just supporting English.
//	Later, see http://en.wikipedia.org/wiki/Word_wrap
//	and http://en.wikipedia.org/wiki/Line_breaking_rules_in_East_Asian_language
//	and http://msdn.microsoft.com/en-us/goglobal/bb688158.aspx , which is a pretty good reference.
//	and we might need to change canBreakBetween to take different arguments.
//		e.g. what if we think we can break after a space because the two chars are ' ' and 'T', but BEFORE that,
//		there was a non-allowed end-of-line character (e.g. '*' in chinese)?
//		Though, why would there be a space after non-allowed-end-of-line?  Maybe we can ignore that and assume breaking after a space is always OK.
rat.modules.add( "rat.utils.r_wordwrap",
[
	"rat.debug.r_console",
], 
function(rat)
{
	rat.wordwrap = {

		isWhitespace : function(char)
		{
			//	these characters we consider whitespace.  Are there more?
			//	we should not count non-breaking space as whitespace (0x00a0)
			//	0x3000 is ideographic space
			return (char === ' ' || char === '\t' || char === '\n' || char === '\r' || char === String.fromCharCode(0x3000));
		},

		skipWhitespaceAhead : function(string, pos)
		{
			for (; pos < string.length; pos++)
			{
				if (!rat.wordwrap.isWhitespace(string.charAt(pos)))
					return pos;
			}
			return pos;
		},
		
		//	We need to be able to say generally don't break up Latin/Cyrillic words,
		//	but DO break up anything else.  So, for now, let's try this.  Anything alphabetic should not be broken up.
		//	note: greek is in 0x3FF range
		isAlphabetic : function(charCode)
		{
			return (charCode < 0x1000);
		},

		//	French has annoying rules about two-part punctuation where a space preceeds a mark, like " ?"
		isTwoPartPunctuation : function(charX)
		{
			return (charX === '?' || charX === '!' || charX === ';' || charX === ':');
		},
		
		//	OK, basically, we're going to allow wrapping anywhere there's a whitespace or a hyphen
		//	don't bother checking if char1 is whitespace, since we should have already marked this as breakable when char2 was whitespace
		
		//	TODO:  For french, we need to look farther forward.  :(
		//	e.g. we may be testing "x ", but we can't break there if the next character is "?".
		//	Change this to pass in a full string and offset, or something?
		//	also read up on multi-part wrapping - is there a rule for "! "?
		canBreakBetween : function(char1, char2)
		{
			var code1 = char1.charCodeAt(0);
			var code2 = char2.charCodeAt(0);
			
			//	let's start with the idea that we should not break
			var canBreak = false;
			//	but if we're dealing with CJK, the general rule is it's OK to break anywhere
			if (!rat.wordwrap.isAlphabetic(code1) || !rat.wordwrap.isAlphabetic(code2))
				canBreak = true;
			
			//	or if we're whitespace or hyphen
			if (rat.wordwrap.isWhitespace(char2) || char1 === '-')
				canBreak = true;
			
			//	except for a bunch of exceptions!
			//	I adapted what we've learned from XBLA games.
			//	I haven't explicitly checked these rules against the various online docs.
			if (rat.wordwrap.isNonBeginningChar(code2) ||
					rat.wordwrap.isNonEndingChar(code1)
					//|| (char1 === ' ' && rat.wordwrap.isTwoPartPunctuation(char2))
					//|| (char2 === ' ' && rat.wordwrap.isTwoPartPunctuation(char1))
			)
				canBreak = false;
			
			return canBreak;
		},

		//
		//	break this string into an array of lines, based on various word wrapping rules.  What fun!
		//	It is assumed that the given context is set up correctly with the font we care about.
		//	We do not hyphenate.  If your line simply can't be broken up, we just chop it wherever (currently, after the first char).
		//
		//	return the array of lines.
		wrapString : function(string, maxWidth, ctx)
		{
			var lines = [];
			var curStart = 0;
			var lastBreakEnd = 0;	//	end of line leading up to break
			var lastBreakStart = 0;	//	start of line after break (might not be the same if there's whitespace, which we eat up)

			//	I think this approach is reasonable and robust:
			//	walk through the string.  remember last breakable point.
			//	When string gets bigger than max width, go back and break at last breakable point.
			//	If there was no good breakable point, break where we got too wide.
			//		We have to break *somewhere* rather than go out of bounds, e.g. into non-title-safe area
			
			//	utility to accept this one line into the list of lines
			function takeLine(start, end)
			{
				lines.push(string.substring(start, end));
				//console.log("breaking at " + end + " : " + lines[lines.length-1]);
			}

			//	walk through full text
			for (var i = 0; i < string.length; i++)
			{
				//	always break on manual breaks...
				if (string[i] === '\n')
				{
					takeLine(curStart, i);
					curStart = i+1;	//	skip \n
					lastBreakEnd = lastBreakStart = curStart;	//	just start with some reasonable defaults
					continue;
				}

				//	check if this character puts us over the limit, and we need to break first
				var testString = string.substring(curStart, i+1);
				var metrics = ctx.measureText(testString);
				var testWidth = metrics.width || metrics;
				if (testWidth >= maxWidth)
				{
					if (lastBreakEnd === curStart)	//	we never found a good breaking place!
					{
						//	we are forced to just cut off somewhere else, rather than overlap our bounds.
						//	This is a case where the content creator must change the text or the space we have to work with.
						//	Cut off right before this new character, since it's what put us over.
						rat.console.log("bad wrap at " + i);
						lastBreakEnd = lastBreakStart = i;
					}
					takeLine(curStart, lastBreakEnd);
					curStart = lastBreakEnd = lastBreakStart;
				}

				//	now check if we can break after this character, and remember that for future use.
				if (i === string.length-1 || //	always can break after final char, and it won't matter - just short-circuit next expression
						rat.wordwrap.canBreakBetween(string.charAt(i), string.charAt(i+1))	//	OK to break here
					)
				{
					lastBreakEnd = i+1;
					//	if we CAN break here, then skip ahead past any whitespace, so we don't start a new line with empty space.
					lastBreakStart = rat.wordwrap.skipWhitespaceAhead(string, i+1);
				}
			}

			//	pick up the rest of the final line, if any
			if (curStart !== string.length)
			{
				takeLine(curStart, string.length);
			}

			return lines;
		},
		
		//	these characters are not allowed to begin a line
		//	c is charCode, not character or string
		//	TODO: These tables don't seem to match http://msdn.microsoft.com/en-us/goglobal/bb688158.aspx
		isNonBeginningChar : function (c)
		{
			return (
				c === 0x0045 ||		//	no hyphens at start of line
				c === 0x00a0 ||		//	no non-breaking spaces at the start of a line
				c === 0xff0c ||		// 
				c === 0xff0e ||		// 
				c === 0xff1a ||		// 
				c === 0xfe30 ||		// 
				c === 0xfe50 ||		// 
				c === 0x00B7 ||		// 
				c === 0xfe56 ||		// 
				c === 0xff5d ||		// 
				c === 0x300F ||		// 
				c === 0xfe5c ||		// 
				c === 0x201D ||		// 
				c === 0x003A ||		// 
				c === 0x005D ||		// 
				c === 0x2022 ||		// 
				c === 0x2027 ||		// 
				c === 0x2026 ||		// 
				c === 0xfe51 ||		// 
				c === 0xfe54 ||		// 
				c === 0xfe57 ||		// 
				c === 0x3011 ||		// 
				c === 0x300D ||		// 
				c === 0xfe5e ||		// 
				c === 0x301E ||		// 
				c === 0x003B ||		// 
				c === 0x007D ||		// 
				c === 0xff1b ||		// 
				c === 0xff01 ||		// 
				c === 0xfe52 ||		// 
				c === 0xfe55 ||		// 
				c === 0x3015 ||		// 
				c === 0x3009 ||		// 
				c === 0xfe5a ||		// 
				c === 0x2019 ||		// 
				c === 0x2032 ||		// 
				c === 0x0025 ||		// 
				c === 0x00B0 ||		// 
				c === 0x2033 ||		// 
				c === 0x2103 ||		// 
				c === 0x300b ||		// 
				c === 0xff05 ||		// 
				c === 0xff3d ||		// 
				c === 0xffe0 ||		// 
				c === 0x2013 ||		// 
				c === 0x2014 ||		// 
				c === 0xff61 ||		// 
				c === 0xff64 ||		// 
				c === 0x3063 ||		// 
				c === 0x3083 ||		// 
				c === 0x3085 ||		// 
				c === 0x3087 ||		// 
				c === 0x30c3 ||		// 
				c === 0x30e3 ||		// 
				c === 0x30e5 ||		// 
				c === 0x30e7 ||		// 
				c === 0x3041 ||		// 
				c === 0x3043 ||		// 
				c === 0x3045 ||		// 
				c === 0x3047 ||		// 
				c === 0x3049 ||		// 
				c === 0x308e ||		// 
				c === 0x30a1 ||		// 
				c === 0x30a3 ||		// 
				c === 0x30a5 ||		// 
				c === 0x30a7 ||		// 
				c === 0x30a9 ||		// 
				c === 0x30ee ||		// 
				c === 0x0022 ||		// Quotation mark
				c === 0x0021 ||		// Exclamation mark
				c === 0x0029 ||		// Right parenthesis
				c === 0x002c ||		// Comma
				c === 0x002e ||		// Full stop (period)
				c === 0x003f ||		// Question mark
				c === 0x3001 ||		// Ideographic comma
				c === 0x3002 ||		// Ideographic full stop
				c === 0x30fc ||		// Katakana-hiragana prolonged sound mark
				c === 0xff01 ||		// Fullwidth exclamation mark
				c === 0xff09 ||		// Fullwidth right parenthesis
				c === 0xff1f ||		// Fullwidth question mark
				c === 0xff70 ||		// Halfwidth Katakana-hiragana prolonged sound mark
				c === 0xff9e ||		// Halfwidth Katakana voiced sound mark
				c === 0xff9f
			);		// Halfwidth Katakana semi-voiced sound mark
		},
		
		//	these characters are not allowed to end a line
		//	c is charCode, not character or string
		isNonEndingChar : function(c)
		{
			return (
				c === 0x3010 ||		// 
				c === 0x300C ||		// 
				c === 0xfe5d ||		// 
				c === 0x301D ||		// 
				c === 0x005B ||		// 
				c === 0x3014 ||		// 
				c === 0x3008 ||		// 
				c === 0xfe59 ||		// 
				c === 0x2018 ||		// 
				c === 0x2035 ||		// 
				c === 0x007B ||		// 
				c === 0xff5b ||		// 
				c === 0x300E ||		// 
				c === 0xfe5b ||		// 
				c === 0x201C ||		// 
				c === 0x005C ||		// 
				c === 0x0024 ||		// 
				c === 0xffe1 ||		// 
				c === 0x300A ||		// 
				c === 0xff04 ||		// 
				c === 0xff3b ||		// 
				c === 0xffe6 ||		// 
				c === 0xffe5 ||		// 
				c === 0x0022 ||		// Quotation mark
				c === 0x0028 ||		// Left parenthesis
				c === 0xff08		// Fullwidth left parenthesis
			);
		},
	};
	
} );

//----------------------------
//	bubblebox ui element
//	renders with a loaded image
//	maybe make a subclass of sprite to inherit image loading/handling?
rat.modules.add( "rat.ui.r_ui_bubblebox",
[
	{name: "rat.utils.r_utils", processBefore: true },
	{name: "rat.ui.r_ui", processBefore: true },
	
	"rat.math.r_vector",
	"rat.graphics.r_image",
	"rat.debug.r_console",
	"rat.graphics.r_graphics",
], 
function(rat)
{
	// NOTE: these definitions and settings allow us to draw differently (and faster) if the tiles are solid and stretchable
	// when manually doing lots of draw calls for tiling it can create significant performance problems on some hardware
	rat.ui.BubbleBox_TILE = 0;
	rat.ui.BubbleBox_STRETCH = 1;

	// the function rat.ui.BubbleBox_setDefaultDrawType(drawType) can be used to set this if desired
	rat.ui.BubbleBox_defaultDrawType = rat.ui.BubbleBox_TILE;

	/**
	 * @param {string=} resource
	 * @param {number=} drawType How does this bubble box draw (stretch/tile)
	 * @constructor
	 * @extends rat.ui.Element
	 */
	rat.ui.BubbleBox = function (resource, drawType)
	{
		rat.ui.BubbleBox.prototype.parentConstructor.call(this); //	default init
		this.blockSize = new rat.Vector(4, 4);	//	placeholder 'till we get our image
		this.resource = resource;
		if(resource !== void 0)
		{
			this.imageRef = new rat.graphics.ImageRef(resource);
			var self = this;
			this.imageRef.setOnLoad(function (img)
			{
				self.updateWithNewImage(img);
			});
		}
		this.name = "<bbl>" + resource + this.id;

		if(drawType)
			this.drawType = drawType;
		else
			this.drawType = rat.ui.BubbleBox_defaultDrawType;
		//	note that bubblebox is often used as a group, with stuff inside it, so don't turn off trackmouse
	};
	rat.utils.inheritClassFrom(rat.ui.BubbleBox, rat.ui.Element);
	rat.ui.BubbleBox.prototype.elementType = "bubbleBox";

	//	update internal calculations with newly loaded image
	//	(e.g. after load finishes)
	//	This is not the way to change my image.  I think there isn't such a function right now?
	//		todo:  add one.  Like sprites, call it loadImage().  And be sure to setDirty().
	rat.ui.BubbleBox.prototype.updateWithNewImage = function (image)
	{
		/*
		if (image == null) {
			rat.console.log("Liar! The image "+this.imageRef.image.imageFrames[0].src+" did not load.");
			return;
		}
		*/
		
		//	detect if the image is a 3x3 or a 4x4, in order to be more flexible.  Assume even pixel size will tell us...
		//	The 4x4 format is something we used in wraith.
		//	TODO: support the 9-tile format we've seen out there, where center spaces are bigger than outer spaces?
		var div = 4;
		if(image.width / 3 === rat.math.floor(image.width / 3))
			div = 3;
		this.blockSize = new rat.Vector(image.width / div, image.height / div);
		this.blockRows = 3; //	box
		if(image.height === image.width / div)	//	bar - just one row
		{
			this.blockRows = 1;
			this.blockSize.y = image.height;
		}
		
		this.setDirty(true);
	};
	
	//	todo:  why is there no update function here to support animating my imageRef?
	//	if we add one, be sure to consider setting my dirty state.

	rat.ui.BubbleBox.prototype.drawSelf = function ()
	{
		var ctx = rat.graphics.getContext();
		if(this.imageRef === void 0)
			return;
		var image = this.imageRef.getImage();
		if(image === null)
			return;

		//	Deal with scaling...
		//	If context is scaled, we aren't going to look very good, on some platforms (Win8, maybe IE?)
		//	So...  undo all transforms, calculate raw screen pixel points, and draw in a raw identity-matrix context
		//	TODO:  Does not play nicely with rotation, currently.  We need to extract rotation out of matrix or something?
		//	Or keep track of collected scale and rotation separately in rat.graphics.transform api.  Yeah, probably...
		var scaleHack = false;
		var width = rat.math.floor(this.size.x);
		var height = rat.math.floor(this.size.y);
		if((this.flags & rat.ui.Element.adjustForScaleFlag) &&
			(rat.graphics.mTransform.m[0][0] !== 1 || rat.graphics.mTransform.m[1][1] !== 1))
		{
			scaleHack = true;
			//var topLeft = rat.graphics.transformPoint(this.place.pos);
			//var botRight = rat.graphics.transformPoint({ x: this.place.pos.x + this.size.x, y: this.place.pos.y + this.size.y });
			var topLeft = rat.graphics.transformPoint({ x: 0, y: 0 });
			var botRight = rat.graphics.transformPoint({ x: this.size.x, y: this.size.y });

			rat.graphics.save();
			ctx.setTransform(1, 0, 0, 1, 0, 0);

			width = rat.math.floor(botRight.x - topLeft.x);
			height = rat.math.floor(botRight.y - topLeft.y);

			topLeft.x = rat.math.floor(topLeft.x);
			topLeft.y = rat.math.floor(topLeft.y);
			ctx.translate(topLeft.x, topLeft.y);

			//	special case for bubble bars (bubbles that only have one row)
			//	In this case, we are not actually tiling vertically, so we won't have artifacts.
			//	So, go ahead and scale vertically to get what we want.
			//	Will this look funny?
			if(this.blockRows === 1)
			{
				ctx.scale(1, height / this.size.y);
				height = this.size.y;
			}

			//	temp test
			//ctx.fillStyle = "#FFFFFF";
			//ctx.fillRect(topLeft.x, topLeft.y, 20, 20);
			//ctx.fillRect(botRight.x, botRight.y, 20, 20);

			/*
			var m11 = rat.graphics.mTransform.m[0][0];
			var m12 = rat.graphics.mTransform.m[1][0];
			var m21 = rat.graphics.mTransform.m[0][1];
			var m22 = rat.graphics.mTransform.m[1][1];
			var mdx = rat.math.floor(rat.graphics.mTransform.m[0][2]);
			var mdy = rat.math.floor(rat.graphics.mTransform.m[1][2]);
			ctx.setTransform(m11, m12, m21, m22, mdx, mdy);
			*/
		}

		var rows = height / this.blockSize.y;
		if(this.blockRows === 1)	//	support for bubble bars - just truncate to one row
			rows = 1;
		var rowsFloor = rat.math.floor(rows);
		var cols = width / this.blockSize.x;
		var colsFloor = rat.math.floor(cols);

		//console.log("rows, cols:  " + rows + ", " + cols);
		//console.log("blockSize: " + this.blockSize.x + ", " + this.blockSize.y);

		//	util to get pos and width of source tile, based on our position in the loop.
		//	useful for both x and y
		var tileWidth = 0;
		function getTileInfo(index, count, countFloor, pieceSize)
		{
			tileWidth = pieceSize;
			if(index === 0)	//	first tile - assume we're wide enough and just grab the whole thing
				return 0;
			else if(index >= count - 1)	//	last tile
			{
				//	special case...  we didn't have room for middle tiles, and our final tile is too wide, so crop it down, eating away from the left, leaving the right
				if(count > 1 && count < 2)
					tileWidth = (count - countFloor) * pieceSize;
				return pieceSize * 2 + (pieceSize - tileWidth);
			}
			else	//	middle tile - we crop the last middle tile to exactly fill space remaining before final tile
			{
				if(index >= countFloor - 1)
					tileWidth = (count - countFloor) * pieceSize;
				return pieceSize;
			}
		}

		var yPos = 0;
		var sourceX = 0, sourceY = 0, sourceWidth, sourceHeight;
		if(this.drawType === rat.ui.BubbleBox_TILE)
		{
			for(var y = 0; y < rows; y++)
			{
				sourceY = getTileInfo(y, rows, rowsFloor, this.blockSize.y);
				sourceHeight = tileWidth;

				var xPos = 0;
				for(var x = 0; x < cols; x++)
				{
					sourceX = getTileInfo(x, cols, colsFloor, this.blockSize.x);
					sourceWidth = tileWidth;

					//console.log("  draw " + x + "," + y);
					ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, xPos - this.center.x, yPos - this.center.y, sourceWidth, sourceHeight);
					//console.log("x draw " + x + "," + y);

					xPos += sourceWidth;
				}

				yPos += sourceHeight;
			}
		}
		else if(this.drawType === rat.ui.BubbleBox_STRETCH)
		{
			// nine total calls max instead of possibly hundreds

			// draw each of the nine elements once instead of tiling
			var farXPos = width - this.center.x;
			var farYPos = height - this.center.y;

			// top left corner y:0, x:0
			sourceY = getTileInfo(0, rows, rowsFloor, this.blockSize.y);
			sourceHeight = tileWidth;		// missed this the first time through because I didnt realize it was due to side effects from the function call
			sourceX = getTileInfo(0, cols, colsFloor, this.blockSize.x);
			sourceWidth = tileWidth;
			ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, -this.center.x, -this.center.y, sourceWidth, sourceHeight);

			// top right corner y:0, x:cols-1
			sourceY = getTileInfo(0, rows, rowsFloor, this.blockSize.y);
			sourceHeight = tileWidth;
			sourceX = getTileInfo(colsFloor, cols, colsFloor, this.blockSize.x);
			sourceWidth = tileWidth;
			ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, farXPos - sourceWidth, -this.center.y, sourceWidth, sourceHeight);

			// bottom left corner y:rows-1, x:0
			sourceY = getTileInfo(rowsFloor, rows, rowsFloor, this.blockSize.y);
			sourceHeight = tileWidth;
			sourceX = getTileInfo(0, cols, colsFloor, this.blockSize.x);
			sourceWidth = tileWidth;
			ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, -this.center.x, farYPos - sourceHeight, sourceWidth, sourceHeight);

			// bottom right corner y:rows-1, x:cols-1
			sourceY = getTileInfo(rowsFloor, rows, rowsFloor, this.blockSize.y);
			sourceHeight = tileWidth;
			sourceX = getTileInfo(colsFloor, cols, colsFloor, this.blockSize.x);
			sourceWidth = tileWidth;
			ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, farXPos - sourceWidth, farYPos - sourceHeight, sourceWidth, sourceHeight);

			if(cols > 2)
			{
				// top middle
				sourceY = getTileInfo(0, rows, rowsFloor, this.blockSize.y);
				sourceHeight = tileWidth;
				sourceX = getTileInfo(1, cols, colsFloor, this.blockSize.x);
				sourceWidth = tileWidth;
				ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, sourceWidth - this.center.x, -this.center.y, width - sourceWidth * 2, sourceHeight);

				// bottom middle
				sourceY = getTileInfo(rowsFloor, rows, rowsFloor, this.blockSize.y);
				sourceHeight = tileWidth;
				sourceX = getTileInfo(1, cols, colsFloor, this.blockSize.x);
				sourceWidth = tileWidth;
				ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, sourceWidth - this.center.x, farYPos - sourceHeight, width - sourceWidth * 2, sourceHeight);
			}

			if(rows > 2)
			{
				// left middle
				sourceY = getTileInfo(1, rows, rowsFloor, this.blockSize.y);
				sourceHeight = tileWidth;
				sourceX = getTileInfo(0, cols, colsFloor, this.blockSize.x);
				sourceWidth = tileWidth;
				ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, -this.center.x, sourceHeight - this.center.y, sourceWidth, height - sourceHeight * 2);

				// right middle
				sourceY = getTileInfo(1, rows, rowsFloor, this.blockSize.y);
				sourceHeight = tileWidth;
				sourceX = getTileInfo(colsFloor, cols, colsFloor, this.blockSize.x);
				sourceWidth = tileWidth;
				ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, farXPos - sourceWidth, sourceHeight - this.center.y, sourceWidth, height - sourceHeight * 2);
			}

			if(rows > 2 && cols > 2)
			{		// only draw if there is a middle area, only exists if rows and column sizes are greater than 2
				// middle middle
				sourceY = getTileInfo(1, rows, rowsFloor, this.blockSize.y);
				sourceHeight = tileWidth;
				sourceX = getTileInfo(1, cols, colsFloor, this.blockSize.x);
				sourceWidth = tileWidth;
				if(rows > 2 && cols > 2)
					ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, sourceWidth - this.center.x, sourceHeight - this.center.y, width - sourceWidth * 2, height - sourceHeight * 2);
			}
		}

		if(scaleHack)
			rat.graphics.restore();
	};

	rat.ui.BubbleBox_setDefaultDrawType = function (drawType)
	{
		if(drawType === rat.ui.BubbleBox_STRETCH)
			rat.ui.BubbleBox_defaultDrawType = rat.ui.BubbleBox_STRETCH;
		else
			rat.ui.BubbleBox_defaultDrawType = rat.ui.BubbleBox_TILE;
	};
} );

//----------------------------
//	sprite Element (subclass of ui Element)
//	renders with a loaded image

//	TODO:
//		Figure out how to autoscale sprites when setSize() is called, but factor in
//			images that load late
//			setting size before image loads
//			setting size after image loads
//			loading a new image after setting size...
//			all of the above for buttons which use images.  (spritebuttons)
//			see partially written code below. :(
//			would be very nice to figure out some solution to that "isn't loaded yet, can't get size" thing...
//			maybe require preloading, or sprite sheets, or something.
//			
//			Also note that scaling the whole element just to fit the sprite seems incorrect.
//			We should only be scaling the sprite itself to fit our size.
//			For instance, scaling the whole element results in a scaled frame, which is annoying.
//			I'm going to try switching to an internal image scale here instead of element scale.
//
rat.modules.add( "rat.ui.r_ui_sprite",
[
	{name: "rat.ui.r_ui", processBefore: true },
	{name: "rat.utils.r_utils", processBefore: true },
	
	"rat.graphics.r_graphics",
	"rat.graphics.r_image",
	"rat.debug.r_console",
	"rat.ui.r_ui_data",
], 
function(rat)
{
	/**
	 * @constructor
	 * @extends rat.ui.Element
	 * @param {string|Array=} resource
	 * @param {?} extra1
	 * @param {?} extra2
	*/
	rat.ui.Sprite = function (resource, extra1, extra2)
	{
		rat.ui.Sprite.prototype.parentConstructor.call(this); //	default init
		this.flags |= rat.ui.Element.autoSizeAfterLoadFlag;	//	by default, we autosize ourself to match image size after image load
		//	todo: But a manual call to setSize() ought to clear that flag, right?  e.g. user wants to set size explicitly...?
		//	maybe...  see autoScaleAfterLoadFlag

		this.name = "<sprite>" + this.id;	//	+ resource
		this.loadImage(resource, extra1, extra2);	//	do actual image load, or at least set it up
		this.setTracksMouse(false);	//	no mouse tracking, highlight, tooltip, etc. including subelements.
		
		this.imageScaleX = this.imageScaleY = 1;
	};
	rat.utils.inheritClassFrom(rat.ui.Sprite, rat.ui.Element);
	rat.ui.Sprite.prototype.elementType = 'sprite';

	//	Load this resource in as the new image.
	/**
	 * @param {string|Array=} resource
	 * @param {?} extra1
	 * @param {?} extra2
	*/
	rat.ui.Sprite.prototype.loadImage = function (resource, extra1, extra2)
	{
		this.resource = resource;	//	I don't think this is used.  TODO: remove this line.
		if (typeof(resource) !== 'undefined')
		{
			this.imageRef = rat.graphics.makeImage(resource, extra1, extra2);
			//	"makeImage" is a more flexible way of creating sprites - may return a different type of imageref as needed.
			var self = this;	//	set up reference to self for use in closure below
			this.imageRef.setOnLoad(function ()
			{
				var imageSize = self.imageRef.getFrameSize(0);
				self.setContentSize(imageSize.w, imageSize.h);	//	set my content size to match the content we just loaded
				
				self.setDirty(true);
				
				//	autoscale to size
				//	or autosize to content.  These two are mutually exclusive
				//	TODO:  Ugh, this all happens immediately if image is already loaded.
				//	We DO need a way for a call to setSize() to trigger an autoscale after sprite is created.
				//	Or have setSize() assume that for sprites?
				
				if (self.flags & rat.ui.Element.autoScaleAfterLoadFlag)	//	scale image to match our size
				{
					//self.setScale(self.size.x/imageSize.w, self.size.y/imageSize.h);
					self.scaleImageToSize();
					//console.log("set scale on load: " + self.size.x + "/" + imageSize.w);
				}
				else if (self.flags & rat.ui.Element.autoSizeAfterLoadFlag)	//	set our size to match image size
				{
					self.setSize(imageSize.w, imageSize.h);	//	calls boundschanged
					//console.log("set size on load: " + imageSize.w);
				}
				if (self.flags & rat.ui.Element.autoCenterAfterLoadFlag)
				{
					//console.log("delayed autocenter B");
					self.autoCenter();
				}
				if (self.onLoad)
					self.onLoad(self.onLoadArg);
			});
			
			//	for convenient debug purposes, set our internal element name to include the source used.
			if (typeof(resource) === 'string')
				this.name = "<sprite>" + resource + this.id;
		}
	};
	
	//	explicitly use this imageref instead of loading above
	rat.ui.Sprite.prototype.useImageRef = function (imageRef)
	{
		this.imageRef = imageRef;
		//	do other stuff like autocenter, based on current flags?
		
		this.setDirty(true);
	};
	
	//	get back whatever imageref we're using.
	rat.ui.Sprite.prototype.getImageRef = function ()
	{
		return this.imageRef;
	};

	//	explicitly reset my element size to the size of my loaded image.
	//	assumes the image is done loading.
	rat.ui.Sprite.prototype.sizeToImage = function ()
	{
		if (this.imageRef)
		{
			var imageSize = this.imageRef.getFrameSize(0);
			this.setSize(imageSize.w, imageSize.h);	//	calls boundschanged
		}
	};
	//	explicitly reset my scale to my ui element size (with an optional extra scale to also apply)
	//	assumes the image is done loading.
	rat.ui.Sprite.prototype.scaleImageToSize = function (extraScaleX, extraScaleY)
	{
		extraScaleX = extraScaleX || 1;
		extraScaleY = extraScaleY || 1;
		
		if (this.imageRef)
		{
			var imageSize = this.imageRef.getFrameSize(0);
			//	track internal image scale instead of scaling element.
			this.imageScaleX = this.size.x/imageSize.w * extraScaleX;
			this.imageScaleY = this.size.y/imageSize.h * extraScaleY;
			//this.setScale(, this.size.y/imageSize.h);
			
			this.setDirty(true);
		}
	};
	
	//	directly set our separate scale factor
	rat.ui.Sprite.prototype.setImageScale = function (scaleX, scaleY)
	{
		this.imageScaleX = scaleX;
		this.imageScaleY = scaleY;
		
		this.setDirty(true);
	};

	//	auto center for sprites
	//	if sprite is not loaded, do autocenter after load.
	rat.ui.Sprite.prototype.autoCenter = function ()
	{
		//	Old code was doing nothing if the sprite happened to have no image ref (yet).
		//	so, later when new imageref is loaded in, the correct center is not set.
		//	So, current logic:  set afterload flag only if we HAVE an image and it's being loaded.
		//		otherwise, immediately calculate new center.
		if (typeof(this.imageRef) !== "undefined" && !this.imageRef.isLoaded())
		{
			//console.log("delayed autocenter A");
			this.flags |= rat.ui.Element.autoCenterAfterLoadFlag;
		} else {
			rat.ui.Sprite.prototype.parentPrototype.autoCenter.call(this);	//	inherited normal func
		}
	
		/*
		if (this.imageRef !== void 0)
		{
			if (!this.imageRef.isLoaded())
			{
				//console.log("delayed autocenter A");
				this.flags |= rat.ui.Element.autoCenterAfterLoadFlag;
			} else
			{
				rat.ui.Sprite.prototype.parentPrototype.autoCenter.call(this);	//	inherited normal func
			}
		}
		*/
	};

	//	turn on custom outline mode for sprites
	rat.ui.Sprite.prototype.setOutline = function (enabled, scale)
	{
		if (this.outline !== enabled || this.outlineScale !== scale)
			this.setDirty(true);
		
		this.outline = enabled;
		this.outlineScale = scale;
	};

	//	Update my image, in case it needs to animate or something.
	rat.ui.Sprite.prototype.updateSelf = function (dt)
	{
		if (this.imageRef)
		{
			//	update our image, in case it's animated.
			//	NOTE:  If you're using an animated image, it's probably not a good idea to use offscreen functionality,
			//	but just in case, we support it here with a dirty check.  If your image only sometimes animates, that's probably fine.
			var oldFrame = this.imageRef.getFrame();
			this.imageRef.update(dt);
			if (this.imageRef.getFrame() !== oldFrame)
				this.setDirty(true);
		}
	};
	
	//	Draw my sprite, tiled into this space.
	//	This function is useful for being called directly, from outside of the normal UI draw process.
	//	It acts handles positioning and rotation, but doesn't draw subelements.
	//	(Actually, this is a little weird - why does it do SOME of the standard draw, with copied and pasted code?
	//		Seems like this function should be rewritten, calling draw() instead...?)
	//	So, don't use it like it is for normal UI hierarchy drawing.  Just use the tiled flag for that.  See below.
	rat.ui.Sprite.prototype.drawTiled = function (w, h)
	{
		if (!this.isVisible())	//	don't draw me or sub stuff if I'm invisible
			return;
		
		rat.graphics.frameStats.totalElementsDrawn++;	//	for debugging, track total elements drawn per frame
		var ctx = rat.graphics.getContext();
		rat.graphics.save();

		rat.graphics.translate(this.place.pos.x, this.place.pos.y);
		if (this.place.rot.angle)
			rat.graphics.rotate(this.place.rot.angle);
		if (this.scale.x !== 1 || this.scale.y !== 1)
			rat.graphics.scale(this.scale.x, this.scale.y);
		ctx.globalAlpha = this.opacity;
		
		if (this.frameWidth > 0)
		{
			ctx.strokeStyle = this.frameColor.toString();
			ctx.lineWidth = this.frameWidth;
			ctx.strokeRect(-this.center.x - this.frameOutset, -this.center.y - this.frameOutset,
					this.size.x + 2 * this.frameOutset, this.size.y + 2 * this.frameOutset);
		}

		if (this.flags & rat.ui.Element.clipFlag)
		{
			ctx.beginPath();
			ctx.moveTo(0, 0);
			ctx.lineTo(this.size.x, 0);
			ctx.lineTo(this.size.x, this.size.y);
			ctx.lineTo(0, this.size.y);
			ctx.lineTo(0, 0);
			ctx.clip();
		}
		
		//	do the actual drawing
		this.drawMyImageTiled(w, h);
		
		rat.graphics.restore();
	};
	
	//	simple internal utility for drawing my image tiled.  Used by several other functions to do the actual tiled draw.
	//	tile the image as many times as needed to hit w/h
	rat.ui.Sprite.prototype.drawMyImageTiled = function (w, h)
	{
		var ctx = rat.graphics.getContext();
		var imageSize = this.imageRef.getSize();
		for (var x = 0; x < w; x += imageSize.w) {
			for (var y = 0; y < h; y += imageSize.h) {
				//	todo:  Do we need this translate/restore approach?  Why not just pass position args to draw()?
				rat.graphics.save();
				
				var width;
				var height;
				if (imageSize.w + x > w)
					width = w - x;
				else
					width = imageSize.w;
				if (imageSize.h + y > h)
					height = h - y;
				else
					height = imageSize.h;
				rat.graphics.translate(x, y);
				this.imageRef.draw(ctx, 0, 0, width, height, 0, 0, width, height);
				
				rat.graphics.restore();
			}
		}
	};

	//	Draw me
	rat.ui.Sprite.prototype.drawSelf = function ()
	{
		if ((this.flags & rat.ui.Element.drawTiledFlag) !== 0)
		{
			this.drawMyImageTiled(this.size.x, this.size.y);
			
		} else if (this.imageRef)
		{
			var ctx = rat.graphics.getContext();
			//	some custom code for faking outlines around objects by drawing them bigger in a funky mode.
			if (this.outline)
			{
				var frameSize = this.imageRef.getSize();
				ctx.globalCompositeOperation = 'destination-out';
				var ow = frameSize.w * this.outlineScale;
				var oh = frameSize.h * this.outlineScale;
				var dx = (ow - frameSize.w) / 2;
				var dy = (oh - frameSize.h) / 2;
				this.imageRef.draw(ctx, -(this.center.x + dx), -(this.center.y + dy), ow, oh);
				ctx.globalCompositeOperation = 'source-over';	//	back to normal
			}

			//	normal draw, factoring in scale.
			var imageSize = this.imageRef.getSize();
			var w = imageSize.w * this.imageScaleX;
			var h = imageSize.h * this.imageScaleY;

			this.imageRef.draw(ctx, -this.center.x, -this.center.y, w, h);
			
			/*
			image = this.imageRef.getImage();
			if (image != null)
				ctx.drawImage(image, -this.center.x, -this.center.y);
			else
			{
				//	not ready yet...
				//console.log("invalid sprite");
			}
			*/
		}
	};

	//	sprite bounds changed
	/* bleah, lame...
	rat.ui.Sprite.prototype.boundsChanged = function ()
	{
		//	if we should be scaling our content to match our size, set that up.
		//	todo - use contentSize, which should be accurate, and do this at generic boundsChanged level instead of here.
		//	maybe add a way to make sure contentSize is valid, or don't act on zero-sized content or whatever
		if ((this.flags & rat.ui.Element.autoScaleContentFlag) && (this.imageRef !== void 0))
		{
			var frameSize = this.imageRef.getSize();
			var sx = this.size.x / frameSize.w;
			var sy = this.size.y / frameSize.h;
			if (sx != 1 || sy != 1)
				this.setScale(sx, sy);
		}
	
		rat.ui.Sprite.prototype.parentPrototype.boundsChanged.call(this);	//	inherited normal func
	};
	*/

	rat.ui.Sprite.prototype.setOnLoad = function (func, arg)
	{
		this.onLoad = func;
		this.onLoadArg = arg;
	};

	//	Setup from data
	//autoCenter: true,
	//outline: scale,
	//resource:""/[]
	rat.ui.Sprite.setupFromData = function (pane, data, parentBounds)
	{
		rat.ui.data.callParentSetupFromData(rat.ui.Sprite, pane, data, parentBounds);

		if (data.autoCenter)
			pane.autoCenter();
		if (data.outline)
			pane.setOutline(true, data.outline);
		if (data.onLoad)
			pane.setOnLoad(data.onLoad, pane);
		if (data.resource)
			pane.loadImage(data.resource);
		if (data.animSpeed && pane.imageRef)
			pane.imageRef.animSpeed = data.animSpeed;
		
		//	If a size was set in the data, then re-set it here.  This is because pane.loadImage may change it.

	};
});
//
//	rat_load_now
//
//	Used with rat.js to force loading of the engine NOW
//
rat.load({skipLoad:true, async:false});

