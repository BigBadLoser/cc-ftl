import { mount } from 'svelte';
import App from './ui/App.svelte';

const target = document.getElementById('app');
if (!target) throw new Error('Missing #app element');

mount(App, { target });
