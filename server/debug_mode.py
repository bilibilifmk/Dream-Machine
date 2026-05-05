#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
调试模式管理模块

通过 DebugMode 类集中管理调试模式的状态与模拟数据：
- enabled:      当前是否处于调试模式
- network_data: 网络状态模拟数据
- server_data:  服务器列表模拟数据
- load():       从配置文件读取并更新调试模式开关
"""
from config import cfg
from log import logger


class DebugMode:
    """调试模式状态与模拟数据管理器"""

    DEFAULT_NETWORK_DATA: str = (
        '{"Network_card_status": "link", "gateway": "break", "WAN": "online",'
        ' "Reverse_proxy": "online", "God_use_VPN": "break"}'
    )
    DEFAULT_SERVER_DATA: str = (
        '[{"NAME": "主站服务器", "cpu_cores": 12, "load": 3.9599609375,'
        ' "load_percentage": "33%", "latency_ms": 9},'
        ' {"NAME": "FRP服务器", "error": "API错误"},'
        ' {"NAME": "tesssste", "error": "timed out"}]'
    )

    def __init__(self) -> None:
        self._enabled: bool = False
        self._network_data: str = self.DEFAULT_NETWORK_DATA
        self._server_data: str = self.DEFAULT_SERVER_DATA

    # ==================== 初始化 ====================

    def load(self) -> bool:
        """从配置文件读取调试模式开关，返回是否启用"""
        val = cfg.get("DEBUG", "enable")
        self._enabled = bool(val and val.lower() == "true")
        if self._enabled:
            logger.send("INFO", "调试模式已启用 - 将使用模拟数据")
        else:
            logger.send("INFO", "调试模式已禁用 - 将使用真实设备数据")
        return self._enabled

    # ==================== enabled 属性 ====================

    @property
    def enabled(self) -> bool:
        """当前调试模式开关状态"""
        return self._enabled

    @enabled.setter
    def enabled(self, value: bool) -> None:
        """更新调试模式并写入配置文件"""
        self._enabled = value
        cfg.set("DEBUG", "enable", "true" if value else "false")

    # ==================== 模拟数据属性 ====================

    @property
    def network_data(self) -> str:
        """网络状态模拟数据（JSON 字符串）"""
        return self._network_data

    @network_data.setter
    def network_data(self, value: str) -> None:
        self._network_data = value

    @property
    def server_data(self) -> str:
        """服务器列表模拟数据（JSON 字符串）"""
        return self._server_data

    @server_data.setter
    def server_data(self, value: str) -> None:
        self._server_data = value


# 模块级单例
debug = DebugMode()
