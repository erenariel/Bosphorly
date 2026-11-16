import {importJWK,jwtVerify} from 'jose';
export const documents=Object.freeze({terms:'membership-draft-v1',privacy:'privacy-draft-v1',marketing:'marketing-draft-v1'});
export async function authenticateMember(request,env) {
 const token=request.headers.get('Authorization')?.match(/^Bearer ([^\s]+)$/)?.[1];
 if(!token||!env.MEMBER_JWK||!env.MEMBER_ISSUER||!env.MEMBER_AUDIENCE) throw new Error('Unauthorized');
 const jwk=JSON.parse(env.MEMBER_JWK);
 if(jwk.kty!=='RSA'||jwk.d) throw new Error('Public RSA key required');
 const {payload}=await jwtVerify(token,await importJWK(jwk,'RS256'),{algorithms:['RS256'],issuer:env.MEMBER_ISSUER,audience:env.MEMBER_AUDIENCE,requiredClaims:['sub','exp','iat'],maxTokenAge:'15m'});
 if(payload.email_verified!==true||typeof payload.email!=='string'||typeof payload.sub!=='string'||!payload.sub) throw new Error('Verified email required');
 return {issuer:payload.iss,subject:payload.sub,email:payload.email};
}
export function validateMember(body,identity) {
 const fields=['fullName','email','country','termsVersion','privacyVersion','marketingEmail'];
 if(!body||Object.keys(body).length!==fields.length||fields.some(k=>!Object.hasOwn(body,k))) throw new Error('Unexpected fields');
 if(typeof body.fullName!=='string'||body.fullName.trim().length<2||body.fullName.length>120||/[\x00-\x1f\x7f]/.test(body.fullName)) throw new Error('Name required');
 if(typeof body.email!=='string'||body.email.length>254||!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.email)||body.email!==identity.email) throw new Error('Verified email mismatch');
 // ISO country/territory codes, not nationality. No passport or birth date.
 if(!countries.has(body.country)||typeof body.marketingEmail!=='boolean'||body.termsVersion!==documents.terms||body.privacyVersion!==documents.privacy) throw new Error('Invalid country or consent');
 return {fullName:body.fullName.trim(),email:identity.email,country:body.country};
}
const countries=new Set('AD AE AF AG AI AL AM AO AQ AR AS AT AU AW AX AZ BA BB BD BE BF BG BH BI BJ BL BM BN BO BQ BR BS BT BV BW BY BZ CA CC CD CF CG CH CI CK CL CM CN CO CR CU CV CW CX CY CZ DE DJ DK DM DO DZ EC EE EG EH ER ES ET FI FJ FK FM FO FR GA GB GD GE GF GG GH GI GL GM GN GP GQ GR GS GT GU GW GY HK HM HN HR HT HU ID IE IL IM IN IO IQ IR IS IT JE JM JO JP KE KG KH KI KM KN KP KR KW KY KZ LA LB LC LI LK LR LS LT LU LV LY MA MC MD ME MF MG MH MK ML MM MN MO MP MQ MR MS MT MU MV MW MX MY MZ NA NC NE NF NG NI NL NO NP NR NU NZ OM PA PE PF PG PH PK PL PM PN PR PS PT PW PY QA RE RO RS RU RW SA SB SC SD SE SG SH SI SJ SK SL SM SN SO SR SS ST SV SX SY SZ TC TD TF TG TH TJ TK TL TM TN TO TR TT TV TW TZ UA UG UM US UY UZ VA VC VE VG VI VN VU WF WS YE YT ZA ZM ZW'.split(' '));
export async function identityHash(identity) {
 const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify([identity.issuer,identity.subject])));
 return [...new Uint8Array(digest)].map(b=>b.toString(16).padStart(2,'0')).join('');
}
export async function encryptProfile(profile,secret) {
 const bytes=Uint8Array.from(atob(secret),c=>c.charCodeAt(0));
 if(bytes.length!==32) throw new Error('32-byte profile encryption key required');
 const key=await crypto.subtle.importKey('raw',bytes,'AES-GCM',false,['encrypt']);
 const iv=crypto.getRandomValues(new Uint8Array(12));
 const encrypted=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv,additionalData:new TextEncoder().encode('bosphorly-member-v1')},key,new TextEncoder().encode(JSON.stringify(profile))));
 return 'v1.'+btoa(String.fromCharCode(...iv))+'.'+btoa(String.fromCharCode(...encrypted));
}
export async function saveMember(env,identity,body) {
 const profile=validateMember(body,identity);const hash=await identityHash(identity);
 const encrypted=await encryptProfile(profile,env.MEMBER_DATA_KEY);const id=crypto.randomUUID();
 const existing=await env.DB.prepare('SELECT id,status FROM members WHERE identity_hash=?').bind(hash).first();
 if(existing&&existing.status!=='active') throw new Error('Membership unavailable');
 // Identity uniqueness makes retries converge. Conditional updates cannot reactivate suspended/deleted members.
 const statements=[env.DB.prepare(`INSERT INTO members(id,identity_hash,encrypted_profile,marketing_email) VALUES(?,?,?,?) ON CONFLICT(identity_hash) DO UPDATE SET encrypted_profile=excluded.encrypted_profile, marketing_email=excluded.marketing_email, updated_at=CURRENT_TIMESTAMP WHERE members.status='active'`).bind(id,hash,encrypted,Number(body.marketingEmail))];
 for(const [purpose,version,granted] of [['terms',documents.terms,1],['privacy_notice',documents.privacy,1],['marketing_email',documents.marketing,Number(body.marketingEmail)]]) statements.push(env.DB.prepare("INSERT INTO member_consents(id,member_id,purpose,document_version,granted) SELECT ?,id,?,?,? FROM members WHERE identity_hash=? AND status='active'").bind(crypto.randomUUID(),purpose,version,granted,hash));
 await env.DB.batch(statements);
 return {status:'active',emailVerified:true,marketingEmail:body.marketingEmail,discountStatus:'draft_not_applied'};
}
export async function withdrawMarketing(env,identity) {
 const hash=await identityHash(identity);
 await env.DB.batch([
 env.DB.prepare("UPDATE members SET marketing_email=0,updated_at=CURRENT_TIMESTAMP WHERE identity_hash=? AND status='active'").bind(hash),
 env.DB.prepare("INSERT INTO member_consents(id,member_id,purpose,document_version,granted) SELECT ?,id,'marketing_email',?,0 FROM members WHERE identity_hash=? AND status='active'").bind(crypto.randomUUID(),documents.marketing,hash)
 ]);
 return {marketingEmail:false};
}
