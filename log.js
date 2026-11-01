// ============================================================
// عودة للعقار — صفحة الدخول (مربوطة بـ Supabase)
// ============================================================
(function () {
    'use strict';

    var $ = function (s, r) { return (r || document).querySelector(s); };
    var $$ = function (s, r) { return Array.prototype.slice.call((r || document).querySelectorAll(s)); };
    var reduceMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    /* ============================================================
       1. المدينة (SVG) — تُبنى بالكود
       ============================================================ */
    var NS = 'http://www.w3.org/2000/svg';
    var wins = [];
    var skylineStarted = false;
    var progress = 0;

    function rng(seed) {
        return function () {
            seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
            var t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
            t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
            return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
        };
    }

    function el(name, attrs, parent) {
        var e = document.createElementNS(NS, name);
        for (var k in attrs) e.setAttribute(k, attrs[k]);
        if (parent) parent.appendChild(e);
        return e;
    }

    function buildLayer(id, o) {
        var g = $('#' + id);
        if (!g) return;
        var rand = rng(o.seed);
        var x = -60;
        while (x < 1060) {
            var w = o.minW + rand() * (o.maxW - o.minW);
            if (o.gap && x + w > o.gap[0] && x < o.gap[1]) { x = o.gap[1]; continue; }
            var h = o.minH + rand() * (o.maxH - o.minH);
            var b = el('g', { 'class': 'bld' }, g);
            var cx = x + w / 2;
            b.style.setProperty('--d', (Math.abs(cx - 500) / 1000 * 0.9 + o.delay).toFixed(2) + 's');

            el('rect', { x: x.toFixed(1), y: (800 - h).toFixed(1), width: w.toFixed(1), height: h.toFixed(1), fill: o.fill }, b);
            if (rand() > 0.6) {
                el('rect', { x: (cx - 2).toFixed(1), y: (800 - h - 26).toFixed(1), width: 4, height: 26, fill: o.fill }, b);
            }

            if (o.windows) {
                var cols = Math.floor((w - 14) / 16);
                var rows = Math.floor((h - 30) / 22);
                var span = cols * 16 - 8;
                var off = (w - span) / 2;
                for (var r = 0; r < rows; r++) {
                    for (var c = 0; c < cols; c++) {
                        if (rand() < 0.18) continue;
                        var win = el('rect', {
                            'class': 'win',
                            x: (x + off + c * 16).toFixed(1),
                            y: (800 - h + 18 + r * 22).toFixed(1),
                            width: 8, height: 11, rx: 1.5
                        }, b);
                        var rank = rand();
                        win.style.transitionDelay = (rank * 0.7).toFixed(2) + 's';
                        wins.push({ el: win, rank: rank, on: false });
                    }
                }
            }
            x += w + o.gapBetween + rand() * 6;
        }
    }

    function buildSky() {
        var stars = $('#stars');
        if (!stars) return;
        var rand = rng(7);
        for (var i = 0; i < 46; i++) {
            var s = el('circle', { 'class': 'star', cx: (rand() * 1000).toFixed(0), cy: (rand() * 380).toFixed(0), r: (0.6 + rand() * 1.2).toFixed(1) }, stars);
            s.style.animationDelay = (rand() * 3.5).toFixed(2) + 's';
            s.style.animationDuration = (2.5 + rand() * 3).toFixed(2) + 's';
        }
    }

    function setProgress(f) {
        progress = Math.max(0, Math.min(1, f));
        if (!skylineStarted) return;
        var thr = 0.1 + 0.9 * progress;
        for (var i = 0; i < wins.length; i++) {
            var w = wins[i];
            var on = w.rank < thr;
            if (on !== w.on) { w.on = on; w.el.classList.toggle('on', on); }
        }
    }

    buildSky();
    buildLayer('layer-far',  { seed: 11, minW: 46, maxW: 90, minH: 150, maxH: 330, fill: '#2A2145', windows: false, gapBetween: 4, delay: 0 });
    buildLayer('layer-mid',  { seed: 23, minW: 52, maxW: 96, minH: 130, maxH: 300, fill: '#211A38', windows: true,  gapBetween: 6, delay: 0.15 });
    buildLayer('layer-near', { seed: 37, minW: 56, maxW: 100, minH: 80, maxH: 210, fill: '#181229', windows: true, gapBetween: 8, delay: 0.3, gap: [430, 570] });

    // تعتيم الطبقة البعيدة قليلاً لإحساس العمق
    var far = $('#layer-far'); if (far) far.style.opacity = '.9';

    // حركة خفيفة تتبع المؤشر (الشاشات الكبيرة فقط)
    var finePointer = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (finePointer && !reduceMotion) {
        var ticking = false, px = 0;
        window.addEventListener('pointermove', function (e) {
            px = e.clientX / window.innerWidth - 0.5;
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(function () {
                ticking = false;
                var f = $('#layer-far'), m = $('#layer-mid'), n = $('#layer-near');
                if (f) f.style.transform = 'translate3d(' + (px * -8) + 'px,0,0)';
                if (m) m.style.transform = 'translate3d(' + (px * -18) + 'px,0,0)';
                if (n) n.style.transform = 'translate3d(' + (px * -32) + 'px,0,0)';
            });
        }, { passive: true });
    }

    /* ============================================================
       2. شاشة الافتتاح
       ============================================================ */
    var revealed = false;
    function reveal() {
        if (revealed) return;
        revealed = true;
        var loader = $('#loader');
        if (loader) loader.classList.add('hidden');
        $('#auth').classList.add('ready');
        document.body.classList.add('ready');
        setTimeout(function () { skylineStarted = true; setProgress(progress); }, reduceMotion ? 0 : 2000);
    }
    window.addEventListener('load', function () { setTimeout(reveal, reduceMotion ? 0 : 2000); });
    setTimeout(reveal, 4500);

    /* ============================================================
       3. التبويبات
       ============================================================ */
    var tabsEl = $('#tabs');

    function switchTab(name) {
        tabsEl.dataset.active = name;
        $$('.tab').forEach(function (t) {
            var on = t.dataset.tab === name;
            t.classList.toggle('active', on);
            t.setAttribute('aria-selected', on ? 'true' : 'false');
        });
        $$('.form').forEach(function (f) { f.classList.toggle('active', f.id === name + '-form'); });
        updateProgress();
    }

    $$('.tab').forEach(function (t) { t.addEventListener('click', function () { switchTab(t.dataset.tab); }); });
    $$('[data-go]').forEach(function (b) { b.addEventListener('click', function () { switchTab(b.dataset.go); }); });

    /* ============================================================
       4. إظهار كلمة المرور
       ============================================================ */
    $$('.eye').forEach(function (btn) {
        btn.addEventListener('click', function () {
            var input = btn.parentElement.querySelector('input');
            var show = input.type === 'password';
            input.type = show ? 'text' : 'password';
            btn.classList.toggle('shown', show);
            btn.setAttribute('aria-label', show ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور');
        });
    });

    /* ============================================================
       5. التحقق والأخطاء
       ============================================================ */
    function setErr(input, msg) {
        var f = input.closest('.field');
        if (!f) return;
        f.classList.toggle('invalid', !!msg);
        f.querySelector('.err').textContent = msg || '';
        if (msg) {
            f.classList.remove('shake'); void f.offsetWidth; f.classList.add('shake');
        }
    }

    var EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

    function strength(pw) {
        var s = 0;
        if (pw.length >= 8) s++;
        if (/[a-z]/.test(pw) && /[A-Z]/.test(pw)) s++;
        if (/\d/.test(pw)) s++;
        if (/[^A-Za-z0-9]/.test(pw) || pw.length >= 12) s++;
        if (pw.length && pw.length < 6) s = Math.min(s, 1);
        return s;
    }

    var STRENGTH_TEXT = ['استخدم 8 أحرف أو أكثر', 'ضعيفة', 'مقبولة', 'جيدة', 'قوية'];

    $('#su-pass').addEventListener('input', function (e) {
        var lvl = e.target.value ? Math.max(1, strength(e.target.value)) : 0;
        $('#meter').dataset.level = lvl;
        $('#meter-text').textContent = STRENGTH_TEXT[lvl];
    });

    // تنظيف الخطأ أثناء الكتابة + تحديث إضاءة المدينة
    $$('.field input').forEach(function (inp) {
        inp.addEventListener('input', function () {
            if (inp.closest('.field').classList.contains('invalid')) setErr(inp, '');
            updateProgress();
        });
    });
    $('#su-terms').addEventListener('change', updateProgress);

    function updateProgress() {
        var form = $('.form.active');
        if (!form) return;
        var inputs = $$('input:not([type="checkbox"])', form);
        var filled = inputs.filter(function (i) { return i.value.trim().length > 0; }).length;
        var total = inputs.length;
        if (form.id === 'signup-form') {
            total += 1;
            if ($('#su-terms').checked) filled += 1;
        }
        setProgress((filled / total) * 0.85);
    }

    /* ============================================================
       6. التنبيه
       ============================================================ */
    var toastTimer;
    function showToast(msg, isError) {
        var t = $('#toast');
        $('#toast-text').textContent = msg;
        t.classList.toggle('error', !!isError);
        t.classList.add('show');
        clearTimeout(toastTimer);
        toastTimer = setTimeout(function () { t.classList.remove('show'); }, 3400);
    }

    /* ============================================================
       7. الزر
       ============================================================ */
    function setBtn(btn, state) {
        btn.dataset.state = state;
        btn.disabled = state !== 'idle';
    }

    function celebrate() {
        setProgress(1);
        var scene = $('.scene');
        scene.classList.remove('flash'); void scene.offsetWidth; scene.classList.add('flash');
    }

    function noDb() {
        showToast('تعذّر الاتصال بالخادم، حدّث الصفحة وحاول مجدداً', true);
    }

    /* ============================================================
       8. تسجيل الدخول
       ============================================================ */
    $('#login-form').addEventListener('submit', async function (e) {
        e.preventDefault();
        var emailI = $('#login-email'), passI = $('#login-password');
        var btn = $('.submit', e.target);
        var email = emailI.value.trim(), password = passI.value;
        var ok = true;

        if (!EMAIL_RE.test(email)) { setErr(emailI, email ? 'صيغة البريد غير صحيحة' : 'أدخل بريدك الإلكتروني'); ok = false; }
        if (!password) { setErr(passI, 'أدخل كلمة المرور'); ok = false; }
        if (!ok) return;
        if (!window.db) return noDb();

        setBtn(btn, 'loading');

        try {
            await window.db.auth.signOut();
            var res = await window.db.auth.signInWithPassword({ email: email, password: password });

            if (res.error) {
                var m = res.error.message || '';
                var msg = m === 'Invalid login credentials' ? 'البريد أو كلمة المرور غير صحيحة'
                        : m === 'Email not confirmed' ? 'أكّد بريدك الإلكتروني أولاً من الرسالة التي وصلتك'
                        : 'تعذّر تسجيل الدخول، حاول مرة أخرى';
                showToast(msg, true);
                setErr(passI, m === 'Invalid login credentials' ? 'تحقق من البيانات وأعد المحاولة' : '');
                setBtn(btn, 'idle');
                return;
            }

            var profile = await window.db.from('profiles').select('role').eq('id', res.data.user.id).maybeSingle();
            var isAdmin = profile && profile.data && profile.data.role === 'admin';

            setBtn(btn, 'success');
            celebrate();
            showToast('تم تسجيل الدخول');
            setTimeout(function () { window.location.href = isAdmin ? 'admin.html' : 'index.html'; }, 1300);
        } catch (err) {
            console.error(err);
            noDb();
            setBtn(btn, 'idle');
        }
    });

    /* ============================================================
       9. نسيت كلمة المرور
       ============================================================ */
    $('#forgot').addEventListener('click', async function () {
        var emailI = $('#login-email');
        var email = emailI.value.trim();
        if (!EMAIL_RE.test(email)) {
            setErr(emailI, 'اكتب بريدك هنا أولاً لنرسل لك رابط الاستعادة');
            emailI.focus();
            return;
        }
        if (!window.db) return noDb();
        var res = await window.db.auth.resetPasswordForEmail(email);
        if (res.error) showToast('تعذّر إرسال الرابط، حاول بعد قليل', true);
        else showToast('أرسلنا رابط الاستعادة إلى بريدك');
    });

    /* ============================================================
       10. حساب جديد
       ============================================================ */
    $('#signup-form').addEventListener('submit', async function (e) {
        e.preventDefault();
        var nameI = $('#su-name'), emailI = $('#su-email'), phoneI = $('#su-phone');
        var passI = $('#su-pass'), pass2I = $('#su-pass2'), terms = $('#su-terms');
        var btn = $('.submit', e.target);

        var name = nameI.value.trim(), email = emailI.value.trim();
        var phone = phoneI.value.replace(/[\s\-()]/g, '');
        var pass = passI.value, pass2 = pass2I.value;
        var ok = true;

        if (name.length < 2) { setErr(nameI, 'أدخل اسمك الكامل'); ok = false; }
        if (!EMAIL_RE.test(email)) { setErr(emailI, email ? 'صيغة البريد غير صحيحة' : 'أدخل بريدك الإلكتروني'); ok = false; }
        if (!/^\+?\d{9,15}$/.test(phone)) { setErr(phoneI, 'أدخل رقم جوال صحيح'); ok = false; }
        if (pass.length < 6) { setErr(passI, 'كلمة المرور 6 أحرف على الأقل'); ok = false; }
        if (pass2 !== pass) { setErr(pass2I, 'كلمتا المرور غير متطابقتين'); ok = false; }
        if (!terms.checked) {
            var c = terms.closest('.check');
            c.classList.remove('shake'); void c.offsetWidth; c.classList.add('shake');
            showToast('وافق على الشروط والأحكام للمتابعة', true);
            ok = false;
        }
        if (!ok) return;
        if (!window.db) return noDb();

        setBtn(btn, 'loading');

        try {
            var res = await window.db.auth.signUp({
                email: email,
                password: pass,
                options: { data: { full_name: name, phone: phone } }
            });

            if (res.error) {
                var m = (res.error.message || '').toLowerCase();
                showToast(m.indexOf('already') !== -1 ? 'هذا البريد مسجّل مسبقاً، جرّب تسجيل الدخول' : 'تعذّر إنشاء الحساب، حاول مرة أخرى', true);
                setBtn(btn, 'idle');
                return;
            }

            // Supabase يعيد مستخدماً بلا هويات إذا كان البريد موجوداً
            var u = res.data && res.data.user;
            if (u && u.identities && u.identities.length === 0) {
                setErr(emailI, 'هذا البريد مسجّل مسبقاً');
                showToast('هذا البريد مسجّل مسبقاً، جرّب تسجيل الدخول', true);
                setBtn(btn, 'idle');
                return;
            }

            // التأكيد عبر البريد مفعّل: لا توجد جلسة بعد
            if (!res.data.session) {
                setBtn(btn, 'success');
                celebrate();
                showToast('أرسلنا رابط التأكيد إلى بريدك');
                setTimeout(function () { setBtn(btn, 'idle'); switchTab('login'); $('#login-email').value = email; updateProgress(); }, 1800);
                return;
            }

            setBtn(btn, 'success');
            celebrate();
            showToast('تم إنشاء حسابك');
            setTimeout(function () { window.location.href = 'index.html'; }, 1400);
        } catch (err) {
            console.error(err);
            noDb();
            setBtn(btn, 'idle');
        }
    });

    updateProgress();
})();