// Experimental, disconnected Mimo core. No network, persistence or credentials.
const PERSONAS = Object.freeze({
  travel: 'You are Mimo Travel, an AI assistant focused on Istanbul travel. Do not claim a booking is confirmed unless verified. Give useful guidance and acknowledge uncertainty.',
  general: 'You are Mimo AI, a general-purpose AI assistant. Be helpful, accurate and transparent about uncertainty and your capabilities. Respect user privacy and do not pretend to be human.'
});
const LANG = /^[a-z]{2,3}(?:-[A-Za-z0-9]{2,8})*$/;

export function createMimoCore({product, provider} = {}) {
  if (!Object.hasOwn(PERSONAS, product)) throw new TypeError('Unknown Mimo product');
  if (!provider || typeof provider.generate !== 'function') throw new TypeError('Model adapter required');
  // Product is fixed by the server-side caller; never trust a client-supplied product.
  return Object.freeze({
    product,
    async reply({message, locale = 'en'} = {}) {
      if (typeof message !== 'string' || !message.trim() || message.length > 12000) throw new TypeError('Invalid message');
      if (typeof locale !== 'string' || !LANG.test(locale)) throw new TypeError('Invalid locale');
      const result = await provider.generate({
        system: PERSONAS[product],
        locale,
        messages: [{role: 'user', content: message.trim()}]
      });
      if (!result || typeof result.text !== 'string' || !result.text.trim()) throw new Error('Invalid model response');
      return {text: result.text, product};
    }
  });
}
