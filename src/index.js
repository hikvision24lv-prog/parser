import handleParse from './parse.js';

export default {
    async fetch(request, env, ctx) {
        const url = new URL(request.url);

        if (url.pathname === '/api/parse' && request.method === 'POST') {
            return await handleParse(request, env);
        }

        // Provide a default fallback if someone hits the root or another URL.
        // If "assets" routing is configured in wrangler.toml, it should ideally never hit this unless it's a 404.
        return new Response("Not found", { status: 404 });
    }
};
