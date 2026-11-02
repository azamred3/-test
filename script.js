/* ============================================================
   عودة للعقار — script.js v8
   + ورقة الحساب (الاسم + المفضلة + تسجيل الخروج)
   + حركات: دائرة فتح التفاصيل، مؤشر تنقل منزلق، انفجار قلوب،
     بارالاكس، ظهور البطاقات، عدّاد أرقام، ميل ثلاثي الأبعاد
   ============================================================ */
(function () {
    'use strict';

    var LS_FAV = 'awda_favorites_v1';
    var MAX_COMPARE = 3;
    var REDUCE = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    var STATUS_LABELS = {
        available: { label: 'متاح' },
        sold: { label: 'تم البيع' },
        rented: { label: 'تم التأجير' }
    };

    var DEFAULT_AMENITIES = {
        fiber: 'شبكة ألياف بصرية', electricity: 'كهرباء', water: 'مياه',
        gas: 'غاز مركزي', sewage: 'صرف صحي', elevator: 'مصعد',
        parking: 'موقف سيارات', pool: 'مسبح', garden: 'حديقة',
        security: 'أمن 24/7', cameras: 'كاميرات', ac: 'مكيفات',
        kitchen: 'مطبخ مجهز', laundry: 'غسيل ملابس', furnished: 'مفروش', balcony: 'بلكونة'
    };
    var AMENITY_ICONS = {
        fiber: 'wifi-high', electricity: 'lightning', water: 'drop', gas: 'flame', sewage: 'pipe',
        elevator: 'arrows-vertical', parking: 'car', pool: 'swimming-pool', garden: 'plant', security: 'shield-check',
        cameras: 'security-camera', ac: 'snowflake', kitchen: 'cooking-pot', laundry: 'tshirt',
        furnished: 'armchair', balcony: 'sun-horizon'
    };

    var SHEETS = ['filter-sheet', 'profile-sheet', 'compare-modal', 'inquiry-modal', 'share-modal'];

    var state = {
        properties: [], categories: [], filtered: [],
        filters: { category: 'all', transaction: '', minPrice: 0, maxPrice: 0, minArea: 0, maxArea: 0, term: '' },
        sort: 'newest', view: 'grid',
        favorites: [], compare: [],
        user: null,
        map: null, mapMarkers: [],
        featSwiper: null, featSig: '', gallerySwiper: null,
        lastSig: null, catSig: '', statKey: '',
        loaded: false
    };

    var lastPt = { x: window.innerWidth / 2, y: window.innerHeight * .6 };
    var revealIO = null;
    var splashDone = false;

    function $(id) { return document.getElementById(id); }
    function hasGsap() { return typeof window.gsap !== 'undefined' && !REDUCE; }

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function toast(msg, type) {
        var el = $('app-toast');
        if (!el) return;
        var ico = type === 'success' ? 'ph-fill ph-check-circle' : type === 'error' ? 'ph-fill ph-warning-circle' : 'ph-fill ph-info';
        el.innerHTML = '<i class="' + ico + '"></i><span>' + esc(msg) + '</span>';
        el.className = 'app-toast ' + (type || '');
        void el.offsetWidth;
        el.className = 'app-toast show ' + (type || '');
        clearTimeout(toast._t);
        toast._t = setTimeout(function () { el.className = 'app-toast ' + (type || ''); }, 2600);
    }

    function num(s) { return s ? (parseInt(String(s).replace(/[^\d]/g, ''), 10) || 0) : 0; }

    function amenityLabel(f) {
        if (typeof f !== 'string') return String(f);
        if (f.indexOf('custom:') === 0) return f.replace('custom:', '');
        return DEFAULT_AMENITIES[f] || f;
    }
    function amenityIcon(f) { return 'ph-' + (AMENITY_ICONS[f] || 'check-circle'); }

    function catIcon(name) {
        var n = String(name || '');
        var map = [
            ['فيلا', 'house-line'], ['شقة', 'buildings'], ['أرض', 'map-trifold'], ['ارض', 'map-trifold'],
            ['مزرعة', 'tree'], ['استراحة', 'tent'], ['محل', 'storefront'], ['تجاري', 'storefront'],
            ['مكتب', 'briefcase'], ['عمارة', 'building-apartment'], ['دور', 'stairs'], ['شاليه', 'umbrella-simple'],
            ['مستودع', 'warehouse'], ['معرض', 'storefront'], ['برج', 'building-office'], ['بيت', 'house'], ['منزل', 'house']
        ];
        for (var i = 0; i < map.length; i++) if (n.indexOf(map[i][0]) !== -1) return 'ph-' + map[i][1];
        return 'ph-buildings';
    }

    function ytId(url) {
        if (!url) return null;
        var m = String(url).match(/(?:youtu\.be\/|youtube\.com(?:\/embed\/|\/v\/|\/watch\?v=|\/watch\?.+&v=))([^"&?\/\s]{11})/);
        return m ? m[1] : null;
    }

    function mapQuery(p) {
        var lat = parseFloat(p.latitude), lng = parseFloat(p.longitude);
        if (!isNaN(lat) && !isNaN(lng) && lat && lng) {
            if (Math.abs(lat - 24.7136) > 0.01 || Math.abs(lng - 46.6753) > 0.01) return lat + ',' + lng;
        }
        if (p.location) return encodeURIComponent(p.location);
        return null;
    }
    function mapsEmbed(q) { return 'https://maps.google.com/maps?q=' + q + '&z=15&output=embed&hl=ar'; }
    function mapsLink(q) { return 'https://www.google.com/maps/search/?api=1&query=' + q; }
    function mapsDir(q) { return 'https://www.google.com/maps/dir/?api=1&destination=' + q; }

    function shortPrice(p) {
        var n = num(p.price);
        if (!n) return p.price || '—';
        if (n >= 1000000) { var m = n / 1000000; return (m % 1 ? m.toFixed(1) : m) + ' م'; }
        if (n >= 1000) return Math.round(n / 1000) + ' ألف';
        return String(n);
    }

    function byId(id) { return state.properties.find(function (x) { return String(x.id) === String(id); }); }

    function loadLocal() {
        try { state.favorites = JSON.parse(localStorage.getItem(LS_FAV) || '[]').map(String); } catch (e) { state.favorites = []; }
    }
    function saveFav() { try { localStorage.setItem(LS_FAV, JSON.stringify(state.favorites)); } catch (e) {} }

    function countUp(el, to) {
        if (REDUCE || !to) { el.textContent = to; return; }
        var start = performance.now(), dur = 1100;
        (function f(t) {
            var k = Math.min(1, (t - start) / dur);
            k = 1 - Math.pow(1 - k, 4);
            el.textContent = Math.round(to * k);
            if (k < 1) requestAnimationFrame(f);
        })(start);
    }

    /* ============================================================
       الإقلاع
       ============================================================ */
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init, { once: true });
    else init();

    async function init() {
        var t0 = Date.now();
        setTimeout(hideSplash, 6000); // شبكة بطيئة: لا تعلّق الشاشة
        loadLocal();
        bindEvents();
        setNav('home', true);
        renderSkeletons();
        renderFavoritesCount();
        renderUser();
        startPlaceholder();
        refreshAuth();

        await Promise.all([loadCategories(), loadProperties()]);
        state.loaded = true;
        applyFilters();

        setTimeout(hideSplash, Math.max(0, 1300 - (Date.now() - t0)));
    }

    function hideSplash() {
        if (splashDone) return;
        splashDone = true;
        var s = $('splash');
        if (s) { s.classList.add('hide'); setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 800); }
        document.body.classList.add('ready');
        if (hasGsap()) {
            gsap.from('.app-header', { y: -40, opacity: 0, duration: .8, ease: 'power3.out', clearProps: 'all' });
            gsap.from('.bottom-nav', { y: 90, opacity: 0, duration: .9, ease: 'back.out(1.5)', delay: .35, clearProps: 'transform,opacity' });
        }
    }

    async function loadCategories() {
        if (!window.db) { state.categories = []; return; }
        try {
            var res = await window.db.from('property_categories').select('*').order('sort_order');
            state.categories = (res.data && res.data.length) ? res.data : [];
        } catch (e) { state.categories = []; }
    }

    async function loadProperties() {
        if (!window.db) { state.properties = []; return; }
        try {
            var res = await window.db.from('properties').select('*').order('created_at', { ascending: false });
            if (res.error) throw res.error;
            state.properties = (res.data || []).map(function (row) {
                return {
                    id: row.id,
                    code: row.code || 'غير محدد',
                    title: row.title || '',
                    description: row.description || '',
                    price: row.price || '',
                    type: row.type || '',
                    category: row.category || '',
                    status: row.status || 'available',
                    area: parseInt(row.area, 10) || 0,
                    location: row.location || '',
                    latitude: row.latitude || null,
                    longitude: row.longitude || null,
                    specs: row.specs || [],
                    features: row.features || [],
                    images: (row.images && row.images.length > 0) ? row.images : ['https://via.placeholder.com/800x600?text=No+Image'],
                    videos: row.videos || [],
                    views: row.views || 0,
                    agent: { name: row.agent_name || 'الوكيل', phone: row.agent_phone || '966500000000' },
                    date: row.created_at
                };
            });
        } catch (e) { state.properties = []; }
    }

    /* ============================================================
       الحساب
       ============================================================ */
    async function refreshAuth() {
        var user = null;
        if (window.db && window.db.auth) {
            try {
                var res = await window.db.auth.getSession();
                user = res && res.data && res.data.session && res.data.session.user;
            } catch (e) {}
            try {
                window.db.auth.onAuthStateChange(function (ev, session) { setUser(session && session.user); });
            } catch (e) {}
        }
        setUser(user);
    }

    function setUser(user) {
        if (user) {
            var md = user.user_metadata || {};
            var name = md.full_name || md.name || md.username || (user.email ? user.email.split('@')[0] : 'مستخدم');
            state.user = { name: String(name).trim() || 'مستخدم', email: user.email || '' };
        } else state.user = null;
        renderUser();
    }

    function renderUser() {
        var u = state.user;
        var h = new Date().getHours();
        var g = h < 5 ? 'مساء الخير' : h < 12 ? 'صباح الخير' : h < 17 ? 'طاب يومك' : 'مساء الخير';
        var gEl = $('hero-greeting'); if (gEl) gEl.textContent = g;

        var first = u ? u.name.split(' ')[0].substring(0, 20) : 'زائر';
        var nEl = $('welcome-name'); if (nEl) nEl.textContent = first;

        var initial = u ? (Array.from(u.name)[0] || '؟').toUpperCase() : '';
        var ic = $('profile-btn-icon'), ini = $('profile-btn-initial');
        if (ic && ini) {
            ic.style.display = u ? 'none' : '';
            ini.hidden = !u;
            ini.textContent = initial;
        }

        $('profile-initial').textContent = u ? initial : '؟';
        $('profile-avatar').classList.toggle('guest', !u);
        $('profile-name').textContent = u ? u.name : 'زائر';
        $('profile-email').textContent = u ? u.email : '';
        $('profile-role').textContent = u ? 'أهلاً بعودتك' : 'أنت تتصفح كزائر';
        $('login-link').hidden = !!u;
        $('logout-btn').hidden = !u;
        resetLogoutBtn();
    }

    var logoutTimer = null;
    function resetLogoutBtn() {
        var b = $('logout-btn');
        if (!b) return;
        clearTimeout(logoutTimer);
        b.classList.remove('confirm');
        b.querySelector('span').textContent = 'تسجيل الخروج';
    }

    async function onLogoutClick() {
        var b = $('logout-btn');
        if (!b.classList.contains('confirm')) {
            b.classList.add('confirm');
            b.querySelector('span').textContent = 'اضغط مرة أخرى للتأكيد';
            clearTimeout(logoutTimer);
            logoutTimer = setTimeout(resetLogoutBtn, 3500);
            return;
        }
        resetLogoutBtn();
        try {
            if (window.db && window.db.auth) await window.db.auth.signOut();
        } catch (e) { toast('تعذر تسجيل الخروج', 'error'); return; }
        setUser(null);
        closeSheet('profile-sheet');
        toast('تم تسجيل الخروج', 'success');
    }

    function openProfile() {
        renderProfileFavs(true);
        updateProfileCounts();
        openSheet('profile-sheet');
        if (hasGsap()) {
            gsap.from('.profile-hero, .pstat', { y: 26, opacity: 0, duration: .6, stagger: .07, ease: 'power3.out', delay: .12, clearProps: 'all' });
        }
    }

    function updateProfileCounts() {
        $('pf-fav-count').textContent = state.favorites.length;
        $('pf-cmp-count').textContent = state.compare.length;
    }

    function renderProfileFavs(animate) {
        var body = $('favorites-body');
        var list = state.properties.filter(function (p) { return state.favorites.indexOf(String(p.id)) !== -1; });
        if (!list.length) {
            body.innerHTML = '<div class="drawer-empty"><div class="e-ico"><i class="ph-fill ph-heart"></i></div><p>لا توجد عقارات في المفضلة بعد</p><small>اضغط على القلب في أي عقار لحفظه هنا</small></div>';
            return;
        }
        body.innerHTML = list.map(function (p) {
            return '<div class="fav-item" data-fav-open="' + esc(p.id) + '"><img src="' + esc(p.images[0]) + '" alt="">' +
                '<div class="fav-info"><div class="fav-title">' + esc(p.title) + '</div><div class="fav-price">' + esc(p.price) + '</div></div>' +
                '<button class="fav-remove" data-act="fav" data-id="' + esc(p.id) + '" aria-label="إزالة"><i class="ph ph-heart-break"></i></button></div>';
        }).join('');
        body.querySelectorAll('[data-fav-open]').forEach(function (el) {
            el.onclick = function (e) {
                if (e.target.closest('[data-act]')) return;
                closeSheet('profile-sheet');
                openPreview(el.dataset.favOpen);
            };
        });
        if (animate && hasGsap()) {
            gsap.from('.fav-item', { x: 40, opacity: 0, duration: .55, stagger: .06, ease: 'power3.out', delay: .25, clearProps: 'all' });
        }
    }

    /* ============================================================
       الأوراق والقفل والتنقل
       ============================================================ */
    function isOpen(id) { var e = $(id); return !!(e && e.classList.contains('open')); }

    function syncLock() {
        var anySheet = SHEETS.some(isOpen);
        var prev = $('preview-overlay').classList.contains('open');
        document.body.classList.toggle('locked', anySheet || prev);
        $('backdrop').classList.toggle('show', anySheet);
        setNav(isOpen('profile-sheet') ? 'profile' : (state.view === 'map' ? 'map' : 'home'));
    }
    function openSheet(id) { $(id).classList.add('open'); syncLock(); }
    function closeSheet(id) {
        var e = $(id); if (e) e.classList.remove('open');
        if (id === 'profile-sheet') resetLogoutBtn();
        syncLock();
    }
    function closeAllSheets() { SHEETS.forEach(function (id) { var e = $(id); if (e) e.classList.remove('open'); }); resetLogoutBtn(); syncLock(); }

    function setNav(name, instant) {
        var nav = $('bottom-nav'), pill = $('nav-pill'), target = null;
        if (!nav || !pill) return;
        nav.querySelectorAll('.nav-item[data-nav]').forEach(function (b) {
            var on = b.dataset.nav === name;
            var wasOn = b.classList.contains('active');
            b.classList.toggle('active', on);
            var i = b.querySelector('i');
            if (on !== wasOn || instant) i.className = (on ? 'ph-fill' : 'ph') + ' ph-' + b.dataset.icon;
            if (on) target = b;
        });
        if (!target) return;
        pill.style.width = target.offsetWidth + 'px';
        pill.style.transform = 'translateX(' + target.offsetLeft + 'px)';
        if (instant) requestAnimationFrame(function () { requestAnimationFrame(function () { pill.classList.add('anim'); }); });
    }

    /* ============================================================
       الأحداث
       ============================================================ */
    function bindEvents() {
        var si = $('search-input');
        si.addEventListener('input', onSearchInput);
        si.addEventListener('focus', onSearchInput);
        $('search-clear').onclick = clearSearch;

        $('favorites-btn').onclick = openProfile;
        $('profile-btn').onclick = openProfile;
        $('profile-close').onclick = function () { closeSheet('profile-sheet'); };
        $('logout-btn').onclick = onLogoutClick;

        $('filter-toggle-btn').onclick = openFilters;
        $('filter-sheet-close').onclick = function () { closeSheet('filter-sheet'); };
        $('filter-apply-btn').onclick = applyFiltersFromSheet;
        $('filter-reset-btn').onclick = resetFilters;
        $('backdrop').onclick = closeAllSheets;

        $('sort-btn').onclick = function (e) { e.stopPropagation(); $('sort-menu').classList.toggle('open'); };
        document.querySelectorAll('#sort-menu button').forEach(function (b) { b.onclick = function () { setSort(b.dataset.sort); }; });
        document.addEventListener('click', function (e) {
            if (!e.target.closest('.sort-dropdown')) $('sort-menu').classList.remove('open');
            if (!e.target.closest('.search-wrap')) $('search-suggestions').classList.remove('show');
        });

        document.querySelectorAll('.view-btn').forEach(function (b) { b.onclick = function () { setView(b.dataset.view); }; });

        $('compare-open-btn').onclick = function () { openCompare(); };
        $('compare-clear-btn').onclick = clearCompare;
        $('compare-close').onclick = function () { closeSheet('compare-modal'); };

        $('preview-close').onclick = function () { closePreview(); };
        $('share-close').onclick = function () { closeSheet('share-modal'); };
        document.querySelectorAll('.share-option').forEach(function (b) { b.onclick = function () { doShare(b.dataset.type); }; });
        $('inquiry-close').onclick = closeInquiry;
        $('inquiry-cancel').onclick = closeInquiry;
        $('inquiry-submit').onclick = submitInquiry;

        document.querySelectorAll('.nav-item[data-nav]').forEach(function (b) {
            b.onclick = function () {
                var n = b.dataset.nav;
                if (n === 'home') goHome();
                else if (n === 'map') { closeAllSheets(); closePreview(); setView('map'); window.scrollTo({ top: 0, behavior: 'smooth' }); }
                else if (n === 'profile') { if (isOpen('profile-sheet')) closeSheet('profile-sheet'); else openProfile(); }
            };
        });
        window.addEventListener('resize', function () {
            setNav(isOpen('profile-sheet') ? 'profile' : (state.view === 'map' ? 'map' : 'home'), true);
            fitMapFrame();
        });
        $('map-fit').onclick = function () {
            if (!state.map) return;
            if (state.mapBounds && state.mapBounds.length) { try { state.map.fitBounds(state.mapBounds, { padding: [40, 40], maxZoom: 14, animate: true }); } catch (e) {} }
            else state.map.setView([24.7136, 46.6753], 6);
        };

        var logo = $('home-logo-btn');
        logo.onclick = goHome;
        logo.onkeydown = function (e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); goHome(); } };

        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return;
            if (SHEETS.some(isOpen)) closeAllSheets(); else closePreview();
        });

        // نقطة اللمس — منها تنفتح دائرة التفاصيل
        document.addEventListener('pointerdown', function (e) {
            lastPt = { x: e.clientX, y: e.clientY };
            ripple(e);
        }, true);

        bindScroll();
        bindPreviewScroll();
        bindTilt();

        window.addEventListener('popstate', function () { closePreview(true); });
        document.addEventListener('click', onGlobalClick);
        document.addEventListener('click', function (e) {
            var b = e.target.closest && e.target.closest('[data-popup-open]');
            if (b) { if (state.map) state.map.closePopup(); openPreview(b.dataset.popupOpen); }
        });
    }

    function goHome() {
        closeAllSheets();
        closePreview();
        if (state.view !== 'grid') setView('grid');
        try { window.scrollTo({ top: 0, behavior: 'smooth' }); } catch (e) { window.scrollTo(0, 0); }
    }

    function ripple(e) {
        var t = e.target.closest && e.target.closest('.btn, .chip-option, .mini-btn, .toolbar-btn');
        if (!t || REDUCE) return;
        var r = t.getBoundingClientRect();
        var size = Math.max(r.width, r.height) * 2.2;
        var s = document.createElement('span');
        s.className = 'ripple-fx';
        s.style.width = s.style.height = size + 'px';
        s.style.left = (e.clientX - r.left - size / 2) + 'px';
        s.style.top = (e.clientY - r.top - size / 2) + 'px';
        t.appendChild(s);
        setTimeout(function () { if (s.parentNode) s.parentNode.removeChild(s); }, 700);
    }

    function onGlobalClick(e) {
        var t = e.target;
        if (!t.closest) return;

        var actEl = t.closest('[data-act]');
        if (actEl) {
            e.preventDefault(); e.stopPropagation();
            var a = actEl.dataset.act, id = actEl.dataset.id;
            if (a === 'fav') toggleFavorite(id, actEl);
            else if (a === 'compare') toggleCompare(id);
            else if (a === 'share') openShare(id);
            else if (a === 'inquiry') openInquiry(id);
            else if (a === 'map') { var p = byId(id), q = p && mapQuery(p); if (q) window.open(mapsLink(q), '_blank'); else toast('لا يوجد موقع محدد لهذا العقار', 'error'); }
            else if (a === 'directions') { var p2 = byId(id), q2 = p2 && mapQuery(p2); if (q2) window.open(mapsDir(q2), '_blank'); }
            else if (a === 'cat') { state.filters.category = id; applyFilters(); }
            else if (a === 'reset') resetFilters();
            return;
        }

        var chip = t.closest('.chip-option[data-val]');
        if (chip) {
            var group = chip.parentNode;
            var wasActive = chip.classList.contains('active');
            group.querySelectorAll('.chip-option').forEach(function (c) { c.classList.remove('active'); });
            if (group.id === 'filter-categories') chip.classList.add('active');
            else if (!wasActive) chip.classList.add('active');
            return;
        }

        var card = t.closest('[data-card]');
        if (card) openPreview(card.dataset.card);
    }

    /* ============================================================
       التمرير: ترويسة، تقدّم، بارالاكس
       ============================================================ */
    function bindScroll() {
        var header = $('app-header'), prog = $('scroll-progress'), aurora = $('aurora');
        var lastY = 0, ticking = false;
        function frame() {
            var y = window.scrollY || 0;
            header.classList.toggle('is-scrolled', y > 12);
            var dy = y - lastY;
            if (y > 160 && dy > 5) header.classList.add('is-hidden');
            else if (dy < -5 || y <= 160) header.classList.remove('is-hidden');
            if (Math.abs(dy) > 5) lastY = y;
            var max = document.documentElement.scrollHeight - window.innerHeight;
            prog.style.transform = 'scaleX(' + (max > 0 ? Math.min(1, y / max) : 0) + ')';
            if (!REDUCE) aurora.style.transform = 'translateY(' + (-Math.min(y * .12, 140)) + 'px)';
            ticking = false;
        }
        window.addEventListener('scroll', function () { if (!ticking) { ticking = true; requestAnimationFrame(frame); } }, { passive: true });
    }

    function bindPreviewScroll() {
        var pc = document.querySelector('.preview-content');
        var ticking = false;
        pc.addEventListener('scroll', function () {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(function () {
                var y = pc.scrollTop;
                var g = pc.querySelector('.gallery');
                if (g) g.style.setProperty('--sy', y);
                var gh = g ? g.offsetHeight : 300;
                $('topbar-price').classList.toggle('show', y > gh - 90);
                ticking = false;
            });
        }, { passive: true });
    }

    function bindTilt() {
        if (!window.matchMedia || !window.matchMedia('(hover:hover) and (pointer:fine)').matches || REDUCE) return;
        var cur = null;
        function reset(c) { c.style.setProperty('--rx', '0deg'); c.style.setProperty('--ry', '0deg'); }
        document.addEventListener('mousemove', function (e) {
            var c = e.target.closest ? e.target.closest('.p-card') : null;
            if (cur && cur !== c) reset(cur);
            cur = c;
            if (!c) return;
            var r = c.getBoundingClientRect();
            var px = (e.clientX - r.left) / r.width - .5, py = (e.clientY - r.top) / r.height - .5;
            c.style.setProperty('--ry', (px * 9).toFixed(2) + 'deg');
            c.style.setProperty('--rx', (-py * 9).toFixed(2) + 'deg');
            c.style.setProperty('--gx', ((px + .5) * 100).toFixed(1) + '%');
            c.style.setProperty('--gy', ((py + .5) * 100).toFixed(1) + '%');
        });
    }

    function startPlaceholder() {
        var input = $('search-input');
        var base = input.placeholder;
        var phrases = ['فيلا في الرياض', 'شقة للإيجار', 'أرض تجارية', 'مزرعة قريبة', 'رمز العقار'];
        var pi = 0, ci = 0;
        if (REDUCE) return;
        (function tick() {
            if (document.activeElement === input || input.value) { input.placeholder = base; ci = 0; return setTimeout(tick, 1500); }
            var ph = phrases[pi];
            if (ci <= ph.length) { input.placeholder = 'ابحث عن ' + ph.slice(0, ci); ci++; setTimeout(tick, 85); }
            else setTimeout(function () { pi = (pi + 1) % phrases.length; ci = 0; tick(); }, 1900);
        })();
    }

    /* ============================================================
       البحث والفلاتر
       ============================================================ */
    function onSearchInput() {
        var v = $('search-input').value;
        state.filters.term = v.trim();
        $('search-clear').classList.toggle('active', v.length > 0);
        showSuggestions(v);
        applyFilters();
    }

    function showSuggestions(term) {
        var box = $('search-suggestions');
        term = term.trim().toLowerCase();
        if (term.length < 2) { box.classList.remove('show'); box.innerHTML = ''; return; }
        var matches = state.properties.filter(function (p) {
            return (p.title || '').toLowerCase().indexOf(term) !== -1 ||
                   (p.location || '').toLowerCase().indexOf(term) !== -1 ||
                   (p.code || '').toLowerCase().indexOf(term) !== -1;
        }).slice(0, 5);
        if (!matches.length) { box.classList.remove('show'); return; }
        box.innerHTML = matches.map(function (p) {
            return '<button class="suggestion-item" data-suggest="' + esc(p.id) + '"><i class="ph ph-house-line"></i>' +
                '<div class="suggestion-text"><b>' + esc(p.title) + '</b><small>' + esc(p.location) + '</small></div></button>';
        }).join('');
        box.classList.add('show');
        box.querySelectorAll('[data-suggest]').forEach(function (b) {
            b.onclick = function () { box.classList.remove('show'); openPreview(b.dataset.suggest); };
        });
    }

    function clearSearch() {
        $('search-input').value = '';
        state.filters.term = '';
        $('search-clear').classList.remove('active');
        $('search-suggestions').classList.remove('show');
        applyFilters();
    }

    function applyFilters() {
        var f = state.filters;
        var result = state.properties.filter(function (p) {
            if (f.category !== 'all' && p.type !== f.category) return false;
            if (f.transaction && p.category !== f.transaction) return false;
            var price = num(p.price);
            if (f.minPrice && price < f.minPrice) return false;
            if (f.maxPrice && price > f.maxPrice) return false;
            if (f.minArea && p.area < f.minArea) return false;
            if (f.maxArea && p.area > f.maxArea) return false;
            if (f.term) {
                var hay = (p.title + ' ' + p.location + ' ' + p.code + ' ' + p.description).toLowerCase();
                if (hay.indexOf(f.term.toLowerCase()) === -1) return false;
            }
            return true;
        });

        result.sort(function (a, b) {
            switch (state.sort) {
                case 'price-asc': return num(a.price) - num(b.price);
                case 'price-desc': return num(b.price) - num(a.price);
                case 'area-asc': return a.area - b.area;
                case 'area-desc': return b.area - a.area;
                default: return new Date(b.date || 0) - new Date(a.date || 0);
            }
        });

        state.filtered = result;
        renderCats();
        renderStats();
        renderFeatured();
        renderResults();
        updateActiveFiltersCount();
    }

    function applyFiltersFromSheet() {
        state.filters.minPrice = parseInt($('filter-min-price').value, 10) || 0;
        state.filters.maxPrice = parseInt($('filter-max-price').value, 10) || 0;
        state.filters.minArea = parseInt($('filter-min-area').value, 10) || 0;
        state.filters.maxArea = parseInt($('filter-max-area').value, 10) || 0;
        var tr = document.querySelector('#filter-transactions .chip-option.active');
        state.filters.transaction = tr ? tr.dataset.val : '';
        var ct = document.querySelector('#filter-categories .chip-option.active');
        state.filters.category = ct ? ct.dataset.val : 'all';
        applyFilters();
        closeSheet('filter-sheet');
        toast('تم تطبيق الفلاتر', 'success');
    }

    function resetFilters() {
        state.filters = { category: 'all', transaction: '', minPrice: 0, maxPrice: 0, minArea: 0, maxArea: 0, term: state.filters.term };
        ['filter-min-price', 'filter-max-price', 'filter-min-area', 'filter-max-area'].forEach(function (id) { $(id).value = ''; });
        document.querySelectorAll('#filter-transactions .chip-option').forEach(function (b) { b.classList.remove('active'); });
        document.querySelectorAll('#filter-categories .chip-option').forEach(function (b) { b.classList.toggle('active', b.dataset.val === 'all'); });
        applyFilters();
        toast('تم إعادة التعيين');
    }

    function updateActiveFiltersCount() {
        var f = state.filters, c = 0;
        if (f.category !== 'all') c++;
        if (f.transaction) c++;
        if (f.minPrice || f.maxPrice) c++;
        if (f.minArea || f.maxArea) c++;
        var el = $('active-filters-count');
        el.textContent = c; el.hidden = c === 0;
    }

    function hasActiveFilters() {
        var f = state.filters;
        return f.category !== 'all' || f.transaction || f.minPrice || f.maxPrice || f.minArea || f.maxArea || f.term;
    }

    function openFilters() {
        var box = $('filter-categories');
        box.innerHTML = '<button class="chip-option' + (state.filters.category === 'all' ? ' active' : '') + '" data-val="all">الكل</button>' +
            state.categories.map(function (c) {
                return '<button class="chip-option' + (state.filters.category === c.name ? ' active' : '') + '" data-val="' + esc(c.name) + '"><i class="ph ' + catIcon(c.name) + '"></i> ' + esc(c.name) + '</button>';
            }).join('');
        document.querySelectorAll('#filter-transactions .chip-option').forEach(function (b) { b.classList.toggle('active', b.dataset.val === state.filters.transaction); });
        $('filter-min-price').value = state.filters.minPrice || '';
        $('filter-max-price').value = state.filters.maxPrice || '';
        $('filter-min-area').value = state.filters.minArea || '';
        $('filter-max-area').value = state.filters.maxArea || '';
        openSheet('filter-sheet');
    }

    function setSort(mode) {
        state.sort = mode;
        var labels = { 'newest': 'الأحدث', 'price-asc': 'السعر ↑', 'price-desc': 'السعر ↓', 'area-asc': 'المساحة ↑', 'area-desc': 'المساحة ↓' };
        $('sort-label').textContent = labels[mode] || 'الأحدث';
        document.querySelectorAll('#sort-menu button').forEach(function (b) { b.classList.toggle('active', b.dataset.sort === mode); });
        $('sort-menu').classList.remove('open');
        applyFilters();
    }

    function setView(mode) {
        state.view = mode;
        document.querySelectorAll('.view-btn').forEach(function (b) { b.classList.toggle('active', b.dataset.view === mode); });
        var isMap = mode === 'map';
        document.body.classList.toggle('map-mode', isMap);
        $('properties-container').style.display = isMap ? 'none' : '';
        $('map-frame').style.display = isMap ? 'block' : 'none';
        $('featured-section').style.display = isMap ? 'none' : '';
        if (isMap) {
            window.scrollTo(0, 0);
            requestAnimationFrame(function () { fitMapFrame(); renderMap(); });
        } else { renderResults(); renderFeatured(); }
        syncLock();
    }

    // يضبط ارتفاع إطار الخريطة ليملأ المساحة المتبقية بين الأدوات والشريط السفلي في أي هاتف
    function fitMapFrame() {
        var fr = $('map-frame');
        if (!fr || state.view !== 'map' || fr.style.display === 'none') return;
        fr.classList.toggle('has-compare', !$('compare-bar').hidden);
        var top = fr.getBoundingClientRect().top + (window.scrollY || 0);
        var mb = parseFloat(getComputedStyle(fr).marginBottom) || 0;
        var vh = (window.visualViewport && window.visualViewport.height) || window.innerHeight;
        fr.style.height = Math.max(260, Math.round(vh - top - mb)) + 'px';
        if (state.map) state.map.invalidateSize();
    }

    /* ============================================================
       العرض
       ============================================================ */
    function renderSkeletons() {
        $('properties-container').innerHTML = '<div class="skeleton"></div><div class="skeleton"></div><div class="skeleton"></div>';
    }

    function renderStats() {
        var box = $('hero-stats');
        var avail = state.properties.filter(function (p) { return p.status === 'available'; }).length;
        var key = avail + '|' + state.categories.length;
        if (state.statKey === key) return;
        state.statKey = key;
        box.innerHTML =
            '<span class="stat-pill"><i class="ph-fill ph-buildings"></i><b data-n="' + avail + '">0</b> عقار متاح</span>' +
            '<span class="stat-pill"><i class="ph-fill ph-squares-four"></i><b data-n="' + state.categories.length + '">0</b> تصنيف</span>';
        setTimeout(function () {
            box.querySelectorAll('b[data-n]').forEach(function (b) { countUp(b, parseInt(b.dataset.n, 10) || 0); });
        }, 750);
    }

    function renderCats() {
        var box = $('filter-chips');
        var counts = { all: state.properties.length };
        state.categories.forEach(function (c) { counts[c.name] = 0; });
        state.properties.forEach(function (p) { if (counts[p.type] !== undefined) counts[p.type]++; });

        var sig = JSON.stringify(counts);
        if (sig !== state.catSig) {
            var first = !state.catSig;
            state.catSig = sig;
            var i = 0;
            var tile = function (val, label, icon, count) {
                return '<button class="cat-tile' + (first ? ' pop' : '') + '" style="--i:' + (i++) + '" data-act="cat" data-id="' + esc(val) + '">' +
                    '<span class="cat-ico"><i class="ph ' + icon + '"></i></span>' +
                    '<span class="cat-label">' + esc(label) + '</span><span class="cat-count">' + count + '</span></button>';
            };
            box.innerHTML = tile('all', 'الكل', 'ph-squares-four', counts.all) +
                state.categories.map(function (c) { return tile(c.name, c.name, catIcon(c.name), counts[c.name] || 0); }).join('');
        }

        var activeEl = null;
        box.querySelectorAll('.cat-tile').forEach(function (t) {
            var on = t.dataset.id === state.filters.category;
            if (on && !t.classList.contains('active')) activeEl = t;
            t.classList.toggle('active', on);
        });
        if (activeEl && state.loaded) { try { activeEl.scrollIntoView({ inline: 'center', block: 'nearest', behavior: 'smooth' }); } catch (e) {} }
    }

    function renderFeatured() {
        var sec = $('featured-section');
        if (state.view === 'map') return;
        var items = state.properties.filter(function (p) { return p.status === 'available'; }).slice(0, 8);
        if (hasActiveFilters() || items.length < 2) { sec.hidden = true; return; }

        var sig = items.map(function (p) { return p.id; }).join(',');
        if (sig === state.featSig && state.featSwiper) { sec.hidden = false; return; }
        state.featSig = sig;
        if (state.featSwiper) { try { state.featSwiper.destroy(true, true); } catch (e) {} state.featSwiper = null; }
        sec.hidden = false;

        $('feat-wrapper').innerHTML = items.map(function (p) {
            return '<div class="swiper-slide feat-slide"><article class="feat-card" data-card="' + esc(p.id) + '">' +
                '<img src="' + esc(p.images[0]) + '" alt="" loading="lazy" onerror="this.src=\'https://via.placeholder.com/400x500\'">' +
                '<div class="feat-top"><span class="chip-glass glass">' + esc(p.type) + '</span>' +
                '<span class="chip-glass glass">' + esc(p.category) + '</span></div>' +
                '<div class="feat-info"><div class="feat-price">' + esc(p.price) + '</div>' +
                '<div class="feat-title">' + esc(p.title) + '</div>' +
                '<div class="feat-loc"><i class="ph ph-map-pin"></i><span>' + esc(p.location) + '</span></div></div>' +
            '</article></div>';
        }).join('');

        if (typeof Swiper === 'undefined') return;
        function fx(sw) {
            sw.slides.forEach(function (s) {
                var pr = Math.max(-1.5, Math.min(1.5, s.progress));
                var card = s.firstElementChild, img = card && card.querySelector('img');
                if (!card) return;
                var k = Math.min(1, Math.abs(pr));
                card.style.transform = 'scale(' + (1 - k * .09) + ')';
                card.style.opacity = String(1 - k * .35);
                if (img) img.style.transform = 'translateX(' + (pr * 34) + 'px)';
            });
        }
        state.featSwiper = new Swiper('#feat-swiper', {
            slidesPerView: 'auto', spaceBetween: 12, centeredSlides: true, grabCursor: true,
            watchSlidesProgress: true, resistanceRatio: .6, speed: 500,
            on: { init: fx, progress: fx, setTranslate: fx, resize: fx }
        });
    }

    function renderResults() {
        $('results-count').textContent = state.filtered.length + ' عقار';
        if (state.view === 'map') { renderMap(); return; }
        var box = $('properties-container');

        var sig = state.filtered.map(function (p) { return p.id; }).join(',');
        if (sig === state.lastSig && box.children.length && !box.querySelector('.skeleton')) return;
        state.lastSig = sig;

        if (state.filtered.length === 0) {
            box.innerHTML = '<div class="empty-results"><div class="e-ico"><i class="ph ph-house-simple"></i></div>' +
                '<h3>لا توجد نتائج</h3><p>جرّب تعديل البحث أو الفلاتر</p>' +
                '<button class="btn btn-primary" data-act="reset"><i class="ph ph-arrow-counter-clockwise"></i> إعادة تعيين</button></div>';
            return;
        }

        box.innerHTML = state.filtered.map(cardHtml).join('');
        observeReveal(box);
    }

    function observeReveal(box) {
        var cards = box.querySelectorAll('.p-card');
        if (revealIO) { revealIO.disconnect(); revealIO = null; }
        if (!('IntersectionObserver' in window) || REDUCE) { cards.forEach(function (c) { c.classList.add('in'); }); return; }
        revealIO = new IntersectionObserver(function (entries) {
            var vis = entries.filter(function (e) { return e.isIntersecting; });
            vis.forEach(function (e, i) {
                e.target.style.setProperty('--d', (i * 80) + 'ms');
                e.target.classList.add('in');
                revealIO.unobserve(e.target);
            });
        }, { threshold: .06, rootMargin: '0px 0px -30px 0px' });
        cards.forEach(function (c) { revealIO.observe(c); });
    }

    function cardHtml(p) {
        var isFav = state.favorites.indexOf(String(p.id)) !== -1;
        var inCmp = state.compare.indexOf(String(p.id)) !== -1;
        var closed = p.status === 'sold' || p.status === 'rented';
        var media = (p.images || []).length + (p.videos || []).length;
        var tags = [];
        if (p.area) tags.push('<span class="p-tag"><i class="ph ph-ruler"></i>' + p.area + ' م²</span>');
        (p.features || []).slice(0, 2).forEach(function (f) {
            tags.push('<span class="p-tag"><i class="ph ' + amenityIcon(f) + '"></i>' + esc(amenityLabel(f)) + '</span>');
        });

        return '<article class="p-card reveal' + (closed ? ' is-closed' : '') + '" data-card="' + esc(p.id) + '">' +
            '<div class="p-img">' +
                '<img src="' + esc(p.images[0]) + '" alt="" loading="lazy" onerror="this.src=\'https://via.placeholder.com/400x300\'">' +
                '<span class="p-badge glass">' + esc(p.type) + '</span>' +
                (media > 1 ? '<span class="p-media glass"><i class="ph ph-images"></i>' + media + '</span>' : '') +
                '<span class="p-price">' + esc(p.price) + '</span>' +
                (closed ? '<div class="stamp status-' + p.status + '"><span>' + STATUS_LABELS[p.status].label + '</span></div>' : '') +
                '<button class="p-fav glass' + (isFav ? ' on' : '') + '" data-act="fav" data-id="' + esc(p.id) + '" aria-label="المفضلة"><i class="ph' + (isFav ? '-fill' : '') + ' ph-heart"></i></button>' +
            '</div>' +
            '<div class="p-body">' +
                '<h3 class="p-title">' + esc(p.title) + '</h3>' +
                '<div class="p-loc"><i class="ph ph-map-pin"></i><span>' + esc(p.location) + '</span></div>' +
                (tags.length ? '<div class="p-meta">' + tags.join('') + '</div>' : '') +
                '<div class="p-footer">' +
                    '<span class="deal-badge ' + (p.category === 'للإيجار' ? 'for-rent' : 'for-sale') + '">' + esc(p.category) + '</span>' +
                    '<div class="p-actions">' +
                        '<button class="mini-btn' + (inCmp ? ' on-compare' : '') + '" data-act="compare" data-id="' + esc(p.id) + '" aria-label="مقارنة"><i class="ph ph-scales"></i></button>' +
                        '<button class="mini-btn" data-act="map" data-id="' + esc(p.id) + '" aria-label="الموقع"><i class="ph ph-map-pin-line"></i></button>' +
                        '<button class="mini-btn" data-act="share" data-id="' + esc(p.id) + '" aria-label="مشاركة"><i class="ph ph-share-network"></i></button>' +
                    '</div>' +
                '</div>' +
            '</div>' +
        '</article>';
    }

    // تحديث حالة القلب والمقارنة على البطاقات دون إعادة بنائها
    function syncCardStates() {
        document.querySelectorAll('.p-card').forEach(function (card) {
            var id = card.dataset.card;
            var fav = state.favorites.indexOf(id) !== -1;
            var cmp = state.compare.indexOf(id) !== -1;
            var f = card.querySelector('.p-fav');
            if (f) { f.classList.toggle('on', fav); f.querySelector('i').className = 'ph' + (fav ? '-fill' : '') + ' ph-heart'; }
            var c = card.querySelector('[data-act="compare"]');
            if (c) c.classList.toggle('on-compare', cmp);
        });
    }

    /* ============================================================
       المفضلة
       ============================================================ */
    function burst(el) {
        if (!hasGsap() || !el) return;
        var r = el.getBoundingClientRect();
        var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
        for (var i = 0; i < 11; i++) {
            (function (i) {
                var s = document.createElement('i');
                s.className = 'ph-fill ph-heart fx-heart';
                s.style.left = cx + 'px'; s.style.top = cy + 'px';
                s.style.fontSize = (11 + Math.random() * 11) + 'px';
                s.style.color = i % 3 === 0 ? '#FFC56B' : (i % 3 === 1 ? '#FF6B81' : '#60A5FA');
                document.body.appendChild(s);
                var a = Math.PI * 2 * i / 11 + Math.random() * .5, d = 40 + Math.random() * 42;
                gsap.fromTo(s, { x: 0, y: 0, xPercent: -50, yPercent: -50, scale: .3, opacity: 1 },
                    { x: Math.cos(a) * d, y: Math.sin(a) * d - 12, scale: 1, opacity: 0, rotation: (Math.random() - .5) * 100,
                      duration: .85 + Math.random() * .3, ease: 'power2.out',
                      onComplete: function () { if (s.parentNode) s.parentNode.removeChild(s); } });
            })(i);
        }
    }

    function toggleFavorite(id, srcEl) {
        id = String(id);
        var i = state.favorites.indexOf(id);
        if (i === -1) { state.favorites.push(id); burst(srcEl); toast('أضيف إلى مفضلتك', 'success'); }
        else { state.favorites.splice(i, 1); toast('أُزيل من المفضلة'); }
        saveFav();
        renderFavoritesCount();
        syncCardStates();
        renderProfileFavs(false);
        syncPreviewButtons(id);
    }

    function renderFavoritesCount() {
        var el = $('fav-count');
        var c = state.favorites.length;
        if (el.textContent !== String(c) || el.hidden === (c > 0)) {
            el.textContent = c; el.hidden = c === 0;
            el.style.animation = 'none'; void el.offsetWidth; el.style.animation = '';
        }
        updateProfileCounts();
    }

    /* ============================================================
       المقارنة
       ============================================================ */
    function toggleCompare(id) {
        id = String(id);
        var i = state.compare.indexOf(id);
        if (i !== -1) { state.compare.splice(i, 1); toast('أُزيل من المقارنة'); }
        else {
            if (state.compare.length >= MAX_COMPARE) { toast('الحد الأقصى 3 عقارات', 'error'); return; }
            state.compare.push(id); toast('أضيف للمقارنة', 'success');
        }
        renderCompareBar();
        syncCardStates();
        syncPreviewButtons(id);
        updateProfileCounts();
        if (isOpen('compare-modal')) {
            if (state.compare.length) openCompare(true); else closeSheet('compare-modal');
        }
    }

    function renderCompareBar() {
        var bar = $('compare-bar');
        if (!state.compare.length) { bar.hidden = true; fitMapFrame(); return; }
        bar.hidden = false;
        $('compare-thumbs').innerHTML = state.compare.map(function (id) {
            var p = byId(id);
            return '<img src="' + esc(p ? p.images[0] : '') + '" alt="">';
        }).join('');
        fitMapFrame();
    }

    function clearCompare() {
        state.compare = [];
        renderCompareBar(); syncCardStates(); updateProfileCounts();
        if (currentPreviewId) syncPreviewButtons(currentPreviewId);
        toast('تم مسح المقارنة');
    }

    function openCompare(silent) {
        if (!state.compare.length) { toast('أضف عقارات للمقارنة', 'error'); return; }
        var props = state.compare.map(byId).filter(Boolean);
        var rows = [
            ['الصورة', function (p) { return '<img src="' + esc(p.images[0]) + '" alt="">'; }],
            ['السعر', function (p) { return '<strong>' + esc(p.price) + '</strong>'; }],
            ['الرمز', function (p) { return esc(p.code); }],
            ['التصنيف', function (p) { return esc(p.type); }],
            ['العملية', function (p) { return esc(p.category); }],
            ['المساحة', function (p) { return p.area + ' م²'; }],
            ['الموقع', function (p) { return esc(p.location); }],
            ['الحالة', function (p) { return (STATUS_LABELS[p.status] || STATUS_LABELS.available).label; }],
            ['المرافق', function (p) { return (p.features || []).map(function (f) { return '<span class="compare-amenity">' + esc(amenityLabel(f)) + '</span>'; }).join('') || '—'; }]
        ];
        var html = '<table class="compare-table"><thead><tr><th></th>';
        props.forEach(function (p) {
            html += '<th><div class="compare-col-head"><h4>' + esc(p.title) + '</h4><button class="compare-remove-btn" data-act="compare" data-id="' + esc(p.id) + '"><i class="ph-bold ph-x"></i></button></div></th>';
        });
        html += '</tr></thead><tbody>';
        rows.forEach(function (r) {
            html += '<tr><td class="compare-label-cell">' + r[0] + '</td>';
            props.forEach(function (p) { html += '<td>' + r[1](p) + '</td>'; });
            html += '</tr>';
        });
        $('compare-grid').innerHTML = html + '</tbody></table>';
        if (silent !== true) openSheet('compare-modal');
    }

    /* ============================================================
       صفحة التفاصيل
       ============================================================ */
    var currentPreviewId = null;
    var previewPushed = false;

    function syncPreviewButtons(id) {
        if (String(currentPreviewId) !== String(id) || !$('preview-overlay').classList.contains('open')) return;
        var f = state.favorites.indexOf(String(id)) !== -1;
        var fb = $('preview-favorite-btn');
        fb.classList.toggle('active', f);
        fb.querySelector('i').className = 'ph' + (f ? '-fill' : '') + ' ph-heart';
        $('preview-compare-btn').classList.toggle('active-compare', state.compare.indexOf(String(id)) !== -1);
    }

    function openPreview(id) {
        var p = byId(id);
        if (!p) return;
        currentPreviewId = String(p.id);
        incrementViews(p.id);

        var closed = p.status === 'sold' || p.status === 'rented';
        var q = mapQuery(p);

        var amen = (p.features && p.features.length)
            ? '<section class="d-section"><h3><i class="ph-fill ph-check-circle"></i> المرافق والخدمات</h3><div class="amen-grid">' +
              p.features.map(function (f) { return '<div class="amen"><i class="ph ' + amenityIcon(f) + '"></i><span>' + esc(amenityLabel(f)) + '</span></div>'; }).join('') +
              '</div></section>' : '';

        var mapHtml = q
            ? '<section class="d-section"><h3><i class="ph-fill ph-map-pin"></i> موقع العقار</h3>' +
              '<div class="map-box"><iframe src="' + mapsEmbed(q) + '" loading="lazy" allowfullscreen referrerpolicy="no-referrer-when-downgrade"></iframe></div>' +
              '<div class="map-actions"><button class="btn btn-primary" data-act="map" data-id="' + esc(p.id) + '"><i class="ph ph-map-trifold"></i> افتح الخريطة</button>' +
              '<button class="btn btn-outline" data-act="directions" data-id="' + esc(p.id) + '"><i class="ph ph-navigation-arrow"></i> الاتجاهات</button></div></section>' : '';

        var vids = (p.videos && p.videos.length)
            ? '<section class="d-section"><h3><i class="ph-fill ph-play-circle"></i> فيديوهات العقار</h3><div class="videos">' +
              p.videos.map(function (u) {
                  var y = ytId(u);
                  return y ? '<div class="video-box"><iframe src="https://www.youtube.com/embed/' + y + '" allowfullscreen loading="lazy"></iframe></div>'
                           : '<div class="video-box"><video src="' + esc(u) + '" controls preload="metadata" playsinline></video></div>';
              }).join('') + '</div></section>' : '';

        var html =
            '<div class="gallery"><div class="swiper" id="gallery-swiper"><div class="swiper-wrapper">' +
                p.images.map(function (im) { return '<div class="swiper-slide"><img src="' + esc(im) + '" alt="" loading="lazy"></div>'; }).join('') +
            '</div>' + (p.images.length > 1 ? '<div class="swiper-pagination"></div>' : '') + '</div>' +
            (p.images.length > 1 ? '<span class="gallery-counter glass" id="gallery-counter">1 / ' + p.images.length + '</span>' : '') + '</div>' +
            '<div class="details">' +
                (closed ? '<div class="d-status status-' + p.status + '">' + STATUS_LABELS[p.status].label + '</div>' : '') +
                '<div class="d-price">' + esc(p.price) + '</div>' +
                '<h2 class="d-title">' + esc(p.title) + '</h2>' +
                '<div class="d-loc"><i class="ph ph-map-pin"></i>' + esc(p.location) + '</div>' +
                '<div class="d-stats">' +
                    '<div class="d-stat"><i class="ph ph-tag"></i><b>' + esc(p.type || '—') + '</b><small>التصنيف</small></div>' +
                    '<div class="d-stat"><i class="ph ph-ruler"></i><b>' + (p.area ? p.area + ' م²' : '—') + '</b><small>المساحة</small></div>' +
                    '<div class="d-stat"><i class="ph ph-key"></i><b>' + esc(p.category || '—') + '</b><small>العملية</small></div>' +
                '</div>' +
                (p.description ? '<section class="d-section"><h3><i class="ph-fill ph-article"></i> الوصف</h3><p class="d-desc">' + esc(p.description) + '</p></section>' : '') +
                amen + mapHtml + vids +
                '<p class="d-desc" style="text-align:center;font-size:12px;opacity:.7">رمز العقار: ' + esc(p.code) + (p.views ? ' · ' + p.views + ' مشاهدة' : '') + '</p>' +
            '</div>';

        var content = document.querySelector('.preview-content');
        content.innerHTML = html;
        content.scrollTop = 0;
        $('topbar-price').textContent = p.price;
        $('topbar-price').classList.remove('show');

        $('preview-contact').innerHTML =
            '<button class="btn btn-wa" data-act="inquiry" data-id="' + esc(p.id) + '"><i class="ph-fill ph-whatsapp-logo"></i> تواصل مع الوكيل</button>' +
            '<button class="mini-btn" data-act="share" data-id="' + esc(p.id) + '" aria-label="مشاركة"><i class="ph ph-share-network"></i></button>';

        $('preview-favorite-btn').onclick = function () { toggleFavorite(p.id, $('preview-favorite-btn')); };
        $('preview-compare-btn').onclick = function () { toggleCompare(p.id); };
        $('preview-share-btn').onclick = function () { openShare(p.id); };

        if (state.gallerySwiper) { try { state.gallerySwiper.destroy(true, true); } catch (e) {} state.gallerySwiper = null; }
        if (typeof Swiper !== 'undefined') {
            state.gallerySwiper = new Swiper('#gallery-swiper', {
                grabCursor: true, speed: 500,
                pagination: p.images.length > 1 ? { el: '.gallery .swiper-pagination', clickable: true } : false,
                on: { slideChange: function (s) { var c = $('gallery-counter'); if (c) c.textContent = (s.activeIndex + 1) + ' / ' + p.images.length; } }
            });
        }

        // دائرة تتسع من نقطة اللمس
        var o = $('preview-overlay');
        o.style.setProperty('--ox', Math.round(lastPt.x) + 'px');
        o.style.setProperty('--oy', Math.round(lastPt.y) + 'px');
        o.classList.add('open');
        syncPreviewButtons(p.id);
        syncLock();

        if (hasGsap()) {
            gsap.from('.preview-topbar > *', { y: -30, opacity: 0, duration: .6, stagger: .06, ease: 'back.out(1.6)', delay: .3, clearProps: 'all' });
            gsap.from('.details > *', { y: 30, opacity: 0, duration: .7, stagger: .07, ease: 'power3.out', delay: .35, clearProps: 'all' });
            gsap.from('.preview-contact', { y: 80, duration: .7, ease: 'power3.out', delay: .4, clearProps: 'all' });
        }

        if (!previewPushed) { try { history.pushState({ preview: 1 }, ''); previewPushed = true; } catch (e) {} }
    }

    function closePreview(fromPop) {
        var o = $('preview-overlay');
        if (!o.classList.contains('open')) return;
        o.classList.remove('open');
        if (state.gallerySwiper) { try { state.gallerySwiper.destroy(true, true); } catch (e) {} state.gallerySwiper = null; }
        setTimeout(function () { var c = document.querySelector('.preview-content'); if (c && !o.classList.contains('open')) c.innerHTML = ''; }, 700);
        currentPreviewId = null;
        if (!fromPop && previewPushed) { previewPushed = false; try { history.back(); } catch (e) {} }
        else previewPushed = false;
        syncLock();
    }

    async function incrementViews(id) {
        if (!window.db) return;
        try {
            var p = byId(id);
            if (!p) return;
            p.views = (p.views || 0) + 1;
            await window.db.from('properties').update({ views: p.views }).eq('id', id);
        } catch (e) {}
    }

    /* ============================================================
       المشاركة والاستفسار
       ============================================================ */
    var sharePropertyId = null;
    function openShare(id) { sharePropertyId = id; openSheet('share-modal'); }

    function doShare(type) {
        var p = byId(sharePropertyId);
        if (!p) return;
        var url = window.location.href.split('?')[0].split('#')[0] + '?property=' + p.id;
        var text = 'شاهد هذا العقار: ' + p.title + ' - ' + p.price;
        if (type === 'whatsapp') window.open('https://wa.me/?text=' + encodeURIComponent(text + ' ' + url), '_blank');
        else if (type === 'telegram') window.open('https://t.me/share/url?url=' + encodeURIComponent(url) + '&text=' + encodeURIComponent(text), '_blank');
        else if (type === 'link') {
            if (navigator.clipboard) navigator.clipboard.writeText(url).then(function () { toast('تم نسخ الرابط', 'success'); });
        }
        closeSheet('share-modal');
    }

    var inquiryPropertyId = null;
    function openInquiry(id) {
        var p = byId(id);
        if (!p) return;
        inquiryPropertyId = p.id;
        $('inquiry-property-title').textContent = p.title;
        $('inquiry-name').value = state.user ? state.user.name : '';
        $('inquiry-phone').value = '';
        $('inquiry-message').value = 'أنا مهتم بهذا العقار، يرجى التواصل معي.';
        openSheet('inquiry-modal');
    }
    function closeInquiry() { closeSheet('inquiry-modal'); inquiryPropertyId = null; }

    async function submitInquiry() {
        var name = $('inquiry-name').value.trim();
        var phone = $('inquiry-phone').value.trim();
        var message = $('inquiry-message').value.trim();
        if (!name) { toast('أدخل اسمك', 'error'); return; }
        if (!phone || phone.length < 9) { toast('أدخل رقم جوال صحيح', 'error'); return; }
        var p = byId(inquiryPropertyId);
        if (!p) return;

        if (window.db) {
            try {
                await window.db.from('inquiries').insert([{ property_id: p.id, property_title: p.title, name: name, phone: phone, message: message }]);
            } catch (e) {}
        }
        var agentPhone = p.agent.phone || '966500000000';
        var wa = 'مرحباً، أنا ' + name + ' (' + phone + ')\n\nأرغب بالاستفسار عن العقار: ' + p.title + ' (' + p.code + ')\nالسعر: ' + p.price + '\n\n' + message;
        window.open('https://wa.me/' + agentPhone + '?text=' + encodeURIComponent(wa), '_blank');
        toast('تم الإرسال', 'success');
        closeInquiry();
    }

    /* ============================================================
       الخريطة
       ============================================================ */
    function renderMap() {
        if (typeof L === 'undefined') return;
        if (!state.map) {
            state.map = L.map('properties-map', { zoomControl: false }).setView([24.7136, 46.6753], 6);
            L.control.zoom({ position: 'bottomleft' }).addTo(state.map);
            L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
                attribution: '&copy; OpenStreetMap &copy; CartoDB', subdomains: 'abcd', maxZoom: 20
            }).addTo(state.map);
        }
        setTimeout(function () { state.map.invalidateSize(); }, 60);

        state.mapMarkers.forEach(function (m) { state.map.removeLayer(m); });
        state.mapMarkers = [];
        var bounds = [];

        state.filtered.forEach(function (p) {
            var lat = parseFloat(p.latitude), lng = parseFloat(p.longitude);
            if (isNaN(lat) || isNaN(lng) || !lat || !lng) return;
            var closed = p.status === 'sold' || p.status === 'rented';
            var icon = L.divIcon({ className: 'price-pin' + (closed ? ' closed' : ''), html: '<span>' + esc(shortPrice(p)) + '</span>', iconSize: [0, 0] });
            var marker = L.marker([lat, lng], { icon: icon }).addTo(state.map);
            marker.bindPopup(
                '<div class="map-popup"><img src="' + esc(p.images[0]) + '" alt="">' +
                '<h4>' + esc(p.title) + '</h4><p>' + esc(p.price) + '</p>' +
                '<button data-popup-open="' + esc(p.id) + '">التفاصيل</button></div>'
            );
            state.mapMarkers.push(marker);
            bounds.push([lat, lng]);
        });

        state.mapBounds = bounds;
        var total = state.filtered.length;
        $('map-chip-text').textContent = bounds.length === total
            ? bounds.length + ' عقار على الخريطة'
            : bounds.length + ' من ' + total + ' على الخريطة';
        if (bounds.length) { try { state.map.fitBounds(bounds, { padding: [50, 50], maxZoom: 12 }); } catch (e) {} }
    }

    window.addEventListener('load', function () {
        var pid = new URLSearchParams(window.location.search).get('property');
        if (!pid) return;
        var tries = 0;
        (function wait() {
            if (state.loaded && byId(pid)) { openPreview(pid); return; }
            if (++tries < 30) setTimeout(wait, 300);
        })();
    });
})();
