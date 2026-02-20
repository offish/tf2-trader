import { Currencies } from "@/types";
export default defineContentScript({
  matches: [
    "*://backpack.tf/stats/*",
    "*://www.backpack.tf/stats/*",
    "*://backpack.tf/classifieds*",
    "*://www.backpack.tf/classifieds*",
  ],

  main() {
    const moveClassifiedsToTop = () => {
      const classifieds = document.querySelector("#classifieds");

      if (!classifieds) return;

      const parentPanel = classifieds.closest(".stats-body");
      const relatedGutter = classifieds.nextElementSibling;

      if (parentPanel) {
        if (relatedGutter && relatedGutter.classList.contains("guttered")) {
          parentPanel.prepend(relatedGutter);
        }
        parentPanel.prepend(classifieds);
      }
    };

    const stringToCurrencies = (str: string | undefined): Currencies | null => {
      if (!str) return null;

      const prices = str.split(",");
      const currencies: Currencies = {};

      for (const price of prices) {
        const match = price.trim().match(/^([\d\.]*) (\w*)$/i);
        if (!match) continue;

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

      return Object.keys(currencies).length === 0 ? null : currencies;
    };

    const processListings = () => {
      const listings = document.getElementsByClassName("listing");

      Array.from(listings).forEach((listing) => {
        const listingEl = listing as HTMLElement;
        if (listingEl.hasAttribute("data-params-added")) return;

        const itemEl = listingEl.querySelector(".item") as HTMLElement;
        const offerButtonEl = listingEl.querySelector(".listing-buttons")
          ?.lastElementChild as HTMLAnchorElement;
        const href = offerButtonEl.getAttribute("href");

        if (!itemEl || !offerButtonEl || !href || href?.startsWith("steam://"))
          return;

        const { listing_intent, listing_price } = itemEl.dataset;
        const currencies = stringToCurrencies(listing_price);

        if (!currencies) return;

        const params: Record<string, any> = {
          listing_intent: listing_intent === "buy" ? 0 : 1,
        };

        if (currencies.keys)
          params["listing_currencies_keys"] = currencies.keys;
        if (currencies.metal)
          params["listing_currencies_metal"] = currencies.metal;

        const queryString = Object.entries(params)
          .map(([k, v]) => `${k}=${v}`)
          .join("&");

        const newUrl = href.includes("?")
          ? `${href}&${queryString}`
          : `${href}?${queryString}`;

        offerButtonEl.setAttribute("href", newUrl);
        listingEl.setAttribute("data-params-added", "1");
      });
    };

    const contentWrapper =
      document.querySelector(".main-content") || document.body;
    const observer = new MutationObserver(processListings);

    observer.observe(contentWrapper, {
      childList: true,
      subtree: true,
    });

    moveClassifiedsToTop();
    processListings();
  },
});
