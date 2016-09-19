@pushd %cd%
@cd ..\game
@rat\tools\concat_js -i js -l js\boot.js -s rat -pre js\boot.js -o light_game.js

:: insert version number info in a source file and tack that on.
:: an alternative would be to have SubWCRev operate directly on concatenated file

:: SubWCRev . ..\tools\version_template.js ..\tools\version.js
:: type ..\tools\version.js >> light_game.js
:: DEL /Q tools\version.js

@popd
:: @pause