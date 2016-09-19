
:: assumes there's a concatenated rat (e.g. concat_light_rat.bat has been called)

:: copy ..\game\light_rat.js .\game\c_rat.js
java -jar compiler.jar --language_in ECMASCRIPT5 --js ../game/light_rat.js --js_output_file ../game/c_rat.js
