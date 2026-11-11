/* ==========================================================================
   Clavis IT Service – Fotorealistischer Zeitraffer im Kopfbereich der Startseite
   (Spätnachmittag → Sonnenuntergang → Blaue Stunde → Morgendämmerung → Tag)

   - Statische Luftbild-Kamera über Mannheim (Wasserturm, Friedrichsplatz,
     Augustaanlage, Rosengarten & Neckar)
   - Stufenloser WebGL-Übergang in beide Richtungen (Hell ↔ Dunkel) ohne Raster
   - Straßenlaternen entlang der Augustaanlage schalten sich der Reihe nach ein/aus
   - Stadtfenster und die Wasserturm-Anstrahlung blenden organisch auf und ab
   - Sanfte Langzeitbelichtungs-Lichtspuren des Verkehrs (Traffic Light Trails)
   - Pausiert automatisch außerhalb des Sichtfelds oder bei „Bewegung reduzieren"
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

  const IMG_W = 1376, IMG_H = 768;
  const CYCLE_DURATION = 16.0; // Symmetrischer 16-Sekunden-Zyklus (je 5,8s Hell->Dunkel & Dunkel->Hell)

  /* ---------------------------------------------------------------------
     Offscreen-WebGL-Bühne (1376 × 768) für den stufenlosen Zeitraffer-Shader
     --------------------------------------------------------------------- */
  const glCanvas = document.createElement('canvas');
  glCanvas.width = IMG_W;
  glCanvas.height = IMG_H;
  const gl = glCanvas.getContext('webgl', { premultipliedAlpha: false, antialias: true });
  if (!gl) return;

  const vsSource = `
    attribute vec2 aPos;
    varying vec2 vUv;
    void main() {
      vUv = aPos * 0.5 + 0.5;
      vUv.y = 1.0 - vUv.y;
      gl_Position = vec4(aPos, 0.0, 1.0);
    }
  `;

  const fsSource = `
    precision highp float;
    varying vec2 vUv;
    uniform sampler2D uDay;
    uniform sampler2D uNight;
    uniform float uTime;
    uniform float uProgress;  // 0.0 = Tag, 1.0 = Blaue Stunde
    uniform float uDirection; // +1.0 = Abend (Hell -> Dunkel), -1.0 = Morgen (Dunkel -> Hell)

    float softWave(vec2 p) {
      float w1 = sin(p.x * 18.0 + p.y * 11.0);
      float w2 = cos(p.x * 29.0 - p.y * 23.0);
      float w3 = sin(p.x * 47.0 + p.y * 37.0);
      return (w1 * 0.5 + w2 * 0.3 + w3 * 0.2) * 0.5 + 0.5;
    }

    float segDist(vec2 p, vec2 a, vec2 b, out float hOut) {
      vec2 pa = p - a, ba = b - a;
      hOut = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0);
      return length(pa - ba * hOut);
    }

    void main() {
      vec2 uv = vUv;

      vec3 dayCol = texture2D(uDay, uv).rgb;
      vec3 nightCol = texture2D(uNight, uv).rgb;

      // 1. Sanft ziehende Wolken am Taghimmel
      float skyMask = smoothstep(0.245, 0.165, uv.y);
      if (skyMask > 0.001) {
        float cloudDrift = uTime * 0.009;
        vec2 skyUv = vec2(1.0 - abs(1.0 - mod(uv.x - cloudDrift, 2.0)), uv.y);
        vec3 driftedDaySky = texture2D(uDay, skyUv).rgb;
        dayCol = mix(dayCol, driftedDaySky, skyMask * 0.72 * (1.0 - smoothstep(0.25, 0.65, uProgress)));
      }

      // 2. Symmetrische, seidenweiche Himmels- & Atmosphären-Entwicklung
      float skyVerticalShift = (0.25 - uv.y) * 0.15 * uDirection;
      float skyProgress = smoothstep(0.06, 0.78, uProgress + skyVerticalShift);
      float cityAmbientProgress = smoothstep(0.10, 0.84, uProgress);
      float envBlend = mix(cityAmbientProgress, skyProgress, smoothstep(0.30, 0.22, uv.y));

      // Warme Dämmerungs-Farbtönung in der Übergangsmitte
      float twilightBell = sin(clamp(uProgress / 0.78, 0.0, 1.0) * 3.14159);
      vec3 eveningTint = vec3(1.09, 0.95, 0.82);
      vec3 morningTint = vec3(1.07, 0.96, 0.88);
      vec3 activeTint = uDirection >= 0.0 ? eveningTint : morningTint;
      vec3 tintedDay = dayCol * mix(vec3(1.0), activeTint, twilightBell * 0.78);

      vec3 baseScene = mix(tintedDay, nightCol, envBlend);

      // 3. Reines additives Warmlicht der Stadtbeleuchtung (unterhalb des Horizonts uv.y > 0.29)
      float belowHorizon = smoothstep(0.285, 0.345, uv.y);
      vec3 positiveEmission = max(vec3(0.0), nightCol - baseScene);
      float warmGlowMask = smoothstep(0.02, 0.18, positiveEmission.r - positiveEmission.b * 0.75) * belowHorizon;

      // A) Wasserturm-Anstrahlung
      float towerMask = smoothstep(0.095, 0.03, length((uv - vec2(0.718, 0.60)) * vec2(1.0, 0.42)));
      float towerHeightOrder = clamp((0.82 - uv.y) / 0.42, 0.0, 1.0);
      float towerOrder = uDirection >= 0.0 ? towerHeightOrder : (1.0 - towerHeightOrder);
      float towerTurnOn = smoothstep(0.22 + towerOrder * 0.16, 0.56 + towerOrder * 0.16, uProgress);

      // B) Augustaanlage-Laternenkette
      float avePos = 0.0;
      float dAve = segDist(uv, vec2(0.758, 0.585), vec2(0.812, 0.292), avePos);
      float aveCorridor = 1.0 - smoothstep(0.02, 0.055, dAve);
      float aveOrder = uDirection >= 0.0 ? avePos : (1.0 - avePos);
      float aveTurnOn = smoothstep(0.20 + aveOrder * 0.34, 0.48 + aveOrder * 0.34, uProgress);

      // C) Sanfte, stufenlose Welle für die Stadtgebäude
      float waveVal = softWave(uv);
      float waveOrder = uDirection >= 0.0 ? waveVal : (1.0 - waveVal);
      float cityLightsTurnOn = smoothstep(0.18 + waveOrder * 0.34, 0.54 + waveOrder * 0.32, uProgress);

      float lightActivation = cityLightsTurnOn;
      lightActivation = mix(lightActivation, aveTurnOn, aveCorridor);
      lightActivation = mix(lightActivation, towerTurnOn, towerMask);

      vec3 finalCol = baseScene + positiveEmission * warmGlowMask * lightActivation;

      gl_FragColor = vec4(clamp(finalCol, 0.0, 1.0), 1.0);
    }
  `;

  function compileShader(type, src) {
    const s = gl.createShader(type);
    gl.shaderSource(s, src);
    gl.compileShader(s);
    return s;
  }

  const prog = gl.createProgram();
  gl.attachShader(prog, compileShader(gl.VERTEX_SHADER, vsSource));
  gl.attachShader(prog, compileShader(gl.FRAGMENT_SHADER, fsSource));
  gl.linkProgram(prog);
  gl.useProgram(prog);

  const buf = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, buf);
  gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
  const aPos = gl.getAttribLocation(prog, 'aPos');
  gl.enableVertexAttribArray(aPos);
  gl.vertexAttribPointer(aPos, 2, gl.FLOAT, false, 0, 0);

  const uTimeLoc = gl.getUniformLocation(prog, 'uTime');
  const uProgLoc = gl.getUniformLocation(prog, 'uProgress');
  const uDirLoc = gl.getUniformLocation(prog, 'uDirection');
  const uDayLoc = gl.getUniformLocation(prog, 'uDay');
  const uNightLoc = gl.getUniformLocation(prog, 'uNight');

  function uploadTex(unit, imageEl) {
    const t = gl.createTexture();
    gl.activeTexture(gl.TEXTURE0 + unit);
    gl.bindTexture(gl.TEXTURE_2D, t);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
    gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
    gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, imageEl);
    return t;
  }

  /* ---------------------------------------------------------------------
     Abbildung Foto → Leinwand (synchron zu object-fit: cover & object-position)
     --------------------------------------------------------------------- */
  let W = 0, Hh = 0, dpr = 1, ox = 0, oy = 0, sw = 0, sh = 0, scaleFactor = 1;
  function fit() {
    W = Math.max(1, canvas.offsetWidth);
    Hh = Math.max(1, canvas.offsetHeight);
    dpr = Math.min(window.devicePixelRatio || 1, 2.0);
    canvas.width = Math.round(W * dpr);
    canvas.height = Math.round(Hh * dpr);
    scaleFactor = Math.max(W / IMG_W, Hh / IMG_H);
    sw = IMG_W * scaleFactor;
    sh = IMG_H * scaleFactor;
    const pos = (getComputedStyle(img).objectPosition || '72% 54%').split(' ').map((p) => parseFloat(p) / 100);
    ox = (W - sw) * (isNaN(pos[0]) ? 0.72 : pos[0]);
    oy = (Hh - sh) * (isNaN(pos[1]) ? 0.54 : pos[1]);
  }
  const P = (u, v) => [ox + u * sw, oy + v * sh];

  /* ---------------------------------------------------------------------
     2D-Zeitraffer-Lichtspuren & Laternen entlang der Augustaanlage
     --------------------------------------------------------------------- */
  const STREETLIGHTS_AVE = [];
  for (let i = 0; i < 16; i++) {
    const f = i / 15;
    const cx = 0.760 + (0.811 - 0.760) * f;
    const cy = 0.580 + (0.300 - 0.580) * f;
    const spread = 0.022 * (1 - f * 0.72);
    STREETLIGHTS_AVE.push({ x: cx - spread, y: cy, order: f, scale: 1 - f * 0.65 });
    STREETLIGHTS_AVE.push({ x: cx + spread, y: cy, order: f, scale: 1 - f * 0.65 });
  }

  const TRAFFIC_PATHS = [
    {
      pts: [[0.422, 0.990], [0.390, 0.915], [0.378, 0.835], [0.388, 0.765], [0.428, 0.700], [0.488, 0.642], [0.555, 0.585]],
      color: 'rgba(255, 235, 190, ',
      core: 'rgba(255, 252, 240, ',
      width: 2.5,
      speed: 0.26,
      len: 0.16
    },
    {
      pts: [[0.560, 0.588], [0.494, 0.646], [0.434, 0.704], [0.395, 0.768], [0.386, 0.838], [0.398, 0.918], [0.432, 0.990]],
      color: 'rgba(255, 75, 55, ',
      core: 'rgba(255, 190, 170, ',
      width: 2.1,
      speed: 0.22,
      len: 0.15
    },
    {
      pts: [[0.784, 0.578], [0.793, 0.500], [0.802, 0.425], [0.810, 0.345], [0.814, 0.298]],
      color: 'rgba(255, 85, 60, ',
      core: 'rgba(255, 200, 180, ',
      width: 1.7,
      speed: 0.30,
      len: 0.18
    },
    {
      pts: [[0.810, 0.298], [0.804, 0.350], [0.792, 0.425], [0.776, 0.502], [0.758, 0.578]],
      color: 'rgba(255, 230, 175, ',
      core: 'rgba(255, 250, 235, ',
      width: 1.8,
      speed: 0.28,
      len: 0.18
    },
    {
      pts: [[0.750, 0.592], [0.795, 0.605], [0.848, 0.622], [0.990, 0.720]],
      color: 'rgba(255, 90, 65, ',
      core: 'rgba(255, 220, 195, ',
      width: 2.0,
      speed: 0.24,
      len: 0.16
    },
    {
      pts: [[0.990, 0.712], [0.848, 0.616], [0.795, 0.598], [0.748, 0.586]],
      color: 'rgba(255, 235, 185, ',
      core: 'rgba(255, 252, 240, ',
      width: 2.0,
      speed: 0.27,
      len: 0.16
    }
  ];

  function sampleCurveScreen(pts, t) {
    const n = pts.length - 1;
    const f = Math.min(n - 1e-6, Math.max(0, t * n));
    const k = Math.floor(f);
    const q = f - k;
    const u = pts[k][0] + (pts[k + 1][0] - pts[k][0]) * q;
    const v = pts[k][1] + (pts[k + 1][1] - pts[k][1]) * q;
    return P(u, v);
  }

  function calcStateFromCycle(cycleSec) {
    const u = (cycleSec % CYCLE_DURATION) / CYCLE_DURATION;
    if (u < 0.07) {
      return { progress: 0.0, direction: 1.0 };
    } else if (u < 0.43) {
      const t = (u - 0.07) / 0.36;
      return { progress: t * t * (3 - 2 * t), direction: 1.0 };
    } else if (u < 0.57) {
      return { progress: 1.0, direction: 1.0 };
    } else if (u < 0.93) {
      const t = (u - 0.57) / 0.36;
      return { progress: 1.0 - t * t * (3 - 2 * t), direction: -1.0 };
    } else {
      return { progress: 0.0, direction: -1.0 };
    }
  }

  let simTime = 1.2; // Startet direkt am Beginn des sanften Übergangs
  let ready = false;

  function draw() {
    if (!ready) return;
    const st = calm() ? { progress: 0.82, direction: 1.0 } : calcStateFromCycle(simTime);
    const progress = st.progress;
    const direction = st.direction;

    gl.viewport(0, 0, IMG_W, IMG_H);
    gl.uniform1f(uTimeLoc, simTime);
    gl.uniform1f(uProgLoc, progress);
    gl.uniform1f(uDirLoc, direction);
    gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);

    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    // WebGL-Zeitraffer deckungsgleich über das Hero-Bild zeichnen
    ctx.drawImage(glCanvas, ox, oy, sw, sh);

    const duskStrength = Math.max(0, Math.min(1, (progress - 0.20) / 0.55));
    if (duskStrength <= 0.005) return;

    ctx.save();
    ctx.globalCompositeOperation = 'lighter';

    // 1. Sequentielles Auf- und Ableuchten der Laternen entlang der Augustaanlage
    STREETLIGHTS_AVE.forEach((sl) => {
      const ord = direction >= 0 ? sl.order : (1 - sl.order);
      const rawTurn = Math.max(0, Math.min(1, (progress - (0.22 + ord * 0.34)) / 0.16));
      const turnOn = rawTurn * rawTurn * (3 - 2 * rawTurn);
      if (turnOn <= 0.005) return;
      const [x, y] = P(sl.x, sl.y);
      const r = 6.5 * sl.scale * scaleFactor;
      const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(255, 240, 200, ' + (0.38 * turnOn).toFixed(3) + ')');
      grad.addColorStop(0.45, 'rgba(255, 185, 90, ' + (0.20 * turnOn).toFixed(3) + ')');
      grad.addColorStop(1, 'rgba(255, 160, 50, 0)');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(x, y, r, 0, Math.PI * 2);
      ctx.fill();
    });

    // 2. Sanfte Langzeitbelichtungs-Lichtspuren (Traffic Light Trails)
    TRAFFIC_PATHS.forEach((tr, idx) => {
      for (let wave = 0; wave < 2; wave++) {
        const head = (simTime * tr.speed + wave * 0.5 + idx * 0.17) % 1.25;
        const steps = 22;
        for (let s = 0; s < steps; s++) {
          const u0 = head - (s / steps) * tr.len;
          const u1 = head - ((s + 1) / steps) * tr.len;
          if (u0 <= 0 || u1 >= 1 || u1 < 0 || u0 > 1) continue;
          const p0 = sampleCurveScreen(tr.pts, u0);
          const p1 = sampleCurveScreen(tr.pts, u1);
          const tailFade = Math.sin((1 - s / steps) * Math.PI * 0.5);
          const edgeFade = Math.min(1, u0 / 0.10) * Math.min(1, (1 - u0) / 0.10);
          const alpha = duskStrength * tailFade * edgeFade * 0.46;
          if (alpha <= 0.008) continue;

          ctx.strokeStyle = tr.color + alpha.toFixed(3) + ')';
          ctx.lineWidth = tr.width * scaleFactor * (0.6 + 0.4 * tailFade);
          ctx.lineCap = 'round';
          ctx.beginPath();
          ctx.moveTo(p0[0], p0[1]);
          ctx.lineTo(p1[0], p1[1]);
          ctx.stroke();

          if (s < 4) {
            ctx.strokeStyle = tr.core + (alpha * 0.8).toFixed(3) + ')';
            ctx.lineWidth = tr.width * scaleFactor * 0.42;
            ctx.beginPath();
            ctx.moveTo(p0[0], p0[1]);
            ctx.lineTo(p1[0], p1[1]);
            ctx.stroke();
          }
        }
      }
    });

    ctx.restore();
  }

  /* ---------------------------------------------------------------------
     Ablaufsteuerung & Bild-Lader
     --------------------------------------------------------------------- */
  let raf = 0, last = 0, onScreen = true;
  function loop(now) {
    const dt = last ? Math.min(0.05, (now - last) / 1000) : 0;
    last = now;
    simTime += dt;
    draw();
    raf = requestAnimationFrame(loop);
  }
  function start() {
    if (raf || !onScreen || !ready || calm()) return;
    last = 0;
    raf = requestAnimationFrame(loop);
  }
  function stop() {
    if (raf) cancelAnimationFrame(raf);
    raf = 0;
  }
  function refresh() {
    if (!ready) return;
    if (calm()) { stop(); draw(); } else start();
  }

  fit();

  // Passende Auflösung für das Blue-Hour-Gegenstück wählen
  const targetW = window.innerWidth <= 680 ? 640 : (window.innerWidth <= 1024 ? 960 : 1376);
  const nightImg = new Image();
  nightImg.decoding = 'async';

  function initWhenBothReady() {
    if (!img.complete || !img.naturalWidth || !nightImg.complete || !nightImg.naturalWidth) return;
    uploadTex(0, img);
    uploadTex(1, nightImg);
    gl.uniform1i(uDayLoc, 0);
    gl.uniform1i(uNightLoc, 1);
    ready = true;
    fit();
    draw();
    requestAnimationFrame(() => canvas.classList.add('is-ready'));
    refresh();
  }

  img.addEventListener('load', initWhenBothReady);
  nightImg.addEventListener('load', initWhenBothReady);
  nightImg.src = 'assets/img/mannheim-luftbild-bluehour-' + targetW + '.webp';
  if (img.complete && img.naturalWidth) initWhenBothReady();

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
})();
