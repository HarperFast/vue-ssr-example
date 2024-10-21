import { createApp } from './create-app';

const app = createApp({ initialPostData: window.__INITIAL_POST_DATA__ });
app.mount('#root');
