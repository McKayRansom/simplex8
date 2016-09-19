/*

	rectangle list manager.

	Collect and manage a list of 2D rectangles.
	Handle adding, removing, coalescing overlapping rects, etc.
	
	useful for dirty rectangle lists, among other things.
*/
rat.modules.add("rat.graphics.r_rectlist",
[],
function (rat)
{
	///
	/// RectList object
	/// @constructor
	///
	rat.RectList = function ()
	{
		this.list = [];
	};
	//rat.RectList.prototype.blah = true;	//	whatever

	//	clear rect list
	rat.RectList.prototype.clear = function ()
	{
		this.list = [];
	};

	//	snap this rectangle to an even pixel alignment, one pixel around.
	//	This is important for some uses, when rectangles have fractional xywh values,
	//	particularly when we're dealing with antialiasing.
	//	The usage of this is optional, and handled automatically if turned on - see "snapEven" flag.
	//	Odd note:  When graphics are being scaled up (see rat.graphics.globalScale), this still has problems when we clip... :(
	//		How to fix that?  We ideally need these things to align to the final pixel, not to some value that later gets scaled anyway...
	//		One way to fix this is to use bigger target resolutions, instead of targetting small space and scaling up (target big space and scale down).
	//		Can we hack this for now by using bigger numbers?  Nope, it doesn't solve the problem with the final clip being misaligned when graphics applies its scale...
	rat.RectList.prototype.snap = function (addR)
	{
		var r = {};

		r.x = (addR.x - 1 | 0);	//	hmm... why is this -1 necessary?  It seems to be.  Maybe something about pixel scale?
		r.y = (addR.y - 1 | 0);
		r.w = ((addR.w + 1 + (addR.x - r.x) + 0.999999999) | 0);
		r.h = ((addR.h + 1 + (addR.y - r.y) + 0.999999999) | 0);

		return r;
	};

	//	add rect
	//	todo: maintain in some kind of binary searchable order
	rat.RectList.prototype.add = function (addR)
	{
		var r;
		//	if we're supposed to, then snap to outside even boundaries,
		//	to avoid problems with precision errors resulting in bad drawing.
		if (this.snapEven)
			r = this.snap(addR);
		else
			r = { x: addR.x, y: addR.y, w: addR.w, h: addR.h };	//	copy, so we don't get changed when original changes

		//	do some optimizations, based on this rectangle being similar to others already in the list.
		//	TODO: make this optional, based on flag during setup.
		for (var i = this.list.length - 1; i >= 0; i--)
		{
			var t = this.list[i];
			//	short names for right/bottom edges
			var rright = r.x + r.w;
			var rbottom = r.y + r.h;
			var tright = t.x + t.w;
			var tbottom = t.y + t.h;

			//	see if new rectangle is fully included already in another rectangle.
			//	if so, bail now! (don't add r at all)
			if (r.x >= t.x && r.y >= t.y && rright <= tright && rbottom <= tbottom)
			{
				//console.log("add rect inside existing");
				return;
			}
			//	If new rectangle fully includes an existing rectangle, remove *that* rectangle.
			//	keep looping, in case we end up including more than one!
			//	This means a new rectangle could eat up several existing ones, which is good.
			//	At the end of this loop, the new one will be added (or otherwise resolved).
			if (r.x <= t.x && r.y <= t.y && rright >= tright && rbottom >= tbottom)
			{
				//console.log("add rect outside existing");
				this.list.splice(i, 1);
				continue;
			}

			//	OK, the above checks are good and basically no-brainers.  Certainly effective.
			//	Here's where it's a little more heuristic.
			//	How much are these rects overlapping?  If a lot, merge them into one!
			//	Note that this is a very common case, because a moving object will almost always
			//		have a new bounds slightly shifted from previous bounds.
			//	We might need to make this optional, and configurable in how aggressive it is.
			//	TODO: deal with a need for multiple passes.  Merging rects could mean another existing rect is suddenly partly overlapped/consumed.
			//	TODO: optimize all this logic, especially combined with the above?  Maybe not a performance concern.
			//		e.g. quick check to see if there's any overlap at all, and if not, move on,
			//			and if so, then find out what kind, or entirely containing/contained, etc.
			//	TODO: yikes, lots of individual checks below.  Can somehow be simplified?
			var horizOverlap = 0;
			var vertOverlap = 0;
			var left, right, top, bottom;

			//	horizontal checks
			//	make sure there's *some* overlap
			if (!(rright < t.x || tright < r.x) && !(rbottom < t.y || tbottom < r.y))
			{
				if (r.x < t.x)	//	left edge of r is farther left
				{
					left = r.x;
					if (rright > tright)	//	r includes t entirely
					{
						horizOverlap = t.w;
						right = rright;
					} else
					{	//	r overlaps on left
						horizOverlap = rright - t.x;
						right = tright;
					}
				} else
				{
					left = t.x;
					if (tright > rright)	//	t includes r entirely
					{
						horizOverlap = r.w;
						right = tright;
					} else
					{	//	r overlaps on right
						horizOverlap = tright - r.x;
						right = rright;
					}
				}

				//	now vertical cases
				if (r.y < t.y)	//	top edge of r is farther up
				{
					top = r.y;
					if (rbottom > tbottom)	//	r includes t entirely
					{
						vertOverlap = t.h;
						bottom = rbottom;
					} else
					{	//	r overlaps on top
						vertOverlap = rbottom - t.y;
						bottom = tbottom;
					}
				} else
				{
					top = t.y;
					if (tbottom > rbottom)	//	t includes r entirely
					{
						vertOverlap = r.h;
						bottom = tbottom;
					} else
					{	//	r overlaps on bottom
						vertOverlap = tbottom - r.y;
						bottom = rbottom;
					}
				}

				//	now, is that overlap worth it?  At this point we assume horizOverlap and vertOverlap are defined.
				//	For now, require our overlap to be X% of r, but could also check t.
				//	The idea here is that we don't want to always merge.  If 2 rects are barely touching, merging them might resulting
				//	in a lot of things being dirtied that don't really need it.  So, just merge if they're pretty close...
				if (horizOverlap * vertOverlap > r.w * r.h * 0.7)
				{
					//	Huh?
					if (t.x + t.w > right)
					{
						console.log("LOSS");
					}

					//	merge into new r
					r.x = left;
					r.y = top;
					r.w = right - left;
					r.h = bottom - top;
					//	like above, let's kill t in the list and continue looping.
					this.list.splice(i, 1);
				}

			}	//	end of total overlap check


		}	//	end of loop through existing rects

		//	we made it through with r intact - go ahead and add it.
		this.list.push(r);
	};
	//	remove rect, judging from position/size
	//rat.RectList.prototype.remove = function (r)
	//{
	//	//	NOT IMPLEMENTED.
	//};

	//	return true if this rect intersects at all with any rect in my list.
	rat.RectList.prototype.hits = function (r)
	{
		if (this.snapEven)
			r = this.snap(r);

		for (var i = 0; i < this.list.length; i++)
		{
			var t = this.list[i];
			if (r.x + r.w >= t.x
					&& r.x <= t.x + t.w
					&& r.y + r.h >= t.y
					&& r.y <= t.y + t.h)
				return true;
		}

		return false;
	};

	//	Useful utilities - not always needed, but when this rectlist is used as a dirty list, these are nice.

	//	erase all our rects from this ctx
	rat.RectList.prototype.eraseList = function (ctx)
	{
		for (var i = 0; i < this.list.length; i++)
		{
			var t = this.list[i];
			ctx.clearRect(t.x, t.y, t.w, t.h);
		}
	};

	//	set ctx clip region to the total dirty space.
	//	!!
	//		This does a context save, so you MUST CALL unclip() below when you're done with this clipping operation.
	//	!!
	//	useList here is optional, and generally not useful outside debugging.  Usually, you want to use this rectList's list.
	rat.RectList.prototype.clipToList = function (ctx, useList)
	{
		ctx.save();
		this.listToPath(ctx, useList);
		ctx.clip();

	};
	rat.RectList.prototype.unclip = function (ctx)
	{
		ctx.restore();
	};

	//	make a path in the given ctx using our rect list
	//	(or another list, if one was given to us - mostly useful for debugging)
	rat.RectList.prototype.listToPath = function (ctx, list)
	{
		if (!list)
			list = this.list;
		ctx.beginPath();
		for (var i = 0; i < list.length; i++)
		{
			var t = list[i];
			//ctx.rect(t.x, t.y, t.w, t.h);
			ctx.moveTo(t.x, t.y);
			ctx.lineTo(t.x + t.w, t.y);
			ctx.lineTo(t.x + t.w, t.y + t.h);
			ctx.lineTo(t.x, t.y + t.h);
			ctx.lineTo(t.x, t.y);
		}
	};

});
