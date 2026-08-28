/* Web100 — hieu-ung-dep.js (toàn bộ hiệu ứng minh hoạ trên trang "Hiệu ứng đẹp") */

document.addEventListener('DOMContentLoaded', () => {
  initFxScrollProgress();
  initFxSparkle();
  initFxParallax();
  initFxTiltCards();
  initFxParticleFields();
  initFxWaterRipple();
  initFxStats();
  initFxScrollZoom();
  initFxStory();
  initFxSmoothEase();
  initFxMagneticButton();
  initFxCustomCursor();
  initFxSpotlight();
  initFxRippleButton();
  initFxSplitText();
  initFxTypewriter();
  initFxKenBurns();
  initFxMarquee();
  initFxStackCards();
  initFxScramble();
  initFxCursorTrail();
  initFxAccordionGallery();
  initFxZoomPan();
  initFxConfetti();
});

function fxClamp(v, min, max) { return Math.max(min, Math.min(max, v)); }
function fxEaseInOutQuad(t) { return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2; }

/* -------------------------------------------------------------------------- */
function initFxScrollProgress() {
  const bar = document.getElementById('fxScrollProgress');
  if (!bar) return;
  const update = () => {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.width = (max > 0 ? (window.pageYOffset / max) * 100 : 0) + '%';
  };
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
}

/* --------------------------------------------------------------------------
   Đốm sáng tự trôi quanh chữ tiêu đề hero — mỗi lần tới đích lại chọn điểm
   ngẫu nhiên mới quanh vòng tròn bao quanh chữ, để lại vệt hạt mờ dần.
   -------------------------------------------------------------------------- */
function initFxSparkle() {
  const wrap = document.querySelector('.fx-sparkle-wrap');
  const canvas = document.getElementById('fxSparkleCanvas');
  if (!wrap || !canvas) return;
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  const ctx = canvas.getContext('2d');
  const PAD = 70;
  let w = 0, h = 0;
  let sparks = [];

  function resize() {
    w = wrap.clientWidth + PAD * 2;
    h = wrap.clientHeight + PAD * 2;
    canvas.width = w; canvas.height = h;
  }
  resize();
  window.addEventListener('resize', resize);

  function randomRingPoint() {
    const a = Math.random() * Math.PI * 2;
    const m = 0.9 + Math.random() * 0.28;
    return {
      x: w / 2 + (w - PAD * 1.3) / 2 * m * Math.cos(a),
      y: h / 2 + (h - PAD * 1.1) / 2 * m * Math.sin(a),
    };
  }

  let head = randomRingPoint();
  let target = randomRingPoint();
  let speed = 4 + Math.random() * 3;

  (function tick() {
    const dx = target.x - head.x, dy = target.y - head.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    if (dist < speed) {
      head = target;
      target = randomRingPoint();
      speed = 4 + Math.random() * 3;
    } else {
      head.x += dx / dist * speed;
      head.y += dy / dist * speed;
    }

    for (let k = 0; k < 2; k++) {
      sparks.push({
        x: head.x, y: head.y,
        vx: (Math.random() - 0.5) * 0.9, vy: (Math.random() - 0.5) * 0.9,
        life: 1, r: 5 + Math.random() * 6,
        hue: 140 + Math.random() * 45,
      });
    }
    ctx.clearRect(0, 0, w, h);
    for (let i = sparks.length - 1; i >= 0; i--) {
      const p = sparks[i];
      p.x += p.vx; p.y += p.vy; p.life -= 0.02;
      if (p.life <= 0) { sparks.splice(i, 1); continue; }
      ctx.beginPath();
      ctx.fillStyle = `hsla(${p.hue},80%,45%,${p.life * 0.6})`;
      ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.save();
    ctx.shadowColor = 'rgba(11,203,104,0.9)';
    ctx.shadowBlur = 14;
    ctx.fillStyle = '#0bcb68';
    ctx.beginPath();
    ctx.arc(head.x, head.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
    requestAnimationFrame(tick);
  })();
}

/* --------------------------------------------------------------------------
   Parallax scrolling — các phần tử [data-speed] dịch chuyển lệch tốc độ so
   với khối .fx-stage chứa chúng khi cuộn trang.
   -------------------------------------------------------------------------- */
function initFxParallax() {
  const els = document.querySelectorAll('[data-speed]');
  if (!els.length) return;

  function update() {
    els.forEach((el) => {
      const speed = parseFloat(el.getAttribute('data-speed'));
      const stage = el.closest('.fx-stage');
      if (!stage) return;
      const rect = stage.getBoundingClientRect();
      const center = rect.top + rect.height / 2 - window.innerHeight / 2;
      const shift = fxClamp(center * -speed * 0.4, -150, 150);
      el.style.transform = `translateY(${shift}px)`;
    });
  }
  window.addEventListener('scroll', update, { passive: true });
  window.addEventListener('resize', update);
  update();
}

/* -------------------------------------------------------------------------- */
function initFxTiltCards() {
  document.querySelectorAll('.fx-tilt-card').forEach((card) => {
    const maxTilt = 12;
    card.addEventListener('mousemove', (e) => {
      const rect = card.getBoundingClientRect();
      const px = (e.clientX - rect.left) / rect.width;
      const py = (e.clientY - rect.top) / rect.height;
      const rotateY = (px - 0.5) * maxTilt * 2;
      const rotateX = (0.5 - py) * maxTilt * 2;
      card.style.transform = `perspective(700px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) scale3d(1.03,1.03,1.03)`;
      const glare = card.querySelector('.fx-tilt-glare');
      if (glare) glare.style.background = `radial-gradient(circle at ${px * 100}% ${py * 100}%, rgba(255,255,255,0.45), transparent 60%)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(700px) rotateX(0deg) rotateY(0deg) scale3d(1,1,1)';
    });
  });
}

/* --------------------------------------------------------------------------
   Particle canvas dùng chung cho 2 biến thể: 'repel' đẩy hạt ra xa con trỏ,
   'attract' hút hạt về phía con trỏ.
   -------------------------------------------------------------------------- */
function initFxParticleFields() {
  function initField(stageId, canvasId, mode) {
    const canvas = document.getElementById(canvasId);
    const stage = document.getElementById(stageId);
    if (!canvas || !stage) return;
    const ctx = canvas.getContext('2d');
    let particles = [];
    const mouse = { x: null, y: null };
    let W, H;

    function resize() { W = stage.clientWidth; H = stage.clientHeight; canvas.width = W; canvas.height = H; }
    function makeParticles() {
      particles = [];
      const count = Math.floor((W * H) / 7000);
      for (let i = 0; i < count; i++) {
        particles.push({ x: Math.random() * W, y: Math.random() * H, vx: (Math.random() - 0.5) * 0.4, vy: (Math.random() - 0.5) * 0.4 });
      }
    }
    resize(); makeParticles();
    window.addEventListener('resize', () => { resize(); makeParticles(); });
    stage.addEventListener('mousemove', (e) => {
      const r = stage.getBoundingClientRect();
      mouse.x = e.clientX - r.left; mouse.y = e.clientY - r.top;
    });
    stage.addEventListener('mouseleave', () => { mouse.x = null; mouse.y = null; });

    function tick() {
      ctx.clearRect(0, 0, W, H);
      particles.forEach((p) => {
        p.x += p.vx; p.y += p.vy;
        if (p.x < 0 || p.x > W) p.vx *= -1;
        if (p.y < 0 || p.y > H) p.vy *= -1;
        if (mouse.x !== null) {
          const dx = p.x - mouse.x, dy = p.y - mouse.y, dist = Math.sqrt(dx * dx + dy * dy);
          if (mode === 'attract') {
            if (dist < 160 && dist > 14) { p.x -= dx / dist * 0.9; p.y -= dy / dist * 0.9; }
          } else if (dist < 90) {
            p.x += dx / dist * 0.6; p.y += dy / dist * 0.6;
          }
        }
      });
      ctx.fillStyle = 'rgba(180,230,200,0.9)';
      particles.forEach((p) => { ctx.beginPath(); ctx.arc(p.x, p.y, 1.6, 0, Math.PI * 2); ctx.fill(); });
      for (let i = 0; i < particles.length; i++) {
        for (let j = i + 1; j < particles.length; j++) {
          const a = particles[i], b = particles[j];
          const dx = a.x - b.x, dy = a.y - b.y, dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < 110) {
            ctx.strokeStyle = `rgba(11,203,104,${(1 - dist / 110) * 0.5})`;
            ctx.lineWidth = 1;
            ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
          }
        }
      }
      if (mode === 'attract' && mouse.x !== null) {
        const wob = Math.sin(performance.now() / 300) * 0.12;
        ctx.save();
        ctx.beginPath();
        ctx.arc(mouse.x, mouse.y, 26, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(11,203,104,0.18)';
        ctx.fill();
        ctx.translate(mouse.x, mouse.y);
        ctx.rotate(-Math.PI / 5 + wob);
        ctx.font = '28px serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('🧲', 0, 0);
        ctx.restore();
      }
      requestAnimationFrame(tick);
    }
    tick();
  }
  initField('fxParticleStage', 'fxParticleCanvas', 'repel');
  initField('fxParticleStageAttract', 'fxParticleCanvasAttract', 'attract');
}

/* --------------------------------------------------------------------------
   Gợn sóng mặt nước — height-field vật lý 2 buffer, chỉ vẽ lại các ô lệch vị
   trí đủ lớn nên vẫn nhẹ dù lưới mịn. Dừng vòng lặp khi banner khuất tầm nhìn.
   -------------------------------------------------------------------------- */
function initFxWaterRipple() {
  const canvas = document.getElementById('fxWaterCanvas');
  const stage = document.getElementById('fxWaterStage');
  if (!canvas || !stage) return;
  const ctx = canvas.getContext('2d');
  const img = new Image();
  img.src = '../images/hero-full-1600x900.jpg';

  const TARGET_CELL = 7;
  let COLS = 0, ROWS = 0, W = 0, H = 0;
  let bufA, bufB, edgeDamp;
  const damping = 0.988;
  const REFRACTION = 0.16;
  const SHADE = 0.014;
  let cw = 0, ch = 0;
  let cellW = 0, cellH = 0, srcCellW = 0, srcCellH = 0;
  let srcX = 0, srcY = 0, srcW = 0, srcH = 0;

  function gidx(i, j) { return j * W + i; }

  function rebuildGrid(newCols, newRows) {
    COLS = newCols; ROWS = newRows;
    W = COLS + 2; H = ROWS + 2;
    bufA = new Float32Array(W * H);
    bufB = new Float32Array(W * H);
    edgeDamp = new Float32Array(W * H);
    const margin = Math.max(5, Math.round(Math.min(COLS, ROWS) * 0.1));
    for (let ej = 1; ej <= ROWS; ej++) {
      for (let ei = 1; ei <= COLS; ei++) {
        const distToEdge = Math.min(ei - 1, COLS - ei, ej - 1, ROWS - ej);
        edgeDamp[gidx(ei, ej)] = distToEdge >= margin ? 1 : 0.72 + 0.28 * (distToEdge / margin);
      }
    }
  }

  function resize() {
    cw = stage.clientWidth; ch = stage.clientHeight;
    canvas.width = cw; canvas.height = ch;
    const newCols = Math.max(24, Math.round(cw / TARGET_CELL));
    const newRows = Math.max(16, Math.round(ch / TARGET_CELL));
    if (newCols !== COLS || newRows !== ROWS) rebuildGrid(newCols, newRows);
    cellW = cw / COLS; cellH = ch / ROWS;
    if (img.naturalWidth) {
      const canvasRatio = cw / ch;
      const imgRatio = img.naturalWidth / img.naturalHeight;
      if (imgRatio > canvasRatio) {
        srcH = img.naturalHeight; srcW = srcH * canvasRatio;
        srcX = (img.naturalWidth - srcW) / 2; srcY = 0;
      } else {
        srcW = img.naturalWidth; srcH = srcW / canvasRatio;
        srcX = 0; srcY = (img.naturalHeight - srcH) / 2;
      }
      srcCellW = srcW / COLS; srcCellH = srcH / ROWS;
    }
  }
  window.addEventListener('resize', resize);

  function drop(cx, cy, strength, radiusPx) {
    radiusPx = radiusPx || 10;
    const ci = cx / cellW + 1, cj = cy / cellH + 1;
    const spanI = Math.ceil(radiusPx / cellW) + 1;
    const spanJ = Math.ceil(radiusPx / cellH) + 1;
    for (let dj = -spanJ; dj <= spanJ; dj++) {
      for (let di = -spanI; di <= spanI; di++) {
        const pxDist = Math.sqrt(Math.pow(di * cellW, 2) + Math.pow(dj * cellH, 2));
        if (pxDist > radiusPx) continue;
        const i = Math.round(ci + di), j = Math.round(cj + dj);
        if (i < 1 || i > COLS || j < 1 || j > ROWS) continue;
        const falloff = 0.5 + 0.5 * Math.cos(Math.PI * pxDist / radiusPx);
        bufA[gidx(i, j)] += strength * falloff;
      }
    }
  }

  function splash(cx, cy, strength, radiusPx) {
    drop(cx, cy, -strength, radiusPx);
    setTimeout(() => drop(cx, cy, strength * 0.6, radiusPx * 0.7), 90);
  }

  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const scaleX = cw / rect.width, scaleY = ch / rect.height;
    splash((e.clientX - rect.left) * scaleX, (e.clientY - rect.top) * scaleY, 90, 9);
  });

  function scheduleAutoDrop() {
    const delay = 400 + Math.random() * 900;
    setTimeout(() => {
      if (cw > 0 && ch > 0) {
        const count = 1 + Math.floor(Math.random() * 3);
        for (let k = 0; k < count; k++) {
          setTimeout(() => splash(Math.random() * cw, Math.random() * ch, 60 + Math.random() * 25, 7 + Math.random() * 3), k * 150);
        }
      }
      scheduleAutoDrop();
    }, delay);
  }
  scheduleAutoDrop();

  function update() {
    for (let i = 1; i <= COLS; i++) {
      bufA[gidx(i, 0)] = bufA[gidx(i, 1)];
      bufA[gidx(i, ROWS + 1)] = bufA[gidx(i, ROWS)];
    }
    for (let j = 1; j <= ROWS; j++) {
      bufA[gidx(0, j)] = bufA[gidx(1, j)];
      bufA[gidx(COLS + 1, j)] = bufA[gidx(COLS, j)];
    }
    for (let j = 1; j <= ROWS; j++) {
      for (let i = 1; i <= COLS; i++) {
        const id = gidx(i, j);
        bufB[id] = (bufA[gidx(i - 1, j)] + bufA[gidx(i + 1, j)] + bufA[gidx(i, j - 1)] + bufA[gidx(i, j + 1)]) / 2 - bufB[id];
        bufB[id] *= damping * edgeDamp[id];
      }
    }
    const tmp = bufA; bufA = bufB; bufB = tmp;
  }

  function render() {
    if (img.complete && img.naturalWidth && cw > 0) {
      update();
      ctx.clearRect(0, 0, cw, ch);
      ctx.drawImage(img, srcX, srcY, srcW, srcH, 0, 0, cw, ch);
      for (let j = 0; j < ROWS; j++) {
        for (let i = 0; i < COLS; i++) {
          const gi = i + 1, gj = j + 1;
          const dx = fxClamp((bufA[gidx(gi + 1, gj)] - bufA[gidx(gi - 1, gj)]) * REFRACTION, -18, 18);
          const dy = fxClamp((bufA[gidx(gi, gj + 1)] - bufA[gidx(gi, gj - 1)]) * REFRACTION, -18, 18);
          if (Math.abs(dx) < 0.35 && Math.abs(dy) < 0.35) continue;
          ctx.drawImage(img, srcX + i * srcCellW, srcY + j * srcCellH, srcCellW + 2, srcCellH + 2, i * cellW + dx, j * cellH + dy, cellW + 2, cellH + 2);
          const shade = (dx + dy) * SHADE;
          if (shade > 0.015) {
            ctx.fillStyle = `rgba(255,255,255,${Math.min(shade, 0.22).toFixed(3)})`;
            ctx.fillRect(i * cellW, j * cellH, cellW + 1, cellH + 1);
          } else if (shade < -0.015) {
            ctx.fillStyle = `rgba(4,18,38,${Math.min(-shade, 0.26).toFixed(3)})`;
            ctx.fillRect(i * cellW, j * cellH, cellW + 1, cellH + 1);
          }
        }
      }
    }
    scheduleFrame();
  }

  let running = true, rafId = null, isVisible = true, isFocused = document.visibilityState !== 'hidden';
  let firstAppearRippled = false;
  function maybeFirstRipple() {
    if (firstAppearRippled || !isVisible || cw <= 0) return;
    firstAppearRippled = true;
    splash(Math.random() * cw, Math.random() * ch, 70, 8);
  }
  function scheduleFrame() { if (running) rafId = requestAnimationFrame(render); }
  function setRunning(next) {
    if (next === running) return;
    running = next;
    if (running) scheduleFrame(); else if (rafId) cancelAnimationFrame(rafId);
  }
  function refreshRunning() { setRunning(isVisible && isFocused); }

  const io = new IntersectionObserver((entries) => {
    isVisible = entries[0].isIntersecting;
    refreshRunning();
    maybeFirstRipple();
  }, { threshold: 0.05 });
  io.observe(stage);

  document.addEventListener('visibilitychange', () => {
    isFocused = document.visibilityState !== 'hidden';
    refreshRunning();
  });

  let started = false;
  function start() { if (started) return; started = true; resize(); render(); maybeFirstRipple(); }
  img.addEventListener('load', start);
  if (img.complete && img.naturalWidth) start();
}

/* -------------------------------------------------------------------------- */
function initFxStats() {
  const grid = document.getElementById('fxStatsGrid');
  if (!grid) return;
  const nums = grid.querySelectorAll('.fx-stat-num');
  const duration = 2200;
  let running = false;

  function run() {
    if (running) return;
    running = true;
    let start = null;
    function frame(ts) {
      if (!start) start = ts;
      const p = fxClamp((ts - start) / duration, 0, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      nums.forEach((el) => {
        const target = parseInt(el.getAttribute('data-target'), 10);
        el.textContent = Math.round(target * eased).toLocaleString('vi-VN');
      });
      if (p < 1) requestAnimationFrame(frame); else running = false;
    }
    requestAnimationFrame(frame);
  }

  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) { run(); observer.unobserve(grid); }
  }, { threshold: 0.4 });
  observer.observe(grid);

  const replay = document.getElementById('fxStatsReplay');
  if (replay) replay.addEventListener('click', run);
}

/* --------------------------------------------------------------------------
   Scroll zoom — mức zoom tỉ lệ thuận với % trang đã cuộn, làm mượt bằng lerp.
   -------------------------------------------------------------------------- */
function initFxScrollZoom() {
  const panel = document.getElementById('fxAwningPanel');
  if (!panel) return;
  let zoomLevel = 0;
  const ZOOM_MAX = 0.12;

  function progress() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    return max > 0 ? fxClamp(window.pageYOffset / max, 0, 1) : 0;
  }
  (function tick() {
    const target = progress();
    zoomLevel += (target - zoomLevel) * 0.2;
    panel.style.transform = `scale(${1 + zoomLevel * ZOOM_MAX})`;
    requestAnimationFrame(tick);
  })();
}

/* --------------------------------------------------------------------------
   Scrollytelling — ảnh bên trái đứng yên (sticky), đổi ảnh + caption theo
   bước đang lọt vào giữa khung nhìn bên phải.
   -------------------------------------------------------------------------- */
function initFxStory() {
  const steps = document.querySelectorAll('.fx-story-step');
  const imgs = document.querySelectorAll('.fx-story-visual img');
  const caption = document.getElementById('fxStoryCaption');
  if (!steps.length) return;
  const captions = ['Bước 1 — Khởi đầu', 'Bước 2 — Tin tức & cập nhật', 'Bước 3 — Vinh danh & giải thưởng', 'Bước 4 — Dự án nổi bật'];

  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      const step = entry.target.getAttribute('data-step');
      if (entry.isIntersecting) {
        steps.forEach((s) => s.classList.remove('is-active'));
        entry.target.classList.add('is-active');
        imgs.forEach((img) => img.classList.toggle('is-active', img.getAttribute('data-step') === step));
        if (caption) caption.textContent = captions[step] || '';
      }
    });
  }, { threshold: 0.6 });
  steps.forEach((s) => observer.observe(s));
}

/* -------------------------------------------------------------------------- */
function initFxSmoothEase() {
  const dot = document.getElementById('fxEaseDot');
  if (!dot) return;
  function play() {
    const track = dot.parentElement;
    const maxX = track.clientWidth - 14;
    const duration = 1400;
    let start = null;
    function step(ts) {
      if (!start) start = ts;
      const p = fxClamp((ts - start) / duration, 0, 1);
      dot.style.left = (fxEaseInOutQuad(p) * maxX) + 'px';
      if (p < 1) requestAnimationFrame(step); else setTimeout(play, 1200);
    }
    requestAnimationFrame(step);
  }
  play();
  const replay = document.getElementById('fxReplayEase');
  if (replay) replay.addEventListener('click', () => { dot.style.left = '0px'; });
}

/* -------------------------------------------------------------------------- */
function initFxMagneticButton() {
  const btn = document.getElementById('fxMagneticBtn');
  if (!btn) return;
  btn.addEventListener('mousemove', (e) => {
    const rect = btn.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    btn.style.transform = `translate(${x * 0.35}px,${y * 0.35}px)`;
  });
  btn.addEventListener('mouseleave', () => { btn.style.transform = 'translate(0,0)'; });
}

/* -------------------------------------------------------------------------- */
function initFxCustomCursor() {
  const zone = document.getElementById('fxCursorZone');
  const cursor = document.getElementById('fxCustomCursor');
  if (!zone || !cursor) return;
  zone.addEventListener('mousemove', (e) => {
    cursor.style.left = e.clientX + 'px';
    cursor.style.top = e.clientY + 'px';
    cursor.classList.add('is-show');
  });
  zone.addEventListener('mouseenter', () => cursor.classList.add('is-big'));
  zone.addEventListener('mouseleave', () => cursor.classList.remove('is-show', 'is-big'));
}

/* -------------------------------------------------------------------------- */
function initFxSpotlight() {
  const el = document.getElementById('fxSpotlightCard');
  if (!el) return;
  el.addEventListener('mousemove', (e) => {
    const rect = el.getBoundingClientRect();
    el.style.setProperty('--x', (e.clientX - rect.left) + 'px');
    el.style.setProperty('--y', (e.clientY - rect.top) + 'px');
  });
}

/* -------------------------------------------------------------------------- */
function initFxRippleButton() {
  const btn = document.getElementById('fxRippleBtn');
  if (!btn) return;
  btn.addEventListener('click', (e) => {
    const rect = btn.getBoundingClientRect();
    const span = document.createElement('span');
    span.className = 'fx-ripple';
    const size = Math.max(rect.width, rect.height);
    span.style.width = span.style.height = size + 'px';
    span.style.left = (e.clientX - rect.left - size / 2) + 'px';
    span.style.top = (e.clientY - rect.top - size / 2) + 'px';
    btn.appendChild(span);
    span.addEventListener('animationend', () => span.remove());
  });
}

/* -------------------------------------------------------------------------- */
function initFxSplitText() {
  const el = document.getElementById('fxSplitText');
  if (!el) return;
  const original = el.textContent;
  el.textContent = '';
  original.split('').forEach((ch, i) => {
    const span = document.createElement('span');
    span.className = 'fx-ch';
    span.style.transitionDelay = (i * 0.02) + 's';
    span.textContent = ch === ' ' ? ' ' : ch;
    el.appendChild(span);
  });
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) { el.classList.add('is-in-view'); observer.unobserve(el); }
    });
  }, { threshold: 0.5 });
  observer.observe(el);
}

/* -------------------------------------------------------------------------- */
function initFxTypewriter() {
  const line = document.getElementById('fxTwLine');
  if (!line) return;
  const phrases = ['Thiết kế đẹp bắt đầu từ chi tiết nhỏ.', 'Hiệu ứng đúng chỗ, đúng lúc.', 'Đẹp mắt nhưng không làm chậm tốc độ tải trang.'];
  let pIndex = 0, cIndex = 0, deleting = false;
  function tick() {
    const current = phrases[pIndex];
    if (!deleting) {
      cIndex++;
      line.textContent = current.slice(0, cIndex);
      if (cIndex === current.length) { deleting = true; setTimeout(tick, 1400); return; }
    } else {
      cIndex--;
      line.textContent = current.slice(0, cIndex);
      if (cIndex === 0) { deleting = false; pIndex = (pIndex + 1) % phrases.length; }
    }
    setTimeout(tick, deleting ? 35 : 55);
  }
  tick();
}

/* -------------------------------------------------------------------------- */
function initFxKenBurns() {
  const slides = document.querySelectorAll('.fx-kb-slide');
  if (!slides.length) return;
  let index = 0;
  setInterval(() => {
    slides[index].classList.remove('is-active');
    index = (index + 1) % slides.length;
    slides[index].classList.add('is-active');
  }, 5000);
}

/* -------------------------------------------------------------------------- */
function initFxMarquee() {
  const track = document.getElementById('fxMarqueeTrack');
  if (!track) return;
  const tags = ['Website doanh nghiệp', 'Website bán hàng', 'Landing page', 'SEO bền vững', 'Chạy quảng cáo', 'Cải tạo website cũ', 'UI/UX', 'Tối ưu tốc độ'];
  const chunk = tags.map((t) => `<span>${t}</span>`).join('');
  track.innerHTML = chunk + chunk;
}

/* --------------------------------------------------------------------------
   Sticky stacking cards — card sau trượt đè lên card trước, card bị đè thu
   nhỏ dần theo vị trí của card kế tiếp.
   -------------------------------------------------------------------------- */
function initFxStackCards() {
  const cards = document.querySelectorAll('.fx-stack-card');
  if (!cards.length) return;
  function update() {
    for (let i = 0; i < cards.length - 1; i++) {
      const next = cards[i + 1];
      const stickTop = 90 + (i + 1) * 18;
      const nTop = next.getBoundingClientRect().top;
      const vh = window.innerHeight;
      const p = fxClamp(1 - (nTop - stickTop) / (vh - stickTop), 0, 1);
      cards[i].style.transform = `scale(${1 - p * 0.05})`;
    }
  }
  window.addEventListener('scroll', update, { passive: true });
  update();
}

/* -------------------------------------------------------------------------- */
function initFxScramble() {
  const el = document.getElementById('fxScrambleText');
  if (!el) return;
  const CHARS = '!<>-_\\/[]{}=+*^?#@%&';
  let timer = null;
  function run() {
    const text = el.getAttribute('data-text');
    let frame = 0;
    clearInterval(timer);
    timer = setInterval(() => {
      let out = '';
      for (let i = 0; i < text.length; i++) {
        if (text[i] === ' ') { out += ' '; continue; }
        if (frame >= i * 2 + 8) out += text[i];
        else out += `<span class="fx-scr">${CHARS[Math.floor(Math.random() * CHARS.length)]}</span>`;
      }
      el.innerHTML = out;
      frame++;
      if (frame > text.length * 2 + 10) clearInterval(timer);
    }, 28);
  }
  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) { run(); observer.unobserve(el); }
  }, { threshold: 0.5 });
  observer.observe(el);
  const replay = document.getElementById('fxScrambleReplay');
  if (replay) replay.addEventListener('click', run);
}

/* -------------------------------------------------------------------------- */
function initFxCursorTrail() {
  const stage = document.getElementById('fxTrailStage');
  const canvas = document.getElementById('fxTrailCanvas');
  if (!stage || !canvas) return;
  const ctx = canvas.getContext('2d');
  let parts = [];
  function resize() { canvas.width = stage.clientWidth; canvas.height = stage.clientHeight; }
  resize();
  window.addEventListener('resize', resize);
  stage.addEventListener('mousemove', (e) => {
    const r = stage.getBoundingClientRect();
    for (let k = 0; k < 3; k++) {
      parts.push({
        x: e.clientX - r.left, y: e.clientY - r.top,
        vx: (Math.random() - 0.5) * 1.6, vy: (Math.random() - 0.5) * 1.6 - 0.4,
        life: 1, r: 2.5 + Math.random() * 2.5,
        hue: 140 + Math.random() * 45,
      });
    }
  });
  (function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = parts.length - 1; i >= 0; i--) {
      const p = parts[i];
      p.x += p.vx; p.y += p.vy; p.life -= 0.025;
      if (p.life <= 0) { parts.splice(i, 1); continue; }
      ctx.beginPath();
      ctx.fillStyle = `hsla(${p.hue},80%,55%,${p.life * 0.9})`;
      ctx.arc(p.x, p.y, p.r * p.life, 0, Math.PI * 2);
      ctx.fill();
    }
    requestAnimationFrame(tick);
  })();
}

/* --------------------------------------------------------------------------
   Accordion gallery — hover xử lý desktop; trên màn cảm ứng, tap để bật/tắt.
   -------------------------------------------------------------------------- */
function initFxAccordionGallery() {
  const items = document.querySelectorAll('.fx-acc-item');
  items.forEach((item) => {
    item.addEventListener('click', () => {
      const wasActive = item.classList.contains('is-active');
      items.forEach((o) => o.classList.remove('is-active'));
      if (!wasActive) item.classList.add('is-active');
    });
  });
}

/* -------------------------------------------------------------------------- */
function initFxZoomPan() {
  document.querySelectorAll('.fx-zoompan').forEach((box) => {
    const img = box.querySelector('img');
    box.addEventListener('mousemove', (e) => {
      const r = box.getBoundingClientRect();
      const px = (e.clientX - r.left) / r.width;
      const py = (e.clientY - r.top) / r.height;
      img.style.transform = `scale(1.3) translate(${(0.5 - px) * 18}%,${(0.5 - py) * 18}%)`;
    });
    box.addEventListener('mouseleave', () => { img.style.transform = 'scale(1) translate(0,0)'; });
  });
}

/* -------------------------------------------------------------------------- */
function initFxConfetti() {
  const stage = document.getElementById('fxConfettiStage');
  const canvas = document.getElementById('fxConfettiCanvas');
  const btn = document.getElementById('fxConfettiBtn');
  if (!stage || !canvas || !btn) return;
  const ctx = canvas.getContext('2d');
  let confetti = [];
  let running = false;
  const COLORS = ['#0bcb68', '#0891a8', '#d4a012', '#046c36', '#4ade80', '#22a3bd'];
  function resize() { canvas.width = stage.clientWidth; canvas.height = stage.clientHeight; }
  resize();
  window.addEventListener('resize', resize);
  function tick() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (let i = confetti.length - 1; i >= 0; i--) {
      const p = confetti[i];
      p.vy += 0.12;
      p.x += p.vx; p.y += p.vy;
      p.rot += p.vr;
      if (p.y > canvas.height + 30) { confetti.splice(i, 1); continue; }
      ctx.save();
      ctx.translate(p.x, p.y);
      ctx.rotate(p.rot);
      ctx.scale(1, Math.sin(p.rot * 2) * 0.7 + 0.3);
      ctx.fillStyle = p.color;
      ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h);
      ctx.restore();
    }
    if (confetti.length) requestAnimationFrame(tick); else running = false;
  }
  btn.addEventListener('click', () => {
    const sr = stage.getBoundingClientRect();
    const br = btn.getBoundingClientRect();
    const cx = br.left - sr.left + br.width / 2;
    const cy = br.top - sr.top + br.height / 2;
    for (let i = 0; i < 130; i++) {
      const ang = -Math.PI / 2 + (Math.random() - 0.5) * 1.6;
      const speed = 4 + Math.random() * 7;
      confetti.push({
        x: cx, y: cy, vx: Math.cos(ang) * speed, vy: Math.sin(ang) * speed,
        w: 5 + Math.random() * 5, h: 8 + Math.random() * 6,
        rot: Math.random() * Math.PI * 2, vr: (Math.random() - 0.5) * 0.35,
        color: COLORS[Math.floor(Math.random() * COLORS.length)],
      });
    }
    if (!running) { running = true; tick(); }
  });
}
