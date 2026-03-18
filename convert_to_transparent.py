from PIL import Image
import os

# 定义要处理的目录
dirs_to_process = [
    'd:\\projects\\AI自习室\\SmartSports\\imgs',
    'd:\\Program Files\\nginx-1.26.3\\html\\imgs'
]

# 定义白色阈值（接近白色的像素将被设为透明）
WHITE_THRESHOLD = 240

def convert_to_transparent(input_path, output_path):
    """将图片转换为透明背景"""
    try:
        # 打开图片
        img = Image.open(input_path)
        
        # 转换为RGBA模式
        img = img.convert('RGBA')
        
        # 获取像素数据
        pixels = img.load()
        width, height = img.size
        
        # 遍历每个像素，将接近白色的像素设为透明
        for x in range(width):
            for y in range(height):
                r, g, b, a = pixels[x, y]
                # 如果像素接近白色，设为透明
                if r > WHITE_THRESHOLD and g > WHITE_THRESHOLD and b > WHITE_THRESHOLD:
                    pixels[x, y] = (r, g, b, 0)
        
        # 保存修改后的图片
        img.save(output_path, 'PNG')
        print(f"成功转换: {os.path.basename(input_path)}")
        
    except Exception as e:
        print(f"转换失败 {os.path.basename(input_path)}: {e}")

# 处理每个目录
for directory in dirs_to_process:
    if os.path.exists(directory):
        print(f"处理目录: {directory}")
        # 获取目录中的所有PNG文件
        for filename in os.listdir(directory):
            if filename.endswith('.png'):
                input_path = os.path.join(directory, filename)
                output_path = os.path.join(directory, filename)  # 覆盖原文件
                convert_to_transparent(input_path, output_path)
        print(f"目录处理完成: {directory}")
    else:
        print(f"目录不存在: {directory}")
