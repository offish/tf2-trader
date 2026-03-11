import { Currencies } from "@/types";

export const refinedToKeys = (refValue: number, keyValue: number): number => {
  return Math.round((refValue / keyValue) * 10) / 10;
};

export const parseItem = (itemEl: HTMLElement) => {
  const data = itemEl.dataset;
  const details: any = {
    raw: data.price ? parseFloat(data.price) : 0,
    refined: 0,
    currency: "",
    average: 0,
  };

  const pBptf = data.p_bptf || "";
  const match = pBptf.match(/^([\d\.]*)[\-\u2013]?([\d\.]*)? (\w*)/);

  if (match) {
    const currencyNames: Record<string, string> = {
      metal: "metal",
      ref: "metal",
      keys: "keys",
      key: "keys",
    };
    details.value = parseFloat(match[1]);
    details.currency = currencyNames[match[3]] || "";
    details.average = match[2]
      ? (details.value + parseFloat(match[2])) / 2
      : details.value;
  }

  const refStr = data.p_bptf_all || "";
  const matchRef = refStr.replace(/,/g, "").match(/(\d+\.?\d*) ref/);
  const refVal = matchRef ? parseFloat(matchRef[1]) : 0;

  details.refined =
    refVal.toFixed(2) === details.raw.toFixed(2)
      ? details.raw
      : refVal || details.raw;

  return details;
};

export const getKeysListedValue = (items: HTMLElement[], keyValue: number) => {
  let totalRef = 0;
  items.forEach((el) => {
    const listingPrice = el.dataset.listing_price || "";
    const keysMatch = listingPrice.match(/(\d+\.?\d*) keys?/);
    const refMatch = listingPrice.match(/(\d+\.?\d*) ref/);

    const keys = keysMatch ? parseFloat(keysMatch[1]) : 0;
    const ref = refMatch ? parseFloat(refMatch[1]) : 0;
    totalRef += keys * keyValue + ref;
  });
  return refinedToKeys(totalRef, keyValue);
};

export const stringToCurrencies = (
  str: string | undefined,
): Currencies | null => {
  if (!str) return null;

  const cleaned = str.trim().replace(/\s+/g, " ");
  const prices = cleaned.split(",");
  const currencies: Currencies = {};

  for (const price of prices) {
    const match = price.trim().match(/^([\d\.]+) (\w+)$/i);
    if (!match) continue;

    const value = parseFloat(match[1]);
    const currency = match[2].toLowerCase();

    if (isNaN(value)) continue;

    if (["keys", "key"].includes(currency)) currencies.keys = value;
    if (["metal", "ref"].includes(currency)) currencies.metal = value;
  }

  return Object.keys(currencies).length === 0 ? null : currencies;
};

export const processListings = () => {
  const isNext = window.location.hostname.includes("next.backpack.tf");
  const mode: "next" | "legacy" = isNext ? "next" : "legacy";

  const listings = document.querySelectorAll(".listing");

  listings.forEach((el) => {
    const listingEl = el as HTMLElement;
    if (listingEl.hasAttribute("data-bp-processed")) return;

    let offerButtonEl: HTMLAnchorElement | null = null;
    let currencies: Currencies | null = null;
    let intent: string | null = null;

    if (mode === "next") {
      const actionsWrapper = listingEl.querySelector(
        ".listing__details__actions",
      );
      offerButtonEl = actionsWrapper?.querySelector(
        "a.listing__details__actions__action",
      ) as HTMLAnchorElement;

      const intentEl = listingEl.querySelector(
        ".listing__details__header .text-sell, .listing__details__header .text-buy",
      );
      intent = intentEl?.classList.contains("text-sell") ? "sell" : "buy";

      const priceEl = listingEl.querySelector(".item__price");
      if (priceEl) {
        const priceClone = priceEl.cloneNode(true) as HTMLElement;
        priceClone.querySelector("svg")?.remove();
        currencies = stringToCurrencies(priceClone.textContent?.trim() || "");
      }
    } else {
      const itemEl = listingEl.querySelector(".item") as HTMLElement;
      offerButtonEl = listingEl.querySelector(".listing-buttons")
        ?.lastElementChild as HTMLAnchorElement;

      if (itemEl) {
        intent = itemEl.dataset.listing_intent || null;
        currencies = stringToCurrencies(itemEl.dataset.listing_price);

        // Debug: log first listing's item dataset so we can see what's available
        if (!document.querySelector("[data-bp-processed]")) {
          console.log(
            "[tf2-trader] First listing item dataset:",
            JSON.stringify(itemEl.dataset),
          );
          console.log(
            "[tf2-trader] First listing item outerHTML (truncated):",
            itemEl.outerHTML.substring(0, 500),
          );
        }

        // Capture item name for both buy and sell — tradeoffer-new uses it
        // to locate the item in the appropriate inventory.
        const rawName =
          itemEl.dataset.name ||
          itemEl.dataset.item_name ||
          itemEl.title ||
          listingEl
            .querySelector(
              ".item-name, [data-item_name], .listing-item-name, span.name",
            )
            ?.textContent?.trim() ||
          "";
        if (rawName) {
          (listingEl as any)._bp_item_name = rawName;
        }
      }
    }

    const href = offerButtonEl?.href || offerButtonEl?.getAttribute("href");
    if (!offerButtonEl || !href || href.startsWith("steam://") || !currencies) {
      listingEl.setAttribute("data-bp-processed", "1");
      return;
    }

    try {
      const url = new URL(href, window.location.origin);
      url.searchParams.set("listing_intent", intent === "buy" ? "0" : "1");

      if (currencies.keys)
        url.searchParams.set(
          "listing_currencies_keys",
          currencies.keys.toString(),
        );

      if (currencies.metal)
        url.searchParams.set(
          "listing_currencies_metal",
          currencies.metal.toString(),
        );

      // Embed item name for both buy and sell orders so steam-tradeoffer-new
      // can locate the item in the correct inventory.
      // Note: searchParams.set() handles encoding automatically — no manual
      // encodeURIComponent needed (that would cause double-encoding).
      const itemNameToEmbed = (listingEl as any)._bp_item_name as
        | string
        | undefined;
      if (itemNameToEmbed) {
        url.searchParams.set("listing_item_name", itemNameToEmbed);
      }

      offerButtonEl.href = url.toString();
    } catch (e) {
    } finally {
      listingEl.setAttribute("data-bp-processed", "1");
    }
  });
};
