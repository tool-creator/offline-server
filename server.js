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
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Offline Site Saver 🔒</title>
<script src="https://cdn.jsdelivr.net/npm/crypto-js@4.1.1/crypto-js.min.js"></script>
<style>
body { font-family: system-ui, sans-serif; background: #f9fafb; color: #111; display: flex; justify-content: center; padding: 2rem; }
.app { background: white; border-radius: 1rem; box-shadow: 0 4px 20px rgba(0,0,0,0.1); padding: 2rem; width: 100%; max-width: 600px; }
h1 { text-align: center; margin-top: 0; }
input, button, select { width: 100%; padding: 0.75rem; margin-top: 0.5rem; font-size: 1rem; border-radius: 0.5rem; border: 1px solid #ccc; }
button { cursor: pointer; background: #2563eb; color: white; font-weight: 600; border: none; transition: 0.2s; }
button:hover { background: #1d4ed8; }
iframe { width: 100%; height: 500px; border: 1px solid #ccc; border-radius: 0.5rem; margin-top: 1rem; }
</style>
</head>
<body>
<div class="app">
  <h1>Offline Site Saver 🔒</h1>
  <input id="urlInput" placeholder="Enter website URL">
  <input type="password" id="passInput" placeholder="Enter passphrase">
  <button onclick="saveSite()">💾 Save Site</button>
  <button onclick="downloadFile()">⬇️ Download Offline HTML</button>
  <select id="siteSelect" onchange="viewSite()"></select>
  <iframe id="viewer" title="Offline Viewer"></iframe>
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
      const buffer = await blob.arrayBuffer();
      const wordArray = CryptoJS.lib.WordArray.create(buffer);
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
  if (!html) return alert("No saved data found.");

  const viewer = document.getElementById("viewer");

  let out = html.replace(/(src)="([^"]+)"/g, (m, attr, u) => {
    const abs = new URL(u, url).href;
    if (assets[abs]) {
      try {
        const bytes = CryptoJS.AES.decrypt(assets[abs], pass);
        const buf = new Uint8Array(bytes.words.flatMap(w => [(w>>>24)&255,(w>>>16)&255,(w>>>8)&255,w&255]));
        const blobUrl = URL.createObjectURL(new Blob([buf]));
        return attr + '="' + blobUrl + '"';
      } catch {
        console.log("Decrypt failed:", u);
      }
    }
    return m;
  });

  const blob = new Blob([out], { type: "text/html" });
  viewer.src = URL.createObjectURL(blob);
}

function downloadFile() {
  const pass = document.getElementById("passInput").value.trim();
  if (!pass) return alert("Enter your passphrase before downloading.");

  let html = '<!DOCTYPE html><html><head><meta charset="utf-8"><title>Offline Encrypted Sites</title>';
  html += '<script src="https://cdn.jsdelivr.net/npm/crypto-js@4.1.1/crypto-js.min.js"></script>';
  html += '<style>body{font-family:sans-serif;text-align:center;padding:20px;} input,select{padding:10px;margin:5px;} iframe{width:90%;height:500px;border:1px solid #ccc;margin-top:10px;}</style>';
  html += '</head><body>';
  html += '<h2>Offline Encrypted Sites</h2>';
  html += '<input type="password" id="passInput" placeholder="Enter passphrase">';
  html += '<select id="siteSelect"></select>';
  html += '<iframe id="viewer"></iframe>';
  html += '<script>';
  html += 'const sites = ' + JSON.stringify(sites).replace(/</g,"\\u003c") + ';';
  html += 'const sel = document.getElementById("siteSelect");';
  html += 'Object.keys(sites).forEach(u=>{const o=document.createElement("option");o.value=u;o.textContent=u;sel.appendChild(o);});';
  html += 'sel.onchange = ()=>{';
  html += 'const pass=document.getElementById("passInput").value;if(!pass){alert("Enter passphrase");return;}';
  html += 'const {html,assets}=sites[sel.value];';
  html += 'let out=html.replace(/(src)="([^"]+)"/g,(m,a,u)=>{const abs=new URL(u,sel.value).href;';
  html += 'if(assets[abs]){const b=CryptoJS.AES.decrypt(assets[abs],pass);';
  html += 'const buf=new Uint8Array(b.words.flatMap(w=>[(w>>>24)&255,(w>>>16)&255,(w>>>8)&255,w&255]));';
  html += 'const blobUrl=URL.createObjectURL(new Blob([buf]));return a+"=\""+blobUrl+"\"";} return m;});';
  html += 'const blob=new Blob([out],{type:"text/html"});';
  html += 'const a=document.createElement("a");a.href=URL.createObjectURL(blob);document.getElementById("viewer").src=a.href;};';
  html += '</script></body></html>';

  const blob = new Blob([html], { type: "text/html" });
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = "offline-sites.html";
  a.click();
  alert("💾 Downloaded one self-contained HTML file!");
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
  } catch {
    res.status(500).send("Failed to fetch asset");
  }
});

app.listen(PORT, () => console.log("✅ Offline Saver running on port", PORT));
