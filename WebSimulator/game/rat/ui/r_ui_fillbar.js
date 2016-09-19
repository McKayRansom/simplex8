
//
//	Fillbar ui element
//
//	TODO:  Offscreen and Dirty support
//
rat.modules.add( "rat.ui.r_ui_fillbar",
[
	{name: "rat.utils.r_utils", processBefore: true },
	{name: "rat.ui.r_ui", processBefore: true },
	{name: "rat.ui.r_ui_fill", processBefore: true },
	
	"rat.debug.r_console",
	"rat.ui.r_ui_data",
	"rat.graphics.r_graphics",
	"rat.math.r_math",
	"rat.ui.r_ui_data",
], 
function(rat)
{
	/**
	 * @constructor
	 * @extends rat.ui.Element
	*/
	rat.ui.FillBar = function ()
	{
		rat.ui.FillBar.prototype.parentConstructor.call(this); //	default init
		
		//	Default to a fill style/shape supported by this class
		this.fillStyle = 'fill';
		this.fillShape = 'rectangle';
		
		this.minColor= rat.graphics.red;
		this.maxColor= rat.graphics.green;
		this.backColor = rat.graphics.black;
		this.frameColor = rat.graphics.blue;
	};
	rat.utils.inheritClassFrom(rat.ui.FillBar, rat.ui.Fill);
	rat.ui.FillBar.prototype.elementType = "fillBar";

	//	Set the colors that we will use to draw.
	rat.ui.FillBar.prototype.setColors = function (backColor, bodyColor, frameColor)
	{
		//	If instead of a single color for the body, we were given two
		this.backColor = backColor;
		this.minColor = bodyColor.min || bodyColor;
		this.maxColor = bodyColor.max || bodyColor;
		this.frameColor = frameColor;
	};

	//	Draw the fill bar
	rat.ui.FillBar.prototype.drawSelf = function ()
	{
		var ctx = rat.graphics.ctx;
		ctx.save();

		//	Figure out the color
		var percent = this.percent;
		if (percent < 0)
			percent = 0;
		else if (percent > 1)
			percent = 1;
		var color = new rat.graphics.Color();
		if (this.minColor.r !== this.maxColor.r ||
			this.minColor.g !== this.maxColor.g ||
			this.minColor.b !== this.maxColor.b ||
			this.minColor.a !== this.maxColor.a)
		{
			rat.graphics.Color.interp(this.minColor, this.maxColor, this.percent, color);
		}
		else
			color = this.minColor;

		var w, h;
		w = this.getWidth();
		h = this.getHeight();
		
		//	UP is assumed to be 0.   Pull this from data
		//	Assuming clockwise fill.   Pull this from data
		//	Assuming left->right.   Pull from data.
		var startAngle = -rat.math.HALFPI;
		var endAngle = startAngle + (rat.math.PI2 * this.percent);

		var cx = this.size.x / 2 + this.center.x;
		var cy = this.size.y / 2 + this.center.y;
		var r;

		//	If we are radial, then handle that
		if (this.fillShape === "circle")
		{
			if (w<h)
				r = w;
			else
				r = h;
			
			//	BG
			ctx.fillStyle = this.backColor.toString();
			ctx.beginPath();
			ctx.arc(0, 0, r, 0, rat.math.PI2, false);

			//	Fill
			if (this.fillStyle === "radialFill")
			{
				ctx.fillStyle = color.toString();
				ctx.beginPath();
				ctx.moveTo(cx, cy);
				ctx.arc(cx, cy, r, startAngle, endAngle, false);
				ctx.closePath();
				ctx.fill();
			}
			else if (this.fillStyle === "radialStroke")
			{
				ctx.strokeStyle = color.toString();
				ctx.lineWidth = this.lineWidth;
				ctx.beginPath();
				ctx.arc(cx, cy, r, startAngle, endAngle, false);
				ctx.stroke();
			}
			else
			{
				rat.console.log("rat.ui.fillBar does not support fillStyle " + this.fillStyle + " with shape " + this.fillShape);
			}

			//	frame
			ctx.strokeStyle = this.frameColor.toString();
			ctx.lineWidth = 1;
			ctx.beginPath();
			ctx.arc(cx, cy, r, startAngle, endAngle, false);
			ctx.stroke();
		}
		else
		{
			ctx.translate(-this.center.x, -this.center.y);
			//	BG
			ctx.fillStyle = this.backColor.toString();
			ctx.fillRect(0, 0, w, h);

			if (this.fillStyle === "radialFill")
			{
				ctx.beginPath();
				ctx.rect(0, 0, w, h);
				ctx.clip();

				if (w > h)
					r = w;
				else
					r = h;
				r = r * 2;
				ctx.beginPath();
				ctx.moveTo(cx, cy);
				ctx.arc(cx, cy, r, startAngle, endAngle, false);
				ctx.closePath();
				//	BG
				ctx.fillStyle = color.toString();
				ctx.fill();
			}
			else if (this.fillStyle === "radialStroke")
			{
				rat.console.log("rat.ui.fillBar does not support fillStyle " + this.fillStyle + " with shape " + this.fillShape);
			}
			else if (this.fillStyle === "fill")
			{
				ctx.fillStyle = color.toString();
				ctx.fillRect( 0, 0, w*this.percent, h );
			}
			else
			{
				//	Stroke
				ctx.strokeStyle = color.toString();
				ctx.lineWidth = this.lineWidth;
				ctx.strokeRect( 0, 0, w * this.percent, h );
			}

			//	Frame
			ctx.strokeStyle = this.frameColor.toString();
			ctx.lineWidth = 1;
			ctx.strokeRect(0, 0, this.getWidth(), this.getHeight());
		}

		ctx.restore();
	};

	// Support for creation from data
	//
	//colors: {
	// background: {r, g, b, a},
	// body: {r, g, b, a},
	// bodyMin: {r, g, b, a},
	// bodyMax: {r, g, b, a},
	// frame: {r, g, b, a}
	//},
	//}
	//
	rat.ui.FillBar.setupFromData = function (pane, data, parentBounds)
	{
		data.colors = data.colors || {};
		rat.ui.data.callParentSetupFromData(rat.ui.FillBar, pane, data, parentBounds);
		var background = new rat.graphics.Color(data.colors.background || rat.graphics.black);
		var bodyMin = new rat.graphics.Color(data.colors.minBody || data.colors.body || pane.color || rat.graphics.red);
		var bodyMax = new rat.graphics.Color(data.colors.maxBody || data.colors.body || pane.color || rat.graphics.green);
		var frameColor = new rat.graphics.Color(data.colors.frame || (data.frame ? data.frame.color : void 0) || rat.graphics.blue);
		pane.setColors(background, {min:bodyMin, max:bodyMax}, frameColor);
	};
});