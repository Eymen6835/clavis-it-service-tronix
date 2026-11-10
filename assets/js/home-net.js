/* ==========================================================================
   Clavis IT Service – Hochauflösende IT-Ebene über dem Luftbild von Mannheim
   (Variante 2: Höhere Vogelperspektive mit Wasserturm, Augustaanlage & Neckar)

   - Gestochen scharfes HiDPI/Retina-Rendering (bis 2.5x DevicePixelRatio)
   - Wasserturm-Laterne als strahlender Hauptknoten mit mehrstufigem Sonar-Impuls
   - Perspektivischer Licht- & Datenstrom mit Schweif entlang der Augustaanlage
   - Sanft geschwungene Bezier-Lichtbögen rund um Wasserturm-Rondell & Fontänen
   - Ortsmarken „WASSERTURM" und „AUGUSTAANLAGE" im edlen Glas-Design
   - Vernetzte Dachknoten (Rosengarten, Christuskirche, Arkaden, Neckarufer,
     Quadrate) mit ruhigen Statusmeldungen („WLAN verbunden ✓", „Backup ✓" …)
   ========================================================================== */
(function () {
  'use strict';

  const canvas = document.querySelector('canvas.home-net');
  const img = document.querySelector('.home-hero-img');
  const hero = document.querySelector('[data-home-hero]');
  if (!canvas || !img || !hero || !canvas.getContext) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const root = document.documentElement;
  const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
  const calm = () => (mq && mq.matches) || root.classList.contains('motion-reduced');

  /* ---------------------------------------------------------------------
     Koordinaten im Luftbild (Anteile 0..1 von Breite 1376 × Höhe 768)
     Kalibriert auf Variante 2 (Wasserturm, Augustaanlage & Neckar)
     --------------------------------------------------------------------- */
  const IMG_W = 1376, IMG_H = 768;

  // Goldene Statue / Laterne auf dem Mannheimer Wasserturm
  const HUB = [0.722, 0.426];

  // Augustaanlage: vom Horizont geradewegs durch die Baumallee zum Friedrichsplatz
  const AVENUE = [
    [0.812, 0.292],
    [0.800, 0.352],
    [0.788, 0.420],
    [0.774, 0.498],
    [0.758, 0.582]
  ];

  // Geschwungener Rundweg am Fuß des Wasserturms (Friedrichsplatz-Rondell)
  const ARC_BASE = [
    [0.595, 0.745],
    [0.625, 0.805],
    [0.678, 0.842],
    [0.748, 0.852],
    [0.808, 0.825],
    [0.845, 0.768]
  ];

  // Geschwungener Bogen um das Wasserbecken / die Fontänen am Friedrichsplatz
  const ARC_PLAZA = [
    [0.630, 0.655],
    [0.672, 0.628],
    [0.755, 0.628],
    [0.818, 0.658],
    [0.848, 0.708]
  ];

  // Feste Ortsmarken am Wasserturm und an der Augustaanlage
  const LANDMARKS = [
    { pos: [0.722, 0.426], label: 'WASSERTURM', side: 'left', dx: -18, dy: -16 },
    { pos: [0.795, 0.380], label: 'AUGUSTAANLAGE', side: 'right', dx: 20, dy: -12 }
  ];

  // Markante Gebäude- und Dachknoten in Mannheim
  const NODES = [
    [0.661, 0.312], // 0: Christuskirche Oststadt
    [0.618, 0.512], // 1: Arkadenbau am Friedrichsplatz
    [0.452, 0.542], // 2: Friedrichsplatz Nordwest-Flügel
    [0.355, 0.608], // 3: Rosengarten
    [0.303, 0.365], // 4: Kirchturm Innenstadt
    [0.378, 0.315], // 5: Neckarbrücke / Neckarufer
    [0.532, 0.415], // 6: Quadrate / Oststadt Übergang
    [0.632, 0.398], // 7: Oststadt Zentrum
    [0.875, 0.365], // 8: Oststadt Süd / Augustaanlage
    [0.915, 0.545], // 9: Arkadenbau Südost
    [0.855, 0.455], // 10: Augustaanlage Südseite
    [0.558, 0.335]  // 11: Mannheimer Horizont
  ];

  // Knoten für einblendende Status-Pills im freien Sichtfeld
  const TAG_CANDIDATES = [0, 1, 6, 7, 11];
  const STATUS = [
    'WLAN verbunden ✓',
    'Backup aktuell ✓',
    'Fernwartung aktiv',
    'Updates geprüft ✓',
    'Firewall & Schutz ✓',
    'E-Mail & Cloud ✓',
    'Netzwerk stabil ✓'
  ];

  // Leitungen zwischen benachbarten Gebäuden und zum Wasserturm
  const dist = (a, b) => Math.hypot((a[0] - b[0]) * IMG_W, (a[1] - b[1]) * IMG_H);
  const edges = [];
  const seen = new Set();
  const addEdge = (i, j) => {
    const key = i < j ? i + '-' + j : j + '-' + i;
    if (i === j || seen.has(key)) return;
    seen.add(key);
    edges.push([i, j]);
  };
  const pts = NODES.concat([HUB]);
  const H = pts.length - 1;
  NODES.forEach((n, i) => {
    NODES.map((m, j) => [j, dist(n, m)]).filter(([j]) => j !== i)
      .sort((a, b) => a[1] - b[1]).slice(0, 2).forEach(([j]) => addEdge(i, j));
  });
  NODES.map((n, i) => [i, dist(n, HUB)]).sort((a, b) => a[1] - b[1]).slice(0, 6).forEach(([i]) => addEdge(i, H));
  const hubEdges = edges.filter((e) => e[0] === H || e[1] === H);

  /* ---------------------------------------------------------------------
     Abbildung Foto → Leinwand (HiDPI / Retina bis 2.5x für höchste Schärfe)
     --------------------------------------------------------------------- */
  let W = 0, Hh = 0, dpr = 1, ox = 0, oy = 0, sw = 0, sh = 0, small = false;
  function fit() {
    W = Math.max(1, canvas.offsetWidth);
    Hh = Math.max(1, canvas.offsetHeight);
    dpr = Math.min(window.devicePixelRatio || 1, 2.5);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(Hh * dpr);
    const s = Math.max(W / IMG_W, Hh / IMG_H);
    sw = IMG_W * s;
    sh = IMG_H * s;
    const pos = (getComputedStyle(img).objectPosition || '72% 52%').split(' ').map((p) => parseFloat(p) / 100);
    ox = (W - sw) * (isNaN(pos[0]) ? 0.72 : pos[0]);
    oy = (Hh - sh) * (isNaN(pos[1]) ? 0.52 : pos[1]);
    small = W < 700;
  }
  const P = (p) => [ox + p[0] * sw, oy + p[1] * sh];
  const visible = (p, m) => p[0] > -m && p[0] < W + m && p[1] > -m && p[1] < Hh + m;

  // Hochauflösender 128×128 Bloom-Leuchtpunkt für edle Lichtgrafik
  const glow = document.createElement('canvas');
  glow.width = glow.height = 128;
  (function () {
    const g = glow.getContext('2d');
    const grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
    grad.addColorStop(0, 'rgba(255, 255, 255, 1)');
    grad.addColorStop(0.14, 'rgba(224, 242, 254, 0.95)');
    grad.addColorStop(0.32, 'rgba(56, 189, 248, 0.72)');
    grad.addColorStop(0.62, 'rgba(14, 165, 233, 0.24)');
    grad.addColorStop(1, 'rgba(56, 189, 248, 0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, 128, 128);
  })();
  function dot(x, y, r, a) {
    if (a <= 0) return;
    ctx.globalAlpha = Math.min(1, a);
    ctx.drawImage(glow, x - r, y - r, r * 2, r * 2);
  }

  /* ---------------------------------------------------------------------
     Animations-Zustand
     --------------------------------------------------------------------- */
  const rand = (a, b) => a + Math.random() * (b - a);
  const phases = NODES.map(() => rand(0, Math.PI * 2));
  let packets = [], stream = [], arcPulses = [], rings = [], tags = [];
  let time = 0, nextPacket = 0, nextStream = 0.2, nextArc = 0.35, nextTag = 1.1, hubGlow = 0.4;
  let statusIdx = 0;

  function triggerHubPulse(strength) {
    hubGlow = Math.max(hubGlow, strength);
    if (rings.length < 3) {
      rings.push({ t: 0, dur: 1.9, maxR: small ? 30 : 46 });
    }
  }

  function spawnPacket() {
    const toHub = Math.random() < 0.6;
    const e = toHub ? hubEdges[(Math.random() * hubEdges.length) | 0] : edges[(Math.random() * edges.length) | 0];
    let a = e[0], b = e[1];
    if (toHub ? a === H : Math.random() < 0.5) { const t = a; a = b; b = t; }
    packets.push({ a, b, t: 0, dur: rand(1.4, 2.3) });
  }

  function update(dt) {
    time += dt;

    // Datenpakete auf den Dachleitungen
    if (time >= nextPacket) {
      if (packets.length < (small ? 6 : 11)) spawnPacket();
      nextPacket = time + rand(0.2, 0.44);
    }
    packets = packets.filter((p) => {
      p.t += dt / p.dur;
      if (p.t >= 1) {
        if (p.b === H) triggerHubPulse(1);
        return false;
      }
      return true;
    });

    // Lichtimpulse entlang der Augustaanlage
    if (time >= nextStream) {
      stream.push({ t: 0, dur: rand(2.5, 3.3), lane: Math.random() < 0.5 ? -1 : 1 });
      nextStream = time + rand(0.55, 1.0);
    }
    stream = stream.filter((s) => {
      s.t += dt / s.dur;
      if (s.t >= 1) {
        triggerHubPulse(0.75);
        return false;
      }
      return true;
    });

    // Gleitende Lichtpunkte auf den geschwungenen Friedrichsplatz-Bögen
    if (time >= nextArc) {
      const useBase = Math.random() < 0.58;
      const rev = Math.random() < 0.5;
      arcPulses.push({
        path: useBase ? ARC_BASE : ARC_PLAZA,
        rev,
        t: 0,
        dur: rand(3.0, 4.2)
      });
      nextArc = time + rand(1.0, 1.65);
    }
    arcPulses = arcPulses.filter((ap) => (ap.t += dt / ap.dur) < 1);

    // Sonar-Ringe um die Wasserturm-Spitze
    rings = rings.filter((r) => (r.t += dt / r.dur) < 1);

    // Status-Badges im freien Sichtfeld
    if (time >= nextTag && !small) {
      const free = TAG_CANDIDATES.map((i) => [i, P(NODES[i])]).filter(([i, p]) =>
        p[0] > W * 0.44 && p[0] < W * 0.68 && p[1] > 45 && p[1] < Hh * 0.62 && !tags.some((t) => t.i === i)
      );
      if (free.length && tags.length < 1) {
        const pick = free[(Math.random() * free.length) | 0];
        const text = STATUS[statusIdx % STATUS.length];
        statusIdx++;
        tags.push({ i: pick[0], text, t: 0, dur: 3.6 });
      }
      nextTag = time + rand(2.6, 3.8);
    }
    tags = tags.filter((t) => (t.t += dt) < t.dur);
    hubGlow = Math.max(0, hubGlow - dt * 1.15);
  }

  function along(path, t) {
    const n = path.length - 1;
    const f = Math.min(n - 1e-6, Math.max(0, t * n));
    const k = Math.floor(f);
    const q = f - k;
    return [
      path[k][0] + (path[k + 1][0] - path[k][0]) * q,
      path[k][1] + (path[k + 1][1] - path[k][1]) * q
    ];
  }

  function strokeSmoothPath(ptsScreen) {
    if (ptsScreen.length < 2) return;
    ctx.beginPath();
    ctx.moveTo(ptsScreen[0][0], ptsScreen[0][1]);
    for (let i = 0; i < ptsScreen.length - 1; i++) {
      const xc = (ptsScreen[i][0] + ptsScreen[i + 1][0]) * 0.5;
      const yc = (ptsScreen[i][1] + ptsScreen[i + 1][1]) * 0.5;
      if (i === 0) {
        ctx.lineTo(xc, yc);
      } else {
        ctx.quadraticCurveTo(ptsScreen[i][0], ptsScreen[i][1], xc, yc);
      }
    }
    const last = ptsScreen[ptsScreen.length - 1];
    ctx.lineTo(last[0], last[1]);
    ctx.stroke();
  }

  function roundRect(x, y, w, h, r) {
    ctx.beginPath();
    if (ctx.roundRect) ctx.roundRect(x, y, w, h, r);
    else ctx.rect(x, y, w, h);
  }

  function drawLandmarkBadge(anchor, lm) {
    if (!visible(anchor, 80)) return;
    const fs = small ? 9.5 : 10.5;
    ctx.font = '600 ' + fs + 'px var(--font-heading, system-ui, sans-serif)';
    const tw = ctx.measureText(lm.label).width;
    const padX = small ? 8 : 10;
    const boxW = tw + padX * 2;
    const boxH = fs + (small ? 9 : 11);
    const scale = small ? 0.78 : 1;
    const bx = lm.side === 'left'
      ? anchor[0] + lm.dx * scale - boxW
      : anchor[0] + lm.dx * scale;
    const by = anchor[1] + lm.dy * scale - boxH * 0.5;
    const lineEndX = lm.side === 'left' ? bx + boxW : bx;

    // Feine leuchtende Zeigerlinie
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.78)';
    ctx.lineWidth = 1.2;
    ctx.beginPath();
    ctx.moveTo(anchor[0], anchor[1]);
    ctx.lineTo(lineEndX, by + boxH * 0.5);
    ctx.stroke();

    // Edles dunkles Schild mit feinem Glanzrahmen
    ctx.fillStyle = 'rgba(5, 16, 40, 0.86)';
    roundRect(bx, by, boxW, boxH, 6);
    ctx.fill();
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.48)';
    ctx.lineWidth = 1;
    roundRect(bx, by, boxW, boxH, 6);
    ctx.stroke();

    ctx.fillStyle = 'rgba(240, 249, 255, 0.98)';
    ctx.textBaseline = 'middle';
    ctx.fillText(lm.label, bx + padX, by + boxH * 0.5 + 0.5);
  }

  function draw() {
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    const sp = pts.map(P);
    const h = sp[H];

    // 1. Feine Netzwerk-Leitungen mit sanftem Farbverlauf zum Wasserturm
    ctx.lineWidth = 1.05;
    edges.forEach(([i, j]) => {
      const a = sp[i], b = sp[j];
      if (!visible(a, 180) && !visible(b, 180)) return;
      const toHub = i === H || j === H;
      ctx.strokeStyle = toHub ? 'rgba(125, 211, 252, 0.38)' : 'rgba(125, 211, 252, 0.20)';
      ctx.beginPath();
      ctx.moveTo(a[0], a[1]);
      ctx.lineTo(b[0], b[1]);
      ctx.stroke();
    });

    // 2. Geschwungene Lichtbögen am Friedrichsplatz (Rondell & Wasserspiele)
    ctx.setLineDash([4, 7]);
    ctx.lineDashOffset = -time * 16;
    ctx.strokeStyle = 'rgba(186, 230, 253, 0.54)';
    ctx.lineWidth = 1.35;
    strokeSmoothPath(ARC_BASE.map(P));
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.42)';
    ctx.lineWidth = 1.2;
    strokeSmoothPath(ARC_PLAZA.map(P));

    // 3. Augustaanlage als leuchtende Haupt-Datenachse
    const av = AVENUE.map(P);
    ctx.setLineDash([3, 6]);
    ctx.lineDashOffset = -time * 24;
    ctx.strokeStyle = 'rgba(125, 211, 252, 0.68)';
    ctx.lineWidth = 1.65;
    ctx.beginPath();
    av.forEach((p, k) => (k ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1])));
    ctx.lineTo(h[0], h[1] + sh * 0.025);
    ctx.stroke();
    ctx.setLineDash([]);

    // 4. Sonar-Impuls-Ringe um die Wasserturm-Laterne
    rings.forEach((r) => {
      const ease = 1 - Math.pow(1 - r.t, 2.2);
      const rad = 5 + ease * r.maxR;
      const alpha = (1 - r.t) * 0.52;
      ctx.strokeStyle = 'rgba(125, 211, 252, ' + alpha.toFixed(3) + ')';
      ctx.lineWidth = 1.5;
      ctx.beginPath();
      ctx.arc(h[0], h[1], rad, 0, Math.PI * 2);
      ctx.stroke();
    });

    // 5. Additive Licht- & Partikelebene („Hohe Grafik")
    ctx.globalCompositeOperation = 'lighter';

    // Dachknoten mit ruhigem Pulsieren
    NODES.forEach((n, i) => {
      const p = sp[i];
      if (!visible(p, 20)) return;
      const a = 0.46 + 0.3 * Math.sin(time * 1.5 + phases[i]);
      dot(p[0], p[1], small ? 7 : 9.5, a);
      dot(p[0], p[1], 2.4, 1);
    });

    // Datenpakete auf den Leitungen mit weichem Kometenschweif
    packets.forEach((pk) => {
      const a = sp[pk.a], b = sp[pk.b];
      const e = pk.t < 0.5 ? 2 * pk.t * pk.t : 1 - Math.pow(-2 * pk.t + 2, 2) / 2;
      for (let k = 5; k >= 0; k--) {
        const q = Math.max(0, e - k * 0.028);
        dot(
          a[0] + (b[0] - a[0]) * q,
          a[1] + (b[1] - a[1]) * q,
          k ? 4.2 - k * 0.45 : 7.5,
          k ? 0.36 - k * 0.05 : 1
        );
      }
    });

    // Perspektivischer Datenstrom die Augustaanlage entlang (mit Schweif)
    stream.forEach((s) => {
      for (let k = 3; k >= 0; k--) {
        const st = Math.max(0, s.t - k * 0.022);
        const q = Math.pow(st, 1.38);
        const ptNorm = along(AVENUE, q);
        const p = P([ptNorm[0] + (s.lane || 0) * 0.0018 * (0.4 + q), ptNorm[1]]);
        const fade = Math.min(1, st / 0.14) * Math.min(1, (1 - st) / 0.16);
        const r = (small ? 3.5 : 4.5) + 6.8 * q;
        dot(p[0], p[1], k ? r * (0.75 - k * 0.12) : r, fade * (k ? 0.38 - k * 0.08 : 0.96));
        if (k === 0) dot(p[0], p[1], 2.2 + 1.5 * q, fade);
      }
    });

    // Gleitende Lichtpunkte auf den Friedrichsplatz-Bögen
    arcPulses.forEach((ap) => {
      for (let k = 2; k >= 0; k--) {
        const st = Math.max(0, ap.t - k * 0.025);
        const u = ap.rev ? 1 - st : st;
        const p = P(along(ap.path, u));
        const fade = Math.min(1, st / 0.16) * Math.min(1, (1 - st) / 0.16);
        dot(p[0], p[1], k ? 4.5 - k : (small ? 6 : 8), fade * (k ? 0.32 : 0.9));
        if (k === 0) dot(p[0], p[1], 2.4, fade);
      }
    });

    // Wasserturm-Laterne als strahlender Hauptknoten
    dot(h[0], h[1], (small ? 15 : 20) + hubGlow * 18, 0.68 + 0.18 * Math.sin(time * 2.0) + hubGlow * 0.35);
    dot(h[0], h[1], 4.2, 1);

    ctx.globalCompositeOperation = 'source-over';
    ctx.globalAlpha = 1;

    // 6. Ortsmarken „WASSERTURM" und „AUGUSTAANLAGE"
    LANDMARKS.forEach((lm) => {
      const anchor = P(lm.pos);
      dot(anchor[0], anchor[1], 3.4, 0.96);
      drawLandmarkBadge(anchor, lm);
    });

    // 7. Einladende Status-Badges („WLAN verbunden ✓" etc.)
    tags.forEach((t) => {
      const a = Math.min(1, t.t / 0.38) * Math.min(1, (t.dur - t.t) / 0.52);
      const p = sp[t.i];
      const fs = 11;
      ctx.font = '600 ' + fs + 'px var(--font-heading, system-ui, sans-serif)';
      const tw = ctx.measureText(t.text).width;
      const x = p[0] + 10, y = p[1] - 32 - (1 - a) * 5;
      ctx.globalAlpha = a;
      ctx.strokeStyle = 'rgba(186, 230, 253, 0.76)';
      ctx.lineWidth = 1.15;
      ctx.beginPath();
      ctx.moveTo(p[0] + 2, p[1] - 2);
      ctx.lineTo(x + 6, y + 20);
      ctx.stroke();

      ctx.fillStyle = 'rgba(5, 16, 40, 0.88)';
      roundRect(x, y, tw + 30, fs + 12, 8);
      ctx.fill();
      ctx.strokeStyle = 'rgba(125, 211, 252, 0.5)';
      roundRect(x, y, tw + 30, fs + 12, 8);
      ctx.stroke();

      ctx.fillStyle = '#4ADE80';
      ctx.beginPath();
      ctx.arc(x + 11, y + (fs + 12) / 2, 3.3, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = 'rgba(240, 249, 255, 0.98)';
      ctx.textBaseline = 'middle';
      ctx.fillText(t.text, x + 20, y + (fs + 12) / 2 + 0.5);
      ctx.globalAlpha = 1;
    });
  }

  /* ---------------------------------------------------------------------
     Ablaufsteuerung
     --------------------------------------------------------------------- */
  let raf = 0, last = 0, onScreen = true;
  function loop(now) {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    update(dt);
    draw();
    raf = requestAnimationFrame(loop);
  }
  function start() {
    if (raf || !onScreen || calm()) return;
    last = 0;
    raf = requestAnimationFrame(loop);
  }
  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }
  function refresh() {
    if (calm()) { stop(); draw(); } else start();
  }

  fit();
  for (let k = 0; k < 95; k++) update(1 / 30);
  tags = [];
  draw();
  requestAnimationFrame(() => canvas.classList.add('is-ready'));

  if ('IntersectionObserver' in window) {
    new IntersectionObserver((entries) => {
      onScreen = entries[0].isIntersecting;
      if (onScreen) start(); else stop();
    }).observe(hero);
  }
  if ('ResizeObserver' in window) {
    let pending = 0;
    new ResizeObserver(() => {
      if (pending) return;
      pending = requestAnimationFrame(() => { pending = 0; fit(); draw(); });
    }).observe(canvas);
  }
  if (mq) {
    if (mq.addEventListener) mq.addEventListener('change', refresh);
    else if (mq.addListener) mq.addListener(refresh);
  }
  if ('MutationObserver' in window) {
    new MutationObserver(refresh).observe(root, { attributes: true, attributeFilter: ['class'] });
  }
  refresh();
})();
