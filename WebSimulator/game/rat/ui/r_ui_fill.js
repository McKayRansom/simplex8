
//
//	Basic elements for all fills
//
rat.modules.add( "rat.ui.r_ui_fill",
[
	{name: "rat.utils.r_utils", processBefore: true },
	{name: "rat.ui.r_ui", processBefore: true },
	"rat.ui.r_ui_data",
], 
function(rat)
{
	/**
	 * @constructor
	 * @extends rat.ui.Element
	*/
	rat.ui.Fill = function ()
	{
		rat.ui.Fill.prototype.parentConstructor.call(this); //	default init
		this.fillCur = 5;
		this.fillTotal = 10;
		this.percent = 0.5;
		this.allowOverFill = false;
		this.allowUnderFill = false;
		this.fillStyle = 'stroke';	///< Currently supports radialStroke, radialFill, stroke, fill
		this.fillShape = 'circle';		///< Currently supports circle or rectangle
		this.lineWidth = 1; /// When using stroke styles
		this.setTracksMouse(false);	//	no mouse tracking, highlight, tooltip, etc. including subelements.
	};
	rat.utils.inheritClassFrom(rat.ui.Fill, rat.ui.Element);
	rat.ui.Fill.prototype.elementType = "fill";
	
	///	Set the fill
	rat.ui.Fill.prototype.setFill = function (cur, total)
	{
		if (this.fillCur !== cur || (total !== void 0 && this.fillTotal !== total) )
		{
			this.fillCur = cur;
			if(total !== void 0)
				this.fillTotal = total;
				
			if (!this.allowUnderFill && this.fillCur < 0)
				this.fillCur = 0;
			if (!this.allowOverFill && this.fillCur > this.fillTotal)
				this.fillCur = this.fillTotal;
			this.percent = this.fillCur/this.fillTotal;
			this.setDirty(true);
		}
	};

	// Support for creation from data
	//
	//maxFill,
	//currentFill,
	//allowOverFill,
	//allowUnderFill,
	//fillStyle,
	//fillShape,
	//lineWidth
	//}
	//
	rat.ui.Fill.setupFromData = function (pane, data, parentBounds)
	{
		rat.ui.data.callParentSetupFromData(rat.ui.Fill, pane, data, parentBounds);
		if (data.allowOverFill)
			pane.allowOverFill = data.allowOverFill;
		if (data.allowUnderFill)
			pane.allowUnderFill = data.allowUnderFill;
		pane.setFill(data.currentFill || 0, data.maxFill);
		pane.fillStyle = data.fillStyle || pane.fillStyle;
		pane.fillShape = data.fillShape || pane.fillShape;
		if (data.lineWidth !== void 0)
			pane.lineWidth = data.lineWidth;
	};
	
});