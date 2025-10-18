import express from "express";
import axios from "axios";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static("."));
app.use(express.json());

// Serve the frontend
app.get("/", (_, res) => {
  res.sendFile(new URL("./index.html", import.meta.url));
});

// Fetch HTML content
app.post("/fetch", async (req, res) => {
  let { url } = req.body;
  if (!url.startsWith("http")) url = "https://" + url;
  try {
    const r = await axios.get(url, { timeout: 15000 });
    res.send(r.data);
  } catch (e) {
    console.error("Fetch HTML error:", e.message);
    res.status(500).send("Failed to fetch site HTML");
  }
});

// Fetch assets
app.get("/proxy", async (req, res) => {
  let { url } = req.query;
  if (!url.startsWith("http")) url = "https://" + url;
  try {
    const r = await axios.get(url, { responseType: "arraybuffer", timeout: 20000 });
    res.send(Buffer.from(r.data));
  } catch (e) {
    console.error("Proxy fetch error:", e.message);
    res.status(500).send("Failed to fetch asset");
  }
});

app.listen(PORT, () => console.log(`✅ Server running on port ${PORT}`));
