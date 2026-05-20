import http.server
import socketserver
import os
import time
import hashlib

class MyHTTPRequestHandler(http.server.SimpleHTTPRequestHandler):
    def end_headers(self):
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type')
        self.send_header('Cache-Control', 'public, max-age=3600')
        super().end_headers()

    def guess_type(self, path):
        base, ext = os.path.splitext(path)
        if ext == '.tflite':
            return 'application/octet-stream'
        return super().guess_type(path)

os.chdir('d:\\projects\\AI自习室\\SmartSports')

PORT = 3000

handler = MyHTTPRequestHandler

with socketserver.TCPServer(("", PORT), handler) as httpd:
    print(f'Server running at http://localhost:{PORT}/')

    httpd.serve_forever()
