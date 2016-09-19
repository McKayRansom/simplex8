//
//	A system for broadcasting messages to registered listeners
//
rat.modules.add( "rat.utils.r_messenger",
[], 
function(rat)
{
	/**
	 * @constructor
	 */
	rat.Messenger = function ()
	{
		this.handlers = [];
	};

	// Returned by listeners to tell the system to remove them.
	rat.Messenger.remove = "REMOVE"; 

	rat.Messenger.prototype.broadcast = function (name)
	{
		var handlers = this.handlers[name];
		if(handlers)
		{
			var funcsToRemove = [];
			var index;

			Array.prototype.splice.call(arguments, 0, 1);
			for(index in handlers)
			{
				if(handlers.hasOwnProperty(index))
				{
					//We do not work with contexts in this system,
					// using null in apply will provide the global object
					// in place of 'this'
					//handlers[index].apply(null, arguments);
					// However, this does mean that if i have use a bind to provide the handler, then it gets lost.
					// Instead, store the func in  var, and call it
					var func = handlers[index];
					//func();
					var res = func.apply(this, arguments);
					if (res === rat.Messenger.remove)
						funcsToRemove.push(func);
				}
			}
			for (index = 0; index !== funcsToRemove.length; ++index)
				this.stopListening(name, funcsToRemove[index]);
		}
	};

	rat.Messenger.prototype.listen = function (name, callback) {
		if (typeof callback === 'function') {
			this.handlers[name] = this.handlers[name] || [];
			var index = this.handlers[name].indexOf(callback);
			if (index === -1) {
				this.handlers[name].push(callback);
			}
		}
	};

	rat.Messenger.prototype.stopListening = function (name, callback) {
		if (typeof callback === 'function') {
			var index = this.handlers[name].indexOf(callback);
			if(index !== -1)
				this.handlers[name].splice(index, 1);
		}
	};

} );