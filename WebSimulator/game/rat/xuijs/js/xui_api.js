//
//	Functions for initializing the lua engine and APIs for calling between the Javascript layer and the Lua layer.
//
//	This version assumes we're going to use lua.5.1.js, an emscripten port of lua into javascript.
//	Another possiblity is moonshine.js, which is more hand implemented javascript functions to interpret Lua bytecode.
//
//	Good places to see LuaCAPI documentation:
//		http://pgl.yoyo.org/luai/i/lua_pushnil
//		http://www.lua.org/pil/24.html
rat.modules.add( "rat.xuijs.js.xui_api",
[
	"rat.debug.r_console",
	"rat.debug.r_profiler",
	"rat.utils.r_utils",
	"rat.graphics.r_image",
	"rat.audio.r_audio",
	"rat.os.r_system",
	"rat.input.r_input",
	"rat.xuijs.js.xui_parser",
	"rat.xuijs.js.xui_element",
	"rat/xuijs/lua5.1.js/lua5.1.5.min.js",
], 
function(rat)
{
	rat.xuijs = {};
	var xuijs = rat.xuijs;
	var LUAGlobalTracking = "_globalTracking";
	var xuijsAPI = "xuijsAPI";
	
	///	Utility function to push the value from a JS object to a LUA object
	function PushKeyAs( L, obj, key, type, destIndex )
	{
		if (!destIndex)
			destIndex = -1;
		xuijs.LuaCAPI.lua_pushvalue( L, destIndex ); // So we can manage the index to the table easier
		
		xuijs.LuaCAPI["lua_push" + type](L, obj[key]);
		xuijs.LuaCAPI.lua_setfield(L, -2, key);
		
		xuijs.LuaCAPI.lua_pop(L, 1);
	}
	xuijs.PushKeyAs = PushKeyAs;
	
	///	Utility function for creation LUA objects
	function CreateNewObject( L, name, arrayEntries, nonArrayEntries, creator, destIndex )
	{
		if (!destIndex)
			destIndex = -1;
		xuijs.LuaCAPI.lua_pushvalue( L, destIndex ); // So we can manage the index to the table easier
		
		xuijs.LuaCAPI.lua_createtable(L, arrayEntries || 0, nonArrayEntries || 0); // 0 array entries, 2 non-array entries
		if (creator)
			creator(name);
		xuijs.LuaCAPI.lua_setfield(L, -2, name);
		
		xuijs.LuaCAPI.lua_pop(L, 1);
	}
	xuijs.CreateNewObject = CreateNewObject;
	
	//	Get number off the stack
	xuijs.GetItemAsNumber = function( L, index, def ) {
		if (xuijs.LuaCAPI.lua_isnumber(L, index) )
			return xuijs.LuaCAPI.lua_tonumber( L, index );
		else
			return def;
	};
	xuijs.GetItemAsInt = function( L, index, def ) {
		if (xuijs.LuaCAPI.lua_isnumber(L, index) )
			return xuijs.LuaCAPI.lua_tointeger( L, index );
		else
			return def;
	};
	xuijs.GetItemAsString = function( L, index, def ) {
		if (xuijs.LuaCAPI.lua_isstring(L, index) )
			return xuijs.LuaCAPI.lua_tostring( L, index );
		else
			return def;
	};
	xuijs.GetItem = function( L, index, def ) {
		var C = xuijs.LuaCAPI;
		if (C.lua_isnumber(L, index) )
			return C.lua_tonumber( L, index );
		else if (C.lua_isstring(L, index) )
			return C.lua_tostring( L, index );
		else if (C.lua_isnil(L, index))
			return null;
		else if (C.lua_istable(L, index))
			return xuijs.GetItemAsObject( L, index );
		/// TODO Arrays.
		else
			return def;
	};
	xuijs.GetItemAsObject = function( L, index, def ) {
		//	 See http://stackoverflow.com/questions/1438842/iterating-through-a-lua-table-from-c
		var C = xuijs.LuaCAPI;
		if (xuijs.LuaCAPI.lua_istable(L, index) )
		{
			var obj = {};
			C.lua_pushvalue(L, index); // Push the table on so it is easier to manage its index			
			C.lua_pushnil(L); // Nill means get first key (table now at -2)
			while (C.lua_next( L, -2)) // This pop the key off the stack, and pushes on the next key/value.
			{
				var name = xuijs.GetItemAsString( L, -2 );
				obj[name] = xuijs.GetItem( L, -1 ); // Get the item of whatever type it is.
				
				// Pop the value off the stack, but leave the key.  This is because lua_next needs it there
				C.lua_pop(L, 1);
			}
			C.lua_pop(L, 1); // Pop the table off
			return obj;
		}
		else
			return def;
	};
	
	xuijs.GetItemAsType = function( L, index, type )
	{
		var C = xuijs.LuaCAPI;
		switch( type )
		{
			case C.LUA_TNIL:
				return null;
			case C.LUA_TNUMBER:
				return C.lua_tonumber( L, index );
			case C.LUA_TBOOLEAN:
				return C.lua_toboolean( L, index );
			case C.LUA_TSTRING:
				return C.lua_tostring( L, index );
			// case C.LUA_TTABLE:
			// case C.LUA_TFUNCTION:
			// case C.LUA_TUSERDATA:
			// case C.LUA_TTHREAD:
			// case C.LUA_TLIGHTUSERDATA:
			default:
				rat.console.log( "Unable to return value of requested type" );
				return void 0;
		}
	};
	xuijs.getTableValue = function( L, index, name, type, func, forceType )
	{
		if( forceType === void 0)
			forceType = true;
		var C = xuijs.LuaCAPI;
		
		//	Get the value and verify type
		C.lua_getfield( L, index, name );
		if( forceType )
			C.luaL_checktype( L, -1, type );
		
		//	Get the value (by type-inference or by func
		var res = void 0;
		if (!func)
			func = xuijs.GetItemAsType;
		res = func( L, -1, type );
		
		//	Pop the item from the stack
		C.lua_pop( L, 1 );
		
		//	Return the value
		return res;
	};
	xuijs.getXuiElement = function( L, index, type )
	{
		var handle = getTableValue( L, index, "xuijsHandle", xuijs.LuaCAPI.LUA_TNUMBER );
		return xuijs.getXuiElementByHandle(handle);
	}
	
	//	Utility function get a value from the lua stack
	//	EX: xuijs.GetParamAsNumber(L, 2) => 3.52
	// NOTE: Remember that paramter index starts at 1 not zero.
	xuijs.GetParamAsNumber = xuijs.GetItemAsNumber;
	xuijs.GetParamAsInt = xuijs.GetItemAsInt;
	xuijs.GetParamAsString = xuijs.GetItemAsString;
	xuijs.GetParamAsObject = xuijs.GetItemAsObject;
	xuijs.GetParam = xuijs.GetItem;
	/// TODO Arrays
		
	// TODO: 
	// We do this "var C = xuijs.LuaCAPI;" stuff all over.
	// Maybe keep a local variable in this outer scope for C?
	
	// TODO: Maybe make this more of a class than a namespace?
	
	xuijs.initLua = function(luaPackageFile, mainLuaFile, callback)
	{
		xuijs.mInitialized = false;
		
		// Initialize lua5.1.js
		xuijs.LuaCAPI = Lua5_1.C;
		xuijs.LuaState = xuijs.LuaCAPI.lua_open();
		xuijs.LuaCAPI.luaL_openlibs(xuijs.LuaState);

		// Initialize the API that will be call-able from Lua
		xuijs.initAPI();
		
		if( luaPackageFile && mainLuaFile ){
			xuijs.loadLuaPackage(luaPackageFile, mainLuaFile, function(successful){
				xuijs.mInitialized = true;
				callback(successful);
			});
		}
	};
	
	xuijs.shutdownLua = function()
	{
		xuijs.LuaCAPI.lua_close(xuijs.LuaState);
		xuijs.LuaState = 0;
	};
	
	xuijs.isInitialized = function()
	{
		return xuijs.mInitialized;
	};
	
	// Loads the lua source file package, and executes the given mainLuaFile.
	// Calls the given callback when done, passing true if successful, false otherwise.
	xuijs.loadLuaPackage = function(luaPackageFile, mainLuaFile, callback)
	{
		var C = xuijs.LuaCAPI;
		var L = xuijs.LuaState;
		
		// Load packed lua files
		// This could maybe be mnoved elsewhere, as part of rat.load or something, 
		// but lua5.1.5.min.js has to be loaded first.
		rat.utils.loadScriptWithCallback(luaPackageFile, true, function(){
			// Success Callback
			
			// Load the main lua file
			var result = xuijs.executeLuaFile(mainLuaFile);	
			
			callback(result);
		}, 
		function(){
			// Error Callback
			// TODO: Figure out how to deal with errors
			rat.console.log("ERROR: Error loading lua source package file!");
			callback(false);
		});
		
	};
	
	// Loads and executes a lua file (from the preloaded packedLua.js package).
	xuijs.executeLuaFile = function(fileName)
	{
		var C = xuijs.LuaCAPI;
		var L = xuijs.LuaState;
		if (C.luaL_dofile(L, fileName) !== 0)
		{
			// TODO: Figure out how to deal with errors
			var err = C.lua_tostring(L, -1);
			rat.console.log("ERROR: Error executing lua file! " + fileName + "\n\tLua error: " + err);
			//throw new Error("Lua error: " + err);
			return false;
		}
		return true;
	};
	
	// Loads the list of json files and stores the resulting json data objects in a map, to be used later.
	// We need to pre-load the xui data because later when calling xuijs.apiUtils.WScene_Create(), we need it to be synchronous.
	// the given callback is called when all are loaded.
	xuijs.mAssetPrefixPath = null;
	xuijs.mPreloadedXuiData = [];
	xuijs.preloadXuiData = function(manifestFile, prependPath, updateCB)
	{
		xuijs.mAssetPrefixPath = prependPath;	//	remember for later, too.
		
		// Load the manifest to get the file list
		//	Note that here we access a global called "xuiManifest"!
		rat.utils.loadScriptWithCallback(manifestFile, true, function(){
			var loadsLeft = xuiManifest.length;
			if (loadsLeft <= 0){	//	for the case where there were no files to load?
				if( updateCB )
					updateCB();
				return;
			}

			for( var i = 0; i < xuiManifest.length; i++ ){
				// Immediately invoked anonymous function to be able to use loop variable in inner callback.
				(function(){
					var file = xuiManifest[i];
					if (prependPath)
						file = prependPath + file;
					//rat.console.log( "Trying to load " + file + "..." );
					rat.utils.loadJSON(file, function(data){
						xuijs.mPreloadedXuiData[file] = data;
						--loadsLeft;
						if( loadsLeft <= 0 )
							xuijs.preloadAssets(updateCB);
					});
				})();
			}
		});
	};
	
	//	this is a variant of the above that works from an existing list in ram...
	xuijs.processXuiData = function(mergedFiles, prependPath, updateCB, opts)
	{
		xuijs.mAssetPrefixPath = prependPath;	//	remember for later, too.
		
		for( var i = 0; i < mergedFiles.length; i++ )
		{
			var entry = mergedFiles[i];
			xuijs.mPreloadedXuiData[prependPath + entry.fileName] = entry.data;
		}
		
		xuijs.preloadAssets(updateCB, opts);
	};
	
	// Returns the preloaded xui data for the given file, or null if it cannot be found.
	xuijs.getPreloadedXuiData = function(fileName)
	{
		return xuijs.mPreloadedXuiData[fileName];
	};
	
	// test all json objects to get all the file paths in all the xui files and precache the images and sounds
	// callback runs when the preloads have all been triggered (not necessarily finished)
	var UniqueSoundId = 0;
	xuijs.preloadAssets = function (updateCB, opts)
	{
		if (!opts)
			opts = {}
		var imageFiles = [];
		var audioFiles = [];
		var foundImage = {};	// helpers so we don't duplicate things in the image list... not sure if needed
		var foundAudio = {};
		
		//	STT 2015.6.30 added suppression of preloading of assets not used in rat-hosted XUI handling.
		//	I don't like how this is done - we're parsing xui data here, but we also parse it elsewhere,
		//	so I'm doing some of the same logic here as there.
		//	Also, this is a weirdly deeply recursive implementation I don't quite follow.
		//	When does the other parsing of this data happen?  Can we trigger the preloads then?
		//	Certainly we want to start image preloading as early as possible, and that seems to be what's
		//	happening right now, but it means I have to do things like duplicate the logic for
		//	detecting special IDs that change the handling of DesignTime flags.  See below.
		var lastId = "";
		var lastDesignTime = false;

		// test all json objects to get all the file paths in all the xui files and precache the images and sounds
		var findAssets = function (xuiData, basePath) {

			// take the data and find any data in all its children
			var stopAt = xuiData.length;
			var wasDesignTime = lastDesignTime;
			for (var i = 1; i < stopAt; i++) {
				if (!xuijs.parser.dataIsElement(xuiData[i])) {
					continue;
				}
				var addProp = findAssets(xuiData[i], basePath);
				if (addProp)
					xuiData.push(addProp);
			}
			lastDesignTime = wasDesignTime;

			var tag = xuijs.parser.getTagName(xuiData);
			var fullPath;
			var newProp;
			
			// these tags are found as pairs in index 0/1 of the data structure
			switch (tag) {
				case "Id":
					lastID = xuiData[1];
					break;
				case "DesignTime":
					//	check if this is not a rat-specific element and is marked design only
					//	if so, we don't want to load it.
					if (lastID.slice( 0, 8 ) !== "ratonly_" || xuiData[1] === "true")
						lastDesignTime = true;
					break;
				case "ImagePath":
				case "TextureFileName":
					fullPath = xuijs.parser.resolvePath(basePath, xuiData[1]);
					if (!lastDesignTime)	//	don't preload assets used in design time
					{
						if (!foundImage[fullPath]) {
							foundImage[fullPath] = true;
							imageFiles.push(fullPath);
						}
					}
					// else
					// {
						// rat.console.log("suppressing design time load for " + fullPath);
					// }
					break;
				case "File":
					fullPath = xuijs.parser.resolvePath(basePath, xuiData[1]);
					//	For easier xui development purposes, allow designers to put "../../original/audio" references in xui files.
					//	Fix them here.  :)
					fullPath = fullPath.replace("../../original/audio", "../audio");
					var uniqueID = "" + (++UniqueSoundId) + ":";
					var id = uniqueID + fullPath;
					//	this check was weird - we were forcing every single sound to be unique,
					//	so, there were no duplicate sounds to find.
					//	Now I've made it reset unique id per file,
					//	so this check means something.
					if (!foundAudio[id]) {
						foundAudio[id] = true;
						audioFiles.push({ id: id, resource: fullPath, volume: 1 });
					}
					newProp = ["UniqueSoundId", uniqueID];
					break;
				case "Timelines":
					// Find all timelines in this list of timelines
					if( xuiData.length )
					{
						for( var subIndex = 1; subIndex < xuiData.length; ++subIndex )
						{
							var sub = xuiData[subIndex];
							if( sub.length && sub[0] === "Timeline" )
							{
								//	Find the props
								var props = [];
								var propIndex;
								for( propIndex = 1; propIndex < sub.length; ++propIndex )
								{
									var propName = (sub[propIndex].length && sub[propIndex][0]) || "";
									if( propName === "TimelineProp" )
										props.push( sub[propIndex][1] );
									else if( propName != "Id" )
										break;
								}
								
								//	Process the props we care about
								for( propIndex; propIndex < sub.length; ++propIndex )
								{
									var propName = (sub[propIndex].length && sub[propIndex][0]) || "";
									var prop = sub[propIndex];
									if( propName === "KeyFrame" )
									{
										var nthValue = -1;
										for( var childIndex = 1; childIndex < prop.length; ++childIndex )
										{
											var child = prop[childIndex];
											if( child.length && child[0] === "Prop" )
											{
												++nthValue;
												//	This is an image path prop
												if( props[nthValue] === "ImagePath" && child[1])
												{
													fullPath = xuijs.parser.resolvePath(basePath, child[1]);
													if (!foundImage[fullPath])
													{
														//rat.console.log( "Adding preload image from timeline:" + fullPath );
														foundImage[fullPath] = true;
														imageFiles.push(fullPath);
													}
												}
											}
										}
									}
								}
							}
						}
					}
					break;
			};
			return newProp;
		};

		//	look through all json files
		for (var file in xuijs.mPreloadedXuiData) {
			//	support explicit inclusion list (whitelist) for what assets to load for a given level.
			if (opts.inclusions)
			{
				if (!opts.inclusions[file])
					continue;
			}
			var value = xuijs.mPreloadedXuiData[file];
			var basePath = file.slice(0, file.lastIndexOf("/"));
			UniqueSoundId = 0;	//	only allow 
			findAssets(value, basePath);
			// MTR: updateCB isn't being used right. When game.js calls this, updateCB is preLoadDone and it
			// expects preLoadDone to be called when we finish preloading not for every file like was happening
			// here. This caused the lua files to be loaded over and over again and causes issues... 7/20/16
			// if( updateCB )
				// updateCB();
		}

		// run preload for images
		rat.console.log( "XUI Preloading " + imageFiles.length + " images..." );
		rat.graphics.preLoadImages(imageFiles);

		// run preload for audio
		
		/*
		console.log("---- audio load");
		console.log("----------------");
		for (var i = 0; i < audioFiles.length; i++)
		{
			var a = audioFiles[i];
			console.log("" + a.id + ": " + a.resource);
		}
		console.log("----------------");
		*/
		
		var capTest = 999999;
		if (audioFiles.length > capTest)
			audioFiles.length = capTest;
		rat.console.log( "XUI Preloading " + audioFiles.length + " sounds..." );
		if (audioFiles.length)
			rat.console.log( "Last One Is " + audioFiles[audioFiles.length-1].resource);
		rat.audio.loadSounds(audioFiles);

		// TODO - add callback check function passed to preLoadImages and loadSounds to wait for the file loads
		//	for now, we've started the preloads, but haven't waited for them.
		//	It's possible for the caller to wait manually using the usual rat.graphics and rat.audio APIs.
		if(updateCB)
			updateCB();
	};
	
	//	set a prefix path to use when loading assets from the preloaded list.
	xuijs.setAssetPrefixPath = function (path) {
		xuijs.mAssetPrefixPath = path;
	}

	// Sets the main xuiScreen that's handling the drawing, input, etc.
	xuijs.setXuiScreen = function(screen)
	{
		xuijs.xuiScreen = screen;
	};
	
	//	Internal use to consolidate LUA function call code
	xuijs._callLua = function( originalStackSize, functionName, args, options )
	{
		// rat.console.log( ">>> Calling function " + functionName );
		var C = xuijs.LuaCAPI;
		var L = xuijs.LuaState;
		
		// Check that object (at index -1, aka the top, of stack) is a table
		var type;
		type = C.lua_type(L, -1);
		if( type != C.LUA_TTABLE ){
			throw new Error("xuijs.callLuaFunc: object is not a table");
		}
		
		// Get the function - it'll be pushed onto the top of the stack.
		C.lua_getfield(L, -1, functionName);
		// Check that it's a function
		type = C.lua_type(L, -1);
		if( type != C.LUA_TFUNCTION ){
			throw new Error("xuijs.callLuaFunc: functionName \"" + functionName + "\" is not a function");
		}
		
		// Push arguments onto the stack
		var numArgs = 0;
		if( options.includeSelf ){
			// Push a copy of the global (now at index -2) onto the stack, as the self variable
			C.lua_pushvalue(L, -2);
			numArgs++;
		}
		if (args)
		{
			for( var i = 0; i < args.length; i++ ){
				var arg = args[i];
				xuijs.apiUtils.pushLuaValueFromJSValue(L, arg);
				numArgs++;
				C.luaL_checkstack(L, 1, "xuijs.callLuaFunc: Too many arguments");
			}
		}
		
		// Store current stack size before the call
		var oldStackSize = C.lua_gettop(L);
		
		// Call the function
		var result = C.lua_pcall(L, numArgs, C.LUA_MULTRET, 0);
		if( result != 0 ){
			// Something went wrong, an error message should be on the top of the stack.
			throw new Error("xuijs.callLuaFunc: Error calling function \"" + functionName + "\": " + C.lua_tostring(L, -1));
		}
		
		// Sometimes we might want to leave all the Lua return results on the stack, for different processing
		if( options.skipReturnHandling ){
			// Remove the global from it's position in the stack, so we don't end up cluttering the stack.
			C.lua_remove(L, originalStackSize+1);
			return;
		}
		
		// Get the results
		// Get new stack size - the difference between the old and new size is the number of return values.
		var newStackSize = C.lua_gettop(L);
		var numReturns = newStackSize - oldStackSize;
		var returnValues = [];
		// Loop starting at stack index -numReturns, and go up to -1
		for( var i = -numReturns; i < 0; i++ ){
			var value = xuijs.apiUtils.getJSValueFromLua(L, i);
			returnValues.push(value);
		}
		
		// Get stack back to initial state
		C.lua_settop(L, originalStackSize);
		
		return returnValues;
	};
	
	// Calls a function on the object specified in the stack
	xuijs.callLUAFuncOn = function( offset, functionName, args, options )
	{
		// TODO: Figure out how to handle errors.  For now throw an error.
		// TODO: Maybe just pass in one identifier string, like "something.foo.bar.funcName", 
		// split on the periods, then loop over the tokens, finding sub-tables. 
		
		var C = xuijs.LuaCAPI;
		var L = xuijs.LuaState;
		
		options = options || {};
		
		// Get original stack size
		var originalStackSize = C.lua_gettop(L);
		
		// Get the global - it'll be pushed onto the top of the stack.
		C.lua_pushvalue(L, offset);
		
		return xuijs._callLua( originalStackSize, functionName, args, options );
	};
	
	// Calls a function on the Lua side by finding the given global, 
	// finding the function of the given name on that global, 
	// and pushing the proper arguments based on the given list of args.
	// For now, only basic types are supported in the args list.
	// Results will be returned in a list.
	// Throws an error if something goes wrong.
	// options can contain two options:
	// 		includeSelf - whether to push a copy of the global as the first argument to the lua function. Defaults to false.
	//		skipReturnHandling - whether to skip processing the lua results.  If true, the return values are left on the stack for custom processing. Defaults to false.
	xuijs.callLuaFunc = function(globalName, functionName, args, options)
	{
		// TODO: Figure out how to handle errors.  For now throw an error.
		// TODO: Maybe just pass in one identifier string, like "something.foo.bar.funcName", 
		// split on the periods, then loop over the tokens, finding sub-tables. 
		
		var C = xuijs.LuaCAPI;
		var L = xuijs.LuaState;
		
		options = options || {};
		
		// Get original stack size
		var originalStackSize = C.lua_gettop(L);
		
		// Get the global - it'll be pushed onto the top of the stack.
		C.lua_getglobal(L, globalName);
		
		return xuijs._callLua( originalStackSize, functionName, args, options );
	};
	
	// Initializes the APIs that allow communication between the Lua and Javascript layers.
	xuijs.initAPI = function()
	{
		var C = xuijs.LuaCAPI;
		var L = xuijs.LuaState;
		
		// Create a xuijs global
		// Push a new table onto the stack
		C.lua_newtable(L);
		// Push a copy of the table onto the stack, so when it's popped by lua_setglobal, we can still use it below.
		C.lua_pushvalue(L, -1);
		// Set it as a global named xuijsAPI (pops it from the stack)
		C.lua_setglobal(L, xuijsAPI);
		
		// Add functions
		
		for( var key in xuijs.api ){
			if( xuijs.api.hasOwnProperty( key ) ){
				// key is function name, xuijs.api[key] is function itself.
				
				// Push the function onto the stack
				// Have to call an emscripten thing, Lua5_1.Runtime.addFunction(), 
				// to get function callable on "C" side of things.
				C.lua_pushcfunction(L, Lua5_1.Runtime.addFunction(xuijs.api[key]));
				
				// Assign the function onto the xuijsAPI global.
				// the global should be at index -2, and the function at -1.
				C.lua_setfield(L, -2, key);
			}
		}
		
		//	Add the global storage spaec
		CreateNewObject( L, LUAGlobalTracking, 0, 0, void 0 );
		
		// Pop the global off the stack, to keep it at the original level.
		C.lua_pop(L, 1);
	};
	
	//	Get the given tracking into onto the stack
	xuijs.GetGlobalTracking = function( id, L )
	{
		//	Get the global object
		var C = xuijs.LuaCAPI;
		C.lua_getGlobal( L, xuijsAPI );
		C.lua_getfield( L, -1, LUAGlobalTracking );
		C.lua_getfield( L, -1, "_" + id );
		
		//	Cleanup the stack, but leave the value in place
		C.lua_remove(L, -2); // LUAGlobalTracking
		C.lua_remove(L, -2); // xuijsAPI
		//	Leave the value on the stack
		return found;
	};
	
	//	Test a global tracking ID
	//	UNTESTED
	xuijs.HasGlobalTracking = function( id, L )
	{
		rat.console.log( "WARNING! xuijs.HasGlobalTracking has not been tested!");
		
		xuijs.GasGlobalTracking( id, L );
		var found = C.lua_isnil(L, -1) == 1;
		
		//	Pop the value off
		C.lua_pop(L, 1);
		return found;
	};
	
	//	Add something to the global tracking, and return its handle
	//	UNTESTED
	var gLastGlobalTrackingID = 0;
	xuijs.AddToGlobalTracking = function( offset, L )
	{
		rat.console.log( "WARNING! xuijs.AddToGlobalTracking has not been tested!");
		
		//	Get a valid tracking ID
		do {
			++gLastGlobalTrackingID;
		}while( gLastGlobalTrackingID == 0 || xuijs.HasGlobalTracking( gLastGlobalTrackingID, L ) );
		
		//	Get the global object
		var C = xuijs.LuaCAPI;
		C.lua_getGlobal( L, xuijsAPI );
		C.lua_getfield( L, -1, LUAGlobalTracking );
		
		//	Add this item
		C.lua_pushvalue( L, offset );
		C.lua_setfield(L, -2, "_" + gLastGlobalTrackingID );
		
		//	Cleanup the stack
		C.lua_pop(L, 2); // pop LUAGlobalTracking and xuijsAPI
		return gLastGlobalTrackingID;
	};
	
	//	Remove something from the global tracking
	//	UNTESTED
	var gLastGlobalTrackingID = 0;
	xuijs.RemoveFromGlobalTracking = function( id, L )
	{
		rat.console.log( "WARNING! xuijs.RemoveFromGlobalTracking has not been tested!");
		if (xuijs.HasGlobalTracking(id, L))
		{
			//	Get the global object
			var C = xuijs.LuaCAPI;
			C.lua_getGlobal( L, xuijsAPI );
			C.lua_getfield( L, -1, LUAGlobalTracking );
			
			//	Add this item
			C.lua_pushnil( L, offset );
			C.lua_setfield(L, -2, "_" + id );
			C.lua_pop(L, 2 ); // Remove LUAGlobalTracking and xuijsAPI
		}
	};
	
	xuijs.api = {};
	// xuijs.api.testParam = function(L)
	// {
		// var args = [
			// xuijs.GetItem( L, 1 ), // REM: Args start a 1
			// xuijs.GetItem( L, 2 ),
			// xuijs.GetItem( L, 3 ),
			// xuijs.GetItem( L, 4 ),
			// xuijs.GetItem( L, 5 ),
		// ];
		// //nil, 2, 3.5, "bob", {x=0, y=0}
	// }
	// The functions that will be call-able from Lua
	// Functions need to follow this pattern:
	/*
	xuijs.api.someFunc = function(L)
	{
		// Check arguments
		// Do whatever processing
		// Return number of results that were pushed onto stack
	}
	*/
	
	//	Expose a high resolution timer to the LUA
	xuijs.api.getCurTick = function(L)
	{
		var tick;
		if (window.performance)
			tick = window.performance.now();
		else
			tick = new Date().getTime();
		tick /= 1000;
		
		xuijs.apiUtils.pushLuaValueFromJSValue(L, tick);
		return 1;
	};
	
	// Generic functions for calling into Javascript
	
	// Internal function for doing a javascript call from Lua
	// If xuiElement is null or undefined, do the call on the xuija.apiUtils object.
	callXuijsFunctionHelper = function(L, xuiElement)
	{
		var C = xuijs.LuaCAPI;
		
		// Get number of arguments passed in
		var numPassedArgs = C.lua_gettop(L);
		
		if( numPassedArgs < 1 ){
			throw new Error("callXuijsFunctionHelper(): Not enough args");
		}
		
		// The first arg should be the function name.
		var funcName = C.luaL_checkstring(L, 1);
		
		// Get the rest of the args to pass to the function
		var funcArgs = [];
		for( var i = 2; i <= numPassedArgs; i++ ){
			var value = xuijs.apiUtils.getJSValueFromLua(L, i);
			funcArgs.push(value);
		}
		
		// Get the Javascript function
		var func;
		var thisArg = this;
		
		if( xuiElement ){
			func = xuiElement[funcName];
			thisArg = xuiElement;
		}
		else{
			func = xuijs.apiUtils[funcName];
		}
		
		if( !func || typeof func != "function" ){
			throw new Error("callXuijsFunctionHelper(): Couldn't find function \"" + funcName + "\"!");
		}
		
		// Do the call.
		var result = func.apply(thisArg, funcArgs);
		
		// Push the result(s) onto the Lua stack.
		// NOTE: When an array is returned, assume it should be returned to lua as multiple return values. 
		var numResults = 0;
		if( typeof result !== 'undefined' && result !== null ){
			if( xuijs.apiUtils.isArray(result) ){
				for( var i = 0; i < result.length; i++ ){
					xuijs.apiUtils.pushLuaValueFromJSValue(L, result[i]);
					numResults++;
				}
			}
			else{
				xuijs.apiUtils.pushLuaValueFromJSValue(L, result);
				numResults = 1;
			}
		}
		
		// Return the number of results that were pushed
		return numResults;
	};
	
	// For calling a javascript XuiElement method from Lua.
	// Args should be xuiHandle, funcName, <variable list of args for function>
	// TODO: This is almost the same as the below function - Combine them, or refactor common stuff out somehow?
	xuijs.api.callXuijsElementMethod = function(L)
	{
		var C = xuijs.LuaCAPI;
		
		// Get number of arguments passed in
		var numPassedArgs = C.lua_gettop(L);
		
		if( numPassedArgs < 2 ){
			throw new Error("xuijs.api.callXuijsElementMethod(): Not enough args");
		}
		
		// We want to pull the first arg, which should be the xuiHandle, out of it's place in the stack, 
		// Then call our helper function, with the remaining values still on the stack.
		var xuiHandle = C.luaL_checkinteger(L, 1);
		C.lua_remove(L, 1);
		
		// Get the xui element
		var xuiElement = xuijs.getXuiElementByHandle(xuiHandle);
		if( !xuiElement ){
			//	for debugging purposes, I want to know what function we were trying to call...
			var funcName = C.luaL_checkstring(L, 1) || "(unknown)";
			throw new Error("xuijs.api.callXuijsElementMethod(): Couldn't find xuiElement by handle: " + xuiHandle + " to call " + funcName);
		}
		
		// Now call the helper to do the actual call.
		return callXuijsFunctionHelper(L, xuiElement);
	};

	// For calling a javascript xuijs.api function from Lua.
	// Args should be funcName, <variable list of args for function>
	// TODO: This is almost the same as the above function - Combine them, or refactor common stuff out somehow?
	xuijs.api.callXuijsAPIFunction = function(L)
	{
		return callXuijsFunctionHelper(L);
	};
	
	// A function for creating a xui scene from file.
	// First arg should be xui file to open.
	// Needs to be an api function and not just a utility, to properly set up the object return value.
	xuijs.api.WScene_Create = function(L)
	{
		//rat.console.log("WScene_Create called!");
		
		var C = xuijs.LuaCAPI;
		
		// Get number of arguments passed in
		var numPassedArgs = C.lua_gettop(L);
		
		if( numPassedArgs < 1 ){
			throw new Error("xuijs.api.WScene_Create(): Not enough args");
		}
		
		// The first arg should be the file path.
		var xuiFile = C.luaL_checkstring(L, 1);
		
		var returnFirstChild = true;		// xuiScenes are the first child of the canvas
		var scene = xuijs.apiUtils.createXuiItemFromFile(xuiFile, returnFirstChild);
		
		// Loop over all elements in the scene and create the proper Lua-side objects.
		function convertJSXuiElement(jsXuiElement, parentStackIndex){
			
			// Since we're recursing, we should do a lua_checkstack
			C.luaL_checkstack(L, 1, "convertJSXuiElement no more stack, recusion too deep!");
			
			var initialStackTop = C.lua_gettop(L);
			
			// Call the "createElement" function on the lua side to create the lua-side XuiElement object.
			// This should push the resulting lua table onto the stack
			xuijs.callLuaFunc("WXuiElement", "createElement", [jsXuiElement.xuiType, jsXuiElement.GetHandle()], {skipReturnHandling: true});
			//	STT and MTR:  flag this explicitly as a lua element so we know later whether to skip lua event handling or not.
			jsXuiElement.createdFromLua = true;
			
			// Figure out how many return values there were - should be 1
			var newStackTop = C.lua_gettop(L);
			
			var numResults = newStackTop - initialStackTop;
			
			if( numResults != 1 ){
				throw new Error("xuijs.api.WScene_Create(): In convertJSXuiElement(), createElement gave wrong number of results!");
			}
			if( !C.lua_istable(L, -1) ){
				throw new Error("xuijs.api.WScene_Create(): In convertJSXuiElement(), result of createElement not a table!");
			}
			
			// Get the stack index of the new xui element, so we can pass it to the recursive call.
			var elementStackIndex = C.lua_gettop(L);
			
			// Assign this child into the parent table with it's name as the key.
			if( typeof parentStackIndex !== 'undefined' && parentStackIndex !== null ){
				// Since we're recursing, we should do a lua_checkstack
				C.luaL_checkstack(L, 1, "convertJSXuiElement no more stack for pushing copy, recusion too deep!");

				// lua_setfield() pops a value off the stack, so push a copy of the new xui element table onto the stack.
				C.lua_pushvalue(L, -1);
				C.lua_setfield(L, parentStackIndex, jsXuiElement.id);
			}
			
			// Loop over children and create lua versions.
			// TODO: Maybe switch to using XuiElement functions - GetFirstChild(), GetNext().
			// Then if we need to change rat element parentage setup for some reason, it wouldn't matter here.
			if( jsXuiElement.subElements ){
				for( var i = 0; i < jsXuiElement.subElements.length; i++ ){
					var childElem = jsXuiElement.subElements[i];
					convertJSXuiElement(childElem, elementStackIndex);
				}
			}
			
			// Pop the new table off the stack, since we should be done with it,
			// but only if this is a recursive call.
			// If it's the first call, we need to leave a result on the stac.
			// TODO: Is there a better way to deal with the final return value?
			if( typeof parentStackIndex !== 'undefined' && parentStackIndex !== null ){
				C.lua_pop(L, 1);
			}
			
			// For debugging
			//rat.console.log("convertJSXuiElement - " + jsXuiElement.id);
			//xuijs.apiUtils.dumpLuaAPIStack(L);
			
		}
		
		convertJSXuiElement(scene);
		
		// Push proper return value
		// It should already be pushed from the above function.
		
		// Return number of return values;
		return 1;
	};

	//************************************************************************************************************//
	//TODO REFACTOR ME! (with the above code)
	xuijs.api.WXuiElement_LoadObject = function (L) {
		//rat.console.log("WXuiElement_LoadObject called!");

		var C = xuijs.LuaCAPI;

		// Get number of arguments passed in
		var numPassedArgs = C.lua_gettop(L);

		if (numPassedArgs < 1) {
			throw new Error("xuijs.api.WXuiElement_LoadObject(): Not enough args");
		}

		// The first arg should be the file path.
		var xuiFile = C.luaL_checkstring(L, 1);

		var returnFirstChild = false;		// we want the root, not its child
		var xuiObject = xuijs.apiUtils.createXuiItemFromFile(xuiFile, returnFirstChild);

		// Loop over all elements in the object and create the proper Lua-side objects.
		function convertJSXuiElement(jsXuiElement, parentStackIndex) {

			// Since we're recursing, we should do a lua_checkstack
			C.luaL_checkstack(L, 1, "convertJSXuiElement no more stack, recusion too deep!");

			var initialStackTop = C.lua_gettop(L);

			// Call the "createElement" function on the lua side to create the lua-side XuiElement object.
			// This should push the resulting lua table onto the stack
			xuijs.callLuaFunc("WXuiElement", "createElement", [jsXuiElement.xuiType, jsXuiElement.GetHandle()], { skipReturnHandling: true });

			// Figure out how many return values there were - should be 1
			var newStackTop = C.lua_gettop(L);

			var numResults = newStackTop - initialStackTop;

			if (numResults != 1) {
				throw new Error("xuijs.api.WXuiElement_LoadObject(): In convertJSXuiElement(), createElement gave wrong number of results!");
			}
			if (!C.lua_istable(L, -1)) {
				throw new Error("xuijs.api.WXuiElement_LoadObject(): In convertJSXuiElement(), result of createElement not a table!");
			}

			// Get the stack index of the new xui element, so we can pass it to the recursive call.
			var elementStackIndex = C.lua_gettop(L);

			// Assign this child into the parent table with it's name as the key.
			if (typeof parentStackIndex !== 'undefined' && parentStackIndex !== null) {
				// Since we're recursing, we should do a lua_checkstack
				C.luaL_checkstack(L, 1, "convertJSXuiElement no more stack for pushing copy, recusion too deep!");

				// lua_setfield() pops a value off the stack, so push a copy of the new xui element table onto the stack.
				C.lua_pushvalue(L, -1);
				C.lua_setfield(L, parentStackIndex, jsXuiElement.id);
			}

			// Loop over children and create lua versions.
			// TODO: Maybe switch to using XuiElement functions - GetFirstChild(), GetNext().
			// Then if we need to change rat element parentage setup for some reason, it wouldn't matter here.
			if (jsXuiElement.subElements) {
				for (var i = 0; i < jsXuiElement.subElements.length; i++) {
					var childElem = jsXuiElement.subElements[i];
					convertJSXuiElement(childElem, elementStackIndex);
				}
			}

			// Pop the new table off the stack, since we should be done with it,
			// but only if this is a recursive call.
			// If it's the first call, we need to leave a result on the stac.
			// TODO: Is there a better way to deal with the final return value?
			if (typeof parentStackIndex !== 'undefined' && parentStackIndex !== null) {
				C.lua_pop(L, 1);
			}

			// For debugging
			//rat.console.log("convertJSXuiElement - " + jsXuiElement.id);
			//xuijs.apiUtils.dumpLuaAPIStack(L);

		}

		convertJSXuiElement(xuiObject);

		// Push proper return value
		// It should already be pushed from the above function.

		// Return number of return values;
		return 1;
	};
	
	//This is a function to make a new blank xui element on the js side
	//It is roughly equivalent to  Xbox.XuiBase.CreateObject
	//It only returns the handle, so to use it do in lua: 
	//xuiElement = WXuiElement:new(xuijsAPI.newXuiElement())
	//see WTextSetup for an example of it's use.	
	xuijs.api.newXuiElement = function(L)
	{
		var C = xuijs.LuaCAPI;
		//create js side element
		var element = new xuijs.XuiElement();
		//the lua side will use this handle to call back to js when needed
		
		C.lua_pushinteger( L, element.GetHandle() );
		//we return one value: the handle
		return 1;
	};
	
	
	//************************************************************************************************************//

	xuijs.api.WSignin_GetGamertag = function(L)
	{
		var C = xuijs.LuaCAPI;
		
		// Get number of arguments passed in
		var numPassedArgs = C.lua_gettop(L);

		if (numPassedArgs > 0) {
			throw new Error("xuijs.api.WSignin_GetGamertag(): too many args");
		}

		var gamertag = "";
		if (rat.system.has.xboxLE) {
			var userInfo = Maple.getCurrentUser();

			if(userInfo && userInfo.gamertag)
				gamertag = userInfo.gamertag;
		}
		else
			gamertag = "WWWWWWWWWWWWWWW";	// for testing on the PC - 15 W's
			
		C.lua_pushstring(L, gamertag);
		
		return 1;		// one return value
		//xuijs.callLuaFunc("army2DestinationScene", "SetGamertag", ["1234"], { skipReturnHandling: true });		// example code on calling external function, this code would set it, but that'd be silly from a getter
		
	};

	//************************************************************************************************************//

	var HTTP_STATUS_OK = 200
	var HTTP_STATUS_ERROR = 404

	xuijs.api.WLeaderboard_SendDataFromUrl = function(L)
	{
		//rat.console.log("WLeaderboard_SendDataFromUrl called!");

		var C = xuijs.LuaCAPI;

		// Get number of arguments passed in
		var numPassedArgs = C.lua_gettop(L);

		if (numPassedArgs < 5) {
			throw new Error("xuijs.api.WLeaderboard_GetDataFromUrl(): Not enough args");
		}

		// The first arg should be the calling object, 2nd the url, and third the callback
		// we've also added score and gamerTag as they need to be passed back to the callback
		var callingObj = C.luaL_checkstring(L, 1);
		C.lua_remove(L, 1);
		var url = C.luaL_checkstring(L, 1);
		C.lua_remove(L, 1);
		var callbackName = C.luaL_checkstring(L, 1);
		C.lua_remove(L, 1);
		var score = C.luaL_checkint(L, 1);
		C.lua_remove(L, 1);
		var gamerTag = C.luaL_checkstring(L, 1);
		
		var xmlhttp = new XMLHttpRequest();
		xmlhttp.onreadystatechange = function () {
			if (xmlhttp.readyState != 4)						// 4 is done for ready state
				return;

			if (xmlhttp.status !== HTTP_STATUS_OK && xmlhttp.readyState == 4) {
				xuijs.callLuaFunc("WLeaderboardHelper", callbackName, [null, callingObj], { skipReturnHandling: true });
				return;			// TODO, push error on to the c-stack and send it back, have the calling function check for error
			}

			xuijs.callLuaFunc("WLeaderboardHelper", callbackName, [true, callingObj, score, gamerTag], { skipReturnHandling: true });
		};  		// nothing really changes whether we succeeded or not
		xmlhttp.open("POST", url, true);
		xmlhttp.send();
	};
	
	xuijs.api.WLeaderboard_GetDataFromUrl = function(L)
	{
		//rat.console.log("WLeaderboard_GetDataFromUrl called!");

		var C = xuijs.LuaCAPI;

		// Get number of arguments passed in
		var numPassedArgs = C.lua_gettop(L);

		if (numPassedArgs < 3) {
			throw new Error("xuijs.api.WLeaderboard_GetDataFromUrl(): Not enough args");
		}

		// The first arg should be the calling object, 2nd the url, and third the callback
		var callingObj = C.luaL_checkstring(L, 1);
		C.lua_remove(L, 1);
		var url = C.luaL_checkstring(L, 1);
		C.lua_remove(L, 1);
		var callbackName = C.luaL_checkstring(L, 1);

		// test override for websupport
		//var test = [ { name: "bob", rank: "1", score: "2400" }, { name: "joe", rank: "3", score: "2100" },{ name: "bill", rank: "2", score: "2200" } ]
		//xuijs.callLuaFunc("WLeaderboardHelper", callbackName, [test, callingObj], { skipReturnHandling: true });
		//return;

		var xmlhttp = new XMLHttpRequest();
		xmlhttp.onreadystatechange = function() {
			// parse XML
			if (xmlhttp.readyState != 4)						// 4 is done for ready state
				return;

			if (xmlhttp.status !== HTTP_STATUS_OK && xmlhttp.readyState == 4) {
				xuijs.callLuaFunc("WLeaderboardHelper", callbackName, [null, callingObj], { skipReturnHandling: true });
				return;			// TODO, push error on to the c-stack and send it back, have the calling function check for error
			}
			
			var parser = new DOMParser();
			var xmlData = parser.parseFromString(xmlhttp.responseText, "text/xml");
			var entryList = xmlData.getElementsByTagName("entry");

			var arr = [];
			for (var i = 0; i < entryList.length; ++i) {
				var entry = entryList[i];
				var values = {};
				for (var j = 0; j < entry.attributes.length; ++j) {
					var attrib = entry.attributes[j];
					values[attrib.name] = attrib.value;
					values.length = j + 1; //this is so that the value has a length attribute this way later it will be counted as an array kind of a quick fix for leaderboards but it works
				}
				arr[i] = values;
			}
			
			//var test = [{ name: "bob", rank: "1", score: "2400" }, { name: "joe", rank: "3", score: "2100" }, { name: "bill", rank: "2", score: "2200" }]
			xuijs.callLuaFunc("WLeaderboardHelper", callbackName, [arr, callingObj], { skipReturnHandling: true });
		};
		xmlhttp.open("GET", url, true);
		xmlhttp.send();
	};

	// ***  WStats

	xuijs.api.WStats_SendDataFromUrl = function (L) {
		//rat.console.log("WStats_SendDataFromUrl called!");
		var helperModule = "WStatsHelper";
		var C = xuijs.LuaCAPI;

		// Get number of arguments passed in
		var numPassedArgs = C.lua_gettop(L);

		if (numPassedArgs < 5) {
			throw new Error("xuijs.api.WStats_SendDataFromUrl(): Not enough args");
		}

		// The first arg should be the calling object, 2nd the url, and third the callback
		// we've also added score and gamerTag as they need to be passed back to the callback
		var callingObj = C.luaL_checkstring(L, 1);
		C.lua_remove(L, 1);
		var url = C.luaL_checkstring(L, 1);
		C.lua_remove(L, 1);
		var callbackName = C.luaL_checkstring(L, 1);
		C.lua_remove(L, 1);
		var gamerTag = C.luaL_checkstring(L, 1);
		C.lua_remove(L, 1);
		var refresh = C.luaL_checkint(L, 1);

		var xmlhttp = new XMLHttpRequest();
		xmlhttp.onreadystatechange = function () {
			if (xmlhttp.readyState != 4)						// 4 is done for ready state
				return;

			if (xmlhttp.status !== HTTP_STATUS_OK && xmlhttp.readyState == 4) {
				xuijs.callLuaFunc(helperModule, callbackName, [null, callingObj], { skipReturnHandling: true });
				return;			// TODO, push error on to the c-stack and send it back, have the calling function check for error
			}

			xuijs.callLuaFunc(helperModule, callbackName, [true, callingObj, gamerTag, refresh], { skipReturnHandling: true });
		};  		// nothing really changes whether we succeeded or not
		xmlhttp.open("POST", url, true);
		xmlhttp.send();
	};

	xuijs.api.WStats_GetDataFromUrl = function (L) {
		//rat.console.log("WStats_GetDataFromUrl called!");
		var helperModule = "WStatsHelper";
		var C = xuijs.LuaCAPI;

		// Get number of arguments passed in
		var numPassedArgs = C.lua_gettop(L);

		if (numPassedArgs < 3) {
			throw new Error("xuijs.api.WStats_GetDataFromUrl(): Not enough args");
		}

		// The first arg should be the calling object, 2nd the url, and third the callback
		var callingObj = C.luaL_checkstring(L, 1);
		C.lua_remove(L, 1);
		var url = C.luaL_checkstring(L, 1);
		C.lua_remove(L, 1);
		var callbackName = C.luaL_checkstring(L, 1);

		// test override for websupport
		//return;

		var xmlhttp = new XMLHttpRequest();
		xmlhttp.onreadystatechange = function () {
			// parse XML
			if (xmlhttp.readyState != 4)						// 4 is done for ready state
				return;

			if (xmlhttp.status !== HTTP_STATUS_OK && xmlhttp.readyState == 4) {
				xuijs.callLuaFunc(helperModule, callbackName, [null, callingObj], { skipReturnHandling: true });
				return;			// TODO, push error on to the c-stack and send it back, have the calling function check for error
			}

			var parser = new DOMParser();
			var xmlData = parser.parseFromString(xmlhttp.responseText, "text/xml");
			var entryList = xmlData.getElementsByTagName("entry");

			var arr = [];
			for (var i = 0; i < entryList.length; ++i) {
				var entry = entryList[i];
				var values = {};
				for (var j = 0; j < entry.attributes.length; ++j) {
					var attrib = entry.attributes[j];
					values[attrib.name] = attrib.value;
					values.length = j + 1; //this is so that the value has a length attribute this way later it will be counted as an array kind of a quick fix for leaderboards but it works
				}
				arr[i] = values;
			}

			//var test = [{ name: "bob", rank: "1", score: "2400" }, { name: "joe", rank: "3", score: "2100" }, { name: "bill", rank: "2", score: "2200" }]
			xuijs.callLuaFunc(helperModule, callbackName, [arr, callingObj], { skipReturnHandling: true });
		};
		xmlhttp.open("GET", url, true);
		xmlhttp.send();
	};

	//************************************************************************************************************//

	//**  WOmniture  **//
	xuijs.api.WOmniture_SendReport = function (L) {
		//rat.console.log("WOmniture_SendReport called!");
		var C = xuijs.LuaCAPI;

		// Get number of arguments passed in
		var numPassedArgs = C.lua_gettop(L);

		if (numPassedArgs < 3) {
			throw new Error("xuijs.api.WOmniture_SendReport(): Not enough args");
		}
		if (numPassedArgs > 3) {
			throw new Error("xuijs.api.WOmniture_SendReport(): Too many Args, are we sending more params along than we did originally??");
		}

		// AdExpertOrderNumber, CampaignType, BDETier, Event, Action, ActionName
		var eventName = C.luaL_checkstring(L, 1);
		C.lua_remove(L, 1);
		var actionType = C.luaL_checkstring(L, 1);
		C.lua_remove(L, 1);
		var actionName = C.luaL_checkstring(L, 1);

		// MS stated that in this case we do the name fire and the type-desc thingy second
		if (rat.system.has.xboxLE)
			Reporting.ReportEvent([Number(eventName.substring(5, eventName.length))], actionName, actionType);
	}

	xuijs.api.WOmniture_InitReporting = function (L) {
		//rat.console.log("WOmniture_InitReporting called!");
		var C = xuijs.LuaCAPI;

		// Get number of arguments passed in
		var numPassedArgs = C.lua_gettop(L);

		if (numPassedArgs < 2) {
			throw new Error("xuijs.api.WOmniture_SendReport(): Not enough args");
		}
		if (numPassedArgs > 2) {
			throw new Error("xuijs.api.WOmniture_SendReport(): Too many Args");
		}

		// ChannelName, PageName
		var channelName = C.luaL_checkstring(L, 1);
		C.lua_remove(L, 1);
		var pageName = C.luaL_checkstring(L, 1);

		var x = 0;
		if (rat.system.has.xboxLE)
			Reporting.Init(channelName, pageName);
	}

	xuijs.api.WOmniture_Exit = function (L) {
		var C = xuijs.LuaCAPI;

		// Get number of arguments passed in
		var numPassedArgs = C.lua_gettop(L);

		if (numPassedArgs > 0) {
			throw new Error("xuijs.api.WOmniture_SendReport(): Too many Args");
		}

		var x = 0;
		if (rat.system.has.xboxLE)
			Reporting.Exit();
	}
	//************************************************************************************************************//
 
	xuijs.api.ExitGame = function (L) {
		//rat.console.log("ExitGame called!");

		//	No actual LUA called here...
		//var C = xuijs.LuaCAPI;

		// To handle the close, we should call Ormma.close() from the Main Manu or something similar.
		if (rat.system.has.xboxLE) {
			var exitUrl = void 0;
			if (window.adParams && window.adParams.return_url)
				exitUrl = window.adParams.return_url;					// if MS has the capability of just modifying the adParams as we launch use the return_url there
			else if (rat.fallBackUrl)
				exitUrl = rat.fallBackUrl;								// this is a special set URL for MS to modify and set externally after we send this to them, as a backup to return_url

			if (exitUrl)
				Maple.open("ms-ad-wed:?f=0&debug=0&cu=" + exitUrl);
			else
				Ormma.close();
		} else if (rat.system.has.Wraith) {
			if (window.close)
				window.close();
		} else {
			rat.console.log( ">>>>APP REQUESTED CLOSE WHEN APP IS UNABLE TO CLOSE!<<<<" );
			//	NOTE: This is not likely to work in browsers...
			// if (window.close)
			//	window.close();
		}

		// all other systems do nothing for now
	}

	//************************************************************************************************************//

	// this is mostly because on the XBO i have been having issues getting console logging
	// so while this may write to the console, i may not see it, and this is a handy place to put a breakpoint to make sure i see the logging I want
	xuijs.api.WriteLog = function (L) {
		// Get number of arguments passed in
		var numPassedArgs = xuijs.LuaCAPI.lua_gettop(L);

		var message = xuijs.LuaCAPI.luaL_checkstring(L, 1);
		rat.console.log(message);
	}

	//************************************************************************************************************//

	//	A function to expose the rat profiler
	xuijs.api.pushPerfMark = function( L )
	{
		if( rat.profiler && rat.profiler.enableProfiler && rat.profiler)
		{
			var C = xuijs.LuaCAPI;
			// Get number of arguments passed in
			var numPassedArgs = C.lua_gettop(L);
			if (numPassedArgs < 1) {
				throw new Error("xuijs.api.pushPerfMark(): Not enough args");
			}

			// The first arg should be the file path.
			var name = C.luaL_checkstring(L, 1);
			
			rat.profiler.push( name );
		}
	};
	
	//	A function to pop a rat profiler mark
	xuijs.api.popPerfMark = function()
	{
		if( rat.profiler )
			rat.profiler.pop();
	};
	
	xuijs.api.bitTest = function(L)
	{
		var C = xuijs.LuaCAPI;
		
		// Get number of arguments passed in
		var numPassedArgs = C.lua_gettop(L);
		if (numPassedArgs < 2) {
			throw new Error("xuijs.api.bitTest(): Not enough args");
		}

		// The first arg should the flag set
		var set = C.luaL_checknumber(L, 1);
		
		//	The second flag should be the bit
		var bit = C.luaL_checknumber(L, 2);
		
		C.lua_pushboolean(L, (set&bit) !== 0 );
		return 1;
	};
	
	var LUABtnTranslation = void 0;
	var LUABtnOppositeKeys = void 0;
	
	var ProcessControllerStateArgs = {
		self: 1,
		pressed: 2,
		triggered: 3,
		//deltaTime: 2,
		//released: 5,
		//delays: 5,
		//pressedDelay: 6,
		num: 3
	};
	xuijs.api.processControllerState = function(L)
	{
		if (!LUABtnTranslation)
		{
			LUABtnTranslation = {};
			
			// LUABtnTranslation[rat.input.BUTTON_UP] = "";
			// LUABtnTranslation[rat.input.BUTTON_DOWN] = "";
			// LUABtnTranslation[rat.input.BUTTON_LEFT] = "";
			// LUABtnTranslation[rat.input.BUTTON_RIGHT] = "";

			LUABtnTranslation[rat.input.BUTTON_SELECT] = "VK_PAD_BACK";
			LUABtnTranslation[rat.input.BUTTON_START] = "VK_PAD_START";
			
			LUABtnTranslation[rat.input.BUTTON_A] = "VK_PAD_A";
			LUABtnTranslation[rat.input.BUTTON_B] = "VK_PAD_B";
			LUABtnTranslation[rat.input.BUTTON_X] = "VK_PAD_X";
			LUABtnTranslation[rat.input.BUTTON_Y] = "VK_PAD_Y";
			
			LUABtnTranslation[rat.input.BUTTON_LT] = "VK_PAD_LTRIGGER";
			LUABtnTranslation[rat.input.BUTTON_LB] = "VK_PAD_LSHOULDER";
			LUABtnTranslation[rat.input.BUTTON_RT] = "VK_PAD_RTRIGGER";
			LUABtnTranslation[rat.input.BUTTON_RB] = "VK_PAD_RSHOULDER";

			LUABtnTranslation[rat.input.BUTTON_DPAD_UP] = "VK_PAD_DPAD_UP";
			LUABtnTranslation[rat.input.BUTTON_DPAD_DOWN] = "VK_PAD_DPAD_DOWN";
			LUABtnTranslation[rat.input.BUTTON_DPAD_LEFT] = "VK_PAD_DPAD_LEFT";
			LUABtnTranslation[rat.input.BUTTON_DPAD_RIGHT] = "VK_PAD_DPAD_RIGHT";
			
			LUABtnTranslation[rat.input.BUTTON_LEFT_STICK] = "VK_PAD_LTHUMB_PRESS";
			LUABtnTranslation[rat.input.BUTTON_RIGHT_STICK] = "VK_PAD_RTHUMB_PRESS";
			
			LUABtnTranslation[rat.input.BUTTON_LSTICK_UP] = "VK_PAD_LTHUMB_UP";
			LUABtnTranslation[rat.input.BUTTON_LSTICK_DOWN] = "VK_PAD_LTHUMB_DOWN";
			LUABtnTranslation[rat.input.BUTTON_LSTICK_LEFT] = "VK_PAD_LTHUMB_LEFT";
			LUABtnTranslation[rat.input.BUTTON_LSTICK_RIGHT] = "VK_PAD_LTHUMB_RIGHT";

			LUABtnTranslation[rat.input.BUTTON_RSTICK_UP] = "VK_PAD_RTHUMB_UP";
			LUABtnTranslation[rat.input.BUTTON_RSTICK_DOWN] = "VK_PAD_RTHUMB_DOWN";
			LUABtnTranslation[rat.input.BUTTON_RSTICK_LEFT] = "VK_PAD_RTHUMB_LEFT";
			LUABtnTranslation[rat.input.BUTTON_RSTICK_RIGHT] = "VK_PAD_RTHUMB_RIGHT";
			
			LUABtnOppositeKeys = {
				"VK_PAD_DPAD_UP": 		"VK_PAD_DPAD_DOWN",
				"VK_PAD_DPAD_DOWN":		"VK_PAD_DPAD_UP",
				"VK_PAD_DPAD_LEFT":		"VK_PAD_DPAD_RIGHT",
				"VK_PAD_DPAD_RIGHT":		"VK_PAD_DPAD_LEFT",
				"VK_PAD_LTHUMB_UP":		"VK_PAD_LTHUMB_DOWN",
				"VK_PAD_LTHUMB_DOWN":	"VK_PAD_LTHUMB_UP",
				"VK_PAD_LTHUMB_LEFT":	"VK_PAD_LTHUMB_RIGHT",
				"VK_PAD_LTHUMB_RIGHT":	"VK_PAD_LTHUMB_LEFT",
				"VK_PAD_RTHUMB_UP":		"VK_PAD_RTHUMB_DOWN",
				"VK_PAD_RTHUMB_DOWN":	"VK_PAD_RTHUMB_UP",
				"VK_PAD_RTHUMB_LEFT":	"VK_PAD_RTHUMB_RIGHT",
				"VK_PAD_RTHUMB_RIGHT":	"VK_PAD_RTHUMB_LEFT"
			};
		}
		if( xuijs.disableControllersThisFrame )
		{
			xuijs.disableControllersThisFrame = false
			return 0;
		}
		
		var C = xuijs.LuaCAPI;
		var args = ProcessControllerStateArgs;
		var numPassedArgs = C.lua_gettop(L);
		if (numPassedArgs !== args.num )
		{
			throw new Error("processControllerState(): Not enough args");
			return 0;
		}
		C.luaL_checktype( L, args.self, C.LUA_TTABLE );
		//C.luaL_checktype( L, args.deltaTime, C.LUA_TNUMBER );
		C.luaL_checktype( L, args.pressed, C.LUA_TTABLE );
		C.luaL_checktype( L, args.triggered, C.LUA_TTABLE );
		//C.luaL_checktype( L, args.released, C.LUA_TTABLE );
		//C.luaL_checktype( L, args.delays, C.LUA_TTABLE );
		//C.luaL_checktype( L, args.pressedDelay, C.LUA_TNUMBER );
		
		rat.profiler.pushPerfMark( "GetCombinedControllers" );
		var controller = rat.input.getCombinedControllers();
		rat.profiler.popPerfMark( "GetCombinedControllers" );
		if( !controller )
			return 0;
		
		//var deltaTime = C.lua_tonumber( L, args.deltaTime );
		//var pressedDelay = C.lua_tonumber( L, args.pressedDelay );
				
		var btnCount = rat.input.BUTTON_COUNT;
		rat.profiler.pushPerfMark( "BUTTON UPDATE!" );
		for( var btn = 0; btn !== btnCount; ++btn )
		{
			//rat.console.log( "update input for btn " + btn );
			//rat.profiler.pushPerfMark( "shift" );
			var key = 1 << btn;
			//rat.profiler.popPerfMark( "shift" );
			//rat.profiler.pushPerfMark( "LookupTranslation!" );
			var id = LUABtnTranslation[key];
			//rat.profiler.popPerfMark( "LookupTranslation!" );
			if( !id )
				continue;
			
			//rat.console.log( "   Button is " + id );
			//rat.profiler.pushPerfMark( "test!" );
			var pressed = (controller.rawButtons & key) !== 0;
			//rat.profiler.popPerfMark( "test!" );
			
			//rat.profiler.pushPerfMark( "oldState" );
			C.lua_getfield( L, args.pressed, id );
			var isPressed = C.lua_toboolean( L, -1 );
			C.lua_pop( L, 1 );
			//rat.profiler.popPerfMark( "oldState" );
			
			//rat.console.log( "KEY " + key + "(" + id + ") " + (pressed ? "DOWN" : "UP") );
			if( pressed )
			{
				//rat.profiler.pushPerfMark( "pressed" );
				var isTriggered = xuijs.getTableValue( L, args.triggered, id, C.LUA_TBOOLEAN, void 0, false );

				//rat.console.log( "   checking opkey" );
				var opKey = LUABtnOppositeKeys[ id ];
				//rat.console.log( "      OPKey = " + (opKey || "VOID") );
				if (opKey)
				{
					C.lua_pushboolean(L, false);
					C.lua_setfield( L, args.triggered, opKey );
					C.lua_pushboolean(L, false);
					C.lua_setfield( L, args.pressed, opKey );
					//C.lua_pushboolean(L, true);
					//C.lua_setfield( L, args.released, opKey );
				}

				if (!isTriggered && !isPressed)
				{
					C.lua_pushboolean(L, true);
					C.lua_setfield( L, args.triggered, id );
					C.lua_pushboolean(L, true);
					C.lua_setfield( L, args.pressed, id );
					//C.lua_pushboolean(L, false);
					//C.lua_setfield( L, args.released, id );
					
					//C.lua_pushnumber(L, pressedDelay );
					//C.lua_setfield( L, args.delays, id );
				}
				else if(isTriggered)
				{
					C.lua_pushboolean(L, false);
					C.lua_setfield( L, args.triggered, id );
					C.lua_pushboolean(L, true);
					C.lua_setfield( L, args.pressed, id );
					//C.lua_pushboolean(L, false);
					//C.lua_setfield( L, args.released, id );
				}
				//rat.profiler.popPerfMark( "pressed" );
			}
			else if (isPressed)
			{
				//( L, index, name, type, func, forceType )
				//rat.profiler.pushPerfMark( "released" );
				C.lua_pushboolean(L, false);
				C.lua_setfield( L, args.triggered, id );
				C.lua_pushboolean(L, false);
				C.lua_setfield( L, args.pressed, id );
				C.lua_pushboolean(L, true);
				//C.lua_setfield( L, args.released, id );
				//rat.profiler.popPerfMark( "released" );
			}
			
			//rat.profiler.pushPerfMark( "delays" );
			//C.lua_getfield(L, args.delays, id);
			//if (!C.lua_isnil(L, -1) )
			//{
			//	var delay = C.lua_tonumber( L, -1 );
			//	delay -= deltaTime;
			//	C.lua_pop( L, 1 );
			//	C.lua_pushnumber( L, delay );
			//	C.lua_setfield( L, args.delays, id );
			//}
			//C.lua_pop( L, 1 );
			//rat.profiler.popPerfMark( "delays" );
		}
		rat.profiler.popPerfMark( "BUTTON UPDATE!" );
		return 0;
	};
	
	// A function for getting the current state on the controller(s).
	// It will need to return a complex object,
	// so we can't just use callXuijsAPIFunction.
	xuijs.api.getControllerState = function(L)
	{
		var C = xuijs.LuaCAPI;
		
		// allow us to turn off controllers for a while to bypass the incursion it makes to our framerate
		// disable on each frame where the lua is getting bypassed and rat is accessing the controllers directly
		if( xuijs.disableControllersThisFrame )
		{
			xuijs.disableControllersThisFrame = false
			return 0;
		}
		
		// Get controller state.
		// Maybe loop over all controllers and send them all over?
		var controller = rat.input.getCombinedControllers();
		if (!controller)
			return;
		// Create new table on the stack, to be the return object.
		C.lua_newtable(L);
		
		// Add entries into the result table
		// Maybe loop over all the properties in controller and convert them all generically?
		
		// For each entry, push a value onto the stack, then call lua_setfield, with -2 referring to the result table.
		
		//	Push on controller values
		PushKeyAs( L, controller, "id", "string" );
		PushKeyAs( L, controller, "index", "number" );
		PushKeyAs( L, controller, "connected", "boolean" );
		PushKeyAs( L, controller, "timestamp", "number" );
		PushKeyAs( L, controller, "rawButtons", "integer" );
		PushKeyAs( L, controller, "newButtons", "integer" );
		PushKeyAs( L, controller, "lastButtons", "integer" );
		xuijs.LuaCAPI.lua_createtable(L, 0, 2);
			PushKeyAs( L, controller.leftStick, "x", "number" );
			PushKeyAs( L, controller.leftStick, "y", "number" );
		xuijs.LuaCAPI.lua_setfield(L, -2, "leftStick");
		
		xuijs.LuaCAPI.lua_createtable(L, 0, 2);
			PushKeyAs( L, controller.rightStick, "x", "number" );
			PushKeyAs( L, controller.rightStick, "y", "number" );
		xuijs.LuaCAPI.lua_setfield(L, -2, "rightStick");

		xuijs.LuaCAPI.lua_createtable(L, 0, 2);
			PushKeyAs( L, controller.leftTrigger, "x", "number" );
			PushKeyAs( L, controller.leftTrigger, "y", "number" );
		xuijs.LuaCAPI.lua_setfield(L, -2, "leftTrigger");
		
		xuijs.LuaCAPI.lua_createtable(L, 0, 2);
			PushKeyAs( L, controller.rightTrigger, "x", "number" );
			PushKeyAs( L, controller.rightTrigger, "y", "number" );
		xuijs.LuaCAPI.lua_setfield(L, -2, "rightTrigger");

		// Result should be on the top of the stack.
		// Return 1 since we're just returning one object.
		return 1;
	};
	
	
	// A container for api utility functions.
	// Some of these are called by Lua indirectly through callXuijsAPIFunction(),
	// others are simple utility functions used in various places.
	xuijs.apiUtils = {};
	
	// Calls the main CycleUpdate loop on the Lua side.
	xuijs.apiUtils.LuaCycleUpdate = function(deltaTime)
	{
		if( xuijs.isInitialized() ){
			rat.profiler.pushPerfMark( "LUA Update" );
			xuijs.callLuaFunc("main", "CycleUpdate", [deltaTime]);
			rat.profiler.popPerfMark( "LUA Update" );
		}
	}
	
	// Add an element to the main XuiScreen
	xuijs.apiUtils.AddElementToScreen = function(xuiHandle)
	{
		// Get the xui element
		var xuiElement = xuijs.getXuiElementByHandle(xuiHandle);
		if( !xuiElement ){
			throw new Error("xuijs.api.AddElementToScreen(): Couldn't find xuiElement by handle: " + xuiHandle + "!");
		}
		
		// Add the element to the screen.
		if( xuijs.xuiScreen ){
			xuijs.xuiScreen.addXuiElement(xuiElement);
		}
	};
	
	// create a xui item from a file
	//	maps to WScene in wahoolua
	var loadCount = {};
	xuijs.apiUtils.createXuiItemFromFile = function (xuiFilePath, returnFirstChild)
	{
		//var startTime = window.performance.now();
		
		// Adjust path to one suitable for converted xui json file
		var jsonPath = xuiFilePath;
		var regExp;
		
		// Strip everything before a # (not exactly sure of this, but it should work for us).
		regExp = /.*#/;
		jsonPath = jsonPath.replace(regExp, "");
		
		//	apply prefix path if we have one.
		if (xuijs.mAssetPrefixPath && xuijs.mAssetPrefixPath !== "")
		{
			//	and if not already there
			if (jsonPath.indexOf(xuijs.mAssetPrefixPath) !== 0)
				jsonPath = xuijs.mAssetPrefixPath + jsonPath;
		}
		
		// Replace .xui or .xur with .json
		regExp = /(\.xui$)|(\.xur$)/i;
		jsonPath = jsonPath.replace(regExp, ".json");
		
		// Get the json data from the pre-loaded data.
		// We have to pre-load because we need this to happen synchronously.
		var xuiData = xuijs.getPreloadedXuiData(jsonPath);
		if( !xuiData ){
			throw new Error("xuijs.apiUtils.WScene_Create(): Didn't find pre-loaded xui data for \"" + jsonPath + "\"!");
		}
		
		// Call the parser to create the scene
		var basePath = jsonPath.slice(0, jsonPath.lastIndexOf("/"));
		var scene = xuijs.parser.createXuiItem(xuiData, basePath, returnFirstChild);
		
		//var endTime = window.performance.now();
		//loadCount[xuiFilePath] = loadCount[xuiFilePath] || 0;
		//loadCount[xuiFilePath]++;
		//rat.console.log( "Loaded " + xuiFilePath + " (#" + loadCount[xuiFilePath] + ").  Took " + ((endTime - startTime)/1000) );
		return scene;
	};

	
	///////////// Utility Functions /////////////
	
	// Utility function for getting a javascript value based on a value on the Lua stack.
	// For now only simple types are supported, plus a special case where a table is a Lua-side XuiElement.
	// C is the Lua API object, L is the Lua state, i is the index on the stack to convert.
	// Doesn't affect the Lua stack.
	xuijs.apiUtils.getJSValueFromLua = function(L, i)
	{
		var C = xuijs.LuaCAPI;
		
		var value;
		var type = C.lua_type(L, i);
		switch(type){
			case C.LUA_TNIL:
				value = null;
				break;
			case C.LUA_TBOOLEAN:
				value = C.lua_toboolean(L, i) ? true : false;
				break;
			case C.LUA_TNUMBER:
				value = C.lua_tonumber(L, i);
				break;
			case C.LUA_TSTRING:
				// TODO: Do we need to worry about copying the strings, them going out of scope when we pop the stack, etc.?
				value = C.lua_tostring(L, i);
				break;
			case C.LUA_TTABLE:
				// Deal with the special case that the value is a Lua-side XuiElement
				C.lua_getfield(L, i, "xuijsHandle");
				var handleType = C.lua_type(L, -1);
				if( handleType == C.LUA_TNUMBER ){
					var handle = C.lua_tonumber(L, -1);
					value = xuijs.getXuiElementByHandle(handle);
				}
				// Pop xuijsHandle off the stack.
				C.lua_pop(L, 1);
				
				if( value ){
					break;
				}
				// Fall through to error case.
			default:
				throw new Error("xuijs.apiUtils.getJSValueFromLua: Unsupported Lua type: " + C.lua_typename(L, type));
		}
		
		return value;
	};
	
	// Utility function for pushing a value onto the Lua stack based on a javascript value.
	// For now only simple types are supported, plus a special case where jsValue is a JS-side XuiElement.
	// C is the Lua API object, L is the Lua state, jsValue is the javascript value to convert and push.
	xuijs.apiUtils.pushLuaValueFromJSValue = function(L, jsValue)
	{
		var C = xuijs.LuaCAPI;
		
		switch(typeof jsValue){
			case "undefined":
				C.lua_pushnil(L);
				break;
			case "boolean":
				C.lua_pushboolean(L, jsValue);
				break;
			case "number":
				C.lua_pushnumber(L, jsValue);
				break;
			case "string":
				C.lua_pushstring(L, jsValue);
				break;
			case "object":
				if( jsValue === null ){
					C.lua_pushnil(L);
					break;
				}
				// Deal with the special case that the object is a JS-side XuiElement, and push the handle value.
				else if (jsValue instanceof xuijs.XuiElement) {
					C.lua_pushnumber(L, jsValue.GetHandle());
					break;
				}
				else {
					
					//	STT note:  We all seem to agree that this function is broken,
					//	but nobody is willing to dig into fixing and testing the changes.
					//	I'm leaving this note so we remember.
					//	First, this seems like it ought to be an === check here.
					//	second, should we detect arrays instead of objects with a length property?  See kludge above for leaderboards and stats
					if (jsValue.length == 0) {
						C.lua_pushnil(L);
						break;
					}
					
					if(jsValue.length) {
						C.lua_newtable(L);

						// Add entries into the result table
						// loop over all the properties in data list and convert them all generically

						// For each entry, push a value onto the stack, then call lua_setfield, with -2 referring to the result table.
						//TODO - instead of hardcoding this to one deep, take care of everything with recursive pushLuaValueFromJSValue calls
						for (var k in jsValue) {
							xuijs.apiUtils.pushLuaValueFromJSValue(L, jsValue[k])
							C.lua_setfield(L, -2, k);
						}
					}
					break; 
				}
				// TODO: Could do something here to detect an array and push a new table with numeric keys.
			default:
				throw new Error("xuijs.apiUtils.pushLuaValueFromJSValue: Unsupported jsValue type: " + typeof jsValue);
		}
	};

	// Utility function for telling if a Javascript value is an array
	xuijs.apiUtils.isArray = Array.isArray || function(obj){
		return Object.prototype.toString.call(obj) === '[object Array]';
	};

	// Utility function for getting a string with some info about the table on the stack at stack-index i.
	// Right now just dumps top level key value pairs.
	xuijs.apiUtils.tableInfo = function(L, index){
		var C = xuijs.LuaCAPI;
		
		var tableInfo = "{";
		
		// Push a reference to the table on top of the stack
		C.lua_pushvalue(L, index);
		
		// Push nil to represent the first key
		C.lua_pushnil(L);
		
		// Use lua_next to pop a key and push the key-value pair of the next entry onto the stack.
		while(C.lua_next(L, -2)){
			// Get key-value info
			
			// index -1 should be value, -2 should be key
			// Make sure lua_tostring is not used on a key that's a number, 
			// or it will change the value on the stack, and mess up out iteration.
			
			// Let's just push a copy of the key onto the stack, so we don't have to check type.
			C.lua_pushvalue(L, -2);
			
			var key = C.lua_tostring(L, -1);
			var value;
			if( C.lua_type(L, -2) == C.LUA_TTABLE ){
				value = "<subtable>";
			}
			else{
				value = C.lua_tostring(L, -2);
			}
			tableInfo += key + ": " + value + ", ";
			
			// Pop the copied key and the value off the stack, leaving the original key there for the lua_next call.
			C.lua_pop(L, 2);
		}
		
		// Pop off the reference to the original table we pushed earlier.
		C.lua_pop(L, 1);
		
		tableInfo += "}";
		return tableInfo;
	};
	
	// Utility function for dumping info about the Lua-C stack.
	xuijs.apiUtils.dumpLuaAPIStack = function(L){
		var C = xuijs.LuaCAPI;
		
		rat.console.log("--============= Lua API Stack Dump =============--");
		
		var top = C.lua_gettop(L);
		for(var i = 1; i <= top; i++ ){
			var type = C.lua_type(L, i);
			var typeName = C.lua_typename(L, type);
			var value = null;
			switch(type){
				case C.LUA_TBOOLEAN:
					value = C.lua_toboolean(L, i) ? true : false;
					break;
				case C.LUA_TNUMBER:
					value = C.lua_tonumber(L, i);
					break;
				case C.LUA_TSTRING:
					value = C.lua_tostring(L, i);
					break;
				case C.LUA_TTABLE:
					value = xuijs.apiUtils.tableInfo(L, i);
					break;
			}
			
			var info = "\t" + i + ": " + typeName + " (type = " + type + ")";
			if( value !== null ){
				info += " - " + value;
			}
			rat.console.log( info );
		}
		rat.console.log("--============= End Lua API Stack Dump =============--");
	};

	
} );