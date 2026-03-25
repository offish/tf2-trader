// Runs in the default ISOLATED world on Steam inventory pages.
//
// The main inventory content script (steam-inventory) runs in world:MAIN and
// cannot fetch external URLs due to Steam's CSP.  It posts window messages
// here; this bridge forwards them to the background service worker (which is
// not subject to page CSPs) and returns the result.
//
// Handles the same message types as tradeoffer-pricedb-bridge so the inventory
// content script can reuse fetchPricedbSearch from pricedb-ipc.ts directly.

export default defineContentScript({
  matches: [
    "*://steamcommunity.com/id/*/inventory*",
    "*://steamcommunity.com/profiles/*/inventory*",
  ],
  runAt: "document_start",
  main() {
    window.addEventListener("message", (e: MessageEvent) => {
      if (e.source !== window) return;

      if (e.data?.type === "tf2trader_pricedb_request") {
        const { sku, id } = e.data as { sku: string; id: string };
        browser.runtime.sendMessage({ type: "pricedb_fetch", sku })
          .then((result) => window.postMessage({ type: "tf2trader_pricedb_response", id, result }, "*"))
          .catch(() => window.postMessage({ type: "tf2trader_pricedb_response", id, result: null }, "*"));
        return;
      }

      if (e.data?.type === "tf2trader_pricedb_search_request") {
        const { query, id } = e.data as { query: string; id: string };
        browser.runtime.sendMessage({ type: "pricedb_search", query })
          .then((result) => window.postMessage({ type: "tf2trader_pricedb_search_response", id, result }, "*"))
          .catch(() => window.postMessage({ type: "tf2trader_pricedb_search_response", id, result: null }, "*"));
      }
    });
  },
});
