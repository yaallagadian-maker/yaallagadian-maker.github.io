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
let samples = []; // y position along the road, every STEP px of length
const STEP = 6;

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
  let d = `M ${xOf(stops[0])} ${yOf(first) + first.offsetHeight / 2}`;

  crosses.forEach((c, i) => {
    const yc = yOf(c) + c.offsetHeight / 2;
    const xa = xOf(stops[i]);
    const xb = xOf(stops[i + 1]);
    const dir = xb < xa ? -1 : 1;
    d += ` L ${xa} ${yc - R} Q ${xa} ${yc} ${xa + dir * R} ${yc}`;
    d += ` L ${xb - dir * R} ${yc} Q ${xb} ${yc} ${xb} ${yc + R}`;
  });

  const last = stops[stops.length - 1];
  const dest = last.querySelector(".sign");
  d += ` L ${xOf(last)} ${yOf(dest) + dest.offsetHeight / 2}`;

  svg.setAttribute("viewBox", `0 0 ${main.clientWidth} ${main.scrollHeight}`);
  [base, done, lines].forEach((p) => p.setAttribute("d", d));

  total = base.getTotalLength();
  done.style.strokeDasharray = total;
  samples = [];
  for (let l = 0; l <= total; l += STEP) samples.push(base.getPointAtLength(l).y);
  update();
}

// first length whose y reaches target (road y never goes back up)
function lengthAtY(y) {
  let lo = 0, hi = samples.length - 1;
  while (lo < hi) {
    const mid = (lo + hi) >> 1;
    if (samples[mid] < y) lo = mid + 1; else hi = mid;
  }
  return Math.min(lo * STEP, total);
}

/* ---------- Scroll: drive the traveler + route progress ---------- */
function update() {
  if (!total) return;
  const top = main.getBoundingClientRect().top;
  const target = innerHeight * 0.55 - top;
  const len = lengthAtY(target);
  done.style.strokeDashoffset = total - len;
  const p = base.getPointAtLength(len);
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

let rebuild;
new ResizeObserver(() => {
  cancelAnimationFrame(rebuild);
  rebuild = requestAnimationFrame(buildRoad);
}).observe(main);
document.fonts?.ready.then(buildRoad);
addEventListener("load", buildRoad);

/* ---------- Reveal on scroll ---------- */
const io = new IntersectionObserver((entries) => {
  entries.forEach((e) => {
    if (e.isIntersecting) { e.target.classList.add("in"); io.unobserve(e.target); }
  });
}, { threshold: 0.12, rootMargin: "0px 0px -40px 0px" });
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
  fig.querySelector(".ver .on").classList.remove("on");
  b.classList.add("on");
  v.pause();
  v.src = b.dataset.src;
  v.poster = b.dataset.poster;
  fig.querySelector("figcaption span").textContent = b.dataset.len;
}));

/* ---------- Project filters ---------- */
const cards = [...document.querySelectorAll(".card")];
document.querySelectorAll(".filters button").forEach((btn) => {
  btn.addEventListener("click", () => {
    document.querySelector(".filters .on").classList.remove("on");
    btn.classList.add("on");
    const f = btn.dataset.filter;
    cards.forEach((c) => {
      const show = f === "all" || c.dataset.cat.split(" ").includes(f);
      c.classList.toggle("hide", !show);
      if (show) c.classList.add("in");
    });
  });
});

/* ---------- Cosmetics gallery: silent loops play only while on screen ---------- */
const loopIO = new IntersectionObserver((entries) => entries.forEach((e) => {
  const v = e.target;
  if (e.isIntersecting) { if (!v.src) v.src = v.dataset.src; v.play().catch(() => {}); } else v.pause();
}), { threshold: 0.3 });
document.querySelectorAll(".noir-row video").forEach((v) => loopIO.observe(v));

/* ---------- Deep links (#talking etc.): stay on target while images above it load ---------- */
const hashTarget = location.hash && document.querySelector(location.hash);
if (hashTarget) {
  let userMoved = false;
  const stop = () => { userMoved = true; };
  ["wheel", "touchstart", "keydown", "mousedown"].forEach((ev) => addEventListener(ev, stop, { once: true, passive: true }));
  const align = () => { if (!userMoved) hashTarget.scrollIntoView({ block: "start", behavior: "instant" }); };
  document.addEventListener("load", (e) => { if (e.target.tagName === "IMG") align(); }, true);
  addEventListener("load", align);
  setTimeout(() => { userMoved = true; }, 4000);
}
