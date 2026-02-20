// entrypoints/ui-injector.content.ts
export default defineContentScript({
  matches: ["*://steamcommunity.com/*tradeoffers*"],
  main() {
    const injectButtons = () => {
      document.querySelectorAll(".tradeoffer").forEach((offer: any) => {
        if (offer.querySelector(".ext-processed")) return;
        offer.classList.add("ext-processed");

        const offerID = offer.id.split("_")[1];
        const partnerID = offer
          .querySelector(".playerAvatar")
          ?.getAttribute("data-miniprofile");
        const footer = offer.querySelector(".tradeoffer_footer_actions");

        if (footer) {
          // Add Accept Button
          const acceptBtn = document.createElement("span");
          acceptBtn.className = "whiteLink";
          acceptBtn.style.cursor = "pointer";
          acceptBtn.innerText = "Accept Trade";
          acceptBtn.onclick = () =>
            handleAction("accept", offerID, partnerID, offer);

          footer.prepend(acceptBtn, " | ");
        }
      });
    };

    const handleAction = (
      action: string,
      offerId: string,
      partnerId: string,
      offerEl: HTMLElement,
    ) => {
      const middleElement = offerEl.querySelector(
        ".tradeoffer_items_rule",
      ) as HTMLElement;

      // Prepare UI for loading
      if (middleElement) {
        middleElement.innerText =
          action === "accept" ? "Accepting..." : "Declining...";
        middleElement.style.height = "46px"; // Prevent page jerk
      }

      window.dispatchEvent(
        new CustomEvent("STEAM_EXT_ACTION", {
          detail: { action, offerId, partnerId },
        }),
      );
    };

    // Listen for the result to update UI without refresh
    window.addEventListener("STEAM_EXT_RESULT", (event: any) => {
      const { offerId, action, success, data } = event.detail;
      const offerEl = document.getElementById(`tradeofferid_${offerId}`);
      if (!offerEl) return;

      const offerContent = offerEl.querySelector(".tradeoffer_items_ctn");
      const middleElement = offerEl.querySelector(
        ".tradeoffer_items_rule, .tradeoffer_items_banner",
      ) as HTMLElement;
      const footer = offerEl.querySelector(".tradeoffer_footer");

      let message = "";
      if (success) {
        if (action === "accept") {
          message =
            data.needs_email_confirmation || data.needs_mobile_confirmation
              ? "Accepted - Awaiting Confirmation"
              : "Trade Accepted";
        } else {
          message = "Trade Declined";
        }
        if (footer) (footer as HTMLElement).style.display = "none";
      } else {
        message = "Error: Steam is likely having issues.";
      }

      // Final UI Transformation (Native Steam Style)
      if (offerContent && middleElement) {
        offerContent.classList.remove("active");
        offerContent.classList.add("inactive");

        middleElement.className = "tradeoffer_items_banner";
        middleElement.style.height = "";
        middleElement.innerText = message;
      }
    });

    injectButtons();
  },
});
