var commands = {
	"NOOP": 0,
	"LI":  1,
	"UI": 2,
	"MOVE":  3,
	"ACC":  4,
	"ADD":  5,
	"SUB":  6,
	"EQUAL":  7,
	"SHIFT":  8,
	"JMP":  9,
	"STORE":  10,
	"LOAD":  11,
	"DISP":  12,
	"INPUT":  13,
	"FREE":  14,
	"HALT":  15,
	"SET":  1,
}

function compile(text) {
	var lines = text.split('\n');
	for (var i = 0; i < lines.length; i++) {
		var line = lines[i].trim();

		// TODO: comments

		if (line === "") {
			// skip blank line
			continue;
		}

		var parts = line.split(" ");
		var command = parts.shift();
		var parameter = parts.shift();
	}
}