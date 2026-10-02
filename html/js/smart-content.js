/* Khối Smart content trong bài blog: tab demo + hiện dần khi cuộn. */
(function () {
  // Tab "Bài viết thường / Smart content"
  document.querySelectorAll('[data-sc-demo]').forEach(function (demo) {
    var tabs = demo.querySelectorAll('[role="tab"]');
    tabs.forEach(function (tab) {
      tab.addEventListener('click', function () {
        tabs.forEach(function (t) {
          var on = t === tab;
          t.setAttribute('aria-selected', on ? 'true' : 'false');
          document.getElementById(t.getAttribute('aria-controls')).hidden = !on;
        });
      });
    });
  });

  // Mục lục: bấm thì trượt tới mục, đang đọc mục nào thì tô đậm mục đó
  var toc = document.querySelector('[data-sc-toc]');
  if (toc) {
    var links = [].slice.call(toc.querySelectorAll('a[href^="#"]'));
    var heads = links.map(function (a) { return document.getElementById(a.getAttribute('href').slice(1)); });
    links.forEach(function (a, i) {
      a.addEventListener('click', function (e) {
        if (!heads[i]) return;
        e.preventDefault();
        heads[i].scrollIntoView({ behavior: 'smooth', block: 'start' });
        history.replaceState(null, '', a.getAttribute('href'));
      });
    });
    var setActive = function () {
      var y = window.innerHeight * 0.3, cur = 0;
      heads.forEach(function (h, i) { if (h && h.getBoundingClientRect().top <= y) cur = i; });
      links.forEach(function (a, i) { a.parentNode.classList.toggle('is-active', i === cur); });
    };
    window.addEventListener('scroll', setActive, { passive: true });
    setActive();
  }

  // Hiện dần các khối khi cuộn tới
  var items = document.querySelectorAll('.sc-in');
  if (!('IntersectionObserver' in window)) {
    items.forEach(function (el) { el.classList.add('is-in'); });
    return;
  }
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    });
  }, { rootMargin: '0px 0px -8% 0px' });
  items.forEach(function (el) { io.observe(el); });
})();
