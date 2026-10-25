// Same behaviour as web/Caddyfile: www redirect, immutable hashed assets, no SPA fallback for
// missing bundles, uncached service worker and SPA routing to index.html.
function withHeaders(res: Response, headers: Record<string, string>, status = res.status): Response {
  const out = new Response(res.body, {status, statusText: status === res.status ? res.statusText : '', headers: res.headers});
  for (const [k, v] of Object.entries(headers)) out.headers.set(k, v);
  return out;
}

export default {
  async fetch(request, env): Promise<Response> {
    const url = new URL(request.url);

    if (url.hostname === 'www.pethaii.com') {
      return Response.redirect(`https://pethaii.com${url.pathname}${url.search}`, 301);
    }

    if (url.pathname.startsWith('/assets/')) {
      const res = await env.ASSETS.fetch(request);
      if (res.status === 404) return new Response(null, {status: 404, headers: {'Cache-Control': 'no-store'}});
      return withHeaders(res, {'Cache-Control': 'public, max-age=31536000, immutable'});
    }

    if (url.pathname === '/sw.js') {
      return withHeaders(await env.ASSETS.fetch(request), {'Cache-Control': 'no-cache', 'Service-Worker-Allowed': '/'});
    }

    let res = await env.ASSETS.fetch(request);
    if (res.status === 404 && (request.method === 'GET' || request.method === 'HEAD')) {
      res = await env.ASSETS.fetch(new Request(new URL('/', url), request));
    }
    return withHeaders(res, {'Cache-Control': 'no-cache'});
  },
} satisfies ExportedHandler<Env>;
