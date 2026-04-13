import "@/styles/steam-tradeoffers.css";
import { ButtonConfig, AggregatedItem } from "@/types";
import {
  acceptOffer,
  declineOffer,
  cancelOffer,
  isOfferActive,
  getPartnerID,
  getOfferID,
} from "@/utils/offers";

import { getSettings } from "@/utils/settings";

export default defineContentScript({
  matches: [
    "https://steamcommunity.com/id/*/tradeoffers*",
    "https://steamcommunity.com/profiles/*/tradeoffers*",
  ],
  async main() {
    const settings = await getSettings();
    if (!settings.sites.steamTradeOffers) return;

    const REPORT_PATTERN = /ReportTradeScam\( ?'(\d{17})', ?"(.*)"\ ?\)/;
    const BUTTON_CONFIGS: ButtonConfig[] = [
      {
        title: "View %personaname%'s backpack",
        url: "https://backpack.tf/profiles/%steamid%",
        className: "backpack_btn",
      },
      {
        title: "View %personaname%'s Rep.tf page",
        url: "https://rep.tf/%steamid%",
        className: "rep_btn",
      },
    ];

    function resolveBanner(
      offerEl: HTMLElement,
      message: string,
      accepted = false,
    ): void {
      const offerContent = offerEl.querySelector<HTMLElement>(
        ".tradeoffer_items_ctn",
      );
      const middleEl = offerContent?.querySelector<HTMLElement>(
        ".tradeoffer_items_rule",
      );
      const footerEl = offerEl.querySelector<HTMLElement>(".tradeoffer_footer");

      if (footerEl) footerEl.style.display = "none";
      if (offerContent) {
        offerContent.classList.remove("active");
        offerContent.classList.add("inactive");
      }
      if (middleEl) {
        if (accepted) middleEl.classList.add("accepted");
        middleEl.classList.remove("tradeoffer_items_rule");
        middleEl.classList.add("tradeoffer_items_banner");
        middleEl.style.height = "";
        middleEl.innerText = message;
      }
    }

    function addAcceptButton(offerEl: HTMLElement): void {
      if (!isOfferActive(offerEl)) return;

      const offerID = getOfferID(offerEl);
      const partnerID = getPartnerID(offerEl);
      const actionsEl = offerEl.querySelector<HTMLElement>(
        ".tradeoffer_footer_actions",
      );

      if (!actionsEl) return;

      const acceptSpan = document.createElement("span");
      acceptSpan.id = `accept_${offerID}`;
      acceptSpan.className = "whiteLink";
      acceptSpan.textContent = "Accept Trade";

      const separator = document.createTextNode(" | ");

      actionsEl.prepend(separator);
      actionsEl.prepend(acceptSpan);

      acceptSpan.addEventListener("click", async () => {
        try {
          const res = await acceptOffer(offerID, partnerID);
          const awaiting =
            res.needs_email_confirmation || res.needs_mobile_confirmation;
          resolveBanner(
            offerEl,
            awaiting ? "Accepted - Awaiting Confirmation" : "Trade Accepted",
            !awaiting,
          );
        } catch (err) {
          console.error("Accept offer failed:", err);
          resolveBanner(
            offerEl,
            "Could not accept trade offer, most likely Steam is having problems.",
          );
        }
      });
    }

    function replaceDeclineButton(offerEl: HTMLElement, isSent: boolean): void {
      const actionsEl = offerEl.querySelector<HTMLElement>(
        ".tradeoffer_footer_actions",
      );
      if (!actionsEl) return;

      const links =
        actionsEl.querySelectorAll<HTMLAnchorElement>("a.whiteLink");
      const declineAnchor = links[links.length - 1];
      if (!declineAnchor) return;

      const offerID = getOfferID(offerEl);
      const declineText = declineAnchor.innerText;
      declineAnchor.remove();

      const newDeclineSpan = document.createElement("span");
      newDeclineSpan.className = "whiteLink";
      newDeclineSpan.textContent = declineText;
      actionsEl.appendChild(newDeclineSpan);

      newDeclineSpan.addEventListener("click", async () => {
        try {
          if (isSent) {
            await cancelOffer(offerID);
            resolveBanner(offerEl, "Trade Cancelled");
          } else {
            await declineOffer(offerID);
            resolveBanner(offerEl, "Trade Declined");
          }
        } catch (err) {
          console.error("Decline/cancel offer failed:", err);
          resolveBanner(
            offerEl,
            "Could not decline offer, most likely Steam is having problems.",
          );
        }
      });
    }

    function addUserButtons(offerEl: HTMLElement): void {
      const reportButtonEl = offerEl.getElementsByClassName("btn_report")[0] as
        | HTMLElement
        | undefined;

      if (!reportButtonEl) return;

      const onclick = reportButtonEl.getAttribute("onclick") ?? "";
      const match = onclick.match(REPORT_PATTERN);

      if (match) {
        const [, steamid, personaname] = match;
        const html = buildButtonsHtml(steamid, personaname);
        reportButtonEl.insertAdjacentHTML("beforebegin", html);
      }

      reportButtonEl.remove();
    }

    function buildButtonsHtml(steamid: string, personaname: string): string {
      const replace = (str: string) =>
        str.replace("%personaname%", personaname).replace("%steamid%", steamid);

      return [...BUTTON_CONFIGS]
        .reverse()
        .map((btn) => {
          const href = replace(btn.url);
          const title = replace(btn.title);
          const classes = [
            btn.className,
            "btn_grey_grey",
            "btn_small",
            "btn_user_link",
          ].join(" ");
          return `<a href="${href}" title="${title}" class="${classes}">&nbsp;</a>`;
        })
        .join("");
    }

    const SORT_PRIORITIES = {
      app: ["440", "730"] as string[],
      color: [
        "rgb(134, 80, 172)",
        "rgb(170, 0, 0)",
        "rgb(207, 106, 50)",
        "rgb(56, 243, 171)",
        "rgb(77, 116, 85)",
        "rgb(71, 98, 145)",
        "rgb(250, 250, 250)",
        "rgb(125, 109, 0)",
      ] as string[],
    };

    function getClassInfo(itemEl: HTMLElement): string {
      return itemEl.getAttribute("data-economy-item") ?? "";
    }

    function summarizeItemLists(offerEl: HTMLElement): void {
      const itemsLists = Array.from(
        offerEl.getElementsByClassName("tradeoffer_item_list"),
      ) as HTMLElement[];

      for (const itemsEl of itemsLists) {
        const itemsArr = Array.from(
          itemsEl.getElementsByClassName("trade_item"),
        ) as HTMLElement[];

        const seen = new Set<string>();
        const hasDuplicates = itemsArr.some((el) => {
          const info = getClassInfo(el);
          if (seen.has(info)) return true;
          seen.add(info);
          return false;
        });

        if (itemsArr.length === 0 || !hasDuplicates) continue;

        const aggregated = aggregateItems(itemsArr);
        const sorted = sortItems(aggregated);

        renderSummarizedItems(itemsEl, sorted);
      }
    }

    function aggregateItems(itemsArr: HTMLElement[]): AggregatedItem[] {
      const map = new Map<string, AggregatedItem>();

      for (const itemEl of itemsArr) {
        const classinfo = getClassInfo(itemEl);

        if (map.has(classinfo)) {
          map.get(classinfo)!.count += 1;
        } else {
          const app = classinfo.replace("classinfo/", "").split("/")[0];
          map.set(classinfo, {
            el: itemEl,
            count: 1,
            props: { classinfo, app, color: itemEl.style.borderColor },
          });
        }
      }

      return Array.from(map.values());
    }

    function getSortIndex(priorities: string[], value: string): number {
      let index = priorities.indexOf(value);
      if (index === -1) {
        priorities.push(value);
        index = priorities.length - 1;
      }
      return index;
    }

    function sortItems(items: AggregatedItem[]): AggregatedItem[] {
      return [...items].sort((a, b) => {
        for (const key of ["app", "color", "count"] as const) {
          let sortA: number;
          let sortB: number;

          if (key === "count") {
            sortA = -a.count;
            sortB = -b.count;
          } else {
            sortA = getSortIndex(SORT_PRIORITIES[key], a.props[key]);
            sortB = getSortIndex(SORT_PRIORITIES[key], b.props[key]);
          }

          if (sortA !== sortB) return sortA - sortB;
        }
        return 0;
      });
    }

    function renderSummarizedItems(
      itemsEl: HTMLElement,
      sorted: AggregatedItem[],
    ): void {
      const fragment = document.createDocumentFragment();

      for (const { el, count } of sorted) {
        if (count > 1) {
          const badge = document.createElement("span");
          badge.classList.add("summary_badge");
          badge.textContent = String(count);
          el.appendChild(badge);
        }
        fragment.appendChild(el);
      }

      const clearEl = document.createElement("div");
      clearEl.style.clear = "both";
      fragment.appendChild(clearEl);

      itemsEl.innerHTML = "";
      itemsEl.appendChild(fragment);
    }

    function enhanceTradeOffers(): void {
      const isSent = window.location.pathname.includes("/tradeoffers/sent");

      const offers = Array.from(
        document.getElementsByClassName("tradeoffer"),
      ) as HTMLElement[];

      for (const offerEl of offers) {
        addUserButtons(offerEl);
        summarizeItemLists(offerEl);
        if (!isSent) addAcceptButton(offerEl);
        replaceDeclineButton(offerEl, isSent);
      }
    }

    enhanceTradeOffers();
  },
});
