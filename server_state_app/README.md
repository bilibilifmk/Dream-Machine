# server_state_app

系统负载监控 API 服务，提供 RESTful 接口查询服务器 CPU 负载信息。

## 功能

- 通过 HTTP GET 请求查询 CPU 负载百分比、核心数及 1 分钟平均负载
- 使用 API Key 进行简单身份验证
- 仅依赖 Python 标准库，无需安装第三方包

## 配置

在 `server_state_app.py` 中修改以下参数：

| 参数 | 默认值 | 说明 |
|------|--------|------|
| `PORT` | `7810` | 监听端口 |
| `SECRET_KEY` | `apikey` | API 密钥 |

## 运行

### 直接运行

```bash
python3 server_state_app.py
```

### systemd 服务

部署为系统服务（需要 root 权限）：

```bash
# 复制服务文件
sudo cp Dream_Machine_state_app.service /etc/systemd/system/

# 重新加载 systemd 配置
sudo systemctl daemon-reload

# 启用并启动服务
sudo systemctl enable Dream_Machine_state_app
sudo systemctl start Dream_Machine_state_app

# 查看运行状态
sudo systemctl status Dream_Machine_state_app
```

## API 使用

### 请求

```
GET http://<host>:7810/?key=<SECRET_KEY>
```

### 响应示例

```json
{
  "load_percentage": "23%",
  "cpu_cores": 8,
  "load": 1.83
}
```

### 错误响应

| HTTP 状态码 | 原因 |
|-------------|------|
| `401` | API Key 错误或缺失 |
| `404` | 路径不存在 |
| `500` | 服务器内部错误 |
