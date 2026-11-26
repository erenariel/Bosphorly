from playwright.sync_api import sync_playwright
from pathlib import Path
import json,statistics,mimetypes
from urllib.parse import urlparse,unquote
r=Path(__file__).resolve().parents[2];out=Path(__file__).resolve().parents[3]/'high-fidelity-evidence'
rows=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for width,theme in [(390,'light'),(390,'dark')]:
  c=b.new_context(viewport={'width':width,'height':900},color_scheme=theme,reduced_motion='reduce')
  def serve(route):
   if not route.request.url.startswith('http://127.0.0.1:8765'):return route.abort()
   f=r/unquote(urlparse(route.request.url).path).lstrip('/')
   if f.is_dir():f=f/'index.html'
   if f.is_file():return route.fulfill(path=str(f),content_type=mimetypes.guess_type(str(f))[0] or 'application/octet-stream')
   return route.fulfill(status=404,body='Not found')
  c.route('**/*',serve)
  paths=['index.html','prices.html','booking.html','account.html','extranet/index.html','en/istanbul-guide.html']
  for path in paths:
   page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)))
   page.goto('http://127.0.0.1:8765/'+path,wait_until='domcontentloaded',timeout=30000);page.wait_for_timeout(180)
   row={'path':path,'width':width,'theme':theme,'errors':errors,**page.evaluate('''() => ({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,dir:document.documentElement.dir,dcl:performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd})''')}
   if path in ['index.html','prices.html','booking.html','account.html','extranet/index.html','en/istanbul-guide.html']:
    page.add_script_tag(path='/workspace/brand-qa-tools/node_modules/axe-core/axe.min.js')
    row['axe']=page.evaluate('''async()=>{const r=await axe.run(document,{runOnly:{type:'tag',values:['wcag2a','wcag2aa','wcag21aa']}});return r.violations.map(v=>({id:v.id,impact:v.impact,nodes:v.nodes.map(n=>({target:n.target,summary:n.failureSummary}))}));}''')
    page.screenshot(path=str(out/f'audit-{theme}-{width}-{path.replace("/","-")}.png'))
   rows.append(row);page.close()
  for lang in []:
   page=c.new_page();errors=[];page.on('pageerror',lambda e:errors.append(str(e)));page.goto('http://127.0.0.1:8765/?lang='+lang,wait_until='domcontentloaded');page.wait_for_timeout(180)
   rows.append({'path':'/?lang='+lang,'width':width,'theme':theme,'errors':errors,**page.evaluate('''()=>({width:innerWidth,scrollWidth:document.documentElement.scrollWidth,dir:document.documentElement.dir,lang:document.documentElement.lang})''')});page.screenshot(path=str(out/f'audit-{theme}-{width}-{lang}.png'));page.close()
  c.close()
 b.close()
(out/'contrast-audit.json').write_text(json.dumps(rows,ensure_ascii=False,indent=2))
print(json.dumps({'checks':len(rows),'overflow':[x for x in rows if x['scrollWidth']>x['width']],'jsErrors':[x for x in rows if x['errors']]}))
