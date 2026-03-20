from PIL import Image
import os

# 输入图片路径
input_path = "D:\\Program Files\\nginx-1.26.3\\html\\imgs\\7.png"
# 输出图片路径
output_path = "D:\\Program Files\\nginx-1.26.3\\html\\imgs\\7_transparent_100x100.png"

try:
    # 打开图片
    img = Image.open(input_path)
    print(f"成功打开图片: {input_path}")
    
    # 调整尺寸为100x100像素
    resized_img = img.resize((100, 100), Image.Resampling.LANCZOS)
    print("成功调整尺寸为100x100像素")
    
    # 转换为RGBA模式（支持透明）
    if resized_img.mode != 'RGBA':
        resized_img = resized_img.convert('RGBA')
    print("成功转换为RGBA模式")
    
    # 创建透明背景
    transparent_img = Image.new('RGBA', (100, 100), (255, 255, 255, 0))
    
    # 将调整后的图片粘贴到透明背景上
    # 计算居中位置
    paste_x = (100 - resized_img.width) // 2
    paste_y = (100 - resized_img.height) // 2
    transparent_img.paste(resized_img, (paste_x, paste_y), resized_img)
    print("成功创建透明背景")
    
    # 保存输出图片
    transparent_img.save(output_path, 'PNG')
    print(f"成功保存透明图片到: {output_path}")
    
    # 验证文件是否存在
    if os.path.exists(output_path):
        print(f"验证成功: 输出文件已创建")
        print(f"文件大小: {os.path.getsize(output_path)} 字节")
    else:
        print("错误: 输出文件未创建")
        
except Exception as e:
    print(f"处理图片时出错: {str(e)}")
    import traceback
    traceback.print_exc()