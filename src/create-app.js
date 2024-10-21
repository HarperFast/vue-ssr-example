import { createSSRApp } from 'vue';
import App from './App.vue';

export function createApp({ initialPostData }) {
	return createSSRApp(App, { initialPostData });
}
