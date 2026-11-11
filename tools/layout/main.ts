import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';

mount(App, { target: document.getElementById('app') as HTMLElement });

// A hook for scripted screenshots and agents.
import { lab } from './lab.svelte';
import { preview } from './previewHost';
(window as unknown as { __layoutLab: unknown }).__layoutLab = { lab, preview };
