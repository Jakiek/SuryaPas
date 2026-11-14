// Mock only: wires the result screen to the toy model in model.js.
const $ = (id) => document.getElementById(id);
let current = REC.panels;

const picker = $("picker");
for (let p = 1; p <= MAX; p++) {
  const b = document.createElement("button");
  b.type = "button";
  b.dataset.p = p;
  b.innerHTML = `<span class="num">${p}</span>`;
  if (p === REC.panels) b.classList.add("rec");
  if (p < MIN) { b.disabled = true; b.setAttribute("aria-label", `${p} panel, di bawah ukuran terkecil`); }
  else { b.setAttribute("aria-label", `${p} panel`); b.addEventListener("click", () => render(p)); }
  picker.append(b);
}

function render(panels) {
  current = panels;
  const r = pick(panels), isRec = r === REC;
  for (const b of picker.children) {
    const on = +b.dataset.p <= panels;
    b.classList.toggle("on", on);
    b.setAttribute("aria-pressed", String(+b.dataset.p === panels));
  }
  $("lede").textContent = isRec ? "Yang pas untuk rumah ini" : "Pilihan Anda";
  $("count").textContent = `${r.panels} panel`;
  $("kwp").textContent = kwpText(r.kwp);
  $("area").textContent = Math.round(r.panels * PANEL_M2);
  $("cost").innerHTML = jutaRange(r.up.low, r.up.high);
  $("payback").innerHTML = payText(r.base.pay);
  $("say").textContent = isRec ? "Ini yang pas: hemat bersih paling besar untuk pemakaian siang Anda."
    : r.panels < REC.panels ? "Kurang dari yang pas. Masih ada pemakaian siang yang belum tertutup panel."
    : `Lebih dari yang pas. ${r.wasted}% listrik panel terbuang ke jaringan tanpa dibayar.`;

  drawDay($("dayChart"), r);
  $("daySummary").textContent = `Panel menghasilkan ${dec(r.d.gen)} kWh sehari. ${dec(r.d.self)} kWh langsung dipakai di rumah, ${dec(r.d.surplus)} kWh mengalir ke jaringan tanpa dibayar.`;
  $("monthly").innerHTML = ribu((r.d.self * 365 * TARIFF) / 12);
  $("share").innerHTML = `${100 - r.wasted}<small>%</small>`;
  $("net").innerHTML = juta(r.base.net);
  $("co2").innerHTML = `${dec((r.d.self * 365 * CO2) / 1000)} <small>ton/tahun</small>`;

  drawPay($("payChart"), r);
  const [a, b] = r.base.pay;
  $("paySummary").textContent = a === null
    ? "Dalam 25 tahun, penghematan tidak menutup biaya awal pada jumlah panel ini."
    : `Penghematan menutup biaya awal pada tahun ke-${a}${b && b !== a ? ` sampai ke-${b}` : ""}, tergantung harga pemasang. Setelah 25 tahun, hemat bersih sekitar ${plain(juta(r.base.net))}.`;

  $("bat-h").textContent = r.bat.net < r.base.net ? "Baterai belum sepadan" : "Baterai menambah hemat";
  $("b0cost").textContent = plain(jutaRange(r.up.low, r.up.high));
  $("b1cost").textContent = plain(jutaRange(r.upB.low, r.upB.high));
  $("b0month").textContent = plain(ribu((r.d.self * 365 * TARIFF) / 12));
  $("b1month").textContent = plain(ribu((r.selfB * 365 * TARIFF) / 12));
  $("b0pay").textContent = plain(payText(r.base.pay));
  $("b1pay").textContent = plain(payText(r.bat.pay));
  $("b0net").textContent = plain(juta(r.base.net));
  $("b1net").textContent = plain(juta(r.bat.net));
}

render(current);
$("quote").addEventListener("click", () => { $("quoteMsg").textContent = "Terima kasih. Minat Anda kami catat, tanpa menyimpan data pribadi."; });
$("copy").addEventListener("click", () => { $("copy").textContent = "Tautan disalin"; });
