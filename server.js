import express from "express";
import axios from "axios";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static("."));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve the frontend
app.get("/", (_, res) => {
  res.sendFile(new URL("./index.html", import.meta.url));
});

// POST /fetch - fetch HTML content from a website
app.post("/fetch", async (req, res) => {
  let { url } = req.body;
  if (!url) return res.status(400).send("Missing URL");
  
  // Ensure URL has protocol
  if (!url.startsWith("http://") && !url.startsWith("https://")) {
    url = "https://" + url;
  }

  try {
    const response = await axios.get(url, { timeout: 15000 }); // 15s timeout
    res.send(response.data);
  } catch (e) {
    console.error("Error fetching HTML:", e.message);
    res.status(500).send("Failed to fetch site HTML: " + e.message);
  }
});

// GET /proxy?url=... - fetch assets (images/videos) as arraybuffer
app.get("/proxy", async (req, res) => {
  let { url } = req.query;
  if (!url) return res.status(400).send("Missing URL");

  try {
    if (!url.startsWith("http://") && !url.startsWith("https://")) {
      url = "https://" + url;
    }
    const response = await axios.get(url, {
      responseType: "arraybuffer",
      timeout: 20000 // 20s for larger files
    });
    res.send(Buffer.from(response.data));
  } catch (e) {
    console.error("Error fetching asset:", url, e.message);
    res.status(500).send("Failed to fetch asset: " + e.message);
  }
});

app.listen(PORT, () => {
  console.log(`✅ Offline Site Saver server running on port ${PORT}`);
});
