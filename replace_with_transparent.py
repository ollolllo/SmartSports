from PIL import Image
import os
import shutil

# 输入图片路径
input_path = "D:\\Program Files\\nginx-1.26.3\\html\\imgs\\7.png"
# 临时输出路径
temp_path = "D:\\Program Files\\nginx-1.26.3\\html\\imgs\\7_temp_transparent.png"

try:
    # 备份原文件
    backup_path = "D:\\Program Files\\nginx-1.26.3\\html\\imgs\\7_backup.png"
    if os.path.exists(input_path):
        shutil.copy(input_path, backup_path)
        print(f"成功备份原文件到: {backup_path}")
    
    # 打开图片
    img = Image.open(input_path)
    print(f"成功打开图片: {input_path}")
    print(f"原始图片模式: {img.mode}")
    print(f"原始图片尺寸: {img.width}x{img.height}")
    
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
    
    # 保存到临时文件
    img.save(temp_path, 'PNG')
    print(f"成功保存透明图片到临时文件: {temp_path}")
    
    # 替换原文件
    if os.path.exists(temp_path):
        # 删除原文件
        os.remove(input_path)
        print(f"删除原文件: {input_path}")
        
        # 重命名临时文件为原文件名
        os.rename(temp_path, input_path)
        print(f"重命名临时文件为原文件: {input_path}")
        
        # 验证文件是否存在
        if os.path.exists(input_path):
            print(f"验证成功: 新文件已创建")
            print(f"文件大小: {os.path.getsize(input_path)} 字节")
        else:
            print("错误: 新文件未创建")
    else:
        print("错误: 临时文件未创建")
        
except Exception as e:
    print(f"处理图片时出错: {str(e)}")
    import traceback
    traceback.print_exc()