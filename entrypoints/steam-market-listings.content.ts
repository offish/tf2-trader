import "@/styles/steam-market-listings.css";
import { addAttributesToElement } from "@/utils/inventory";
import { getSettingsFromBridge } from "@/utils/settings-bridge";
// import { fetchPricedbSearch } from "@/utils/pricedb-ipc";

export default defineContentScript({
  matches: ["*://steamcommunity.com/market/listings/440/*"],
  world: "MAIN",

  async main() {
    const settings = await getSettingsFromBridge();

    if (!settings.sites.steamMarket) return;

    // const autobotEnabled =
    //   settings.autobot.enabled && settings.autobot.sites.steamMarket;

    const getItemIdsFromRow = (rowEl: HTMLElement) => {
      const buyButtonLinkEl = rowEl.querySelector(
        "div.market_listing_buy_button a",
      );
      if (!buyButtonLinkEl) return null;

      const href = buyButtonLinkEl.getAttribute("href") || "";
      const params = href
        .replace("javascript:BuyMarketListing", "")
        .replace(/[\,\(/) ]/g, "");
      const split = params.split(/'(.+?)'/g).filter(Boolean);

      return {
        appid: split[2],
        contextid: split[3],
        assetid: split[4],
      };
    };

    const getAssetData = (ids: {
      appid: string;
      contextid: string;
      assetid: string;
    }) => {
      const win = window as any;
      const assets = win.g_rgAssets;
      const asset = assets?.[ids.appid]?.[ids.contextid]?.[ids.assetid];
      return asset;
    };

    const addAttributesToResults = () => {
      const resultsRows = document.getElementById("searchResultsRows");

      if (!resultsRows) return;

      const rowsList = resultsRows.getElementsByClassName("market_listing_row");

      Array.from(rowsList).forEach((row) => {
        const rowEl = row as HTMLElement;
        if (rowEl.hasAttribute("data-checked")) return;

        const ids = getItemIdsFromRow(rowEl);
        const asset = ids ? getAssetData(ids) : null;

        if (!asset) return;

        const itemImgContainerEl = rowEl.querySelector(
          "div.market_listing_item_img_container",
        );
        const itemImgEl = itemImgContainerEl?.querySelector(
          "img.market_listing_item_img",
        ) as HTMLImageElement;

        if (itemImgContainerEl && itemImgEl) {
          const itemWrapper = document.createElement("div");
          const imgSrc = itemImgEl.getAttribute("src");

          itemWrapper.classList.add(
            "market_listing_item_img",
            "economy_item_hoverable",
          );
          itemWrapper.setAttribute(
            "style",
            itemImgEl.getAttribute("style") || "",
          );
          itemWrapper.style.position = "relative";
          itemWrapper.style.backgroundImage = `url('${imgSrc}')`;

          itemImgEl.classList.remove("market_listing_item_img");
          itemImgEl.style.backgroundColor = "transparent";

          itemImgEl.parentNode?.replaceChild(itemWrapper, itemImgEl);
          itemWrapper.appendChild(itemImgEl);
          addAttributesToElement(itemWrapper, asset);
          rowEl.setAttribute("data-checked", "1");
        }
      });
    };

    function getItemNameFromUrl(): string | null {
      try {
        const url = new URL(window.location.href);
        const pathParts = url.pathname.split("/");
        const lastPart = pathParts[pathParts.length - 1];

        if (lastPart) {
          const itemName = decodeURIComponent(lastPart);
          console.log("Extracted Item Name:", itemName);
          return itemName;
        }
      } catch (e) {
        console.error("Failed to parse name from URL", e);
      }

      return null;
    }

    const resultsRows = document.getElementById("searchResultsRows");
    if (resultsRows) {
      const observer = new MutationObserver(addAttributesToResults);
      observer.observe(resultsRows, { childList: true });

      addAttributesToResults();
    }

    const fullName = getItemNameFromUrl();

    const sites = [
      {
        name: "Skinport.com",
        url: `https://skinport.com/market/440?search=${encodeURIComponent(fullName ?? "")}&r=guidetf`,
        icon: "https://skinport.com/favicon.ico",
      },
      {
        name: "ManncoStore",
        url: "https://mannco.store/?ref=guidetf",
        icon: "https://mannco.store/statics/img/logo.svg",
      },
      {
        name: "Tradeit.gg",
        url: "https://tradeit.gg/tf2/trade?aff=guide",
        icon: "https://tradeit.gg/images/logo-full.svg",
      },
      {
        name: "MarketplaceTF",
        url: "https://marketplace.tf/",
        icon: "https://marketplace.tf/favicon.ico",
      },
      {
        name: "MerchantTF",
        url: "https://merchant.tf/r/guide",
        icon: "https://merchant.tf/favicon.ico",
      },
      {
        name: "CS.TRADE",
        url: "https://cs.trade/ref/TF2GUIDES",
        icon: "https://cs.trade/favicon.ico",
      },
      {
        name: "SkinsCash",
        url: "https://skins.cash/user/ref/76561198253325712",
        icon: "https://skins.cash/favicon.ico",
      },
      {
        name: "CTrade.tf",
        url: "https://ctrade.tf?referred_by=CONFERN",
        icon: "https://ctrade.tf/icon.ico",
      },
    ];

    const buildReferralBlock = () => {
      const referralContainer = document.createElement("div");
      referralContainer.className = "referral-container";
      referralContainer.style.cssText =
        "display:block;overflow:visible;padding:12px 0;margin:8px 0;";

      const title = document.createElement("span");
      title.className = "sites_ad_title";
      title.style.cssText =
        "display:block;font-size:1.25em;color:#cde46f;margin-bottom:8px;";
      title.textContent =
        "You can save 20-35% by buying this item on these trusted marketplaces:";
      referralContainer.appendChild(title);

      const adsContainer = document.createElement("div");
      adsContainer.className = "tf2t-site-ads";
      adsContainer.style.setProperty("display", "flex", "important");
      adsContainer.style.cssText +=
        "flex-wrap:wrap;align-items:flex-start;justify-content:center;gap:25px;margin:10px auto;max-width:100%;overflow:visible;height:auto;";
      adsContainer.style.setProperty("display", "flex", "important");

      sites.forEach((site) => {
        const siteAd = document.createElement("div");
        siteAd.className = "tf2t-site-ad";
        siteAd.style.setProperty("display", "block", "important");
        siteAd.style.cssText += "text-align:center;flex:0 0 auto;";
        siteAd.style.setProperty("display", "block", "important");

        const link = document.createElement("a");
        link.href = site.url;
        link.target = "_blank";
        link.rel = "noopener noreferrer";
        link.className = "tf2t-site-ad-link";
        link.style.setProperty("display", "inline-block", "important");
        link.style.cssText +=
          "text-decoration:none;color:inherit;white-space:nowrap;font-size:1.1rem;";
        link.style.setProperty("display", "inline-block", "important");

        const iconWrapper = document.createElement("div");
        iconWrapper.style.setProperty("display", "block", "important");

        const img = document.createElement("img");
        img.alt = site.name;
        img.src = site.icon;
        img.style.setProperty("display", "block", "important");
        img.style.cssText +=
          "margin:0 auto 5px;height:50px;max-width:100%;object-fit:contain;";
        img.style.setProperty("display", "block", "important");
        iconWrapper.appendChild(img);

        const nameSpan = document.createElement("span");
        nameSpan.className = "tf2t-site-ad-name";
        nameSpan.style.setProperty("display", "block", "important");
        nameSpan.textContent = site.name;

        link.appendChild(iconWrapper);
        link.appendChild(nameSpan);
        siteAd.appendChild(link);
        adsContainer.appendChild(siteAd);
      });

      referralContainer.appendChild(adsContainer);

      // TODO: fix, does not find sku nor copy to clipboard
      // if (autobotEnabled) {
      //   const autobotRow = document.createElement("div");
      //   autobotRow.id = "tf2trader-autobot-row";
      //   autobotRow.style.cssText = "margin-top:10px;";

      //   const autobotBtn = document.createElement("button");
      //   autobotBtn.id = "tf2trader-autobot-btn";
      //   autobotBtn.textContent = "Copy !add";
      //   autobotBtn.style.cssText =
      //     "background:#1a3a1a;border:1px solid #67d45e;color:#67d45e;" +
      //     "padding:6px 12px;border-radius:4px;cursor:pointer;font-size:13px;";
      //   autobotBtn.title = "Resolve SKU and copy !add command";

      //   const itemName = fullName;
      //   if (itemName) {
      //     fetchPricedbSearch(itemName).then((result) => {
      //       if (!result?.sku) return;
      //       const sku = result.sku;
      //       autobotBtn.title = `!add sku=${sku}`;
      //       autobotBtn.addEventListener("click", () => {
      //         navigator.clipboard.writeText(`!add sku=${sku}`);
      //         autobotBtn.textContent = "Copied!";
      //         setTimeout(() => {
      //           autobotBtn.textContent = "Copy !add";
      //         }, 1500);
      //       });
      //     });
      //   }

      //   autobotRow.appendChild(autobotBtn);
      //   referralContainer.appendChild(autobotRow);
      // }

      return referralContainer;
    };

    const tryInsertReferralBlock = () => {
      if (document.querySelector(".referral-container")) return true;

      const block = buildReferralBlock();

      // For commodity items: insert directly before the first
      // .market_commodity_orders_block (which contains the Buy button),
      // inside #market_commodity_order_spread so it sits right above the
      // buy/sell order tables.
      const firstOrdersBlock = document.querySelector<HTMLElement>(
        "#market_commodity_order_spread .market_commodity_orders_block",
      );

      if (firstOrdersBlock?.parentNode) {
        firstOrdersBlock.parentNode.insertBefore(block, firstOrdersBlock);
      } else {
        // Non-commodity fallback: after the large item info panel.
        const itemInfo =
          document.querySelector<HTMLElement>("#largeiteminfo_warning") ??
          document.querySelector<HTMLElement>("#largeiteminfo");
        if (!itemInfo?.parentNode) return false;
        itemInfo.parentNode.insertBefore(block, itemInfo.nextSibling);
      }

      // Force overflow:visible on all ancestors so the flex row isn't clipped.
      const fixOverflow = () => {
        let el: HTMLElement | null = block.parentElement;
        let depth = 0;
        while (el && el !== document.body && depth < 10) {
          const s = getComputedStyle(el);
          if (s.overflow !== "visible" || s.overflowY !== "visible") {
            el.style.setProperty("overflow", "visible", "important");
            el.style.setProperty("height", "auto", "important");
            el.style.setProperty("max-height", "none", "important");
          }
          el = el.parentElement;
          depth++;
        }
      };

      fixOverflow();
      requestAnimationFrame(fixOverflow);
      setTimeout(fixOverflow, 500);
      setTimeout(fixOverflow, 2000);

      return true;
    };

    if (!tryInsertReferralBlock()) {
      const observer = new MutationObserver(() => {
        if (tryInsertReferralBlock()) observer.disconnect();
      });
      observer.observe(document.body, { childList: true, subtree: true });
    }
  },
});
