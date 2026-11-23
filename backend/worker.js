import {plan, publicQuote} from './domain.js';
import {handleMembers, isMemberRoute} from './members.js';
import {handleAssistantRoutes} from './assistant.js';
import {handleTtsRoute} from './tts.js';
import {handleTelegramWebhook} from './telegram.js';
import {sendWeeklyMimoReport} from './mimo.js';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export default {async fetch(request,env,ctx) {
 const url=new URL(request.url);
 const origin=request.headers.get('Origin');
 const isOauth=url.pathname.startsWith('/v1/auth/oauth/');
 // Deny browser cross-origin writes unless the exact deployment origin is configured (except OAuth form_post callbacks).
 if (!isOauth && origin && origin!==env.PUBLIC_ORIGIN) return json({error:'Origin denied'},403);
 if (request.method==='OPTIONS') return new Response(null,{status:204,headers:origin===env.PUBLIC_ORIGIN?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Vary':'Origin'}:{}});
 // Membership, coupons, OAuth and partner check-in (backend/members.js), behind the same rate limit.
 if (isMemberRoute(url.pathname)) {
 if (!env.RATE_LIMITER || !(await env.RATE_LIMITER.limit({key:request.headers.get('CF-Connecting-IP')||'unknown'})).success) return json({error:'Rate limited'},429);
 const r=await handleMembers(request,env,url);
 if(origin===env.PUBLIC_ORIGIN) {r.headers.set('Access-Control-Allow-Origin',origin);r.headers.set('Vary','Origin');}
 return r;
 }
 if (url.pathname==='/v1/telegram/webhook') {
 return handleTelegramWebhook(request,env,Date.now(),ctx);
 }
 if (url.pathname==='/v1/assistant' || url.pathname==='/v1/assistant/handoff' || url.pathname==='/v1/assistant/feedback' || url.pathname==='/v1/assistant/transcribe') {
 if (!env.RATE_LIMITER || !(await env.RATE_LIMITER.limit({key:request.headers.get('CF-Connecting-IP')||'unknown'})).success) return json({error:'Rate limited'},429);
 return handleAssistantRoutes(request,env,url,ctx);
 }
 if (url.pathname==='/v1/tts') {
 if (!env.RATE_LIMITER || !(await env.RATE_LIMITER.limit({key:request.headers.get('CF-Connecting-IP')||'unknown'})).success) return json({error:'Rate limited'},429);
 return handleTtsRoute(request,env,url);
 }
 let response;
 try {
 if (request.method!=='POST') return json({error:'Method not allowed'},405);
 // A missing managed rate limiter fails closed, before reading any body.
 if (!env.RATE_LIMITER || !(await env.RATE_LIMITER.limit({key:request.headers.get('CF-Connecting-IP')||'unknown'})).success) return json({error:'Rate limited'},429);
 if (url.pathname==='/v1/requests') {
  const requestJson=(body,status)=>{const result=json(body,status); if(origin){result.headers.set('Access-Control-Allow-Origin',origin);result.headers.set('Vary','Origin')}return result};
  // Explicit deployment gate: no delivery without verified provider credentials and rate limiter.
  if (env.ENABLE_EMAIL_REQUESTS !== 'true' || !env.RESEND_API_KEY || !env.REQUEST_FROM_EMAIL || !env.TURNSTILE_SECRET) return requestJson({error:'Email requests are not configured'},503);
  if (!request.headers.get('Content-Type')?.startsWith('application/json')) return requestJson({error:'JSON required'},415);
  let raw = '';
  const reader = request.body?.getReader();
  if (reader) {
    const decoder = new TextDecoder(); let size = 0;
    while (true) { const {done,value} = await reader.read(); if (done) break;
      size += value.byteLength; if (size > 65536) { await reader.cancel(); return requestJson({error:'Payload too large'},413); }
      raw += decoder.decode(value,{stream:true});
    }
    raw += decoder.decode();
  }
  let b; try { b = JSON.parse(raw); } catch { return requestJson({error:'Invalid JSON'},400); }
  const validText = (v,max) => typeof v === 'string' && v.trim().length > 0 && v.length <= max;
  if (!b || !validText(b.reference,80) || !/^[A-Za-z0-9_-]+$/.test(b.reference) ||
      !validText(b.name,120) || !validText(b.phone,40) || !validText(b.service,160) ||
      !validText(b.date,20) || !/^\d{4}-\d{2}-\d{2}$/.test(b.date) ||
      !Number.isInteger(b.guests) || b.guests < 1 || b.guests > 30 ||
      !validText(b.message,12000) || !validText(b.turnstileToken,2048) ||
      b.consent !== true || !['transfer','tour','hammam'].includes(b.kind) ||
      // Every kind needs the guest's email: it becomes Reply-To, otherwise replies would go to the no-inbox sender.
      !validText(b.email,160) || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(b.email.trim())) return requestJson({error:'Invalid request'},400);
  const verification = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', {
    method:'POST', body:new URLSearchParams({secret:env.TURNSTILE_SECRET,response:b.turnstileToken,remoteip:request.headers.get('CF-Connecting-IP') || ''})
  });
  if (!verification.ok || !(await verification.json()).success) return requestJson({error:'Bot verification failed'},403);
  const subject = 'Bosphorly ' + b.kind + ' inquiry · ' + b.reference;
  const replyTo = b.email.trim();
  const content = [subject,'Service: '+b.service,'Date: '+b.date,'Guests: '+b.guests,'Name: '+b.name,'Phone: '+b.phone,
    'Email: '+replyTo, '', b.message].filter(Boolean).join('\n');
  const delivered = await fetch('https://api.resend.com/emails', {
    method:'POST', headers:{Authorization:'Bearer '+env.RESEND_API_KEY,'Content-Type':'application/json','Idempotency-Key':b.reference},
    body:JSON.stringify({from:env.REQUEST_FROM_EMAIL,to:['info@bosphorly.com'],subject,text:content,reply_to:replyTo})
  });
  if (!delivered.ok) return requestJson({error:'Email delivery provider rejected request'},502);
  const result = await delivered.json();
  return requestJson({accepted:true,reference:b.reference,providerId:result.id},202);
}
 if (!['/v1/quotes','/v1/admin/providers/verify','/v1/admin/prices'].includes(url.pathname)) return json({error:'Not found'},404);
 const admin=url.pathname.startsWith('/v1/admin/');
 if (admin && (!env.ADMIN_TOKEN || request.headers.get('Authorization')!==`Bearer ${env.ADMIN_TOKEN}`)) return json({error:'Unauthorized'},401);
 if (!request.headers.get('Content-Type')?.startsWith('application/json')) return json({error:'JSON required'},415);
 const reader=request.body?.getReader();
 let raw=''; let size=0; const decoder=new TextDecoder();
 if(reader) while(true) {
 const {done,value}=await reader.read(); if(done) break;
 size+=value.byteLength;
 if(size>4096) {await reader.cancel();return json({error:'Payload too large'},413);}
 raw+=decoder.decode(value,{stream:true});
 }
 raw+=decoder.decode();
 if (new TextEncoder().encode(raw).length>4096) return json({error:'Payload too large'},413);
 const body=JSON.parse(raw);
 if (url.pathname==='/v1/quotes') {
 const p=plan(body);
 const row=await env.DB.prepare(`SELECT ap.unit_minor, ap.currency FROM approved_prices ap JOIN experiences e ON e.id=ap.experience_id JOIN providers pr ON pr.id=e.provider_id JOIN availability a ON a.experience_id=e.id WHERE e.id=? AND pr.status='verified' AND pr.currency=ap.currency AND ap.valid_from<=? AND ap.valid_until>=? AND a.service_date=? AND a.remaining>=? AND julianday(a.verified_until)>julianday('now') ORDER BY ap.created_at DESC, ap.id DESC LIMIT 1`).bind(p.experienceId,p.date,p.date,p.date,p.guests).first();
 response=json(publicQuote(row,p.guests));
 } else {
 const fields=url.pathname.endsWith('/verify')?['id','licenseReference','sourceReference']:['id','experienceId','currency','unitMinor','validFrom','validUntil','sourceReference'];
 if (!body || Object.keys(body).length!==fields.length || fields.some(k=>!(k in body)) || fields.some(k=>k!=='unitMinor'&&(typeof body[k]!=='string'||!body[k].trim()||body[k].length>200))) return json({error:'Invalid admin record'},400);
 let stmt;
 if (url.pathname.endsWith('/verify')) stmt=env.DB.prepare("UPDATE providers SET status='verified', license_reference=?, source_reference=?, verified_by='admin', verified_at=CURRENT_TIMESTAMP WHERE id=?").bind(body.licenseReference,body.sourceReference,body.id);
 else {
 if (!Number.isSafeInteger(body.unitMinor)||body.unitMinor<0||!['TRY','EUR','USD','GBP'].includes(body.currency)||![body.validFrom,body.validUntil].every(d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d))&&new Date(d).toISOString().slice(0,10)===d)||body.validFrom>=body.validUntil) return json({error:'Invalid rate'},400);
 stmt=env.DB.prepare(`INSERT INTO approved_prices(id,experience_id,currency,unit_minor,valid_from,valid_until,approved_by,source_reference) SELECT ?,e.id,?,?,?,?, 'admin',? FROM experiences e JOIN providers p ON p.id=e.provider_id WHERE e.id=? AND p.status='verified' AND p.currency=?`).bind(body.id,body.currency,body.unitMinor,body.validFrom,body.validUntil,body.sourceReference,body.experienceId,body.currency);
 }
 // Mutation and PII-free audit event commit atomically.
 const results=await env.DB.batch([stmt,env.DB.prepare("INSERT INTO booking_events(id,idempotency_key,actor_id,evidence_reference) VALUES(?,?,'admin',?)").bind(crypto.randomUUID(),crypto.randomUUID(),url.pathname)]);
 response=json({updated:results[0].meta.changes});
 }
 } catch {response=json({error:'Invalid request or unavailable service'},400);}
 if(origin) {response.headers.set('Access-Control-Allow-Origin',origin);response.headers.set('Vary','Origin');}
 return response;
},
async scheduled(_event, env, ctx) {
 const job = sendWeeklyMimoReport(env);
 if (ctx && typeof ctx.waitUntil === 'function') ctx.waitUntil(job);
 else await job;
}
};
