const REDIRECTS = new Set([301, 302, 303, 307, 308]);

// Keep each redirect manual so every new destination passes publicUrl's DNS checks.
export async function fetchPublicPage(start, { validateUrl, fetchPage = fetch, signal, maxRedirects = 5 }) {
  let url = await validateUrl(start.toString());
  const visited = new Set();
  for (let hop = 0; ; hop++) {
    url.hash = '';
    if (visited.has(url.href)) throw Error('Website redirect loop detected.');
    visited.add(url.href);
    const response = await fetchPage(url.href, {
      signal, redirect: 'manual', headers: { 'User-Agent': 'MKTVisibility-SEOAudit/1.0' },
    });
    if (!REDIRECTS.has(response.status)) return { response, url };
    const location = response.headers.get('location');
    await response.body?.cancel();
    if (!location) throw Error('Website redirect is missing its destination.');
    if (hop >= maxRedirects) throw Error('Website exceeded the audit redirect limit.');
    url = await validateUrl(new URL(location, url).href);
  }
}
