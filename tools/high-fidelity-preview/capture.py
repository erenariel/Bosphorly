from playwright.sync_api import sync_playwright
from pathlib import Path
from urllib.parse import urlparse,unquote
import mimetypes,json,sys
r=Path(__file__).resolve().parents[2];out=Path(__file__).resolve().parents[3]/'high-fidelity-evidence';rows=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for w,h in [(1920,1080),(1440,900),(1280,800),(430,932),(390,844),(375,667)]:
  c=b.new_context(viewport={'width':w,'height':h},reduced_motion='reduce',locale='tr-TR',color_scheme='light')
  def route(q):
   if not q.request.url.startswith('http://hf-review.test'):return q.abort()
   f=r/unquote(urlparse(q.request.url).path).lstrip('/')
   if f.is_dir():f=f/'index.html'
   if f.is_file():return q.fulfill(path=str(f),content_type=mimetypes.guess_type(str(f))[0] or 'application/octet-stream')
   return q.fulfill(status=404,body='Not found')
  c.route('**/*',route);page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
  page.goto('http://hf-review.test/?lang=tr',wait_until='networkidle');page.wait_for_timeout(300)
  page.screenshot(path=str(out/f'home-{w}x{h}.png'))
  page.screenshot(path=str(out/f'home-{w}x{h}-full.png'),full_page=True)
  rows.append({'viewport':[w,h],'errors':errors,**page.evaluate('''()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,cardCount:document.querySelectorAll('.tour-card').length,heading:document.querySelector('.hero h1').innerText,controls:document.querySelector('#hfExperience').options.length})''')})
  c.close()
 b.close()
(out/'screenshots.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2));print(json.dumps(rows,ensure_ascii=False))
