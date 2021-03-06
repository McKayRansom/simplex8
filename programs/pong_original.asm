#First version of pong that works
#kept here so I can look back if I break something
#slower and has 2-dot paddles
#REGISTERS
#2-7 ball and player VARIABLES
#8-10 counters
#11-13 TEMP variables
#14-15 return address!!

_start:
	SET 2 						#SETUP OF VARIABLES
	MOVE $2 					#Ball object Column
	LI 2
	MOVE $3 					#Ball object Row
	LI 0
	MOVE $4						#1 is up 0 is down
	LI 0
	MOVE $5 					#1 is right 0 is left
	LI 3
	MOVE $6 					#Player 1
	LI 3
	MOVE $7 					#Player 2
	LI 0
	MOVE $8
	MOVE $9
	MOVE $10
loop:
	CALL @display
	SET @loop
	JMP 0
	SET 1						#input
	ADD $9
	MOVE $9

	SET 2				#count to
	AND $9
	SET @loop
	JMPIF !equal
	CALL @input
	SET 0
	MOV $9

	SET 1
	ADD $10
	MOVE $10

	SET 2						#count to
	AND $10
	SET @loop
	JMPIF !equal
	CALL @updateBall
	SET 0
	MOV $10

	SET @loop
	JMP 0

display:
	SET 6
	STORE $15
	LI 5
	STORE $14
						#STORE CALL ADDRESS
	SET 25
	MOVE $13

	SET 128
	MOVE $1
	SET 1 						#display loop
	MOVE $11
	LI 0
	DISP $0
	LI 5
	MOVE $12
	LI 2
	DISP $12					#GREEN 5
	LI 1	 						#player 1
	DISP $6
	LI 0
	DISP $11

	#CALL @WAIT

	SET 128  					#player 2
	MOVE $11
	SET 0
	DISP $0
	LI 3
	MOVE $12
	LI 2
	DISP $12					#BLUE 3
	LI 1
	DISP $7
	LI 0
	DISP $11

	#CALL @WAIT

	SET 0							#ball
	DISP $0
	LI 1
	DISP $2
	LI 6
	MOVE $11
	LI 2
	DISP $11 					#RED 6
	LI 0
	DISP $3

	#CALL @WAIT

	SET 0
	MOV $1
	LI 6 #LOAD CALL ADDRESS
	LOAD $15
	LI 5
	LOAD $14
	RET 0

WAIT:
	SET 0 #COUNTER
	MOVE $11
	#REG 13 #COUNT TO
	#MOVE $13
wait_loop:
	SET 1
	ADD $11
	MOVE $11
	CMP $13
	RET equal
	SET @wait_loop
	JMP 0

input:
	SET 128
	MOV $1
	SET 4
	LOAD $13
	LI 0
	MOV $1
	LI 1
	AND $13 					#checkUP
	SET @checkDown
	JMPIF !any
	ACC $6 						#moving up
	ADD $6
	MOVE $6
checkDown:
	SET 2
	AND $13
	SET @checkUpP2
	JMPIF !any
	ACC $6
	SHIFT $0 					#moving down
	MOVE $6
checkUpP2:
	SET 4
	AND $13
	SET @checkDownP2
	JMPIF !any
	ACC $7 						#moving up
	ADD $7
	MOVE $7
checkDownP2:
	SET 8
	AND $13
	SET @inputEnd
	JMPIF !any
	ACC $7
	SHIFT $0 					#moving down
	MOVE $7
inputEnd:
	RET 0

#BALL UPDATING
updateBall:  #ball at top
	SET 128 					#Ball up if ball at top then dir = down Bound checking loop
	EQUAL $2
	SET @ballAtBottom
	JMPIF !equal
	SET 0
	MOVE $4
ballAtBottom:
	SET 1 						#Ball at bottom then dir == up
	EQUAL $2
	SET @ballAtLeft
	JMPIF !equal
	SET 1
	MOVE $4
ballAtLeft:
	SET 1 						#at the left side
	EQUAL $3
	SET @ballAtRight
	JMPIF !equal
	ACC $6 						#collision with player 1
	EQUAL $2
	SET @hitTheWall
	JMPIF !any					#jmp if NOT ANY
	SET 1
	MOVE $5
	SET @ballAtRight
	JMP 0
hitTheWall:
	SET @halt					#hit the wall
	JMP 0
ballAtRight:
	SET 64						#at the right side
	EQUAL $3
	SET @updateBallPosition
	JMPIF !equal
	ACC $7 						#collision with player 2
	EQUAL $2
	SET @hitTheWall
	JMPIF !any
	SET 0
	MOVE $5
updateBallPosition:
	SET 1								#update ball position
	EQUAL $5
	SET @movingRight
	JMPIF equal
movingLeft:
	ACC $3
	SHIFT $0 						#moving left
	MOVE $3
	SET @updateUpDown
	JMP 0
movingRight:					#moving right
	ACC $3
	ADD $3
	MOVE $3
updateUpDown:
	SET 1						#update up down
	EQUAL $4
	SET @movingUp
	JMPIF equal
movingDown:
	ACC $2
	SHIFT $0 					#moving down
	MOVE $2
	SET @end
	JMP 0
movingUp:
	ACC $2 						#moving up
	ADD $2
	MOVE $2
end:
	RET 0
halt:
