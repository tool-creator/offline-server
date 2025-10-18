import express from "express";
import axios from "axios";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static("."));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

app.get("/", (_, res) => {
  res.send(`<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Offline Site Saver 🔒</title>
<script src="https://cdn.jsdelivr.net/npm/crypto-js@4.1.1/crypto-js.min.js"></script>
<style>
body {
  font-family: system-ui, sans-serif;
  background: #f8fafc;
  color: #111;
  margin: 0;
  display: flex;
  justify-content: center;
  align-items: start;
  min-height: 100vh;
  padding: 2rem;
}
.app {
  background: white;
  border-radius: 1rem;
  box-shadow: 0 0 20px rgba(0,0,0,0.05);
  padding: 2rem;
  width: 100%;
  max-width: 600px;
}
h1 { margin-top: 0; font-size: 1.5rem; text-align: center; }
input, button, select {
  width: 100%;
  padding: 0.75rem;
  font-size: 1rem;
  border-radius: 0.5rem;
  border: 1px solid #ccc;
  margin-top: 0.5rem;
}
button {
  cursor: pointer;
  background: #2563eb;
  color: white;
  font-weight: 600;
  border: none;
  transition: background 0.2s;
}
button:hover { background: #1d4ed8; }
iframe {
  width: 100%;
  height: 500px;
  border: 1px solid #ccc;
  border-radius: 0.5rem;
  margin-top: 1rem;
}
.notice {
  font-size: 0.875rem;
  color: #555;
  margin-top: 1rem;
}
</style>
</head>
<body>
<div class="app">
  <h1>Offline Site Saver 🔒</h1>
  <input id="urlInput" placeholder="Enter a website URL">
  <input type="password" id="passInput" placeholder="Enter a passphrase">
  <button onclick="saveSite()">💾 Save Site</button>
  <button onclick="downloadFile()">⬇️ Download Offline File</button>

  <select id="siteSelect" onchange="viewSite()"></select>
  <iframe id="viewer" title="Offline Viewer"></iframe>
  <p class="notice">Sites are saved locally in your browser. Media (images/videos) are encrypted with your passphrase.</p>
</div>

<script>
let sites = JSON.parse(localStorage.getItem("offlineSites") || "{}");
refreshList();

function refreshList() {
  const select = document.getElementById("siteSelect");
  select.innerHTML = "<option value=''>📂 View Saved Site...</option>";
  Object.keys(sites).forEach(url => {
    const opt = document.createElement("option");
    opt.value = url;
    opt.textContent = url;
    select.appendChild(opt);
  });
}

async function saveSite() {
  const url = document.getElementById("urlInput").value.trim();
  const pass = document.getElementById("passInput").value.trim();
  if (!url || !pass) return alert("Please enter both URL and passphrase.");

  try {
    const res = await fetch("/fetch", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url })
    });
    let html = await res.text();

    const assetUrls = [];
    html.replace(/<img[^>]+src="([^">]+)"/g, (_, u) => assetUrls.push(new URL(u, url).href));
    html.replace(/<video[^>]+src="([^">]+)"/g, (_, u) => assetUrls.push(new URL(u, url).href));

    const assets = {};
    for (const aurl of assetUrls) {
      const blob = await (await fetch("/proxy?url=" + encodeURIComponent(aurl))).blob();
      const arrayBuffer = await blob.arrayBuffer();
      const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer);
      assets[aurl] = CryptoJS.AES.encrypt(wordArray, pass).toString();
    }

    sites[url] = { html, assets };
    localStorage.setItem("offlineSites", JSON.stringify(sites));
    refreshList();
    alert("✅ Site saved successfully with encrypted media!");
  } catch (e) {
    alert("❌ Failed to save: " + e.message);
  }
}

function viewSite() {
  const url = document.getElementById("siteSelect").value;
  if (!url) return;
  const pass = document.getElementById("passInput").value.trim();
  if (!pass) return alert("Enter your passphrase to decrypt media.");

  const { html, assets } = sites[url];
  const viewer = document.getElementById("viewer");

  let out = html.replace(/(src)="([^"]+)"/g, (m, attr, u) => {
    const abs = new URL(u, url).href;
    if (assets[abs]) {
      const bytes = CryptoJS.AES.decrypt(assets[abs], pass);
      const buf = new Uint8Array(bytes.words.flatMap(w => [(w >>> 24) & 0xFF, (w >>> 16) & 0xFF, (w >>> 8) & 0xFF, w & 0xFF]));
      const blobUrl = URL.createObjectURL(new Blob([buf]));
      return attr + '="' + blobUrl + '"';
    }
    return m;
  });

  const blob = new Blob([out], { type: "text/html" });
  viewer.src = URL.createObjectURL(blob);
}

function downloadFile() {
  const blob = new Blob([JSON.stringify(sites)], { type: "application/json" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "offline-sites.json";
  a.click();
  alert("💾 Downloaded your saved sites file!");
}
</script>
</body>
</html>`);
});

// Backend routes
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

app.get("/proxy", async (req, res) => {
  const { url } = req.query;
  if (!url) return res.status(400).send("Missing URL");
  try {
    const r = await axios.get(url, { responseType: "arraybuffer" });
    res.send(Buffer.from(r.data));
  } catch (e) {
    res.status(500).send("Failed to fetch asset.");
  }
});

app.listen(PORT, () => console.log("✅ Offline Saver running on port", PORT));
