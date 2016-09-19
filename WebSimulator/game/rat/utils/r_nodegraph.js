//
//	Node Graph building module
//
/*
	USAGE:
	
	Setup:
		var nodeGraph = new rat.NodeGraph();
		
		nodeGraph.setConfig({	//	see "defConfig" below for many default values
			targetNodeCount : 24,	//	number of nodes we want to make, total (approximate, varies by linkFromCurrent)
		});
		
		nodeGraph.build();
		
	Then:
		nodeGraph.maxGeneration : is the maximum generation count (steps from start, which has a generation of 0)
		
		nodeGraph.getBounds() gets bounds of nodegraph
		
		nodeGraph.nodes : is an array of nodes. each node has
			pos : xy position (in nodegraph space, where nodes are usually around 1 unit apart)
			generation : number of steps from start node (could be a difficulty or depth or something)
			links : array of indices of nodes to which we are directly linked
			leaf : true if this is a leaf node (has only one link to the graph, and is not the starting node)
		
	todo: encapsulate nicely
	serialize/deserialize functions
	todo: move math utils elsewhere
	todo: calculate chokepoints
	todo: calculate leaves
	todo: optionally make target node count absolute - that's a lot more useful.

	How this works:
		We have a list of nodes on a conceptual grid of 1x1 units.
		We start at one node and grow from there, adding nodes, linking nearby nodes, according to config
		avoiding overlapping nodes, overlapping links, crossed links, etc.
*/

rat.modules.add("rat.utils.r_nodegraph",
[
	"rat.math.r_vector",
	"rat.graphics.r_graphics",
	"rat.utils.r_shapes",
	"rat.debug.r_console",
],
function (rat)
{
	///
	/// NodeGraph
	/// @constructor 
	///
	rat.NodeGraph = function ()
	{
		this.nodes = [];	//	actual map
		this.mapCenter = new rat.Vector(0, 0);
		this.mapSize = new rat.Vector(1, 1);
		this.config = null;
		this.fillDefaultConfig();
	};

	rat.NodeGraph.debug = {	//	debug drawing stuff
		nodeColors: [
			"red",
			"yellow",
			"green",
			"cyan",
			"blue",
			"violet",
			"orange",
		],
		NODE_COLOR_COUNT: 7
	};

	rat.NodeGraph.prototype.fillDefaultConfig = function ()
	{
		//	clean up some default stuff.
		if (!this.config)
			this.config = {};

		//	does this stuff work in compiler?  So annoying...
		//	If not, maybe set config to defaults and have client set their values AFTER that.
		//	but this is better 'cause we can fix client errors if we need to, or otherwise interpret..

		var defConfig = {

			rng : Math,	//	default, use built-in random()
			
			targetNodeCount: 50,	//	number of nodes we want to make, total (approximate, varies by linkFromCurrent)

			//	creating new nodes from current node
			linkFromCurrent: 3,	//	add several nodes from current node. high value = spiky burst patterns, low = long chains
			attemptsAtNearSpace: 5,	//	how many times to try to find near space
			nearSpaceDist: 3,		//	how near to attempt (+/-) (in units) (1 = very tight little lattices)
			nearSpaceBias: new rat.Vector(0, 0),	//	drift in one direction - this helps make maps more linear and less curly
			//	probably make nearSpaceBias less than nearSpaceDist, but it's not required.
			//	also note that a high bias results in fewer links back, generally, just 'cause they're not near enough.

			//	backlinking to existing near nodes after creating a new node:
			//	This first number : a higher number means more of a mesh, more paths, more loops.
			//	this number can be 0, resulting in no new links.  I think random*2 is a good range for a space trading game
			maxTargetNewLinks: 2,	//	how many links we would like to have to (randomly varied from 0 to this value)
			maxNearNodesToTry: 4,	//	lower = fewer links
			maxNearNodeDistance: 4,	//	these affect how far away nodes are connected in the final map
			minNearNodeDistance: 0,
			maxLinkGenerationGap: -1,	//	if the node we're trying to link back to is more than X generations back in the list, forget it.
			//	this helps loops be localized.
			//	0 is a valid value - it means same-generation nodes (branches from same parent) can be linked.
			//	1 works well - it means each link only goes up or down by one generation, e.g. 6->7->6->7->8->9
			//	-1 is no limit

			//	special rules
			maxLinksFromFirst: 1,	//	max number of links from first node
			maxLinksFromLast: 1,	//	max number of links to last node

			//	what to do when there are problems
			stuckAction: 'backtrack',	//	'backtrack', 'random', or none

			//	adjust when done
			addRandomJitter: true,	//	randomly shift nodes a bit when done so they don't look like they're on a grid
			adjustToTopLeft: false,	//	readjust to put top-left edges at 0 and 0
			
			//unused: recenterAtZero: false,		//	recenter all at 0,0
		};

		for (var c in defConfig)
		{
			if (typeof (this.config[c]) === 'undefined')
				this.config[c] = defConfig[c];
		}
	};

	rat.NodeGraph.prototype.setConfig = function (config)
	{
		this.config = config;
		this.fillDefaultConfig();
	};

	//	do these two lines intersect?
	//	NOTE:  This function won't return an intersect if the ends exactly line up,
	//	which is useful for adding one line on the end of another without considering them intersecting...
	function linesIntersect(x1, y1, x2, y2, x3, y3, x4, y4)
	{
		var numA = (x4 - x3) * (y1 - y3) - (y4 - y3) * (x1 - x3);
		var numB = (x2 - x1) * (y1 - y3) - (y2 - y1) * (x1 - x3);
		var denom = (y4 - y3) * (x2 - x1) - (x4 - x3) * (y2 - y1);

		if (denom === 0.0)
		{
			//	lines are the same or parallel - count that as not intersecting?  hmm...
			return false;
		}
		else
		{
			var ua = numA / denom;
			var ub = numB / denom;
			var inRange1 = (ua > 0.0 && ua < 1.0);
			var inRange2 = (ub > 0.0 && ub < 1.0);
			if (inRange1 && inRange2)
			{
				//intersectX = Math.floor(x1 + ua*(x2-x1)+0.5);
				//intersectY = Math.floor(y1 + ua*(y2-y1)+0.5);
				return true;
			}
			else
			{
				return false;
			}
		}
	}

	//	distance from a point to a line segment...
	//	http://stackoverflow.com/questions/849211/shortest-distance-between-a-point-and-a-line-segment
	function sqr(x) { return x * x; }
	function dist2(v, w) { return sqr(v.x - w.x) + sqr(v.y - w.y); }
	function distToSegmentSquared(p, v, w)
	{
		var l2 = dist2(v, w);
		if (l2 === 0)
			return dist2(p, v);
		var t = ((p.x - v.x) * (w.x - v.x) + (p.y - v.y) * (w.y - v.y)) / l2;
		if (t < 0)
			return dist2(p, v);
		if (t > 1)
			return dist2(p, w);
		return dist2(p, {
			x: v.x + t * (w.x - v.x),
			y: v.y + t * (w.y - v.y)
		});
	}
	//function distToSegment(p, v, w)
	//{
	//	return Math.sqrt(distToSegmentSquared(p, v, w));
	//}

	/**
	//
	//	Check if this new proposed line runs close to existing nodes anywhere.
	//	(except the given node)
	//
	* @param {number=} skipNode1
	* @param {number=} skipNode2
	*/
	rat.NodeGraph.prototype.checkLineNearNodes = function (curX, curY, x, y, skipNode1, skipNode2)
	{
		//console.log("checkLineNearNodes");
		var v = { x: curX, y: curY };
		var w = { x: x, y: y };
		for (var i = 0; i < this.nodes.length; i++)
		{
			if (i === skipNode1 || i === skipNode2)
				continue;
			var d = distToSegmentSquared(this.nodes[i].pos, v, w);
			//console.log(" (" + this.nodes[i].pos.x + "," + this.nodes[i].pos.y + ") .. (" +v.x + "," +v.y +")->(" + w.x + "," + w.y + ")");
			//console.log("  d = " + d);
			//	this value, 0.2 (used also below) was reached by experiment.  A smaller number would let nodes get closer.
			//	a higher number will keep them from getting too packed.
			if (d < 0.2)
			{
				//console.log("too close!");
				return true;
			}
		}
		return false;
	};

	//
	//	Check if this new proposed node is close to existing lines anywhere.
	//
	rat.NodeGraph.prototype.checkNodeNearLines = function (x, y)
	{
		//console.log("checkNodeNearLines");
		var p = { x: x, y: y };

		for (var i = 0; i < this.nodes.length; i++)
		{
			var n = this.nodes[i];
			for (var linkIndex = 0; linkIndex < n.links.length; linkIndex++)
			{
				var d = distToSegmentSquared(p, n.pos, this.nodes[n.links[linkIndex]].pos);
				//fix refs here before uncommenting: console.log(" (" + this.nodes[i].pos.x + "," + this.nodes[i].pos.y + ") .. (" +v.x + "," +v.y +")->(" + w.x + "," + w.y + ")");
				//console.log("  pd = " + d);
				if (d < 0.2)
				{
					//console.log(" p too close...");
					return true;
				}
			}
		}
		return false;
	};

	//
	//	check if this new proposed line is close in angle to any existing link to this node.
	//	This is not solving our problems...
	//
	/*
	function checkLinesClose(x1, y1, x2, y2, nodeIndex)
	{
		var angle = Math.atan2(y2-y1, x2-x1);
		var node = this.nodes[nodeIndex];
		for (var i = 0; i < node.links.length; i++)
		{
			var link = this.nodes[nodeIndex].links[i];
			var langle = Math.atan2(this.nodes[link].pos.y - node.pos.y, this.nodes[link].pos.x - node.pos.x);
			if (Math.abs(langle - angle) < 0.1)
			{
				rat.console.log("too close!");
				return true;
			}
		}
		return false;
	};
	*/

	//	check for used space in nodes
	rat.NodeGraph.prototype.checkUsedSpace = function (x, y)
	{
		for (var i = 0; i < this.nodes.length; i++)
		{
			if (this.nodes[i].pos.x === x && this.nodes[i].pos.y === y)
				return true;
		}

		return false;
	};

	/**
	//	check if this line intersects with any existing links.
	//	skipping a node is useful because we might be projecting a line from that node,
	//	and this code will detect that as an intersect since one endpoint is the same.
	//	But then I changed linesIntersect to ignore matching ends, so... forget that?
	*	@param {number=} skipNode optional node index to skip
	*/
	rat.NodeGraph.prototype.checkIntersects = function (sx, sy, x, y, skipNode)
	{
		for (var cIndex = 0; cIndex < this.nodes.length; cIndex++)
		{
			//if (cIndex == skipNode)
			//	continue;

			var cNode = this.nodes[cIndex];
			for (var linkIndex = 0; linkIndex < cNode.links.length; linkIndex++)
			{
				//	all links are doubled - only check links from lower to higher, to skip the duplicates.
				var tNodeIndex = cNode.links[linkIndex];
				if (tNodeIndex !== skipNode && tNodeIndex > cIndex)
				{
					var tNode = this.nodes[tNodeIndex];
					if (linesIntersect(sx, sy, x, y, cNode.pos.x, cNode.pos.y, tNode.pos.x, tNode.pos.y))
					{
						//console.log("isect: (" + sx + "," + sy + ")->(" + x + "," + y + ") x (" + cNode.x + "," + cNode.y + ")->(" + tNode.x + "," + tNode.y + ")");
						return true;
					}
				}
			}
		}
		return false;
	};

	//
	//	get a full list of nodes, in order of nearness to a certain node.
	//	exclude the subject node.
	//	exclude any nodes farther than the given generation gap
	//
	rat.NodeGraph.prototype.getNearNodeIndices = function (nodeIndex, maxGenerationGap)
	{
		var refNode = this.nodes[nodeIndex];
		refNode.distSq = 0;
		var list = [];
		for (var i = 0; i < this.nodes.length; i++)
		{
			var n = this.nodes[i];
			//	yes, I suck, I'm tacking fields on to the base structure for temporary purposes
			n.index = i;
			n.distSq = n.pos.distanceSqFrom(refNode.pos);

			if (maxGenerationGap >= 0)	//	check generation gap?
			{
				var generationGap = Math.abs(refNode.generation - n.generation);
				//console.log("checking gap " + generationGap);
				if (generationGap > maxGenerationGap)
				{
					//console.log("rejecting gap " + generationGap);
					continue;
				}
			}

			list[list.length] = n;
		}

		list.sort(function (a, b)
		{
			return a.distSq - b.distSq;
		});

		return list;
	};

	//	link these two nodes together, both ways.
	rat.NodeGraph.prototype.linkNodes = function (a, b)
	{
		this.nodes[a].links[this.nodes[a].links.length] = b;
		this.nodes[b].links[this.nodes[b].links.length] = a;

		//	debug checking
		//if (this.nodes[a].generation == 0 || this.nodes[b].generation == 0)
		//{
		//	console.log("gen 0");
		//}
		//var ggap = Math.abs(this.nodes[a].generation - this.nodes[b].generation);
		//if (ggap > 1)
		//{
		//	console.log("GGAP BIG: " + ggap);
		//}
	};

	//	return true if these two nodes are linked
	rat.NodeGraph.prototype.nodesHaveLink = function (a, b)
	{
		for (var linkIndex = 0; linkIndex < this.nodes[a].links.length; linkIndex++)
		{
			if (this.nodes[a].links[linkIndex] === b)
				return true;
		}
		return false;
	};

	//	link back to some nearby (older) nodes from this node.
	//	called below after each node is created, but could be used other ways in theory.
	rat.NodeGraph.prototype.linkNearNodes = function (nodeIndex, maxNewLinks)
	{
		//	now many new links to create, if there's room.
		//	This number strongly affects the final map - a higher number means more of a mesh, more paths, more loops.
		//	this number can be 0, resulting in no new links.  I think 0-1 is a good range for a space trading game
		var targetNewLinks = Math.floor(this.config.rng.random() * (maxNewLinks + 1));
		//console.log("target " + targetNewLinks);
		if (targetNewLinks === 0)
			return;

		var checkNode = this.nodes[nodeIndex];	//	convenience reference to our node

		//	get full list of nodes sorted by nearness
		var list = this.getNearNodeIndices(nodeIndex, this.config.maxLinkGenerationGap);

		//	go through first few nodes in list (nearest nodes to us)
		//	if we're not already linked, or a link would not intersect another link,
		//	then add a link.  Try to reach our target new link count.
		var maxNearNodesToTry = this.config.maxNearNodesToTry;
		var maxDist = this.config.maxNearNodeDistance;
		var minDist = this.config.minNearNodeDistance;

		for (var i = 1; i <= maxNearNodesToTry && i < list.length && targetNewLinks > 0; i++)	//	skip first, since that's us
		{
			//console.log("n " + nodeIndex + "+" + list[i].index + " dist = " + list[i].distSq);

			if (list[i].distSq >= minDist && list[i].distSq < maxDist &&
				!this.nodesHaveLink(nodeIndex, list[i].index) &&	//	already there?
				!this.checkIntersects(list[i].pos.x, list[i].pos.y, checkNode.pos.x, checkNode.pos.y) &&	//	crossing another line?
				!this.checkLineNearNodes(list[i].pos.x, list[i].pos.y, checkNode.pos.x, checkNode.pos.y, nodeIndex, list[i].index)	//	new link would be too near another node (except these 2)?
				)
			{
				//	special rule for limiting number of links to first node
				//console.log("special check: " + nodeIndex + " to " + list[i].index + ": has " + list[i].links.length);
				if (list[i].index === 0 && list[i].links.length >= this.config.maxLinksFromFirst)
					continue;

				//console.log("added");
				this.linkNodes(nodeIndex, list[i].index);
				targetNewLinks--;
			}
		}
	};

	//	shift the locations of nodes a little, just for looks.  Leave links alone.
	rat.NodeGraph.prototype.addRandomMapJitter = function ()
	{
		var rand = this.config.rng.random;
		for (var i = 0; i < this.nodes.length; i++)
		{
			this.nodes[i].pos.x += (rand() * 0.2 - 0.1);
			this.nodes[i].pos.y += (rand() * 0.2 - 0.1);
		}
	};

	//
	//	build the nodegraph according to config.
	//	This can be called again on an existing nodegraph to regenerate it.
	//
	rat.NodeGraph.prototype.build = function ()
	{
		this.nodes = [];	//	start clean in case this is a rebuild

		//	initial node
		this.nodes[0] = {
			pos: new rat.Vector(0, 0),	//	some interesting starting pos, but doesn't really matter (map grows in random directions)
			links: [],		//	list of node indices to which we are linked
			colorIndex: 0,	//	mostly for fun, for now
			generation: 0,	//	number of steps from root node
			main: true,		//	part of main path (wasn't a branch)
			leaf: false,
		};

		var curNode = 0;
		var generation = 1;
		var i;

		//	here's the main loop for adding new nodes one at a time
		for (var tries = 0; this.nodes.length < this.config.targetNodeCount; tries++)
		{
			var curX = this.nodes[curNode].pos.x;
			var curY = this.nodes[curNode].pos.y;

			var lastNode = curNode;
			var nodeAdded = 0;	//	track if we added a new node (won't be 0, if we did)

			//	add several nodes connected from here
			//	this number could change to affect output, or it could even be randomly picked for each node instead of fixed.
			//	A high number here results in spiky burst patterns
			var linkFromCurrent = this.config.linkFromCurrent;

			//	special rule for limiting links to/from first node
			if (this.config.maxLinksFromFirst < linkFromCurrent && curNode === 0)
				linkFromCurrent = this.config.maxLinksFromFirst;

			for (var sIndex = 0; sIndex < linkFromCurrent; sIndex++)
			{
				//	try a few times to find a legit spot for the new node
				//	note that it's possible not to find a spot, which could mean drastically different generated maps, depending on randomness
				//	changing this number won't affect much - a higher number means trying harder, taking a little longer.
				//	I suppose changing this lower would result in less strung-out maps?
				for (var fIndex = 0; fIndex < this.config.attemptsAtNearSpace; fIndex++)
				{
					//	OK, this is interesting.
					//	We actually end up with cleaner maps if we make this a little lopsided.
					//	They curl back on themselves less...
					//	so, I added this "bias" idea..
					var x = curX + Math.floor(this.config.rng.random() * this.config.nearSpaceDist * 2) - this.config.nearSpaceDist + this.config.nearSpaceBias.x;
					var y = curY + Math.floor(this.config.rng.random() * this.config.nearSpaceDist * 2) - this.config.nearSpaceDist + this.config.nearSpaceBias.y;
					if (x === 0 && y === 0)
						continue;
					//console.log("checking cases for " + curNode);
					if (!this.checkUsedSpace(x, y) && //	node at this spot?
						!this.checkIntersects(curX, curY, x, y, curNode) &&	//	new link would cross other links?
						!this.checkLineNearNodes(curX, curY, x, y, curNode) &&	//	new link would be too near another node?
						!this.checkNodeNearLines(x, y))	//	new node would be too near another link?
					{
						//	all good - add the new node!
						//console.log("OK");
						var node = {
							pos: new rat.Vector(x, y),
							links: [],
							colorIndex: Math.floor(this.config.rng.random() * rat.NodeGraph.debug.NODE_COLOR_COUNT),
							generation: generation,
							main: false,		//	not part of main path yet - depends on whether more is built from here
							leaf: false,		//	by default, not a leaf - will get detected when we're done
						};
						this.nodes[this.nodes.length] = node;
						this.linkNodes(curNode, this.nodes.length - 1);
						nodeAdded = this.nodes.length - 1;

						this.nodes[curNode].main = true;	//	we've successfully built from here, so current base is part of main line

						//	try to link this new node to other existing nearby nodes, as well.
						//	so the map has some nice double-links and loops.
						var backLinks = this.config.maxTargetNewLinks;

						if (this.nodes.length >= this.config.targetNodeCount)	//	will be last node
						{
							//	node already has one link - back to source.
							//console.log("last node...");
							if (this.config.maxLinksFromLast - 1 < backLinks)
								backLinks = this.config.maxLinksFromLast - 1;
						}
						//console.log("backLinks " + backLinks);

						if (backLinks)
							this.linkNearNodes(this.nodes.length - 1, backLinks);

						break;
					}	//	end of good check and new node added
				}	//	end of near space checks
			}	//	end of loop to add multiple new nodes

			//	IF we created any new nodes, use the new node as anchor.
			//	if we did not, we need to make sure not to update curNode, as we might be backtracking... see below
			if (nodeAdded)
				curNode = nodeAdded;	//	move to this node as an anchor for new nodes

			if (curNode === lastNode)	//	same as before, wasn't able to create a single new node...
			{
				//rat.console.log("Boxed in at " + curNode + "... stuck action: " + this.config.stuckAction);
				if (this.config.stuckAction === 'random')
				{
					//	try picking a random previous node to work with...
					curNode = Math.floor(this.config.rng.random() * this.nodes.length);

				} else if (this.config.stuckAction === 'backtrack')
				{
					curNode--;
					//rat.console.log("backtracking to " + curNode);
					if (curNode <= 1)	//	man, serious problems...  I don't think this is possible or likely
						break;	//	done
				} else
				{	//	no stuck behavior - just stop give up...
					break;	//	done
				}
				generation = this.nodes[curNode].generation;	//	roll back generation to match
				//	todo: if we step back to a leaf and it works, mark it as main?

				//	NOTE:  At this point, we have to get unstuck.
				//	Walking back (or randomly jumping back) is our only solution, currently.
				//	Rolling back the generation counter as well is the right thing to do in theory, and it avoids generation gap problems,
				//	but it means potentially that our generations don't get very high, if there's a lot of backtracking.
				//	though, that already kinda happens with multiple links off a node.  Hmm...
				//	one option would be to generate nodes until we hit a target generation instead of a target total count,
				//	but I'm not sure if that's desirable.  Would probably depend on the specific use of the resulting nodegraph.

			}	//	end of detected stuck

			generation++;	//	next generation will be one beyond ours
		}
		//rat.console.log("ng created " + this.nodes.length + " nodes.");

		this.nodes[this.nodes.length - 1].main = true;	//	mark final node as part of main line (from start to end)

		//	mark explicit leaves
		for (i = 0; i < this.nodes.length; i++)
		{
			if (this.nodes[i].links.length === 1 && !this.nodes[i].main)
				this.nodes[i].leaf = true;
		}

		//linkNearNodes(0);	//	test

		if (this.config.addRandomJitter)
			this.addRandomMapJitter();	//	for looks, shift nodes around a bit

		//	find bounds so we know where the center is
		var minX = 99999;
		var maxX = -99999;
		var minY = 99999;
		var maxY = -99999;
		for (i = 0; i < this.nodes.length; i++)
		{
			if (this.nodes[i].pos.x < minX)
				minX = this.nodes[i].pos.x;
			if (this.nodes[i].pos.x > maxX)
				maxX = this.nodes[i].pos.x;
			if (this.nodes[i].pos.y < minY)
				minY = this.nodes[i].pos.y;
			if (this.nodes[i].pos.y > maxY)
				maxY = this.nodes[i].pos.y;
		}
		this.mapSize.x = maxX - minX;
		this.mapSize.y = maxY - minY;
		this.mapLargestSide = (this.mapSize.x > this.mapSize.y) ? this.mapSize.x : this.mapSize.y;
		this.mapCenter.x = minX + this.mapSize.x / 2;
		this.mapCenter.y = minY + this.mapSize.y / 2;
		//console.log("center " + this.mapCenter.x + "," + this.mapCenter.y);

		//	readjust everything so top-left is 0,0
		if (this.config.adjustToTopLeft)
		{
			for (i = 0; i < this.nodes.length; i++)
			{
				this.nodes[i].pos.x -= minX;
				this.nodes[i].pos.y -= minY;
			}
			this.mapCenter.x -= minX;
			this.mapCenter.y -= minY;
		}

		this.maxGeneration = generation - 1;	//	remember highest "generation" we reached.
	};

	rat.NodeGraph.prototype.getBounds = function ()
	{
		var r = new rat.shapes.Rect(this.mapCenter.x - this.mapSize.x / 2, this.mapCenter.y - this.mapSize.y / 2, this.mapSize.x, this.mapSize.y);
		return r;
	};

	//	draw map - for debug use
	rat.NodeGraph.prototype.draw = function (ctx, fitRect, center, forceScale)
	{
		var nodeScale = 10;
		var bufferSpace = nodeScale * 2;
		var n;
		var x;
		var y;
		var i;
		var mapScale = (fitRect.w - bufferSpace * 2) / (this.mapSize.x);
		var altScale = (fitRect.h - bufferSpace * 2) / (this.mapSize.y);
		if (altScale < mapScale)
			mapScale = altScale;
		if (forceScale)
		{
			mapScale = forceScale;
			bufferSpace = 0;
		}

		//var mapScale = 30 * (10 / this.mapLargestSide);

		//var offsetX = fitRect.x + 250 - this.mapCenter.x * mapScale;
		//var offsetY = fitRect.y + 200 - this.mapCenter.y * mapScale;
		var offsetX = bufferSpace;
		var offsetY = bufferSpace;
		if (center)
		{
			offsetX = fitRect.x + fitRect.w / 2 - this.mapCenter.x * mapScale;
			offsetY = fitRect.y + fitRect.h / 2 - this.mapCenter.y * mapScale;
		} else
		{
			offsetX = fitRect.x;
			offsetY = fitRect.y;
		}

		rat.graphics.save(ctx);
		rat.graphics.translate(offsetX, offsetY, ctx);

		ctx.fillStyle = "#6040FF";
		//	first draw nodes
		for (i = 0; i < this.nodes.length; i++)
		{
			var size = nodeScale;
			//	temp debug stuff
			/*
			if (i == 0)
				ctx.fillStyle = "#F04030";
			else if (i == 1)
				ctx.fillStyle = "#F0F030";
			else if (i == 2)
				ctx.fillStyle = "#00F0F0";
			else
				ctx.fillStyle = "#6040FF";
			*/
			if (i === 0)	//	show first node differently
				size = nodeScale * 2;
			if (i === this.nodes.length - 1)	//	show last node differently
				size = nodeScale * 2;

			n = this.nodes[i];
			x = n.pos.x * mapScale;
			y = n.pos.y * mapScale;

			ctx.fillStyle = rat.NodeGraph.debug.nodeColors[n.colorIndex];

			rat.graphics.save();
			rat.graphics.translate(x, y, ctx);
			ctx.beginPath();
			ctx.arc(0, 0, size / 2, 0, Math.PI * 2, true);
			ctx.closePath();
			ctx.fill();
			rat.graphics.restore();

			ctx.font = "10px Arial";
			ctx.fillStyle = "#A0A0A0";
			ctx.fillText(n.generation, x + 5, y - 2);
		}

		//	then another pass for drawing links
		for (i = 0; i < this.nodes.length; i++)
		{
			n = this.nodes[i];
			x = n.pos.x * mapScale;
			y = n.pos.y * mapScale;

			ctx.strokeStyle = "yellow";
			for (var linkIndex = 0; linkIndex < n.links.length; linkIndex++)
			{
				//	to only draw links once, only draw from smaller indices to bigger indices, and not vice-versa
				if (n.links[linkIndex] < i)
					continue;

				var n2 = this.nodes[n.links[linkIndex]];
				var x2 = n2.pos.x * mapScale;
				var y2 = n2.pos.y * mapScale;

				ctx.beginPath();
				ctx.moveTo(x, y);
				ctx.lineTo(x2, y2);
				ctx.closePath();
				ctx.stroke();
			}
		}

		var r = this.getBounds();
		ctx.strokeStyle = "#55FF55";
		ctx.strokeRect(r.x * mapScale, r.y * mapScale, r.w * mapScale, r.h * mapScale);

		rat.graphics.restore();	//	restore from center offset translation

		//	show fitrect - how well did we do?
		ctx.strokeStyle = "#5555FF";
		ctx.strokeRect(fitRect.x, fitRect.y, fitRect.w, fitRect.h);


	};
});