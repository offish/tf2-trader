import { Currencies } from "@/types";

export default defineContentScript({
  matches: ["*://next.backpack.tf/stats*", "*://next.backpack.tf/classifieds*"],

  main() {
    const stringToCurrencies = (str: string | undefined): Currencies | null => {
      if (!str) return null;

      // Clean up the string: "  11.77 ref  " -> "11.77 ref"
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

    const processListings = () => {
      // backpack.tf Next uses .listing
      const listings = document.querySelectorAll(".listing");

      listings.forEach((listingEl) => {
        if (listingEl.hasAttribute("data-params-added")) return;

        // 1. Find the Offer Button (the trade/add friend icon)
        const actionsWrapper = listingEl.querySelector(
          ".listing__details__actions",
        );
        const offerButtonEl =
          actionsWrapper?.lastElementChild as HTMLAnchorElement;
        if (!offerButtonEl || !offerButtonEl.href) return;

        const href = offerButtonEl.href;

        // 2. SKIP STEAM LINKS IMMEDIATELY
        if (href.startsWith("steam:")) {
          listingEl.setAttribute("data-params-added", "1");
          return;
        }

        // 3. GET INTENT
        // Check for 'text-sell' or 'text-buy' classes in the header icon
        const intentEl = listingEl.querySelector(
          ".listing__details__header .text-sell, .listing__details__header .text-buy",
        );
        const isSellOrder = intentEl?.classList.contains("text-sell");
        const listing_intent = isSellOrder ? "sell" : "buy";

        // 4. GET PRICE
        const priceEl = listingEl.querySelector(".item__price");
        if (!priceEl) return;

        // innerText will get "11.77 ref" without the SVG icon text
        const currencies = stringToCurrencies(priceEl.textContent || "");
        if (!currencies) return;

        // 5. CONSTRUCT URL
        try {
          const url = new URL(href);

          url.searchParams.set(
            "listing_intent",
            listing_intent === "buy" ? "0" : "1",
          );

          if (currencies.keys) {
            url.searchParams.set(
              "listing_currencies_keys",
              currencies.keys.toString(),
            );
          }
          if (currencies.metal) {
            url.searchParams.set(
              "listing_currencies_metal",
              currencies.metal.toString(),
            );
          }

          offerButtonEl.href = url.toString();
          listingEl.setAttribute("data-params-added", "1");

          console.log(
            `✅ Success: Updated ${listing_intent} listing to ${url.toString()}`,
          );
        } catch (e) {
          listingEl.setAttribute("data-params-added", "1");
        }
      });
    };

    const contentWrapper =
      document.querySelector(".main-content") || document.body;
    const observer = new MutationObserver(processListings);

    observer.observe(contentWrapper, {
      childList: true,
      subtree: true,
    });

    processListings();
  },
});
