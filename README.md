# HarperDB Vue SSR Example

This repo is an example of how to implement Vue SSR using HarperDB Resources to efficiently generate a _Blog_ from a database of _Posts_.

It includes complete client side hydration as well, resulting in a fully interactive web app experience.

## Get Started

1. `npm i`
2. `npm build`
3. `harperdb run .`
4. Navigate to [/UncachedBlog/0](http://localhost:9926/UncachedBlog/0) or [/CachedBlog/0](http://localhost:9926/CachedBlog/0)
5. Add or remove comments!

The application is fully interactive and leverages a WebHook on the _Post_ to keep the page synced with the database record.

Regardless of caching, the pages are server side rendered. In the caching example, it will only rerender when the _Post_ has been updated.

Otherwise, clients should always receive a 304 status code!

## Help

- The `resources.js` file will generate a Post record automatically on startup, but won't overwrite an existing one.

- If you want to clear the Post record, use the command: `curl -X DELETE http://localhost:9926/Post/0`

- If you want to clear the comments on the Post, use the command:

```sh
curl -X PATCH http://localhost:9926/Post/0 \
-H "Content-Type: application/json" \
-d '{ "comments": [] }'
```

- This repo includes a `caching-test.js` script for quickly demonstrating and validating the caching behavior. Give it a try with `node caching-test.js` (component must be running with HarperDB).
