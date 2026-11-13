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

/** One decision button (kit/DecisionBar): the label, a short note on the right, and whether it is the primary one. */
export interface DecisionOption {
  id: string;
  label: string;
  note?: string;
  primary?: boolean;
  disabled?: boolean;
  /** Why it is disabled (a tooltip). */
  reason?: string;
  /** A test id for this button (default `comms-decision`). */
  testId?: string;
}
