/**
 * The health colour every inspector uses, by the share of max hp left: green when healthy, yellow when hurt, red when
 * critical. Same thresholds as the boarding card (combat/BoardingCard.svelte): red below 30%, yellow below 60%.
 */
export function healthColor(frac: number): string {
  return frac < 0.3 ? 'var(--health-bad)' : frac < 0.6 ? 'var(--health-warn)' : 'var(--health-good)';
}

/** The matching text tone (the readout beside the bar). */
export function healthTone(frac: number): 'good' | 'warn' | 'bad' {
  return frac < 0.3 ? 'bad' : frac < 0.6 ? 'warn' : 'good';
}
