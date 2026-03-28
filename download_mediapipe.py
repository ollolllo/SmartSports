import urllib.request
import os

os.makedirs('d:/projects/SmartSports/mediapipe', exist_ok=True)
os.makedirs('d:/projects/SmartSports/mediapipe/camera_utils', exist_ok=True)
os.makedirs('d:/projects/Smartports/mediapipe/control_utils', exist_ok=True)
os.makedirs('d:/projects/SmartSports/mediapipe/drawing_utils', exist_ok=True)
os.makedirs('d:/projects/SmartSports/mediapipe/pose', exist_ok=True)

files = [
    ('camera_utils/camera_utils.js', 'https://cdn.jsdelivr.net/npm/@mediapipe/camera_utils/camera_utils.js'),
    ('control_utils/control_utils.js', 'https://cdn.jsdelivr.net/npm/@mediapipe/control_utils/control_utils.js'),
    ('drawing_utils/drawing_utils.js', 'https://cdn.jsdelivr.net/npm/@mediapipe/drawing_utils/drawing_utils.js'),
    ('pose/pose.js', 'https://cdn.jsdelivr.net/npm/@mediapipe/pose/pose.js'),
]

for filename, url in files:
    dst = f'd:/projects/SmartSports/mediapipe/{filename}'
    print(f'Downloading {filename}...')
    try:
        urllib.request.urlretrieve(url, dst)
        size = os.path.getsize(dst)
        print(f'OK: {filename} ({size} bytes)')
    except Exception as e:
        print(f'FAIL: {filename} - {e}')

print('Done')