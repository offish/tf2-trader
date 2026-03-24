import { getItemAttributes, buildSku, getDefindexFromDesc } from "./inventory";

/** Metal (ref) value of each currency item defindex. */
export const CURRENCY_DEFINDEXES: Record<string, { keys: number; metal: number }> = {
  "5021": { keys: 1, metal: 0 },       // Mann Co. Supply Crate Key
  "5000": { keys: 0, metal: 1 },        // Refined Metal
  "5001": { keys: 0, metal: 1 / 3 },   // Reclaimed Metal
  "5002": { keys: 0, metal: 1 / 9 },   // Scrap Metal
};

// Cache SKU prices for the lifetime of the page so repeated panel
// refreshes don't re-request the same items.
export const priceCache = new Map<string, { keys: number; metal: number } | null>();

// The content script runs in world:MAIN (Steam's page), which is bound by
// Steam's CSP — direct fetch() to pricedb.io is blocked.  Instead we post
// a message to the ISOLATED bridge script (tradeoffer-pricedb-bridge), which
// forwards the request through the background service worker.
export async function fetchPricedbPrice(
  sku: string,
): Promise<{ keys: number; metal: number } | null> {
  if (priceCache.has(sku)) return priceCache.get(sku)!;

  const result = await new Promise<{ keys: number; metal: number } | null>(
    (resolve) => {
      const id = Math.random().toString(36).slice(2);
      const timer = setTimeout(() => {
        window.removeEventListener("message", handler);
        resolve(null);
      }, 5000);
      const handler = (e: MessageEvent) => {
        if (
          e.data?.type === "tf2trader_pricedb_response" &&
          e.data?.id === id
        ) {
          clearTimeout(timer);
          window.removeEventListener("message", handler);
          resolve(e.data.result ?? null);
        }
      };
      window.addEventListener("message", handler);
      window.postMessage({ type: "tf2trader_pricedb_request", sku, id }, "*");
    },
  );

  priceCache.set(sku, result);
  return result;
}

/**
 * Search pricedb by name — only used as a fallback when the SKU is incomplete.
 * Returns price + resolved SKU when there is exactly one matching result.
 */
export async function fetchPricedbSearch(
  query: string,
): Promise<{ keys: number; metal: number; sku: string } | null> {
  return new Promise((resolve) => {
    const id = Math.random().toString(36).slice(2);
    const timer = setTimeout(() => {
      window.removeEventListener("message", handler);
      resolve(null);
    }, 5000);
    const handler = (e: MessageEvent) => {
      if (
        e.data?.type === "tf2trader_pricedb_search_response" &&
        e.data?.id === id
      ) {
        clearTimeout(timer);
        window.removeEventListener("message", handler);
        resolve(e.data.result ?? null);
      }
    };
    window.addEventListener("message", handler);
    window.postMessage(
      { type: "tf2trader_pricedb_search_request", query, id },
      "*",
    );
  });
}

export async function sideValueInKeys(
  assets: Array<{ assetid: string }>,
  rgMap: Record<string, any>,
  keyPriceRef: number,
): Promise<{ total: number; missing: number; unpricedNames: string[] }> {
  let totalKeys = 0;
  let missing = 0;
  const unpricedNames: string[] = [];
  const fetches: Promise<void>[] = [];

  for (const asset of assets) {
    const desc = rgMap[asset.assetid];
    if (!desc) { missing++; continue; }

    const defindex = getDefindexFromDesc(desc);

    if (defindex && CURRENCY_DEFINDEXES[defindex]) {
      const c = CURRENCY_DEFINDEXES[defindex];
      totalKeys += c.keys + (keyPriceRef > 0 ? c.metal / keyPriceRef : 0);
      continue;
    }

    if (!defindex) {
      const name = desc.market_hash_name ?? desc.name ?? "Unknown";
      unpricedNames.push(name);
      missing++;
      continue;
    }

    const attrs = getItemAttributes(desc);
    const sku = buildSku(defindex, attrs);

    // Strip "Series #" → "#" so "Mann Co. Supply Crate Series #75"
    // matches pricedb's canonical name "Mann Co. Supply Crate #75".
    const itemName = (desc.market_hash_name ?? desc.name ?? "")
      .replace(/\bSeries\s+(?=#\d)/i, "");

    fetches.push(
      fetchPricedbPrice(sku).then(async (price) => {
        if (!price) {
          // Fallback: search by name — handles crates where the series
          // number was not available when building the SKU.
          const found = await fetchPricedbSearch(itemName);
          if (found) {
            const resolved = { keys: found.keys, metal: found.metal };
            priceCache.set(sku, resolved);
            priceCache.set(found.sku, resolved);
            totalKeys += resolved.keys + (keyPriceRef > 0 ? resolved.metal / keyPriceRef : 0);
          } else {
            unpricedNames.push(itemName);
            missing++;
          }
          return;
        }
        totalKeys += price.keys + (keyPriceRef > 0 ? price.metal / keyPriceRef : 0);
      }),
    );
  }

  await Promise.all(fetches);
  return { total: totalKeys, missing, unpricedNames };
}
