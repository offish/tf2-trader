import { processListings } from "@/utils/backpack";
import { createPricedbGraphIframe } from "@/utils/graph";

export default defineContentScript({
  matches: ["*://next.backpack.tf/stats*"],

  main() {
    let isReordering = false;

    const getSku = (): string | null => {
      const link = document.querySelector(
        'a[href*="marketplace.tf/items/tf2/"]',
      );
      return (
        link?.getAttribute("href")?.match(/tf2\/(\d+;\d+;[a-zA-Z0-9]+)/)?.[1] ||
        null
      );
    };

    const organizeLayout = () => {
      if (isReordering) return;

      const container = document.getElementById("content");
      if (!container) return;

      const columns = Array.from(container.children);

      const buyOrders = columns.find((el) =>
        el.textContent?.includes("Buy Orders"),
      );
      const sellOrders = columns.find((el) =>
        el.textContent?.includes("Sell Orders"),
      );
      const trends = columns.find((el) =>
        el.textContent?.includes("Classifieds Trends"),
      );
      const history = columns.find((el) => el.textContent?.includes("History"));
      const suggestions = columns.find((el) =>
        el.textContent?.includes("Suggestions"),
      );

      let graph = document.getElementById("pricedb-graph-wrapper");

      if (!graph) {
        const sku = getSku();
        if (sku) {
          graph = document.createElement("div");
          graph.id = "pricedb-graph-wrapper";
          graph.className = "col-12 mb-3";
          const card = document.createElement("div");
          card.className = "card p-2";
          card.style.cssText = "background:#273241;border:1px solid #222;";
          card.appendChild(createPricedbGraphIframe(sku));
          graph.appendChild(card);
          container.appendChild(graph);
        }
      }

      isReordering = true;

      if (
        sellOrders &&
        buyOrders &&
        sellOrders.nextElementSibling !== buyOrders
      ) {
        sellOrders.after(buyOrders);
      }

      if (graph && buyOrders && graph.previousElementSibling !== buyOrders) {
        buyOrders.after(graph);
      }

      if (trends && graph && trends.previousElementSibling !== graph) {
        graph.after(trends);
      }

      if (history && trends && history.previousElementSibling !== trends) {
        trends.after(history);
      }

      if (
        suggestions &&
        history &&
        suggestions.previousElementSibling !== history
      ) {
        history.after(suggestions);
      }

      isReordering = false;
    };

    const observer = new MutationObserver(() => {
      processListings();
      organizeLayout();
    });

    observer.observe(document.body, { childList: true, subtree: true });

    const forceRender = () => {
      const content = document.getElementById("content");
      if (content) {
        window.dispatchEvent(new Event("scroll"));
        window.scrollBy(0, 1);
        setTimeout(() => window.scrollBy(0, -1), 50);
      }
    };

    organizeLayout();
    [200, 1000, 2500].forEach((delay) => setTimeout(forceRender, delay));
  },
});
