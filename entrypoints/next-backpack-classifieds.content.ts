import { processListings } from "@/utils/backpack";
import { debounce } from "@/utils";
import { getSettings } from "@/utils/settings";

export default defineContentScript({
  matches: ["*://next.backpack.tf/classifieds*"],

  async main() {
    const settings = await getSettings();
    if (!settings.sites.nextBackpackClassifieds) return;

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
