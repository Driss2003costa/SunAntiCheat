/* =================================================================
   ESTELLE CASTERO — "AURORA EDITORIAL" · interactions
   Vanilla JS, zéro dépendance
   ================================================================= */
(function () {
  "use strict";

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isTouch = window.matchMedia("(hover: none)").matches;
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  /* =====================================================
     1. AURORA — fond animé sur canvas (blobs rose/bleu)
     ===================================================== */
  (function aurora() {
    const canvas = $("#aurora");
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    let w, h, dpr;
    const pink = [255, 61, 139], purple = [177, 75, 255], blue = [46, 91, 255];

    const blobs = [
      { c: pink,   r: .45, x: .2,  y: .3,  dx: .00021, dy: .00017, px: 0, py: 0 },
      { c: blue,   r: .42, x: .8,  y: .4,  dx: -.00018, dy: .00022, px: 0, py: 0 },
      { c: purple, r: .38, x: .5,  y: .8,  dx: .00015, dy: -.00019, px: 0, py: 0 },
      { c: pink,   r: .30, x: .7,  y: .7,  dx: -.00024, dy: -.00013, px: 0, py: 0 },
    ];

    const mouse = { x: .5, y: .5, tx: .5, ty: .5 };

    function resize() {
      dpr = Math.min(window.devicePixelRatio || 1, 1.6);
      w = canvas.width = innerWidth * dpr;
      h = canvas.height = innerHeight * dpr;
      canvas.style.width = innerWidth + "px";
      canvas.style.height = innerHeight + "px";
    }
    resize();
    window.addEventListener("resize", resize);

    if (!isTouch) window.addEventListener("mousemove", (e) => {
      mouse.tx = e.clientX / innerWidth;
      mouse.ty = e.clientY / innerHeight;
    });

    function rgba(c, a) { return `rgba(${c[0]},${c[1]},${c[2]},${a})`; }

    let t = 0;
    function draw() {
      t += 1;
      mouse.x += (mouse.tx - mouse.x) * 0.04;
      mouse.y += (mouse.ty - mouse.y) * 0.04;
      ctx.clearRect(0, 0, w, h);
      ctx.globalCompositeOperation = "lighter";

      blobs.forEach((b, i) => {
        b.x += b.dx; b.y += b.dy;
        if (b.x < .05 || b.x > .95) b.dx *= -1;
        if (b.y < .05 || b.y > .95) b.dy *= -1;
        // léger attrait vers la souris
        const pull = (i % 2 ? 0.05 : 0.08);
        const cx = (b.x + (mouse.x - .5) * pull) * w;
        const cy = (b.y + (mouse.y - .5) * pull) * h;
        const rad = b.r * Math.min(w, h) * (1 + Math.sin(t * 0.004 + i) * 0.06);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        g.addColorStop(0, rgba(b.c, 0.55));
        g.addColorStop(0.5, rgba(b.c, 0.18));
        g.addColorStop(1, rgba(b.c, 0));
        ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill();
      });
      ctx.globalCompositeOperation = "source-over";
      raf = requestAnimationFrame(draw);
    }
    let raf;
    if (!reduced) draw();
    else { // version statique
      blobs.forEach((b, i) => {
        const cx = b.x * w, cy = b.y * h, rad = b.r * Math.min(w, h);
        const g = ctx.createRadialGradient(cx, cy, 0, cx, cy, rad);
        g.addColorStop(0, rgba(b.c, 0.4)); g.addColorStop(1, rgba(b.c, 0));
        ctx.globalCompositeOperation = "lighter"; ctx.fillStyle = g;
        ctx.beginPath(); ctx.arc(cx, cy, rad, 0, Math.PI * 2); ctx.fill();
      });
    }
    // pause quand l'onglet est caché
    document.addEventListener("visibilitychange", () => {
      if (document.hidden) cancelAnimationFrame(raf);
      else if (!reduced) draw();
    });
  })();

  /* =====================================================
     2. SCRAMBLE — décodage de texte lettre par lettre
     ===================================================== */
  function scramble(el, finalText, duration = 900) {
    const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ!<>-_\\/[]{}—=+*^?#";
    const len = finalText.length;
    const start = performance.now();
    function frame(now) {
      const p = Math.min(1, (now - start) / duration);
      let out = "";
      for (let i = 0; i < len; i++) {
        if (finalText[i] === " ") { out += " "; continue; }
        const revealAt = i / len;
        if (p >= revealAt) out += finalText[i];
        else out += chars[(Math.random() * chars.length) | 0];
      }
      el.textContent = out;
      if (p < 1) requestAnimationFrame(frame);
      else el.textContent = finalText;
    }
    requestAnimationFrame(frame);
  }

  (function initScramble() {
    const targets = $$("[data-scramble]");
    if (reduced) return; // on garde le texte tel quel
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        scramble(e.target, e.target.dataset.scramble, 800);
        io.unobserve(e.target);
      });
    }, { threshold: 0.5 });
    targets.forEach((t) => { if (!t.closest(".preloader")) io.observe(t); });
  })();

  /* =====================================================
     3. PRELOADER
     ===================================================== */
  function preloader() {
    const el = $("#preloader");
    const count = $("#preloaderCount");
    const bar = $(".preloader__bar span");
    const name = $(".preloader__name");
    if (name && !reduced) scramble(name, name.dataset.scramble, 1100);
    if (!el) return revealHero();
    let p = 0;
    const tick = setInterval(() => {
      p = Math.min(100, p + Math.random() * 16);
      if (count) count.textContent = Math.floor(p);
      if (bar) bar.style.width = p + "%";
      if (p >= 100) {
        clearInterval(tick);
        setTimeout(() => { el.classList.add("is-done"); revealHero(); }, 350);
      }
    }, reduced ? 30 : 120);
  }
  function revealHero() {
    $$(".hero .line__inner").forEach((l, i) => {
      l.style.transition = "transform 1s cubic-bezier(.22,1,.36,1)";
      l.style.transitionDelay = 0.15 + i * 0.12 + "s";
      requestAnimationFrame(() => (l.style.transform = "translateY(0)"));
    });
    $$(".hero .reveal").forEach((r) => r.classList.add("is-visible"));
  }

  /* ----------  YEAR  ---------- */
  const yEl = $("#year");
  if (yEl) yEl.textContent = new Date().getFullYear();

  /* ----------  THEME  ---------- */
  (function theme() {
    const root = document.documentElement;
    const saved = localStorage.getItem("ec-theme");
    if (saved) root.setAttribute("data-theme", saved);
    const btn = $("#themeToggle");
    if (btn) btn.addEventListener("click", () => {
      const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      localStorage.setItem("ec-theme", next);
    });
  })();

  /* =====================================================
     4. SCROLL : nav state + progress + projets horizontaux
        + marquee réactif à la vitesse
     ===================================================== */
  const nav = $("#nav");
  const progress = $("#scrollProgress");
  const pin = $("#projectsPin");
  const track = $("#projectsTrack");
  const mq = $("#marqueeTrack");
  let marqueeX = 0, lastScroll = 0, mqDir = 1, autoSpeed = 0.6;

  function horizontalProjects() {
    if (!pin || !track || isTouch || innerWidth <= 960) return;
    const rect = pin.getBoundingClientRect();
    const total = pin.offsetHeight - innerHeight;
    const passed = Math.min(Math.max(-rect.top, 0), total);
    const prog = total > 0 ? passed / total : 0;
    const dist = track.scrollWidth - innerWidth + 40;
    track.style.transform = `translateX(${-prog * Math.max(dist, 0)}px)`;
  }

  function onScroll() {
    const y = window.scrollY;
    if (nav) nav.classList.toggle("is-scrolled", y > 40);
    if (progress) {
      const docH = document.documentElement.scrollHeight - innerHeight;
      progress.style.width = (docH > 0 ? (y / docH) * 100 : 0) + "%";
    }
    horizontalProjects();
    // direction du marquee selon le sens de scroll
    if (y > lastScroll) mqDir = 1; else if (y < lastScroll) mqDir = -1;
    lastScroll = y;
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("resize", onScroll);
  onScroll();

  /* ----------  MARQUEE animé en JS (réagit au scroll)  ---------- */
  (function marquee() {
    if (!mq || reduced) return;
    const half = () => mq.scrollWidth / 2;
    let boost = 0;
    let lastY = window.scrollY;
    window.addEventListener("scroll", () => {
      const dy = window.scrollY - lastY; lastY = window.scrollY;
      boost = Math.max(-12, Math.min(12, dy * 0.4));
    }, { passive: true });
    (function loop() {
      boost *= 0.92;
      marqueeX -= (autoSpeed + Math.abs(boost)) * (boost !== 0 ? Math.sign(autoSpeed * mqDir + boost) || 1 : mqDir);
      const limit = half();
      if (marqueeX <= -limit) marqueeX += limit;
      if (marqueeX > 0) marqueeX -= limit;
      mq.style.transform = `translateX(${marqueeX}px)`;
      requestAnimationFrame(loop);
    })();
  })();

  /* ----------  MOBILE MENU  ---------- */
  (function mobileMenu() {
    const burger = $("#burger");
    const menu = $("#mobileMenu");
    if (!burger || !menu) return;
    const toggle = (open) => {
      burger.classList.toggle("is-open", open);
      menu.classList.toggle("is-open", open);
      burger.setAttribute("aria-expanded", open);
      menu.setAttribute("aria-hidden", !open);
      document.body.style.overflow = open ? "hidden" : "";
    };
    burger.addEventListener("click", () => toggle(!menu.classList.contains("is-open")));
    $$(".mobile-menu__link").forEach((l) => l.addEventListener("click", () => toggle(false)));
  })();

  /* ----------  REVEAL ON SCROLL  ---------- */
  (function reveal() {
    const items = $$(".reveal").filter((el) => !el.closest(".hero"));
    if (reduced || !("IntersectionObserver" in window)) {
      items.forEach((i) => i.classList.add("is-visible"));
      $$(".line__inner").forEach((l) => (l.style.transform = "none"));
      return;
    }
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        const d = parseFloat(e.target.dataset.delay || 0);
        e.target.style.transitionDelay = d + "s";
        e.target.classList.add("is-visible");
        io.unobserve(e.target);
      });
    }, { threshold: 0.12, rootMargin: "0px 0px -8% 0px" });
    items.forEach((i) => io.observe(i));

    const lineIO = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (!e.isIntersecting) return;
        $$(".line__inner", e.target).forEach((l, i) => {
          l.style.transition = "transform .9s cubic-bezier(.22,1,.36,1)";
          l.style.transitionDelay = i * 0.1 + "s";
          l.style.transform = "translateY(0)";
        });
        lineIO.unobserve(e.target);
      });
    }, { threshold: 0.3 });
    $$(".contact__title").forEach((t) => lineIO.observe(t));
  })();

  /* ----------  COUNTERS  ---------- */
  (function counters() {
    const nums = $$("[data-count]");
    if (!nums.length) return;
    const animate = (el) => {
      const target = +el.dataset.count, suffix = el.dataset.suffix || "";
      const dur = 1600, start = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.floor(eased * target) + suffix;
        if (t < 1) requestAnimationFrame(step); else el.textContent = target + suffix;
      };
      requestAnimationFrame(step);
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => { if (e.isIntersecting) { animate(e.target); io.unobserve(e.target); } });
    }, { threshold: 0.6 });
    nums.forEach((n) => io.observe(n));
  })();

  /* ----------  ROTATING WORDS  ---------- */
  (function rotator() {
    const words = $$("#rotator .rotator__word");
    if (words.length < 2 || reduced) return;
    let i = 0;
    setInterval(() => {
      words[i].classList.remove("is-active");
      i = (i + 1) % words.length;
      words[i].classList.add("is-active");
    }, 2200);
  })();

  /* =====================================================
     5. CURSEUR (blend invert) + étiquettes + magnétique
     ===================================================== */
  (function cursor() {
    if (isTouch || reduced) return;
    const ring = $("#cursor"), dot = $("#cursorDot"), label = $("#cursorLabel");
    if (!ring || !dot) return;
    document.body.classList.add("cursor-ready");
    let mx = innerWidth / 2, my = innerHeight / 2, rx = mx, ry = my;
    window.addEventListener("mousemove", (e) => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%,-50%)`;
    });
    (function loop() {
      rx += (mx - rx) * 0.18; ry += (my - ry) * 0.18;
      ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%,-50%)`;
      requestAnimationFrame(loop);
    })();

    $$("a, button, [data-magnetic]").forEach((el) => {
      el.addEventListener("mouseenter", () => {
        const txt = el.getAttribute("data-cursor");
        if (txt && label) { label.textContent = txt; ring.classList.add("is-label"); }
        else ring.classList.add("is-hover");
      });
      el.addEventListener("mouseleave", () => ring.classList.remove("is-hover", "is-label"));
    });

    $$("[data-magnetic]").forEach((el) => {
      const strength = 0.35;
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const x = e.clientX - (r.left + r.width / 2);
        const y = e.clientY - (r.top + r.height / 2);
        el.style.transform = `translate(${x * strength}px, ${y * strength}px)`;
      });
      el.addEventListener("mouseleave", () => (el.style.transform = ""));
    });
  })();

  /* ----------  TILT / GLOW  ---------- */
  (function tilt() {
    if (isTouch || reduced) return;
    $$("[data-tilt]").forEach((el) => {
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width, py = (e.clientY - r.top) / r.height;
        el.style.setProperty("--mx", px * 100 + "%");
        el.style.setProperty("--my", py * 100 + "%");
        el.style.transform = `perspective(900px) rotateX(${(py - .5) * -6}deg) rotateY(${(px - .5) * 6}deg) translateY(-4px)`;
      });
      el.addEventListener("mouseleave", () => (el.style.transform = ""));
    });
  })();

  /* ----------  SMOOTH ANCHORS  ---------- */
  $$('a[href^="#"]').forEach((a) => {
    a.addEventListener("click", (e) => {
      const id = a.getAttribute("href");
      if (id.length < 2) return;
      const target = document.querySelector(id);
      if (!target) return;
      e.preventDefault();
      target.scrollIntoView({ behavior: reduced ? "auto" : "smooth" });
    });
  });

  /* ----------  BOOT  ---------- */
  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", preloader);
  else preloader();
})();
