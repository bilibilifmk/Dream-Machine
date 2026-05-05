// 建立与服务器的 Socket.io 连接，强制使用 WebSocket，禁用 polling 降级
const socket = io("http://127.0.0.1:8081", {
    transports: ['websocket']
});

// 用于重试机制的全局变量，存放 run_loop 定时器的标识
let runLoopTimeout = null;
// 定义日志输出开关
var log_open = false;
// 定义忽略响应数据的截止时间（毫秒时间戳），在控制指令发送后 ignoreDelay 内收到的数据都不可信
let ignoreUntilTime = 0;

/**
 * 封装 socket.send 的通用函数
 * @param {string} data - 要发送的 JSON 格式命令字符串
 * @param {number} [ignoreDelay=3000] - 忽略响应的时长（默认 3000 毫秒，即 3 秒）
 */
function sendCommand(data, ignoreDelay = 0) {
    socket.send(data);
    // 仅当 ignoreDelay > 0 时才设置忽略窗口（控制指令用，RUN 命令传 0 跳过）
    if (ignoreDelay > 0) {
        ignoreUntilTime = Date.now() + ignoreDelay;
    }
}

socket.on('response', (data) => {
    // 判断当前时间是否在忽略截止时间内，如果是，则不处理这次返回的数据
    if (Date.now() < ignoreUntilTime) {
        console.log("收到数据，但在忽略时间内，丢弃数据");
        return;
    }

    // 收到可信数据后，清除旧的重试计时器，并在短暂延迟后重新请求新数据
    if (runLoopTimeout) {
        clearTimeout(runLoopTimeout);
        runLoopTimeout = null;
    }
    // 屏幕已关闭时不重调度 run_loop，降低 CPU 负载
    if (typeof _screenOff === 'undefined' || !_screenOff) {
        runLoopTimeout = setTimeout(() => {
            run_loop();
        }, 800);
    }
    
    const messageType = Object.keys(data)[0];
    const messageContent = data[messageType];
    
    if (log_open) {
        const logContainer = document.getElementById('log-container');
        // 创建日志区块
        const logEntry = document.createElement('div');
        logEntry.classList.add('message-item');
        
        const logText = document.createElement('p');
        logText.textContent = messageContent;
        
        const logTime = document.createElement('span');
        logTime.classList.add('message-time');
        logTime.textContent = new Date().toLocaleTimeString();
      
        logEntry.appendChild(logText);
        logEntry.appendChild(logTime);
      
        logContainer.appendChild(logEntry);
      
        // 自动滚动到底部
        logContainer.scrollTop = logContainer.scrollHeight;
    }
    
    if (typeof messageContent === 'string') {
        const splitIndex = messageContent.indexOf(':'); // 查找冒号位置
        if (splitIndex === -1) {
            return;
        }

        const key = messageContent.substring(0, splitIndex).trim();
        const value = messageContent.substring(splitIndex + 1).trim();

        switch (key) {
            case 'IO':
                IOMessage(value);
                break;
            case 'POWER':
                POWERMessage(value);
                break;
            case 'NETWORK':
                NETWORKMessage(value);
                break;
            case 'SERVER':
                SERVERMessage(value);
                break;
            case 'TIME':
                TIMEMessage(value);
                break;
            case 'LOCK':
                lock_dp();
                break;
            case 'DP_STATUS':
                handleDpStatus(value);
                break;
            default:
                console.log('Unknown Message:', value);
        }
    } else {
        console.error('messageContent is not a string:', messageContent);
    }
});

function IOMessage(message) {
    let jsonMessage = JSON.parse(message);
    updateFan(jsonMessage.FAN_status); // 更新风扇模块
    updateIO(jsonMessage.IO_status);
    update_env(
        jsonMessage.IO_status, 
        jsonMessage.Lighting_IO, 
        jsonMessage.Remaining_filter_element, 
        jsonMessage.Temperature, 
        jsonMessage.Humidity, 
        jsonMessage.UPS_STATE
    );
    update_power_info(jsonMessage);
}

function POWERMessage(message) {
    let jsonMessage = JSON.parse(message);
    update_power(jsonMessage);
}

function NETWORKMessage(message) {
    let jsonMessage = JSON.parse(message);
    update_network(jsonMessage);
}

function SERVERMessage(message) {
    let jsonMessage = JSON.parse(message);
    update_server_info(jsonMessage);
}

function TIMEMessage(message) {
    const totalHours = parseFloat(message);
    const days = Math.floor(totalHours / 24);
    const hours = Math.floor(totalHours % 24);
    const minutes = Math.round((totalHours % 1) * 60);
    
    const runtimeElement = document.getElementById('runtime');
    runtimeElement.textContent = `服务运行时间：${days}天 ${hours}小时 ${minutes}分钟`;
}

// 用于发送 IO 控制消息
function setIOState(ioid, mode) {
    try {
        const data = `{"ID":"SETIO","IO":"${ioid}","SET":"${mode}"}`;
        sendCommand(data, 2000);  // 控制指令忽略 2 秒
    } catch (error) {
        console.error('Error setting IO state:', error);
        alert('IO 状态更新失败，请检查网络或后端服务');
    }
}

// 用于发送风扇控制消息
function setFANState(fanid, mode) {
    try {
        const data = `{"ID":"SETFAN","FANID":"${fanid}","SET":"${mode}"}`;
        sendCommand(data, 2000);
    } catch (error) {
        console.error('Error setting FAN state:', error);
        alert('FAN 状态更新失败，请检查网络或后端服务');
    }
}

// socket 连接成功后自动开始通信
socket.on('connect', () => {
    console.log("Socket 已连接，自动开始通信...");
    _loop_running = true;
    const sw = document.getElementById('sw-loop');
    if (sw) sw.classList.add('on');
    run_loop();
});

// 修改后的 run_loop 函数，包含 5 秒未响应重试机制，同时发送命令后设置忽略时间
function run_loop() {
    if (runLoopTimeout) {
        clearTimeout(runLoopTimeout);
        runLoopTimeout = null;
    }
    
    console.log("发送 RUN 命令到服务器...");
    const data = '{"ID":"COMMAND","MSG":"RUN"}';
    sendCommand(data, 0); // RUN 命令不忽略响应

    // 如果在 3 秒内没有收到可信响应，则重试
    runLoopTimeout = setTimeout(() => {
        console.warn("3秒内没有接收到服务器响应，正在重试 run_loop...");
        run_loop();
    }, 3000);
}

function stop_loop() {
    if (runLoopTimeout) { clearTimeout(runLoopTimeout); runLoopTimeout = null; }
    const data = '{"ID":"COMMAND","MSG":"STOP"}';
    sendCommand(data, 1000);
}

function c_reboot() {
    const data = '{"ID":"COMMAND","MSG":"REBOOT"}';
    sendCommand(data, 2000);
}

function send_lockFunction() {
    const data = '{"ID":"COMMAND","MSG":"OFF_DP"}';
    sendCommand(data, 0); // 不忽略响应，确保 LOCK 消息能被接收
    lockFunction();       // 立即锁屏，无需等待服务器回包
}

function lock_dp() {
    lockFunction();
    console.warn("LOCK");
}


function opne_output_log() {
    log_open = true;
    const keai = document.querySelector('.debug-keai');
    if (keai) keai.style.opacity = '0';
    const sw = document.getElementById('sw-log');
    if (sw) sw.classList.add('on');
}

function close_output_log() {
    log_open = false;
    const keai = document.querySelector('.debug-keai');
    if (keai) keai.style.opacity = '1';
    const sw = document.getElementById('sw-log');
    if (sw) sw.classList.remove('on');
}

function toggle_log() {
    if (log_open) { close_output_log(); } else { opne_output_log(); }
}

var _loop_running = true;
function toggle_loop() {
    if (_loop_running) {
        stop_loop();
        _loop_running = false;
        const sw = document.getElementById('sw-loop');
        if (sw) sw.classList.remove('on');
    } else {
        run_loop();
        _loop_running = true;
        const sw = document.getElementById('sw-loop');
        if (sw) sw.classList.add('on');
    }
}

function clear_log() {
    const logContainer = document.getElementById('log-container');
    logContainer.innerHTML = '';
    const keai = document.querySelector('.debug-keai');
    if (keai) keai.style.opacity = '1';
}