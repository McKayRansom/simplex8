
//
// String localization module
//
// Handle pulling of a string based on locale
//
rat.modules.add( "rat.utils.r_string",
[
	"rat.debug.r_console",
	"rat.os.r_system",
	"rat.utils.r_utils",
], 
function(rat)
{
	var STATES = {
		init: "uninit",				//	the rat string objects initial state
		requested: "requested",		//	We are requesting files
		complete: "complete",		//	The files are all done (successfully)
		error: "error"				//	A file failed!
	};
	
	rat.string = {
		currentStatus: STATES.init,			// valid status should be STATES.<state>.  See above
		currentLanguage: "english",			//	The language to used based on the currently set locale
		currentLocale: "en-US",				// the locale we are in, eg en-US for us english, es-ES for spain spanish, ca-FR for French canadian, etc - defaults to US

		stringData: {},						// The string data as defined by our localization strings file 

		supportedLanguages: [],				// When we load in the string data we will populate this with supported languages in order

		callback: void 0,
	};
	rat.string.hasLanguage = {};

	rat.string.useXMLFile = !!window.DOMParser;

	/// Fire the done callback
	rat.string.fireDoneCallback = function ()
	{
		// not sure we should always call the callback even if it errors, but if it errors it is done...
		if (rat.string.callback)
		{
			rat.string.callback();
			rat.string.callback = void 0;
		}
	};

	// initialize, make checks for platform
	var stringFilesPending = 0;
	rat.string.init = function (filenames, callback)
	{
		if (rat.string.currentStatus !== STATES.init)
		{
			rat.console.log("rat.string.init called twice   This is NOT allowed");
			return;
		}

		rat.string.callback = callback;
		if (Array.isArray(filenames) === false)
		{
			if (filenames)
				filenames = [filenames];
			else
				filenames = [];
		}
		stringFilesPending = filenames.length;
		
		if (filenames.length > 0)
		{
			rat.string.currentStatus = STATES.requested;

			if (rat.system.has.xboxLE)
			{
				Maple.addEventListener(ORMMA_EVENT_RESPONSE, rat.string.processUrlCallback);
				Maple.addEventListener(ORMMA_EVENT_ERROR, rat.string.processUrlError);
			}

			for (var index = 0; index !== filenames.length; ++index)
			{
				var filename = filenames[index];

				//	Make sure that have have the correct extension (XML/JSON) based on our platform
				//	First, strip any extension that is there
				var extAtIndex = filename.lastIndexOf(".");
				if( extAtIndex !== -1 )
					filename = filename.slice(0, extAtIndex);
				//	And add the correct extension
				if (rat.string.useXMLFile)
					filename += ".xml";
				else
					filename += ".json";

				//rat.console.log( "Loading string file " + filename);
				if (rat.system.has.xboxLE)
					Maple.request(adParams._projectBase + filename, "proxy", "GET");
				else if (rat.string.useXMLFile)
					rat.utils.loadXML(filename, rat.string.loadData);		// loadData sets status to completed when its finished
				else
					rat.utils.loadJSON(filename, rat.string.loadData);		// loadData sets status to completed when its finished
			}
		}
		else
		{
			rat.string.currentStatus = STATES.complete;
			rat.string.fireDoneCallback();
		}
	};

	// got the XML data, load it up
	rat.string.processUrlCallback = function (url, data)
	{
		if (rat.string.currentStatus !== STATES.requested)
			return;

		rat.string.loadData(data);

		if (stringFilesPending <= 0)
		{
			Maple.removeEventListener(ORMMA_EVENT_RESPONSE, rat.string.processUrlCallback);
			Maple.removeEventListener(ORMMA_EVENT_ERROR, rat.string.processUrlError);
		}
	};

	// failed the callback, probably default to english?
	rat.string.processUrlError = function (message, action)
	{
		if (rat.string.currentStatus !== STATES.requested)
			return;

		stringFilesPending = 0;
		rat.string.currentStatus = STATES.error;
		Maple.removeEventListener(ORMMA_EVENT_RESPONSE, rat.string.processUrlCallback);
		Maple.removeEventListener(ORMMA_EVENT_ERROR, rat.string.processUrlError);

		//	Should we fire this if we fail?
		rat.string.fireDoneCallback();
	};

	// have we done all we can and are ready to start the game up?
	rat.string.isReady = function ()
	{
		// if we error'ed out we will use the default language
		if (rat.string.currentStatus === STATES.complete || rat.string.currentStatus === STATES.error)
			return true;
		return false;
	};

	rat.string.selectLanguage = function ()
	{
		var locale = ["en-US"];
		if (rat.system.has.winJS)
			locale = window.Windows.System.UserProfile.GlobalizationPreferences.languages;

		if (locale && locale[0])
			locale = locale[0];
		//locale = "es-ES"
		rat.string.setLocale(locale);
		rat.console.log("Using locale :" + rat.string.currentLocale + " with language " + rat.string.currentLanguage);
	};

	rat.string.setLocale = function (locale)
	{
		rat.string.currentLocale = locale;
		rat.string.currentLanguage = rat.string.convertLocaleToLanguage(rat.string.currentLocale);
	};

	rat.string.getLocale = function ()
	{
		return rat.string.currentLocale;
	};

	rat.string.getLanguage = function ()
	{
		return rat.string.currentLanguage;
	};

	rat.string.getString = function (stringName)
	{
		var language = rat.string.currentLanguage;

		if (!rat.string.stringData[language])
			language = rat.string.supportedLanguages[0];		// language not supported, use default

		var stringList = rat.string.stringData[language];

		if (stringList && stringList[stringName])
			return stringList[stringName].replace("\\n", "\n");

		return rat.string.getLanguageCode(language) + "_" + stringName;
	};

	//	Get a string, replacing tokens
	//	Usage examples.
	//	STR_CODE is "This is a {0} string" and STR_VAL is "Longest"
	//	getStringReplaceTokens("STR_CODE", "Long");	-> "This is a Long string"
	//	getStringReplaceTokens("STR_CODE", ["Longer"]);	-> "This is a Longer string"
	//	getStringReplaceTokens("STR_CODE", [{value: "STR_VAL", localize:true]);	-> "This is a Longer string"
	//	STR_CODE is "This is a {0} string {1}"
	//	getStringReplaceTokens("STR_CODE", ["Longer", "Buddy"]);	-> "This is a Longer string Buddy"
	//	getStringReplaceTokens("STR_CODE", [{key:"{0}", value:"Longer"}, "Buddy"]);		->	"This is a Longer string Buddy"
	//	STR_CODE is "This is a {CUSTOM} string"
	//	getStringReplaceTokens("STR_CODE", {key:"{CUSTOM}", value:"REALLY CUSTOM"});	->	"This is a REALLY CUSTOM string"
	rat.string.getStringReplaceTokens = function (stringCode, tokensArray)
	{
		tokensArray = tokensArray || [];
		if (Array.isArray(tokensArray) === false)
			tokensArray = [tokensArray];

		var string = rat.string.getString(stringCode);

		var token;
		var val;
		for (var index = 0; index < tokensArray.length; ++index)
		{
			token = tokensArray[index];
			if( token.value !== void 0 )
				val = token.value;
			else
				val = token;
			if (token.localize)
				val = rat.string.getString(val);
			if (token.key !== void 0)
				string = string.replace( token.key, val );
			else
				string = string.replace("{" + index + "}", val);
		}

		return string;
	};

	// Load all our localization information from file
	// not the most robust system and has a number of assumptions like the first column being the string keys, and
	//	the first row being the languages. It also requires the key column to have a language heading (I used "KEY")
	//	We should switch this system to use a JS file setup and make an excel exporter or similar tool accordingly
	//
	rat.string.loadData = function (in_Data)
	{
		//	ABORT if we are not loading.
		if (rat.string.currentStatus !== STATES.requested )
			return;

		// rat.console.log("load data from file: ");
		// rat.console.log("" + in_Data.substring(50, 100));

		if (rat.string.useXMLFile)
		{
			// rat.console.log("using xml parser");
			var parser = new DOMParser();
			var xmlData = parser.parseFromString(in_Data, "text/xml");
			var rows = xmlData.getElementsByTagName("Row");
			var lang;
			var j;
			for (var i = 0; i < rows.length; ++i)
			{
				var data = rows[i].getElementsByTagName("Cell");

				if (i === 0)
				{
					// language setup
					for (j = 0; j < data.length; ++j)
					{
						lang = data[j].textContent.toLowerCase();
						if (!rat.string.hasLanguage[lang])
						{
							rat.string.supportedLanguages.push(lang);
							rat.string.stringData[lang] = {};
							rat.string.hasLanguage[lang] = true;
						}
					}
				}
				else
				{
					// strings data
					for (j = 0; j < data.length; ++j)
					{
						lang = rat.string.supportedLanguages[j];
						var langData = rat.string.stringData[lang];

						langData[data[0].textContent] = data[j].textContent;
					}
				}
			}
		}
		else
		{
			//rat.console.log("not using xml parser:");
			var workbook = in_Data ? in_Data.Workbook : void 0;
			var worksheet = workbook ? workbook.Worksheet : workbook;
			var table = worksheet ? (worksheet.Table || worksheet[0].Table) : worksheet;
			var rowsData = table ? table.Row : table;
			if (!rowsData)
			{
				rat.console.log("FAILED to process string JSON file.  Bad format");
				return;
			}

			var language;
			var k;
			var col;
			for (var l = 0; l < rowsData.length; ++l)
			{
				var rowData = rowsData[l].Cell;

				if (l === 0)
				{
					// language setup
					for (k = 0; k < rowData.length; ++k)
					{
						col = rowData[k].Data || rowData[k]["ss:Data"];
						language = col["#text"].toLowerCase();
						if (!rat.string.hasLanguage[language])
						{
							// console.log("language " + language);
							rat.string.supportedLanguages.push(language);
							rat.string.stringData[language] = {};
							rat.string.hasLanguage = true;
						}
					}
				}
				else
				{
					// strings data
					if (!rowData.length || rowData.length === 1 ||
						(!rowData[0].Data && !rowData[0]["ss:Data"]) ||
						(!rowData[1].Data && !rowData[1]["ss:Data"]))
						continue;

					var firstCol = (rowData[0].Data || rowData[0]["ss:Data"]);

					for (k = 0; k < rowData.length; ++k)
					{
						col = rowData[k].Data || rowData[k]["ss:Data"];
						language = rat.string.supportedLanguages[k];
						var languageData = rat.string.stringData[language];

						// console.log("language: " + language + "   obj: " + languageData);
						// console.log("stringy blah (" + k + " of ");
						// console.log("    " + rowData.length);
						// console.log("key " + rowData[0].Data["#text"]);

						// console.log("data " + rowData[k].Data);
						if (col)
						{
							// console.log("string " + rowData[k].Data["#text"]);

							languageData[firstCol["#text"]] = col["#text"];
						}
					}
				}
			}

			//rat.console.log("Parsed");

		}

		--stringFilesPending;
		if (stringFilesPending <= 0)
		{
			rat.string.currentStatus = STATES.complete;
			rat.string.fireDoneCallback();
		}
	};

	rat.string.getLanguageCode = function (language)
	{
		switch (language)
		{
			case "english":					return "EN";
			case "french":					return "FR";
			case "italian":					return "IT";
			case "german":					return "DE";
			case "spanish":					return "ES";
			case "portuguese":				return "PT";
			case "japanese":				return "JA";
			case "korean":					return "KO";
			case "simplified chinese":		return "CS";
			case "traditional chinese":		return "CT";
			default: return "??";
		}
	};

	rat.string.convertLocaleToLanguage = function (locale)
	{
		//var language = "default";

		switch (locale.substring(0, 2))
		{
			case "en":
				return "english";
			case "fr":
				return "french";
			case "it":
				return "italian";
			case "de":
				return "german";
			case "es":
				return "spanish";
			case "pt":
				return "portuguese";
			case "ja":
				return "japanese";
			case "ko":
				return "korean";
			case "zh":
				if (locale === "zh-CN" || locale === "zh-SG" || locale === "zh-Hans")		// china, singapore
					return "simplified chinese";
				else											// taiwan, hong kong, macau
					return "traditional chinese";
				break;
			default:
				return "english";
		}
		//	default case above will get hit.  commenting this out to remove compile warning.
		//return language;
	};

	rat.strings = rat.string;
} );