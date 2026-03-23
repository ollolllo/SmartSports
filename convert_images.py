import base64
import os

# 图片文件路径
image_paths = {
    '1': 'D:\\Program Files\\nginx-1.26.3\\html\\imgs\\1.png',
    '2': 'D:\\Program Files\\nginx-1.26.3\\html\\imgs\\2.png',
    '3': 'D:\\Program Files\\nginx-1.26.3\\html\\imgs\\3.png',
    '4': 'D:\\Program Files\\nginx-1.26.3\\html\\imgs\\4.png',
    '5': 'D:\\Program Files\\nginx-1.26.3\\html\\imgs\\5.png',
    '6': 'D:\\Program Files\\nginx-1.26.3\\html\\imgs\\6.png',
    '7': 'D:\\Program Files\\nginx-1.26.3\\html\\imgs\\7.png'
}

# 转换图片为base64
base64_images = {}
for key, path in image_paths.items():
    if os.path.exists(path):
        with open(path, 'rb') as f:
            img_data = f.read()
            base64_str = base64.b64encode(img_data).decode('utf-8')
            base64_images[key] = f'data:image/png;base64,{base64_str}'
        print(f'{key}: {base64_images[key][:50]}...')  # 只打印前50个字符
        
        # 写入对应的txt文件
        with open(f'{key}.txt', 'w', encoding='utf-8') as f:
            f.write(base64_images[key])
        print(f'Base64 image has been written to {key}.txt')
    else:
        print(f'File not found: {path}')

# 生成JavaScript代码
js_code = 'const expressions = {\n'
for key, value in base64_images.items():
    js_code += f'    {key}: "{value}",\n'
js_code += '};'

# 写入文件
with open('base64_images.js', 'w', encoding='utf-8') as f:
    f.write(js_code)

print('\nBase64 images have been written to base64_images.js')