import { test } from 'node:test';
import assert from 'node:assert/strict';
import { fetchPublicPage } from '../supabase/functions/website-seo-audit/redirects.mjs';

const validateUrl = async value => {
  const url = new URL(value);
  if (url.hostname === 'localhost' || url.protocol !== 'https:') throw Error('Blocked destination');
  return url;
};

test('follows normal redirect codes and resolves relative locations', async () => {
  for (const status of [301, 302, 303, 307, 308]) {
    const calls = [];
    const result = await fetchPublicPage(new URL('https://example.com/'), {
      validateUrl,
      fetchPage: async (url, options) => {
        calls.push(url);
        assert.equal(options.redirect, 'manual');
        return calls.length === 1 ? new Response(null, { status, headers: { location: '/shop/' } }) : new Response('<html></html>');
      },
    });
    assert.deepEqual(calls, ['https://example.com/', 'https://example.com/shop/']);
    assert.equal(result.url.href, 'https://example.com/shop/');
  }
});

test('validates a cross-domain redirect before requesting it', async () => {
  const calls = [];
  await assert.rejects(fetchPublicPage(new URL('https://example.com/'), {
    validateUrl,
    fetchPage: async url => { calls.push(url); return new Response(null, {status:301,headers:{location:'https://localhost/private'}}); },
  }), /Blocked destination/);
  assert.equal(calls.length, 1);
});

test('rejects loops, missing locations and excessive chains', async () => {
  for (const [location, message] of [['/', /loop/], [null, /missing/], ['/next', /limit/]]) {
    await assert.rejects(fetchPublicPage(new URL('https://example.com/'), {
      validateUrl, maxRedirects: 0,
      fetchPage: async () => new Response(null, {status:302,headers:location?{location}:{}}),
    }), location==='/' ? /limit/ : message);
  }
  await assert.rejects(fetchPublicPage(new URL('https://example.com/'), {
    validateUrl, fetchPage:async()=>new Response(null,{status:301,headers:{location:'/'}}),
  }), /loop/);
});

test('preserves final HTTP errors and the request abort signal', async () => {
  const signal = new AbortController().signal;
  const {response} = await fetchPublicPage(new URL('https://example.com/'), {
    validateUrl, signal, fetchPage:async (_,options)=>{assert.equal(options.signal,signal);return new Response(null,{status:404});},
  });
  assert.equal(response.status,404);
});
