/* ============================================================
   عودة للعقار — admin.js
   منطق لوحة التحكم: التنقل، إدارة العقارات والتصنيفات، الوسائط، الخروج
   يعتمد على: supabase-client.js (window.db) + admin.html + admin.css
   ============================================================ */
(function () {
    'use strict';

    /* ---------- إعدادات ---------- */
    // اسم حاوية Storage في Supabase لرفع الصور/الفيديوهات من الجهاز (يجب أن تكون Public)
    var STORAGE_BUCKET = 'property-media';
    var MAX_UPLOAD_MB = 50;
    // رمز الدولة للبحث عن الأماكن (sa = السعودية). اتركه فارغاً '' للبحث في كل الدول
    var GEO_COUNTRY = 'sa';

    // نفس مفاتيح المرافق المستخدمة في الموقع الرئيسي (script.js)
    var DEFAULT_AMENITIES = [
        { key: 'fiber',       label: 'شبكة ألياف بصرية', icon: 'fa-wifi' },
        { key: 'electricity', label: 'كهرباء',           icon: 'fa-bolt' },
        { key: 'water',       label: 'مياه',             icon: 'fa-droplet' },
        { key: 'gas',         label: 'غاز مركزي',        icon: 'fa-fire' },
        { key: 'sewage',      label: 'صرف صحي',          icon: 'fa-faucet-drip' },
        { key: 'elevator',    label: 'مصعد',             icon: 'fa-elevator' },
        { key: 'parking',     label: 'موقف سيارات',      icon: 'fa-square-parking' },
        { key: 'pool',        label: 'مسبح',             icon: 'fa-water-ladder' },
        { key: 'garden',      label: 'حديقة',            icon: 'fa-seedling' },
        { key: 'security',    label: 'أمن 24/7',         icon: 'fa-shield-halved' },
        { key: 'cameras',     label: 'كاميرات',          icon: 'fa-video' },
        { key: 'ac',          label: 'مكيفات',           icon: 'fa-snowflake' },
        { key: 'kitchen',     label: 'مطبخ مجهز',        icon: 'fa-kitchen-set' },
        { key: 'laundry',     label: 'غسيل ملابس',       icon: 'fa-shirt' },
        { key: 'furnished',   label: 'مفروش',            icon: 'fa-couch' },
        { key: 'balcony',     label: 'بلكونة',           icon: 'fa-sun' }
    ];
    var STATUS_LABELS = { available: 'متاح', sold: 'تم البيع', rented: 'تم التأجير' };

    /* ---------- الحالة ---------- */
    var state = {
        user: null,
        role: null,
        properties: [],
        categories: [],
        activeCat: 'all',
        term: '',
        editingId: null,
        images: [],
        videos: [],
        features: [],
        lat: null,
        lng: null,
        saving: false
    };

    /* ---------- أدوات ---------- */
    function $(id) { return document.getElementById(id); }

    function esc(s) {
        return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
            return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
        });
    }

    function showAlert(msg, type) {
        var box = $('alert-container');
        if (!box) return;
        type = type || 'info';
        var icons = { success: 'fa-circle-check', error: 'fa-circle-exclamation', warning: 'fa-triangle-exclamation', info: 'fa-circle-info' };
        var el = document.createElement('div');
        el.className = 'alert ' + type;
        el.innerHTML = '<i class="fas ' + icons[type] + '"></i><span>' + esc(msg) + '</span>';
        box.appendChild(el);
        setTimeout(function () {
            el.style.transition = 'opacity .3s, transform .3s';
            el.style.opacity = '0';
            el.style.transform = 'translateY(-12px)';
            setTimeout(function () { el.remove(); }, 320);
        }, (type === 'error' || type === 'warning') ? 6000 : 2800);
    }

    function errText(err) {
        if (!err) return '';
        return err.message || String(err);
    }

    function openModal(id) {
        var m = $(id);
        if (!m) return;
        m.classList.add('active');
        document.body.style.overflow = 'hidden';
    }

    function closeModal(id) {
        var m = $(id);
        if (!m) return;
        m.classList.remove('active');
        if (!document.querySelector('.modal.active')) document.body.style.overflow = '';
    }

    function formatPrice(v) {
        var s = String(v == null ? '' : v).trim();
        if (!s) return '—';
        if (/^\d+$/.test(s)) return Number(s).toLocaleString('en-US') + ' ر.س';
        return s;
    }

    function youtubeId(url) {
        var m = String(url).match(/(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/)([\w-]{11})/);
        return m ? m[1] : null;
    }

    function isHttpUrl(u) { return /^https?:\/\/\S+$/i.test(u); }

    /* ============================================================
       التنقل
       ============================================================ */
    function showSection(name) {
        document.querySelectorAll('.app-section').forEach(function (s) {
            s.classList.toggle('active', s.dataset.section === name);
        });
        document.querySelectorAll('.nav-item').forEach(function (b) {
            b.classList.toggle('active', b.dataset.section === name);
        });
        window.scrollTo(0, 0);
    }

    /* ============================================================
       تحميل البيانات
       ============================================================ */
    async function loadCategories() {
        var res = await window.db.from('property_categories').select('*').order('sort_order');
        if (res.error) {
            console.error(res.error);
            showAlert('تعذّر تحميل التصنيفات: ' + errText(res.error), 'error');
            state.categories = [];
        } else {
            state.categories = res.data || [];
        }
        renderChips();
        fillTypeSelect();
    }

    async function loadProperties() {
        var res = await window.db.from('properties').select('*').order('created_at', { ascending: false });
        if (res.error) {
            console.error(res.error);
            showAlert('تعذّر تحميل العقارات: ' + errText(res.error), 'error');
            state.properties = [];
        } else {
            state.properties = res.data || [];
        }
        renderStats();
        renderProperties();
    }

    async function refreshAll() {
        await Promise.all([loadCategories(), loadProperties()]);
    }

    /* ============================================================
       العرض
       ============================================================ */
    function renderStats() {
        var p = state.properties;
        var sold = 0, rented = 0, available = 0;
        p.forEach(function (x) {
            if (x.status === 'sold') sold++;
            else if (x.status === 'rented') rented++;
            else available++;
        });
        $('stat-properties').textContent = p.length;
        $('stat-available').textContent = available;
        $('stat-sold').textContent = sold;
        $('stat-rented').textContent = rented;
    }

    function renderChips() {
        var box = $('category-chips');
        var html = '<button type="button" class="category-chip' + (state.activeCat === 'all' ? ' active' : '') + '" data-cat="all"><i class="fas fa-layer-group"></i> الكل</button>';
        state.categories.forEach(function (c) {
            var icon = c.icon && /^fa-[\w-]+$/.test(c.icon) ? c.icon : 'fa-tag';
            html += '<button type="button" class="category-chip' + (state.activeCat === c.name ? ' active' : '') + '" data-cat="' + esc(c.name) + '"><i class="fas ' + icon + '"></i> ' + esc(c.name) + '</button>';
        });
        box.innerHTML = html;
    }

    function fillTypeSelect(selected) {
        var sel = $('property-type');
        var cur = selected !== undefined ? selected : sel.value;
        var names = state.categories.map(function (c) { return c.name; });
        if (cur && names.indexOf(cur) === -1) names.push(cur);
        sel.innerHTML = '<option value="">اختر التصنيف</option>' + names.map(function (n) {
            return '<option value="' + esc(n) + '">' + esc(n) + '</option>';
        }).join('');
        sel.value = cur || '';
    }

    function filteredProperties() {
        var term = state.term.trim().toLowerCase();
        return state.properties.filter(function (p) {
            if (state.activeCat !== 'all' && p.type !== state.activeCat) return false;
            if (!term) return true;
            return [p.title, p.code, p.location, p.type, p.category].some(function (f) {
                return String(f || '').toLowerCase().indexOf(term) !== -1;
            });
        });
    }

    function renderProperties() {
        var grid = $('properties-grid');
        var list = filteredProperties();

        if (!list.length) {
            var none = !state.properties.length;
            grid.innerHTML =
                '<div class="empty-state">' +
                '<i class="fas ' + (none ? 'fa-building' : 'fa-magnifying-glass') + '"></i>' +
                '<h3>' + (none ? 'لا توجد عقارات بعد' : 'لا توجد نتائج') + '</h3>' +
                '<p>' + (none ? 'اضغط «عقار جديد» لإضافة أول عقار.' : 'جرّب تغيير البحث أو التصنيف.') + '</p>' +
                '</div>';
            return;
        }

        grid.innerHTML = list.map(function (p) {
            var img = (p.images && p.images[0]) || '';
            var closed = p.status === 'sold' || p.status === 'rented';
            var deal = p.category === 'للإيجار' ? 'for-rent' : 'for-sale';
            return '' +
                '<div class="property-card' + (closed ? ' is-closed' : '') + '">' +
                    '<div class="property-image">' +
                        (img ? '<img src="' + esc(img) + '" alt="" loading="lazy" onerror="this.style.display=\'none\'">' : '') +
                        '<span class="property-code">' + esc(p.code || '—') + '</span>' +
                        (closed
                            ? '<span class="property-status-mini status-' + p.status + '">' + esc(STATUS_LABELS[p.status]) + '</span>'
                            : (p.type ? '<span class="property-badge">' + esc(p.type) + '</span>' : '')) +
                    '</div>' +
                    '<div class="property-content">' +
                        '<div class="property-header">' +
                            '<h3 class="property-title">' + esc(p.title) + '</h3>' +
                            '<span class="property-price">' + esc(formatPrice(p.price)) + '</span>' +
                        '</div>' +
                        '<div class="property-location"><i class="fas fa-location-dot"></i><span>' + esc(isHttpUrl(String(p.location || '').trim()) ? 'رابط خريطة — عدّل الموقع' : (p.location || '—')) + '</span></div>' +
                        '<div class="property-footer">' +
                            '<span class="status-badge ' + deal + '">' + esc(p.category || '—') + '</span>' +
                            '<div class="property-actions">' +
                                '<button type="button" class="property-action-btn edit" data-id="' + esc(p.id) + '" title="تعديل" aria-label="تعديل"><i class="fas fa-pen"></i></button>' +
                                '<button type="button" class="property-action-btn delete" data-id="' + esc(p.id) + '" title="حذف" aria-label="حذف"><i class="fas fa-trash"></i></button>' +
                            '</div>' +
                        '</div>' +
                    '</div>' +
                '</div>';
        }).join('');
    }

    /* ---------- الصور والفيديوهات والمرافق داخل النافذة ---------- */
    function renderImages() {
        $('images-count-badge').textContent = '(' + state.images.length + ')';
        $('images-grid').innerHTML = state.images.map(function (url, i) {
            return '<div class="media-item">' +
                '<img src="' + esc(url) + '" alt="" loading="lazy">' +
                (i === 0 ? '<span class="media-type-badge">رئيسية</span>' : '') +
                '<button type="button" class="media-delete" data-kind="image" data-i="' + i + '" aria-label="حذف"><i class="fas fa-times"></i></button>' +
                '</div>';
        }).join('');
    }

    function renderVideos() {
        $('videos-count-badge').textContent = '(' + state.videos.length + ')';
        $('videos-grid').innerHTML = state.videos.map(function (url, i) {
            var yt = youtubeId(url);
            var thumb = yt
                ? '<img src="https://img.youtube.com/vi/' + yt + '/mqdefault.jpg" alt="" loading="lazy">'
                : '<video src="' + esc(url) + '" preload="metadata" muted playsinline></video>';
            return '<div class="media-item">' + thumb +
                '<span class="media-type-badge">' + (yt ? 'YouTube' : 'MP4') + '</span>' +
                '<div class="media-play-overlay"><i class="fas fa-play"></i></div>' +
                '<button type="button" class="media-delete" data-kind="video" data-i="' + i + '" aria-label="حذف"><i class="fas fa-times"></i></button>' +
                '</div>';
        }).join('');
    }

    function renderAmenities() {
        var defaultKeys = DEFAULT_AMENITIES.map(function (a) { return a.key; });
        var html = DEFAULT_AMENITIES.map(function (a) {
            var on = state.features.indexOf(a.key) !== -1;
            return '<div class="amenity-item' + (on ? ' active' : '') + '" role="button" tabindex="0" data-key="' + a.key + '">' +
                '<i class="fas ' + a.icon + '"></i><span>' + esc(a.label) + '</span></div>';
        }).join('');

        state.features.forEach(function (f) {
            if (defaultKeys.indexOf(f) !== -1) return;
            var label = String(f).replace(/^custom:/, '');
            html += '<div class="amenity-item custom active" role="button" tabindex="0" data-key="' + esc(f) + '" title="اضغط للحذف">' +
                '<i class="fas fa-star"></i><span>' + esc(label) + '</span></div>';
        });
        $('amenities-grid').innerHTML = html;
    }

    /* ============================================================
       موقع العقار على الخريطة
       ============================================================ */
    var geo = { map: null, marker: null };
    var DEFAULT_CENTER = [24.7136, 46.6753];

    function toLatin(s) {
        return String(s).replace(/[٠-٩]/g, function (d) { return '٠١٢٣٤٥٦٧٨٩'.indexOf(d); }).replace(/٫/g, '.').replace(/[،؛]/g, ',');
    }
    function validCoords(a, b) {
        return isFinite(a) && isFinite(b) && Math.abs(a) <= 90 && Math.abs(b) <= 180 && !(a === 0 && b === 0);
    }
    function isShortMapLink(t) { return /maps\.app\.goo\.gl|goo\.gl\/maps|g\.co\/kgs/i.test(t); }

    // يقرأ الإحداثيات من: 24.71, 46.67 | رابط قوقل الطويل (@lat,lng أو !3d..!4d.. أو ?q=lat,lng)
    function parseCoords(text) {
        var t = toLatin(String(text || '').trim());
        try { t = decodeURIComponent(t); } catch (e) {}
        var m = t.match(/@(-?\d{1,2}(?:\.\d+)?),\s*(-?\d{1,3}(?:\.\d+)?)/)
             || t.match(/!3d(-?\d{1,2}(?:\.\d+)?)!4d(-?\d{1,3}(?:\.\d+)?)/)
             || t.match(/[?&](?:q|ll|query|center|destination|daddr)=(-?\d{1,2}(?:\.\d+)?)\s*,\s*(-?\d{1,3}(?:\.\d+)?)/i)
             || t.match(/^\s*(-?\d{1,2}(?:\.\d+)?)\s*[,\s]\s*(-?\d{1,3}(?:\.\d+)?)\s*$/);
        if (!m) return null;
        var a = parseFloat(m[1]), b = parseFloat(m[2]);
        return validCoords(a, b) ? { lat: a, lng: b } : null;
    }

    function pinIcon() {
        return L.divIcon({ className: 'geo-pin', html: '<i class="fas fa-location-dot"></i>', iconSize: [36, 36], iconAnchor: [18, 34] });
    }

    function initGeoMap() {
        if (geo.map || typeof L === 'undefined') return;
        geo.map = L.map('geo-map').setView(DEFAULT_CENTER, 6);
        L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png', {
            maxZoom: 19, subdomains: 'abcd', attribution: '&copy; OpenStreetMap &copy; CARTO'
        }).addTo(geo.map);
        geo.map.on('click', function (e) { setGeo(e.latlng.lat, e.latlng.lng, false); });
    }

    function updateGeoUI() {
        var has = state.lat != null && state.lng != null;
        $('geo-badge').textContent = has ? '(تم التحديد)' : '(غير محدد)';
        $('geo-hint').textContent = has
            ? 'الإحداثيات: ' + state.lat + '، ' + state.lng + ' — اسحب الدبوس لتعديل الموقع.'
            : 'اضغط على الخريطة لتحديد موقع العقار، أو استخدم الخيارات أعلاه.';
        $('geo-clear').disabled = !has;
    }

    // move=true: تقرّب الخريطة للنقطة
    function setGeo(lat, lng, move) {
        lat = Math.round(lat * 1e6) / 1e6;
        lng = Math.round(lng * 1e6) / 1e6;
        state.lat = lat;
        state.lng = lng;
        if (geo.map) {
            if (!geo.marker) {
                geo.marker = L.marker([lat, lng], { draggable: true, icon: pinIcon() }).addTo(geo.map);
                geo.marker.on('dragend', function () {
                    var ll = geo.marker.getLatLng();
                    setGeo(ll.lat, ll.lng, false);
                });
            } else {
                geo.marker.setLatLng([lat, lng]);
            }
            if (move) geo.map.setView([lat, lng], Math.max(geo.map.getZoom(), 16));
        }
        updateGeoUI();
    }

    function clearGeo() {
        state.lat = null;
        state.lng = null;
        if (geo.marker && geo.map) geo.map.removeLayer(geo.marker);
        geo.marker = null;
        updateGeoUI();
    }

    // تُستدعى بعد ظهور النافذة (Leaflet يحتاج حجماً فعلياً للحاوية)
    function syncGeoMap() {
        initGeoMap();
        if (!geo.map) { showAlert('تعذّر تحميل الخريطة — تأكد من اتصال الإنترنت', 'warning'); return; }
        geo.map.invalidateSize();
        if (state.lat != null) setGeo(state.lat, state.lng, true);
        else geo.map.setView(DEFAULT_CENTER, 6);
    }

    function applyGeoPaste() {
        var v = $('geo-paste').value.trim();
        if (!v) return;
        var c = parseCoords(v);
        if (c) {
            setGeo(c.lat, c.lng, true);
            $('geo-paste').value = '';
            showAlert('تم تحديد الموقع على الخريطة', 'success');
        } else if (isShortMapLink(v)) {
            showAlert('الرابط المختصر ما يقدر المتصفح يقرأ موقعه. في قوقل ماب اضغط مطولاً على المكان وانسخ الإحداثيات، أو حدد المكان مباشرة على الخريطة هنا.', 'warning');
        } else {
            showAlert('ما قدرت أستخرج الموقع. الصق إحداثيات مثل 24.7136, 46.6753 أو رابطاً طويلاً من قوقل ماب.', 'warning');
        }
    }

    function locateMe() {
        if (!navigator.geolocation) { showAlert('المتصفح لا يدعم تحديد الموقع', 'warning'); return; }
        var btn = $('geo-locate');
        btn.disabled = true;
        navigator.geolocation.getCurrentPosition(function (pos) {
            btn.disabled = false;
            setGeo(pos.coords.latitude, pos.coords.longitude, true);
        }, function (err) {
            btn.disabled = false;
            showAlert(err && err.code === 1 ? 'اسمح للمتصفح بالوصول إلى موقعك ثم أعد المحاولة' : 'تعذّر تحديد موقعك الحالي', 'warning');
        }, { enableHighAccuracy: true, timeout: 12000 });
    }

    async function searchPlace() {
        var q = $('geo-search').value.trim();
        if (!q) return;
        initGeoMap();
        if (!geo.map) return;
        var btn = $('geo-search-btn');
        btn.disabled = true;
        try {
            var url = 'https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=ar' +
                      (GEO_COUNTRY ? '&countrycodes=' + GEO_COUNTRY : '') + '&q=' + encodeURIComponent(q);
            var r = await fetch(url, { headers: { 'Accept': 'application/json' } });
            if (!r.ok) throw new Error('HTTP ' + r.status);
            var list = await r.json();
            if (!list.length) { showAlert('ما لقيت هذا المكان، جرّب كتابة الحي مع المدينة', 'warning'); return; }
            geo.map.invalidateSize();
            geo.map.setView([parseFloat(list[0].lat), parseFloat(list[0].lon)], 15);
            showAlert('اضغط على مكان العقار بالضبط لتثبيت الدبوس', 'info');
        } catch (err) {
            console.error(err);
            showAlert('تعذّر البحث الآن، حدد المكان بالنقر على الخريطة', 'warning');
        } finally {
            btn.disabled = false;
        }
    }

    /* ---------- تبويب الصور / الفيديوهات ---------- */
    function setMediaTab(name) {
        document.querySelectorAll('.amt-tab').forEach(function (b) { b.classList.toggle('active', b.dataset.mt === name); });
        document.querySelectorAll('.amt-pane').forEach(function (p) { p.classList.toggle('active', p.id === 'amt-' + name); });
    }

    /* ============================================================
       نافذة العقار
       ============================================================ */
    function resetPropertyForm() {
        $('property-form').reset();
        $('property-id').value = '';
        $('new-image-url').value = '';
        $('new-video-url').value = '';
        $('new-amenity-input').value = '';
        state.images = [];
        state.videos = [];
        state.features = [];
        $('geo-paste').value = '';
        $('geo-search').value = '';
        clearGeo();
        setMediaTab('images');
        renderImages();
        renderVideos();
        renderAmenities();
    }

    function openAddProperty() {
        state.editingId = null;
        resetPropertyForm();
        fillTypeSelect('');
        $('property-status').value = 'available';
        $('property-modal-title').textContent = 'إضافة عقار جديد';
        openModal('property-modal');
        setTimeout(syncGeoMap, 320);
    }

    function openEditProperty(id) {
        var p = state.properties.filter(function (x) { return String(x.id) === String(id); })[0];
        if (!p) return;
        state.editingId = p.id;
        resetPropertyForm();
        $('property-id').value = p.id;
        $('property-title').value = p.title || '';
        $('property-code').value = p.code || '';
        fillTypeSelect(p.type || '');
        $('property-category').value = p.category || '';
        $('property-status').value = p.status || 'available';
        $('property-price').value = p.price || '';
        $('property-area').value = p.area || '';
        var loc = String(p.location || '').trim();
        var plat = parseFloat(p.latitude), plng = parseFloat(p.longitude);
        if (validCoords(plat, plng)) { state.lat = plat; state.lng = plng; }
        if (isHttpUrl(loc)) {
            // بيانات قديمة: الموقع محفوظ كرابط → ننقله لخانة الخريطة ونطلب اسم الحي
            $('property-location').value = '';
            $('geo-paste').value = loc;
            var fromUrl = parseCoords(loc);
            if (fromUrl && state.lat == null) { state.lat = fromUrl.lat; state.lng = fromUrl.lng; }
            showAlert('موقع هذا العقار محفوظ كرابط. اكتب اسم الحي في خانة «الحي / المدينة» وحدد مكانه على الخريطة.', 'info');
        } else {
            $('property-location').value = loc;
        }
        updateGeoUI();
        $('property-description').value = p.description || '';
        state.images = (p.images || []).slice();
        state.videos = (p.videos || []).slice();
        state.features = (p.features || []).slice();
        renderImages();
        renderVideos();
        renderAmenities();
        $('property-modal-title').textContent = 'تعديل العقار';
        openModal('property-modal');
        setTimeout(syncGeoMap, 320);
    }

    async function saveProperty() {
        if (state.saving) return;
        var form = $('property-form');

        // خانة الحي للاسم فقط — لو لصق رابطاً نحوّله لقسم الخريطة بدل ما يظهر للزوار
        var locVal = $('property-location').value.trim();
        if (isHttpUrl(locVal)) {
            var c0 = parseCoords(locVal);
            if (c0) setGeo(c0.lat, c0.lng, true);
            $('geo-paste').value = c0 ? '' : locVal;
            $('property-location').value = '';
            $('property-location').focus();
            showAlert(c0
                ? 'استخرجت الموقع من الرابط ✔ الحين اكتب اسم الحي (مثل: حي النرجس) ثم احفظ.'
                : 'خانة الحي للاسم فقط (مثل: حي النرجس). الرابط نقلته لقسم الخريطة — حدد المكان بالإحداثيات أو بالنقر على الخريطة.', 'warning');
            return;
        }

        if (!form.reportValidity()) return;

        var row = {
            title: $('property-title').value.trim(),
            code: $('property-code').value.trim(),
            type: $('property-type').value,
            category: $('property-category').value,
            status: $('property-status').value,
            price: $('property-price').value.trim(),
            area: parseInt($('property-area').value, 10) || 0,
            location: $('property-location').value.trim(),
            latitude: state.lat,
            longitude: state.lng,
            description: $('property-description').value.trim(),
            images: state.images,
            videos: state.videos,
            features: state.features
        };

        var btn = $('save-property');
        var label = btn.querySelector('span');
        var oldLabel = label.textContent;
        state.saving = true;
        btn.disabled = true;
        label.textContent = 'جارٍ الحفظ...';

        try {
            var res;
            if (state.editingId != null) {
                res = await window.db.from('properties').update(row).eq('id', state.editingId).select();
            } else {
                res = await window.db.from('properties').insert([row]).select();
            }
            if (res.error) throw res.error;
            // لو الصلاحيات (RLS) تمنع التعديل ترجع Supabase نتيجة فارغة بدون خطأ
            if (!res.data || !res.data.length) {
                throw new Error('لم يتم الحفظ — تحقق من صلاحيات (RLS) جدول properties للأدمن');
            }
            showAlert(state.editingId != null ? 'تم تحديث العقار' : 'تمت إضافة العقار', 'success');
            closeModal('property-modal');
            await loadProperties();
        } catch (err) {
            console.error(err);
            var em = errText(err);
            if (/latitude|longitude/i.test(em)) em += ' — أضف عمودي latitude و longitude لجدول properties من SQL Editor (راجع التعليمات)';
            showAlert('تعذّر الحفظ: ' + em, 'error');
        } finally {
            state.saving = false;
            btn.disabled = false;
            label.textContent = oldLabel;
        }
    }

    async function deleteProperty(id) {
        var p = state.properties.filter(function (x) { return String(x.id) === String(id); })[0];
        if (!p) return;
        if (!window.confirm('هل تريد حذف «' + (p.title || p.code) + '» نهائياً؟')) return;
        try {
            var res = await window.db.from('properties').delete().eq('id', p.id).select();
            if (res.error) throw res.error;
            if (!res.data || !res.data.length) throw new Error('لم يتم الحذف — تحقق من صلاحيات (RLS) للأدمن');
            showAlert('تم حذف العقار', 'success');
            await loadProperties();
        } catch (err) {
            console.error(err);
            showAlert('تعذّر الحذف: ' + errText(err), 'error');
        }
    }

    /* ---------- رفع الملفات من الجهاز ---------- */
    async function uploadFiles(files, kind) {
        if (!files || !files.length) return;
        var labelEl = $(kind === 'image' ? 'image-upload-label' : 'video-upload-label');
        var btnEl = labelEl.closest('.media-upload-btn');
        var original = labelEl.textContent;
        var list = Array.prototype.slice.call(files);
        var done = 0;

        btnEl.classList.add('uploading');
        try {
            for (var i = 0; i < list.length; i++) {
                var f = list[i];
                labelEl.textContent = 'جارٍ الرفع ' + (i + 1) + '/' + list.length + '...';
                if (f.size > MAX_UPLOAD_MB * 1024 * 1024) {
                    showAlert('«' + f.name + '» أكبر من ' + MAX_UPLOAD_MB + ' ميغابايت', 'warning');
                    continue;
                }
                var ext = (f.name.split('.').pop() || 'bin').toLowerCase().replace(/[^a-z0-9]/g, '');
                var path = kind + 's/' + Date.now() + '-' + Math.random().toString(36).slice(2, 8) + '.' + ext;
                var up = await window.db.storage.from(STORAGE_BUCKET).upload(path, f, { cacheControl: '3600', upsert: false, contentType: f.type || undefined });
                if (up.error) throw up.error;
                var pub = window.db.storage.from(STORAGE_BUCKET).getPublicUrl(path);
                var url = pub && pub.data && pub.data.publicUrl;
                if (!url) throw new Error('تعذّر الحصول على رابط الملف');
                (kind === 'image' ? state.images : state.videos).push(url);
                done++;
                kind === 'image' ? renderImages() : renderVideos();
            }
            if (done) showAlert('تم رفع ' + done + (kind === 'image' ? ' صورة' : ' فيديو'), 'success');
        } catch (err) {
            console.error(err);
            var msg = errText(err);
            if (/bucket/i.test(msg)) msg += ' — أنشئ حاوية باسم «' + STORAGE_BUCKET + '» (Public) في Supabase Storage';
            showAlert('فشل الرفع: ' + msg, 'error');
        } finally {
            btnEl.classList.remove('uploading');
            labelEl.textContent = original;
            $(kind === 'image' ? 'image-file-input' : 'video-file-input').value = '';
        }
    }

    function addImageUrl() {
        var input = $('new-image-url');
        var url = input.value.trim();
        if (!isHttpUrl(url)) { showAlert('الصق رابطاً صحيحاً يبدأ بـ https://', 'warning'); return; }
        state.images.push(url);
        input.value = '';
        renderImages();
    }

    function addVideoUrl() {
        var input = $('new-video-url');
        var url = input.value.trim();
        if (!isHttpUrl(url)) { showAlert('الصق رابطاً صحيحاً يبدأ بـ https://', 'warning'); return; }
        state.videos.push(url);
        input.value = '';
        renderVideos();
    }

    function addCustomAmenity() {
        var input = $('new-amenity-input');
        var v = input.value.trim();
        if (!v) return;
        var key = 'custom:' + v;
        if (state.features.indexOf(key) === -1) state.features.push(key);
        input.value = '';
        renderAmenities();
    }

    function toggleAmenity(key) {
        var idx = state.features.indexOf(key);
        if (idx === -1) state.features.push(key);
        else state.features.splice(idx, 1);
        renderAmenities();
    }

    /* ============================================================
       التصنيفات
       ============================================================ */
    function openCategoryModal() {
        $('new-category-name').value = '';
        $('new-category-icon').value = 'fa-tag';
        openModal('category-modal');
        setTimeout(function () { $('new-category-name').focus(); }, 60);
    }

    async function saveCategory() {
        var name = $('new-category-name').value.trim();
        var icon = $('new-category-icon').value;
        if (!name) { showAlert('اكتب اسم التصنيف', 'warning'); return; }
        if (state.categories.some(function (c) { return c.name === name; })) {
            showAlert('هذا التصنيف موجود مسبقاً', 'warning');
            return;
        }

        var nextOrder = state.categories.reduce(function (m, c) { return Math.max(m, Number(c.sort_order) || 0); }, 0) + 1;
        var btn = $('save-category');
        btn.disabled = true;

        try {
            var res = await window.db.from('property_categories').insert([{ name: name, icon: icon, sort_order: nextOrder }]).select();
            // إن لم يكن في الجدول عمود icon نعيد المحاولة بدونه
            if (res.error && /icon/i.test(errText(res.error))) {
                res = await window.db.from('property_categories').insert([{ name: name, sort_order: nextOrder }]).select();
            }
            if (res.error) throw res.error;
            if (!res.data || !res.data.length) throw new Error('لم تتم الإضافة — تحقق من صلاحيات (RLS) جدول property_categories');
            showAlert('تمت إضافة التصنيف', 'success');
            closeModal('category-modal');
            await loadCategories();
        } catch (err) {
            console.error(err);
            showAlert('تعذّرت الإضافة: ' + errText(err), 'error');
        } finally {
            btn.disabled = false;
        }
    }

    /* ============================================================
       الحساب والحماية
       ============================================================ */
    async function guard() {
        var s = await window.db.auth.getSession();
        var session = s && s.data && s.data.session;
        if (!session) { window.location.replace('log.html'); return false; }

        state.user = session.user;
        var prof = await window.db.from('profiles').select('role').eq('id', session.user.id).maybeSingle();
        state.role = prof && prof.data ? prof.data.role : null;

        $('account-email').textContent = session.user.email || '—';
        $('account-role').textContent = state.role === 'admin' ? 'مدير' : (state.role || 'مستخدم');

        if (state.role !== 'admin') {
            showAlert('هذه الصفحة للمدير فقط', 'error');
            setTimeout(function () { window.location.replace('index.html'); }, 1200);
            return false;
        }
        return true;
    }

    async function logout() {
        try { await window.db.auth.signOut(); } catch (e) { console.error(e); }
        window.location.replace('log.html');
    }

    /* ============================================================
       ربط الأحداث
       ============================================================ */
    function bindEvents() {
        // الشريط السفلي
        $('bottom-nav').addEventListener('click', function (e) {
            var b = e.target.closest('.nav-item');
            if (b) showSection(b.dataset.section);
        });

        // الإجراءات السريعة
        document.querySelectorAll('.quick-action-btn').forEach(function (b) {
            b.addEventListener('click', function () {
                if (b.dataset.action === 'add-property') { showSection('properties'); openAddProperty(); }
                else if (b.dataset.action === 'view-properties') showSection('properties');
            });
        });

        // الهيدر
        $('refresh-btn').addEventListener('click', async function () {
            await refreshAll();
            showAlert('تم التحديث', 'success');
        });
        $('logout-btn').addEventListener('click', logout);

        // العقارات
        $('add-property-btn').addEventListener('click', openAddProperty);
        $('properties-search').addEventListener('input', function (e) {
            state.term = e.target.value;
            renderProperties();
        });
        $('properties-grid').addEventListener('click', function (e) {
            var btn = e.target.closest('.property-action-btn');
            if (!btn) return;
            if (btn.classList.contains('edit')) openEditProperty(btn.dataset.id);
            else if (btn.classList.contains('delete')) deleteProperty(btn.dataset.id);
        });

        // التصنيفات
        $('category-chips').addEventListener('click', function (e) {
            var chip = e.target.closest('.category-chip');
            if (!chip) return;
            state.activeCat = chip.dataset.cat;
            renderChips();
            renderProperties();
        });
        $('add-category-btn').addEventListener('click', openCategoryModal);
        $('save-category').addEventListener('click', saveCategory);
        $('cancel-category').addEventListener('click', function () { closeModal('category-modal'); });
        $('close-category-modal').addEventListener('click', function () { closeModal('category-modal'); });
        $('new-category-name').addEventListener('keydown', function (e) {
            if (e.key === 'Enter') { e.preventDefault(); saveCategory(); }
        });

        // نافذة العقار
        $('save-property').addEventListener('click', saveProperty);
        $('cancel-property').addEventListener('click', function () { closeModal('property-modal'); });
        $('close-property-modal').addEventListener('click', function () { closeModal('property-modal'); });

        // الموقع على الخريطة
        $('geo-apply').addEventListener('click', applyGeoPaste);
        $('geo-paste').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); applyGeoPaste(); } });
        $('geo-search-btn').addEventListener('click', searchPlace);
        $('geo-search').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); searchPlace(); } });
        $('geo-locate').addEventListener('click', locateMe);
        $('geo-clear').addEventListener('click', clearGeo);

        // تبويب الصور / الفيديوهات
        document.querySelectorAll('.amt-tab').forEach(function (b) {
            b.addEventListener('click', function () { setMediaTab(b.dataset.mt); });
        });

        // الصور والفيديو
        $('add-image-url-btn').addEventListener('click', addImageUrl);
        $('add-video-url-btn').addEventListener('click', addVideoUrl);
        $('new-image-url').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addImageUrl(); } });
        $('new-video-url').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addVideoUrl(); } });
        $('image-file-input').addEventListener('change', function (e) { uploadFiles(e.target.files, 'image'); });
        $('video-file-input').addEventListener('change', function (e) { uploadFiles(e.target.files, 'video'); });

        function onMediaDelete(e) {
            var d = e.target.closest('.media-delete');
            if (!d) return;
            var i = parseInt(d.dataset.i, 10);
            if (d.dataset.kind === 'image') { state.images.splice(i, 1); renderImages(); }
            else { state.videos.splice(i, 1); renderVideos(); }
        }
        $('images-grid').addEventListener('click', onMediaDelete);
        $('videos-grid').addEventListener('click', onMediaDelete);

        // المرافق
        $('amenities-grid').addEventListener('click', function (e) {
            var it = e.target.closest('.amenity-item');
            if (it) toggleAmenity(it.dataset.key);
        });
        $('amenities-grid').addEventListener('keydown', function (e) {
            if (e.key !== 'Enter' && e.key !== ' ') return;
            var it = e.target.closest('.amenity-item');
            if (it) { e.preventDefault(); toggleAmenity(it.dataset.key); }
        });
        $('add-amenity-btn').addEventListener('click', addCustomAmenity);
        $('new-amenity-input').addEventListener('keydown', function (e) { if (e.key === 'Enter') { e.preventDefault(); addCustomAmenity(); } });

        // إغلاق النوافذ بالنقر على الخلفية أو Esc
        document.querySelectorAll('.modal').forEach(function (m) {
            m.addEventListener('mousedown', function (e) { if (e.target === m) closeModal(m.id); });
        });
        document.addEventListener('keydown', function (e) {
            if (e.key !== 'Escape') return;
            document.querySelectorAll('.modal.active').forEach(function (m) { closeModal(m.id); });
        });
    }

    /* ============================================================
       الإقلاع
       ============================================================ */
    async function init() {
        bindEvents(); // نربط الأزرار أولاً حتى لا تبقى ميتة إن تأخر التحميل

        if (!window.db) {
            showAlert('تعذّر الاتصال بقاعدة البيانات — تأكد من تحميل مكتبة Supabase و supabase-client.js', 'error');
            return;
        }
        try {
            if (!(await guard())) return;
            await refreshAll();
        } catch (err) {
            console.error(err);
            showAlert('حدث خطأ أثناء التحميل: ' + errText(err), 'error');
        }
    }

    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
    else init();
})();
