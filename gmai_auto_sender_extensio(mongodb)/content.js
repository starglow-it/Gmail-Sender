var contacts,
  pageSize,
  pageNumber,
  startIndex,
  endIndex,
  emailFieldName,
  collectionName,
  sentList = [];

async function callChatGPT(promptText, callback) {
  const chatGPTApiUrl = "https://api.openai.com/v1/chat/completions";
  const chatGPTApiKey = "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";
  try {
    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${chatGPTApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-3.5-turbo",
        messages: promptText,
      }),
    });

    return response.json();
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
    console.log(firstName);
    console.log(lastName);
    console.log(companyName);
    console.log(companyContent);

    const promptText = `CEO's First Name: ${firstName}, CEO's Last Name: ${lastName}
  CEO's Company name: ${companyName}
  This is information about the CEO's company: ${companyContent}
  """Email Template:

  Dear [CEO's Name],

  I'm a lead developer from StarGlow Ventures, and I was highly impressed by [specific detail about the CEO's company]. 

  We're eager to utilize our expertise in your ongoing or upcoming project.

  <b>Our team, comprising 11 skilled professionals, specializes in websites and web applications, mobile apps, blockchain, and AI development. 

  We have a track record of accelerating project timelines by 20%, delivering innovative solutions tailored for clients similar to [CEO's company name]. </b>

  Whether we take on the development of the entire project independently, align with specific tasks assigned by you, or integrate seamlessly into your team, StarGlow Ventures is fully adaptable to meet your strategic objectives and goals.

  Looking forward to exploring how our collaboration can bring outstanding results to your projects.

  Warm regards,

  James Kai
  Lead Developer
  StarGlow Ventures
  +1 (604) 243-7330,  +1 (778) 650-9556, +1 (604) 998-8820
  Write an email using this template.
  0. Complete CEO's company name, CEO's name, and detail about CEO's company
  1. The template I provided is example message. Make impactful message by ADDING MORE achievements(creatively imagine!!!) not just only the example
  2. Make content in HTML format.
  3. Provide me only JSON {"subject": "...", "content": "..."}
  4. Don't write https://starglowventures.com directly. Instead write <a> link with href="https://starglowventures.com?id=${
    firstName + " " + lastName
  }" for example '..., <a href="...">visit our website</a>'. Make link only for starglow ventures.
  5. Remove <html><body>, </body></html>.
  6. Add unsubscribe section with link in the footer.
  7. Never include 'opportunity' or 'opportunities' in the subject.
  8. Add this in the bottom of email. <img src="https://starglowventures.com/email/track_image.png?id=${email}" />
  `;

    const messages = [
      {
        role: "system",
        content: "You are a helpful assistant writing an email.",
      },
      {
        role: "user",
        content: promptText,
      },
    ];

    const response = await callChatGPT(messages);

    console.log(response.choices[0].message.content);

    const { subject, content } = JSON.parse(
      response.choices[0].message.content
    );

    return { subject, content };
  } catch (error) {
    console.error("Error generating message: ", error);
  }
}

async function saveContacts(list) {
  try {
    await fetch(`http://localhost:5000/${collectionName}/save`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ sentList: list }),
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

  await element.dispatchEvent(new Event("input", { bubbles: true }));
  await element.dispatchEvent(new Event("change", { bubbles: true }));
}

function createNotification() {
  chrome.runtime.sendMessage({
    action: "createNotification",
  });
}

function processNextBatch(collectionName, startIndex, endIndex, pageNumber) {
  // Fetch the next batch and start processing it
  console.log("processNextBatch");
  fetch(
    `http://localhost:5000/${collectionName}/${startIndex}/${endIndex}/${pageNumber}`
  )
    .then((response) => response.json())
    .then((data) => {
      console.log("Fetched Data: ", data, pageNumber);
      if (data.finished) {
        console.log("Finished");
        chrome.runtime.sendMessage({
          action: "createNotification",
        });
      } else {
        contacts = data.contacts;
        result_contacts = [];
        startNewEmail(0);
      }
    })
    .catch((error) => {
      console.error("Error fetching next batch:", error);
    });
}

async function waitForElement(selector) {
  let element = document.querySelector(selector);
  while (!element) {
    await new Promise((resolve) => setTimeout(resolve, 500));
    element = document.querySelector(selector);
  }
  return element;
}

async function startNewEmail(index) {
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

    const currentContact = contacts[index];

    await simulateKeyboardInput(toField, currentContact[emailFieldName]);

    const { subject, content } = await generateEmailContent(
      currentContact["contact_first_name"],
      currentContact["contact_last_name"],
      currentContact["company_company_name"],
      currentContact["company_data"],
      currentContact[emailFieldName]
    );

    subjectField.value = subject || "";

    messageField.innerHTML = content || "";

    await simulateClick(sendButton);

    sentList.push(currentContact._id);

    console.log(
      "CURRENT PAGE: ",
      pageNumber + 1,
      "/",
      Math.ceil((endIndex - startIndex) / pageSize)
    );

    const totalAtThisPage =
      endIndex < startIndex + pageSize * (pageNumber + 1)
        ? endIndex - startIndex - pageSize * pageNumber
        : pageSize;

    console.log("POSITION AT CURRENT PAGE: ", index + 1, "/", totalAtThisPage);

    if (index < totalAtThisPage - 1) {
      index++;
      setTimeout(() => startNewEmail(index), interval);
    } else {
      saveContacts(sentList);
      pageNumber++;
      processNextBatch(collectionName, startIndex, endIndex, pageNumber);
    }
  } catch (error) {
    console.log("Error sending email: ", error);

    const discardButton = await waitForElement(
      'div[data-tooltip="Discard draft ‪(Ctrl-Shift-D)‬"]'
    );

    discardButton.click();

    startNewEmail(index);
  }
}

window.addEventListener("load", () => {
  if (!window.hasLoadedContentScript) {
    window.hasLoadedContentScript = true;

    chrome.storage.local.get(
      [
        "contacts",
        "startIndex",
        "endIndex",
        "emailFieldName",
        "collectionName",
        "interval",
        "pageNumber",
      ],
      (data) => {
        contacts = data.contacts || [];
        pageSize = contacts.length;
        startIndex = data.startIndex;
        endIndex = data.endIndex;
        interval = data.interval || 6000;
        pageNumber = data.pageNumber;
        emailFieldName = data.emailFieldName || "contact_email_1";
        collectionName = data.collectionName;

        console.log("contacts: ", contacts);

        startNewEmail(0);
      }
    );
  }
});
