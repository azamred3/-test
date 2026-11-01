/* ============================================================
   عودة للعقار — ui.js
   تحسينات واجهة صغيرة فوق script.js دون لمسه:
   1) ارتفاع الهيدر الحقيقي → يثبّت شريط الفلاتر تحته بدقة
   2) ظل الهيدر عند التمرير
   3) السحب بالإصبع في معرض الصور
   ============================================================ */
(function () {
    'use strict';

    var root = document.documentElement;
    var header = document.querySelector('.header');

    /* 1) ارتفاع الهيدر */
    function syncHeaderHeight() {
        if (!header) return;
        root.style.setProperty('--header-h', header.offsetHeight + 'px');
    }
    syncHeaderHeight();
    window.addEventListener('resize', syncHeaderHeight);
    window.addEventListener('load', syncHeaderHeight);
    if ('ResizeObserver' in window && header) new ResizeObserver(syncHeaderHeight).observe(header);

    /* 2) حالة التمرير */
    if (header) {
        var ticking = false;
        window.addEventListener('scroll', function () {
            if (ticking) return;
            ticking = true;
            requestAnimationFrame(function () {
                ticking = false;
                header.classList.toggle('is-scrolled', window.scrollY > 6);
            });
        }, { passive: true });
    }

    /* 3) سحب المعرض: يضغط زر السابق/التالي الذي يرسمه script.js */
    var sx = 0, sy = 0, tracking = false;

    document.addEventListener('touchstart', function (e) {
        var g = e.target.closest && e.target.closest('.preview-gallery');
        tracking = !!g;
        if (tracking) { sx = e.touches[0].clientX; sy = e.touches[0].clientY; }
    }, { passive: true });

    document.addEventListener('touchend', function (e) {
        if (!tracking) return;
        tracking = false;
        var t = e.changedTouches[0];
        var dx = t.clientX - sx, dy = t.clientY - sy;
        if (Math.abs(dx) < 40 || Math.abs(dx) < Math.abs(dy) * 1.4) return;
        // المعرض يتحرك من اليمين لليسار: سحب لليسار = التالي
        var btn = document.querySelector('.gallery-nav-btn[data-gallery="' + (dx < 0 ? 1 : -1) + '"]');
        if (btn) btn.click();
    }, { passive: true });
})();