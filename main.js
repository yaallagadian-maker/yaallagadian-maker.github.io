document.documentElement.classList.add("js");

const WA = "https://wa.me/972525669317?text=";
const main = document.getElementById("journey");
const svg = document.getElementById("road");
const [base, done, lines] = svg.querySelectorAll("path");
const traveler = document.getElementById("traveler");
const tripFill = document.querySelector(".trip-fill");
const stops = [...main.querySelectorAll(".stop")];
const crosses = [...main.querySelectorAll(".cross")];
const routeLinks = [...document.querySelectorAll(".route a")];

let total = 0;
// the road as a polyline: pts[i] = [x, y], lens[i] = length from the start.
// Built in JS so scrolling never has to ask the SVG path for points (slow on long paths).
let pts = [], lens = [];

// WhatsApp links with a ready message per service
document.querySelectorAll("[data-wa]").forEach((a) => {
  a.href = WA + encodeURIComponent(a.dataset.wa);
  a.target = "_blank";
  a.rel = "noopener";
});

/* ---------- Road: a serpentine through every stop ---------- */
function buildRoad() {
  const box = main.getBoundingClientRect();
  const wrap = main.querySelector(".wrap").getBoundingClientRect();
  const gx = parseFloat(getComputedStyle(document.documentElement).getPropertyValue("--gx"));
  const xR = wrap.right - box.left - gx;
  const xL = wrap.left - box.left + gx;
  const xOf = (s) => (s.classList.contains("road-l") ? xL : xR);
  const yOf = (el) => el.getBoundingClientRect().top - box.top;

  // put each station marker on its side of the road
  stops.forEach((s) => {
    const sign = s.querySelector(".sign");
    sign.style.left = xOf(s) - sign.offsetWidth / 2 + "px";
  });

  const R = Math.min(70, gx * 1.4);
  const first = stops[0].querySelector(".sign");
  const start = [xOf(stops[0]), yOf(first) + first.offsetHeight / 2];
  let d = `M ${start[0]} ${start[1]}`;
  pts = [start];
  const lineTo = (x, y) => pts.push([x, y]);
  const quadTo = (cx, cy, x, y) => {
    const [x0, y0] = pts[pts.length - 1];
    for (let k = 1; k <= 12; k++) {
      const t = k / 12, u = 1 - t;
      pts.push([u * u * x0 + 2 * u * t * cx + t * t * x, u * u * y0 + 2 * u * t * cy + t * t * y]);
    }
  };

  crosses.forEach((c, i) => {
    const yc = yOf(c) + c.offsetHeight / 2;
    const xa = xOf(stops[i]);
    const xb = xOf(stops[i + 1]);
    const dir = xb < xa ? -1 : 1;
    d += ` L ${xa} ${yc - R} Q ${xa} ${yc} ${xa + dir * R} ${yc}`;
    d += ` L ${xb - dir * R} ${yc} Q ${xb} ${yc} ${xb} ${yc + R}`;
    lineTo(xa, yc - R); quadTo(xa, yc, xa + dir * R, yc);
    lineTo(xb - dir * R, yc); quadTo(xb, yc, xb, yc + R);
  });

  const last = stops[stops.length - 1];
  const dest = last.querySelector(".sign");
  d += ` L ${xOf(last)} ${yOf(dest) + dest.offsetHeight / 2}`;
  lineTo(xOf(last), yOf(dest) + dest.offsetHeight / 2);

  svg.setAttribute("viewBox", `0 0 ${main.clientWidth} ${main.scrollHeight}`);
  [base, done, lines].forEach((p) => p.setAttribute("d", d));

  lens = [0];
  for (let k = 1; k < pts.length; k++) lens.push(lens[k - 1] + Math.hypot(pts[k][0] - pts[k - 1][0], pts[k][1] - pts[k - 1][1]));
  total = lens[lens.length - 1];
  done.style.strokeDasharray = total;
  update();
}

// point on the road at a given length along it
function pointAt(len) {
  let lo = 1, hi = lens.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (lens[mid] < len) lo = mid + 1; else hi = mid; }
  const [x0, y0] = pts[lo - 1], [x1, y1] = pts[lo];
  const t = (len - lens[lo - 1]) / (lens[lo] - lens[lo - 1] || 1);
  return { x: x0 + (x1 - x0) * t, y: y0 + (y1 - y0) * t };
}

// first length whose y reaches target (road y never goes back up)
function lengthAtY(y) {
  if (y <= pts[0][1]) return 0;
  let lo = 1, hi = pts.length - 1;
  while (lo < hi) { const mid = (lo + hi) >> 1; if (pts[mid][1] < y) lo = mid + 1; else hi = mid; }
  const [, y0] = pts[lo - 1], [, y1] = pts[lo];
  if (y1 <= y0) return lens[lo - 1];
  return Math.min(lens[lo - 1] + (lens[lo] - lens[lo - 1]) * Math.min(1, (y - y0) / (y1 - y0)), total);
}

/* ---------- Scroll: drive the traveler + route progress ---------- */
function update() {
  if (!total) return;
  const top = main.getBoundingClientRect().top;
  const target = innerHeight * 0.55 - top;
  const len = lengthAtY(target);
  done.style.strokeDashoffset = total - len;
  const p = pointAt(len);
  traveler.setAttribute("transform", `translate(${p.x} ${p.y}) scale(${innerWidth < 760 ? 0.62 : 1})`);
  tripFill.style.width = (len / total) * 100 + "%";

  // which stop are we at?
  let here = 0;
  stops.forEach((s, i) => { if (s.getBoundingClientRect().top < innerHeight * 0.55) here = i; });
  routeLinks.forEach((a) => {
    const i = stops.findIndex((s) => s.id === a.dataset.stop);
    a.classList.toggle("here", i === here);
    a.classList.toggle("passed", i < here);
  });
}

let ticking = false;
addEventListener("scroll", () => {
  if (ticking) return;
  ticking = true;
  requestAnimationFrame(() => { update(); ticking = false; });
}, { passive: true });

let rebuild, lastSize = "";
new ResizeObserver(() => {
  const size = main.clientWidth + "x" + Math.round(main.scrollHeight);
  if (size === lastSize) return;
  lastSize = size;
  clearTimeout(rebuild);
  rebuild = setTimeout(buildRoad, 120);
}).observe(main);
document.fonts?.ready.then(buildRoad);
addEventListener("load", buildRoad);

/* ---------- Reveal on scroll ---------- */
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  });
}, { threshold: 0, rootMargin: "0px 0px 15% 0px" });
document.querySelectorAll(".reveal").forEach((el) => io.observe(el));

/* ---------- Reels: only one plays at a time ---------- */
const reels = [...document.querySelectorAll(".reel video")];
reels.forEach((v) => v.addEventListener("play", () => {
  reels.forEach((o) => { if (o !== v) o.pause(); });
}));

// reel / full-length switch on videos that have both cuts
document.querySelectorAll(".ver button").forEach((b) => b.addEventListener("click", () => {
  const fig = b.closest(".reel");
  const v = fig.querySelector("video");
  const prev = fig.querySelector(".ver .on");
  prev.classList.remove("on");
  prev.setAttribute("aria-pressed", "false");
  b.classList.add("on");
  b.setAttribute("aria-pressed", "true");
  v.pause();
  v.src = b.dataset.src;
  v.poster = b.dataset.poster;
  fig.querySelector("figcaption span").textContent = b.dataset.len;
}));

/* ---------- Project filters ---------- */
const cards = [...document.querySelectorAll(".card")];
document.querySelectorAll(".filters button").forEach((btn) => {
  btn.addEventListener("click", () => {
    const prev = document.querySelector(".filters .on");
    prev.classList.remove("on");
    prev.setAttribute("aria-pressed", "false");
    btn.classList.add("on");
    btn.setAttribute("aria-pressed", "true");
    const f = btn.dataset.filter;
    cards.forEach((c) => {
      const show = f === "all" || c.dataset.cat.split(" ").includes(f);
      c.classList.toggle("hide", !show);
      if (show) c.classList.add("in");
    });
  });
});

/* ---------- Cosmetics gallery: silent loops play only while on screen ---------- */
// paused by the visitor's button, or from the start if they asked for reduced motion
const loopBtn = document.querySelector(".loop-toggle");
let loopsOff = matchMedia("(prefers-reduced-motion: reduce)").matches;
const loopVids = [...document.querySelectorAll(".noir-row video")];
function playLoop(v) {
  if (!v.src) v.src = v.dataset.src; // load only once it is needed
  v.play().catch(() => {});
}
const loopIO = new IntersectionObserver((entries) => entries.forEach((e) => {
  const v = e.target;
  if (e.isIntersecting && !loopsOff) playLoop(v); else v.pause();
}), { threshold: 0.3 });
loopVids.forEach((v) => loopIO.observe(v));
function setLoopBtn() {
  loopBtn.textContent = loopsOff ? "▶ הפעלת הסרטונים" : "⏸ עצירת הסרטונים";
}
loopBtn?.addEventListener("click", () => {
  loopsOff = !loopsOff;
  loopVids.forEach((v) => (loopsOff ? v.pause() : playLoop(v)));
  setLoopBtn();
});
if (loopBtn) setLoopBtn();

/* ---------- Every visit starts at the top, even from a link with #section ---------- */
history.scrollRestoration = "manual";
if (location.hash) history.replaceState(null, "", location.pathname + location.search);
const toTop = () => scrollTo({ top: 0, behavior: "instant" });
toTop();
