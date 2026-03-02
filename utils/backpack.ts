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

const stringToCurrencies = (str: string | undefined): Currencies | null => {
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
    if (listingEl.hasAttribute("data-params-added")) return;

    let offerButtonEl: HTMLAnchorElement | null = null;
    let currencies: Currencies | null = null;
    let intent: string | null = null;

    if (mode === "next") {
      const actionsWrapper = listingEl.querySelector(
        ".listing__details__actions",
      );
      offerButtonEl = actionsWrapper?.lastElementChild as HTMLAnchorElement;

      const intentEl = listingEl.querySelector(
        ".listing__details__header .text-sell, .listing__details__header .text-buy",
      );
      intent = intentEl?.classList.contains("text-sell") ? "sell" : "buy";

      const priceEl = listingEl.querySelector(".item__price");
      currencies = stringToCurrencies(priceEl?.textContent || "");
    } else {
      const itemEl = listingEl.querySelector(".item") as HTMLElement;
      offerButtonEl = listingEl.querySelector(".listing-buttons")
        ?.lastElementChild as HTMLAnchorElement;

      if (itemEl) {
        intent = itemEl.dataset.listing_intent || null;
        currencies = stringToCurrencies(itemEl.dataset.listing_price);
      }
    }

    const href = offerButtonEl?.href || offerButtonEl?.getAttribute("href");
    if (!offerButtonEl || !href || href.startsWith("steam://") || !currencies) {
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

      offerButtonEl.href = url.toString();
      listingEl.setAttribute("data-params-added", "1");
    } catch (e) {
      listingEl.setAttribute("data-params-added", "1");
    }
  });
};
