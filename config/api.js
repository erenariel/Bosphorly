// Address of the Bosphorly API (backend/worker.js on Cloudflare Workers), e.g. "https://api.bosphorly.com".
// Leave empty until the API is deployed: membership and coupons then show as "coming soon" and the site
// keeps working with device-only requests.
window.BOSPHORLY_API = Object.freeze({ base: '', turnstileSiteKey: '' });
