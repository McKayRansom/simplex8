//
//	rat module that handles preloading sounds, images, and atlases
//

//	A example of how to use the preloader
//var preloder = new rat.utils.Preloader({
//	"audio": [],	//	For the format of this see rat.audio.loadSounds
//	"atlases": [ {atlas: "path_to_image", json: "path_to_json"}, ... ],
//	"images": [],	//	For the format of this see rat.graphics.preLoadImages
//	"strings": []	//	For the format of this see rat.strings.init (first param)
//});
rat.modules.add( "rat.utils.r_preload",
[
	{name: "rat.debug.r_console", processBefore: true},
	
	"rat.utils.r_cycleupdate",
	"rat.graphics.r_image",
	"rat.audio.r_audio",
	"rat.utils.r_utils",
	"rat.utils.r_string",
],
function(rat)
{
	//	items that we can preload
	var preloadable = {
		audio: "audio",
		atlases: "atlases",
		images: "images",
		strings: "strings"
	};

	/** @constructor */
	/// Create the preloader
	var Preloader = function( fields )
	{
		fields = fields || {};

		//	State
		this.loadRunning = false;
		this.loading = {};
		this.loaded = {};
		var key, tag;
		for( key in preloadable )
		{
			tag = preloadable[key];
			this.loading[tag] = false;
			this.loaded[tag] = false;
		}

		//	Special handling for atlases.
		this.atlasImagesLoading = false;
		this.atlasJSONLoading = false;
		
		// Events that we fired when we finish loading
		this.onDone = [];
		
		//	Data
		this.data = {};
		for (key in preloadable)
		{
			tag = preloadable[key];
			this.data[tag] = fields[tag] || [];
		}
				
		//	Data for the preloader when firing done callbacks to make sure that the list does not get screwed up.
		this.fireCBIndex = -1;

		this.cycleUpdateFunc = this.cycleUpdate.bind(this);

		// Maybe add code here to go and find any additional images images to preload
	};
	
	///	How does this module log
	Preloader.prototype.log = rat.console.log;	//	This is here so apps can override it.
		
	///	Register a new function to fire when we have finished loading
	Preloader.prototype.registerOnDone = function(cb, ctx, options)
	{
		options = options || {};
		options.autoRemove = !!options.autoRemove;
		
		if( cb )
		{
			this.onDone.push({ cb: cb, ctx: ctx, options: options});
		}
	};
	
	///	Remove a registered done function
	Preloader.prototype.unregisterOnDone = function(cb, ctx)
	{
		var index, entry;
		if( typeof(cb) === "number" )
		{
			index = cb;
			if( index >= 0 && index < this.onDone.length )
			{
				entry = this.onDone[index];
				if( index < this.fireCBIndex )
					--this.fireCBIndex;
				this.onDone.splice( index, 1 );
					return true;
			}
		}
		else if( cb )
		{
			for( index = 0; index !== this.onDone.length; ++index )
			{
				entry = this.onDone[index];
				if( entry.cb === cb && entry.ctx === ctx )
				{
					if( index < this.fireCBIndex )
						--this.fireCBIndex;
					this.onDone.splice( index, 1 );
					return true;
				}
			}
		}		
		return false;
	};
	
	///	Fire the one done events
	Preloader.prototype.fireOnDone = function()
	{
		var entry;
		for( this.fireCBIndex = 0; this.fireCBIndex !== this.onDone.length; ++this.fireCBIndex )
		{
			entry = this.onDone[this.fireCBIndex];
			entry.cb.call( entry.ctx );	//	Fire the cb
		}
		
		this.fireCBIndex = -1;
		
		for( var index = this.onDone.length-1; index >= 0; --index )
		{
			entry = this.onDone[index];
			if( entry.options.autoRemove )
				this.unregisterOnDone( index );
		}
	};
	
	///	Return if everything is loaded
	Preloader.prototype.isLoaded = function()
	{
		for (var key in this.loaded)
			if (!this.loaded[key])
				return false;
		return true;
	};
	
	///	Return if anything is loading
	Preloader.prototype.isLoading = function()
	{
		return this.loadRunning;
	};

	///	Called once per atlas JSON that gets loaded
	Preloader.prototype._loadedSingleAtlasJSON = function (entry, data)
	{
		entry.jsonData = data;
	};

	///	Called once per atlas that has loaded both image that gets loaded
	Preloader.prototype._loadedAtlasJSON = function()
	{
		this.atlasJSONLoading = false;
	};

	///	Call to finish the preload of this atlas.
	Preloader.prototype._loadedSingleAtlas = function (entry)
	{
		//this.log("...Finished loading atlas " +entry.name);
		rat.graphics.Image.registerSpriteSheet(entry.atlas, entry.jsonData);
	};

	//	Fired when each type of preload is finished
	Preloader.prototype._preloadSetFinished = function(set)
	{
		this.log("...Finished loading ALL " + set + ".");
		this.loading[set] = false;
		this.loaded[set] = true;
	};

	/// Start the load process if it is not already running and we are not already loaded
	Preloader.prototype.startLoad = function(cb, ctx)
	{
		var index, entry;
		if( cb )
			this.registerOnDone( cb, ctx, {autoRemove:true} );

		var tag, key;
		for (key in preloadable)
		{
			tag = preloadable[key];
			this.loaded[tag] = !this.loading[tag] && this.data[tag].length <= 0;
			this.loading[tag] = this.loading[tag] || (!this.loaded[tag] && this.data[tag].length > 0);
		}
				
		//	Is everything loaded.
		if( this.isLoaded() )
		{
			this.fireOnDone();
			return;
		}

		//	Are we already loading?
		if (this.isLoading())
			return;

		this.loadRunning = true;
		this.log("Staring the preload process.  Loading :");
		for (key in preloadable)
		{
			tag = preloadable[key];
			this.log("   "+tag+":  " + this.data[tag].length);
		}

		//	Add the atlas images to the list of images to load
		var atlases = this.data[preloadable.atlases];
		if( this.loading[preloadable.atlases] )
		{
			for (index = 0; index !== atlases.length; ++index)
				this.data[preloadable.images].push(atlases[index].atlas);
		}

		//	Run through the data and start loading what we need to load
		for (key in preloadable)
		{
			tag = preloadable[key];
			if (!this.loading[tag] || this.loaded[tag])
				continue;

			switch (tag)
			{
				case preloadable.audio:
					rat.audio.loadSounds(this.data[tag]);
					break;

				case preloadable.atlases:
					this.atlasJSONLoading = true;
					this.atlasImagesLoading = true;
					var resources = [];
					for (index = 0; index !== atlases.length; ++index)
					{
						entry = atlases[index];
						resources.push({
							source: entry.json, callback: this._loadedSingleAtlasJSON.bind(this, entry)
						});
					}
					rat.utils.loadResources(resources, this._loadedAtlasJSON.bind(this));

					//	If we are not also loading images, then start that load here
					if (!this.loading[preloadable.images])
						rat.graphics.preLoadImages(this.data[preloadable.images]);
					break;

				case preloadable.images:
					rat.graphics.preLoadImages(this.data[tag]);
					break;

				case preloadable.strings:
					//rat.console.log("init rat.strings with:" + JSON.stringify(this.data[tag]))

					rat.strings.init(this.data[tag]);
					break;

				default:
					this.log("ERROR!  Unrecognized load type!");
					break;
			}
		}

		//	Register ourself as a cycle updater
		rat.cycleUpdate.addUpdater(this.cycleUpdateFunc);
	};
	
	/// Update once per frame
	Preloader.prototype.cycleUpdate = function ()
	{
		//	Check on the status of anything that is still loading
		var key, tag;
		for (key in preloadable)
		{
			tag = preloadable[key];
			if (!this.loading[tag] || this.loaded[tag])
				continue;

			switch (tag)
			{
				case preloadable.audio:
					if (rat.audio.isCacheLoaded())
						this._preloadSetFinished(tag);
					break;

				case preloadable.atlases:
					if (this.atlasImagesLoading && rat.graphics.isCacheLoaded())
						this.atlasImagesLoading = false;
					if (!this.atlasImagesLoading && !this.atlasJSONLoading)
					{
						//	Finish the load for each atlas
						var atlases = this.data[tag];
						for (var index = 0; index !== atlases.length; ++index)
							this._loadedSingleAtlas(atlases[index]);

						this._preloadSetFinished(tag);
					}
					break;

				case preloadable.images:
					if (rat.graphics.isCacheLoaded())
						this._preloadSetFinished(tag);
					break;

				case preloadable.strings:
					if (rat.string.isReady())
						this._preloadSetFinished(tag);
					break;

				default:
					this.log("ERROR!  Unrecognized load type!");
					break;
			}
		}

		if( this.loadRunning && this.isLoaded() )
		{
			this.log("...Preload Finished.");
			rat.cycleUpdate.removeUpdater(this.cycleUpdateFunc);
			this.loadRunning = false;
			this.fireOnDone();
		}
	};

	rat.utils.Preloader = Preloader;
} );