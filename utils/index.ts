import { browser } from "wxt/browser";
import { ItemDescription, SteamItem, TF2_APPID } from "../types";

export function createElement<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  classes: string[] = [],
  innerHTML = "",
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (classes.length) el.className = classes.join(" ");
  if (innerHTML) el.innerHTML = innerHTML;
  return el;
}

export function waitForElement(
  selector: string,
  timeout = 10000,
): Promise<Element> {
  return new Promise((resolve, reject) => {
    const el = document.querySelector(selector);
    if (el) return resolve(el);

    const observer = new MutationObserver(() => {
      const found = document.querySelector(selector);
      if (found) {
        observer.disconnect();
        resolve(found);
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });

    setTimeout(() => {
      observer.disconnect();
      reject(new Error(`Timeout waiting for element: ${selector}`));
    }, timeout);
  });
}

export function getDescriptionOfType(
  item: SteamItem,
  type: string,
): ItemDescription | undefined {
  return item.descriptions?.find((d) => d.type === type);
}

export function isUncraftable(item: SteamItem): boolean {
  return (
    item.descriptions?.some(
      (d) => d.value && d.value.includes("Not Usable in Crafting"),
    ) ?? false
  );
}

export function isStrangified(item: SteamItem): boolean {
  // Strangified items have Strange quality (11) in their tags but also another quality descriptor
  const qualityTag = item.tags?.find((t) => t.category === "Quality");
  if (!qualityTag) return false;
  // Look for "Strange" in descriptions while the item has another quality
  return (
    item.descriptions?.some(
      (d) => d.value?.includes("Strange") && d.type === "html",
    ) ?? false
  );
}

export function getUnusualEffect(item: SteamItem): string | null {
  if (!item.descriptions) return null;
  for (const desc of item.descriptions) {
    if (desc.value?.startsWith("★ Unusual Effect: ")) {
      return desc.value.replace("★ Unusual Effect: ", "");
    }
  }
  return null;
}

export function hasSpells(item: SteamItem): boolean {
  return (
    item.descriptions?.some(
      (d) => d.value?.includes("Spell:") && d.color === "7ea9d1",
    ) ?? false
  );
}

export function getItemQuality(item: SteamItem): number {
  const qualityTag = item.tags?.find((t) => t.category === "Quality");
  if (!qualityTag) return 6; // Default to Unique
  // Map quality names to numbers
  const qualityMap: Record<string, number> = {
    Normal: 0,
    Genuine: 1,
    Vintage: 3,
    Unusual: 5,
    Unique: 6,
    Community: 7,
    Valve: 8,
    "Self-Made": 9,
    Strange: 11,
    Haunted: 13,
    "Collector's": 14,
    "Decorated Weapon": 15,
  };
  return qualityMap[qualityTag.localized_tag_name] ?? 6;
}

export function isTF2Item(item: SteamItem): boolean {
  return item.appid === TF2_APPID;
}

export function getUrlParam(
  name: string,
  url = window.location.href,
): string | null {
  const params = new URLSearchParams(new URL(url).search);
  return params.get(name);
}

export function getSteamIdFromUrl(url: string): string | null {
  const match = url.match(/\/profiles\/(\d+)/);
  return match ? match[1] : null;
}

export function formatMetal(scrap: number): string {
  const ref = Math.floor(scrap / 9);
  const rec = Math.floor((scrap % 9) / 3);
  const sc = scrap % 3;
  const parts: string[] = [];
  if (ref) parts.push(`${ref} ref`);
  if (rec) parts.push(`${rec} rec`);
  if (sc) parts.push(`${sc} scrap`);
  return parts.join(", ") || "0 scrap";
}

export function parseIds(input: string): string[] {
  return input
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

export function backpackTfUrl(steamId: string, selectedIds?: string[]): string {
  let url = `https://backpack.tf/profiles/${steamId}`;
  if (selectedIds?.length) {
    url += `?select=${selectedIds.join(",")}`;
  }
  return url;
}

export function repTfUrl(steamId: string): string {
  return `https://rep.tf/${steamId}`;
}

const UNUSUAL_EFFECT_MAP: Record<string, number> = {
  "Green Confetti": 6,
  "Purple Confetti": 7,
  "Haunted Ghosts": 8,
  "Green Energy": 9,
  "Purple Energy": 10,
  "Circling TF Logo": 11,
  "Massed Flies": 12,
  "Burning Flames": 13,
  "Scorching Flames": 14,
  "Searing Plasma": 15,
  "Vivid Plasma": 16,
  Sunbeams: 17,
  "Circling Peace Sign": 18,
  "Circling Heart": 19,
  "Stormy 13th Hour": 29,
  "Kill-a-Watt": 56,
  "Terror-Watt": 57,
  "Cloud 9": 58,
  "Aces High": 59,
  "Dead Presidents": 60,
  "Miami Nights": 61,
  "Disco Beat Down": 62,
  Phosphorous: 63,
  Sulphurous: 64,
  "Memory Leak": 65,
  Overclocked: 66,
  Electrostatic: 67,
  "Power Surge": 68,
  "Anti-Freeze": 69,
  "Time Warp": 70,
  "Green Black Hole": 71,
  Roboactive: 72,
  Arcana: 73,
  Spellbound: 3000,
  "Fragmented Gluons": 4006,
  "Accellerating Gluons": 4007,
};

export function getUnusualEffectImageUrl(effectName: string): string | null {
  const effectId = UNUSUAL_EFFECT_MAP[effectName];
  if (!effectId) return null;
  return `https://backpack.tf/images/440/particles/${effectId}_188x188.png`;
}

export async function storageGet<T>(key: string, defaultValue: T): Promise<T> {
  try {
    const result = await browser.storage.local.get(key);
    return result[key] !== undefined ? (result[key] as T) : defaultValue;
  } catch {
    return defaultValue;
  }
}

export async function storageSet(key: string, value: unknown): Promise<void> {
  await browser.storage.local.set({ [key]: value });
}
