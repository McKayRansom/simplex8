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