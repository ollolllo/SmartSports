from PIL import Image
import os
import base64

# 定义要处理的目录
dirs_to_process = [
    'd:\\projects\\AI自习室\\SmartSports\\imgs',
    'd:\\Program Files\\nginx-1.26.3\\html\\imgs'
]

# 定义白色阈值（接近白色的像素将被设为透明）
WHITE_THRESHOLD = 240

def convert_to_transparent(input_path, output_path, target_size=(200, 200)):
    """将图片转换为透明背景并调整尺寸

    Args:
        input_path: 输入图片路径
        output_path: 输出图片路径
        target_size: 目标尺寸 (width, height)，默认为 (100, 100)
    """
    try:
        img = Image.open(input_path)
        img = img.convert('RGBA')

        pixels = img.load()
        width, height = img.size

        for x in range(width):
            for y in range(height):
                r, g, b, a = pixels[x, y]
                if r > WHITE_THRESHOLD and g > WHITE_THRESHOLD and b > WHITE_THRESHOLD:
                    pixels[x, y] = (r, g, b, 0)

        img = img.resize(target_size, Image.LANCZOS)

        img.save(output_path, 'PNG')
        print(f"成功转换: {os.path.basename(input_path)} -> {target_size[0]}x{target_size[1]}")

    except Exception as e:
        print(f"转换失败 {os.path.basename(input_path)}: {e}")

def convert_image_to_base64(image_path, output_path):
    """将图片转换为base64字符串并写入文件

    Args:
        image_path: 输入图片路径
        output_path: 输出文件路径
    """
    try:
        with open(image_path, 'rb') as img_file:
            base64_data = base64.b64encode(img_file.read()).decode('utf-8')
        base64_with_prefix = f"data:image/png;base64,{base64_data}"
        with open(output_path, 'w') as output_file:
            output_file.write(base64_with_prefix)
        print(f"Base64转换成功: {os.path.basename(image_path)}")
        print(f"Base64字符串: {base64_with_prefix}")
    except Exception as e:
        print(f"Base64转换失败 {os.path.basename(image_path)}: {e}")



# # 处理每个目录
# for directory in dirs_to_process:
#     if os.path.exists(directory): 
#         print(f"处理目录: {directory}")
#         # 获取目录中的所有PNG文件
#         for filename in os.listdir(directory):
#             if filename.endswith('.png'):
#                 input_path = os.path.join(directory, filename)
#                 output_path = os.path.join(directory, filename)  # 覆盖原文件
#                 convert_to_transparent(input_path, output_path)
#         print(f"目录处理完成: {directory}")

#     else:
#         print(f"目录不存在: {directory}")
 
convert_to_transparent("D:\\projects\\AI自习室\\SmartSports\\imgs\\cs.png", "D:\\projects\\AI自习室\\SmartSports\\imgs\\css.png")
convert_image_to_base64("D:\\projects\\AI自习室\\SmartSports\\imgs\\css.png", "D:\\projects\\AI自习室\\SmartSports\\imgs\\css.txt")
# convert_to_transparent("D:\\projects\\AI自习室\\SmartSports\\imgs\\f.png", "D:\\projects\\AI自习室\\SmartSports\\imgs\\fs.png")
# convert_image_to_base64("D:\\projects\\AI自习室\\SmartSports\\imgs\\fs.png", "D:\\projects\\AI自习室\\SmartSports\\imgs\\fs.txt")
# convert_to_transparent("D:\\projects\\AI自习室\\SmartSports\\imgs\\j.png", "D:\\projects\\AI自习室\\SmartSports\\imgs\\js.png")
# convert_image_to_base64("D:\\projects\\AI自习室\\SmartSports\\imgs\\js.png", "D:\\projects\\AI自习室\\SmartSports\\imgs\\js.txt")
