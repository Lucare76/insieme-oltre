// Run against a production build: BASE_URL=http://127.0.0.1:3044 node --test tests/seo-public-pages.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
const base = process.env.BASE_URL;
if (!base) throw new Error('Set BASE_URL to the running build');
const load = async (path) => {
 const response = await fetch(new URL(path, base));
 assert.equal(response.status, 200, path);
 return response.text();
};
const canonical = (html, path) => {
 assert.match(html, new RegExp('<link rel="canonical" href="https://www\\.insiemeoltreischia\\.it'+path+'"'));
};
const preview = (html) => {
 if (process.env.EXPECT_PREVIEW === 'true') assert.match(html, /<meta name="robots" content="noindex, nofollow"/);
 else assert.doesNotMatch(html, /<meta name="robots" content="[^\"]*noindex/);
};
test('Home is explicit about topic, keeps the slogan and links to the association', async () => {
 const html = await load('/');
 assert.match(html, /<title>Sindrome di Down e inclusione a Ischia \| Insieme Oltre<\/title>/);
 assert.match(html, /L’amore non si misura/);
 assert.match(html, /sindrome di Down \(trisomia 21\)/);
 assert.match(html, /href="\/chi-siamo"/);
 canonical(html, ''); preview(html);
});
test('About page has one h1, valid structured data and actionable links', async () => {
 const html = await load('/chi-siamo');
 assert.equal((html.match(/<h1\b/g) || []).length, 1);
 assert.match(html, /non un elenco di servizi già attivi/);
 for (const href of ['/#unisciti', '/partecipa', '/#storie']) assert.ok(html.includes(`href="${href}"`));
 const json = html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/);
 const data = JSON.parse(json[1]);
 assert.ok(data['@graph'].some(x => x['@type'] === 'AboutPage'));
 assert.ok(data['@graph'].some(x => x['@type'] === 'BreadcrumbList'));
 canonical(html, '/chi-siamo'); preview(html);
});
test('Dedicated and CMS story routes have descriptive, distinct metadata and an association link', async () => {
 const aurora = await load('/storie/aurora');
 const emanuele = await load('/storie/emanuele');
 assert.match(aurora, /<title>Aurora: la sua storia raccontata da mamma e papà \| Insieme Oltre<\/title>/);
 assert.match(emanuele, /<title>Emanuele: .+ \| Insieme Oltre<\/title>/);
 for (const [html, slug] of [[aurora, 'aurora'], [emanuele, 'emanuele']]) {
  assert.match(html, /href="\/chi-siamo"/); canonical(html, '/storie/'+slug); preview(html);
 }
});
test('Sitemap exposes the new public page once and excludes private areas and noindex notices', async () => {
 const xml = await load('/sitemap.xml');
 assert.equal((xml.match(/<loc>https:\/\/www\.insiemeoltreischia\.it\/chi-siamo<\/loc>/g) || []).length, 1);
 assert.doesNotMatch(xml, /<loc>[^<]*(?:\/admin|\/area-soci|\/informativa-contatti)/);
});
