import http.server
import socketserver
import os

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        super().end_headers()

os.chdir('d:\projects\SmartSports')

PORT = 5173

handler = MyHTTPRequestHandler

with socketserver.TCPServer(("", PORT), handler) as httpd:
    print(f'Server running at http://localhost:{PORT}/')
    print(f'Server running at http://192.168.3.131:{PORT}/')
    httpd.serve_forever()