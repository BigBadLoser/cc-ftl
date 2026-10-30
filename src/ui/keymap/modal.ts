/**
 * Set while a full-screen menu owns the keyboard (the Esc menu): the game's key handlers (App, the combat strip, camera keys in app/input.ts,
 * lessons) stand aside, and the menu's own controls (buttons, sliders, a slot's name field) get their keys as usual.
 */
export const keyModal = { open: false };
