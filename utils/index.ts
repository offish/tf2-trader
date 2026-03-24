import { UNUSUAL_EFFECTS } from "./data";

export const getEffectID = (value: string): number => {
  return UNUSUAL_EFFECTS[value];
};

export const getEffectURL = (value: number): string => {
  return `https://itempedia.tf/assets/particles/${value}_94x94.png`;
};

/** Returns a debounced version of `fn` that delays invocation by `ms`. */
export function debounce<T extends (...args: unknown[]) => void>(
  fn: T,
  ms: number,
): (...args: Parameters<T>) => void {
  let timer: ReturnType<typeof setTimeout> | null = null;
  return (...args: Parameters<T>) => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(() => fn(...args), ms);
  };
}
