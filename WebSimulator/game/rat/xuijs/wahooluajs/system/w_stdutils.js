//
//	generated js from lua file
//	Then hand-edited
//
//
//	WStdUtils.lua
//	Collection of standard utility methods to be used by lua apps
//
rat.modules.add( "rat.xuijs.wahooluajs.system.w_stdutils",
[
	{name: "rat.utils.r_utils", processBefore: true },
	{name: "rat.math.r_math", processBefore: true },
	{name: "rat.xuijs.wahooluajs.wahoolua", processBefore: true },
], 
function(rat)
{
	var WStdUtils = {};
	
	// According to some documentation, these locals are faster to lookup than the functions
	var MathRand = rat.math.random
	var MathFoor = rat.math.floor
	
	// Get a random value within the given range
	//
	WStdUtils.RandomInRange = function( min, max ) {
		var delta = max - min
		return (MathRand() * delta) + min
	}
	
	// Get a random whole value in the given range
	//
	WStdUtils.RandomIntInRange = function( min, max ) {
		return Math.floor(WStdUtils.RandomInRange( min, max ));
	}
	
	// Get a random value then output a true/false
	//
	WStdUtils.CoinToss = function() {
		return MathRand() <= .5
	}
	
	//	Return the highest value
	//
	WStdUtils.Max = function( a, b ) {
		if( a > b ) {
			return a
		}
		return b
	}
	
	//	Return the lowest value
	//
	WStdUtils.Min = function( a, b ) {
		if( b > a ) {
			return a
		}
		return b
	}
	
	//	Return a value within bounds
	//
	WStdUtils.MinMax = function( v, min, max ) {
		v = WStdUtils.Max( v, min )
		v = WStdUtils.Min( v, max )
		return v
	}
	
	// Get a final value from base and variance
	//
	WStdUtils.GetWithVariance = function( base, variance ) {
		var halfVariance = variance * .5
		return base + WStdUtils.RandomInRange( halfVariance * -1, halfVariance )
	}
	
	//	Get the sign of the value
	//
	WStdUtils.SignOf = function(val) {
		if( val < 0 ) {
			return -1;
		} else if( val > 0 ) {
			return 1;
		} else {
			return 0;
		}
	}
	
	// More like c output function
	//
	WStdUtils.printf = function( s, varargs ) {
		//	PORT: just printing format string for now.  fix this.
		console.log("WLUA: " + s);
		//print(s.format(...))
	}
	
	// More like c output function
	//	This function is for ouputing errors so that
	//	in release builds, we can disable the printf to stop log ouputs, but still get error messages.
	WStdUtils.ErrPrintf = function( s, varargs ) {
		//	PORT: just printing format string for now.  fix this.
		console.log("WLUA: " + s);
		//print(s.format(...))
	}
	
	WStdUtils.buildValueString = function( v, depth ) {
		/*	PORT:  haha, I'm sure this all came out wrong.
		var desc;
		if( type(v) == "table" ) {
			for sk, sv in pairs(v) do
				if( !desc ) {
					desc = "";
				} else {
					desc = desc + ", ";
				}
			if( depth > 0 ) {
				desc = desc + string.format( "%s=%s", tostring(sk), buildValueString(sv, depth-1) );
			} else {
				desc = desc + string.format( "%s=%s", tostring(sk), tostring(sv) );
			}
		}
			if( !desc ) {
				desc = "{}";
			} else {
				desc = "{" + desc + "}";
			}
		} else {
			if( type(v) == "string" ) {
				desc = "\"" + tostring(v) + "\"";
			} else {
				desc = tostring(v);
			}
		}
		return desc;
		*/
		console.log("WLUA: WStdUtils.buildValueString not implemented!");
		return "";
	}
	
	//- Dump the members of this table to the log
	//
	WStdUtils.ptable = function(t, dumpSub) {
		//	PORT: fix this.
		console.log("WLUA: WStdUtils.ptable not implemented.");
		/*
		dumpSub = dumpSub || 0;
		if( t ) {
			var k, v
			for k,v in pairs(t) do
				if( !dumpSub ) {
					printf( "%s -> %s", tostring(k), tostring(v) )
				else {
					var desc = buildValueString( v, dumpSub );
					printf( "%s -> %s", k, desc );
				}
			}
		else {
			//print("Empty table")
		}
		*/
	}
	
	//- Get the Xui element type, if any, from this scene.
	//	Can be "XuiScene", "XuiSound", "XuiGroup", "XuiImage", etc...
	//
	WStdUtils.GetXuiElementType = function(elem) {
		if( (elem && elem._name) ) {
			return elem._name;
		}
		
		return "";
	}
	
	//-	Remap a value from one range to another.
	//
	WStdUtils.Remap = function(value, inMin, inMax, outMin, outMax) {
		return (((value - inMin) * (outMax-outMin)) / (inMax-inMin)) + outMin
	}
	
	//-	Remap a value from one range to another safely within the given ranges
	//
	WStdUtils.RemapInRange = function(value, inMin, inMax, outMin, outMax) {
		value = WStdUtils.MinMax( value, inMin, inMax )
		return (((value - inMin) * (outMax-outMin)) / (inMax-inMin)) + outMin
	}
	
	//- Sets help text data, confirms item exists before setting the text.
	//
	WStdUtils.HelpText = function(scene, button, text, visible) {
		var legend = scene["legend_"+button]
		if( legend != null && text != null ) {
			legend.SetText(text)
			if( type(visible) == "boolean" ) {
				legend.SetEnable(visible)
				legend.SetShow(visible)
			}
		}
	}
	
	WStdUtils.select = function(n, varargs) {
		//	PORT: fix this!
		console.log("WLUA: WStdUtils.select not implemented!");
		return arg[n]
	}

	WStdUtils.ClearArray = function(array)
	{
		array.length = 0;
	}
	
	/*	OK, not porting the rest for now...
	
	//	Coroutines won't port across, by the way!
	
	var MessageBoxCoroutine = false
	WStdUtils.MessageBox = function(message, buttonList, defaultButton, options, nilIndex) {
		message = message || "Are you sure?"
		defaultButton = defaultButton || 1
		options = options || {NoIcon : true}
		
		var buttons = {}
		for i=1,#buttonList do
			table.insert(buttons, buttonList[i].name)
		}
		if( #buttons <= 0 ) {
			buttons = {"Yes", "No"}
		}
		
		if( MessageBoxCoroutine == false ) {
			MessageBoxCoroutine = Xbox.Scheduler.Start(
				function() {
					var buttonIndex = Xbox.System.ShowMessageBox(Xbox.Dashboard.GetCurrentUserIndex(), "", message, buttons, defaultButton, options)
					//button index is 0 based, add one for addressing into button list
					//print("Button Index:", buttonIndex)
					if( buttonIndex == null ) { buttonIndex = nilIndex }
					if( buttonIndex ) {
						buttonIndex = buttonIndex + 1
						if( buttonList && buttonList[buttonIndex].Action ) {
							buttonList[buttonIndex].Action()
						}
					}
					MessageBoxCoroutine = false
					//[[
					//Bad hacky hacky, we delay 1/2 a second to prevent trying to pull up another
					// message box while this one is closing. This fixes a crash in the xbox lua system.
					Xbox.Scheduler.Start(function() {
						Sleep(50)
						MessageBoxCoroutine = false
					})//]]
				}
			)
		} else {
			//print("There is already a message box open....")
		}
	}
	*/
	
	//	convert a key code or other input to a direction code like "up" or "right"
	//	the last 3 args are flags for which category of inputs to recognize, and they default to true.
	WStdUtils.GetDirection = function(keyCode, dpad, leftStick, rightStick) {
		if( dpad == null ) { dpad = true }
		if( leftStick == null ) { leftStick = true }
		if( rightStick == null ) { rightStick = false }
		
		//	I'm too lazy to look up the string processing, so let's just do this....
		//	oddly enough, the lua code prioritizes right stick then left stick then dpad.
		if (rightStick)
		{
			if (keyCode === 'VK_PAD_RTHUMB_UP') return "up";
			if (keyCode === 'VK_PAD_RTHUMB_DOWN') return "down";
			if (keyCode === 'VK_PAD_RTHUMB_LEFT') return "left";
			if (keyCode === 'VK_PAD_RTHUMB_RIGHT') return "right";
		}
		if (leftStick)
		{
			if (keyCode === 'VK_PAD_LTHUMB_UP') return "up";
			if (keyCode === 'VK_PAD_LTHUMB_DOWN') return "down";
			if (keyCode === 'VK_PAD_LTHUMB_LEFT') return "left";
			if (keyCode === 'VK_PAD_LTHUMB_RIGHT') return "right";
		}
		if (dpad)
		{
			if (keyCode === 'VK_PAD_DPAD_UP') return "up";
			if (keyCode === 'VK_PAD_DPAD_DOWN') return "down";
			if (keyCode === 'VK_PAD_DPAD_LEFT') return "left";
			if (keyCode === 'VK_PAD_DPAD_RIGHT') return "right";
		}
		
		return false;
	}


	/*
	WStdUtils.RemoveFromTable = function(tbl, entry) {
		var removed = null;
		for i=#tbl,1,-1 do
			if( tbl[i] == entry ) {
				removed = table.remove(tbl, i)
				break
			}
		}
		
		return removed
	}
	WStdUtils.GetIndexInTable = function(tbl, entry) {
		for index, item in ipairs(tbl) do
			if( item == entry ) {
				return index
			}
		}
		return -1
	}
	*/
	
	// Remove the element by shifting around the least number of elements possible
	// for efficiency. Does not preserve how the remaining elements are sorted.
	WStdUtils.RemoveFromUnsortedTable = function(tbl, entry) {
		var index = tbl.indexOf(entry);
		if(index >= 0) {
			return WStdUtils.RemoveIndexFromUnsortedTable(tbl, index);
		}
		return null;
	};
	
	// Remove the element at the index by shifting around the least number of 
	// elements possible for efficiency. Does not preserve how the remaining
	// elements are sorted.
	WStdUtils.RemoveIndexFromUnsortedTable = function(tbl, index) {
		var removed = tbl[index];
		
		// Switch this removed entry with the one at the end.
		tbl[index] = tbl[tbl.length - 1];
		tbl.pop();
		
		return removed;
	};
	
	//- Create a new table and make it a deep copy of the provided table
	// could bemore robust, they share a metatable instead of copying the metatable
	WStdUtils.TableDeepCopy = function(t) {
		if( t === null || t === false ) { return null; }
		
		var u = {};
		for(var k in t) {
			var v = t[k];
			if( typeof(v) === "object" && v != t ) {
				u[k] = WStdUtils.TableDeepCopy(v);
			} else {
				u[k]=v;
			}
		}
		// LUA
		//return setmetatable(u, getmetatable(t))
		
		return u;
	}
	
	/*
	table.randomEntry = function(t) {
		var index = RandomIntInRange(1, #t)
		return t[index]
	}
	
	WStdUtils.TableShuffle = function(tbl, start, finish) {
		finish = finish || #tbl
		start = start || 1
		var done = start + 1
	 
		while finish >= done do
			var i = RandomIntInRange(start, finish)
			tbl[finish], tbl[i] = tbl[i], tbl[finish]
			finish = finish - 1
		}
	
		return tbl
	}
	
	WStdUtils.TableMerge = function(t1, t2) {
		for k,v in pairs(t2) do
			t1[#t1+1] = v;
		}
	}
	
	//	!!! PORT TODO:  I think the intention here is to delete all the values, not just set them to null,
	//	since that's what a nil assignment does in lua tables.
	//	Do this differently, using delete.
	WStdUtils.ClearTable = function(tbl) {
		for k,v in pairs(tbl) do
			tbl[k] = null
		}
	}
	
	WStdUtils.PadString = function(str, padChar, maxSize) {
		var padAmount = maxSize - #str
		var padding = string.rep(padChar, padAmount)
		return padding + str
	}
	
	WStdUtils.PadNumber = function(number, maxSize, padChar) {
		var str = tostring(number)
		padChar = padChar || '0'
		var padAmount = maxSize - #str
		var padding = string.rep(padChar, padAmount)
		return padding + str
	}
	
	// Used for changing file paths.
	// This is useful for making a project with multiple BDEs in a project with
	// different file paths.
	WStdUtils.ChangeAssetFilePath = function(filePath, newPath, oldPath) {
		oldPath = oldPath || ""
		if( newPath != oldPath ) {
			var oldPathPattern = oldPath
			var newPathPattern = newPath
			if( string.sub(filePath, 1, 1) == "#" ) {
				oldPathPattern = "#"+oldPath
				newPathPattern = "#"+newPath
			}
			return string.gsub(filePath, oldPathPattern, newPathPattern, 1)
		}
		return filePath
	}
	WStdUtils.ChangeListOfAssetFilePaths = function(filePathList, newPath, oldPath) {
		oldPath = oldPath || ""
		if( newPath != oldPath ) {
			for i, filePath in ipairs(filePathList) do
				filePathList[i] = ChangeAssetFilePath(filePath, newPath, oldPath)
			}
		}
	}
	*/
	
	//	more globally accessible
	wahoolua.WStdUtils = WStdUtils;
		
} );
