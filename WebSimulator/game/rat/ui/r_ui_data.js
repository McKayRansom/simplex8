//
//	Support for creating UI elements from data
//
//
/*
	Usage:
	
	AS TREE (a top-level node, with hierarchy under that)
		
		Use createTreeFromData() inside a screen constructor,
		like this:
		
		screen.setSize(rat.graphics.SCREEN_WIDTH, rat.graphics.SCREEN_HEIGHT);	//	or whatever
		screen.setPos(0, 0);	//	or whatever
		var panes = rat.ui.data.createTreeFromData({
			... top level node with subnodes
		}
		, screen.getBounds());
		screen.appendSubElement(panes);
		
		the format of the data is hierarchical,
		with each entry having a "children" array of subelements.
		
		The above usage assumes a top-level node that contains everything else.
	
	AS ARRAY (a list of panes, with hierarchy under those)
	
		Alternatively, you can use an array without a top-level node, like this:
		
		rat.ui.data.createChildrenFromData(screen, [
			... array of nodes with subnodes
		]);
		
		This might be simpler.
		
*/
		
rat.modules.add( "rat.ui.r_ui_data",
[
	{name: "rat.utils.r_utils", processBefore: true },
	{name: "rat.ui.r_ui", processBefore: true },
	
	"rat.debug.r_console",
	"rat.utils.r_shapes",
], 
function(rat)
{
	//	Namespace for all of this functionality
	rat.ui.data = {};
	
	rat.ui.data.inDesignTime = false;	//	set this flag to allow designTimeOnly panes to be created!

	function calcSizeFromFlags(val, parent)
	{
		if (val.val !== void 0)
		{
			if (val.percent)
				val.val *= parent;
			if (val.fromParent)
				val.val += parent;
			val = val.val;
		}
		return val;
	}

	/** @suppress {missingProperties} */
	function calcPosFromFlags(val, parentSize, mySize)
	{
		if (val.val === void 0)
			val = { val: val };

		{
			//	Percentage of parent size
			if (val.percent)
				val.val *= parentSize;

			//	From the center of the parent
			if (val.fromCenter)
				val.val += (parentSize / 2);
				//	From the edge of the parent
			else if (val.fromParentEdge || val.fromParentFarEdge)
				val.val = parentSize - val.val;

			//	centered (not the same as setting center values, see elsewhere)
			if (val.centered || val.drawCentered || val.center)
				val.val -= mySize / 2;
			else if (val.fromMyEdge || val.fromMyFarEdge)
				val.val -= mySize;
			val = val.val;
		}
		return val;
	}

	// Calculate bounds based on flags, data, and parent bounds
	//	Supported flags
	//	noChange
	//	autoFill
	//	Per size field flags
	//		percent
	//		fromParent
	//	Per pos field flags
	//		percent
	//		center
	rat.ui.data.calcBounds = function (data, parentBounds)
	{
		var bounds = rat.utils.copyObject(data.bounds || {}, true);
		bounds.x = bounds.x || 0;
		bounds.y = bounds.y || 0;
		bounds.w = bounds.w || 0;
		bounds.h = bounds.h || 0;


		//	No change flag set
		if (bounds.noChange)
		{
			if (bounds.x.val !== void 0)
				bounds.x.val = bounds.x.val;
			if (bounds.y.val !== void 0)
				bounds.y.val = bounds.y.val;
			if (bounds.w.val !== void 0)
				bounds.w.val = bounds.w.val;
			if (bounds.h.val !== void 0)
				bounds.h.val = bounds.h.val;
			return bounds;
		}

		//	Auto fill always auto-fills
		if (bounds.autoFill)
			return { x: 0, y: 0, w: parentBounds.w, h: parentBounds.h };

		//	Find the size I will be.
		bounds.w = calcSizeFromFlags(bounds.w, parentBounds.w);
		bounds.h = calcSizeFromFlags(bounds.h, parentBounds.h);
		bounds.x = calcPosFromFlags(bounds.x, parentBounds.w, bounds.w);
		bounds.y = calcPosFromFlags(bounds.y, parentBounds.h, bounds.h);
		
		return bounds;
	};
	
	//	Given a data type code,
	//	figure out what constructor class to use, and what setupFromData function.
	//	This is intented to be flexible and easy - if something is missing, figure out a decent substitute,
	//	like parent class, or Element class.
	rat.ui.data.getSetupCallsForType = function( dataType )
	{
		var paneType = dataType;
		if (paneType === "Container")
			paneType = "Element";
		if( !rat.ui[paneType] )
		{
			rat.console.log( "WARNING! Unknown pane type '" + paneType + "' hit in createPaneFromData.  Falling back to Element." );
			paneType = "Element";
		}
		
		//	Find the create function, falling back to parent types if we need to.
		var elementClass = rat.ui[paneType];
		//	If we did not find anything, then use the the Element one as we know that it does (or atleast should) exist
		if (!elementClass)
		{
			rat.console.log("WARNING! Unable to find createFromData for element of type " + paneType + ".  Reverting to rat.ui.Element.createFromData");
			elementClass = rat.ui.Element;
		}

		//	get the setupFromData func
		var setupClass = elementClass;
		while (setupClass && !setupClass.setupFromData)
		{
			if (setupClass.prototype)
				setupClass = setupClass.prototype.parentConstructor;
			else
				setupClass = void 0;
		}
			
		//	If we did not find anything, then use the the Element one as we know that it does (or atleast should) exist
		if (!setupClass)
		{
			rat.console.log( "WARNING! Unable to find createFromData for element of type "+paneType+".  Reverting to rat.ui.Element.createFromData" );
			setupClass = rat.ui.Element;
		}
		
		return {paneType:paneType, elementClass:elementClass, setupClass:setupClass};
	};

	//	Create any pane from data
	//	It's possible for this to return null, if the data was explicitly marked as being not constructable...
	rat.ui.data.createPaneFromData = function( data, parent )
	{
		if (data._editor && data._editor.designTimeOnly)
			return null;
		
		var parentBounds;
		if( parent )
			parentBounds = parent.getBounds();
		else
			parentBounds = {x: 0, y:0, w:0, h:0};

		//	find constructor and setup functions
		var setups = rat.ui.data.getSetupCallsForType(data.type);
		
		//	Create it.
		var pane = new setups.elementClass();
		if (setups.setupClass.setupFromData)
			setups.setupClass.setupFromData(pane, data, parentBounds);

		//	Now create its children
		rat.ui.data.createChildrenFromData(pane, data.children);

		//	Call any onCreate callback
		if (data.onCreate)
			data.onCreate(pane);
		return pane;
	};

	/// Create the children of an element
	rat.ui.data.createChildrenFromData = function (parent, children)
	{
		if (!parent)
			return;
		if (!children)
			return;
		for (var index = 0; index !== children.length; ++index)
		{
			var pane = rat.ui.data.createPaneFromData(children[index], parent);
			if (pane)
				parent.appendSubElement(pane);
		}
	};

	// Call setupFromData on this type's parent type
	//	(so we can walk up the inheritance tree properly setting up all properties)
	rat.ui.data.callParentSetupFromData = function (type, pane, data, parentBounds)
	{
		var setupClass = type;
		do
		{
			if (setupClass)
			{
				if (setupClass.prototype)
					setupClass = setupClass.prototype.parentConstructor;
				else
					setupClass = void 0;
			}
		} while (setupClass && !setupClass.setupFromData);

		//	If we did not find anything there is nothing else to call
		if (!setupClass)
			return;
		setupClass.setupFromData(pane, data, parentBounds);
	};
	
	//	A function that will create a given graphical structure from "JSON" data
	//	Note that in some cases, we may violate the strict JSON structure by allowing functions 
	/**
	 * @param {Object} data
	 * @param {Object=} bounds
	 */
	rat.ui.data.createTreeFromData = function (data, bounds)
	{
		//	Create the root pane
		var parent = {
			getBounds: function(){
				if (bounds)
					return bounds;
				else
					return new rat.shapes.Rect(0, 0, rat.graphics.SCREEN_WIDTH, rat.graphics.SCREEN_HEIGHT);
			}
		};
		return rat.ui.data.createPaneFromData(data, parent);
	};
} );