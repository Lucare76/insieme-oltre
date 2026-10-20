// Run after compiling route.ts to CONTACT_TEST_BUILD (see CONTACT_FORM.md).
import { test, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
const root = process.env.CONTACT_TEST_BUILD;
if (!root) throw new Error('Set CONTACT_TEST_BUILD to the temporary tsc output');
const { POST } = (await import(pathToFileURL(path.join(root, 'app/api/contact/route.js')))).default;
const { contactNotice: privacyPolicy } = (await import(pathToFileURL(path.join(root, 'lib/legal.js')))).default;
const { validateContact, contactRoles } = (await import(pathToFileURL(path.join(root, 'lib/contact.js')))).default;
const originalFetch = global.fetch;
const originalPublished = privacyPolicy.published;
const originalEnv = { VERCEL: process.env.VERCEL, BREVO_API_KEY: process.env.BREVO_API_KEY, CONTACT_FROM_EMAIL: process.env.CONTACT_FROM_EMAIL, CONTACT_TO_EMAIL: process.env.CONTACT_TO_EMAIL };
const valid = { name: 'Persona Test', email: 'test@example.org', phone: '', role: 'Una famiglia', message: 'Richiesta di informazioni.', privacy: true, website: '' };
let ip = 0, calls = [];
const req = (body = valid, headers = {}) => new Request('https://example.org/api/contact', {
  method: 'POST', headers: { 'content-type': 'application/json', origin: 'https://example.org', 'x-vercel-forwarded-for': String(++ip), ...headers }, body: typeof body === 'string' ? body : JSON.stringify(body),
});
beforeEach(() => {
  privacyPolicy.published = false;
  process.env.VERCEL = '1';
  process.env.BREVO_API_KEY = 'test-placeholder';
  process.env.CONTACT_FROM_EMAIL = 'sender@example.org';
  delete process.env.CONTACT_TO_EMAIL;
  calls = [];
  global.fetch = async (...args) => { calls.push(args); return new Response('{}', { status: 201 }); };
});
after(() => {
  privacyPolicy.published = originalPublished;
  global.fetch = originalFetch;
  for (const [key, value] of Object.entries(originalEnv)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});
test('privacy unpublished blocks even a valid request before provider call', async () => {
  assert.equal((await POST(req())).status, 503); assert.equal(calls.length, 0);
});
test('all allowed roles validate, malformed and required fields reject', () => {
  for (const role of contactRoles) assert.ok(validateContact({ ...valid, role }));
  for (const changes of [{ name: '' }, { name: 'a\nb' }, { email: 'bad' }, { phone: 'abc' }, { role: 'unknown' }, { privacy: 'true' }, { privacy: false }, { message: 'a'.repeat(5001) }, { name: 'a'.repeat(121) }]) assert.equal(validateContact({ ...valid, ...changes }), null);
  assert.equal(validateContact(null), null);
  assert.equal(validateContact([]), null);
});
test('invalid request never calls provider', async () => {
  assert.equal((await POST(req({ ...valid, privacy: false }))).status, 400); assert.equal(calls.length, 0);
});
test('honeypot responds neutrally without sending', async () => {
  assert.equal((await POST(req({ ...valid, website: 'spam' }))).status, 200); assert.equal(calls.length, 0);
});
test('rejects foreign origin, bad content type, malformed JSON, oversized streamed body', async () => {
  assert.equal((await POST(req(valid, { origin: 'https://other.org' }))).status, 403);
  assert.equal((await POST(req(valid, { 'content-type': 'text/plain' }))).status, 415);
  assert.equal((await POST(req('{'))).status, 400);
  assert.equal((await POST(req('x'.repeat(24001)))).status, 413);
  assert.equal(calls.length, 0);
});
test('sixth attempt in one bucket returns 429 with Retry-After', async () => {
  const headers = { 'x-vercel-forwarded-for': 'rate-test' };
  for (let i = 0; i < 5; i++) assert.equal((await POST(req(valid, headers))).status, 503);
  const response = await POST(req(valid, headers));
  assert.equal(response.status, 429); assert.ok(Number(response.headers.get('retry-after')) > 0); assert.equal(calls.length, 0);
});
test('success with simulated provider: fixed sender and recipient, visitor Reply-To, plain text', async () => {
  privacyPolicy.published = true;
  assert.equal((await POST(req())).status, 200); assert.equal(calls.length, 1);
  const [url, options] = calls[0];
  assert.equal(url, 'https://api.brevo.com/v3/smtp/email');
  const body = JSON.parse(options.body);
  assert.equal(body.sender.email, 'sender@example.org');
  assert.equal(body.to[0].email, 'info@insiemeoltreischia.it');
  assert.equal(body.replyTo.email, valid.email); assert.ok(body.textContent.includes(valid.message));
  assert.equal(body.htmlContent, undefined); assert.ok(options.signal);
});
test('missing credentials, provider rejection and network timeout return 503', async () => {
  privacyPolicy.published = true;
  delete process.env.BREVO_API_KEY;
  assert.equal((await POST(req())).status, 503); assert.equal(calls.length, 0);
  process.env.BREVO_API_KEY = 'test-placeholder';
  global.fetch = async () => new Response('{}', { status: 401 });
  assert.equal((await POST(req())).status, 503);
  global.fetch = async () => { throw new DOMException('Timed out', 'TimeoutError'); };
  assert.equal((await POST(req())).status, 503);
});

test('optional message accepts empty, whitespace and missing values and sends contact details', async () => {
  privacyPolicy.published = true;
  for (const message of ['', '   ', undefined]) {
    assert.equal(validateContact({ ...valid, message })?.message, '');
    assert.equal((await POST(req({ ...valid, message }))).status, 200);
    const body = JSON.parse(calls.at(-1)[1].body);
    assert.ok(body.textContent.includes(valid.email));
    assert.ok(body.textContent.includes('Nessun messaggio aggiunto.'));
  }
});
