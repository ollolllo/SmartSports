from PIL import Image
import os

# 定义文件路径
file_path = 'd:\\Program Files\\nginx-1.26.3\\html\\imgs\\6.png'

# 定义目标尺寸
target_size = (100, 100)

# 定义白色阈值（接近白色的像素将被设为透明）
WHITE_THRESHOLD = 240

def process_image(input_path, output_path, size):
    """调整图片尺寸并设置透明背景"""
    try:
        # 打开图片
        img = Image.open(input_path)
        
        # 转换为RGBA模式
        img = img.convert('RGBA')
        
        # 遍历每个像素，将接近白色的像素设为透明
        pixels = img.load()
        width, height = img.size
        for x in range(width):
            for y in range(height):
                r, g, b, a = pixels[x, y]
                # 如果像素接近白色，设为透明
                if r > WHITE_THRESHOLD and g > WHITE_THRESHOLD and b > WHITE_THRESHOLD:
                    pixels[x, y] = (r, g, b, 0)
        
        # 调整尺寸
        resized_img = img.resize(size, Image.LANCZOS)
        
        # 保存修改后的图片
        resized_img.save(output_path, 'PNG')
        print(f"成功处理: {os.path.basename(input_path)}")
        print(f"新尺寸: {resized_img.size}")
        print(f"模式: {resized_img.mode}")
        
    except Exception as e:
        print(f"处理失败 {os.path.basename(input_path)}: {e}")

# 处理图片
if os.path.exists(file_path):
    print(f"处理文件: {file_path}")
    process_image(file_path, file_path, target_size)  # 覆盖原文件
    print("处理完成")
else:
    print(f"文件不存在: {file_path}")
