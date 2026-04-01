import { fetchPricedbPrice, sideValueInKeys } from "./pricedb-ipc";


function mkUnpricedSection(names: string[], side: string): string {
  if (names.length === 0) return "";
  const items = names
    .map((n) => `<li style="margin:0;padding:1px 0;">${n}</li>`)
    .join("");
  return `
    <details style="margin-bottom:6px;">
      <summary style="cursor:pointer;color:#8f98a0;font-size:11px;user-select:none;list-style:none;outline:none;">
        ${side}: ${names.length} unpriced item${names.length > 1 ? "s" : ""} ▸
      </summary>
      <ul style="margin:4px 0 0 8px;padding:0;color:#8f98a0;font-size:11px;list-style:disc;">${items}</ul>
    </details>
  `;
}

export async function renderValuePanel(
  giveAssets: Array<{ assetid: string }>,
  recvAssets: Array<{ assetid: string }>,
  giveRgMap: Record<string, any>,
  recvRgMap: Record<string, any>,
): Promise<void> {
  const keyData = await fetchPricedbPrice("5021;6");
  const keyPriceRef = keyData?.metal ?? 0;

  const [giveVal, recvVal] = await Promise.all([
    sideValueInKeys(giveAssets, giveRgMap, keyPriceRef),
    sideValueInKeys(recvAssets, recvRgMap, keyPriceRef),
  ]);

  const fmtKeys = (v: { total: number }) => {
    const rounded = Math.max(0, Math.round(v.total * 100) / 100) || 0;
    return `${rounded} keys`;
  };

  const existing = document.getElementById("tf2trader-value-panel");
  if (existing) existing.remove();

  const panel = document.createElement("div");
  panel.id = "tf2trader-value-panel";
  panel.style.cssText = [
    "position:fixed",
    "bottom:20px",
    "right:20px",
    "background:#1d1d1d",
    "border:1px solid #3d3d3e",
    "border-radius:5px",
    "color:#c6d4df",
    "font-size:12px",
    "font-family:'Motiva Sans',Arial,sans-serif",
    "padding:12px 16px",
    "z-index:99999",
    "min-width:220px",
    "box-shadow:0 4px 16px rgba(0,0,0,0.7)",
    "line-height:1.5",
  ].join(";");

  const hasUnpriced =
    giveVal.unpricedNames.length > 0 || recvVal.unpricedNames.length > 0;

  panel.innerHTML = `
    <div style="display:flex;align-items:center;gap:6px;font-weight:bold;margin-bottom:10px;padding-bottom:8px;border-bottom:1px solid #3d3d3e;color:#67D35E;font-size:13px;">
      Value Estimate
    </div>
    <div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:4px;">
      <span style="color:#8f98a0;">You give</span>
      <strong style="color:#fff;">${fmtKeys(giveVal)}</strong>
    </div>
    <div style="display:flex;justify-content:space-between;gap:16px;margin-bottom:${hasUnpriced ? "10" : "8"}px;">
      <span style="color:#8f98a0;">You receive</span>
      <strong style="color:#fff;">${fmtKeys(recvVal)}</strong>
    </div>
    ${hasUnpriced ? `<div style="border-top:1px solid #3d3d3e;padding-top:8px;margin-bottom:6px;">${mkUnpricedSection(giveVal.unpricedNames, "Giving")}${mkUnpricedSection(recvVal.unpricedNames, "Receiving")}</div>` : ""}
    <div style="font-size:11px;color:#8f98a0;padding-top:6px;border-top:1px solid #3d3d3e;">
      via <a href="https://pricedb.io" target="_blank" rel="noopener" style="color:#67C1F5;text-decoration:none;">PriceDB.io</a>
    </div>
  `;

  document.body.appendChild(panel);
}

// Watches both trade-slot containers and refreshes the panel whenever items
// are added or removed — works on any tradeoffer/new page.
export function startLiveValuePanel(): void {
  const win = window as any;
  let debounce: ReturnType<typeof setTimeout> | null = null;

  const refresh = async () => {
    const status = win.g_rgCurrentTradeStatus;
    if (!status) return;

    const myAssets = (status.me?.assets ?? []) as Array<{ assetid: string }>;
    const theirAssets = (status.them?.assets ?? []) as Array<{
      assetid: string;
    }>;

    if (myAssets.length === 0 && theirAssets.length === 0) {
      document.getElementById("tf2trader-value-panel")?.remove();
      return;
    }

    const myInv: Record<string, any> =
      win.UserYou?.rgContexts?.["440"]?.["2"]?.inventory?.rgInventory ?? {};
    const theirInv: Record<string, any> =
      win.UserThem?.rgContexts?.["440"]?.["2"]?.inventory?.rgInventory ?? {};

    try {
      await renderValuePanel(myAssets, theirAssets, myInv, theirInv);
    } catch (e) {
      console.warn("[tf2-trader] Live value panel error:", e);
    }
  };

  const schedule = () => {
    if (debounce) clearTimeout(debounce);
    debounce = setTimeout(refresh, 600);
  };

  const observe = () => {
    const yours = document.getElementById("your_slots");
    const theirs = document.getElementById("their_slots");
    if (!yours || !theirs) {
      setTimeout(observe, 500);
      return;
    }
    const obs = new MutationObserver(schedule);
    obs.observe(yours, { childList: true, subtree: true });
    obs.observe(theirs, { childList: true, subtree: true });
  };
  observe();
}
