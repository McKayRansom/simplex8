
//----------------------------
//	shape Element
//	uses built-in shape drawing system
//
//	TODO:  Offscreen and Dirty support
//
rat.modules.add( "rat.ui.r_ui_shape",
[
	{name: "rat.ui.r_ui", processBefore: true },
	{name: "rat.utils.r_utils", processBefore: true },
	"rat.debug.r_console",
	"rat.ui.r_ui_data",
	"rat.graphics.r_graphics",
	"rat.math.r_math",
], 
function(rat)
{
	/**
	 * @constructor
	 * @extends rat.ui.Element
	 * @param {Object} shapeType (one of rat.ui.noShape, rat.ui.circleShape, rat.ui.squareShape, or rat.ui.pathShape)
	*/
	rat.ui.Shape = function (arg1, arg2)
	{
		var parentPane = arg1;
		var shapeType = arg2;
		if (typeof(arg1) === 'number')
		{
			parentPane = null;
			shapeType = arg1;
		}
		
		rat.ui.Shape.prototype.parentConstructor.call(this, parentPane); //	default init
		//	for now, we're going to put all shape types in a single Element class rather than make
		//	a bunch of classes.
		if(shapeType === void 0)
			this.shapeType = rat.ui.circleShape;
		else
			this.shapeType = shapeType;
		//	shapes are often used as containers, so don't turn off mouse tracking
		
		this.cornerRadius = 5;	//	client will presumably change this.
		
		this.strokeWidth = -1;
		this.strokeColor = null;
	};
	rat.utils.inheritClassFrom(rat.ui.Shape, rat.ui.Element);
	rat.ui.Shape.prototype.elementType = 'shape';

	rat.ui.noShape = 0;
	rat.ui.circleShape = 1;
	rat.ui.squareShape = 2;
	rat.ui.roundRectShape = 3;
	rat.ui.pathShape = 4;
	
	rat.ui.Shape.prototype.setShapeType = function (arg)
	{
		if (arg != this.shapeType)
			this.setDirty(true);
		
		this.shapeType = arg;
	};
	rat.ui.Shape.prototype.setCornerRadius = function (arg)
	{
		if (arg < 0)	//	negative corner radius not OK
			arg = 0;
		if (arg != this.cornerRadius)
			this.setDirty(true);
		
		this.cornerRadius = arg;
	};
	
	rat.ui.Shape.prototype.setStroke = function (width, color)
	{
		if (width !== this.strokeWidth || color != this.strokeColor)
			this.setDirty(true);

		this.strokeWidth = width;
		this.strokeColor = color;
	};
	
	rat.ui.Shape.prototype.drawSelf = function ()
	{
		//this.prototype.parentClass.prototype.drawSelf.call or whatever();	//	inherited draw self, if it were needed...
		var ctx = rat.graphics.getContext();
		
		//	define proper ctx path
		if (this.shapeType === rat.ui.circleShape)
		{
			ctx.beginPath();
			var radius = rat.math.min(this.size.x, this.size.y)/2;
			
			var cx = this.size.x/2 - this.center.x;
			var cy = this.size.y/2 - this.center.y;
			ctx.arc(cx, cy, radius, 0, Math.PI * 2, true);
			
			ctx.closePath();
				
		} else if (this.shapeType === rat.ui.squareShape)
		{
			ctx.beginPath();
			ctx.rect(0 - this.center.x, 0 - this.center.y, this.size.x, this.size.y);
			ctx.closePath();
			
		} else if (this.shapeType === rat.ui.roundRectShape)
		{
			rat.graphics.roundRect(
				{x : 0-this.center.x, y : 0-this.center.y, w : this.size.x, h : this.size.y},
				this.cornerRadius
			);
			
		} else
		{
			//	todo: path - maybe with anon function set from outside?
			return;
		}
		
		//	then fill
		ctx.fillStyle = this.color.toString();
		ctx.fill();
		
		//	and optionally stroke
		if (this.strokeWidth && this.strokeColor)
		{
			ctx.lineWidth = this.strokeWidth;
			ctx.strokeStyle = this.strokeColor.toString();
			ctx.stroke();
		}
			
	};

	//	editor properties
	rat.ui.Shape.editProperties = [
		{ label: "shape",
			props: [
				{propName:'shapeType', type:'integer'},	//	todo: pick from list
				{propName:'cornerRadius', type:'float'},	//	todo: pick from list
				{label: 'strokeWidth', propName:'strokeWidth', type:'float'},
				{label: 'strokeColor', propName:'strokeColor', type:'color'},
			],
		}
	];

	rat.ui.Shape.setupFromData = function (pane, data, parentBounds)
	{
		rat.ui.data.callParentSetupFromData(rat.ui.Shape, pane, data, parentBounds);

		if (data.shapeType !== void 0)
			pane.shapeType = data.shapeType;
		if (data.cornerRadius !== void 0)
			pane.setCornerRadius(data.cornerRadius);
		if (data.strokeWidth !== void 0)
			pane.strokeWidth = data.strokeWidth;
		if (data.strokeColor !== void 0)
			pane.strokeColor = data.strokeColor;
	};
	
});