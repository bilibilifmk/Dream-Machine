#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
电源模块串口通信模块

通过 PowerSerial 类封装与外置电源（CSPS 控制器）的串口通信，包括：
- 串口初始化与数据读写
- 上报数据缓存
- 调试模式模拟逻辑
"""

import time
import threading
from typing import Optional

import serial
from config import cfg
from log import logger


class PowerSerial:
    """外置电源（CSPS 控制器）串口通信管理器"""

    BAUDRATE = 115200
    TIMEOUT = 0.5
    WRITE_TIMEOUT = 1

    DEFAULT_DEBUG_DATA = (
        '{"ID":"Power","Powe_STATE":1,"IN_Voltage":239.38,"IN_Current":-1.00,'
        '"IN_Power":12.29,"OUT_Voltage":12.28,"OUT_Current":12.00,"OUT_Power":13.00,'
        '"Temp0":21.97,"Temp1":-1.00,"Fan":3795,"Time":-1.00}'
    )

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._serial: Optional[serial.Serial] = None
        self._report_message: str = ""
        self._mode: Optional[str] = None
        self._debug_mode: bool = False
        self._debug_data: str = self.DEFAULT_DEBUG_DATA

    # ==================== 初始化 ====================

    def setup(self, debug_mode: bool, power_mode: Optional[str]) -> None:
        """配置电源模块参数，应在 open_serial() 前调用"""
        self._debug_mode = debug_mode
        self._mode = power_mode
        if debug_mode:
            with self._lock:
                self._report_message = self._debug_data
            logger.send("DEBUG", "PowerSerial 已初始化（调试模式）")
        else:
            logger.send("DEBUG", "PowerSerial 已初始化")

    def open_serial(self) -> None:
        """打开电源模块串口；调试模式或 inside 模式下跳过"""
        if self._debug_mode:
            logger.send("DEBUG", "调试模式 - 跳过电源串口初始化")
            return
        if self._mode == "inside":
            return
        try:
            port = cfg.get("SYS", "Power_serial")
            self._serial = serial.Serial(
                port, self.BAUDRATE,
                timeout=self.TIMEOUT,
                write_timeout=self.WRITE_TIMEOUT,
                rtscts=1
            )
            logger.send("INFO", f"CSPS 控制器串口已连接: {port}")
        except Exception as e:
            logger.send("ERROR", f"CSPS 控制器串口打开失败: {e}")

    # ==================== 串口读写 ====================

    def write(self, msg: str) -> bool:
        """发送命令到电源串口；inside 模式下直接忽略"""
        if self._mode == "inside":
            return False
        try:
            if self._serial is None:
                logger.send("WARNING", "电源串口未初始化")
                return False
            self._serial.write(msg.encode('utf-8'))
            logger.send("DEBUG", f"发送到电源: {msg}")
            time.sleep(0.1)
            return True
        except Exception as e:
            logger.send("ERROR", f"电源串口发送超时: {e}")
            return False

    def read_loop(self) -> None:
        """持续读取电源上报数据（后台线程入口）；调试或 inside 模式下直接返回"""
        if self._debug_mode:
            logger.send("DEBUG", "调试模式 - 跳过电源串口读取")
            return
        if self._mode == "inside":
            return

        error_count = 0
        logger.send("INFO", "电源串口读取线程已启动")

        while True:
            try:
                if self._serial and self._serial.in_waiting > 0:
                    raw = self._serial.readline()
                    try:
                        data = raw.decode('utf-8').strip()
                        with self._lock:
                            self._report_message = data
                        logger.send("DEBUG", f"接收自电源: {data}")
                        error_count = 0
                    except UnicodeDecodeError:
                        logger.send("WARNING", "电源数据编码错误，非 UTF-8")
            except Exception as e:
                logger.send("ERROR", f"电源串口读取错误: {e}")
                error_count += 1
                if error_count > 10:
                    logger.send("ERROR", "电源串口读取线程因连续错误退出")
                    break
            time.sleep(0.1)

    # ==================== 数据访问 ====================

    def get_report(self) -> str:
        """返回最新一条电源上报消息"""
        with self._lock:
            return self._report_message

    @property
    def mode(self) -> Optional[str]:
        """当前电源模式"""
        return self._mode

    # ==================== 调试数据 ====================

    @property
    def debug_data(self) -> str:
        return self._debug_data

    @debug_data.setter
    def debug_data(self, value: str) -> None:
        """更新调试模拟数据并同步到上报缓存"""
        self._debug_data = value
        if self._debug_mode:
            with self._lock:
                self._report_message = value
