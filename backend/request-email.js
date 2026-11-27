import {supportRecipients} from './support-requests.js';
// Shared inquiry delivery for website forms and authenticated messaging channels.
export function deliverInquiryEmail(env, {reference, kind, text, email, timeoutMs=5000}) {
  return fetch('https://api.resend.com/emails', {
    method:'POST', signal:AbortSignal.timeout(Math.max(1,Math.floor(timeoutMs))),
    headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':reference},
    body:JSON.stringify({from:env.REQUEST_FROM_EMAIL,to:supportRecipients(env),subject:`Bosphorly ${kind} inquiry · ${reference}`,text,...(email?{reply_to:email}:{})})
  });
}
