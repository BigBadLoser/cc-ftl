/**
 * The name the enemy card sets into its top border. A generated ship's name repeats its faction and class ("Navy frigate NA-0005"),
 * and the card already shows those on the line below, so the leading words the subtitle already says are dropped ("NA-0005").
 * Names that don't start with those words (authored ones like "Raider", stations) are kept whole; the card cuts them short with an ellipsis.
 */
export function cardName(name: string, faction: string | null | undefined, klass: string | null | undefined): string {
  const said = new Set(`${faction ?? ''} ${klass ?? ''}`.toLowerCase().split(/\s+/).filter(Boolean));
  const words = name.split(/\s+/).filter(Boolean);
  let i = 0;
  while (i < words.length - 1 && said.has((words[i] as string).toLowerCase())) i++;
  return words.slice(i).join(' ');
}
