

#include <EEPROM.h>
#include "DHT22.h"
// #include "DHT.h"

#include "FanMonitor.h"
#define Version_v "SOC侧MCU V0.0.2"

#define OUT_0 11
#define OUT_1 12
#define OUT_2 13
#define OUT_3 A5
#define OUT_4 A4
#define OUT_5 A3
#define OUT_6 A2

#define DC_IN_current A1
#define DC_IN_voltage A0
#define DC_OUT_5V A6
#define Solar_sampling_voltage A7

#define DHT22_IO 3

#define FAN0_PWM 5
#define FAN0_PRM 2
#define FAN1_PWM 6
#define FAN1_PRM 4
#define FAN2_PWM 9
#define FAN2_PRM 7
#define FAN3_PWM 10
#define FAN3_PRM 8

#define EEPROM_IO_0_addr 10
#define EEPROM_IO_1_addr 20
#define EEPROM_IO_2_addr 30
#define EEPROM_IO_3_addr 40
#define EEPROM_IO_4_addr 50
#define EEPROM_IO_5_addr 60
#define EEPROM_IO_6_addr 70

#define EEPROM_FAN_0_addr 80
#define EEPROM_FAN_1_addr 90
#define EEPROM_FAN_2_addr 100
#define EEPROM_FAN_3_addr 110


int loops_delay = 0;
bool OUT_IO_SET[7] = { false, false, false, false, false, false, false };
unsigned char FAN_PWM_SET[4] = { 0, 0, 0, 0 };

float voltage_buf[3] = { 0.0, 0.0, 0.0 };
int current_buf = 0;
float Humidity_buf = 0;
float Temperature_buf = 0;
int FAN_PRM_buf[4] = { -1, -1, -1, -1 };
DHT22 dht22(DHT22_IO);
// DHT dht(DHT11_IO, DHTTYPE);
FanMonitor FAN0_PRM_DATA = FanMonitor(FAN0_PRM, FAN_TYPE_BIPOLE);
FanMonitor FAN1_PRM_DATA = FanMonitor(FAN1_PRM, FAN_TYPE_BIPOLE);
FanMonitor FAN2_PRM_DATA = FanMonitor(FAN2_PRM, FAN_TYPE_BIPOLE);
FanMonitor FAN3_PRM_DATA = FanMonitor(FAN3_PRM, FAN_TYPE_BIPOLE);

void setup() {
  Serial.begin(115200);
  Serial.println("DC OK");
  IO_INIT();
  // dht.begin();
  FAN_PRM_INIT();
}

void loop() {
  Server_Loop();
  Serial_Loop();
  // testio();
  // updata_dht11();
}


void testio() {
  for (int i = 0; i < 7; i++) {
    SET_IO(i, 1);
    delay(200);
    SET_IO(i, 0);
    delay(200);
  }
}
long previousTime = 0;
void Server_Loop() {
  if (loops_delay == 0) {
    return;
  }
  unsigned long currentTime = millis();
  if (currentTime - previousTime > loops_delay) {
    previousTime = currentTime;
    updata_dht();
    updata_FAN_PRM();
    updata_ADC();
    // String send = "repay:";
    // send += String(Humidity_buf) + ",";
    // send += String(Temperature_buf) + ",";
    // send += String(FAN_PRM_buf[0]) + ",";
    // send += String(FAN_PRM_buf[1]) + ",";
    // send += String(FAN_PRM_buf[2]) + ",";
    // send += String(FAN_PRM_buf[3]) + ",";
    // send += String(voltage_buf[0]) + ",";
    // send += String(voltage_buf[1]) + ",";
    // send += String(voltage_buf[2]) + ",";
    // send += String(current_buf);
    // Serial.println(send);
    // 创建 JSON 字符串
    String json = "{";

    // 添加 OUT_IO_SET 数组
    json += "\"OUT_IO_SET\":[";
    for (int i = 0; i < 7; i++) {
      json += OUT_IO_SET[i] ? "true" : "false";
      if (i < 6) json += ",";  // 添加逗号分隔符
    }
    json += "],";

    // 添加 FAN_PWM_SET 数组
    json += "\"FAN_PWM_SET\":[";
    for (int i = 0; i < 4; i++) {
      json += String(FAN_PWM_SET[i]);
      if (i < 3) json += ",";
    }
    json += "],";
    json += "\"FAN_RPM\":[";
    for (int i = 0; i < 4; i++) {
      json += String(FAN_PRM_buf[i]);
      if (i < 3) json += ",";
    }
    json += "],";
    // 添加 voltage_buf 数组
    json += "\"voltage_buf\":[";
    for (int i = 0; i < 3; i++) {
      json += String(voltage_buf[i], 2);  // 保留两位小数
      if (i < 2) json += ",";
    }
    json += "],";

    // 添加单个值
    json += "\"Humidity\":" + String(Humidity_buf, 1) + ",";
    json += "\"Temperature\":" + String(Temperature_buf, 1) + ",";
    json += "\"Current\":" + String(current_buf);

    json += "}";

    // 输出 JSON 字符串
    Serial.println(json);
  }
}

void Serial_Loop() {
  if (Serial.available() > 0) {
    String comdata = "";
    while (Serial.available() > 0) {
      comdata += char(Serial.read());
      delay(2);
    }

    if (comdata.length() > 0) {
      if (comdata.indexOf("The Matrix has you") != -1) {
        Serial.println("follow the white rabbit?");
        Serial.print("MCU_Version:");
        Serial.println(Version_v);

      } else if (comdata.indexOf("REPORT") != -1) {
        Serial.println("Rabbit probe");
        int S = analysis_Serial_to_int(comdata, "S");
        loops_delay = S;
      } else if (comdata.indexOf("SET_OUT_IO") != -1) {
        Serial.println("SET_OUT_IO");
        int io = analysis_Serial_to_int(comdata, "IOID");
        int set = analysis_Serial_to_int(comdata, "SETMODE");
        SET_IO(io, set);
      } else if (comdata.indexOf("SET_FAN_PWM") != -1) {
        Serial.println("SET_FAN_PWM");
        int io = analysis_Serial_to_int(comdata, "FANID");
        int set = analysis_Serial_to_int(comdata, "SETRPM");
        SET_FAN_PWM(io, set);
      }
    }
  }
}
void SET_FAN_PWM(int fan_id, char PWNS) {

  switch (fan_id) {
    case 0:
      analogWrite(FAN0_PWM, PWNS);
      FAN_PWM_SET[fan_id] = PWNS;
      EEPROM.put(EEPROM_FAN_0_addr, PWNS);
      break;
    case 1:
      analogWrite(FAN1_PWM, PWNS);
      FAN_PWM_SET[fan_id] = PWNS;
      EEPROM.put(EEPROM_FAN_1_addr, PWNS);
      break;
    case 2:
      analogWrite(FAN2_PWM, PWNS);
      FAN_PWM_SET[fan_id] = PWNS;
      EEPROM.put(EEPROM_FAN_2_addr, PWNS);
      break;
    case 3:
      analogWrite(FAN3_PWM, PWNS);
      FAN_PWM_SET[fan_id] = PWNS;
      EEPROM.put(EEPROM_FAN_3_addr, PWNS);
      break;
  }
}
void updata_ADC() {

  voltage_buf[0] = adc_to_voltage(analogRead(DC_IN_voltage), 12);
  voltage_buf[1] = adc_to_voltage(analogRead(DC_OUT_5V), 5);
  voltage_buf[2] = adc_to_voltage(analogRead(Solar_sampling_voltage), 12);
  int buf_in_c = 0;
  for (int i = 0; i < 20; i++) {
    buf_in_c += analogRead(DC_IN_current);
    delay(5);
  }
  buf_in_c = buf_in_c / 20;
  current_buf = adc_to_current(buf_in_c);
}
void updata_dht() {
  Humidity_buf = dht22.getHumidity();
  Temperature_buf = dht22.getTemperature();
}
void updata_FAN_PRM() {
  for (int i = 0; i < 4; i++) {
    if (FAN_PRM_buf[i] != -1) {
      switch (i) {
        case 0:
          FAN_PRM_buf[i] = FAN0_PRM_DATA.getSpeed();
          break;
        case 1:
          FAN_PRM_buf[i] = FAN1_PRM_DATA.getSpeed();
          break;
        case 2:
          FAN_PRM_buf[i] = FAN2_PRM_DATA.getSpeed();
          break;
        case 3:
          FAN_PRM_buf[i] = FAN3_PRM_DATA.getSpeed();
          break;
      }
    }
  }
}
void SET_IO(int out_io, int set_modo) {

  switch (out_io) {
    case 0:
      digitalWrite(OUT_0, set_modo);
      OUT_IO_SET[out_io] = set_modo;
      EEPROM.put(EEPROM_IO_0_addr, set_modo);
      break;
    case 1:
      digitalWrite(OUT_1, set_modo);
      OUT_IO_SET[out_io] = set_modo;
      EEPROM.put(EEPROM_IO_1_addr, set_modo);
      break;
    case 2:
      digitalWrite(OUT_2, set_modo);
      OUT_IO_SET[out_io] = set_modo;
      EEPROM.put(EEPROM_IO_2_addr, set_modo);
      break;
    case 3:
      digitalWrite(OUT_3, set_modo);
      OUT_IO_SET[out_io] = set_modo;
      EEPROM.put(EEPROM_IO_3_addr, set_modo);
      break;
    case 4:
      digitalWrite(OUT_4, set_modo);
      OUT_IO_SET[out_io] = set_modo;
      EEPROM.put(EEPROM_IO_4_addr, set_modo);
      break;
    case 5:
      digitalWrite(OUT_5, set_modo);
      OUT_IO_SET[out_io] = set_modo;
      EEPROM.put(EEPROM_IO_5_addr, set_modo);
      break;
    case 6:
      digitalWrite(OUT_6, set_modo);
      OUT_IO_SET[out_io] = set_modo;
      EEPROM.put(EEPROM_IO_6_addr, set_modo);
      break;
  }
}

float adc_to_voltage(int adc_in, int voltage_mode) {
  float out_v = adc_in * (5.0 / 1024.0);
  switch (voltage_mode) {
    case 5:
      out_v = out_v * 2.0;
      break;
    case 12:
      out_v = out_v * 4.0;
      break;
  }
  return out_v;
}
int adc_to_current(int adc_in) {
  return map(adc_in, 508, 1023, 0, 50000);
}

int analysis_Serial_to_int(String in, String keyword) {
  int Po = in.indexOf(keyword) + keyword.length() + 1;
  String buf = in.substring(Po);
  buf.trim();
  return buf.toInt();
}
void FAN_PRM_INIT() {
  FAN0_PRM_DATA.begin();
  FAN1_PRM_DATA.begin();
  FAN2_PRM_DATA.begin();
  FAN3_PRM_DATA.begin();
  delay(100);


  FAN_PRM_buf[0] = FAN0_PRM_DATA.getSpeed();
  FAN_PRM_buf[1] = FAN1_PRM_DATA.getSpeed();
  FAN_PRM_buf[2] = FAN2_PRM_DATA.getSpeed();
  FAN_PRM_buf[3] = FAN3_PRM_DATA.getSpeed();
  for (int i = 0; i < 4; i++) {
    if (FAN_PRM_buf[i] == 0) {
      FAN_PRM_buf[i] = -1;
    }
  }
  Serial.println("FAN_PRM_INIT OK");
}
void IO_INIT() {
  // EEPROM.begin(1000);
  pinMode(OUT_0, OUTPUT);
  pinMode(OUT_1, OUTPUT);
  pinMode(OUT_2, OUTPUT);
  pinMode(OUT_3, OUTPUT);
  pinMode(OUT_4, OUTPUT);
  pinMode(OUT_5, OUTPUT);
  pinMode(OUT_6, OUTPUT);
  pinMode(FAN0_PWM, OUTPUT);
  pinMode(FAN1_PWM, OUTPUT);
  pinMode(FAN2_PWM, OUTPUT);
  pinMode(FAN3_PWM, OUTPUT);
  // pinMode(FAN0_PRM, INPUT);
  // pinMode(FAN1_PRM, INPUT);
  // pinMode(FAN2_PRM, INPUT);
  // pinMode(FAN3_PRM, INPUT);
  // digitalWrite(OUT_0, LOW);
  // digitalWrite(OUT_1, LOW);
  // digitalWrite(OUT_2, LOW);
  // digitalWrite(OUT_3, LOW);
  // digitalWrite(OUT_4, LOW);
  // digitalWrite(OUT_5, LOW);
  // digitalWrite(OUT_6, LOW);
  analogWrite(FAN0_PWM, 255);
  analogWrite(FAN1_PWM, 255);
  analogWrite(FAN2_PWM, 255);
  analogWrite(FAN3_PWM, 255);
  EEPROM.get(EEPROM_IO_0_addr, OUT_IO_SET[0]);
  EEPROM.get(EEPROM_IO_1_addr, OUT_IO_SET[1]);
  EEPROM.get(EEPROM_IO_2_addr, OUT_IO_SET[2]);
  EEPROM.get(EEPROM_IO_3_addr, OUT_IO_SET[3]);
  EEPROM.get(EEPROM_IO_4_addr, OUT_IO_SET[4]);
  EEPROM.get(EEPROM_IO_5_addr, OUT_IO_SET[5]);
  EEPROM.get(EEPROM_IO_6_addr, OUT_IO_SET[6]);

  EEPROM.get(EEPROM_FAN_0_addr, FAN_PWM_SET[0]);
  EEPROM.get(EEPROM_FAN_1_addr, FAN_PWM_SET[1]);
  EEPROM.get(EEPROM_FAN_2_addr, FAN_PWM_SET[2]);
  EEPROM.get(EEPROM_FAN_3_addr, FAN_PWM_SET[3]);

  digitalWrite(OUT_0, OUT_IO_SET[0]);
  digitalWrite(OUT_1, OUT_IO_SET[1]);
  digitalWrite(OUT_2, OUT_IO_SET[2]);
  digitalWrite(OUT_3, OUT_IO_SET[3]);
  digitalWrite(OUT_4, OUT_IO_SET[4]);
  digitalWrite(OUT_5, OUT_IO_SET[5]);
  digitalWrite(OUT_6, OUT_IO_SET[6]);

  delay(5000);
  Serial.println("GPIO_INIT OK");
}
