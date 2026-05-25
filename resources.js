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
		.replace(`<!--app-data-->`, `<script>window.__INITIAL_POST_DATA__ = ${JSON.stringify(post)};</script>`);

	return html;
}

export class UncachedBlog extends tables.Post {
	static async get(target) {
		const post = await tables.Post.get(target);
		return {
			status: 200,
			headers: { 'Content-Type': 'text/html' },
			body: await renderPost(post),
		};
	}
}

class PageBuilder extends tables.Post {
	static async get(target) {
		const post = await tables.Post.get(target);
		return {
			content: await renderPost(post),
		};
	}
}

tables.BlogCache.sourcedFrom(PageBuilder);

export class CachedBlog extends tables.BlogCache {
	static async get(target) {
		const cached = await tables.BlogCache.get(target);
		return {
			status: 200,
			headers: { 'Content-Type': 'text/html' },
			body: cached.content,
		};
	}
}
