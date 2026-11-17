import {plan, publicQuote} from './domain.js';
import {handleMembers, isMemberRoute} from './members.js';
const json=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'}});
export default {async fetch(request,env) {
 const url=new URL(request.url);
 // Deny browser cross-origin writes unless the exact deployment origin is configured.
 const origin=request.headers.get('Origin');
 if (origin && origin!==env.PUBLIC_ORIGIN) return json({error:'Origin denied'},403);
 if (request.method==='OPTIONS') return new Response(null,{status:204,headers:origin?{'Access-Control-Allow-Origin':origin,'Access-Control-Allow-Methods':'GET, POST, OPTIONS','Access-Control-Allow-Headers':'Content-Type, Authorization','Vary':'Origin'}:{}});
 // Membership, coupons and partner check-in (backend/members.js), behind the same origin check and rate limit.
 if (isMemberRoute(url.pathname)) {
 if (!env.RATE_LIMITER || !(await env.RATE_LIMITER.limit({key:request.headers.get('CF-Connecting-IP')||'unknown'})).success) return json({error:'Rate limited'},429);
 const r=await handleMembers(request,env,url);
 if(origin) {r.headers.set('Access-Control-Allow-Origin',origin);r.headers.set('Vary','Origin');}
 return r;
 }
 let response;
 try {
 if (request.method!=='POST') return json({error:'Method not allowed'},405);
 // A missing managed rate limiter fails closed, before reading any body.
 if (!env.RATE_LIMITER || !(await env.RATE_LIMITER.limit({key:request.headers.get('CF-Connecting-IP')||'unknown'})).success) return json({error:'Rate limited'},429);
 if (url.pathname==='/v1/requests') return json({error:'Booking requests disabled pending separate launch approval; no data stored'},503);
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
}};
