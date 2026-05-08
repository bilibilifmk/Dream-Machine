#include "FanMonitor.h"

FanMonitor::FanMonitor(uint8_t monitorPin, uint8_t fanType)
{
  this->monitorPin = monitorPin;
  this->fanType = fanType;
}

FanMonitor::~FanMonitor()
{
}

void FanMonitor::begin()
{
  pinMode(this->monitorPin, INPUT_PULLUP);
  this->pulsesPerRotation = 2;
  this->numberOfSamples = 5;
}

uint16_t FanMonitor::getSpeed()
{
  uint16_t returnValue = 0;
  uint32_t timeCheck = pulseIn(this->monitorPin, LOW);

  if (timeCheck != 0)
  {
    uint32_t time = 0;

    for (uint8_t i = 0; i < this->numberOfSamples; i++)
    {
      // ***
      // *** This measures the total length of time the
      // *** signal is LOW.
      // ***
      time += pulseIn(this->monitorPin, LOW);
    }

    if (time > 0)
    {
     
      uint32_t averageLowPulseLength = time / this->numberOfSamples;

      
      uint32_t averageTimeFullRotation = averageLowPulseLength * this->pulsesPerRotation * 2;

     
      float turnsPerMicrosecond = 1.0 / averageTimeFullRotation;

    
      float turnsPerSecond = turnsPerMicrosecond * 1000.0 * 1000.0;

     
      int16_t rpm = turnsPerSecond * 60;

      
      returnValue = rpm / this->fanType;
    }
  }

  return returnValue;
}