//
//	console and debug utils
//
//	(move debug utils to r_debug maybe)
 
//	console namespace
rat.modules.add( "rat.debug.r_console",
[
	"rat.os.r_system", 
	"rat.math.r_math", 
	"rat.graphics.r_graphics", 
	"rat.utils.r_utils", 
	"rat.input.r_input",
], 
function(rat)
{
	rat.console.bounds = {x:0, y:0, w:{fromParent:true, val:0}, h:{percent:true, val:0.5}};
	rat.console.textColor = "#90B090";
	rat.console.textSize = 12;
	rat.console.logLineHeight = 14;	//	should be similar to text size
	rat.console.bgColor = "rgba(0,0,0,0.5)";
	rat.console.state = {
		consoleAllowed:	false,
		consoleActive: false,
		cursorPos: 0,
		pulseTimer: 0,
		currentCommand: "",

		//	Registered commands
		nextCommandID: 0,			//	The next ID to provide to a registered command
		commandList: [],			//	The list of available commands
		commandHistory: [],			//	History of entered commands
		commandHistoryIndex: -1,	//	What history item am i accessing (up/down)  -1 is im not
		commandHistoryMax: 100,		//	Remember up to 100 commands

		//	For auto-complete
		autoComplete: [],			//	List of currently built auto-completion options
		accessingAutoComplete: -1,	//	where are we in the auto-completion list

		logOffset: 0,				// How to shift the log display
		
		consoleKey: '/'				// What key to use to open the console
	};
	var state = rat.console.state;

	//	Load the command history from local storage if it is there
	var storage = window.localStorage;
	var storageCmdHistoryKey = "rat_commandHistory";
	if (storage && storage.getItem(storageCmdHistoryKey))
		rat.console.state.commandHistory = JSON.parse(storage.getItem(storageCmdHistoryKey));

	rat.console.setBounds = function(x, y, w, h)
	{
		rat.console.bounds.x = x;
		rat.console.bounds.y = y;	//	ignored, currently
		rat.console.bounds.w = w;	//	ignored, currently
		rat.console.bounds.h = h;	//	ignored, currently
	};
	
	rat.console.setTextSize = function(size, lineHeight)
	{
		rat.console.textSize = size;
		
		if (!lineHeight)
			lineHeight = Math.floor(size * 1.1);	//	autocalculate to be 20% bigger than text height
		
		rat.console.logLineHeight = lineHeight;
	};

	//	Utility for resetting auto-complete
	function resetAutoComplete()
	{
		state.autoComplete = [];
		state.accessingAutoComplete = -1;
	}

	//	Utility function to handle setting the current command
	function setCurCommand(cmd, resetHistory, resetAutocomplete)
	{
		state.currentCommand = cmd;
		state.cursorPos = rat.math.min( rat.math.max(0, state.cursorPos), state.currentCommand.length);
		if (resetHistory)
			state.commandHistoryIndex = -1;
		if (resetAutocomplete)
			resetAutoComplete();
	}

	function getGlobalVar(name)
	{
		return rat.utils.get(this, name);
	}

	//	Build the auto-complete list
	function buildAutocomplete(cmd)
	{
		//	Start with an empty list.
		state.autoComplete = [];

		//	The commands must START with cmd to fit.
		var upperCmd = cmd.toUpperCase();
		var commandCount = state.commandList.length;
		for (var commandIndex = 0; commandIndex !== commandCount; ++commandIndex)
		{
			//	Is this the matching command
			//	If the command matches, do NOT put its aliases in the list
			var curCmd = state.commandList[commandIndex];
			if (curCmd.name.slice(0, upperCmd.length) === upperCmd )
			{
				state.autoComplete.push(curCmd.name);
				continue;
			}

			//	Check its aliases
			var aliasCount = curCmd.alias.length;
			for (var aliasIndex = 0; aliasIndex !== aliasCount; ++aliasIndex)
			{
				if (curCmd.alias[aliasIndex].slice(0, upperCmd.length) === upperCmd )
					state.autoComplete.push(curCmd.alias[aliasIndex]);
			}
		}

		//	IF we found nothing, maybe we are entering javascript..   Variable name completion
		if (state.autoComplete.length <= 0)
		{
			//	Find the leading variable name...
			//	Do this by finding the last '.'
			var fullVarNameEndsAt = cmd.lastIndexOf('.');
			if (fullVarNameEndsAt > 1)//	We MUST find something (app or rat or some other global)
			{
				var fullVarName = cmd.substring(0, fullVarNameEndsAt);
				var mustStartWith = cmd.substring(fullVarNameEndsAt + 1);
				//if( mustStartWith )
				//	rat.console.log("Auto complete for variables in '" + fullVarName + "' starting with '" + mustStartWith + "'");
				//else
				//	rat.console.log("Auto complete for variables in '" + fullVarName + "'");

				//	get the variable
				var variable = getGlobalVar(fullVarName);
				if (variable !== void 0)
				{
					for (var key in variable)
					{
						if( key )
						{
							if( mustStartWith )
							{
								var startsWith = key.substring(0, mustStartWith.length);
								if (startsWith !== mustStartWith)
									continue;
							}

							state.autoComplete.push(fullVarName + "." + key);
						}
					}
				}
			}
				

		}

		//	Alphabetical order
		state.autoComplete.sort();
		state.accessingAutoComplete = 0;
	}

	//	Allow the console
	rat.console.allow = function (allow)
	{
		if (allow === void 0)
			allow = true;
		rat.console.state.consoleAllowed = !!allow;
	};
	
	//	Log this (type of) output once, recording that we've logged it,
	//	so we can suppress future messages of that type.
	rat.console.logOnce = function (text, name, count)
	{
		if (!name)	//	if name not specified, use full text message to identify it
			name = text;
		
		if (!count)	//	optional count (to allow this message more than once, but still limited)
			count = 1;
		
		if (!rat.console.onceRecord[name])
			rat.console.onceRecord[name] = 0;
		rat.console.onceRecord[name]++;
		if (rat.console.onceRecord[name] <= count)
		{
			rat.console.log(text);
		}
	};

	//	Draw the console
	rat.console.drawConsole = function ()
	{
		//	Bail if we are either not allowed or not active.
		if (!rat.console.state.consoleAllowed ||
			!rat.console.state.consoleActive)
			return;

		//	Draw at the bounds set.
		//	This includes drawing the log and any input that we have
		//	Find out what the bounds mean
		var bounds = rat.console.bounds;
		if (rat.ui && rat.ui.data && rat.ui.data.calcBounds)
		{
			var ratBounds = {
				x: 0,
				y: 0,
				w: rat.graphics.SCREEN_WIDTH,
				h: rat.graphics.SCREEN_HEIGHT
			};
			bounds = rat.ui.data.calcBounds({ bounds: bounds }, ratBounds);
		}

		//	Draw the BG
		rat.graphics.drawRect(
			bounds,
			{ fill: true, color: rat.console.bgColor });
		rat.graphics.drawRect(
			bounds,
			{ color: rat.console.bgColor, lineWidth:2 });

		//	Draw the log
		var logBounds = rat.utils.copyObject( bounds );
		logBounds.h -= 24;
		rat.console.drawLog(logBounds);

		//	Draw the line between the log and the input
		logBounds.y = logBounds.h;
		logBounds.h = bounds.h - logBounds.h;
		rat.graphics.drawRect(logBounds, { color: rat.console.bgColor, lineWidth: 2 });

		//	Draw the running time
		logBounds.x += 4;
		logBounds.y += 4;

		var time = rat.runningTime || 0;
		var hours = (time/60/60)|0;
		time -= hours * 60 * 60;
		var minutes = (time/60)|0;
		time -= minutes * 60;
		var seconds = time|0;
		var timeText = "" + hours + ":" + minutes + ":" + seconds;
		var width = rat.graphics.ctx.measureText(timeText);
		if (width.width !== void 0)
			width = width.width;
		rat.graphics.drawText(timeText, logBounds.x + logBounds.w - width - 8, logBounds.y);

		//	Draw the current console text
		
		rat.graphics.drawText("> " + state.currentCommand, logBounds.x, logBounds.y);

		//	Draw the cursor
		state.pulseTimer += rat.deltaTime;
		if (state.pulseTimer > 0.6)
			state.pulseTimer = 0;
		if (state.pulseTimer < 0.3)
		{
			var subCmd = state.currentCommand.slice(0, state.cursorPos);
			width = rat.graphics.ctx.measureText("> " + subCmd);
			width = width.width || width;
			logBounds.x += width;
			rat.graphics.ctx.fillStyle = "white";
			rat.graphics.ctx.font = " bold" + rat.graphics.ctx.font;
			rat.graphics.drawText("|", logBounds.x, logBounds.y );
		}
	};

	//	display log lines of text
	/** @param {Object=} bounds */
	rat.console.drawLog = function (bounds)
	{
		bounds = bounds || rat.console.bounds;
		var out = rat.console.output;
		var ctx = rat.graphics.ctx;
		
		var logLineHeight = rat.console.logLineHeight;
		
		//	make a copy of my bounds so I can mess with it, if it's not set up.
		var myBounds = {x:bounds.x, y:bounds.y, w:bounds.w, h:bounds.h};
		if (myBounds.w < 0)
			myBounds.w = rat.graphics.SCREEN_WIDTH - myBounds.x - 10;
		if (myBounds.h < 0)
			myBounds.h = rat.graphics.SCREEN_HEIGHT - myBounds.y - 10;

		ctx.font = '' + rat.console.textSize + 'px Arial';
		ctx.textAlign = 'left';
		ctx.fillStyle = rat.console.textColor;//"#B0FFA0";

		//	start high enough so that our last line is at the bottom.
		
		var yPos = myBounds.h - 0 - logLineHeight * out.length;
		var bottom = myBounds.h + myBounds.y;
		yPos += (rat.console.state.logOffset-1) * logLineHeight;
		ctx.textBaseline = "top";//"bottom";
		for (var i = 0; i < out.length; i++)
		{
			if( (yPos + logLineHeight) > myBounds.y )
				ctx.fillText(out[i], myBounds.x, yPos, myBounds.w);
			yPos += logLineHeight;
			if( (yPos + logLineHeight) >= bottom && rat.console.state.logOffset > 0 )
			{
				ctx.fillText("...", myBounds.x, yPos, myBounds.w);
				yPos += logLineHeight;
			}
			if( yPos >= bottom )
				break;
		}
		
		//ctx.strokeStyle = "#FFFFFF";
		//ctx.strokeRect(myBounds.x, myBounds.y, myBounds.w, myBounds.h);
	};

	//	Get events
	rat.console.handleEvent = function (ratEvent)
	{
		if (ratEvent.eventType !== "keydown" && ratEvent.eventType !== "keypress")
			return;

		//	Don't eat F12
		if (ratEvent.eventType === "keydown")
		{
			if (ratEvent.which === rat.keys.f12)
				return false;

			//	console key (if it's unmodified!) will toggle console activity.
			//	Escape key will only make console inactive.
			if ((ratEvent.which === rat.keys[state.consoleKey] && !(ratEvent.sysEvent.altKey || ratEvent.sysEvent.ctrlKey || ratEvent.sysEvent.shiftKey)) ||
				(ratEvent.which === rat.keys.esc && rat.console.state.consoleActive) )
			{
				rat.console.state.consoleActive = !rat.console.state.consoleActive;
				return true;
			}

			//	Not active means not handled.
			if (!rat.console.state.consoleActive)
				return false;
			else
				ratEvent.allowBrowserDefault = true;

			//	Run the cmd.
			if (ratEvent.which === rat.keys.enter)
			{
				ratEvent.sysEvent.preventDefault();
				state.currentCommand = state.currentCommand.trim();
				if (state.currentCommand && state.commandHistory[state.commandHistory.length] !== state.currentCommand)
				{
					state.commandHistory.unshift(state.currentCommand);
					if (state.commandHistory.length > state.commandHistoryMax)
						state.commandHistory.pop();
					if (window.localStorage)
						window.localStorage.setItem(storageCmdHistoryKey, JSON.stringify(state.commandHistory));
				}
				if( state.currentCommand )
					rat.console.parseCommand(state.currentCommand.trim());
				setCurCommand("", true, true);
			}

			//	Erase
			else if (ratEvent.which === rat.keys.backspace)
			{
				ratEvent.sysEvent.preventDefault();
				if (state.cursorPos > 0)
				{
					--state.cursorPos;
					setCurCommand(state.currentCommand.slice(0, state.cursorPos) + state.currentCommand.slice(state.cursorPos + 1), false, true);
				}
			}
			else if (ratEvent.which === rat.keys.del)
			{
				ratEvent.sysEvent.preventDefault();
				if (state.cursorPos < state.currentCommand.length)
				{
					setCurCommand(state.currentCommand.slice(0, state.cursorPos) + state.currentCommand.slice(state.cursorPos + 1), false, true);
				}
			}
			
			//	font size change (shift + arrow keys)
			else if (ratEvent.sysEvent.shiftKey && (ratEvent.which === rat.keys.upArrow || ratEvent.which === rat.keys.downArrow))
			{
				var size = rat.console.textSize;
				if (ratEvent.which === rat.keys.upArrow)
					size += 2;
				else if (ratEvent.which === rat.keys.downArrow)
				{
					size -= 2;
					if (size < 4)	//	let's be reasonable
						size = 4;
				}
				rat.console.setTextSize(size);
			}

			//	History access
			else if (ratEvent.which === rat.keys.upArrow || ratEvent.which === rat.keys.downArrow)
			{
				ratEvent.sysEvent.preventDefault();
				setCurCommand(state.currentCommand.trim(), false, false);
				if (ratEvent.which === rat.keys.upArrow)
					++state.commandHistoryIndex;
				else
					--state.commandHistoryIndex;

				//	 If we are less then our current, stay at our current
				if (state.commandHistoryIndex < -1)
					state.commandHistoryIndex = -1;

					//	Did we try to go up with no history
				else if (state.commandHistoryIndex === 0 && state.commandHistory.length === 0)
					setCurCommand("", true, true);

					//	Did we go off the top.
				else if (state.commandHistoryIndex >= state.commandHistory.length)
				{
					state.commandHistoryIndex = state.commandHistory.length - 1;
					setCurCommand(state.commandHistory[state.commandHistoryIndex], false, false);
				}

					//	leaving the history
				else if (state.commandHistoryIndex === -1)
				{
					setCurCommand("", false, false);
				}

					//	We are accessing the history
				else
				{
					setCurCommand(state.commandHistory[state.commandHistoryIndex], false, true);
					state.cursorPos = state.currentCommand.length;
				}
			}
			
			//	Cursor position change
			else if (ratEvent.which === rat.keys.leftArrow || ratEvent.which === rat.keys.rightArrow)
			{
				ratEvent.sysEvent.preventDefault();
				if (ratEvent.which === rat.keys.leftArrow)
					--state.cursorPos;
				else
					++state.cursorPos;
				state.cursorPos = rat.math.max(0, state.cursorPos);
				state.cursorPos = rat.math.min(state.cursorPos, state.currentCommand.length);
			}
			else if (ratEvent.which === rat.keys.home)
			{
				ratEvent.sysEvent.preventDefault();
				state.cursorPos = 0;
			}
			else if (ratEvent.which === rat.keys.end)
			{
				ratEvent.sysEvent.preventDefault();
				state.cursorPos = state.currentCommand.length;
			}

			//	TAB for auto-completion
			else if (ratEvent.which === rat.keys.tab)
			{
				ratEvent.sysEvent.preventDefault();

				//	Find the commands that will complete the current.
				if (state.accessingAutoComplete === -1)
				{
					setCurCommand(state.currentCommand.trim(), false, false);
					buildAutocomplete(state.currentCommand);
				}

				//	Auto-complete only does something if there is something to change to.
				if (state.autoComplete.length > 0)
				{
					setCurCommand(state.autoComplete[state.accessingAutoComplete], true, false);
					state.cursorPos = state.currentCommand.length;
					if (rat.input.keyboard.isKeyDown(rat.keys.shift)) {
						state.accessingAutoComplete--;
						if (state.accessingAutoComplete < 0)
							state.accessingAutoComplete = state.autoComplete.length - 1;
					}
					else {
						state.accessingAutoComplete++;
						if (state.accessingAutoComplete >= state.autoComplete.length)
							state.accessingAutoComplete = 0;
					}
				}
			}
			
			//	PageUp/PageDown to change log offset
			else if (ratEvent.which === rat.keys.pageUp || ratEvent.which === rat.keys.pageDown )
			{
				ratEvent.sysEvent.preventDefault();
				
				if( ratEvent.which === rat.keys.pageUp )
					++rat.console.state.logOffset;
				else
					--rat.console.state.logOffset;
				if( rat.console.state.logOffset >= rat.console.output.length )
					rat.console.state.logOffset = rat.console.output.length-1;
				if( rat.console.state.logOffset < 0 )
					rat.console.state.logOffset = 0;
			}
		}
		else if (ratEvent.eventType === "keypress" )
		{
			//	Not active means not handled.
			if (!rat.console.state.consoleActive)
				return false;
			var char = ratEvent.sysEvent.char;
			if (char.charCodeAt(0) < ' '.charCodeAt(0))
				return false;
			if (state.consoleActive && char !== "\n" && char !== "\t" && char !== state.consoleKey)
			{
				if (state.cursorPos === state.currentCommand.length)
					state.currentCommand += char;
				else if (state.cursorPos === 0)
					state.currentCommand = char + state.currentCommand;
				else
					state.currentCommand = state.currentCommand.slice(0, state.cursorPos) + char + state.currentCommand.slice(state.cursorPos);
				state.cursorPos++;
				resetAutoComplete();
			}
		}
		return true; // Handled
	};

	//	Register new commands into the console
	rat.console.registerCommand = function (name, func, aliasList)
	{
		//	Init the new cmd
		var newCmd = {};
		newCmd.name = name.toUpperCase();
		newCmd.func = func;
		newCmd.id = state.nextCommandID++;
		newCmd.alias = aliasList || [];

		//	All commands and alias are uppercase
		var aliasCount = newCmd.alias.length;
		for (var aliasIndex = 0; aliasIndex < aliasCount; aliasIndex++)
			newCmd.alias[aliasIndex] = newCmd.alias[aliasIndex].toUpperCase();

		//	Add it to the cmd list
		state.commandList.push(newCmd);
		return newCmd.id;
	};

	//	Unregister a commands from the console
	rat.console.unregisterCommand = function (id)
	{
		//	Find the command that goes with this
		var commandCount = state.commandList.length;
		for (var commandIndex = 0; commandIndex < commandCount; commandIndex++)
		{
			if (state.commandList[commandIndex].id === id)
			{
				state.commandList.splice(commandIndex, 1);
				return true;
			}
		}

		return false;
	};

	//	Get a command by its name
	rat.console.getCommand = function (cmd)
	{
		var upperCmd = cmd.toUpperCase();
		var count = state.commandList.length;
		for (var index = 0; index !== count; ++index)
		{
			var curCmd = state.commandList[index];
			if (curCmd.name === upperCmd)
				return curCmd;

			for (var aliasIndex = 0; aliasIndex !== curCmd.alias.length; ++aliasIndex)
			{
				if (curCmd.alias[aliasIndex] === upperCmd)
					return curCmd;
			}
		}

		//	Not found
		return void 0;
	};

	/**
	  *	@method	Run the provided command
	  * @returns True if the command successfully parsed
	  */
	rat.console.parseCommand = function (cmd)
	{
		//	Get the command from the args
		var fullCmd = cmd;
		var cmdArgs = cmd.split(/\s/);
		cmd = cmdArgs[0];
		cmdArgs.splice(0, 1);
		var foundCmd = rat.console.getCommand(cmd);
		if (foundCmd)
		{
			//	Call the command
			foundCmd.func(cmd, cmdArgs);
			return true;
		}
		else
		{
			//	Is the string a full variable?  If so, dump its members or value to the log
			var gblVar = getGlobalVar(fullCmd);
			var dumpVar = fullCmd + "=";
			if (gblVar !== void 0)
			{
				switch( typeof(gblVar) )
				{
					case "object":
					{
						if (gblVar === null)
							dumpVar += "NULL";
						else
						{
							dumpVar += "OBJECT:";
							rat.console.log(dumpVar);
							dumpVar = void 0;
							var longestName = 0;
							var vals = [];
							var key;
							for (key in gblVar)
							{
								//	We skip some things
								if (key !== "parentClass" && key !== "parentConstructor" && key !== "parent" && key !== "parentPrototype" && key !== "constructor")
								{
									vals.push(key);
									if (key.length > longestName)
										longestName = key.length;
								}
							}

							//	Sort
							vals.sort();
							for (var i = 0; i < vals.length; ++i)
							{
								key = vals[i];
								var type = typeof (gblVar[key]);
								while (key.length < longestName)
									key += " ";
								rat.console.log(key + "=" + type);
							}
						}
						break;
					}
					case "boolean":
						dumpVar += gblVar.toString();
						break;
					case "number":
						dumpVar += gblVar.toString();
						break;
					case "string":
						dumpVar += gblVar.toString();
						break;
					case "function":
						dumpVar += "function";
						break;
				}
				if( dumpVar )
					rat.console.log(dumpVar);
			}
			else
			{
				//	We assume this to be raw javascript
				try
				{
					rat.console.log(fullCmd);
					/* jshint -W061 */
					eval(fullCmd);
				}
				catch (e)
				{
					rat.console.log("ERROR: Execution of JS Failed: " + e.description);
				}
			}
		}

		return true;
	};

	//	Add the LOG command
	rat.console.registerCommand("log", function (cmd, args)
	{
		rat.console.log( args.join(" ") );
	});

	//	Toggle the saveLog feature
	rat.console.registerCommand("saveLog", function (cmd, args)
	{
		rat.console.saveOutputToLocalStorage = !rat.console.saveOutputToLocalStorage;
		rat.console.log( "Log will "+ (rat.console.saveOutputToLocalStorage?"":" not ") + " save." );
	});
	
	//	Toggle the saveLog feature
	rat.console.registerCommand("restoreLog", function (cmd, args)
	{
		if( !window.localStorage )
			rat.console.log( "ERROR! localStorage not supported" );
		else
		{
			var out = JSON.parse( window.localStorage.getItem( "RAT_LOG" ) );
			if( out && Array.isArray(out) )
			{
				rat.console.output = out;
				rat.console.log( "Log restored" );
			}
			else
				rat.console.log( "Failed to restore log" );
		}
	});
	
	//	Add the clear command
	rat.console.registerCommand("clear", function (cmd, args)
	{
		rat.console.output = [];
	}, ["cls", "clearLog"]);

	//	Add the Alias command
	rat.console.registerCommand("Alias", function (cmd, args)
	{
		var aliasCmd = args[0];
		if (aliasCmd)
		{
			args.splice(0, 1);
			rat.console.registerCommand(aliasCmd, function (cmd, args)
			{
				var foundCmd = rat.console.getCommand(cmd);
				rat.console.parseCommand(foundCmd.aliasedTo + " " + args.join(" "));
			});
			var foundCmd = rat.console.getCommand(aliasCmd);
			foundCmd.aliasedTo = args.join(" ");
			rat.console.log("Added alias " + aliasCmd + "=" + foundCmd.aliasedTo);
		}
	});

	//	put frames around ui elements
	rat.console.registerCommand("frames", function (cmd, args)
	{
		rat.dframe();
	}, ["showFrames", "dframe"]);
	
	//	dump ui tree to log
	rat.console.registerCommand("dtree", function (cmd, args)
	{
		rat.dtree();
	}, ["dumpTree"]);

	//	show fps graph
	rat.console.registerCommand("showFPSGraph", function (cmd, args)
	{
		var on = rat.system.debugDrawFramerateGraph;
		rat.system.debugDrawFramerateGraph = !on;
		rat.system.debugDrawTiming = !on;
	}, ["showFPS", "fps"]);

	//------
	//	These debug commands are intended to be accepted in the javascript console,
	//	e.g. the developer can type "rat.dframe()" to use one.  So they're intentionally short, but consistent.
	//	These are also now available in rat's console.
	
	//	put debug frame around everything
	rat.dframe = function ()
	{
		if( rat.screenManager )
		{
			var s = rat.screenManager.getTopScreen();
			if (s)
				s.frameAllRandom();
		}
	};
	
	rat.dtree = function ()
	{
		if( rat.screenManager )
		{
			var s = rat.screenManager.getTopScreen();
			if (s)
			{
				var data = s.dumpTree();
				//	actually output that text...
				for (var i = 0; i < data.lines.length; i++)
				{
					rat.console.log(data.lines[i]);
				}
				rat.console.log("total:" + data.totalCount + " (vis: " + (data.totalCount - data.hiddenCount) + ", hid: " + data.hiddenCount + ")");
			} else {
				rat.console.log("no top screen in stack to dump.");
			}
		}
	};
});