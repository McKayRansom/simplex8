//
//	Wrapper around saving a file directly to disk (or asking the user to any way)
//
rat.modules.add("rat.storage.r_file_access",
[
	{ name: "rat.os.r_system", processBefore: true },
	{ name: "rat.utils.r_utils", processBefore: true },
],
function (rat)
{
	rat.fileAccess = {
		
		//	Ask the user if they want to save a file
		save: function(data, fileName, onDone)
		{
			if( typeof(Blob) === "undefined" )
			{
				rat.console.log( "Unable to save.   Not supported" );
				if( onDone )
					onDone();
				return;
			}
			
			if (typeof(data) !== 'string')
				data = JSON.stringify( data );
			var b = new Blob( [data], {type:"text/plain"} );
			
			if( rat.system.has.IEBrowser && rat.system.has.IEVersion >= 10 )
			{
				window.navigator.msSaveBlob(b, fileName || "file" );
				if( onDone )
					onDone();
				return;
			}
			else
			{
				var lnk = document.createElement('a');
				lnk.href = window.URL.createObjectURL( b );
				lnk.download = fileName;
				lnk.click();
				if( onDone )
					onDone();
				return;
			}
		},
		
		//	Ask the user to find a file on the disk to load
		openFile: function( onSuccess, onError )
		{
			//	NOT wraith compatable.  
			
			var fileSelector = document.createElement('input');
			fileSelector.type = "file";
			document.body.appendChild( fileSelector );
			function onChange() {
				//fileSelector.removeEventListener( "change", onChange, false );
				fileSelector.parentNode.removeChild(fileSelector);
				var fileList = fileSelector.files;
				fileSelector = void 0;
				
				//	Open the file
				var reader = new FileReader();
				var fullData = "";
				reader.onload = function() {
					fullData += reader.result;
				};
				for( var index = 0; index < fileList.length; ++index )
					reader.readAsText( fileList[index] );
				reader.onloadend = function() {
					reader.onload = void 0;
					reader.onloadend = void 0;
					if (reader.error) {
						alert( "error: " + reader.error.message );
						if( onError )
							onError( reader.error );
					}
					else {
						if( onSuccess )
							onSuccess( fullData );
						//alert( "done" );
					}
				};
				
			}
			//fileSelector.addEventListener( "change", onChange, false );
			fileSelector.onchange = onChange;
			fileSelector.click();
		},
		
		//	Ask the user to find a file or file on disk.
		//	Don't load them - just get their info.
		//	This is basically useless in a browser.  We get individual file names,
		//	but not path!
		//	so, this is sort of here as placeholder until this API can also reflect something like
		//	chrome apps.
		selectFile: function( onSuccess, onError, allowMultiple )
		{
			var fileSelector = document.createElement('input');
			fileSelector.type = "file";
			if (allowMultiple !== void 0)
				fileSelector.multiple = allowMultiple;
			document.body.appendChild( fileSelector );
			function onChange() {
				//fileSelector.removeEventListener( "change", onChange, false );
				fileSelector.parentNode.removeChild(fileSelector);
				var fileList = fileSelector.files;
				fileSelector = void 0;
				
				if (onSuccess)
					onSuccess(fileList);
			}
			fileSelector.onchange = onChange;
			fileSelector.click();
			
			//	any way to detect cancel?
		},
	};
});
