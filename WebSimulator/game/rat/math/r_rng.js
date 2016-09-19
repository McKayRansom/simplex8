
//------------ rat.math.rng ----------------
//
//	Rat random number generator systems
//	Sometimes, an alternative to Math.random() is needed because
//		math.Random can't be seeded explicitly, or maintain parallel streams of random generation
//		and math.Random can be slower
//
//	Here we present several options.
//	For general use, any will probably work fine.
//	If you want something else, consider implementing some more!
//
//	See https://github.com/nquinlan/better-random-numbers-for-javascript-mirror
//	or https://github.com/davidbau/seedrandom
//
//	Usage:
//		set up a generator like this:
//			var rgen = new rat.math.rng.Simple();
//			or
//			var rgen = new rat.math.rng.WhateverRandomGenerator();
//		then seed it (with an integer)
//			rgen.setSeed(10);
//			or maybe rgen.setSeedNormalized(0.3);
//			or leave the default Math.random() seed
//		and then call random() as much as you want:
//			var val = rgen.random();
//

///
/// random generators
///
rat.modules.add("rat.math.r_rng",
[
	{ name: "rat.math.r_math", processBefore: true },
	{ name: "rat.utils.r_utils", processBefore: true },
],
function (rat)
{
	///
	/// Namespace for random generator classes
	///	Note that I can't use rat.math.random because it's already used for a quick random() function
	/// @namespace
	///
	rat.math.rng = {};
	var rng = rat.math.rng;
	
	///
	/// Base class used by all random number generators to provide common functionality,
	/// like randRange and randomVariance.  
	///	
	var Base = function(seed)
	{
		if (seed !== void 0)
			this.seed = seed;
		else
			this.seed = rat.math.random() * this.MAX_VAL;
	};
	rat.math.rng.Base = Base;
	Base.prototype.seed = void 0;			//	Setup later
	Base.prototype.MAX_VAL = 2147483647;	//	This can be overriden by sub classes
	Base.prototype.random = void 0;			//	Needs to be set by sub classes
	Base.prototype.setSeed = function(seed)
	{
		this.seed = seed;
	};
	
	Base.prototype.setSeedNormalized = function(seed)
	{
		this.seed = seed * this.MAX_VAL;
	};
	
	Base.prototype.getSeed = function()
	{
		return this.seed;
	};
	
	Base.prototype.getSeedRange = function()
	{
		return this.MAX_VAL;
	};
	Base.prototype.randomRange = function(min, max)
	{
		return (this.random() * (max-min)) + min;
	};
	Base.prototype.randomIntInRange = function (min, max)
	{
		var difference = max - min;
		return (this.random() * difference + min + 0.5)|0;
	};
	Base.prototype.randomVariance = function (v)
	{
		if (!v)
			return 0;
		return v * 2.0 * this.random() - v;
	};

	
	///
	/// A simple random number generator
	///
	rng.Simple = function(seed)
	{
		rng.Simple.prototype.parentConstructor.call(this, seed);
	};
	rat.utils.inheritClassFrom( rng.Simple, Base );

	///
	///	How does this random number generator work
	///		Returns a number from 0 to one
	///
	rng.Simple.prototype.random = function()
	{
		this.seed = ((this.seed * 7621) + 1) % this.MAX_VAL;
		return (this.seed/this.MAX_VAL);
	};
	
	///
	/// and an implementation mapping to Math.random(), for convenience
	///
	rng.Default = function(seed)
	{
		rng.Default.prototype.parentConstructor.call(this, seed);
	};
	rat.utils.inheritClassFrom( rng.Default, Base );
	rng.Default.random = rat.math.random;
});