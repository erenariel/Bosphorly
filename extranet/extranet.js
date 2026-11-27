'use strict';
/* Bosphorly Extranet — Aşama 1: Güvenli Giriş (E-posta kodu veya Passkey), RBAC (Owner/Admin/Staff),
   30 dk Hareketsizlik Koruması, Gösterge Paneli ve Rezervasyon Yönetimi. */
(() => {
  const IDLE_LIMIT_MS = 30 * 60 * 1000;
  const MEMBER_SESSION_KEY = 'bosphorly.session';

  const STATUS_LABELS = {
    new: 'Yeni',
    in_progress: 'İşlemde',
    confirmed: 'Onaylandı',
    completed: 'Tamamlandı',
    cancelled: 'İptal',
  };

  const STATUS_ACTION_LABELS = {
    in_progress: 'İşleme Al →',
    confirmed: 'Onayla ✓',
    completed: 'Tamamlandı İşaretle ★',
    cancelled: 'İptal Et ✕',
  };

  const PAYMENT_LABELS = {
    pending: 'Beklemede',
    paid: 'Ödendi',
    refunded: 'İade Edildi',
  };

  const TIER_LABELS = {
    platinum: '💎 Platinum',
    gold: '🥇 Gold',
    silver: '🥈 Silver',
    guest: 'Misafir',
  };

  const SOURCE_LABELS = {
    web: 'Web',
    whatsapp: 'WhatsApp',
    member: 'Üye Paneli',
    hotel_qr: 'Otel QR',
    telegram: 'Telegram',
    partner: 'Partner',
  };

  const ROLE_LABELS = {
    owner: 'Owner',
    admin: 'Admin',
    staff: 'Staff',
    partner: 'Partner',
  };

  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  };

  const apiBase = () => {
    const apiCfg = window.BOSPHORLY_API || {};
    const cfg = apiCfg.extranetBase || apiCfg.base;
    return String(cfg || '').replace(/\/+$/, '');
  };

  const readMemberBearer = () => {
    try {
      return localStorage.getItem(MEMBER_SESSION_KEY) || '';
    } catch {
      return '';
    }
  };

  const writeMemberBearer = (tok) => {
    try {
      if (tok) localStorage.setItem(MEMBER_SESSION_KEY, tok);
      else localStorage.removeItem(MEMBER_SESSION_KEY);
    } catch {}
  };

  // In-memory security state (never persisted to storage)
  let csrfToken = '';
  let currentUser = null;
  let pendingMemberToken = '';
  let pendingEmail = '';
  let lastActivityMs = Date.now();
  let idleTimerId = null;

  // UI state
  let activeView = 'dashboard';
  let activePeriod = 'today';
  let dashboardCache = null;
  let bookingsState = { page: 1, pageSize: 20, totalPages: 1 };
  let activeDetailUid = null;

  class HttpApiError extends Error {
    constructor(status, message, code) {
      super(message);
      this.status = status;
      this.code = code || null;
    }
  }

  async function memberApi(path, body, bearerOverride = null) {
    const base = apiBase();
    if (!base) throw new HttpApiError(503, 'API adresi (config/api.js) tanımlı değil.');
    const tok = bearerOverride !== null ? bearerOverride : readMemberBearer();
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (tok) headers.Authorization = 'Bearer ' + tok;
    const res = await fetch(base + path, {
      method: body === undefined ? 'GET' : 'POST',
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new HttpApiError(res.status, data.error || 'İstek başarısız.', data.code);
    return data;
  }

  async function extranetApi(path, { method = 'GET', body = undefined, bearer = null, expectBlob = false } = {}) {
    const base = apiBase();
    if (!base) throw new HttpApiError(503, 'API adresi (config/api.js) tanımlı değil.');
    const headers = {};
    if (body !== undefined) headers['Content-Type'] = 'application/json';
    if (bearer) headers.Authorization = 'Bearer ' + bearer;
    if (method !== 'GET' && csrfToken) headers['X-CSRF-Token'] = csrfToken;

    const res = await fetch(base + path, {
      method,
      credentials: 'include',
      headers,
      body: body !== undefined ? JSON.stringify(body) : undefined,
    });

    if (res.status === 401 && currentUser) {
      handleForcedSignOut('Oturumunuz sona erdi veya 30 dakika hareketsizlik süresi doldu. Lütfen yeniden giriş yapın.');
      throw new HttpApiError(401, 'Oturum sona erdi.', 'UNAUTHENTICATED');
    }

    if (expectBlob) {
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        throw new HttpApiError(res.status, errData.error || 'Dışa aktarma başarısız.', errData.code);
      }
      touchActivity();
      return res.blob();
    }

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new HttpApiError(res.status, data.error || 'İşlem gerçekleştirilemedi.', data.code);
    touchActivity();
    return data;
  }

  // --- Alerts & Formatting ---

  function showGateAlert(text, kind = 'err') {
    const box = $('gateAlert');
    if (!text) {
      box.hidden = true;
      box.textContent = '';
      return;
    }
    box.className = `ex-alert ex-alert-${kind}`;
    box.textContent = text;
    box.hidden = false;
  }

  let bannerTimer = null;
  function showBanner(text, kind = 'ok') {
    const box = $('globalBanner');
    if (bannerTimer) clearTimeout(bannerTimer);
    if (!text) {
      box.hidden = true;
      return;
    }
    box.className = `ex-alert ex-alert-${kind}`;
    box.textContent = text;
    box.hidden = false;
    bannerTimer = setTimeout(() => {
      box.hidden = true;
    }, 5500);
  }

  function formatCommissionObj(commObj) {
    if (!commObj || typeof commObj !== 'object') return '€0';
    const symbols = { EUR: '€', TRY: '₺', USD: '$', GBP: '£' };
    const parts = [];
    for (const cur of ['EUR', 'TRY', 'USD', 'GBP']) {
      const minor = Number(commObj[cur] || 0);
      if (minor > 0 || (cur === 'EUR' && parts.length === 0)) {
        const formatted = new Intl.NumberFormat('tr-TR', {
          minimumFractionDigits: minor % 100 === 0 ? 0 : 2,
          maximumFractionDigits: 2,
        }).format(minor / 100);
        if (minor > 0) parts.push(`${symbols[cur]}${formatted}`);
      }
    }
    return parts.length ? parts.join(' · ') : '€0';
  }

  function formatDateTimeTr(sqlTs) {
    if (!sqlTs) return '—';
    try {
      const iso = String(sqlTs).includes('T') ? sqlTs : String(sqlTs).replace(' ', 'T') + 'Z';
      const d = new Date(iso);
      if (Number.isNaN(d.getTime())) return String(sqlTs);
      return new Intl.DateTimeFormat('tr-TR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      }).format(d);
    } catch {
      return String(sqlTs);
    }
  }

  function formatDateTr(isoDateStr) {
    if (!isoDateStr) return '—';
    try {
      const d = new Date(isoDateStr + 'T00:00:00Z');
      if (Number.isNaN(d.getTime())) return isoDateStr;
      return new Intl.DateTimeFormat('tr-TR', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      }).format(d);
    } catch {
      return isoDateStr;
    }
  }

  function looksLikeCardNumber(text) {
    const matches = String(text || '').match(/(?<!\d)(?:\d[ -]*?){13,19}(?!\d)/g);
    if (!matches) return false;
    return matches.some((m) => {
      const d = m.replace(/\D/g, '');
      return d.length >= 13 && d.length <= 19;
    });
  }

  // --- Idle Watchdog (30 minutes) ---

  function touchActivity() {
    lastActivityMs = Date.now();
  }

  function startIdleWatchdog() {
    stopIdleWatchdog();
    lastActivityMs = Date.now();
    idleTimerId = setInterval(() => {
      if (!currentUser) return;
      const remMs = Math.max(0, IDLE_LIMIT_MS - (Date.now() - lastActivityMs));
      const totalSec = Math.ceil(remMs / 1000);
      const mm = String(Math.floor(totalSec / 60)).padStart(2, '0');
      const ss = String(totalSec % 60).padStart(2, '0');
      const timerEl = $('idleCountdown');
      if (timerEl) timerEl.textContent = `${mm}:${ss}`;
      if (remMs <= 0) {
        performLogout('30 dakika hareketsizlik nedeniyle oturumunuz güvenlik gereği kapatıldı.');
      }
    }, 1000);
  }

  function stopIdleWatchdog() {
    if (idleTimerId) {
      clearInterval(idleTimerId);
      idleTimerId = null;
    }
  }

  ['pointerdown', 'keydown'].forEach((evt) => {
    document.addEventListener(
      evt,
      () => {
        if (currentUser) touchActivity();
      },
      { passive: true }
    );
  });

  // --- Gate & Authentication Flows ---

  function setGateStep(stepName, userInfo = null) {
    $('stepSignIn').hidden = stepName !== 'signin';
    $('stepSetupPasskey').hidden = stepName !== 'setup_passkey';
    $('stepVerifyPasskey').hidden = stepName !== 'verify_passkey';

    if (stepName === 'setup_passkey' && userInfo) {
      $('setupUserSummary').textContent = `${userInfo.email} (${ROLE_LABELS[userInfo.role] || userInfo.role})`;
    }
    if (stepName === 'verify_passkey' && userInfo) {
      $('verifyUserSummary').textContent = `${userInfo.email} (${ROLE_LABELS[userInfo.role] || userInfo.role})`;
    }
  }

  function isEmergencyOwner() {
    return Boolean(
      currentUser &&
      currentUser.role === 'owner' &&
      typeof currentUser.email === 'string' &&
      currentUser.email.trim().toLowerCase() === 'info@bosphorly.com'
    );
  }

  function handleForcedSignOut(reasonMsg) {
    csrfToken = '';
    currentUser = null;
    stopIdleWatchdog();
    stopEmergencyTimers();
    const drawer = $('bookingDetailDrawer');
    if (drawer && drawer.open) drawer.close();
    const emgModal = $('emergencyVerifyModal');
    if (emgModal && emgModal.open) emgModal.close();
    if ($('navEmergency')) $('navEmergency').hidden = true;
    if ($('viewEmergency')) $('viewEmergency').hidden = true;
    $('appShell').hidden = true;
    $('gateScreen').hidden = false;
    setGateStep('signin');
    showGateAlert(reasonMsg || 'Lütfen oturum açın.', 'warn');
  }

  async function enterWorkspace(sessionPayload) {
    csrfToken = sessionPayload.csrfToken || '';
    currentUser = sessionPayload.user;
    pendingMemberToken = '';

    $('currentUserName').textContent = currentUser.name || currentUser.email;
    const roleEl = $('currentUserRole');
    roleEl.textContent = ROLE_LABELS[currentUser.role] || currentUser.role;
    roleEl.dataset.role = currentUser.role;

    // CSV export button strictly visible only for owner
    $('btnExportCsv').hidden = currentUser.role !== 'owner';
    if ($('navEmergency')) $('navEmergency').hidden = !isEmergencyOwner();

    $('gateScreen').hidden = true;
    $('appShell').hidden = false;
    startIdleWatchdog();

    const partner=currentUser.role==='partner';
    for(const id of ['navDashboard','navBookings','navMembers','navInbox','navCampaigns','navCatalog','navSettings'])$(id).hidden=partner;
    if(partner){$('navPartners').hidden=false;await switchView('partners');}
    else { $('navCatalog').hidden=!manager();$('navSettings').hidden=!manager();$('navPartners').hidden=!manager();$('navCampaigns').hidden=!manager();await switchView('dashboard'); }
  }

  async function checkMemberExtranetStatus(memberBearer) {
    showGateAlert('');
    try {
      const status = await extranetApi('/v1/extranet/auth/status', {
        method: 'POST',
        body: {},
        bearer: memberBearer,
      });
      pendingMemberToken = memberBearer;
      if (status.step === 'setup_passkey') {
        setGateStep('setup_passkey', status.user);
      } else {
        setGateStep('verify_passkey', status.user);
      }
    } catch (e) {
      showGateAlert(e.message || 'Extranet yetki kontrolü başarısız.', 'err');
    }
  }

  async function runPasskeyEnrollment() {
    const swa = window.SimpleWebAuthnBrowser;
    if (!swa || typeof swa.startRegistration !== 'function') {
      showGateAlert('Tarayıcınız Passkey (WebAuthn) desteklemiyor. Güncel bir tarayıcı kullanın.', 'err');
      return;
    }
    const btn = $('btnEnrollPasskey');
    btn.disabled = true;
    showGateAlert('');
    try {
      const options = await extranetApi('/v1/extranet/passkey/register/options', {
        method: 'POST',
        body: {},
        bearer: pendingMemberToken,
      });
      const attResp = await swa.startRegistration({ optionsJSON: options });
      const verified = await extranetApi('/v1/extranet/passkey/register/verify', {
        method: 'POST',
        body: attResp,
        bearer: pendingMemberToken,
      });
      await enterWorkspace(verified);
    } catch (e) {
      const msg = e && e.name === 'NotAllowedError' ? 'Passkey kurulumu iptal edildi.' : e.message || 'Passkey kurulumu başarısız.';
      showGateAlert(msg, 'err');
    } finally {
      btn.disabled = false;
    }
  }

  async function runPasskeyLogin(memberBearer = null) {
    const swa = window.SimpleWebAuthnBrowser;
    if (!swa || typeof swa.startAuthentication !== 'function') {
      showGateAlert('Tarayıcınız Passkey (WebAuthn) desteklemiyor.', 'err');
      return;
    }
    showGateAlert('');
    const btn1 = $('btnDirectPasskey');
    const btn2 = $('btnStepUpPasskey');
    btn1.disabled = true;
    btn2.disabled = true;
    try {
      const options = await extranetApi('/v1/extranet/passkey/login/options', {
        method: 'POST',
        body: {},
        bearer: memberBearer || undefined,
      });
      const asseResp = await swa.startAuthentication({ optionsJSON: options });
      const verified = await extranetApi('/v1/extranet/passkey/login/verify', {
        method: 'POST',
        body: asseResp,
        bearer: memberBearer || undefined,
      });
      await enterWorkspace(verified);
    } catch (e) {
      if (e && e.code === 'PASSKEY_SETUP_NEEDED' && memberBearer) {
        await checkMemberExtranetStatus(memberBearer);
        return;
      }
      const msg = e && e.name === 'NotAllowedError' ? 'Passkey doğrulaması iptal edildi.' : e.message || 'Passkey ile giriş başarısız.';
      showGateAlert(msg, 'err');
    } finally {
      btn1.disabled = false;
      btn2.disabled = false;
    }
  }

  async function runAdditionalPasskeyEnrollment() {
    const swa = window.SimpleWebAuthnBrowser;
    if (!swa || typeof swa.startRegistration !== 'function') {
      showBanner('Tarayıcınız Passkey (WebAuthn) desteklemiyor.', 'err');
      return;
    }
    const btn = $('btnAddPasskey');
    if (btn) btn.disabled = true;
    try {
      const options = await extranetApi('/v1/extranet/passkeys/add/options', {
        method: 'POST',
        body: {},
      });
      const attResp = await swa.startRegistration({ optionsJSON: options });
      await extranetApi('/v1/extranet/passkeys/add/verify', {
        method: 'POST',
        body: attResp,
      });
      showBanner('Yeni passkey hesabınıza eklendi ve denetim kaydına (audit) işlendi.', 'ok');
    } catch (e) {
      const msg =
        e && e.name === 'NotAllowedError'
          ? 'Yeni passkey kaydı iptal edildi.'
          : e.message || 'Yeni passkey eklenemedi.';
      showBanner(msg, 'err');
    } finally {
      if (btn) btn.disabled = false;
    }
  }

  async function performLogout(customMessage = '') {
    try {
      if (csrfToken) {
        await extranetApi('/v1/extranet/logout', { method: 'POST', body: {} });
      }
    } catch {}
    handleForcedSignOut(customMessage || 'Güvenli çıkış yapıldı.');
    if (!customMessage) showGateAlert('Extranet oturumunuz kapatıldı.', 'ok');
  }

  // --- Navigation & Views ---

  async function loadCatalogue(){
    const host=$('catalogContent');host.replaceChildren();
    try{const data=await extranetApi('/v1/extranet/catalog');const editor=node('section');host.append(button('Yeni tur ekle',()=>edit({id:'',title:'',operator:'Bosphorly',currency:'EUR',price:null,basis:'per_person',details:{},photos:[],active:true,revision:0})),editor);
      function edit(record){editor.replaceChildren(node('h2',record.id?'Turu düzenle: '+record.id:'Yeni tur'));const form=node('form'),id=input('Tur ID','text',record.id),operator=input('Operatör','text',record.operator),price=input('Fiyat (boş: ekip teyidi)','number',record.price??''),currency=input('Para birimi','text',record.currency),duration=input('Süre (EN)','text',record.details.duration||''),active=input('Tur aktif','checkbox');id.field.required=true;id.field.pattern='[a-z0-9-]+';id.field.readOnly=!!record.id;operator.field.required=true;price.field.min=0;price.field.step=.01;active.field.checked=record.active;
        const area=(label,value)=>{const l=node('label',label),field=node('textarea');field.setAttribute('aria-label',label);field.value=value||'';l.append(field);return{label:l,field};};const included=area('Dahil olanlar (EN, her satır bir madde)',(record.details.included||[]).join('\n')),photos=area('Fotoğraflar (her satır HTTPS veya /assets/ adresi)',(record.photos||[]).join('\n'));form.append(id.label,operator.label,price.label,currency.label,duration.label,included.label,photos.label,active.label);
        const variantFields=[];for(const [oi,option]of (record.options||[]).entries())for(const [di,d]of option.durations.entries()){const f=input(option.name+' · '+d.min+' dakika fiyatı','number',d.price);f.field.min=0;f.field.step=.01;variantFields.push({oi,di,field:f.field});form.append(f.label);}
        const translations=[];for(const lang of data.languages){const section=node('details'),title=input(lang.toUpperCase()+' başlık','text',lang==='en'?record.title:record['title_'+lang]||''),summary=area(lang.toUpperCase()+' açıklama',lang==='en'?record.details.summary:record.details[lang]?.summary);if(lang==='en')title.field.required=true;section.append(node('summary',lang.toUpperCase()+' çeviri'),title.label,summary.label);form.append(section);const localDuration=lang==='en'?null:input(lang.toUpperCase()+' süre','text',record.details[lang]?.duration||''),localIncluded=lang==='en'?null:area(lang.toUpperCase()+' dahil olanlar (her satır bir madde)',(record.details[lang]?.included||[]).join('\n'));if(localDuration)section.append(localDuration.label,localIncluded.label);translations.push({lang,title:title.field,summary:summary.field,duration:localDuration?.field,included:localIncluded?.field});}
        const save=node('button','Katalog kaydını kaydet','ex-btn');save.type='submit';form.append(save);form.onsubmit=async e=>{e.preventDefault();save.disabled=true;try{const next=structuredClone(record);Object.assign(next,{id:id.field.value,title:next.title,operator:operator.field.value,price:price.field.value===''?null:Number(price.field.value),currency:currency.field.value.toUpperCase(),photos:photos.field.value.split('\n').map(x=>x.trim()).filter(Boolean)});next.details.duration=duration.field.value;next.details.included=included.field.value.split('\n').map(x=>x.trim()).filter(Boolean);for(const v of variantFields)next.options[v.oi].durations[v.di].price=Number(v.field.value);for(const t of translations){if(t.lang==='en'){next.title=t.title.value;next.details.summary=t.summary.value;}else{next['title_'+t.lang]=t.title.value;next.details[t.lang]={...(next.details[t.lang]||{}),summary:t.summary.value};if(t.duration.value)next.details[t.lang].duration=t.duration.value;else delete next.details[t.lang].duration;if(t.included.value.trim())next.details[t.lang].included=t.included.value.split('\n').filter(Boolean);else delete next.details[t.lang].included;}}await extranetApi('/v1/extranet/catalog/'+next.id,{method:'POST',body:{record:next,active:active.field.checked,revision:record.revision}});await loadCatalogue();}catch(e){alert(e.message);save.disabled=false;}};editor.append(form);editor.scrollIntoView({block:'start'});
      }
      for(const r of data.records){const row=node('section');row.append(node('h2',r.title),node('p',(r.active?'Aktif':'Pasif')+' · '+(r.price===null?'Fiyat teyit edilecek':r.price+' '+r.currency)),node('p','Eksik çeviriler: '+(r.missingTranslations.join(', ')||'Yok')),button('Düzenle: '+r.id,()=>edit(r)));host.append(row);}
    }catch(e){host.append(node('p',e.message));}
  }
  async function loadSettings(){
    const host=$('settingsContent');host.replaceChildren();
    try{const [data,usage]=await Promise.all([extranetApi('/v1/extranet/settings'),extranetApi('/v1/extranet/usage')]);const s=data.settings;
      host.append(node('h2','Kullanım ve tahmini bütçe'),node('p',`Bugün: ${usage.daily.ai_calls||0} AI çağrısı · ${usage.daily.tts_chars||0} TTS karakteri. Bu ay: ${usage.monthly.ai_calls||0} AI çağrısı · ${usage.monthly.tts_chars||0} TTS karakteri.`),node('p',usage.estimatedCostUsd===null?'Maliyet bilinmiyor: sağlayıcı birim fiyatlarını girin.':`Tahmini maliyet $${usage.estimatedCostUsd.toFixed(2)} / $${usage.budgetUsd} hedef`),node('p',usage.warning==='budget_warning'?'Uyarı: aylık hedefin en az %80’ine ulaşıldı.':usage.note));
      if(currentUser.role!=='owner'){host.append(node('p','Limitleri ve ayarları yalnız owner değiştirebilir.'));return;}
      const form=node('form'),fields={};for(const [key,label,value,max] of [['assistantDailyLimit','Mimo operasyonel günlük tavan',s.assistantDailyLimit??data.deploymentCaps.assistant,data.deploymentCaps.assistant],['ttsMonthlyChars','TTS operasyonel aylık karakter tavanı',s.ttsMonthlyChars??data.deploymentCaps.tts,data.deploymentCaps.tts],['monthlyBudgetUsd','Aylık bütçe hedefi (USD)',s.monthlyBudgetUsd??9,10000],['inputUsdPerMillion','AI giriş milyon token fiyatı (USD)',s.inputUsdPerMillion??'',10000],['outputUsdPerMillion','AI çıkış milyon token fiyatı (USD)',s.outputUsdPerMillion??'',10000],['ttsUsdPerMillion','TTS milyon karakter fiyatı (USD)',s.ttsUsdPerMillion??'',10000]]){const f=input(label,'number',value);f.field.min=0;f.field.max=max;f.field.step=key.includes('Limit')||key==='ttsMonthlyChars'?1:.0001;fields[key]=f.field;form.append(f.label);}
      host.append(node('p',`Deployment tavanları: AI ${data.deploymentCaps.assistant}/gün, TTS ${data.deploymentCaps.tts}/ay. Panel bunları yükseltemez; owner ayrıcalıkları korunur.`));
      const url=input('Airalo affiliate HTTPS bağlantısı','url',s.airaloUrl||''),soon=input('eSIM yakında etiketi','checkbox');soon.field.checked=s.esimComingSoon!==false;form.append(url.label,soon.label);const save=node('button','Ayarları kaydet','ex-btn');save.type='submit';form.append(save);form.onsubmit=async e=>{e.preventDefault();try{const payload={airaloUrl:url.field.value,esimComingSoon:soon.field.checked};for(const [key,f]of Object.entries(fields))if(f.value!=='')payload[key]=Number(f.value);await extranetApi('/v1/extranet/settings',{method:'POST',body:payload});await loadSettings();}catch(e){alert(e.message);}};host.append(form);
    }catch(e){host.append(node('p',e.message));}
  }
  async function loadPartners(){
    const host=$('partnerContent');host.replaceChildren();
    try{const own=currentUser.role==='partner';
      if(!own){const data=await extranetApi('/v1/extranet/partners');
        for(const p of data.partners)host.append(node('p',p.name+' · ID: '+p.member_id+' · Komisyon %'+p.commission_bps/100+' · '+(p.active?'Aktif':'Kapalı')));
        const form=node('form'),member=input('Partner üye ID'),provider=input('Partner tedarikçi ID'),name=input('Partner adı'),rate=input('Partner komisyon (%)','number','10'),active=input('Partner hesabı aktif','checkbox');active.field.checked=true;rate.field.min=0;rate.field.max=100;rate.field.step=.01;const save=node('button','Partner hesabını kaydet','ex-btn');save.type='submit';form.append(member.label,provider.label,name.label,rate.label,active.label,save);form.onsubmit=async e=>{e.preventDefault();try{await extranetApi('/v1/extranet/partners',{method:'POST',body:{memberId:member.field.value,providerId:provider.field.value,name:name.field.value,commissionBps:Math.round(Number(rate.field.value)*100),active:active.field.checked}});await loadPartners();}catch(e){alert(e.message);}};host.append(form);
        const assign=node('form'),partner=input('Atanacak partner üye ID'),booking=input('Rezervasyon UID (mr:BOS-... / bk:...)'),submit=node('button','Rezervasyonu partnere ata','ex-btn');submit.type='submit';assign.append(partner.label,booking.label,submit);assign.onsubmit=async e=>{e.preventDefault();try{await extranetApi('/v1/extranet/partners/assign',{method:'POST',body:{memberId:partner.field.value,bookingUid:booking.field.value}});await loadPartners();}catch(e){alert(e.message);}};host.append(assign);
      }
      const data=await extranetApi(own?'/v1/extranet/partner/bookings':'/v1/extranet/partners/bookings');host.append(node('h2',own?'Size atanan rezervasyonlar':'Partner komisyon takibi'));
      for(const b of data.bookings){const card=node('section');card.append(node('h3',b.displayRef+' · '+b.productTitle),node('p',b.serviceDate+' · '+b.guests+' kişi · '+b.bookingStatus),node('p','Komisyon '+b.amount_minor/100+' '+b.currency+' · '+(b.status==='paid'?'Ödendi':b.payable?'Ödenecek':'Turun tamamlanması bekleniyor')));
        if(own&&b.bookingStatus==='confirmed')card.append(button('Turu tamamlandı işaretle',async()=>{if(!confirm('Tur gerçekten tamamlandı mı? Kupon kullanılacak ve kademe hesabına katılacak.'))return;try{await extranetApi('/v1/extranet/partner/bookings/'+encodeURIComponent(b.booking_uid)+'/complete',{method:'POST',body:{confirm:true}});await loadPartners();}catch(e){alert(e.message);}}));
        if(!own&&b.payable&&b.status==='unpaid')card.append(button('Komisyon ödendi kaydet',async()=>{const reference=prompt('Banka/sağlayıcı ödeme referansı (kart verisi yazmayın)');if(!reference||!confirm('Bu ödeme gerçekten yapıldı mı?'))return;try{await extranetApi('/v1/extranet/partners/bookings/'+encodeURIComponent(b.booking_uid)+'/paid',{method:'POST',body:{reference,confirm:true}});await loadPartners();}catch(e){alert(e.message);}}));host.append(card);
      }
    }catch(e){host.append(node('p',e.message));}
  }
  async function loadCampaigns(){
    const host=$('campaignContent');host.replaceChildren();
    try{const data=await extranetApi('/v1/extranet/campaigns');
      for(const c of data.campaigns){const card=node('section');card.append(node('h2',c.id),node('p',`%${c.percent_bps/100} · ${c.valid_days} gün · Verilen: ${c.issued} · Kullanılan: ${c.redeemed}`));
        const form=node('form'),rate=input('Kampanya oranı (%)','number',c.percent_bps/100),days=input('Kampanya süresi (gün)','number',c.valid_days),active=input('Kampanya aktif','checkbox'),why=input('Değişiklik gerekçesi');active.field.checked=!!c.active;rate.field.min=.01;rate.field.max=(data.maxDiscountBps||1000)/100;rate.field.step=.01;days.field.min=1;days.field.max=730;why.field.required=true;const submit=node('button','Owner onayına sun','ex-btn');submit.type='submit';form.append(rate.label,days.label,active.label,why.label,submit);form.onsubmit=async e=>{e.preventDefault();try{await extranetApi('/v1/extranet/campaigns/'+encodeURIComponent(c.id)+'/proposal',{method:'POST',body:{percentBps:Math.round(Number(rate.field.value)*100),validDays:Number(days.field.value),active:active.field.checked,reason:why.field.value}});await loadCampaigns();}catch(e){alert(e.message);}};card.append(form);
        card.append(button('Kampanyadan üyeye kupon üret',async()=>{const memberId=prompt('Üye ID'),reason=prompt('Kupon gerekçesi');if(!memberId||!reason)return;try{const r=await extranetApi('/v1/extranet/campaigns/'+encodeURIComponent(c.id)+'/issue',{method:'POST',body:{memberId,reason}});alert(r.code);await loadCampaigns();}catch(e){alert(e.message);}}));host.append(card);
      }
      host.append(node('h2','Owner onayı bekleyenler'));
      for(const p of data.proposals){const section=node('section');section.append(node('p',p.campaign_id+' · '+p.reason),node('pre','Önce: '+p.old_json+'\nSonra: '+p.new_json));if(currentUser.role==='owner')section.append(button('Kampanya değişikliğini onayla',async()=>{if(!confirm('Gösterilen eski/yeni oranları onaylıyor musunuz? Verilmiş kuponlar değişmeyecek.'))return;try{await extranetApi('/v1/extranet/campaign-proposals/'+p.id+'/approve',{method:'POST',body:{confirm:true}});await loadCampaigns();}catch(e){alert(e.message);}}));host.append(section);}
      const coupons=await extranetApi('/v1/extranet/coupon-management');host.append(node('h2','Son kuponlar'));
      for(const c of coupons.coupons){const row=node('section');row.append(node('p',c.code+' · %'+c.percent_bps/100+' · '+c.status));if(c.status==='issued')row.append(button('Kuponu iptal et',async()=>{const reason=prompt('İptal gerekçesi');if(!reason)return;try{await extranetApi('/v1/extranet/coupon-management/'+c.id+'/revoke',{method:'POST',body:{reason}});await loadCampaigns();}catch(e){alert(e.message);}}));host.append(row);}
    }catch(e){host.append(node('p',e.message));}
  }
  const manager = () => currentUser && ['owner','admin'].includes(currentUser.role);
  function node(tag,text,cls) {const n=document.createElement(tag);if(text)n.textContent=text;if(cls)n.className=cls;return n;}
  function input(labelText,type='text',value='') {const label=node('label',labelText+' '),field=document.createElement('input');field.type=type;field.value=value;field.setAttribute('aria-label',labelText);label.append(field);return {label,field};}
  function button(text,fn){const b=node('button',text,'ex-btn');b.type='button';b.onclick=fn;return b;}
  async function previewAndConfirm(path,body) {
    const result=await extranetApi(path,{method:'POST',body});
    const dialog=document.createElement('dialog'),title=node('h2','İşlemi onayla'),preview=result.preview;
    dialog.append(title);
    const names={count:'Etkilenecek üye sayısı',skipped:'Atlanacak korunan hesap',tier:'Seviye',days:'Gün',reason:'Gerekçe',to:'Alıcı',subject:'Konu',body:'E-posta metni',member:'Üye',message:'İşlem'};
    for(const [key,value] of Object.entries(preview))dialog.append(node('p',(names[key]||key)+': '+(value??'Süresiz')));
    const status=node('p');dialog.append(status);
    const cancel=button('Vazgeç',()=>{dialog.close();dialog.remove();});
    const send=button('Onayla ve uygula',async()=>{
      send.disabled=true;try{await extranetApi('/v1/extranet/actions/'+result.confirmationId+'/confirm',{method:'POST',body:{confirm:true}});dialog.close();dialog.remove();if(activeView==='inbox'){await loadInbox(inboxPage);}else{await loadMembers(memberPage);}}
      catch(error){status.textContent=error.message;send.disabled=false;}
    });dialog.append(cancel,send);document.body.append(dialog);dialog.showModal();
  }
  async function memberDetail(id) {
    const container=$('membersDetail');container.replaceChildren();
    try {
      const data=await extranetApi('/v1/extranet/members/'+encodeURIComponent(id));
      container.append(node('h2',data.name||'Üye'),node('p',data.email+' · '+(data.phone||'')+' · Kayıt: '+data.createdAt+' · Son giriş: '+(data.lastLogin||'Kayıt yok')));
      const show=(title,items,render)=>{container.append(node('h3',title));if(!items.length)container.append(node('p','Kayıt yok.'));for(const item of items)container.append(node('p',render(item)));};
      show('Talepler',data.requests,r=>r.ref+' · '+r.service_date+' · '+r.state);
      show('Kuponlar',data.coupons,r=>r.code+' · %'+r.percent_bps/100+' · '+r.status+' · '+r.expires_at);
      container.append(node('p','Mimo günlük kullanım sayacı: '+(data.mimo?.messagesToday||0)+' · Sayaç günü: '+(data.mimo?.counterDay||'yok')+'. Sohbet içeriği gösterilmez.'));
      if(manager()){
        container.append(button('Kişisel verileri dışa aktar',async()=>{try{const reason=prompt('Veri dışa aktarma talebi gerekçesi');if(!reason)return;const exported=await extranetApi('/v1/extranet/members/'+id+'/data-export',{method:'POST',body:{reason}});const url=URL.createObjectURL(new Blob([JSON.stringify(exported,null,2)],{type:'application/json'}));const a=node('a','İndir');a.href=url;a.download='bosphorly-member-data.json';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);}catch(e){alert(e.message);}}));
        for(const field of ['email','phone'])container.append(button(field==='email'?'Üye e-postasını göster':'Üye telefonunu göster',async()=>{try{const r=await extranetApi('/v1/extranet/members/'+id+'/reveal-pii',{method:'POST',body:{field,reason:'Operasyon için iletişim bilgisi görüntüleme'}});container.append(node('p',r.value||'Kayıt yok'));}catch(e){alert(e.message);}}));
      }
      if(manager()&&data.levels){
        show('Seviye geçmişi',data.history,r=>r.created_at+' · '+r.reason+' · '+JSON.parse(r.new_json).tier);
        if(data.owner){container.append(node('p','İşletme sahibi: Platinum, sınırsız. Bu hesap seviye veya askıya alma işlemleriyle değiştirilemez.'));return;}
        const controls=node('form'),reason=input('İşlem gerekçesi'),suspended=input('Hesap askıda','checkbox'),disabled=input('Otomatik seviye kuralını durdur','checkbox'),limit=input('Mimo günlük mesaj limiti','number',data.controls.mimo_daily_limit??'');
        suspended.field.checked=!!data.controls.suspended;disabled.field.checked=!!data.controls.automatic_disabled;limit.field.min=0;limit.field.max=10000;limit.field.placeholder='Seviyenin varsayılan limiti';
        reason.field.required=true;reason.field.minLength=3;
        controls.append(suspended.label,disabled.label,limit.label,reason.label);
        const save=node('button','Hesap ayarlarını kaydet','ex-btn');save.type='submit';controls.append(save);
        controls.onsubmit=async event=>{event.preventDefault();try{await extranetApi('/v1/extranet/members/'+id+'/controls',{method:'POST',body:{reason:reason.field.value,suspended:suspended.field.checked,automaticDisabled:disabled.field.checked,mimoDailyLimit:limit.field.value===''?null:Number(limit.field.value)}});await memberDetail(id);}catch(e){alert(e.message);}};container.append(controls);
        container.append(button('Tüm oturumları kapat',async()=>{const why=prompt('Oturumları kapatma gerekçesi');if(!why)return;try{await extranetApi('/v1/extranet/members/'+id+'/controls',{method:'POST',body:{reason:why,revokeSessions:true}});alert('Oturumlar kapatıldı.');}catch(e){alert(e.message);}}));
        const coupon=node('form'),percent=input('Kupon indirimi (%)','number','5'),days=input('Kupon geçerlilik günü','number','30'),why=input('Kupon gerekçesi');percent.field.min=1;percent.field.max=10;days.field.min=1;days.field.max=730;why.field.required=true;why.field.minLength=3;const grant=node('button','Kupon tanımla','ex-btn');grant.type='submit';coupon.append(percent.label,days.label,why.label,grant);
        coupon.onsubmit=async event=>{event.preventDefault();try{await extranetApi('/v1/extranet/members/'+id+'/coupon',{method:'POST',body:{percentBps:Math.round(Number(percent.field.value)*100),validDays:Number(days.field.value),reason:why.field.value}});await memberDetail(id);}catch(e){alert(e.message);}};container.append(coupon);
        container.append(button('Seviye bildirim e-postasını önizle',()=>previewAndConfirm('/v1/extranet/members/'+id+'/tier-mail-preview',{lang:prompt('Dil: tr / en / ru','tr')||'tr'}).catch(e=>alert(e.message))));
        if(currentUser.role==='owner')container.append(button('KVKK silme talebini işle',()=>{const why=prompt('Silme talebi gerekçesi');if(why)previewAndConfirm('/v1/extranet/members/'+id+'/delete-preview',{reason:why}).catch(e=>alert(e.message));}));
      }
      container.scrollIntoView({block:'start'});
    }catch(e){container.append(node('p',e.message));}
  }
  let inboxPage=1;
  async function loadInbox(page=1) {
    const list=$('inboxList');list.replaceChildren();
    try{const data=await extranetApi('/v1/extranet/messages?page='+page+'&status='+$('inboxStatus').value+'&source='+$('inboxSource').value+'&channel='+$('inboxChannel').value+'&assignedTo='+$('inboxAssigned').value);inboxPage=data.page;
      $('inboxCount').textContent=data.total+' mesaj · Sayfa '+data.page;
      for(const item of data.messages){const card=node('section',null,'ex-detail-section');card.append(node('h2',item.subject),node('p',item.source+' · '+(item.channel||'web')+' · Atanan: '+(item.assigned_to||'yok')+' · '+item.status+' · '+item.created_at+' · '+(item.email||'')),button('Mesajı aç',()=>openMessage(item.id)));list.append(card);}
      $('inboxPrev').disabled=page<=1;$('inboxNext').disabled=page*20>=data.total;
    }catch(e){list.append(node('p',e.message));}
  }
  async function openMessage(id) {
    const box=$('messageDetail');box.replaceChildren();
    try{const data=await extranetApi('/v1/extranet/messages/'+id);box.append(node('h2',data.subject),node('p',data.email||'E-posta yok'),node('pre',data.body));
      for(const state of [['new','Yeni'],['read','Okundu'],['replied','Yanıtlandı'],['archived','Kapandı']])box.append(button(state[1],async()=>{await extranetApi('/v1/extranet/messages/'+id+'/status',{method:'POST',body:{status:state[0]}});await loadInbox(inboxPage);}));
      const assignment=button('Mesajı bana ata',async()=>{await extranetApi('/v1/extranet/messages/'+id+'/assignment',{method:'POST',body:{memberId:currentUser.id}});await loadInbox(inboxPage);});box.append(assignment);
      for(const note of data.notes)box.append(node('p','İç not: '+note.body));
      for(const reply of data.replies)box.append(node('p','Yanıt ('+reply.status+'): '+reply.subject+' — '+reply.body));
      const note=node('form'),text=input('İç not');text.field.required=true;text.field.maxLength=2000;const add=node('button','Not ekle','ex-btn');add.type='submit';note.append(text.label,add);note.onsubmit=async e=>{e.preventDefault();try{await extranetApi('/v1/extranet/messages/'+id+'/note',{method:'POST',body:{body:text.field.value}});await openMessage(id);}catch(error){alert(error.message);}};box.append(note);
      if(data.email){const templates=await extranetApi('/v1/extranet/reply-templates'),form=node('form'),lang=document.createElement('select');lang.setAttribute('aria-label','Yanıt dili');for(const code of ['tr','en','ru']){const o=node('option',code.toUpperCase());o.value=code;lang.append(o);}
        const subject=input('Yanıt konusu'),body=document.createElement('textarea');body.setAttribute('aria-label','Yanıt metni');body.required=true;body.maxLength=12000;
        const fill=()=>{subject.field.value=templates[lang.value].subject;body.value=templates[lang.value].body;};lang.onchange=fill;fill();const preview=node('button','Yanıtı önizle','ex-btn');preview.type='submit';form.append(lang,subject.label,body,preview);
        form.onsubmit=e=>{e.preventDefault();previewAndConfirm('/v1/extranet/messages/'+id+'/reply-preview',{lang:lang.value,subject:subject.field.value,body:body.value}).catch(error=>alert(error.message));};box.append(form);
      }
      box.scrollIntoView({block:'start'});
    }catch(e){box.append(node('p',e.message));}
  }

  let memberPage = 1;
  let membersBusy = false;
  async function loadMembers(page) {
    if (membersBusy) return;
    membersBusy = true;
    $('membersMessage').textContent = 'Yükleniyor…';
    try {
      const data = await extranetApi('/v1/extranet/members?q='+encodeURIComponent($('memberSearch').value)+'&status='+$('memberStatus').value+'&provider='+$('memberProvider').value+'&tier='+$('memberTierFilter').value+'&page='+Math.max(1,page));
      memberPage = data.page;
      const list = $('membersList'); list.replaceChildren();
      $('memberManagement').hidden=!manager();
      for (const member of data.members) {
        const card = document.createElement('section'); card.className='ex-detail-section';
        const title = document.createElement('h2');title.textContent=member.name+' · '+member.email;card.append(title);
        card.append(button('Üye profili',()=>memberDetail(member.id)));
        if(manager()&&!member.owner){const choice=input('Toplu işlem için seç','checkbox');choice.field.dataset.memberId=member.id;card.append(choice.label);}
        const dates=node('p','Kayıt: '+(member.createdAt||'')+' · Son giriş: '+(member.lastLogin||'Yok')+' · Talep: '+(member.requestCount||0)+' · Giriş: '+(member.methods||[]).join(', '));card.append(dates);
        const info = document.createElement('p');info.textContent=(manager()?'Geçerli: '+(member.owner?'Platinum (işletme sahibi)':member.tier)+' · Otomatik: '+member.automaticTier+' · Tamamlanan tur: '+member.fulfilledCount+' · '+(member.manualTier?'Elle atandı':'Otomatik')+(member.expiresAt?' · Süre sonu: '+member.expiresAt:''):'Üye profili görüntülenebilir.');card.append(info);
        if (!member.owner && ['owner','admin'].includes(currentUser.role)) {
          const form=document.createElement('form');
          const label=document.createElement('label');label.textContent='Üyelik seviyesi ';
          const select=document.createElement('select');select.setAttribute('aria-label','Üyelik seviyesi');
          for (const [value,text] of [['automatic','Otomatik hesaba dön'],['silver','Silver'],['gold','Gold'],['platinum','Platinum']]) {
            const option=document.createElement('option');option.value=value;option.textContent=text;select.append(option);
          }
          select.value=member.manualTier||'automatic';label.append(select);
          const reason=document.createElement('input');reason.placeholder='İşlem gerekçesi';reason.setAttribute('aria-label','İşlem gerekçesi');reason.required=true;reason.minLength=3;reason.maxLength=500;
          const save=document.createElement('button');save.type='submit';save.className='ex-btn';save.textContent='Seviyeyi kaydet';
          const duration=input('Seviye süresi (gün)','number');duration.field.min=1;duration.field.max=730;duration.field.placeholder='Süresiz';
          form.append(label,duration.label,reason,save);card.append(form);
          form.onsubmit=async event=>{
            event.preventDefault();
            if (!confirm(member.name+' için '+select.options[select.selectedIndex].text+' uygulanacak. Onaylıyor musunuz?')) return;
            save.disabled=true;
            try {await extranetApi('/v1/extranet/members/'+encodeURIComponent(member.id)+'/tier',{method:'POST',body:{tier:select.value,reason:reason.value,days:duration.field.value?Number(duration.field.value):null}});await loadMembers(memberPage);}
            catch(error){$('membersMessage').textContent=error.message;} finally {save.disabled=false;}
          };
        }
        list.append(card);
      }
      $('membersPage').textContent=' '+data.page+' / '+Math.max(1,Math.ceil(data.total/data.pageSize))+' ';
      $('membersPrev').disabled=data.page<=1;$('membersNext').disabled=data.page*data.pageSize>=data.total;
      $('membersMessage').textContent=data.total+' üye';
    } catch(error) {$('membersMessage').textContent=error.message;$('membersList').replaceChildren();}
    finally {membersBusy=false;}
  }

  async function switchView(viewName) {
    if (viewName === 'emergency' && !isEmergencyOwner()) {
      viewName = 'dashboard';
    }
    activeView = viewName;
    $('viewCatalog').hidden=viewName!=='catalog';$('viewSettings').hidden=viewName!=='settings';
    if(viewName==='catalog')await loadCatalogue();if(viewName==='settings')await loadSettings();
    $('viewPartners').hidden=viewName!=='partners';
    if(viewName==='partners')await loadPartners();
    $('viewCampaigns').hidden=viewName!=='campaigns';
    if(viewName==='campaigns')await loadCampaigns();
    $('viewDashboard').hidden = viewName !== 'dashboard';
    $('viewBookings').hidden = viewName !== 'bookings';
    $('viewInbox').hidden=viewName!=='inbox';
    $('navInbox').setAttribute('aria-current',viewName==='inbox'?'page':'false');
    $('viewMembers').hidden = viewName !== 'members';
    $('navMembers').setAttribute('aria-current',viewName==='members'?'page':'false');
    $('navDashboard').setAttribute('aria-current', viewName === 'dashboard' ? 'page' : 'false');
    $('navBookings').setAttribute('aria-current', viewName === 'bookings' ? 'page' : 'false');
    if ($('viewEmergency')) $('viewEmergency').hidden = viewName !== 'emergency';
    if ($('navEmergency')) $('navEmergency').setAttribute('aria-current', viewName === 'emergency' ? 'page' : 'false');

    if (viewName === 'dashboard') {
      await loadDashboard();
    } else if (viewName === 'inbox') {
      await loadInbox(1);
    } else if (viewName === 'members') {
      await loadMembers(1);
    } else if (viewName === 'bookings') {
      await loadBookings(1);
    } else if (viewName === 'emergency') {
      await loadEmergencyCenter();
    }
  }

  // --- Acil Durum ve Güvenlik Merkezi (Exclusive Owner + Dual-Account OTP) ---

  const EMG_CHANNEL_DESC = {
    whatsapp: 'Telnyx WhatsApp hattı, sitedeki wa.me bağlantıları ve Mimo WhatsApp yönlendirmeleri.',
    telegram: '@BosphorlyBot normal mesaj işleme akışı ve sitedeki tüm Telegram CTA bağlantıları.',
    instagram: 'Sitedeki bütün kurumsal Instagram bağlantıları ve sosyal medya butonları.',
    mimo: 'Sitedeki Mimo Web AI sohbet penceresi ve doğrudan /v1/assistant web API istekleri (WhatsApp ve Telegram Mimo etkilenmez).',
  };

  const EMG_ACTION_TITLES = {
    close: 'Acil Kanal Kapatma',
    reopen: 'Kanal Yeniden Açma',
    close_all: 'Bütün İletişim Kanallarını Acil Kapatma',
    reopen_all: 'Bütün İletişim Kanallarını Yeniden Açma',
    banner_enable: 'Güvenlik Uyarı Bandını Yayınlama',
    banner_update: 'Güvenlik Uyarı Bandını Güncelleme',
    banner_disable: 'Güvenlik Uyarı Bandını Kapatma',
  };

  let emgStateCache = null;
  let emgModalContext = null;
  let emgCountdownTimer = null;

  function stopEmergencyTimers() {
    if (emgCountdownTimer) {
      clearInterval(emgCountdownTimer);
      emgCountdownTimer = null;
    }
  }

  function showEmgModalAlert(text, kind = 'err') {
    const box = $('emgModalAlert');
    if (!box) return;
    if (!text) {
      box.hidden = true;
      box.textContent = '';
      return;
    }
    box.className = `ex-alert ex-alert-${kind}`;
    box.textContent = text;
    box.hidden = false;
  }

  function startEmergencyCountdown() {
    stopEmergencyTimers();
    const tick = () => {
      if (!emgModalContext) return;
      const now = Date.now();
      const resendBtn = $('btnResendEmgOtp');
      const metaEl = $('emgOtpMeta');
      const cooldownLeft = emgModalContext.cooldownUntilMs
        ? Math.max(0, Math.ceil((emgModalContext.cooldownUntilMs - now) / 1000))
        : 0;
      if (resendBtn) {
        resendBtn.disabled = cooldownLeft > 0;
        resendBtn.textContent = cooldownLeft > 0 ? `Yeni Kod İste (${cooldownLeft} sn)` : 'Yeni Kod İste';
      }
      if (emgModalContext.expiresAtMs && metaEl) {
        const expLeft = Math.max(0, Math.ceil((emgModalContext.expiresAtMs - now) / 1000));
        const mm = String(Math.floor(expLeft / 60)).padStart(2, '0');
        const ss = String(expLeft % 60).padStart(2, '0');
        const dest = emgModalContext.maskedVerifyEmail || 'kayıtlı ikinci doğrulama e-postası';
        metaEl.textContent = `Hedef: ${dest} · İşlem No: ${emgModalContext.operationId} · Kalan süre: ${mm}:${ss}`;
      }
    };
    tick();
    emgCountdownTimer = setInterval(tick, 1000);
  }

  function openEmergencyModal(ctx) {
    if (!isEmergencyOwner()) return;
    emgModalContext = {
      targetChannel: ctx.targetChannel,
      targetLabel: ctx.targetLabel,
      actionType: ctx.actionType,
      bannerText: ctx.bannerText || '',
      bannerPreset: ctx.bannerPreset || '',
      telegramRequestId: ctx.telegramRequestId || null,
      operationId: ctx.operationId || '',
      expiresAtMs: ctx.expiresAtMs || 0,
      cooldownUntilMs: ctx.cooldownRemainingSec ? Date.now() + ctx.cooldownRemainingSec * 1000 : 0,
      maskedVerifyEmail: ctx.maskedVerifyEmail || (emgStateCache?.configStatus?.maskedVerifyEmail || ''),
      reopenText: (ctx.actionType === 'reopen' || ctx.actionType === 'reopen_all') && ctx.operationId ? 'AÇ' : '',
    };

    const modal = $('emergencyVerifyModal');
    $('emgModalTitle').textContent = `${ctx.targetLabel} · ${EMG_ACTION_TITLES[ctx.actionType] || ctx.actionType}`;
    showEmgModalAlert('');

    const isReopen = ctx.actionType === 'reopen' || ctx.actionType === 'reopen_all';
    const destLabel = emgModalContext.maskedVerifyEmail || 'sunucuda kayıtlı ikinci kişisel doğrulama e-postası';
    $('emgModalDesc').textContent = isReopen
      ? ctx.actionType === 'reopen_all'
        ? `Panelden kapatılmış bütün kanalları yeniden etkinleştirmek için aşağıya büyük harflerle "AÇ" yazın ve ${destLabel} adresine gönderilecek tek kullanımlık 6 haneli kodu doğrulayın. Cloudflare ortam değişkeniyle (*_DISABLED=1) kilitlenen kanallar panelden açılamaz ve kapalı kalır.`
        : `${ctx.targetLabel} kanalını yeniden etkinleştirmek için aşağıya büyük harflerle "AÇ" yazın ve ${destLabel} adresine gönderilecek tek kullanımlık 6 haneli kodu doğrulayın.`
      : `${ctx.targetLabel} üzerinde işlem yapmak için ${destLabel} adresine tek kullanımlık 6 haneli doğrulama kodu gönderilecektir. Web sitesi, rezervasyonlar ve diğer açık kanallar etkilenmez.`;

    $('emgReopenAcWrap').hidden = !isReopen;
    $('emgReopenConfirmInput').value = emgModalContext.reopenText;
    $('emgOtpInput').value = '';

    const reqBtn = $('btnRequestEmgCode');
    reqBtn.className = isReopen ? 'ex-btn ex-btn-primary' : 'ex-btn ex-btn-danger';

    if (emgModalContext.operationId) {
      $('emgConfirmForm').hidden = true;
      $('emgVerifyForm').hidden = false;
      startEmergencyCountdown();
    } else {
      stopEmergencyTimers();
      $('emgConfirmForm').hidden = false;
      $('emgVerifyForm').hidden = true;
    }

    if (!modal.open) modal.showModal();
    if (emgModalContext.operationId) $('emgOtpInput').focus();
    else if (isReopen) $('emgReopenConfirmInput').focus();
  }

  function closeEmergencyModal() {
    stopEmergencyTimers();
    emgModalContext = null;
    const modal = $('emergencyVerifyModal');
    if (modal && modal.open) modal.close();
  }

  async function requestEmergencyOtpCode() {
    if (!emgModalContext) return;
    const isReopen = emgModalContext.actionType === 'reopen' || emgModalContext.actionType === 'reopen_all';
    const acVal = $('emgReopenConfirmInput').value.trim();
    if (isReopen && acVal !== 'AÇ') {
      showEmgModalAlert('Yeniden açma işlemini başlatmak için doğrulama alanına tam olarak "AÇ" yazmalısınız.', 'err');
      $('emgReopenConfirmInput').focus();
      return;
    }
    emgModalContext.reopenText = isReopen ? 'AÇ' : '';

    const payload = {
      targetChannel: emgModalContext.targetChannel,
      actionType: emgModalContext.actionType,
      confirmAction: true,
    };
    if (isReopen) payload.confirmReopenText = 'AÇ';
    if (emgModalContext.actionType.startsWith('banner_')) {
      payload.bannerText = emgModalContext.bannerText;
      payload.bannerPreset = emgModalContext.bannerPreset;
    }
    if (emgModalContext.telegramRequestId) {
      payload.telegramRequestId = emgModalContext.telegramRequestId;
    }

    const reqBtn = $('btnRequestEmgCode');
    const resendBtn = $('btnResendEmgOtp');
    reqBtn.disabled = true;
    resendBtn.disabled = true;
    showEmgModalAlert('');
    try {
      const res = await extranetApi('/v1/extranet/emergency/request-code', {
        method: 'POST',
        body: payload,
      });
      emgModalContext.operationId = res.operationId;
      emgModalContext.expiresAtMs = res.expiresAtMs;
      emgModalContext.cooldownUntilMs = Date.now() + Number(res.cooldownSec || 60) * 1000;
      if (res.maskedVerifyEmail) emgModalContext.maskedVerifyEmail = res.maskedVerifyEmail;
      $('emgConfirmForm').hidden = true;
      $('emgVerifyForm').hidden = false;
      $('emgOtpInput').value = '';
      showEmgModalAlert('6 haneli tek kullanımlık doğrulama kodu ikinci e-posta adresinize gönderildi.', 'ok');
      startEmergencyCountdown();
      $('emgOtpInput').focus();
      await loadEmergencyCenter();
    } catch (e) {
      showEmgModalAlert(e.message || 'Doğrulama kodu gönderilemedi.', 'err');
    } finally {
      reqBtn.disabled = false;
    }
  }

  async function submitEmergencyOtpVerification() {
    if (!emgModalContext || !emgModalContext.operationId) return;
    const code = $('emgOtpInput').value.trim();
    if (!/^\d{6}$/.test(code)) {
      showEmgModalAlert('Lütfen e-postanıza gelen 6 haneli sayısal kodu girin.', 'err');
      $('emgOtpInput').focus();
      return;
    }
    const payload = {
      operationId: emgModalContext.operationId,
      code,
      targetChannel: emgModalContext.targetChannel,
      actionType: emgModalContext.actionType,
    };
    if (emgModalContext.actionType === 'reopen' || emgModalContext.actionType === 'reopen_all') {
      payload.confirmReopenText = emgModalContext.reopenText || 'AÇ';
    }

    const btn = $('btnSubmitEmgOtp');
    btn.disabled = true;
    showEmgModalAlert('');
    try {
      await extranetApi('/v1/extranet/emergency/verify', {
        method: 'POST',
        body: payload,
      });
      const label = emgModalContext.targetLabel;
      const actTitle = EMG_ACTION_TITLES[emgModalContext.actionType] || emgModalContext.actionType;
      closeEmergencyModal();
      showBanner(`${label}: ${actTitle} işlemi çift hesap doğrulamasıyla başarıyla uygulandı.`, 'ok');
      await loadEmergencyCenter();
    } catch (e) {
      showEmgModalAlert(e.message || 'Doğrulama kodu onaylanamadı.', 'err');
      await loadEmergencyCenter();
    } finally {
      btn.disabled = false;
    }
  }

  async function abortPendingEmergencyVerification() {
    if (emgModalContext && emgModalContext.operationId) {
      try {
        await extranetApi('/v1/extranet/emergency/cancel-pending', {
          method: 'POST',
          body: { operationId: emgModalContext.operationId },
        });
      } catch {}
    }
    closeEmergencyModal();
    await loadEmergencyCenter();
  }

  function renderEmergencyCenter(data) {
    emgStateCache = data;

    // Toplu yeniden açma: yalnızca env kilidi olmayan en az bir kapalı kanal varsa etkin.
    const reopenAllBtn = $('btnEmergencyReopenAll');
    if (reopenAllBtn) {
      const chs = Array.isArray(data.channels) ? data.channels : [];
      reopenAllBtn.disabled = !chs.some((c) => !c.enabled && !c.envLocked);
    }

    // 1. Config / Notification alert
    const cfgAlert = $('emergencyConfigAlert');
    const cfgWarnings = [];
    if (!data.configStatus?.verifyEmailConfigured) {
      cfgWarnings.push('Sunucuda ikinci doğrulama e-posta adresi (EMERGENCY_VERIFY_EMAIL) henüz tanımlanmamış.');
    }
    if (!data.configStatus?.emailProviderConfigured) {
      cfgWarnings.push('E-posta gönderim sağlayıcısı yapılandırması eksik.');
    }
    if (Number(data.configStatus?.pendingNotifications || 0) > 0) {
      cfgWarnings.push(`${data.configStatus.pendingNotifications} güvenlik bildirim e-postası yeniden gönderim kuyruğunda bekliyor.`);
    }
    if (cfgWarnings.length) {
      cfgAlert.textContent = cfgWarnings.join(' ');
      cfgAlert.hidden = false;
    } else {
      cfgAlert.hidden = true;
      cfgAlert.textContent = '';
    }

    // 2. Pending Telegram requests
    const tgSec = $('emergencyTelegramSection');
    const tgList = $('emergencyTelegramList');
    tgList.replaceChildren();
    const tgReqs = Array.isArray(data.telegramRequests) ? data.telegramRequests : [];
    if (tgReqs.length) {
      tgSec.hidden = false;
      for (const req of tgReqs) {
        const row = el('div', 'emg-tg-req');
        const info = el('div');
        info.append(
          el('strong', '', `Telegram Acil Kapatma Talebi: ${req.label}`),
          el('p', 'emg-meta', `Oluşturulma: ${formatDateTimeTr(new Date(req.createdAtMs).toISOString())}`)
        );
        const completeBtn = el('button', 'ex-btn ex-btn-danger ex-btn-sm', 'Doğrulama Kodu Gönder ve Tamamla');
        completeBtn.type = 'button';
        completeBtn.onclick = () =>
          openEmergencyModal({
            targetChannel: req.targetChannel,
            targetLabel: req.label,
            actionType: req.targetChannel === 'all' ? 'close_all' : 'close',
            telegramRequestId: req.id,
            cooldownRemainingSec: data.cooldownRemainingSec || 0,
            maskedVerifyEmail: data.configStatus?.maskedVerifyEmail || '',
          });
        row.append(info, completeBtn);
        tgList.appendChild(row);
      }
    } else {
      tgSec.hidden = true;
    }

    // 3. 4 Channel Cards
    const grid = $('emergencyChannelsGrid');
    grid.replaceChildren();
    const pendingSessionVerif = data.pendingVerification || null;

    for (const ch of data.channels || []) {
      const card = el('article', 'emg-channel-card');
      card.dataset.channel = ch.id;
      card.dataset.state = ch.pendingVerification ? 'pending' : ch.enabled ? 'open' : 'closed';

      const top = el('div');
      const headRow = el('div', 'emg-card-top');
      headRow.appendChild(el('h2', 'emg-card-title', ch.label));

      const badgeGroup = el('div', 'emg-card-actions');
      const statusBadge = el(
        'span',
        `emg-badge ${ch.enabled ? 'emg-badge-open' : 'emg-badge-closed'}`,
        ch.enabled ? '● Açık' : '● Kapalı'
      );
      badgeGroup.appendChild(statusBadge);
      if (ch.pendingVerification) {
        badgeGroup.appendChild(el('span', 'emg-badge emg-badge-pending', '◐ Doğrulama bekleniyor'));
      }
      headRow.appendChild(badgeGroup);
      top.appendChild(headRow);

      const desc = el('p', 'emg-meta', EMG_CHANNEL_DESC[ch.id] || '');
      desc.style.marginTop = '8px';
      top.appendChild(desc);

      if (ch.envLocked) {
        const lockBox = el('div', 'emg-lock-box');
        lockBox.style.marginTop = '10px';
        lockBox.append(
          el('span', '', '🔒'),
          el('span', '', `${ch.lockWarning} (${ch.envVarName}=1). Bu kilit yönetim panelinden kaldırılamaz.`)
        );
        top.appendChild(lockBox);
      }

      if (ch.updatedAt) {
        const meta = el('p', 'emg-meta', `Son güncelleme: ${formatDateTimeTr(ch.updatedAt)} · ${ch.updatedBy || '—'}`);
        meta.style.marginTop = '8px';
        top.appendChild(meta);
      }

      const actions = el('div', 'emg-card-actions');
      if (ch.enabled) {
        const closeBtn = el('button', 'ex-btn ex-btn-danger ex-btn-sm', 'Acil Kapat');
        closeBtn.type = 'button';
        closeBtn.dataset.emgAction = `close-${ch.id}`;
        closeBtn.disabled = Boolean(ch.envLocked);
        closeBtn.onclick = () =>
          openEmergencyModal({
            targetChannel: ch.id,
            targetLabel: ch.label,
            actionType: 'close',
            cooldownRemainingSec: data.cooldownRemainingSec || 0,
            maskedVerifyEmail: data.configStatus?.maskedVerifyEmail || '',
          });
        actions.appendChild(closeBtn);
      } else {
        const reopenBtn = el('button', 'ex-btn ex-btn-primary ex-btn-sm', 'Yeniden Aç');
        reopenBtn.type = 'button';
        reopenBtn.dataset.emgAction = `reopen-${ch.id}`;
        reopenBtn.disabled = Boolean(ch.envLocked);
        reopenBtn.onclick = () =>
          openEmergencyModal({
            targetChannel: ch.id,
            targetLabel: ch.label,
            actionType: 'reopen',
            cooldownRemainingSec: data.cooldownRemainingSec || 0,
            maskedVerifyEmail: data.configStatus?.maskedVerifyEmail || '',
          });
        actions.appendChild(reopenBtn);
      }

      if (
        pendingSessionVerif &&
        (pendingSessionVerif.targetChannel === ch.id || pendingSessionVerif.targetChannel === 'all')
      ) {
        const resumeBtn = el('button', 'ex-btn ex-btn-gold ex-btn-sm', 'Bekleyen Kodu Gir');
        resumeBtn.type = 'button';
        resumeBtn.onclick = () =>
          openEmergencyModal({
            targetChannel: pendingSessionVerif.targetChannel,
            targetLabel: pendingSessionVerif.targetChannel === 'all' ? 'Bütün İletişim Kanalları' : ch.label,
            actionType: pendingSessionVerif.actionType,
            operationId: pendingSessionVerif.operationId,
            expiresAtMs: pendingSessionVerif.expiresAtMs,
            cooldownRemainingSec: pendingSessionVerif.cooldownRemainingSec || 0,
            maskedVerifyEmail: pendingSessionVerif.maskedVerifyEmail || '',
          });
        actions.appendChild(resumeBtn);
      }

      card.append(top, actions);
      grid.appendChild(card);
    }

    // 4. Security Warning Banner Editor
    const presetSel = $('emgBannerPreset');
    const currentPresetVal = data.banner?.preset || '';
    presetSel.replaceChildren(el('option', '', 'Özel Metin'));
    presetSel.firstChild.value = '';
    for (const p of data.presets || []) {
      const opt = el('option', '', `${p.key} — ${p.textTr.slice(0, 64)}…`);
      opt.value = p.key;
      opt.dataset.textTr = p.textTr;
      presetSel.appendChild(opt);
    }
    presetSel.value = currentPresetVal;

    const bannerBadge = $('emgBannerStatusBadge');
    if (data.banner?.pendingVerification) {
      bannerBadge.className = 'emg-badge emg-badge-pending';
      bannerBadge.textContent = '◐ Doğrulama bekleniyor';
    } else if (data.banner?.enabled) {
      bannerBadge.className = 'emg-badge emg-badge-open';
      bannerBadge.textContent = '● Açık (Yayında)';
    } else {
      bannerBadge.className = 'emg-badge emg-badge-closed';
      bannerBadge.textContent = '● Kapalı';
    }

    const bannerArea = $('emgBannerText');
    if (document.activeElement !== bannerArea) {
      bannerArea.value = data.banner?.text || '';
    }
    $('btnSaveBanner').textContent = data.banner?.enabled
      ? 'Uyarı Bandı Metnini Doğrula ve Güncelle'
      : 'Uyarı Bandını Doğrula ve Yayınla';
    $('btnDisableBanner').disabled = !data.banner?.enabled;

    // 5. Recent Security Operations
    const recentHost = $('emergencyRecentList');
    recentHost.replaceChildren();
    const recentOps = Array.isArray(data.recentOperations) ? data.recentOperations : [];
    if (!recentOps.length) {
      recentHost.appendChild(el('p', 'emg-meta', 'Henüz tamamlanmış bir acil güvenlik işlemi kaydı bulunmuyor.'));
    } else {
      for (const op of recentOps) {
        const item = el('div', 'emg-audit-item');
        const head = el('div', 'emg-audit-head');
        head.append(
          el('span', '', `${EMG_ACTION_TITLES[op.action_type] || op.action_type} · ${op.channel}`),
          el('span', 'emg-meta', formatDateTimeTr(op.created_at))
        );
        item.append(
          head,
          el('div', 'emg-meta', `Hesap: ${op.actor_email} · Kaynak: ${op.source} · İşlem No: ${op.operation_id}`)
        );
        recentHost.appendChild(item);
      }
    }

    // 6. Read-only Immutable Audit Log
    const auditHost = $('emergencyAuditList');
    auditHost.replaceChildren();
    const audits = Array.isArray(data.auditLogs) ? data.auditLogs : [];
    if (!audits.length) {
      auditHost.appendChild(el('p', 'emg-meta', 'Denetim kaydı bulunmuyor.'));
    } else {
      for (const log of audits) {
        const item = el('div', 'emg-audit-item');
        item.dataset.outcome = log.outcome;
        const head = el('div', 'emg-audit-head');
        const outcomeTxt = log.outcome === 'success' ? '✓ Başarılı' : '✕ Reddedildi / Başarısız';
        head.append(
          el('span', '', `${outcomeTxt} · ${log.action_type} (${log.channel})`),
          el('span', 'emg-meta', formatDateTimeTr(log.created_at))
        );
        const detailParts = [
          `Hesap: ${log.actor_email} (${log.actor_role})`,
          `Kaynak: ${log.source}`,
          `İşlem No: ${log.operation_id}`,
        ];
        if (log.previous_state || log.new_state) {
          detailParts.push(`Durum: ${log.previous_state || '—'} → ${log.new_state || '—'}`);
        }
        if (log.reason) {
          detailParts.push(`Detay: ${log.reason}`);
        }
        item.append(head, el('div', 'emg-meta', detailParts.join(' · ')));
        auditHost.appendChild(item);
      }
    }
  }

  async function loadEmergencyCenter() {
    if (!isEmergencyOwner()) return;
    try {
      const data = await extranetApi('/v1/extranet/emergency/status');
      renderEmergencyCenter(data);
    } catch (e) {
      showBanner(e.message || 'Acil Durum ve Güvenlik Merkezi yüklenemedi.', 'err');
    }
  }

  // --- Dashboard Rendering ---

  function renderDashboardPeriod() {
    if (!dashboardCache || !dashboardCache.periods) return;
    const p = dashboardCache.periods;
    const cur = p[activePeriod] || p.today;

    $('kpiNewRequests').textContent = String(cur.newRequests ?? 0);
    $('kpiNewRequestsSub').textContent = `Bugün: ${p.today.newRequests} · Hafta: ${p.week.newRequests} · Ay: ${p.month.newRequests}`;

    $('kpiConfirmed').textContent = String(cur.confirmed ?? 0);
    $('kpiConfirmedSub').textContent = `Bugün: ${p.today.confirmed} · Hafta: ${p.week.confirmed} · Ay: ${p.month.confirmed}`;

    $('kpiCancelled').textContent = String(cur.cancelled ?? 0);
    $('kpiCancelledSub').textContent = `Bugün: ${p.today.cancelled} · Hafta: ${p.week.cancelled} · Ay: ${p.month.cancelled}`;

    $('kpiNewMembers').textContent = String(cur.newMembers ?? 0);
    $('kpiNewMembersSub').textContent = `Bugün: ${p.today.newMembers} · Hafta: ${p.week.newMembers} · Ay: ${p.month.newMembers}`;

    $('kpiCommissionExpected').textContent = 'Beklenen (onaylı): ' + formatCommissionObj(cur.expectedCommission || {});
    $('kpiCommission').textContent = formatCommissionObj(cur.estimatedCommission);
    const grossEl = $('kpiCommissionGross');
    if (grossEl) {
      grossEl.textContent = `brüt ${formatCommissionObj(cur.grossCommission || cur.estimatedCommission)}`;
    }
    const wkNet = formatCommissionObj(p.week.estimatedCommission);
    const wkGross = formatCommissionObj(p.week.grossCommission || p.week.estimatedCommission);
    const moNet = formatCommissionObj(p.month.estimatedCommission);
    const moGross = formatCommissionObj(p.month.grossCommission || p.month.estimatedCommission);
    $('kpiCommissionSub').textContent = `Hafta: ${wkNet} (brüt ${wkGross}) · Ay: ${moNet} (brüt ${moGross})`;

    // Status pills
    const pillsWrap = $('statusSummaryPills');
    pillsWrap.replaceChildren();
    const bd = dashboardCache.statusBreakdown || {};
    ['new', 'in_progress', 'confirmed', 'completed', 'cancelled'].forEach((st) => {
      const btn = el('button', 'ex-badge ex-badge-status', `${STATUS_LABELS[st]}: ${bd[st] ?? 0}`);
      btn.type = 'button';
      btn.dataset.status = st;
      btn.style.border = '0';
      btn.onclick = () => {
        $('filterStatus').value = st;
        switchView('bookings');
      };
      pillsWrap.appendChild(btn);
    });

    let analytics=$('dashboardAnalytics');if(!analytics){analytics=el('div','ex-card');analytics.id='dashboardAnalytics';$('viewDashboard').append(analytics);}
    analytics.replaceChildren(el('h2',null,'Dönüşüm ve dağılımlar'));
    const conversion=cur.conversion||{};
    analytics.append(el('p',null,`Talep → onay → tamamlandı: ${conversion.requests||0} → ${conversion.confirmed||0} → ${conversion.completed||0} · Onay %${Math.round((conversion.confirmationRate||0)*100)} · Tamamlanma %${Math.round((conversion.completionRate||0)*100)}`));
    analytics.append(el('p',null,'Kademeler: '+Object.entries(dashboardCache.tierDistribution||{}).map(([k,v])=>k+': '+v).join(' · ')));
    analytics.append(el('p',null,'Diller: '+Object.entries(dashboardCache.languageDistribution||{}).map(([k,v])=>k+': '+v).join(' · ')));
    const top=el('ol');for(const tour of dashboardCache.topTours||[])top.append(el('li',null,tour.title+' · '+tour.count+' talep'));analytics.append(top);
    // Recent bookings table
    renderBookingsTable($('recentBookingsWrap'), dashboardCache.recentBookings || []);
  }

  async function loadDashboard() {
    try {
      dashboardCache = await extranetApi('/v1/extranet/dashboard');
      renderDashboardPeriod();
    } catch (e) {
      if (e.status !== 401) showBanner(e.message || 'Gösterge paneli yüklenemedi.', 'err');
    }
  }

  // --- Reservations List & CSV Export ---

  function collectFilterParams(page = 1) {
    const params = new URLSearchParams();
    params.set('page', String(page));
    params.set('pageSize', $('filterPageSize').value || '20');
    const dateType = $('filterDateType').value;
    const dateFrom = $('filterDateFrom').value;
    const dateTo = $('filterDateTo').value;
    const status = $('filterStatus').value;
    const product = $('filterProduct').value;
    const source = $('filterSource').value;
    const lang = $('filterLang').value;
    const tier = $('filterTier').value;
    const q = $('filterSearch').value.trim();

    if (dateType) params.set('dateType', dateType);
    if (dateFrom) params.set('dateFrom', dateFrom);
    if (dateTo) params.set('dateTo', dateTo);
    if (status) params.set('status', status);
    if (product) params.set('product', product);
    if (source) params.set('source', source);
    if (lang) params.set('lang', lang);
    if (tier) params.set('tier', tier);
    if (q) params.set('q', q);
    return params;
  }

  function syncProductDropdown(products) {
    const sel = $('filterProduct');
    const curVal = sel.value;
    const firstOpt = el('option', null, 'Tümü');
    firstOpt.value = '';
    sel.replaceChildren(firstOpt);
    (products || []).forEach((p) => {
      const opt = el('option', null, p.title && p.title !== p.id ? `${p.title} (${p.id})` : p.id);
      opt.value = p.id;
      sel.appendChild(opt);
    });
    sel.value = curVal;
  }

  function renderBookingsTable(container, items) {
    container.replaceChildren();
    if (!items || !items.length) {
      container.appendChild(el('div', 'ex-empty', 'Seçili kriterlere uygun rezervasyon veya talep kaydı bulunamadı.'));
      return;
    }

    const wrap = el('div', 'ex-table-wrap');
    const table = el('table', 'ex-table');
    const thead = el('thead');
    const hr = el('tr');
    ['Referans', 'Misafir', 'Ürün', 'Tarih & Kişi', 'Tutar & Kupon', 'Kaynak / Dil', 'Durum', 'Ödeme', 'İşlem'].forEach((h) => {
      hr.appendChild(el('th', null, h));
    });
    thead.appendChild(hr);

    const tbody = el('tbody');
    items.forEach((row) => {
      const tr = el('tr');

      const tdRef = el('td');
      tdRef.dataset.label = 'Referans';
      const refBox = el('div');
      refBox.appendChild(el('span', 'ex-mono', row.displayRef));
      refBox.appendChild(el('span', 'ex-cell-sub', formatDateTimeTr(row.createdAt)));
      tdRef.appendChild(refBox);

      const tdGuest = el('td');
      tdGuest.dataset.label = 'Misafir';
      const guestBox = el('div');
      guestBox.appendChild(el('strong', null, row.guestName || 'İsimsiz Misafir'));
      const tierBadge = el('span', 'ex-badge ex-badge-tier', TIER_LABELS[row.memberTier] || row.memberTier);
      tierBadge.dataset.tier = row.memberTier || 'guest';
      tierBadge.style.marginLeft = '6px';
      guestBox.appendChild(tierBadge);
      if (row.guestEmailMasked) {
        guestBox.appendChild(el('span', 'ex-cell-sub', row.guestEmailMasked));
      }
      tdGuest.appendChild(guestBox);

      const tdProd = el('td');
      tdProd.dataset.label = 'Ürün';
      const prodBox = el('div');
      prodBox.appendChild(el('strong', null, row.productTitle || row.productId));
      if (row.providerId) {
        prodBox.appendChild(el('span', 'ex-cell-sub', `Tedarikçi: ${row.providerId}`));
      }
      tdProd.appendChild(prodBox);

      const tdDate = el('td');
      tdDate.dataset.label = 'Tarih & Kişi';
      const dateBox = el('div');
      dateBox.appendChild(el('span', null, formatDateTr(row.serviceDate) + (row.serviceTime ? ` · ${row.serviceTime}` : '')));
      dateBox.appendChild(el('span', 'ex-cell-sub', `${row.guests} kişi`));
      tdDate.appendChild(dateBox);

      const tdPrice = el('td');
      tdPrice.dataset.label = 'Tutar & Kupon';
      const priceBox = el('div');
      priceBox.appendChild(el('strong', null, row.priceDisplay || '—'));
      if (row.coupon) {
        priceBox.appendChild(el('span', 'ex-cell-sub', `🎟 ${row.coupon.code} (%${(row.coupon.percentBps / 100).toFixed(0)})`));
      }
      tdPrice.appendChild(priceBox);

      const tdSrc = el('td');
      tdSrc.dataset.label = 'Kaynak / Dil';
      tdSrc.appendChild(
        el('span', null, `${SOURCE_LABELS[row.source] || row.source} · ${String(row.lang || '').toUpperCase()}`)
      );

      const tdStatus = el('td');
      tdStatus.dataset.label = 'Durum';
      const stBadge = el('span', 'ex-badge ex-badge-status', STATUS_LABELS[row.status] || row.status);
      stBadge.dataset.status = row.status;
      tdStatus.appendChild(stBadge);

      const tdPay = el('td');
      tdPay.dataset.label = 'Ödeme';
      const payBadge = el('span', 'ex-badge ex-badge-pay', PAYMENT_LABELS[row.paymentStatus] || row.paymentStatus);
      payBadge.dataset.pay = row.paymentStatus;
      tdPay.appendChild(payBadge);

      const tdAct = el('td');
      tdAct.dataset.label = 'İşlem';
      const detailBtn = el('button', 'ex-btn ex-btn-secondary ex-btn-sm', 'Detay →');
      detailBtn.type = 'button';
      detailBtn.onclick = () => openBookingDetail(row.uid);
      tdAct.appendChild(detailBtn);

      tr.append(tdRef, tdGuest, tdProd, tdDate, tdPrice, tdSrc, tdStatus, tdPay, tdAct);
      tbody.appendChild(tr);
    });

    table.append(thead, tbody);
    wrap.appendChild(table);
    container.appendChild(wrap);
  }

  async function loadBookings(page = 1) {
    try {
      const qs = collectFilterParams(page);
      const res = await extranetApi('/v1/extranet/bookings?' + qs.toString());
      bookingsState = {
        page: res.page,
        pageSize: res.pageSize,
        totalPages: res.totalPages,
      };
      if (res.filterOptions && res.filterOptions.products) {
        syncProductDropdown(res.filterOptions.products);
      }
      renderBookingsTable($('bookingsTableContainer'), res.items || []);
      $('paginationInfo').textContent = `Toplam ${res.total} kayıt · Sayfa ${res.page} / ${res.totalPages}`;
      $('pageIndicator').textContent = `${res.page} / ${res.totalPages}`;
      $('btnPrevPage').disabled = res.page <= 1;
      $('btnNextPage').disabled = res.page >= res.totalPages;
    } catch (e) {
      if (e.status !== 401) showBanner(e.message || 'Rezervasyon listesi yüklenemedi.', 'err');
    }
  }

  async function exportBookingsCsv() {
    if (!currentUser || currentUser.role !== 'owner') return;
    const btn = $('btnExportCsv');
    btn.disabled = true;
    try {
      const qs = collectFilterParams(1);
      const payload = {};
      for (const [k, v] of qs.entries()) {
        if (k !== 'page' && k !== 'pageSize') payload[k] = v;
      }
      const blob = await extranetApi('/v1/extranet/bookings/export', {
        method: 'POST',
        body: payload,
        expectBlob: true,
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `bosphorly-rezervasyonlar-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);
      showBanner('CSV dışa aktarma tamamlandı ve denetim kaydına (audit) işlendi.', 'ok');
    } catch (e) {
      showBanner(e.message || 'CSV dışa aktarma başarısız.', 'err');
    } finally {
      btn.disabled = false;
    }
  }

  // --- Reservation Detail Drawer ---

  function makeKv(label, valueNodeOrText) {
    const wrap = el('div', 'ex-kv');
    wrap.appendChild(el('span', 'ex-kv-label', label));
    const valBox = el('div', 'ex-kv-val');
    if (valueNodeOrText instanceof Node) valBox.appendChild(valueNodeOrText);
    else valBox.textContent = valueNodeOrText || '—';
    wrap.appendChild(valBox);
    return wrap;
  }

  function renderBookingDetailDrawer(bundle) {
    const b = bundle.booking;
    const providers = bundle.availableProviders || [];
    const canManageFinancialAndProvider = currentUser && (currentUser.role === 'owner' || currentUser.role === 'admin');

    $('drawerSubtitle').textContent = `${b.recordType === 'booking' ? 'Rezervasyon Kaydı' : 'Üye Talebi'} · ${SOURCE_LABELS[b.source] || b.source}`;
    $('drawerTitle').textContent = `${b.displayRef} — ${b.productTitle}`;

    const body = $('drawerBody');
    body.replaceChildren();

    // 1. Misafir Bilgileri (Maskeli + Göster Butonu -> Audit)
    const secGuest = el('section', 'ex-detail-section');
    secGuest.appendChild(el('h3', null, 'Misafir Bilgileri (KVKK Maskeli)'));
    const guestGrid = el('div', 'ex-kv-grid');

    guestGrid.appendChild(makeKv('Ad Soyad', b.guestName || '—'));

    const tierBadge = el('span', 'ex-badge ex-badge-tier', TIER_LABELS[b.memberTier] || b.memberTier);
    tierBadge.dataset.tier = b.memberTier || 'guest';
    guestGrid.appendChild(makeKv('Üye Seviyesi', tierBadge));

    // Masked Email with Reveal
    const emailWrap = el('span', null);
    const emailText = el('span', 'ex-mono', b.guestEmailMasked || '—');
    emailWrap.appendChild(emailText);
    if (b.hasEmail) {
      const btnRevEmail = el('button', 'ex-btn ex-btn-secondary ex-btn-sm', 'Göster');
      btnRevEmail.type = 'button';
      btnRevEmail.style.marginLeft = '8px';
      btnRevEmail.onclick = async () => {
        btnRevEmail.disabled = true;
        try {
          const r = await extranetApi(`/v1/extranet/bookings/${encodeURIComponent(b.uid)}/reveal-pii`, {
            method: 'POST',
            body: { field: 'email' },
          });
          emailText.textContent = r.value || '—';
          btnRevEmail.textContent = 'Audit kaydedildi ✓';
        } catch (e) {
          btnRevEmail.disabled = false;
          showBanner(e.message, 'err');
        }
      };
      emailWrap.appendChild(btnRevEmail);
    }
    guestGrid.appendChild(makeKv('E-posta', emailWrap));

    // Masked Phone with Reveal
    const phoneWrap = el('span', null);
    const phoneText = el('span', 'ex-mono', b.guestPhoneMasked || '—');
    phoneWrap.appendChild(phoneText);
    if (b.hasPhone) {
      const btnRevPhone = el('button', 'ex-btn ex-btn-secondary ex-btn-sm', 'Göster');
      btnRevPhone.type = 'button';
      btnRevPhone.style.marginLeft = '8px';
      btnRevPhone.onclick = async () => {
        btnRevPhone.disabled = true;
        try {
          const r = await extranetApi(`/v1/extranet/bookings/${encodeURIComponent(b.uid)}/reveal-pii`, {
            method: 'POST',
            body: { field: 'phone' },
          });
          phoneText.textContent = r.value || '—';
          btnRevPhone.textContent = 'Audit kaydedildi ✓';
        } catch (e) {
          btnRevPhone.disabled = false;
          showBanner(e.message, 'err');
        }
      };
      phoneWrap.appendChild(btnRevPhone);
    }
    guestGrid.appendChild(makeKv('Telefon', phoneWrap));

    guestGrid.appendChild(makeKv('Konaklama / Otel', [b.guestHotel, b.guestRoom ? `Oda ${b.guestRoom}` : ''].filter(Boolean).join(' · ') || '—'));
    guestGrid.appendChild(makeKv('Dil / Ülke', [String(b.lang || '').toUpperCase(), b.guestCountry || ''].filter(Boolean).join(' · ') || '—'));
    secGuest.appendChild(guestGrid);
    body.appendChild(secGuest);

    // 2. Ürün, Tarih, Fiyat ve Kupon Detayları
    const secTrip = el('section', 'ex-detail-section');
    secTrip.appendChild(el('h3', null, 'Hizmet, Fiyat ve Kupon Bilgileri'));
    const tripGrid = el('div', 'ex-kv-grid');
    tripGrid.appendChild(makeKv('Ürün', `${b.productTitle} (${b.productId})`));
    tripGrid.appendChild(makeKv('Hizmet Tarihi & Saati', formatDateTr(b.serviceDate) + (b.serviceTime ? ` · ${b.serviceTime}` : '')));
    tripGrid.appendChild(makeKv('Kişi Sayısı', `${b.guests} kişi`));
    tripGrid.appendChild(makeKv('Fiyat & Para Birimi', b.priceDisplay || '—'));
    tripGrid.appendChild(
      makeKv(
        'Kupon',
        b.coupon
          ? `${b.coupon.code} · %${(b.coupon.percentBps / 100).toFixed(1)} indirim (${b.coupon.status})`
          : 'Kupon kullanılmadı'
      )
    );
    tripGrid.appendChild(makeKv('Oluşturulma Zamanı', formatDateTimeTr(b.createdAt)));
    secTrip.appendChild(tripGrid);
    if (b.guestNotes) {
      const gNote = el('div', 'ex-alert ex-alert-info');
      gNote.appendChild(el('strong', null, 'Misafir Notu: '));
      gNote.appendChild(document.createTextNode(b.guestNotes));
      secTrip.appendChild(gNote);
    }
    body.appendChild(secTrip);

    // 3. Rezervasyon Durumu (yeni -> işlemde -> onaylandı -> tamamlandı / iptal)
    const secStatus = el('section', 'ex-detail-section');
    secStatus.appendChild(el('h3', null, 'Rezervasyon Durumu Yönetimi'));
    const stepper = el('div', 'ex-stepper');
    ['new', 'in_progress', 'confirmed', 'completed'].forEach((st) => {
      const chip = el('span', 'ex-step' + (b.status === st ? ' current' : ''), STATUS_LABELS[st]);
      stepper.appendChild(chip);
    });
    if (b.status === 'cancelled') {
      stepper.appendChild(el('span', 'ex-step cancelled', 'İptal Edildi'));
    }
    secStatus.appendChild(stepper);

    if (b.allowedNextStatuses && b.allowedNextStatuses.length > 0) {
      const noteField = el('label', 'ex-field');
      noteField.appendChild(el('span', null, 'Durum değişikliği açıklaması (isteğe bağlı, kart bilgisi girilmez)'));
      const statusNoteInput = el('input');
      statusNoteInput.type = 'text';
      statusNoteInput.maxLength = 400;
      statusNoteInput.placeholder = 'Örn. Tedarikçi saat teyidi alındı';
      noteField.appendChild(statusNoteInput);
      secStatus.appendChild(noteField);

      const actRow = el('div', 'ex-inline-form');
      b.allowedNextStatuses.forEach((nextSt) => {
        const cls = nextSt === 'cancelled' ? 'ex-btn ex-btn-danger' : nextSt === 'completed' ? 'ex-btn ex-btn-ok' : 'ex-btn ex-btn-primary';
        const btn = el('button', cls, STATUS_ACTION_LABELS[nextSt] || STATUS_LABELS[nextSt]);
        btn.type = 'button';
        btn.onclick = async () => {
          const noteVal = statusNoteInput.value.trim();
          if (looksLikeCardNumber(noteVal)) {
            showBanner('Güvenlik kuralı: Kart numarası hiçbir alana girilemez.', 'err');
            return;
          }
          if ((nextSt === 'cancelled' || nextSt === 'completed') && !window.confirm(`Rezervasyon durumu "${STATUS_LABELS[nextSt]}" olarak güncellensin mi?`)) {
            return;
          }
          btn.disabled = true;
          try {
            const res = await extranetApi(`/v1/extranet/bookings/${encodeURIComponent(b.uid)}/status`, {
              method: 'POST',
              body: { toStatus: nextSt, ...(noteVal ? { note: noteVal } : {}) },
            });
            renderBookingDetailDrawer(res);
            showBanner(`Rezervasyon durumu "${STATUS_LABELS[nextSt]}" olarak kaydedildi.`, 'ok');
            refreshBackgroundView();
          } catch (e) {
            btn.disabled = false;
            showBanner(e.message, 'err');
          }
        };
        actRow.appendChild(btn);
      });
      secStatus.appendChild(actRow);
    } else {
      secStatus.appendChild(el('p', 'ex-cell-sub', 'Bu rezervasyon son durumda (Tamamlandı veya İptal) olduğu için yeni durum geçişi kapalıdır.'));
    }
    body.appendChild(secStatus);

    // 4. Ödeme Durumu (beklemede / ödendi / iade edildi — sadece kayıt, gerçek ödeme işlemi yok)
    const secPay = el('section', 'ex-detail-section');
    const payHead = el('h3', null, 'Ödeme Durumu Kaydı');
    const curPayBadge = el('span', 'ex-badge ex-badge-pay', PAYMENT_LABELS[b.paymentStatus] || b.paymentStatus);
    curPayBadge.dataset.pay = b.paymentStatus;
    payHead.appendChild(curPayBadge);
    secPay.appendChild(payHead);
    secPay.appendChild(
      el(
        'p',
        'ex-cell-sub',
        'Yalnızca operasyonel kayıt amaçlıdır; gerçek tahsilat veya iade işlemi yapılmaz. Kart bilgisi hiçbir ekranda girilmez ve tutulmaz.'
      )
    );

    if (canManageFinancialAndProvider) {
      const payForm = el('div', 'ex-inline-form');
      const payLabel = el('label', 'ex-field');
      payLabel.appendChild(el('span', null, 'Ödeme Durumu'));
      const paySelect = el('select');
      ['pending', 'paid', 'refunded'].forEach((ps) => {
        const opt = el('option', null, PAYMENT_LABELS[ps]);
        opt.value = ps;
        if (ps === b.paymentStatus) opt.selected = true;
        paySelect.appendChild(opt);
      });
      payLabel.appendChild(paySelect);

      const refundLabel = el('label', 'ex-field');
      refundLabel.appendChild(el('span', null, `Kümülatif iade (${b.currency || 'para birimi'}, kuruş/cent)`));
      const refundInput = el('input'); refundInput.type = 'number'; refundInput.min = '0'; refundInput.step = '1'; refundInput.value = b.refundedMinor || 0;
      refundLabel.appendChild(refundInput);
      const btnSavePay = el('button', 'ex-btn ex-btn-primary', 'Ödeme Kaydını Güncelle');
      btnSavePay.type = 'button';
      btnSavePay.onclick = async () => {
        btnSavePay.disabled = true;
        try {
          const res = await extranetApi(`/v1/extranet/bookings/${encodeURIComponent(b.uid)}/payment`, {
            method: 'POST',
            body: { paymentStatus: paySelect.value, refundedMinor: Number(refundInput.value) },
          });
          renderBookingDetailDrawer(res);
          showBanner('Ödeme durumu kaydı güncellendi.', 'ok');
          refreshBackgroundView();
        } catch (e) {
          btnSavePay.disabled = false;
          showBanner(e.message, 'err');
        }
      };
      payForm.append(payLabel, refundLabel, btnSavePay);
      secPay.appendChild(payForm);
    } else {
      secPay.appendChild(el('p', 'ex-cell-sub', 'Ödeme durumu kaydını yalnızca Owner ve Admin rolleri değiştirebilir.'));
    }
    body.appendChild(secPay);

    // 5. Tedarikçi (Provider) Atama
    const secProv = el('section', 'ex-detail-section');
    secProv.appendChild(el('h3', null, 'Tedarikçi (Provider) Ataması'));
    const curProvText = b.provider
      ? `${b.provider.id} (${b.provider.status}${b.provider.currency ? ' · ' + b.provider.currency : ''})`
      : 'Henüz tedarikçi atanmadı';
    secProv.appendChild(el('p', 'ex-cell-sub', `Mevcut tedarikçi: ${curProvText}`));

    if (canManageFinancialAndProvider) {
      const provForm = el('div', 'ex-inline-form');
      const provLabel = el('label', 'ex-field');
      provLabel.appendChild(el('span', null, 'Tedarikçi Seçin'));
      const provSelect = el('select');
      const noneOpt = el('option', null, '— Tedarikçi Atanmamış —');
      noneOpt.value = '';
      provSelect.appendChild(noneOpt);
      providers.forEach((p) => {
        const opt = el('option', null, `${p.id} · ${p.status === 'verified' ? 'Doğrulanmış' : p.status} (${p.currency})`);
        opt.value = p.id;
        if (b.providerId === p.id) opt.selected = true;
        provSelect.appendChild(opt);
      });
      provLabel.appendChild(provSelect);

      const btnSaveProv = el('button', 'ex-btn ex-btn-primary', 'Tedarikçiyi Kaydet');
      btnSaveProv.type = 'button';
      btnSaveProv.onclick = async () => {
        btnSaveProv.disabled = true;
        try {
          const res = await extranetApi(`/v1/extranet/bookings/${encodeURIComponent(b.uid)}/provider`, {
            method: 'POST',
            body: { providerId: provSelect.value || null },
          });
          renderBookingDetailDrawer(res);
          showBanner('Tedarikçi ataması güncellendi.', 'ok');
          refreshBackgroundView();
        } catch (e) {
          btnSaveProv.disabled = false;
          showBanner(e.message, 'err');
        }
      };
      provForm.append(provLabel, btnSaveProv);
      secProv.appendChild(provForm);
    } else {
      secProv.appendChild(el('p', 'ex-cell-sub', 'Tedarikçi atamasını yalnızca Owner ve Admin rolleri değiştirebilir.'));
    }
    body.appendChild(secProv);

    // 6. İç Notlar (Sadece Extranet Kullanıcıları Görür)
    const secNotes = el('section', 'ex-detail-section');
    secNotes.appendChild(el('h3', null, 'İç Notlar (Yalnızca Extranet Ekibi Görür)'));

    const noteForm = el('form', null);
    noteForm.style.display = 'grid';
    noteForm.style.gap = '8px';
    const noteLbl = el('label', 'ex-field');
    noteLbl.appendChild(el('span', null, 'Yeni iç not ekle (misafire gösterilmez; kart bilgisi yazmayın)'));
    const noteArea = el('textarea');
    noteArea.maxLength = 2000;
    noteArea.placeholder = 'Operasyon notu, transfer karşılama detayı veya tedarikçi teyidi…';
    noteLbl.appendChild(noteArea);
    const btnAddNote = el('button', 'ex-btn ex-btn-secondary', 'İç Not Ekle');
    btnAddNote.type = 'submit';
    btnAddNote.style.justifySelf = 'start';

    noteForm.onsubmit = async (ev) => {
      ev.preventDefault();
      const text = noteArea.value.trim();
      if (!text) return;
      if (looksLikeCardNumber(text)) {
        showBanner('Güvenlik kuralı: Kart numarası iç notlara yazılamaz.', 'err');
        return;
      }
      btnAddNote.disabled = true;
      try {
        const res = await extranetApi(`/v1/extranet/bookings/${encodeURIComponent(b.uid)}/notes`, {
          method: 'POST',
          body: { note: text },
        });
        renderBookingDetailDrawer(res);
        showBanner('İç not eklendi.', 'ok');
      } catch (e) {
        btnAddNote.disabled = false;
        showBanner(e.message, 'err');
      }
    };
    noteForm.append(noteLbl, btnAddNote);
    secNotes.appendChild(noteForm);

    if (b.internalNotes && b.internalNotes.length > 0) {
      const notesList = el('div', null);
      notesList.style.display = 'grid';
      notesList.style.gap = '8px';
      b.internalNotes.forEach((n) => {
        const box = el('div', 'ex-note-box');
        const meta = el('div', 'ex-tl-meta');
        meta.appendChild(
          el('strong', null, `${n.authorName || n.authorMemberId.slice(0, 8)} (${ROLE_LABELS[n.authorRole] || n.authorRole})`)
        );
        meta.appendChild(el('span', null, formatDateTimeTr(n.createdAt)));
        box.append(meta, el('div', null, n.note));
        notesList.appendChild(box);
      });
      secNotes.appendChild(notesList);
    } else {
      secNotes.appendChild(el('p', 'ex-cell-sub', 'Henüz iç not eklenmemiş.'));
    }
    body.appendChild(secNotes);

    // 7. Tüm Olay Geçmişi (booking_events)
    const secEvents = el('section', 'ex-detail-section');
    secEvents.appendChild(el('h3', null, 'Tüm Olay Geçmişi (booking_events)'));
    if (b.events && b.events.length > 0) {
      const ul = el('ul', 'ex-timeline');
      b.events.forEach((ev) => {
        const li = el('li');
        const meta = el('div', 'ex-tl-meta');
        meta.appendChild(el('span', 'ex-mono', `İşleyen: ${ev.actorId}`));
        meta.appendChild(el('span', null, formatDateTimeTr(ev.createdAt)));
        const transitionText =
          ev.fromState || ev.toState
            ? `${STATUS_LABELS[ev.fromState] || ev.fromState || '—'} → ${STATUS_LABELS[ev.toState] || ev.toState || '—'}`
            : ev.evidenceReference;
        li.append(meta, el('strong', null, transitionText), el('span', 'ex-cell-sub', ev.evidenceReference));
        ul.appendChild(li);
      });
      secEvents.appendChild(ul);
    } else {
      secEvents.appendChild(el('p', 'ex-cell-sub', 'Bu kayıt için henüz durum değişikliği olayı bulunmuyor.'));
    }
    body.appendChild(secEvents);
    const mail=el('section','ex-detail-section');mail.append(el('h3',null,'Misafire e-posta'));
    if(b.hasEmail){
      const lang=el('select');lang.setAttribute('aria-label','Rezervasyon e-posta dili');for(const code of ['tr','en','ru']){const o=el('option',null,code.toUpperCase());o.value=code;lang.append(o);}
      const template=el('select');template.setAttribute('aria-label','Rezervasyon e-posta şablonu');for(const [key,title] of [['confirmation','Onay'],['reminder','Hatırlatma']]){const o=el('option',null,title);o.value=key;template.append(o);}
      mail.append(lang,template,button('E-postayı önizle',async()=>{try{const path='/v1/extranet/bookings/'+encodeURIComponent(b.uid);const draft=await extranetApi(path+'/email-preview',{method:'POST',body:{lang:lang.value,template:template.value}});const dialog=el('dialog','ex-card');dialog.append(el('h3',null,draft.preview.subject),el('p',null,draft.preview.to),el('pre',null,draft.preview.body));dialog.append(button('Vazgeç',()=>dialog.close()),button('Onayla ve gönder',async()=>{try{const result=await extranetApi(path+'/email-confirm',{method:'POST',body:{confirmationId:draft.confirmationId,confirm:true}});showBanner(result.sent?'E-posta gönderildi.':'E-posta gönderilemedi.',result.sent?'ok':'err');dialog.close();}catch(e){showBanner(e.message,'err');}}));dialog.addEventListener('close',()=>dialog.remove());document.body.append(dialog);dialog.showModal();}catch(e){showBanner(e.message,'err');}}));
    }
    for(const entry of b.emailHistory||[])mail.append(el('p',null,entry.created_at+' · '+entry.subject+' · '+entry.status));body.append(mail);
  }

  async function openBookingDetail(uid) {
    activeDetailUid = uid;
    const drawer = $('bookingDetailDrawer');
    $('drawerTitle').textContent = 'Yükleniyor…';
    $('drawerBody').replaceChildren(el('p', 'ex-cell-sub', 'Rezervasyon detayları getiriliyor…'));
    if (!drawer.open) drawer.showModal();
    try {
      const bundle = await extranetApi(`/v1/extranet/bookings/${encodeURIComponent(uid)}`);
      if (activeDetailUid === uid) renderBookingDetailDrawer(bundle);
    } catch (e) {
      drawer.close();
      showBanner(e.message || 'Rezervasyon detayı açılamadı.', 'err');
    }
  }

  function refreshBackgroundView() {
    if (activeView === 'dashboard') loadDashboard();
    else if (activeView === 'bookings') loadBookings(bookingsState.page);
  }

  // --- Event Listeners & Initialization ---

  function wireEvents() {
    document.querySelector('.ex-sidebar .ex-brand').onclick=e=>{e.preventDefault();switchView('dashboard');};
    $('btnDirectPasskey').onclick = () => runPasskeyLogin(null);

    $('emailStartForm').onsubmit = async (ev) => {
      ev.preventDefault();
      const email = $('loginEmail').value.trim().toLowerCase();
      if (!email) {
        showGateAlert('Lütfen geçerli bir e-posta adresi girin.', 'err');
        return;
      }
      const btn = $('btnSendCode');
      btn.disabled = true;
      showGateAlert('');
      try {
        const res = await memberApi('/v1/auth/start', { email, lang: 'tr' }, '');
        pendingEmail = email;
        $('emailStartForm').hidden = true;
        $('emailVerifyForm').hidden = false;
        showGateAlert(
          res.devCode
            ? `Geliştirici doğrulama kodu: ${res.devCode}`
            : '6 haneli giriş kodu e-posta adresinize gönderildi.',
          'ok'
        );
        $('loginCode').focus();
      } catch (e) {
        showGateAlert(e.message || 'Giriş kodu gönderilemedi.', 'err');
      } finally {
        btn.disabled = false;
      }
    };

    $('btnBackEmail').onclick = () => {
      $('emailVerifyForm').hidden = true;
      $('emailStartForm').hidden = false;
      showGateAlert('');
    };

    $('emailVerifyForm').onsubmit = async (ev) => {
      ev.preventDefault();
      const code = $('loginCode').value.trim();
      if (!/^\d{6}$/.test(code)) {
        showGateAlert('Lütfen 6 haneli sayısal kodu girin.', 'err');
        return;
      }
      const btn = $('btnVerifyCode');
      btn.disabled = true;
      showGateAlert('');
      try {
        const res = await memberApi('/v1/auth/verify', { email: pendingEmail, code, lang: 'tr', extranet: true }, '');
        writeMemberBearer(res.token);
        $('loginCode').value = '';
        const session=await extranetApi('/v1/extranet/auth/email',{method:'POST',body:{ticket:res.extranetTicket},bearer:res.token});
        await enterWorkspace(session);
      } catch (e) {
        showGateAlert(e.message || 'Kod doğrulanamadı.', 'err');
      } finally {
        btn.disabled = false;
      }
    };

    $('btnEnrollPasskey').onclick = () => runPasskeyEnrollment();
    $('btnCancelPasskeySetup').onclick = () => {
      pendingMemberToken = '';
      setGateStep('signin');
      showGateAlert('');
    };

    $('btnStepUpPasskey').onclick = () => runPasskeyLogin(pendingMemberToken);
    $('btnCancelPasskeyVerify').onclick = () => {
      pendingMemberToken = '';
      setGateStep('signin');
      showGateAlert('');
    };

    $('navDashboard').onclick = () => switchView('dashboard');
    $('navCatalog').onclick=()=>switchView('catalog');$('navSettings').onclick=()=>switchView('settings');
    $('navPartners').onclick=()=>switchView('partners');
    $('showHandoffs').onclick=async()=>{try{const r=await extranetApi('/v1/extranet/message-handoffs');$('priorityHandoffs').replaceChildren(node('h2','Öncelikli insana devirler'));for(const m of r.messages)$('priorityHandoffs').append(button(m.subject+' · '+m.channel,()=>openMessage(m.id)));}catch(e){alert(e.message);}};
    $('inboxChannel').onchange=()=>loadInbox(1);$('inboxAssigned').onchange=()=>loadInbox(1);
    $('navCampaigns').onclick=()=>switchView('campaigns');
    $('navInbox').onclick=()=>switchView('inbox');
    $('inboxStatus').onchange=()=>loadInbox(1);$('inboxSource').onchange=()=>loadInbox(1);$('inboxPrev').onclick=()=>loadInbox(inboxPage-1);$('inboxNext').onclick=()=>loadInbox(inboxPage+1);
    $('memberTierFilter').onchange=()=>loadMembers(1);$('memberStatus').onchange=()=>loadMembers(1);$('memberProvider').onchange=()=>loadMembers(1);
    $('memberBulk').onclick=()=>{const ids=[...document.querySelectorAll('[data-member-id]:checked')].map(n=>n.dataset.memberId);previewAndConfirm('/v1/extranet/members/tier-bulk-preview',{ids,tier:$('bulkTier').value,days:$('bulkDays').value?Number($('bulkDays').value):null,reason:$('bulkReason').value}).catch(e=>alert(e.message));};
    $('navMembers').onclick = () => switchView('members');
    $('memberSearchForm').onsubmit = e => {e.preventDefault();loadMembers(1);};
    $('membersPrev').onclick = () => loadMembers(memberPage-1);
    $('membersNext').onclick = () => loadMembers(memberPage+1);
    $('navBookings').onclick = () => switchView('bookings');
    $('btnGoAllBookings').onclick = () => {
      $('filterStatus').value = '';
      switchView('bookings');
    };
    const addPkBtn = $('btnAddPasskey');
    if (addPkBtn) addPkBtn.onclick = () => runAdditionalPasskeyEnrollment();
    $('btnLogout').onclick = () => performLogout('');

    document.querySelectorAll('.ex-seg-btn').forEach((btn) => {
      btn.onclick = () => {
        activePeriod = btn.dataset.period || 'today';
        document.querySelectorAll('.ex-seg-btn').forEach((b) => {
          b.setAttribute('aria-pressed', b === btn ? 'true' : 'false');
        });
        renderDashboardPeriod();
      };
    });

    $('btnRefreshDashboard').onclick = () => loadDashboard();
    $('btnRefreshBookings').onclick = () => loadBookings(bookingsState.page);
    $('btnExportCsv').onclick = () => exportBookingsCsv();

    $('bookingsFilterForm').onsubmit = (ev) => {
      ev.preventDefault();
      loadBookings(1);
    };

    $('btnResetFilters').onclick = () => {
      $('filterSearch').value = '';
      $('filterDateType').value = 'service';
      $('filterDateFrom').value = '';
      $('filterDateTo').value = '';
      $('filterStatus').value = '';
      $('filterProduct').value = '';
      $('filterSource').value = '';
      $('filterLang').value = '';
      $('filterTier').value = '';
      loadBookings(1);
    };

    $('filterPageSize').onchange = () => loadBookings(1);
    $('btnPrevPage').onclick = () => {
      if (bookingsState.page > 1) loadBookings(bookingsState.page - 1);
    };
    $('btnNextPage').onclick = () => {
      if (bookingsState.page < bookingsState.totalPages) loadBookings(bookingsState.page + 1);
    };

    $('btnCloseDrawer').onclick = () => $('bookingDetailDrawer').close();
    $('bookingDetailDrawer').addEventListener('click', (ev) => {
      if (ev.target === $('bookingDetailDrawer')) $('bookingDetailDrawer').close();
    });

    if ($('navEmergency')) {
      $('navEmergency').onclick = () => switchView('emergency');
    }
    if ($('btnRefreshEmergency')) {
      $('btnRefreshEmergency').onclick = () => loadEmergencyCenter();
    }
    if ($('btnEmergencyCloseAll')) {
      $('btnEmergencyCloseAll').onclick = () =>
        openEmergencyModal({
          targetChannel: 'all',
          targetLabel: 'Bütün İletişim Kanalları',
          actionType: 'close_all',
          cooldownRemainingSec: emgStateCache?.cooldownRemainingSec || 0,
          maskedVerifyEmail: emgStateCache?.configStatus?.maskedVerifyEmail || '',
        });
    }
    if ($('btnEmergencyReopenAll')) {
      $('btnEmergencyReopenAll').onclick = () =>
        openEmergencyModal({
          targetChannel: 'all',
          targetLabel: 'Bütün İletişim Kanalları',
          actionType: 'reopen_all',
          cooldownRemainingSec: emgStateCache?.cooldownRemainingSec || 0,
          maskedVerifyEmail: emgStateCache?.configStatus?.maskedVerifyEmail || '',
        });
    }
    if ($('emgBannerPreset')) {
      $('emgBannerPreset').onchange = () => {
        const sel = $('emgBannerPreset');
        const chosen = sel.options[sel.selectedIndex];
        if (chosen && chosen.dataset.textTr) {
          $('emgBannerText').value = chosen.dataset.textTr;
        }
      };
    }
    if ($('emergencyBannerForm')) {
      $('emergencyBannerForm').onsubmit = (ev) => {
        ev.preventDefault();
        const text = $('emgBannerText').value.trim();
        if (!text) {
          showBanner('Güvenlik uyarı bandı yayınlamak için metin girin.', 'err');
          $('emgBannerText').focus();
          return;
        }
        const preset = $('emgBannerPreset').value || '';
        const act = emgStateCache?.banner?.enabled ? 'banner_update' : 'banner_enable';
        openEmergencyModal({
          targetChannel: 'banner',
          targetLabel: 'Web Sitesi Güvenlik Uyarı Bandı',
          actionType: act,
          bannerText: text,
          bannerPreset: preset,
          cooldownRemainingSec: emgStateCache?.cooldownRemainingSec || 0,
          maskedVerifyEmail: emgStateCache?.configStatus?.maskedVerifyEmail || '',
        });
      };
    }
    if ($('btnDisableBanner')) {
      $('btnDisableBanner').onclick = () =>
        openEmergencyModal({
          targetChannel: 'banner',
          targetLabel: 'Web Sitesi Güvenlik Uyarı Bandı',
          actionType: 'banner_disable',
          bannerText: $('emgBannerText').value.trim(),
          bannerPreset: '',
          cooldownRemainingSec: emgStateCache?.cooldownRemainingSec || 0,
          maskedVerifyEmail: emgStateCache?.configStatus?.maskedVerifyEmail || '',
        });
    }
    if ($('btnCloseEmgModal')) $('btnCloseEmgModal').onclick = () => closeEmergencyModal();
    if ($('btnCancelEmgStep1')) $('btnCancelEmgStep1').onclick = () => closeEmergencyModal();
    if ($('emgConfirmForm')) {
      $('emgConfirmForm').onsubmit = (ev) => {
        ev.preventDefault();
        requestEmergencyOtpCode();
      };
    }
    if ($('emgVerifyForm')) {
      $('emgVerifyForm').onsubmit = (ev) => {
        ev.preventDefault();
        submitEmergencyOtpVerification();
      };
    }
    if ($('btnResendEmgOtp')) {
      $('btnResendEmgOtp').onclick = () => requestEmergencyOtpCode();
    }
    if ($('btnAbortPendingEmg')) {
      $('btnAbortPendingEmg').onclick = () => abortPendingEmergencyVerification();
    }
    if ($('emergencyVerifyModal')) {
      $('emergencyVerifyModal').addEventListener('click', (ev) => {
        if (ev.target === $('emergencyVerifyModal')) closeEmergencyModal();
      });
    }
  }

  async function bootstrap() {
    wireEvents();

    // 1. Check active HttpOnly Extranet cookie session first
    try {
      const session = await extranetApi('/v1/extranet/session');
      if (session && session.authenticated) {
        await enterWorkspace(session);
        return;
      }
    } catch {}

    // 2. If signed in as a Bosphorly member on this browser, offer 1-click continuation into Passkey check
    const existingBearer = readMemberBearer();
    if (existingBearer) {
      try {
        const me = await memberApi('/v1/me', undefined, existingBearer);
        if (me && me.email) {
          const box = $('existingMemberBox');
          $('existingMemberText').textContent = `Açık üye oturumu algılandı: ${me.email}`;
          box.hidden = false;
          $('emailStartForm').hidden = true;
          $('btnUseMemberSession').onclick = () => {box.hidden=true;$('emailStartForm').hidden=false;$('loginEmail').value=me.email;$('emailStartForm').requestSubmit();};
          $('btnSwitchAccount').onclick = () => {
            box.hidden = true;
            $('emailStartForm').hidden = false;
            $('loginEmail').focus();
          };
        }
      } catch {
        writeMemberBearer('');
      }
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();
