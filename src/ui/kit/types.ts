/** One choice in a Select, Segmented or Chips control. */
export interface KitOption<T extends string = string> {
  value: T;
  label: string;
  /** Smaller dim text after (Chips) or under (Select) the label. */
  sub?: string;
  disabled?: boolean;
  testId?: string;
  title?: string;
}
