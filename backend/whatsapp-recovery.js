// Service-error copy is separate from catalog/grounding fallbacks. No AI call is needed.
const messages={
 tr:'Şu an yoğunum, birazdan tekrar dener misin? Acil destek: info@bosphorly.com',
 en:'I am busy right now. Please try again shortly. For urgent help: info@bosphorly.com',
 ru:'Сейчас я занят. Пожалуйста, попробуйте чуть позже. Срочная помощь: info@bosphorly.com',
 he:'אני עמוס כרגע. אפשר לנסות שוב בעוד רגע. לעזרה דחופה: info@bosphorly.com',
 zh:'我现在有些忙，请稍后再试。紧急帮助：info@bosphorly.com',
 uk:'Зараз я зайнятий. Спробуйте трохи пізніше. Термінова допомога: info@bosphorly.com',
 ar:'أنا مشغول الآن، يرجى المحاولة بعد قليل. للمساعدة العاجلة: info@bosphorly.com',
 fa:'اکنون مشغولم، لطفاً کمی بعد دوباره تلاش کنید. کمک فوری: info@bosphorly.com',
 de:'Ich bin gerade ausgelastet. Bitte versuche es gleich erneut. Dringende Hilfe: info@bosphorly.com',
 fr:'Je suis occupé pour le moment. Réessayez dans un instant. Aide urgente : info@bosphorly.com',
 nl:'Ik ben nu druk. Probeer het zo nog eens. Dringende hulp: info@bosphorly.com',
 es:'Ahora estoy ocupado. Inténtalo de nuevo en un momento. Ayuda urgente: info@bosphorly.com',
 it:'Al momento sono occupato. Riprova tra poco. Assistenza urgente: info@bosphorly.com',
 pt:'Estou ocupado agora. Tente novamente em breve. Ajuda urgente: info@bosphorly.com',
 az:'Hazırda məşğulam, bir az sonra yenidən cəhd edin. Təcili yardım: info@bosphorly.com',
 bs:'Trenutno sam zauzet. Pokušajte ponovo uskoro. Hitna pomoć: info@bosphorly.com',
 hr:'Trenutno sam zauzet. Pokušajte ponovno uskoro. Hitna pomoć: info@bosphorly.com',
 hu:'Most elfoglalt vagyok. Kérlek, próbáld újra hamarosan. Sürgős segítség: info@bosphorly.com',
 hi:'अभी मैं व्यस्त हूँ। कृपया थोड़ी देर में फिर कोशिश करें। तुरंत सहायता: info@bosphorly.com',
 bn:'আমি এখন ব্যস্ত। একটু পরে আবার চেষ্টা করুন। জরুরি সহায়তা: info@bosphorly.com',
 id:'Saya sedang sibuk. Silakan coba lagi sebentar. Bantuan mendesak: info@bosphorly.com',
 ja:'ただいま混み合っています。少し待ってからお試しください。お急ぎの場合：info@bosphorly.com',
 ko:'지금은 바쁩니다. 잠시 후 다시 시도해 주세요. 긴급 도움: info@bosphorly.com'
};
export const whatsappFailureReply=lang=>messages[lang]||messages.en;
export function whatsappErrorCode(error){
 const message=String(error?.message||'');
 if(/^(ai_timeout|conversation_busy|empty_model_reply|request_email_failed|notification_failed|send_failed_\d{3})$/.test(message))return message;
 if(/SQLITE|D1_|no such (?:table|column)|database/i.test(message))return 'database_error';
 return 'background_processing_failed';
}
