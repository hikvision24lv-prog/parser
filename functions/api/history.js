export async function onRequestGet({ request, env }) {
    try {
        if (!env.DB) {
            return new Response(JSON.stringify({ success: true, history: [], note: "DB binding 'DB' not configured yet." }), { headers: { "Content-Type": "application/json" } });
        }
        
        const d1 = env.DB;
        const { results: queries } = await d1.prepare("SELECT * FROM queries ORDER BY created_at DESC LIMIT 20").all();
        
        const history = [];
        for (let q of queries) {
            const { results } = await d1.prepare("SELECT * FROM parse_results WHERE query_id = ? ORDER BY position ASC").bind(q.id).all();
            history.push({
                ...q,
                results
            });
        }
        
        return new Response(JSON.stringify({ success: true, history }), { headers: { "Content-Type": "application/json" } });
    } catch (err) {
         return new Response(JSON.stringify({ error: err.message }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
}
