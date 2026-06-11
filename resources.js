import { tables } from 'harper';
import fs from 'node:fs';
import path from 'node:path';

if (!(await tables.Post.get('0'))) {
	await tables.Post.put({
		id: '0',
		title: 'Hello, World!',
		body: 'This is a test post. Please leave a comment! 📝',
		comments: [],
	});
}

const template = fs.readFileSync(path.join(import.meta.dirname, 'dist/client/index.html'), 'utf-8');
const serverEntry = await import('./dist/server/entry-server.js');

async function renderPost(post) {
	const rendered = await serverEntry.render({ initialPostData: post });

	const html = template
		.replace(`<!--app-head-->`, rendered.head ?? '')
		.replace(`<!--app-html-->`, rendered.html ?? '')
		.replace(`<!--app-data-->`, `<script>window.__INITIAL_POST_DATA__ = ${JSON.stringify(post).replace(/</g, '\\u003c').replace(/>/g, '\\u003e')};</script>`);

	return html;
}

export class UncachedBlog extends tables.Post {
	async get(query) {
		const post = await super.get(query);
		if (!post) return { status: 404 };
		return {
			status: 200,
			headers: { 'Content-Type': 'text/html' },
			body: await renderPost(post),
		};
	}
}

// Caching source for BlogCache. In v5 a caching source resolves per-id through
// an instance `get`, so the cache instantiates this resource for the requested
// id and calls `get()`; `super.get()` returns the underlying Post record.
class PageBuilder extends tables.Post {
	async get(query) {
		const post = await super.get(query);
		if (!post) return null;
		return {
			content: await renderPost(post),
		};
	}
}

tables.BlogCache.sourcedFrom(PageBuilder);

export class CachedBlog extends tables.BlogCache {
	async get(query) {
		const cached = await super.get(query);
		if (!cached) return { status: 404 };
		// Return { contentType, data } rather than a full { status, headers, body }
		// response: when the response carries a `headers` property Harper treats it
		// as a complete Response and skips its conditional-request handling, so no
		// ETag/Last-Modified is emitted and 304s never happen. The `contentType`
		// shape sets Content-Type while leaving caching to the BlogCache record.
		return {
			contentType: 'text/html',
			data: cached.content,
		};
	}
}
