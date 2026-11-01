/** The loading veil is static markup in index.html (so the first paint is already dark); this lifts it once `until` settles. */
export function liftBootVeil(until: Promise<void>): void {
  const done = (): void => {
    const v = document.getElementById('boot-veil');
    if (!v) return;
    v.classList.add('lift');
    setTimeout(() => v.remove(), 220);
  };
  void until.then(done, done);
}
