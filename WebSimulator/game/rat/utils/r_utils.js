rat.modules.add("rat.utils.r_utils",
[
	{ name: "rat.math.r_math", processBefore: true },

	"rat.debug.r_console",
	"rat.os.r_system",
	"rat.os.r_user",
	
	{ name: "rat.utils.r_utils_test", platform: "unitTest" },
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
	///	Util to find all properties of a certain name, set them all to a certain value.
	///	recursively.
	///
	rat.utils.deepSet = function (o, propName, value)
	{
		// If we got something other than an object (or array), then we cannot really work with it.
		if (typeof (o) !== "object" || o === null)
			return;

		for (var e in o)
		{
			if (o.hasOwnProperty(e))
			{
				//	for subtle reasons (replacing a field called "font.font")
				//	we search for objects first and THEN replacement names.
				//	That means this function can't be used to replace objects.
				//	write a new one for that?
				if (typeof(o[e]) === "object")
				{
					rat.utils.deepSet(o[e], propName, value);
				} else if (e === propName)
				{
					o[e] = value;
				}
			}
		}
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
	rat.utils.randomizeList = function (list, rng)
	{
		if (!rng)
			rng = Math;
		for (var i = 0; i < list.length; i++)
		{
			var targ = Math.floor(rng.random() * list.length);
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
		var possible = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";

		for (var i = 0; i < len; i++)
			text += possible.charAt(Math.floor(Math.random() * possible.length));

		return text;
	};
	
	///
	///	utility to encode a number into a shorter alphanumeric ID
	///
	rat.utils.encodeID = function (value)
	{
		var possible = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
		//var possible = "0123456789";	(just a test: this results in exact itoa value)
		
		var div = possible.length;
		
		var text = "";
		var left = value;
		do {
			var part = left % div;
			left = (left / div)|0;
			text = possible.charAt(part) + text;
		} while(left);
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
	///	Also, if a ../ reference comes before another ../ reference, we can't do much about it.
	///	So, we clean up from left to right as much as we can, but we can't guarantee no ../ when we're done.
	///
	///	Returns cleaned path.
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
				//	if we *start* with a .., just give up now.
				//	todo: continue and clean up the rest of the string,
				//	but right now, this code keeps looking from the start, not from a current position.
				//	probably need to revamp the whole function.
				//	maybe something like split out every single /-delimited thing,
				//	and reconstruct.
				if (before.charAt(0) === '.')
					break;
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
	
	//	format seconds in text nicely.
	//	todo:
	//		take formatting arguments
	//		support longer times
	//		support fractions of second (especially when under 10s or something),
	//		etc.
	rat.utils.secondsToText = function(seconds)
	{
		var text;
		
		var minutes = (seconds/60)|0;
		seconds -= minutes * 60;
		seconds = seconds | 0;
		
		var secString;
		if (seconds < 10)
			secString = "0" + seconds;
		else
			secString = seconds;
		text = "" + minutes + ":" + secString;
		
		return text;
	};
	
});