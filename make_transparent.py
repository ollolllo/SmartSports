from PIL import Image
import os

# 输入图片路径
input_path = "D:\\Program Files\\nginx-1.26.3\\html\\imgs\\7.png"
# 输出图片路径
output_path = "D:\\Program Files\\nginx-1.26.3\\html\\imgs\\7_transparent.png"

try:
    # 打开图片
    img = Image.open(input_path)
    print(f"成功打开图片: {input_path}")
    print(f"原始图片尺寸: {img.width}x{img.height}")
    print(f"原始图片模式: {img.mode}")
    
    # 转换为RGBA模式（支持透明）
    if img.mode != 'RGBA':
        img = img.convert('RGBA')
    print("成功转换为RGBA模式")
    
    # 获取图片数据
    data = img.getdata()
    
    # 创建新的透明图片数据
    new_data = []
    for item in data:
        # 检查是否为白色背景（可以根据实际情况调整阈值）
        # 这里假设白色背景的RGB值接近(255, 255, 255)
        if item[0] > 240 and item[1] > 240 and item[2] > 240:
            # 将白色背景设为透明
            new_data.append((255, 255, 255, 0))
        else:
            # 保留其他颜色
            new_data.append(item)
    
    # 更新图片数据
    img.putdata(new_data)
    print("成功将白色背景转换为透明")
    
    # 保存输出图片
    img.save(output_path, 'PNG')
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