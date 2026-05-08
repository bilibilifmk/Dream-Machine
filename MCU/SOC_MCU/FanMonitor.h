#ifndef FAN_MONITOR_H
#define FAN_MONITOR_H

#include <Arduino.h>

#define FAN_TYPE_UNIPOLE  1
#define FAN_TYPE_BIPOLE   2

class FanMonitor
{
  public:
    FanMonitor(uint8_t monitorPin, uint8_t fanType);
    ~FanMonitor();

    void begin();
    uint8_t fanType;
    uint16_t getSpeed();
    uint8_t pulsesPerRotation;
    uint8_t numberOfSamples;
    uint8_t monitorPin;
};
#endif