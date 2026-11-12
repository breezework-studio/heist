#!/usr/bin/env python3
"""Builds index.html (single offline file) + PWA files from src/ and data/."""
import base64, json, os, subprocess, sys
from pathlib import Path
root = Path(__file__).resolve().parent.parent
src = root / 'src'
data = json.loads(subprocess.check_output(['node', '-e', "process.stdout.write(JSON.stringify(require('./tools/data.js')))"], cwd=root))
html = (src / 'template.html').read_text(encoding='utf-8')

# fonts (embedded so the game works offline)
fontdir = root / 'tools' / 'fonts'
faces = []
for fam, file, weight in [('Special Elite', 'special-elite-latin-400-normal.woff2', 400),
                          ('Barlow Condensed', 'barlow-condensed-latin-500-normal.woff2', 500),
                          ('Barlow Condensed', 'barlow-condensed-latin-700-normal.woff2', 700),
                          ('Barlow', 'barlow-latin-400-normal.woff2', 400),
                          ('Barlow', 'barlow-latin-500-normal.woff2', 500)]:
    f = fontdir / file
    if f.exists():
        b = base64.b64encode(f.read_bytes()).decode()
        faces.append(f"@font-face{{font-family:'{fam}';font-weight:{weight};font-style:normal;font-display:swap;src:url(data:font/woff2;base64,{b}) format('woff2')}}")
html = html.replace('/*FONTS*/', '\n'.join(faces))
html = html.replace('/*DATA*/', 'window.HEIST_DATA = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';')
for mark, name in [('ENGINE', 'engine.js'), ('AI', 'ai.js'), ('I18N', 'i18n.js'), ('RULES', 'rules.js'), ('ICONS', 'icons.js'), ('CLOUD', 'cloud.js'), ('TUTORIAL', 'tutorial.js'), ('UI', 'ui.js')]:
    html = html.replace(f'/*{mark}*/', (src / name).read_text(encoding='utf-8'))
# PWA hooks
html = html.replace('<meta name="theme-color" content="#121419">',
    '<meta name="theme-color" content="#121419">\n<link rel="manifest" href="manifest.webmanifest">\n<link rel="icon" href="icon-192.png">\n<link rel="apple-touch-icon" href="icon-192.png">', 1)
html = html.replace('</body>', "<script>if('serviceWorker' in navigator && location.protocol.startsWith('http')) navigator.serviceWorker.register('sw.js').catch(()=>{});</script>\n</body>", 1)
(root / 'index.html').write_text(html, encoding='utf-8')
print('index.html', len(html) // 1024, 'KB')
