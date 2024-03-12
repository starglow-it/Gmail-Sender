const axios = require("axios");
const cheerio = require("cheerio");

const express = require("express");
const mongoose = require("mongoose");
const dotenv = require("dotenv");
const cors = require("cors");
const morgan = require("morgan");
dotenv.config();

const options = {
  rejectUnauthorized: false,
};

const app = express();

const extractCompanyContent = async (url) => {
  try {
    const response = await fetch(url);
    const data = await response.text();
    await console.log("response");
    const $ = cheerio.load(data);
    $("script, style").remove();

    let text = $("html").text();
    text = text.replace(/\s+/g, " ").trim();
    console.log(text);
    // Limiting to the first 4000 characters
    return text.substring(0, 4000);
  } catch (error) {
    console.error("Error fetching or processing HTML:", error);
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
    const { collectionName, startIndex, pageNum, limit, type, search } = extractQueryParams(req);
    const collection = mongoose.connection.db.collection(collectionName);
    const filterOption = buildFilterOptions(JSON.parse(search));
    
    const partData = await fetchContacts(collection, filterOption, startIndex, pageNum, limit);

    if (partData.length === 0) {
      return res.json({ message: "Data Fetching finished.", finished: true });
    }

    const result = type === 'send' ? await enrichContactsWithCompanyData(partData) : partData;

    res.json({ contacts: result, finished: false });
  } catch (error) {
    console.error("Error in getContactList:", error);
    res.status(500).json({ message: "An error occurred while fetching contact list." });
  }
});

function extractQueryParams(req) {
  return {
    collectionName: req.query.collectionName,
    startIndex: Number(req.query.startIndex),
    pageNum: Number(req.query.pageNum),
    limit: Number(req.query.limit),
    type: req.query.type,
    search: req.query.search
  };
}

function buildFilterOptions(search) {
  const filterOption = {};
  if (search && Object.keys(JSON.parse(search)).includes("passed_validator") && JSON.parse(search).passed_validator) {
    filterOption['passed_validator'] = { $ne: null };
  }
  return filterOption;
}

async function fetchContacts(collection, filterOption, startIndex, pageNum, limit) {
  return collection
    .find(filterOption)
    .skip(startIndex + (pageNum * limit))
    .limit(limit)
    .toArray();
}

async function enrichContactsWithCompanyData(partData) {
  return Promise.all(partData.map(async (contact) => {
    try {
      const companyData = await extractCompanyContent("https://" + contact.company_website);
      return { ...contact, company_data: companyData }; // Return new object with company data
    } catch (error) {
      console.log("Error scraping company data for:", contact.company_website, error);
      return { ...contact, company_data: "" }; // Return contact with empty company data on error
    }
  }));
}

app.post("/:collectionName/updateStatus", async (req, res) => {
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


app.post("/:collectionName/addValidation", async (req, res) => {
  try {
    const { filtered } = req.body;
    const { collectionName } = req.params;

    for (const doc of filtered) {
      const updatedDoc = { ...doc };
      delete updatedDoc._id;

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
