//
//	generated js from lua file
//

rat.modules.add( "rat.xuijs.wahooluajs.graphics.w_simple_play_particles",
[
	{name: "rat.xuijs.wahooluajs.wahoolua", processBefore: true },
	{name: "rat.xuijs.wahooluajs.system.w_class", processBefore: true },
	
	{name: "rat.xuijs.js.xui_api", fileOnly: true},
	{name: "rat.math.r_math", fileOnly: true},
],
function(rat, app)
{
	// Manages particles for attacks.
	// Automatically pools created particles.
	
	wahoolua.WSimplePlayParticles = wahoolua.class();

	wahoolua.WSimplePlayParticles.prototype.Ctor = function(scene, maxParticles) {
		this.scene = scene
		this.maxParticles = maxParticles
		
		this.time = 0
		this.particles = []
	}
	
	wahoolua.WSimplePlayParticles.prototype.Dtor = function() {
		if ( this.particles ) {
			var particle = null
			while( this.particles.length != 0 ) {
				this.particles.pop().xui.destroy();
			}
			this.particles = false
		}
	}
	
	// Precaches particles from the list of files.
	wahoolua.WSimplePlayParticles.prototype.Precache = function(fileList) {
		var particlesToMake = rat.math.min(fileList.length, this.maxParticles);
		for(var i = 0; i < particlesToMake; ++i) {
			var particle = this.NewParticleFromFile(fileList[i])
			particle.killTime = -1 // Set the particle to die immediatly.
		}
		this.Update(0) // Kill the cached particles so they don't show
	}
	
	// Spawns a particle given the data and the screen position
	wahoolua.WSimplePlayParticles.prototype.NewParticle = function(particleData, screenPosition, onDie, onDieArg) {
		//WStdUtils.printf("Created particle at <"+screenPosition.x+", "+screenPosition.y+", "+screenPosition.z+"> facing "+(isFacingRight?"right":"left") )
		
		var particle = this.NewParticleFromFile(particleData.file)
		particle.killTime = this.time + particleData.life
		
		if ( particleData.startFrame && particleData.stopFrame ) {
			particle.xui.PlayTimeline(particleData.startFrame, particleData.stopFrame, false)
		}
		
		var vars0 =  particle.xui.GetPivot()

		pivotX = vars0[0]
		pivotY = vars0[1]
		pivotZ = vars0[2]
	var posX = screenPosition.x - pivotX
		var posY = screenPosition.y - pivotY
		var posZ = screenPosition.z - pivotZ
		particle.xui.SetPosition(posX, posY, posZ)
		
		particle.onDie = onDie
		particle.onDieArg = onDieArg
		
		return particle
	}
	
	wahoolua.WSimplePlayParticles.prototype.Update = function(deltaTime) {
		this.time = this.time + deltaTime
		for(var i = 0; i < this.particles.length; ++i) {
			var particle = this.particles[ i ];
			if ( particle.isActive && particle.killTime < this.time ) {
				particle.xui.Unlink()
				particle.isActive = false
				if ( particle.onDie ) {
					particle.onDie(particle.onDieArg)
				}
			}
		}
	}
	
	// Gets a particle with the given XUI file.
	// The particle is owned by this system.
	// The particle comes attached to the scene.
	// The particle is marked active.
	wahoolua.WSimplePlayParticles.prototype.NewParticleFromFile = function(file) {
		
		// Search for a dead particle with the same file as this is ideal.
		for(var i = 0; i < this.particles.length; ++i) {
			var particle = this.particles[ i ];
			if ( particle.file == file && !particle.isActive ) {
				// We found a dead particle using the same file.
				// Can't get any better than this.
				this.scene.AddChild(particle.xui)
				particle.isActive = true
				return particle
			}
		}	
		
		// See if we can create a new particle
		if ( this.particles.length < this.maxParticles ) {
			var particle = {
				xui: wahoolua.WScene.Create(file),
				file: file,
				killTime: 0,
				isActive: true,
				onDie: false,
				onDieArg: false,
			}
			this.particles.push(particle)
			this.scene.AddChild(particle.xui)
			
			return particle
		}
		
		// The best particle to recycle is one that has the same XUI file,
		// then if it is the oldest.
		var idealParticle = this.particles[1]
		for(var i = 0; i < this.particles.length; ++i) {
			var particle = this.particles[ i ];
			if ( particle.file == file ) {
				// This particle is better if it has a file and the other doesn't or it is older.
				if ( idealParticle.file != file || particle.killTime < idealParticle.killTime ) {
					idealParticle = particle
				}
			// If these two particles have a different file, the better one is older
			}
			else if ( idealParticle.file != file && particle.killTime < idealParticle.killTime ) {
				idealParticle = particle
			}
		}
		
		if ( idealParticle.isActive ) {
			// Treat the particle as if it was dying since it is being recycled.
			if ( idealParticle.onDie ) {
				idealParticle.onDie(idealParticle.onDieArg)
			}
		}
		else {
			idealParticle.isActive = true
		}
		
		if ( idealParticle.file != file ) {
			// We'll have to replace the XUI
			idealParticle.xui.destroy();
			idealParticle.xui = wahoolua.WScene.Create(file)
			this.scene.AddChild(idealParticle.xui)
			idealParticle.file = file
		}
		
		return idealParticle
		
	}
});
