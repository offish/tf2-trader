// entrypoints/steam-logic.content.ts
export default defineContentScript({
  matches: ["*://steamcommunity.com/*tradeoffers*"],
  world: "MAIN",
  main() {
    window.addEventListener("STEAM_EXT_ACTION", async (event: any) => {
      const { action, offerId, partnerId } = event.detail;
      const sessionID = (window as any).g_sessionID;

      try {
        let response;
        if (action === "accept") {
          const body = new URLSearchParams({
            sessionid: sessionID,
            serverid: "1",
            tradeofferid: offerId,
            partner: partnerId,
            captcha: "",
          });
          response = await fetch(
            `https://steamcommunity.com/tradeoffer/${offerId}/accept`,
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/x-www-form-urlencoded; charset=UTF-8",
              },
              body: body.toString(),
            },
          );
        } else {
          response = await fetch(
            `https://steamcommunity.com/tradeoffer/${offerId}/decline`,
            {
              method: "POST",
              headers: {
                "Content-Type":
                  "application/x-www-form-urlencoded; charset=UTF-8",
              },
              body: `sessionid=${sessionID}`,
            },
          );
        }

        const result = await response.json();
        // Send the result back to the UI script
        window.dispatchEvent(
          new CustomEvent("STEAM_EXT_RESULT", {
            detail: { offerId, action, success: response.ok, data: result },
          }),
        );
      } catch (err) {
        window.dispatchEvent(
          new CustomEvent("STEAM_EXT_RESULT", {
            detail: { offerId, action, success: false },
          }),
        );
      }
    });
  },
});
