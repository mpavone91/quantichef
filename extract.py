import re
import sys

with open('dashboard.html', 'r', encoding='utf-8') as f:
    html = f.read()

match = re.search(r'<script>(.*?)</script>', html, re.DOTALL)
if match:
    with open('temp.js', 'w', encoding='utf-8') as f:
        f.write(match.group(1))
    print("JS extracted to temp.js")
else:
    print("No script tag found")
