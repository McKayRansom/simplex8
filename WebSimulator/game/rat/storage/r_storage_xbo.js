//
//	storage layer, xbox specific implementation.
//
//	This is a separate source file in case rat goes open-source, yet xbox-specific calls are under NDA.
//
/*
STATUS:

Save and retrieve code now works, need to implement perma-object and user swapping
--What happens if we dont get a connected storage space? should we make a temporary space to store things until we can get one?
*/
rat.modules.add("rat.storage.r_storage_xbo",
[
	{ name: "rat.storage.r_storage", processBefore: true },
	{ name: "rat.os.r_system", processBefore: true },
	{ name: "rat.utils.r_utils", processBefore: true },

	"rat.os.r_user",
	"rat.debug.r_console",

	//Would it be possible to somehow list firebase as a module here.
	//Would need to add support for listing files and not modules here
],
function (rat)
{
	if (!rat.system.has.Xbox)
		return;

	var prefsName = "saveState";
	var prefsKey = "saveData";		// technically we could split this up into categories like - savePrefs (for audio/music prefs) and saveGameData (game specific data like points/scores/stats/etc), or we can just have individual values like 'gameScore', 'gMusicPref' etc

	//	storage namespace
	rat.storage.XboxOne = {
		userStorageObjects: {}, // We store one object per user (not one obect per user per type)
		machineStorageObject: void 0
		//	define unique xbox values?
		// whateverlikepermanentLocal : 10,
	};

	//	return a reference to the given storage system
	rat.storage.XboxOne.getStorage = function (storeType, userID)
	{
		//	create the proper object depending on requested service
		//	Each type of object we instantiate supports all the same API.

		// we don't want to kick off the startup calls each time we look for a storage object, so save it off
		var userObj = rat.user.getUser(userID);
		if (userID && rat.storage.XboxOne.userStorageObjects[userID])
			return rat.storage.XboxOne.userStorageObjects[userID];
		else if (!userID && rat.storage.XboxOne.machineStorageObject)
			return rat.storage.XboxOne.machineStorageObject;

		//	Note:  All storage uses the same "connected storage" API
		var createdObj;
		if (!userID)
		{
			createdObj = new rat.storage.XboxOne.ConnectedStorage('', void 0);
			rat.storage.XboxOne.machineStorageObject = createdObj;
		}
		else
		{
			createdObj = new rat.storage.XboxOne.ConnectedStorage('', userObj);
			rat.storage.XboxOne.userStorageObjects[userID] = createdObj;
		}

		return createdObj;
	};

	///
	/// Xbox Storage
	/// @constructor 
	/// @extends rat.BasicStorage
	/// @suppress {missingProperties}
	///
	rat.storage.XboxOne.ConnectedStorage = function (prefix, forUser)
	{
		rat.storage.XboxOne.ConnectedStorage.prototype.parentConstructor.call(this, prefix); //	default init
		this.useFallback = false;
		this.currentData = void 0; // if we fail to get connected storage, use this object instead..
		this.gotData = false;

		//	todo - support multiple active users - pass in as argument to this constructor -- done?
		this.connectedStorage = void 0;
		if (forUser)
		{
			//	Get the users connected storage.
			window.Windows.Xbox.Storage.ConnectedStorageSpace.getForUserAsync(forUser.rawData).done(
				//	Success
				function (space)
				{
					//console.log("got connected storage");
					this.connectedStorage = space;
					this.startDataRead();
				}.bind(this),
				//	Failure
				function (error)
				{
					rat.console.log("Failed to get the connected storage object: " + (error.message || JSON.stringify(error)));
					this.useFallback = true;
					this.startDataRead();
				}.bind(this)
			);
		}
		else
		{
			this.useFallback = true;
			this.startDataRead();
		}
	};

	(function () { rat.utils.inheritClassFrom(rat.storage.XboxOne.ConnectedStorage, rat.BasicStorage); })();

	/**
		set a single value
	*	value comes in as JSON, need to get it back into normal form before submitting
	*/
	rat.storage.XboxOne.ConnectedStorage.prototype._internalSetItem = function (key, value)
	{
		this.currentData[key] = value;
	};

	/**
		get a single value
	*	the function above us expects JSON as return input
	*/
	rat.storage.XboxOne.ConnectedStorage.prototype._internalGetItem = function (key)
	{
		return this.currentData[key];
	};

	/**
	 *	Start the xbox data read from connected storage.  Only does asyc calls with a user object
	 **/
	rat.storage.XboxOne.ConnectedStorage.prototype.startDataRead = function ()
	{
		if (this.useFallback)
		{
			this.currentData = {};
			this.gotData = true;
			this._fireOnReady();
		}
		else
		{
			this.connectedStorage.createContainerInfoQuery("").getItemCountAsync().then(
				function (count)
				{
					if (count > 0)
					{
						var container = this.connectedStorage.createContainer(prefsName);
						container.getAsync([prefsKey]).then(
							function (results)
							{
								// Read the favorites data
								try
								{
									var reader = window.Windows.Storage.Streams.DataReader.fromBuffer(results[prefsKey]);
									var count = reader.readInt32();
									var jsonData = reader.readString(count);

									reader.close();

									this.currentData = JSON.parse(jsonData);
								}
								catch (e)
								{
									rat.console.log("Failed to get data: " + (e.message || JSON.stringify(e)));
									this.currentData = {};
								}

								this.gotData = true;
								this._fireOnReady();

							}.bind(this),
							function (results)
							{
								this.currentData = {};
								//console.log("key doesn't exist on connected storage.");

								this.gotData = true;
								this._fireOnReady();
							}.bind(this)
						);
					}
					else
					{
						this.currentData = {};

						this.gotData = true;
						this._fireOnReady();
					}
				}.bind(this)
			);
		}
	};

	///	start the xbox's data write to connected storage
	rat.storage.XboxOne.ConnectedStorage.prototype._internalSave = function (func, ctx)
	{
		if (this.useFallback)
		{
			if (func)
				func.call(ctx);
		}
		else
		{

			// Update the favorites data
			var dataWriter = window.Windows.Storage.Streams.DataWriter();
			var value = JSON.stringify(this.currentData);
			var count = value.length;
			dataWriter.writeInt32(count);
			dataWriter.writeString(value);

			var container = this.connectedStorage.createContainer(prefsName);
			var map = window.Windows.Foundation.Collections.PropertySet();
			map.insert(prefsKey, dataWriter.detachBuffer());
			return container.submitPropertySetUpdatesAsync(map, null).done(
				//	Success
				function (args)
				{
					rat.console.log("csc submit done");
					if (func)
						func.call(ctx);
				},
				//	Failure
				function (args)
				{
					rat.console.log("csc submit failed");
					if (func)
						func.call(ctx);
				}
			);
		}
	};

	/**
		check to see if we have gotten to a point where data is setup
	*/
	rat.storage.XboxOne.ConnectedStorage.prototype.hasData = function ()
	{
		return this.gotData;
	};

	/**
		remove a single value
	* @suppress {missingProperties}
	*/
	rat.storage.XboxOne.ConnectedStorage.prototype.remove = function (key)
	{
		rat.console.log("remove not supported yet with Xbox One Connected Storage Objects (in RAT)");
	};

	/// Clear any held data...
	rat.storage.XboxOne.ConnectedStorage.clear = function ()
	{
		for (var user in rat.storage.XboxOne.userStorageObjects)
		{
			if (rat.storage.XboxOne.userStorageObjects[user])
			{
				rat.storage.XboxOne.userStorageObjects[user].currentData = {};
				rat.storage.XboxOne.userStorageObjects[user].save();
			}
		}

		for (var type in rat.storage.XboxOne.machineStorageObject)
		{
			if (rat.storage.XboxOne.machineStorageObject[type])
			{
				rat.storage.XboxOne.machineStorageObject[type].currentData = {};
				rat.storage.XboxOne.machineStorageObject[type].save();
			}
		}
	};
});
