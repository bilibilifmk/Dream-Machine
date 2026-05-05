#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
UPS 监控模块

通过 UPSMonitor 类封装 NUT (Network UPS Tools) 协议 UPS 状态监控，支持三种模式：
- OFF: UPS 监控关闭
- ON:  UPS 始终在线
- NUT: 通过 telnet 连接 NUT 服务器实时查询状态
"""

import re
import time
import threading
from typing import Optional, Any

import pexpect
from log import logger
from bark_notify import bark


class UPSMonitor:
    """UPS 状态监控管理器"""

    NUT_PORT = 3493
    POLL_INTERVAL = 10  # 秒

    def __init__(self) -> None:
        self._lock = threading.Lock()
        self._state: Optional[str] = None
        self._mode: Optional[str] = None
        self._host: Optional[str] = None

    # ==================== 初始化 ====================

    def setup(self, mode: str, host: Optional[str] = None) -> None:
        """配置并启动 UPS 监控

        参数:
            mode: "OFF" / "ON" / "NUT"
            host: NUT 服务器地址（mode 为 NUT 时必填）
        """
        self._mode = mode
        self._host = host

        if mode == "OFF":
            with self._lock:
                self._state = "break"
            logger.send("INFO", "UPS 监控已禁用")
        elif mode == "ON":
            with self._lock:
                self._state = "online"
            logger.send("INFO", "UPS 设置为始终在线")
        elif mode == "NUT":
            if not host:
                logger.send("ERROR", "UPS NUT 模式需要提供 HOST 地址")
                with self._lock:
                    self._state = "offline"
                return
            threading.Thread(
                target=self._monitor_loop,
                daemon=True
            ).start()
            logger.send("INFO", f"UPS 监控线程已启动，目标: {host}:{self.NUT_PORT}")
        else:
            logger.send("WARNING", f"未知的 UPS 模式: {mode}")

    # ==================== 状态查询 ====================

    @property
    def state(self) -> Optional[str]:
        """当前 UPS 状态（线程安全）"""
        with self._lock:
            return self._state

    # ==================== 内部监控循环 ====================

    def _monitor_loop(self) -> None:
        """后台轮询 UPS 状态（NUT 模式专用线程）"""
        host = self._host
        port = self.NUT_PORT
        interval = self.POLL_INTERVAL

        logger.send("INFO", "UPS 监控线程已启动")
        child: Optional[Any] = None
        retry_count = 0

        def connect() -> Optional[Any]:
            nonlocal retry_count
            try:
                c = pexpect.spawn(f"telnet {host} {port}", timeout=5)
                c.expect(".*")
                logger.send("INFO", "UPS 已连接")
                retry_count = 0
                return c
            except Exception as e:
                logger.send("ERROR", f"UPS 连接失败: {e}")
                retry_count += 1
                return None

        def get_value(c: Any, var_name: str) -> Optional[str]:
            try:
                c.sendline(f"GET VAR ups {var_name}")
                c.expect(rf'VAR ups {re.escape(var_name)} "[^"]+"'  , timeout=3)
                line = c.after.decode("utf-8", errors="ignore")
                match = re.search(r'"([^"]+)"', line)
                return match.group(1) if match else None
            except Exception as e:
                logger.send("ERROR", f"UPS 获取 {var_name} 失败: {e}")
                return None

        while True:
            if child is None:
                child = connect()

            if child:
                status = get_value(child, "ups.status")
                charge = get_value(child, "battery.charge")

                if status is None:
                    with self._lock:
                        self._state = "offline"
                    child.close()
                    child = None
                elif "OL" in status:
                    with self._lock:
                        prev = self._state
                        if prev and "电池供电" in prev:
                            bark.send("UPS 状态恢复", "UPS 已恢复市电供电", is_important=False)
                        self._state = "online"
                elif "OB" in status:
                    with self._lock:
                        new_state = f"电池供电 {charge}%" if charge else "电池供电"
                        prev = self._state
                        if prev != new_state and (not prev or "电池供电" not in prev):
                            body = (f"市电断开，UPS 已进入电池供电模式！当前电量: {charge}%"
                                    if charge else "市电断开，UPS 已进入电池供电模式！")
                            bark.send("UPS 警告", body, is_important=True)
                        self._state = new_state
                else:
                    with self._lock:
                        self._state = "未知状态"
            else:
                with self._lock:
                    self._state = "offline"

            time.sleep(interval)
