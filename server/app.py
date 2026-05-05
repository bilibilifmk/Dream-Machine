#!/usr/bin/env python
# -*- coding: utf-8 -*-
"""
Dream Machine 服务器 - 主应用程序

该应用提供以下功能：
- 用户认证和权限管理
- MCU 和电源模块的串口通信
- IO 端口和风扇控制
- UPS 监控和管理
- 网络状态和服务器监控
- WebSocket 实时数据推送
- Web 配置界面
作者: keai
"""

# 标准库导入
import os
import json
import time
import threading
import subprocess
import ipaddress
from datetime import datetime
from typing import Optional, Dict, List, Any

# 第三方库导入
import requests
from flask import Flask, render_template, request, redirect, url_for, flash, jsonify, abort
from flask_login import LoginManager, UserMixin, login_user, login_required, logout_user, current_user
from flask_sqlalchemy import SQLAlchemy
from werkzeug.security import generate_password_hash, check_password_hash
from flask_socketio import SocketIO, emit, disconnect

# 本地模块导入
from config import cfg
from log import logger
from mcu_serial import MCUSerial
from power_serial import PowerSerial
from ups_monitor import UPSMonitor
from debug_mode import debug
from bark_notify import bark

# ==================== 子系统实例 ====================
mcu = MCUSerial()
power = PowerSerial()
ups = UPSMonitor()

# ==================== 常量定义 ====================
class AppConstants:
    """应用常量配置"""
    SECRET_KEY = 'supersecretkey'
    DATABASE_URI = 'sqlite:///user.db'
    HOST = '0.0.0.0'
    PORT = 8081
    LOG_FILE = './run.log'
    CONFIG_FILE = 'configuration.cfg'
    DEFAULT_USERNAME = 'root'
    DEFAULT_PASSWORD = 'password'


# ==================== 全局变量 ====================
lock = threading.Lock()


# 服务器列表与网络状态
SERVER_LIST: Optional[List[Dict[str, str]]] = None
Network_STATE: Optional[str] = None
SERVER_STATE: Optional[str] = None

# 滤芯信息
Remaining_filter_element: Optional[str] = None
filter_element_MAX: Optional[str] = None
Lighting_IO: Optional[str] = None

# 风扇全速模式时间段
FAN_full_mode_time: str = ""

# 环境安全配置
env_safety_enable: bool = False
filter_alert_enable: bool = False
temp_limit: float = 75.0
temp_limit_io_actions: dict = {}   # {io_id: "true"|"false"}
temp_alert_triggered: bool = False

# WebSocket 连接数
WebSocket_user: int = 0

# 程序启动时间
Start_Time: float = time.time()

# ==================== 日志初始化 ====================
logger.setup("INFO", AppConstants.LOG_FILE)

# ==================== Flask 应用配置 ====================
app = Flask(__name__, static_url_path='/static')
app.secret_key = AppConstants.SECRET_KEY
app.config['SQLALCHEMY_DATABASE_URI'] = AppConstants.DATABASE_URI
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False

socketio = SocketIO(app, async_mode='gevent', cors_allowed_origins='*')
db = SQLAlchemy(app)
login_manager = LoginManager()
login_manager.init_app(app)
login_manager.login_view = 'login'
# ==================== 数据库模型 ====================
class User(UserMixin, db.Model):
    """用户模型 - 存储用户认证信息
    
    字段:
        id: 用户唯一标识符
        username: 用户名，唯一
        password_hash: 密码哈希值
    """
    __tablename__ = 'users'
    id = db.Column(db.Integer, primary_key=True)
    username = db.Column(db.String(150), unique=True, nullable=False)
    password_hash = db.Column(db.String(150), nullable=False)

    def check_password(self, password: str) -> bool:
        """验证密码是否正确
        
        参数:
            password: 明文密码
        
        返回:
            bool: 密码是否匹配
        """
        return check_password_hash(self.password_hash, password)

    def set_password(self, password: str) -> None:
        """设置用户密码
        
        参数:
            password: 明文密码
        """
        self.password_hash = generate_password_hash(password, method="pbkdf2:sha256")


# ==================== 初始化函数 ====================
def init_cfg() -> None:
    """初始化系统配置，并完成各子模块的初始化"""
    global Network_STATE, SERVER_STATE, SERVER_LIST
    global Remaining_filter_element, filter_element_MAX, Lighting_IO
    global FAN_full_mode_time

    try:
        # 加载调试模式配置
        debug.load()
        if debug.enabled:
            Network_STATE = debug.network_data
            SERVER_STATE = debug.server_data

        # 加载 MCU 配置并初始化 MCU 模块
        io_state, fan_state, fan_std, fan_full = cfg.init_mcu()
        FAN_full_mode_time = cfg.get("SYS", "full_mode_time") or ""
        mcu.setup(debug.enabled, io_state, fan_state, fan_std, fan_full, FAN_full_mode_time)

        # 初始化电源模块
        power_mode = cfg.get("SYS", "Power_mode")
        power.setup(debug.enabled, power_mode)

        # 加载其他系统配置
        Remaining_filter_element = cfg.get("SYS", "Remaining_filter_element")
        filter_element_MAX = cfg.get("SYS", "filter_element_MAX")
        Lighting_IO = cfg.get("SYS", "Lighting_IO")

        # 初始化 UPS 监控模块
        ups_mode = cfg.get("UPS", "MODE")
        ups_host = cfg.get("UPS", "HOST") if ups_mode == "NUT" else None
        ups.setup(ups_mode, ups_host)

        # 加载 ENV_SAFETY 配置
        global env_safety_enable, filter_alert_enable, temp_limit, temp_limit_io_actions, temp_alert_triggered
        env_safety_enable = str(cfg.get("ENV_SAFETY", "temp_limit_enable") or "").lower() == "true"
        filter_alert_enable = str(cfg.get("ENV_SAFETY", "filter_element_alert_enable") or "").lower() == "true"
        try:
            temp_limit = float(cfg.get("ENV_SAFETY", "limit") or 75.0)
        except (ValueError, TypeError):
            temp_limit = 75.0
        temp_limit_io_actions = {}
        for i in range(7):
            action = cfg.get("ENV_SAFETY", f"io{i}_action")
            if action in ["true", "false"]:
                temp_limit_io_actions[i] = action
        temp_alert_triggered = False

        # 加载服务器列表
        SERVER_LIST = cfg.read_server()

        # 启动定时任务线程
        threading.Thread(target=time_loop, args=(60,), daemon=True).start()
        logger.send("INFO", "配置初始化完成")
        bark.send("Dream Machine 已启动", "服务已成功启动，推送通道正常", is_important=False)

    except Exception as e:
        logger.send("ERROR", f"配置初始化失败: {str(e)}")
        raise


def init_serial() -> None:
    """初始化 MCU 和电源模块串口连接（委托给各子模块）"""
    mcu.open_serial()
    power.open_serial()

# ==================== 外设配置 ====================
def Configuring_Peripherals() -> None:
    """配置外设设备（委托给 mcu_serial 模块）"""
    mcu.configure_peripherals()

def get_power_status() -> str:
    """获取电源状态数据

    根据 Power_mode 配置返回相应的电源数据：
    - inside: 返回 MCU 内置电源数据（从 mcu.get_report() 提取）
    - external: 返回外部电源模块数据（power.get_report()）

    返回:
        JSON 字符串包含电源状态信息
    """
    try:
        if power.mode == "inside":
            mcu_report = mcu.get_report()
            if mcu_report:
                mcu_data = json.loads(mcu_report)
                voltage = mcu_data.get("voltage_buf", [0])[0] if mcu_data.get("voltage_buf") else 0
                current = mcu_data.get("Current", 0) / 1000
                power_status = {
                    "ID": "Power",
                    "Mode": "inside",
                    "OUT_Voltage": voltage,
                    "OUT_Current": round(current, 3),
                    "OUT_Power": round(voltage * current, 2),
                }
                return json.dumps(power_status, ensure_ascii=False)
            else:
                return json.dumps({"ID": "Power", "Mode": "inside", "error": "MCU数据不可用"}, ensure_ascii=False)
        else:
            power_report = power.get_report()
            if power_report:
                power_data = json.loads(power_report)
                power_data["Mode"] = "external"
                return json.dumps(power_data, ensure_ascii=False)
            else:
                return json.dumps({"ID": "Power", "Mode": "external", "error": "外部电源数据不可用"}, ensure_ascii=False)
    except Exception as e:
        logger.send("ERROR", f"get_power_status 失败: {str(e)}")
        return json.dumps({"ID": "Power", "error": str(e)}, ensure_ascii=False)

# ==================== 数据整合函数 ====================
def get_io_all() -> str:
    """获取所有 IO 和环境信息，整合 MCU/电源/UPS/滤芯数据"""
    global Remaining_filter_element, filter_element_MAX, Lighting_IO

    try:
        buf_request = mcu.get_report()
        if not buf_request:
            return json.dumps({"error": "MCU 数据不可用"}, ensure_ascii=False)

        json_buf = json.loads(buf_request)

        if Remaining_filter_element and filter_element_MAX:
            remaining_pct = round((int(Remaining_filter_element) / int(filter_element_MAX)) * 100)
            json_buf["Remaining_filter_element"] = remaining_pct

        json_buf["Lighting_IO"] = Lighting_IO
        json_buf["UPS_STATE"] = ups.state

        power_report = power.get_report()
        if power.mode != "inside" and power_report:
            try:
                power_data = json.loads(power_report)
                json_buf["OUT_Voltage"] = power_data.get("OUT_Voltage", 0)
                json_buf["OUT_Current"] = power_data.get("OUT_Current", 0)
                json_buf["OUT_Power"] = power_data.get("OUT_Power", 0)
            except json.JSONDecodeError:
                logger.send("WARNING", "电源数据解析失败")

        return json.dumps(json_buf, ensure_ascii=False, indent=4)

    except Exception as e:
        logger.send("ERROR", f"get_io_all 失败: {str(e)}")
        return json.dumps({"error": str(e)}, ensure_ascii=False)


# ==================== 定时任务（滤芯/网络/服务器/风扇） ====================
#空气滤芯计算&网络状态&服务器状态
def time_loop(interval=60):
    logger.send("DEBUG", "time_loop函数线程启动")

    def get_server_status():
        global SERVER_LIST, SERVER_STATE
        return_list = []
        for server in SERVER_LIST:
            server_name = server["NAME"]
            server_host = server["HOST"]
            server_key = server["KEY"]
            params = {"key": server_key}
            try:
                start_time = time.time()
                response = requests.get("http://" + server_host, params=params, timeout=0.5)
                latency = (time.time() - start_time) * 1000
                if response.status_code == 200:
                    data = response.json()
                    return_list.append({
                        "NAME": server_name,
                        "cpu_cores": data.get("cpu_cores"),
                        "load": data.get("load"),
                        "load_percentage": data.get("load_percentage"),
                        "latency_ms": round(latency),
                    })
                else:
                    return_list.append({"NAME": server_name, "error": "API访问失败"})
            except requests.exceptions.Timeout:
                return_list.append({"NAME": server_name, "error": "timed out"})
            except Exception:
                return_list.append({"NAME": server_name, "error": "API错误"})
        result = json.dumps(return_list, ensure_ascii=False)
        with lock:
            SERVER_STATE = result
        return result

    def is_eth_connected():
        try:
            iface = cfg.get("NETWORK", "car_name")
            result = subprocess.check_output(f"ip link show {iface}", shell=True, text=True)
            return "link" if ("LOWER_UP" in result and "UP" in result) else "break"
        except subprocess.CalledProcessError:
            return "break"

    def get_url(modes):
        try:
            response = requests.get(cfg.get("NETWORK", modes), timeout=2)
            return "online" if response.status_code in (200, 404) else "break"
        except Exception:
            return "break"

    def is_fan_full_mode(fan_time_range: str) -> bool:
        if fan_time_range.strip() == "0:0":
            return False
        try:
            start_hour_str, end_hour_str = fan_time_range.strip().split(":")
            start_hour = int(start_hour_str)
            end_hour = int(end_hour_str)
        except ValueError:
            raise ValueError("时间格式应为 'HH:HH'，例如 '21:0' 或 '15:14'")
        now_hour = datetime.now().hour
        if start_hour == end_hour:
            return False
        if start_hour < end_hour:
            return start_hour <= now_hour < end_hour
        else:
            return now_hour >= start_hour or now_hour < end_hour

    global Remaining_filter_element, Network_STATE, FAN_full_mode_time
    global env_safety_enable, filter_alert_enable, temp_limit, temp_limit_io_actions, temp_alert_triggered
    run_time = time.time()
    filter_alert_sent = False
    temp_log_time = time.time()
    while True:
        if time.time() - run_time >= 3600:
            try:
                Remaining_filter_element = cfg.get("SYS", "Remaining_filter_element")
                Remaining_filter_element = str(max(0, int(Remaining_filter_element) - 1))
                cfg.set("SYS", "Remaining_filter_element", Remaining_filter_element)
                run_time = time.time()
                logger.send("DEBUG", "滤芯寿命-1")

                # 滤芯耗尽通知
                if filter_alert_enable:
                    if int(Remaining_filter_element) <= 0 and not filter_alert_sent:
                        bark.send("滤芯寿命耗尽", "空气滤芯剩余寿命已归零，请及时更换！", is_important=False)
                        filter_alert_sent = True
                    elif int(Remaining_filter_element) > 0:
                        filter_alert_sent = False

            except Exception as e:
                logger.send("ERROR", f"滤芯寿命计算失败: {str(e)}")

        # 温度安全监控
        if env_safety_enable:
            try:
                current_temp = None
                mcu_report = mcu.get_report()
                if mcu_report:
                    m_buf = json.loads(mcu_report)
                    if "Temperature" in m_buf and m_buf["Temperature"] != -1:
                        current_temp = float(m_buf["Temperature"])

                if current_temp is not None:
                    if current_temp >= temp_limit and not temp_alert_triggered:
                        logger.send("WARNING", f"温度超限！当前: {current_temp}°C, 阈值: {temp_limit}°C")
                        bark.send(
                            "高温紧急警告",
                            f"机柜温度已达到 {current_temp}°C，超过安全阈值 {temp_limit}°C！",
                            is_important=True
                        )
                        for io_num, action_str in temp_limit_io_actions.items():
                            mcu_action = "1" if action_str == "true" else "0"
                            mcu.set_io(io_num, int(mcu_action))
                            logger.send("WARNING", f"高温触发: IO{io_num} → {mcu_action}")
                        temp_alert_triggered = True
                        temp_log_time = time.time()
                    elif current_temp < temp_limit and temp_alert_triggered:
                        logger.send("INFO", f"温度恢复正常: {current_temp}°C")
                        bark.send(
                            "温度恢复正常",
                            f"机柜温度已回落至 {current_temp}°C，温度安全警报解除。为安全仍需要手动恢复电源IO",
                            is_important=False
                        )
                        temp_alert_triggered = False
            except Exception as e:
                logger.send("ERROR", f"温度监控异常: {str(e)}")

        get_server_status()

        Network_STATE = json.dumps({
            "Network_card_status": is_eth_connected(),
            "gateway": get_url("gateway"),
            "WAN": get_url("wan"),
            "Reverse_proxy": get_url("reverse_proxy"),
            "God_use_VPN": get_url("god_use_vpn"),
        })

        # 风扇全速模式切换（委托给 mcu_serial 模块）
        if mcu.fan_mode != "":
            if is_fan_full_mode(FAN_full_mode_time):
                logger.send("DEBUG", "风扇全速模式")
                if mcu.fan_mode != "Full":
                    mcu.apply_full_mode()
            else:
                logger.send("DEBUG", "风扇标准模式")
                if mcu.fan_mode != "Standard":
                    mcu.apply_standard_mode()

        time.sleep(interval)



# 加载用户
@login_manager.user_loader
def load_user(user_id):
    return User.query.get(int(user_id))

# 首页，登录后才可访问
@app.route('/')
@login_required
def index():
    return app.send_static_file('index/index.html')

@app.route('/aaa')
@login_required
def homaae():
    return f'Hello, {current_user.username}! You areaaaaa logged in.'



# 登录页面
@app.route('/login', methods=['GET', 'POST'])
def login():
    if request.method == 'POST':
        username = request.form['username']
        password = request.form['password']
        user = User.query.filter_by(username=username).first()
        if user and user.check_password(password):
            login_user(user)
            flash('Logged in successfully.')
            return redirect(url_for('index'))
        flash('Invalid username or password.')
    return app.send_static_file('login/login.html')

# 修改密码页面
@app.route('/change_password', methods=['GET', 'POST'])
@login_required
def change_password():
    if request.method == 'POST':
        new_password = request.form.get('new_password', '')
        if not new_password:
            return jsonify({'status': 'error', 'message': '密码不能为空'}), 400
        current_user.set_password(new_password)
        db.session.commit()
        return jsonify({'status': 'success', 'message': '密码修改成功'})
    return app.send_static_file('change_password.html')

# 登出功能
@app.route('/logout')
@login_required
def logout():
    logout_user()
    flash('You have been logged out.')
    return redirect(url_for('login'))

# 初始化数据库并创建默认用户
def create_user():
    db.create_all()
    if not User.query.filter_by(username=AppConstants.DEFAULT_USERNAME).first():
        user = User(username=AppConstants.DEFAULT_USERNAME)
        user.set_password(AppConstants.DEFAULT_PASSWORD)
        db.session.add(user)
        db.session.commit()

# web设置io
@app.route('/web_setio')
@login_required
def web_setio():
    ioid = request.args.get('ioid', type=int)
    mode = request.args.get('mode', type=int)
    if ioid is None or mode is None:
        return jsonify({'error': '参数缺失'}), 400
    result = mcu.set_io(ioid, mode)
    return jsonify({'message': result})

# web 反转io（5秒后恢复）
@app.route('/web_restart_io')
@login_required
def web_restart_io():
    ioid = request.args.get('ioid', type=int)
    if ioid is None:
        return jsonify({'error': '参数缺失'}), 400
    # 检查是否已锁定
    io_info = mcu.get_io_info(ioid)
    if io_info is None:
        return jsonify({'error': 'IO不存在'}), 404
    if io_info.get('locked'):
        return jsonify({'error': '该IO已锁定，无法反转'}), 403
    current_state = 1 if io_info.get('state', False) else 0
    new_state = 0 if current_state else 1
    mcu.set_io(ioid, new_state)
    def restore():
        time.sleep(5)
        mcu.set_io(ioid, current_state)
    threading.Thread(target=restore, daemon=True).start()
    return jsonify({'message': f'IO{ioid} 已反转，5秒后恢复', 'new_state': new_state})

# web 设置风扇
@app.route('/web_setfan')
@login_required
def web_setfan():
    fanid = request.args.get('fanid', type=int)
    pwm = request.args.get('pwm', type=int)
    if fanid is None or pwm is None:
        return jsonify({'error': '参数缺失'}), 400
    result = mcu.set_fan(fanid, pwm)
    return jsonify({'message': result})

# web 获取全部io环境信息 
@app.route('/web_get_io_all')
@login_required
def web_get_io_all():
    # global Power_mode, Power_Report_message
    # global Remaining_filter_element, filter_element_MAX, Lighting_IO
    # global UPS_STATE
    # buf_request = MCU_Report_SP()
    # json_buf = json.loads(buf_request)
    # Remaining_filter_calculation =  round((int(Remaining_filter_element) / int(filter_element_MAX)) * 100)
    # json_buf["Remaining_filter_element"] = Remaining_filter_calculation
    # json_buf["Lighting_IO"] = Lighting_IO
    # with lock:
    #     json_buf["UPS_STATE"] = UPS_STATE
    # if Power_mode != "inside":
    #     with lock:
    #         p_buf = json.loads(Power_Report_message)
    #     json_buf["OUT_Voltage"] = p_buf.get("OUT_Voltage", 0)
    #     json_buf["OUT_Current"] = p_buf.get("OUT_Current", 0)
    #     json_buf["OUT_Power"] = p_buf.get("OUT_Power", 0)
    # return json.dumps(json_buf, ensure_ascii=False, indent=4)
    return get_io_all()
# web 获取网络信息

@app.route('/web_get_network')
@login_required
def web_get_network():
    global Network_STATE
    return Network_STATE


# web获取服务器信息 
@app.route('/web_get_server')
@login_required
def web_get_server():
    global SERVER_STATE
    return SERVER_STATE

# @sockets.route('/echo')
# def echo_socket(ws):
#     print("connection start")
#     while not ws.closed:
#         msg = ws.receive() # 同步阻塞
#         print(msg)
#         now = datetime.datetime.now().isoformat()
#         ws.send(now)  # 发送数据
#         time.sleep(1)

# web 获取电源状态信息
@app.route('/web_get_power')
@login_required
def web_get_power():
    """获取电源状态 API

    根据 power_mode 配置返回内置或外部电源数据
    """
    return get_power_status()

@app.route('/local-only')
@login_required
def local_only_endpoint():
    # 检查请求的 IP 地址是否为 127.0.0.1
    if request.remote_addr != '127.0.0.1':
        abort(403)  # 返回 403 Forbidden 状态码，拒绝访问
    return "This endpoint is only accessible from localhost!"


# 与屏幕通信部分
def _get_client_ip() -> str:
    """优先使用反向代理头，回退 remote_addr。"""
    xff = (request.headers.get('X-Forwarded-For') or '').split(',')[0].strip()
    xri = (request.headers.get('X-Real-IP') or '').strip()
    return xff or xri or (request.remote_addr or '')


def _is_allowed_ws_client(ip: str) -> bool:
    """仅允许回环与内网地址访问 WS 通道。"""
    try:
        addr = ipaddress.ip_address(ip)
        return addr.is_loopback or addr.is_private
    except ValueError:
        return False


# WebSocket 连接建立时的事件处理
@socketio.on('connect')
def handle_connect():
    global WebSocket_user
    client_ip = _get_client_ip()

    if not _is_allowed_ws_client(client_ip):
        logger.send("ERROR", f"{client_ip}尝试建立非法通信")
        emit('connection_rejected', {'message': '访问通道不在白名单'})
        disconnect()
    else:
        logger.send("DEBUG", f"WS客户端加入通信: {client_ip}")
        WebSocket_user += 1
        emit('response', {'message': 'welcome to Dream Machine.'})

# 接收客户端消息的事件处理
@socketio.on('message')
def handle_message(data):
    global ui_thread, ui_thread_running
    # print(f"Received message from client: {data}")

    try:
        command = json.loads(data)
        command_id = command.get("ID")
        if command_id == "COMMAND":
            msg = command.get("MSG")
            if msg == "RUN":
                if not ui_thread_running:
                    ui_thread_running = True
                    ui_thread = threading.Thread(target=background_thread)
                    ui_thread.start()
                    emit('response', {'message': '消息开始轮询'})

            elif msg == "STOP":
                ui_thread_running = False
                emit('response', {'message': '消息关闭轮询'})
            elif msg == "OFF_DP":
                try:
                    env = os.environ.copy()
                    env["DISPLAY"] = ":0"
                    subprocess.run(["xset", "dpms", "force", "off"], env=env, check=True)
                except subprocess.CalledProcessError as e:
                    pass
            elif msg == "GET_DP":
                try:
                    env = os.environ.copy()
                    env["DISPLAY"] = ":0"
                    result = subprocess.run(["xset", "q"], env=env, capture_output=True, text=True, timeout=3)
                    if "Monitor is On" in result.stdout:
                        dp_state = "on"
                    elif "Monitor is Off" in result.stdout:
                        dp_state = "off"
                    else:
                        dp_state = "unknown"
                    emit('response', {'message': 'DP_STATUS:' + dp_state})
                except Exception as e:
                    emit('response', {'message': 'DP_STATUS:unknown'})
            elif msg == "REBOOT":
                try:
                    subprocess.check_output("reboot", shell=True, text=True)
                except subprocess.CalledProcessError as e:
                    pass
        elif command_id == "SETIO": 
            io_pin = command.get("IO")
            state = command.get("SET")
            mcu.set_io(int(io_pin), int(state))

        elif command_id == "SETFAN":
            fan_id = command.get("FANID")
            fan_speed = command.get("SET")
            mcu.set_fan(int(fan_id), int(fan_speed))

        else:
            logger.send("WARNING", "未知指令：" + data)

    except json.JSONDecodeError:
        logger.send("ERROR", "无法解析数据，确保消息是有效的 JSON 格式: " + data)
            
    except Exception as e:
        logger.send("ERROR", f"handle_message处理消息时发生错误: {e}")
    # if data == 'run':
    #     # 启动后台线程来持续发送消息
    #     if not ui_thread_running:
    #         ui_thread_running = True
    #         ui_thread = threading.Thread(target=background_thread)
    #         ui_thread.start()
    #         emit('response', {'message': '消息开始轮询'})
    # elif data == 'stop':
    #     # 停止后台线程
    #     ui_thread_running = False
    #     emit('response', {'message': 'Stopped background message loop'})

    # else:
    #     emit('response', {'message': f'Server received: {data}'})

# 处理 WebSocket 断开连接事件
@socketio.on('disconnect')
def handle_disconnect():
    global ui_thread_running
    global WebSocket_user
    WebSocket_user -= 1
    # print("Client disconnected")
    if WebSocket_user <= 0:
        ui_thread_running = False  # 停止后台线程


# 标记后台线程的状态
ui_thread = None
ui_thread_running = False

def background_thread():
    """后台线程持续发送消息到客户端"""
    global ui_thread_running, Start_Time, Network_STATE, SERVER_STATE

    while ui_thread_running:
        buf_io_all = get_io_all()
        socketio.emit('response', {'message': "IO:" + str(buf_io_all)})
        socketio.sleep(0.1)
        socketio.emit('response', {'message': "POWER:" + str(power.get_report())})
        socketio.sleep(0.1)
        socketio.emit('response', {'message': "NETWORK:" + str(Network_STATE)})
        socketio.sleep(0.1)
        socketio.emit('response', {'message': "SERVER:" + str(SERVER_STATE)})
        socketio.sleep(0.1)
        elapsed_time = round((time.time() - Start_Time) / 3600, 2)
        socketio.emit('response', {'message': "TIME:" + str(elapsed_time)})
        socketio.sleep(1)


@app.route('/ws', methods=['GET', 'POST'])
def web_ws():
    # return  get_server_status()
    return app.send_static_file('ws.html')

@app.route('/cfg', methods=['GET', 'POST'])
@login_required
def cscscfg():
    return app.send_static_file('cfg/cfg.html')

@app.route('/cfg_load', methods=['GET'])
@login_required
def cfg_load_file():
    try:
        with open("configuration.cfg", 'r') as file:
            content = file.read()
        return content, 200
    except Exception as e:
        return str(e), 500

@app.route('/cfg_save', methods=['POST'])
@login_required
def cfg_save_file():
    data = request.get_json()
    content = data.get('content', '')
    filename = 'configuration.cfg'
    try:
        with open(filename, 'w') as file:
            file.write(content)
        return jsonify({"status": "success"}), 200
    except Exception as e:
        return str(e), 500

@app.route('/system_restart', methods=['GET'])
@login_required
def system_restart():
    """重启系统服务"""
    try:
        logger.send("WARNING", "重启整个框架")
        logger.send("WARNING", "重启UI")
        subprocess.run(
            ["systemctl", "restart", "Dream_Machine_app.service"],
            check=True
        )
        logger.send("WARNING", "重启Server")
        subprocess.run(
            ["systemctl", "restart", "Dream_Machine_server.service"],
            check=True
        )
        return "ok", 200
    except subprocess.CalledProcessError as e:
        logger.send("ERROR", "重启失败")
        return str(e), 500

# ==================== 调试模式 API ====================
@app.route('/debug', methods=['GET'])
@login_required
def debug_page():
    """调试模式控制页面"""
    return app.send_static_file('debug.html')

@app.route('/debug/status', methods=['GET'])
@login_required
def debug_status():
    """获取调试模式状态"""
    return jsonify({"debug_mode": debug.enabled})

@app.route('/debug/get_data', methods=['GET'])
@login_required
def debug_get_data():
    """获取所有模拟数据"""
    return jsonify({
        "mcu_data": mcu.debug_data,
        "power_data": power.debug_data,
        "network_data": debug.network_data,
        "server_data": debug.server_data
    })

@app.route('/debug/set_data', methods=['POST'])
@login_required
def debug_set_data():
    """设置模拟数据"""
    global Network_STATE, SERVER_STATE

    try:
        data = request.get_json()
        data_type = data.get('type')
        value = data.get('value')

        if not data_type or value is None:
            return jsonify({"status": "error", "message": "参数缺失"}), 400

        try:
            json.loads(value)
        except json.JSONDecodeError:
            return jsonify({"status": "error", "message": "无效的JSON格式"}), 400

        if data_type == 'mcu':
            mcu.debug_data = value
        elif data_type == 'power':
            power.debug_data = value
        elif data_type == 'network':
            debug.network_data = value
            if debug.enabled:
                Network_STATE = value
        elif data_type == 'server':
            debug.server_data = value
            if debug.enabled:
                SERVER_STATE = value
        else:
            return jsonify({"status": "error", "message": "未知的数据类型"}), 400

        logger.send("DEBUG", f"调试数据已更新: {data_type}")
        return jsonify({"status": "success", "message": "数据已更新"})

    except Exception as e:
        logger.send("ERROR", f"设置调试数据失败: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500

@app.route('/debug/toggle', methods=['POST'])
@login_required
def debug_toggle():
    """切换调试模式"""
    try:
        data = request.get_json()
        enable = data.get('enable', False)
        debug.enabled = enable
        
        return jsonify({
            "status": "success", 
            "message": f"调试模式已{'启用' if enable else '禁用'}，需要重启服务生效",
            "requires_restart": True
        })
    except Exception as e:
        logger.send("ERROR", f"切换调试模式失败: {str(e)}")
        return jsonify({"status": "error", "message": str(e)}), 500
    try:
        logger.send("WARNING", "重启整个框架")
        logger.send("WARNING", "重启UI")
        subprocess.run(
            ["systemctl", "restart", "Dream_Machine_app.service"],
            check=True
        )
        logger.send("WARNING", "重启Server")
        subprocess.run(
            ["systemctl", "restart", "Dream_Machine_server.service"],
            check=True
        )
    except subprocess.CalledProcessError as e:
        logger.send("ERROR", f"重启失败: {str(e)}")
    # print("restarting system...")
    return "ok", 200


if __name__ == '__main__':
    init_cfg()              # 加载配置并初始化各子模块
    init_serial()           # 初始化串口连接
    Configuring_Peripherals()

    read_thread = [
        threading.Thread(target=mcu.read_loop,   daemon=True),
        threading.Thread(target=power.read_loop, daemon=True),
    ]
    for t in read_thread:
        t.start()

    with app.app_context():
        create_user()
    socketio.run(app, host='0.0.0.0', port=8081, allow_unsafe_werkzeug=True)