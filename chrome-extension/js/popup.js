document.addEventListener("DOMContentLoaded", function () {
  let currentTabId = null;
  let domainKey = null;

  const startButton = document.getElementById("start");
  const collectionSelect = document.getElementById("collectionSelect");
  const actionFields = document.getElementsByName("action-type");

  // Utility functions
  function getDomainKey(url) {
    return "formData_" + new URL(url.split("#")[0]);
  }

  function sendMessageToContentScript(message, tabId, callback) {
    console.log(message, tabId, callback);

    chrome.tabs.sendMessage(
      tabId,
      {
        message: startButton.value == "Start" ? "start_action" : "end_action",
        data: message,
        domainKey: domainKey
      },
      callback
    );
  }

  // Function to save form data to localStorage
  function saveFormData() {
    const formData = {
      actionType: document.querySelector('input[name="action-type"]:checked')
        .value,
      collectionName: document.getElementById("collectionSelect").value,
      to: document.getElementById("to").value,
      emailFieldName: document.getElementById("email_field_name").value,
      interval: document.getElementById("interval").value,
      startIndex: document.getElementById("start_point").value,
      endIndex: document.getElementById("end_point").value,
    };
    let domainFormData = {};
    domainFormData[domainKey] = formData;
    chrome.storage.local.set(domainFormData);
    return domainFormData[domainKey];
  }

  function updateButtonState(startButton, newState, domainKey) {
    console.log(domainKey);
    let updatedStorage = {};
    const isStarted = newState === "started";
    // Assuming your button text does NOT include the icon HTML, you'd clear and recreate it.
    startButton.innerHTML = `${
      isStarted ? "Stop" : "Start"
    } <i class="material-icons right">${isStarted ? "stop" : "play_arrow"}</i>`;
    startButton.value = isStarted ? "Stop" : "Start";
    chrome.storage.local.get(domainKey, function (result) {
      console.log(result);
      let storageObject = result[domainKey];

      // If there's no existing object, create a new one
      if (!storageObject) {
        storageObject = {};
      }

      // Update only the 'state' attribute
      storageObject.state = newState;

      // Initialize updatedStorage object inside the callback
      let updatedStorage = {};
      updatedStorage[domainKey] = storageObject;
      console.log(updatedStorage);

      // Save the updated object back to storage inside the callback
      chrome.storage.local.set(updatedStorage);
    });

    return updatedStorage;
  }

  function fetchCollectionsData() {
    return fetch("http://localhost:5000/collections")
      .then((response) => {
        if (!response.ok) {
          throw new Error(
            "Network response was not ok: " + response.statusText
          );
        }
        return response.json();
      })
      .catch((error) => {
        console.error("Error fetching collections:", error);
        // Handle the error further if needed
        throw error; // Re-throwing the error to be caught by the calling function
      });
  }

  async function fetchAndRenderCollections(val) {
    // Assume you have a function to fetch collection data
    fetchCollectionsData()
      .then((data) => {
        data.collections.forEach((collection) => {
          const option = document.createElement("option");
          option.value = collection;
          option.text = collection;
          document.getElementById("collectionSelect").appendChild(option);
        });
        document.getElementById("collectionSelect").value = val;
        M.FormSelect.init(document.getElementById("collectionSelect"));
      })
      .catch((error) => console.error("Error:", error));
  }

  function populateFormWithSavedData(domainKey) {
    chrome.storage.local.get(domainKey, async function (data) {
      const savedData = data[domainKey];
      if (savedData) {
        console.log(savedData);
        // Fetch collections for the dropdown
        await fetchAndRenderCollections(savedData.collectionName);

        document
          .querySelectorAll('input[name="action-type"]')
          .forEach((input) => {
            if (input.value === savedData.actionType) {
              input.checked = true;
            }
          });
        toggleFields(savedData.actionType);
        // document.getElementById('collectionSelect').value = savedData.collectionName || '';
        document.getElementById("to").value = savedData.to || "";
        document.getElementById("email_field_name").value =
          savedData.emailFieldName || "";
        document.getElementById("interval").value = savedData.interval || "";
        document.getElementById("start_point").value =
          savedData.startIndex || "";
        document.getElementById("end_point").value = savedData.endIndex || "";
        updateButtonState(startButton, savedData.state, domainKey);
        M.FormSelect.init(document.getElementById("collectionSelect"));
        M.updateTextFields();
        M.textareaAutoResize(document.getElementById("to"));
      } else {
        fetchAndRenderCollections("");
      }
    });
  }

  // Attach event listeners
  Array.from(actionFields).forEach((field) => {
    field.addEventListener("change", (event) => {
      toggleFields(event.target.value);
    });
  });

  startButton.addEventListener("click", function () {
    let params = saveFormData();
    sendMessageToContentScript(params, currentTabId, function (response) {
      const newState = response.response === "started" ? "started" : "stopped";
      updateButtonState(startButton, newState, domainKey);
      console.log("Content script response:", response);
    });
  });

  document.getElementById("reset").addEventListener("click", function () {
    resetFormData();
  });

  chrome.tabs.query(
    {
      active: true,
      currentWindow: true,
    },
    function (tabs) {
      const currentTab = tabs[0];
      currentTabId = currentTab.id; // Store the current tab ID for later use

      domainKey = getDomainKey(currentTab.url); // Now domainKey is accessible throughout

      populateFormWithSavedData(domainKey);
    }
  );

  // Function to reset form data
  function resetFormData() {
    document.getElementById("collectionSelect").value = "";
    document.getElementById("to").value = "";
    document.getElementById("email_field_name").value = "";
    document.getElementById("interval").value = "";
    document.getElementById("start_point").value = "";
    document.getElementById("end_point").value = "";
    M.FormSelect.init(document.getElementById("collectionSelect"));
    M.updateTextFields();
    M.textareaAutoResize(document.getElementById("to"));
  }

  // Function to hide or show fields based on the selected action
  function toggleFields(actionValue) {
    const recipientsField = document.querySelector(".to");
    const intervalField = document.querySelector(".interval");

    if (actionValue === "send-email") {
      recipientsField.style.display = "";
      intervalField.style.display = "";
    } else if (actionValue === "filter-contact") {
      recipientsField.style.display = "none";
      intervalField.style.display = "none";
    }
  }
});
