import os
import re

src_file = r'c:\Users\zubai\Desktop\Inventory Management\Inventory Management\IMS Code.txt'
out_dir = r'c:\Users\zubai\Desktop\Inventory Management\Inventory Management\src'

with open(src_file, 'r', encoding='utf-8') as f:
    code = f.read()

# I will just write a simpler approach: I will provide the full code for Sidebar since it's small, 
# and use python to do the heavy lifting for the rest if needed, or I can just use python to extract the whole component bodies.
