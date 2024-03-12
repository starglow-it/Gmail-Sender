document.addEventListener("DOMContentLoaded", function () {
  // Fetch array of collection names and render.
  const collectionSelect = document.getElementById("collectionSelect");

  fetch("http://localhost:5000/collections")
    .then((response) => response.json())
    .then((data) => {
      data.collections.forEach((collection) => {
        const option = document.createElement("option");
        option.value = collection;
        option.text = collection;
        collectionSelect.appendChild(option);

        M.FormSelect.init(collectionSelect);
      });
    })
    .catch((error) => console.error("Error:", error));

  const form = document.getElementById("form");

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    chrome.storage.local.clear();

    // Get the values from the input fields
    let startIndex = parseInt(document.getElementById("start_point").value, 10);
    let endIndex = parseInt(document.getElementById("end_point").value, 10);
    let collectionName = collectionSelect.value;
    let emailFieldName = document.getElementById("email_field_name").value;
    let addresses = document.getElementById("to").value.split("\n");
    let interval = parseInt(document.getElementById("interval").value, 10);

    console.log(startIndex, endIndex, collectionName, emailFieldName, interval);

    // Save the values to local storage
    chrome.storage.local.set(
      {
        startIndex,
        endIndex,
        pageNumber: 0,
        collectionName,
        emailFieldName,
        interval,
      },
      () => {
        processBatch();
      }
    );
  });
});

function processBatch() {
  chrome.storage.local.get(
    ["startIndex", "endIndex", "pageNumber", "collectionName"],
    (data) => {
      console.log(
        data.collectionName,
        data.startIndex,
        data.endIndex,
        data.pageNumber
      );
      fetch(
        `http://localhost:5000/${data.collectionName}/${data.startIndex}/${data.endIndex}/${data.pageNumber}`
      )
        .then((response) => response.json())
        .then((data) => {
          if (data.finished) {
            createNotification();
          } else {
            chrome.storage.local.set({ contacts: data.contacts }, () => {
              findOrCreateGmailTab();
            });
          }
        })
        .catch((error) => console.error("Error fetching contacts:", error));
    }
  );
}

function findOrCreateGmailTab() {
  chrome.tabs.query({ url: "https://mail.google.com/*" }, function (tabs) {
    if (tabs.length > 0) {
      // Gmail tab exists, use the first one found
      executeScriptInTab(tabs[0].id);
    } else {
      // No Gmail tab found, create a new one
      chrome.tabs.create({ url: "https://mail.google.com" }, function (tab) {
        executeScriptInTab(tab.id);
      });
    }
  });
}

function executeScriptInTab(tabId) {
  chrome.scripting.executeScript({
    target: { tabId: tabId },
    files: ["content.js"],
  });
}

function createNotification() {
  const notificationOptions = {
    type: "basic",
    iconUrl: "icon128.png",
    title: "Valid Email Filtering",
    message:
      "Congratulations! \nYour filtering has just finished. Now please check your target database.",
    requireInteraction: true,
  };

  chrome.runtime.sendMessage({
    action: "createNotification",
    options: notificationOptions,
  });
}
