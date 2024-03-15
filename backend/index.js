const axios = require("axios");
const cheerio = require("cheerio");

const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const morgan = require("morgan");
dotenv.config();
const apiKey = process.env.OPENAI_API_KEY;

const options = {
  rejectUnauthorized: false,
};

const app = express();

const extractCompanyContent = async (url) => {
  try {
    const response = await fetch(url);
    const data = await response.text();
    const $ = cheerio.load(data);
    $("script, style").remove();

    let text = $("html").text();
    text = text.replace(/\s+/g, " ").trim();
    // Limiting to the first 4000 characters
    return text.substring(0, 4000);
  } catch (error) {
    console.error("Error fetching or processing HTML:");
    throw error;
  }
};

app.use(express.json());
app.use(cors());
app.use(morgan("dev"));

app.get("/collections", async (req, res) => {
  try {
    const collections = (
      await mongoose.connection.db.listCollections().toArray()
    ).map((collection) => collection.name);

    return res.json({ collections });
  } catch (error) {
    console.log(error);
  }
});

app.get("/getContactList", async (req, res) => {
  try {
    const {
      collectionName,
      startIndex,
      pageNumber,
      limit,
      type,
      search,
      pageSize,
    } = extractQueryParams(req);

    const collection = mongoose.connection.db.collection(collectionName);
    const filterOption = buildFilterOptions(JSON.parse(search));

    const partData = await fetchContacts(
      collection,
      filterOption,
      startIndex,
      pageNumber,
      pageSize,
      limit
    );

    if (partData.length === 0) {
      return res.json({ message: "Data Fetching finished.", finished: true });
    }

    const result =
      type === "send"
        ? await enrichContactsWithCompanyData(partData)
        : partData;

    res.json({ contacts: result, finished: false });
  } catch (error) {
    console.error("Error in getContactList:", error);
    res
      .status(500)
      .json({ message: "An error occurred while fetching contact list." });
  }
});

function extractQueryParams(req) {
  return {
    collectionName: req.query.collectionName,
    startIndex: Number(req.query.startIndex),
    pageNumber: Number(req.query.pageNumber),
    limit: Number(req.query.limit),
    type: req.query.type,
    search: req.query.search || null,
  };
}

function buildFilterOptions(search) {
  const filterOption = {};
  if (
    search &&
    Object.keys(JSON.parse(search)).includes("passed_validator") &&
    JSON.parse(search).passed_validator
  ) {
    filterOption["passed_validator"] = { $ne: null };
  }
  return filterOption;
}

async function fetchContacts(
  collection,
  filterOption,
  startIndex,
  pageNumber,
  pageSize = 2,
  limit
) {
  return collection
    .find(filterOption)
    .skip(startIndex + pageNumber * pageSize)
    .limit(limit)
    .toArray();
}

async function enrichContactsWithCompanyData(partData) {
  return Promise.all(
    partData.map(async (contact) => {
      try {
        const companyData = await extractCompanyContent(
          "https://" + contact.company_website
        );
        return { ...contact, company_data: companyData }; // Return new object with company data
      } catch (error) {
        console.log(
          "Error scraping company data for:",
          contact.company_website
          // error
        );
        return { ...contact, company_data: "" }; // Return contact with empty company data on error
      }
    })
  );
}


app.post('/chatgpt', async (req, res) => {
  try {
    console.log(req.body)
    const { prompt } = req.body;
    if (!prompt) {
      return res.status(400).send({ message: 'Prompt is required' });
    }
    console.log(prompt)
    const response = await axios.post('https://api.openai.com/v1/chat/completions', {
      model: "gpt-3.5-turbo",
      messages: prompt,
    }, {
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      }
    });

    // Send back the ChatGPT response
    return res.status(200).json({data: JSON.parse(response.data.choices[0].message.content)});
  } catch (error) {
    console.error(error);
    res.status(500).send({ message: 'Error processing your request' });
  }
});

app.post("/:collectionName/update-status", async (req, res) => {
  try {
    const { sentList } = req.body;
    const { collectionName } = req.params;

    const objectIds = sentList.map((id) => new mongoose.Types.ObjectId(id));

    await mongoose.connection.db
      .collection(collectionName)
      .updateMany({ _id: { $in: objectIds } }, { $set: { sent_status: true } });

    return res.status(200).json({
      message: "Successfully saved",
    });
  } catch (error) {
    console.log(error);
  }
});

app.post("/:collectionName/add-validation", async (req, res) => {
  try {
    const { filtered } = req.body;
    const { collectionName } = req.params;

    for (const doc of filtered) {
      const updatedDoc = { ...doc };
      delete updatedDoc._id;

      console.log(updatedDoc);

      await mongoose.connection.db.collection(collectionName).findOneAndUpdate(
        { _id: new mongoose.Types.ObjectId(doc._id) }, // Ensure _id is an ObjectId
        { $set: updatedDoc }, // Use $set to update fields
        { upsert: true } // Create a new document if no match is found
      );
    }

    return res.status(200).json({
      message: "Successfully saved",
    });
  } catch (error) {
    console.log(error);
  }
});

mongoose
  .connect(process.env.DB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log(err));

const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
