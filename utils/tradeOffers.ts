import { browser } from "wxt/browser";

const acceptOffer = (offerID: string, partnerID: string) => {
  return new Promise((resolve, reject) => {
    browser.storage.local.get(["steamSessionID"], ({ steamSessionID }) => {
      const headers = new Headers();
      headers.append(
        "Content-Type",
        "application/x-www-form-urlencoded; charset=UTF-8",
      );

      const request = new Request(
        `https://steamcommunity.com/tradeoffer/${offerID}/accept`,
        {
          method: "POST",
          headers: headers,
          referrer: `https://steamcommunity.com/tradeoffer/${offerID}/`,
          body: `sessionid=${steamSessionID}&serverid=1&tradeofferid=${offerID}&partner=${partnerID}&captcha=`,
        },
      );

      fetch(request)
        .then((response) => {
          if (!response.ok) {
            console.log(
              `Error code: ${response.status} Status: ${response.statusText}`,
            );
            reject({
              status: response.status,
              statusText: response.statusText,
            });
          } else return response.json();
        })
        .then((body) => {
          resolve(body);
        })
        .catch((err) => {
          console.log(err);
          reject(err);
        });
    });
  });
};

const declineOffer = (offerID: string) => {
  return new Promise((resolve, reject) => {
    browser.storage.local.get(["steamSessionID"], ({ steamSessionID }) => {
      const headers = new Headers();
      headers.append(
        "Content-Type",
        "application/x-www-form-urlencoded; charset=UTF-8",
      );

      const request = new Request(
        `https://steamcommunity.com/tradeoffer/${offerID}/decline`,
        {
          method: "POST",
          headers: headers,
          body: `sessionid=${steamSessionID}`,
        },
      );

      fetch(request)
        .then((response) => {
          if (!response.ok) {
            console.log(
              `Error code: ${response.status} Status: ${response.statusText}`,
            );
            reject({
              status: response.status,
              statusText: response.statusText,
            });
          } else return response.json();
        })
        .then((body) => {
          if (body.tradeofferid === offerID) {
            resolve(body);
          } else reject(body);
        })
        .catch((err) => {
          console.log(err);
          reject(err);
        });
    });
  });
};
