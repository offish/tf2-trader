import "@/styles/steam-tradeoffers.css";
import { ButtonConfig, AggregatedItem } from "@/types";

export default defineContentScript({
  matches: [
    "https://steamcommunity.com/id/*/tradeoffers*",
    "https://steamcommunity.com/profiles/*/tradeoffers*",
  ],
  cssInjectionMode: "manifest",
  main() {
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
        "rgb(134, 80, 172)", // unusual
        "rgb(170, 0, 0)", // collectors
        "rgb(207, 106, 50)", // strange
        "rgb(56, 243, 171)", // haunted
        "rgb(77, 116, 85)", // genuine
        "rgb(71, 98, 145)", // vintage
        "rgb(250, 250, 250)", // decorated
        "rgb(125, 109, 0)", // unique
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
            props: {
              classinfo,
              app,
              color: itemEl.style.borderColor,
            },
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
      const offers = Array.from(
        document.getElementsByClassName("tradeoffer"),
      ) as HTMLElement[];

      for (const offerEl of offers) {
        addUserButtons(offerEl);
        summarizeItemLists(offerEl);
      }
    }

    enhanceTradeOffers();
  },
});
