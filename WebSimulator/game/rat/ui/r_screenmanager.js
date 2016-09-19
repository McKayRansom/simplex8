//
//	Screen management (screen stack, etc.)
//
//	TODO:
//		* get bottom screen (stack[0])
//		* get screen below this one
//		* get screen above this one
//		* get next-lower or top screen of certain type (popups vs. full screens)
//			what's the actual "screen" below these popups
//		* get next/prev screen by "type" meaning constructor
//
rat.modules.add( "rat.ui.r_screenmanager",
[
	{ name: "rat.os.r_events", processBefore: true },
	
	{ name: "rat.input.r_input", processBefore: true },
	"rat.debug.r_console",
	"rat.debug.r_profiler",
	"rat.graphics.r_graphics",
	"rat.ui.r_screen",
	"rat.ui.r_ui_textbox",
	"rat.ui.r_ui_button",
	"rat.utils.r_collision2d",
	"rat.utils.r_shapes",
	"rat.math.r_math",
], 
function(rat)
{
	//	some common command numbers
	//	todo - move to rat.event namespace, or something like that.  system, at least.
	rat.OK_COMMAND = -100;
	rat.CANCEL_COMMAND = -99;

	rat.screenManager = {
		screenStack: [],	//	current active screens and popups

		regScreens: {},	//	(hash) optional screen registration system for easier switching between screens

		//	set root UI - replace all screens (if any) with a single current screen
		/** @suppress {missingProperties} - for screenDeactivate */
		setUIRoot: function (uiRoot)
		{
			//	Remove all of the current screens.
			rat.screenManager.popAllScreens();

			//	note:  if uiRoot is null, we're just being asked to clear stack, not put a new screen up.  That's fine.
			if(uiRoot)
			{
				//	set this as our only screen.  Use pushScreen function so we get side effects, like activation functions being called.
				rat.screenManager.pushScreen(uiRoot);
			}
		},

		//	get topmost screen
		getTopScreen: function ()
		{
			if(rat.screenManager.screenStack.length > 0)
				return rat.screenManager.screenStack[rat.screenManager.screenStack.length - 1];
			else
				return null;
		},

		//	push a screen onto the stack of screens
		pushScreen: function (screen)
		{
			if (!screen)
				return;

			//	Let the current screen save their target.
			var topScreen = rat.screenManager.getTopScreen();
			if (topScreen)
				topScreen.saveCurrentTarget();

			//	If we are not overlay screen, walk down the stack suspending any screens that are not yet suspended
			if (!screen.isOverlay)
			{
				var curScreen;
				for (var index = rat.screenManager.screenStack.length - 1; index >= 0; --index)
				{
					curScreen = rat.screenManager.screenStack[index];
					if (curScreen.isSuspended)
						break;
					curScreen.deactivate({ allowOnlySuspend: true });
				}
			
			} else if (screen.isModal) {
				//	let's clear tooltips so they don't draw or pop later...
				//	todo: flags to support/suppress this?
				var curScreen;
				for (var index = rat.screenManager.screenStack.length - 1; index >= 0; --index)
				{
					curScreen = rat.screenManager.screenStack[index];
					//	I can't just clear activeTooltip for a few reasons,
					//	including the fact that it's NULLed out every frame by this point.
					//	Anyway, this is what we want to do so we don't draw mouse tracking graphics
					//	when the mouse really isn't in lower-level screens any more.
					//	This is close to correct, but we still have some things like buttons behaving wrong...
					//	We either need them to respect mouseLeave(),
					//	or we need some new concept of let-go-of-mouse-tracking.
					//	see notes in r_ui.js about optimizing mouse tracking, and handleMouseLeave.
					curScreen.applyRecursively(function (arg){
						if (this.toolTip)
							this.toolTip.timer = 0;
						this.mouseLeave();
					});
				}
			}

			//	Put me on the top of the screen stack, and activate me

			rat.screenManager.screenStack.push(screen);
			screen.activate();
		},

		//	insert a screen into the stack of screens
		insertScreen: function (screen)
		{
			// not the top screen, so tell it to suspend until it's on top
			if (rat.screenManager.screenStack.length)
			{
				screen.deactivate({ allowOnlySuspend: true });
				rat.screenManager.screenStack.unshift(screen);
				//rat.console.log("insertScreen: " + rat.screenManager.screenStack.length);
			}

			//	It really is the only screen, so add it.
			else
				rat.screenManager.pushScreen(screen);
			
		},

		//	remove a screen from the stack by matching ids
		removeScreen: function (screen)
		{
			for(var i = 0; i < rat.screenManager.screenStack.length; ++i)
			{
				if(rat.screenManager.screenStack[i].id === screen.id)
				{
					//	If it is the top screen, call pop
					if (i === rat.screenManager.screenStack.length - 1)
						return rat.screenManager.popScreen();
					else
						return rat.screenManager.removeScreenAtIndex(i);
					break;
				}
			}

			//	Nothing to remove
			return void 0;
		},

		// Remove a screen at the given index
		removeScreenAtIndex: function( stackIndex )
		{
			if (stackIndex < 0 || stackIndex >= rat.screenManager.screenStack.length)
				return void 0;
			var screen = rat.screenManager.screenStack[stackIndex];
			rat.screenManager.screenStack.splice(stackIndex, 1);
			screen.deactivate();
			screen.destroy();
			return screen;
		},

		//
		//	pop top-most screen off stack
		//
		popScreen: function ()
		{
			//	Remove the top screen
			var screen = rat.screenManager.removeScreenAtIndex(rat.screenManager.screenStack.length - 1);

			//	Reactive (or resume) the screen until a non-overlay
			var curScreen;
			for (var i = rat.screenManager.screenStack.length-1; i >= 0; --i)
			{
				curScreen = rat.screenManager.screenStack[i];
				if( curScreen )
				{
					curScreen.activate();

					//	Only activate until we hit a screen that covers the rest
					if( !curScreen.isOverlay )
						break;
				}
			}

			//	Get the new top of stack and restore their target
			var topScreen = rat.screenManager.getTopScreen();
			if (topScreen)
				topScreen.restoreSavedTarget();

			//	Return the removed screen
			return screen;
		},

		///	Remove all screens
		popAllScreens: function ()
		{
			//	Not using removeScreenAtIndex so we don't have to deal with changing the array.
			for (var i = rat.screenManager.screenStack.length-1; i >= 0; --i)
			{
				rat.screenManager.screenStack[i].deactivate();
			}

			//	No more screens.
			rat.screenManager.screenStack = [];
		},

		//	register a standard screen for easy creation/switching later
		registerScreen: function (name, creator)
		{
			rat.screenManager.regScreens[name] = { creator: creator };
		},

		//	switch to a registered screen
		//	pushOn (which defaults to undefined) indicates that we want to push this new screen on the stack instead of replacing.
		switchToScreen: function (name, pushOn, args)
		{
			args = args || [];
			//	Find the registered screen.
			var regScreen = rat.screenManager.regScreens[name];
			if(!regScreen)
			{
				rat.console.log("ERROR: no such registered screen: " + name);
				return null;
			}

			//	Create the screen.
			var screen = regScreen.creator.apply(void 0, args);
			if(!screen)
			{
				rat.console.log("Error: screen creator failed " + name);
				return null;
			}
			screen._screenTag = name;

			//	If we are replacing the current, pop it off.
			if(!pushOn)	//	not pushing - kill old screen first
				rat.screenManager.popScreen();

			//	finally, push new screen
			rat.screenManager.pushScreen(screen);
			return screen;
		},

		//	pop up a standard yes/no dialog, using this setup structure.
		doConfirmDialog: function (setup)
		{
			//	we can add many things to this setup structure over time.  It's pretty minimal so far.
			//	But even better would be reading from a resource.

			//	a bunch of defaults...

			var width = setup.width;
			var height = setup.height;
			if(typeof width === 'undefined')
				width = 420;
			if(typeof height === 'undefined')
				height = 200;
			if(typeof setup.title === 'undefined')
				setup.title = "";
			if(typeof setup.body === 'undefined')
				setup.body = "";
			if(typeof setup.yesText === 'undefined')
				setup.yesText = "Yes";
			if(typeof setup.yesCommand === 'undefined')
				setup.yesCommand = rat.OK_COMMAND;
			if(typeof setup.noText === 'undefined')
				setup.noText = "";
			if(typeof setup.noCommand === 'undefined')
				setup.noCommand = rat.CANCEL_COMMAND;
			if(typeof setup.userData === 'undefined')
				setup.userData = null;
			if (!setup.bgColor)
				setup.bgColor = { r: 80, g: 80, b: 80 };
			if (!setup.frameColor)
				setup.frameColor = { r: 120, g: 120, b: 120 };
			if (!setup.pos)
				setup.pos = { x: rat.graphics.SCREEN_WIDTH / 2 - width, y: rat.graphics.SCREEN_WIDTH / 3 - height / 2 };
			if (!setup.titleFont)
				setup.titleFont = setup.font;
			if (!setup.bodyFont)
				setup.bodyFont = setup.font;
			if (!setup.buttonFont)
				setup.buttonFont = setup.font;
			if (!setup.titleFont) {
				setup.titleFont = {
					font: "Impact",
					size: 14
				};
			}
			if (!setup.bodyFont) {
				setup.titleFont = {
					font: "Arial",
					size: 12
				};
			}

			//	screen
			var screen = new rat.ui.Screen();
			screen.setModal(true);

			screen.setPos(setup.pos.x, setup.pos.y);
			screen.setSize(width, height);

			screen.setBackground(new rat.graphics.Color(setup.bgColor.r, setup.bgColor.g, setup.bgColor.b));

			screen.setFrame(4, new rat.graphics.Color(120, 120, 120));
			var b;
			var tbox;

			//	title
			if(setup.title !== "")
			{
				tbox = new rat.ui.TextBox(setup.title);
				tbox.setFont(setup.titleFont.font || setup.titleFont);
				tbox.setFontSize(setup.titleFont.size || 14);
				tbox.setPos(0, 0);
				tbox.setSize(screen.size.x, 14);
				tbox.setAlign(rat.ui.TextBox.alignCenter);
				tbox.setColor(new rat.graphics.Color(250, 250, 220));
				screen.appendSubElement(tbox);
			}

			//	body
			if(setup.body !== "")
			{
				tbox = new rat.ui.TextBox(setup.body);
				tbox.setFont(setup.bodyFont.font || setup.bodyFont);
				tbox.setFontSize(setup.bodyFont.size || 12);
				tbox.setPos(0, 40);
				tbox.setSize(screen.size.x, 14);
				//tbox.setAlign(rat.ui.TextBox.alignLeft);
				tbox.setAlign(rat.ui.TextBox.alignCenter);
				tbox.setColor(new rat.graphics.Color(190, 190, 190));
				screen.appendSubElement(tbox);
			}

			//	button
			var buttonPosY = screen.size.y * 2 / 3 - 30;
			if(setup.yesText !== "")
			{
				b = rat.ui.makeCheapButton(null, new rat.graphics.Color(150, 200, 150));
				b.setTextValue(setup.yesText);
				b.setSize(70, 30);
				b.setPos(50, buttonPosY);
				b.setCommand(setup.yesCommand, setup.userData);
				screen.appendSubElement(b);
			}

			//	button
			if(setup.noText !== "")
			{
				b = rat.ui.makeCheapButton(null, new rat.graphics.Color(150, 200, 150));
				b.setTextValue(setup.noText);
				b.setSize(70, 30);
				b.setPos(screen.size.x - 30 - 70, buttonPosY);
				b.setCommand(setup.noCommand, setup.userData);
				screen.appendSubElement(b);
			}

			rat.screenManager.pushScreen(screen);

			screen.handleCommand = function (command, info)
			{
				rat.screenManager.popScreen();	//	get rid of screen
				return false;	//	let the command continue to get passed up to somebody who will respond to it.
			};

			//	we can't really do modal, so just set it up, and let commands do their work.

			return screen;
		},

		//	dispatch an event down the screen stack.
		//	This means the usual walk through screens, top to bottom, but stop if one is modal,
		//	and send the event to the target of that screen.
		//	Note that "ratEvent" here has a controllerID value attached to it so we know which input device this came from.
		//	If anybody handles this event (returns true) stop dispatching it!
		//	return true if we handled it.
		//	This is a higher-level "ratEvent".  If you need system event info, get it from event.sysEvent
		dispatchEvent: function (event)
		{
			if (rat.console.state.consoleActive === true || rat.console.state.consoleActive === "target" )
				return;
			var result = false;

			//console.log("screenmanager dispatchEvent " + event.eventType);
			//console.log("  which " + event.which);

			for(var i = rat.screenManager.screenStack.length - 1; i >= 0; i--)
			{
				//	sometimes, all of (or many of) the screens might get killed in response to an event in this loop,
				//	so it's possible to end up trying to dispatch to a screen that no longer exists.
				//	If we detect that case, stop dispatching.  Really, the people who handled the event should have returned that it was handled,
				//	but not every game is perfectly behaved in this way.
				if (i > rat.screenManager.screenStack.length - 1)
					return true;
				
				var screen = rat.screenManager.screenStack[i];
				if (typeof(screen) === 'undefined')
				{
					console.log("bogus screen at " + i);
					return;
				}
				var wasModal = screen.modal;
				//	If this screen is suspended, then don't handle events
				if (screen.isSuspended && !screen.forceScreenActive)
					break; // All other screens should be suspended.

				//	Let's see if we can direct this input to a direct target.
				var directTarget = null;
				
				//	see if this is a positional event (e.g. mouse click),
				//	because we don't want to use the targeting system for things like that.
				//	positional events are instead just handed down starting from the screen element.
				var isPositionalEvent = (event.eventType === "mousedown" ||
										event.eventType === "mouseup" ||
										event.eventType === "mousemove" ||
										event.eventType === "contextmenu" ||
										event.eventType === "touchstart" ||
										event.eventType === "touchend" ||
										event.eventType === "mousewheel" ||
										event.eventType === "touchmove" );
				if (!isPositionalEvent)
				{
					//	input map?  use that.
					if (screen.inputMap)
						directTarget = screen.inputMap.getTargetForEvent(event);
					
					//	simple current target pointer?  use that.
					if (!directTarget && screen.targets)
					{
						//var index = event.inputIndex;
						//if (!index)
						//	index = 0;
						var index = 0;	//	TODO:  get user index from somewhere
						directTarget = screen.targets[index];
					}
				}
				
				if (directTarget)
					result = directTarget.handleEvent(event);
				else	//	no direct target - just send to screen
					result = screen.handleEvent(event);
				
				if (result)	//	handled?  stop looking.
					break;

				if(wasModal)	//	stop if we hit a modal screen
				{
					//	support clicking away from popup to dismiss
					if((event.eventType === 'mousedown' || event.eventType === 'touchstart') &&
						screen.allowClickAway && !rat.collision2D.pointInRect(event.pos, screen.getBounds()))
					{
						if(screen.clickAwaySound && rat.audio)
							rat.audio.playSound(screen.clickAwaySound);
						rat.screenManager.popScreen();
						result = true;	//	handled, in the form of a close
					}

					break;	//	done handling
				}
			}
			return result;
		},

		updateScreens: function ()
		{
			rat.ui.updateCallCount = 0;	//	debug - count total update calls
			var screen;
			for (var i = rat.screenManager.screenStack.length-1; i >= 0; --i)
			{
				screen = rat.screenManager.screenStack[i];
				if (!screen)
					continue;
				if (screen.isSuspended && !screen.forceScreenActive)
					break;
				rat.profiler.pushPerfMark(screen._screenTag || "???");
				rat.screenManager.screenStack[i].update(rat.deltaTime);
				rat.profiler.popPerfMark(screen._screenTag || "???");
			}
		},

		//
		//	draw all screens in our stack
		//
		drawScreens: function ()
		{

			//	STT rewriting this... now...  Let's get rid of this separation of root and postdraw and stack...
			//	we can move postdraw functionality to a per-screen thing, if needed.
			/*
			if (rat.screenManager.uiRoot != null)
			{
				rat.screenManager.uiRoot.draw();
				rat.screenManager.drawTooltips(rat.screenManager.uiRoot);
			}

			//	need a way better system for handling this post-draw thing.
			if (typeof rat.postUIDraw !== 'undefined')
				rat.postUIDraw();
			*/

			//	draw all screens bottom up
			var i;
			var screen;
			var stack = rat.screenManager.screenStack;
			for(i = 0; i < stack.length; i++)
			{
				screen = stack[i];
				if( screen.isSuspended && !screen.forceScreenActive )
					continue;
				
				rat.profiler.pushPerfMark(screen._screenTag || "???");
				
				//console.log("> screen " + i);
				screen.draw();
				//	only draw tooltips for topmost screen, by default.
				//	if you need something different (e.g. a tooltip up when there's some higher screen?)
				//	then you'll need to add flags to change the default behavior, like
				//	screen.alwaysDrawTooltips or something.
				if (i === stack.length-1)
					rat.screenManager.drawTooltips(screen);
				
				rat.profiler.popPerfMark(screen._screenTag || "???");
				//	post-draw?
			}
		},

		//
		//	Draw the current tooltip, if any, for this screen for this drawing frame.
		//	This list gets cleared every frame, and active elements set up new tooltips to draw as needed.
		//	(this puts tooltips under control of elements, so they can figure out their own location, visible state, etc.,
		//	and so it's easy to clean up when an element dies.)
		//	We draw here so that it happens after all other stuff draws, so tooltips show up on top of everything.
		//
		drawTooltips: function (screen)
		{
			if(screen.activeToolTip)
			{
				//	convert global to screen space (tooltips are always given here in global space)
				//	Why add screen position here?  these positions are already global!
				//screen.activeToolTip.place.pos.x += screen.place.pos.x;
				//screen.activeToolTip.place.pos.y += screen.place.pos.y;

				//	fix up (constrain) location if it's off our total canvas space
				//	todo: configurable buffer space away from edges.
				//	todo: this should happen when position is first calculated, not here at draw time!
				var rect = new rat.shapes.Rect(0, 0, rat.graphics.SCREEN_WIDTH - screen.activeToolTip.size.x, rat.graphics.SCREEN_HEIGHT - screen.activeToolTip.size.y);
				screen.activeToolTip.place.pos.limitToRect(rect);

				//	draw
				screen.activeToolTip.setVisible(true);
				screen.activeToolTip.draw();
				//	and clear for next frame
				screen.activeToolTip = null;
			}
		},

		//	Fired when we get a resize from the graphics system.
		//	This will attempt to call onWindowResize for any active (not deflated) screens
		onWindowResize: function()
		{
			var curScreen;
			for (var index = rat.screenManager.screenStack.length - 1; index >= 0; --index)
			{
				curScreen = rat.screenManager.screenStack[index];
				if (curScreen.isSuspended && !curScreen.forceScreenActive)
					break;
				if (curScreen.onWindowResize)
					curScreen.onWindowResize();
			}
		},
		
		//	Walk through screen stack, centering all screens based on their stated size and rat's understanding of screen size.
		centerAllScreens: function()
		{
			var curScreen;
			for (var index = rat.screenManager.screenStack.length - 1; index >= 0; --index)
			{
				curScreen = rat.screenManager.screenStack[index];
				curScreen.centerInDisplay();
			}
		}
	};

	rat.addEventListener("resize", rat.screenManager.onWindowResize);
	
	//	Always have the screen manager.
	rat.input.registerEventHandler(rat.screenManager.dispatchEvent);

	//	aliases for convenience with old code
	// rat.graphics.setUIRoot = rat.screenManager.setUIRoot;
	// rat.graphics.getTopScreen = rat.screenManager.getTopScreen;
	// rat.graphics.pushScreen = rat.screenManager.pushScreen;
	// rat.graphics.popScreen = rat.screenManager.popScreen;
	// rat.graphics.doConfirmDialog = rat.screenManager.doConfirmDialog;

});