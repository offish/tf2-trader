import { processListings } from "@/utils/backpack";
import { getSettings } from "@/utils/settings";

export default defineContentScript({
  matches: ["*://backpack.tf/classifieds*"],

  async main() {
    const settings = await getSettings();
    if (!settings.sites.backpackClassifieds) return;

    processListings();
  },
});
