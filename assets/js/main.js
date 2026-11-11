/* ==========================================================================
   Clavis IT Service — Client-Side Interactivity
   Zero cookies · Zero tracking · localStorage ('clavis-theme') ONLY on click
   ========================================================================== */

(function () {
  'use strict';

  const root = document.documentElement;

  /* 1. Theme Toggle (writes 'clavis-theme' ONLY on explicit user click) */
  function getEffectiveTheme() {
    const explicit = root.getAttribute('data-theme');
    if (explicit === 'dark' || explicit === 'light') return explicit;
    return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches
      ? 'dark'
      : 'light';
  }

  const themeBtn = document.querySelector('[data-theme-toggle]');
  if (themeBtn) {
    const syncAria = () => {
      const isDark = getEffectiveTheme() === 'dark';
      themeBtn.setAttribute(
        'aria-label',
        isDark ? 'Zu heller Darstellung wechseln' : 'Zu dunkler Darstellung wechseln'
      );
      themeBtn.setAttribute('title', isDark ? 'Helle Darstellung' : 'Dunkle Darstellung');
    };
    syncAria();

    themeBtn.addEventListener('click', () => {
      const next = getEffectiveTheme() === 'dark' ? 'light' : 'dark';
      root.setAttribute('data-theme', next);
      try {
        localStorage.setItem('clavis-theme', next);
      } catch (_) {
        /* Ignore storage restrictions in private browsing */
      }
      syncAria();
    });
  }

  /* 2. Mobile Navigation Drawer + Backdrop */
  const menuBtn = document.querySelector('[data-menu-toggle]');
  const mainNav = document.getElementById('hauptnavigation');
  if (menuBtn && mainNav) {
    const backdrop = document.createElement('div');
    backdrop.className = 'nav-backdrop';
    backdrop.setAttribute('aria-hidden', 'true');
    document.body.appendChild(backdrop);

    const mobileCta = mainNav.querySelector('.nav-mobile-cta');
    if (mobileCta && !mobileCta.querySelector('.nav-mobile-hours')) {
      const hoursNote = document.createElement('div');
      hoursNote.className = 'nav-mobile-hours';
      hoursNote.textContent = 'Telefonisch täglich 8–20 Uhr · Termine nach Vereinbarung';
      mobileCta.appendChild(hoursNote);
    }

    const setMenuState = (open) => {
      menuBtn.setAttribute('aria-expanded', String(open));
      menuBtn.setAttribute('aria-label', open ? 'Menü schließen' : 'Menü öffnen');
      mainNav.classList.toggle('is-open', open);
      backdrop.classList.toggle('is-open', open);
      root.classList.toggle('is-nav-open', open);
    };

    const closeMenu = (restoreFocus = false) => {
      if (!mainNav.classList.contains('is-open')) return;
      setMenuState(false);
      if (restoreFocus) menuBtn.focus();
    };

    menuBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const expanded = menuBtn.getAttribute('aria-expanded') === 'true';
      setMenuState(!expanded);
    });

    backdrop.addEventListener('click', () => closeMenu(false));

    document.addEventListener('click', (e) => {
      if (!mainNav.classList.contains('is-open')) return;
      if (!mainNav.contains(e.target) && !menuBtn.contains(e.target)) {
        closeMenu(false);
      }
    });

    mainNav.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => closeMenu(false));
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') closeMenu(true);
    });

    window.addEventListener('resize', () => {
      if (window.innerWidth > 1060) closeMenu(false);
    });

    window.addEventListener('pageshow', () => {
      closeMenu(false);
    });
  }

  /* 2b. Aufklappmenüs „Unternehmen“ / „Privatkunden“ */
  const navGroups = Array.from(document.querySelectorAll('[data-nav-group]'));
  if (navGroups.length) {
    const setGroup = (group, open) => {
      group.classList.toggle('is-open', open);
      const btn = group.querySelector('.nav-sub-toggle');
      if (btn) {
        btn.setAttribute('aria-expanded', String(open));
        const label = group.querySelector('.nav-link--parent');
        const name = label ? label.textContent.trim() : '';
        btn.setAttribute('aria-label', `Untermenü ${name} ${open ? 'schließen' : 'öffnen'}`);
      }
    };
    const closeAllGroups = (except) => {
      navGroups.forEach((g) => { if (g !== except) setGroup(g, false); });
    };

    navGroups.forEach((group) => {
      const btn = group.querySelector('.nav-sub-toggle');
      if (!btn) return;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const open = !group.classList.contains('is-open');
        closeAllGroups(group);
        setGroup(group, open);
      });
      // Auf dem Desktop schließen, sobald der Fokus die Gruppe verlässt
      group.addEventListener('focusout', (e) => {
        if (window.innerWidth > 1060 && !group.contains(e.relatedTarget)) setGroup(group, false);
      });
      group.querySelectorAll('.nav-sub a').forEach((link) => {
        link.addEventListener('click', () => setGroup(group, false));
      });
    });

    document.addEventListener('click', (e) => {
      if (window.innerWidth > 1060 && !navGroups.some((g) => g.contains(e.target))) closeAllGroups();
    });

    document.addEventListener('keydown', (e) => {
      if (e.key !== 'Escape') return;
      const openGroup = navGroups.find((g) => g.classList.contains('is-open'));
      if (openGroup && window.innerWidth > 1060) {
        setGroup(openGroup, false);
        const btn = openGroup.querySelector('.nav-sub-toggle');
        if (btn) btn.focus();
      }
    });

    window.addEventListener('pageshow', () => closeAllGroups());
  }

  /* 3. Close QR Popovers on Outside Click or Escape */
  const qrDropdowns = document.querySelectorAll('details.qr-dropdown');
  if (qrDropdowns.length > 0) {
    document.addEventListener('click', (e) => {
      qrDropdowns.forEach((d) => {
        if (d.open && !d.contains(e.target)) {
          d.open = false;
        }
      });
    });
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        qrDropdowns.forEach((d) => {
          d.open = false;
        });
      }
    });
  }

  /* 4. Interactive Pricing Tabs (preise.html) */
  const tabList = document.querySelector('[data-pricing-tabs]');
  if (tabList) {
    const tabs = Array.from(tabList.querySelectorAll('[role="tab"]'));
    const panels = tabs.map((t) => document.getElementById(t.getAttribute('aria-controls')));

    const activateTab = (targetId, moveFocus = false) => {
      tabs.forEach((tab, idx) => {
        const isMatch = tab.dataset.tabTarget === targetId;
        tab.setAttribute('aria-selected', String(isMatch));
        tab.setAttribute('tabindex', isMatch ? '0' : '-1');
        if (panels[idx]) {
          panels[idx].hidden = !isMatch;
        }
        if (isMatch && moveFocus) {
          tab.focus();
        }
      });
    };

    tabs.forEach((tab, idx) => {
      tab.addEventListener('click', () => {
        activateTab(tab.dataset.tabTarget, false);
      });
      tab.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
          e.preventDefault();
          const nextIdx =
            e.key === 'ArrowRight'
              ? (idx + 1) % tabs.length
              : (idx - 1 + tabs.length) % tabs.length;
          activateTab(tabs[nextIdx].dataset.tabTarget, true);
        }
      });
    });

    document.querySelectorAll('[data-switch-tab]').forEach((link) => {
      link.addEventListener('click', (e) => {
        e.preventDefault();
        const target = link.getAttribute('data-switch-tab');
        activateTab(target, true);
        tabList.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      });
    });

    if (window.location.hash === '#unternehmen') {
      activateTab('unternehmen', false);
    } else if (window.location.hash === '#privathaushalte') {
      activateTab('privathaushalte', false);
    }
  }

  /* 5. Wartungsvertrag Calculator (geschaeftskunden.html#rechner) */
  const calcEl = document.getElementById('wartungsrechner');
  if (calcEl) {
    const MIN_MONTHLY = 249;
    const fmt = new Intl.NumberFormat('de-DE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const rows = Array.from(calcEl.querySelectorAll('[data-calc-row]'));
    const totalEl = document.getElementById('calc-total-amount');
    const minHintEl = document.getElementById('calc-min-hint');
    const resetBtn = document.getElementById('calc-reset');
    const inquiryLink = document.getElementById('calc-inquiry');

    const WORKPLACE_TIERS = {
      0: 0,
      1: 249,
      2: 480,
      3: 690,
      4: 880,
      5: 1050,
      6: 1218,
      7: 1386,
      8: 1552,
      9: 1719,
      10: 1890,
    };

    const calcWorkplaceTotal = (qty) => {
      if (qty <= 0) return 0;
      if (WORKPLACE_TIERS[qty] !== undefined) return WORKPLACE_TIERS[qty];
      return qty * 189;
    };

    const updateCalculator = () => {
      let rawSum = 0;
      const selectedLines = [];

      rows.forEach((row) => {
        const isWorkplaceTier = row.dataset.workplaceTier === 'true';
        const unitPrice = parseFloat(row.dataset.price || '0');
        const label = row.dataset.label || '';
        const input = row.querySelector('.calc-input');
        const decBtn = row.querySelector('[data-calc-dec]');
        const lineOut = row.querySelector('[data-calc-subtotal]');
        const workplaceDesc = row.querySelector('[data-workplace-desc]');

        const minQty = parseInt(input.min, 10) || 0;
        let qty = parseInt(input.value, 10);
        if (Number.isNaN(qty) || qty < minQty) qty = minQty;
        if (qty > 999) qty = 999;
        input.value = String(qty);

        if (decBtn) decBtn.disabled = qty <= minQty;

        const lineTotal = isWorkplaceTier ? calcWorkplaceTotal(qty) : qty * unitPrice;
        rawSum += lineTotal;

        if (lineOut) {
          lineOut.textContent = `${fmt.format(lineTotal)} €`;
        }
        if (isWorkplaceTier && workplaceDesc) {
          if (qty <= 1) {
            workplaceDesc.textContent =
              'Eine Person mit Computer oder Laptop · 249 € pro Platz, ab 2 Plätzen Mengenrabatt bis rund 24 %';
          } else {
            const perSeat = Math.round(lineTotal / qty);
            const discountPct = Math.round((1 - perSeat / 249) * 100);
            workplaceDesc.innerHTML = `${perSeat} € pro Platz <span class="discount-pill">rund ${discountPct} % Rabatt</span>`;
          }
        }
        if (qty > 0) {
          if (isWorkplaceTier && qty > 1) {
            const perSeat = Math.round(lineTotal / qty);
            const discountPct = Math.round((1 - perSeat / 249) * 100);
            selectedLines.push(
              `- ${qty}x ${label} (${perSeat} € pro Platz, rund ${discountPct} % Rabatt): ${fmt.format(lineTotal)} € netto`
            );
          } else {
            const itemLabel = isWorkplaceTier && qty === 1 ? 'Arbeitsplatz' : label;
            selectedLines.push(`- ${qty}x ${itemLabel}: ${fmt.format(lineTotal)} € netto`);
          }
        }
      });

      const finalMonthly = Math.max(MIN_MONTHLY, rawSum);
      if (totalEl) {
        totalEl.textContent = `${fmt.format(finalMonthly)} €`;
      }

      if (minHintEl) {
        if (rawSum < MIN_MONTHLY) {
          minHintEl.hidden = false;
          minHintEl.textContent = `Summe der Positionen: ${fmt.format(rawSum)} € · Es gilt der Mindestbetrag von 249,00 € netto.`;
        } else {
          minHintEl.hidden = true;
        }
      }

      if (inquiryLink) {
        const subject = 'Anfrage Wartungsvertrag – Kostenlose Bestandsaufnahme';
        const bodyLines = [
          'Guten Tag Herr Kumaru,',
          '',
          'ich interessiere mich für eine kostenlose Bestandsaufnahme und einen Wartungsvertrag für unseren Betrieb.',
          '',
          'Meine unverbindliche Zusammenstellung aus dem Online-Rechner:',
          ...(selectedLines.length > 0 ? selectedLines : ['- Noch keine Einzelpositionen ausgewählt']),
          '',
          `Kalkulierter Monatsbeitrag: ${fmt.format(finalMonthly)} € netto zzgl. 19 % USt.`,
          '',
          'Betrieb / Ansprechpartner:',
          'Telefonnummer für Rückruf:',
          'Ort:',
          '',
          'Freundliche Grüße',
        ];
        inquiryLink.href = `mailto:kontakt@clavis-itservice.de?subject=${encodeURIComponent(
          subject
        )}&body=${encodeURIComponent(bodyLines.join('\n'))}`;
      }
    };

    rows.forEach((row) => {
      const input = row.querySelector('.calc-input');
      const decBtn = row.querySelector('[data-calc-dec]');
      const incBtn = row.querySelector('[data-calc-inc]');
      const minQty = parseInt(input.min, 10) || 0;

      if (decBtn) {
        decBtn.addEventListener('click', () => {
          const val = Math.max(minQty, (parseInt(input.value, 10) || minQty) - 1);
          input.value = String(val);
          updateCalculator();
        });
      }
      if (incBtn) {
        incBtn.addEventListener('click', () => {
          const val = Math.min(999, (parseInt(input.value, 10) || minQty) + 1);
          input.value = String(val);
          updateCalculator();
        });
      }
      if (input) {
        input.addEventListener('input', updateCalculator);
        input.addEventListener('change', updateCalculator);
      }
    });

    if (resetBtn) {
      resetBtn.addEventListener('click', () => {
        rows.forEach((row) => {
          const input = row.querySelector('.calc-input');
          const def = row.dataset.default || '0';
          if (input) input.value = def;
        });
        updateCalculator();
      });
    }

    updateCalculator();
  }

  /* 6. OS-Aware Download Helper (fernwartung.html) */
  const dlBtn = document.getElementById('tv-download-btn');
  if (dlBtn) {
    const ua = navigator.userAgent || '';
    const platform = navigator.platform || '';
    const isMobile = /Android|iPhone|iPad|iPod/i.test(ua) || (platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isMac = !isMobile && /Mac/i.test(platform || ua);
    const isWin = !isMobile && /Win/i.test(platform || ua);

    const osBadge = document.getElementById('tv-os-badge');
    const mobileBanner = document.getElementById('tv-mobile-notice');

    const WIN_URL = 'https://download.teamviewer.com/download/TeamViewerQS.exe';
    const MAC_URL = 'https://download.teamviewer.com/download/TeamViewerQS.dmg';

    if (isMac) {
      dlBtn.href = MAC_URL;
      if (osBadge) osBadge.textContent = 'Ihr System: macOS (auch für Windows verfügbar)';
    } else if (isWin) {
      dlBtn.href = WIN_URL;
      if (osBadge) osBadge.textContent = 'Ihr System: Windows (auch für macOS verfügbar)';
    } else {
      dlBtn.href = WIN_URL;
    }

    if (mobileBanner) {
      mobileBanner.hidden = !isMobile;
    }
  }

  /* 7. Tronix Floating Back-to-Top Button */
  const backTopBtn = document.getElementById('back-top');
  if (backTopBtn) {
    const onScroll = () => {
      backTopBtn.classList.toggle('is-visible', window.scrollY > 360);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
    backTopBtn.addEventListener('click', () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  /* 9. Abschnitte beim Scrollen sanft einblenden (nur wo [data-reveal] gesetzt ist) */
  (function () {
    const groups = document.querySelectorAll('[data-reveal], [data-reveal-stagger]');
    // Bei reduzierter Bewegung blenden die Inhalte nur ein (siehe CSS), ohne zu gleiten
    if (!groups.length || !('IntersectionObserver' in window)) return;

    const targets = [];
    groups.forEach((el) => {
      if (el.hasAttribute('data-reveal-stagger')) {
        Array.prototype.forEach.call(el.children, (child, i) => {
          child.setAttribute('data-reveal', '');
          child.style.setProperty('--reveal-delay', (Math.min(i, 6) * 0.05).toFixed(2) + 's');
          targets.push(child);
        });
      } else {
        targets.push(el);
      }
    });

    // Nach dem Einblenden wieder die normalen Übergänge (z. B. Hover der Karten) zulassen
    const finish = (el) => {
      el.removeAttribute('data-reveal');
      el.classList.remove('is-revealed');
      el.style.removeProperty('--reveal-delay');
    };

    const io = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el = entry.target;
        io.unobserve(el);
        el.classList.add('is-revealed');
        el.addEventListener('transitionend', (ev) => {
          if (ev.target === el && ev.propertyName === 'transform') finish(el);
        });
        setTimeout(() => finish(el), 1800);
      });
    }, { rootMargin: '0px 0px -2% 0px', threshold: 0.05 });

    root.classList.add('reveal-on');
    targets.forEach((t) => io.observe(t));
  })();

  /* 10. Startseite: reduzierte Bewegungsvariante, Zähler, Parallax, Lichtkegel auf Karten */
  (function () {
    const mq = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;
    const osReduced = !!(mq && mq.matches);
    const isReduced = () => osReduced || root.classList.contains('motion-reduced');

    // Knopf im Kopfbereich: Bewegung reduzieren und wieder einschalten (gilt für diesen Seitenaufruf)
    const motionBtn = document.querySelector('.home-hero-toggle');
    if (motionBtn && !osReduced) {
      motionBtn.hidden = false;
      motionBtn.addEventListener('click', () => {
        const on = root.classList.toggle('motion-reduced');
        const label = on ? 'Bewegung wieder einschalten' : 'Bewegung reduzieren';
        motionBtn.setAttribute('aria-pressed', String(on));
        motionBtn.setAttribute('aria-label', label);
        motionBtn.title = label;
      });
    }

    if (!('IntersectionObserver' in window)) return;

    // Zahlen zählen hoch, sobald sie sichtbar werden
    const counters = document.querySelectorAll('[data-count]');
    if (counters.length && !osReduced) {
      const run = (el) => {
        const target = parseInt(el.getAttribute('data-count'), 10) || 0;
        if (!target || isReduced()) return;
        const t0 = performance.now();
        const step = (now) => {
          const p = Math.min(1, (now - t0) / 1400);
          el.textContent = String(Math.round(target * (1 - Math.pow(1 - p, 3))));
          if (p < 1) requestAnimationFrame(step);
        };
        el.textContent = '0';
        requestAnimationFrame(step);
      };
      const seen = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          seen.unobserve(entry.target);
          run(entry.target);
        });
      }, { threshold: 0.5 });
      counters.forEach((c) => seen.observe(c));
    }

    // Parallax: Ebenen mit [data-parallax] bewegen sich beim Scrollen leicht versetzt.
    // Nur mit Maus/Trackpad; auf Touch-Geräten bleibt die Seite ruhig und flüssig.
    const layers = Array.prototype.slice.call(document.querySelectorAll('[data-parallax]'));
    const finePointer = window.matchMedia && window.matchMedia('(hover: hover) and (pointer: fine)').matches;
    if (layers.length && !osReduced && finePointer) {
      const hosts = new Map();
      layers.forEach((el) => {
        const host = el.closest('section') || el.parentElement;
        if (!hosts.has(host)) hosts.set(host, { visible: false, layers: [] });
        hosts.get(host).layers.push({ el, speed: parseFloat(el.getAttribute('data-parallax')) || 0 });
      });
      let ticking = false;
      const apply = () => {
        ticking = false;
        if (isReduced()) return;
        const mid = window.innerHeight / 2;
        hosts.forEach((h, host) => {
          if (!h.visible) return;
          const r = host.getBoundingClientRect();
          const d = r.top + r.height / 2 - mid;
          h.layers.forEach((l) => l.el.style.setProperty('--py', (d * l.speed).toFixed(1) + 'px'));
        });
      };
      const request = () => {
        if (ticking) return;
        ticking = true;
        requestAnimationFrame(apply);
      };
      const inView = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          const h = hosts.get(entry.target);
          if (h) h.visible = entry.isIntersecting;
        });
        request();
      });
      hosts.forEach((_, host) => inView.observe(host));
      window.addEventListener('scroll', request, { passive: true });
      window.addEventListener('resize', request, { passive: true });
    }

    // Lichtkegel auf Karten folgt dem Mauszeiger
    if (finePointer && document.body.classList.contains('page-home')) {
      document.addEventListener('pointermove', (e) => {
        const card = e.target && e.target.closest ? e.target.closest('.card') : null;
        if (!card) return;
        const r = card.getBoundingClientRect();
        card.style.setProperty('--mx', (e.clientX - r.left).toFixed(0) + 'px');
        card.style.setProperty('--my', (e.clientY - r.top).toFixed(0) + 'px');
      }, { passive: true });
    }
  })();

  /* 8. Seiten vorab laden: Der Klick auf einen internen Link öffnet die Seite ohne Wartezeit */
  (function () {
    const internal = (a) => a && a.origin === location.origin && a.pathname !== location.pathname &&
      !a.hasAttribute('download') && a.target !== '_blank';

    if (HTMLScriptElement.supports && HTMLScriptElement.supports('speculationrules')) {
      // Chrome/Edge: Seite beim Überfahren oder Antippen eines Links im Hintergrund vorbereiten
      const rules = document.createElement('script');
      rules.type = 'speculationrules';
      rules.textContent = JSON.stringify({
        prerender: [{ where: { href_matches: '/*' }, eagerness: 'moderate' }]
      });
      document.head.appendChild(rules);
      return;
    }

    // Andere Browser: HTML der Zielseite beim Überfahren/Antippen vorab holen
    const conn = navigator.connection;
    if (conn && (conn.saveData || /2g/.test(conn.effectiveType || ''))) return;
    const done = new Set();
    const warm = (e) => {
      const a = e.target.closest ? e.target.closest('a[href]') : null;
      if (!internal(a) || done.has(a.pathname)) return;
      done.add(a.pathname);
      const link = document.createElement('link');
      link.rel = 'prefetch';
      link.href = a.pathname;
      document.head.appendChild(link);
    };
    document.addEventListener('pointerenter', warm, { capture: true, passive: true });
    document.addEventListener('touchstart', warm, { capture: true, passive: true });
  })();
})();
