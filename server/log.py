#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
日志模块

通过 AppLogger 类封装日志配置与记录功能：
- setup: 配置日志系统，支持日志轮转
- send:  发送日志消息
"""
import logging
import os
from logging.handlers import RotatingFileHandler

LOG_FORMAT  = "%(asctime)s %(name)s %(levelname)s  %(message)s "
DATE_FORMAT = "%Y-%m-%d  %H:%M:%S %a "

_LEVELS = {
    "DEBUG":    logging.DEBUG,
    "INFO":     logging.INFO,
    "WARNING":  logging.WARNING,
    "ERROR":    logging.ERROR,
    "CRITICAL": logging.CRITICAL,
}


class AppLogger:
    """应用日志管理器（封装 Python 标准 logging）"""

    def setup(self, level: str, f_name: str,
              max_size: int = 1024 * 1024,
              backup_count: int = 5) -> None:
        """配置日志系统（日志轮转）

        参数:
            level:        日志级别 DEBUG/INFO/WARNING/ERROR/CRITICAL
            f_name:       日志文件路径
            max_size:     单文件最大字节数，默认 1 MB
            backup_count: 保留备份数，默认 5
        """
        log_level = _LEVELS.get(level.upper(), logging.ERROR)

        log_dir = os.path.dirname(f_name)
        if log_dir:
            os.makedirs(log_dir, exist_ok=True)

        formatter = logging.Formatter(fmt=LOG_FORMAT, datefmt=DATE_FORMAT)
        handler   = RotatingFileHandler(
            f_name, maxBytes=max_size,
            backupCount=backup_count, encoding="utf-8"
        )
        handler.setFormatter(formatter)

        root = logging.getLogger()
        root.setLevel(log_level)
        root.addHandler(handler)
        root.info(f"{f_name} 日志系统已启动")

    def send(self, level: str, msg: str) -> None:
        """发送一条日志消息

        参数:
            level: 日志级别字符串
            msg:   消息内容
        """
        root = logging.getLogger()
        method = getattr(root, level.lower(), None)
        if callable(method):
            method(msg)
        else:
            root.error(f"无效的日志级别: {level}. 消息: {msg}")


# 模块级单例，供各模块直接导入使用
logger = AppLogger()
