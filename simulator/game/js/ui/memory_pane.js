//
//	Memory value display pane
//
//	this is implemented as a rat subpane so we can use offscreen rendering for speed.
//

/**
 * @constructor for game screen
 * @extends rat.ui.Element
*/
rat.modules.add( "js.ui.memory_pane",
[
	{name: "rat.ui.r_screen", processBefore: true },	//	we inherit from, so process first.
	"js.ui.ui",	//	we use functions and data here
],
function(rat)
{
	var MemoryPane = function(parent)
	{
		MemoryPane.prototype.parentConstructor.call(this, parent); //	default init
		
		//	set up this pane
		var pane = this;
		
		this.memoryOffset = 0;	//	todo: support changing this through UI. :)
		this.showX = 16;
		this.showY = 4;
		this.showSize = this.showX * this.showY;
		
		this.prevData = new Array(this.showSize);
		for (var i = 0; i < this.showSize; i++)
		{
			this.prevData[i] = {changed:false, val:0};
		}
	};
	(function(){ rat.utils.inheritClassFrom( MemoryPane, rat.ui.Element ); })();

	//	update me occasionally.
	//	This is a chance to (1) see if memory changed, and (2) mark myself dirty, if so.
	MemoryPane.prototype.updateSelf = function(dt)
	{
		var isDirty = false;
		var memory = game.simulation.memory;
		for (var i = 0; i < this.showSize; i++)
		{
			newVal = memory[this.memoryOffset + i];
			if (this.prevData[i].val !== newVal)
			{
				this.prevData[i].val = newVal;
				this.prevData[i].changed = true;
				isDirty = true;
			} else {
				this.prevData[i].changed = false;
			}
		}
		if (isDirty)
		{
			//console.log("memory changed");
			this.setDirty(true);
		}
	};
	
	MemoryPane.prototype.drawSelf = function()
	{
		var ctx = rat.graphics.getContext();
		
		var w = this.getWidth();
		var h = this.getHeight();
		ctx.fillStyle = "#401040";
		ctx.fillRect(0, 0, w, h);
		
		
		var memory = game.simulation.memory;
		var localOffset = 0;
		ctx.font = "bold 48px courier new";
		
		var rowHeight = 56;
		var oneWidth = 70;
		var yPos = 60;
		for (var yIndex = 0; yIndex < this.showY; yIndex++)
		{
			ctx.fillStyle = "#E0E0E0";
			var addrText = "" + (this.memoryOffset + localOffset);
			while (addrText.length < 3)
				addrText = "0" + addrText;
			ctx.fillText(addrText + ":", 10, yPos);
			
			var xPos = 160;
			for (var xIndex = 0; xIndex < this.showX; xIndex++)
			{
				if (this.prevData[localOffset].changed)
					ctx.fillStyle = "#FFFF00";
				else
					ctx.fillStyle = "#E0E0E0";
				var val = memory[this.memoryOffset + localOffset];
				var vText = val.toString(16);
				if (val < 16)
					vText = "0" + vText;
				ctx.fillText(vText, xPos, yPos);
				localOffset++;
				xPos += oneWidth;
			}
			yPos += rowHeight;
		}
	};

	app.types.MemoryPane = MemoryPane;	//	global access to this class for my convenience
});
