// Worker du prototype. Les fichiers statiques des Workers ignorent l'en-tête Range,
// alors que Safari exige des réponses 206 pour lire l'audio. En production, R2 gère
// les plages lui-même : ce Worker l'imite, uniquement pour /media/ (voir wrangler.jsonc).

export default {
  async fetch(request, env) {
    const response = await env.ASSETS.fetch(request);
    const range = request.headers.get('range');
    if (response.status !== 200) return response;

    const headers = new Headers(response.headers);
    headers.set('Accept-Ranges', 'bytes');
    if (!range) return new Response(response.body, { headers });

    // ponytail: tout le fichier est lu en mémoire à chaque plage ; tient pour 6 Mo, rien de plus.
    const body = await response.arrayBuffer();
    const size = body.byteLength;
    const match = /^bytes=(\d*)-(\d*)$/.exec(range);
    let start = NaN;
    let end = size - 1;
    if (match && match[1] !== '') {
      start = Number(match[1]);
      if (match[2] !== '') end = Math.min(Number(match[2]), size - 1);
    } else if (match && match[2] !== '') {
      start = Math.max(size - Number(match[2]), 0); // bytes=-N : les N derniers octets
    }
    if (!(start <= end)) {
      return new Response(null, { status: 416, headers: { 'Content-Range': `bytes */${size}` } });
    }

    headers.set('Content-Range', `bytes ${start}-${end}/${size}`);
    headers.set('Content-Length', String(end - start + 1));
    return new Response(body.slice(start, end + 1), { status: 206, headers });
  },
};
