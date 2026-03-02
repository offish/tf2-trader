import { processListings } from "@/utils/backpack";

export default defineContentScript({
  matches: ["*://backpack.tf/classifieds*"],

  main() {
    processListings();
  },
});
