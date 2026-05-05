# Dream Machine Server

机柜管理控制器后端服务，提供 IO 控制、风扇管理、UPS 监控、串口通信与 Web 界面。

---

## 目录结构

```
server/
├── app.py                    # 主入口，Flask + SocketIO 应用
├── config.py                 # 配置文件读写封装
├── configuration.cfg         # 系统配置（串口、网络、风扇、UPS 等）
├── log.py                    # 日志模块
├── bark_notify.py            # Bark 推送通知
├── mcu_serial.py             # MCU 串口通信模块
├── power_serial.py           # 电源模块串口通信
├── ups_monitor.py            # UPS 状态监控
├── debug_mode.py             # 调试模式辅助
├── pyproject.toml            # 项目依赖声明（uv）
├── Dream_Machine_server.service  # systemd 服务单元文件
├── DEPLOY.md                 # 部署文档
│
└── static/                   # 前端静态资源
    ├── index/
    │   ├── index.html        # 主控制界面
    │   ├── index.js          # 主界面逻辑
    │   └── index.css         # 主界面样式
    ├── login/
    │   ├── login.html        # 登录页
    │   └── login.jpg         # 登录背景图
    ├── cfg/
    │   ├── cfg.html          # 在线配置编辑器
    │   ├── ace.js            # Ace 编辑器
    │   ├── mode-ini.js       # INI 语法高亮
    │   └── theme-chrome.js   # 编辑器主题
    ├── debug.html            # 调试模式页面
    ├── ws.html               # WebSocket 调试页面
    ├── change_password.html  # 修改密码页面
    └── SmileySans-Oblique.ttf  # 字体文件
```

---

## 二次开发

### 添加新 HTTP 接口

在 `app.py` 中按如下模式添加路由：

```python
@app.route('/web_your_endpoint')
@login_required
def your_endpoint():
    return jsonify({...})
```

### 添加新 WebSocket 指令

在 `app.py` 的 `handle_message()` 函数中，在 `command_id == "COMMAND"` 分支下新增 `elif msg == "YOUR_CMD":` 处理块。

### 修改系统配置项

配置读写统一通过 `config.py` 的 `get_config(section, key)` / `set_config(section, key, value)` 操作 `configuration.cfg`。

### 前端

主界面逻辑集中在 `static/index/index.js`，与后端通过以下方式通信：

- HTTP 轮询：`/web_get_io_all`、`/web_get_network` 等接口
- WebSocket：Socket.IO，发送 JSON 指令，接收 `IO:`、`POWER:`、`NETWORK:`、`SERVER:`、`TIME:` 前缀消息

---

## 部署文档

## 开发阶段（本地）

使用 uv 启动：

```bash
uv run python app.py
```

启动后访问：

- 主界面：http://localhost:8081
- 默认账号：`root` / `password`

---

## 环境要求（线上）

- Linux（systemd）
- Python 3.9+
- root 权限

---

## 1. 安装 Python 依赖

```bash
pip3 install \
    flask \
    flask-login \
    flask-socketio \
    flask-sqlalchemy \
    pexpect \
    pyserial \
    requests \
    werkzeug \
    gevent \
    gevent-websocket
```

---



## 2. 注册 systemd 服务

```bash
cp Dream_Machine_server.service /etc/systemd/system/
systemctl daemon-reload
systemctl enable Dream_Machine_server
systemctl start Dream_Machine_server
```

查看运行状态：

```bash
systemctl status Dream_Machine_server
journalctl -u Dream_Machine_server -f
```

---

## 3. 更新部署

```bash
# 然后在服务器上重启服务
systemctl restart Dream_Machine_server
```

