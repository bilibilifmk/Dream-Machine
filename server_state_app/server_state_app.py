"""系统负载监控 API 服务

提供 RESTful API 端点来查询系统 CPU 负载信息。
需要提供有效的 API 密钥进行身份验证。
仅使用 Python 标准库，无需第三方依赖。
"""
import os
import json
from http.server import BaseHTTPRequestHandler, HTTPServer
from urllib.parse import urlparse, parse_qs


PORT = 7810
SECRET_KEY = 'apikey'


class RequestHandler(BaseHTTPRequestHandler):

    def _send_json(self, status: int, data: dict):
        body = json.dumps(data, ensure_ascii=False).encode('utf-8')
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self):
        parsed = urlparse(self.path)
        params = parse_qs(parsed.query)

        if parsed.path != '/':
            self._send_json(404, {"error": "Not Found"})
            return

        request_key = params.get('key', [None])[0]

        if request_key != SECRET_KEY:
            self._send_json(401, {"error": "Unauthorized", "message": "Invalid API key"})
            return

        try:
            load = os.getloadavg()[0]
            cpu_cores = os.cpu_count() or 1
            load_percentage = (load / cpu_cores) * 100

            self._send_json(200, {
                "load_percentage": f"{load_percentage:.0f}%",
                "cpu_cores": cpu_cores,
                "load": load,
            })
        except Exception as e:
            self._send_json(500, {"error": "Internal Server Error", "message": str(e)})

    def log_message(self, format, *args):
        pass  # 静默访问日志


if __name__ == '__main__':
    server = HTTPServer(('0.0.0.0', PORT), RequestHandler)
    print(f"Starting API server on port {PORT}...")
    server.serve_forever()