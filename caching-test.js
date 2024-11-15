import assert from 'node:assert';

const blog_url = new URL('http://localhost:9926/CachedBlog/0');
const post_url = new URL('http://localhost:9926/Post/0');

// Step 1. Request the Page so it gets SSR'd
const r1 = await fetch(blog_url);

// Retrieve the cache headers
let etag = r1.headers.get('ETag');
let last_modified = r1.headers.get('Last-Modified');

// Step 2. Load the Page a second time using the respective cache headers
const r2 = await fetch(blog_url, {
	headers: {
		'If-None-Match': etag,
		'If-Modified-Since': last_modified,
	},
});
// And assert we get a cache hit (304)
assert(r2.status === 304, `Expected 304 status code, got ${r2.status}`);

// Step 3. Update the Post
const post = await (await fetch(post_url)).json();
const r3 = await fetch(post_url, {
	method: 'PATCH',
	headers: {
		'Content-Type': 'application/json',
	},
	body: JSON.stringify({
		comments: post.comments.concat(`Random Comment ${Math.random()}`),
	}),
});
// Assert this doesn't fail
assert(r3.ok, `Expected successful response, got ${r3.status}`);

// Step 4. Load the Page a third time using the respective cache headers
const r4 = await fetch(blog_url, {
	headers: {
		'If-None-Match': etag,
		'If-Modified-Since': last_modified,
	},
});
// But we should get a 200 since the Post changed
assert(r4.status === 200, `Expected 200 status code, got ${r4.status}`);

// Update the cache headers
etag = r4.headers.get('ETag');
last_modified = r4.headers.get('Last-Modified');

// Step 5. Load the Page a fourth time using the respective cache headers
const r5 = await fetch(blog_url, {
	headers: {
		'If-None-Match': etag,
		'If-Modified-Since': last_modified,
	},
});

// And finally assert we get a cache hit (304)
assert(r5.status === 304, `Expected 304 status code, got ${r5.status}`);
