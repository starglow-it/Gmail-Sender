const notificationOptions = {
  type: "basic",
  iconUrl: "icon128.png",
  title: "Gmail Auto Sender",
  message:
    "Congratulations! \nYou've sent all the emails. Now you can check sent history log files.",
  requireInteraction: true,
};

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "createNotification") {
    chrome.notifications.create(notificationOptions);
  }
});
