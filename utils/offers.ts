interface AcceptOfferResponse {
  tradeid?: string;
  needs_email_confirmation?: boolean;
  needs_mobile_confirmation?: boolean;
}

interface DeclineOfferResponse {
  tradeofferid: string;
}

export function getOfferID(offerEl: HTMLElement): string {
  return offerEl.id.replace("tradeofferid_", "");
}

export function getPartnerID(offerEl: HTMLElement): string {
  const avatarEl = offerEl.querySelector<HTMLElement>(".playerAvatar");
  const miniprofile = avatarEl?.getAttribute("data-miniprofile") ?? "";
  return (BigInt(miniprofile) + BigInt("76561197960265728")).toString();
}

export function isOfferActive(offerEl: HTMLElement): boolean {
  return (
    offerEl
      .querySelector(".tradeoffer_items_ctn")
      ?.classList.contains("active") ?? false
  );
}

function getSessionID(): string {
  const match = document.cookie
    .split("; ")
    .find((row) => row.startsWith("sessionid="));

  if (!match) throw new Error("Steam sessionid cookie not found");

  return match.split("=")[1];
}

export async function acceptOffer(
  offerID: string,
  partnerID: string,
): Promise<AcceptOfferResponse> {
  const sessionID = getSessionID();

  const response = await fetch(
    `https://steamcommunity.com/tradeoffer/${offerID}/accept`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      referrer: `https://steamcommunity.com/tradeoffer/${offerID}/`,
      body: `sessionid=${sessionID}&serverid=1&tradeofferid=${offerID}&partner=${partnerID}&captcha=`,
    },
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  return response.json();
}

export async function declineOffer(
  offerID: string,
): Promise<DeclineOfferResponse> {
  const sessionID = getSessionID();

  const response = await fetch(
    `https://steamcommunity.com/tradeoffer/${offerID}/decline`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      body: `sessionid=${sessionID}`,
    },
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const body: DeclineOfferResponse = await response.json();

  if (body.tradeofferid !== offerID) {
    throw new Error(
      `Unexpected tradeofferid in decline response: ${body.tradeofferid}`,
    );
  }

  return body;
}

export async function cancelOffer(
  offerID: string,
): Promise<DeclineOfferResponse> {
  const sessionID = getSessionID();

  const response = await fetch(
    `https://steamcommunity.com/tradeoffer/${offerID}/cancel`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded; charset=UTF-8",
      },
      body: `sessionid=${sessionID}`,
    },
  );

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
  }

  const body: DeclineOfferResponse = await response.json();

  if (body.tradeofferid !== offerID) {
    throw new Error(
      `Unexpected tradeofferid in cancel response: ${body.tradeofferid}`,
    );
  }

  return body;
}
