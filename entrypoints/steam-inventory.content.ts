/**
 * Content script for Steam inventory and profile pages:
 *   https://steamcommunity.com/profiles/<steamid>/inventory
 *   https://steamcommunity.com/id/<id>/inventory
 *   https://steamcommunity.com/profiles/<steamid>
 *   https://steamcommunity.com/id/<id>
 *   https://steamcommunity.com/market/listings/440/<market_hash_name>
 *
 * Features:
 *  - Unusual effect particle overlays on items
 *  - Uncraftable items: dashed border
 *  - Strangified items: orange border
 *  - Spelled items: spell icon badge
 */

import "../styles/main.css";
import { SteamItem, TF2_APPID, TF2_CONTEXTID } from "../types";

import { decorateItemElement } from "../utils/decorations";

export default defineContentScript({
  matches: [
    "*//steamcommunity.com/profiles/*/inventory*",
    "*//steamcommunity.com/id/*/inventory*",
    "*//steamcommunity.com/profiles/*",
    "*//steamcommunity.com/id/*",
    "*//steamcommunity.com/market/listings/440/*",
  ],
  main() {
    init();
  },
});

// Steam's global inventory variable
declare const g_rgAppContextData: Record<string, unknown> | undefined;
declare const UserYou:
  | {
      getInventory: (
        appid: number,
        contextid: string,
      ) => { m_rgItems: Record<string, SteamItem> } | null;
    }
  | undefined;

// ─── Init ─────────────────────────────────────────────────────────────────────

function init(): void {
  // Observe inventory items appearing
  setupObserver();
  // Decorate any already-visible items
  decorateAllVisible();
}

// ─── Item Decoration ──────────────────────────────────────────────────────────

function decorateAllVisible(): void {
  // Steam inventory items use `.item` class
  const selectors = [
    ".item[data-economy-item]:not([data-stoe-decorated])",
    ".inventory_item_link:not([data-stoe-decorated])",
  ];

  for (const sel of selectors) {
    const els = Array.from(document.querySelectorAll<HTMLElement>(sel));
    for (const el of els) {
      el.setAttribute("data-stoe-decorated", "1");
      tryDecorateElement(el);
    }
  }
}

function tryDecorateElement(el: HTMLElement): void {
  const econItem = el.getAttribute("data-economy-item");
  if (!econItem) return;

  const parts = econItem.split("/");
  if (parts.length < 4) return;

  const appid = parseInt(parts[1], 10);
  const contextid = parts[2];
  const assetid = parts[3];

  if (appid !== TF2_APPID || contextid !== TF2_CONTEXTID) return;

  const item = lookupItem(assetid);
  if (item) {
    decorateItemElement(el, item);
  }
}

function lookupItem(assetid: string): SteamItem | null {
  try {
    if (typeof UserYou !== "undefined" && UserYou) {
      const inv = UserYou.getInventory(TF2_APPID, TF2_CONTEXTID);
      if (inv?.m_rgItems?.[assetid]) {
        return inv.m_rgItems[assetid];
      }
    }
  } catch {
    // Inventory not available
  }
  return null;
}

// ─── Observer ─────────────────────────────────────────────────────────────────

function setupObserver(): void {
  const observer = new MutationObserver(() => {
    decorateAllVisible();
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    attributes: false,
  });
}
