import puppeteer from "@cloudflare/puppeteer";

const SELECTORS = {
    itemCard: ".item_details",         
    sellerName: ".shop_name",          
    price: ".item_price"               
};

export async function handleParse(request, env) {
    const logs = [];
    const log = (msg) => logs.push(`[${new Date().toISOString().split('T')[1].slice(0,8)}] ${msg}`);

    try {
        log("API Request received in Worker.");
        const body = await request.json();
        const { query, minPrice } = body;

        if (!query) {
            return new Response(JSON.stringify({ error: "Missing query", logs }), { status: 400 });
        }

        const limitPrice = parseFloat(minPrice) || 0;
        const searchUrl = query.startsWith('http') ? query : `https://www.salidzini.lv/rus/cena?q=${encodeURIComponent(query)}`;
        log(`Navigating to URL: ${searchUrl}`);

        if (!env.MYBROWSER) {
            throw new Error("ERROR: MYBROWSER binding is missing. Check your wrangler.toml and account limits.");
        }

        log("Launching Headless Chrome (Browser Run)...");
        let browser;
        try {
            browser = await puppeteer.launch(env.MYBROWSER);
            log("Browser launched.");
        } catch (launchErr) {
            log(`LAUNCH ERROR: ${launchErr.message}`);
            if (launchErr.message.includes("429")) {
                throw new Error("Cloudflare 429: Лимит 10 минут в день исчерпан. Попробуйте завтра или привяжите карту.");
            }
            throw launchErr;
        }
        
        const page = await browser.newPage();
        await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/120.0.0.0");
        
        log("Loading search results...");
        await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 20000 });
        
        // Маленькая пауза для подгрузки динамики
        await new Promise(r => setTimeout(r, 3000));

        const results = await page.evaluate((sel, limit) => {
            const items = [];
            const cards = document.querySelectorAll('.item_details, .item-details');
            cards.forEach(card => {
                const nameEl = card.querySelector('.shop_name, .shop-name');
                const priceEl = card.querySelector('.item_price, .price');
                if (nameEl && priceEl) {
                    const price = parseFloat(priceEl.innerText.replace(/[^\d.,]/g, "").replace(',', '.'));
                    if (price >= limit) {
                        items.push({ seller_name: nameEl.innerText.trim(), price });
                    }
                }
            });
            return items.sort((a,b) => a.price - b.price).slice(0, 5);
        }, SELECTORS, limitPrice);

        await browser.close();
        log(`Found ${results.length} items.`);

        // Сохранение в базу
        if (env.DB) {
            log("Saving to D1...");
            const { id } = await env.DB.prepare("INSERT INTO queries (product_query, min_purchase_price) VALUES (?, ?) RETURNING id")
                .bind(query, limitPrice).first();
            
            for (let i = 0; i < results.length; i++) {
                await env.DB.prepare("INSERT INTO parse_results (query_id, seller_name, price, position) VALUES (?, ?, ?, ?)")
                    .bind(id, results[i].seller_name, results[i].price, i + 1).run();
            }
        }

        return new Response(JSON.stringify({ success: true, items: results, logs }), {
            headers: { "Content-Type": "application/json" }
        });

    } catch (err) {
        return new Response(JSON.stringify({ error: err.message, logs }), { status: 500 });
    }
}
