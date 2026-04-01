/**
 * Creates a PriceDB.io price history graph iframe for a given SKU.
 * The caller is responsible for wrapping and inserting the returned element.
 */
export function createPricedbGraphIframe(sku: string): HTMLIFrameElement {
  const iframe = document.createElement("iframe");
  iframe.src = `https://pricedb.io/api/graph/${encodeURIComponent(sku)}`;
  iframe.style.cssText =
    "width:100%;height:500px;border:none;border-radius:4px;";
  return iframe;
}
