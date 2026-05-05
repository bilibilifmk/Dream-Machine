async function exit() {
    await fetch('/logout');  
    await location.reload();
}

function settings() {
    window.location.href = '/cfg';
}

function debugMode() {
    window.location.href = '/debug';
}

(async function initDebugBtn() {
    try {
        const res  = await fetch('/debug/status');
        const data = await res.json();
        const btn  = document.getElementById('debug-mode-btn');
        if (btn && data.debug_mode) btn.style.display = '';
    } catch (e) { /* 静默忽略 */ }
})();
async function updateDashboard() {
try {
const response = await fetch('/web_get_io_all');
const data = await response.json();

// 更新电源状态（内建模式：从 io_all 取数据）
const insideEl   = document.getElementById('power-inside');
const externalEl = document.getElementById('power-external');
const modeTag    = document.getElementById('power-mode-tag');
if (data.OUT_Voltage) {
    // 外接模式标识出现在 io_all → 但完整数据改由 /web_get_power 提供
    if (insideEl)   insideEl.style.display   = 'none';
    if (externalEl) externalEl.style.display = 'block';
    if (modeTag)    modeTag.textContent = '外部电源';
    // 拉取外部电源全量数据
    try {
        const pResp = await fetch('/web_get_power');
        const pd    = await pResp.json();
        const fmt   = v => (v === undefined || v === null || v === -1) ? '--' : Number(v).toFixed(2);
        document.getElementById('in-voltage').textContent  = fmt(pd.IN_Voltage);
        document.getElementById('in-current').textContent  = fmt(pd.IN_Current);
        document.getElementById('in-power').textContent    = fmt(pd.IN_Power);
        document.getElementById('out-voltage').textContent = fmt(pd.OUT_Voltage);
        document.getElementById('out-current').textContent = fmt(pd.OUT_Current);
        document.getElementById('out-power').textContent   = fmt(pd.OUT_Power);
        document.getElementById('pext-temp0').textContent  = fmt(pd.Temp0);
        document.getElementById('pext-temp1').textContent  = fmt(pd.Temp1);
        document.getElementById('pext-fan').textContent    = (pd.Fan === undefined || pd.Fan === -1) ? '--' : Math.round(pd.Fan);
        _extPowerRaw = pd; // 存储全量数据供 gauge 动画使用
        updatePowerGauges(parseFloat(pd.OUT_Voltage)||0, parseFloat(pd.OUT_Current)||0, parseFloat(pd.OUT_Power)||0, 'external');
    } catch(e) { console.error('外部电源数据获取失败', e); }
} else {
    // 内建模式
    if (insideEl)   insideEl.style.display   = 'flex';
    if (externalEl) externalEl.style.display = 'none';
    if (modeTag)    modeTag.textContent = '内建电源';
    const voltage = data.voltage_buf && data.voltage_buf[0] ? data.voltage_buf[0] : 0; // 第一个电压值
    const current = data.Current ? data.Current / 1000 : 0; // 电流值从毫安转为安培

    // 计算功率 (W)
    const power = (voltage * current).toFixed(2); // 保留两位小数

    // 更新页面内容
    document.getElementById('Voltage').innerHTML = `${voltage.toFixed(2)} <span class="pil-unit">V</span>`;
    document.getElementById('Current').innerHTML = `${current.toFixed(2)} <span class="pil-unit">A</span>`;
    document.getElementById('Power').innerHTML   = `${power} <span class="pil-unit">W</span>`;
    updatePowerGauges(voltage, current, parseFloat(power), 'inside');
}
// 更新 IO 状态
const ioContainer = document.getElementById('io-status-container');
ioContainer.innerHTML = ''; // 清空内容

data.IO_status.forEach((io, index) => {
    const ioElement = document.createElement('div');
    ioElement.classList.add('io-item');

    // 创建名称元素
    const ioName = document.createElement('span');
    ioName.classList.add('io-name');
    ioName.textContent = io.name;

    // 创建开关元素
    const ioSwitch = document.createElement('label');
    ioSwitch.classList.add('switch');
    
    const inputElement = document.createElement('input');
    inputElement.type = 'checkbox';
    inputElement.checked = io.state; // 同步开关状态
    inputElement.disabled = io.locked; // 禁用逻辑

    // 绑定事件处理程序
    inputElement.addEventListener('change', () => {
        setIOState(index, inputElement.checked ? 1 : 0);
    });

    const slider = document.createElement('span');
    slider.classList.add('slider');

    ioSwitch.appendChild(inputElement);
    ioSwitch.appendChild(slider);

    // 将名称和开关添加到 io-item
    ioElement.appendChild(ioName);

    // 反转按钮（locked 时禁用）
    if (!io.locked) {
        const restartBtn = document.createElement('button');
        restartBtn.classList.add('io-restart-btn');
        restartBtn.title = '反转5秒后恢复';
        restartBtn.innerHTML = '&#x21BA;';
        restartBtn.addEventListener('click', () => restartIO(index, restartBtn));
        ioElement.appendChild(restartBtn);
    }

    ioElement.appendChild(ioSwitch);

    // 添加到 io-grid 容器
    ioContainer.appendChild(ioElement);
});

// 更新风扇状态
const fanContainer = document.getElementById('fan-rpm');
fanContainer.innerHTML = ''; // 清空内容
let fanHasError = false;
data.FAN_status.forEach(fan => {
    const fanElement = document.createElement('div');
    fanElement.classList.add('fan-item');
    const nameEl = document.createElement('span');
    nameEl.classList.add('fan-name');
    nameEl.textContent = fan.name;
    const rpmEl = document.createElement('span');
    rpmEl.classList.add('fan-rpm-val');
    const isNA = fan.rpm === -1 || fan.rpm === null || fan.rpm === undefined;
    const isZero = fan.rpm === 0;
    rpmEl.textContent = isNA ? 'N/A' : `${fan.rpm} RPM`;
    if (isNA || isZero) fanHasError = true;
    fanElement.appendChild(nameEl);
    fanElement.appendChild(rpmEl);
    fanContainer.appendChild(fanElement);
});
// 全部为0或含N/A时显示ERROR闪烁
const fanErrorEl = document.getElementById('fan-error');
if (fanErrorEl) fanErrorEl.classList.toggle('visible', fanHasError);

// 更新预览风扇转速（前面卡片上的大风扇动画）
_updateFanPreviewSpeed(data.FAN_status);

// 更新展开屏中各风扇动画
_updateFanExpandGrid(data.FAN_status);

// 更新环境状态
const lightingIndex = parseInt(data.Lighting_IO.replace("IO", ""), 10); // 提取 IO 的索引
const lightingState = data.IO_status[lightingIndex]?.state; // 获取灯光状态

document.getElementById('lighting-status').textContent = lightingState ? "ON" : "OFF";
document.getElementById('lighting-status').className = lightingState ? "text-green" : "text-red";
document.getElementById('filter-life').textContent = `${data.Remaining_filter_element}%`;

document.getElementById('temperature').textContent = `${data.Temperature}°C`;
document.getElementById('humidity').textContent = `${data.Humidity}%`;

const upsElement = document.getElementById('ups-status');
const upsState = data.UPS_STATE;
upsElement.textContent = upsState || "N/A"; // 显示 UPS 的具体状态参数
upsElement.className = upsState === "online" ? "text-green" : "text-red"; // 在线状态为绿色，其他状态为红色

// 环境状态错误提示（UPS 优先级高于滤芯）
const envErrorEl = document.getElementById('env-error');
if (envErrorEl) {
    const filterLife = parseFloat(data.Remaining_filter_element);
    const isUpsOffline  = upsState === 'offline';
    const isUpsBattery  = typeof upsState === 'string' && upsState.startsWith('电池供电');
    const isFilterDead  = filterLife === 0 || data.Remaining_filter_element === '0';

    if (isUpsOffline) {
        envErrorEl.textContent = 'UPS ERROR';
        envErrorEl.classList.add('visible');
    } else if (isUpsBattery) {
        envErrorEl.textContent = '市电故障';
        envErrorEl.classList.add('visible');
    } else if (isFilterDead) {
        envErrorEl.textContent = '空气滤芯耗尽快更换';
        envErrorEl.classList.add('visible');
    } else {
        envErrorEl.textContent = '';
        envErrorEl.classList.remove('visible');
    }
}
// 请求成功，隐藏断连遮罩
const overlay = document.getElementById('conn-error-overlay');
if (overlay) overlay.classList.remove('visible');
} catch (error) {
    console.error('Error updating dashboard:', error);
    const overlay = document.getElementById('conn-error-overlay');
    if (overlay) overlay.classList.add('visible');
}
}




async function setIOState(ioid, mode) {
    try {
        const response = await fetch(`/web_setio?ioid=${ioid}&mode=${mode}`);
        const result = await response.json();

        if (response.ok) {
            console.log('IO 状态更新成功:', result.message);
        } else {
            console.error('IO 状态更新失败:', result.error || '未知错误');
            alert('IO 状态更新失败，请检查网络或后端服务');
        }
    } catch (error) {
        console.error('Error setting IO state:', error);
        alert('IO 状态更新失败，请检查网络或后端服务');
    }
}

async function restartIO(ioid, btn) {
    try {
        btn.disabled = true;
        btn.classList.add('io-restart-countdown');
        const response = await fetch(`/web_restart_io?ioid=${ioid}`);
        const result = await response.json();
        if (!response.ok) {
            alert(result.error || 'IO反转失败');
            btn.disabled = false;
            btn.classList.remove('io-restart-countdown');
            return;
        }
        // 5秒倒计时
        let remaining = 5;
        btn.textContent = remaining;
        const timer = setInterval(() => {
            remaining--;
            if (remaining <= 0) {
                clearInterval(timer);
                btn.innerHTML = '&#x21BA;';
                btn.disabled = false;
                btn.classList.remove('io-restart-countdown');
            } else {
                btn.textContent = remaining;
            }
        }, 1000);
    } catch (error) {
        console.error('IO反转失败:', error);
        btn.disabled = false;
        btn.classList.remove('io-restart-countdown');
    }
}



function calculateIndicatorColor(loadPercentage) {
// 将负载百分比转换为数值
const load = parseFloat(loadPercentage.replace('%', ''));
// 计算绿色 (10b981) 到黄色 (facc15) 的渐变
// 分别计算 RGB 渐变值
const greenRGB = [16, 185, 129]; // #10b981
const yellowRGB = [250, 204, 21]; // #facc15

const factor = Math.min(Math.max((load - 40) / 40, 0), 1); // 计算权重（40%-80%之间）
const r = Math.round(greenRGB[0] + (yellowRGB[0] - greenRGB[0]) * factor);
const g = Math.round(greenRGB[1] + (yellowRGB[1] - greenRGB[1]) * factor);
const b = Math.round(greenRGB[2] + (yellowRGB[2] - greenRGB[2]) * factor);

return `rgb(${r}, ${g}, ${b})`; // 返回渐变后的 RGB 颜色
}

async function updateServerStatus() {
try {
const response = await fetch('/web_get_server');
const data = await response.json();

const serverContainer = document.getElementById('server-status-container');

data.forEach((server, index) => {
    let serverElement = document.querySelector(`#server-item-${index}`);
    
    // 如果不存在对应的服务器项，创建它
    if (!serverElement) {
        serverElement = document.createElement('div');
        serverElement.classList.add('server-item');
        serverElement.id = `server-item-${index}`;

        // 左侧名称
        const serverDetails = document.createElement('div');
        serverDetails.classList.add('server-details');
        const serverName = document.createElement('span');
        serverName.classList.add('server-name');
        serverName.textContent = server.NAME;
        serverDetails.appendChild(serverName);

        // 右侧负载和指示灯
        const serverRight = document.createElement('div');
        serverRight.classList.add('server-right');
        const serverLoad = document.createElement('span');
        serverLoad.classList.add('server-load');
        const statusIndicator = document.createElement('div');
        statusIndicator.classList.add('status-indicator');
        serverRight.appendChild(serverLoad);
        serverRight.appendChild(statusIndicator);

        serverElement.appendChild(serverDetails);
        serverElement.appendChild(serverRight);

        serverContainer.appendChild(serverElement);
    }

    // 更新内容
    const serverLoad = serverElement.querySelector('.server-load');
    const statusIndicator = serverElement.querySelector('.status-indicator');

    if (server.error) {
        // 错误状态
        serverLoad.textContent = server.error;
        serverLoad.classList.add('text-red');
        statusIndicator.className = 'status-indicator red'; // 设置红色
    } else {
        // 正常状态
        serverLoad.textContent = "";

        const loadValue = parseFloat(server.load_percentage.replace('%', ''));
        let indicatorClass = 'green'; // 默认绿色

        if (loadValue >= 70 && loadValue <= 95) {
            indicatorClass = 'yellow'; // 黄色
        } else if (loadValue > 95) {
            indicatorClass = 'red'; // 红色
        }

        // 如果指示灯颜色没变，不更新类名，避免刷新动画
        if (!statusIndicator.classList.contains(indicatorClass)) {
            statusIndicator.className = `status-indicator ${indicatorClass}`;
        }
    }
});
} catch (error) {
console.error('Error fetching server status:', error);
}
}


async function updateNetworkStatus() {
try {
const response = await fetch('/web_get_network');
const data = await response.json();

const networkContainer = document.getElementById('network-status-container');
networkContainer.innerHTML = ''; // 清空现有内容

// 网络状态键值映射
const networkStatus = {
    "Network_card_status": "网卡状态",
    "gateway": "网关状态",
    "WAN": "外网状态",
    "Reverse_proxy": "反向代理",
    "God_use_VPN": "科学网络"
};

// 动态生成状态列表
for (const [key, value] of Object.entries(networkStatus)) {
    const status = data[key]; // 获取 API 返回的状态
    const statusElement = document.createElement('div');
    statusElement.classList.add('flex-between');

    // 名称部分
    const nameElement = document.createElement('span');
    nameElement.textContent = value;

    // 状态部分
    const statusValue = document.createElement('span');
    statusValue.textContent = status;
    statusValue.className = status === "online" || status === "link" ? 'text-green' : 'text-red';

    // 合并到容器
    statusElement.appendChild(nameElement);
    statusElement.appendChild(statusValue);

    networkContainer.appendChild(statusElement);
}

// WAN / GFW 错误提示（WAN 优先级高于 GFW）
const netErrorEl = document.getElementById('net-error');
if (netErrorEl) {
    const wanOk  = data['WAN']         === 'online';
    const gfwOk  = data['God_use_VPN'] === 'online';
    if (!wanOk) {
        netErrorEl.textContent = 'WAN ERROR';
        netErrorEl.classList.add('visible');
    } else if (!gfwOk) {
        netErrorEl.textContent = 'GFW ERROR';
        netErrorEl.classList.add('visible');
    } else {
        netErrorEl.textContent = '';
        netErrorEl.classList.remove('visible');
    }
}
} catch (error) {
console.error('Error fetching network status:', error);
}
}

// 定期刷新服务器状态
setInterval(updateDashboard, 10000);

// ── 电源卡片翻转 + 弧形仪表 ─────────────────────────────────────────────────
const GAUGE_CIRC = 238.76; // 2π × r38
let _powerGaugeData  = null;
let _extPowerRaw     = null;  // 外置电源原始数据
let _powerExpanded   = false;
let _powerExpanding  = false;

function setGaugeArc(arcId, fraction) {
    const el = document.getElementById(arcId);
    if (!el) return;
    const circ = parseFloat(el.dataset.circ) || GAUGE_CIRC;
    el.style.strokeDashoffset = circ * (1 - Math.max(0, Math.min(1, fraction)));
}

function animateCounterEl(el, to, decimals) {
    if (!el) return;
    const from = parseFloat(el.textContent) || 0;
    const duration = 650;
    const t0 = performance.now();
    function tick(now) {
        const p = Math.min((now - t0) / duration, 1);
        const ease = 1 - Math.pow(1 - p, 3);
        el.textContent = (from + (to - from) * ease).toFixed(decimals);
        if (p < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
}

function _applyPowerGaugeData() {
    if (!_powerGaugeData) return;
    const { voltage, current, power, mode } = _powerGaugeData;
    const insideBack = document.getElementById('power-back-inside');
    const extBack    = document.getElementById('power-back-external');
    const backTag    = document.getElementById('power-mode-tag-back');

    if (mode === 'inside') {
        if (insideBack) insideBack.style.display = '';
        if (extBack)    extBack.style.display    = 'none';
        if (backTag)    backTag.textContent = '内建电源';
        setGaugeArc('gauge-voltage-arc', voltage / 15);
        setGaugeArc('gauge-current-arc', current / 30);
        setGaugeArc('gauge-power-arc',   power   / 500);
        animateCounterEl(document.getElementById('gauge-voltage-val'), voltage, 2);
        animateCounterEl(document.getElementById('gauge-current-val'), current, 2);
        animateCounterEl(document.getElementById('gauge-power-val'),   power,   1);
    } else {
        if (insideBack) insideBack.style.display = 'none';
        if (extBack)    extBack.style.display    = '';
        if (backTag)    backTag.textContent = '外部电源';
        // 输出电源 gauge
        setGaugeArc('gauge-ext-v-arc', voltage / 30);
        setGaugeArc('gauge-ext-a-arc', current / 30);
        setGaugeArc('gauge-ext-w-arc', power   / 1000);
        animateCounterEl(document.getElementById('gauge-ext-v-val'), voltage, 2);
        animateCounterEl(document.getElementById('gauge-ext-a-val'), current, 2);
        animateCounterEl(document.getElementById('gauge-ext-w-val'), power,   1);
        // 入电源 + 温度风扇 gauge
        if (_extPowerRaw) {
            const pd  = _extPowerRaw;
            const fv  = v => (v === undefined || v === null || v === -1) ? 0 : parseFloat(v) || 0;
            setGaugeArc('gauge-in-v-arc',   fv(pd.IN_Voltage)  / 30);
            setGaugeArc('gauge-in-a-arc',   fv(pd.IN_Current)  / 30);
            setGaugeArc('gauge-in-w-arc',   fv(pd.IN_Power)    / 1000);
            setGaugeArc('gauge-temp0-arc',  fv(pd.Temp0)       / 100);
            setGaugeArc('gauge-temp1-arc',  fv(pd.Temp1)       / 100);
            setGaugeArc('gauge-fan-arc',    fv(pd.Fan)         / 10000);
            animateCounterEl(document.getElementById('gauge-in-v-val'),   fv(pd.IN_Voltage), 2);
            animateCounterEl(document.getElementById('gauge-in-a-val'),   fv(pd.IN_Current), 2);
            animateCounterEl(document.getElementById('gauge-in-w-val'),   fv(pd.IN_Power),   1);
            animateCounterEl(document.getElementById('gauge-temp0-val'),  fv(pd.Temp0),      1);
            animateCounterEl(document.getElementById('gauge-temp1-val'),  fv(pd.Temp1),      1);
            animateCounterEl(document.getElementById('gauge-fan-val'),    fv(pd.Fan),        0);
        }
    }
}

function _resetPowerGaugeArcs() {
    ['gauge-voltage-arc','gauge-current-arc','gauge-power-arc',
     'gauge-ext-v-arc','gauge-ext-a-arc','gauge-ext-w-arc',
     'gauge-in-v-arc','gauge-in-a-arc','gauge-in-w-arc',
     'gauge-temp0-arc','gauge-temp1-arc','gauge-fan-arc'].forEach(id => {
        const el = document.getElementById(id);
        if (!el) return;
        const circ = parseFloat(el.dataset.circ) || GAUGE_CIRC;
        el.style.transition = 'none';
        el.style.strokeDashoffset = circ;
        requestAnimationFrame(() => { el.style.transition = ''; });
    });
    ['gauge-voltage-val','gauge-current-val','gauge-power-val',
     'gauge-ext-v-val','gauge-ext-a-val','gauge-ext-w-val',
     'gauge-in-v-val','gauge-in-a-val','gauge-in-w-val',
     'gauge-temp0-val','gauge-temp1-val','gauge-fan-val'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.textContent = '0';
    });
}

function updatePowerGauges(voltage, current, power, mode) {
    _powerGaugeData = { voltage, current, power, mode };
    if (_powerExpanded) {
        _applyPowerGaugeData();
    }
}

// ── 全屏展开状态 ──────────────────────────────────────────────────────────

// ── 风扇展开屏 ────────────────────────────────────────────────────────────
let _fanExpanded  = false;
let _fanExpanding = false;
let _fanStatusCache = [];   // 最新一次 FAN_status 数据

/** RPM → CSS animation-duration (s)。rpm≤0 时返回 null 表示暂停 */
function _rpmToDuration(rpm) {
    if (!rpm || rpm <= 0) return null;
    // 200 RPM → 3s；500 RPM → 1.2s；1000 RPM → 0.6s；上限 0.4s（≈1500 RPM 封顶）
    return Math.max(0.4, 600 / rpm).toFixed(2) + 's';
}

/** 更新卡片正面的预览大风扇转速 */
function _updateFanPreviewSpeed(fans) {
    const spinEl = document.getElementById('fan-preview-spin');
    if (!spinEl) return;
    // 主页预览使用固定转速动画，不跟随实际 RPM
    spinEl.style.animationDuration  = '1.2s';
    spinEl.style.animationPlayState = 'running';
}

/** 初始化或更新展开网格中的4个风扇动画（含单独调速控件） */
function _updateFanExpandGrid(fans) {
    _fanStatusCache = fans || [];
    const grid = document.getElementById('fan-expand-grid');
    if (!grid) return;

    fans.forEach((fan, i) => {
        const isNA = fan.rpm === -1 || fan.rpm === null || fan.rpm === undefined;
        let item = grid.querySelector(`[data-fan-index="${i}"]`);
        if (!item) {
            // 首次建立 DOM
            item = document.createElement('div');
            item.className = 'fan-expand-item';
            item.dataset.fanIndex = i;

            // 动画区域
            const animWrap = document.createElement('div');
            animWrap.className = 'fan-expand-anim';

            const spinEl = document.createElement('div');
            spinEl.className = 'fan-expand-spin';
            spinEl.id = `fan-exp-spin-${i}`;
            for (let b = 0; b < 3; b++) {
                const blade = document.createElement('div');
                blade.className = 'fan-expand-blade';
                spinEl.appendChild(blade);
            }
            const hub = document.createElement('div');
            hub.className = 'fan-expand-hub';

            // ERROR 浮层
            const errOverlay = document.createElement('div');
            errOverlay.className = 'fan-exp-err-overlay';
            errOverlay.id = `fan-exp-err-${i}`;
            errOverlay.textContent = 'ERROR';

            animWrap.appendChild(spinEl);
            animWrap.appendChild(hub);
            animWrap.appendChild(errOverlay);

            // 顶部居中包裹层
            const topWrap = document.createElement('div');
            topWrap.className = 'fan-exp-top';

            // 名称 + RPM
            const nameEl = document.createElement('div');
            nameEl.className = 'fan-expand-name';
            nameEl.id = `fan-exp-name-${i}`;

            const rpmEl = document.createElement('div');
            rpmEl.className = 'fan-expand-rpm';
            rpmEl.id = `fan-exp-rpm-${i}`;

            topWrap.appendChild(animWrap);
            topWrap.appendChild(nameEl);
            topWrap.appendChild(rpmEl);

            // 单独调速控件
            const ctrl = document.createElement('div');
            ctrl.className = 'fan-exp-ctrl';

            const sliderRow = document.createElement('div');
            sliderRow.className = 'fan-exp-slider-row';
            const slider = document.createElement('input');
            slider.type = 'range'; slider.min = '0'; slider.max = '255';
            const initPwm = fan.set_speed ?? 128;
            slider.value = initPwm;
            slider.id = `fan-exp-slider-${i}`;
            const valSpan = document.createElement('span');
            valSpan.className = 'fan-exp-slider-val';
            valSpan.id = `fan-exp-val-${i}`;
            valSpan.textContent = initPwm;
            slider.addEventListener('input', () => { valSpan.textContent = slider.value; });
            slider.addEventListener('change', () => sendSingleFanSpeed(i));
            sliderRow.appendChild(slider);
            sliderRow.appendChild(valSpan);

            ctrl.appendChild(sliderRow);

            item.appendChild(topWrap);
            item.appendChild(ctrl);
            grid.appendChild(item);
        }

        // 更新名称、RPM、ERROR 浮层
        const nameEl    = document.getElementById(`fan-exp-name-${i}`);
        const rpmEl     = document.getElementById(`fan-exp-rpm-${i}`);
        const spinEl    = document.getElementById(`fan-exp-spin-${i}`);
        const errOverlay= document.getElementById(`fan-exp-err-${i}`);

        if (nameEl) nameEl.textContent = fan.name;
        if (rpmEl)  rpmEl.textContent  = isNA ? 'N/A' : `${fan.rpm} RPM`;
        if (errOverlay) errOverlay.classList.toggle('visible', isNA || fan.rpm === 0);

        // 同步滑条：未聚焦时跟随实际 set_speed
        const sliderEl = document.getElementById(`fan-exp-slider-${i}`);
        const valEl    = document.getElementById(`fan-exp-val-${i}`);
        if (sliderEl && document.activeElement !== sliderEl && fan.set_speed != null) {
            sliderEl.value = fan.set_speed;
            if (valEl) valEl.textContent = fan.set_speed;
        }

        // 旋转速度
        if (spinEl) {
            const dur = _rpmToDuration(isNA ? 0 : fan.rpm);
            if (dur) {
                spinEl.style.animationDuration  = dur;
                spinEl.style.animationPlayState = 'running';
            } else {
                spinEl.style.animationPlayState = 'paused';
            }
        }
    });
}

function flipFanCard(card) {
    if (_fanExpanding) return;
    if (!_fanExpanded) {
        _openFanExpand(card);
    } else {
        closeFanExpand();
    }
}

function _openFanExpand(card) {
    const overlay  = document.getElementById('fan-expand-screen');
    const backdrop = document.getElementById('fan-expand-backdrop');
    if (!overlay || !backdrop) return;

    _fanExpanding = true;
    _fanExpanded  = true;

    const INSET  = 8;
    const EASING = 'cubic-bezier(0.4,0,0.2,1)';
    const panel     = document.querySelector('.panel');
    const panelRect = panel.getBoundingClientRect();
    const cardRect  = card.getBoundingClientRect();

    const startLeft   = cardRect.left   - panelRect.left;
    const startTop    = cardRect.top    - panelRect.top;
    const startWidth  = cardRect.width;
    const startHeight = cardRect.height;

    const targetLeft   = INSET;
    const targetTop    = INSET;
    const targetWidth  = panel.offsetWidth  - INSET * 2;
    const targetHeight = panel.offsetHeight - INSET * 2;

    Object.assign(overlay.style, {
        left: startLeft + 'px', top: startTop + 'px',
        width: startWidth + 'px', height: startHeight + 'px',
        transform: 'perspective(1400px) rotateY(-90deg)',
        transition: 'none', opacity: '1',
    });
    overlay.offsetHeight; // force reflow

    const T = '0.52s';
    overlay.style.transition =
        `left ${T} ${EASING}, top ${T} ${EASING}, width ${T} ${EASING}, height ${T} ${EASING}, transform ${T} ${EASING}, border-radius ${T} ${EASING}`;
    Object.assign(overlay.style, {
        left: targetLeft + 'px', top: targetTop + 'px',
        width: targetWidth + 'px', height: targetHeight + 'px',
        transform: 'perspective(1400px) rotateY(0deg)',
        borderRadius: '16px',
    });

    overlay.classList.add('open');
    backdrop.classList.add('open');

    setTimeout(() => { _fanExpanding = false; }, 560);
}

function closeFanExpand() {
    if (!_fanExpanded || _fanExpanding) return;
    const overlay  = document.getElementById('fan-expand-screen');
    const backdrop = document.getElementById('fan-expand-backdrop');
    const card     = document.getElementById('fan-card');
    if (!overlay || !backdrop || !card) return;

    _fanExpanding = true;
    _fanExpanded  = false;

    const panel     = document.querySelector('.panel');
    const panelRect = panel.getBoundingClientRect();
    const cardRect  = card.getBoundingClientRect();
    const closeLeft = cardRect.left - panelRect.left;
    const closeTop  = cardRect.top  - panelRect.top;
    const EASING    = 'cubic-bezier(0.4,0,0.2,1)';
    const T         = '0.42s';
    overlay.style.transition =
        `left ${T} ${EASING}, top ${T} ${EASING}, width ${T} ${EASING}, height ${T} ${EASING}, transform 0.35s ${EASING}, opacity 0.3s ease, border-radius ${T} ${EASING}`;
    Object.assign(overlay.style, {
        left: closeLeft + 'px', top: closeTop + 'px',
        width: cardRect.width + 'px', height: cardRect.height + 'px',
        transform: 'perspective(1400px) rotateY(-90deg)',
        opacity: '0', borderRadius: '16px',
    });
    backdrop.classList.remove('open');
    setTimeout(() => {
        overlay.classList.remove('open');
        overlay.removeAttribute('style');
        _fanExpanding = false;
    }, 450);
}

/** 单台风扇调速（滑条松开自动触发） */
async function sendSingleFanSpeed(i) {
    const slider = document.getElementById(`fan-exp-slider-${i}`);
    try {
        const pwm = Math.max(0, Math.min(255, parseInt(slider?.value || '128', 10)));
        await fetch(`/web_setfan?fanid=${i}&pwm=${pwm}`, { method: 'GET' });
    } catch (e) {
        console.error('风扇调速失败', e);
    }
}

// 点击展开屏外侧关闭
document.addEventListener('click', function(e) {
    if (!_fanExpanded) return;
    const screen = document.getElementById('fan-expand-screen');
    const card   = document.getElementById('fan-card');
    if (screen && !screen.contains(e.target) && card && !card.contains(e.target)) {
        closeFanExpand();
    }
}, true);


function flipCard(card) {
    if (_powerExpanding) return;
    if (!_powerExpanded) {
        _openPowerExpand(card);
    } else {
        closePowerExpand();
    }
}

function _openPowerExpand(card) {
    const overlay  = document.getElementById('power-expand-screen');
    const backdrop = document.getElementById('power-expand-backdrop');
    if (!overlay || !backdrop) return;

    _powerExpanding = true;
    _powerExpanded  = true;

    const INSET  = 8;
    const EASING = 'cubic-bezier(0.4,0,0.2,1)';

    // overlay 是 .panel 的 absolute 子元素，坐标相对于 panel
    const panel     = document.querySelector('.panel');
    const panelRect = panel.getBoundingClientRect();
    const cardRect  = card.getBoundingClientRect();

    // 卡片相对于 panel 的起始坐标
    const startLeft   = cardRect.left   - panelRect.left;
    const startTop    = cardRect.top    - panelRect.top;
    const startWidth  = cardRect.width;
    const startHeight = cardRect.height;

    // 目标：充满 panel，留 INSET 边距
    const targetLeft   = INSET;
    const targetTop    = INSET;
    const targetWidth  = panel.offsetWidth  - INSET * 2;
    const targetHeight = panel.offsetHeight - INSET * 2;

    // 先定位到卡片位置，rotateY(-90deg) 从侧面飞出
    Object.assign(overlay.style, {
        left:       startLeft   + 'px',
        top:        startTop    + 'px',
        width:      startWidth  + 'px',
        height:     startHeight + 'px',
        transform:  'perspective(1400px) rotateY(-90deg)',
        transition: 'none',
        opacity:    '1',
    });
    overlay.offsetHeight; // force reflow

    const T = '0.52s';
    overlay.style.transition =
        `left ${T} ${EASING}, top ${T} ${EASING}, width ${T} ${EASING}, height ${T} ${EASING}, transform ${T} ${EASING}, border-radius ${T} ${EASING}`;
    Object.assign(overlay.style, {
        left:         targetLeft   + 'px',
        top:          targetTop    + 'px',
        width:        targetWidth  + 'px',
        height:       targetHeight + 'px',
        transform:    'perspective(1400px) rotateY(0deg)',
        borderRadius: '16px',
    });

    overlay.classList.add('open');
    backdrop.classList.add('open');

    _resetPowerGaugeArcs();
    setTimeout(() => {
        _applyPowerGaugeData();
        _powerExpanding = false;
    }, 300);
}

function closePowerExpand() {
    if (!_powerExpanded || _powerExpanding) return;
    const overlay  = document.getElementById('power-expand-screen');
    const backdrop = document.getElementById('power-expand-backdrop');
    const card     = document.getElementById('power-card');
    if (!overlay || !backdrop || !card) return;

    _powerExpanding = true;
    _powerExpanded  = false;

    const panel     = document.querySelector('.panel');
    const panelRect = panel.getBoundingClientRect();
    const cardRect  = card.getBoundingClientRect();
    const closeLeft   = cardRect.left   - panelRect.left;
    const closeTop    = cardRect.top    - panelRect.top;
    const EASING  = 'cubic-bezier(0.4,0,0.2,1)';
    const T       = '0.42s';
    overlay.style.transition =
        `left ${T} ${EASING}, top ${T} ${EASING}, width ${T} ${EASING}, height ${T} ${EASING}, transform 0.35s ${EASING}, opacity 0.3s ease, border-radius ${T} ${EASING}`;
    Object.assign(overlay.style, {
        left:         closeLeft       + 'px',
        top:          closeTop        + 'px',
        width:        cardRect.width  + 'px',
        height:       cardRect.height + 'px',
        transform:    'perspective(1400px) rotateY(-90deg)',
        opacity:      '0',
        borderRadius: '16px',
    });
    backdrop.classList.remove('open');

    setTimeout(() => {
        overlay.classList.remove('open');
        overlay.removeAttribute('style');
        _powerExpanding = false;
    }, 450);
}

// 点击面板外部区域也可关闭
document.addEventListener('click', function(e) {
    if (!_powerExpanded) return;
    const screen = document.getElementById('power-expand-screen');
    const card   = document.getElementById('power-card');
    if (screen && !screen.contains(e.target) && card && !card.contains(e.target)) {
        closePowerExpand();
    }
}, true);

updateDashboard(); // 页面加载时立即刷新

setInterval(updateServerStatus, 10000); 
updateServerStatus(); // 页面加载时立即刷新

setInterval(updateNetworkStatus, 10000); 
updateNetworkStatus(); // 页面加载时立即刷新

// ── 物理倾斜：鼠标位置驱动卡片 3D 旋转 ──────────────────────────────
(function initCardTilt() {
    const MAX_TILT = 5;    // 最大倾斜角度（度）
    const LIFT     = 4;    // 悬浮上移 px

    function applyTilt(card, e) {
        if (_powerExpanded && card.id === 'power-card') return; // 已展开时跳过倾斜
        const rect   = card.getBoundingClientRect();
        // 归一化鼠标位置：中心为 0，角落为 ±1
        const nx = ((e.clientX - rect.left)  / rect.width  - 0.5) * 2;
        const ny = ((e.clientY - rect.top)   / rect.height - 0.5) * 2;
        // nx>0 鼠标偏右 → 向右倾（rotateY 正），ny>0 鼠标偏下 → 向上翻（rotateX 负）
        const ry =  nx * MAX_TILT;
        const rx = -ny * MAX_TILT;
        card.style.transition = 'box-shadow 0.18s ease, transform 0.05s ease';
        card.style.transform  =
            `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(${LIFT}px)`;
    }

    function resetTilt(card) {
        card.style.transition = 'box-shadow 0.18s ease, transform 0.45s cubic-bezier(0.23,1,0.32,1)';
        card.style.transform  = 'perspective(900px) rotateX(0deg) rotateY(0deg) translateZ(0)';
    }

    // 对当前和未来动态插入的卡片都生效（事件委托到 .grid）
    document.querySelectorAll('.grid').forEach(grid => {
        grid.addEventListener('mousemove', e => {
            const card = e.target.closest('.card');
            if (card) applyTilt(card, e);
        });
        // 鼠标离开某张卡片时立即复位（委托到 grid，捕获阶段处理 mouseleave 冒泡问题）
        grid.addEventListener('mouseover', e => {
            const card = e.target.closest('.card');
            if (!card) return;
            // 从外部进入卡片：relatedTarget 不在该卡片内
            if (!card.contains(e.relatedTarget)) {
                // 进入时不需要做任何事，mousemove 会驱动
            }
        });
        grid.addEventListener('mouseout', e => {
            const card = e.target.closest('.card');
            if (!card) return;
            // relatedTarget 不在同一张卡片内，说明真正离开了该卡片
            if (!card.contains(e.relatedTarget)) {
                resetTilt(card);
            }
        });
        grid.addEventListener('mouseleave', () => {
            grid.querySelectorAll('.card').forEach(resetTilt);
        });
    });
}());

// ── 关于页翻转 ─────────────────────────────────────────────────────────────
let _aboutOpen = false;

function toggleAbout() {
    const scene       = document.querySelector('.scene');
    const aboutScreen = scene.querySelector('.about-screen');

    if (!_aboutOpen) {
        // ── 打开 ─────────────────────────────────────────────────────────
        _aboutOpen = true;
        scene.classList.add('about-active');
    } else {
        // ── 关闭 ─────────────────────────────────────────────────────────
        // 先加 about-closing 保持 keai/title 隐藏，同时移除 about-active
        // 让 about-screen 和 panel 开始反向动画
        scene.classList.add('about-closing');
        scene.classList.remove('about-active');

        // 等 panel 的 transform transition 结束（面板完全回来），再让 keai/title 出现
        const panel = scene.querySelector('.panel');
        const onDone = (e) => {
            if (e.target !== panel || e.propertyName !== 'transform') return;
            panel.removeEventListener('transitionend', onDone);
            scene.classList.remove('about-closing');
            _aboutOpen = false;
        };
        panel.addEventListener('transitionend', onDone);
    }
}