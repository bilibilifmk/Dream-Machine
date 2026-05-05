#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
配置管理模块

通过 AppConfig 类封装配置文件的读写操作：
- get:         读取指定区块和参数的配置值
- set:         写入配置值并保存
- init_mcu:    初始化 MCU 相关配置
- read_server: 读取服务器列表
"""
import configparser
import os
from typing import Optional, List, Dict, Any, Tuple

CONFIG_FILE = "./configuration.cfg"


class AppConfig:
    """配置文件管理器（基于 configparser）"""

    def __init__(self, config_file: str = CONFIG_FILE) -> None:
        self._file = config_file

    # ==================== 读写 ====================

    def _read(self) -> configparser.ConfigParser:
        cp = configparser.ConfigParser()
        cp.read(self._file, encoding="utf-8")
        return cp

    def get(self, area: str, parameter: str) -> Optional[str]:
        """读取配置值；不存在时返回 None"""
        cp = self._read()
        if area in cp:
            return cp[area].get(parameter, None)
        return None

    def set(self, area: str, parameter: str, value: Any) -> None:
        """写入配置值并立即保存到文件"""
        cp = configparser.ConfigParser()
        cp.read(self._file, encoding="utf-8")
        if area not in cp:
            cp.add_section(area)
        cp[area][parameter] = str(value)
        with open(self._file, "w", encoding="utf-8") as f:
            cp.write(f)

    # ==================== MCU 配置 ====================

    def init_mcu(self) -> Tuple[List[List[str]], List[List[str]], List[str], List[str]]:
        """读取 MCU IO 与风扇配置

        返回:
            (IO_state, FAN_state, FAN_Standard_mode, FAN_full_mode)
        """
        io_state  = [self._read_io(i)  for i in range(7)]
        fan_state = [self._read_fan(i) for i in range(4)]
        fan_std   = self._read_fan_mode("Standard_mode")
        fan_full  = self._read_fan_mode("full_mode")
        return io_state, fan_state, fan_std, fan_full

    def _read_io(self, io_id: int) -> List[str]:
        key = f"IO{io_id}"
        return [
            key,
            self.get(key, "NAME")    or "",
            self.get(key, "LOCK")    or "false",
            self.get(key, "DEFAULT") or "false",
        ]

    def _read_fan(self, fan_id: int) -> List[str]:
        key = f"FAN{fan_id}"
        return [key, self.get(key, "NAME") or ""]

    def _read_fan_mode(self, mode_id: str) -> List[str]:
        mode_name = self.get("SYS", mode_id)
        if not mode_name:
            return ["0"] * 4
        return [self.get(mode_name, f"FAN{i}") or "0" for i in range(4)]

    # ==================== 服务器列表 ====================

    def read_server(self) -> List[Dict[str, str]]:
        """读取服务器列表配置"""
        cp = self._read()
        if "SERVER_LIST" not in cp:
            return []
        servers = []
        for _, server_name in cp["SERVER_LIST"].items():
            if server_name in cp:
                sc = cp[server_name]
                servers.append({
                    "NAME": sc.get("NAME", ""),
                    "HOST": sc.get("HOST", ""),
                    "KEY":  sc.get("KEY",  ""),
                })
        return servers


# 模块级单例，供各模块直接导入使用
cfg = AppConfig()
