//
//	A performance profiling calls.
//		Most of these are currently only implemented under Wraith
//

//------------ rat.profiler ----------------

//
// The profiler module
rat.modules.add( "rat.debug.r_profiler",
[
	"rat.debug.r_console",
	"rat.os.r_system",
	"rat.graphics.r_graphics",
	"rat.input.r_input",
], 
function(rat)
{
	rat.profiler = {
		enableProfiler: false,		//	Set to true to enable the profiler code
		usingRatProfiler: false,	//	Are we using the profiler built into rat
		
		//	The following are used when we are using the profiler built into rat
		profileTrees: [
			void 0, 
			void 0
		],
		curNode: void 0,
		enableStatsDisplay: false,
		selectedNode: ["ROOT"],
		displayInfo: {
			atX: 64,			//	Where to draw the profiler information
			atY: 64,
			lineHeight: 22,		//	How high is a single line of profiler information
			tab: "  ",			//	What is a tab
			font: "12px arial",	//	What font
			color: void 0,		//	What color
			highlightColor: void 0,// Color of highlighted node
			shadowColor: "black",// Shadow color
			curY: 0,			//	Runtime value used to draw
			cols: [0, 150, 225, 300, 375, 450], // NAME, % PARENT, % TOTAL, ttl MS, MS/call, # of calls
		},
		highlightedNode: void 0,

		//	For profiler marks in the FPS graph
		perfmarkers: [],
	};

	var perfmarkers = rat.profiler.perfmarkers;

	var topMark = {
		last: void 0,
		name: void 0
	};


	/** Empty perf function
	 * @param {?} name
	 */
	function noAction(name)
	{
	}

	//////////////////////////////////////////////////////////////////////////////////////////////////
	///	Code for rats embedded profiler

	//	A single profiler node
	function RatProfilerNode(name, parent)
	{
		this._stats = {
			name: name,
			parent: parent,
			time: 0,
			lastTick: void 0,
			calls: 0,
			hasChildren: false
		};
		this._children = {};
	}

	//	Get a child node (or create it if it does not exist)
	RatProfilerNode.prototype.getChild = function( name )
	{
		if (!this._children[name])
		{
			this._children[name] = new RatProfilerNode(name, this);
			this._stats.hasChildren = true;
		}
		return this._children[name];
	};

	//	Clear any held times
	RatProfilerNode.prototype.clear = function()
	{
		this._stats.time = 0;
		this._stats.calls = 0;
		for( var key in this._children )
			this._children[key].clear();
	};

	//	Get the current tick
	RatProfilerNode.prototype.getTick = function()
	{
		if (rat.profiler.usingRatProfiler)
			return window.performance.now();
		else
			return 0;
	};

	//	Store the current tick
	RatProfilerNode.prototype.storeTick = function()
	{
		this._stats.lastTick = this.getTick();
	};

	//	Get the amount of elapsed time
	RatProfilerNode.prototype.updateElapsed = function ()
	{
		this._stats.time += (this.getTick() - this._stats.lastTick) / 1000;
		this._stats.lastTick = void 0;
	};

	//	Starting a new frame
	function ratLevelBeginFrame()
	{
		
	}

	//	Ending a frame
	function ratLevelEndFrame()
	{
		if (rat.profiler.curNode.parent)
		{
			rat.console.log("ERROR!  profiler.push does not match profiler.pop");
			rat.profiler.curNode = rat.profiler.profileTrees[0];
			rat.profiler.curNode._stats.abortProfilerForFrame = true;
		}

		if( !rat.profiler.curNode._stats.abortProfilerForFrame )
		{
			// Should be the full frame time.
			if( rat.profiler.curNode._stats.lastTick !== void 0 )
				rat.profiler.curNode.updateElapsed();
		}

		//	Swap our tree buffers
		var oldTree = rat.profiler.profileTrees[0];
		rat.profiler.profileTrees[0] = rat.profiler.profileTrees[1];
		rat.profiler.profileTrees[1] = oldTree;

		//	Setup for a new pass
		rat.profiler.curNode = rat.profiler.profileTrees[0];
		rat.profiler.curNode.clear();
		rat.profiler.curNode.storeTick();
		++rat.profiler.curNode._stats.calls;
		rat.profiler.curNode._stats.abortProfilerForFrame = false;

		//	Setup the old tree to be ready to display
		oldTree._stats.built = true;
	}

	//	Push a new timing block
	function ratLevelPushPerfMark(name)
	{
		if( rat.profiler.curNode._stats.abortProfilerForFrame )
			return;
		rat.profiler.curNode = rat.profiler.curNode.getChild(name);
		rat.profiler.curNode.storeTick();
		++rat.profiler.curNode._stats.calls;
	}

	//	Pop the last timing block
	function ratLevelPopPerfMark(name)
	{
		if( rat.profiler.curNode._stats.abortProfilerForFrame )
			return;
		if (rat.profiler.curNode._stats.name !== name || rat.profiler.curNode._stats.parent === void 0)
		{
			
			rat.console.log("ERROR!  profiler.push does not match profiler.pop");
			rat.profiler.curNode = rat.profiler.profileTrees[0];
			rat.profiler.curNode._stats.abortProfilerForFrame = true;
			
		}
		else
		{
			rat.profiler.curNode.updateElapsed();
			rat.profiler.curNode = rat.profiler.curNode._stats.parent;
		}
	}

	//	Display some next on the current line.
	function displayProfilerLine(text, atCol, indent)
	{
		indent = indent || 0;
		atCol = atCol || 0;
		var ctx = rat.graphics.ctx;
		while (indent--)
			text = rat.profiler.displayInfo.tab + text;
		if (atCol >= rat.profiler.displayInfo.cols.length)
			atCol = rat.profiler.displayInfo.cols.length - 1;
		var x = rat.profiler.displayInfo.atX + rat.profiler.displayInfo.cols[atCol];
		ctx.fillText(text, x, rat.profiler.displayInfo.curY);
	}

	//	Go down one line
	function gotoNextDisplayLine()
	{
		rat.profiler.displayInfo.curY += rat.profiler.displayInfo.lineHeight;
	}

	//	Get the string version of a percent
	function getPercentDisplay(val, max)
	{
		return (val / max * 100).toFixed(2) + "%";
	}

	//	Get the string version of a time
	function getTimeDisplay(val)
	{
		return val.toFixed(4);
	}

	//	Get the node that is currently being displayed
	function getSelectedNode(node)
	{
		for (var index = 1; index < rat.profiler.selectedNode.length; ++index)
			node = node.getChild(rat.profiler.selectedNode[index]);
		return node;
	}

	//	Dump the profiling information
	function ratLevelDisplayPerfStats()
	{
		if (!rat.profiler.enableStatsDisplay)
			return;
		var ctx = rat.graphics.ctx;
		if (!ctx)
			return;
		ctx.save();

		ctx.font = rat.profiler.displayInfo.font;
		ctx.fillStyle = rat.profiler.displayInfo.color;
		// Draw text shadows is expensive...  Turning this on has serios effects on the FPS, which
		//	When using rat's profiler matters.
		//	So i turned these off.
		// ctx.shadowOffsetX = 1.5;
		// ctx.shadowOffsetY = 1.5;
		// ctx.shadowColor = rat.profiler.displayInfo.shadowColor;

		rat.profiler.displayInfo.curY = rat.profiler.displayInfo.atY;

		var root = rat.profiler.profileTrees[1];
		if (root._stats.abortProfilerForFrame)
			displayProfilerLine("***ERROR WITH PROFILER USAGE***", 0);
		else if (!root._stats.built)
			displayProfilerLine("***STATS PENDING***", 0);
		else
		{
			//	Dump this node
			var node = getSelectedNode(root);
			var parent = node._stats.parent;
			var foundTime = 0;

			//	Header row
			displayProfilerLine("NAME",		0, 2);
			displayProfilerLine("% Parent",	1, 2);
			displayProfilerLine("% Total",	2, 2);
			displayProfilerLine("MS Total",	3, 2);
			displayProfilerLine("MS/call", 4, 2);
			displayProfilerLine("calls", 5, 2);
			gotoNextDisplayLine();
						
			// NAME, % PARENT, % TOTAL, ttl MS, MS/call
			if (parent)
			{
				displayProfilerLine("-" + node._stats.name, 0);	//	Name
				displayProfilerLine(getPercentDisplay(node._stats.time, parent._stats.time), 1);	//	% Parent
			}
			else
				displayProfilerLine(" " + node._stats.name, 0);	//	Name
			displayProfilerLine(getPercentDisplay(node._stats.time,root._stats.time), 2);	//	% Total
			displayProfilerLine(getTimeDisplay(node._stats.time), 3); // TTL MS
			if (node._stats.calls)
			{
				displayProfilerLine(getTimeDisplay(node._stats.time / node._stats.calls), 4); // MS/call
				displayProfilerLine(node._stats.calls, 5); // # of calls
			}
			gotoNextDisplayLine();

			var child;
			for (var key in node._children)
			{
				//	Make sure we have a set highlighted node
				if (!rat.profiler.highlightedNode)
					rat.profiler.highlightedNode = key;
				
				child = node._children[key];
				if (key === rat.profiler.highlightedNode)
					ctx.fillStyle = rat.profiler.displayInfo.highlightColor;
				var preName = " ";
				if( child._stats.hasChildren )
					preName = "+";
				displayProfilerLine(preName + child._stats.name, 0, 1);	//	Name
				displayProfilerLine(getPercentDisplay(child._stats.time, node._stats.time), 1);	//	% Parent
				displayProfilerLine(getPercentDisplay(child._stats.time, root._stats.time), 2);	//	% Total
				displayProfilerLine(getTimeDisplay(child._stats.time), 3); // TTL MS
				if (node._stats.calls)
				{
					displayProfilerLine(getTimeDisplay(child._stats.time / child._stats.calls), 4); // MS/call
					displayProfilerLine(child._stats.calls, 5); // # of calls
				}
				gotoNextDisplayLine();
				if (key === rat.profiler.highlightedNode)
					ctx.fillStyle = rat.profiler.displayInfo.color;
				foundTime += child._stats.time;
			}

			gotoNextDisplayLine();
			displayProfilerLine(" MISSING TIME", 0, 1);	//	Name
			var missingTime = node._stats.time - foundTime;
			displayProfilerLine(getPercentDisplay(missingTime, node._stats.time), 1);	//	% Parent
			displayProfilerLine(getPercentDisplay(missingTime, root._stats.time), 2);	//	% Total
			displayProfilerLine(getTimeDisplay(missingTime), 3); // TTL MS

			//rat.console.log("DUMP STATS FOR NODE " + node._stats.name);
			//displayInfo
		}

		ctx.restore();
	}

	//	Event handling for the profiler
	function ratLevelEventHandler(ratEvent)
	{
		var selected, key;
		if (ratEvent.eventType === "keydown")
		{
			if (rat.profiler.enableStatsDisplay)
			{
				if (ratEvent.which === rat.keys.j)
				{
					if (rat.profiler.selectedNode.length > 1)
						rat.profiler.highlightedNode = rat.profiler.selectedNode.splice(rat.profiler.selectedNode.length - 1, 1)[0];

					return true;
				}
				else if (ratEvent.which === rat.keys.l)
				{
					selected = getSelectedNode( rat.profiler.profileTrees[1] );
					if (selected._children[rat.profiler.highlightedNode] && selected._children[rat.profiler.highlightedNode]._stats.hasChildren)
					{
						rat.profiler.selectedNode.push(rat.profiler.highlightedNode);
						rat.profiler.highlightedNode = void 0;
					}
					return true;
				}
				else if (ratEvent.which === rat.keys.i)
				{
					selected = getSelectedNode(rat.profiler.profileTrees[1]);
					//	Find which child this is
					var lastKey = "";
					for (key in selected._children)
					{
						if (key === rat.profiler.highlightedNode)
						{
							rat.profiler.highlightedNode = lastKey;
							break;
						}
						lastKey = key;
					}
					return true;
				}
				else if (ratEvent.which === rat.keys.k)
				{
					//	Find which child this is
					var useNextKey = false;
					selected = getSelectedNode(rat.profiler.profileTrees[1]);
					for (key in selected._children)
					{
						if (key === rat.profiler.highlightedNode)
							useNextKey = true;
						else if(useNextKey)
						{
							rat.profiler.highlightedNode = key;
							break;
						}
					}
					return true;
				}
			}
			if (ratEvent.which === rat.keys.p)
			{
				rat.profiler.enableStatsDisplay = !rat.profiler.enableStatsDisplay;
				return true;
			}
		}

		return false;
	}

	/// Add a "profiler mark" to the FPS graph
	rat.profiler.addPerfMarker = function (name, color)
	{
		if( rat.system.debugDrawFramerateGraph && rat.graphics )
		{
			if (rat.graphics)
				perfmarkers.unshift({ name: name, color: color.toString(), frame: rat.graphics.frameIndex });
		}
	};

	/**
	 * Setup the profiler module
	 */
	//@TODO Replace with module registered init function
	rat.profiler.init = function ()
	{
		var self = rat.profiler;
		if (!rat.profiler.enableProfiler)
		{
			self.pushPerfMark = noAction;
			self.popPerfMark = noAction;
		}
		else
		{
			if(rat.system.has.Wraith)
			{
				rat.console.log("Using Wraith Profiler");
				self.pushPerfMark = Wraith.PushPerfMark;
				self.popPerfMark = Wraith.PopPerfMark;
			}
			else if (window.performance && window.performance.now)
			{
				rat.console.log("Using RAT Profiler");
				self.pushPerfMark = ratLevelPushPerfMark;
				self.popPerfMark = ratLevelPopPerfMark;
				var oldBeginFrame = self.beginFrame;
				var oldEndFrame = self.endFrame;
				self.beginFrame = function () { oldBeginFrame(); ratLevelBeginFrame(); };
				self.endFrame = function () { oldEndFrame(); ratLevelEndFrame(); };
				self.displayStats = ratLevelDisplayPerfStats;

				//	Some data setup
				for( var index = 0; index < rat.profiler.profileTrees.length; ++index )
					rat.profiler.profileTrees[index] = new RatProfilerNode("ROOT", void 0);
				rat.profiler.curNode = rat.profiler.profileTrees[0];

				rat.profiler.displayInfo.color = rat.profiler.displayInfo.color || rat.graphics.white;
				rat.profiler.displayInfo.highlightColor = rat.profiler.displayInfo.highlightColor || rat.graphics.yellow;

				rat.input.registerEventHandler(ratLevelEventHandler);
				rat.profiler.usingRatProfiler = true;
			}
			else
			{
				rat.console.log("No Profiler");
				self.pushPerfMark = noAction;
				self.popPerfMark = noAction;
			}
		}
	};

	rat.profiler.beginFrame = function ()
	{
		if( rat.system.debugDrawFramerateGraph && rat.graphics && perfmarkers.length )
		{
			//	Remove frame markers that are now too old
			//	What is our current frame
			var lastValidFrame = rat.graphics.frameIndex - rat.system.FPS_RECORD_SIZE;
			var removeFrom = perfmarkers.length;
			for (var index = perfmarkers.length-1; index >= 0; --index)
			{
				if (perfmarkers[index].frame < lastValidFrame)
					removeFrom = index;
				else
					break;
			}
			if (removeFrom < perfmarkers.length)
				perfmarkers.splice(removeFrom);
		}
	};

	rat.profiler.endFrame = function ()
	{

	};

	rat.profiler.push = function (name)
	{
		var mark = { name: name, last: topMark };
		topMark = mark;
		rat.profiler.pushPerfMark(name);
	};

	rat.profiler.pop = function ()
	{
		var name = topMark.name;
		topMark = topMark.last;
		rat.profiler.popPerfMark(name);
	};

	rat.profiler.perf = function (name, func, ctx)
	{
		rat.profiler.pushPerfMark(name);
		var res;
		if (ctx)
			res = func.call(ctx);
		else
			res = func();
		rat.profiler.popPerfMark(name);
		return res;
	};

});
