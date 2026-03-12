const API_BASE = "http://localhost:5000";

// Active chart instances (so we can destroy before re-rendering)
const charts = {};

// Current pagination state
let currentPage = 1;
let totalPages  = 1;

// --- Init ---

async function init() {
    await populateDietDropdown();
    await loadRecipes(1);
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

async function loadChart(type) {
    const res  = await fetch(`${API_BASE}/api/chart/${type}`);
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

    // Also reload recipes with the diet filter applied
    currentPage = 1;
    await loadRecipes(1, diet);
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
    const out   = document.getElementById("api-output");
    out.style.display = "block";
    out.textContent   = JSON.stringify(data, null, 2);
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

// --- Start ---
init();
