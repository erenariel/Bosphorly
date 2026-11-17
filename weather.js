'use strict';
/* Istanbul weather from Open-Meteo (free, no key; CC BY 4.0, attribution shown).
   - BosphorlyWeather.strip(node): 7-day strip for the home page.
   - BosphorlyWeather.forDate(node, isoDate, serviceId): forecast for a chosen request date, with a rain note
     for open-air tours in Istanbul. Forecasts reach 16 days ahead.
   The forecast is fetched once per page and kept in memory only: nothing is written to the browser's storage. */
(() => {
  const URL = 'https://api.open-meteo.com/v1/forecast?latitude=41.0082&longitude=28.9784&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=Europe%2FIstanbul&forecast_days=16';
  const RAIN_NOTE_AT = 60; // % chance of rain
  // [title, sub, today, rain {p}%, forecast for {d}, rain note, too far, source, clear, partly, cloudy, fog, drizzle, rain, snow, storm]
  const T = {
    en: ['Istanbul weather', 'Next 7 days', 'Today', 'Rain {p}%', 'Forecast for {d}:', 'Rain is likely that day. Open-air parts of the tour may be affected; ask the company about its weather policy.', 'The forecast for this date is not available yet (up to 16 days ahead).', 'Forecast: Open-Meteo', 'Clear', 'Partly cloudy', 'Cloudy', 'Fog', 'Drizzle', 'Rain', 'Snow', 'Thunderstorm'],
    tr: ['İstanbul hava durumu', 'Önümüzdeki 7 gün', 'Bugün', 'Yağmur %{p}', '{d} için tahmin:', 'O gün yağmur bekleniyor. Turun açık havadaki kısımları etkilenebilir; firmaya hava koşulları politikasını sor.', 'Bu tarihin tahmini henüz yok (16 gün sonrasına kadar verilir).', 'Tahmin: Open-Meteo', 'Açık', 'Parçalı bulutlu', 'Bulutlu', 'Sis', 'Çisenti', 'Yağmur', 'Kar', 'Gök gürültülü fırtına'],
    ru: ['Погода в Стамбуле', 'Ближайшие 7 дней', 'Сегодня', 'Дождь {p}%', 'Прогноз на {d}:', 'В этот день вероятен дождь. Части тура на открытом воздухе могут измениться; уточните у компании её правила на случай непогоды.', 'Прогноза на эту дату пока нет (он даётся на 16 дней вперёд).', 'Прогноз: Open-Meteo', 'Ясно', 'Переменная облачность', 'Облачно', 'Туман', 'Морось', 'Дождь', 'Снег', 'Гроза'],
    uk: ['Погода в Стамбулі', 'Найближчі 7 днів', 'Сьогодні', 'Дощ {p}%', 'Прогноз на {d}:', 'Того дня ймовірний дощ. Частини туру просто неба можуть змінитися; уточніть у компанії її правила на випадок негоди.', 'Прогнозу на цю дату ще немає (він дається на 16 днів наперед).', 'Прогноз: Open-Meteo', 'Ясно', 'Мінлива хмарність', 'Хмарно', 'Туман', 'Мряка', 'Дощ', 'Сніг', 'Гроза'],
    de: ['Wetter in Istanbul', 'Nächste 7 Tage', 'Heute', 'Regen {p} %', 'Vorhersage für {d}:', 'An diesem Tag ist Regen wahrscheinlich. Programmpunkte im Freien können betroffen sein; fragen Sie den Anbieter nach seinen Regeln bei schlechtem Wetter.', 'Für dieses Datum gibt es noch keine Vorhersage (bis zu 16 Tage im Voraus).', 'Vorhersage: Open-Meteo', 'Klar', 'Teilweise bewölkt', 'Bewölkt', 'Nebel', 'Nieselregen', 'Regen', 'Schnee', 'Gewitter'],
    fr: ['Météo à Istanbul', '7 prochains jours', 'Aujourd’hui', 'Pluie {p} %', 'Prévision pour le {d} :', 'Pluie probable ce jour-là. Les parties en plein air peuvent être touchées ; demandez à l’entreprise sa politique en cas de mauvais temps.', 'La prévision pour cette date n’est pas encore disponible (jusqu’à 16 jours à l’avance).', 'Prévisions : Open-Meteo', 'Dégagé', 'Partiellement nuageux', 'Nuageux', 'Brouillard', 'Bruine', 'Pluie', 'Neige', 'Orage'],
    nl: ['Weer in Istanbul', 'Komende 7 dagen', 'Vandaag', 'Regen {p}%', 'Verwachting voor {d}:', 'Die dag is regen waarschijnlijk. Onderdelen in de open lucht kunnen veranderen; vraag het bedrijf naar het beleid bij slecht weer.', 'De verwachting voor deze datum is er nog niet (tot 16 dagen vooruit).', 'Verwachting: Open-Meteo', 'Helder', 'Half bewolkt', 'Bewolkt', 'Mist', 'Motregen', 'Regen', 'Sneeuw', 'Onweer'],
    ar: ['الطقس في إسطنبول', 'الأيام السبعة القادمة', 'اليوم', 'مطر {p}%', 'توقعات {d}:', 'يُتوقع المطر في ذلك اليوم. قد تتأثر أجزاء الجولة في الهواء الطلق؛ اسأل الشركة عن سياستها في سوء الأحوال الجوية.', 'لا تتوفر توقعات لهذا التاريخ بعد (حتى 16 يومًا مسبقًا).', 'التوقعات: Open-Meteo', 'صافٍ', 'غائم جزئيًا', 'غائم', 'ضباب', 'رذاذ', 'مطر', 'ثلج', 'عاصفة رعدية'],
    he: ['מזג האוויר באיסטנבול', '7 הימים הקרובים', 'היום', 'גשם {p}%', 'תחזית ל-{d}:', 'צפוי גשם באותו יום. חלקי הסיור בחוץ עלולים להיפגע; שאלו את החברה על מדיניות מזג האוויר שלה.', 'התחזית לתאריך הזה עדיין לא זמינה (עד 16 ימים מראש).', 'תחזית: Open-Meteo', 'בהיר', 'מעונן חלקית', 'מעונן', 'ערפל', 'טפטוף', 'גשם', 'שלג', 'סופת רעמים'],
    az: ['İstanbulda hava', 'Növbəti 7 gün', 'Bu gün', 'Yağış {p}%', '{d} üçün proqnoz:', 'Həmin gün yağış gözlənilir. Turun açıq havada olan hissələrinə təsir edə bilər; şirkətdən hava şəraiti qaydalarını soruşun.', 'Bu tarix üçün proqnoz hələ yoxdur (16 gün qabağadək verilir).', 'Proqnoz: Open-Meteo', 'Açıq', 'Qismən buludlu', 'Buludlu', 'Duman', 'Çiskin', 'Yağış', 'Qar', 'Tufan'],
    fa: ['آب‌وهوای استانبول', '۷ روز آینده', 'امروز', 'باران {p}٪', 'پیش‌بینی {d}:', 'آن روز احتمال باران زیاد است. بخش‌های روباز تور ممکن است تحت تأثیر قرار گیرد؛ از شرکت درباره سیاست آب‌وهوایی‌اش بپرسید.', 'پیش‌بینی این تاریخ هنوز در دسترس نیست (تا ۱۶ روز آینده).', 'پیش‌بینی: Open-Meteo', 'صاف', 'نیمه‌ابری', 'ابری', 'مه', 'نم‌نم باران', 'باران', 'برف', 'رعدوبرق'],
    es: ['El tiempo en Estambul', 'Próximos 7 días', 'Hoy', 'Lluvia {p} %', 'Previsión para el {d}:', 'Es probable que llueva ese día. Las partes al aire libre pueden verse afectadas; pregunta a la empresa por su política en caso de mal tiempo.', 'Aún no hay previsión para esta fecha (se da hasta 16 días antes).', 'Previsión: Open-Meteo', 'Despejado', 'Parcialmente nublado', 'Nublado', 'Niebla', 'Llovizna', 'Lluvia', 'Nieve', 'Tormenta'],
    it: ['Meteo a Istanbul', 'Prossimi 7 giorni', 'Oggi', 'Pioggia {p}%', 'Previsioni per il {d}:', 'Quel giorno è probabile la pioggia. Le parti all’aperto del tour potrebbero cambiare; chiedi all’azienda come gestisce il maltempo.', 'Le previsioni per questa data non sono ancora disponibili (fino a 16 giorni prima).', 'Previsioni: Open-Meteo', 'Sereno', 'Parzialmente nuvoloso', 'Nuvoloso', 'Nebbia', 'Pioviggine', 'Pioggia', 'Neve', 'Temporale'],
    pt: ['Tempo em Istambul', 'Próximos 7 dias', 'Hoje', 'Chuva {p}%', 'Previsão para {d}:', 'Há chance de chuva nesse dia. As partes ao ar livre do passeio podem ser afetadas; pergunte à empresa sobre a política para mau tempo.', 'Ainda não há previsão para esta data (até 16 dias antes).', 'Previsão: Open-Meteo', 'Céu limpo', 'Parcialmente nublado', 'Nublado', 'Neblina', 'Garoa', 'Chuva', 'Neve', 'Tempestade']
  };
  const lang = () => {
    const l = (document.documentElement.lang || (window.BosphorlyLang && window.BosphorlyLang.pick()) || 'en').slice(0, 2);
    return T[l] ? l : 'en';
  };
  const tx = () => T[lang()];
  const locale = () => (lang() === 'ar' ? 'ar-u-nu-latn' : lang());
  // WMO weather codes → [icon, label index]
  function kind(code) {
    if (code === 0) return ['☀️', 8];
    if (code <= 2) return ['⛅', 9];
    if (code === 3) return ['☁️', 10];
    if (code === 45 || code === 48) return ['🌫️', 11];
    if (code >= 51 && code <= 57) return ['🌦️', 12];
    if ((code >= 61 && code <= 67) || (code >= 80 && code <= 82)) return ['🌧️', 13];
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return ['🌨️', 14];
    if (code >= 95) return ['⛈️', 15];
    return ['🌤️', 9];
  }

  let pending = null;
  function load() {
    if (pending) return pending;
    pending = (async () => {
      const r = await fetch(URL); if (!r.ok) throw new Error('weather ' + r.status);
      const j = await r.json(); const d = j.daily;
      const data = d.time.map((date, i) => ({ date, code: d.weather_code[i], max: d.temperature_2m_max[i], min: d.temperature_2m_min[i], rain: d.precipitation_probability_max[i] }));
      return data;
    })();
    pending.catch(() => { pending = null; });
    return pending;
  }

  const el = (tag, cls, text) => { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; };
  const deg = v => Math.round(v) + '°';
  const dayName = (iso, i) => (i === 0 ? tx()[2] : new Intl.DateTimeFormat(locale(), { weekday: 'short', timeZone: 'UTC' }).format(new Date(iso + 'T12:00:00Z')));
  const longDate = iso => new Intl.DateTimeFormat(locale(), { weekday: 'long', day: 'numeric', month: 'long', timeZone: 'UTC' }).format(new Date(iso + 'T12:00:00Z'));
  const credit = () => { const a = el('a', 'wx-credit', tx()[7]); a.href = 'https://open-meteo.com/'; a.target = '_blank'; a.rel = 'noopener'; return a; };

  async function strip(node) {
    if (!node) return;
    let days;
    try { days = (await load()).slice(0, 7); } catch { node.hidden = true; return; }
    const draw = () => {
      const x = tx();
      const head = el('div', 'wx-head');
      head.append(el('h2', 'wx-title', x[0]), el('span', 'wx-sub', x[1]));
      const row = el('div', 'wx-row');
      days.forEach((d, i) => {
        const [icon, li] = kind(d.code);
        const c = el('div', 'wx-day'); c.title = x[li];
        c.append(el('span', 'wx-name', dayName(d.date, i)), el('span', 'wx-icon', icon), el('span', 'wx-temp', deg(d.max) + ' / ' + deg(d.min)));
        if (d.rain != null) c.append(el('span', 'wx-rain' + (d.rain >= RAIN_NOTE_AT ? ' wet' : ''), '💧 ' + new Intl.NumberFormat(locale(), { style: 'percent' }).format(d.rain / 100)));
        c.setAttribute('aria-label', dayName(d.date, i) + ': ' + x[li] + ', ' + deg(d.max) + ' / ' + deg(d.min) + (d.rain != null ? ', ' + x[3].replace('{p}', d.rain) : ''));
        row.append(c);
      });
      node.replaceChildren(head, row, credit());
      node.hidden = false;
    };
    draw();
    document.addEventListener('bosphorly:lang', draw);
  }

  // Open-air tours in Istanbul get a rain note. Hammam, transfers and trips outside Istanbul do not.
  const openAirIstanbul = id => !/alaturka|transfer|triple|bursa|sapanca|yalova/.test(id || '');
  async function forDate(node, iso, serviceId) {
    if (!node) return;
    if (!iso) { node.hidden = true; return; }
    let days;
    try { days = await load(); } catch { node.hidden = true; return; }
    const x = tx(); const d = days.find(v => v.date === iso);
    node.replaceChildren(); node.hidden = false;
    if (!d) { node.append(el('span', 'wx-muted', x[6])); return; }
    const [icon, li] = kind(d.code);
    const line = el('span', 'wx-line', x[4].replace('{d}', longDate(iso)) + ' ' + icon + ' ' + x[li] + ' · ' + deg(d.max) + ' / ' + deg(d.min) + (d.rain != null ? ' · ' + x[3].replace('{p}', d.rain) : ''));
    node.append(line);
    if (d.rain != null && d.rain >= RAIN_NOTE_AT && openAirIstanbul(serviceId)) node.append(el('span', 'wx-warn', '☔ ' + x[5]));
    node.append(credit());
  }

  const css = document.createElement('style');
  css.textContent = '.wx{background:#fff;border:1px solid #dfe6f3;border-radius:18px;padding:14px 16px;box-shadow:0 2px 10px #0a17530a}' +
    '.wx-head{display:flex;align-items:baseline;justify-content:space-between;gap:10px;margin-bottom:8px}.wx-title{font-size:17px;margin:0;color:#102956}.wx-sub{font-size:12px;color:#5d6f8a}' +
    '.wx-row{display:flex;gap:8px;overflow-x:auto;scrollbar-width:none;-webkit-overflow-scrolling:touch;padding-bottom:2px}.wx-row::-webkit-scrollbar{display:none}' +
    '.wx-day{flex:1 0 76px;display:flex;flex-direction:column;align-items:center;gap:2px;background:#f4f8fe;border-radius:12px;padding:8px 6px;font-size:12px;color:#34465f}' +
    '.wx-name{font-weight:700;text-transform:capitalize}.wx-icon{font-size:24px;line-height:1.2}.wx-temp{font-weight:800;color:#14213d}.wx-rain{color:#4c6b8f}.wx-rain.wet{color:#0b5ea8;font-weight:800}' +
    '.wx-credit{display:inline-block;margin-top:6px;font-size:11px;color:#5d6f8a}' +
    '.wx-date{display:flex;flex-direction:column;gap:4px;font-size:13px;color:#2c4a6e;background:#f4f8fe;border-radius:10px;padding:8px 10px}.wx-date .wx-credit{margin-top:0}' +
    '.wx-warn{color:#8a4b00;background:#fff4e0;border:1px solid #f0c98a;border-radius:8px;padding:6px 8px}.wx-muted{color:#5d6f8a}';
  document.head.append(css);

  window.BosphorlyWeather = Object.freeze({ strip, forDate, load });
})();
