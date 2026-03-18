export default defineBackground(() => {
  // Proxy PriceDB requests from content scripts running in world:MAIN.
  // Those scripts are subject to the host page's CSP and cannot fetch
  // external URLs directly; the background service worker is not.
  //
  // Must use the explicit sendResponse + `return true` pattern — returning a
  // Promise from an async listener is unreliable when other extensions (e.g.
  // Steam Inventory Helper) also have onMessage listeners, causing the channel
  // to close before the response arrives.
  browser.runtime.onMessage.addListener(
    (
      message: unknown,
      _sender: unknown,
      sendResponse: (r: unknown) => void,
    ) => {
      const msg = message as { type?: string; sku?: string; query?: string };

      if (msg?.type === "pricedb_fetch" && msg.sku) {
        fetch(`https://pricedb.io/api/item/${encodeURIComponent(msg.sku)}`)
          .then(async (res) => {
            if (!res.ok) {
              sendResponse(null);
              return;
            }
            const data = await res.json();
            const price = data?.price ?? data?.sell ?? data;
            const keys = typeof price?.keys === "number" ? price.keys : 0;
            const metal = typeof price?.metal === "number" ? price.metal : 0;
            sendResponse(keys === 0 && metal === 0 ? null : { keys, metal });
          })
          .catch(() => sendResponse(null));
        return true;
      }

      if (msg?.type === "pricedb_search" && msg.query) {
        // "Mann Co. Supply Crate Series #75" → "Mann Co. Supply Crate #75"
        const q = (msg.query as string).replace(/\bSeries\s+(?=#\d)/i, "");
        fetch(`https://pricedb.io/api/search?q=${encodeURIComponent(q)}`)
          .then(async (res) => {
            if (!res.ok) {
              sendResponse(null);
              return;
            }
            const data = await res.json();
            if (data?.data?.total !== 1) {
              sendResponse(null);
              return;
            }
            const item = data.data.results[0];
            const price = item.sell ?? item.buy ?? {};
            const keys = typeof price?.keys === "number" ? price.keys : 0;
            const metal = typeof price?.metal === "number" ? price.metal : 0;
            sendResponse(
              keys === 0 && metal === 0 ? null : { keys, metal, sku: item.sku },
            );
          })
          .catch(() => sendResponse(null));
        return true;
      }

      return false; // not our message
    },
  );
});
