
//----------------------------
//	treeview
//

/*

	Very rough initial tree view.  Maybe useful as a debugging or toolset element.
	
	Could be way more complicated than this one day.
	
	Having some trouble figuring out if we want subelements that know they're in the input map...
	
	Scrolling:
		We're just going to act like we draw our whole tree as it's currently set up to draw.
		If you need this to be in a clipped scrolling space, put it inside a standard scrollview.

	TODO:
		* support totally noninteractive version (but is that the same as simply disabling it?)
		* callback for tree organization change
		* function to query x/y position and size for a given node (by name?), for custom drawing on top of that.
		
		* support NOT displaying root, optionally.
			(it still needs an entry in the tree, and a _treeView structure, etc., just needs to not be added to the visual list,
			not have a treeIndex, etc.)
*/

rat.modules.add( "rat.ui.r_ui_treeview",
[
	{name: "rat.ui.r_ui", processBefore: true },
	
	//"rat.graphics.r_ui_textbox",
	"rat.utils.r_utils",
	"rat.graphics.r_graphics",
	"rat.ui.r_ui_data",
], 
function(rat)
{
	/**
	 * @constructor
	 * @extends rat.ui.Element
	*/
	rat.ui.TreeView = function(parentView)
	{
		rat.ui.TreeView.prototype.parentConstructor.call(this, parentView); //	default init
		
		this.setTracksMouse(true);	//	we do want mouse tracking, highlighting, etc.
		this.setTargetable(true);	//	we're targetable for key input.  Scary...
		
		//	TODO: refactor these frame and selection "look" concepts, which are the same as edittext
		this.editBodyLook = {		//	("fill" look)
			normalColor : new rat.graphics.Color(20, 20, 20),
		};
		this.editFrameLook = {
			normalColor : new rat.graphics.Color(180, 180, 180),
			highlightColor : new rat.graphics.Color(255, 255, 180),
			targetColor : new rat.graphics.Color(255, 255, 255),
			lineWidth : 2,
		};
		this.editSelectionLook = {
			normalColor : new rat.graphics.Color(200, 200, 180, 0.2),	//	selection when inactive - very light
			//activeColor : new rat.graphics.Color(255, 255, 180, 0.8),
		};
		
		this.nextNodeID = 1;		//	unique ID that doesn't change even if things are moved around
		this.setFont("arial", 13, "");
	};
	rat.utils.inheritClassFrom(rat.ui.TreeView, rat.ui.Element);
	rat.ui.TreeView.prototype.elementType = 'treeView';
	
	//	these flag changes need to set me dirty, because they change my look!
	//	see rat.ui module, comments above flagsThatDirtyMe variable,
	//	and rat.ui.Element.prototype.checkFlagsChanged function.
	//	This is similar to buttons...
	rat.ui.TreeView.prototype.flagsThatDirtyMe = 
			rat.ui.Element.highlightedFlag |
			rat.ui.Element.enabledFlag;

	//	set up font
	//	todo: refactor this font code and other similar code (e.g. textbox) to a single font tracking object in rat.
	rat.ui.TreeView.prototype.setFont = function (font, size, style)
	{
		this.font = font;
		if (size)
			this.fontSize = size;
		if (style)
			this.fontStyle = style;
		this.fontDescriptor = ("" + this.fontStyle + " " + this.fontSize + "px " + this.font).trim();
	};
	
	//	set tree values
	//	We expect this is a single object with a "children" list, each of which is an object with children, etc., like this:
	//	var thing = { label: "topthing", children: [
	//		thing1 : { label : "bob"},
	//		thing2 : { label : "frank"}, children : [
	//				... (etc)
	//		]},
	//	]};
	rat.ui.TreeView.prototype.setTreeValues = function(values)
	{
		var treeView = this;
		this.tree = values;	//	root of tree is the main object passed in
		
		this.removeAllSubElements();
		
		//	build content
		var lineHeight = this.fontSize + 2;
		var ySpace = 4;
		//var fontHeight = 13;
		var xIndent = 30;
		
		var treeIndex = 0;	//	simple vertical index in list, ignoring parenting and depth

		function addLine(entry, x, y)
		{
			//	for each item we add, we're going to give it a set of extra treeView specific properties.
			if (!entry._treeView)
				entry._treeView = {};
			
			//var elem = rat.ui.makeCheapButton(null, new rat.graphics.Color(180, 180, 180));
			
			var colorStates = [];
			colorStates[0] = {
				flags : rat.ui.Element.enabledFlag, //	normal state
				color : new rat.graphics.Color(0, 0, 0, 0.0),
				frameColor : new rat.graphics.Color(0, 0, 0, 0.0),
				textColor : new rat.graphics.Color(180, 180, 180),
			};
			colorStates[1] = {
				flags : rat.ui.Element.enabledFlag | rat.ui.Element.highlightedFlag, //	highlight state
				color : new rat.graphics.Color(80, 80, 80),
				frameColor : new rat.graphics.Color(0, 0, 0, 0.0),
				textColor : new rat.graphics.Color(180, 180, 180),
			};
			colorStates[1] = {
				flags : rat.ui.Element.enabledFlag | rat.ui.Element.toggledFlag, //	toggled (selected) state
				color : new rat.graphics.Color(40, 40, 180),
				frameColor : new rat.graphics.Color(0, 0, 0, 0.0),
				textColor : new rat.graphics.Color(180, 180, 180),
			};
			
			var elem = rat.ui.makeCheapButtonWithColors(null, colorStates);
			elem.setToggles(true);	//	we use toggle as "selection"
			
			//var tbox = new rat.ui.TextBox(entry.label);
			//tbox.setFont("arial");
			//tbox.setFontSize(fontHeight);
			elem.setFont(treeView.font, treeView.fontSize, treeView.fontStyle);
			elem.setTextValue(entry.label);
			elem.getTextBox().setAlign(rat.ui.TextBox.alignLeft);
			elem.setPos(x, y);
			elem.setSize(treeView.size.x - x - 100, lineHeight);	//	hack - don't make them full width, so I can scroll...?
			//tbox.setAlign(rat.ui.TextBox.alignLeft);
			//tbox.setFrame(1, rat.graphics.yellow);
			//tbox.setColor(new rat.graphics.Color(180, 180, 180));
			elem.setCallback(function(thisElem, userData)
			{
				treeView.selectNodeByID(thisElem.treeNode._treeView.treeNodeID);	//	mostly to unselect the rest.
			}, null);
			
			treeView.appendSubElement(elem);
			
			//	and mark each entry (in the original data!) with a unique ID for later manipulation,
			//	IF it doesn't already have one.
			//	and make some convenient cross-references...
			if (!entry._treeView.treeNodeID)
				entry._treeView.treeNodeID = treeView.nextNodeID++;
			
			entry._treeView.treeIndex = treeIndex++;	//	tree index gets reset any time we're building this list - it's a simple vertical index
			
			entry._treeView.elem = elem;
			elem.treeNode = entry;
			
			return lineHeight;
		}
		
		function addSubTree(parent, list, x, y)
		{
			var startY = y;
			for (var i = 0; i < list.length; i++)
			{
				var entry = list[i];
				
				addLine(entry, x, y);
				entry._treeView.parentNode = parent;
				
				y += lineHeight + ySpace;
				
				if (entry.children)
				{
					var subHeight = addSubTree(entry, entry.children, x + xIndent, y);
					y += subHeight;
				}
			}
			return y - startY;
		};
		
		var height = 0;
		var x = 5;
		var y = 5;
		if (this.tree)
		{
			height = addLine(this.tree, x, y)
			y += height + ySpace;
			x += xIndent;
			if (this.tree.children)
				height += addSubTree(this.tree, this.tree.children, x, y);
		}
		
		this.elemCount = treeIndex;
		
		this.setContentSize(this.size.x, height + ySpace);
		
		this.setDirty(true);
	};
	
	//	return full tree of values (return top-level object, which has children)
	rat.ui.TreeView.prototype.getTreeValues = function()
	{
		return this.tree;
	};
	
	
	rat.ui.TreeView.prototype.removeChildFrom = function(nodeParent, nodeChild)
	{
		if (nodeParent.children)
		{
			for (var i = 0; i < nodeParent.children.length; i++)
			{
				if (nodeParent.children[i]._treeView.treeNodeID === nodeChild._treeView.treeNodeID)
				{
					nodeParent.children.splice(i, 1);
					nodeChild._treeView.parentNode = null;
					//	also remove ui element, if any
					//	this is pretty questionable, since all the other UI elements need to get visually moved, too!
					//	need another separate function that does that.
					//	For now, we actually depend on the whole visual tree being rebuilt elsewhere after this.
					//if (nodeParent._treeView.elem && nodeChild._treeView.elem)
					//{
					//	nodeParent._treeView.elem.removeSubElement(nodeChild._treeView.elem);
					//}
					
					if (this.removeChildCallback)
						this.removeChildCallback(this, this.tree, nodeParent, nodeChild);
					
					return true;
				}
			}
		}
		
		return false;
	};
	
	//	add this node to a parent's children list, with optional requested index.
	rat.ui.TreeView.prototype.addChildTo = function(nodeParent, nodeChild, atIndex)
	{
		if (!nodeParent.children)
			nodeParent.children = [];
		if (atIndex === void 0)
			atIndex = nodeParent.children.length;
		
		nodeParent.children.splice(atIndex, 0, nodeChild);
		nodeChild._treeView.parentNode = nodeParent;
		
		if (this.addChildCallback)
			this.addChildCallback(this, this.tree, nodeParent, nodeChild, atIndex);
		
		//	add visual element.  This is wrong - For now, we actually depend on the whole visual tree being rebuilt elsewhere after this.
		//if (nodeParent._treeView.elem && nodeChild._treeView.elem)
		//	nodeParent._treeView.elem.appendSubElement(nodeChild._treeView.elem);
		return true;
	};
	
	//	return the index of this child in this parent, or -1 if not found
	rat.ui.TreeView.prototype.getChildIndex = function(nodeParent, nodeChild)
	{
		if (nodeParent.children)
		{
			for (var i = 0; i < nodeParent.children.length; i++)
			{
				if (nodeParent.children[i]._treeView.treeNodeID === nodeChild._treeView.treeNodeID)
					return i;
			}
		}
		return -1;
	};
	
	rat.ui.TreeView.prototype.isDescendentOf = function(nodeParent, checkNode)
	{
		do {
			var parent = checkNode._treeView.parentNode;
			if (parent === nodeParent)
				return true;
			checkNode = parent;
		} while (checkNode);
		
		return false;
	};

	//	Generic utility to apply some function to the whole tree.
	//	The function takes a single node pointer and userdata argument
	//	If the function returns non-void, it's done, and we should stop recursing, and return that value.
	rat.ui.TreeView.prototype.applyToTree = function(func, userData, node)
	{
		if (!node)
			node = this.tree;
		
		if (!node)	//	nothing to apply to
			return;
		
		var res = func(node, userData);
		if (res !== void 0)
			return res;
		
		if (node.children)
		{
			for (var i = 0; i < node.children.length; i++)
			{
				var entry = node.children[i];
				var res = this.applyToTree(func, userData, entry);
				if (res !== void 0)
					return res;
			}
		}
		return void 0;
	};
	
	//	select (toggle?) the node with this id, if there is one.
	//	unselect the rest.
	rat.ui.TreeView.prototype.selectNodeByID = function(inID)
	{
		var selNode = null;
		this.applyToTree(function(node, id)
		{
			if (node._treeView.elem)
			{
				if (node._treeView.treeNodeID === id)
				{
					selNode = node;
					node._treeView.elem.setToggled(true);
				}
				else
					node._treeView.elem.setToggled(false);
			}
			
			return void 0;
		}, inID);
		
		if (this.selectionCallback)
			this.selectionCallback(this, this.tree, [selNode]);
	};
	
	//	select (toggle?) the node with this tree index, if there is one.
	//	unselect the rest.
	rat.ui.TreeView.prototype.selectNodeByIndex = function(inIndex)
	{
		var node = this.getNodeByIndex(inIndex);
		if (node)
			this.selectNodeByID(node._treeView.treeNodeID);
	};
	rat.ui.TreeView.prototype.selectNode = function(node)
	{
		if (!node || !node._treeView)	//	invalid, so unselect everything
			this.selectNodeByID(-99999);	//	hack.  todo: we need a "clear selection" function...
		else
			this.selectNodeByID(node._treeView.treeNodeID);
	};
	
	//	return the node with this tree index, if there is one
	rat.ui.TreeView.prototype.getNodeByIndex = function(inIndex)
	{
		return this.applyToTree(function(node, index)
		{
			if (node._treeView.treeIndex === index)
				return node;
			else
				return (void 0);
		}, inIndex);
	};
	
	//	return data tree node matching whatever's selected right now
	rat.ui.TreeView.prototype.getSelectedNode = function()
	{
		return this.applyToTree(function(node, userData)
		{
			if (node._treeView.elem && node._treeView.elem.isToggled())
			{
				return node;
			}
		});
	};
	
	//	given a particular node, return its parent node, if there is one.
	rat.ui.TreeView.prototype.getNodeParent = function(targetNode)
	{
		if (!targetNode)
			return null;
		
		function search(node)
		{
			for (var i = 0; i < node.children.length; i++)
			{
				var entry = node.children[i];
				if (entry._treeView.treeNodeID === targetNode._treeView.treeNodeID)
					return node;
				
				if (entry.children)
				{
					var res = search(entry);
					if (res)
						return res;
				}
			}
			return null;
		}
		return search(this.tree);
	};
	
	//	reorganize this node's position
	//	return true if tree changed.
	rat.ui.TreeView.prototype.moveNode = function(selectedNode, dirKey)
	{
		if (!selectedNode)
			return false;
		
		var treeChanged = false;
		var nodeParent = this.getNodeParent(selectedNode);
		var gparent = null;
		if (nodeParent)
			gparent = this.getNodeParent(nodeParent);
		
		if (dirKey === rat.keys.leftArrow)
		{
			//	move out of my parent
			if (gparent)
			{
				var parIndex = this.getChildIndex(gparent, nodeParent);
				
				this.removeChildFrom(nodeParent, selectedNode);
				this.addChildTo(gparent, selectedNode, parIndex);	//	insert right before parent slot
				treeChanged = true;
			}
		} else if (dirKey === rat.keys.rightArrow)
		{
			//	move inside the next element in list
			var index = selectedNode._treeView.treeIndex;
			var targetNode;
			//	but skip any node that's my descendent.
			do {
				targetNode = this.getNodeByIndex(++index);
			} while (targetNode && this.isDescendentOf(selectedNode, targetNode));
			if (nodeParent && targetNode)
			{
				this.removeChildFrom(nodeParent, selectedNode);
				this.addChildTo(targetNode, selectedNode, 0);	//	insert at start
				treeChanged = true;
			}
		} else if (dirKey === rat.keys.upArrow)
		{
			//	Move up visually.
			//	Trickier.  If I'm not the first in a child list, then reorder me in my parent.
			//	If I'm the first in a child list, then remove me from parent and put me before parent in gparent's children.
			var sibIndex = this.getChildIndex(nodeParent, selectedNode);
			if (sibIndex > 0)
			{
				this.removeChildFrom(nodeParent, selectedNode);
				this.addChildTo(nodeParent, selectedNode, sibIndex-1);
				treeChanged = true;
			}
//			else if (gparent) {
				//get index of my parent in gparent
				//
				//this.removeChildFrom(nodeParent, selectedNode);
				//	Actually, let's not do this for now...
				//	let's have arrows just work inside parnet.
				//	you have to hit left/right arrow to move to another level
//			}
		} else if (dirKey === rat.keys.downArrow)
		{
			//	Move down visually.
			//	Trickier.  If I'm not the last in a child list, then reorder me in my parent.
			//	If I'm the last in a child list, then remove me from parent and put me after parent in gparent's children.
			var sibIndex = this.getChildIndex(nodeParent, selectedNode);
			if (sibIndex < nodeParent.children.length-1)
			{
				this.removeChildFrom(nodeParent, selectedNode);
				this.addChildTo(nodeParent, selectedNode, sibIndex+1);
				treeChanged = true;
			}
//			else if (gparent) {
//				//	todo, but maybe.  see above.
//			}
		}
			
		if (treeChanged)
		{
			//	this is a heavy version - completely replace all contents.
			//	Lots of stuff like selection will be broken in that case.  :(
			//	including input order, tab order, etc.
			//	It'll be a lot more work, but can we please just move ui elements around explicitly,
			//	instead of rebuilding?
			this.setTreeValues(this.tree);
			
			//	reselect the one that was selected before
			this.selectNodeByID(selectedNode._treeView.treeNodeID);
			
			if (this.changeCallback)
				this.changeCallback(this, this.tree, '');
			
			return true;
		}
		return false;
	};
	
	//	draw frame to help indicate state?
	//	(e.g. we are targeted, keystrokes will go to us)
	rat.ui.TreeView.prototype.drawFrame = function(ctx)
	{
		/*
		var frameLook = this.editFrameLook;
		ctx.lineWidth = frameLook.lineWidth;
		
		var outset = 0;
		
		var targeted = (this.flags & rat.ui.Element.targetedFlag) !== 0;
		var highlighted = (this.flags & rat.ui.Element.enabledFlag) && (this.flags & rat.ui.Element.highlightedFlag);
		
		if (highlighted)
			ctx.strokeStyle = frameLook.highlightColor.toString();
		else if (targeted)
			ctx.strokeStyle = frameLook.targetColor.toString();
		else
			ctx.strokeStyle = frameLook.normalColor.toString();
		
		//	still feeling this out.  Feel free to change it.
		if (highlighted || targeted)
		{
			ctx.lineWidth = frameLook.lineWidth + 1;
			outset = 1;
		}
		
		//	draw frame		
		ctx.strokeRect(-this.center.x - outset, -this.center.y - outset,
					this.size.x + 2 * outset, this.size.y + 2 * outset);
		*/
	};
	
	//	override draw to draw carat and selection, etc.
	rat.ui.TreeView.prototype.drawSelf = function()
	{
		var ctx = rat.graphics.getContext();
		
		//	draw a background		
		//ctx.fillStyle = this.editBodyLook.normalColor.toString();
		//ctx.fillRect(-this.center.x, -this.center.y, this.size.x, this.size.y);
		
		//	draw a frame to indicate state?
		//	maybe more appropriate for a scrollview containing us?
		//this.drawFrame(ctx);
		
	};
	
	rat.ui.TreeView.prototype.updateSelf = function(dt)
	{
		
	};
	
	//	handle keys
	//	This is a hacky way to control hierarchy.
	//	Long-term, we'll certainly support mouse control,
	//	and this stuff could be cleaned up and optional.
	rat.ui.TreeView.prototype.keyDown = function(ratEvent)
	{
		var which = ratEvent.which;
		
		//if (ratEvent.which === rat.keys.esc)
		//{
		//	//return true;
		//}
		//else if (ratEvent.which === rat.keys.enter)
		//{
		//	//return false;
		//}
		
		var selectedNode = this.getSelectedNode();
		
		//	non-meta key means move selection.
		if (!ratEvent.sysEvent.altKey && selectedNode)
		{
			var index = selectedNode._treeView.treeIndex;

			if (ratEvent.which === rat.keys.upArrow && index > 0)
			{
				this.selectNodeByIndex(index-1);
				return true;
			} else if (ratEvent.which === rat.keys.downArrow && index < this.elemCount-1) {
				this.selectNodeByIndex(index+1);
				return true;
			}
			//	todo: return true even if they hit up/down on top/bottom element?
			//	right now, it'll move out of the tree if there's an input map...
			//	I could see either reaction being legit.
		}
		
		//	meta key means move this node around, using various (experimental) rules
		//	report any meta key arrow as handled, since normally we handle them,
		//	and we don't want to sometimes return handled and sometimes not.
		var wasMetaKeyArrow = false;
		
		if (rat.input.keyToDirection(ratEvent.which) && ratEvent.sysEvent.altKey)
		{
			this.moveNode(selectedNode, ratEvent.which);
			wasMetaKeyArrow = true;
		}
		
		if (wasMetaKeyArrow)
			return true;
		
		return false;
	};
	
	//	mouse down - start tracking some stuff?
	rat.ui.TreeView.prototype.mouseDown = function(pos, ratEvent)
	{
		//	call inherited to get correct flags cleared/set
		return rat.ui.TreeView.prototype.parentPrototype.mouseDown.call(this, pos, ratEvent);
		
		//	also, we should become target now.  Is that already handled?
		
		//return true;
	};
	
	rat.ui.TreeView.prototype.mouseUp = function(pos, ratEvent)
	{
		//	call inherited to get correct flags cleared/set
		return rat.ui.TreeView.prototype.parentPrototype.mouseUp.call(this, pos, ratEvent);
		
		//return false;
	};
	
	//	track mouse movement for drags
	rat.ui.TreeView.prototype.mouseMove = function(pos, ratEvent)
	{
		//	note that we don't care if cursor is really in our bounds.
		//	It's OK to drag outside our space, as long as it was all
		//	from a click that started in our space.
		/*
		if (this.trackingClick)
		{
			return true;
		}
		return false;
		*/
	};
	
	//	for keyboard/controller support, also go active on trigger (action button) if not already active?
	rat.ui.TreeView.prototype.trigger = function()
	{
		return rat.ui.TreeView.prototype.parentPrototype.trigger.call(this); //	inherited trigger
	};
	
	// Support for creation from data
	rat.ui.TreeView.setupFromData = function(pane, data, parentBounds)
	{
		rat.ui.data.callParentSetupFromData( rat.ui.TreeView, pane, data, parentBounds );
	};
});