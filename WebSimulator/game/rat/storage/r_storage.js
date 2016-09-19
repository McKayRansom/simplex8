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
		
		if (document.cookie)
		{
			document.cookie = "FakeStorage=; expires=Thu, 01 Jan 1970 00:00:00 UTC";
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
			var Ctor = rat.LocalStore;
			if( !window.localStorage && document.cookie != void 0 )
				Ctor = rat.LocalCookieStore;
			if (storeType === rat.storage.permanentLocal)
				storageObjects[storeType] = new Ctor('');
			else if (storeType === rat.storage.suspendLocal)
				storageObjects[storeType] = new Ctor('_sus_');
		}

		return storageObjects[storeType];
	};

	rat.storage.permanentLocal = 1;	//	e.g. local store - store on local device
	rat.storage.permanentRoaming = 2;	//	store in cloud
	rat.storage.permanentServer = 3;	//	store on our game server per user
	rat.storage.suspendLocal = 4;		//	temp during suspend
	
	//	make storage clear command available in console
	rat.console.registerCommand("clearStorage", function (cmd, args)
	{
		rat.storage.clear();
	});
	
	//--------------------- generic implementation - base class -----------------------------

	///
	/// BasicStorage for basic storage class
	/// @constructor 
	rat.BasicStorage = function (prefix)
	{
		this.prefix = prefix || "";
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
		this.prefix = prefix || "";
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
		
		this._fireOnReady();
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
	
	//--------------------- Cookie version for when we don't have local storage -----------------------------

	///
	/// Local Cookie Storage
	/// @constructor 
	/// @extends rat.BasicStorage
	///
	rat.LocalCookieStore = function (prefix)
	{
		rat.LocalCookieStore.prototype.parentConstructor.call(this, prefix); //	default init

		//	Record the data that we know is in the cookie
		this.cookieData = {};
		
		//	Get the current cookie data
		var str = document.cookie || "";
		var propList = str.split(";");
		for( var i = 0; i < propList.length; ++i )
		{
			var prop = propList[i].trim();
			var name, value;
			var equalAt = prop.indexOf("=");
			if( equalAt != -1 )
			{
				name = prop.substr( 0, equalAt ).trim();
				value = prop.substr( equalAt + 1 ).trim();
			}
			else
			{
				name = prop;
				value = "{}";
			}
			
			if( name == "FakeStorage" )
			{
				try
				{
					this.cookieData = JSON.parse(value);
				}
				catch(err)
				{
					rat.console.log("WARNING: Unable to parse save data from cookie data");
					this.cookieData = {};
				}
				break;
			}
		}
		
		//	Ready
		this._fireOnReady();
	};
	rat.utils.inheritClassFrom(rat.LocalCookieStore, rat.BasicStorage);

	//	just map the simple calls
	// We suppress checkTypes because Wraith does take three args even if windows only takes 2
	/** @suppress {checkTypes} */
	rat.LocalCookieStore.prototype._internalSetItem = function (key, value)
	{
		if( this.prefix.length > 0 )
			key = this.prefix + key;
		this.cookieData[this.prefix + key] = value;
		this._internalSave();
	};
	// We suppress checkTypes because Wraith does take three args even if windows only takes 2
	/** @suppress {checkTypes} */
	rat.LocalCookieStore.prototype._internalGetItem = function (key)
	{
		if( this.prefix.length > 0 )
			key = this.prefix + key;
		return this.cookieData[key];
	};
	// We suppress checkTypes because Wraith does take three args even if windows only takes 2
	/** @suppress {checkTypes} */
	rat.LocalCookieStore.prototype.remove = function (key)
	{
		if( this.prefix.length > 0 )
			key = this.prefix + key;
		delete this.cookieData[key];
		this._internalSave();
	};
	// We suppress checkTypes because Wraith does take three args even if windows only takes 2
	/** @suppress {checkTypes} */
	rat.LocalCookieStore.prototype.hasData = function ()
	{
		return true;
	};
	// We suppress missingProperties save may exist (as it does under Wraith)
	/** @suppress {missingProperties} */
	rat.LocalCookieStore.prototype._internalSave = function (func, ctx)
	{
		rat.console.log("Saving storage.");
		document.cookie = "FakeStorage=; expires=Thu, 01 Jan 1970 00:00:00 UTC";
		document.cookie = "FakeStorage="+ JSON.stringify(this.cookieData) + ";";
		rat.console.log("...Done");
		if (func)
			func.call(ctx);
		return;
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