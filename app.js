let coins = [];
let filtered = [];
let theme = localStorage.getItem("theme") || (document.documentElement.classList.contains('dark') ? 'dark' : 'light');

const tableBody = document.querySelector("#coin-table tbody");
const searchInput = document.getElementById("search");
const filterSelect = document.getElementById("filter");
const themeSwitch = document.getElementById("toggle-theme");

themeSwitch.onchange = (e) => {
  if (e.target.checked) document.documentElement.classList.add("dark");
  else document.documentElement.classList.remove("dark");
};


// Single in-board floating panel
const hoverPanel = document.getElementById("hover-detail");
const panelTitle = document.getElementById("panel-title");
const panelContent = document.getElementById("panel-content");
const closePanelBtn = document.getElementById("close-panel");

// Apply theme to <html> for Tailwind dark mode
function applyTheme(t) {
  const root = document.documentElement;
  if (t === "dark") root.classList.add("dark");
  else root.classList.remove("dark");
  themeSwitch.checked = t === "dark";
  localStorage.setItem("theme", t);
}
applyTheme(theme); // initialize from storage or system

// Load coin data directly from CoinGecko
async function fetchCoins() {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h"
    );
    const data = await res.json();
    coins = data;

    // Move Vanry/USDT to top
    const idx = coins.findIndex(c => c.symbol?.toLowerCase() === "vanry");
    if (idx > 0) {
      const vanry = coins.splice(idx, 1)[0];
      coins.unshift(vanry);
    }

    applyFilters();
  } catch (err) {
    tableBody.innerHTML = `
      <tr>
        <td colspan="3" class="px-4 py-6 text-center text-sm text-rose-600 dark:text-rose-400">
          Failed to load data. Please try again.
        </td>
      </tr>
    `;
  }
}

function applyFilters() {
  const q = searchInput.value.trim().toLowerCase();
  filtered = coins.filter(c =>
    c.name?.toLowerCase().includes(q) || c.symbol?.toLowerCase().includes(q)
  );

  if (filterSelect.value === "gainers") {
    filtered = filtered.filter(c => (c.price_change_percentage_24h || 0) > 0);
  } else if (filterSelect.value === "losers") {
    filtered = filtered.filter(c => (c.price_change_percentage_24h || 0) < 0);
  }

  renderTable();
}

function fmtPrice2(v) {
  if (v == null || v === "") return "-";
  const n = Number(v);
  if (!isFinite(n)) return "-";
  return n.toFixed(2);
}

function pctClass(p) {
  if (p == null) return "text-slate-600 dark:text-slate-400";
  return p >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400";
}

function badgeHtml(c) {
  const isVanry = c.symbol?.toLowerCase() === "vanry";
  return isVanry
    ? `<span class="ml-2 inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full bg-gradient-to-r from-fuchsia-500 via-cyan-400 to-rose-500 text-white shadow-sm">VANRY/USDT</span>`
    : "";
}

function renderTable() {
  tableBody.innerHTML = "";
  filtered.forEach(c => {
    const row = document.createElement("tr");
    row.className = "hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors";
    const pct = c.price_change_percentage_24h;

    row.innerHTML = `
      <td class="px-4 py-3">
        <div class="flex items-center gap-3">
          <img src="${c.image}" alt="${c.symbol}" class="w-7 h-7 rounded-full ring-1 ring-slate-200 dark:ring-slate-700" />
          <div class="flex flex-col">
            <div class="flex items-center">
              <span class="font-semibold text-slate-900 dark:text-slate-100">${c.name}</span>
              ${badgeHtml(c)}
            </div>
            <span class="text-xs text-slate-500 dark:text-slate-400">${(c.symbol || "").toUpperCase()}</span>
          </div>
        </div>
      </td>
      <td class="px-4 py-3 text-right font-semibold text-sky-700 dark:text-cyan-300">$${fmtPrice2(c.current_price)} USDT</td>
      <td class="px-4 py-3 text-right font-bold ${pctClass(pct)}">${pct != null ? Number(pct).toFixed(2) : "-"}%</td>
    `;

    let hoverTimeout;
    row.addEventListener("mouseenter", () => {
      clearTimeout(hoverTimeout);
      showHoverDetail(c.id, c.name);
    });
    row.addEventListener("mouseleave", () => {
      hoverTimeout = setTimeout(() => {
        if (!hoverPanel.matches(":hover")) hideHoverDetail();
      }, 120);
    });

    tableBody.appendChild(row);
  });

  hoverPanel.addEventListener("mouseleave", hideHoverDetail);
}

async function showHoverDetail(coinId, coinName) {
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=7`);
    const data = await res.json();

    panelTitle.textContent = `${coinName}: Latest 7 Days Report`;

    const rowsHtml = (data.prices || []).map(([t, p]) => {
      const d = new Date(t).toLocaleDateString();
      const price = fmtPrice2(p);
      return `
        <div class="grid grid-cols-12 items-center py-1">
          <div class="col-span-7 text-slate-600 dark:text-slate-400">${d}</div>
          <div class="col-span-5 text-right font-medium text-slate-900 dark:text-slate-100">$${price} USDT</div>
        </div>
      `;
    }).join("");

    panelContent.innerHTML = `
      <div class="grid grid-cols-12 text-xs font-semibold uppercase tracking-wide pb-2 border-b border-slate-200 dark:border-slate-700">
        <div class="col-span-7 text-slate-600 dark:text-slate-300">Date</div>
        <div class="col-span-5 text-right text-slate-600 dark:text-slate-300">Price</div>
      </div>
      <div class="mt-2 space-y-1">
        ${rowsHtml}
      </div>
    `;

    hoverPanel.classList.remove("hidden");
  } catch (err) {
    console.error("Failed to load chart data", err);
  }
}

function hideHoverDetail() {
  hoverPanel.classList.add("hidden");
}

closePanelBtn.onclick = hideHoverDetail;

searchInput.oninput = applyFilters;
filterSelect.onchange = applyFilters;
themeSwitch.onchange = (e) => applyTheme(e.target.checked ? "dark" : "light");

fetchCoins();
