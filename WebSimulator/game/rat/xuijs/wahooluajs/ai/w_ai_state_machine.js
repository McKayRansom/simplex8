//
//	generated js from lua file
//

rat.modules.add( "rat.xuijs.wahooluajs.ai.w_ai_state_machine",
[
	{name: "rat.xuijs.wahooluajs.wahoolua", processBefore: true },
	{name: "rat.xuijs.wahooluajs.system.w_class", processBefore: true },
], 
function(rat)
{
	// A state machine for controling AI behavior.
	
	wahoolua.WAiStateMachine = wahoolua.class();

	wahoolua.WAiStateMachine.prototype.Ctor = function(initialState, stateUpdates, stateTransitions) {
		this.stateUpdates = stateUpdates || {};
		this.stateTransitions = stateTransitions || {};
		this.currentState = initialState || "initialState";
		
		// Keeps track of a timer's current time.
		this.timerCurrent = 0;
		
		// Keeps track of random conditions
		this.randomCheckTimes = {};
		this.randomResults = {};
	};
	
	wahoolua.WAiStateMachine.prototype.Dtor = function() {
	};
	
	// Copies the state machine to be used by a different AI.
	wahoolua.WAiStateMachine.prototype.Clone = function() {
		return wahoolua.WAiStateMachine.new(this.currentState, this.stateUpdates, this.stateTransitions);
	};
	wahoolua.WAiStateMachine.prototype.Copy = wahoolua.WAiStateMachine.prototype.Clone;
	
	var CreatCallback = function(callback, arg2) {
		return {callback:callback, arg2:arg2};
	};
	
	var CallCallback = function(callback, owner, deltaTime, stateMachine) {
		return callback.callback.call(owner, callback.arg2, deltaTime, stateMachine);
	};
	
	wahoolua.WAiStateMachine.prototype.Update = function(owner, deltaTime) {
		this.UpdateStateTransition(owner, deltaTime);
		this.UpdateCurrentState(owner, deltaTime);
	};
	
	wahoolua.WAiStateMachine.prototype.UpdateStateTransition = function(owner, deltaTime) {
		var possibleTransitions = this.stateTransitions[this.currentState];
		if ( !possibleTransitions ) {
			rat.console.log("WARNING: There are no state transitions from the state "+this.currentState+".");
			return;
		}
		for(var i = 0; i != possibleTransitions.length; ++i) {
			var possibleTransition = possibleTransitions[ i ];
			if ( CallCallback(possibleTransition.callback, owner, deltaTime, this) ) {
				this.currentState = possibleTransition.nextState;
				this.timerCurrent = 0;
				this.randomCheckTimes = {};
				this.randomResults = {};
				break;
			}
		}
	};
	
	wahoolua.WAiStateMachine.prototype.UpdateCurrentState = function(owner, deltaTime) {
		this.timerCurrent = this.timerCurrent + deltaTime;
		var currentStateUpdate = this.stateUpdates[this.currentState];
		CallCallback(currentStateUpdate, owner, deltaTime, this);
	};
	
	var GetDefaultUpdateName = function(state) {
		return "UpdateState"+state;
	};
	
	// Default update action when there is no defined update.
	var DefaultUpdate = function() { };
	
	var GetArg2 = function(arg2Data, definision, owner) {
		return (!!arg2Data) && (definision[arg2Data] || owner[arg2Data] || arg2Data);
	};
	
	var Not = function(arg2, deltaTime, stateMachine) {
		return !CallCallback(arg2, this, deltaTime, stateMachine);
	};
	
	var And = function(arg2, deltaTime, stateMachine) {
		return CallCallback(arg2.condition1, this, deltaTime, stateMachine) &&
			   CallCallback(arg2.condition2, this, deltaTime, stateMachine);
	};
	
	var Or = function(arg2, deltaTime, stateMachine) {
		return CallCallback(arg2.condition1, this, deltaTime, stateMachine) ||
			   CallCallback(arg2.condition2, this, deltaTime, stateMachine);
	};
	
	var BooleanOperators = { Not:Not, And:And, Or:Or };
	
	// Condition for being in the state for a period of time
	var Timer = function(arg2, deltaTime, stateMachine) {
		if ( typeof(arg2) == "string" ) {
			arg2 = this[arg2];
		}
		if ( stateMachine.timerCurrent > arg2 ) {
			stateMachine.timerCurrent = 0;
			return true;
		}
		return false;
	};
	
	var getChance = function(caller, arg2) {
		return arg2.chance && (caller[arg2.chance] || arg2.chance) || 0.5;
	}
	
	// A random condition
	var IsRandomConditionMet = function(arg2, deltaTime, stateMachine) {
		if(!arg2.refreashRandomRate) {
			var chance = getChance(this, arg2);
			return rat.math.random() < chance;
		}
		
		var timeKey = arg2.chance + "_" + arg2.refreashRandomRate;
		var nextRefreashTime = stateMachine.randomCheckTimes[timeKey];
		if ( !nextRefreashTime || stateMachine.timerCurrent > nextRefreashTime ) {
			var refreashRate = arg2.refreashRandomRate && (this[arg2.refreashRandomRate] || arg2.refreashRandomRate) || 0;
			stateMachine.randomCheckTimes[timeKey] = stateMachine.timerCurrent + refreashRate;
			
			var chance = getChance(this, arg2);
			stateMachine.randomResults[timeKey] = rat.math.random() < chance;
		}
		return stateMachine.randomResults[timeKey];
	}
	
	// Default conditions for any AI
	var DefaultConditions = {
		Timer:Timer,
		Random:IsRandomConditionMet,
	};
	
	var ParseCondition = function(owner, stateConditionDefinitions, argDefinitions, fromState, nextState, stateTransitionData) {
		var booleanCondition = BooleanOperators[stateTransitionData.condition];
		if ( booleanCondition ) {
			var arg2 = (stateTransitionData.condition == "Not"/*The only uniary boolean operator*/) &&
					ParseCondition(owner, stateConditionDefinitions, argDefinitions, fromState, nextState, stateTransitionData.arg2) ||
					{condition1 : ParseCondition(owner, stateConditionDefinitions, argDefinitions, fromState, nextState, stateTransitionData.arg2.condition1),
					 condition2 : ParseCondition(owner, stateConditionDefinitions, argDefinitions, fromState, nextState, stateTransitionData.arg2.condition2)};
			return CreatCallback(booleanCondition, arg2);
		}
		var condition = stateConditionDefinitions[stateTransitionData.condition] || DefaultConditions[stateTransitionData.condition] || owner[stateTransitionData.condition] || owner.prototype[stateTransitionData.condition];
		if ( condition ) {
			var arg2 = GetArg2(stateTransitionData.arg2, argDefinitions, owner);
			return CreatCallback(condition, arg2);
		}
		return CreatCallback(DefaultUpdate, false);
	};
	
	wahoolua.WAiStateMachine.NewFromData = function(owner, stateUpdateDefinitions, stateConditionDefinitions, argDefinitions, initialState, stateUpdatesData, stateTransitionsData) {
		var stateUpdates = {};
		var stateTransitions = {};
		var statesNeedingUpdatesSet = {};
		statesNeedingUpdatesSet[ initialState ] = true;
		
		for(var fromState in stateTransitionsData) {
			var toStateTransitionData = stateTransitionsData[fromState];
			statesNeedingUpdatesSet[fromState] = true;
			var toStateTransition = [];
			for(var i = 0; i < toStateTransitionData.length; ++i) {
				var stateTransitionData = toStateTransitionData[ i ];
				statesNeedingUpdatesSet[stateTransitionData.nextState] = true
				var callback = ParseCondition(owner, stateConditionDefinitions, argDefinitions, fromState, stateTransitionData.nextState, stateTransitionData);
				toStateTransition.push({callback:callback, nextState:stateTransitionData.nextState});
			}
			stateTransitions[fromState] = toStateTransition;
		}
		
		for(var state in stateUpdatesData) {
			var updateData = stateUpdatesData[ state ];
			statesNeedingUpdatesSet[state] = false;
			var updateName = updateData.updateName || GetDefaultUpdateName(state);
			var update = stateUpdateDefinitions[updateData.updateName] || owner[updateData.updateName] || owner.prototype[updateData.updateName];
			if ( !update ) {
				update = DefaultUpdate;
				rat.console.log("Warning: There is no update function "+updateName+" for the state "+state+".");
			}
			var arg2 = GetArg2(updateData.arg2, argDefinitions, owner);
			stateUpdates[state] = CreatCallback(update, arg2);
		}
		
		for(var state in statesNeedingUpdatesSet) {
			if ( statesNeedingUpdatesSet[ state ] ) {
				var updateName = GetDefaultUpdateName(state)
				var update = stateUpdateDefinitions[updateName] || owner[updateName] || DefaultUpdate
				stateUpdates[state] = CreatCallback(update, false)
			}
		}
		
		return wahoolua.WAiStateMachine.new(initialState, stateUpdates, stateTransitions);
	};

});
