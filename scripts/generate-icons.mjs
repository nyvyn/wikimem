import { mkdirSync, writeFileSync, readFileSync, copyFileSync } from "node:fs";
import { join } from "node:path";
import { deflateSync } from "node:zlib";

const OUT_DIR = "src-tauri/icons";
mkdirSync(OUT_DIR, { recursive: true });

const BASE = [15, 23, 42, 255];
const GLOW_DARK = [22, 33, 53, 255];
const GLOW_LIGHT = [33, 45, 72, 255];
const STROKE = [148, 163, 184, 255];
const NODE_PRIMARY = [56, 189, 248, 255];
const NODE_SECONDARY = [125, 211, 252, 255];
const SPARK = [248, 250, 252, 160];

const ICON_SPECS = {
  "32x32.png": 32,
  "128x128.png": 128,
  "128x128@2x.png": 256,
  "Square150x150Logo.png": 150,
  "Square310x310Logo.png": 310,
  "Square71x71Logo.png": 71,
  "Square89x89Logo.png": 89,
  "Square44x44Logo.png": 44,
  "Square107x107Logo.png": 107,
  "Square142x142Logo.png": 142,
  "Square284x284Logo.png": 284,
  "Square30x30Logo.png": 30,
  "icon.png": 128,
};

const ICO_SIZES = [64, 128, 256, 512];

const crcTable = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(buffer) {
  let crc = ~0;
  for (let i = 0; i < buffer.length; i++) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ buffer[i]) & 0xff];
  }
  return (~crc) >>> 0;
}

function pngChunk(tag, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([tag, data])), 0);
  return Buffer.concat([len, tag, data, crc]);
}

function blendPixel(data, size, x, y, rgba, alpha = 1) {
  if (x < 0 || y < 0 || x >= size || y >= size) return;
  const idx = (y * size + x) * 4;
  const sa = (rgba[3] / 255) * alpha;
  const da = data[idx + 3] / 255;
  const outA = sa + da * (1 - sa);
  if (outA <= 0) {
    data[idx] = data[idx + 1] = data[idx + 2] = data[idx + 3] = 0;
    return;
  }
  const sr = rgba[0];
  const sg = rgba[1];
  const sb = rgba[2];
  const dr = data[idx];
  const dg = data[idx + 1];
  const db = data[idx + 2];
  const outR = (sr * sa + dr * da * (1 - sa)) / outA;
  const outG = (sg * sa + dg * da * (1 - sa)) / outA;
  const outB = (sb * sa + db * da * (1 - sa)) / outA;
  data[idx] = Math.round(outR);
  data[idx + 1] = Math.round(outG);
  data[idx + 2] = Math.round(outB);
  data[idx + 3] = Math.round(outA * 255);
}

function createCanvas(size) {
  const data = new Uint8ClampedArray(size * size * 4);
  for (let i = 0; i < size * size; i++) {
    data[i * 4] = BASE[0];
    data[i * 4 + 1] = BASE[1];
    data[i * 4 + 2] = BASE[2];
    data[i * 4 + 3] = BASE[3];
  }
  return { size, data };
}

function drawCircle(canvas, cx, cy, radius, color, alpha = 1) {
  const { size, data } = canvas;
  const minX = Math.max(0, Math.floor((cx - radius) * size));
  const maxX = Math.min(size - 1, Math.ceil((cx + radius) * size));
  const minY = Math.max(0, Math.floor((cy - radius) * size));
  const maxY = Math.min(size - 1, Math.ceil((cy + radius) * size));
  const rSq = radius * radius;
  for (let y = minY; y <= maxY; y++) {
    const ny = (y + 0.5) / size;
    for (let x = minX; x <= maxX; x++) {
      const nx = (x + 0.5) / size;
      if ((nx - cx) ** 2 + (ny - cy) ** 2 <= rSq) {
        blendPixel(data, size, x, y, color, alpha);
      }
    }
  }
}

function distanceToSegment(px, py, x0, y0, x1, y1) {
  const dx = x1 - x0;
  const dy = y1 - y0;
  const lenSq = dx * dx + dy * dy;
  if (lenSq === 0) return Math.hypot(px - x0, py - y0);
  let t = ((px - x0) * dx + (py - y0) * dy) / lenSq;
  t = Math.max(0, Math.min(1, t));
  const projX = x0 + t * dx;
  const projY = y0 + t * dy;
  return Math.hypot(px - projX, py - projY);
}

function drawLine(canvas, x0, y0, x1, y1, width, color, alpha = 1) {
  const { size, data } = canvas;
  const minX = Math.max(0, Math.floor(Math.min(x0, x1) * size - width * size));
  const maxX = Math.min(size - 1, Math.ceil(Math.max(x0, x1) * size + width * size));
  const minY = Math.max(0, Math.floor(Math.min(y0, y1) * size - width * size));
  const maxY = Math.min(size - 1, Math.ceil(Math.max(y0, y1) * size + width * size));
  for (let y = minY; y <= maxY; y++) {
    const ny = (y + 0.5) / size;
    for (let x = minX; x <= maxX; x++) {
      const nx = (x + 0.5) / size;
      if (distanceToSegment(nx, ny, x0, y0, x1, y1) <= width / 2) {
        blendPixel(data, size, x, y, color, alpha);
      }
    }
  }
}

function renderIcon(size) {
  const canvas = createCanvas(size);

  drawCircle(canvas, 0.5, 0.52, 0.48, GLOW_DARK, 0.95);
  drawCircle(canvas, 0.5, 0.52, 0.38, GLOW_LIGHT, 0.9);
  drawCircle(canvas, 0.5, 0.52, 0.33, [255, 255, 255, 18], 1);

  const nodes = [
    { x: 0.23, y: 0.35 },
    { x: 0.36, y: 0.68 },
    { x: 0.5, y: 0.4 },
    { x: 0.64, y: 0.68 },
    { x: 0.77, y: 0.35 },
  ];

  for (let i = 0; i < nodes.length - 1; i++) {
    drawLine(canvas, nodes[i].x, nodes[i].y, nodes[i + 1].x, nodes[i + 1].y, 0.09, [15, 23, 42, 200], 0.8);
    drawLine(canvas, nodes[i].x, nodes[i].y, nodes[i + 1].x, nodes[i + 1].y, 0.05, STROKE, 0.9);
  }

  for (const node of nodes) {
    drawCircle(canvas, node.x, node.y, 0.07, [NODE_PRIMARY[0], NODE_PRIMARY[1], NODE_PRIMARY[2], 120], 0.7);
    drawCircle(canvas, node.x, node.y, 0.05, NODE_PRIMARY, 1);
    drawCircle(canvas, node.x, node.y, 0.03, NODE_SECONDARY, 1);
  }

  drawCircle(canvas, 0.32, 0.23, 0.035, SPARK, 0.75);
  drawCircle(canvas, 0.68, 0.2, 0.03, NODE_SECONDARY, 0.6);

  const stride = size * 4 + 1;
  const raw = Buffer.alloc(stride * size);
  let offset = 0;
  for (let y = 0; y < size; y++) {
    raw[offset++] = 0;
    for (let x = 0; x < size; x++) {
      const idx = (y * size + x) * 4;
      raw[offset++] = canvas.data[idx];
      raw[offset++] = canvas.data[idx + 1];
      raw[offset++] = canvas.data[idx + 2];
      raw[offset++] = canvas.data[idx + 3];
    }
  }

  const header = Buffer.from("\x89PNG\r\n\x1a\n", "binary");
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(size, 0);
  ihdr.writeUInt32BE(size, 4);
  ihdr[8] = 8;
  ihdr[9] = 6;
  const ihdrChunk = pngChunk(Buffer.from("IHDR"), ihdr);
  const idatChunk = pngChunk(Buffer.from("IDAT"), deflateSync(raw, { level: 9 }));
  const iendChunk = pngChunk(Buffer.from("IEND"), Buffer.alloc(0));
  return Buffer.concat([header, ihdrChunk, idatChunk, iendChunk]);
}

for (const [name, size] of Object.entries(ICON_SPECS)) {
  writeFileSync(join(OUT_DIR, name), renderIcon(size));
}

for (const size of ICO_SIZES) {
  writeFileSync(join(OUT_DIR, `icon-${size}.png`), renderIcon(size));
}

function writeICO(path) {
  const entries = [];
  let offset = 6 + ICO_SIZES.length * 16;
  const dataBlocks = [];
  for (const size of ICO_SIZES) {
    const data = readFileSync(join(OUT_DIR, `icon-${size}.png`));
    const entry = Buffer.alloc(16);
    entry[0] = size === 256 ? 0 : size;
    entry[1] = size === 256 ? 0 : size;
    entry[2] = 0;
    entry[3] = 0;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    entries.push(entry);
    dataBlocks.push(data);
    offset += data.length;
  }
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(ICO_SIZES.length, 4);
  writeFileSync(path, Buffer.concat([header, ...entries, ...dataBlocks]));
}

writeICO(join(OUT_DIR, "icon.ico"));
copyFileSync(join(OUT_DIR, "icon-512.png"), join(OUT_DIR, "icon.png"));
