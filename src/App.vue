<template>
	<article>
		<h1>{{ post.title }}</h1>
		<p>{{ post.body }}</p>
		<ul v-if="post.comments && post.comments.length > 0">
			<li v-for="(comment, index) in post.comments" :key="index">
				<span>{{ comment }}</span>
				<button class="delete-button" @click="deleteComment(index)">X</button>
			</li>
		</ul>
		<p v-else>No Comments Yet!</p>
		<form @submit.prevent="addComment">
			<input type="text" v-model="newComment" placeholder="Add a comment" />
			<button type="submit">Submit</button>
		</form>
	</article>
</template>

<script setup>
import { ref, onMounted, onUnmounted } from 'vue';

const props = defineProps({ initialPostData: Object });

const post = ref(props.initialPostData);
const newComment = ref('');

const addComment = () => {
	const newPost = { ...post.value, comments: [...post.value.comments, newComment.value.trim()] };

	fetch(`http://localhost:9926/Post/${post.value.id}`, {
		method: 'PATCH',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(newPost),
	})
		.then((response) => {
			if (response.ok) {
				console.log('Comment added!');
			} else {
				console.error('Error adding comment:', response.statusText);
			}
		})
		.catch((error) => {
			console.error('Error adding comment:', error);
		});
};

const deleteComment = (index) => {
	const newPost = { ...post.value, comments: post.value.comments.filter((_, i) => i !== index) };

	fetch(`http://localhost:9926/Post/${post.value.id}`, {
		method: 'PATCH',
		headers: {
			'Content-Type': 'application/json',
		},
		body: JSON.stringify(newPost),
	})
		.then((response) => {
			if (response.ok) {
				console.log('Comment deleted!');
			} else {
				console.error('Error deleting comment:', response.statusText);
			}
		})
		.catch((error) => {
			console.error('Error deleting comment:', error);
		});
};

onMounted(() => {
	const ws = new WebSocket(`ws://localhost:9926/Post/${post.value.id}`);
	ws.onmessage = (event) => {
		const message = JSON.parse(event.data);
		post.value = message.value;
	};

	onUnmounted(() => {
		ws.close();
	});
});
</script>

<style scoped>
.delete-button {
	margin-left: 10px;
	color: red;
	cursor: pointer;
}
</style>
