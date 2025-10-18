import express from "express";
import axios from "axios";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve the frontend UI
app.get("/", (_, res) => {
  res.sendFile(new URL("./index.html", import.meta.url));
});

// Fetch HTML from URL
app.post("/fetch", async (req, res) => {
  const { url } = req.body;
  if (!url) return res.status(400).send("Missing URL");
  try {
    const r = await axios.get(url);
    res.send(r.data);
  } catch (e) {
    res.status(500).send("Failed to fetch site: " + e.message);
  }
});

// Fetch assets
app.get("/proxy", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send("Missing URL");
  try {
    const r = await axios.get(url, { responseType: "arraybuffer" });
    res.send(Buffer.from(r.data));
  } catch {
    res.status(500).send("Failed to fetch asset");
  }
});

app.listen(PORT, () => console.log("✅ Offline Saver running on port", PORT));
