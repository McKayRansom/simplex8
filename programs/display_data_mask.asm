#	A weird idea: bake loop-bit-checking masks into our image data.
#	(mask to check with loop variable)
#
#	This is working pretty well in the simulator, though not on hardware?


#	jump to load my data below so it's out of the way...
	SET @start
	MOVE $15	#	return here when you're done
	SET @loaddata
	JMP 0
	
start:
	NOP 0
	
display:
	#	display whatever's at memory 0, pixel by pixel
	
	#	registers used
	#		2	pixel data source address
	#		13	incrementer (holds the value 1)
	#		3	clearer (holds the value 0)
	
	#		5	current loop counter (0-255)
	#		6	loop speed (see below)
	
	#		4	color bits (active low)
	#		8	column (flagged in a single bit that slides up)
	#		9	row (flagged in a single bit that slides up)
	
	#		10, 11, 12		r, g, b
	
	#	do this multiple loops... start at loop 0, and just let this thing wrap...
	#	also, dang, we need to do this a lot faster, so we actually loop it more than 1 each time
	#	see $6 usage below...
	
	SET 0
	MOVE $5
	SET 1
	MOVE $6

	#	This displayframe loop is currently about 5800 cycles,
	#	for the full 8x8 display.
	#	At 1MHz, we're updating the full display at 180 fps
	#	which should be OK!
	
displayframe:
	SET 0
	MOVE $2		#	pixel data source address
	SET 1
	MOVE $13	#	incrementer (just holds the value 1 for use below)
	
	SET 0
	MOVE $3		#	clearer (just holds the value 0 for use below)
	
	SET 128		#	start at highest bit so I can use right shift to go to next bit (don't have left shift)
	MOVE $8		#	col bit
	MOVE $9		#	row bit
	
dloop:
	
	#	read r g b values into registers, whatever's currently at our read register, which is r2
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
	ACC $5	#	loop counter
	AND	$10	#	red value
	AND $10 #	check if they're actually equal
	SET @checkgreen
	JMP !equal
	
	SET 6	#	we know the value was 7 above, so just directly set to clear the bit
	MOVE $4
	
checkgreen:
	#SET 127
	ACC $5
	AND	$11	#	green
	AND	$11
	SET @checkblue
	JMP !equal
	
	SET 5	#	this has a cleared green bit
	AND $4	#	and with whatever was there to clear that bit
	MOVE $4
	
checkblue:
	#SET 127
	ACC $5
	AND	$12	#	blue
	AND	$12
	SET @goahead
	JMP !equal
	
	SET 3	#	this has a cleared blue bit
	AND $4	#	and with whatever was there to clear that bit
	MOVE $4
	
goahead:

	#	At this point we're ready to turn on lights...
	#		r4 color bits
	#		r8 cols
	#		r9 rows
	
	# io memory
	SET 128
	MOV 1
	
	UI 0
	LI 0		# pick cols
	STORE $3	# store 0 there to clear column selector
	
	#	set the color
	LI 2	#	pick color selector
	STORE $4
	
	#	set row
	LI 1	#	pick row selector
	STORE $9
	
	#	set col
	LI 0	#	pick col selector
	STORE $8
	
	#	old
	#	first, clear the color selector while we set up other values
	#	(row and col have some old value...)
	#	is this legit?  we usually clear the row/col selectors...
	#SET 7	#	this is "no color" (no low value)
	#MOV $3		# 0 in r3
	#UI 0
	#LI 2	# clear color
	#STORE $3
	#
	##	now set the column/row we want
	#UI 0
	#LI 0	# pick cols
	#STORE $8
	#LI 1	# pick rows
	#STORE $9
	#
	##	and set the color we want
	#LI 2	#	pick color
	#STORE $4	#	set the color we calculated above
	
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
	#	todo: reset variables instead of this hacky reset?
	#	either way, increment looper, and wrap when it's done...
	ACC	$5
	ADD $6		#	loop at this speed
	MOVE $5
	
	#	wrap at 32 (256/8)
	#	actually, it already is.  Hmm...
	
	MOVE $5
	
	SET @displayframe
	JMP 0
	
dcontinue:
	
	SET @dloop
	JMP 0

# jump to end and halt (unused)
SET @end
JMP 0

loaddata:
	# DATA!
	
	# start storing our image info (which will be 8 x 8 x 3 bytes) at memory 0
	
	#	set up r2 to point to destination for our data
	#	which is address 0
	SET 0
	MOV $2
	#	and set up spacing for data, which is 1 byte per
	SET 1
	MOV $3
	
	#	try a real image this way - little sword dude!
	#RDATA    7  7  7     255  255  255      255  255  255      3   3   3     3   3   3     3   3   3     3   3   3    255  255  255
	#RDATA    7 7  7     255  255  255      1 3 3     1 3 3    1 3 3    1 3 3     3   3   3    255  255  255
	#RDATA    7  7  7     255  255  255      255   0   0      1 3 3     255   0   0     1 3 3     3   3   3    255  255  255
	#RDATA    7  7  7    255 255 255    1 3 3     1 3 3    1 3 3    1 3 3     3   7  31     3   7  31
	#RDATA    3   7   31     1 3 3       3   3   3      7   7   7     3   3   3 15  15  15       3   7  31    3   7  31
	#RDATA    255  255  255    255 255 255    7 7 7       1   7  15      1   7  31    3 3 3    3   7  31      3   7  31
	#RDATA    255  255  255    255 255 255   3   3   3      7   7   7     3  3  3     7 7 7   3   3   3      255 255 255
	#RDATA    255  255  255    255 255 255    1 3 3      255 255 255     255 255 255   255 255 255    1 3 3      255 255 255
	
	#	new approach with masks
	RDATA    0   0   0      1   1   1      3   3   3      7   7   7     15  15  15     31  31  31     63  63  63    127 127 127
	RDATA    0   0   0    255 255 255    255   0   0      0 255   0      0 0   255    255 255   0    255   0 255      0 255 255
	RDATA    0   0   0      0   1   0      0   3   0      0   7   0      0  15   0      0  31  0     0  63  0    0 127 0
	RDATA    0   0   0    255 255 255    255   0   0      0 255   0      0 0   255    255 255   0    255   0 255      0 255 255
	# dark green?
	RDATA  255 000 255    255 1 255    255 3 255    255 7 255    255 15 255    255 31 255    255 31 255    255 31 255
	RDATA  255 000 255    2 0 2    3 0 3    7 0 7    15 0 15    31 0 31    31 0 31    31 0 31
	RDATA  255 000 000    255 000 000    255 000 000    255 000 000    000 000 255    000 000 255    000 000 255    000 000 255
	RDATA    0   0   0    255 255 255    255   0   0      0 255   0      0 0   255    255 255   0    255   0 255      0 255 255
	
	#	EACH value above translates to a block of code like this:
	#SET value (2 instructions)
	#MOV $4
	#ACC $2
	#STORE $4
	#ADD $3
	#MOV $2
	
	#	return
	LI 0
	UI 0
	MOV 1
	ACC $15
	JMP 0
	
end:
	NOP 0