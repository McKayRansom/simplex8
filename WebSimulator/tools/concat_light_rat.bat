@pushd %cd%
@cd ..\game
@rat\tools\concat_js -i rat -l js\boot.js -s js -pre rat\r_base.js -pre rat\r_minified.js -a rat\utils\r_load_now.js -o light_rat.js
@popd
