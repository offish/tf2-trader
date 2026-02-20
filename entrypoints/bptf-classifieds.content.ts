/**
 * Content script for:
 *   https://backpack.tf/classifieds
 *   https://backpack.tf/stats/*
 *
 * Features:
 *  - Auto-generate trade offer links on listings for use with the trade offer page
 *    (sets for_item, listing_intent, listing_currencies_keys, listing_currencies_metal)
 */

import "../styles/main.css";

export default defineContentScript({
  matches: ["https://backpack.tf/classifieds*", "https://backpack.tf/stats/*"],
  main() {
    init();
  },
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface ListingData {
  steamid: string;
  intent: 0 | 1; // 0 = buy, 1 = sell
  item?: {
    id?: string;
    appid?: number;
    contextid?: string;
  };
  currencies?: {
    keys?: number;
    metal?: number;
  };
  tradeurl?: string;
}

// ─── Init ─────────────────────────────────────────────────────────────────────

function init(): void {
  processAllListings();

  // Re-process when listings update (pagination, search, etc.)
  const observer = new MutationObserver(() => {
    processAllListings();
  });
  observer.observe(document.body, { childList: true, subtree: true });
}

// ─── Listing Processing ───────────────────────────────────────────────────────

function processAllListings(): void {
  const listingEls = Array.from(
    document.querySelectorAll<HTMLElement>(
      ".listing:not([data-stoe-processed])",
    ),
  );

  for (const el of listingEls) {
    el.setAttribute("data-stoe-processed", "1");
    processListing(el);
  }
}

function processListing(listingEl: HTMLElement): void {
  const data = extractListingData(listingEl);
  if (!data) return;

  const tradeLink = buildTradeOfferLink(data);
  if (!tradeLink) return;

  injectTradeLink(listingEl, tradeLink, data);
}

function extractListingData(listingEl: HTMLElement): ListingData | null {
  try {
    // backpack.tf stores listing data in data attributes or embedded JSON
    const dataAttr = listingEl.getAttribute("data-listing");
    if (dataAttr) {
      return JSON.parse(dataAttr) as ListingData;
    }

    // Try to extract from child elements
    const steamidEl = listingEl.querySelector<HTMLElement>("[data-steamid]");
    const intentEl = listingEl.querySelector<HTMLElement>("[data-intent]");
    const itemEl = listingEl.querySelector<HTMLElement>("[data-id]");

    if (!steamidEl || !intentEl) return null;

    const steamid = steamidEl.getAttribute("data-steamid") ?? "";
    const intent = parseInt(intentEl.getAttribute("data-intent") ?? "1", 10) as
      | 0
      | 1;

    // Parse currencies
    let keys = 0;
    let metal = 0;
    const keysEl = listingEl.querySelector("[data-keys]");
    const metalEl = listingEl.querySelector("[data-metal]");
    if (keysEl) keys = parseFloat(keysEl.getAttribute("data-keys") ?? "0");
    if (metalEl) metal = parseFloat(metalEl.getAttribute("data-metal") ?? "0");

    // Get trade URL
    const tradeUrlLink = listingEl.querySelector<HTMLAnchorElement>(
      'a[href*="tradeoffer"]',
    );
    const tradeurl = tradeUrlLink?.href;

    return {
      steamid,
      intent,
      item: itemEl
        ? { id: itemEl.getAttribute("data-id") ?? undefined }
        : undefined,
      currencies: { keys, metal },
      tradeurl,
    };
  } catch {
    return null;
  }
}

/**
 * Build a Steam trade offer URL with backpack.tf listing parameters
 */
function buildTradeOfferLink(data: ListingData): string | null {
  // We need a base trade offer URL - use the partner's steamid
  if (!data.steamid) return null;

  // Convert steamid64 to partner id (subtract base)
  const steamId64 = BigInt(data.steamid);
  const base = BigInt("76561197960265728");
  const partner = (steamId64 - base).toString();

  const params = new URLSearchParams({
    partner,
    listing_intent: data.intent.toString(),
  });

  if (data.currencies?.keys) {
    params.set("listing_currencies_keys", data.currencies.keys.toString());
  }

  if (data.currencies?.metal) {
    params.set("listing_currencies_metal", data.currencies.metal.toString());
  }

  // If this is a sell listing, we want the item the seller has
  if (data.intent === 1 && data.item?.id) {
    params.set("for_item", `440_2_${data.item.id}`);
  }

  return `https://steamcommunity.com/tradeoffer/new/?${params.toString()}`;
}

/**
 * Inject a trade offer quick-link button into the listing element
 */
function injectTradeLink(
  listingEl: HTMLElement,
  tradeLink: string,
  data: ListingData,
): void {
  const existing = listingEl.querySelector(".stoe-trade-link");
  if (existing) return;

  const link = document.createElement("a");
  link.href = tradeLink;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.className = "stoe-offer-link stoe-trade-link";
  link.textContent = "⚡ Send Offer";
  link.title = "Open trade offer with currencies pre-filled";

  // Find the actions area in the listing
  const actions = listingEl.querySelector(
    ".listing-buttons, .listing-actions, .actions, .btn-group",
  );

  if (actions) {
    actions.appendChild(link);
  } else {
    // Append to end of listing
    const footer = document.createElement("div");
    footer.className = "stoe-offer-links";
    footer.appendChild(link);
    listingEl.appendChild(footer);
  }
}
