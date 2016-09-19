//
//	Settings handler (system wide.  If you are looking for user preferences, see r_storage)
//
//	Gloals
//		Used durring development (not exposed to the end use)
//		Allow setting items per user
//		Easy to modify
//		If no settings are found then it is transparent.
//		Cross platform
//		key can be strings, numbers, booleans, etc..
//
//	Possible ways achieve settings...
//	*	Load in a file that may or may not exist (file not included in SVN). 
//		[Pros]
//			*Easy to find/edit.
//			*Can use a JS file that could just execute raw code.
//		[Cons]
//			*Support under SRA's and Windows 8 apps will be more tricky because we don't want to have to add the file to the project.
//	*	store the settings via r_stroage.
//		[Pros]
//			*System already in place to store and load
//			*Can be accessed (via the console) with running products
//		[Cons]
//			*Would have to be modified while the application is running.
//			*Easy to lose your settings.
//	*	via URL
//		[Pros]
//			*Can be accessed (for web pages) after launch
//		[Cons]
//			*Cannot be accessed (for anything but web pages) after launch
//			*difficult to edit and maintain.
//			*would we all have to have short cuts that included the data?
//	All that being said, I think I'm going to go with the separate file options because
//		MUCH easier for designers/artists to access and change.
//		Will will fine for browsers
//		The only requirement at the moment is that if a settings file does not exist, it will need to be created under windows 8 and SRA as they won't deploy with a missing file.
//		The format will be a JSON file.  This makes getting at the data easy for rat as it does not need to know where it was stored.

//	settings namespace
rat.modules.add( "rat.storage.r_settings",
[
	"rat.debug.r_console",
	"rat.storage.r_storage",
],
function(rat)
{
	/** @constructor */
	var Settings = function()
	{
		this.loadedFromSettingsJson = {};
		this.data = {}; // This is where all settings get saved.
		this.doNotSave = {};
	};
	Settings.prototype.isLoading = false;
	Settings.prototype.isLoaded = false;
	Settings.prototype.wasFound = false;
	
	///	Load the settings from the provided file
	Settings.prototype.loadSettings = function(file, doneCB)
	{
		this.isLoading = true;
		
		//	We give it two seconds to load
		var failed = false;
		var	timeoutID = setTimeout( function()
		{
			failed = true;
			rat.console.log( "Warning! Settings file "+ file +" failed to load." );
			this.loadDone(false);
			if (doneCB)
				doneCB();
		}.bind(this), 2000);

		//	Start the JSON load
		rat.utils.loadResources(
			{
				source: file,
				callback: function(data)
				{
					//	Did we already time-out
					if( failed )
						return;
					for (var key in data)
					{
						this.data[key] = data[key];
						this.loadedFromSettingsJson[key] = true;
					}
				}.bind(this)
			},
			function()
			{
				//	Did we already time-out
				if( failed )
					return;
				clearTimeout( timeoutID );
				this.loadDone(true);
				if( doneCB )
					doneCB();
			}.bind(this)
		);
	};

	//	Load the settings from a profile.  NOTE: Will NOT overwrite values set via the settings file.
	Settings.prototype.loadFromProfile = function (userID, storageType)
	{
		storageType = storageType || rat.storage.permanentLocal;
		var storage = rat.storage.getStorage(storageType, userID);
		if (!storage || !storage.hasData)
		{
			app.utils.logWarning("Attempting to access storage for the settings before we have storage");
			return;
		}

		var value;
		for (var key in this.data)
		{
			if (!this.loadedFromSettingsJson[key] && !this.doNotSave[key])
			{
				value = storage.getItem(key);
				if (value !== void 0 && value !== null)
					this.data[key] = JSON.parse(value);
			}
		}
	};

	//	Save the settings to a profile.  NOTE: Will NOT save values loaded from the settings file
	Settings.prototype.writeToProfile = function (userID, storageType)
	{
		storageType = storageType || rat.storage.permanentLocal;
		var storage = rat.storage.getStorage(storageType, userID);
		if (!storage || !storage.hasData)
		{
			app.utils.logWarning("Attempting to access storage for the settings before we have storage");
			return;
		}

		//var value;
		for (var key in this.data)
		{
			if (!this.loadedFromSettingsJson[key] && !this.doNotSave[key])
				storage.setItem(key, JSON.stringify(this.data[key]));
		}
	};
	
	//	Called when we finish loading the settings from a file.
	Settings.prototype.loadDone = function(gotSettings)
	{
		this.isLoading = false;
		this.isLoaded = true;
		this.wasFound = gotSettings;
	};
	
	//	Put this module in rat.
	rat.Settings = Settings;
	
} );

