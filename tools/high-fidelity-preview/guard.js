/* Loaded first ONLY in generated preview output. No production integration changes. */
(() => {
  'use strict';
  const blocked = () => new Response(JSON.stringify({error:'demo_read_only',message:'Demo: canlı işlem gönderimi kapalıdır.'}),{status:403,headers:{'Content-Type':'application/json'}});
  const originalFetch=window.fetch.bind(window);
  window.fetch = (input,options={}) => {
    const u=new URL(input instanceof Request?input.url:input,location.href);
    const method=(options.method||(input instanceof Request?input.method:'GET')).toUpperCase();
    if(u.origin!==location.origin || !['GET','HEAD'].includes(method))return Promise.resolve(blocked());
    return originalFetch(input,options);
  };
  const open=XMLHttpRequest.prototype.open;
  XMLHttpRequest.prototype.open=function(method,url,...args){
    const u=new URL(url,location.href);
    if(u.origin!==location.origin || !['GET','HEAD'].includes(String(method).toUpperCase()))throw new DOMException('Read-only demo','SecurityError');
    return open.call(this,method,url,...args);
  };
  navigator.sendBeacon=()=>false;
  window.open=()=>null;
  const notice=()=>{
    let n=document.getElementById('previewNotice');
    if(!n){n=document.createElement('div');n.id='previewNotice';n.setAttribute('role','status');n.style.cssText='position:fixed;bottom:14px;inset-inline:14px;z-index:2147483647;padding:14px 18px;background:#122b41;color:#f7f5ef;border:1px solid #329e9a;border-radius:12px;font:14px/1.4 system-ui;pointer-events:none';document.body.append(n);}
    n.textContent='Demo: canlı işlem ve harici yönlendirmeler kapalı / Live actions and external navigation disabled';
    clearTimeout(notice.timer);notice.timer=setTimeout(()=>n.remove(),5000);
  };
  document.addEventListener('submit',e=>{if(e.target?.id==='hfSearchForm')return;e.preventDefault();e.stopImmediatePropagation();notice();},true);
  document.addEventListener('click',e=>{
    const a=e.target.closest?.('a[href]');if(!a)return;
    const u=new URL(a.href,location.href);
    if(u.origin===location.origin)return;
    e.preventDefault();e.stopImmediatePropagation();
    if(['bosphorly.com','www.bosphorly.com'].includes(u.hostname) && /^https?:$/.test(u.protocol) && !u.pathname.startsWith('/__demo_api')){location.assign(u.pathname+u.search+u.hash);return;}
    notice();
  },true);
  document.addEventListener('DOMContentLoaded',()=>{
    document.querySelectorAll('meta[http-equiv="refresh" i]').forEach(e=>e.remove());
  });
})();
