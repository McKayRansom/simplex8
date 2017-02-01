-------------------
TEMPLATE PROJECT
-------------------
This is a template project organized the "ideal" way.
See https://docs.google.com/document/d/122FtPRRtS_kPeHgGdhVTwz_t-3QiUAzzZtmnkvci1x8/edit#

-------------------
HOW TO USE
-------------------

Start here:
  * Make a copy of this whole template project folder
  * Rename the new folder to your new project name.
  * From the "game" sub folder, delete any generated js files if they exist
    (c_game.js, c_rat.js, light_game.js, light_rat.js)

If you're going to check the new project into SVN, also do these steps to set that up correctly:
  * Delete game/rat
    (we don't want a copy - we want to use an svn extern to the live version of rat)
  * svn Add the new project folder
    (or check in as new project, if you don't have whole webprojects folder checked out)
    and include everything in it when adding
  * svn commit
  * set up rat SVN external in game folder
   - right-click on game folder
   - tortoise svn -> properties
   - new -> externals
   - new...
   - local path: rat
   - url: ^/rat
   - OK, OK, OK.
  * svn update at project folder level - you should get all of rat again in game/rat folder
  * svn commit again to get your folder properties committed.

Open index.html in a browser and make sure it runs, without errors.

You're all set up now.

start hacking!

-------------------
POSSIBLE NEXT STEPS
-------------------
* change name of window in index.html file (from "Template Rat Project")
* remove/replace readme.txt file, maybe repurpose for your new project
* rename storage variable, and enable settings saving/loading
* enable telemetry

-------------------
TODO on template project
-------------------

* use real dependency setup, and async load in boot.js?
* more stuff we typically use, like better effects module setup?
* audio ui (sound/music buttons, which I keep copying in anyway)
* telemetry
* mark places in code to replace with a recognizable mark, like "**TEMPLATE_CHANGE_ME**" or something

-------------------
