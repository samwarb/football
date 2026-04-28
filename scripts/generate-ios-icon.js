import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

const root = path.resolve(import.meta.dirname, '..');
const iconset = path.join(root, 'ios/MatchdayLedger/Assets.xcassets/AppIcon.appiconset');
const sizes = [20, 29, 40, 58, 60, 76, 80, 87, 120, 152, 167, 180, 1024];

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) {
    crc ^= byte;
    for (let index = 0; index < 8; index += 1) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function chunk(type, data = Buffer.alloc(0)) {
  const typeBuffer = Buffer.from(type);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(data.length);
  const checksum = Buffer.alloc(4);
  checksum.writeUInt32BE(crc32(Buffer.concat([typeBuffer, data])));
  return Buffer.concat([length, typeBuffer, data, checksum]);
}

function png(width, height, rgba) {
  const stride = width * 4;
  const raw = Buffer.alloc((stride + 1) * height);
  for (let y = 0; y < height; y += 1) {
    raw[y * (stride + 1)] = 0;
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride);
  }

  const header = Buffer.alloc(13);
  header.writeUInt32BE(width, 0);
  header.writeUInt32BE(height, 4);
  header[8] = 8;
  header[9] = 6;

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', header),
    chunk('IDAT', zlib.deflateSync(raw, { level: 9 })),
    chunk('IEND')
  ]);
}

function mix(a, b, t) {
  return Math.round(a + (b - a) * t);
}

function setPixel(buffer, width, x, y, r, g, b, a = 255) {
  if (x < 0 || y < 0 || x >= width || y >= width) return;
  const offset = (y * width + x) * 4;
  buffer[offset] = r;
  buffer[offset + 1] = g;
  buffer[offset + 2] = b;
  buffer[offset + 3] = a;
}

function fillCircle(buffer, width, centerX, centerY, radius, color) {
  const minX = Math.floor(centerX - radius);
  const maxX = Math.ceil(centerX + radius);
  const minY = Math.floor(centerY - radius);
  const maxY = Math.ceil(centerY + radius);
  for (let y = minY; y <= maxY; y += 1) {
    for (let x = minX; x <= maxX; x += 1) {
      const distance = Math.hypot(x - centerX, y - centerY);
      if (distance <= radius) setPixel(buffer, width, x, y, ...color);
    }
  }
}

function fillRoundedRect(buffer, width, x, y, rectWidth, rectHeight, radius, color) {
  for (let py = y; py < y + rectHeight; py += 1) {
    for (let px = x; px < x + rectWidth; px += 1) {
      const dx = Math.max(x - px, 0, px - (x + rectWidth - 1));
      const dy = Math.max(y - py, 0, py - (y + rectHeight - 1));
      const cornerX = px < x + radius ? x + radius : px > x + rectWidth - radius ? x + rectWidth - radius : px;
      const cornerY = py < y + radius ? y + radius : py > y + rectHeight - radius ? y + rectHeight - radius : py;
      if (dx === 0 && dy === 0 && Math.hypot(px - cornerX, py - cornerY) <= radius) {
        setPixel(buffer, width, px, py, ...color);
      }
    }
  }
}

function drawLine(buffer, width, x1, y1, x2, y2, lineWidth, color) {
  const steps = Math.max(Math.abs(x2 - x1), Math.abs(y2 - y1));
  for (let index = 0; index <= steps; index += 1) {
    const t = steps === 0 ? 0 : index / steps;
    fillCircle(buffer, width, x1 + (x2 - x1) * t, y1 + (y2 - y1) * t, lineWidth / 2, color);
  }
}

function makeIcon(size) {
  const buffer = Buffer.alloc(size * size * 4);

  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      const t = (x * 0.65 + y * 0.35) / size;
      setPixel(
        buffer,
        size,
        x,
        y,
        mix(12, 34, t),
        mix(60, 124, t),
        mix(44, 88, t),
        255
      );
    }
  }

  const cream = [238, 230, 204, 255];
  const gold = [219, 177, 86, 255];
  const dark = [10, 42, 33, 255];
  const pitch = [26, 118, 83, 255];

  fillRoundedRect(buffer, size, size * 0.16, size * 0.18, size * 0.68, size * 0.64, size * 0.08, [18, 98, 69, 255]);
  drawLine(buffer, size, size * 0.22, size * 0.27, size * 0.78, size * 0.27, size * 0.024, cream);
  drawLine(buffer, size, size * 0.22, size * 0.39, size * 0.78, size * 0.39, size * 0.024, cream);
  drawLine(buffer, size, size * 0.22, size * 0.51, size * 0.78, size * 0.51, size * 0.024, cream);
  drawLine(buffer, size, size * 0.22, size * 0.63, size * 0.78, size * 0.63, size * 0.024, cream);
  drawLine(buffer, size, size * 0.22, size * 0.75, size * 0.78, size * 0.75, size * 0.024, cream);

  fillCircle(buffer, size, size * 0.50, size * 0.50, size * 0.16, [238, 230, 204, 255]);
  fillCircle(buffer, size, size * 0.50, size * 0.50, size * 0.105, pitch);
  drawLine(buffer, size, size * 0.50, size * 0.34, size * 0.50, size * 0.66, size * 0.026, cream);
  drawLine(buffer, size, size * 0.34, size * 0.50, size * 0.66, size * 0.50, size * 0.026, cream);

  fillRoundedRect(buffer, size, size * 0.30, size * 0.28, size * 0.40, size * 0.44, size * 0.025, [255, 255, 255, 26]);
  drawLine(buffer, size, size * 0.29, size * 0.78, size * 0.71, size * 0.78, size * 0.05, gold);
  fillCircle(buffer, size, size * 0.72, size * 0.25, size * 0.055, gold);
  fillCircle(buffer, size, size * 0.72, size * 0.25, size * 0.028, dark);

  return png(size, size, buffer);
}

function filename(size) {
  return `AppIcon-${size}.png`;
}

const contents = {
  images: [
    { idiom: 'iphone', size: '20x20', scale: '2x', filename: filename(40) },
    { idiom: 'iphone', size: '20x20', scale: '3x', filename: filename(60) },
    { idiom: 'iphone', size: '29x29', scale: '2x', filename: filename(58) },
    { idiom: 'iphone', size: '29x29', scale: '3x', filename: filename(87) },
    { idiom: 'iphone', size: '40x40', scale: '2x', filename: filename(80) },
    { idiom: 'iphone', size: '40x40', scale: '3x', filename: filename(120) },
    { idiom: 'iphone', size: '60x60', scale: '2x', filename: filename(120) },
    { idiom: 'iphone', size: '60x60', scale: '3x', filename: filename(180) },
    { idiom: 'ipad', size: '20x20', scale: '1x', filename: filename(20) },
    { idiom: 'ipad', size: '20x20', scale: '2x', filename: filename(40) },
    { idiom: 'ipad', size: '29x29', scale: '1x', filename: filename(29) },
    { idiom: 'ipad', size: '29x29', scale: '2x', filename: filename(58) },
    { idiom: 'ipad', size: '40x40', scale: '1x', filename: filename(40) },
    { idiom: 'ipad', size: '40x40', scale: '2x', filename: filename(80) },
    { idiom: 'ipad', size: '76x76', scale: '1x', filename: filename(76) },
    { idiom: 'ipad', size: '76x76', scale: '2x', filename: filename(152) },
    { idiom: 'ipad', size: '83.5x83.5', scale: '2x', filename: filename(167) },
    { idiom: 'ios-marketing', size: '1024x1024', scale: '1x', filename: filename(1024) }
  ],
  info: {
    author: 'xcode',
    version: 1
  }
};

await fs.mkdir(iconset, { recursive: true });
await fs.writeFile(path.join(iconset, 'Contents.json'), `${JSON.stringify(contents, null, 2)}\n`);
await fs.mkdir(path.join(root, 'ios/MatchdayLedger/Assets.xcassets'), { recursive: true });
await fs.writeFile(path.join(root, 'ios/MatchdayLedger/Assets.xcassets/Contents.json'), `${JSON.stringify({ info: { author: 'xcode', version: 1 } }, null, 2)}\n`);

for (const size of sizes) {
  await fs.writeFile(path.join(iconset, filename(size)), makeIcon(size));
}

console.log(`Generated ${sizes.length} app icon PNGs in ${iconset}`);
