// Mock only. A toy one-day model so the screens can show real-looking behaviour.
// The real engine (src/engine) simulates 8,760 hours; nothing here is reused.

const TARIFF = 1444.7;            // Rp/kWh, 2,200 VA
const PANEL_KWP = 0.55;
const PANEL_M2 = 2.6;
const COST = { low: 11e6, typ: 13e6, high: 15e6 }; // Rp per kWp
const YEARS = 25;
const DEGRADE = 0.005;
const OPEX = 0.01;
const INVERTER = { year: 12, share: 0.10 };
const BATTERY = { kwh: 5, usable: 0.9, eff: 0.9, cost: 18.75e6, replaceYear: 12 };
const CO2 = 0.85;                 // kg per kWh, placeholder

// Average kW in each hour: 15 kWh a day, 55% of it between 06.00 and 18.00.
const LOAD = [0.3, 0.3, 0.3, 0.3, 0.3, 0.3, 0.45, 0.55, 0.6, 0.65, 0.7, 0.8,
              0.85, 0.85, 0.8, 0.75, 0.65, 0.6, 0.9, 1.0, 1.0, 0.85, 0.7, 0.5];
const SUN_PEAK = 0.509;           // kW per kWp at solar noon

const solarAt = (t, kwp) => (t <= 6 || t >= 18 ? 0 : kwp * SUN_PEAK * Math.sin(Math.PI * (t - 6) / 12));
const loadAt = (t) => {
  const x = ((t - 0.5) % 24 + 24) % 24, i = Math.floor(x), f = x - i;
  return LOAD[i] * (1 - f) + LOAD[(i + 1) % 24] * f;
};

function money(yearKwh, upfront, battery) {
  const series = [0];
  let cum = 0;
  for (let y = 1; y <= YEARS; y++) {
    cum += yearKwh * TARIFF * Math.pow(1 - DEGRADE, y - 1) - OPEX * upfront.typ;
    if (y === INVERTER.year) cum -= INVERTER.share * upfront.typ;
    if (battery && y === BATTERY.replaceYear) cum -= BATTERY.cost;
    series.push(cum);
  }
  const payback = (cost) => { const y = series.findIndex((v, i) => i > 0 && v >= cost && series.slice(i).every((w) => w >= cost)); return y < 0 ? null : y; };
  return { series, net: cum - upfront.typ, pay: [payback(upfront.low), payback(upfront.high)] };
}

function assess(panels) {
  const kwp = panels * PANEL_KWP;
  let gen = 0, self = 0, night = 0;
  for (let h = 0; h < 24; h++) {
    const s = solarAt(h + 0.5, kwp);
    gen += s; self += Math.min(s, LOAD[h]);
    if (h < 6 || h >= 18) night += LOAD[h];
  }
  const d = { gen, self, surplus: gen - self };
  const up = { low: kwp * COST.low, typ: kwp * COST.typ, high: kwp * COST.high };
  const base = money(self * 365, up, false);
  const selfB = self + Math.min(Math.min(d.surplus, BATTERY.kwh * BATTERY.usable) * BATTERY.eff, night);
  const upB = { low: up.low + BATTERY.cost, typ: up.typ + BATTERY.cost, high: up.high + BATTERY.cost };
  return { panels, kwp, d, up, base, selfB, upB, bat: money(selfB * 365, upB, true), wasted: Math.round((d.surplus / gen) * 100) };
}

const MIN = 2, MAX = 8;
const ALL = []; for (let p = MIN; p <= MAX; p++) ALL.push(assess(p));
const REC = ALL.reduce((a, b) => (b.base.net > a.base.net ? b : a));
const pick = (panels) => ALL[panels - MIN];

// ---------- formatting (Indonesian) ----------
const dec = (n, d = 1) => n.toLocaleString("id-ID", { minimumFractionDigits: d, maximumFractionDigits: d });
const kwpText = (n) => n.toLocaleString("id-ID", { minimumFractionDigits: 1, maximumFractionDigits: 2 });
const juta = (n) => `Rp${dec(n / 1e6, Math.abs(n) < 10e6 ? 1 : 0)} <small>juta</small>`;
const jutaRange = (a, b) => `Rp${Math.round(a / 1e6)}–${Math.round(b / 1e6)} <small>juta</small>`;
const ribu = (n) => `Rp${Math.round(n / 1e4) * 10} <small>ribu</small>`;
const payText = ([a, b]) => (a === null ? "Tidak balik modal" : b === null ? `${a}+ <small>tahun</small>` : a === b ? `${a} <small>tahun</small>` : `${a}–${b} <small>tahun</small>`);
const plain = (html) => html.replace(/<[^>]+>/g, "");

// ---------- charts ----------
const NS = "http://www.w3.org/2000/svg";
const NIGHT = "#0f1b3d", SUN = "#ffcf33", SOFT = "#4a556f", RULE = "rgba(15,27,61,0.2)";
const el = (name, attrs, text) => { const n = document.createElementNS(NS, name); for (const k in attrs) n.setAttribute(k, attrs[k]); if (text != null) n.textContent = text; return n; };
let hatchSeq = 0;
function hatch(svg, bg, stroke, opacity = 1) {
  const id = "hatch" + ++hatchSeq, defs = el("defs", {}), p = el("pattern", { id, width: 6, height: 6, patternUnits: "userSpaceOnUse", patternTransform: "rotate(45)" });
  if (bg) p.append(el("rect", { width: 6, height: 6, fill: bg }));
  p.append(el("line", { x1: 0, y1: 0, x2: 0, y2: 6, stroke, "stroke-width": 2.2, "stroke-opacity": opacity }));
  defs.append(p); svg.append(defs);
  return `url(#${id})`;
}

// One day: solid yellow is solar used at home, hatching is solar sent to the grid unpaid.
function drawDay(svg, r, { labels = true } = {}) {
  svg.replaceChildren();
  const X0 = 2, X1 = 338, Y0 = 150, Y1 = 8, YMAX = 2.45, BAND = 18;
  const x = (t) => X0 + (t / 24) * (X1 - X0), y = (kw) => Y0 - (kw / YMAX) * (Y0 - Y1);
  const waste = hatch(svg, "#fff1bf", NIGHT, 0.55);
  if (labels) for (const kw of [1, 2]) {
    svg.append(el("line", { x1: X0, x2: X1, y1: y(kw), y2: y(kw), stroke: RULE, "stroke-width": 1 }));
    svg.append(el("text", { x: X0, y: y(kw) - 4, "font-size": 10, "font-weight": 700, fill: SOFT }, kw + " kW"));
  }
  const ts = []; for (let t = 6; t <= 18.001; t += 0.25) ts.push(t);
  const area = (f) => `M${x(6)} ${y(0)}` + ts.map((t) => `L${x(t).toFixed(1)} ${y(f(t)).toFixed(1)}`).join("") + `L${x(18)} ${y(0)}Z`;
  svg.append(el("path", { d: area((t) => solarAt(t, r.kwp)), fill: waste, stroke: NIGHT, "stroke-width": 1.5, "stroke-linejoin": "round" }));
  svg.append(el("path", { d: area((t) => Math.min(solarAt(t, r.kwp), loadAt(t))), fill: SUN }));
  let line = ""; for (let t = 0; t <= 24.001; t += 0.25) line += `${t ? "L" : "M"}${x(t).toFixed(1)} ${y(loadAt(t)).toFixed(1)}`;
  svg.append(el("path", { d: line, fill: "none", stroke: NIGHT, "stroke-width": 3, "stroke-linejoin": "round", "stroke-linecap": "round" }));
  // night / day band under the plot
  svg.append(el("rect", { x: x(0), y: Y0, width: x(6) - x(0), height: BAND, fill: NIGHT }));
  svg.append(el("rect", { x: x(6), y: Y0, width: x(18) - x(6), height: BAND, fill: SUN }));
  svg.append(el("rect", { x: x(18), y: Y0, width: x(24) - x(18), height: BAND, fill: NIGHT }));
  const band = (t, s, fill) => svg.append(el("text", { x: x(t), y: Y0 + 12.5, "text-anchor": "middle", "font-size": 9.5, "font-weight": 800, "letter-spacing": 1.2, fill }, s));
  band(3, "MALAM", "#fff"); band(12, "SIANG", NIGHT); band(21, "MALAM", "#fff");
  for (const t of [0, 6, 12, 18, 24]) svg.append(el("text", { x: x(t), y: Y0 + BAND + 13, "text-anchor": t === 0 ? "start" : t === 24 ? "end" : "middle", "font-size": 10.5, "font-weight": 700, fill: SOFT }, String(t).padStart(2, "0") + ".00"));
  if (!labels) return;
  const note = (tx, ty, s, anchor = "middle") => svg.append(el("text", { x: tx, y: ty, "text-anchor": anchor, "font-size": 11, "font-weight": 800, fill: NIGHT, stroke: "#fff", "stroke-width": 3, "paint-order": "stroke" }, s));
  svg.append(el("text", { x: x(12), y: y(Math.min(solarAt(12, r.kwp), loadAt(12)) / 2) + 4, "text-anchor": "middle", "font-size": 11, "font-weight": 800, fill: NIGHT }, "dipakai langsung"));
  if (r.wasted >= 8) note(x(12), y(solarAt(12, r.kwp)) - 7, "terbuang ke jaringan");
  note(x(21.2), y(1.0) - 10, "pemakaian rumah");
}

// Payback: savings line against the upfront-cost range.
function drawPay(svg, r) {
  svg.replaceChildren();
  const X0 = 2, X1 = 338, Y0 = 150, Y1 = 10;
  const top = Math.max(r.base.series[YEARS], r.up.high) * 1.1;
  const x = (yr) => X0 + (yr / YEARS) * (X1 - X0), y = (v) => Y0 - (Math.max(v, 0) / top) * (Y0 - Y1);
  const cost = hatch(svg, null, NIGHT, 0.35);
  const [a, b] = r.base.pay;
  if (a !== null) svg.append(el("rect", { x: x(a), width: Math.max(x(b ?? YEARS) - x(a), 3), y: Y1, height: Y0 - Y1, fill: SUN }));
  const step = top > 120e6 ? 50e6 : 25e6;
  for (let v = step; v <= top; v += step) {
    svg.append(el("line", { x1: X0, x2: X1, y1: y(v), y2: y(v), stroke: RULE, "stroke-width": 1 }));
    svg.append(el("text", { x: X0, y: y(v) - 4, "font-size": 10, "font-weight": 700, fill: SOFT }, `Rp${v / 1e6} jt`));
  }
  svg.append(el("rect", { x: X0, width: X1 - X0, y: y(r.up.high), height: y(r.up.low) - y(r.up.high), fill: cost, stroke: NIGHT, "stroke-width": 1 }));
  svg.append(el("line", { x1: X0, x2: X1, y1: Y0, y2: Y0, stroke: NIGHT, "stroke-width": 2.5 }));
  svg.append(el("path", { d: r.base.series.map((v, i) => `${i ? "L" : "M"}${x(i).toFixed(1)} ${y(v).toFixed(1)}`).join(""), fill: "none", stroke: NIGHT, "stroke-width": 3.5, "stroke-linejoin": "round", "stroke-linecap": "round" }));
  const note = (tx, ty, s, anchor) => svg.append(el("text", { x: tx, y: ty, "text-anchor": anchor, "font-size": 11, "font-weight": 800, fill: NIGHT, stroke: "#fff", "stroke-width": 3, "paint-order": "stroke" }, s));
  note(X1, y(r.up.low) + 14, "biaya awal", "end");
  note(x(24), y(r.base.series[24]) - 12, "total hemat", "end");
  if (a !== null) svg.append(el("text", { x: Math.min(Math.max((x(a) + x(b ?? YEARS)) / 2, 40), X1 - 40), y: Y0 - 8, "text-anchor": "middle", "font-size": 11, "font-weight": 800, fill: NIGHT }, "balik modal"));
  for (const yr of [0, 5, 10, 15, 20, 25]) svg.append(el("text", { x: x(yr), y: Y0 + 15, "text-anchor": yr === 0 ? "start" : yr === 25 ? "end" : "middle", "font-size": 10.5, "font-weight": 700, fill: SOFT }, yr === 0 ? "tahun 0" : String(yr)));
}
