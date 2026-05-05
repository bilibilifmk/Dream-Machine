const menuToggle = document.querySelector('.logo'),
sidebar = document.querySelector('.sidebar'),
Menulist = document.querySelectorAll('.menu-list li')
menuToggle.onclick = function(){
menuToggle.classList.toggle('active')
sidebar.classList.toggle('active')
}

function activeLink() {
Menulist.forEach((item) => 
item.classList.remove('active')
)
this.classList.add('active')
}

Menulist.forEach((item) =>
item.addEventListener('click', activeLink)
)

//标签切换
document.addEventListener("DOMContentLoaded", () => {
    const menuItems = document.querySelectorAll(".menu-list li");
    
    menuItems.forEach((item) => {
      item.addEventListener("click", () => {
        // 获取被点击菜单的文本内容
        const text = item.querySelector(".text").textContent.trim();
        
        // 隐藏所有内容
        document.getElementById("info").classList.remove("display_block");
        document.getElementById("info").classList.add("display_none");
  
        document.getElementById("server").classList.remove("display_block");
        document.getElementById("server").classList.add("display_none");
  
        document.getElementById("setting").classList.remove("display_block");
        document.getElementById("setting").classList.add("display_none");
  
        // 根据菜单项显示对应的内容
        if (text === "信息") {
          document.getElementById("info").classList.remove("display_none");
          document.getElementById("info").classList.add("display_block");
        } else if (text === "服务") {
          document.getElementById("server").classList.remove("display_none");
          document.getElementById("server").classList.add("display_block");
        } else if (text === "设置") {
          document.getElementById("setting").classList.remove("display_none");
          document.getElementById("setting").classList.add("display_block");
        }
      });
    });
  });

  //信息页面 触发效果 
  document.addEventListener("DOMContentLoaded", () => {
    const gridItems = document.querySelectorAll(".info_grid-item");
  
    gridItems.forEach((item) => {
      // 处理鼠标事件
      item.addEventListener("mousedown", () => {
        item.classList.add("info_grid-item_down");
        item.classList.remove("info_grid-item");
      });
  
      item.addEventListener("mouseup", () => {
        item.classList.add("info_grid-item");
        item.classList.remove("info_grid-item_down");
      });
  
      item.addEventListener("mouseleave", () => {
        // 鼠标移出时恢复原样
        item.classList.add("info_grid-item");
        item.classList.remove("info_grid-item_down");
      });
  
      // 处理触摸事件
      item.addEventListener("touchstart", () => {
        item.classList.add("info_grid-item_down");
        item.classList.remove("info_grid-item");
      });
  
      item.addEventListener("touchend", () => {
        item.classList.add("info_grid-item");
        item.classList.remove("info_grid-item_down");
      });
  
      item.addEventListener("touchcancel", () => {
        // 触摸取消时恢复原样
        item.classList.add("info_grid-item");
        item.classList.remove("info_grid-item_down");
      });
    });
  });
//   document.addEventListener("DOMContentLoaded", () => {
//     const gridItems = document.querySelectorAll(".info_grid-item");
  
//     gridItems.forEach((item) => {
//       item.addEventListener("mousedown", () => {
//         item.classList.add("info_grid-item_down");
//         item.classList.remove("info_grid-item");
//       });
  
//       item.addEventListener("mouseup", () => {
//         item.classList.add("info_grid-item");
//         item.classList.remove("info_grid-item_down");
//       });
  
//       item.addEventListener("mouseleave", () => {
//         // 鼠标移出时恢复原样
//         item.classList.add("info_grid-item");
//         item.classList.remove("info_grid-item_down");
//       });
//     });
//   });


//风扇更新部分
function updateFan(fan) {
  // 更新现有风扇转速显示
  document.getElementById('fan_speed0').innerHTML = fan[0].rpm === -1 ? "N/A" : fan[0].rpm;
  document.getElementById('fan_speed1').innerHTML = fan[1].rpm === -1 ? "N/A" : fan[1].rpm;
  document.getElementById('fan_speed2').innerHTML = fan[2].rpm === -1 ? "N/A" : fan[2].rpm;
  document.getElementById('fan_speed3').innerHTML = fan[3].rpm === -1 ? "N/A" : fan[3].rpm;

  const fanContainer = document.querySelector('.fan-grid-container_info');
  fanContainer.innerHTML = ''; // 清空现有内容

  fan.forEach((fanItem, index) => {
    // 创建风扇项容器
    const fanElement = document.createElement('div');
    fanElement.classList.add('fan-item');

    // 创建风扇名称元素
    const fanName = document.createElement('span');
    fanName.classList.add('fan-name');
    fanName.textContent = fanItem.name;

    // 创建风扇转速元素
    const fanRpm = document.createElement('span');
    fanRpm.classList.add('fan-rpm');
    fanRpm.textContent = fanItem.rpm === -1 ? "N/A" : `${fanItem.rpm} RPM`;

    // 创建滑动条
    const slider = document.createElement('input');
    slider.type = 'range';
    slider.min = '0';
    slider.max = '255';
    slider.value = fanItem.set_speed;
    slider.classList.add('fan-slider');

    // 创建滑动条值显示
    const sliderValue = document.createElement('span');
    sliderValue.classList.add('slider-value');
    sliderValue.textContent = fanItem.set_speed;

    // 滑动条事件监听，更新值
    slider.addEventListener('input', () => {
      sliderValue.textContent = slider.value; // 更新显示的值
      fanItem.set_speed = parseInt(slider.value); // 更新风扇速度
    });

    // 监听滑动条松手事件（发送数据）
    slider.addEventListener('change', () => {
      setFANState(`${index}`, fanItem.set_speed); // 发送风扇 ID 和速度
    });

    // 将元素加入风扇项容器
    fanElement.appendChild(fanName);
    fanElement.appendChild(fanRpm);
    fanElement.appendChild(slider);
    fanElement.appendChild(sliderValue);

    // 将风扇项容器加入主容器
    fanContainer.appendChild(fanElement);
  });
}

//io更新
function updateIO(io) {
  io.forEach((item, index) => {
    // 获取状态
    const state = item.state ? "ON" : "OFF";

    // 更新通道状态
    const nameElement = document.getElementById(`io_status${index}`);
    if (nameElement) {
        const statusElement = nameElement.nextElementSibling;
        if (statusElement) {
            statusElement.innerHTML = state; // 更新状态
            statusElement.style.color = state === "ON" ? "aliceblue" : "#747474"; // 设置颜色
        }
    }
});
  const ioContainer = document.getElementById('io-status-container');
  ioContainer.innerHTML = ''; // 清空内容
  io.forEach((io, index) => {
    const ioElement = document.createElement('div');
    ioElement.classList.add('io-item');

    // 创建名称元素
    const ioName = document.createElement('span');
    ioName.classList.add('io-name');
    ioName.textContent = io.name;

    // 创建开关元素
    const ioSwitch = document.createElement('label');
    ioSwitch.classList.add('switch_info');
    
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
    ioElement.appendChild(ioSwitch);

    // 添加到 io-grid 容器
    ioContainer.appendChild(ioElement);
});

}
//环境更新
function update_env(io, light_status, Remaining_filter_element, Temperature, Humidity, UPS_STATE){

  const light_status_io = parseInt(light_status.slice(-1), 10);
  const ioItem = io[light_status_io];
  light_IO = light_status_io;
  // 更新状态为 ON 或 OFF
  const status = ioItem.state ? "ON" : "OFF";
  const color = ioItem.state ? "#b0eec1" : "#747474";
  document.getElementById('env_light_status').innerHTML = status;
  document.getElementById('env_light_status').style.color = color;

  document.getElementById('env_Remaining_filter_element').innerHTML = Remaining_filter_element + "%";
  document.getElementById('env_Remaining_filter_element_info').innerHTML = Remaining_filter_element + "%";
  if (Remaining_filter_element > 20) {
      document.getElementById('env_light_status').style.colo = "#b0eec1";
      } else {
        document.getElementById('env_light_status').style.colo = "#f07365";
  }

   document.getElementById('env_Temperature').innerHTML = Temperature + "°C";
   document.getElementById('env_Humidity').innerHTML = Humidity + "%";
   document.getElementById('env_Temperature_info').innerHTML = Temperature + "°C";
   document.getElementById('env_Humidity_info').innerHTML = Humidity + "%";

   if( UPS_STATE != null){
    document.getElementById('env_UPS_STATE').innerHTML = UPS_STATE;
    document.getElementById('env_UPS_STATE_info').innerHTML = UPS_STATE;
   }
   else{
    document.getElementById('env_UPS_STATE').innerHTML = "N/A";
    document.getElementById('env_UPS_STATE_info').innerHTML = "N/A";
   }
   const lightSwitch = document.getElementById('env_light_status_switch');
    if (lightSwitch) {
      lightSwitch.checked = ioItem.state; // 设置开关状态
    }

  // 环境故障 badge（优先级：UPS > 空气滤芯）
  var envBadge = document.getElementById('fault-badge-env');
  if (envBadge) {
    var envMsg = '';
    if (UPS_STATE != null && UPS_STATE !== 'online') {
      envMsg = 'UPS ERROR';
    } else if (parseInt(Remaining_filter_element) <= 20) {
      envMsg = '空气滤芯耗尽 请更换';
    }
    if (envMsg) {
      envBadge.textContent = envMsg;
      envBadge.classList.add('visible');
    } else {
      envBadge.classList.remove('visible');
    }
  }

}

function update_network(network) {
  // console.log('SERVERMessage:', network);
  const keyToIdMap = {
    "card_status":   ["Network_card_status",   "Network_card_status_info"],
    "gateway":       ["Network_gateway",        "Network_gateway_info"],
    "WAN":           ["Network_WAN",            "Network_WAN_info"],
    "Reverse_proxy": ["Network_Reverse_proxy",  "Network_Reverse_proxy_info"],
    "God_use_VPN":   ["Network_God_use_VPN",    "Network_God_use_VPN_info"]
};

// 定义状态对应的颜色
const statusColors = {
    "link": "aliceblue",
    "break": "#747474",
    "online": "aliceblue",
    "offline": "#747474"
};

// 遍历 network 数据对象
for (const key in network) {
    const ids = keyToIdMap[key];
    if (!ids) continue;
    const status = network[key];
    const color = statusColors[status] || "#747474";
    ids.forEach(function(id) {
        const element = document.getElementById(id);
        if (element) {
            element.innerHTML = status;
            element.style.color = color;
        }
    });
}

  // 网络故障 badge（优先级：LAN > WAN > GFW）
  var netBadge = document.getElementById('fault-badge-net');
  if (netBadge) {
    var netMsg = '';
    if (network.card_status && network.card_status !== 'link') {
      netMsg = 'LAN ERROR';
    } else if (network.WAN && network.WAN !== 'online') {
      netMsg = 'WAN ERROR';
    } else if (network.God_use_VPN && network.God_use_VPN !== 'online') {
      netMsg = 'GFW ERROR';
    }
    if (netMsg) {
      netBadge.textContent = netMsg;
      netBadge.classList.add('visible');
    } else {
      netBadge.classList.remove('visible');
    }
  }

}

//更新电源信息
function update_power_info(data) {
  var random = 0;
  var random2 = 0;
  var random3 = 0;
// 更新电源状态
if (data.OUT_Voltage) {
  random = data.OUT_Power;
  random2 = data.OUT_Voltage;
  random3 = data.OUT_Current;
  // 直接使用返回的 OUT_Voltage、OUT_Current 和 OUT_Power
      // document.getElementById('Voltage').textContent = `${data.OUT_Voltage} V`;
      // document.getElementById('Current').textContent = `${data.OUT_Current} A`;
      // document.getElementById('Power').textContent = `${data.OUT_Power} W/H`;
  } else {
      // 使用 voltage_buf 和 Current 动态计算
      const voltage = data.voltage_buf && data.voltage_buf[0] ? data.voltage_buf[0] : 0; // 第一个电压值
      const current = data.Current ? data.Current / 1000 : 0; // 电流值从毫安转为安培
  
      // 计算功率 (W)
      const power = (voltage * current).toFixed(2); // 保留两位小数
      random = power
      random2 = voltage.toFixed(2);
      random3 = current.toFixed(2);
      // 更新页面内容
      // document.getElementById('Voltage').textContent = `${voltage.toFixed(2)} V`;
      // document.getElementById('Current').textContent = `${current.toFixed(2)} A`;
      // document.getElementById('Power').textContent = `${power} W/H`;
  }


  
  Power_info_Chart.setOption({
      series: [
        {
          data: [
            {
              value: random,
              value2: random2,
              value3: random3
            }
          ],
          detail: {
            formatter: function (value) {
              return `${random2} V\n\n\n\n\n${random3} A\n\n\n\n\n${value} W/H\n\n\n\n\n电源状态`;
            }
          }
        },
        {
          data: [
            {
              value: random,
              value2: random2,
              value3: random3
            }
          ]
        }
      ]
    });


}

//更新服务器信息
// function update_server_info(data) {

//   const serverContainer = document.getElementById('server-status-container');

//   data.forEach((server, index) => {
//       let serverElement = document.querySelector(`#server-item-${index}`);
      
//       // 如果不存在对应的服务器项，创建它
//       if (!serverElement) {
//           serverElement = document.createElement('div');
//           serverElement.classList.add('server-item');
//           serverElement.id = `server-item-${index}`;
  
//           // 左侧名称
//           const serverDetails = document.createElement('div');
//           serverDetails.classList.add('server-details');
//           const serverName = document.createElement('span');
//           serverName.classList.add('server-name');
//           serverName.textContent = server.NAME;
//           serverDetails.appendChild(serverName);
  
//           // 右侧负载和指示灯
//           const serverRight = document.createElement('div');
//           serverRight.classList.add('server-right');
//           const serverLoad = document.createElement('span');
//           serverLoad.classList.add('server-load');
//           const statusIndicator = document.createElement('div');
//           statusIndicator.classList.add('status-indicator');

//           // 设置随机动画延迟
//           const randomDelay = (Math.random() * 1.5 + 0.5).toFixed(2) + 's';
//           statusIndicator.style.animationDelay = randomDelay;

//           serverRight.appendChild(serverLoad);
//           serverRight.appendChild(statusIndicator);
  
//           serverElement.appendChild(serverDetails);
//           serverElement.appendChild(serverRight);
  
//           serverContainer.appendChild(serverElement);
//       }
  
//       // 更新内容
//       const serverLoad = serverElement.querySelector('.server-load');
//       const statusIndicator = serverElement.querySelector('.status-indicator');
  
//       if (server.error) {
//           // 错误状态
//           serverLoad.textContent = server.error;
//           serverLoad.classList.add('text-red');
//           statusIndicator.className = 'status-indicator red'; // 设置红色
//       } else {
//           // 正常状态
//           serverLoad.textContent = "";
  
//           const loadValue = parseFloat(server.load_percentage.replace('%', ''));
//           let indicatorClass = 'green'; // 默认绿色
  
//           if (loadValue >= 40 && loadValue <= 80) {
//               indicatorClass = 'yellow'; // 黄色
//           } else if (loadValue > 80) {
//               indicatorClass = 'red'; // 红色
//           }
  
//           // 如果指示灯颜色没变，不更新类名，避免刷新动画
//           if (!statusIndicator.classList.contains(indicatorClass)) {
//               statusIndicator.className = `status-indicator ${indicatorClass}`;
//           }
//       }
//   });
// }

function update_power(data) {
  const powerInfoContainer = document.getElementById('power-info');

  if (!powerInfoContainer) {
    console.error('Power info container not found!');
    return;
  }

  // 生成电源信息的 HTML 内容
  const powerContent = `
    <p><strong>市电电压:</strong> ${data.IN_Voltage} V</p>
    <p><strong>市电电流:</strong> ${data.IN_Current} A</p>
    <p><strong>输出电压:</strong> ${data.OUT_Voltage} V</p>
    <p><strong>输出电流:</strong> ${data.OUT_Current} A</p>
    <p><strong>输入功率:</strong> ${data.IN_Power} W</p>
    <p><strong>输出功率:</strong> ${data.OUT_Power} W</p>
    <p><strong>温度 0:</strong> ${data.Temp0} °C</p>
    <p><strong>温度 1:</strong> ${data.Temp1 === -1 ? 'N/A' : data.Temp1 + ' °C'}</p>
    <p><strong>风扇转速:</strong> ${data.Fan} RPM</p>
    <p><strong>运行时间:</strong> ${data.Time === -1 ? 'N/A' : data.Time + ' s'}</p>
  `;

  // 更新模态框内容
  powerInfoContainer.innerHTML = powerContent;

}


function update_server_info(data) {
  const serverContainer = document.getElementById('server-status-container');

  // 限制最多显示 5 个服务器项
  const maxServers = 5;
  const displayedData = data.slice(0, maxServers);

  // 创建或更新已有服务器项
  for (let i = 0; i < maxServers; i++) {
      let serverElement = document.querySelector(`#server-item-${i}`);
      
      // 如果不存在对应的服务器项，创建它
      if (!serverElement) {
          serverElement = document.createElement('div');
          serverElement.classList.add('server-item');
          serverElement.id = `server-item-${i}`;

          // 左侧名称
          const serverDetails = document.createElement('div');
          serverDetails.classList.add('server-details');
          const serverName = document.createElement('span');
          serverName.classList.add('server-name');
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
      const serverName = serverElement.querySelector('.server-name');
      const serverLoad = serverElement.querySelector('.server-load');
      const statusIndicator = serverElement.querySelector('.status-indicator');

      if (i < displayedData.length) {
          // 更新正常服务器数据
          const server = displayedData[i];
          serverName.textContent = server.NAME;

          if (server.error) {
              // 错误状态
              serverLoad.textContent = server.error;
              serverLoad.classList.add('text-red');
              statusIndicator.className = 'status-indicator red'; // 红色
          } else {
              // 正常状态
              serverLoad.textContent = server.load_percentage;
              serverLoad.classList.remove('text-red');

              const loadValue = parseFloat(server.load_percentage.replace('%', ''));
              let indicatorClass = 'green'; // 默认绿色

              if (loadValue >= 40 && loadValue <= 80) {
                  indicatorClass = 'yellow'; // 黄色
              } else if (loadValue > 80) {
                  indicatorClass = 'red'; // 红色
              }

              statusIndicator.className = `status-indicator ${indicatorClass}`;
          }

          statusIndicator.style.visibility = 'visible'; // 显示指示灯
      } else {
          // 补全空服务器项
          serverName.textContent = ''; // 不显示名称
          serverLoad.textContent = ''; // 不显示负载
          statusIndicator.className = 'status-indicator'; // 默认样式
          statusIndicator.style.visibility = 'hidden'; // 隐藏指示灯，但保留占位
      }
  }

  // 删除多余的服务器项（如果有）
  while (serverContainer.children.length > maxServers) {
      serverContainer.removeChild(serverContainer.lastChild);
  }
  //更新 服务器页面数据 
  


  const serverList = document.querySelector('.server_info-list');
  serverList.innerHTML = ''; // 清空之前的内容

  data.forEach(server => {
    // 创建服务器项容器
    const serverItem = document.createElement('div');
    serverItem.classList.add('server_info-item');

    // 服务器名称
    const serverName = document.createElement('h3');
    serverName.classList.add('server_info-name');
    serverName.textContent = `${server.NAME}`;
    serverItem.appendChild(serverName);

    if (server.error) {
      // 显示错误信息
      const errorText = document.createElement('p');
      errorText.classList.add('server_info-error');
      errorText.textContent = `ERROR: ${server.error}`;
      errorText.style.color = '#000000';
      errorText.style.fontWeight = 'bold';
      serverItem.appendChild(errorText);

      // 创建错误进度条
      const errorBar = document.createElement('div');
      errorBar.classList.add('server_info-progress-bar', 'server_info-load-bar');
      errorBar.style.setProperty('--value', 0); // 进度条填满
      // errorBar.style.backgroundColor = '#000000'; 
      errorBar.style.backgroundColor = '#b0b0b0'; // 设置灰色背景

      serverItem.appendChild(errorBar);
    } else {
      // 显示核心数量
      const cpuCores = document.createElement('p');
      cpuCores.textContent = `核心数量: ${server.cpu_cores}`;
      serverItem.appendChild(cpuCores);

      // 显示平均负载
      const loadText = document.createElement('p');
      loadText.innerHTML = `平均负载: <span class="server_info-load-value">${server.load_percentage}</span>`;
      serverItem.appendChild(loadText);

      // 创建负载进度条
      const loadBar = document.createElement('div');
      loadBar.classList.add('server_info-progress-bar', 'server_info-load-bar');
      loadBar.style.setProperty('--value', parseFloat(server.load_percentage));
      serverItem.appendChild(loadBar);

      // 显示通信延迟
      const latencyText = document.createElement('p');
      latencyText.innerHTML = `请求延迟:  <span class="server_info-latency-value" style="--latency: ${server.latency_ms};">${server.latency_ms}ms</span>`;
      serverItem.appendChild(latencyText);
    }

    // 将服务器项添加到服务器列表
    serverList.appendChild(serverItem);
  });


}



//按钮触发与模态框显示
document.addEventListener('DOMContentLoaded', () => {
  const gridItems = document.querySelectorAll('.info_grid-item');
  const menuItems = document.querySelectorAll('.menu-list li');

  gridItems.forEach((item, index) => {
    if (index === 5) {
      // 第六个 info_grid-item 的特殊处理
      item.addEventListener('click', () => {
        const serverDiv = document.getElementById('server');
        if (serverDiv) {
          // 隐藏 info
          document.getElementById("info").classList.remove("display_block");
          document.getElementById("info").classList.add("display_none");

          // 显示 server
          serverDiv.classList.remove('display_none');
          serverDiv.classList.add('display_block');

          // 设置左侧菜单“服务”标签为选中
          updateActiveMenu("服务");
        }
      });
    } else {
      // 其他 info_grid-item 绑定对应模态框
      const modal = document.getElementById(`modal-${index + 1}`);
      const closeButton = modal.querySelector('.close-button');

      // 绑定点击事件，显示对应模态框
      item.addEventListener('click', () => {
        modal.classList.add('active');
      });

      // 绑定关闭按钮事件
      closeButton.addEventListener('click', () => {
        modal.classList.remove('active');
      });

      // 点击模态框外部区域关闭
      modal.addEventListener('click', (event) => {
        if (event.target === modal) {
          modal.classList.remove('active');
        }
      });
    }
  });

  /**
   * 更新左侧菜单的选中状态
   * @param {string} menuText - 要选中的菜单项文本
   */
  function updateActiveMenu(menuText) {
    menuItems.forEach((menuItem) => {
      const text = menuItem.querySelector('.text').textContent.trim();

      // 切换 active 类
      if (text === menuText) {
        menuItem.classList.add('active');
      } else {
        menuItem.classList.remove('active');
      }
    });
  }
});

//环境信息灯光绑定 
let light_IO = 0;
document.addEventListener('DOMContentLoaded', () => {
  const lightSwitch = document.getElementById('env_light_status_switch');

  // 监听开关的 change 事件
  lightSwitch.addEventListener('change', (event) => {
    const isOn = event.target.checked; // 获取开关状态
    if (isOn) {
      setIOState(light_IO, "1");
    } else {
      setIOState(light_IO, "0");
    }
  });
});

// ============================
// 锁屏 & 滑动解锁
// ============================

// ===== 滑动解锁 =====
const sliderThumb = document.getElementById('slider-thumb');
const sliderTrack = document.getElementById('slider-track');
let isDragging    = false;
let startX        = 0;
let thumbStartX   = 0;   // 拖动开始时的 translateX 值
let _currentX     = 0;   // 当前 translateX，避免正则解析
let _sliderMax    = 0;   // 缓存 max，避免每帧 reflow

let _lockOffTimer = null;  // 10s 无操作关屏计时器
let _dpPollTimer  = null;  // 屏幕关闭后轮询 GET_DP 计时器
let _shouldLock   = false; // 关屏后重新亮起是否需要锁屏
let _screenOff    = false; // 屏幕当前是否已关闭（关闭时停止数据更新）

// 闲置自动锁屏计时器
let _idleTimer    = null;
let _idleMs       = parseInt(localStorage.getItem('autoLockMs') || '300000', 10); // 默认 5 分钟

// 应用设置：同步 select 值并重置计时
function setAutoLock(ms) {
  _idleMs = ms;
  localStorage.setItem('autoLockMs', ms);
  var sel = document.getElementById('autolock-select');
  if (sel) sel.value = String(ms);
  _resetIdleTimer();
}

// 重置闲置计时器
function _resetIdleTimer() {
  if (_idleTimer) { clearTimeout(_idleTimer); _idleTimer = null; }
  if (_idleMs <= 0) return; // 永不锁屏
  _idleTimer = setTimeout(function() {
    _idleTimer = null;
    lockFunction_all(); // 闲置超时 → 锁屏 + 发送 OFF_DP
  }, _idleMs);
}

// 监听用户交互，有操作时重置闲置计时
(function() {
  ['mousemove', 'mousedown', 'touchstart', 'keydown'].forEach(function(evt) {
    document.addEventListener(evt, _resetIdleTimer, { passive: true });
  });
})();

function getClientX(e) {
  return e.touches ? e.touches[0].clientX : e.clientX;
}

function _setThumbX(x) {
  x = Math.max(0, Math.min(x, _sliderMax));
  sliderThumb.style.transform = 'translateX(' + x + 'px)';
  _currentX = x;
  return x;
}

// 被 socket LOCK 事件 / 侧边栏按钮调用：显示锁屏，并启动 10s 关屏计时
function lockFunction() {
  // 锁屏前先跳回主页，避免锁屏期间停留在设置/服务页
  ['info', 'server', 'setting'].forEach(function(id) {
    var el = document.getElementById(id);
    if (el) { el.classList.remove('display_block'); el.classList.add('display_none'); }
  });
  var infoEl = document.getElementById('info');
  if (infoEl) { infoEl.classList.remove('display_none'); infoEl.classList.add('display_block'); }

  const modal = document.getElementById('lock-modal');
  if (modal) {
    if (sliderTrack && sliderThumb) {
      _sliderMax = sliderTrack.clientWidth - sliderThumb.offsetWidth;
    }
    modal.classList.add('active');
  }
  _shouldLock = true;
  // 停止可能正在运行的轮询（防止重复）
  if (_dpPollTimer) { clearInterval(_dpPollTimer); _dpPollTimer = null; }
  // 10 秒内未解锁 → 关屏，然后轮询等待屏幕再次亮起
  if (_lockOffTimer) clearTimeout(_lockOffTimer);
  _lockOffTimer = setTimeout(function() {
    _lockOffTimer = null;
    _screenOff = true;          // 标记屏幕已关，response handler 停止重调度
    stop_loop();                // 停止服务器数据推送
    sendCommand('{"ID":"COMMAND","MSG":"OFF_DP"}', 0);
    _startDpPoll();
  }, 10000);
}

// 关屏后每 2s 查询一次屏幕状态
function _startDpPoll() {
  if (_dpPollTimer) clearInterval(_dpPollTimer);
  _dpPollTimer = setInterval(function() {
    sendCommand('{"ID":"COMMAND","MSG":"GET_DP"}', 0);
  }, 2000);
}

// 供 index_socket.js DP_STATUS 回调调用
function handleDpStatus(status) {
  if (status === 'on' && _shouldLock) {
    // 屏幕重新亮起，且应处于锁定状态 → 恢复数据更新，重新显示锁屏
    _screenOff = false;
    if (_dpPollTimer) { clearInterval(_dpPollTimer); _dpPollTimer = null; }
    run_loop();      // 恢复数据推送
    lockFunction();  // 重新显示锁屏 + 重启 10s 计时
  }
  // status === 'off' / 'unknown'：继续轮询等待
}

// 被侧边栏按钮调用：显示锁屏 + 发送 OFF_DP 命令
function lockFunction_all() {
  lockFunction();
  send_lockFunction();
}

function startDrag(e) {
  isDragging  = true;
  startX      = getClientX(e);
  thumbStartX = _currentX;   // 直接读变量，无正则
  sliderThumb.style.transition = 'none';
  e.preventDefault();
}

function onDrag(e) {
  if (!isDragging) return;
  const dx = getClientX(e) - startX;
  _setThumbX(thumbStartX + dx);
  e.preventDefault();
}

function endDrag() {
  if (!isDragging) return;
  isDragging = false;
  sliderThumb.style.transition = 'transform 0.18s ease';
  if (_currentX >= _sliderMax * 0.9) {
    _setThumbX(_sliderMax);
    setTimeout(unlockScreen, 180);
  } else {
    _setThumbX(0);
  }
}

function unlockScreen() {
  _shouldLock = false;
  _screenOff  = false;           // 解锁后屏幕视为亮起
  if (_lockOffTimer) { clearTimeout(_lockOffTimer); _lockOffTimer = null; }
  if (_dpPollTimer)  { clearInterval(_dpPollTimer);  _dpPollTimer  = null; }
  const modal = document.getElementById('lock-modal');
  if (modal) modal.classList.remove('active');
  setTimeout(function() {
    sliderThumb.style.transition = '';
    _setThumbX(0);
  }, 220);
  // 返回主页（信息页）已在 lockFunction 触发时完成，此处无需重复跳转
  run_loop();          // 恢复数据推送
  _resetIdleTimer();   // 重新启动闲置计时
}

// 初始化（脚本在 body 末尾，DOM 已就绪）
if (sliderTrack && sliderThumb) {
  _sliderMax = sliderTrack.clientWidth - sliderThumb.offsetWidth;
}

// 同步自动锁屏下拉框选中值
(function() {
  var sel = document.getElementById('autolock-select');
  if (sel) sel.value = String(_idleMs);
  _resetIdleTimer(); // 页面加载完成即开始计时  // 故障 badge 动画同步基准：计算负偏移将所有 badge 锻定到同一时间轴
  var syncDelay = -((Date.now() % 2000) / 1000);
  document.documentElement.style.setProperty('--fault-badge-sync', syncDelay + 's');})();

if (sliderThumb) {
  sliderThumb.addEventListener('mousedown',  startDrag, { passive: false });
  sliderThumb.addEventListener('touchstart', startDrag, { passive: false });
}
document.addEventListener('mousemove', onDrag,    { passive: false });
document.addEventListener('touchmove', onDrag,    { passive: false });
document.addEventListener('mouseup',   endDrag);
document.addEventListener('touchend',  endDrag);