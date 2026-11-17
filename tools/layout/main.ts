import { mount } from 'svelte';
import './app.css';
import App from './App.svelte';
import Popout from './Popout.svelte';
import { servePopout } from './popout.svelte';

// `?popout`: this window is the lab's preview, popped out onto its own window (a second monitor).
const popped = new URLSearchParams(location.search).has('popout');
mount(popped ? Popout : App, { target: document.getElementById('app') as HTMLElement });
if (!popped) servePopout();

// A hook for scripted screenshots and agents.
import { lab } from './lab.svelte';
import { preview } from './previewHost';
(window as unknown as { __layoutLab: unknown }).__layoutLab = { lab, preview };
