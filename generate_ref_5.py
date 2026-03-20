from PIL import Image
import os
import shutil

# 输入图片路径（8.png）
input_path = "D:\\Program Files\\nginx-1.26.3\\html\\imgs\\8.png"
# 参考图片路径（5.png）
ref_path = "D:\\Program Files\\nginx-1.26.3\\html\\imgs\\5.png"
# 输出图片路径（7.png）
output_path = "D:\\Program Files\\nginx-1.26.3\\html\\imgs\\7.png"

try:
    # 检查输入文件是否存在
    if not os.path.exists(input_path):
        print(f"错误: 输入文件不存在: {input_path}")
        exit(1)
    
    # 检查参考文件是否存在
    if not os.path.exists(ref_path):
        print(f"错误: 参考文件不存在: {ref_path}")
        exit(1)
    
    # 备份原7.png文件
    backup_path = "D:\\Program Files\\nginx-1.26.3\\html\\imgs\\7_backup.png"
    if os.path.exists(output_path):
        shutil.copy(output_path, backup_path)
        print(f"成功备份原文件到: {backup_path}")
    
    # 打开8.png图片
    img = Image.open(input_path)
    print(f"成功打开图片: {input_path}")
    print(f"原始图片模式: {img.mode}")
    print(f"原始图片尺寸: {img.width}x{img.height}")
    
    # 打开参考图片5.png
    ref_img = Image.open(ref_path)
    print(f"成功打开参考图片: {ref_path}")
    print(f"参考图片模式: {ref_img.mode}")
    print(f"参考图片尺寸: {ref_img.width}x{ref_img.height}")
    
    # 调整尺寸为100x100像素（与参考图片相同）
    if img.size != (100, 100):
        img = img.resize((100, 100), Image.Resampling.LANCZOS)
        print("成功调整尺寸为100x100像素")
    
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
    
    # 保存输出图片（替换7.png）
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