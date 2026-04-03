import { processListings } from "@/utils/backpack";
import { getSettings } from "@/utils/settings";
import { TAG_TO_QUALITY } from "@/utils/data";

export default defineContentScript({
  matches: ["*://next.backpack.tf/stats*"],

  async main() {
    const settings = await getSettings();
    if (!settings.sites.nextBackpackStats) return;

    const autobotEnabled =
      settings.autobot.enabled && settings.autobot.sites.nextBackpackStats;

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
      document.getElementById("tf2trader-autobot-btn")?.remove();
    };

    function insertAutobotButton(sku: string) {
      if (document.getElementById("tf2trader-autobot-btn")) return;

      const btn = document.createElement("button");
      btn.id = "tf2trader-autobot-btn";
      btn.textContent = "Copy !add";
      btn.title = `!add sku=${sku}`;
      btn.style.cssText =
        "background:#1a3a1a;border:1px solid #67d45e;color:#67d45e;" +
        "padding:4px 10px;border-radius:4px;cursor:pointer;font-size:13px;margin-left:10px;";
      btn.addEventListener("click", () => {
        navigator.clipboard.writeText(`!add sku=${sku}`);
        btn.textContent = "Copied!";
        setTimeout(() => {
          btn.textContent = "Copy !add";
        }, 1500);
      });

      const title = document.querySelector<HTMLElement>(
        ".item-name, .stats-header-title, h1, h2",
      );
      if (title?.parentElement) {
        title.parentElement.insertBefore(btn, title.nextSibling);
      }
    }

    async function buildSkuFromUrl(): Promise<string | null> {
      const parts = window.location.pathname.split("/").filter(Boolean);
      if (parts.length < 5) return null;
      const qualityName = decodeURIComponent(parts[1]);
      const itemName = decodeURIComponent(parts[2]);
      const qualityId = TAG_TO_QUALITY[qualityName];
      if (qualityId === undefined) return null;
      const lastPart = parts[parts.length - 1];
      const effectId =
        parts.length >= 6 && /^\d+$/.test(lastPart)
          ? parseInt(lastPart, 10)
          : null;
      const result = (await browser.runtime.sendMessage({
        type: "pricedb_search",
        query: itemName,
      })) as { keys: number; metal: number; sku: string } | null;
      if (!result?.sku) return null;
      const defindex = result.sku.split(";")[0];
      let sku = `${defindex};${qualityId}`;
      if (qualityId === 5 && effectId !== null) sku += `;u${effectId}`;
      return sku;
    }

    async function tryInsertAutobotButton() {
      if (!autobotEnabled) return;
      if (document.getElementById("tf2trader-autobot-btn")) return;
      const sku = getSku() ?? (await buildSkuFromUrl());
      if (sku) insertAutobotButton(sku);
    }

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
        tryInsertAutobotButton();
      }, 300);
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });
  },
});
