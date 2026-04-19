import fs from "node:fs";
import path from "node:path";
import zlib from "node:zlib";

const buildDirectory = import.meta.dirname;
const iconsDirectory = path.join(buildDirectory, "icons");
const pngDirectory = path.join(iconsDirectory, "png");
const sizes = [16, 24, 32, 48, 64, 128, 256, 512, 1024];

fs.mkdirSync(pngDirectory, { recursive: true });

function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function mixColor(from, to, t) {
  return [
    Math.round(lerp(from[0], to[0], t)),
    Math.round(lerp(from[1], to[1], t)),
    Math.round(lerp(from[2], to[2], t)),
    Math.round(lerp(from[3], to[3], t)),
  ];
}

function isInsideRoundedRect(x, y, left, top, right, bottom, radius) {
  if (x < left || x > right || y < top || y > bottom) {
    return false;
  }

  const innerLeft = left + radius;
  const innerRight = right - radius;
  const innerTop = top + radius;
  const innerBottom = bottom - radius;

  if ((x >= innerLeft && x <= innerRight) || (y >= innerTop && y <= innerBottom)) {
    return true;
  }

  const cornerX = x < innerLeft ? innerLeft : innerRight;
  const cornerY = y < innerTop ? innerTop : innerBottom;
  const dx = x - cornerX;
  const dy = y - cornerY;
  return dx * dx + dy * dy <= radius * radius;
}

function signedArea(ax, ay, bx, by, cx, cy) {
  return (ax - cx) * (by - cy) - (bx - cx) * (ay - cy);
}

function isInsideTriangle(x, y, ax, ay, bx, by, cx, cy) {
  const first = signedArea(x, y, ax, ay, bx, by);
  const second = signedArea(x, y, bx, by, cx, cy);
  const third = signedArea(x, y, cx, cy, ax, ay);
  const hasNegative = first < 0 || second < 0 || third < 0;
  const hasPositive = first > 0 || second > 0 || third > 0;
  return !(hasNegative && hasPositive);
}

function isInsideCircle(x, y, centerX, centerY, radius) {
  const dx = x - centerX;
  const dy = y - centerY;
  return dx * dx + dy * dy <= radius * radius;
}

function drawSample(x, y) {
  const cornerRadius = 0.22;
  const backgroundInset = 0.04;
  const isBackground = isInsideRoundedRect(
    x,
    y,
    backgroundInset,
    backgroundInset,
    1 - backgroundInset,
    1 - backgroundInset,
    cornerRadius,
  );

  if (!isBackground) {
    return [0, 0, 0, 0];
  }

  const primary = [37, 99, 235, 255];
  const secondary = [14, 165, 233, 255];
  const accent = [249, 115, 22, 255];
  const shadow = [15, 23, 42, 255];
  const highlight = [255, 255, 255, 255];

  const diagonalT = clamp((x * 0.65 + y * 0.95) / 1.6, 0, 1);
  let color = mixColor(primary, secondary, diagonalT);

  if (isInsideCircle(x, y, 0.28, 0.24, 0.23)) {
    color = mixColor(color, highlight, 0.14);
  }

  if (isInsideCircle(x, y, 0.82, 0.86, 0.42)) {
    color = mixColor(color, shadow, 0.18);
  }

  const bubble = isInsideRoundedRect(x, y, 0.16, 0.18, 0.82, 0.67, 0.12);
  const tail = isInsideTriangle(x, y, 0.34, 0.66, 0.50, 0.66, 0.29, 0.84);

  if (bubble || tail) {
    color = [255, 255, 255, 255];
  }

  if (isInsideRoundedRect(x, y, 0.28, 0.33, 0.67, 0.40, 0.03)) {
    color = [59, 130, 246, 255];
  }

  if (isInsideRoundedRect(x, y, 0.28, 0.47, 0.57, 0.54, 0.03)) {
    color = [59, 130, 246, 255];
  }

  if (isInsideCircle(x, y, 0.75, 0.27, 0.13)) {
    color = accent;
  }

  if (isInsideCircle(x, y, 0.71, 0.23, 0.04)) {
    color = highlight;
  }

  return color;
}

function renderIcon(size) {
  const samplesPerAxis = size <= 32 ? 6 : size <= 128 ? 4 : 2;
  const sampleCount = samplesPerAxis * samplesPerAxis;
  const output = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let red = 0;
      let green = 0;
      let blue = 0;
      let alpha = 0;

      for (let sy = 0; sy < samplesPerAxis; sy += 1) {
        for (let sx = 0; sx < samplesPerAxis; sx += 1) {
          const normalizedX = (x + (sx + 0.5) / samplesPerAxis) / size;
          const normalizedY = (y + (sy + 0.5) / samplesPerAxis) / size;
          const sample = drawSample(normalizedX, normalizedY);
          red += sample[0];
          green += sample[1];
          blue += sample[2];
          alpha += sample[3];
        }
      }

      const offset = (y * size + x) * 4;
      output[offset] = Math.round(red / sampleCount);
      output[offset + 1] = Math.round(green / sampleCount);
      output[offset + 2] = Math.round(blue / sampleCount);
      output[offset + 3] = Math.round(alpha / sampleCount);
    }
  }

  return output;
}

const crcTable = new Uint32Array(256).map((_, index) => {
  let value = index;
  for (let bit = 0; bit < 8; bit += 1) {
    value = (value & 1) === 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  }
  return value >>> 0;
});

function crc32(buffer) {
  let value = 0xffffffff;
  for (const byte of buffer) {
    value = crcTable[(value ^ byte) & 0xff] ^ (value >>> 8);
  }
  return (value ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const typeBuffer = Buffer.from(type, "ascii");
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length, 0);

  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])), 0);

  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function encodePng(size, rgba) {
  const scanlines = [];
  for (let y = 0; y < size; y += 1) {
    const start = y * size * 4;
    const end = start + size * 4;
    scanlines.push(Buffer.from([0]));
    scanlines.push(rgba.subarray(start, end));
  }

  const compressed = zlib.deflateSync(Buffer.concat(scanlines), { level: 9 });
  const header = Buffer.alloc(13);
  header.writeUInt32BE(size, 0);
  header.writeUInt32BE(size, 4);
  header[8] = 8;
  header[9] = 6;
  header[10] = 0;
  header[11] = 0;
  header[12] = 0;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    createChunk("IHDR", header),
    createChunk("IDAT", compressed),
    createChunk("IEND", Buffer.alloc(0)),
  ]);
}

function createIco(pngs) {
  const header = Buffer.alloc(6);
  header.writeUInt16LE(0, 0);
  header.writeUInt16LE(1, 2);
  header.writeUInt16LE(pngs.length, 4);

  const entries = [];
  let offset = 6 + pngs.length * 16;

  for (const { size, data } of pngs) {
    const entry = Buffer.alloc(16);
    entry[0] = size >= 256 ? 0 : size;
    entry[1] = size >= 256 ? 0 : size;
    entry[2] = 0;
    entry[3] = 0;
    entry.writeUInt16LE(1, 4);
    entry.writeUInt16LE(32, 6);
    entry.writeUInt32LE(data.length, 8);
    entry.writeUInt32LE(offset, 12);
    offset += data.length;
    entries.push(entry);
  }

  return Buffer.concat([header, ...entries, ...pngs.map(({ data }) => data)]);
}

function createIcns(pngsBySize) {
  const typeMap = new Map([
    [16, "icp4"],
    [32, "icp5"],
    [64, "icp6"],
    [128, "ic07"],
    [256, "ic08"],
    [512, "ic09"],
    [1024, "ic10"],
  ]);

  const chunks = [];
  for (const [size, type] of typeMap) {
    const png = pngsBySize.get(size);
    if (!png) {
      continue;
    }

    const chunkHeader = Buffer.alloc(8);
    chunkHeader.write(type, 0, "ascii");
    chunkHeader.writeUInt32BE(8 + png.length, 4);
    chunks.push(Buffer.concat([chunkHeader, png]));
  }

  const totalLength = 8 + chunks.reduce((sum, chunk) => sum + chunk.length, 0);
  const header = Buffer.alloc(8);
  header.write("icns", 0, "ascii");
  header.writeUInt32BE(totalLength, 4);

  return Buffer.concat([header, ...chunks]);
}

const pngs = new Map();
for (const size of sizes) {
  const pixels = renderIcon(size);
  const png = encodePng(size, pixels);
  pngs.set(size, png);
  fs.writeFileSync(path.join(pngDirectory, `${size}x${size}.png`), png);
}

fs.writeFileSync(path.join(buildDirectory, "icon.png"), pngs.get(512));
fs.writeFileSync(
  path.join(buildDirectory, "icon.ico"),
  createIco([16, 24, 32, 48, 64, 128, 256].map((size) => ({ size, data: pngs.get(size) }))),
);
fs.writeFileSync(path.join(buildDirectory, "icon.icns"), createIcns(pngs));

const sourceSvg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1024 1024">
  <defs>
    <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#2563eb" />
      <stop offset="100%" stop-color="#0ea5e9" />
    </linearGradient>
  </defs>
  <rect x="40" y="40" width="944" height="944" rx="220" fill="url(#bg)" />
  <circle cx="290" cy="250" r="220" fill="#ffffff" opacity="0.12" />
  <circle cx="840" cy="900" r="420" fill="#0f172a" opacity="0.18" />
  <path d="M190 190h500c75 0 136 61 136 136v239c0 75-61 136-136 136H510L300 860c-17 13-41-4-34-25l41-134H190c-75 0-136-61-136-136V326c0-75 61-136 136-136z" fill="#ffffff"/>
  <rect x="286" y="337" width="402" height="71" rx="30" fill="#3b82f6" />
  <rect x="286" y="478" width="299" height="71" rx="30" fill="#3b82f6" />
  <circle cx="768" cy="276" r="132" fill="#f97316" />
  <circle cx="728" cy="236" r="42" fill="#ffffff" />
</svg>
`;

fs.writeFileSync(path.join(buildDirectory, "icon.svg"), sourceSvg, "utf8");

console.log(`Generated icon assets in ${buildDirectory}`);
