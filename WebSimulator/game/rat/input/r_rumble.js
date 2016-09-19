//
//	Rumble class for handling controller rumbling capabilities
//

//------------ rat.Rumble ----------------
rat.modules.add( "rat.input.r_rumble",
[
	{name: "rat.input.r_rumble_xbox", platform: "xbox"}, // Platform versions run BEFORE me
	{name: "rat.input.r_rumble_wraith", platform: "Wraith"}, // Platform versions run BEFORE me
	
	"rat.utils.r_utils",
	"rat.math.r_vector",
	"rat.input.r_input",
	
	{name: "rat.debug.r_console", processBefore: true},
	{name: "rat.os.r_system", processBefore: true},
], 
function(rat)
{
	var verboseLogging = false;
	
	rat.Rumble = rat.Rumble || {};

	rat.Rumble.muted = false;		/// Is the whole system muted
	rat.Rumble.masterList = [];		/// Running sequences. 
	rat.Rumble.nextID = 1;			/// Next sequence ID

	rat.Rumble.motorStates = {};	/// Motor states for a controller.  Key is controller ID

	//	Find out if this platforms supports rumble
	var rumbleSupported = rat.Rumble.platform_setMotorStates !== void 0;
	rat.Rumble.supported = rumbleSupported;
	
	rat.console.log( "Rumble system is "+(rumbleSupported?"":"NOT ")+"supported" );

	//////////////////////////////////////////////////////////////////////////////////////
	///	Possible note functions
	rat.Rumble.NoteFunction = {
		None: "None",	///	Just play the note
		Ramp: "Ramp",	///	Ramp from A to B
		Fade: "Fade",	///	Fade out to zero
		Random: "Random"/// Random value between A and B
	};

	//////////////////////////////////////////////////////////////////////////////////////
	/// Motors we understand.
	rat.Rumble.Motors = {
		Left: 0,
		Low: 0,
		Right: 1,
		High: 1,
		LeftTrigger: 2,
		RightTrigger: 3,
		Count: 4			// We understand 4 motors, but some platforms may ignore some of the motors
	};
	rat.Rumble.Motors.All = [
		rat.Rumble.Motors.Left,
		rat.Rumble.Motors.Right,
		rat.Rumble.Motors.LeftTrigger,
		rat.Rumble.Motors.RightTrigger
	];
	rat.Rumble.Motors.Main = [
		rat.Rumble.Motors.Left,
		rat.Rumble.Motors.Right
	];
	rat.Rumble.Motors.Triggers = [
		rat.Rumble.Motors.LeftTrigger,
		rat.Rumble.Motors.RightTrigger
	];

	//////////////////////////////////////////////////////////////////////////////////////
	///	 A single note
	/** @constructor */
	rat.Rumble.Note = function( ops )
	{
		ops = ops || {};
		ops.levels = ops.levels || ops.level || [0];
		this.levels = ops.levels || [0];
		if (!Array.isArray(this.levels))
			this.levels = [this.levels];
		this.function = ops.function || ops.behavior || ops.func || rat.Rumble.NoteFunction.None;
		this.length = ops.length || ops.time || 1.0;
	};

	//////////////////////////////////////////////////////////////////////////////////////
	///	A sequence of notes
	/** @constructor */
	rat.Rumble.Sequence = function( ops, notes )
	{
		ops = ops || {};
		this.motor = ops.motor || ops.motorID || rat.Rumble.Motors.Left;		// Which motor to rumble

		//	The min and max distances work similar to distances for audio.  If the distance between the rumble note and the receiver is
		//	<= minDistance the rumble is at full strength.  If the distance is > maxDistance than the rumble note is turned off.
		//	Any distance which is between min and max is interpolated between the two.  Set maxDistance to -1 to disable distance fall off.
		this.minDistance = ops.minDistance || -1;				// For falloff
		this.maxDistance = ops.maxDistance || -1;				// For falloff

		this.notes = notes || [];
	};

	//////////////////////////////////////////////////////////////////////////////////////
	/// A master sequence.  One per controller
	/** @constructor */
	rat.Rumble.MasterSequence = function( controllerID, motor, seq, id, pos )
	{
		this.original = rat.utils.copyObject( seq, true );	///	The sequence.  Fully copy
		this.id = id;										///	id of this sequence
		this.curNote= 0;									///	What note is currently playing
		this.curTime = 0;									///	What is the current time in this note.
		this.pos = new rat.Vector( pos );					///	Used for falloff
		this.targetControllerID = controllerID;					///	What controller is this for
		this.targetMotor = motor;							///	What motor is this targeting.
	};

	//////////////////////////////////////////////////////////////////////////////////////
	///	The state of a controllers motors
	/** @constructor */
	rat.Rumble.MotorState = function()
	{
		this.curLevel = [];
		this.newLevel = [];
		this.position = [];
		this.on = true;
		for( var index = 0; index !== rat.Rumble.Motors.Count; ++index )
		{
			this.curLevel[index] = 0;
			this.newLevel[index] = 0;
			this.position[index] = new rat.Vector();
		}
	};

	//////////////////////////////////////////////////////////////////////////////////////
	/// Start a sequence for a controller
	rat.Rumble.startSequence = function (controllerID, sequence, position)
	{
		if (!rumbleSupported)
			return;

		var ratControllers = rat.input.controllers;

		//	Handle ALL controllers.
		if (controllerID === "ALL" || controllerID === "all" || controllerID === "All")
		{
			for (var controllerIndex = 0; controllerIndex !== ratControllers.length; ++controllerIndex)
				rat.Rumble.startSequence(ratControllers[controllerIndex].id, sequence, position);
			return void 0;	// Invalid sequence ID
		}

		//	MUST exist as a controller
		if (rat.input.controllers.getByID(controllerID) === void 0)
			return void 0;

		//	Handle motor groups.
		if( Array.isArray(sequence.motor) )
		{
			var oldMotor = sequence.motor;
			for (var motorIndex = 0; motorIndex !== oldMotor.length; ++motorIndex)
			{
				sequence.motor = oldMotor[motorIndex];
				rat.Rumble.startSequence(controllerID, sequence, position);
			}
			sequence.motor = oldMotor;
			return void 0;
		}

		if( verboseLogging )
			rat.console.log( "Adding rumble sequence "+(this.nextID+1)+" for controller "+controllerID+" and motor "+ sequence.motor );
		
		//	Get a fully copy of the sequence
		var masterSeq = new rat.Rumble.MasterSequence(controllerID, sequence.motor, sequence, this.nextID++, position);

		//	Remove any running sequences for this motor with a copy of the provided sequence
		//	The reason to remove (and not replace) is that order of the list may matter.
		for (var index = 0; index !== this.masterList.length; ++index)
		{
			var seq = this.masterList[index];
			if (seq.controllerID === controllerID && seq.motor === sequence.motor)
			{
				this.masterList.splice(index, 1);
				break;
			}
		}

		this.masterList.push(masterSeq);
		return masterSeq.id;
	};

	//////////////////////////////////////////////////////////////////////////////////////
	///	Update function, should be called every frame, and is likely usually passed 'app.deltaTime' as its argument
	rat.Rumble.frameUpdate = function (deltaTime)
	{
		if (!rumbleSupported)
			return;

		//	Update the motor states for each controller.
		var state;
		for (var index = this.masterList.length - 1; index >= 0; index--)
		{
			var master = this.masterList[index];
			var sequence = master.original;
			var targetControllerID = master.targetControllerID;
			var targetMotor = master.original.motor;

			//	 Watch for invalid IDs
			if (rat.input.controllers.getByID(targetControllerID) === void 0)
			{
				this.masterList.splice(index, 1);
				continue;
			}

			//	What level should the motor be at.
			var newLevel = 0;	//	new desired level for this motor
			state = this.motorStates[targetControllerID];
			if (!state)
			{
				state = new rat.Rumble.MotorState();
				this.motorStates[targetControllerID] = state;
			}
			var curLevel = state.curLevel[targetMotor];
			
			//	maybe use real time!  If game is paused, we don't want to keep adding 0...
			master.curTime += deltaTime;
			var note = master.original.notes[master.curNote];

			//	Is this note (and any other notes) done?
			while( note && note.length < master.curTime )
			{
				master.curTime -= note.length;
				++master.curNote;

				//	Is this sequence done?
				if (master.curNote >= sequence.notes.length)
				{
					if( verboseLogging )
						rat.console.log( "Rumble sequence "+(this.nextID+1)+" for controller +"+targetControllerID+" and motor "+ targetMotor + " done." );
					this.masterList.splice(index, 1);
					note = void 0;
				}
				else
				{
					note = master.original.notes[master.curNote];
				}
			}
			
			//	given a note ("note") and note-relative time ("master.curTime"), calculate the new level we should be playing.
			if (!rat.Rumble.muted && note)
				newLevel = this.calculateLevel(note, master.curTime, deltaTime, curLevel);
			else
				newLevel = 0;
			
			//	clamp to valid range just in case
			if (newLevel < 0)
				newLevel = 0;
			else if (newLevel > 1)
				newLevel = 1;

			newLevel *= this.calculateDistanceFalloff(targetControllerID, master, targetMotor);

			state.newLevel[targetMotor] = newLevel;
		}	//	end of loop through sequences

		//	Update the actual rumble for each gamepad.
		var controllers = rat.input.controllers;
		var motorIndex;
		var controller;
		var controllerID;
		var changeFound;
		for (var contIndex = 0; contIndex < controllers.length; contIndex++)
		{
			controller = controllers[contIndex];
			controllerID = controller.id;
			state = this.motorStates[controllerID];
			if (!state)
				continue;

			//	if rumble is turned off on this controller, set our new level straight to 0.
			if (!state.on)
				for (motorIndex = 0; motorIndex !== rat.Rumble.Motors.Count; ++motorIndex)
					state.newLevel[motorIndex] = 0;

			//	If there is a change in levels,
			changeFound = false;
			for (motorIndex = 0; motorIndex !== rat.Rumble.Motors.Count; ++motorIndex)
			{
				if (state.newLevel[motorIndex] !== state.curLevel[motorIndex])
				{
					changeFound = true;
					break;
				}
			}

			if (changeFound)
			{
				rat.Rumble.platform_setMotorStates(controller, state);

				//	Set cur level
				for (motorIndex = 0; motorIndex !== rat.Rumble.Motors.Count; ++motorIndex)
					state.curLevel[motorIndex] = state.newLevel[motorIndex];
			}
		}
	};

	//////////////////////////////////////////////////////////////////////////////////////
	///	Stop the rumble on a given controller
	rat.Rumble.stopController = function (controllerID)
	{
		if (!rumbleSupported)
			return;

		var controller = rat.input.controllers.getByID(controllerID);
		if (!controller)
			return;

		var state = this.motorStates[controllerID];
		if (!state)
			return;

		for (var motorIndex = 0; motorIndex !== rat.Rumble.Motors.Count; ++motorIndex)
		{
			state.newLevel[motorIndex] = 0;
			state.curLevel[motorIndex] = 0;
		}

		rat.Rumble.platform_setMotorStates(controller, state.newLevel);
	};

	//////////////////////////////////////////////////////////////////////////////////////
	///	kill everything right now, no fade
	rat.Rumble.stopAll = function ()
	{
		if (!rumbleSupported)
			return;

		this.masterList = [];

		var controllers = rat.input.controllers;
		for (var index = 0; index !== controllers.length; ++index)
			rat.Rumble.stopController(controllers.id);
	};

	//////////////////////////////////////////////////////////////////////////////////////
	///	calculate new value from a note and a note-relative time
	rat.Rumble.calculateLevel = function (note, time, deltaTime, curLevel)
	{
		var newLevel;
		var level1 = note.levels[0];
		var level2 = note.levels[1];
		switch (note.function)
		{
			case rat.Rumble.NoteFunction.None:
				newLevel = level1;
				break;
			case rat.Rumble.NoteFunction.Ramp:
				var interp = time / note.length;
				newLevel = level2 * interp + level1 * (1.0 - interp);
				break;
			case rat.Rumble.NoteFunction.Fade:
				//	this is a total kludge - not taking current time into account.
				newLevel = curLevel - 1.0 * deltaTime / note.length;
				//	would need to store original value, though, right?
				//	could have been generated randomly, so could be anything...
				//	can NOT store in note.level1, that's not our data to play with!
				//	(could be used by another sequence right this moment, for instance)
				break;
			case rat.Rumble.NoteFunction.Random:
				var lowLevel = level1;
				var highLevel = level2;
				if (lowLevel > highLevel)
				{
					lowLevel = level2;
					highLevel = level1;
				}
				newLevel = rat.math.randomInRange(lowLevel, highLevel);
				break;
			default:
				rat.console.log("Unknown note function type");
				newLevel = 0;
				break;
		}

		//	clamp to valid range just in case
		if (newLevel < 0)
			newLevel = 0;
		else if (newLevel > 1)
			newLevel = 1;

		return newLevel;
	};

	//////////////////////////////////////////////////////////////////////////////////////
	///	Turns on rumbling
	rat.Rumble.turnOn = function (controllerID)
	{
		if (!rumbleSupported)
			return;
		rat.console.log("rumble on " + controllerID + "\n");
		var state = this.motorStates[controllerID];
		if (!state)
		{
			state = new rat.Rumble.MotorState();
			this.motorStates[controllerID] = state;
		}
		if (state.on !== true)
		{
			state.on = true;
		}
	};

	//////////////////////////////////////////////////////////////////////////////////////
	///	Turns off rumbling
	rat.Rumble.turnOff = function (controllerID)
	{
		if (!rumbleSupported)
			return;
		rat.console.log("rumble off " + controllerID + "\n");
		var state = this.motorStates[controllerID];
		if (!state)
		{
			state = new rat.Rumble.MotorState();
			this.motorStates[controllerID] = state;
		}
		if (state.on !== false)
		{
			state.on = false;
		}
	};

	//////////////////////////////////////////////////////////////////////////////////////
	///	mutes rumbling
	rat.Rumble.mute = function ()
	{
		this.muted = true;
	};

	//////////////////////////////////////////////////////////////////////////////////////
	///	un-mutes rumbling
	rat.Rumble.unMute = function ()
	{
		this.muted = false;
	};

	//////////////////////////////////////////////////////////////////////////////////////
	///	set position of a controller on a per motor basis
	///	this is likely something like the position of the player in the game
	///	whereas sequences that are passed in to the master list may have a position of the object that causes rumble
	///	-1 for controllerID indicates all current rumble-capable devices
	rat.Rumble.setPosition = function (controllerID, motor, pos)
	{
		if (!rumbleSupported)
			return;

		//	Handle all controllers
		if (controllerID === "ALL" || controllerID === "all" || controllerID === "All")
		{
			var controllers = rat.input.controllers;
			for (var controllerIndex = 0; controllerIndex !== controllers.length; ++controllerIndex)
			{
				rat.Rumble.setPosition(controllers[controllerIndex].id, motor, pos);
			}
			return;
		}

		//	Must be a valid controller ID
		if (rat.input.controllers.getByID(controllerID) === void 0)
			return;

		//	Handle motor groups.
		if (Array.isArray(motor))
		{
			for (var motorIndex = 0; motorIndex !== rat.Rumble.Motors.Count; ++motorIndex)
				rat.Rumble.setPosition(controllerID, motor[motorIndex], pos);
			return;
		}

		var state = this.motorStates[controllerID];
		if (!state)
		{
			state = new rat.Rumble.MotorState();
			this.motorStates[controllerID] = state;
		}

		state.position[motor] = pos;
	};

	//////////////////////////////////////////////////////////////////////////////////////
	///	Internal function to calculate rumble note fall off based on distance
	rat.Rumble.calculateDistanceFalloff = function (targetControllerID, master, targetMotor) {
		var falloff = 1.0;

		// check to see if distance fall off is enabled
		if (master.original.maxDistance !== -1) {
			var motorState = this.motorStates[targetControllerID];
			var pos = {
				x: master.position.x - motorState.position[targetMotor].x,
				y: master.position.y - motorState.position[targetMotor].y,
				z: master.position.z - motorState.position[targetMotor].z
			};

			var distance = Math.sqrt(pos.x * pos.x + pos.y * pos.y + pos.z * pos.z);
			if (distance > master.original.maxDistance)
				falloff = 0;
			else if (distance > master.original.minDistance)
				falloff = 1.0 - (distance - master.original.minDistance) / (master.original.maxDistance - master.original.minDistance);
		}

		return falloff;
	};

} );