import { getSettingsFromBridge } from "@/utils/settings-bridge";

export default defineContentScript({
  matches: [
    "*://steamcommunity.com/id/*",
    "*://steamcommunity.com/profiles/*",
  ],
  world: "MAIN",
  runAt: "document_idle",
  async main() {
    const settings = await getSettingsFromBridge();
    if (!settings.sites.steamProfile) return;

    // Only run on the profile root, not on sub-pages like /inventory/, /tradeoffers/, etc.
    const pathParts = window.location.pathname.split("/").filter(Boolean);
    if (pathParts.length > 2) return;

    const steam64 = await getSteam64();
    if (!steam64) return;

    const ids = buildIds(steam64);
    addSteamIdButton(ids);
    addSidebarLinks(steam64);
  },
});

// ---------------------------------------------------------------------------
// Steam64 resolution
// ---------------------------------------------------------------------------

// For /profiles/<steam64> the ID is right in the URL.
// For /id/<vanityname> we fetch the profile as XML (same origin) which
// includes a <steamID64> element – avoids relying on g_steamID which
// returns the *logged-in* user's ID rather than the profile being viewed.
async function getSteam64(): Promise<string | null> {
  const profileMatch = window.location.pathname.match(/\/profiles\/(\d{17})/);
  if (profileMatch) return profileMatch[1];

  try {
    const res = await fetch(
      `${window.location.origin}${window.location.pathname}?xml=1`,
    );
    if (!res.ok) return null;
    const text = await res.text();
    return text.match(/<steamID64>(\d+)<\/steamID64>/)?.[1] ?? null;
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Steam ID conversion
// ---------------------------------------------------------------------------

interface SteamIdEntry {
  label: string;
  value: string;
}

function buildIds(steam64: string): SteamIdEntry[] {
  const steam64n = BigInt(steam64);
  const BASE = 76561197960265728n;
  const accountId = steam64n - BASE;
  const authBit = accountId & 1n;
  const accountNum = accountId >> 1n;

  return [
    { label: "Steam64", value: steam64 },
    { label: "SteamID2", value: `STEAM_0:${authBit}:${accountNum}` },
    { label: "SteamID3", value: `[U:1:${accountId}]` },
    { label: "Steam32 / AccountID", value: String(accountId) },
  ];
}

// ---------------------------------------------------------------------------
// Header button
// ---------------------------------------------------------------------------

function addSteamIdButton(ids: SteamIdEntry[]) {
  if (document.getElementById("tf2trader_steamid_btn")) return;

  const actionsEl = document.querySelector<HTMLElement>(
    ".profile_header_actions",
  );
  if (!actionsEl) return;

  const btn = document.createElement("a");
  btn.id = "tf2trader_steamid_btn";
  btn.className = "btn_profile_action btn_medium";
  btn.style.cursor = "pointer";
  btn.style.marginLeft = "8px";
  const btnSpan = document.createElement("span");
  btnSpan.textContent = "Steam IDs";
  btn.appendChild(btnSpan);
  btn.addEventListener("click", (e) => {
    e.preventDefault();
    openModal(ids);
  });
  actionsEl.appendChild(btn);
}

// ---------------------------------------------------------------------------
// Modal
// ---------------------------------------------------------------------------

function openModal(ids: SteamIdEntry[]) {
  document.getElementById("tf2trader_modal_overlay")?.remove();

  const overlay = document.createElement("div");
  overlay.id = "tf2trader_modal_overlay";
  Object.assign(overlay.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    background: "rgba(0,0,0,0.7)",
    zIndex: "9999",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
  } satisfies Partial<CSSStyleDeclaration>);

  const modal = document.createElement("div");
  Object.assign(modal.style, {
    background: "#1b2838",
    border: "1px solid #4b619a",
    borderRadius: "4px",
    padding: "20px 24px",
    minWidth: "440px",
    maxWidth: "560px",
    color: "#c6d4df",
    fontFamily: "'Motiva Sans', Arial, sans-serif",
    position: "relative",
    boxSizing: "border-box",
  } satisfies Partial<CSSStyleDeclaration>);

  // Title row
  const title = document.createElement("h3");
  title.textContent = "Steam IDs";
  Object.assign(title.style, {
    margin: "0 0 14px 0",
    color: "#c6d4df",
    fontSize: "16px",
    fontWeight: "normal",
    borderBottom: "1px solid #4b619a",
    paddingBottom: "10px",
    paddingRight: "24px",
  } satisfies Partial<CSSStyleDeclaration>);
  modal.appendChild(title);

  // Close button
  const closeBtn = document.createElement("span");
  closeBtn.textContent = "✕";
  Object.assign(closeBtn.style, {
    position: "absolute",
    top: "14px",
    right: "16px",
    cursor: "pointer",
    fontSize: "16px",
    color: "#8ba2b5",
    lineHeight: "1",
  } satisfies Partial<CSSStyleDeclaration>);
  closeBtn.addEventListener("mouseenter", () => {
    closeBtn.style.color = "#c6d4df";
  });
  closeBtn.addEventListener("mouseleave", () => {
    closeBtn.style.color = "#8ba2b5";
  });
  closeBtn.addEventListener("click", () => overlay.remove());
  modal.appendChild(closeBtn);

  // ID rows
  for (const { label, value } of ids) {
    const row = document.createElement("div");
    Object.assign(row.style, {
      display: "flex",
      alignItems: "center",
      marginBottom: "10px",
      gap: "8px",
    } satisfies Partial<CSSStyleDeclaration>);

    const labelEl = document.createElement("span");
    labelEl.textContent = label;
    Object.assign(labelEl.style, {
      width: "150px",
      flexShrink: "0",
      fontSize: "13px",
      color: "#8ba2b5",
    } satisfies Partial<CSSStyleDeclaration>);

    const valueEl = document.createElement("code");
    valueEl.textContent = value;
    Object.assign(valueEl.style, {
      flex: "1",
      fontSize: "13px",
      background: "#2a475e",
      padding: "5px 8px",
      borderRadius: "3px",
      userSelect: "all",
      color: "#c6d4df",
      fontFamily: "monospace",
      overflow: "hidden",
      textOverflow: "ellipsis",
      whiteSpace: "nowrap",
    } satisfies Partial<CSSStyleDeclaration>);

    const copyBtn = document.createElement("button");
    copyBtn.textContent = "Copy";
    Object.assign(copyBtn.style, {
      background: "#4b619a",
      color: "#c6d4df",
      border: "none",
      borderRadius: "3px",
      padding: "5px 12px",
      cursor: "pointer",
      fontSize: "12px",
      flexShrink: "0",
      transition: "background 0.15s",
    } satisfies Partial<CSSStyleDeclaration>);
    copyBtn.addEventListener("click", () => {
      navigator.clipboard.writeText(value).then(() => {
        copyBtn.textContent = "Copied!";
        copyBtn.style.background = "#4a8a4a";
        setTimeout(() => {
          copyBtn.textContent = "Copy";
          copyBtn.style.background = "#4b619a";
        }, 1500);
      });
    });

    row.appendChild(labelEl);
    row.appendChild(valueEl);
    row.appendChild(copyBtn);
    modal.appendChild(row);
  }

  overlay.appendChild(modal);
  document.body.appendChild(overlay);

  overlay.addEventListener("click", (e) => {
    if (e.target === overlay) overlay.remove();
  });
}

// ---------------------------------------------------------------------------
// Sidebar links
// ---------------------------------------------------------------------------

function addSidebarLinks(steam64: string) {
  if (document.getElementById("tf2trader_profile_links")) return;

  const linksContainer = document.querySelector(".profile_item_links");
  if (!linksContainer) return;

  const SITES: { label: string; url: string }[] = [
    { label: "backpack.tf", url: `https://backpack.tf/profiles/${steam64}` },
    { label: "rep.tf", url: `https://rep.tf/${steam64}` },
    { label: "SteamRep", url: `https://steamrep.com/profiles/${steam64}` },
    {
      label: "marketplace.tf",
      url: `https://marketplace.tf/seller/${steam64}`,
    },
    { label: "posts.tf", url: `https://posts.tf/users/${steam64}` },
  ];

  const section = document.createElement("div");
  section.id = "tf2trader_profile_links";

  const divider = document.createElement("div");
  Object.assign(divider.style, {
    borderTop: "1px solid rgba(255,255,255,0.1)",
    margin: "8px 0 6px",
  } satisfies Partial<CSSStyleDeclaration>);
  section.appendChild(divider);

  for (const site of SITES) {
    const wrapper = document.createElement("div");
    wrapper.className = "profile_count_link";

    const a = document.createElement("a");
    a.href = site.url;
    a.target = "_blank";
    a.rel = "noopener noreferrer";

    const span = document.createElement("span");
    span.className = "count_link_label";
    span.textContent = site.label;

    a.appendChild(span);
    wrapper.appendChild(a);
    section.appendChild(wrapper);
  }

  linksContainer.appendChild(section);
}
