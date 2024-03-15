var pageSize = 5;
let domainKey = '';
const sendingEmail = (function () {
  let isSending = false;
  let currentIndex = 0;

  async function processQueue(params) {
    let contacts = [];
    contacts = await getNextPageData(params);

    while (isSending && contacts.length) {
      if (currentIndex >= contacts.length) {
        params.pageNumber++;
        currentIndex = 0;

        await updateStatus(
          params.collectionName,
          contacts.map((contact) => contact._id)
        );

        contacts = await getNextPageData(params);
      }
      // If contacts array no element, no need to iterate more.
      if (!contacts.length) {
        break;
      }
      await sendNewEmail(contacts[currentIndex], params.emailFieldName);
      currentIndex++;
      // Wait for interval time
      await new Promise((resolve) => setTimeout(resolve, params.interval));
    }

    if (!contacts.length) {
      console.log("Finished sending all emails.");
      stop(); // Optionally stop when queue is empty
    }
  }

  function start(params) {
    if (!isSending) {
      isSending = true;
      processQueue(params);
    }
  }

  function stop() {
    isSending = false;
    mailSendingComplete();
  }

  return {
    start,
    stop,
  };
})();

const filteringEmail = (function () {
  let isFiltering = false;
  let currentIndex = 0;

  async function processQueue(params) {
    let contacts = [];
    contacts = await getNextPageData(params);

    while (isFiltering && contacts.length) {
      if (currentIndex >= contacts.length) {
        params.pageNumber++;
        currentIndex = 0;
        console.log("1");
        await addValidation(params.collectionName, contacts);
        contacts = await getNextPageData(params);
        console.log("2");
      }
      console.log("3");
      // If contacts array no element, no need to iterate more.
      if (!contacts.length) {
        break;
      }
      console.log("4");
      await filterNewEmail(contacts[currentIndex], params.emailFieldName);
      console.log("5");
      currentIndex++;
      console.log("6", currentIndex);
      // Wait for interval time
      await new Promise((resolve) => setTimeout(resolve, params.interval));
    }

    if (!contacts.length) {
      console.log("Finished sending all emails.");
      stop(); // Optionally stop when queue is empty
    }
  }

  function start(params) {
    if (!isFiltering) {
      isFiltering = true;
      processQueue(params);
    }
  }

  function stop() {
    isFiltering = false;
  }

  return {
    start,
    stop,
  };
})();

async function callChatGPT(promptText) {
  try {
    const response = await fetch("http://localhost:5000/chatgpt", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        prompt: promptText,
      }),
    });
    let res = await response.json();
    console.log(res)
    return res.data;

  } catch (error) {
    console.log("Error calling ChatGPT API: ", error);
  }
}

async function generateEmailContent(
  firstName,
  lastName,
  companyName,
  companyContent,
  email
) {
  try {
    console.log(companyContent);

    const promptText = `CEO's First Name: ${firstName}, CEO's Last Name: ${lastName}
                          CEO's Company name: ${companyName}
                          This is information about the CEO's company: ${companyContent}
                          """Email Template:

                          Dear [CEO's Name],

                          I'm a Senior Full Stack developer, and I was highly impressed by [specific detail about the CEO's company]. 

                          We're eager to utilize our expertise in your ongoing or upcoming project.

                          <b>Our team, comprising 11 skilled professionals, specializes in websites and web applications, mobile apps, blockchain, and AI development. 

                          We have a track record of accelerating project timelines by 20%, delivering innovative solutions tailored for clients similar to [CEO's company name]. </b>

                          Whether we take on the development of the entire project independently, align with specific tasks assigned by you, or integrate seamlessly into your team, StarGlow Ventures is fully adaptable to meet your strategic objectives and goals.

                          Looking forward to exploring how our collaboration can bring outstanding results to your projects.

                          Warm regards,

                          James Kai
                          Lead Developer
                          StarGlow Ventures
                          +1 (604) 243-7330
                          Write an email using this template.
                          0. Complete CEO's company name, CEO's name, and detail about CEO's company
                          1. The template I provided is example message. Make impactful message by ADDING MORE achievements(creatively imagine!!!) not just only the example
                          2. Make content in HTML format.
                          3. Provide me exact JSON format {"subject": "...", "content": "..."}
                          4. Don't write https://starglowventures.com directly. Instead write <a> link with href="https://starglowventures.com?id=${email}" for example '..., <a href="...">visit our website</a>'. Make link only for starglow ventures.
                          5. Remove <html><body>, </body></html>.
                          6. Don't use 'opportunity' or 'opportunities' words in the subject.
                          7. Add this in the bottom of email. <img src="https://starglowventures.com/email/track_image.png?id=${email}" />
                          8. Don't include specific characters. Because I am getting error when parse your data to JSON.
                        `;

    const messages = [{
        role: "system",
        content: "You are a helpful assistant writing an email.",
      },
      {
        role: "user",
        content: promptText,
      },
    ];

    let subject, content;

    // while (true) {
    // }
    try {
      const data = await callChatGPT(messages);
      subject = data.subject
      content = data.content
      console.log(subject, content)
      // break;
    } catch (error) {
      console.log("Iterating due to wrong JSON format of ChatGPT rsesponse");
    }

    return {
      subject,
      content,
    };
  } catch (error) {
    console.error("Error generating message: ", error);
  }
}

async function updateStatus(collectionName, list) {
  try {
    await fetch(`http://localhost:5000/${collectionName}/update-status`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        sentList: list,
      }),
    });
  } catch (error) {
    console.log(error);
  }
}

async function addValidation(collectionName, contacts) {
  try {
    await fetch(`http://localhost:5000/${collectionName}/add-validation`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        filtered: contacts,
      }),
    });
  } catch (error) {
    console.log(error);
  }
}

async function simulateClick(element) {
  element.dispatchEvent(
    new MouseEvent("click", {
      bubbles: true,
      cancelable: true,
      view: window,
    })
  );
}

async function simulateKeyboardInput(element, value) {
  element.value = value;

  await element.dispatchEvent(
    new Event("input", {
      bubbles: true,
    })
  );
  await element.dispatchEvent(
    new Event("change", {
      bubbles: true,
    })
  );
}

function createNotification() {
  chrome.runtime.sendMessage({
    action: "createNotification",
  });
}

async function getNextPageData(params) {
  let contacts = [];
  // Fetch the next batch and start processing it
  console.log("getNextPageData");
  let getEndpointUrl = `http://localhost:5000/getContactList?`;

  params = {
    ...params,
    limit: Math.min(
      pageSize, // Page limit is same as pageSize when it is not the last page.
      params.endIndex - params.startIndex - pageSize * params.pageNumber // Page limit is equal or less than pageSize when the last page.
    ),
    pageSize,
  };

  // When exceed the last page, set the contacts array as empty array. Then finish iterating inside processQueue() function.
  if (params.limit <= 0) {
    return [];
  }

  for (let param in params) {
    if (["endIndex", "interval", "emailFieldName"].includes(param)) {
      // Eliminate unnecessary queries in the url.
      continue;
    }

    getEndpointUrl += `${param}=${params[param]}&`;
  }

  await fetch(getEndpointUrl)
    .then((response) => response.json())
    .then((data) => {
      console.log("Fetched Data: ", data);
      if (data.finished) {
        console.log("Finished");
        chrome.runtime.sendMessage({
          action: "createNotification",
        });
        contacts = [];
      } else {
        contacts = data.contacts;

        // updateStatus(sentList);
      }
    })
    .catch((error) => {
      console.error("Error fetching next batch:", error);
    });

  return contacts;
}

async function waitForElement(selector) {
  let element = document.querySelector(selector);
  while (!element) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    element = document.querySelector(selector);
  }
  return element;
}

async function sendNewEmail(currentContact, emailFieldName) {
  console.log("currentContact", currentContact);

  try {
    const composeButton = await waitForElement('[gh="cm"]');

    await simulateClick(composeButton);

    const toField = await waitForElement(
      'input[class="agP aFw"][peoplekit-id="BbVjBd"]'
    );

    const subjectField = await waitForElement('input[name="subjectbox"]');

    const messageField = await waitForElement('[role="textbox"]');

    const sendButton = await waitForElement(
      '[role="button"][tabindex="1"][data-tooltip-delay="800"][style="user-select: none;"]'
    );
    await simulateKeyboardInput(toField, currentContact[emailFieldName]);

    let {
      subject,
      content
    } = await generateEmailContent(
      currentContact["contact_first_name"],
      currentContact["contact_last_name"],
      currentContact["company_company_name"],
      currentContact["company_data"],
      currentContact[emailFieldName]
    );

    subjectField.value = subject || "";
    content+=`<br>This email was sent to you as a part of our efforts to provide valuable services. To unsubscribe from future communications, <a href="https://starglowventures.com/unsubscribe?id=${currentContact[emailFieldName]}" target="_blank">click here</a><br>`;
    messageField.innerHTML = content || "";

    await simulateClick(sendButton);
  } catch (error) {
    console.log("Error sending email: ", error);

    const discardButton = await waitForElement(
      'div[data-tooltip="Discard draft ‪(Ctrl-Shift-D)‬"]'
    );

    discardButton.click();

    sendNewEmail(currentContact, emailFieldName);
  }
}

async function filterNewEmail(contact, emailFieldName) {
  const composeButton = await waitForElement('[gh="cm"]');
  console.log("composeButton");

  simulateClick(composeButton);

  const toField = await waitForElement(
    'input[class="agP aFw"][peoplekit-id="BbVjBd"]'
  );

  const discardButton = await waitForElement(
    'div[data-tooltip="Discard draft ‪(Ctrl-Shift-D)‬"]'
  );

  try {
    const enterEvent = new KeyboardEvent("keydown", {
      key: "Enter",
      code: "Enter",
      which: 13,
      keyCode: 13,
      bubbles: true,
    });

    contact["visited_validators"] = ["gmail"];

    await simulateKeyboardInput(toField, contact[emailFieldName]);

    toField.dispatchEvent(enterEvent);

    let imageElement = document.querySelector(
        "div[data-hovercard-id][data-name]"
      )?.children[0]?.children[0]?.children[0]?.children[0]?.children[0]
      ?.children[0]?.children[0]?.children[0]?.children[0];

    let polls = 0;

    while (!imageElement && polls < 20) {
      polls++;
      console.log("imageElement waiting");

      await new Promise((resolve) => setTimeout(resolve, 500));

      imageElement = document.querySelector("div[data-hovercard-id][data-name]")
        ?.children[0]?.children[0]?.children[0]?.children[0]?.children[0]
        ?.children[0]?.children[0]?.children[0]?.children[0];
    }

    if (
      imageElement &&
      !imageElement
      .getAttribute("src")
      .startsWith("https://lh3.googleusercontent.com/a/default-user")
    ) {
      contact["passed_validator"] = "gmail";
    }

    discardButton.click();
  } catch (error) {
    console.log("Error writing email address", error);

    discardButton.click();
  }

  return contact;
}

function mailSendingComplete() {
  chrome.storage.local.get(domainKey, function (result) {
    console.log(result);
    let storageObject = result[domainKey];

    // If there's no existing object, create a new one
    if (!storageObject) {
      storageObject = {};
    }

    // Update only the 'state' attribute
    storageObject.state = "stopped";

    // Initialize updatedStorage object inside the callback
    let updatedStorage = {};
    updatedStorage[domainKey] = storageObject;

    // Save the updated object back to storage inside the callback
    chrome.storage.local.set(updatedStorage);
  });
}

window.addEventListener("load", () => {
  if (!window.hasLoadedContentScript) {
    window.hasLoadedContentScript = true;

    chrome.runtime.onMessage.addListener(function (
      request,
      sender,
      sendResponse
    ) {
      if (request.message === "start_action") {
        // Perform actions based on the message
        console.log(request.data); // Log the message data sent from the popup
        domainKey = request.domainKey;
        let params = {
          startIndex: request.data.startIndex,
          endIndex: request.data.endIndex,
          collectionName: request.data.collectionName,
          interval: request.data.interval || 5000,
          emailFieldName: request.data.emailFieldName || "contact_email_1",
          pageNumber: 0,
        };
        if (request.data.actionType == "send-email") {
          sendingEmail.start({
            type: "send",
            ...params
          });
        } else {
          filteringEmail.start({
            type: "filter",
            ...params
          });
        }
        // Optionally send a response back to the popup
        sendResponse({
          response: "started",
        });
      }
      if (request.message === "end_action") {
        // Perform actions based on the message
        console.log(request.data); // Log the message data sent from the popup
        if (request.data.actionType == "send-email") {
          sendingEmail.stop();
        } else {
          filteringEmail.stop();
        }
        // Optionally send a response back to the popup
        sendResponse({
          response: "stopped",
        });
      }
    });
  }
});