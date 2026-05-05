# Dream Machine — Electron 前端

基于 Electron 的硬件监控面板，运行于 H618 SoC（ARM64）Linux 设备，连接后端 Flask-SocketIO 服务实时展示网络、环境、电源等状态。

---

## 环境要求

| 组件 | 版本 |
|------|------|
| Node.js | ≥ 18 |
| npm | ≥ 9 |
| Electron | 29（自动安装） |
| 系统 | Linux，需 X Server（xinit / Xorg） |
| 架构 |  ARM64 |

---

## 本地开发

```bash
# 安装依赖
npm install

# 启动（开发模式，带窗口边框可调试）
npm start
```

---

## Linux 环境准备

### 安装 Node.js（ARM64）


### 安装 X Server 与 xinit

Electron 需要 X 窗口系统才能显示界面，无桌面环境的精简系统需手动安装。

```bash
# Debian / Ubuntu / Armbian
apt-get update
apt-get install -y xorg xinit x11-xserver-utils

# 验证安装
which xinit    # 应输出 /usr/bin/xinit
which Xorg     # 应输出 /usr/bin/Xorg
```

> **`x11-xserver-utils`** 提供 `xset` 命令，`run.sh` 中 `xset -dpms` 用于关闭屏幕节能。

### 允许 root 运行 X（如以 root 部署）

Xorg 默认拒绝 root 启动，需修改配置：

```bash
# 编辑 /etc/X11/Xwrapper.config，若不存在则创建
echo "allowed_users = anybody" > /etc/X11/Xwrapper.config
echo "needs_root_rights = yes" >> /etc/X11/Xwrapper.config
```

---

## 部署到 Linux 设备

### 1. 传输文件

将以下文件/目录复制到设备的 `/opt/Dream_Machine/electron/`：

```
index.html
index.js
package.json
package-lock.json
index/
run.sh
Dream_Machine_app.service
```



### 2. 在设备上安装依赖

```bash
cd /opt/Dream_Machine/electron
npm install --omit=dev
```

### 3. 配置开机自启（systemd）

```bash
# 复制服务文件
cp /opt/Dream_Machine/electron/Dream_Machine_app.service /etc/systemd/system/

# 重载 systemd 并启用
systemctl daemon-reload
systemctl enable Dream_Machine_app
systemctl start Dream_Machine_app
```

服务配置（`Dream_Machine_app.service`）会调用 `run.sh`，流程如下：

```
systemd → run.sh → xinit → npm start → Electron
```

`run.sh` 内容：

```sh
#!/bin/sh
source /root/.bashrc
xset -dpms          # 关闭屏幕节能
xinit /usr/local/bin/npm start -- :0 -nocursor
```

### 4. 手动启动（不用 systemd）

```bash
cd /opt/Dream_Machine/electron
DISPLAY=:0 npm start
```

或直接执行 run.sh（需已有 X 环境）：

```bash
bash /opt/Dream_Machine/electron/run.sh
```

---

## 服务管理

```bash
# 查看运行状态
systemctl status Dream_Machine_app

# 重启
systemctl restart Dream_Machine_app

# 查看日志
journalctl -u Dream_Machine_app -f
```

---

## 项目结构

```
electron/
├── index.html              # 主窗口页面
├── index.js                # Electron 主进程
├── package.json
├── run.sh                  # Linux 启动脚本（xinit）
├── Dream_Machine_app.service  # systemd 服务文件
└── index/                  # 前端资源
    ├── index.html          # 面板 HTML
    ├── index.js            # 页面逻辑（自动锁屏、导航等）
    ├── index_socket.js     # SocketIO 通信、数据更新
    ├── style.css           # 主样式
    ├── fan.css             # 风扇动画
    ├── *.css               # 各模块样式
    ├── echarts.min.js      # ECharts 图表库
    ├── socket.io.min.js    # Socket.IO 客户端
    └── icon/ img/          # 图标和图片资源
```

---

## 后端依赖

前端通过 Socket.IO 连接 `http://127.0.0.1:8081`，需确保 Flask-SocketIO 后端服务已在设备上运行。
