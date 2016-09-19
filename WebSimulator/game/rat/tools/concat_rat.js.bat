:: build final full rat.js at top level (same folder rat is in)
:: assuming modulescan has already happened
@pushd %cd%
@cd ..\..
@rat\tools\concat_js -s rat -l rat\builds\full_web_boot.js -d rat\r_base.js -pre rat\r_base.js -pre rat\r_minified.js -a rat\utils\r_load_now.js -o rat.js

:: generate version number info in a source file to tack on the end
:: an alternative would be to have SubWCRev operate directly on concatenated file,
:: or generate above and use -pre or -append, but I'm having trouble with that.  :(
SubWCRev .\rat rat\builds\r_version_template.js temp_r_version.js
type temp_r_version.js >> rat.js
DEL /Q temp_r_version.js

@popd