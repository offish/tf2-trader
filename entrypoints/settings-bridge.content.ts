import { getSettings } from "@/utils/settings";

/**
 * Bridges settings from browser.storage.local (accessible only in ISOLATED
 * world) to MAIN-world content scripts via window.postMessage.
 *
 * MAIN scripts post: { type: "tf2trader_settings_request", id: string }
 * This script responds: { type: "tf2trader_settings_response", id, settings }
 */
export default defineContentScript({
  matches: [
    "*://steamcommunity.com/",
    "*://backpack.tf/",
    "*://next.backpack.tf/",
    "*://marketplace.tf/",
    "*://stntrading.eu/",
    "*://scrap.tf/",
    "*://pricedb.io/",
  ],
  world: "ISOLATED",
  runAt: "document_start",

  main() {
    window.addEventListener("message", async (e: MessageEvent) => {
      if (e.source !== window) return;
      if (e.data?.type !== "tf2trader_settings_request") return;

      const id = e.data?.id as string | undefined;
      const settings = await getSettings();
      window.postMessage(
        { type: "tf2trader_settings_response", id, settings },
        "*",
      );
    });
  },
});
