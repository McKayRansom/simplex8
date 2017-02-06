#test of LED Dot matrix
NOP 0
LI 15	# these 2 instructions equivalent to set FF
UI 15
MOV $3	# this is used for row and column, to set all LEDs at once.
LI 6
UI 0
MOV $4 #RED
LI 5
MOV $5 #GREEN
LI 3
MOV $6 #BLUE

# so, at this point, we have 6, 5, 3 in registers $4, $5, $6

# now turn on correct bit in register 1 to write to display memory
LI 0
UI 8
MOV 1

# but I think this is wrong - upper 4 bits = 8. :(
# I'm going to clear upper bits here and see how that goes...
UI 0
LI 0
STORE $3
LI 1
STORE $3


loopR:
	LI 0
	UI 8
	MOV 1 # tell addressing to use io
	UI 0
	LI 2  # set color value
	STORE $4
	LI 0
	UI 0
	MOV $1
	SET @loopG
	MOV $15
	SET @delay
	JMP 0
loopG:
	LI 0
	UI 8
	MOV 1
	UI 0
	LI 2
	STORE $5
	LI 0
	UI 0
	MOV $1
	SET @loopB
	MOV $15
	SET @delay
	JMP 0
loopB:
	LI 0
	UI 8
	MOV 1
	UI 0
	LI 2
	STORE $6
	LI 0
	UI 0
	MOV $1
	SET @loopR
	MOV $15
	SET @delay
	JMP 0
delay:
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	NOP 0
	LI 0
	UI 0
	MOV 1
	ACC $15
	JMP 0
