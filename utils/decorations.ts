import { SteamItem } from "../types";
import {
  isUncraftable,
  isStrangified,
  getUnusualEffect,
  getUnusualEffectImageUrl,
  hasSpells,
} from "./index";

export function decorateItemElement(el: HTMLElement, item: SteamItem): void {
  // Wrap for absolute positioning if not already done
  if (
    !el.querySelector(".stoe-item-wrap") &&
    !el.classList.contains("stoe-item-wrap")
  ) {
    el.style.position = "relative";
  }

  // Apply uncraftable dashed border
  if (isUncraftable(item)) {
    el.classList.add("stoe-uncraftable");
  }

  // Apply strangified orange border
  if (isStrangified(item)) {
    el.classList.add("stoe-strangified");
  }

  // Apply unusual particle effect overlay
  const unusualEffect = getUnusualEffect(item);
  if (unusualEffect) {
    const imgUrl = getUnusualEffectImageUrl(unusualEffect);
    if (imgUrl) {
      const existing = el.querySelector(".stoe-unusual-effect");
      if (!existing) {
        const overlay = document.createElement("div");
        overlay.className = "stoe-unusual-effect";
        overlay.style.backgroundImage = `url(${imgUrl})`;
        overlay.title = `★ Unusual Effect: ${unusualEffect}`;
        el.appendChild(overlay);
      }
    }
  }

  // Apply spell badge
  if (hasSpells(item)) {
    const existing = el.querySelector(".stoe-spell-badge");
    if (!existing) {
      const badge = document.createElement("div");
      badge.className = "stoe-spell-badge";
      badge.title = "This item has Halloween spells";
      el.appendChild(badge);
    }
  }
}

export function injectStyles(cssText: string): void {
  if (document.getElementById("stoe-styles")) return;
  const style = document.createElement("style");
  style.id = "stoe-styles";
  style.textContent = cssText;
  document.head.appendChild(style);
}

export function buildItemSummary(items: SteamItem[]): {
  keys: number;
  metalScrap: number;
  counts: Map<string, number>;
} {
  let keys = 0;
  let metalScrap = 0;
  const counts = new Map<string, number>();

  for (const item of items) {
    const name = item.name ?? item.market_hash_name ?? "Unknown Item";

    if (name === "Mann Co. Supply Crate Key") {
      keys += parseInt(item.amount ?? "1", 10);
      continue;
    }

    if (name === "Refined Metal") {
      metalScrap += 9 * parseInt(item.amount ?? "1", 10);
      continue;
    }

    if (name === "Reclaimed Metal") {
      metalScrap += 3 * parseInt(item.amount ?? "1", 10);
      continue;
    }

    if (name === "Scrap Metal") {
      metalScrap += 1 * parseInt(item.amount ?? "1", 10);
      continue;
    }

    counts.set(
      name,
      (counts.get(name) ?? 0) + parseInt(item.amount ?? "1", 10),
    );
  }

  return { keys, metalScrap, counts };
}

export function renderSummaryHtml(
  summary: ReturnType<typeof buildItemSummary>,
): string {
  const lines: string[] = [];

  if (summary.keys > 0) {
    lines.push(
      `<div class="stoe-summary-row"><span>Keys:</span><span>${summary.keys}</span></div>`,
    );
  }

  if (summary.metalScrap > 0) {
    const ref = (summary.metalScrap / 9).toFixed(2).replace(/\.?0+$/, "");
    lines.push(
      `<div class="stoe-summary-row"><span>Metal:</span><span>${ref} ref</span></div>`,
    );
  }

  const sortedItems = Array.from(summary.counts.entries()).sort(
    (a, b) => b[1] - a[1],
  );

  for (const [name, count] of sortedItems) {
    lines.push(
      `<div class="stoe-summary-row"><span>${name}:</span><span>×${count}</span></div>`,
    );
  }

  return lines.join("");
}
