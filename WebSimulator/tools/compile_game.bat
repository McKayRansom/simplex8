java -jar compiler.jar --language_in ECMASCRIPT5 --js ../game/light_game.js --js_output_file ../game/c_game.js

:: ugh, better if you just include that in the original light concatenation, or include in compile step or something?
:: type ..\js\utils\firebase_nobom.js >> ..\c_miniciv.js
