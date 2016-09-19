//
//	Input map class for handling on-screen buttons (and other targetable enabled interactive ui elements)
//
//  To use this mapping, whatever button class you use simply needs to implement an interface that allows the following functions:
//      Press() - button got pressed (user hit enter)
//      Focus() - button is now the target.  returns boolean as to whether it succeeded or not
//      Blur() -- button is no longer the target.
//
//  Also each entry in the inputMap needs to include a reference to that button object itself. I named this 'currObj'
//
//  Example code for creating a mapping:
//
//  // there are two buttons 'back', and 'ads'
//  var buttonBack = { currObj: this.backButton, down: this.adsButton, right: this.adsButton }
//  var buttonAds = { currObj: this.adsButton, up: this.backButton, left: this.backButton }
//  var map = [buttonBack, buttonAds]
//
//  You can auto-build inputmaps for a screen by using the functions in the rat.Screen class.
//
//	TODO - really nothing external should know about the index,
//		so the 'startIndex' should probably be changed in the future to 'startButton'
//			and have it save the index based on the object it finds.
//		Maybe remove the concept of a current index entirely.
//			If we need to support multi-target systems (e.g. multiple controllers, like Wraith does),
//			it'll all have to change anyway, and a cTargets system like Wraith might be more flexible.
//	TODO:  rename press/focus/blur functions to not have capital names.
//	TODO:  Not everything in an input map has to be a "button"
//	TODO:  Tab and shift-tab support
//	TODO:  Automated building of inputMaps based on contents of a screen
//	TODO:  non-buttons!  checkboxes, editboxes, etc.
//			rename everything to "elements" instead of buttons.
//

//------------ rat.InputMap ----------------
rat.modules.add( "rat.input.r_inputmap",
[
	"rat.input.r_input"
], 
function(rat)
{
	/**
	 * @constructor
	 */
	rat.InputMap = function (map, startIndex) {
		this.events = {};
		this.map = map;

		if ((!startIndex || startIndex === 0) && this.checkBounds(startIndex) && this.map[startIndex]) {
			this.defaultIndex = startIndex;
			this.index = startIndex;
		}
		else {
			this.defaultIndex = -1;
			this.index = -1;
		}

		this.validateMap();

		if (this.index >= 0)
			this.focusButton(this.index, true);
	};

	///	Set the on change event callback
	rat.InputMap.prototype.setOnChange = function (cb) {
		this.events.onChange = cb;
	};

	//	run through input map we were given, and fix up any problems.
	//	Why?  To make defining input maps easier and less error prone.
	//	For instance, we might define an input map that refers to a button that may or may not be there.
	//	Instead of having complex input map creation logic, we'll just leave all our up/down/left/right references,
	//	but just not include it in the map, and fix that here.
	//	This would be less necessary if we used automated input map generation more often.
	rat.InputMap.prototype.validateMap = function()
	{
		var dIndex;
		for (var i = 0; i < this.map.length; ++i)
		{
			var curEntry = this.map[i];
			var directions = ["up", "left", "right", "down", "select"];
			for (dIndex = 0; dIndex < directions.length; dIndex++)
			{
				var target = curEntry[directions[dIndex]];	//	TODO: this (and similar index-by-name code below) will fail with closure compiler)
				if (target)
				{
					var found = null;
					for (var tIndex = 0; tIndex < this.map.length; ++tIndex)
					{
						if (this.map[tIndex].currObj === target)
							found = target;
					}
					if (!found)
						curEntry[directions[dIndex]] = null;	//	clear that bogus reference out
				}
			}	//	end of direction loop
		}
	};

	rat.InputMap.prototype.handleKeyDown = function (keyCode) {
		var direction;
		// may also add directions for controller inputs?

		switch (keyCode) {
			case rat.keys.leftArrow:
				direction = "left";
				break;
			case rat.keys.upArrow:
				direction = "up";
				break;
			case rat.keys.rightArrow:
				direction = "right";
				break;
			case rat.keys.downArrow:
				direction = "down";
				break;
			case rat.keys.enter:
				direction = "select";
				break;
			default:
				return;
		}

		return this.handleDirection(direction);
	};

	//	Handle direction input - navigate through targetable elements
	rat.InputMap.prototype.handleDirection = function (direction) {
		if (this.checkBounds(this.index)) {
			var currentButton = this.map[this.index];

			if (direction === "select")
				this.doPress(this.map[this.index].currObj);
			else if (currentButton && currentButton[direction] && currentButton.currObj !== currentButton[direction]) {
				// blur current button so we can change the index
				//var oldIndex = this.index
				var newIndex;
				// get handle to new button
				var newfocus = currentButton[direction];
				// find index for new handle
				for (var i = 0; i < this.map.length; ++i) {
					if(this.map[i].currObj === newfocus)
						newIndex = i;
				}
				this.focusButton(newIndex);
				return true;
			}
			else if (currentButton)
			{
				// wasn't a direction to go to, rehighlight self
				//	But tell the button about the direction
				this.doFocus(currentButton.currObj);
				if (currentButton.currObj.handleDirection)
				{
					if (currentButton.currObj.handleDirection(direction))
						return true;
				}
			}
		}
		else if (this.index === -1)   // was currently not a valid index
		{
			// then set the index to default
			if(this.defaultIndex === -1 && this.map.length > 0)
				this.index = 0;
			else if(this.checkBounds(this.defaultIndex))
				this.index = this.defaultIndex;

			if (this.checkBounds(this.index))
			{
				this.doFocus(this.map[this.index].currObj);
				return true;
			}
		}

		return false;
	};
	
	//	Handle direction input - tab or reverse-tab through targetable elements
	rat.InputMap.prototype.handleTab = function (event) {
		
		var delta = 1;
		if (event.sysEvent.shiftKey)
			delta = -1;
		
		if (this.checkBounds(this.index)) {
			var currentButton = this.map[this.index];
			
			var newIndex = 0;
			
			if (currentButton.tabOrder !== void 0)
			{
				newOrder = currentButton.tabOrder + delta;
				//	wrap
				if (newOrder < 0)
					newOrder = this.map.length-1;
				else if (newOrder > this.map.length-1)
					newOrder = 0;
				
				//	find the entry with that desired tab order
				for (var i = 0; i < this.map.length; ++i) {
					if (this.map[i].tabOrder === newOrder)
					{
						newIndex = i;
						break;
					}
				}
			}
			else
			{
				newIndex = this.index + delta;
				//	wrap
				if (newIndex < 0)
					newIndex = this.map.length-1;
				else if (newIndex > this.map.length-1)
					newIndex = 0;
			}
			
			this.focusButton(newIndex);
			
			if (this.index === newIndex)	//	success?
			{
				var elem = this.map[newIndex].currObj;
				if (elem.handleTabbedTo)
					elem.handleTabbedTo(event);	//	let some elements handle this more specifically
			}

			return true;
		}
		
		return false;
	};

	//	wrapper for setting button focus
	//	currently, helps us use new function names,
	//	but could also be used later to do fancier focus handling with target system
	rat.InputMap.prototype.doFocus = function(button)
	{
		if (button.Focus)
			return button.Focus();
		else if (button.focus)
			return button.focus();
		else
			return false;
	};

	//	wrapper for setting button blue
	//	currently, helps us use new function names,
	//	but could also be used later to do fancier focus handling with target system
	rat.InputMap.prototype.doBlur = function(button)
	{
		if (button.Blur)
			return button.Blur();
		else if (button.blur)
			return button.blur();
		else
			return false;
	};

	//	wrapper for setting button pressing
	//	currently, helps us use new function names,
	//	but could also be used later to do fancier focus handling with target system
	rat.InputMap.prototype.doPress = function(button)
	{
		if (button.Press)
			return button.Press();
		else if (button.press)
			return button.press();
		else
			return false;
	};
	
	rat.InputMap.prototype.getButtonCount = function () {
		return this.map.length;
	};

	rat.InputMap.prototype.getButton = function (index) {
		if (this.checkBounds(index))
			return this.map[index].currObj;
		return null;
	};

	rat.InputMap.prototype.getCurrIndexButton = function ()
	{
		if(this.checkBounds(this.index))
			return this.map[this.index].currObj;
		return null;
	};
	//	a slightly more consistent name for that...
	rat.InputMap.prototype.getCurrentFocusedButton = rat.InputMap.prototype.getCurrIndexButton;
	//	an even better name.  :)
	rat.InputMap.prototype.getTarget = rat.InputMap.prototype.getCurrIndexButton;
	
	//	return the current target element.
	//	The reason we take ratEvent as an argument here is so we can do things like support multiple targets,
	//	or check what kind of event it is and filter out some possible targets?
	rat.InputMap.prototype.getTargetForEvent = function(ratEvent)
	{
		return this.getTarget();
	};

	//	get the index for this button.
	//	if not found, return null (which is weird?)
	rat.InputMap.prototype.getIndexByButton = function (button) {
		for (var i = 0; i < this.map.length; ++i) {
			if (this.map[i].currObj === button)
				return i;
		}
		return null;
	};

	//
	//	Focus on this button by index.
	//	"force" is a way to force the new button to get a focus() call, even if it's already the currrent.
	//	Also blur the old button
	/** 
	 * @param {number|undefined} index
	 * @param {boolean=} force
	 */
	rat.InputMap.prototype.focusButton = function (index, force) {
		var oldIndex = this.index;

		if (index === this.index)   //  already at this index
		{
			if (force)  //  but support forcing anyway
				oldIndex = -1;  //  in which case don't blur!
			else
				return;
		}

		if (this.checkBounds(index) && this.map[index]) {
			if (this.doFocus(this.map[index].currObj))
			{
				//  blur old button
				if (this.checkBounds(oldIndex) && this.map[oldIndex])
					this.doBlur(this.map[oldIndex].currObj);
			}
			this.index = index;

			if (this.events.onChange)
				this.events.onChange(this.map[index].currObj, this.map[oldIndex] ? this.map[oldIndex].currObj : void 0);
		}
	};
	
	//
	//	Focus on this button by button reference.
	//	"FocusByIndex" would be a better name for the above function.
	//
	rat.InputMap.prototype.focusByButton = function (button, force) {
		var index = this.getIndexByButton(button);
		if (typeof(index) === null)
			return;
		this.focusButton(index, force);
	};

	rat.InputMap.prototype.clearIndex = function ()
	{
		this.index = -1;
	};

	rat.InputMap.prototype.reset = function ()
	{
		if(this.index !== this.defaultIndex)
		{
			if(this.checkBounds(this.index))
				this.doBlur(this.map[this.index].currObj);
			if(this.checkBounds(this.defaultIndex))
				this.doFocus(this.map[this.defaultIndex].currObj);

			this.index = this.defaultIndex;
		}
	};

	rat.InputMap.prototype.checkBounds = function (index)
	{
		if(index >= 0 && index < this.map.length)
			return true;
		return false;
	};
	
	//	debug - dump list of elements we've collected
	rat.InputMap.prototype.dumpList = function (index)
	{
		rat.console.log("inputmap: " + this.map.length + " elements:");
		for (var i = 0; i < this.map.length; ++i)
		{
			var curEntry = this.map[i];
			var elem = curEntry.currObj;
			var name = elem.name || "(no name)";
			var type = "type: " + (elem.elementType || "?");
			rat.console.log("" + i + " : " + name + " " + type);
		}
	};
} );