let coins = [];
let filtered = [];
let theme = localStorage.getItem("theme") || (document.documentElement.classList.contains('dark') ? 'dark' : 'light');

const tableBody = document.querySelector("#coin-table tbody");
const searchInput = document.getElementById("search");
const filterSelect = document.getElementById("filter");
const themeSwitch = document.getElementById("toggle-theme");

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

// Load coin data directly from CoinGecko and ensure VANRY is first
async function fetchCoins() {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&order=market_cap_desc&per_page=50&page=1&sparkline=false&price_change_percentage=24h"
    );
    const data = await res.json();
    coins = Array.isArray(data) ? data : [];

    // Ensure VANRY exists and is first
    let idx = coins.findIndex(c => (c.symbol || "").toLowerCase() === "vanry" || (c.id || "") === "vanar-chain");

    // If not found in top 50, fetch it by id explicitly
    if (idx === -1) {
      try {
        const vanrRes = await fetch(
          "https://api.coingecko.com/api/v3/coins/markets?vs_currency=usd&ids=vanar-chain&order=market_cap_desc&per_page=1&page=1&sparkline=false&price_change_percentage=24h"
        );
        const vanrData = await vanrRes.json();
        if (Array.isArray(vanrData) && vanrData.length > 0) {
          coins = coins.filter(c => (c.id || "") !== vanrData[0].id);
          coins.unshift(vanrData[0]);
        }
      } catch (e) {
        // fail quietly; list still renders
      }
    } else if (idx > 0) {
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
  return n >= 1 ? n.toFixed(2) : n.toFixed(6);
}

function pctClass(p) {
  if (p == null) return "text-slate-600 dark:text-slate-400";
  return p >= 0 ? "text-emerald-600 dark:text-emerald-400" : "text-rose-600 dark:text-rose-400";
}

function badgeHtml(c) {
  const isVanry = (c.symbol || "").toLowerCase() === "vanry" || (c.id || "") === "vanar-chain";
  return isVanry
    ? `<span class="ml-2 inline-flex items-center px-2 py-0.5 text-[10px] font-semibold rounded-full bg-gradient-to-r from-fuchsia-500 via-cyan-400 to-rose-500 text-white shadow-sm">VANRY/USDT</span>`
    : "";
}

function renderTable() {
  tableBody.innerHTML = "";
  filtered.forEach(c => {
    const row = document.createElement("tr");
    row.className = "hover:bg-slate-50 dark:hover:bg-slate-800/60 transition-colors cursor-pointer";
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

    // Click to open detail panel with interactive chart
    row.addEventListener("click", () => {
      showHoverDetail(c.id, c.name);
    });

    tableBody.appendChild(row);
  });
}

// Build an interactive sparkline SVG where labels show only on click
function interactiveSparklineSVG(values, dates, {
  width = 560,
  height = 120,
  stroke = "#06b6d4",
  fillAlpha = "22",
  dotColor = "#06b6d4",
  textColorLight = "#0f172a",  // slate-900
  textColorDark = "#e2e8f0",   // slate-200
  fontSize = 11
} = {}) {
  const pts = values.map(Number).filter(v => isFinite(v));
  if (!pts.length) return "";

  const min = Math.min(...pts);
  const max = Math.max(...pts);
  const span = Math.max(1, pts.length - 1);
  const pad = 6;
  const innerW = width - pad * 2;
  const innerH = height - pad * 2;
  const yScale = max === min ? 1 : (max - min);

  const getX = (i) => pad + (i / span) * innerW;
  const getY = (v) => height - pad - ((v - min) / yScale) * innerH;

  const lineD = pts.map((v, i) => `${i === 0 ? "M" : "L"} ${getX(i).toFixed(2)} ${getY(v).toFixed(2)}`).join(" ");
  const areaD = `${lineD} L ${getX(pts.length - 1).toFixed(2)} ${height - pad} L ${getX(0).toFixed(2)} ${height - pad} Z`;

  const isDark = document.documentElement.classList.contains("dark");
  const labelColor = isDark ? textColorDark : textColorLight;

  // Build SVG elements
  const svg = document.createElementNS("http://www.w3.org/2000/svg", "svg");
  svg.setAttribute("width", "100%");
  svg.setAttribute("height", String(height));
  svg.setAttribute("viewBox", `0 0 ${width} ${height}`);
  svg.setAttribute("preserveAspectRatio", "none");
  svg.classList.add("rounded-md");

  // Area path
  const area = document.createElementNS("http://www.w3.org/2000/svg", "path");
  area.setAttribute("d", areaD);
  area.setAttribute("fill", `${stroke}${fillAlpha}`);
  svg.appendChild(area);

  // Line path
  const line = document.createElementNS("http://www.w3.org/2000/svg", "path");
  line.setAttribute("d", lineD);
  line.setAttribute("fill", "none");
  line.setAttribute("stroke", stroke);
  line.setAttribute("stroke-width", "2");
  line.setAttribute("stroke-linecap", "round");
  svg.appendChild(line);

  // Focus marker and tooltip (hidden until a point is clicked)
  const focus = document.createElementNS("http://www.w3.org/2000/svg", "circle");
  focus.setAttribute("r", "3");
  focus.setAttribute("fill", dotColor);
  focus.style.display = "none";
  svg.appendChild(focus);

  const tooltipBg = document.createElementNS("http://www.w3.org/2000/svg", "rect");
  tooltipBg.setAttribute("rx", "4");
  tooltipBg.setAttribute("ry", "4");
  tooltipBg.setAttribute("fill", isDark ? "#0b1220" : "#ffffff");
  tooltipBg.setAttribute("stroke", isDark ? "#334155" : "#cbd5e1");
  tooltipBg.setAttribute("stroke-width", "1");
  tooltipBg.style.display = "none";
  svg.appendChild(tooltipBg);

  const tooltipText = document.createElementNS("http://www.w3.org/2000/svg", "text");
  tooltipText.setAttribute("font-size", String(fontSize));
  tooltipText.setAttribute("fill", labelColor);
  tooltipText.setAttribute("font-family", "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial");
  tooltipText.style.display = "none";
  svg.appendChild(tooltipText);

  // Optional first/last date labels at bottom for context
  if (dates && dates.length === pts.length) {
    const firstDate = new Date(dates[0]).toLocaleDateString();
    const lastDate = new Date(dates[dates.length - 1]).toLocaleDateString();

    const firstLbl = document.createElementNS("http://www.w3.org/2000/svg", "text");
    firstLbl.setAttribute("x", String(pad));
    firstLbl.setAttribute("y", String(height - 2));
    firstLbl.setAttribute("text-anchor", "start");
    firstLbl.setAttribute("font-size", String(10));
    firstLbl.setAttribute("fill", labelColor);
    firstLbl.setAttribute("font-family", "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial");
    firstLbl.textContent = firstDate;
    svg.appendChild(firstLbl);

    const lastLbl = document.createElementNS("http://www.w3.org/2000/svg", "text");
    lastLbl.setAttribute("x", String(width - pad));
    lastLbl.setAttribute("y", String(height - 2));
    lastLbl.setAttribute("text-anchor", "end");
    lastLbl.setAttribute("font-size", String(10));
    lastLbl.setAttribute("fill", labelColor);
    lastLbl.setAttribute("font-family", "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Arial");
    lastLbl.textContent = lastDate;
    svg.appendChild(lastLbl);
  }

  // Build invisible click targets for each point
  pts.forEach((v, i) => {
    const cx = getX(i);
    const cy = getY(v);

    // A larger invisible circle to make clicking easier
    const hit = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    hit.setAttribute("cx", cx.toFixed(2));
    hit.setAttribute("cy", cy.toFixed(2));
    hit.setAttribute("r", "10");
    hit.setAttribute("fill", "transparent");
    hit.style.cursor = "pointer";

    hit.addEventListener("click", () => {
      // Show focus dot
      focus.setAttribute("cx", cx.toFixed(2));
      focus.setAttribute("cy", cy.toFixed(2));
      focus.style.display = "block";

      // Tooltip text content: Price and Date
      const dateStr = dates && dates[i] ? new Date(dates[i]).toLocaleString() : "";
      const text = `$${fmtPrice2(v)} USDT` + (dateStr ? ` • ${dateStr}` : "");
      tooltipText.textContent = text;

      // Measure text to size background rect
      // Create a temporary <svg> in DOM ensures getBBox works
      tooltipText.style.display = "block";
      const bbox = tooltipText.getBBox();
      const padX = 8;
      const padY = 6;

      // Position tooltip above the point, fallback below if near top
      const boxW = bbox.width + padX * 2;
      const boxH = bbox.height + padY * 2;
      let boxX = cx - boxW / 2;
      let boxY = cy - boxH - 8;

      // Keep within chart bounds
      boxX = Math.max(2, Math.min(boxX, width - boxW - 2));
      if (boxY < 2) boxY = cy + 8;

      // Set background rect
      tooltipBg.setAttribute("x", String(boxX));
      tooltipBg.setAttribute("y", String(boxY));
      tooltipBg.setAttribute("width", String(boxW));
      tooltipBg.setAttribute("height", String(boxH));
      tooltipBg.style.display = "block";

      // Place text inside rect
      tooltipText.setAttribute("x", String(boxX + padX));
      // Align baseline inside box
      tooltipText.setAttribute("y", String(boxY + padY + bbox.height - 2));
    });

    svg.appendChild(hit);

    // Small visible dot for the point (optional)
    const dot = document.createElementNS("http://www.w3.org/2000/svg", "circle");
    dot.setAttribute("cx", cx.toFixed(2));
    dot.setAttribute("cy", cy.toFixed(2));
    dot.setAttribute("r", "2");
    dot.setAttribute("fill", dotColor);
    svg.appendChild(dot);
  });

  // Click anywhere else in SVG to hide tooltip
  svg.addEventListener("click", (e) => {
    if (e.target.tagName !== "circle" || e.target === svg) {
      focus.style.display = "none";
      tooltipBg.style.display = "none";
      tooltipText.style.display = "none";
    }
  });

  return svg;
}

async function showHoverDetail(coinId, coinName) {
  try {
    const res = await fetch(`https://api.coingecko.com/api/v3/coins/${coinId}/market_chart?vs_currency=usd&days=7`);
    const data = await res.json();

    panelTitle.textContent = `${coinName}: Latest 7 Days`;

    const prices = Array.isArray(data.prices) ? data.prices : [];
    const closes = prices.map(p => p[1]);
    const times = prices.map(p => p[0]);

    // Interactive SVG chart (labels only on click)
    const svgEl = interactiveSparklineSVG(closes, times, {
      width: 560,
      height: 130,
      stroke: "#06b6d4",
      fillAlpha: "22",
      dotColor: "#06b6d4"
    });

    const rowsHtml = prices.map(([t, p]) => {
      const d = new Date(t).toLocaleDateString();
      const price = fmtPrice2(p);
      return `
        <div class="grid grid-cols-12 items-center py-1">
          <div class="col-span-7 text-slate-600 dark:text-slate-400">${d}</div>
          <div class="col-span-5 text-right font-medium text-slate-900 dark:text-slate-100">$${price} USDT</div>
        </div>
      `;
    }).join("");

    // Mount SVG then the list
    panelContent.innerHTML = `<div class="mb-3"></div>`;
    panelContent.firstChild.appendChild(svgEl);
    panelContent.insertAdjacentHTML("beforeend", `
      <div class="grid grid-cols-12 text-xs font-semibold uppercase tracking-wide pb-2 border-b border-slate-200 dark:border-slate-700">
        <div class="col-span-7 text-slate-600 dark:text-slate-300">Date</div>
        <div class="col-span-5 text-right text-slate-600 dark:text-slate-300">Price</div>
      </div>
      <div class="mt-2 space-y-1">
        ${rowsHtml}
      </div>
    `);

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
