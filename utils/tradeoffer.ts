export interface ItemAttributes {
  color: string;
  effect?: number;
  effectName?: string;
  strange?: boolean;
  uncraft?: boolean;
  lowcraft?: number;
  spelled?: boolean;
  parts?: boolean;
  killstreak?: boolean;
}

export interface SteamItem {
  appid: number | string;
  name?: string;
  market_hash_name?: string;
  type?: string;
  name_color?: string;
  descriptions?: Array<{ value: string; color?: string }>;
  tags?: Array<{ category: string; name: string }>;
  appdata?: { def_index?: string };
  [key: string]: unknown;
}

// ---------------------------------------------------------------------------
// Identifier helpers
// ---------------------------------------------------------------------------

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
 * Copies a value to clipboard.
 */
export function copyToClipboard(str: string): void {
  const el = document.createElement("textarea");
  el.value = str;
  document.body.appendChild(el);
  el.select();
  document.execCommand("copy");
  document.body.removeChild(el);
}

/**
 * Currencies object.
 */
export interface Currencies {
  keys?: number;
  metal?: number;
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

//TODO: remove
export function getItemAttributes(item: SteamItem): ItemAttributes {
  const hasDescriptions = typeof item.descriptions === "object";
  const attributes: ItemAttributes = {
    color: (item.name_color || "").toUpperCase(),
  };
  const isUnique = attributes.color === "7D6D00";
  const isStrangeQuality = attributes.color === "CF6A32";
  const hasStrangeItemType = Boolean(
    /^Strange /.test(item.market_hash_name || "") &&
    item.type &&
    /^Strange ([0-9\w\s\\()'\\-]+) \- ([0-9\w\s()'\\-]+): (\d+)\n?$/.test(
      item.type,
    ),
  );

  const matchesLowcraft = item.name?.match(/.* #(\d+)$/);
  if (matchesLowcraft) {
    attributes.lowcraft = parseInt(matchesLowcraft[1]);
  }

  if (!isStrangeQuality && hasStrangeItemType) {
    attributes.strange = true;
  }

  if (!hasDescriptions || !item.descriptions) return attributes;

  for (const description of item.descriptions) {
    const matchesEffect =
      attributes.effectName === undefined &&
      !isUnique &&
      description.color === "ffd700" &&
      description.value.match(/^\u2605 Unusual Effect: (.+)$/);

    if (matchesEffect) {
      const effectName = (matchesEffect as RegExpMatchArray)[1];
      const value = getEffectID(effectName);
      if (value) {
        attributes.effect = value;
        attributes.effectName = effectName;
      }
    }

    if (
      attributes.spelled === undefined &&
      description.color === "7ea9d1" &&
      description.value.includes("(spell only active during event)")
    ) {
      attributes.spelled = true;
    }

    if (
      attributes.parts === undefined &&
      description.color === "756b5e" &&
      description.value.match(/^\(?(.+?):\s*\d+\)?$/)
    ) {
      attributes.parts = true;
    }

    if (
      attributes.killstreak === undefined &&
      description.color === "7ea9d1" &&
      description.value === "Killstreaks Active"
    ) {
      attributes.killstreak = true;
    }

    if (
      !description.color &&
      /^\( Not.* Usable in Crafting/.test(description.value)
    ) {
      attributes.uncraft = true;
    }

    const hasStatClock =
      description.color?.toUpperCase() === "CF6A32" &&
      description.value.trim() === "Strange Stat Clock Attached";

    if (!isStrangeQuality && hasStatClock) {
      attributes.strange = true;
    }
  }

  return attributes;
}

export function addAttributesToElement(
  itemEl: HTMLElement,
  attributes: ItemAttributes,
): void {
  if (itemEl.hasAttribute("data-checked")) return;

  const iconsEl = document.createElement("div");
  const classes: string[] = [];

  if (attributes.effect) {
    const url = getEffectURL(attributes.effect);
    itemEl.setAttribute("data-effect", String(attributes.effect));
    itemEl.style.backgroundImage = `url('${url}')`;
    classes.push("unusual");
  }

  if (attributes.strange) classes.push("strange");
  if (attributes.uncraft) classes.push("uncraft");

  if (attributes.lowcraft) {
    const craftNumberEl = document.createElement("div");
    craftNumberEl.textContent = `#${attributes.lowcraft}`;
    craftNumberEl.classList.add("lowcraft");
    craftNumberEl.style.color = `#${attributes.color}`;
    itemEl.appendChild(craftNumberEl);
  }

  if (attributes.spelled) {
    const spellEl = document.createElement("img");
    spellEl.setAttribute("src", "https://scrap.tf/img/spell.png");
    spellEl.classList.add("spell");
    iconsEl.appendChild(spellEl);
  }

  if (attributes.parts) {
    const partsEl = document.createElement("img");
    partsEl.setAttribute("src", "https://itempedia.tf/assets/wrench.png");
    partsEl.classList.add("parts");
    iconsEl.appendChild(partsEl);
  }

  if (attributes.killstreak) {
    const ksEl = document.createElement("img");
    ksEl.setAttribute("src", "https://itempedia.tf/assets/icon-ks.png");
    ksEl.classList.add("ks");
    iconsEl.appendChild(ksEl);
  }

  if (iconsEl.children.length > 0) {
    iconsEl.classList.add("icons");
    itemEl.appendChild(iconsEl);
  }

  if (classes.length > 0) {
    itemEl.classList.add(...classes);
  }

  itemEl.setAttribute("data-checked", "1");
}

export function addAttributes(item: SteamItem, itemEl: HTMLElement): void {
  const attributes = getItemAttributes(item);
  addAttributesToElement(itemEl, attributes);
}
