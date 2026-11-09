import os
import sys

from PIL import Image

# The same face crop and JPEG settings as the hand-made kel-*.jpg in hub/assets (98ba0fc).
src, dest = sys.argv[1], sys.argv[2]
im = Image.open(src).convert('RGB')
s = im.size[0] / 256
im = im.crop((round(48 * s), round(12 * s), round(208 * s), round(172 * s))).resize((200, 200), Image.LANCZOS)
tmp = dest + '.part'
im.save(tmp, 'JPEG', quality=85, optimize=True)
os.replace(tmp, dest)
