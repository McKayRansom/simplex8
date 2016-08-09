/*!
 * Compiler - Assembler for a Minecraft computer
 * Copyright (C) 2012 - Ethan Ransom
*/

var Compiler = (function () {
    // substituted for params that are null
    var binaryZero = '0000';

    /**
     * Converts a register name to its binary id.
    */
    function register(reg) {          
        var registers = {
            a: '0001',
            b: '0010',
            c: '0011',
            d: '0100', // deprecated, use math
        };

        var register = registers[reg];

		if (register == undefined)
			throw new Error('A register is a required argument');
		
        if (register == null)
        	throw new Error(reg + ' is an unknown register.');

        return register;
    }

    /**
     * Processes a memory address.
    */
    function memory(string) {
        var a = string.split("m");

        if (a.length !== 2)
        	throw new Error('Malformed memory reference.');
        
        return binary(a[1], 8);    	
    }

    /**
     * Converts an integer to a binary number, adding leading zeros if necessary.
     * Optional 2nd param: The length of the binary number (default is four).
     * Can accept strings.
    */
    function binary(num, size) {
        // default value of size is 4
        if (size == null)
            size = 4;

        if (typeof num === 'string')
            num = parseInt(num);
        
        var bin = num.toString(2);
        
        // number is too long
        if (bin.length > size)
            throw new Error('Binary number cannot be represented in ' + size + ' binary digits');
        
        while (bin.length !== size)
            bin = '0' + bin; // prepend a zero
        
        return bin;
    }

    /**
     * Glues the portions of commands together.
     * Substitutes binaryZero for null commands.
    */
    function command(cmd, param1, param2, param3) {
        // cmd is never null
        
        // param1 is null in 'nil'
        if (param1 == null)
            param1 = binaryZero;
        
        // param2 could be null (in dis, for example)
        if (param2 == null)
            param2 = binaryZero;
        
        // param3 is null most of the time
        if (param3 == null)
            param3 = binaryZero;
        
        // smush segments together
        return cmd + ' ' + param1 + ' ' + param2 + ' ' + param3;
    }

    // see the language specifications for info on each command
    var commands = {
        nil: function(args) {
            return command(
                '0000'
            );
        },

        sto: function(args) {
            return command(
                '0001',
                binary( args[0], 8 ),
                "",
                register(args[1])
            );
        },

        add: function(args) {
            return command(
                '0010',
                register(args[0]),
                register(args[1])
            );
        },
        
        dis: function(args) {
            return command(
                '0011',
                register( args[0] )
            );
        },

        jmp: function(args) {
            return command(
                '0100',
                binary( args[0] )
            );    
        },
        
        jif: function(args) {
            var overflow = (args[0] === 'overflow');

            return command(
                '0100',
                binary( !overflow ? args[0] : args[1] ),
                null,
                (!overflow) ? '0001' : '0010'
            );    
        },

        mov: function(args) {
            return command(
                '0101',
                register( args[0] ),
                register( args[1] )
            );            
        },

        sub: function(args) {
            return command(
                '0110',
                register(args[0]),
                register(args[1])
            );
        },
        
        cmp: function(args) {
            return command(
                '0111',
                register(args[0]),
                register(args[1])
            );
        },
        
        set: function(args) {
            return command(
                '1000',
                memory(args[0]),
                '',
                register(args[1])
            );
        },

        get: function(args) {
            return command(
                '1001',
                memory(args[0]),
                '',
                register(args[1])
            );
        },
        
        run: function(args) {
            return command(
                '1010',
                register(args[0])
            );
        }

    };

    /*
     * Compiles a single line of assembly code
    */
    function compile(line) {
        var parts = line.split(" "),
			cmd = parts.shift().toLowerCase();
    
		var fn = commands[cmd];
		
		if (fn == null)
			throw new Error("Unknown command: " + cmd);
	
        return fn(parts);
    }

    /*
     * The magic happens here.
     * Compiles multiple lines of assembly code. 
     * Returns an array of strings.
    */
    function compileLines(input) {
        var instructions = input.split("\n"),
            compiledCode = [];
        
        instructions.forEach(function(line, index) {
            try {
                line = $.trim(line);
                
                // handle blank lines
                if (line === "")
                    return; // return out of forEach
        
                compiledCode.push(
                    compile(line)
                );
            } catch (e) {
                var error = 'Line ' + (index + 1) + ': ' + e.message;
                compiledCode.push('<span style="color: red;">' + e.message + '</span>');
                return;
            }
        });

        return compiledCode;
    }

    return {
        'commands': commands,
        'register': register,
        'memory': memory,
        'compile': compile,
        'compileLines': compileLines
    }
})();