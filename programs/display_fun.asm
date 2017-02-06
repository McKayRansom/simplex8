# Playing around with LED system

NOP 0

start:
	
	SET 5		#	green
	MOV $5		#	in register 5
	
step1:
	LI 12
	UI 3
	MOV $7	#	cols
	LI 1
	UI 8
	MOV $8	#	rows

	# jump to show (set and delay)
	SET @step2
	MOV $15		# continue at...
	SET @show
	JMP 0

step2:
	LI 2
	UI 4
	MOV $7	#	cols
	LI 2
	UI 4
	MOV $8	#	rows

	# jump to show (set and delay)
	SET @step3
	MOV $15		# continue at...
	SET @show
	JMP 0
	
step3:	# side
	LI 1
	UI 8
	MOV $7	#	cols
	LI 12	# several at once here
	UI 3
	MOV $8	#	rows

	# jump to show (set and delay)
	SET @step4
	MOV $15		# continue at...
	SET @show
	JMP 0
	
step4:	# eyes
	LI 4
	UI 2
	MOV $7	#	cols
	LI 0
	UI 2
	MOV $8	#	rows
	
	# new color
	#SET 5		#	green- already there, though...
	#MOV $5		#	in register 5

	# jump to show (set and delay)
	SET @step5
	MOV $15		# continue at...
	SET @show
	JMP 0

step5:	# eyes, second color
	# new color
	SET 6		#	red
	MOV $5		#	in register 5
	
	# jump to show (set and delay)
	SET @step6
	MOV $15		# continue at...
	SET @show
	JMP 0

step6:	# mouth
	LI 8
	UI 3
	MOV $7	#	cols
	LI 4
	UI 0
	MOV $8	#	rows
	
	# new color
	#SET 3		#	red- already there, though...
	#MOV $5		#	in register 5

	# jump to show (set and delay)
	SET @step7
	MOV $15		# continue at...
	SET @show
	JMP 0

step7:	# mouth part 2
	LI 4
	UI 0
	MOV $7	#	cols
	LI 8
	UI 0
	MOV $8	#	rows
	
	# jump to show (set and delay)
	SET @done
	MOV $15		# continue at...
	SET @show
	JMP 0
	
done:
	SET @start
	JMP 0
	
# jump to end and halt (test)
SET @end
JMP 0

show:
	# show whatever was asked of us
	
	# io memory
	SET 128
	MOV 1
	
	# in order to avoid setting things until we're ready, clear old values...
	SET 0
	MOV $3		# 0 in r3
	UI 0
	LI 0	# clear cols
	STORE $3
	UI 0
	LI 1	# clear rows
	STORE $3
	
	UI 0
	LI 2	# pick color
	STORE $5
	LI 0	# pick cols
	STORE $7
	LI 1	# pick rows
	STORE $8
	
	# then delay
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

# jump to end and halt
SET @end
JMP 0
	
#old reference
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
end:
	NOP 0