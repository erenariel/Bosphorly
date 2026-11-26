"""Build a disposable static preview. Never modifies live config or backend source."""
from pathlib import Path
import shutil, re, sys, json
source=Path(__file__).resolve().parents[2]
dest=Path(sys.argv[1]).resolve()
dest.mkdir(parents=True,exist_ok=True)
public_dirs={'assets','config','data','en','tr','he','extranet','mimo'}
public_extensions={'.html','.js','.css','.json','.webmanifest','.svg','.png','.webp','.jpg','.jpeg','.gif','.woff','.woff2','.ico','.mp3','.ogg','.wav','.txt','.xml'}
for p in source.rglob('*'):
 rel=p.relative_to(source)
 if not p.is_file() or p.is_symlink():continue
 if len(rel.parts)>1 and rel.parts[0] not in public_dirs:continue
 if p.suffix not in public_extensions:continue
 if p.name in ['package.json','package-lock.json','playwright.config.js','.brand-qa.config.js']:continue
 out=dest/rel;out.parent.mkdir(parents=True,exist_ok=True);shutil.copyfile(p,out)
# Keep the existing guide typeface available without third-party browser requests.
shutil.copytree(source/'tools/brand-preview/fonts',dest/'assets/brand-preview-fonts',dirs_exist_ok=True)
p=dest/'guide.css'
s=p.read_text();s=re.sub(r"@import url\('https://fonts.googleapis.com/[^']+'\);","@import url('assets/brand-preview-fonts/dm-sans.css');",s);p.write_text(s)
# A preview-only directory makes all original pages directly reviewable.
import html
pages=sorted(dest.rglob('*.html'))
links=''.join('<li><a href="/'+html.escape(str(p.relative_to(dest)))+'">'+html.escape(str(p.relative_to(dest)))+'</a></li>' for p in pages if '__review' not in p.parts)
review=dest/'__review/index.html';review.parent.mkdir(exist_ok=True)
review.write_text('<!doctype html><html lang="tr"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Bosphorly — Görsel İnceleme</title><link rel="stylesheet" href="/brand-v2.css"></head><body style="font:16px/1.6 system-ui;padding:24px;max-width:960px;margin:auto"><h1>Bosphorly · Görsel İnceleme</h1><p>Bu demoda gerçek işlem gönderilmez. Mevcut sayfalar aşağıdaki bağlantılardan incelenebilir.</p><p><a href="/">Ana sayfaya dön</a></p><ul>'+links+'</ul></body></html>')
# Strong browser-enforced isolation; original production config is untouched.
csp="default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; font-src 'self' data:; connect-src 'self'; form-action 'none'; frame-src 'none'; object-src 'none'; worker-src 'none'; base-uri 'self'"
for p in dest.rglob('*.html'):
 s=p.read_text()
 s=re.sub(r'<meta\s+name=[\"\']robots[\"\'][^>]*>','',s,flags=re.I)
 prefix='../'*len(p.relative_to(dest).parents[:-1])
 # relative depth from root, independent of language subdirectories
 prefix='../'*(len(p.relative_to(dest).parts)-1)
 guard='<meta name="robots" content="noindex,nofollow,noarchive"><meta http-equiv="Content-Security-Policy" content="'+csp+'"><script src="'+prefix+'preview-guard.js"></script>'
 s=re.sub(r'(<head[^>]*>)',lambda m:m.group(1)+guard,s,count=1,flags=re.I)
 p.write_text(s)
p=dest/'config/api.js'
s=p.read_text();s=re.sub(r'window\.BOSPHORLY_API = Object\.freeze\(\{[^\n]+\}\);',"window.BOSPHORLY_API = Object.freeze({base: location.origin+'/__demo_api', extranetBase: location.origin+'/__demo_api', transferMailBase: location.origin+'/__demo_api', turnstileSiteKey: '', telegramBot: ''});",s,count=1);p.write_text(s)
(dest/'site-analytics.js').write_text('// Analytics intentionally disabled only in this isolated preview.\n')
(dest/'robots.txt').write_text('User-agent: *\nDisallow: /\n')
(dest/'_headers').write_text('/*\n  X-Robots-Tag: noindex, nofollow, noarchive\n  Content-Security-Policy: '+csp+'\n  Referrer-Policy: no-referrer\n  X-Content-Type-Options: nosniff\n')
shutil.copyfile(source/'tools/brand-preview/guard.js',dest/'preview-guard.js')
# Static read-only fixtures never create a member, role, token or reservation.
for endpoint,data in {'extranet/session':{'authenticated':False},'extranet/auth/status':{'authenticated':False},'auth/status':{'authenticated':False},'auth/me':{'authenticated':False},'catalog':json.loads((dest/'data/public-market-prices.json').read_text())}.items():
 p=dest/'__demo_api/v1'/endpoint;p.parent.mkdir(parents=True,exist_ok=True);p.write_text(json.dumps(data))
print(json.dumps({'output':str(dest),'pages':len(list(dest.rglob('*.html'))),'isolation':'CSP + guard + local-only config + read-only fixtures'}))
