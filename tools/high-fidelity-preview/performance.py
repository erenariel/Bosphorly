from playwright.sync_api import sync_playwright
from pathlib import Path
from urllib.parse import urlparse,unquote
import mimetypes,json,statistics
roots={'before':Path('/workspace/reference-bosphorly'),'after':Path(__file__).resolve().parents[2]};rows=[]
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 for iteration in range(5):
  for name in (['before','after'] if iteration%2==0 else ['after','before']):
   r=roots[name];c=b.new_context(viewport={'width':1440,'height':900},reduced_motion='reduce')
   def serve(route):
    if not route.request.url.startswith('http://brand-review.test'):return route.abort()
    f=r/unquote(urlparse(route.request.url).path).lstrip('/')
    if f.is_dir():f=f/'index.html'
    if f.is_file():return route.fulfill(path=str(f),content_type=mimetypes.guess_type(str(f))[0] or 'application/octet-stream')
    return route.fulfill(status=404,body='Not found')
   c.route('**/*',serve)
   for path in ['index.html','prices.html','extranet/index.html']:
    page=c.new_page();page.add_init_script("window.__cls=0;new PerformanceObserver(list=>{for(const e of list.getEntries())if(!e.hadRecentInput)window.__cls+=e.value;}).observe({type:'layout-shift',buffered:true});")
    page.goto('http://brand-review.test/'+path,wait_until='load');page.wait_for_timeout(400)
    rows.append({'version':name,'iteration':iteration,'path':path,**page.evaluate('''()=>({dcl:performance.getEntriesByType('navigation')[0].domContentLoadedEventEnd,load:performance.getEntriesByType('navigation')[0].loadEventEnd,cls:window.__cls,requests:performance.getEntriesByType('resource').length})''')});page.close()
   c.close()
 b.close()
summary=[]
for path in ['index.html','prices.html','extranet/index.html']:
 summary.append({'path':path,**{name:{k:round(statistics.median(x[k] for x in rows if x['version']==name and x['path']==path),3) for k in ['dcl','load','cls','requests']} for name in roots}})
result={'method':'Same Chromium, 1440x900, 5 alternating runs per version, local file responses, external requests aborted. Local diagnostic; not production Core Web Vitals.','summary':summary,'runs':rows}
Path('/workspace/high-fidelity-evidence/performance.json').write_text(json.dumps(result,indent=2));print(json.dumps(summary))
