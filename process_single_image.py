from PIL import Image
import os

# 定义文件路径
input_image_path = r"D:\Program Files\nginx-1.26.3\html\imgs\8.png"
output_image_path = r"D:\Program Files\nginx-1.26.3\html\imgs\7.png"

# 检查文件是否存在
if not os.path.exists(input_image_path):
    print(f"错误: 输入文件 {input_image_path} 不存在")
    exit(1)

# 打开图片
img = Image.open(input_image_path)

# 转换为RGBA模式（支持透明）
img = img.convert("RGBA")

# 获取像素数据
pixels = img.load()

# 遍历所有像素，将接近白色的像素设置为透明
width, height = img.size
for x in range(width):
    for y in range(height):
        r, g, b, a = pixels[x, y]
        # 如果颜色接近白色，设置为透明
        if r > 200 and g > 200 and b > 200:
            pixels[x, y] = (255, 255, 255, 0)

# 保存处理后的图片，替换7.png
img.save(output_image_path, "PNG")

print(f"成功转换: 8.png -> 7.png")
print("处理完成！")