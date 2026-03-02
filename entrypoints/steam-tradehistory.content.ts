import "@/styles/steam-tradehistory.css";

export default defineContentScript({
  matches: [
    "*://steamcommunity.com/*/tradehistory*",
    "*://steamcommunity.com/id/*/tradehistory*",
  ],
  runAt: "document_end",

  main() {
    interface ItemDetails {
      count: number;
      links: string[];
      style: string;
      imgSrc?: string;
      imgStyle?: string;
    }

    const combineItems = (
      container: HTMLElement,
      isReceived: boolean,
    ): void => {
      const itemsGroup = container.querySelector(".tradehistory_items_group");
      if (!itemsGroup || !itemsGroup.children.length) return;

      const itemMap = new Map<string, ItemDetails>();
      const itemElements = Array.from(itemsGroup.children) as HTMLElement[];

      itemElements.forEach((item) => {
        const nameElement = item.querySelector(".history_item_name");
        if (!nameElement) return;

        const itemName = nameElement.textContent?.trim() || "Unknown Item";
        const link = item.getAttribute("href") || "";

        const details: ItemDetails = itemMap.get(itemName) || {
          count: 0,
          links: [],
          style: nameElement.getAttribute("style") || "",
        };

        details.count += 1;
        if (isReceived && link) details.links.push(link);

        if (isReceived && !details.imgSrc) {
          const img = item.querySelector<HTMLImageElement>(
            "img.tradehistory_received_item_img",
          );
          if (img) {
            details.imgSrc = img.getAttribute("src") || "";
            details.imgStyle = img.getAttribute("style") || "";
          }
        }
        itemMap.set(itemName, details);
      });

      let newContent = "";

      itemMap.forEach((details, name) => {
        const count = details.count > 1 ? ` x${details.count}` : ``;

        if (isReceived) {
          const firstLink = details.links[0] || "";
          newContent += `
            <a class="history_item economy_item_hoverable" href="${firstLink}">
              <img src="${details.imgSrc}" style="${details.imgStyle}" class="tradehistory_received_item_img">
              <span class="history_item_name" style="${details.style}">${name + count}</span>
            </a>`;
        } else {
          newContent += `
            <span class="history_item economy_item_hoverable">
              <span class="history_item_name" style="${details.style}">${name + count}</span>
            </span>`;
        }
      });

      itemsGroup.innerHTML = newContent;
    };

    const processTradeHistory = (): void => {
      const tradeRows = document.querySelectorAll(".tradehistoryrow");

      tradeRows.forEach((row) => {
        if (row.classList.contains("combined-done")) return;

        const receivedItems = row.querySelector<HTMLElement>(
          ".tradehistory_items_withimages",
        );

        if (receivedItems) combineItems(receivedItems, true);

        const givenItems = row.querySelector<HTMLElement>(
          ".tradehistory_items_noimages",
        );

        if (givenItems) combineItems(givenItems, false);

        row.classList.add("combined-done");
      });
    };

    processTradeHistory();

    const observer = new MutationObserver(() => processTradeHistory());
    observer.observe(document.body, { childList: true, subtree: true });
  },
});
