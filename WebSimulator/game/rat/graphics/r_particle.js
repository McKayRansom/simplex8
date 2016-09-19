
//	Particle system
//
//	Basic idea:
//		particle systems are objects, so you can have more than one particle system in existence.
//		system contains emitters
//		emitters manage particles
//
//

//	TO DO:
//		* finish start/various/end state blending ideas
//		* allow user to tag emitters for later debugging or finding?
//		* general tag system - in fact, just assume everything has a "tag" variable?  no need for special per-class code.
//		* once we know the type of an emitter, set its draw function so we don't do branching in draw loop,
//			though this will have function call overhead
//		* custom draw function (combined with the above)
//		* specific support for flashups (text? or any type?) (dedicated emitter, created if needed?)
//		* for particles that are not changing color each frame, store color in string form so we don't convert every time we draw.
//			that's a lot of converting.
//

//	NOTE: Variance is generally assumed to be +/- value.
//	e.g. a variance of 10 means from -10 to +10
rat.modules.add( "rat.graphics.r_particle",
[
	{name: "rat.math.r_math", processBefore: true},
	
	"rat.debug.r_console",
	"rat.debug.r_profiler",
	"rat.graphics.r_graphics",
	"rat.math.r_vector",
	"rat.graphics.r_image"
], 
function(rat)
{
	var math = rat.math;
	//var clamp = math.clamp;
	//var Interp = math.interp;
	var RandomVariance = math.randomVariance;
	
	rat.particle = {
		systems: [],
		stateCaching: {
			enabled: true,		//	Will rat cache the particle state objects
			minObjectCount: 0,	// If caching state objects, the system will create this number of state objects to populate the cached when you launch the game
			createPerFrame: 0	// If rat is trying to meet the minObjectCount for the state objects, how many will we create per frame.  0 = all.  If not zero, rat.cycleUpdate is required
		},
	};

	//===============================================
	//------------- particle systems ----------------
	//===============================================

	/**
	 * @constructor
	 */
	rat.particle.System = function (options)	//	constructor for particle system
	{
		this.options = options;
		this.emitters = [];
	};

	//	Some event style callbacks for adding an emitter, removeing an emitter and creating an emitter
	rat.particle.System.prototype.onRemoveEmitter = void 0;
	rat.particle.System.prototype.onAddEmitter = void 0;
	rat.particle.System.prototype.emitterConstructor = void 0;

	//	particle system constants
	rat.particle.System.infinite = -1;
	rat.particle.System.statusDead = 0;
	rat.particle.System.statusActive = 1;
	rat.particle.System.statusAlive = 1;

	rat.particle.System.emitTypeUnknown = 0;
	rat.particle.System.emitTypeSingle = 1;
	rat.particle.System.emitTypeBurst = 2;
	rat.particle.System.emitTypeStream = 3;

	rat.particle.System.killParticles = true;	//	argument to killAllEmitters() below

	rat.particle.System.RENDER_UNKNOWN = 0;	//	hasn't been correctly set up yet.
	rat.particle.System.RENDER_DOT = 1;
	rat.particle.System.RENDER_TRIANGLE = 2;
	rat.particle.System.RENDER_BOX = 3;
	rat.particle.System.RENDER_SPRITE = 4;
	rat.particle.System.RENDER_TEXT = 5;
	rat.particle.System.RENDER_CUSTOM = 10;

	//-------------
	//	create new emitter in this system
	rat.particle.System.prototype.newEmitter = function ()
	{
		var Ctor = this.emitterConstructor || rat.particle.Emitter;
		var emitter = new Ctor();
		this.emitters.push(emitter);
		if (this.options && this.options.trackBounds)
			emitter.trackBounds = this.options.trackBounds;
		
		//alert("ecount: " + this.emitters.length);
		if (this.onAddEmitter)
			this.onAddEmitter(emitter);
		return emitter;
	};

	//-------------
	//	return total emitter count in this system
	rat.particle.System.prototype.getEmitterCount = function ()
	{
		return this.emitters.length;
	};

	//-------------
	//	kill all emitters in this system
	rat.particle.System.prototype.killAllEmitters = function (killParticles)
	{
		if(killParticles === void 0)
			killParticles = true;	//	let's assume you usually want to clear everything out...
		for(var i = this.emitters.length - 1; i >= 0; i--)
		{
			this.emitters[i].die(killParticles);
		}
	};

	//-------------
	//	kill all particles in this whole system without killing the emitters.
	//	e.g. if they're still emitting, there will be more soon.
	//	NOTE:  You might want killAllEmitters() above, instead.
	rat.particle.System.prototype.killAllParticles = function ()
	{
		for(var i = this.emitters.length - 1; i >= 0; i--)
		{
			this.emitters[i].killAllParticles();
		}
	};

	//-------------
	//	move this emitter to the top visually (last in list)
	rat.particle.System.prototype.moveEmitterToTop = function (emitter)
	{
		for(var i = this.emitters.length - 1; i >= 0; i--)
		{
			if(this.emitters[i] === emitter)
			{
				this.emitters.splice(i, 1);
				this.emitters.push(emitter);
				return;
			}
		}
	};
	
	//-------------
	//	remove this emitter from the system.
	//	Note that you generally want something else, like to mark an emitter as dead.
	//	This is a specialized function for yanking an emitter out of the system (not deleting it)
	//	useful for things like storing it and putting it back in later, or putting it in another system.
	rat.particle.System.prototype.removeEmitter = function (emitter)
	{
		for(var i = this.emitters.length - 1; i >= 0; i--)
		{
			if(this.emitters[i] === emitter)
			{
				if (this.onRemoveEmitter)
					this.onRemoveEmitter(this.emitters[i]);
				this.emitters.splice(i, 1);
				return;
			}
		}
	};
	
	//-------------
	//	Explicitly append this existing emitter to this system's list.
	//	This is a specialized function that assumes correct creation of the emitter.
	//	Generally, you want newEmitter() instead.
	rat.particle.System.prototype.appendEmitter = function (emitter)
	{
		this.emitters.push(emitter);
		if (this.onAddEmitter)
			this.onAddEmitter(emitter);
	};

	//-------------
	//
	//	Update all emitters in this system
	//
	rat.particle.System.prototype.update = function (dt)
	{
		rat.profiler.pushPerfMark("PSystem:Update");
		for(var i = this.emitters.length - 1; i >= 0; i--)
		{
			var status = this.emitters[i].update(dt);
			if(status === rat.particle.System.statusDead)
			{
				this.emitters[i].destroy();
				if (this.onRemoveEmitter)
					this.onRemoveEmitter(this.emitters[i]);
				this.emitters.splice(i, 1);
			}
		}
		rat.profiler.popPerfMark("PSystem:Update");
	};

	//-------------
	//	Render this entire particle system, all emitters and particles.
	rat.particle.System.prototype.draw = function (options)
	{
		rat.profiler.pushPerfMark("PSystem:draw");
		var useCtx;
		if (options && options.ctx)
			useCtx = options.ctx;
		else
			useCtx = rat.graphics.getContext();
		var oldCtx = rat.graphics.getContext();
		rat.graphics.setContext(useCtx);
		rat.graphics.save({ ignoreRatMat: true });
		
		for(var i = 0; i < this.emitters.length; i++)
		{
			this.emitters[i].draw(useCtx);
		}
		
		rat.graphics.restore();
		rat.graphics.setContext(oldCtx);
		rat.profiler.popPerfMark("PSystem:draw");
	};
	
	//-------------
	//	translate all my emitter bounds to rectangle list (e.g. dirtyRects list) info.
	rat.particle.System.prototype.applyBoundsToRectList = function(rectList)
	{
		for(var i = 0; i < this.emitters.length; i++)
		{
			var e = this.emitters[i];
			if (e.trackBounds)
			{
				//if (e.prevBounds.w > 0 && e.prevBounds.h > 0)
				//	rectList.add(e.prevBounds);
				if (e.bounds.w > 0 && e.bounds.h > 0)
					rectList.add(e.bounds);
			}
		}
	};
	//	old deprecated name
	rat.particle.System.prototype.applyToDirtyRects = rat.particle.System.prototype.applyBoundsToRectList;

	//=======================================
	//------------- emitters ----------------
	//=======================================

	//-------------
	//	emitter constructor
	//var createdEmitters = 0;
	/**
	 * @constructor
	 */
	rat.particle.Emitter = function ()
	{
		//rat.console.log( "Created " + ( ++createdEmitters ) + " Emitters!" );
		this.pos = new rat.Vector(100, 100);	//	default, should be set externally
		this.angle = new rat.Angle();	//	default create our own, may be replaced with ref to some external angle
		this.startState = rat.particle.State.create();	//	to be set up externally, we presume.
		this.startVariance = rat.particle.State.create();	//	empty, default 0 values, no variance!

		this.asset = [];
		this.stateSets = [];	//	list of states and variances {state: state, variance: variance}
		this.stateSets[0] = { state: this.startState, variance: this.startVariance };

		//	by default, end and start the same, and if one changes, change the other.  If client wants end state unique,
		//	then need to do something like myEmitter.endState = myEmitter.startState.copy() or call initEndState...
		//	Note:  this is less and less useful?  It may just be a shortcut for clients at this point.
		this.endState = this.startState;

		//	some more reasonable start values, for debugging ease, mostly, so client doesn't have to be perfect to see anything...
		//this.startState.color.setWhite();	//	includes 1.0 alpha, which is important for ease of setup
		this.startState.color.a = 1.0;
		this.startState.color.r = 255;
		this.startState.color.g = 255;
		this.startState.color.b = 255;
		this.startState.ageLimit = 1;

		//	prepare to track total bounds of my particles, if requested.
		this.prevBounds = {x : this.pos.x, y : this.pos.y, w : 0, h : 0};
		this.bounds = {x : this.pos.x, y : this.pos.y, w : 0, h : 0};
		this.trackBounds = false;	//	but assume it's not desired, yet

		this.particles = [];	//	list of particles, starting empty
	};

	//	flags for emitters
	rat.particle.Emitter.fAutoDie = 0x0001;					//	auto die if we're ever out of particles
	rat.particle.Emitter.fAutoDieAfterAgeLimit = 0x0004;	//	after hitting age limit, set autodie flag (probably usually desired, if age limit)
	rat.particle.Emitter.fRadialStartVelocity = 0x0008;		//	start velocity is radial instead of x/y
	rat.particle.Emitter.fRadialStartOffset = 0x0010;		//	start position offset is radial distance instead of x/y
	rat.particle.Emitter.fEmitting = 0x0100;				//	start/stop emitting
	rat.particle.Emitter.fEmitImmediately = 0x0200;			//	start timer advanced to emit point
	rat.particle.Emitter.fStroke = 0x0800;					//	text: stroke
	rat.particle.Emitter.fGlobalVelocity = 0x1000;			//	global velocity for initial particles, not emitter relative
	rat.particle.Emitter.fGlobalOffset = 0x2000;			//	global offset for initial particle position, not emitter relative

	// Initial state of emitters.   ONLY PUT VALUES THAT ARE COPIED BY VALUE, NOT REFERENCE(like objects)
	rat.particle.Emitter.prototype.flags = rat.particle.Emitter.fEmitting;	// behavior flags: by default, no autodie, etc.
	rat.particle.Emitter.prototype.emitType = rat.particle.System.emitTypeStream;
	rat.particle.Emitter.prototype.renderType = rat.particle.System.RENDER_UNKNOWN;	//	by default, render boxes
	rat.particle.Emitter.prototype.rate = 10.0;		//	emit/burst per second (default, should be set externally)
	rat.particle.Emitter.prototype.burstCount = 1;	//	for burst types, how many times to burst, usually 1
	rat.particle.Emitter.prototype.burstAmount = 0;	//	for burst types, how much to burst at once
	rat.particle.Emitter.prototype.emitCounter = 0;	//	current counter (time) to next emit time
	rat.particle.Emitter.prototype.status = rat.particle.System.statusActive;	//	start alive
	rat.particle.Emitter.prototype.ageLimit = rat.particle.System.infinite;	//	emitter last forever by default
	rat.particle.Emitter.prototype.age = 0;	//	current age (time)
	rat.particle.Emitter.prototype.font = "";
	rat.particle.Emitter.prototype.fontSize = 0;
	rat.particle.Emitter.prototype.createEvent = null;	//	event (function) to call for each particle on create:  f(emitter, particle)
	rat.particle.Emitter.prototype.updateEvent = null;	//	event (function) to call for each particle on update
	rat.particle.Emitter.prototype.deathEvent = null;		//	event (function) to call for each particle on death
	rat.particle.Emitter.prototype.customDraw = null;		//	function to call to draw particle, if type is set to CUSTOM
	rat.particle.Emitter.prototype.isReadyForUse = false;//	so we know to do some optimizations/calculations before using for the first time

	//-------------
	//	set/clear flags
	rat.particle.Emitter.prototype.setFlag = function (flag)
	{
		this.flags |= flag;
	};
	rat.particle.Emitter.prototype.clearFlag = function (flag)
	{
		this.flags &= ~flag;
	};
	rat.particle.Emitter.prototype.isFlag = function (flag)
	{
		return ((this.flags & flag) !== 0);
	};

	//-------------
	//	start/stop emitting
	rat.particle.Emitter.prototype.startEmitting = function ()
	{
		this.setFlag(rat.particle.Emitter.fEmitting);
	};
	rat.particle.Emitter.prototype.stopEmitting = function ()
	{
		this.clearFlag(rat.particle.Emitter.fEmitting);
	};
	rat.particle.Emitter.prototype.isEmitting = function ()
	{
		return this.isFlag(rat.particle.Emitter.fEmitting);
	};

	//-------------
	//	Kill all my particles instantly.
	//	But leave me in whatever state I was in (e.g. still emitting)
	rat.particle.Emitter.prototype.killAllParticles = function ()
	{
		//	Cache the states from my particles
		if(rat.particle.stateCaching.enabled)
		{
			for(var index = 0, len = this.particles.length; index !== len; index++)
			{
				if(this.particles[index].destroy)
					this.particles[index].destroy();
			}
		}
		this.particles = [];
	};

	//-------------
	//	die - stop emitting, and delete emitter from system when particles are dead.
	//	that could be done manually by client, but this function makes it easy and obvious.
	rat.particle.Emitter.prototype.die = function (killParticles)
	{
		this.stopEmitting();
		this.setFlag(rat.particle.Emitter.fAutoDie);
		if(killParticles)
			this.killAllParticles();//	no more particles - will die next update because of autodie flag.
	};

	//-------------
	//	add an intermediate state
	//	keyTime and keyFlags can be undefined, in which case a defaults are assigned when readyForUse ends up getting called, eventually.
	//	See readyForUse() for more info.
	//	note:  keyTime here is actually an interpolation value from 0 to 1, not a literal time in seconds.
	//		also, keyTime is a START point for the given state.  state lengths are calculated automatically later.
	rat.particle.Emitter.prototype.addState = function (keyTime, keyFlags)
	{
		var newState = this.stateSets[this.stateSets.length - 1].state.copy();
		newState.keyTime = keyTime;
		newState.keyFlags = keyFlags;
		var entry = { state: newState, variance: rat.particle.State.create() };
		this.stateSets.push(entry);

		//rat.console.log("rpe: addstate " + this.stateSets.length);

		return entry;
	};

	//-------------
	//	get full initial state set with variance and key values and stuff
	rat.particle.Emitter.prototype.getInitState = function ()
	{
		return this.stateSets[0];
	};

	//-------------
	//
	//	Make the endstate different from the start state
	//	Convenience function, might make more sense to an outsider than doing things by hand.
	//
	rat.particle.Emitter.prototype.initEndState = function (keyTime, keyFlags)
	{
		var entry = this.addState(keyTime, keyFlags);
		this.endState = entry.state;
		return entry;
	};

	//-------------
	//	set up for standard burst
	rat.particle.Emitter.prototype.setupStandardBurst = function (amount)
	{
		this.emitType = rat.particle.System.emitTypeBurst;
		this.rate = 1;	//	not important for burst
		this.emitCounter = 1 / this.rate + 0.0001;	//	advance counter to do it right away at next update
		this.burstCount = 1;	//	burst once
		this.burstAmount = amount;	//	count per burst
	};

	//-------------
	//	return total number of particles being handled by this emitter
	rat.particle.Emitter.prototype.getParticleCount = function ()
	{
		return this.particles.length;
	};

	//-------------
	//	do some cleanup, calculations, etc. that can happen one time after setup and before use,
	//	to avoid doing it every frame, or on every setup call (e.g. flag setting)
	rat.particle.Emitter.prototype.readyForUse = function ()
	{
		//var	lastState;
		var state;
		var i;
		for(i = 0; i < this.stateSets.length; i++)
		{
			state = this.stateSets[i].state;

			//	put in key times if they weren't specified.
			//	These are spread evenly out, from 0 to 1.  E.g. if you have 4 keys (including start and end) you get 0.0, 0.33, 0.66, 1.0
			//	if a given key time has been specified, we leave it, and just set the others.
			if(typeof (state.keyTime) === 'undefined')
				state.keyTime = i / (this.stateSets.length - 1);	//	by default, even key times
			if(typeof (state.keyFlags) === 'undefined')
				state.keyFlags = 0;

			//	check if a numeric angle was specified...
			if(typeof(state.angle) !== 'object')
				state.angle = new rat.Angle(state.angle);
			
			//	detect if colors change over time at all.  Eventually, do this with other animated state vars.

			//	TODO:  Hmmm!  If the user sets an initial color with variance,
			//		and then doesn't want to override that calculated color later, how does he do so?  We kinda need something like "undefined" values
			//		for state variables, to mean "leave it like it is".
			//		This would apply to colors, and also things like angle.
			//			If an angle is defined in each key, then fine, interpolate (animate).  If not, then leave angle (or let it roll or whatever).

			//lastState = {state:this.state
		}
		//	check my own angle
		if(typeof(this.angle) !== 'object')
			this.angle = new rat.Angle(this.angle);

		//	calculate the length of time allocated to each key for convenience later
		//	(figure each one but the last one, which is always 0)
		for(i = 0; i < this.stateSets.length - 1; i++)
		{
			state = this.stateSets[i].state;
			state.keyTimeLength = this.stateSets[i + 1].state.keyTime - state.keyTime;
			//rat.console.log("key tl[" + i + "] " + state.keyTimeLength);
		}
		this.stateSets[this.stateSets.length - 1].state.keyTimeLength = 0;
		//	unless there's only 1 key, in which case its time length is simply 1
		if(this.stateSets.length === 1)
			this.stateSets[this.stateSets.length - 1].state.keyTimeLength = 1;
		//rat.console.log("key tl[" + (this.stateSets.length-1) + "] " + this.stateSets[this.stateSets.length-1].state.keyTimeLength);
		
		if (this.isFlag(rat.particle.Emitter.fEmitImmediately))
			this.emitCounter = 1 / this.rate + 0.0001;	//	advance counter to spawn right away on next update
		
		this.isReadyForUse = true;
	};

	//-------------
	//
	//	Update emitter, updates the emitter's particles
	//	return status.
	//
	rat.particle.Emitter.prototype.update = function (dt)
	{
		if(this.renderType === rat.particle.System.RENDER_UNKNOWN)	//	the emitter has not been set up.  Just kill it.
			return rat.particle.System.statusDead;

		var emitterStatus;

		rat.profiler.pushPerfMark("Emitter.update");

		if(!this.isReadyForUse)
			this.readyForUse();
		var i;
		
		if (this.trackBounds)
		{
			this.prevBounds = this.bounds;
			this.bounds = {x:this.pos.x, y:this.pos.y, w:0, h:0};	//	todo: hrm... set to some clearly identified "not set yet" value instead?  is pos legit here?
		}

		if(this.rate > 0 && this.isEmitting())	//	if we're emitting, handle emission at our rate
		{
			this.emitCounter += dt;
			if(this.emitCounter > 1 / this.rate)
			{
				rat.profiler.pushPerfMark("Emitting");
				//	reset counter
				this.emitCounter -= 1 / this.rate;	//	don't just set to 0, factor in how far we actually progressed
				///@todo support emitting more if the rate was faster than our DT.  Right now we're assuming 1.
				///@todo support retroactively putting the particles in the right place, retroactively, and setting their life correctly, etc...
				///@todo support applying emit rate variance every time counter is calculated again.

				//	emit, depending on type
				if(this.emitType === rat.particle.System.emitTypeStream)
				{
					this.spawnNewParticle();

				} else if(this.emitType === rat.particle.System.emitTypeBurst && this.burstCount > 0)
				{
					for(i = 0; i < this.burstAmount; i++)
					{
						this.spawnNewParticle();
					}
					this.burstCount--;
					if(this.burstCount <= 0)
					{
						this.rate = 0;	//	done with our burst count, don't burst any more
						this.stopEmitting();	//	just in case, but generally not used with burst emitters?
					}
				}
				rat.profiler.popPerfMark("Emitting");
			}
		}

		//	Update my particles, including deleting dead ones.
		rat.profiler.pushPerfMark("p.update");
		var curP;
		for (i = this.particles.length - 1; i >= 0; i--)
		{
			curP = this.particles[i];
			var status = curP.update(dt, this);
			if (status === rat.particle.System.statusDead)
			{
				if (this.deathEvent)	//	is there a registered create event function to call?
				{
					this.deathEvent(this, curP);
				}
				
				if (this.particles[i].destroy )
					this.particles[i].destroy();
				this.particles.splice(i, 1);
			} else {	//	not dead
				//	track bounds.  We could be rotated, so be generous.
				//	but rotation worst case will add sqrt(2)... or about 1.414,
				//	thus the 1.5 values below.
				//	and we subtract half that for x/y pos
				if (this.trackBounds)
				{
					this.addToBounds(curP.state.pos.x - curP.state.size*0.75, curP.state.pos.y - curP.state.size*0.75,
							curP.state.size * 1.5, curP.state.size * 1.5);
				}

				/*	this should all be handled in update() call above.
				//	this is hardcoded for now... start/end states only.
				//	heck, let's just hack colors and a few other things for now...
				var interp = curat.particle.age / curat.particle.ageLimit;
				interp = clamp(interp, 0, 1);
				curat.particle.color.a = Interp(this.startState.color.a, this.endState.color.a, interp);
			
				//	would also be nice to animate emitter values like rate...!
				//	think about more general animation systems for sets of values?  an animated keyframed set of values just spits out
				//	automatically into a new struct, and people just access the struct?  Don't overdo it... 
			
				//	update stuff
				curat.particle.angle.angle += curat.particle.roll * dt;
				*/
			}
			
		}
		rat.profiler.popPerfMark("p.update");

		///@todo	check for particle death event support
		///@todo	check for particle update event support

		//	check for emitter age death
		rat.profiler.pushPerfMark("statusUpdate");
		this.age += dt;
		//	age limit stops an emitter from emitting when it has reached this age
		if(this.ageLimit > 0 && this.age > this.ageLimit)
		{
			//this.rate = 0;	//	stop spawning
			this.stopEmitting();	//	use new flag instead so isEmitting can be used to detect this.

			if(this.flags & rat.particle.Emitter.fAutoDieAfterAgeLimit)
				this.flags |= rat.particle.Emitter.fAutoDie;	//	now, autodie when our particles are finished

			//	maybe support a flag that instantly kills on age limit?
			//return rat.particle.System.statusDead;
		}

		//	check for emitter autodeath if no particles are left.
		//	note that this happens after emitter checks above, so a newly created emitter has a chance to create particles first.
		if(this.flags & rat.particle.Emitter.fAutoDie)
		{
			if(this.particles.length <= 0)
			{
				//rat.console.log("*** autodie!");
				emitterStatus = rat.particle.System.statusDead;
			}
		}
		else
		{
			emitterStatus = rat.particle.System.statusActive;
		}
		rat.profiler.popPerfMark("statusUpdate");

		//	by default, we're still alive
		rat.profiler.popPerfMark("Emitter.update");
		return emitterStatus;
	};

	//-------------
	//
	//	Destroy this emitter
	//
	rat.particle.Emitter.prototype.destroy = function ()
	{
		this.killAllParticles();
		if(rat.particle.stateCaching.enabled)
		{
			for(var index = 0, len = this.stateSets.length; index !== len; ++index)
			{
				rat.particle.State.destroy(this.stateSets[index].state);
				rat.particle.State.destroy(this.stateSets[index].variance);
			}
			this.stateSets = [];
		}
	};

	//-------------
	//
	//	Spawn new particle from this emitter
	//
	rat.particle.Emitter.prototype.spawnNewParticle = function ()
	{
		rat.profiler.pushPerfMark("spawnNewParticle");

		var particle = new rat.particle.One();
		var asset;
		var rad;

		//	OK, let's generate this particle's various state variables right now, based on emitter's state list and variances
		var sets = this.stateSets;
		var state, base, variance;
		rat.profiler.pushPerfMark("setupStates");
		for(var i = 0, len = sets.length; i !== len; ++i)
		{

			state = rat.particle.State.create();
			//	for easy access in particle later - could use emitter's values, but this leads to shorter code
			base = sets[i].state;
			variance = sets[i].variance;

			//	build the state
			state.keyTime = base.keyTime;
			state.keyTimeLength = base.keyTimeLength;
			state.size = base.size;
			state.grow = base.grow;
			state.roll = base.roll;
			state.friction = base.friction;
			state.color.r = base.color.r;
			state.color.g = base.color.g;
			state.color.b = base.color.b;
			state.color.a = base.color.a;

			//	Handle variance of the state fields
			if(variance.size)
				state.size += (variance.size * 2 * math.random() - variance.size);
			if(variance.grow)
				state.grow += (variance.grow * 2 * math.random() - variance.grow);
			if(variance.roll)
				state.roll += (variance.roll * 2 * math.random() - variance.roll);
			if(variance.friction)
				state.friction += (variance.friction * 2 * math.random() - variance.friction);
			if(variance.color.r)
			{
				state.color.r += (variance.color.r * 2 * math.random() - variance.color.r);
				state.color.r = ((state.color.r < 0) ? 0 : ((state.color.r > 255) ? 255 : (state.color.r | 0)));
			}
			if(variance.color.g)
			{
				state.color.g += (variance.color.g * 2 * math.random() - variance.color.g);
				state.color.g = ((state.color.g < 0) ? 0 : ((state.color.g > 255) ? 255 : (state.color.g | 0)));
			}
			if(variance.color.b)
			{
				state.color.b += (variance.color.b * 2 * math.random() - variance.color.b);
				state.color.b = ((state.color.b < 0) ? 0 : ((state.color.b > 255) ? 255 : (state.color.b | 0)));
			}
			if(variance.color.a)
			{
				state.color.a += (variance.color.a * 2 * math.random() - variance.color.a);
				state.color.a = ((state.color.a < 0) ? 0 : ((state.color.a > 1) ? 1 : state.color.a));
			}

			// This state is part of the particle
			particle.states[i] = state;
		}
		rat.profiler.popPerfMark("setupStates");

		//	and set initial "now" state
		rat.profiler.pushPerfMark("initialState");
		particle.state.size = particle.states[0].size;
		particle.state.grow = particle.states[0].grow;

		// was this, but sometimes we failed to receive a proper new Color object, so setting this manually for now

		//particle.state.color.copyFrom(particle.states[0].color);
		particle.state.color.a = particle.states[0].color.a;
		particle.state.color.r = particle.states[0].color.r;
		particle.state.color.g = particle.states[0].color.g;
		particle.state.color.b = particle.states[0].color.b;

		particle.state.friction = particle.states[0].friction;
		particle.state.roll = particle.states[0].roll;

		//	Set a bunch of properties for the new particle based on emitter flags, startState, and startVariance.
		//	These properties don't animate based on keyframes - they're initialized here and modified over time with
		//	unique logic, like acceleration being gravity...

		//	start at emitter position
		//	ref...
		//particle.state.pos = new rat.Vector(this.pos.x, this.pos.y)
		//	pos already exists, and might be being tracked.  Don't create new one.
		particle.state.pos.x = this.pos.x;
		particle.state.pos.y = this.pos.y;
		//	note that emitter pos may not be a Vector, depending on client usage

		//	offset based on emitter properties
		var offset = new rat.Vector();
		if(this.flags & rat.particle.Emitter.fRadialStartOffset)	//	radial space for offset
		{
			//	find a random radial vector, and then scale it with just the X value
			rad = math.random() * math.PI2;
			offset.setFromAngle(rad);
			offset.scale(this.startState.offset.x + RandomVariance(this.startVariance.offset.x));
		} else
		{
			offset.x = this.startState.offset.x + RandomVariance(this.startVariance.offset.x);
			offset.y = this.startState.offset.y + RandomVariance(this.startVariance.offset.y);
		}
		if(!this.isFlag(rat.particle.Emitter.fGlobalOffset))
			offset = this.angle.rotateVector(offset);
		particle.state.pos.x += offset.x;
		particle.state.pos.y += offset.y;

		particle.state.angle.angle = this.angle.angle;//	start by matching emitter angle
		//	then add state settings
		particle.state.angle.angle += this.startState.angle.angle + RandomVariance(this.startVariance.angle.angle);
		//	todo: support a flag to use absolute angles instead of emitter relative?

		if(this.flags & rat.particle.Emitter.fRadialStartVelocity)	//	radial space
		{
			//	so, how do we do this?
			//	find a random radial vector, and then scale it with just the X value and x variance...?
			rad = math.random() * math.PI2;
			particle.state.vel = new rat.Vector();
			particle.state.vel.setFromAngle(rad);
			particle.state.vel.scale(this.startState.vel.x + RandomVariance(this.startVariance.vel.x));

		} else
		{	//	normal square space
			particle.state.vel = new rat.Vector(
					this.startState.vel.x + RandomVariance(this.startVariance.vel.x)
					, this.startState.vel.y + RandomVariance(this.startVariance.vel.y)
					);	//	in units (pixels) per second
		}

		particle.state.accel = new rat.Vector(
				this.startState.accel.x + RandomVariance(this.startVariance.accel.x)
				, this.startState.accel.y + RandomVariance(this.startVariance.accel.y)
				);	//	in units (pixels) per second per second

		//	rotate calculated vel to match emitter angle at this instant.
		if(!this.isFlag(rat.particle.Emitter.fGlobalVelocity))
			particle.state.vel = this.angle.rotateVector(particle.state.vel);
		//	note: do NOT rotate accel, which is assumed to be in world space, not emitter space.
		//	if we need support for that later, we can add it.  TODO:  relative accel, also radial accel!

		particle.ageLimit = this.startState.ageLimit + RandomVariance(this.startVariance.ageLimit);
		rat.profiler.popPerfMark("initialState");

		//	set up particle asset reference, e.g. sprite for sprite particles.
		//	for now, if asset hasn't loaded yet, set null asset.
		particle.asset = null;
		if(this.renderType === rat.particle.System.RENDER_SPRITE)
		{
			asset = this.asset;
			if(this.assetSpawnFunction)
			{
				asset = this.assetSpawnFunction(this);
			}

			if(Array.isArray(asset))	//	allow the emitter's asset to be a list of assets
				asset = asset[(math.random() * asset.length) | 0];

			particle.setImageAsset(asset);

		} else if(this.renderType === rat.particle.System.RENDER_TEXT)
		{
			//	for text, asset is string (or list of strings)
			asset = this.asset;
			if(Array.isArray(this.asset))
				asset = this.asset[(math.random() * this.asset.length) | 0];
			particle.text = asset;
		}

		if(this.createEvent)	//	is there a registered create event function to call?
		{
			rat.profiler.pushPerfMark("createEvent");
			var res = this.createEvent(this, particle);
			rat.profiler.popPerfMark("createEvent");
			if(res === false)
			{
				//	OK, just kidding!  don't add this to our list.  Lose it.
				rat.profiler.popPerfMark("spawnNewParticle");
				return;
			}
		}
		
		//	track space used (add to bounds)
		//	see other call to addToBounds for notes.
		if (this.trackBounds)
		{
			this.addToBounds(particle.state.pos.x - particle.state.size*0.75, particle.state.pos.y - particle.state.size*0.75,
					particle.state.size * 1.5, particle.state.size * 1.5);
		}

		//	add to my particle list
		this.particles.push(particle);

		rat.profiler.popPerfMark("spawnNewParticle");
	};
	
	//-------------
	//	util to add a point (with space) to the bounds we're tracking.
	rat.particle.Emitter.prototype.addToBounds = function (x, y, w, h)
	{
		//	faster approach to this math?  Or store differently?
		//	This seems unoptimal...
		if (x < this.bounds.x)
		{
			this.bounds.w += (this.bounds.x - x);
			this.bounds.x = x;
		}
		if (y < this.bounds.y)
		{
			this.bounds.h += (this.bounds.y - y);
			this.bounds.y = y;
		}
		if (x + w > this.bounds.x + this.bounds.w)
			this.bounds.w = x + w - this.bounds.x;
		if (y + h > this.bounds.y + this.bounds.h)
			this.bounds.h = y + h - this.bounds.y;
	};
	
	//-------------
	//	explicitly spawn N new particles from this emitter.
	rat.particle.Emitter.prototype.spawn = function (count)
	{
		if(typeof (count) === 'undefined')
			count = 1;
		for(var i = 0; i < count; i++)
		{
			this.spawnNewParticle();
		}
	};

	//	Utility function to calculate start value +/- variance for a named member of the particle structure
	//	This function accesses normal object properties by string name,
	//	which confuses the google compiler.
	//	So... let's try this a different way.  Ugh, can't come up with a better way.
	//	I'm replacing all use of this function for now... see above.
	// intead do: this.foo.startState.bar + RandomVariance(this.foo.startVariance.bar);
	//rat.particle.Emitter.prototype.startWithVar = function(field)
	//{
	//	return this.startState[field] + RandomVariance(this.startVariance[field]);
	//}

	//-------------
	//
	//	Draw my particles.
	//
	rat.particle.Emitter.prototype.draw = function (ctx)
	{
		rat.profiler.pushPerfMark("Emitter.Draw");

		if(this.preDraw)
			this.preDraw(ctx, this);
		var scale;

		//	setup that's universal for all particles
		var stroke = false;
		if(this.renderType === rat.particle.System.RENDER_TEXT)
		{
			ctx.textBaseline = 'middle';
			ctx.textAlign = 'center';
			if(this.flags & rat.particle.Emitter.fStroke)
				stroke = true;
		}

		//	actual draw for each particle
		rat.profiler.pushPerfMark("particle.Draw");
		for(var i = 0; i < this.particles.length; i++)
		{
			
			//	if this ever gets too slow, maybe collapse the draw function into this one?
			//	would make polymorphism a lot harder...  probably won't be slow.
			//	Hmm...  actually, we really should have the behavior of these particles determined by the emitter.
			//	so, the draw should be here anyway, even if it's a separate function, which may not be necessary.
			//this.particles[i].draw(ctx);

			//	context save/restore is necessary so we can rotate below and have it be relative to particle
			//	Although...  An alternative might be to rotate, and then rotate back.
			//	this context save/restore is theoretically expensive.
			//	Also, we could first test if rotate is being used?
			var p = this.particles[i];
			var ps = p.state;
			//	Bypass the rat gfx and directly access the context here.
			ctx.save();
			ctx.translate(ps.pos.x, ps.pos.y);
			
			//	temp test...
			/*
			if (ps.pos.x < this.bounds.x || ps.pos.y < this.bounds.y
				|| ps.pos.x > this.bounds.x + this.bounds.w
				|| ps.pos.y > this.bounds.y + this.bounds.h)
			{
				console.log("ugh");
			}
			*/
			
			if(ps.angle.angle)
				ctx.rotate (ps.angle.angle);
			//rat.graphics.save();
			//rat.graphics.translate(ps.pos.x, ps.pos.y, ctx);
			//if(ps.angle.angle)
			//	rat.graphics.rotate(ps.angle.angle, ctx);

			///@todo	switch this to function reference or lambda, to avoid check every time through loop...
			if(this.renderType === rat.particle.System.RENDER_BOX)
			{
				scale = ps.size;
				ctx.fillStyle = ps.color.toString();//"#6040FF";
				ctx.fillRect(-scale / 2, -scale / 2, scale, scale);

			} else if(this.renderType === rat.particle.System.RENDER_TRIANGLE)	//	maybe generic RENDER_POLYGON instead
			{
				var radius = ps.size / 2;
				var rotInc = math.PI2 / 3;	//	3 sides
				ctx.fillStyle = ps.color.toString();

				ctx.beginPath();

				ctx.moveTo(radius, 0);
				ctx.lineTo(math.cos(rotInc) * radius, math.sin(rotInc) * radius);
				ctx.lineTo(math.cos(2 * rotInc) * radius, math.sin(2 * rotInc) * radius);

				ctx.closePath();
				ctx.fill();

			} else if(this.renderType === rat.particle.System.RENDER_DOT)
			{
				ctx.fillStyle = ps.color.toString();//"#6040FF";
				ctx.beginPath();
				scale = ps.size / 2;	//	radius! (half size)
				ctx.arc(0, 0, scale, 0, math.PI * 1.9999, false);
				ctx.closePath();
				ctx.fill();

			} else if(this.renderType === rat.particle.System.RENDER_SPRITE)
			{
				if(p.asset)	//	if particle has valid asset reference, use that.
				{
					ctx.globalAlpha = ps.color.a;

					//	scale to the size of the particle, not the image size.
					//	(these scaleWidth factors are usually 1, but can be something else if the image is not square)
					var sw = ps.size * p.scaleWidth;
					var sh = ps.size * p.scaleHeight;

					if(p.asset.isImageRef)
					{
						//	The following code is an extracted and optimized version of the draw call.
						////p.asset.draw(ctx, 0, 0, sw, sh);
						//p.asset.image.draw(ctx, p.asset.frame, 0, 0, sw, sh, p.asset.flags);
						var img = p.asset.image;
						var frameNum = p.asset.frame;
						var flags = p.asset.flags;
						var sheetStyle = !!(img.frames);	//	is this a spritesheet style image?
						var frameImage = img.getImageFrame(sheetStyle ? 0 : frameNum);
						var offsetX = 0;
						var offsetY = 0;
						//	easy version - single frame
						if(frameImage)
						{
							if(!sheetStyle)
							{
								if(flags & rat.graphics.Image.centeredX)
									offsetX = -sw / 2;
								if(flags & rat.graphics.Image.centeredY)
									offsetY = -sh / 2;
								ctx.drawImage(frameImage, offsetX, offsetY, sw, sh);
								
								//	temp debug - show space we're drawing in
								//ctx.strokeStyle = "#FF80FF";
								//ctx.lineWidth = 2;
								//ctx.strokeRect(offsetX, offsetY, sw, sh);
							}
							else
							{
								var curFrame = img.frames[frameNum];

								//	adapt w and h to relative w/h based on trimmed size
								
								//	first, how much does client want to scale from the original source image size?
								var wscale = sw / curFrame.origSize.w;
								var hscale = sh / curFrame.origSize.h;
								//	and, since we'll be drawing from a smaller space in the sheet, if the image was trimmed,
								//	then figure out effective width of that...
								var ew = curFrame.box.w * wscale;
								var eh = curFrame.box.h * hscale;

								offsetX = curFrame.trimRect.x * wscale;	//	account for trim
								offsetY = curFrame.trimRect.y * hscale;
								if(flags & rat.graphics.Image.centeredX)
									offsetX -= sw / 2;	//	center based on desired render size, not trimmed image
								if(flags & rat.graphics.Image.centeredY)
									offsetY -= sh / 2;
								ctx.drawImage(frameImage, curFrame.drawBox.x, curFrame.drawBox.y, curFrame.drawBox.w, curFrame.drawBox.h, offsetX, offsetY, ew, eh);
							}
						}
					}
					else
					{
						ctx.drawImage(p.asset, 0, 0, p.asset.width, p.asset.height, -sw / 2, -sh / 2, sw, sh);
					}
				}

			} else if(this.renderType === rat.particle.System.RENDER_TEXT)
			{
				ctx.font = (ps.size * this.fontSize) + 'pt ' + this.font;//(p.size * this.fontSize) + this.font;
				//	or?
				//rat.graphics.scale(p.size * this.fontSize, ctx);

				if(stroke)
				{
					//	todo - support second color per particle for this kind of thing
					//	and it needs to be animated, fade, etc...
					//	for now, stroke at a much darker color of the same
					ctx.strokeStyle = "rgba(" + (ps.color.r >> 3) + "," + (ps.color.g >> 3) + "," + (ps.color.b >> 3) + "," + ps.color.a + ")";
					ctx.lineWidth = 3;
					ctx.strokeText(p.text, -ps.size / 2, 0);
				}
				ctx.fillStyle = ps.color.toString();
				ctx.fillText(p.text, -ps.size / 2, 0);

			} else if(this.renderType === rat.particle.System.RENDER_CUSTOM)
			{
				//	don't draw.  See customDraw call below
				//	I'm making that separate so you can have a custom draw in addition to build-in draw.
			} else
			{
				//alert("unknown render type");
				rat.console.log("Error:  Unknown particle render type");
			}

			if(this.customDraw)
			{
				var emitter = this;
				this.customDraw(ctx, p, emitter);	//	note: custom draw happens in translated/rotated space	
			}

			//rat.graphics.restore();
			ctx.restore();
		}
		rat.profiler.popPerfMark("particle.Draw");
		
		//	temp debug - show emitter location
		//ctx.fillStyle = "#FFFF80";
		//ctx.fillRect(this.pos.x - 10, this.pos.y - 10, 20, 20);

		if(this.postDraw)
			this.postDraw(ctx, this);

		rat.profiler.popPerfMark("Emitter.Draw");
	};

	//-------------
	//	convenience function to set additive pre/post draw functions
	rat.particle.Emitter.prototype.setAdditive = function ()
	{
		this.preDraw = rat.particle.Emitter.preDrawAdditive;
		this.postDraw = rat.particle.Emitter.postDrawAdditive;
	};

	//	some standard useful predraw stuff
	rat.particle.Emitter.preDrawAdditive = function (ctx, emitter)
	{
		emitter.oldOperation = ctx.globalCompositeOperation;
		ctx.globalCompositeOperation = 'lighter';
	};
	rat.particle.Emitter.postDrawAdditive = function (ctx, emitter)
	{
		ctx.globalCompositeOperation = emitter.oldOperation;
	};

	//===========================================================================
	//-------------- classes for individual particles and states ----------------
	//===========================================================================

	//	state variables - these are initial, intermediate, or end states for a particle,
	//	as well as a particle's current state,
	//	or variance values for those same states.
	//var createdStates = 0;
	/**
	 * @constructor
	 */
	rat.particle.State = function ()
	{
		//rat.console.log( "Created " + ( ++createdStates ) + " Particle States!" );
		this.pos = new rat.Vector();
		this.offset = new rat.Vector();
		this.angle = new rat.Angle();
		this.vel = new rat.Vector();
		this.accel = new rat.Vector();
		this.color = new rat.graphics.Color(0, 0, 0, 0);
		this.protoObject = rat.particle.State.prototype;
	};
	rat.particle.State.prototype.size = 0;
	rat.particle.State.prototype.grow = 0;
	rat.particle.State.prototype.roll = 0;
	rat.particle.State.prototype.ageLimit = 0;
	rat.particle.State.prototype.friction = 0;
	rat.particle.State.prototype.nextInCache = void 0;
	/**
	 * Reset this state object as though it had just been newed
	 */
	rat.particle.State.prototype.reset = function()
	{
		// By val types.
		this.size = this.protoObject.size;
		this.grow = this.protoObject.grow;
		this.roll = this.protoObject.roll;
		this.ageLimit = this.protoObject.ageLimit;
		this.friction = this.protoObject.friction;
		this.nextInCache = void 0;
		
		//	we depend on keyTime and keyLength starting undefined,
		//	so we can know if the user has set them explicitly.
		//	That was undocumented, and the new state caching broke that.  My fault, really. (STT)
		//	let's try this to reset them to undefined...
		//	Alternatively, we could set up new values that mean "undefined", like -1
		var uu;	//	undefined
		this.keyTime = uu;
		this.keyFlags = uu;

		//	Objects created during the initialization process
		this.pos.x = 0;
		this.pos.y = 0;
		this.offset.x = 0;
		this.offset.y = 0;
		this.angle.angle = 0;
		this.vel.x = 0;
		this.vel.y = 0;
		this.accel.x = 0;
		this.accel.y = 0;
		this.color.r = 0;
		this.color.g = 0;
		this.color.b = 0;
		this.color.a = 0;
	};
	rat.particle.State.prototype.copy = function ()
	{
		var p = rat.particle.State.create();

		//	copy all atomic variables automatically
		// JHS This destroys the different vectors/angles/colors and makes us re-create the
		//for (var e in this) {
		//  p[e] = this[e];
		//}
		//	Simple By-Val copy
		p.size = this.size;
		p.grow = this.grow;
		p.roll = this.roll;
		p.ageLimit = this.ageLimit;
		p.friction = this.friction;
		p.keyTime = this.keyTime;
		p.keyFlags = this.keyFlags;

		//	Complex types need to be copied field by field
		p.pos.x = this.pos.x;
		p.pos.y = this.pos.y;
		p.offset.x = this.offset.x;
		p.offset.y = this.offset.y;
		p.angle.angle = this.angle.angle;
		p.vel.x = this.vel.x;
		p.vel.y = this.vel.y;
		p.accel.x = this.accel.x;
		p.accel.y = this.accel.y;
		p.color.r = this.color.r;
		p.color.g = this.color.g;
		p.color.b = this.color.b;
		p.color.a = this.color.a;

		return p;
	};
	/** The cache of state objects for the particle system */
	rat.particle.State.cache = void 0;
	/** The number of cached objects */
	rat.particle.State.cacheSize = 0;
	/** The of state objects that exist */
	rat.particle.State.count = 0;

	/// JHS Cache of state objects
	/**
	 * Get a new state object, either from the cache or create one
	 */
	rat.particle.State.create = function ()
	{
		if(rat.particle.State.cache)
		{
			var state = rat.particle.State.cache;
			rat.particle.State.cache = state.nextInCache;
			--rat.particle.State.cacheSize;
			state.reset();

			return state;
		}
		else
		{
			++rat.particle.State.count;
			return new rat.particle.State();
		}
	};
	/**
	 * Destroy a state object, and cache it.
	 */
	rat.particle.State.destroy = function (state)
	{
		if(state)
		{
			state.nextInCache = rat.particle.State.cache;
			rat.particle.State.cache = state;
			++rat.particle.State.cacheSize;
		}
	};

	/**
	 * Called once per frame in an attempt to fill the cache with some state objects to avoid hits to our framerate when creating lots of particles
	 * @param {number} deltaTime
	 */
	rat.particle.State.FillCache = function (deltaTime)
	{
		//	Create some state objects
		var leftToCreate = rat.particle.stateCaching.minObjectCount - rat.particle.State.count;
		if(leftToCreate > 0)
		{
			//	How many are we going to create?
			var howManyToCreate = math.min(leftToCreate, rat.particle.stateCaching.createPerFrame);
			for(var left = howManyToCreate; left > 0; --left)
			{	
				rat.particle.State.destroy(new rat.particle.State()); // If i use create, i get it from the cache I am trying to fill which is NOT what i want.
				++rat.particle.State.count;
			}
			leftToCreate -= howManyToCreate;
		}

		if( leftToCreate <= 0 )
		{
			//	We don't need to update anymore
			if( rat.cycleUpdate )
				rat.cycleUpdate.removeUpdater(rat.particle.State.FillCache);
		}
	};

	//
	//	A single particle
	//	This has a current state ("this.state"), and its own copy of a state array for interpolation over time.
	//	This is so we can calculate states with variance values from the emitter, but then stick to those calculated
	//	values when interpolating.
	//
	/**
	 * @constructor
	 */
	rat.particle.One = function ()
	{
		this.state = rat.particle.State.create();	//	my current state
		this.states = [];	//	my list of state keys (may be refs to emitter's state keys, if possible) (no variances)
		this.age = 0;
		this.ageLimit = 0;

		//	set up refs for convenience and external access?
		this.pos = this.state.pos;//new rat.Vector();	//	why not in "state"? maybe for easier external access
		//this.angle = this.state.angle;

		this.curKeyIndex = 0;	//	if we have state keyframes, start with first one
	};

	//	This may currently be unused?
	rat.particle.One.prototype.copy = function ()
	{
		var p = new rat.particle.One();

		//	copy all atomic variables automatically
		// JHS Again, this destroy vector and states forcing us to re-create them
		for(var e in this)
		{
			p[e] = this[e];
		}

		//	some things (complex types) need to be copied explicitly
		p.pos = this.pos.copy();
		p.state = this.state.copy();

		//	copy list of states
		var numStates = this.states.length;
		p.states = [];
		for(var i = 0; i < numStates; i++)
		{
			p.states[i] = this.states[i].copy();
		}

		return p;
	};

	//	single particle update function
	rat.particle.One.prototype.update = function (dt, e)
	{
		var s = this.state;

		s.size += s.grow * dt;
		if(s.size < 0)
			s.size = 0;

		//	decay velocity because of friction, if any (should be from emitter?)
		var vel = s.vel;
		var fric = s.friction;
		if(fric > 0)
		{
			fric = 1.0 - fric * dt;
			vel.x *= fric;
			vel.y *= fric;
		}

		//	apply new acceleration, if any (should be from emitter?)
		var accel = s.accel;
		vel.x += accel.x * dt;
		vel.y += accel.y * dt;

		//	apply velocity to position
		var pos = s.pos;
		pos.x += vel.x * dt;
		pos.y += vel.y * dt;

		//	roll
		s.angle.angle += s.roll * dt;

		//	interp some values based on keyframes.
		//	figure out how far long in time we are, and find the two appropriate keyframes to use
		//	todo:  curve interp somehow - maybe just use ease in/out
		//	todo:  optimize?  See note about skipping calculations below.
		//	todo:  optimize: skip all this calculation if there ARE no state keys.  Just keep our state and move on.  that happens often enough, right?

		var interp;	//	interp between appropriate key states
		var keyInterp = this.age / this.ageLimit;	//	total interp over life
		//keyInterp = clamp(interp, 0, 1);
		var stateCount = this.states.length;
		var segs = stateCount - 1;

		//starting with the current segment, see if our time is past the next segment's key time start,
		//	and if so, move our "current segment" marker up...
		for(var segIndex = this.curKeyIndex + 1; segIndex < segs; segIndex++)
		{
			if(keyInterp >= this.states[segIndex].keyTime)
				this.curKeyIndex = segIndex;
		}

		//var indexA = math.floor(segs * keyInterp);	//	this didn't allow for custom key timing
		var indexA = this.curKeyIndex;
		var indexB = indexA + 1;
		if(indexB > segs)
		{
			indexB = indexA;
			interp = 0;
		} else
		{
			//	calculate how far past A and toward B we are
			interp = (keyInterp - this.states[indexA].keyTime) / this.states[indexA].keyTimeLength;
			interp = ((interp < 0) ? 0 : ((interp > 1) ? 1 : interp));
		}

		//	Currently, this is the only thing that animates, really, for particles.
		//	todo - detect at setup if colors are ever changing, and skip calculations if not (set flag)
		//	See readyForUse function above, which would be a good time to do that.
		var invIVal = 1 - interp;
		var from = this.states[indexA];
		var to = this.states[indexB];
		if(to.color.r !== from.color.r) {
			var r = to.color.r * interp + invIVal * from.color.r;
			r = ((r < 0) ? 0 : ((r > 255) ? 255 : (r | 0)));
			s.color.r = r;
		} else {
			s.color.r = to.color.r;
		}
		if(to.color.g !== from.color.g) {
			var g = to.color.g * interp + invIVal * from.color.g;
			g = ((g < 0) ? 0 : ((g > 255) ? 255 : (g | 0)));
			s.color.g = g;
		} else {
			s.color.g = to.color.g;
		}
		if(to.color.b !== from.color.b) {
			var b = to.color.b * interp + invIVal * from.color.b;
			b = ((b < 0) ? 0 : ((b > 255) ? 255 : (b | 0)));
			s.color.b = b;
		} else {
			s.color.b = to.color.b;
		}
		if(to.color.a !== from.color.a) {
			var a = to.color.a * interp + invIVal * from.color.a;
			a = ((a < 0) ? 0 : ((a > 1) ? 1 : a));
			s.color.a = a;
		}else {
			s.color.a = to.color.a;
		}
				
		//	would also be nice to animate emitter values like rate...!
		//	think about more general animation systems for sets of values?  an animated keyframed set of values just spits out
		//	automatically into a new struct, and people just access the struct?  Don't overdo it... 

		if(this.asset && this.asset.isImageRef)
			this.asset.update(dt);

		this.age += dt;

		var status;
		if(this.age >= this.ageLimit)
		{
			status = rat.particle.System.statusDead;
		}
		else
			status = rat.particle.System.statusActive;
		
		return status;
	};

	/**
	 *	Set the rendering asset for this one particle to be this image.
	 * @param {?} asset
	 * @param {Object=} emitter
	 */
	rat.particle.One.prototype.setImageAsset = function (asset, emitter)
	{
		if (asset.isImageRef)
		{
			//	OK, half the point of imageRef is to support light references to images that can have their own
			//	animation timing!  So, let's do this right, and copy the imageref.
			this.asset = new rat.graphics.ImageRef(asset);
			//particle.assetIsImageRef = true;
			var size = asset.getSize();
			//	remember some values for proper scaling
			this.scaleWidth = 1;	//	by default, match width
			this.scaleHeight = size.h / size.w;

		} else
		{	//	normal image
			if(asset.width > 0 && asset.height > 0)	//	loaded and ready?
			{
				this.asset = asset;
				//	remember some values for proper scaling
				this.scaleWidth = 1;	//	by default, match width
				this.scaleHeight = asset.width / asset.height;
			}
		}
	};

	/*
	see above - currently we let the emitter draw its particles, so we don't have the overhead of a function call.
	rat.particle.One.prototype.draw = function(ctx)
	{
		//ctx.fillStyle = "rgba(100, 100, 200," + this.color.a + ")";
		ctx.fillStyle = this.color.toString();//"#6040FF";
		ctx.beginPath();
		var scale = 5;
		ctx.arc(this.pos.x, this.pos.y, scale, 0, math.PI * 2, true);
		ctx.closePath();
		ctx.fill();
	}
	*/

	/**
	 * Cleanup this single particle
	 */
	rat.particle.One.prototype.destroy = function ()
	{
		rat.particle.State.destroy(this.state);
		this.state = void 0;

		for(var i = 0, len = this.states.length; i !== len; ++i)
		{
			rat.particle.State.destroy(this.states[i]);
		}
		this.states = [];
	};

	//	system utility functions

	rat.particle.createSystem = function (options)
	{
		var ps = new rat.particle.System(options);
		rat.particle.systems[rat.particle.systems.length] = ps;
		return ps;
	};
	
	//	createSystem adds to a master list, which could mean references sticking around...
	//	So if you call createSystem, you probably eventually want to call removeSystem as well.
	rat.particle.removeSystem = function (sys)
	{
		var totalSystems = rat.particle.systems.length;
		for(var i = 0; i < totalSystems; i++)
		{
			if (rat.particle.systems[i] === sys)
			{
				rat.particle.systems.splice(i, 1);
				return;
			}
		}
	};

	rat.particle.getSystemCount = function () { return rat.particle.systems.length; };

	rat.particle.getAllEmitterCount = function ()
	{
		var totalEmitters = 0;
		var totalSystems = rat.particle.systems.length;
		for(var i = 0; i < totalSystems; i++)
		{
			var emitterCount = rat.particle.systems[i].getEmitterCount();
			totalEmitters += emitterCount;
		}
		return totalEmitters;
	};

	rat.particle.getAllParticleCount = function ()
	{
		var totalSystems = rat.particle.systems.length;
		var totalParticles = 0;
		for(var i = 0; i < totalSystems; i++)
		{
			var emitterCount = rat.particle.systems[i].getEmitterCount();
			for(var j = 0; j < emitterCount; j++)
			{
				totalParticles += rat.particle.systems[i].emitters[j].getParticleCount();
			}
		}
		return totalParticles;
	};

	/**
	 * Initialize the particle system
	 * @param {Object=} options used to setup the particle system
	 */
	rat.particle.init = function (options)
	{
		//	Are we caching state objects?
		if(rat.particle.stateCaching.enabled)
		{
			//	Create them all?
			if(rat.particle.stateCaching.createPerFrame <= 0)
			{
				rat.particle.stateCaching.createPerFrame = rat.particle.stateCaching.minObjectCount;
				rat.particle.State.FillCache(0);
				rat.particle.stateCaching.createPerFrame = 0;
			}
			//	Create them over time?
			if(rat.cycleUpdate)
			{
				rat.cycleUpdate.addUpdater(rat.particle.State.FillCache);
			}
		}
		else
		{
			rat.particle.stateCaching.minObjectCount = 0;
			rat.particle.stateCaching.createPerFrame = 0;
		}		
	};
} );