//
//	Effects (mostly particles)
//
rat.modules.add( "js.graphics.effects",
[
	"rat.graphics.r_graphics",
	"rat.graphics.r_particle",
],
function(rat)
{
	var effects = {
		
		oneTimeInit : function()
		{
			effects.particles = rat.particle.createSystem();
			
			//	an example of making sure an image is preloaded for use in particles...
			//rat.graphics.preLoadImages([
			//	"images/train/puff.png"
			//]);
			//effects.puffSprite = new rat.graphics.ImageRef("images/train/puff.png");
			//effects.puffSprite.setCentered(true, true);
		},
		
		reset : function()
		{
			effects.particles.killAllEmitters(true);
		},
		
		update : function(dt)
		{
			effects.particles.update(dt);
		},
		
		//	test effect
		testEffect : function(x, y)
		{
			emitter = effects.particles.newEmitter();
				
			emitter.flags |= rat.particle.Emitter.fAutoDie;		//	die after particles are all gone
			emitter.flags |= rat.particle.Emitter.fRadialStartVelocity;	//	don't burst in square shape, burst in circle
				
			emitter.pos.x = x;
			emitter.pos.y = y;
				
			emitter.angle.angle = Math.random() * Math.PI * 2;
			emitter.emitType = rat.particle.System.emitTypeBurst;
			emitter.renderType = rat.particle.System.RENDER_BOX;
			//emitter.renderType = rat.particle.System.RENDER_DOT;

			emitter.setupStandardBurst(20);	//	one burst, right away, with this burst amount
			//emitter.rate = 1;	//	not important for burst
			//emitter.emitCounter = 1;	//	advance counter to do it right away at next update
			//emitter.burstCount = 1;	//	burst once
			//emitter.burstAmount = blah;	//	count per burst
				
			//emitter.createEvent = firePieceSpawn;	//	for each particle created, call this function
			//emitter.deathEvent = function(e, p) { console.log("death"); }	//	test
				
			//	start vals per particle
			emitter.startState.ageLimit = .5;
			emitter.startVariance.ageLimit = .25;
				
			emitter.startState.size = 5;
			emitter.startVariance.size = 1;
				
			emitter.startState.color.r = 230;
			emitter.startState.color.g = 230;
			emitter.startState.color.b = 150;
				
			emitter.startVariance.color.r = 24;
			emitter.startVariance.color.g = 24;
			emitter.startVariance.color.b = 30;
				
			emitter.startState.vel.x = 0;
			emitter.startState.vel.y = 0;
			//	NOTE:  because we're using radial velocity flag above, only x value here is used!
			emitter.startVariance.vel.x = 200;
			emitter.startVariance.vel.y = 200;
				
			emitter.startState.friction = 2.5;	//	a coefficient, sort of, but per second...  balance with high initial velocity
			//emitter.startState.accel.y = 60;	//	units per second per second.  Not sure why this needs to be so huge...
				
			emitter.startVariance.roll = 5;	//	radians per second
				
			emitter.initEndState();
			emitter.endState.color.a = 0;	//	fade to nothing over time
			emitter.endState.roll = 40;
		},	
	};
	window.effects = effects;	//	global access for my convenience
});
