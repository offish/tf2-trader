import { processListings } from "@/utils/backpack";

export default defineContentScript({
  matches: ["*://next.backpack.tf/stats*", "*://next.backpack.tf/classifieds*"],

  main() {
    const contentWrapper =
      document.querySelector(".main-content") || document.body;
    const observer = new MutationObserver(processListings);

    observer.observe(contentWrapper, {
      childList: true,
      subtree: true,
    });

    processListings();
  },
});
