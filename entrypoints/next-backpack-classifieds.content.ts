import { processListings } from "@/utils/backpack";
import { debounce } from "@/utils";

export default defineContentScript({
  matches: ["*://next.backpack.tf/classifieds*"],

  main() {
    const contentWrapper =
      document.querySelector(".main-content") || document.body;
    const observer = new MutationObserver(debounce(processListings, 300));

    observer.observe(contentWrapper, {
      childList: true,
      subtree: true,
    });

    processListings();
  },
});
