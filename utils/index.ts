import { UNUSUAL_EFFECTS } from "./data";

const STORAGE_KEY_PREFIX = "tf2_trader";

export function getStored(name: string): string | null {
  return localStorage.getItem(STORAGE_KEY_PREFIX + name);
}

export function setStored(name: string, value: string | number): void {
  localStorage.setItem(STORAGE_KEY_PREFIX + name, String(value));
}

export const getEffectID = (value: string): number => {
  return UNUSUAL_EFFECTS[value];
};

export const getEffectURL = (value: number | string): string => {
  const effect = typeof value === "string" ? parseInt(value, 10) : value;
  return `https://itempedia.tf/assets/particles/${effect}_94x94.png`;
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
