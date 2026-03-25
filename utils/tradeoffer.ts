import { SteamItem, Currencies } from "@/types";

export function isRareTF2Key(item: SteamItem): boolean {
  const rare440Keys = [
    "5049",
    "5067",
    "5072",
    "5073",
    "5079",
    "5081",
    "5628",
    "5631",
    "5632",
    "5713",
    "5716",
    "5717",
    "5762",
  ];
  const defindex = item.appdata?.def_index;
  return typeof defindex === "string" && rare440Keys.includes(defindex);
}

/**
 * URL parameter utilities
 */
export function getURLParams(): Record<string, string> {
  const params: Record<string, string> = {};
  const pattern = /[?&]+([^=&]+)=([^&]*)/gi;
  window.location.search.replace(
    pattern,
    (_str: string, key: string, value: string) => {
      params[key] = decodeURIComponent(value);
      return "";
    },
  );
  return params;
}

/**
 * Omits keys with null/undefined/empty values from an object.
 */
export function omitEmpty<T extends Record<string, unknown>>(
  obj: T,
): Partial<T> {
  const result: Partial<T> = {};
  for (const k in obj) {
    if (obj[k] != null && obj[k] !== "") {
      result[k] = obj[k];
    }
  }
  return result;
}

/**
 * Gets a list of IDs from a comma-separated string.
 */
export function getIDsFromString(str: string): string[] | null {
  if (/(\d+)(,\s*\d+)*/.test(str)) {
    return str.split(",");
  }
  return null;
}

/**
 * Executes hot key command.
 */
export function execHotKey(
  e: KeyboardEvent,
  hotKeys: Record<number, () => void>,
): void {
  const target = e.target as HTMLElement;
  const isTextField =
    /textarea|select/i.test(target.nodeName) ||
    ["number", "text"].indexOf((target as HTMLInputElement).type) !== -1;
  const code = e.keyCode || e.which;
  const method = hotKeys[code];
  if (!isTextField && method) {
    method();
  }
}

/**
 * Flattens an array one level deep.
 */
export function flatten<T>(arrays: (T[] | T)[]): T[] {
  return ([] as T[]).concat(...(arrays as T[][]));
}

/**
 * Partitions an array into two based on a predicate.
 */
export function partition<T>(arr: T[], fn: (item: T) => boolean): [T[], T[]] {
  const result: [T[], T[]] = [[], []];
  for (let i = 0; i < arr.length; i++) {
    result[fn(arr[i]) ? 0 : 1].push(arr[i]);
  }
  return result;
}

/**
 * Groups an array by a key.
 */
export function groupBy<T>(
  arr: T[],
  key: string | ((item: T) => string | number),
): Record<string, T[]> {
  return arr.reduce((a: Record<string, T[]>, b: T) => {
    const k =
      typeof key === "function"
        ? String(key(b))
        : String((b as Record<string, unknown>)[key]);
    (a[k] = a[k] || []).push(b);
    return a;
  }, {});
}

/**
 * Converts a currency string (e.g. "1.33 metal, 2 keys") to a Currencies object.
 */
export function stringToCurrencies(string: string): Currencies | null {
  if (!string) return null;
  const prices = string.split(",");
  const currencies: Currencies = {};
  for (let i = 0; i < prices.length; i++) {
    const match = prices[i].trim().match(/^([\d.]*) (\w*)$/i);
    if (!match) return null;
    const value = parseFloat(match[1]);
    const currency = match[2].toLowerCase();
    if (isNaN(value)) return null;
    switch (currency) {
      case "keys":
      case "key":
        currencies.keys = value;
        break;
      case "metal":
      case "ref":
        currencies.metal = value;
        break;
    }
  }
  if (Object.keys(currencies).length === 0) return null;
  return currencies;
}

export function addAttributes(item: SteamItem, itemEl: HTMLElement): void {
  const attributes = getItemAttributes(item);
  addAttributesToElement(itemEl, attributes);
}
