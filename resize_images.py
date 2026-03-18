from PIL import Image
import os

# 定义要处理的目录
directory = 'd:\\Program Files\\nginx-1.26.3\\html\\imgs'

# 定义目标尺寸
target_size = (300, 300)

def resize_image(input_path, output_path, size):
    """调整图片尺寸"""
    try:
        # 打开图片
        img = Image.open(input_path)
        
        # 调整尺寸
        resized_img = img.resize(size, Image.LANCZOS)
        
        # 保存修改后的图片
        resized_img.save(output_path, 'PNG')
        print(f"成功调整尺寸: {os.path.basename(input_path)}")
        
    except Exception as e:
        print(f"调整尺寸失败 {os.path.basename(input_path)}: {e}")

# 处理目录
if os.path.exists(directory):
    print(f"处理目录: {directory}")
    # 获取目录中的所有PNG文件
    for filename in os.listdir(directory):
        if filename.endswith('.png'):
            input_path = os.path.join(directory, filename)
            output_path = os.path.join(directory, filename)  # 覆盖原文件
            resize_image(input_path, output_path, target_size)
    print(f"目录处理完成: {directory}")
else:
    print(f"目录不存在: {directory}")
