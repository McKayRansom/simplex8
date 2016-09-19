//
//	generated js from lua file
//
rat.modules.add( "rat.xuijs.wahooluajs.system.w_class",
[
	{name: "rat.xuijs.wahooluajs.wahoolua", processBefore: true },
], 
function(rat)
{
	wahoolua = wahoolua || {}
	wahoolua.class = function() {
		
		var parents = [];
		for(var i = 0; i < arguments.length; ++i) parents.push(arguments[i]);
		
		var c = function() {};
		
		// Derek: The closest I could find to the LUA metamethod __index was
		// prototype.__noSuchMethod__, but even that is not standard. I'll get
		// the equivalent by copying the protoypes of the parents into one
		// prototype for the new class. I'm iterating over the parents
		// backwards so the first class with a key will overwrite the key for
		// the other classes to behave like the LUA version.
		for(var i = arguments.length-1; i >= 0; --i) {
			var parentPrototype = arguments[i].prototype;
			for(var key in parentPrototype) {
				c.prototype[key] = parentPrototype[key];
			}
		}
		
		// Need to set these up so we don't call parents twice.
		// They'll be overridden in the class implmentations
		c.prototype.Ctor = function() {};
		c.prototype.Dtor = function() {};
	
		c.prototype.construct = function() {
			for(var i = 0; i < parents.length; ++i) {
				var parent = parents[i];
				parent.prototype.construct.apply(this, arguments);
				
				if( parent.prototype.Ctor && this._calledCtors.indexOf(parent.prototype.Ctor) === -1 )
				{
					this._calledCtors.push( parent.prototype.Ctor );
					parent.prototype.Ctor.apply(this, arguments);
				}
			}
		};
	
		c.prototype.destroy = function() {
			for(var i = 0; i < parents.length; ++i) {
				var parent = parents[i];
				parent.prototype.destroy.apply(this, arguments);
				if( parent.prototype.Dtor && this._calledDtors.indexOf(parent.prototype.Dtor) === -1 ) {
					this._calledDtors.push(parent.prototype.Dtor);
					parent.prototype.Dtor.apply(this, arguments);
				}
			}
		};
		
		c.new = function() {
			var o = new c();
			
			o._calledCtors = []; // Keep track of which constructors have been called to handle diamond inheritance.
			
			c.prototype.construct.apply(o, arguments);
			
			if( c.prototype.Ctor && o._calledCtors.indexOf(c.prototype.Ctor) === -1 ) c.prototype.Ctor.apply(o, arguments);
			
			o._calledCtors = null;
			
			return o;
		};
		
		c.prototype.delete = function() {
			// Derek: Should delete handle diamond inheritance or just expect
			// the Dtors deletes in a safe way? I'll set it up to handle
			// diamond inheritance for now.
			
			this._calledDtors = []; // Keep track of which constructors have been called to handle diamond inheritance.
			
			if( c.prototype.Dtor ) {
				this._calledDtors.push(c.prototype.Dtor);
				c.prototype.Dtor.apply(this, arguments);
			}
			c.prototype.destroy.apply(this, arguments);
		};
	
		return c;
	};
});
