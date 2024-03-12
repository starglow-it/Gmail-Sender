document.addEventListener("DOMContentLoaded", function () {
  function
  /* The `sendMessageToContentScript` function is responsible for sending a message to the
   content script running in the active tab. It first queries for the active tab in the
   current window, then sends a message with a specific identifier and data to the content
   script in that tab. It also logs the response received from the content script. */
  sendMessageToContentScript(params) {
    chrome.tabs.query({
      active: true,
      currentWindow: true
    }, function (tabs) {
      // Send a message to the active tab
      chrome.tabs.sendMessage(tabs[0].id, {
        message: "start_action",
        data: params
      }, function (response) {
        console.log(response.response); // Log the response from the content script.
        const currentTab = tabs[0];
        console.log(currentTab)
        const tabUrl = new URL(currentTab.url);
        const domainKey = `formData_${tabUrl}`; // Use domain (or the whole URL if you need to be more specific) as a key
        var startButton = document.getElementById('start');
        if (response.response == "started") {

          chrome.storage.local.get(domainKey, function (data) {
            let domainFormData = {};
            domainFormData[domainKey] = data[domainKey];
            domainFormData[domainKey]['status'] = "started";
            chrome.storage.local.set(domainFormData);
          })
          if (startButton.textContent.includes('Start')) {
            // Change the button text to 'Stop'
            startButton.textContent = 'Stop';
            // Update the icon to 'stop'
            startButton.innerHTML += '<i class="material-icons right">stop</i>';
          }
        }
      });
    });
  }

  chrome.tabs.query({
    active: true,
    currentWindow: true
  }, function (tabs) {
    const currentTab = tabs[0];
    console.log(currentTab)
    const tabUrl = new URL(currentTab.url);
    const domainKey = `formData_${tabUrl}`; // Use domain (or the whole URL if you need to be more specific) as a key

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



    // Function to populate form with saved data
    function resetFormData() {
      document.querySelectorAll('input[name="action-type"]').forEach((input) => {
        if (input.value == 'send-email') {
          input.checked = true;
        }
      });
      document.getElementById('collectionSelect').value = '';
      document.getElementById('to').value = '';
      document.getElementById('email_field_name').value = '';
      document.getElementById('interval').value = '';
      document.getElementById('start_point').value = '';
      document.getElementById('end_point').value = '';
      M.updateTextFields();
    }

    // Function to save form data to localStorage
    function saveFormData() {
      const formData = {
        'actionType': document.querySelector('input[name="action-type"]:checked').value,
        'collectionName': document.getElementById('collectionSelect').value,
        'to': document.getElementById('to').value,
        'emailFieldName': document.getElementById('email_field_name').value,
        'interval': document.getElementById('interval').value,
        'startIndex': document.getElementById('start_point').value,
        'endIndex': document.getElementById('end_point').value,
      };
      let domainFormData = {};
      domainFormData[domainKey] = formData;
      chrome.storage.local.set(domainFormData);
    }

    // Function to populate form with saved data
    function populateFormWithSavedData() {
      chrome.storage.local.get(domainKey, function (data) {
        const savedData = data[domainKey];
        if (savedData) {
          document.querySelectorAll('input[name="action-type"]').forEach((input) => {
            if (input.value === savedData.actionType) {
              input.checked = true;
            }
          });
          document.getElementById('collectionSelect').value = savedData.collectionName || '';
          document.getElementById('to').value = savedData.to || '';
          document.getElementById('email_field_name').value = savedData.emailFieldName || '';
          document.getElementById('interval').value = savedData.interval || '';
          document.getElementById('start_point').value = savedData.startIndex || '';
          document.getElementById('end_point').value = savedData.endIndex || '';
          M.updateTextFields();
        }
      });
    }

    // Attach event listener to the Start button
    document.getElementById('start').addEventListener('click', function (event) {
      event.preventDefault(); // Prevent actual submit
      saveFormData();
      processBatch(domainKey);

      // Optionally close the popup if needed
      // window.close();
    });

    // Attach event listener to the Start button
    document.getElementById('reset').addEventListener('click', function (event) {
      event.preventDefault(); // Prevent actual submit
      resetFormData();

      // Optionally close the popup if needed
      // window.close();
    });

    // Populate the form when the popup is opened
    populateFormWithSavedData();
    const actionFields = document.getElementsByName("action-type");

    // Function to hide or show fields based on the selected action
    function toggleFields(actionValue) {
      // Select the elements you want to show or hide
      const recipientsField = document.querySelector('.to');
      const intervalField = document.querySelector('.interval');

      // Check the actionValue and adjust visibility
      if (actionValue === 'send-email') {
        // Show the fields for sending email
        recipientsField.style.display = '';
        intervalField.style.display = '';
      } else if (actionValue === 'filter-contact') {
        // Hide the fields not needed for filtering contact
        recipientsField.style.display = 'none';
        intervalField.style.display = 'none';
      }
    }

    // Initially set the correct visibility based on the checked input
    const initiallySelectedAction = document.querySelector('input[name="action-type"]:checked').value;
    toggleFields(initiallySelectedAction);

    // Add change event listener to each radio button
    Array.from(actionFields).forEach((field) => {
      field.addEventListener("change", (e) => {
        toggleFields(e.target.value);
      });
    });
  });

  function processBatch(domainKey) {
    chrome.storage.local.get(domainKey,
      (data) => {
        const savedData = data[domainKey];
        const params = {
          collectionName: data[domainKey].collectionName,
          startIndex: data[domainKey].startIndex,
          pageNum: 0,
          limit: 10,
          search: data[domainKey].actionType == "send-email" ? JSON.stringify({
            passed_validator: true
          }) : JSON.stringify({})
        }
        console.log(params);
        sendMessageToContentScript(params)
        // fetch(
        //     `http://localhost:5000/getContactList?collectionName=${savedData.collectionName}&startIndex=${savedData.startIndex}&pageNum=${savedData.pageNumber}&limit=${savedData.limit}&type=${type}&search=${savedData.search}`
        //   )
        //   .then((response) => response.json())
        //   .then((data) => {
        //     if (data.finished) {
        //       createNotification();
        //     } else {
        //       chrome.storage.local.set({
        //         contacts: data.contacts
        //       }, () => {
        //         findOrCreateGmailTab();
        //       });
        //     }
        //   })
        //   .catch((error) => console.error("Error fetching contacts:", error));
      }
    );
  }

  function findOrCreateGmailTab() {
    chrome.tabs.query({
      url: "https://mail.google.com/*"
    }, function (tabs) {
      if (tabs.length > 0) {
        // Gmail tab exists, use the first one found
        executeScriptInTab(tabs[0].id);
      } else {
        // No Gmail tab found, create a new one
        chrome.tabs.create({
          url: "https://mail.google.com"
        }, function (tab) {
          executeScriptInTab(tab.id);
        });
      }
    });
  }

  function executeScriptInTab(tabId) {
    chrome.scripting.executeScript({
      target: {
        tabId: tabId
      },
      files: ["content.js"],
    });
  }

  function createNotification() {
    const notificationOptions = {
      type: "basic",
      iconUrl: "icon128.png",
      title: "Valid Email Filtering",
      message: "Congratulations! \nYour filtering has just finished. Now please check your target database.",
      requireInteraction: true,
    };

    chrome.runtime.sendMessage({
      action: "createNotification",
      options: notificationOptions,
    });
  }
});
