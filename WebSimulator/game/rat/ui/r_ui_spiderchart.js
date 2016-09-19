//
//	SpiderChart ui element
//
//	TODO:  Offscreen and Dirty support
//
rat.modules.add( "rat.ui.r_ui_spiderchart",
[
	{name: "rat.ui.r_ui", processBefore: true },
	{name: "rat.utils.r_utils", processBefore: true },
	
	"rat.math.r_math",
	"rat.graphics.r_graphics",
	"rat.debug.r_console",
], 
function(rat)
{
	/**
	 * @constructor
	 * @extends rat.ui.Element
	*/
	rat.ui.SpiderChart = function ()
	{
		rat.ui.SpiderChart.prototype.parentConstructor.call(this); //	default init
		this.setTracksMouse(false);	//	no mouse tracking, highlight, tooltip, etc. including subelements.
	};
	rat.utils.inheritClassFrom(rat.ui.SpiderChart, rat.ui.Element);
	rat.ui.SpiderChart.prototype.elementType = 'spiderChart';

	rat.ui.SpiderChart.START_ANGLE = -rat.math.PI / 2;	//	start first axis straight up

	rat.ui.SpiderChart.prototype.setData = function (data)
	{
		this.data = data;

		//	copy?
		//	fill in a bunch of defaults

		if(typeof this.data.normalizeScale === 'undefined')
			this.data.normalizeScale = 1;

		//	normalizing?
		var biggest = 1;
		for(var setIndex = 0; setIndex < this.data.sets.length; setIndex++)
		{
			var set = this.data.sets[setIndex];
			for(var i = 0; i < set.points.length; i++)
			{
				if(set.points[i] > biggest)
					biggest = set.points[i];
			}
		}
		this.data.normalizeTarget = biggest;

		//	todo: if drawaxes.scale doesn't exist, default to normalizescale above
	};

	var debugtest = true;
	var lastSpider = null;

	rat.ui.SpiderChart.prototype.drawSelf = function ()
	{
		lastSpider = this;

		var ctx = rat.graphics.getContext();
		ctx.fillStyle = "#AAEEFF";	//	todo: let client specify this color
		ctx.fillRect(0, 0, this.size.x, this.size.y);

		var axes = this.data.sets[0].points.length;
		var angleGap = rat.math.PI * 2 / axes;
		var i, angle, dx, dy, v;
		//	start centered
		rat.graphics.save();
		//	clip?
		ctx.translate(this.size.x / 2, this.size.y / 2);

		//	draw axes
		if(this.data.drawAxes.color)
		{
			angle = rat.ui.SpiderChart.START_ANGLE;
			for(i = 0; i < axes; i++)
			{
				v = this.data.drawAxes.scale * this.size.x / 2;

				dx = v * rat.math.cos(angle);
				dy = v * rat.math.sin(angle);

				ctx.beginPath();
				ctx.moveTo(0, 0);
				ctx.lineTo(dx, dy);
				ctx.strokeStyle = this.data.drawAxes.color.toString();
				ctx.stroke();

				angle += angleGap;
			}
		}
		if(this.data.drawAxes.hashColor)
		{
			var hashCount = this.data.drawAxes.hashCount;
			for(var hashIndex = 0; hashIndex < hashCount; hashIndex++)
			{
				angle = rat.ui.SpiderChart.START_ANGLE;
				ctx.beginPath();

				for(i = 0; i < axes; i++)
				{
					//	use normalizescale here, not axes scale, so we match data when it's drawn!
					v = (hashIndex + 1) / hashCount * this.data.normalizeScale * this.size.x / 2;

					dx = v * rat.math.cos(angle);
					dy = v * rat.math.sin(angle);

					if(i === 0)
						ctx.moveTo(dx, dy);
					else
						ctx.lineTo(dx, dy);

					angle += angleGap;
				}

				ctx.closePath();
				ctx.strokeStyle = this.data.drawAxes.hashColor.toString();
				ctx.stroke();

			}
		}
		
		//	draw chart
		for(var setIndex = 0; setIndex < this.data.sets.length; setIndex++)
		{
			var set = this.data.sets[setIndex];
			if(set.fillColor)
				ctx.fillStyle = set.fillColor.toString();
			if(set.strokeColor)
				ctx.strokeStyle = set.strokeColor.toString();
			ctx.lineWidth = set.strokeWidth;	//	todo: default above

			angle = rat.ui.SpiderChart.START_ANGLE;
			ctx.beginPath();
			
			for(i = 0; i < set.points.length; i++)
			{
				v = set.points[i];
				if(this.data.normalize)
					v = v / this.data.normalizeTarget * this.data.normalizeScale * this.size.x / 2;

				var x = v * rat.math.cos(angle);
				var y = v * rat.math.sin(angle);
				if(debugtest)
				{
					rat.console.log(". " + set.points[i] + "(" + v + ") : " + x + ", " + y);
					debugtest = false;
				}

				if(i === 0)
					ctx.moveTo(x, y);
				else
					ctx.lineTo(x, y);

				angle += angleGap;
			}
			ctx.closePath();
			if(set.fillColor)
				ctx.fill();
			if(set.strokeColor)
				ctx.stroke();
		}
		rat.graphics.restore();

	};
});