import { suite, test, before, after } from 'node:test';
import { strictEqual, ok } from 'node:assert/strict';
import { setupHarperWithFixture, teardownHarper, type ContextWithHarper } from '@harperfast/integration-testing';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { existsSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';

const __dirname = dirname(fileURLToPath(import.meta.url));
const FIXTURE_PATH = resolve(__dirname, '..');

// The `harper` package's `exports` map only exposes ".", so the harness's
// auto-resolution of 'harper/dist/bin/harper.js' fails with ERR_PACKAGE_PATH_NOT_EXPORTED.
// Resolve the CLI from the (exported) main entry and pass it explicitly.
const require = createRequire(import.meta.url);
const harperBinPath = resolve(dirname(require.resolve('harper')), 'bin/harper.js');

function authFetch(
	ctx: ContextWithHarper,
	path: string,
	init: RequestInit & { headers?: Record<string, string> } = {}
) {
	const { headers = {}, ...rest } = init;
	const creds = Buffer.from(`${ctx.harper.admin.username}:${ctx.harper.admin.password}`).toString('base64');
	return fetch(`${ctx.harper.httpURL}${path}`, { ...rest, headers: { Authorization: `Basic ${creds}`, ...headers } });
}

void suite('Vue SSR example', (ctx: ContextWithHarper) => {
	before(async () => {
		// The SSR component imports ./dist/server/entry-server.js and serves
		// ./dist/client/index.html, so the Vite build must exist before the
		// fixture (the whole repo dir) is copied into the Harper install.
		if (!existsSync(resolve(FIXTURE_PATH, 'dist/server/entry-server.js'))) {
			execFileSync('npm', ['run', 'build'], { cwd: FIXTURE_PATH, stdio: 'inherit' });
		}
		await setupHarperWithFixture(ctx, FIXTURE_PATH, { harperBinPath });
	});

	after(async () => {
		await teardownHarper(ctx);
	});

	void test('Harper starts and the Post REST table is seeded', async () => {
		// resources.js seeds Post/0 on startup.
		const res = await authFetch(ctx, '/Post/0');
		strictEqual(res.status, 200);
		const body = (await res.json()) as { id: string; title: string; comments: string[] };
		strictEqual(body.id, '0');
		ok(body.title, 'expected a seeded title');
		ok(Array.isArray(body.comments), 'expected a comments array');
	});

	void test('GET /UncachedBlog/0 server-side renders the blog as HTML', async () => {
		const res = await authFetch(ctx, '/UncachedBlog/0');
		strictEqual(res.status, 200);
		ok(res.headers.get('Content-Type')?.startsWith('text/html'), 'expected text/html content type');
		const html = await res.text();
		// SSR output should contain the rendered post content + the hydration data script.
		ok(html.includes('<!DOCTYPE html>') || html.includes('<html'), 'expected a full HTML document');
		ok(html.includes('__INITIAL_POST_DATA__'), 'expected SSR hydration data to be injected');
	});

	void test('GET /CachedBlog/0 server-side renders the blog as HTML', async () => {
		const res = await authFetch(ctx, '/CachedBlog/0');
		strictEqual(res.status, 200);
		ok(res.headers.get('Content-Type')?.startsWith('text/html'), 'expected text/html content type');
		const html = await res.text();
		ok(html.includes('__INITIAL_POST_DATA__'), 'expected SSR hydration data in cached render');
	});

	void test('CachedBlog returns 304 on a conditional re-request (cache hit)', async () => {
		const first = await authFetch(ctx, '/CachedBlog/0');
		strictEqual(first.status, 200);
		const etag = first.headers.get('ETag');
		const lastModified = first.headers.get('Last-Modified');
		ok(etag || lastModified, 'expected a cache validator header (ETag or Last-Modified)');

		const conditionalHeaders: Record<string, string> = {};
		if (etag) conditionalHeaders['If-None-Match'] = etag;
		if (lastModified) conditionalHeaders['If-Modified-Since'] = lastModified;

		const second = await authFetch(ctx, '/CachedBlog/0', { headers: conditionalHeaders });
		strictEqual(second.status, 304);
	});

	void test('Updating the Post invalidates the cache, then re-caches', async () => {
		// Prime the cache and grab validators.
		const primed = await authFetch(ctx, '/CachedBlog/0');
		strictEqual(primed.status, 200);
		const etag = primed.headers.get('ETag');
		const lastModified = primed.headers.get('Last-Modified');

		const conditionalHeaders: Record<string, string> = {};
		if (etag) conditionalHeaders['If-None-Match'] = etag;
		if (lastModified) conditionalHeaders['If-Modified-Since'] = lastModified;

		// Confirm it's currently a cache hit.
		const hit = await authFetch(ctx, '/CachedBlog/0', { headers: conditionalHeaders });
		strictEqual(hit.status, 304);

		// Mutate the source Post via REST PATCH.
		const current = (await (await authFetch(ctx, '/Post/0')).json()) as { comments: string[] };
		const patch = await authFetch(ctx, '/Post/0', {
			method: 'PATCH',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ comments: current.comments.concat(`Test comment ${Math.random()}`) }),
		});
		ok(patch.ok, `expected PATCH to succeed, got ${patch.status}`);

		// The same conditional request should now miss the cache (source changed) -> 200.
		const afterUpdate = await authFetch(ctx, '/CachedBlog/0', { headers: conditionalHeaders });
		strictEqual(afterUpdate.status, 200);

		// New validators should once again yield a 304 cache hit.
		const newEtag = afterUpdate.headers.get('ETag');
		const newLastModified = afterUpdate.headers.get('Last-Modified');
		const newConditional: Record<string, string> = {};
		if (newEtag) newConditional['If-None-Match'] = newEtag;
		if (newLastModified) newConditional['If-Modified-Since'] = newLastModified;

		const reCached = await authFetch(ctx, '/CachedBlog/0', { headers: newConditional });
		strictEqual(reCached.status, 304);
	});
});
