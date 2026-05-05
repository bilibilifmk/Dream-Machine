#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
MCU 串口通信模块

通过 MCUSerial 类封装与主控 MCU 的串口通信，包括：
- 串口初始化与数据读写
- IO 端口和风扇控制
- 上报数据解析与拼接
- 调试模式模拟逻辑
"""

import json
import time
import threading
from typing import Optional, List, Dict, Any

import serial
from config import cfg
from log import logger


class MCUSerial:
    """MCU 串口通信管理器"""

    BAUDRATE = 115200
    TIMEOUT = 0.5
    WRITE_TIMEOUT = 1
    REPORT_INTERVAL = 1000  # 毫秒

    DEFAULT_DEBUG_DATA = (
        '{"OUT_IO_SET":[false,false,false,false,true,false,true],'
        '"FAN_PWM_SET":[0,0,0,0],"FAN_RPM":[10000,-1,-1,-1],'
        '"voltage_buf":[12.09,4.99,0.00],"Humidity":0,"Temperature":0,"Current":291}'
    )

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._serial: Optional[serial.Serial] = None
        self._report_message: str = ""
        self._debug_mode: bool = False
        self._debug_data: str = self.DEFAULT_DEBUG_DATA
        self._io_state: List[List[str]] = []
        self._fan_state: List[List[str]] = []
        self._fan_standard_mode: List[str] = []
        self._fan_full_mode: List[str] = []
        self._fan_mode: str = ""
        self._fan_full_mode_time: str = ""


    # ==================== 初始化 ====================

    def setup(self, debug_mode: bool, io_state: List, fan_state: List,
              fan_standard_mode: List, fan_full_mode: List,
              fan_full_mode_time: str) -> None:
        """配置 MCU 模块参数，应在 open_serial() 前调用"""
        self._debug_mode = debug_mode
        self._io_state = io_state
        self._fan_state = fan_state
        self._fan_standard_mode = fan_standard_mode
        self._fan_full_mode = fan_full_mode
        self._fan_full_mode_time = fan_full_mode_time
        if debug_mode:
            self._report_message = self._debug_data
            logger.send("DEBUG", "MCUSerial 已初始化（调试模式）")
        else:
            logger.send("DEBUG", "MCUSerial 已初始化")

    def open_serial(self) -> None:
        """打开 MCU 串口连接；调试模式下跳过"""
        if self._debug_mode:
            logger.send("DEBUG", "调试模式 - 跳过 MCU 串口初始化")
            return
        try:
            port = cfg.get("SYS", "MCU_serial")
            self._serial = serial.Serial(
                port, self.BAUDRATE,
                timeout=self.TIMEOUT,
                write_timeout=self.WRITE_TIMEOUT,
                rtscts=False
            )
            self._serial.setRTS(True)
            logger.send("INFO", f"MCU 串口已连接: {port}")
        except Exception as e:
            logger.send("ERROR", f"MCU 串口打开失败: {e}")

    # ==================== 串口读写 ====================

    def write(self, msg: str) -> bool:
        """发送命令到 MCU（调试模式下模拟执行）"""
        if self._debug_mode:
            self._simulate(msg)
            return True
        try:
            if self._serial is None:
                logger.send("WARNING", "MCU 串口未初始化")
                return False
            self._serial.write(msg.encode('utf-8'))
            logger.send("DEBUG", f"发送到 MCU: {msg}")
            time.sleep(0.1)
            return True
        except Exception as e:
            logger.send("ERROR", f"MCU 串口发送超时: {e}")
            return False

    def read_loop(self) -> None:
        """持续读取 MCU 上报数据（后台线程入口）；调试模式下直接返回"""
        if self._debug_mode:
            logger.send("DEBUG", "调试模式 - 跳过 MCU 串口读取")
            return
        error_count = 0
        logger.send("INFO", "MCU 串口读取线程已启动")
        while True:
            try:
                if self._serial and self._serial.in_waiting > 0:
                    raw = self._serial.readline()
                    try:
                        data = raw.decode('utf-8').strip()
                        logger.send("DEBUG", f"接收自 MCU: {data}")
                        if "OUT_IO_SET" in data:
                            with self._lock:
                                self._report_message = data
                            error_count = 0
                    except UnicodeDecodeError:
                        logger.send("WARNING", "MCU 数据编码错误，非 UTF-8")
            except Exception as e:
                logger.send("ERROR", f"MCU 串口读取错误: {e}")
                error_count += 1
                if error_count > 10:
                    logger.send("ERROR", "MCU 串口读取线程因连续错误退出")
                    break
            time.sleep(0.1)

    # ==================== 数据解析 ====================

    def get_report(self) -> Optional[str]:
        """返回结构化的 MCU 上报 JSON；失败返回 None"""
        try:
            with self._lock:
                mcu = json.loads(self._report_message)
            if len(self._io_state) != len(mcu.get("OUT_IO_SET", [])):
                raise ValueError("IO_state 与 OUT_IO_SET 长度不一致")
            if len(self._fan_state) != len(mcu.get("FAN_RPM", [])) or \
               len(self._fan_state) != len(mcu.get("FAN_PWM_SET", [])):
                raise ValueError("FAN_state 与风扇数据长度不一致")
            report: Dict[str, Any] = {
                "id": "MCU_Report",
                "IO_status": [
                    {"name": io[1],
                     "state": bool(mcu["OUT_IO_SET"][i]),
                     "locked": io[2].lower() == "true"}
                    for i, io in enumerate(self._io_state)
                ],
                "FAN_status": [
                    {"name": fan[1],
                     "rpm": int(mcu["FAN_RPM"][i]),
                     "set_speed": int(mcu["FAN_PWM_SET"][i])}
                    for i, fan in enumerate(self._fan_state)
                ],
                "voltage_buf": [float(v) for v in mcu["voltage_buf"]],
                "Humidity":    int(mcu["Humidity"]),
                "Temperature": int(mcu["Temperature"]),
                "Current":     int(mcu["Current"]),
            }
            return json.dumps(report, ensure_ascii=False, separators=(',', ':'))
        except Exception as e:
            logger.send("ERROR", f"MCU get_report 失败: {e}")
            return None

    # ==================== IO / 风扇控制 ====================

    def get_io_info(self, io_id: int) -> Optional[Dict[str, Any]]:
        """返回指定 IO 的 {name, state, locked}，索引越界返回 None"""
        try:
            data = self.get_report()
            if not data:
                return None
            ios = json.loads(data).get("IO_status", [])
            if io_id < 0 or io_id >= len(ios):
                return None
            return ios[io_id]
        except Exception:
            return None

    def set_io(self, io_id: int, mode: int) -> str:
        """设置指定 IO 端口状态 (mode: 0=关, 1=开)"""
        try:
            data = self.get_report()
            if not data:
                return "MCU 数据不可用"
            buf = json.loads(data)
            if io_id < 0 or io_id >= len(buf["IO_status"]):
                return "无效的 IO 索引"
            if buf["IO_status"][io_id]["locked"]:
                return "IO 已锁定"
            self.write(f"SET_OUT_IO IOID {io_id} SETMODE {mode}")
            return "设置成功"
        except Exception as e:
            logger.send("ERROR", f"set_io 失败: {e}")
            return f"设置失败: {e}"

    def set_fan(self, fan_id: int, pwm: int) -> str:
        """设置指定风扇 PWM 值 (0-255)"""
        if fan_id < 0 or fan_id > 3:
            return "无效的风扇 ID"
        if pwm < 0 or pwm > 255:
            return "PWM 值应在 0-255 之间"
        try:
            self.write(f"SET_FAN_PWM FANID {fan_id} SETRPM {pwm}")
            return "设置成功"
        except Exception as e:
            logger.send("ERROR", f"set_fan 失败: {e}")
            return f"设置失败: {e}"

    # ==================== 外设配置与风扇模式 ====================

    def configure_peripherals(self) -> None:
        """按配置初始化 IO 和风扇，并启动 MCU 定时上报"""
        if self._debug_mode:
            logger.send("DEBUG", "调试模式 - 跳过外设配置")
            self._fan_mode = "Standard"
            return
        logger.send("DEBUG", "开始配置外设设备")
        for i, item in enumerate(self._io_state):
            self.write(f"SET_OUT_IO IOID {i} SETMODE {'1' if item[-1] == 'true' else '0'}")
            time.sleep(0.5)
        for i, speed in enumerate(self._fan_standard_mode):
            self.write(f"SET_FAN_PWM FANID {i} SETRPM {speed}")
            time.sleep(0.5)
        self._fan_mode = "Standard"
        self.write(f"REPORT S {self.REPORT_INTERVAL}")
        logger.send("INFO", "外设设备配置完成")

    @property
    def fan_mode(self) -> str:
        """当前风扇工作模式（'Standard' / 'Full' / ''）"""
        return self._fan_mode

    def apply_full_mode(self) -> None:
        """切换所有风扇到全速模式"""
        for i, speed in enumerate(self._fan_full_mode):
            self.write(f"SET_FAN_PWM FANID {i} SETRPM {speed}")
            time.sleep(0.5)
        self._fan_mode = "Full"
        logger.send("INFO", "风扇切换全速模式")

    def apply_standard_mode(self) -> None:
        """切换所有风扇到标准模式"""
        for i, speed in enumerate(self._fan_standard_mode):
            self.write(f"SET_FAN_PWM FANID {i} SETRPM {speed}")
            time.sleep(0.5)
        self._fan_mode = "Standard"
        logger.send("INFO", "风扇切换标准模式")

    # ==================== 调试数据 ====================

    @property
    def debug_data(self) -> str:
        return self._debug_data

    @debug_data.setter
    def debug_data(self, value: str) -> None:
        """设置调试数据，自动同步 FAN_RPM"""
        try:
            d = json.loads(value)
            if "FAN_PWM_SET" in d:
                pwm_list = d["FAN_PWM_SET"]
                if "FAN_RPM" not in d or len(d["FAN_RPM"]) != len(pwm_list):
                    d["FAN_RPM"] = [0] * len(pwm_list)
                for i, pwm in enumerate(pwm_list):
                    d["FAN_RPM"][i] = int(pwm) * 100
            value = json.dumps(d)
        except Exception as e:
            logger.send("WARNING", f"MCU 调试数据更新失败: {e}")
        self._debug_data = value
        if self._debug_mode:
            with self._lock:
                self._report_message = value

    # ==================== 内部辅助 ====================

    def _simulate(self, msg: str) -> None:
        """调试模式下模拟 MCU 执行命令"""
        logger.send("DEBUG", f"Mock MCU Send: {msg}")
        try:
            with self._lock:
                mcu = json.loads(self._report_message)
            parts = msg.split()
            if parts[0] == "SET_OUT_IO" and len(parts) >= 5:
                io_id, mode = int(parts[2]), int(parts[4])
                ios = mcu.setdefault("OUT_IO_SET", [])
                while len(ios) <= io_id:
                    ios.append(False)
                ios[io_id] = (mode == 1)
                logger.send("DEBUG", f"Debug IO: id={io_id} mode={mode}")
            elif parts[0] == "SET_FAN_PWM" and len(parts) >= 5:
                fan_id, pwm = int(parts[2]), int(parts[4])
                pwm_list = mcu.setdefault("FAN_PWM_SET", [])
                rpm_list = mcu.setdefault("FAN_RPM", [])
                while len(pwm_list) <= fan_id:
                    pwm_list.append(0)
                while len(rpm_list) <= fan_id:
                    rpm_list.append(0)
                pwm_list[fan_id] = pwm
                rpm_list[fan_id] = pwm * 100
                logger.send("DEBUG", f"Debug Fan: id={fan_id} pwm={pwm}")
            updated = json.dumps(mcu)
            with self._lock:
                self._report_message = updated
            self._debug_data = updated
        except Exception as e:
            logger.send("ERROR", f"MCU 模拟执行错误: {e}")
