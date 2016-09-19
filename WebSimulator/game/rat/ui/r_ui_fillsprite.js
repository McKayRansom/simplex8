
//
//	FillSprite ui element (a FillSprite-like visual, using a sprite and clipping).
//
//	currently supports radial fill style, but could do other effects, like fill top-to-bottom, or whatever.
//	The way this works now is we just clip what gets drawn, and assume you have something interesting behind it.
//	So, you only need to specify one resource here.
//	This is a subclass of sprite, since it's very similar in most of its functionality.
//
//	TODO:  test Offscreen and Dirty support - is it correct?
//
rat.modules.add( "rat.ui.r_ui_fillsprite",
[
	{name: "rat.utils.r_utils", processBefore: true },
	{name: "rat.ui.r_ui", processBefore: true },
	{name: "rat.ui.r_ui_fill", processBefore: true },
	{name: "rat.ui.r_ui_sprite", processBefore: true },
	
	"rat.debug.r_console",
	"rat.ui.r_ui_data",
	"rat.os.r_system",
	"rat.graphics.r_graphics",
	"rat.math.r_math",
], 
function(rat)
{
	var Sprite = rat.ui.Sprite;
	/**
	 * @constructor
	 * @extends rat.ui.Sprite
	*/
	rat.ui.FillSprite = function (resource, extra1, extra2)
	{
		rat.ui.FillSprite.prototype.parentConstructor.call(this, resource, extra1, extra2); //	default init
		Sprite.call(this);
		this.fillStyle = 'radialFill';
		this.fillShape = 'rectangle';
	};
	rat.utils.inheritClassFrom(rat.ui.FillSprite, rat.ui.Fill);
	rat.utils.extendClassWith(rat.ui.FillSprite, rat.ui.Sprite);
	rat.ui.FillSprite.prototype.elementType = "fillSprite";

	//	Updating
	rat.ui.FillSprite.prototype.updateSelf = function (dt)
	{
		if (rat.ui.FillSprite.prototype.parentPrototype.updateSelf)
			rat.ui.FillSprite.prototype.parentPrototype.updateSelf(dt);
		Sprite.prototype.updateSelf.call(this,dt);
	};

	//	Draw the fill sprite
	var haveReportedWarningWraith = false;
	rat.ui.FillSprite.prototype.drawSelf = function ()
	{
		if (!this.imageRef)
			return;
		var ctx = rat.graphics.getContext();
		rat.graphics.save();
		if (rat.ui.FillSprite.prototype.parentPrototype.drawSelf)
			rat.ui.FillSprite.prototype.parentPrototype.drawSelf.call(this);

		var w = this.getWidth();
		var h = this.getHeight();
		var percent = this.percent;
		var clamped = percent;
		if (clamped < 0)
			clamped = 0;
		if (clamped > 1)
			clamped = 1;

		//- NOTE: If we are in wraith, we cannot currently do this...
		//	Workarounds exist, but they really consist of r_ui_fillbars and bg/fg images
		if (rat.system.has.Wraith)
		{
			rat.console.logOnce("WARNING!  Attempting to use a circle FillSprite while running in Wraith.   This is currently not support", "WraithFillSpriteSupport", 1 );
			return;
		}
		var cx = this.size.x / 2 + this.center.x;
		var cy = this.size.y / 2 + this.center.y;

		//	UP is assumed to be 0.   Pull this from data
		//	Assuming clockwise fill.   Pull this from data
		//	Assuming left->right.   Pull from data.
		if (this.fillStyle === "radialStroke" || this.fillStyle === "stroke")
		{
			rat.console.log("rat.ui.FillSprite does not support fillStyle " + this.fillStyle + " with shape " + this.fillShape);
		}
		else
		{
			if (this.fillStyle === "radialFill")
			{
				var startAngle = -rat.math.HALFPI;
				var endAngle = startAngle + (this.percent * rat.math.PI2);
				
				ctx.beginPath();
				ctx.moveTo( cx, cy );
				var radius;
				if (this.fillShape === "circle")
				{
					if (w<h)
						radius = w;
					else
						radius = h;
				}
				else
				{
					if (w>h)
						radius = w;
					else
						radius = h;
					radius = radius*2;
				}
				ctx.arc( cx, cy, radius, startAngle, endAngle, false );
				ctx.closePath();
				ctx.clip();
			}
			else if( this.fillStyle === "fill" )
			{
				if (this.fillStyle === "circle")
				{
					rat.console.log("rat.ui.FillSprite does not support fillStyle " + this.fillStyle + " with shape " + this.fillShape);
				}
				else
				{
					ctx.beginPath();
					ctx.moveTo(-this.center.x, -this.center.y);
					ctx.rect(-this.center.x, -this.center.y, w * this.percent, h);
					ctx.clip();
				}
			}

			//	Draw the sprite
			Sprite.prototype.drawSelf.call(this);
		}

		ctx.restore();

	};

	rat.ui.FillSprite.setupFromData = function (pane, data, parentBounds)
	{
		rat.ui.data.callParentSetupFromData(rat.ui.FillSprite, pane, data, parentBounds);
		Sprite.setupFromData(pane, data, parentBounds);
	};
});
