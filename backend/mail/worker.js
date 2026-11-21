import booking from '../worker.js';

// Give the public mail service only the route and bindings needed for inquiries.
export default {
  fetch(request, env) {
    if (new URL(request.url).pathname !== '/v1/requests') {
      return new Response(null, {status:404});
    }
    return booking.fetch(request, env);
  }
};
