import base64

# 定义文件路径
input_image_path = r"D:\Program Files\nginx-1.26.3\html\imgs\7.png"
output_txt_path = r"D:\projects\AI自习室\SmartSports\7.txt"

# 读取图片文件并转换为base64字符串
with open(input_image_path, "rb") as image_file:
    base64_string = base64.b64encode(image_file.read()).decode('utf-8')

# 将base64字符串写入到7.txt文件
with open(output_txt_path, "w") as txt_file:
    txt_file.write(base64_string)

print(f"成功转换: 7.png -> 7.txt")
print("处理完成！")