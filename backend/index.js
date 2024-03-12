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

app.get("/:collectionName/:startIndex/:endIndex/:pageNum", async (req, res) => {
  try {
    const collectionName = req.params.collectionName;
    const startIndex = Number(req.params.startIndex);
    const endIndex = Number(req.params.endIndex);
    const pageNum = Number(req.params.pageNum);

    if (startIndex + pageNum * 2 >= endIndex) {
      return res.json({
        message: "Data Fetching finished.",
        finished: true,
      });
    }

    const limitNumber =
      startIndex + (pageNum + 1) * 2 < endIndex
        ? 2
        : endIndex - startIndex - pageNum * 2;

    const collection = mongoose.connection.db.collection(collectionName);

    const partData = await collection
      .find({ passed_validator: { $ne: null } }, { _id: 0 })
      .skip(startIndex + pageNum * 2)
      .limit(limitNumber)
      .toArray();

    if (partData.length === 0) {
      return res.json({
        message: "Data Fetching finished.",
        finished: true,
      });
    }

    await Promise.all(
      partData.map(async (contact) => {
        try {
          const companyData = await extractCompanyContent(
            "https://" + contact["company_website"]
          );
          contact["company_data"] = companyData;
        } catch (error) {
          console.log("Error scraping company data: ");
          contact["company_data"] = "";
        }
      })
    );

    return res.json({
      contacts: partData,
      finished: false,
    });
  } catch (error) {
    throw error;
  }
});

app.post("/:collectionName/save", async (req, res) => {
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

mongoose
  .connect(process.env.DB_URI)
  .then(() => console.log("MongoDB connected"))
  .catch((err) => console.log(err));

const port = process.env.PORT || 5000;

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
