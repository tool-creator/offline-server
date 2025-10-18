import express from "express";
import axios from "axios";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.static("."));
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve main page
app.get("/", (_, res) => {
  res.send(`<!DOCTYPE html>
<html>
<head>
<meta charset="utf-8">
<title>Offline Site Saver with Encrypted Media</title>
<meta name="viewport" content="width=device-width,initial-scale=1">
<script src="https://cdn.jsdelivr.net/npm/crypto-js@4.1.1/crypto-js.min.js"></script>
<style>
body { font-family:sans-serif; text-align:center; padding:20px; }
input,button,select { padding:10px;margin:5px;font-size:16px; }
iframe { width:90%; height:500px; border:1px solid #ccc; margin-top:10px; }
.container { max-width:600px; margin:auto; }
</style>
</head>
<body>
<div class="container">
<h1>🖼 Offline Site Saver (Encrypted Media)</h1>
<input type="text" id="urlInput" placeholder="Enter website URL" style="width:70%">
<input type="password" id="passInput" placeholder="Enter passphrase" style="width:70%">
<br>
<button onclick="saveSite()">Save Site</button>
<button onclick="downloadFile()">Download Offline File</button>
<div>
<h3>Saved Sites</h3>
<select id="siteSelect" onchange="viewSite()"></select>
</div>
<iframe id="viewer"></iframe>
</div>

<script>
let sites = JSON.parse(localStorage.getItem('offlineSites')||'{}');

function refreshList() {
  const select=document.getElementById('siteSelect');
  select.innerHTML='<option value="">--Choose site--</option>';
  Object.keys(sites).forEach(url=>{
    const opt=document.createElement('option');
    opt.value=url; opt.textContent=url; select.appendChild(opt);
  });
}

// Fetch an asset and encrypt it
async function fetchAsset(url, pass) {
  try {
    const res = await fetch('/proxy?url=' + encodeURIComponent(url));
    const blob = await res.blob();
    const arrayBuffer = await blob.arrayBuffer();
    const wordArray = CryptoJS.lib.WordArray.create(arrayBuffer);
    return CryptoJS.AES.encrypt(wordArray, pass).toString();
  } catch(e){ console.log("Asset failed:", url); return null; }
}

// Save site and encrypt media
async function saveSite() {
  const url=document.getElementById('urlInput').value.trim();
  const pass=document.getElementById('passInput').value;
  if(!url||!pass) return alert("Enter URL and passphrase");
  try{
    const res = await fetch('/fetch',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({url})});
    let html = await res.text();

    // Extract images and videos
    const assetUrls = [];
    html.replace(/<img[^>]+src="([^">]+)"/g,(m,u)=>assetUrls.push(u));
    html.replace(/<video[^>]+src="([^">]+)"/g,(m,u)=>assetUrls.push(u));

    const assets = {};
    for(const aurl of assetUrls){
      const encrypted = await fetchAsset(aurl, pass);
      if(encrypted) assets[aurl] = encrypted;
    }

    sites[url]={html,assets};
    localStorage.setItem('offlineSites', JSON.stringify(sites));
    refreshList();
    alert('✅ Site saved with encrypted media!');
  } catch(e){ alert('❌ Failed: '+e.message); }
}

// View site with decrypted media
function viewSite() {
  const url=document.getElementById('siteSelect').value;
  if(!url) return;
  const pass=document.getElementById('passInput').value;
  if(!pass) return alert("Enter passphrase");
  const {html, assets} = sites[url];

  // Replace images/videos with decrypted blob URLs
  let modifiedHtml = html.replace(/<img[^>]+src="([^">]+)"/g,(m,u)=>{
    if(assets[u]){
      const bytes = CryptoJS.AES.decrypt(assets[u], pass);
      const blob = new Blob([new Uint8Array(bytes.words.map(w=>[(w>>>24)&0xFF,(w>>>16)&0xFF,(w>>>8)&0xFF,w&0xFF]).flat())]);
      return m.replace(u, URL.createObjectURL(blob));
    }
    return m;
  });
  modifiedHtml = modifiedHtml.replace(/<video[^>]+src="([^">]+)"/g,(m,u)=>{
    if(assets[u]){
      const bytes = CryptoJS.AES.decrypt(assets[u], pass);
      const blob = new Blob([new Uint8Array(bytes.words.map(w=>[(w>>>24)&0xFF,(w>>>16)&0xFF,(w>>>8)&0xFF,w&0xFF]).flat())]);
      return m.replace(u, URL.createObjectURL(blob));
    }
    return m;
  });

  const blob = new Blob([modifiedHtml], {type:'text/html'});
  document.getElementById('viewer').src = URL.createObjectURL(blob);
}

// Download self-contained offline file
function downloadFile() {
  const data = JSON.stringify(sites).replace(/</g,'\\u003c');
  const html = \`<!DOCTYPE html>
<html><head><meta charset="utf-8"><title>Offline Encrypted Media Collection</title>
<script src="https://cdn.jsdelivr.net/npm/crypto-js@4.1.1/crypto-js.min.js"></script>
<style>body{text-align:center;font-family:sans-serif;padding:20px;}iframe{width:90%;height:500px;border:1px solid #ccc;margin-top:10px;}</style>
</head>
<body>
<input type="password" id="passInput" placeholder="Enter passphrase">
<select id="siteSelect"></select>
<iframe id="viewer"></iframe>
<script>
const sites=\${data};
const select=document.getElementById('siteSelect');
const viewer=document.getElementById('viewer');
Object.keys(sites).forEach(u=>{ const o=document.createElement('option'); o.value=u; o.textContent=u; select.appendChild(o); });
select.onchange=()=>{
  const pass=document.getElementById('passInput').value;
  if(!pass){ alert('Enter passphrase'); return; }
  const {html, assets}=sites[select.value];
  let modifiedHtml = html.replace(/<img[^>]+src="([^">]+)"/g,(m,u)=>{
    if(assets[u]){
      const bytes = CryptoJS.AES.decrypt(assets[u], pass);
      const blob = new Blob([new Uint8Array(bytes.words.map(w=>[(w>>>24)&0xFF,(w>>>16)&0xFF,(w>>>8)&0xFF,w&0xFF]).flat())]);
      return m.replace(u, URL.createObjectURL(blob));
    } return m;
  });
  modifiedHtml = modifiedHtml.replace(/<video[^>]+src="([^">]+)"/g,(m,u)=>{
    if(assets[u]){
      const bytes = CryptoJS.AES.decrypt(assets[u], pass);
      const blob = new Blob([new Uint8Array(bytes.words.map(w=>[(w>>>24)&0xFF,(w>>>16)&0xFF,(w>>>8)&0xFF,w&0xFF]).flat())]);
      return m.replace(u, URL.createObjectURL(blob));
    } return m;
  });
  const blob = new Blob([modifiedHtml],{type:'text/html'});
  viewer.src=URL.createObjectURL(blob);
};
</script>
</body></html>\`;
  const blob = new Blob([html],{type:'text/html'});
  const a=document.createElement('a');
  a.href=URL.createObjectURL(blob);
  a.download='offline-site.html';
  a.click();
}

refreshList();
</script>
</body>
</html>`);
});

// Backend fetch route
app.post("/fetch", async(req,res)=>{
  const {url}=req.body;
  if(!url) return res.status(400).send("Missing URL");
  try{
    const r = await axios.get(url);
    res.send(r.data);
  }catch(e){ res.status(500).send("Error fetching site: "+e.message);}
});

// Proxy route for assets (images/videos)
app.get("/proxy", async(req,res)=>{
  const {url} = req.query;
  if(!url) return res.status(400).send("Missing URL");
  try{
    const r = await axios.get(url, {responseType:'arraybuffer'});
    res.send(Buffer.from(r.data));
  }catch(e){ res.status(500).send("Failed to fetch asset");}
});

app.listen(PORT,()=>console.log("✅ Offline Saver running with encrypted media on port", PORT));
