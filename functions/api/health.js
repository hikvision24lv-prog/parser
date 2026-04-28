export async function onRequestGet({ request, env }) {
    let dbStatus = false;
    let browserStatus = false;
    let msg = "";

    try {
        if (env.DB) {
            // Test DB
            await env.DB.prepare("SELECT 1").first();
            dbStatus = true;
        } else {
            msg += "D1 Binding 'DB' is missing. ";
        }

        if (env.MYBROWSER) {
            browserStatus = true;
        } else {
            msg += "Browser Binding 'MYBROWSER' is missing. ";
        }

        return new Response(JSON.stringify({ 
            success: true, 
            dbStatus, 
            browserStatus,
            message: msg || "All clear"
        }), { headers: { "Content-Type": "application/json" } });

    } catch (err) {
         return new Response(JSON.stringify({ 
            success: false, 
            error: err.message 
        }), { status: 500, headers: { "Content-Type": "application/json" } });
    }
}
