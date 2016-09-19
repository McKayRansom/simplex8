//
//	Functions for parsing xui data and creating hierarchy of rat-based xui elements.
//
rat.modules.add( "rat.xuijs.js.xui_parser",
[
	{name: "rat.xuijs.js.xui_api", processBefore: true },
	
	"rat.debug.r_console",
	"rat.utils.r_utils",
	"rat.math.r_math",
	"rat.graphics.r_graphics",
	"rat.xuijs.js.xui_element",
	"rat.utils.r_keyframeanimator",
], 
function(rat)
{
	var xuijs = rat.xuijs;
	
	xuijs.parser = {};
	
	// Public API
	
	// Create a xui item by parsing the given json data.
	// Returns a Xui object. In a typical xui file, the XuiScene is the main object that needs to be returned, and is the first child
	// In atypical use, we may not have a XuIScene and just return the root(canvas) instead.
	xuijs.parser.createXuiItem = function (xuiData, basePath, returnFirstChild)
	{
		// TODO: I don't  really like how this basePath stuff is handled.  Find a better way.
		// Temporarily set mBasePath while we're parsing.
		xuijs.parser.mBasePath = basePath;
		
		var canvas = xuijs.parser.parseXuiData(xuiData, null);
		
		// Now set basePath to null, to avoid polluting future calls.
		xuijs.parser.mBasePath = null;
		
		if( !canvas ){
			rat.console.log("No new XuiCanvas element created!");
			return null;
		}
		
		// Get the XuiScene from the canvas - should be the first child.
		if(returnFirstChild)
			return canvas.GetFirstChild();

		// otherwise, just return the canvas object
		return canvas;
	};
	
	// Create a xui scene by loading and parsing the given file.
	// NOTE THAT THIS IS ASYNCRONOUS.
	// I don't think this function is really needed anymore, since we mostly need synchronous loads.

	// DEPRECATED _ NOT IN USE
	xuijs.parser.createSceneFromFile = function(filePath, callback)
	{
		// Should we assume the given path has already been converted from "foo/bar.xur" to "foo/bar.json"?
		// Will we need to deal with relative paths, root directories, etc.?
		
		
		filePath = filePath.replace(/\\/g, "/");
		var basePath = filePath.slice(0, filePath.lastIndexOf("/"));

		rat.console.log("Loading Xui data: " + filePath);
		
		// For now assume we need to load the file.  Maybe set up preload or something.
		rat.utils.loadJSON(filePath, function(data){
			var scene = xuijs.parser.createXuiItem(data, basePath);
			callback(scene);
		});
	};
	
	// unified place to take a base and relative path, put them together and fix the slashes
	xuijs.parser.resolvePath = function (basePath, relativePath) {
		var fullPath = basePath + "/" + relativePath;
		fullPath = fullPath.replace(/\\/g, "/");
		return fullPath;
	}

	// Internal functions
	
	// Parse xui data (JsonML object).
	// Will return the object representing the main scene from the Xui data.
	xuijs.parser.parseXuiData = function(xuiData, parentElement)
	{
		if( !xuiData || !xuijs.parser.dataIsElement(xuiData) ){
			return;
		}

		var tag = xuijs.parser.getTagName(xuiData);
		
		var newElement = null;
		
		switch(tag){
		case "XuiCanvas":
			newElement = xuijs.parser.parseXuiCanvas(xuiData, tag, parentElement);
			break;
		case "XuiScene":
			newElement = xuijs.parser.parseXuiScene(xuiData, tag, parentElement);
			break;
		case "XuiGroup":
			newElement = xuijs.parser.parseXuiGroup(xuiData, tag, parentElement);
			break;
		case "XuiImage":
			newElement = xuijs.parser.parseXuiImage(xuiData, tag, parentElement);
			break;
		case "XuiText":
			newElement = xuijs.parser.parseXuiText(xuiData, tag, parentElement);
			break;
		case "XuiFigure":
			newElement = xuijs.parser.parseXuiFigure(xuiData, tag, parentElement);
			break;
		case "XuiSoundXAudio":
			// Pretend tag is "XuiSound" instead of "XuiSoundXAudio"
			tag = "XuiSound";
			newElement = xuijs.parser.parseXuiSound(xuiData, tag, parentElement);
			break;
		case "XuiCompVideo":
			//	Pretend tag is XuiVideo instead of XuiCompVideo
			tag = "XuiVideo";
			newElement = xuijs.parser.parseXuiVideo(xuiData, tag, parentElement, true);
			break;
		case "XuiVideo":
			newElement = xuijs.parser.parseXuiVideo(xuiData, tag, parentElement);
			break;
		case "Properties":
			// Properties will be handled by their parent
			break;
		case "Timelines":
			xuijs.parser.parseTimelines(xuiData, tag, parentElement);
			break;
		case "Timeline":
			xuijs.parser.parseTimeline(xuiData, tag, parentElement);
			break;
		case "NamedFrames":
			xuijs.parser.parseNamedFrames(xuiData, tag, parentElement);
			break;
		case "NamedFrame":
			xuijs.parser.parseNamedFrame(xuiData, tag, parentElement);
			break;
		case "XuiVariable":
			xuijs.parser.parseXuiVariable(xuiData, tag, parentElement);
			break;
		default:
			rat.console.log("Unsupported xui tag: " + tag);
		}
		
		return newElement;
	};
	
	// Returns whether or not the given xuiData is an element (i.e. it's an array)
	xuijs.parser.dataIsElement = function(xuiData)
	{
		return xuijs.apiUtils.isArray(xuiData);
	};
	
	// Get the tag name (i.e. XuiCanvas, XuiScene, etc.) from the xui data.
	xuijs.parser.getTagName = function(xuiData)
	{
		// The JsonML puts the tag as the first element of the array.
		var tag = "";
		if( xuiData[0] && typeof xuiData[0] == 'string' ){
			tag = xuiData[0];
		}
		else{
			rat.console.log("Tagless element!  How did that happen? - " + xuiData);
		}
		
		return tag;
	};
	
	// Parses a comma-separated list of numbers into an array of floats
	xuijs.parser.parseFloatValues = function(stringData)
	{
		var stringValues = stringData.split(',');
		var values = new Array(stringValues.length);
		for( var i = 0; i < stringValues.length; i++ ){
			values[i] = parseFloat(stringValues[i]);
		}
		
		return values;
	};
	
	// Parses a comma-separated list of quaternion values, 
	// and converts it into a rotation angle, assuming it's really a 2D rotation around the Z-axis. 
	xuijs.parser.getRotationValue = function(stringData)
	{
		var quatValues = xuijs.parser.parseFloatValues(stringData);
		if( quatValues.length < 4 ){
			rat.console.log("Invalid Rotation Values! (\"" + stringData + "\")");
			return 0;
		}
		if( quatValues[0] != 0 || quatValues[1] != 0 ){
			rat.console.log("Non Z-axis rotation is not supported! (\"" + stringData + "\")");
		}
		
		// This should be right, assuming axis of rotation is only Z.
		var z = quatValues[2];
		var w = quatValues[3];
		var angle = 2 * rat.math.atan2(z, w);
		
		// Make sure it's pi to -pi range
		// TODO: Not sure if I need this
		if( angle > rat.math.PI ){
			angle = angle - (2.0 * rat.math.PI);
		}
		else if( angle < -rat.math.PI ){
			angle = angle + (2.0 * rat.math.PI);
		}
			
		return angle;
	};
	
	// Parses the string data to get a boolean value.
	// Returns true if string == "true", false otherwise.
	xuijs.parser.parseBooleanValue = function(stringData)
	{
		var boolVal = stringData.toLowerCase() == "true" ? true : false;
		return boolVal;
	};
	
	// Parses the string data to get a color value.
	// Returns a rat color object.
	xuijs.parser.parseColorValue = function(stringData)
	{
		// Color values from Xui look like this: "0xaarrggbb"
		a = parseInt(stringData.substring(2, 4), 16);
		r = parseInt(stringData.substring(4, 6), 16);
		g = parseInt(stringData.substring(6, 8), 16);
		b = parseInt(stringData.substring(8, 10), 16);
		
		var color = new rat.graphics.Color(r, g, b, a/255);
		
		return color;
	};
	
	// Parses the string data to get a list of xuiFigure point-data entries.
	// Returns an array of the point-data entries.
	xuijs.parser.parseFigurePointsData = function(stringData)
	{
		// Figure point data is a comma separated list of values.
		// First value in the list is the number of points described.
		// Then there are 7 values for each point.
		// 3 pairs of xy coordinates for bezier curve values, and the last value indicates smooth/sharp, I think.
		
		var pointData = [];
		var entries = stringData.split(",");
		
		// We could have an array of arrays, with inner arrays containing the 7 values for each point,
		// But that's harder to deal with when drawing.
		//var numPoints = parseInt(entries[0]);
		//for( var i = 0; i < numPoints; i++ ){
		//	var pointValues = [7];
		//	for( j = 0; j < 7; j++ ){
		//		pointValues[j] = parseFloat(entries[(i * 7) + j + 1]);
		//	}
		//}
		
		
		// With the way we end up having to draw, it'll be easiest if the values are all just in a flat array.
		for( var i = 0; i < entries.length; i++ ){
			// There can be empty entries at the end of the list - skip them
			if(entries[i].length == 0){
				continue;
			}
			
			// Entries at mod 7 should be integers
			if( i % 7 == 0 ){
				pointData.push(parseInt(entries[i]));
			}
			else{
				pointData.push(parseFloat(entries[i]));
			}
		}
		
		return pointData;
	};
	
	
	// Returns whether the property is a numeric type.
	xuijs.parser.propertyIsNumeric = function(propName){
		if( 
			propName === 'Width' ||
			propName === 'Height' ||
			propName === 'Position' ||
			propName === 'Scale' ||
			propName === 'Rotation' ||
			propName === 'Opacity' ||
			propName === 'Pivot' ||
			propName === 'Fill.Translation' ||
			propName === 'Fill.FillColor' ||
			propName === 'ColorFactor' ||
			propName === 'TextColor' ||
			propName === 'Fill.FillType'
		){
			return true;
		}
		return false;
	};
	
	// Returns whether the property is a string type.
	xuijs.parser.propertyIsString = function(propName){
		if( 
			propName === 'ImagePath' ||
			propName === 'State' ||				//used for playing sounds
			propName === 'Text'
		){
			return true;
		}
		return false;
	};

	// Returns whether the property is a boolean type.
	xuijs.parser.propertyIsBoolean = function(propName){
		if( 
			propName == 'Show' ||
			propName == 'DisableTimelineRecursion'
		){
			return true;
		}
		return false;
	};
	
	// Returns a properly parsed value from propValueString, for the given property name/type.
	xuijs.parser.getKeyFramePropertyValue = function(propName, propValueString){
		switch (propName) {
		case "Width":
		case "Height":
		case "Opacity":
			return parseFloat(propValueString);
		case "Fill.FillType":
			return parseInt(propValueString);
		case "Position":
		case "Scale":
		case "Pivot":
		case "Fill.Translation":
			// TODO: Maybe limit result to two values?
			return xuijs.parser.parseFloatValues(propValueString);
		case "Fill.FillColor":
		case "TextColor":
		case "ColorFactor":
			var clr = xuijs.parser.parseColorValue(propValueString);
			return [clr.r, clr.g, clr.b, clr.a];
		case "Rotation":
		case "ShortestRotation":
			return xuijs.parser.getRotationValue(propValueString);
		case "Show":
		case "DisableTimelineRecursion":
			return xuijs.parser.parseBooleanValue(propValueString);
		case "ImagePath":
		case "State":								// xui audio - though theres no type checking anywhere! eeks! - also float was funky so using string instead
		case "Text":
			return propValueString;
		default:
			rat.console.logOnce("xuijs.parser.getKeyFramePropertyValue - Unsupported xui property '" + propName + "'!  Value=" + propValueString, propName);
			//rat.console.log("xuijs.parser.getKeyFramePropertyValue - Unsupported xui property '" + propName + "'!  Value=" + propValueString);
		}
		
		return null;
	};
	
	// Parses properties from the xui data and sets key-value pairs on the given outProperties object.
	xuijs.parser.parseProperties = function(xuiData, outProperties)
	{
		//rat.console.log("Parse Properties");
		
		if( !xuiData ){
			return;
		}
		
		// Find the properties element
		var properties;
		// Check if xuiData is the Properties element
		if( xuijs.parser.getTagName(xuiData) == 'Properties' ){
			properties = xuiData;
		}
		else{
			// Find a child element that is Properties element
			for( var i = 1; i < xuiData.length; i++ ){
				if( !xuijs.parser.dataIsElement(xuiData[i]) ){
					continue;
				}
				if( xuijs.parser.getTagName(xuiData[i]) == 'Properties' ){
					properties = xuiData[i];
				}
			}
		}
		
		if( !properties ){
			return;
		}
		
		// Loop over properties adding entries to outProperties.
		for( var i = 1; i < properties.length; i++ ){
			var propertyName = properties[i][0];
			var propertyValue = properties[i][1];
			if( !xuijs.parser.dataIsElement(propertyValue) && typeof propertyValue != "string" ){
				// Must've had an attribute, go to the next entry.
				// TODO: This doesn't seem very robust - maybe make a getFirstJsonMLElement, or something?
				propertyValue = properties[i][2];
			}
			
			// Check if we need to put properties of the same name into an array entry.
			var arrayName = propertyName + "_Array";
			
			// If something is already there with the propertyName, convert the existing item into an array entry.
			if( typeof outProperties[propertyName] !== 'undefined' && outProperties[propertyName] !== null ){
				outProperties[arrayName] = [outProperties[propertyName]];
				// Now let the code below add the new item into the array entry.
			}
			// Check if we get properties of the same name, and convert them to arrays.
			if( outProperties[arrayName] ){
				outProperties[arrayName].push(propertyValue);
			}
			
			outProperties[propertyName] = propertyValue;
		}
		
		//	IF the tag starts with xboxonly_, make sure DesignTime is checked for our purposes
		//	IF the tag starts with ratonly_, then make sure that DesignTime is cleared
		//	and the ID used outside is xboxonly_ (why?)
		if (outProperties.Id)
		{
			if (outProperties.Id.slice( 0, 9 ) === "xboxonly_")
				outProperties.DesignTime = true;
			if (outProperties.Id.slice( 0, 8 ) === "ratonly_")
			{
				outProperties.Id = "xboxonly_" + outProperties.Id.slice( 8 );
				outProperties.DesignTime = false;
			}
		}
		
		/*
		var xuiProperties = xuiData['Properties'];
		if( !xuiData['Properties'] || typeof xuiData['Properties'] != 'object' ){
			return;
		}
		
		for( var key in xuiProperties ){
			if( !xuiProperties.hasOwnProperty(key) ){
				continue;
			}
			
			// Copy properties into output parameter
			outProperties[key] = xuiProperties[key];
		}
		*/
	};
	
	// Applies the set of properties to the given element.
	// This handles generic properties common to many element types.
	xuijs.parser.applyPropertiesToElement = function(element, properties)
	{
		//rat.console.log("Apply Properties");
		
		// Id
		if( properties.Id ){
			// Maybe use rat element id field, maybe keep a separate xuiID?
			element.setID(properties.Id);
			
			//	Some hacking:  automatically hide stuff that's not really conceptually visible,
			//	like sound effects and collision data.
			//rat.console.log("set id " + properties.Id);
			var id = properties.Id;
			if (id.indexOf("sfx") == 0
				|| id.indexOf("music") == 0
				|| id.indexOf("song") == 0
				|| id.indexOf("stream") == 0
				|| id.indexOf("collision") == 0
				|| id.indexOf("Camera") == 0
			)
			{
				element.setVisible(false);
			}
		}
		
		// Width, Height
		// We have to make sure a default width/height is set, 
		// since if it's at a default value, there will be no width/height in the xui file.
		// Check for 0 values here so that specific element types can set their own defaults, and not have them overridden.
		var defaultWidth = 90;
		var defaultHeight = 30;
		if( element.getWidth() == 0 ){
			element.SetWidth(defaultWidth);
		}
		if( element.getHeight() == 0 ){
			element.SetHeight(defaultHeight);
		}
		
		// Set values from properties
		if( properties.Width ){
			element.SetWidth(parseFloat(properties.Width));
		}
		if( properties.Height ){
			element.SetHeight(parseFloat(properties.Height));
		}
		
		// Pivot
		if( properties.Pivot ){
			var values = xuijs.parser.parseFloatValues(properties.Pivot);
			element.SetPivot(values[0], values[1]);
		}
		
		// Position
		if( properties.Position ){
			var values = xuijs.parser.parseFloatValues(properties.Position);
			element.SetPosition(values[0], values[1]);
		}
		
		// Scale
		if( properties.Scale ){
			var values = xuijs.parser.parseFloatValues(properties.Scale);
			element.SetScale(values[0], values[1]);
		}
		
		// Rotation
		if( properties.Rotation ){
			var rotAngle = xuijs.parser.getRotationValue(properties.Rotation);
			element.setRotation(rotAngle);
		}
		
		// Show
		if( properties.Show ){
			element.SetShow(xuijs.parser.parseBooleanValue(properties.Show));
		}
		
		// Opacity
		if( properties.Opacity ){
			element.SetOpacity(parseFloat(properties.Opacity));
		}
		
		// Blend Mode
		// Blend Mode
		// 0 - Default 
		// 1 - Normal
		// 2 - Multiply
		// 3 - Darken - No support
		// 4 - Lighten - Maybe like screen?
		// 5 - Add
		// 6 - Subtract - No support
		// 7 - Alpha Mask - No support
		// 8 - Layer - What is it?
		// 9 - Override - What is it?
		if( typeof properties.BlendMode !== "undefined" && properties.BlendMode !== null ){
			element.setBlendMode(parseInt(properties.BlendMode));
		}
		
		// Color Factor
		if( properties.ColorFactor ){
			element.mColorFactor = xuijs.parser.parseColorValue(properties.ColorFactor);
		}
		// Clipping
		if( properties.ClipChildren ){
			element.setClip(xuijs.parser.parseBooleanValue(properties.ClipChildren));
		}
		
		// Disable Timeline Recursion
		if( properties.DisableTimelineRecursion ){
			element.disableTimelineRecursion(xuijs.parser.parseBooleanValue(properties.DisableTimelineRecursion));
		}
		
		
		// TEMP FOR DEBUGGING
		//element.setFrameRandom(1);
	};

	// Applies data common to all element types.
	xuijs.parser.applyCommonData = function(tag, properties, element, parentElement)
	{
		//rat.console.log("Apply Common Data");
		
		element.xuiType = tag;
		
		xuijs.parser.applyPropertiesToElement(element, properties);
		
		// Add child to parent with XuiElement function.
		if( parentElement ){
			parentElement.AddChild(element);
		}
		
		// Set the base path so that we can find things relative to it later.
		// TODO: Not all elements need this, but several do - should we limit it somehow?
		element.setBasePath(xuijs.parser.mBasePath);
		
	};
	
	xuijs.parser.parseChildren = function(xuiData, parentElement)
	{
		// JsonML has tag name as first entry, then maybe a key-value-pair object for attributes, then a list of children.
		for( var i = 1; i < xuiData.length; i++ ){
			if( !xuijs.parser.dataIsElement(xuiData[i]) ){
				continue;
			}
			xuijs.parser.parseXuiData(xuiData[i], parentElement);
		}
	};
	
	xuijs.parser.parseGenericXuiElement = function(xuiData, tag, parentElement)
	{
		//rat.console.log("Parse generic: " + tag);
		
		var properties = {};
		xuijs.parser.parseProperties(xuiData, properties);
		
		// Skip design-time elements
		if( properties.DesignTime ){
			return null;
		}
		
		var newElement = new xuijs.XuiElement();
		
		xuijs.parser.applyCommonData(tag, properties, newElement, parentElement);
		
		// Parse children
		xuijs.parser.parseChildren(xuiData, newElement);
		
		return newElement;
	};
	
	xuijs.parser.parseXuiCanvas = function(xuiData, tag, parentElement)
	{
		//rat.console.log("Parse XuiCanvas");
		var newElement = xuijs.parser.parseGenericXuiElement(xuiData, tag, parentElement);
		newElement.setID(tag);
		return newElement;
	};

	xuijs.parser.parseXuiScene = function(xuiData, tag, parentElement)
	{
		//rat.console.log("Parse XuiScene");
		return xuijs.parser.parseGenericXuiElement(xuiData, tag, parentElement);
	};
	
	xuijs.parser.parseXuiGroup = function(xuiData, tag, parentElement)
	{
		//rat.console.log("Parse XuiGroup");
		return xuijs.parser.parseGenericXuiElement(xuiData, tag, parentElement);
	};
	
	xuijs.parser.parseXuiImage = function(xuiData, tag, parentElement)
	{
		//rat.console.log("Parse XuiImage");
		
		var properties = {};
		xuijs.parser.parseProperties(xuiData, properties);
		
		// Skip design-time elements
		if( properties.DesignTime ){
			return null;
		}
		
		// Don't do anything if image path is empty.
		// TODO: Will this cause any problems with dynamically setting the image path?
		if( !properties.ImagePath ){
			return null;
		}
		
		var newXuiImage = new xuijs.XuiImage();
		
		// Apply common data
		xuijs.parser.applyCommonData(tag, properties, newXuiImage, parentElement);
		
		// Apply XuiImage specific data
		newXuiImage.SetImagePath(properties.ImagePath);
		
		if( typeof properties.SizeMode !== 'undefined' && properties.SizeMode !== null ){
			newXuiImage.setSizeMode(parseInt(properties.SizeMode));
		}
		
		// Xui always clips images to element bounds.
		//newXuiImage.setClip(true);
		
		// Create a rat sprite as a child?
		
		// Parse children
		xuijs.parser.parseChildren(xuiData, newXuiImage);
		
		return newXuiImage;
	};
	
	xuijs.parser.parseGradient = function(xuiData, fillOptions)
	{
		var gradientProperties = {};
		xuijs.parser.parseProperties(xuiData, gradientProperties);
		
		var numStops = 2;
		if( gradientProperties.NumStops ){
			numStops = parseInt(gradientProperties.NumStops);
		}
		fillOptions.NumStops = numStops;
		
		// TODO: Will there ever be a gradient with only one stop?  I don't think so.
		
		if( 
			gradientProperties.StopPos_Array && 
			gradientProperties.StopColor_Array && 
			xuijs.apiUtils.isArray(gradientProperties.StopPos_Array) &&
			xuijs.apiUtils.isArray(gradientProperties.StopColor_Array) &&
			gradientProperties.StopPos_Array.length == numStops &&
			gradientProperties.StopColor_Array.length == numStops
		){
			fillOptions.Stops = new Array(numStops);
			for( var i = 0; i < numStops; i++ ){
				var stopPos = parseFloat(gradientProperties.StopPos_Array[i]);
				var stopColor = xuijs.parser.parseColorValue(gradientProperties.StopColor_Array[i]);
				fillOptions.Stops[i] = {pos: stopPos, color: stopColor};
			}
		}
	};
	
	xuijs.parser.parseXuiFigure = function(xuiData, tag, parentElement)
	{
		//rat.console.log("Parse XuiFigure");
		
		var properties = {};
		xuijs.parser.parseProperties(xuiData, properties);
		
		// Skip design-time elements
		if( properties.DesignTime ){
			return null;
		}
		
		var newXuiFigure = new xuijs.XuiFigure();
		xuijs.parser.applyCommonData(tag, properties, newXuiFigure, parentElement);
		
		
		// Apply XuiFigure specific data
		
		// Stroke
		if( properties.Stroke ){
			var strokeWidth = 0;
			var strokeColor = new rat.graphics.Color(0, 0, 0, 0);
			
			// Get stroke properties
			var strokeProperties = {};
			xuijs.parser.parseProperties(properties.Stroke, strokeProperties);
			
			if( strokeProperties.StrokeWidth ){
				strokeWidth = parseFloat(strokeProperties.StrokeWidth);
			}
			
			if( strokeProperties.StrokeColor ){
				strokeColor = xuijs.parser.parseColorValue(strokeProperties.StrokeColor);
			}
			
			newXuiFigure.setStroke(strokeWidth, strokeColor);
		}
		
		
		// Fill
		if( properties.Fill ){
			// Get fill properties
			var fillProperties = {};
			xuijs.parser.parseProperties(properties.Fill, fillProperties);

			var fillOptions = {};
			
			var type = xuijs.XuiFigure.FillType.SOLID;
			if( fillProperties.FillType ){
				type = parseInt(fillProperties.FillType);
			}
			
			if( type == xuijs.XuiFigure.FillType.NONE ){
				// NONE
			}
			else if( type == xuijs.XuiFigure.FillType.SOLID ){
				// SOLID
				if( fillProperties.FillColor ){
					fillOptions.color = xuijs.parser.parseColorValue(fillProperties.FillColor);
				}
			}
			else if( type == xuijs.XuiFigure.FillType.LINEAR_GRADIENT ){
				// LINEAR GRADIENT
				if( fillProperties.Gradient ){
					xuijs.parser.parseGradient(fillProperties.Gradient, fillOptions);
				}
			}
			else if( type == xuijs.XuiFigure.FillType.RADIAL_GRADIENT ){
				// RADIAL GRADIENT
				if( fillProperties.Gradient ){
					xuijs.parser.parseGradient(fillProperties.Gradient, fillOptions);
				}
			}
			else if( type == xuijs.XuiFigure.FillType.TEXTURE ){
				// SOLID
				if( fillProperties.TextureFileName ){
					var texturePath = fillProperties.TextureFileName;
					fillOptions.TextureFileName = texturePath;
				}
			}
			else{
				rat.console.log("Unsupported XuiFigure Fill type: " + type );
			}
			
			// Transformation
			if( fillProperties.Translation ){
				var values = xuijs.parser.parseFloatValues(fillProperties.Translation);
				fillOptions.Translation = values;
			}
			if( fillProperties.Scale ){
				var values = xuijs.parser.parseFloatValues(fillProperties.Scale);
				fillOptions.Scale = values;
			}
			if( fillProperties.Rotation ){
				var value = parseFloat(fillProperties.Rotation);
				fillOptions.Rotation = value * rat.math.PI / 180;
			}
			
			newXuiFigure.setFillType(type, fillOptions);
		}
		
		
		// Closed
		if( properties.Closed ){
			newXuiFigure.setClosed(xuijs.parser.parseBooleanValue(properties.Closed));
		}
		
		// Points
		if( properties.Points ){
			var pointData = xuijs.parser.parseFigurePointsData(properties.Points);
			newXuiFigure.setPointData(pointData);
		}
		
		// Parse children
		xuijs.parser.parseChildren(xuiData, newXuiFigure);
		
		return newXuiFigure;
	};
	
	//	Parse Xui Text object
	//	TODO: support all these values animating in timelines... I don't think we do, currently.
	xuijs.parser.parseXuiText = function(xuiData, tag, parentElement)
	{
		//rat.console.log("Parse XuiText");
		
		var properties = {};
		xuijs.parser.parseProperties(xuiData, properties);
		
		// Skip design-time elements
		if( properties.DesignTime ){
			return null;
		}
		
		var newXuiText = new xuijs.XuiText();
		// Set default size for text elements.
		newXuiText.Width = 240;
		newXuiText.Height = 40;
		xuijs.parser.applyCommonData(tag, properties, newXuiText, parentElement);
		
		// Apply XuiText specific data
		
		// Fill textOptions then use them to initialize the element.
		var textOptions = {};
		
		// Text
		if( properties.Text ){
			// Replace some placeholder characters with their real values.
			var textString = properties.Text;
			textString = textString.replace(/&lt;/g, "<");
			textString = textString.replace(/&gt;/g, ">");
			//	Not needed?  Seems like \\n in the json file is already getting translated to \n earlier than this point.
			//textString = textString.replace(/\\n/g, "\n");
			
			textOptions.Text = textString;
		}
		
		// TextColor
		if( properties.TextColor ){
			textOptions.TextColor = xuijs.parser.parseColorValue(properties.TextColor);
		}
		
		// DropShadowColor
		if( properties.DropShadowColor ){
			textOptions.DropShadowColor = xuijs.parser.parseColorValue(properties.DropShadowColor);
		}
		
		// PointSize
		if( properties.PointSize ){
			textOptions.PointSize = parseFloat(properties.PointSize);
		}
		
		// TextStyle
		if( properties.TextStyle ){
			textOptions.TextStyle = parseInt(properties.TextStyle);
		}
		
		// TextScale
		if( properties.TextScale ){
			textOptions.TextScale = parseFloat(properties.TextScale);
		}
		
		newXuiText.init(textOptions);
		
		// Parse children
		xuijs.parser.parseChildren(xuiData, newXuiText);
		
		return newXuiText;
	};


	xuijs.parser.parseXuiSound = function(xuiData, tag, parentElement)
	{
		//rat.console.log("Parse XuiSound");
		
		var properties = {};
		xuijs.parser.parseProperties(xuiData, properties);
		
		// Skip design-time elements
		if( properties.DesignTime ){
			return null;
		}
		
		var newXuiSound = new xuijs.XuiSound();
		xuijs.parser.applyCommonData(tag, properties, newXuiSound, parentElement);
		
		if (properties.UniqueSoundId)
			newXuiSound.mUniqueSoundId = properties.UniqueSoundId;
		
		// Apply XuiSound specific data
		// get sound path
		if(properties.File)
			newXuiSound.SetFile(properties.File);
		else {
			rat.console.log("ERROR: sound " + properties.Id + " did not load correctly.  Is the file in a timeline?");
		}

		// Set if this sound is looping
		newXuiSound.SetLooping(properties.Loop);
			
		// find out if state is set to 'Play' (2 or empty), or 'Stop' -> 4
		// we dont set state always here, because 'stop' may stop an already playing sound unintentionally
		if (properties.State == "2" || typeof properties.State == "undefined" || !properties.State)
			newXuiSound.SetState("2");
			
		// Set the volume
		if(properties.Volume)
			newXuiSound.SetVolume(properties.Volume);
		
		// Parse children
		xuijs.parser.parseChildren(xuiData, newXuiSound);
		
		return newXuiSound;
	};
	
	xuijs.parser.parseXuiVideo = function(xuiData, tag, parentElement, isCompVideo)
	{
		//	rat.console.log("Parse XuiVideo");
		
		var properties = {};
		xuijs.parser.parseProperties(xuiData, properties);
		
		// Skip design-time elements
		if( properties.DesignTime ){
			return null;
		}
		
		var newXuiVideo = new xuijs.XuiVideo( isCompVideo );
		xuijs.parser.applyCommonData(tag, properties, newXuiVideo, parentElement);

		// find out if state is set to 'Play' (2 or empty), or 'Stop' -> 4
		newXuiVideo.mStartWhenReady = properties.State == "2";
		
		// Apply XuiSound specific data
		// get sound path
		if(properties.File)
			newXuiVideo.SetFile(properties.File);
			
		// Set the volume
		if(properties.Volume)
			newXuiVideo.SetVolume(properties.Volume);
		
		// Parse children
		xuijs.parser.parseChildren(xuiData, newXuiVideo);
		
		return newXuiVideo;
	};
	
	xuijs.parser.parseTimelines = function(xuiData, tag, parentElement)
	{
		// Parse children
		xuijs.parser.parseChildren(xuiData, parentElement);
	};
	
	xuijs.parser.parseTimeline = function(xuiData, tag, parentElement)
	{
		var elemId = null;
		var propNames = [];
		var xuiKeyFrames = [];
		for( var i = 1; i < xuiData.length; i++ ){
			if( !xuijs.parser.dataIsElement(xuiData[i]) ){
				continue;
			}
			
			var childName = xuiData[i][0];
			var childValue = xuiData[i][1];
			if( !xuijs.parser.dataIsElement(childValue) && typeof childValue != "string" ){
				// Must've had an attribute, go to the next entry.
				childValue = xuiData[i][2];
			}
			
			//	IF the tag starts with xboxonly_
			//	IF the tag starts with ratonly_, then make sure that we ignore it
			//	and take the ratonly_ and reassign it as we did in the element detection code
			if (childValue)
			{
				if (childValue.slice( 0, 9 ) === "xboxonly_") {
					//rat.console.log("skip tag " + childValue)
					break;	// skip this tag
				}
				if (childValue.slice( 0, 8 ) === "ratonly_")
				{
					//rat.console.log("changed tag " + childValue)
					childValue = "xboxonly_" + childValue.slice( 8 );
				}
			}
			
			if( childName == 'Id' ){
				elemId = childValue;
			}
			else if( childName == 'TimelineProp' ){
				propNames.push(childValue);
			}
			else if( childName == 'KeyFrame' ){
				var keyFrame = xuijs.parser.parseKeyFrame(xuiData[i], propNames);
				if( keyFrame ){
					xuiKeyFrames.push(keyFrame);
				}
			}
			
		}
		
		// Process the keyframe data to create rat keyFrameAnimators.
		// TODO: This is getting pretty fugly.  Maybe find a cleaner way, break it into functions, something.
		
		// Find element
		//	TODO:  This is wrong...  We're looking for a property of the parent element that matches the elemId,
		//	but if that ID HAPPENS to be the same as a standard property name, like "name", then this screws up.
		//	What we really need is to know if this is referring to a subelement.  I'm not sure how to do that,
		//	because it's kinda nice that we just throw subelements in as named properties...
		var element = parentElement[elemId];
		// Check if we need to do anything
		if( !element || propNames.length == 0 || xuiKeyFrames.length == 0 ){
			return;
		}
		
		// We want to split properties in the timeline into separate animators for each type (numeric, string, boolean).
		var NUMERIC = rat.KeyFrameAnimator.ValueType.NUMERIC;
		var STRING = rat.KeyFrameAnimator.ValueType.STRING;
		var BOOLEAN = rat.KeyFrameAnimator.ValueType.BOOLEAN;
		
		// A map to keep track of collected property names and keyframes for each property type.
		// Maps property type to keyframe data for that type.
		var keyFrameTypeMap = {};
		keyFrameTypeMap[NUMERIC] = {propNames: [], keyFrames: [], tempWorkingArray: []};
		keyFrameTypeMap[STRING] = {propNames: [], keyFrames: [], tempWorkingArray: []};
		keyFrameTypeMap[BOOLEAN] = {propNames: [], keyFrames: [], tempWorkingArray: []};
		
		var numericPropertyNames = [];
		var stringPropertyNames = [];
		var booleanPropertyNames = [];
		
		var numericKeys = [];
		var stringKeys = [];
		var booleanKeys = [];
		
		// Use a map to be able to look up property type for each key value later.
		// Maps property index to property type.
		var propTypeMap = {};
		
		// Loop over propNames to figure out what kind of animators/key-arrays we need.
		for( var i = 0; i < propNames.length; i++ ){
			var propName = propNames[i];
			var propType = null;
			
			if( xuijs.parser.propertyIsNumeric(propName) ){
				propType = NUMERIC;
			}
			else if( xuijs.parser.propertyIsString(propName) ){
				propType = STRING;
			}
			else if( xuijs.parser.propertyIsBoolean(propName) ){
				propType = BOOLEAN;
			}
			else{
				//rat.console.log("xuijs.parser.parseTimeline - Unsupported property type for property name: '" + propName +"'!");
				propTypeMap[i] = null;
			}
			
			propTypeMap[i] = propType;
			if( keyFrameTypeMap[propType] ){
				keyFrameTypeMap[propType].propNames.push(propName);
			}
		}

		// Loop over xuiKeyFrames and add all key frame data for the KeyFrameAnimators.
		for( var i = 0; i < xuiKeyFrames.length; i++ ){
			var keyFrame = xuiKeyFrames[i];
			
			// Temporary arrays that'll be used when creating keyFrameData items.
			keyFrameTypeMap[NUMERIC].tempWorkingArray = [];
			keyFrameTypeMap[STRING].tempWorkingArray = [];
			keyFrameTypeMap[BOOLEAN].tempWorkingArray = [];
			
			// Collect key values into proper arrays.
			for( var j = 0; j < keyFrame.propertyValues.length; j++ ){
				var propType = propTypeMap[j];
				
				// This is for referencing which array we need to use for the property type.
				var values = null;
				if( keyFrameTypeMap[propType] ){
					values = keyFrameTypeMap[propType].tempWorkingArray;
				}
				if( values ){
					values.push(keyFrame.propertyValues[j]);
				}
			}
			
			// TODO: Handle custom ease types for Xui animations.
			for( var type in keyFrameTypeMap ){
				if( keyFrameTypeMap.hasOwnProperty(type) ){
					if( keyFrameTypeMap[type].tempWorkingArray.length > 0 ){
						var keyFrameData = new rat.KeyFrameData(keyFrame.time, keyFrameTypeMap[type].tempWorkingArray);
						keyFrameTypeMap[type].keyFrames.push(keyFrameData);
					}
				}
			}
		}
		
		
		// Create the animators with the collected keys.
		
		var keyFrameAnimatorOptions = {
			looping: true,
			paused: false,
			applyFunc: xuijs.keyFrameAnimatorApplyFunc
		};
		
		for( var typeString in keyFrameTypeMap ){
			var type = parseInt(typeString);
			if( keyFrameTypeMap.hasOwnProperty(type) ){
				if( keyFrameTypeMap[type].keyFrames.length > 0 ){
					var test = -1;
					if( Array.isArray(keyFrameTypeMap[type].propNames) )
					{
						test = keyFrameTypeMap[type].propNames.indexOf( "Rotation" );
						if( test >= 0 )
							keyFrameTypeMap[type].propNames[test] = "ShortestRotation";
					}
					else if( keyFrameTypeMap[type].propNames === "Rotation" )
					{
						keyFrameTypeMap[type].propNames = "ShortestRotation";
					}
					var animator = new rat.KeyFrameAnimator(element, keyFrameTypeMap[type].propNames, keyFrameTypeMap[type].keyFrames, type, keyFrameAnimatorOptions);
					// I think with the way Xui handles things, it's best that the animators be stored/controlled on the parent.
					parentElement.addKeyFrameAnimator(animator);
				}
			}
		}
		
	};
	
	xuijs.parser.parseKeyFrame = function(xuiData, propertyNames)
	{
		var keyFrame = {};
		keyFrame.propertyValues = [];
		
		for( var i = 1; i < xuiData.length; i++ ){
			if( !xuijs.parser.dataIsElement(xuiData[i]) ){
				continue;
			}
			
			var childName = xuiData[i][0];
			var childValue = xuiData[i][1];
			if( !xuijs.parser.dataIsElement(childValue) && typeof childValue != "string" ){
				// Must've had an attribute, go to the next entry.
				childValue = xuiData[i][2];
			}
			
			if( childName == 'Time' ){
				keyFrame.time = xuijs.getTimeForFrame(parseInt(childValue));
			}
			else if( childName == 'Interpolation' ){
				// TODO: Support different interpolation types
			}
			else if( childName == 'Ease' ){
				// TODO: Support different ease types/parameters
			}
			else if( childName == 'Prop' ){
				// Figure out what type of data this will be.
				var index = keyFrame.propertyValues.length;
				var propName = propertyNames[index];
				
				// Get a value, and add it to keyFrame.propertyValues.
				var propValue = xuijs.parser.getKeyFramePropertyValue(propName, childValue);
				keyFrame.propertyValues.push(propValue);
			}
			
		}
		
		return keyFrame;
	};
	
	xuijs.parser.parseNamedFrames = function(xuiData, tag, parentElement)
	{
		// Parse children
		xuijs.parser.parseChildren(xuiData, parentElement);
	};

	xuijs.parser.parseNamedFrame = function(xuiData, tag, parentElement)
	{
		var name = null;
		var time = null;
		var command = xuijs.NamedFrame.CommandType.PLAY;
		var commandTarget = null;
		
		if( tag != "NamedFrame" ){
			rat.console.log("xuijs.parser.parseNamedFrame - Wrong tag encountered! Expected 'NamedFrame', got '" + tag + "'");
			return;
		}
		
		for( var i = 1; i < xuiData.length; i++ ){
			if( !xuijs.parser.dataIsElement(xuiData[i]) ){
				continue;
			}
			
			var childName = xuiData[i][0];
			var childValue = xuiData[i][1];
			if( !xuijs.parser.dataIsElement(childValue) && typeof childValue != "string" ){
				// Must've had an attribute, go to the next entry.
				childValue = xuiData[i][2];
			}
			if( typeof childValue != "string" ){
				rat.console.log("xuijs.parser.parseNamedFrame - child tag '" + childName + "' value is not string!");
				continue;
			}
			
			if( childName == 'Name' ){
				name = childValue;
			}
			else if( childName == 'Time' ){
				time = xuijs.getTimeForFrame(parseInt(childValue));
			}
			else if( childName == 'Command' ){
				command = childValue;
			}
			else if( childName == 'CommandParams' ){
				commandTarget = childValue;
			}
			
		}
		
		if( name === null || time === null ){
			// No proper data
			return;
		}
		// Create named frame data
		var namedFrame = new xuijs.NamedFrame(name, time, command, commandTarget);
		
		// Add named frame to parent element's list
		parentElement.addNamedFrame(namedFrame);
	};
	
	xuijs.parser.parseXuiVariable = function(xuiData, tag, parentElement)
	{
		var properties = {};
		xuijs.parser.parseProperties(xuiData, properties);
		if (!properties.DesignTime)
		{
			//	If the tag starts with #, it may have special meaning
			var id = properties.Id;
			if (id)
			{
				var vec = properties.VectorVariable || "0, 0, 0";
				vec = vec.split( "," );
				for( var index = 0; index !== vec.length; ++index )
					vec[index] = Number(vec[index].trim());
				
				var vals = {
					_vector:{x: vec[0], y: vec[1], z: vec[2]},
					_float: Number(properties.FloatVariable),
					_int: Number(properties.IntegerVariable) | 0
				};
				parentElement.customVars[id] = vals;
					
				if( id.slice(0, 2) === '__' )
				{
					switch(id)
					{
						case "__useOffscreenRendering":
							parentElement.setUseOffscreen( !!(vals._float || vals._int) );
							break;
						default:
							rat.console.log( "Unrecognized special handling custom var " + id );
					}
				}
				else
				{
					
				}
			}
		}
		return null;
	};
	
} );