import { processListings } from "@/utils/backpack";
import { createPricedbGraphIframe } from "@/utils/graph";

export default defineContentScript({
  matches: ["*://next.backpack.tf/stats*"],

  main() {
    let inserted = false;
    let lastUrl = location.href;

    const getSku = (): string | null => {
      const link = document.querySelector(
        'a[href*="marketplace.tf/items/tf2/"]',
      );
      const href = link?.getAttribute("href");
      if (!href) return null;
      return href.split("/tf2/")[1]?.split("?")[0] ?? null;
    };

    const insertGraph = () => {
      if (inserted || document.getElementById("pricedb-graph-wrapper")) return;

      const content = document.getElementById("content");
      if (!content) return;

      const suggestionsWrapper = Array.from(content.children).find((el) => {
        const header = el.querySelector(".card__header__title span");
        return header?.textContent?.trim() === "Suggestions";
      });

      if (!suggestionsWrapper) return;

      const sku = getSku();
      if (!sku) return;

      const graph = document.createElement("div");
      graph.id = "pricedb-graph-wrapper";
      graph.className = "col-12";

      graph.innerHTML = `
        <div class="card p-2" style="background: #273241; border: 1px solid #222;">
          <iframe
            src="https://pricedb.io/api/graph/${sku}"
            style="width: 100%; height: 500px; border: none; border-radius: 4px;"
          ></iframe>
        </div>
      `;

      content.insertBefore(graph, suggestionsWrapper);
      inserted = true;
    };

    const reset = () => {
      inserted = false;
      document.getElementById("pricedb-graph-wrapper")?.remove();
    };

    let debounceTimer: ReturnType<typeof setTimeout> | null = null;

    const observer = new MutationObserver(() => {
      if (location.href !== lastUrl) {
        lastUrl = location.href;
        reset();
      }

      if (debounceTimer) clearTimeout(debounceTimer);
      debounceTimer = setTimeout(() => {
        processListings();
        insertGraph();
      }, 300);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  },
});
