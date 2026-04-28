import puppeteer from "@cloudflare/puppeteer";

const SELECTORS = {
    // ВНИМАНИЕ: Если salidzini.lv изменит верстку, обнови эти классы
    itemCard: ".item_details",         
    sellerName: ".shop_name",          
    price: ".item_price"               
};

export async function onRequest(context) {
    if (context.request.method !== "POST") {
        return new Response("Method not allowed", { status: 405 });
    }

    const { env, request } = context;
    const logs = [];
    const log = (msg) => logs.push(`[${new Date().toISOString().split('T')[1].slice(0,8)}] ${msg}`);

    try {
        log("API Request received in Pages Function.");
        const body = await request.json();
        const { query, minPrice } = body;

        if (!query) {
            return new Response(JSON.stringify({ error: "Missing query", logs }), { status: 400 });
        }

        const limitPrice = parseFloat(minPrice) || 0;
        
        // Понимает как прямые ссылки, так и текстовые запросы
        const searchUrl = query.startsWith('http') ? query : `https://www.salidzini.lv/rus/cena?q=${encodeURIComponent(query)}`;
        log(`Navigating to URL: ${searchUrl}`);

        if (!env.MYBROWSER) {
            throw new Error("CRITICAL: 'MYBROWSER' binding is missing. Please ensure Cloudflare Pages read the wrangler.toml file.");
        }

        log("Launching Headless Chrome (Puppeteer)...");
        let browser;
        try {
            log("Awaiting CF Browser Run allocation...");
            browser = await puppeteer.launch(env.MYBROWSER, {
                keep_alive: 10000 
            });
            log("Browser allocated successfully.");
        } catch (launchErr) {
            log(`CRITICAL PUPPETEER ERROR: ${launchErr.message}`);
            if (launchErr.message.includes("Browser.getVersion timed out") || launchErr.message.includes("timeout") || launchErr.message.includes("429")) {
                throw new Error("Не удалось запустить браузер. Если ошибка 429 (Browser time limit exceeded) - исчерпан бесплатный лимит 10 минут в день (Browser Run). Восстановится на следующий день. Либо возник таймаут запуска.");
            }
            throw launchErr;
        }
        
        let page;
        try {
            log("Opening new page...");
            page = await browser.newPage();
            
            await page.setUserAgent("Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36");
            
            log("Loading page DOM...");
            await page.goto(searchUrl, { waitUntil: "domcontentloaded", timeout: 15000 });
        } catch(pageErr) {
            log(`CRITICAL PAGE LOAD ERROR: ${pageErr.message}`);
            if (browser) await browser.close();
            throw new Error(`Не удалось загрузить страницу: ${pageErr.message}`);
        }

        log("Waiting 4.5s for Cloudflare JS challenge bypass...");
        await new Promise(resolve => setTimeout(resolve, 4500));

        let results = [];
        log("Executing parsing script inside browser...");
        try {
            results = await page.evaluate((sel, limit) => {
                const cards = Array.from(document.querySelectorAll('.item-details, .item_type_2, ' + sel.itemCard));
                let items = [];

                cards.forEach(card => {
                    const sellerEl = card.querySelector('.shop-name, ' + sel.sellerName) || card.querySelector('a.shop_link');
                    const priceEl = card.querySelector('.price, .item_price, ' + sel.price);
                    
                    if (sellerEl && priceEl) {
                        const name = sellerEl.innerText.trim() || sellerEl.title || "Unknown Shop";
                        const priceText = priceEl.innerText.replace(/[^\d.,]/g, "").replace(',', '.');
                        const parsedPrice = parseFloat(priceText);

                        if (!isNaN(parsedPrice) && parsedPrice >= limit) {
                            items.push({ seller_name: name, price: parsedPrice });
                        }
                    }
                });

                if (items.length === 0) {
                     const rows = Array.from(document.querySelectorAll('tr'));
                     rows.forEach(tr => {
                         if (tr.innerText.includes('€')) {
                             const tds = tr.querySelectorAll('td');
                             if(tds.length >= 3) {
                                 const name = tr.querySelector('img') ? tr.querySelector('img').alt : (tds[0]?.innerText || "Shop");
                                 const priceMatch = tr.innerText.match(/(\d+[.,]\d{2})/);
                                 if (priceMatch) {
                                      const parsedPrice = parseFloat(priceMatch[1].replace(',', '.'));
                                      if (!isNaN(parsedPrice) && parsedPrice >= limit) {
                                          items.push({ seller_name: name, price: parsedPrice });
                                      }
                                 }
                             }
                         }
                     })
                }

                items.sort((a, b) => a.price - b.price);
                return items.slice(0, 5); 
            }, SELECTORS, limitPrice);
        } catch(evalErr) {
            log(`CRITICAL EVALUATION ERROR: ${evalErr.message}`);
            if (browser) await browser.close();
            throw new Error(`Ошибка парсинга DOM: ${evalErr.message}`);
        }

        log(`Found ${results.length} valid items above €${limitPrice}`);
        await browser.close();
        log("Browser closed successfully.");

        let queryId = null;
        let resultsLog = [];
        let position = 1;

        if (results.length > 0) {
            results.forEach(item => {
                resultsLog.push({ ...item, position });
                position++;
            });
        }

        if (env.DB) {
            log("Saving results to D1 Database...");
            try {
                const d1 = env.DB;
                const insertQuery = await d1.prepare(
                    "INSERT INTO queries (product_query, min_purchase_price) VALUES (?, ?) RETURNING id"
                ).bind(query, limitPrice).first();
                queryId = insertQuery.id;
                
                if (results.length > 0) {
                    const statements = resultsLog.map(item => {
                        return d1.prepare(
                            "INSERT INTO parse_results (query_id, seller_name, price, position) VALUES (?, ?, ?, ?)"
                        ).bind(queryId, item.seller_name, item.price, item.position);
                    });
                    await d1.batch(statements);
                }
                log("DB Save complete.");
            } catch (dbErr) {
                log(`DB Action Failed (skipped): ${dbErr.message}`);
            }
        } else {
            log("NOTICE: DB binding not found. Skipping database save.");
        }

        return new Response(JSON.stringify({ 
            success: true, 
            queryId, 
            items: resultsLog,
            logs 
        }), { headers: { "Content-Type": "application/json" } });

    } catch (err) {
        log(`ERROR: ${err.message}`);
        return new Response(JSON.stringify({ error: err.message, logs }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
}
