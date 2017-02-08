# Let's try some data-driven display
# Also, let's try turning on a pixel at a time,
# simulating the worst case where each color is unique anyway.
# So, for that, we just need RGB values in sequence.
# For my convenience, we're going to store RGB values for each pixel,
# but it might be optimal to split out the R G and B layers...?

#	jump to load my data below so it's out of the way...
	SET @start
	MOVE $15	#	return here when you're done
	SET @loaddata
	JMP 0
	
start:
	NOP 0
	
display:
	#	display whatever's at memory 0, pixel by pixel
	SET 0
	MOVE $2	#	pixel data source address
	SET 1
	MOVE $13	#	incrementer
	
	SET 128	#	start at highest bit so I can use right shift to go to next bit (don't have left shift)
	MOVE $8	#	col bit
	MOVE $9	#	row bit
	
	SET 6	# red test
	MOVE $5
	
dloop:
	
	#	read r g b values into registers
	ACC	$2
	LOAD $10	#r
	ADD $13
	LOAD $11	#g
	ADD $13
	LOAD $12	#b
	ADD $13
	MOVE $2		#	update current pixel source address
	
	#	Figure out which colors to turn on based on source data.
	#	We want register 4 to hold the final value we'll write out.
	#	This will start out with the value 7 (bits 111),
	#	and we'll turn off the proper bit for any color we want to display (active low)
	SET 7
	MOVE $4
	
checkred:	
	SET 127
	SUB	$10	#	red
	SET @checkgreen
	JMP gt
	
	SET 6	#	we know the value was 7, so just directly set to clear the bit
	MOVE $4
	
checkgreen:
	SET 127
	SUB	$11	#	green
	SET @checkblue
	JMP gt
	
	SET 5	#	clear the green bit
	AND $4
	MOVE $4
	
checkblue:
	SET 127
	SUB	$12	#	blue
	SET @goahead
	JMP gt
	
	SET 3	#	clear the blue bit
	AND $4
	MOVE $4
	
goahead:
	# io memory
	SET 128
	MOV 1
	
	#	first, clear the color selector while we set up other values
	#	(row and col have some old value...)
	#	is this legit?  we usually clear the row/col selectors...
	SET 7	#	this is "no color" (no low value)
	MOV $3		# 0 in r3
	UI 0
	LI 2	# clear color
	STORE $3
	
	#	now set the column/row we want
	UI 0
	LI 0	# pick cols
	STORE $8
	LI 1	# pick rows
	STORE $9
	
	#	and set the color we want
	LI 2	#	pick color
	STORE $4	#	set the color we calculated above
	
	#	todo - pick color based on what phase we're in and how strong the color value is.
	#	for now, just set r/g/b on off based on R value being >= 128

moveon:
	#	move to next pixel
	#SHIFT $8
	ACC $8
	SHIFT 0
	MOVE $8
	
	#	if the one bit we're using here shifted off the end, that's the end of my row!
	#	so, if that's not the case, continue...
	SET @dcontinue
	JMPIF !shiftOverflow
	
	#	start over with bits for next row
	SET 128
	MOVE $8
	
	#	move to next row
	#SHIFT $9
	ACC $9
	SHIFT 0
	MOVE $9
	
	#	was that the last one there? shifted off end?
	SET @dcontinue
	JMPIF !shiftOverflow
	
	#	start over entirely!
	#	todo: reset variables instead of this hacky reset...
	SET @display
	JMP 0
	
dcontinue:
	
	SET @dloop
	JMP 0

# jump to end and halt (unused)
SET @end
JMP 0

loaddata:
	# DATA!
	# Here's an approximation of how this could be assembled by the assembler later...
	
	# start storing our image info (which will be 8 x 8 x 3 bytes) at memory 0
	
	SET 255		#	actual value to store
	MOV $4		#	move that to r4
	SET 0		#	memory address
	STORE $4	#	write it
	
	SET 10
	MOV $4
	SET 1
	STORE $4
	
	SET 10
	MOV $4
	SET 2
	STORE $4
	
	#oh my gosh I'm already bored.
		
	SET 128
	MOV $4
	SET 3
	STORE $4
	
	SET 20
	MOV $4
	SET 4
	STORE $4
	
	SET 128
	MOV $4
	SET 5
	STORE $4
	
	# p3
	SET 0
	MOV $4
	SET 6
	STORE $4
	
	SET 255
	MOV $4
	SET 7
	STORE $4
	
	SET 0
	MOV $4
	SET 8
	STORE $4
	
	# p4
	SET 0
	MOV $4
	SET 9
	STORE $4
	
	SET 0
	MOV $4
	SET 10
	STORE $4
	
	SET 255
	MOV $4
	SET 11
	STORE $4
	
	#	return
	LI 0
	UI 0
	MOV 1
	ACC $15
	JMP 0
	
end:
	NOP 0