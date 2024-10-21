import { createApp } from './create-app';
import { renderToString } from 'vue/server-renderer';

export async function render({ initialPostData }) {
	const app = createApp({ initialPostData });
	const html = await renderToString(app, {});
	return { html };
}
