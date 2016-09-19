//
//	Clipboard emulation or access, depending on the system.
//
//	Usage:  clipboard.store({type:'text', value:"My text"});
//			var myValue = clipboard.retrieve('text');
//
//			the idea here is that the clipboard's data could be interpreted several ways, e.g. text, image, path, structure...
//
//	This could eventually do a bunch of work to try to access clipboard,
//	and could detect chrome app status and behave differently.
//	For now, all it does is implement a clipboard local to this webpage.
//
//	By default, we use localstore to cache clipboard across sessions, which is really convenient.
//
rat.modules.add( "rat.os.r_clipboard",
[ ], 
function(rat)
{
	var clipboard = {
		blobs : {
			//	hash, with type as key (and type also listed in object)
			//	e.g.:
			//	'text' : {type:'text', value:'hello'}
		},
	};
	
	clipboard.init = function ()
	{
		//	use a userID here to avoid problems with prefix changing when the app decides it wants to use storage.
		clipboard.localSave = rat.storage.getStorage(rat.storage.permanentLocal, 'rat');
		if (clipboard.localSave)
		{
			//	load anything that was already there.  This is the key value of the cache - to start up with content already.
			var data = clipboard.localSave.getObject('rat_clipboard');
			if (data && data.version === 2)
			{
				clipboard.blobs = data.blobs;
			}
		}
	};
	
	clipboard.cache = function()
	{
		if (clipboard.localSave)
			clipboard.localSave.setObject('rat_clipboard',
			{
				version:2,
				blobs:clipboard.blobs,
			});
	};
	
	//	store current value with this type
	//	{type, value} or array of them.
	clipboard.store = function (blobs, arg2)
	{
		//	old simpler format:  type and value.
		if (typeof(blobs) === 'string')
		{
			blobs = {type:blobs, value:arg2};
		}
		if (!Array.isArray(blobs))
			blobs = [blobs];
		
		clipboard.blobs = {};
		for (var i = 0; i < blobs.length; i++)
		{
			var blob = blobs[i];
			//	store in hash with type as key 
			clipboard.blobs[blob.type] = {type:blob.type, value:blob.value};
		}
		
		clipboard.cache();
	};
	
	//	return value of this type, if it's here.
	//	otherwise return null.
	clipboard.retrieve = function (type)
	{
		if (clipboard.blobs[type])
			return clipboard.blobs[type].value;
		else
			return null;
	};
	
	//	return whatever data we have!
	clipboard.getData = function ()
	{
		if (clipboard.blobs)
			return clipboard.blobs;
		else
			return null;
	};
	
	//	global namespace access
	rat.clipboard = clipboard;
	
});