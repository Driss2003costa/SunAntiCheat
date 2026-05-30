/* =================================================================
   ESTELLE CASTERO — Portfolio · interactions
   Vanilla JS, zéro dépendance
   ================================================================= */
(function () {
  "use strict";

  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const isTouch = window.matchMedia("(hover: none)").matches;
  const $  = (s, c = document) => c.querySelector(s);
  const $$ = (s, c = document) => [...c.querySelectorAll(s)];

  /* ----------  PRELOADER  ---------- */
  function preloader() {
    const el = $("#preloader");
    const count = $("#preloaderCount");
    const bar = $(".preloader__bar span");
    if (!el) return revealHero();

    let p = 0;
    const tick = setInterval(() => {
      p = Math.min(100, p + Math.random() * 18);
      if (count) count.textContent = Math.floor(p);
      if (bar) bar.style.width = p + "%";
      if (p >= 100) {
        clearInterval(tick);
        setTimeout(() => {
          el.classList.add("is-done");
          revealHero();
        }, 350);
      }
    }, reduced ? 30 : 130);
  }

  function revealHero() {
    $$(".hero .line__inner").forEach((l, i) => {
      l.style.transition = "transform 1s cubic-bezier(.22,1,.36,1)";
      l.style.transitionDelay = 0.15 + i * 0.12 + "s";
      requestAnimationFrame(() => (l.style.transform = "translateY(0)"));
    });
    $$(".hero .reveal").forEach((r) => r.classList.add("is-visible"));
    // also reveal contact title lines when in view (handled by observer)
  }

  /* ----------  YEAR  ---------- */
  const yEl = $("#year");
  if (yEl) yEl.textContent = new Date().getFullYear();

  /* ----------  THEME  ---------- */
  (function theme() {
    const root = document.documentElement;
    const saved = localStorage.getItem("ec-theme");
    if (saved) root.setAttribute("data-theme", saved);
    else if (window.matchMedia("(prefers-color-scheme: dark)").matches)
      root.setAttribute("data-theme", "dark");

    const btn = $("#themeToggle");
    if (btn) btn.addEventListener("click", () => {
      const next = root.getAttribute("data-theme") === "dark" ? "light" : "dark";
      root.setAttribute("data-theme", next);
      localStorage.setItem("ec-theme", next);
    });
  })();

  /* ----------  NAV SCROLL STATE + PROGRESS  ---------- */
  const nav = $("#nav");
  const progress = $("#scrollProgress");
  function onScroll() {
    const y = window.scrollY;
    if (nav) nav.classList.toggle("is-scrolled", y > 40);
    if (progress) {
      const h = document.documentElement.scrollHeight - window.innerHeight;
      progress.style.width = (h > 0 ? (y / h) * 100 : 0) + "%";
    }
  }
  window.addEventListener("scroll", onScroll, { passive: true });
  onScroll();

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
    burger.addEventListener("click", () =>
      toggle(!menu.classList.contains("is-open"))
    );
    $$(".mobile-menu__link").forEach((l) =>
      l.addEventListener("click", () => toggle(false))
    );
  })();

  /* ----------  REVEAL ON SCROLL  ---------- */
  (function reveal() {
    const items = $$(".reveal:not(.hero .reveal)");
    if (reduced || !("IntersectionObserver" in window)) {
      items.forEach((i) => i.classList.add("is-visible"));
      $$(".section .line__inner").forEach((l) => (l.style.transform = "none"));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((e) => {
          if (!e.isIntersecting) return;
          const el = e.target;
          const d = parseFloat(el.dataset.delay || 0);
          el.style.transitionDelay = d + "s";
          el.classList.add("is-visible");
          io.unobserve(el);
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -8% 0px" }
    );
    items.forEach((i) => io.observe(i));

    // reveal masked lines inside sections (contact, etc.)
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
      const target = +el.dataset.count;
      const suffix = el.dataset.suffix || "";
      const dur = 1600;
      const start = performance.now();
      const step = (now) => {
        const t = Math.min(1, (now - start) / dur);
        const eased = 1 - Math.pow(1 - t, 3);
        el.textContent = Math.floor(eased * target) + suffix;
        if (t < 1) requestAnimationFrame(step);
        else el.textContent = target + suffix;
      };
      requestAnimationFrame(step);
    };
    const io = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) { animate(e.target); io.unobserve(e.target); }
      });
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

  /* ----------  CUSTOM CURSOR + MAGNETIC  ---------- */
  (function cursor() {
    if (isTouch || reduced) return;
    const ring = $("#cursor");
    const dot = $("#cursorDot");
    if (!ring || !dot) return;
    document.body.classList.add("cursor-ready");

    let mx = innerWidth / 2, my = innerHeight / 2;
    let rx = mx, ry = my;
    window.addEventListener("mousemove", (e) => {
      mx = e.clientX; my = e.clientY;
      dot.style.transform = `translate(${mx}px, ${my}px) translate(-50%,-50%)`;
    });
    (function loop() {
      rx += (mx - rx) * 0.18;
      ry += (my - ry) * 0.18;
      ring.style.transform = `translate(${rx}px, ${ry}px) translate(-50%,-50%)`;
      requestAnimationFrame(loop);
    })();

    $$("a, button, [data-magnetic]").forEach((el) => {
      el.addEventListener("mouseenter", () => ring.classList.add("is-hover"));
      el.addEventListener("mouseleave", () => ring.classList.remove("is-hover"));
    });

    // magnetic
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

  /* ----------  TILT / CARD GLOW  ---------- */
  (function tilt() {
    if (isTouch || reduced) return;
    $$("[data-tilt]").forEach((el) => {
      el.addEventListener("mousemove", (e) => {
        const r = el.getBoundingClientRect();
        const px = (e.clientX - r.left) / r.width;
        const py = (e.clientY - r.top) / r.height;
        el.style.setProperty("--mx", px * 100 + "%");
        el.style.setProperty("--my", py * 100 + "%");
        const rotX = (py - 0.5) * -6;
        const rotY = (px - 0.5) * 6;
        el.style.transform = `perspective(900px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-4px)`;
      });
      el.addEventListener("mouseleave", () => (el.style.transform = ""));
    });
  })();

  /* ----------  HERO PARALLAX  ---------- */
  (function parallax() {
    if (isTouch || reduced) return;
    const items = $$("[data-parallax]");
    if (!items.length) return;
    window.addEventListener("scroll", () => {
      const y = window.scrollY;
      items.forEach((el) => {
        const speed = parseFloat(el.dataset.parallax);
        el.style.transform = `translateY(${y * speed}px)`;
      });
    }, { passive: true });
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
