import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const source = readFileSync(new URL('../site-analytics.js', import.meta.url), 'utf8');
const delivery = readFileSync(new URL('../transfer-delivery.js', import.meta.url), 'utf8');
const key = 'bosphorly.analytics.preference.v2';
const legacy = 'bosphorly.analytics.preference';

function boot(initial = {}) {
  const storage = new Map(Object.entries(initial));
  const scripts = [], listeners = {}, cookies = [];
  const make = () => ({children:[],style:{},append(...items){this.children.push(...items);},setAttribute(){},focus(){}});
  const body = make(), footer = make();
  const document = {
    readyState:'complete', documentElement:{lang:'en'}, body,
    head:{append(tag){scripts.push(tag.src);}},
    referrer:'https://example.org/private?email=redacted',
    createElement:make, querySelector:()=>footer,
    get cookie(){return '_ga=abc; _gcl_aw=def; unrelated=keep';},
    set cookie(v){cookies.push(v);}
  };
  let reloads = 0;
  const window = {addEventListener(name, callback){listeners[name]=callback;}};
  const localStorage = {getItem:k=>storage.get(k)??null,setItem:(k,v)=>storage.set(k,v),removeItem:k=>storage.delete(k)};
  const location = {origin:'https://bosphorly.com',hostname:'bosphorly.com',pathname:'/booking.html',reload(){reloads++;}};
  const context = vm.createContext({window,document,localStorage,location,URL,MutationObserver:class{observe(){}}});
  vm.runInContext(source, context);
  const layer = () => JSON.parse(JSON.stringify(window.dataLayer || []));
  const panel = body.children[0];
  return {window,scripts,storage,cookies,layer,panel,listeners,click(i){panel.children[i].onclick();},reloads:()=>reloads};
}

test('no consent: no Google scripts or conversion signals',()=>{
  const b=boot(); b.window.BosphorlyMeasurement.acceptedRequest();
  assert.deepEqual(b.scripts,[]);assert.deepEqual(b.layer(),[]);
  assert.equal(b.panel.hidden,false);
});
test('saved refusal stays off',()=>{
  const b=boot({[key]:'no'});b.window.BosphorlyMeasurement.acceptedRequest();
  assert.equal(b.panel.hidden,true);assert.deepEqual(b.scripts,[]);assert.deepEqual(b.layer(),[]);
});
test('legacy yes grants analytics only, never ads',()=>{
  const b=boot({[legacy]:'yes'});
  assert.deepEqual(b.scripts,['https://www.googletagmanager.com/gtag/js?id=G-YGVBPKGXRR']);
  const update=b.layer().find(x=>x[0]==='consent'&&x[1]==='update');
  assert.equal(update[2].ad_storage,'denied');assert.equal(update[2].ad_user_data,'denied');
  assert.equal(b.panel.hidden,false);
});
test('legacy refusal does not trigger new tracking',()=>{
  const b=boot({[legacy]:'no'});assert.deepEqual(b.scripts,[]);assert.equal(b.panel.hidden,true);
});
test('analytics only: one loader and one GA4 lead without personal fields',()=>{
  const b=boot({[key]:'analytics'});b.window.BosphorlyMeasurement.acceptedRequest();
  assert.equal(b.scripts.length,1);
  assert.deepEqual(b.layer().filter(x=>x[0]==='event'),[{0:'event',1:'generate_lead',2:{send_to:'G-YGVBPKGXRR'}}]);
  assert.equal(b.layer().some(x=>x.event==='bosphorly_booking_request_accepted'),false);
});
test('explicit combined permission: GTM only, no direct GA4 duplicate',()=>{
  const b=boot();b.click(3);b.window.BosphorlyMeasurement.acceptedRequest();
  assert.equal(b.storage.get(key),'both');
  assert.deepEqual(b.scripts,['https://www.googletagmanager.com/gtm.js?id=GTM-WCTCCKD3']);
  const l=b.layer(),update=l.find(x=>x[0]==='consent'&&x[1]==='update');
  assert.equal(update[2].ad_storage,'granted');assert.equal(update[2].ad_personalization,'denied');
  assert.deepEqual(l.filter(x=>x.event==='bosphorly_booking_request_accepted'),[{event:'bosphorly_booking_request_accepted'}]);
  assert.equal(l.some(x=>x[0]==='config'),false);
  assert.equal(l.some(x=>x[0]==='set'&&x[1]==='page_location'&&x[2]==='https://bosphorly.com/booking.html'),true);
});
test('withdrawal disables events, clears tracking cookies, and reloads',()=>{
  const b=boot({[key]:'both'});b.click(4);b.window.BosphorlyMeasurement.acceptedRequest();
  assert.equal(b.storage.get(key),'no');assert.equal(b.reloads(),1);
  assert.equal(b.window['ga-disable-G-YGVBPKGXRR'],true);
  assert.equal(b.layer().some(x=>x.event==='bosphorly_booking_request_accepted'),false);
  assert.ok(b.cookies.some(x=>x.startsWith('_gcl_aw=')));
  assert.equal(b.cookies.some(x=>x.startsWith('unrelated=')),false);
});
test('switching from analytics to both never loads a second script on same page',()=>{
  const b=boot({[key]:'analytics'});b.click(3);
  assert.equal(b.reloads(),1);assert.equal(b.scripts.length,1);assert.equal(b.storage.get(key),'both');
});
test('accepted request hook follows successful HTTP 202 check and passes no payload',()=>{
  const check=delivery.indexOf("if (response.status !== 202 || !(await response.json()).accepted) throw new Error();");
  const hook=delivery.indexOf('window.BosphorlyMeasurement?.acceptedRequest()');
  assert.ok(check>=0 && hook>check);
  assert.equal(delivery.match(/BosphorlyMeasurement\?\.acceptedRequest\(/g)?.length,1);
  assert.ok(hook<delivery.indexOf('} catch {\n      button.disabled = false',hook));
});
