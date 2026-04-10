const API_BASE = "https://cpsy300groupsix-azcfb9ejcghncxc5.canadacentral-01.azurewebsites.net";

// Active chart instances (so we can destroy before re-rendering)
const charts = {};

// Track which chart types have been opened by the user
const renderedCharts = new Set();

// Current pagination state
let currentPage = 1;
let totalPages  = 1;

// --- Init ---

async function init() {
    await populateDietDropdown();
    await loadRecipes(1);
    await loadSecurityStatus();
    checkOAuthReturn();
}

function checkOAuthReturn() {
    const params   = new URLSearchParams(window.location.search);
    const provider = params.get("login");
    const user     = params.get("user");
    if (!provider || !user) return;

    const msgEl = document.getElementById("oauth-message");
    msgEl.textContent = `Logged in with ${provider === "google" ? "Google" : "GitHub"} as ${user}`;
    msgEl.className   = "green";

    // Clean the URL without reloading
    window.history.replaceState({}, "", window.location.pathname);
}

// --- Dropdown ---

async function populateDietDropdown() {
    const res    = await fetch(`${API_BASE}/api/diet-types`);
    const types  = await res.json();
    const select = document.getElementById("diet-select");

    types.forEach(diet => {
        const opt   = document.createElement("option");
        opt.value   = diet;
        opt.textContent = diet;
        select.appendChild(opt);
    });
}

// --- Charts ---

async function loadChart(type, diet = "") {
    renderedCharts.add(type);
    const params = diet ? `?diet=${encodeURIComponent(diet)}` : "";
    const res  = await fetch(`${API_BASE}/api/chart/${type}${params}`);
    const data = await res.json();

    if (charts[type]) {
        charts[type].destroy();
    }

    const ctx = document.getElementById(`chart-${type}`).getContext("2d");

    if (type === "bar") {
        charts[type] = new Chart(ctx, {
            type: "bar",
            data: {
                labels: data.labels,
                datasets: [
                    { label: "Protein (g)", data: data.protein, backgroundColor: "#1a56db" },
                    { label: "Carbs (g)",   data: data.carbs,   backgroundColor: "#28a745" },
                    { label: "Fat (g)",     data: data.fat,     backgroundColor: "#e07b00" },
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }

    if (type === "scatter") {
        const points = data.points.map(p => ({ x: p["Carbs(g)"], y: p["Protein(g)"] }));
        charts[type] = new Chart(ctx, {
            type: "scatter",
            data: { datasets: [{ label: "Recipes", data: points, backgroundColor: "#1a56db" }] },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }

    if (type === "heatmap") {
        // Render as grouped bar (Chart.js has no native heatmap)
        charts[type] = new Chart(ctx, {
            type: "bar",
            data: {
                labels: data.diets,
                datasets: [
                    { label: "Protein", data: data.protein, backgroundColor: "#1a56db" },
                    { label: "Carbs",   data: data.carbs,   backgroundColor: "#28a745" },
                    { label: "Fat",     data: data.fat,     backgroundColor: "#e07b00" },
                ]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }

    if (type === "pie") {
        charts[type] = new Chart(ctx, {
            type: "pie",
            data: {
                labels: data.labels,
                datasets: [{
                    data: data.counts,
                    backgroundColor: [
                        "#1a56db","#28a745","#e07b00","#6f42c1",
                        "#dc3545","#17a2b8","#fd7e14","#20c997"
                    ]
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } } }
        });
    }
}

// --- Filters ---

async function applyFilter() {
    const search = document.getElementById("search-input").value.toLowerCase();
    const diet   = document.getElementById("diet-select").value;

    const params = new URLSearchParams();
    if (diet) params.set("diet", diet);

    const res  = await fetch(`${API_BASE}/api/nutritional-insights?${params}`);
    const data = await res.json();

    const filtered = data.filter(row =>
        row["Diet_type"].toLowerCase().includes(search)
    );

    const out = document.getElementById("filter-results");
    if (filtered.length === 0) {
        out.textContent = "No results found.";
        return;
    }

    out.innerHTML = filtered.map(row =>
        `<strong>${row["Diet_type"]}</strong> —
         Protein: ${row["Protein(g)"].toFixed(1)}g,
         Carbs: ${row["Carbs(g)"].toFixed(1)}g,
         Fat: ${row["Fat(g)"].toFixed(1)}g`
    ).join("<br>");

    // Reload recipes with the diet filter applied
    currentPage = 1;
    await loadRecipes(1, diet);

    // Reload any charts that have already been opened
    const chartPromises = [];
    for (const type of ["bar", "scatter", "heatmap"]) {
        if (renderedCharts.has(type)) {
            chartPromises.push(loadChart(type, diet));
        }
    }
    await Promise.all(chartPromises);
}

// --- API Buttons ---

async function apiGetInsights() {
    const diet   = document.getElementById("diet-select").value;
    const params = diet ? `?diet=${diet}` : "";
    const res    = await fetch(`${API_BASE}/api/nutritional-insights${params}`);
    const data   = await res.json();
    showOutput(data);
}

async function apiGetRecipes() {
    const diet   = document.getElementById("diet-select").value;
    const params = diet ? `?diet=${diet}&page=${currentPage}` : `?page=${currentPage}`;
    const res    = await fetch(`${API_BASE}/api/recipes${params}`);
    const data   = await res.json();
    showOutput(data);
}

async function apiGetClusters() {
    const res  = await fetch(`${API_BASE}/api/clusters`);
    const data = await res.json();
    showOutput(data);
}

function showOutput(data) {
    const out = document.getElementById("api-output");
    out.style.display = "block";

    // Recipes response: {page, pages, total, recipes: [...]}
    if (data && Array.isArray(data.recipes)) {
        out.innerHTML = `
            <p style="margin:0 0 8px"><strong>Page ${data.page} of ${data.pages}</strong> — ${data.total} total recipes</p>
            ${buildTable(data.recipes)}`;
        return;
    }

    // Plain array (insights, clusters)
    if (Array.isArray(data)) {
        out.innerHTML = buildTable(data);
        return;
    }

    // Fallback
    out.innerHTML = `<pre>${JSON.stringify(data, null, 2)}</pre>`;
}

function buildTable(rows) {
    if (!rows.length) return "<p>No results.</p>";
    const headers = Object.keys(rows[0]);
    const ths = headers.map(h => `<th>${h}</th>`).join("");
    const trs = rows.map(row =>
        `<tr>${headers.map(h => {
            const v = row[h];
            return `<td>${typeof v === "number" ? v.toFixed(2) : v ?? "—"}</td>`;
        }).join("")}</tr>`
    ).join("");
    return `<table><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table>`;
}

// --- Pagination ---

async function loadRecipes(page, diet = "") {
    const params = new URLSearchParams({ page, per_page: 20 });
    if (diet) params.set("diet", diet);

    const res  = await fetch(`${API_BASE}/api/recipes?${params}`);
    const data = await res.json();

    currentPage = data.page;
    totalPages  = data.pages;

    document.getElementById("page-info").textContent = `${currentPage} / ${totalPages}`;
    renderTable(data.recipes);
}

function renderTable(recipes) {
    if (!recipes.length) {
        document.getElementById("recipe-table").innerHTML = "<p>No recipes found.</p>";
        return;
    }

    const headers = ["Diet_type", "Recipe_name", "Cuisine_type", "Protein(g)", "Carbs(g)", "Fat(g)"];
    const rows = recipes.map(r =>
        `<tr>${headers.map(h => `<td>${typeof r[h] === "number" ? r[h].toFixed(1) : r[h]}</td>`).join("")}</tr>`
    ).join("");

    document.getElementById("recipe-table").innerHTML = `
        <table>
            <thead><tr>${headers.map(h => `<th>${h}</th>`).join("")}</tr></thead>
            <tbody>${rows}</tbody>
        </table>`;
}

async function changePage(delta) {
    const next = currentPage + delta;
    if (next < 1 || next > totalPages) return;
    const diet = document.getElementById("diet-select").value;
    await loadRecipes(next, diet);
}

async function triggerManualCleanup() {
    const res  = await fetch(`${API_BASE}/api/cleanup`);
    const data = await res.json();
    alert(data.message);
}

// --- OAuth ---

function loginWithGoogle() {
    window.location.href = `${API_BASE}/api/auth/google`;
}

function loginWithGitHub() {
    window.location.href = `${API_BASE}/api/auth/github`;
}

// --- 2FA ---

async function verify2FA() {
    const code  = document.getElementById("twofa").value.trim();
    const msgEl = document.getElementById("twofa-message");
    if (!code) {
        msgEl.textContent = "Please enter your 2FA code.";
        msgEl.className   = "red";
        return;
    }
    try {
        const res  = await fetch(`${API_BASE}/api/auth/verify-2fa`, {
            method:  "POST",
            headers: { "Content-Type": "application/json" },
            body:    JSON.stringify({ code })
        });
        const data = await res.json();
        msgEl.textContent = data.message;
        msgEl.className   = data.status === "success" ? "green" : "red";
    } catch (err) {
        msgEl.textContent = "Error contacting server.";
        msgEl.className   = "red";
    }
}

// --- Security Status ---

async function loadSecurityStatus() {
    const encEl  = document.getElementById("sec-encryption");
    const accEl  = document.getElementById("sec-access-control");
    const comEl  = document.getElementById("sec-compliance");

    encEl.textContent = "Loading…";
    accEl.textContent = "Loading…";
    comEl.textContent = "Loading…";

    try {
        const res  = await fetch(`${API_BASE}/api/security-status`);
        const data = await res.json();

        encEl.textContent = data.encryption;
        encEl.className   = data.encryption === "Enabled" ? "green" : "red";

        accEl.textContent = data.access_control;
        accEl.className   = data.access_control === "Secure" ? "green" : "red";

        comEl.textContent = data.compliance;
        comEl.className   = data.compliance === "GDPR Compliant" ? "green" : "red";

    } catch (err) {
        encEl.textContent = accEl.textContent = comEl.textContent = "Error";
        encEl.className   = accEl.className   = comEl.className   = "red";
    }
}

// --- Start ---
init();
