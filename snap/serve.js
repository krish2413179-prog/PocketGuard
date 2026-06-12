/**
 * PocketGuard Snap — static server with correct shasum computation.
 * Uses @metamask/snaps-utils getSnapChecksum with VirtualFile instances,
 * matching exactly what MetaMask Flask expects.
 */
const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8080;
const BUNDLE_PATH = path.join(__dirname, 'dist', 'bundle.js');
const MANIFEST_PATH = path.join(__dirname, 'snap.manifest.json');
const ICON_PATH = path.join(__dirname, 'images', 'icon.svg');

const { getSnapChecksum, VirtualFile } = require('@metamask/snaps-utils');

async function computeOfficialShasum() {
  const manifestJson = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));

  const manifest = new VirtualFile({
    value: JSON.stringify(manifestJson),
    path: 'snap.manifest.json',
    result: manifestJson,
  });

  const sourceCode = new VirtualFile({
    value: new Uint8Array(fs.readFileSync(BUNDLE_PATH)),
    path: 'dist/bundle.js',
  });

  const svgIcon = fs.existsSync(ICON_PATH)
    ? new VirtualFile({ value: fs.readFileSync(ICON_PATH, 'utf8'), path: 'images/icon.svg' })
    : undefined;

  return getSnapChecksum({
    manifest,
    sourceCode,
    svgIcon,
    auxiliaryFiles: [],
    localizationFiles: [],
  });
}

async function getManifestWithCorrectShasum() {
  const manifest = JSON.parse(fs.readFileSync(MANIFEST_PATH, 'utf8'));
  manifest.source.shasum = await computeOfficialShasum();
  return manifest;
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  const url = req.url.split('?')[0];

  if (url === '/' || url === '/snap.manifest.json') {
    try {
      const manifest = await getManifestWithCorrectShasum();
      res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify(manifest, null, 2));
      console.log(`[snap] Served manifest  shasum: ${manifest.source.shasum}`);
    } catch (e) {
      console.error('[snap] Manifest error:', e.message);
      res.writeHead(500);
      res.end(e.message);
    }
    return;
  }

  if (url === '/dist/bundle.js') {
    try {
      const bundle = fs.readFileSync(BUNDLE_PATH);
      res.writeHead(200, { 'Content-Type': 'application/javascript' });
      res.end(bundle);
      console.log('[snap] Served bundle.js');
    } catch {
      res.writeHead(404);
      res.end('Bundle not found — run npm run build first');
    }
    return;
  }

  if (url === '/images/icon.svg') {
    try {
      const icon = fs.readFileSync(ICON_PATH);
      res.writeHead(200, { 'Content-Type': 'image/svg+xml' });
      res.end(icon);
    } catch {
      res.writeHead(404);
      res.end('Not found');
    }
    return;
  }

  res.writeHead(404);
  res.end('Not found');
});

(async () => {
  if (!fs.existsSync(BUNDLE_PATH)) {
    console.error('ERROR: dist/bundle.js not found. Run "npm run build" first.');
    process.exit(1);
  }
  try {
    const shasum = await computeOfficialShasum();
    server.listen(PORT, () => {
      console.log(`\nPocketGuard Snap server  http://localhost:${PORT}`);
      console.log(`Shasum: ${shasum}`);
      console.log(`Manifest: http://localhost:${PORT}/snap.manifest.json`);
      console.log(`Bundle:   http://localhost:${PORT}/dist/bundle.js\n`);
    });
  } catch (e) {
    console.error('Failed to start:', e.message);
    process.exit(1);
  }
})();
