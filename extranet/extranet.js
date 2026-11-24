'use strict';
/* Bosphorly Extranet — Aşama 1: Güvenli Giriş (Üye + Zorunlu Passkey), RBAC (Owner/Admin/Staff),
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
    member: 'Üye Paneli',
    hotel_qr: 'Otel QR',
    telegram: 'Telegram',
    partner: 'Partner',
  };

  const ROLE_LABELS = {
    owner: 'Owner',
    admin: 'Admin',
    staff: 'Staff',
  };

  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => {
    const node = document.createElement(tag);
    if (cls) node.className = cls;
    if (text !== undefined && text !== null) node.textContent = String(text);
    return node;
  };

  const apiBase = () => {
    const cfg = window.BOSPHORLY_API && window.BOSPHORLY_API.base;
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

  function handleForcedSignOut(reasonMsg) {
    csrfToken = '';
    currentUser = null;
    stopIdleWatchdog();
    const drawer = $('bookingDetailDrawer');
    if (drawer && drawer.open) drawer.close();
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

    $('gateScreen').hidden = true;
    $('appShell').hidden = false;
    startIdleWatchdog();

    await switchView('dashboard');
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

  async function switchView(viewName) {
    activeView = viewName;
    $('viewDashboard').hidden = viewName !== 'dashboard';
    $('viewBookings').hidden = viewName !== 'bookings';
    $('navDashboard').setAttribute('aria-current', viewName === 'dashboard' ? 'page' : 'false');
    $('navBookings').setAttribute('aria-current', viewName === 'bookings' ? 'page' : 'false');

    if (viewName === 'dashboard') {
      await loadDashboard();
    } else if (viewName === 'bookings') {
      await loadBookings(1);
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

    $('kpiCommission').textContent = formatCommissionObj(cur.estimatedCommission);
    $('kpiCommissionSub').textContent = `Hafta: ${formatCommissionObj(p.week.estimatedCommission)} · Ay: ${formatCommissionObj(p.month.estimatedCommission)}`;

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

      const btnSavePay = el('button', 'ex-btn ex-btn-primary', 'Ödeme Kaydını Güncelle');
      btnSavePay.type = 'button';
      btnSavePay.onclick = async () => {
        btnSavePay.disabled = true;
        try {
          const res = await extranetApi(`/v1/extranet/bookings/${encodeURIComponent(b.uid)}/payment`, {
            method: 'POST',
            body: { paymentStatus: paySelect.value },
          });
          renderBookingDetailDrawer(res);
          showBanner('Ödeme durumu kaydı güncellendi.', 'ok');
          refreshBackgroundView();
        } catch (e) {
          btnSavePay.disabled = false;
          showBanner(e.message, 'err');
        }
      };
      payForm.append(payLabel, btnSavePay);
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
        const res = await memberApi('/v1/auth/verify', { email: pendingEmail, code, lang: 'tr' }, '');
        writeMemberBearer(res.token);
        $('loginCode').value = '';
        await checkMemberExtranetStatus(res.token);
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
    $('navBookings').onclick = () => switchView('bookings');
    $('btnGoAllBookings').onclick = () => {
      $('filterStatus').value = '';
      switchView('bookings');
    };
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
          $('btnUseMemberSession').onclick = () => checkMemberExtranetStatus(existingBearer);
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
