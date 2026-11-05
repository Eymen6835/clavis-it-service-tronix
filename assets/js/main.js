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
      hoursNote.textContent = 'Telefonisch täglich 8 bis 20 Uhr · Termine nach Vereinbarung';
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
    const MIN_MONTHLY = 199;
    const fmt = new Intl.NumberFormat('de-DE', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

    const rows = Array.from(calcEl.querySelectorAll('[data-calc-row]'));
    const totalEl = document.getElementById('calc-total-amount');
    const minHintEl = document.getElementById('calc-min-hint');
    const resetBtn = document.getElementById('calc-reset');
    const inquiryLink = document.getElementById('calc-inquiry');

    const updateCalculator = () => {
      let rawSum = 0;
      const selectedLines = [];

      rows.forEach((row) => {
        const unitPrice = parseFloat(row.dataset.price || '0');
        const label = row.dataset.label || '';
        const input = row.querySelector('.calc-input');
        const decBtn = row.querySelector('[data-calc-dec]');
        const lineOut = row.querySelector('[data-calc-subtotal]');

        let qty = parseInt(input.value, 10);
        if (Number.isNaN(qty) || qty < 0) qty = 0;
        if (qty > 999) qty = 999;
        input.value = String(qty);

        if (decBtn) decBtn.disabled = qty <= 0;

        const lineTotal = qty * unitPrice;
        rawSum += lineTotal;

        if (lineOut) {
          lineOut.textContent = `${fmt.format(lineTotal)} €`;
        }
        if (qty > 0) {
          selectedLines.push(`- ${qty}x ${label}: ${fmt.format(lineTotal)} € netto`);
        }
      });

      const finalMonthly = Math.max(MIN_MONTHLY, rawSum);
      if (totalEl) {
        totalEl.textContent = `${fmt.format(finalMonthly)} €`;
      }

      if (minHintEl) {
        if (rawSum < MIN_MONTHLY) {
          minHintEl.hidden = false;
          minHintEl.textContent = `Summe der Positionen: ${fmt.format(rawSum)} € · Es greift der Mindestbetrag von 199,00 € netto.`;
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

      if (decBtn) {
        decBtn.addEventListener('click', () => {
          const val = Math.max(0, (parseInt(input.value, 10) || 0) - 1);
          input.value = String(val);
          updateCalculator();
        });
      }
      if (incBtn) {
        incBtn.addEventListener('click', () => {
          const val = Math.min(999, (parseInt(input.value, 10) || 0) + 1);
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
      if (osBadge) osBadge.textContent = 'Für macOS erkannt (auch für Windows verfügbar)';
    } else if (isWin) {
      dlBtn.href = WIN_URL;
      if (osBadge) osBadge.textContent = 'Für Windows erkannt (auch für macOS verfügbar)';
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
})();
