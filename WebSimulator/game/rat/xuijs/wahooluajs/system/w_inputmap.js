//
//	generated js from lua file and hand-edited
//
rat.modules.add( "rat.xuijs.wahooluajs.system.w_inputmap",
[
	{name: "rat.xuijs.wahooluajs.wahoolua", processBefore: true },
	
	"rat.xuijs.wahooluajs.graphics.w_button",
	"rat.xuijs.wahooluajs.system.w_stdutils",
], 
function(rat)
{
	//	constructor
	var WInputMap = function(map, refScene, snapStates) {
		this.buttons = []
		this.map = []
	
		this.index = map.defaultIndex || 0
		//	maps in screens are weird.  They're sort of arrays and objects.
		//	so I'm handling them carefully here...
		//	Also, important note:  We're using a zero-based list of buttons here!
		//	This has a bunch of implications, including that screens need to define their button maps that way.
		//	And it had subtle effects on the code below, e.g. a map of "0" is not the same as a map of undefined.
		
		var i = 0;
		for (var key in map)
		{
			if (key === "defaultIndex")	//	special value, not a normal entry.
				continue;
				
			var ButtonType = map[key].buttonType || WButton
			var asset = map[key].asset || ButtonType.asset
	
			var state = "blur"
			if ( this.index == i ) {
				state = "focus"
			}
			
			var buttonScene = refScene[map[key].refScene];
			if ( (! buttonScene) ) {
				wahoolua.WStdUtils.printf("** ERROR:  Button scene "+map[key].refScene+" is missing!");
			}
			
			this.buttons[i] = new ButtonType(buttonScene, asset, state)
			
			this.buttons[i].action = map[key].action || false
			this.buttons[i].actionParam = map[key].actionParam || null;
			this.buttons[i].actionArgs = map[key].actionArgs || {};
			this.buttons[i].indexInButtonMap = i;
			this.map[i] = {
				up: map[key].up,
				left: map[key].left,
				down: map[key].down,
				right: map[key].right
			}
			
			i++;
		}
	}
	
	WInputMap.prototype.Dtor = function() {
		for (var i=0; i < this.buttons.length; i++)
		{
			if ( this.buttons[i] ) {
				this.buttons[i].Dtor()
			}
		}
	}
	
	WInputMap.prototype.HandleKeyDown = function(keyCode) {
		var direction = wahoolua.WStdUtils.GetDirection(keyCode)
		
		// PMM - think this goes here... we have a system setup for autohandling focus/blue animations as well as pressing the button, but the pressing part wasnt hooked up
		if ( keyCode == "VK_PAD_A" || keyCode == "VK_PAD_START" ) {
			this.Press()
		}
		
		return this.HandleDirection(direction)
	}
	
	WInputMap.prototype.HandleDirection = function(direction) {
		var handled = false;
		if ( this.index >= 0 && this.index < this.buttons.length) {
			var currentButton = this.buttons[this.index]
			
			// PMM disabled these if there is not a map for them - we were getting animations for directions that didnt exist
			if ( direction == "up" && this.map[this.index].up !== void 0 ) {
				currentButton.Up()
				handled = true;
			}
			else if ( direction == "left" && this.map[this.index].left !== void 0 ) {
				currentButton.Left()
				handled = true;
			}
			else if ( direction == "down" && this.map[this.index].down !== void 0 ) {
				currentButton.Down()
				handled = true;
			}
			else if ( direction == "right" && this.map[this.index].right !== void 0 ) {
				currentButton.Right()
				handled = true;
			}
			
			if ( this.map[this.index] ) {
				handled = this.HandleTransition(this.map[this.index], direction)
			}
		}
		return handled;
	}
	
	WInputMap.prototype.HandleTransition = function(map, direction) {
		if ( map[direction] !== void 0 && map[direction] >= 0 ) {
			//local currentButton = this.buttons[this.index]
			//currentButton.Blur()
			
			//this.index = map[direction]
			//currentButton = this.buttons[this.index]
			//currentButton.Focus()
			this.FocusButton(map[direction])
			return true;
		}
		
		return false;
	}
	
	WInputMap.prototype.GetFocusedButtonIndex = function() {
		if (this.index !== void 0)
			return this.index;
		else
			return false;
	}
	
	WInputMap.prototype.GetButton = function(index) {
		if (index === void 0)
			index = this.GetFocusedButtonIndex()
		return this.buttons[index]
	}
	
	WInputMap.prototype.Press = function(index) {
		if (index === void 0)
			index = this.GetFocusedButtonIndex()
		if ( this.buttons[index] && this.buttons[index].Press ) {
			this.buttons[index].Press()
		}
	}
	
	WInputMap.prototype.FocusButton = function(idx) {
		//if ( this.buttons[idx].IsEnabled() ) {
			var currentButton = this.buttons[this.index]
			currentButton.Blur()
			
			this.index = idx
			currentButton = this.buttons[this.index]
			currentButton.Focus()
		//}
	}	
	
	wahoolua.WInputMap = WInputMap;
	
} );
