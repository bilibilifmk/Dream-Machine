# SOC_MCU — 机柜控制器固件

基于 Arduino Nano 兼容mcu 的机柜控制器固件，负责 IO 输出控制、风扇转速 PWM 调节与转速采集、温湿度采集、电压电流采集，通过串口与上位机（SOC）通信。

---

## 硬件

### 主控

| 项目 | 规格 |
|------|------|
| 开发板 | Arduino Nano（ATmega328P） |
| 主频 | 16 MHz |
| 串口波特率 | 115200 |

### 引脚分配

#### IO 输出（数字输出）

| 引脚 | 宏定义 | 说明 |
|------|--------|------|
| D11 | `OUT_0` | IO0 |
| D12 | `OUT_1` | IO1 |
| D13 | `OUT_2` | IO2 |
| A5  | `OUT_3` | IO3 |
| A4  | `OUT_4` | IO4 |
| A3  | `OUT_5` | IO5 |
| A2  | `OUT_6` | IO6 |

#### 风扇 PWM 输出 / 转速输入

| 风扇 | PWM 引脚 | 转速测量引脚 |
|------|----------|-------------|
| FAN0 | D5 | D2 |
| FAN1 | D6 | D4 |
| FAN2 | D9 | D7 |
| FAN3 | D10 | D8 |

> PWM 值范围 0–255，255 = 全速。

#### 模拟采集

| 引脚 | 宏定义 | 说明 |
|------|--------|------|
| A0 | `DC_IN_voltage` | 输入电压（量程 12V，分压比 1/4） |
| A1 | `DC_IN_current` | 输入电流（ACS 系列传感器） |
| A6 | `DC_OUT_5V` | 5V 输出电压（量程 5V，分压比 1/2） |
| A7 | `Solar_sampling_voltage` | 太阳能/备用电压采样（量程 12V） |

#### 温湿度

| 引脚 | 宏定义 | 传感器 |
|------|--------|--------|
| D3 | `DHT22_IO` | DHT22 |

### 依赖库

| 库 | 说明 |
|----|------|
| `DHT22.h` / `DHT22.cpp` | 本地 DHT22 驱动（项目自带） |
| `FanMonitor.h` / `FanMonitor.cpp` | 风扇转速测量（项目自带） |
| `EEPROM.h` | Arduino 内置，掉电保存 IO / 风扇状态 |

---

## 串口通信协议

波特率：**115200**，换行符 `\n` 结尾。

### 握手

```
发送：The Matrix has you
回复：follow the white rabbit?
      MCU_Version:SOC侧MCU V0.0.2
```

### 启动周期上报

```
发送：REPORT S=<毫秒>
回复：Rabbit probe
```

`S` 为上报间隔（毫秒），设为 0 停止上报。启动后 MCU 以该间隔循环通过串口输出 JSON 状态包。

**JSON 格式：**

```json
{
  "OUT_IO_SET": [false, true, true, true, true, false, true],
  "FAN_PWM_SET": [128, 55, 100, 80],
  "FAN_RPM": [1200, 800, 1100, -1],
  "voltage_buf": [12.05, 5.02, 0.00],
  "Humidity": 45.2,
  "Temperature": 28.6,
  "Current": 3200
}
```

| 字段 | 说明 |
|------|------|
| `OUT_IO_SET` | 7 路 IO 当前输出状态 |
| `FAN_PWM_SET` | 4 路风扇当前 PWM 值（0–255） |
| `FAN_RPM` | 4 路风扇转速（RPM），`-1` 表示未接风扇 |
| `voltage_buf` | `[输入电压V, 5V输出V, 太阳能采样V]` |
| `Humidity` | 湿度（%RH） |
| `Temperature` | 温度（°C） |
| `Current` | 输入电流（mA） |

### IO 控制

```
发送：SET_OUT_IO IOID=<0-6> SETMODE=<0|1>
回复：SET_OUT_IO
```

示例——打开 IO2：

```
SET_OUT_IO IOID=2 SETMODE=1
```

### 风扇 PWM 控制

```
发送：SET_FAN_PWM FANID=<0-3> SETRPM=<0-255>
回复：SET_FAN_PWM
```

示例——FAN1 设为半速（约 128/255）：

```
SET_FAN_PWM FANID=1 SETRPM=128
```

---

## EEPROM 掉电保存

上电时自动从 EEPROM 恢复上次的 IO 状态和风扇 PWM 值，每次 `SET_IO` / `SET_FAN_PWM` 写入时同步保存。

| 地址 | 内容 |
|------|------|
| 10–70（步长10） | IO0–IO6 状态 |
| 80–110（步长10） | FAN0–FAN3 PWM 值 |

> **注意**：上电后风扇先以全速（255）运行 5 秒，EEPROM 恢复完成并 GPIO 初始化后才切换到保存值。

---

## 烧录

1. 用 USB 连接 Arduino Nano
2. 打开 Arduino IDE，选择：
   - 开发板：`Arduino Nano`
   - 处理器：`ATmega328P`（旧版 Bootloader 选 `ATmega328P (Old Bootloader)`）
   - 端口：对应 COM / `/dev/ttyUSB*`
3. 打开 `SOC_MCU/SOC_MCU.ino`，点击上传

---

## 二次开发

### 增加 IO 路数

Arduino Nano 数字/模拟引脚有限，如需扩展 IO 可接 **74HC595** 移位寄存器。

如只是重新映射引脚，修改顶部宏定义即可：

```cpp
#define OUT_0 11   // 改为目标引脚号
```

同时在 `IO_INIT()` 中对应添加 `pinMode(NEW_PIN, OUTPUT)`。

### 增加新串口指令

在 `Serial_Loop()` 的 `if/else if` 链中追加：

```cpp
} else if (comdata.indexOf("YOUR_CMD") != -1) {
    // 解析参数
    int param = analysis_Serial_to_int(comdata, "PARAM");
    // 执行操作
    Serial.println("YOUR_CMD");
}
```

`analysis_Serial_to_int(comdata, "KEY")` 会从字符串中解析 `KEY=<数字>` 格式的整数参数。

### 修改 ADC 量程

电压转换函数 `adc_to_voltage()` 中的分压系数按实际分压电阻修改：

```cpp
float adc_to_voltage(int adc_in, int voltage_mode) {
    float out_v = adc_in * (5.0 / 1024.0);
    switch (voltage_mode) {
        case 5:  out_v = out_v * 2.0; break;   // 分压比 1/2
        case 12: out_v = out_v * 4.0; break;   // 分压比 1/4
    }
    return out_v;
}
```

新增量程只需添加新的 `case`，并在调用处传入对应 `voltage_mode`。

### 修改电流计算

`adc_to_current()` 中的 `map()` 参数对应 ACS 传感器的零电流偏置和满量程，按实际传感器规格修改：

```cpp
int adc_to_current(int adc_in) {
    // adc=508 对应 0mA（传感器零点），adc=1023 对应 50000mA（50A）
    return map(adc_in, 508, 1023, 0, 50000);
}
```

### 更换温湿度传感器

固件已预留 DHT11 支持（注释中可见）。切换至 DHT11：

```cpp
// 注释掉
// #include "DHT22.h"
// DHT22 dht22(DHT22_IO);

// 取消注释
#include "DHT.h"
#define DHTTYPE DHT11
DHT dht(DHT22_IO, DHTTYPE);
```

并在 `setup()` 中调用 `dht.begin()`，将 `updata_dht()` 改为读取 `dht.readHumidity()` / `dht.readTemperature()`。

### 上位机对接示例（Python）

```python
import serial, json

ser = serial.Serial('/dev/ttyUSB0', 115200, timeout=2)

# 握手
ser.write(b'The Matrix has you\n')
print(ser.readline().decode())

# 启动 1 秒上报
ser.write(b'REPORT S=1000\n')

# 读取状态
while True:
    line = ser.readline().decode().strip()
    if line.startswith('{'):
        data = json.loads(line)
        print(data['Temperature'], data['FAN_RPM'])
```
