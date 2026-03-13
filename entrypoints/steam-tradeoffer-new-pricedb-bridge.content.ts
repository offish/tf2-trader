// Runs in the default ISOLATED world on tradeoffer/new pages.
//
// The main content script (steam-tradeoffer-new) runs in world:MAIN and
// cannot fetch external URLs due to Steam's CSP.  It posts window messages
// here; this bridge forwards them to the background service worker (which is
// not subject to page CSPs) and returns the result.

export default defineContentScript({
  matches: ["https://steamcommunity.com/tradeoffer/new*"],
  runAt: "document_start",
  main() {
    window.addEventListener("message", async (e: MessageEvent) => {
      if (e.source !== window) return;

      if (e.data?.type === "tf2trader_pricedb_request") {
        const { sku, id } = e.data as { sku: string; id: string };
        const result = await browser.runtime.sendMessage({ type: "pricedb_fetch", sku });
        window.postMessage({ type: "tf2trader_pricedb_response", id, result }, "*");
        return;
      }

      if (e.data?.type === "tf2trader_pricedb_search_request") {
        const { query, id } = e.data as { query: string; id: string };
        const result = await browser.runtime.sendMessage({ type: "pricedb_search", query });
        window.postMessage({ type: "tf2trader_pricedb_search_response", id, result }, "*");
      }
    });
  },
});
