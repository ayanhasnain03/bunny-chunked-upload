import express from "express";
import mongoose from "mongoose";
import axios from "axios";
import cors from "cors";
import crypto from "crypto";
import morgan from "morgan";
const app = express();
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

mongoose.connect("mongodb+srv://ayanhasnain2572006:8797131193@practicemern.lebin.mongodb.net/bunny-mern-large")
  .then(() => console.log("✅ Connected to MongoDB"))
  .catch((err) => console.error("❌ MongoDB Error:", err));

const LectureSchema = new mongoose.Schema({
  title: String,
  description: String,
  videoId: String,
  streamUrl: String,
  thumbnailUrl: String,
});
const Lecture = mongoose.model("Lecture", LectureSchema);

const VIDEO_LIBRARY_ID = "450217";
const BUNNY_API_KEY = "02ebc93a-c2c2-4f37-ac3b645f31e3-254d-40ea";

app.post("/api/create-video-entry", async (req, res) => {
  try {
    const { title } = req.body;
    const response = await axios.post(
      `https://video.bunnycdn.com/library/${VIDEO_LIBRARY_ID}/videos`,
      { title },
      {
        headers: {
          AccessKey: BUNNY_API_KEY,
          "Content-Type": "application/json",
        },
      }
    );

    const { guid } = response.data;
    if (!guid) return res.status(500).json({ error: "GUID not returned from BunnyCDN" });

    res.json({ guid });
  } catch (err) {
    console.error("❌ Bunny API Error:", err?.response?.data || err.message);
    res.status(500).json({ message: "Failed to create video entry" });
  }
});

app.post("/api/generate-tus-auth", (req, res) => {
  try {
    const { videoId } = req.body;
    if (!videoId) return res.status(400).json({ message: "Missing videoId" });

    const libraryId = VIDEO_LIBRARY_ID;
    const apiKey = BUNNY_API_KEY;
    const expiration = Math.floor(Date.now() / 1000) + 60 * 60; // 1 hour expiry

    const signatureBase = libraryId + apiKey + expiration + videoId;
    const hash = crypto.createHash("sha256").update(signatureBase).digest("hex");

    res.json({
      authorizationSignature: hash,
      authorizationExpire: expiration,
      libraryId,
      videoId,
    });
  } catch (err) {
    console.error("❌ TUS Auth Generation Error:", err);
    res.status(500).json({ message: "Failed to generate TUS auth headers" });
  }
});

app.post("/api/save-video-metadata", async (req, res) => {
  try {
    const { title, description, videoId, thumbnailUrl } = req.body;
    if (!videoId) return res.status(400).json({ message: "Missing videoId" });

    const streamUrl = `https://vz-${VIDEO_LIBRARY_ID}-${videoId}.b-cdn.net/play.m3u8`;

    const lecture = await Lecture.create({
      title,
      description,
      videoId,
      streamUrl,
      thumbnailUrl,
    });

    res.json({ lecture });
  } catch (err) {
    console.error("❌ Metadata Save Error:", err);
    res.status(500).json({ message: "Failed to save video metadata" });
  }
});
app.get("/api/get-lectures", async (req, res) => {
  const lectures = await Lecture.find();
  res.json(lectures);
});
const PORT = 5000;
app.listen(PORT, () => console.log(`🚀 Server running on http://localhost:${PORT}`));
