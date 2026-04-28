import { handleParse } from './parse.js';

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        // 1. Обработка API
        if (url.pathname === "/api/parse" && request.method === "POST") {
            return await handleParse(request, env);
        }

        // 2. Датчики здоровья (Health Check)
        if (url.pathname === "/api/health") {
            return new Response(JSON.stringify({
                browserStatus: !!env.MYBROWSER,
                dbStatus: !!env.DB
            }), { headers: { "Content-Type": "application/json" } });
        }

        // 3. История запросов
        if (url.pathname === "/api/history") {
            if (!env.DB) return new Response(JSON.stringify({ history: [] }), { status: 200 });
            try {
                const { results } = await env.DB.prepare(`
                    SELECT q.*, 
                    (SELECT json_group_array(json_object('seller_name', r.seller_name, 'price', r.price)) 
                     FROM parse_results r WHERE r.query_id = q.id) as results_v
                    FROM queries q ORDER BY q.created_at DESC LIMIT 10
                `).all();
                
                const history = results.map(r => ({
                    ...r,
                    results: JSON.parse(r.results_v || "[]")
                }));
                return new Response(JSON.stringify({ history }), { headers: { "Content-Type": "application/json" } });
            } catch (e) {
                return new Response(JSON.stringify({ error: e.message, history: [] }), { status: 200 });
            }
        }

        // 4. Если это не API, отдаем статику
        return env.ASSETS.fetch(request);
    }
};
