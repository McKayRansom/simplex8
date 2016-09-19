
//----------------------------
//	bubblebox ui element
//	renders with a loaded image
//	maybe make a subclass of sprite to inherit image loading/handling?
rat.modules.add( "rat.ui.r_ui_bubblebox",
[
	{name: "rat.utils.r_utils", processBefore: true },
	{name: "rat.ui.r_ui", processBefore: true },
	
	"rat.math.r_vector",
	"rat.graphics.r_image",
	"rat.debug.r_console",
	"rat.graphics.r_graphics",
], 
function(rat)
{
	// NOTE: these definitions and settings allow us to draw differently (and faster) if the tiles are solid and stretchable
	// when manually doing lots of draw calls for tiling it can create significant performance problems on some hardware
	rat.ui.BubbleBox_TILE = 0;
	rat.ui.BubbleBox_STRETCH = 1;

	// the function rat.ui.BubbleBox_setDefaultDrawType(drawType) can be used to set this if desired
	rat.ui.BubbleBox_defaultDrawType = rat.ui.BubbleBox_TILE;

	/**
	 * @param {string=} resource
	 * @param {number=} drawType How does this bubble box draw (stretch/tile)
	 * @constructor
	 * @extends rat.ui.Element
	 */
	rat.ui.BubbleBox = function (resource, drawType)
	{
		rat.ui.BubbleBox.prototype.parentConstructor.call(this); //	default init
		this.blockSize = new rat.Vector(4, 4);	//	placeholder 'till we get our image
		this.resource = resource;
		if (resource !== void 0)
		{
			this.imageRef = new rat.graphics.ImageRef(resource);
			var self = this;
			this.imageRef.setOnLoad(function (img)
			{
				self.updateWithNewImageSize(img.width, img.height);
			});
		}
		this.name = "<bbl>" + resource + this.id;

		if (drawType)
			this.drawType = drawType;
		else
			this.drawType = rat.ui.BubbleBox_defaultDrawType;
		//	note that bubblebox is often used as a group, with stuff inside it, so don't turn off trackmouse
	};
	rat.utils.inheritClassFrom(rat.ui.BubbleBox, rat.ui.Element);
	rat.ui.BubbleBox.prototype.elementType = "bubbleBox";

	//	update internal calculations with newly loaded image size
	//	(e.g. after load finishes)
	rat.ui.BubbleBox.prototype.updateWithNewImageSize = function (width, height)
	{
		//	detect if the image is a 3x3 or a 4x4, in order to be more flexible.  Assume even pixel size will tell us...
		//	The 4x4 format is something we used in wraith.
		//	TODO: support the 9-tile format we've seen out there, where center spaces are bigger than outer spaces?
		var div = 4;
		if (width / 3 === rat.math.floor(width / 3))
			div = 3;
		this.blockSize = new rat.Vector(width / div, height / div);
		this.blockRows = 3; //	box
		if (height === width / div)	//	bar - just one row
		{
			this.blockRows = 1;
			this.blockSize.y = image.height;
		}
		
		this.setDirty(true);
	};
	
	//	explicitly use this imageref instead of loading above
	rat.ui.BubbleBox.prototype.useImageRef = function (imageRef)
	{
		this.imageRef = imageRef;
		var imageSize = this.imageRef.getFrameSize(0);
		this.updateWithNewImageSize(imageSize.w, imageSize.h);
		
		this.setDirty(true);
	};
	
	//	Update my image, in case it needs to animate or something.
	//	This behavior currently needs to be the same as Sprite's updateSelf,
	//	so I'm just going to call that function, for now.
	//	Later, this might argue for a refactor, or even making this class a subclass of sprite,
	//	but right now that seems like overkill.
	rat.ui.BubbleBox.prototype.updateSelf = function (dt)
	{
		rat.ui.Sprite.prototype.updateSelf.call(this, dt);
	};
	
	//	todo:  why is there no update function here to support animating my imageRef?
	//	if we add one, be sure to consider setting my dirty state.

	rat.ui.BubbleBox.prototype.drawSelf = function ()
	{
		var ctx = rat.graphics.getContext();
		if (this.imageRef === void 0)
			return;
		var image = this.imageRef.getImage();
		if (image === null)
			return;

		//	Deal with scaling...
		//	If context is scaled, we aren't going to look very good, on some platforms (Win8, maybe IE?)
		//	So...  undo all transforms, calculate raw screen pixel points, and draw in a raw identity-matrix context
		//	TODO:  Does not play nicely with rotation, currently.  We need to extract rotation out of matrix or something?
		//	Or keep track of collected scale and rotation separately in rat.graphics.transform api.  Yeah, probably...
		var scaleHack = false;
		var width = rat.math.floor(this.size.x);
		var height = rat.math.floor(this.size.y);
		if ((this.flags & rat.ui.Element.adjustForScaleFlag) &&
			(rat.graphics.mTransform.m[0][0] !== 1 || rat.graphics.mTransform.m[1][1] !== 1))
		{
			scaleHack = true;
			//var topLeft = rat.graphics.transformPoint(this.place.pos);
			//var botRight = rat.graphics.transformPoint({ x: this.place.pos.x + this.size.x, y: this.place.pos.y + this.size.y });
			var topLeft = rat.graphics.transformPoint({ x: 0, y: 0 });
			var botRight = rat.graphics.transformPoint({ x: this.size.x, y: this.size.y });

			rat.graphics.save();
			ctx.setTransform(1, 0, 0, 1, 0, 0);

			width = rat.math.floor(botRight.x - topLeft.x);
			height = rat.math.floor(botRight.y - topLeft.y);

			topLeft.x = rat.math.floor(topLeft.x);
			topLeft.y = rat.math.floor(topLeft.y);
			ctx.translate(topLeft.x, topLeft.y);

			//	special case for bubble bars (bubbles that only have one row)
			//	In this case, we are not actually tiling vertically, so we won't have artifacts.
			//	So, go ahead and scale vertically to get what we want.
			//	Will this look funny?
			if (this.blockRows === 1)
			{
				ctx.scale(1, height / this.size.y);
				height = this.size.y;
			}

			//	temp test
			//ctx.fillStyle = "#FFFFFF";
			//ctx.fillRect(topLeft.x, topLeft.y, 20, 20);
			//ctx.fillRect(botRight.x, botRight.y, 20, 20);

			/*
			var m11 = rat.graphics.mTransform.m[0][0];
			var m12 = rat.graphics.mTransform.m[1][0];
			var m21 = rat.graphics.mTransform.m[0][1];
			var m22 = rat.graphics.mTransform.m[1][1];
			var mdx = rat.math.floor(rat.graphics.mTransform.m[0][2]);
			var mdy = rat.math.floor(rat.graphics.mTransform.m[1][2]);
			ctx.setTransform(m11, m12, m21, m22, mdx, mdy);
			*/
		}

		var rows = height / this.blockSize.y;
		if (this.blockRows === 1)	//	support for bubble bars - just truncate to one row
			rows = 1;
		var rowsFloor = rat.math.floor(rows);
		var cols = width / this.blockSize.x;
		var colsFloor = rat.math.floor(cols);

		//console.log("rows, cols:  " + rows + ", " + cols);
		//console.log("blockSize: " + this.blockSize.x + ", " + this.blockSize.y);

		//	util to get pos and width of source tile, based on our position in the loop.
		//	useful for both x and y
		var tileWidth = 0;
		function getTileInfo(index, count, countFloor, pieceSize)
		{
			tileWidth = pieceSize;
			if (index === 0)	//	first tile - assume we're wide enough and just grab the whole thing
				return 0;
			else if (index >= count - 1)	//	last tile
			{
				//	special case...  we didn't have room for middle tiles, and our final tile is too wide, so crop it down, eating away from the left, leaving the right
				if (count > 1 && count < 2)
					tileWidth = (count - countFloor) * pieceSize;
				return pieceSize * 2 + (pieceSize - tileWidth);
			}
			else	//	middle tile - we crop the last middle tile to exactly fill space remaining before final tile
			{
				if (index >= countFloor - 1)
					tileWidth = (count - countFloor) * pieceSize;
				return pieceSize;
			}
		}

		var yPos = 0;
		var sourceX = 0, sourceY = 0, sourceWidth, sourceHeight;
		if (this.drawType === rat.ui.BubbleBox_TILE)
		{
			for(var y = 0; y < rows; y++)
			{
				sourceY = getTileInfo(y, rows, rowsFloor, this.blockSize.y);
				sourceHeight = tileWidth;

				var xPos = 0;
				for(var x = 0; x < cols; x++)
				{
					sourceX = getTileInfo(x, cols, colsFloor, this.blockSize.x);
					sourceWidth = tileWidth;

					//console.log("  draw " + x + "," + y);
					ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, xPos - this.center.x, yPos - this.center.y, sourceWidth, sourceHeight);
					//console.log("x draw " + x + "," + y);

					xPos += sourceWidth;
				}

				yPos += sourceHeight;
			}
		}
		else if (this.drawType === rat.ui.BubbleBox_STRETCH)
		{
			// nine total calls max instead of possibly hundreds

			// draw each of the nine elements once instead of tiling
			var farXPos = width - this.center.x;
			var farYPos = height - this.center.y;

			// top left corner y:0, x:0
			sourceY = getTileInfo(0, rows, rowsFloor, this.blockSize.y);
			sourceHeight = tileWidth;		// missed this the first time through because I didnt realize it was due to side effects from the function call
			sourceX = getTileInfo(0, cols, colsFloor, this.blockSize.x);
			sourceWidth = tileWidth;
			ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, -this.center.x, -this.center.y, sourceWidth, sourceHeight);

			// top right corner y:0, x:cols-1
			sourceY = getTileInfo(0, rows, rowsFloor, this.blockSize.y);
			sourceHeight = tileWidth;
			sourceX = getTileInfo(colsFloor, cols, colsFloor, this.blockSize.x);
			sourceWidth = tileWidth;
			ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, farXPos - sourceWidth, -this.center.y, sourceWidth, sourceHeight);

			// bottom left corner y:rows-1, x:0
			sourceY = getTileInfo(rowsFloor, rows, rowsFloor, this.blockSize.y);
			sourceHeight = tileWidth;
			sourceX = getTileInfo(0, cols, colsFloor, this.blockSize.x);
			sourceWidth = tileWidth;
			ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, -this.center.x, farYPos - sourceHeight, sourceWidth, sourceHeight);

			// bottom right corner y:rows-1, x:cols-1
			sourceY = getTileInfo(rowsFloor, rows, rowsFloor, this.blockSize.y);
			sourceHeight = tileWidth;
			sourceX = getTileInfo(colsFloor, cols, colsFloor, this.blockSize.x);
			sourceWidth = tileWidth;
			ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, farXPos - sourceWidth, farYPos - sourceHeight, sourceWidth, sourceHeight);

			if (cols > 2)
			{
				// top middle
				sourceY = getTileInfo(0, rows, rowsFloor, this.blockSize.y);
				sourceHeight = tileWidth;
				sourceX = getTileInfo(1, cols, colsFloor, this.blockSize.x);
				sourceWidth = tileWidth;
				ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, sourceWidth - this.center.x, -this.center.y, width - sourceWidth * 2, sourceHeight);

				// bottom middle
				sourceY = getTileInfo(rowsFloor, rows, rowsFloor, this.blockSize.y);
				sourceHeight = tileWidth;
				sourceX = getTileInfo(1, cols, colsFloor, this.blockSize.x);
				sourceWidth = tileWidth;
				ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, sourceWidth - this.center.x, farYPos - sourceHeight, width - sourceWidth * 2, sourceHeight);
			}

			if (rows > 2)
			{
				// left middle
				sourceY = getTileInfo(1, rows, rowsFloor, this.blockSize.y);
				sourceHeight = tileWidth;
				sourceX = getTileInfo(0, cols, colsFloor, this.blockSize.x);
				sourceWidth = tileWidth;
				ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, -this.center.x, sourceHeight - this.center.y, sourceWidth, height - sourceHeight * 2);

				// right middle
				sourceY = getTileInfo(1, rows, rowsFloor, this.blockSize.y);
				sourceHeight = tileWidth;
				sourceX = getTileInfo(colsFloor, cols, colsFloor, this.blockSize.x);
				sourceWidth = tileWidth;
				ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, farXPos - sourceWidth, sourceHeight - this.center.y, sourceWidth, height - sourceHeight * 2);
			}

			if (rows > 2 && cols > 2)
			{		// only draw if there is a middle area, only exists if rows and column sizes are greater than 2
				// middle middle
				sourceY = getTileInfo(1, rows, rowsFloor, this.blockSize.y);
				sourceHeight = tileWidth;
				sourceX = getTileInfo(1, cols, colsFloor, this.blockSize.x);
				sourceWidth = tileWidth;
				if (rows > 2 && cols > 2)
					ctx.drawImage(image, sourceX, sourceY, sourceWidth, sourceHeight, sourceWidth - this.center.x, sourceHeight - this.center.y, width - sourceWidth * 2, height - sourceHeight * 2);
			}
		}

		if (scaleHack)
			rat.graphics.restore();
	};

	rat.ui.BubbleBox_setDefaultDrawType = function (drawType)
	{
		if (drawType === rat.ui.BubbleBox_STRETCH)
			rat.ui.BubbleBox_defaultDrawType = rat.ui.BubbleBox_STRETCH;
		else
			rat.ui.BubbleBox_defaultDrawType = rat.ui.BubbleBox_TILE;
	};
} );