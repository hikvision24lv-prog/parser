// URL Cloudflare Pages API
const WORKER_URL = '';

// DOM Elements
const form = document.getElementById('parseForm');
const queryInput = document.getElementById('queryInput');
const minPriceInput = document.getElementById('minPriceInput');
const parseBtn = document.getElementById('parseBtn');
const btnText = document.getElementById('btnText');
const btnLoader = document.getElementById('btnLoader');
const statusMessage = document.getElementById('statusMessage');
const errorMessage = document.getElementById('errorMessage');

const currentResultsSection = document.getElementById('currentResultsSection');
const resultsTableBody = document.getElementById('resultsTableBody');

const historyTableBody = document.getElementById('historyTableBody');
const refreshHistoryBtn = document.getElementById('refreshHistoryBtn');
const emptyHistory = document.getElementById('emptyHistory');

const runtimeStatus = document.getElementById('runtimeStatus');
const dbStatus = document.getElementById('dbStatus');

// System Health Check
async function checkSystemHealth() {
    try {
        const res = await fetch(`${WORKER_URL}/api/health`);
        const data = await res.json();
        
        if (data.browserStatus) {
            runtimeStatus.innerHTML = '<span class="w-2 h-2 bg-green-500 rounded-full mr-2"></span> PUPPETEER: READY';
        } else {
            runtimeStatus.innerHTML = '<span class="w-2 h-2 bg-red-500 rounded-full mr-2"></span> PUPPETEER: NOT_BOUND (Check Settings)';
        }

        if (data.dbStatus) {
            dbStatus.innerHTML = '<span class="w-2 h-2 bg-[#F27D26] rounded-full mr-2"></span> D1_DATABASE: CONNECTED';
        } else {
            dbStatus.innerHTML = '<span class="w-2 h-2 bg-red-500 rounded-full mr-2"></span> D1_DATABASE: NOT_BOUND (Check Settings)';
        }
    } catch (err) {
        runtimeStatus.innerHTML = '<span class="w-2 h-2 bg-red-500 rounded-full mr-2"></span> API OFFLINE';
        dbStatus.innerHTML = '<span class="w-2 h-2 bg-red-500 rounded-full mr-2"></span> D1 OFFLINE';
    }
}
checkSystemHealth();

function setLoading(isLoading) {
    if (isLoading) {
        parseBtn.disabled = true;
        btnText.textContent = "EXEC_WAIT...";
        btnLoader.classList.remove('hidden');
        statusMessage.classList.remove('hidden');
        statusMessage.innerText = `[${new Date().toLocaleTimeString()}] WORKER_INIT: API Request sent...`;
        errorMessage.classList.add('hidden');
        currentResultsSection.classList.add('hidden');
    } else {
        parseBtn.disabled = false;
        btnText.textContent = "Execute_Parsing_Job";
        btnLoader.classList.add('hidden');
    }
}

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    const query = queryInput.value.trim();
    const minPrice = parseFloat(minPriceInput.value);

    setLoading(true);

    try {
        const response = await fetch(`${WORKER_URL}/api/parse`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ query, minPrice })
        });
        
        const rawText = await response.text();
        let data;
        
        try {
            data = JSON.parse(rawText);
        } catch (e) {
            throw new Error(`Cloudflare Server Crash (Code ${response.status}). Details: ${rawText.substring(0, 150)}`);
        }

        if (data.logs && Array.isArray(data.logs)) {
            statusMessage.innerText = data.logs.join('\n');
        }

        if (!response.ok) {
            throw new Error(data.error || 'Server error');
        }

        renderCurrentResults(data.items);
        loadHistory(); 
    } catch (err) {
        errorMessage.innerText = `[${new Date().toLocaleTimeString()}] ERROR: ${err.message}`;
        errorMessage.classList.remove('hidden');
    } finally {
        setLoading(false);
    }
});

function renderCurrentResults(items) {
    currentResultsSection.classList.remove('hidden');
    resultsTableBody.innerHTML = '';
    
    if (!items || items.length === 0) {
        resultsTableBody.innerHTML = '<tr><td colspan="3" class="p-3 text-center">No items found matching criteria.</td></tr>';
        return;
    }

    items.forEach((item, index) => {
        const tr = document.createElement('tr');
        tr.className = `border-b border-[#141414] ${index === 0 ? 'bg-green-50' : 'bg-white hover:bg-gray-50'}`;
        tr.innerHTML = `
            <td class="p-3 font-mono text-[11px]">0${item.position}</td>
            <td class="p-3 font-mono text-[11px] font-bold ${index === 0 ? 'underline text-green-700' : ''}">${escapeHtml(item.seller_name)}</td>
            <td class="p-3 font-mono text-[11px]">${item.price.toFixed(2)} €</td>
        `;
        resultsTableBody.appendChild(tr);
    });
}

async function loadHistory() {
    try {
        const response = await fetch(`${WORKER_URL}/api/history`);
        if (!response.ok) {
           return;
        }
        const data = await response.json();

        historyTableBody.innerHTML = '';
        if (!data.history || data.history.length === 0) {
            emptyHistory.classList.remove('hidden');
            return;
        }

        emptyHistory.classList.add('hidden');
        data.history.forEach(item => {
            const tr = document.createElement('tr');
            tr.className = 'hover:bg-gray-100 transition';
            const dateStr = item.created_at.split('T')[0];
            const topSeller = item.results && item.results.length > 0 ? `${escapeHtml(item.results[0].seller_name)} (${item.results[0].price.toFixed(2)}€)` : 'None';
            
            tr.innerHTML = `
                <td class="p-3">${dateStr}</td>
                <td class="p-3">${escapeHtml(item.product_query)}</td>
                <td class="p-3">${topSeller}</td>
            `;
            historyTableBody.appendChild(tr);
        });
    } catch (err) {
        console.error("Failed to load history", err);
    }
}

function escapeHtml(unsafe) {
    return unsafe
         .replace(/&/g, "&amp;")
         .replace(/</g, "&lt;")
         .replace(/>/g, "&gt;")
         .replace(/"/g, "&quot;")
         .replace(/'/g, "&#039;");
}

refreshHistoryBtn.addEventListener('click', loadHistory);
loadHistory();
