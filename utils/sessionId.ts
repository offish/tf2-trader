const getSessionID = () => {
  const getSessionIDScript =
    "document.querySelector('body').setAttribute('sessionid', g_sessionID);";
  return injectScript(getSessionIDScript, true, "getSessionID", "sessionid");
};

const getUserSteamID = () => {
  const getUserSteamIDScript =
    "document.querySelector('body').setAttribute('steamidOfLoggedinUser', g_steamID);";
  return injectScript(
    getUserSteamIDScript,
    true,
    "steamidOfLoggedinUser",
    "steamidOfLoggedinUser",
  );
};

// updates the SteamID of the extension's user in storage
const updateLoggedInUserInfo = () => {
  const steamID = getUserSteamID();
  if (steamID !== "false" && steamID !== false && steamID !== null) {
    chrome.storage.local.set(
      {
        steamIDOfUser: steamID,
        steamSessionID: getSessionID(),
      },
      () => {},
    );
  }
};
