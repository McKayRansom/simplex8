//
//	generated js from lua file and hand-edited
//
rat.modules.add( "rat.xuijs.wahooluajs.events.w_timelineevent",
[
	{name: "rat.xuijs.wahooluajs.wahoolua", processBefore: true },
], 
function(rat)
{
	var WTimelineEvent = function(scene, startFrame, endFrame, func, autodelete, recursive) {
		this.scene = scene
		this.startFrame = startFrame
		this.endFrame = endFrame
		this.SetFunc(func)
		this.autodelete = autodelete || false
		this.handler = false
		this.recursive = recursive || false
	}
	
	WTimelineEvent.prototype.Dtor = function() {
		this.Stop()
	}
	
	WTimelineEvent.prototype.Start = function( ) {	//	varargs
		if ( this.scene && !this.handler ) {
			var self = this;	//	remember this for access below... (where a new "this" will be set)
			this.handler = this.scene.Subscribe("TimelineEnd", function(scene, a) {
				//if ( scene._handle == a ) {
				//	Why are we checking the handle?
				//	Isn't it guaranteed to match?
				{
					//WStdUtils.printf( "anim "+this.startFrame+" -> "+this.endFrame+" Done" );
					//if ( this.func(unpack(arg))  != false ) {
					
					//	the lua code passed this timeline object as the first argument, I think?
					//	judging from bubblesobject in rndive
					if ( self.func(self, a) != false ) {
						self.Stop()
					}
				}
			})
			//WStdUtils.printf( "Playing anim "+this.startFrame+" -> "+this.endFrame );
			this.scene.PlayTimeline(this.startFrame, this.endFrame, this.recursive)
		}
	}
	
	//	Stop this timeline event - unsubscribe our handler.
	//	Notes:
	//		This does not stop the animation itself from happening.
	//		This does not trigger the } callback, either.
	WTimelineEvent.prototype.Stop = function() {
		if ( this.scene && this.handler ) {
			this.scene.Unsubscribe(this.handler)
			this.handler = false
	
			if ( this.autodelete ) {
				this.Dtor()
			}
		}
	}
	
	WTimelineEvent.prototype.SetFunc = function(func) {
		this.func = func
	}

	wahoolua.WTimelineEvent = WTimelineEvent;

});
