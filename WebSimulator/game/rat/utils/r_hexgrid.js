/**

Hex Grid support
	
CONCEPTS

	AXIAL COORDINATES
		We use Axial coordinates (q,r):
			
			q increments to the right, and r increments along the down/right diagonal axis.
			
		See http://www.redblobgames.com/grids/hexagons/#coordinates
		or http://3dmdesign.com/development/hexmap-coordinates-the-easy-way
		
		This is not the same as offset coordinates.  Important to understand.
	
	STORAGE and BOUNDS
		We have internally a definition of what grid space is defined, determined when you set the grid up.
		Initially, only a rectangular space is supported, but it'd be easy to add other spaces, like a big hex.
		You can find out if a hex is in valid space by calling inBounds();

IMPLEMENTATION NOTES
	Existing Libraries:
	Why didn't I use an existing hex grid library?
		I looked at several, and they didn't do what I needed, and took the wrong fundamental approach.
		Some are flat-top only, and I wanted pointy-top, or the ability to choose.
		HexLib.js hasn't been updated in a couple of years, but more importantly, it's very DOM-heavy:
			about half the file is implementing detailed event handling and stuff.
			It even has sprite classes baked in.  I don't want any of that.
		I want core hex-grid math, positioning, pathfinding, data mangement, etc.
		Rat can do everything else already.
	
	Reference:
	Super useful resource: http://www.redblobgames.com/grids/hexagons/
	Also interesting: http://keekerdc.com/2011/03/hexagon-grids-coordinate-systems-and-distance-calculations/

	Axial Coordinates:
	When I first started implementing this, I assumed I'd use offset coordinates,
		because that's what most people expect.
		But the more I read about it, the more I became convinced that Axial makes for easier implementation,
		and isn't that hard to understand.  I've been using this Axial system for a year now, since
		first implementing HexGrid, and it's definitely fine.  No big problem to understand, and
		with much easier to understand delta directions when moving from one square to another.
		
		Axial means (in a pointy system) that q increments to the right, and r increments down/right diagonally.
		And let's consider 0,0 the top left of our world, for now.
		(though I think that's flexible now)
		
TO DO:
	
	* test case in rtest for each of the below, which makes it more fun to implement anyway.
	
	[x] generic "for each" system for our defined space
		[x] convert our setAllXX functions to use it.

	[x] pixel to hex

	[x] support for squished hexes, determined at setup.
		
	* pathfinding
		
		[x] shortest path breadth-first
		
		[x] multi-pass split over calls!
			(define how many passes you want to happen, or let the whole search happen in one call)

		[x] support for marking blocking directly in data entries.
		
		* preferred avoidance of something with weights (cost per hex).
			(mark blocking as cost value ... 0 = no block, -1 = full block, other = cost)
		
		* Support A* (not done)
			
		[x] support multiple active pathfinding datasets
			so don't store pathfinding data in hexgrid itself.
			We also support different blocking sets (stored in our data but set/read by user),
			which is important in cases like different players having their own pathfinding objectives/knowledge.

		for pathfinding implementation, see
		http://www.redblobgames.com/pathfinding/a-star/introduction.html
		
	[x] distance
	
lower-pri todo:

	* list of coordinates in a range
		* including factoring in blocking squares

	* line of sight (pretty cool, but do we need it somewhere?)
	
	* copy function (copy one of these hexgrid objects to another.)
		e.g. to store a given state for later reference.
	
	* flat-top style instead of pointy.  Right now, pointy is our only supported style.
	* more optimized debug display?  maybe don't bother.
	
	* define region boundaries from a set of hexes, like culture borders in civ.
		* as paths to be filled/stroked,
		* or as mathematical definitions to be handled in other ways.
	
 */
rat.modules.add("rat.utils.r_hexgrid",
[
	{ name: "rat.math.r_math", processBefore: true },

	"rat.utils.r_utils",
],
function (rat)
{
	//	useful constants or references.
	var SQRT3 = rat.math.sqrt(3);

	///
	/// Hex Grid 
	/// potentially a lot of configuration options, so pass them in an object, instead of confusing list of args
	/// @constructor 
	///
	var HexGrid = function (userConfig)
	{
		var config = rat.utils.copyObject(userConfig);

		//	fill in a bunch of defaults
		config.colCount = config.colCount || 1;
		config.rowCount = config.rowCount || 1;
		config.sideSize = config.sideSize || 1;
		config.vScale = config.vScale || 1;	//	squish or stretch (vertically)

		//	keep a copy of that config info for debug, but the more useful values are stored in this.whatever directly.
		//	(we should never refer to config directly again after this init function, for simplicity and clarity)
		this.config = config;

		this.pointyStyle = true;	//	default
		if (typeof (config.style) !== 'undefined')	//	did they want to set a style explicitly?
			this.pointyStyle = (config.style === 'pointy');

		this.size = config.sideSize;

		//	precalculate some common stuff...
		this.vScale = config.vScale;
		this.hexHeight = this.size * 2 * this.vScale;
		this.hexWidth = SQRT3 / 2 * this.size * 2;

		//	specifying columns and rows tells us what kind of rectangular grid we want.
		//	0,0 is upper left, and with pointy style, we end up similar to the
		//	"odd-r" horizontal layout, but with axial coordinates.
		//	We expect the caller to understand this stuff, at least the axial coordinates part,
		//	which is important.

		//	We will eventually support different storage areas, like hex-shaped or triangular-shaped, or something,
		//	but each of these will still need offsets, or something similar to below,
		//	so it shouldn't matter much.

		var id = 0;	//	unique ID per hex - useful for pathfinding, and might be useful in other ways?
		this.data = [];
		for (var y = 0; y < config.rowCount; y++)
		{
			//	note - if we want a hex-shaped grid,
			//		we could store fewer entries here (and an offset) in this sub-array
			var row = [];
			this.data[y] = row;

			//	here's where we have to deal with an axial storage system.
			//	mark starting x offset in this row.
			//	e.g. what value to add to any index to get the real axial q,r coordinates
			//		(or inversely, what value to subtract from axial q to get index)

			row.offset = -(rat.math.floor(y / 2));

			for (var x = 0; x < config.colCount; x++)
			{
				this.data[y][x] = { value: (void 0), blocking: {'main':HexGrid.noBlocking}, debugStyle: (void 0), id: id++ };
			}
		}
	};

	//	standard directions (and indices in following "neighbors" table)
	HexGrid.direction = {
		right: 0,
		upRight: 1,
		upLeft: 2,
		left: 3,
		downLeft: 4,
		downRight: 5,
	};

	//	standard neighbors (in axial coordinates), and other neighbor info
	HexGrid.neighbors = [
		{ delta: { q: +1, r: 0 } },	//	right 1
		{ delta: { q: +1, r: -1 } },	//	upright
		{ delta: { q: 0, r: -1 } },	//	upleft
		{ delta: { q: -1, r: 0 } },	//	left
		{ delta: { q: -1, r: +1 } },	//	downleft
		{ delta: { q: 0, r: +1 } }	//	downright
	];
	//	standard 2-step neighbors (in axial coordinates), and other neighbor info
	HexGrid.neighbors2 = [
		{ delta: { q: +2, r: 0 } },	//	right
		{ delta: { q: +2, r: -1 } },
		{ delta: { q: +2, r: -2 } },
		{ delta: { q: +1, r: -2 } },
		{ delta: { q: 0, r: -2 } },
		{ delta: { q: -1, r: -1 } },
		{ delta: { q: -2, r: 0 } },	//	left
		{ delta: { q: -2, r: +1 } },
		{ delta: { q: -2, r: +2 } },
		{ delta: { q: -1, r: +2 } },	//	left
		{ delta: { q: 0, r: +2 } },
		{ delta: { q: +1, r: +1 } },
	];

	//	todo:  We need a more generic way to define relative sets of hexes
	//	(e.g. step 1 neighbors, step 2 neighbors, both 1 and 2, spiral list, etc.)
	//	and merging those lists into new lists
	//	and turn ALL of those variations into a callback list, optionally factoring in blocking
	//	(see forEachNeigbor below)

	HexGrid.fullBlocking = -1;	//	constant to indicate if a hex is totally blocked (not a cost)
	HexGrid.noBlocking = 0;	//	not blocked at all, no cost.
	//	otherwise, blocking costs can be whatever, e.g. 1, 4, 100...

	//	is this (axial) position valid?  (Is it within the data space we have defined)
	HexGrid.prototype.inBounds = function (q, r)
	{
		if (r < 0 || r >= this.data.length)
			return false;
		var row = this.data[r];
		var dataIndex = q - row.offset;
		if (dataIndex < 0 || dataIndex >= row.length)
			return false;
		return true;
	};

	//	forEachHex utility: for each hex in our defined data space,
	//	call this callback function, passing standard arguments in a block: hexGrid, entry, q, r, value, and userData
	HexGrid.prototype.forEachHex = function (callback, userData)
	{
		//	standard args passed to callback
		var args = {
			hexGrid : this,
			//	entry
			//	q, r
			//	value (will be entry.value)
			userData : userData,
		};
		
		//	walk through every hex
		for (var r = 0; r < this.data.length; r++)
		{
			args.r = r;
			var row = this.data[r];
			for (var x = 0; x < row.length; x++)
			{
				var q = x + row.offset;

				//	new callback approach - pass everything in a single block
				//callback(this, row[x], q, r, row[x].value, userData);
				args.q = q;
				args.entry = row[x];
				args.value = args.entry.value;
				
				callback(args);
			}
		}
	};

	//
	//	Get distance between two hexes.
	//	(doesn't depend on actual hex data, it's just math, so not a method)
	HexGrid.distance = function (aq, ar, bq, br)
	{
		return (rat.math.abs(aq - bq)
			+ rat.math.abs(aq + ar - bq - br)
			+ rat.math.abs(ar - br)) / 2;
	};
	//	and a prototype linked version just for convenience
	HexGrid.prototype.distance = HexGrid.distance;
	
	//	is 'b' a neighbor of 'a'?
	HexGrid.isNeighbor = function(aq, ar, bq, br, distance)
	{
		if (!distance)
			distance = 1;
		return (this.distance(aq, ar, bq, br) <= distance);
	};
	//	and a prototype linked version just for convenience
	//	could later check if the positions are in valid space?
	HexGrid.prototype.isNeighbor = HexGrid.isNeighbor;

	//	forEachNeigbor utility: for each hex neighboring this one,
	//	call this callback function, passing these arguments in a block (same as above):
	//		hexGrid, entry, q, r, value, and userData (if supplied)
	HexGrid.prototype.forEachNeighbor = function (sq, sr, callback, userData, avoidBlocking, includeSelf, distance)
	{
		//	standard args passed to callback
		var args = {
			hexGrid : this,
			//	entry
			//	q, r
			//	value (will be entry.value)
			userData : userData,
		};
		
		//	find all neighbors
		var neighbors = this.getNeighbors(sq, sr, avoidBlocking, includeSelf, distance);
		for (var i = 0; i < neighbors.length; i++)
		{
			var nq = neighbors[i].q;
			var nr = neighbors[i].r;
			if (!this.inBounds(nq, nr))
				continue;

			var row = this.data[nr];
			var dataIndex = nq - row.offset;
			//var entry = row[dataIndex];

			//	todo: take return value that says whether to continue?  Maybe we were looking for something, and if we found it,
			//	we may as well abort the loop...
			//callback(this, entry, nq, nr, entry.value, userData);
			args.entry = row[dataIndex];
			args.value = args.entry.value;
			args.q = nq;
			args.r = nr;
			callback(args);
		}
	};

	//	return data storage entry at this location.
	//	INTERNAL function only.  Clients use getDataAt() or getValueAt(), or some equivalent.
	HexGrid.prototype.getEntryAt = function (q, r)
	{
		q = q | 0;
		r = r | 0;
		if (!this.inBounds(q, r))
			return void 0;
		var row = this.data[r];
		var dataIndex = q - row.offset;
		return row[dataIndex];
	};

	//	set value (user data) at this location.
	//	return undefined if location invalid, but we generally expect the caller to know beforehand
	//		what's a valid position (e.g. by calling inBounds() themselves)
	HexGrid.prototype.setValueAt = function (q, r, value)
	{
		var entry = this.getEntryAt(q, r);
		if (!entry)
			return void 0;
		entry.value = value;
		return true;	//	I'm not super attached to this - return something more useful?
	};
	//	our standard concept of "clear" value
	HexGrid.prototype.clearValueAt = function (q, r)
	{
		return this.setValueAt(q, r, void 0);
	};

	//	return value (user data) at this location.
	//	return undefined if location invalid, but we generally expect the caller to know beforehand
	//		what's a valid position.
	HexGrid.prototype.getValueAt = function (q, r)
	{
		var entry = this.getEntryAt(q, r);
		if (!entry)
			return void 0;
		return entry.value;
	};

	//	set all defined grid entries to have this user value.
	HexGrid.prototype.setAllValues = function (value)
	{
		this.forEachHex(function (args)
		{
			//hg, entry, q, r
			args.entry.value = value;
		});
	};

	HexGrid.prototype.clearAllValues = function ()
	{
		this.setAllValues(void 0);
	};

	//	set blocking weight at this location. (for pathfinding)
	//	return undefined if location invalid, but we generally expect the caller to know beforehand
	//		what's a valid position.
	HexGrid.prototype.setBlockingAt = function (q, r, blocking, whichSet)
	{
		var entry = this.getEntryAt(q, r);
		if (!entry)
			return void 0;
		if (blocking === void 0)
			blocking = HexGrid.fullBlocking;
		if (whichSet === void 0)
			whichSet = 'main';

		entry.blocking[whichSet] = blocking;

		return true;	//	I'm not super attached to this - return something more useful?
	};
	//	return blocking weight at this location (pathfinding)
	//	return undefined if location invalid, but we generally expect the caller to know beforehand
	//		what's a valid position.
	HexGrid.prototype.getBlockingAt = function (q, r, whichSet)
	{
		var entry = this.getEntryAt(q, r);
		if (!entry)
			return void 0;
		if (whichSet === void 0)
			whichSet = 'main';
		return entry.blocking[whichSet];
	};

	HexGrid.prototype.clearBlockingAt = function (q, r)
	{
		return this.setBlockingAt(q, r, HexGrid.noBlocking);
	};

	//	need: clearallblocking

	//	set debug style (for debug rendering) at this location
	//	return undefined if location invalid, but we generally expect the caller to know beforehand
	//		what's a valid position.
	HexGrid.prototype.setDebugStyleAt = function (q, r, style)
	{
		var entry = this.getEntryAt(q, r);
		if (!entry)
			return void 0;
		entry.debugStyle = style;
		return true;	//	I'm not super attached to this - return something more useful?
	};
	//	our standard concept of "clear" debug style
	HexGrid.prototype.clearDebugStyleAt = function (q, r)
	{
		return this.setDebugStyleAt(q, r, void 0);
	};

	//	set all defined grid entries to have this debug style
	HexGrid.prototype.setAllDebugStyles = function (style)
	{
		this.forEachHex(function (args)
		{
			args.entry.debugStyle = style;
		});
	};

	HexGrid.prototype.clearAllDebugStyles = function ()
	{
		this.setAllDebugStyles(void 0);
	};

	//	return a list of valid neighbors, in coordinate object form.
	//	do not return neighbors out of bounds.
	//	if requested, don't return any blocking hexes, either.
	//		'avoidBlocking' can be true, in which case main blockset is used, or can be the name of another blocking set to look at
	//		(which is like saying true as well)
	//	resulting list is an array of objects, each of which has (grid-absolute) q,r values.
	HexGrid.prototype.getNeighbors = function (q, r, avoidBlocking, includeSelf, distance)
	{
		//	some default args
		if (avoidBlocking === true)	//	simple true - use main default blocking set
			avoidBlockingSet = 'main';
		else
			avoidBlockingSet = avoidBlocking;	//	use variable as blocking set name
		
		if (includeSelf === void 0)
			includeSelf = false;
		if (distance === void 0)
			distance = 1;

		var neighborList = HexGrid.neighbors;
		//	limited support for a wider radius,
		//	still only grabbing one ring (not inclusive with radius 1, blocking ignored).
		if (distance === 2)
		{
			neighborList = HexGrid.neighbors2;
		}
		var res = [];
		for (var nIndex = 0; nIndex < neighborList.length; nIndex++)
		{
			var nq = q + neighborList[nIndex].delta.q;
			var nr = r + neighborList[nIndex].delta.r;
			var entry = this.getEntryAt(nq, nr);
			if (!entry)
				continue;
			if (avoidBlocking && entry.blocking[avoidBlockingSet] === HexGrid.fullBlocking)
				continue;

			res.push({ q: nq, r: nr });
		}
		if (includeSelf)
		{
			//	todo: factor in blocking again?
			res.push({ q: q, r: r });
		}

		return res;
	};

	//	return true if B is a valid neighbor of A
	//	optionally factor in blocking, and optionally allow the values to be the same (includeSelf)
	HexGrid.prototype.isValidNeighbor = function (aq, ar, bq, br, avoidBlocking, includeSelf)
	{
		if (aq === bq && ar === br)	//	first check same location case
			return !!includeSelf;

		if (avoidBlocking === true)	//	simple true - use main default blocking set
			avoidBlockingSet = 'main';
		else
			avoidBlockingSet = avoidBlocking;	//	use variable as blocking set name
		
		for (var nIndex = 0; nIndex < HexGrid.neighbors.length; nIndex++)
		{
			var nq = aq + HexGrid.neighbors[nIndex].delta.q;
			var nr = ar + HexGrid.neighbors[nIndex].delta.r;
			if (nq === bq && nr === br)
			{
				var entry = this.getEntryAt(nq, nr);
				if (!entry)
					return false;
				if (avoidBlocking && entry.blocking[avoidBlockingSet] === HexGrid.fullBlocking)
					return false;

				return true;
			}
		}
		return false;
	};

	//	utility to merge one list of hexes into another list of hexes, ignoring duplicate locations,
	//	which is entirely determined by q,r values.
	HexGrid.prototype.mergeHexList = function (mainList, newList)
	{
		for (var i = 0; i < newList.length; i++)
		{
			var found = false;
			for (var mIndex = 0; mIndex < mainList.length; mIndex++)
			{
				if (mainList[mIndex].q === newList[i].q && mainList[mIndex].r === newList[i].r)
				{
					found = true;
					break;
				}
			}
			if (!found)
				mainList.push(newList[i]);
		}
		return mainList;
	};

	//	give back pixel position (center) from this hex position, factoring in hex size.
	//	this returns the pixel position of the center of the requested hex.
	//	This function works OK with fractional q/r values, unlike other hexgrid functions.
	HexGrid.prototype.axialToPixelPos = function (q, r)
	{
		if (this.pointyStyle)
		{
			return {
				//	todo: use precalculated this.hexHeight, this.hexWidth instead of some of this?
				x: this.size * SQRT3 * (q + r / 2),
				y: this.size * this.vScale * 3 / 2 * r
			};
		} else
		{
			return {
				x: this.size * 3 / 2 * q,
				y: this.size * this.vScale * SQRT3 * (r + q / 2)
			};
		}
	};
	HexGrid.prototype.posToPixelPos = HexGrid.prototype.axialToPixelPos;	//	alternate name

	//	given pixel coordinates, return hex grid coordinates.
	//	note that this may return coordinates outside our defined data space.
	//		that's currently considered fine.
	//		caller should just be sure to check inBounds() before using that hex.
	HexGrid.prototype.pixelPosToHex = function (x, y)
	{
		//	from http://www.redblobgames.com/grids/hexagons/#comment-1063818420
		//	This works by magic, I guess.

		//	he had:
		//	x = (x - this.size) / this.hexWidth;
		//	var t1 = y / (this.hexHeight/2);

		//	but that was too far up/left.  Not factoring in centering of square, I guess?  confusing...
		//	Anyway, to match hex-to-pixel code above...
		//	and adapting for our vScale support...
		x = x / this.hexWidth;	//	this basically normalizes x
		var t1 = (y + this.size * this.vScale) / (this.hexHeight / 2);	//	and y is normalized along with other stuff?

		//	without vScale:
		//x = x / this.hexWidth;	//	this basically normalizes x
		//var t1 = (y + this.size) / (this.hexHeight/2);	//	and y is normalized along with other stuff?

		var t2 = rat.math.floor(x + t1);
		var r = rat.math.floor((rat.math.floor(t1 - x) + t2) / 3);
		var q = rat.math.floor((rat.math.floor(2 * x + 1) + t2) / 3) - r;

		return { q: q, r: r };

		//	So, that's working.  Doesn't factor in non-pointy style, though, right?
		//	Old code for reference:

		/*
		//	first find approximate axial coordinates, and then find closest hex.
		//	this is following http://www.redblobgames.com/grids/hexagons/#pixel-to-hex
		
		var q;
		var r;
		
		if (this.pointyStyle)
		{
			q = (x * SQRT3/3 - y / 3) / this.size;
			r = y * 2/3 / this.size;
		} else {
			q = x * 2/3 / this.size;
			r = (y * SQRT3/3 - x / 3) / this.size;
		}
		
		//	now we have real-number q and r values...  need integers.
		//	Hmm...  use hex rounding, etc.
		
		return {q:1, r:1};
		*/
	};

	//
	//	sort this list of hexes by nearest distance to a destination, in euclidian distance terms.
	//	This is mostly useful for pathfinding.  See below.
	//	Note that this adds an extra "dist2" property to each entry in the list.  Hopefully this doesn't cause anyone problems.
	HexGrid.prototype.sortListByXYDistance = function (nList, endQ, endR)
	{
		var endPos = this.axialToPixelPos(endQ, endR);

		for (var i = 0; i < nList.length; i++)
		{
			var pos = this.axialToPixelPos(nList[i].q, nList[i].r);
			var dx = pos.x - endPos.x;
			var dy = pos.y - endPos.y;
			nList[i].dist2 = dx * dx + dy * dy;
		}

		function comp(a, b)
		{
			return a.dist2 - b.dist2;
		};

		return nList.sort(comp);

	};

	//	Pathfinding
	//	(todo: move to a more generic module that works on things like square grids and nodegraphs,
	//		and provide an API here for the key hex-grid things needed)
	//
	//	find a path from one point to another.
	//	pathInfo controls how we behave and also stores data from previous passes on the same path.
	//	You can have multiple pathfinding actions in progress, if you just keep their pathInfo around.
	//	returns true if complete, otherwise false (meaning we're still working on it)
	//
	//	Here's the minimal data you need to set in pathInfo:
	//		pathInfo.start = start location
	//		pathInfo.end = end location
	//
	//	By default, this does the whole search at once.
	//	If you specify a "cycles" value, we'll only perform X cycles
	//	call this function again with the same pathInfo to perform more cycles.
	//
	//	To force calculations to restart when half done, set pathInfo.done to true.
	//
	//	for reference on these algorithms, see http://www.redblobgames.com/pathfinding/a-star/introduction.html
	//	and see notes above.
	HexGrid.prototype.findPath = function (pathInfo)
	{
		//	fill in a bunch of defaults
		pathInfo.cycles = pathInfo.cycles || -1;	//	if not specified, spend as many cycles as needed

		//	initialize stuff if this is our first time.
		if (!pathInfo.frontier || pathInfo.done)
		{
			pathInfo.path = [];	//	will hold final path

			if (!pathInfo.settings)	//	no user-provided settings, so use defaults.
				pathInfo.settings = {};

			pathInfo.done = false;	//	flags when we're done searching
			pathInfo.valid = false;	//	marks whether we found a path

			var startEntry = this.getEntryAt(pathInfo.start.q, pathInfo.start.r);
			if (!startEntry)	//	no such start square
			{
				pathInfo.valid = false;	//	not a valid path
				pathInfo.done = true;	//	we're done working
				//	todo : set some kind of error flag so they know *why* it failed.
				return true;	//	done (but bogus result).
			}
			pathInfo.startID = startEntry.id;

			//	handle the case where we're already where we're going, so we can be a bit more optimal below.
			if (pathInfo.start.q === pathInfo.end.q && pathInfo.start.r === pathInfo.end.r)
			{
				pathInfo.valid = true;	//	valid empty path (zero steps)
				pathInfo.done = true;	//	we're done working
				return true;	//	done
			}

			pathInfo.frontier = [];	//	list of hexes to explore from
			pathInfo.frontier.push({ q: pathInfo.start.q, r: pathInfo.start.r, id: startEntry.id, priority: 0 });

			//	for tracking info about visited locations, (and knowing which I've visited)
			//	I'm using a unique "id" for each hex,
			//	which is set when the hexGrid is initialized above.
			//	The id is used here as a key in a hash of visited locations.
			//	This approach is easy and convenient in javascript, fairly optimal, and hasn't had problems
			//	in the year I've been using it.
			pathInfo.visited = {};
			pathInfo.visited[startEntry.id] = { q: pathInfo.start.q, r: pathInfo.start.r, fromID: -1, cost: 0 };

			//	for partial/failed pathing, keep track of where we got closest (optional)
			if (pathInfo.findClosest)
			{
				pathInfo.closest = {
					dist: 99999999,	//	todo: actual distance from start
					id: startEntry.id,
					pos: { q: pathInfo.start.q, r: pathInfo.start.r },
				};
			} else
				pathInfo.closest = null;
			
			if (pathInfo.blockingSet === void 0)
				pathInfo.blockingSet = 'main';
				

			pathInfo.done = false;	//	actively working on this path
		}

		//	spend several cycles doing the pathfinding work
		var cycles = 0;
		while (
			(pathInfo.cycles === -1 || cycles < pathInfo.cycles)
			&& pathInfo.frontier.length)
		{
			//	take current point in frontier that we're exploring, and expand from there.
			var current = pathInfo.frontier[0];	//	grab next one
			pathInfo.frontier.splice(0, 1);	//	remove it from frontier
			var curVisited = pathInfo.visited[current.id];	//	get visited entry (mostly for cost below) (there's always an entry for anything in the frontier)

			//	get neighbors, avoiding full blocked
			var nList = this.getNeighbors(current.q, current.r, true);

			//	A simple (optional) modification for more natural paths for human thinking...
			//	When searching neighbors to expand our frontier, prioritize entries that are closer
			//	in euclidian (normal XY) distances.
			//	This is potentially much more expensive!
			//	Also, this will need to get redone when we do A*, I think..
			//	Also, if we're serious about this, maybe use a different getNeighbors() function above,
			//	and in fact set up a bunch of them that prioritize various things...
			if (pathInfo.settings.prioritizeXYDistance)
			{
				nList = this.sortListByXYDistance(nList, pathInfo.end.q, pathInfo.end.r);
			}

			//	look at each neighbor
			for (var nIndex = 0; nIndex < nList.length; nIndex++)
			{
				var n = nList[nIndex];
				var entry = this.getEntryAt(n.q, n.r);

				var newCost = curVisited.cost + entry.blocking[pathInfo.blockingSet];

				if (!pathInfo.visited[entry.id] || newCost < pathInfo.visited[entry.id].cost)	//	haven't already visited this tile, or new path is less expensive
				{
					//	add it to our frontier
					var newFrontierEntry = { q: n.q, r: n.r, id: entry.id, priority: newCost };
					//	use newCost as a priority, and keep frontier an ordered list of locations by priority.
					//	todo: make this optional, since it's expensiveish, and some people don't use blocking costs.
					//		and in that case, we just want to append.
					//	todo: I wonder if it would be faster to maintain this list in reverse order, where high priority is end of list?
					var fIndex = 0;
					for (; fIndex < pathInfo.frontier.length; fIndex++)
					{
						if (newCost < pathInfo.frontier[fIndex].priority)	//	insert here
							break;
					}
					pathInfo.frontier.splice(fIndex, 0, newFrontierEntry);
					//	OLD: pathInfo.frontier.push(newFrontierEntry);

					//	remember that we've seen this tile, and here's what we know about it and how we got there.
					//	in the case of having arrived here from a cheaper path, we just replace the old entry entirely.
					pathInfo.visited[entry.id] = { fromQ: current.q, fromR: current.r, fromID: current.id, q: n.q, r: n.r, cost: newCost };

					//	is that where we were heading?  If so, we're done!
					if (n.q === pathInfo.end.q && n.r === pathInfo.end.r)
					{
						//	reconstruct path and return.
						//	todo: besides q and r, include dq and dr deltas?
						var curID = entry.id;
						while (curID !== pathInfo.startID)
						{
							var spot = pathInfo.visited[curID];
							pathInfo.path.unshift({ q: spot.q, r: spot.r });
							curID = pathInfo.visited[curID].fromID;
						}

						//	let go of our data
						pathInfo.frontier = void 0;
						pathInfo.visited = void 0;

						pathInfo.totalCost = newCost;
						pathInfo.valid = true;	//	mark our final path valid
						pathInfo.done = true;	//	we're done
						return true;	//	done
					}

					//	is it at least closer than we've been?
					if (pathInfo.findClosest)
					{
						var dist = rat.HexGrid.distance(n.q, n.r, pathInfo.end.q, pathInfo.end.r);
						if (dist < pathInfo.closest.dist)
						{
							pathInfo.closest.totalCost = newCost;
							pathInfo.closest.dist = dist;
							pathInfo.closest.pos = { q: n.q, r: n.r };
							pathInfo.closest.id = entry.id;
						}
					}

				}
			}
			cycles++;
		}
		//	done with cycles allocated, or with the whole job (no more locations to check).

		if (pathInfo.frontier.length)	//	not done - still working on it.
		{
			return false;
		}
		else		//	done, but didn't find a path!
		{
			//	were we supposed to find closest?
			if (pathInfo.findClosest)
			{
				//	reconstruct path and return.
				//	@todo consolidate with above path reconstruction code, when we move to a new module.
				var curID = pathInfo.closest.id;
				while (curID !== pathInfo.startID)
				{
					var spot = pathInfo.visited[curID];
					pathInfo.path.unshift({ q: spot.q, r: spot.r });
					curID = pathInfo.visited[curID].fromID;
				}
			}

			//	let go of our data
			pathInfo.frontier = void 0;
			pathInfo.visited = void 0;

			pathInfo.valid = false;
			pathInfo.done = true;
			return true;
		}
	};

	//
	//	Flood fill from this hex out, wherever we touch matching blocking cost.
	//	For each matching hex, call the provided callback (standard callback used everywhere in hexgrid)
	//
	//	It's OK for the callback to change the blocking on a hex - we will have already processed that hex.
	//
	//	todo: is this a useful function?  Maybe support as a multi-pass call, like pathfinding?
	//	This function should also probably go in the separate pathfinding module we're planning on making.
	//
	//	Todo: Dang, this should probably return a *list*, not a count.  That'd be way more useful.
	//
	HexGrid.prototype.floodFill = function (startQ, startR, options, callback, userData)
	{
		var pathInfo = {};	//	just in case we do eventually support multi-pass...
		
		pathInfo.blockingSet = 'main';
		if (options && options.blockingSet !== void 0)
			pathInfo.blockingSet = options.blockingSet;
		
		var startEntry = this.getEntryAt(startQ, startR);

		var matchBlocking = startEntry.blocking[pathInfo.blockingSet];	//	initial blocking value at this location
		
		pathInfo.startID = startEntry.id;
		pathInfo.frontier = [];	//	list of hexes to explore from
		pathInfo.frontier.push({ q: startQ, r: startR, id: startEntry.id });
		pathInfo.visited = {};
		pathInfo.visited[startEntry.id] = { q: startQ, r: startR };
		pathInfo.visitedCount = 1;
		
		//	standard args passed to callback
		var args = {
			hexGrid : this,
			//	entry
			//	q, r
			//	value (will be entry.value)
			userData : userData,
		};

		//	fill
		while (pathInfo.frontier.length)
		{
			//	take current point in frontier that we're exploring, and expand from there.
			var current = pathInfo.frontier[0];	//	grab next one
			pathInfo.frontier.splice(0, 1);	//	remove it from frontier

			//	process it
			var entry = this.getEntryAt(current.q, current.r);
			//callback(this, entry, current.q, current.r, entry.value, userData);
			args.entry = entry;
			args.q = current.q;
			args.r = current.r;
			args.value = args.entry.value;
			callback(args);

			//	get neighbors
			var nList = this.getNeighbors(current.q, current.r);

			//	look at each neighbor
			for (var nIndex = 0; nIndex < nList.length; nIndex++)
			{
				var n = nList[nIndex];
				var entry = this.getEntryAt(n.q, n.r);

				if (!pathInfo.visited[entry.id] && entry.blocking[pathInfo.blockingSet] === matchBlocking)
				{
					//	add it to our frontier
					var newFrontierEntry = { q: n.q, r: n.r, id: entry.id };
					pathInfo.frontier.push(newFrontierEntry);

					//	remember that we've seen this tile and added it to our frontier
					pathInfo.visited[entry.id] = { q: n.q, r: n.r };

					pathInfo.visitedCount++;
				}
			}
		}
		//	if needed, we could wait until we collect the full list and then call the callback...
		//	but I like the idea of the callback being able to abort the fill operation... (a potential feature currently unimplemented)

		return pathInfo.visitedCount;
	};
	
	//	Load some data from this standard layered data object,
	//	generally created by using the Tiled editor.
	//	For each cell that we get data for, all the layer data is collected, and the callback provided is called with that data.
	//	(standard hexgrid callback with additional argument "layerData[]"
	//	todo:
	//		options:
	//			support completely replacing our defined data structure with this new data's structure/dimensions
	//			and if not, then warn if data dimensions are bigger than our grid here.
	//		support other stagger values in data
	HexGrid.prototype.loadLayersFromData = function (data, callback, opts)
	{
		var layers = data['layers'];
		if (!layers)
			return;
		
		//	assuming "staggeraxis":"y",
		//	assuming "staggerindex":"odd",
		
		//	If there are several layers, we're ultimately going to set several layers' of data at once,
		//	in each cell, so let's just walk through all the cells we have and find their data all at once,
		//	 if it's there.
		this.forEachHex(function (args)
		{
			//args.entry.value
			var layerData = [];
			var gotData = false;
		
			//	assuming "staggerindex":"odd" here to convert from qr to xy
			var y = args.r;
			var x = args.q + rat.math.floor(args.r/2);
			
			//	for each layer, see if there's data that fits us, and collect it.
			for (var layerIndex = 0; layerIndex < layers.length; layerIndex++)
			{
				var layer = layers[layerIndex];
				var data = layer['data'];
				var width = layer['width'];
				var height = layer['height'];
				var dataIndex = y * width + x;

				if (x < width && y < height && layer['type'] === 'tilelayer' && data && data[dataIndex] !== void 0)
				{
					layerData[layerIndex] = data[dataIndex];
					gotData = true;
				}
			}
			//	and do something with that data.
			if (gotData)
			{
				if (callback)
				{
					args.layerData = layerData;
					callback(args);
				} else {	//	no callback - what do they want from us?
					//	set layer data in value directly.  Let's hope they can deal with that.
					if (!args.entry.value || typeof(args.entry.value) !== 'object')
						args.entry.value = {};
					args.entry.value = {layerData:layerData};
				}
			}
		});
		
	};
	

	//	create a single-hex html5 context path for later stroking or filling or whatever.
	HexGrid.prototype.makeHexContextPath = function (ctx, q, r, inset)
	{
		inset = inset || 0;

		var pos = this.axialToPixelPos(q, r);
		var x = pos.x;
		var y = pos.y;

		var h = this.hexHeight;
		var w = this.hexWidth;

		//	todo: probably these inset/2 values should be something else, like sqrt(3) or 2/3 or something. :)
		ctx.beginPath();
		ctx.moveTo(x + inset - w / 2, y + inset / 2 - h / 4);	//	top left
		ctx.lineTo(x, y + inset - h / 2);		//	top
		ctx.lineTo(x - inset + w / 2, y + inset / 2 - h / 4);
		ctx.lineTo(x - inset + w / 2, y - inset / 2 + h / 4);
		ctx.lineTo(x, y - inset + h / 2);		//	bottom
		ctx.lineTo(x + inset - w / 2, y - inset / 2 + h / 4);
		//ctx.lineTo(xxx, yyy);
		ctx.closePath();
	};

	//	draw (stroke) one hex (using current ctx lineWidth and strokeStyle)
	//	given q,r coordinates, we calculate where in hexgrid space this value is.
	//	mostly debug?
	HexGrid.prototype.strokeOneHex = function (ctx, q, r, inset)
	{
		this.makeHexContextPath(ctx, q, r, inset);
		ctx.stroke();
	};

	//	draw (fill) one hex (using current ctx fill info)
	//	given q,r coordinates, we calculate where in hexgrid space this value is.
	//	mostly debug?
	HexGrid.prototype.fillOneHex = function (ctx, q, r, inset)
	{
		this.makeHexContextPath(ctx, q, r, inset);
		ctx.fill();
	};

	//	draw (stroke or fill depending on each hex's debugStyle) the full grid.
	//	useful for debugging, really.
	//	set lineWidth and strokeStyle yourself before calling.
	HexGrid.prototype.drawGrid = function (ctx)
	{
		//	todo: for optimal performance, draw as many continuous lines as we can, instead of each hex,
		//	e.g. draw the zigzaggy tops for a bunch at once, and then connecting vertical lines.

		//	draw whatever our known valid data is.
		//	that way we don't care how we were set up, just what's valid data, and we draw that.
		for (var y = 0; y < this.data.length; y++)
		{
			var offset = this.data[y].offset;
			for (var x = 0; x < this.data[y].length; x++)
			{
				var q = x + offset;
				var r = y;
				this.strokeOneHex(ctx, q, r);

				var entry = this.getEntryAt(q, r);
				if (entry.debugStyle)
				{
					ctx.fillStyle = entry.debugStyle;
					this.fillOneHex(ctx, q, r);
				}
			}
		}

	};

	//	more globally accessible class
	rat.HexGrid = HexGrid;

});
