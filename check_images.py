from PIL import Image

# 检查所有表情图片
for i in [1, 2, 3, 4, 5]:
    try:
        img = Image.open(f'imgs/{i}.png')
        has_transparency = img.mode in ['RGBA', 'LA']
        print(f'{i}.png - 格式: {img.format}, 模式: {img.mode}, 有透明通道: {has_transparency}')
    except Exception as e:
        print(f'{i}.png - 错误: {e}')
