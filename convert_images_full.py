import base64
import os

# 图片文件路径
image_paths = {
    'default': 'imgs/1.png',
    'happy': 'imgs/4.png',
    'proud': 'imgs/5.png',
    'crying': 'imgs/3.png'
}

# 转换图片为base64
base64_images = {}
for key, path in image_paths.items():
    if os.path.exists(path):
        with open(path, 'rb') as f:
            img_data = f.read()
            base64_str = base64.b64encode(img_data).decode('utf-8')
            base64_images[key] = f'data:image/png;base64,{base64_str}'
        print(f'{key}: {base64_images[key][:100]}... (length: {len(base64_images[key])})')
    else:
        print(f'File not found: {path}')

# 生成JavaScript代码
js_code = 'const expressions = {\n'
for key, value in base64_images.items():
    js_code += f'    {key}: "{value}",\n'
js_code += '};'

# 写入文件
with open('base64_images_full.js', 'w', encoding='utf-8') as f:
    f.write(js_code)

print('\nBase64 images have been written to base64_images_full.js')