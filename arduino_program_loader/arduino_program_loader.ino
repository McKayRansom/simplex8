#include <stdlib.h>
//#include "instructions.c"

#define WE 11 //active LOW!!!
#define OE 10
#define CE A1
#define CLK A5
#define RESET 12
#define PROGRAM A0

//typedef unsigned char byte;

int currentLine = 0;

const int IO[] = {
  2,
  3,
  4,
  5,
  6,
  7,
  8,
  9
};

void setIO(byte value) {
  for (int i=0;i<8;i++) {
    if (value % 2 == 1) {
      digitalWrite(IO[i], HIGH);
    } else {
      digitalWrite(IO[i], LOW);
    }
    value = value >> 1;
  }
}


void setIOMode(int value) {
  for (int i=0;i<8;i++) {
    pinMode(IO[i], value);
  }
}

byte readIO() {
  byte result;
  for (int i=0;i<8;i++) {
    if (digitalRead(IO[i])==HIGH) {
      result += 1<<i;
    }
  }
  return result;
}

extern int* program;
extern int program_length;

void setup() {
  Serial.begin(9600);
  delay(500);
  pinMode(CE, OUTPUT);
  digitalWrite(CE, HIGH);
  delay(500);
  pinMode(WE, OUTPUT);
  digitalWrite(WE, HIGH);
  pinMode(OE, OUTPUT);
  digitalWrite(OE, LOW);
  pinMode(CLK, INPUT);
  pinMode(RESET, INPUT);
  setIOMode(INPUT);
  pinMode(PROGRAM, INPUT);
  delay(1000);
  digitalWrite(CE, LOW);
}

void writeByte(byte value)
{
    //Serial.println(value, BIN);
    setIO(value);
    delayMicroseconds(1);
    digitalWrite(WE, LOW);
    delayMicroseconds(1);
    digitalWrite(WE, HIGH);
}

void resetPC() {
  digitalWrite(RESET, LOW);
  delay(1);
  digitalWrite(RESET, HIGH);
}

void incrPC() {
  delayMicroseconds(1);
  digitalWrite(CLK, HIGH);
  delayMicroseconds(1);
  digitalWrite(CLK, LOW);
}

bool checkValue(byte value) {
  byte expected = value;
  byte actual = readIO();
  if (actual == expected) {
    return true;
  } else {
    // Serial.println("error writing value:");
    // Serial.println(value, DEC);
    Serial.println("CVexpected: ");
    Serial.println(expected, BIN);
    Serial.println("CVgot: ");
    Serial.println(actual, BIN);

    return false;
  }
}

void programEEPROM() {
  for (int i = 0; i< program_length; i++) {
    Serial.println("WritingLine: ");
    Serial.println(i, DEC);
    Serial.println(program[i], BIN);

    writeByte(program[i]);
    // setIOMode(INPUT);
    // digitalWrite(OE, LOW);
    delay(20);
    // while (!checkValue(program[i])) {
    //   delay(20);
    // }

    // Serial.println("Result: ");
    // Serial.println(readIO(), BIN);
    incrPC();
    // digitalWrite(OE, HIGH);
    // setIOMode(OUTPUT);
  }
  Serial.println("wrote lines:");
  Serial.println(program_length, DEC);
  delay(1000); // delay for 1 sec for write to complete
  //check all values
  // resetPC();
  setIOMode(INPUT);
  digitalWrite(OE, LOW);
  // delay(5);
  // for (int i = 0; i< program_length; i++) {
  //   delayMicroseconds(1);
  //   if (!checkValue(program[i])) { //there was an error
  //     Serial.println("error writing value:");
  //     // Serial.println(value, DEC);
  //     Serial.println("expected: ");
  //     Serial.println(program[i], BIN);
  //     Serial.println("got: ");
  //     Serial.println(readIO(), BIN);
  //
  //     return;
  //   }
  //   delayMicroseconds(1);
  //   incrPC();
  // }
  // resetPC();
  Serial.println("Succesfully programmed the EEPROM");
}

void loop() {
  if (digitalRead(PROGRAM) == HIGH) {
    Serial.println("writeTest:");
    // Serial.println("Starting the programming");
    // //setup
    setIOMode(OUTPUT);
    pinMode(CLK, OUTPUT);
    pinMode(RESET, OUTPUT);
    digitalWrite(OE, HIGH);
    digitalWrite(CLK, LOW);
    resetPC();
    delay(10);
    // //program the EEPROM
    programEEPROM();
    // for (int i = 0; i < program_length; i++) {
    //   byte value = program[i];
    //   Serial.println(value, HEX);
    // }
    // //cleanup
    pinMode(CLK, INPUT);
    pinMode(RESET, INPUT);
    setIOMode(INPUT);
    digitalWrite(OE, LOW);
    // Serial.println("finished programming");
    // //delay to prevent several triggers in a row
    delay(1000);
  }
}
