#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Bark 推送通知模块
"""

import urllib.parse
import requests
from config import cfg
from log import logger


class BarkNotifier:
    """Bark 推送通知封装类，每次发送时从配置文件读取最新配置"""

    def send(self, title: str, body: str, group: str = "Dream Machine", is_important: bool = False) -> bool:
        """发送 Bark 推送通知

        :param title: 通知标题
        :param body: 通知内容
        :param group: 通知分组，默认为 "Dream Machine"
        :param is_important: 是否为重要通知（True 使用 critical 级别触发震动）
        :return: 是否发送成功
        """
        try:
            # 检查总开关
            if str(cfg.get("BARK", "enable") or "").lower() != "true":
                return False

            # 检查仅推送重要通知开关
            if str(cfg.get("BARK", "important_only") or "").lower() == "true" and not is_important:
                return False

            server = (cfg.get("BARK", "server") or "https://api.day.app").rstrip("/")
            key = cfg.get("BARK", "key") or ""
            icon = cfg.get("BARK", "icon") or ""

            if not key:
                logger.send("WARNING", "Bark 密钥未配置，无法发送通知")
                return False

            if is_important:
                url = (
                    f"{server}/{urllib.parse.quote(key)}"
                    f"/{urllib.parse.quote(title)}"
                    f"/{urllib.parse.quote(body)}"
                    f"?level=critical&volume=5&group={urllib.parse.quote(group)}"
                )
                if icon:
                    url += f"&icon={urllib.parse.quote(icon)}"
                response = requests.get(url, timeout=5)
            else:
                url = f"{server}/{urllib.parse.quote(key)}/"
                data: dict = {"title": title, "body": body, "group": group}
                if icon:
                    data["icon"] = icon
                response = requests.post(url, data=data, timeout=5)

            if response.status_code == 200:
                logger.send("INFO", f"Bark 通知发送成功: {title}")
                return True
            else:
                logger.send("ERROR", f"Bark 通知发送失败: HTTP {response.status_code} - {response.text}")
                return False

        except Exception as e:
            logger.send("ERROR", f"Bark 通知发送异常: {str(e)}")
            return False


# 模块级单例，供其他模块直接 import 使用
bark = BarkNotifier()


if __name__ == "__main__":
    print("测试发送 Bark 普通通知...")
    print(f"普通通知发送结果: {bark.send('测试普通通知', '这是一条来自 Dream Machine 的普通测试消息', is_important=False)}")
    print("测试发送 Bark 重要通知...")
    print(f"重要通知发送结果: {bark.send('测试重要通知', '这是一条来自 Dream Machine 的重要测试消息', is_important=True)}")