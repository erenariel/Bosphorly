// Shared inquiry delivery for website forms and authenticated messaging channels.
export function deliverInquiryEmail(env, {reference, kind, text, email}) {
  return fetch('https://api.resend.com/emails', {
    method:'POST', signal:AbortSignal.timeout(5000),
    headers:{Authorization:`Bearer ${env.RESEND_API_KEY}`,'Content-Type':'application/json','Idempotency-Key':reference},
    body:JSON.stringify({from:env.REQUEST_FROM_EMAIL,to:['info@bosphorly.com'],subject:`Bosphorly ${kind} inquiry · ${reference}`,text,...(email?{reply_to:email}:{})})
  });
}
