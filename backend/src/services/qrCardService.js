import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';
import QRCode from 'qrcode';
import jpeg from 'jpeg-js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templatePath = path.resolve(__dirname, '../../../frontend/src/img/123.png');
// The template is 1024 × 1536. Keep the generated code inside the printed
// red scanner frame, below the “SCAN ME” label, without covering its border.
const qrBox = { x: 257, y: 550, size: 510 };

let cachedTemplate;
let cachedTemplateSource;
let cachedCompactTemplateDataUri;

export function getQrCardTemplate() {
  if (!cachedTemplateSource) cachedTemplateSource = fs.readFileSync(templatePath);
  return cachedTemplateSource;
}

function template() {
  if (!cachedTemplate) cachedTemplate = PNG.sync.read(getQrCardTemplate());
  const image = new PNG({ width: cachedTemplate.width, height: cachedTemplate.height });
  cachedTemplate.data.copy(image.data);
  return image;
}

function copyPixel(source, target, sourceX, sourceY, targetX, targetY) {
  const sourceIndex = (source.width * sourceY + sourceX) << 2;
  const targetIndex = (target.width * targetY + targetX) << 2;
  target.data[targetIndex] = source.data[sourceIndex];
  target.data[targetIndex + 1] = source.data[sourceIndex + 1];
  target.data[targetIndex + 2] = source.data[sourceIndex + 2];
  target.data[targetIndex + 3] = source.data[sourceIndex + 3];
}

function drawImage(source, target, box) {
  for (let y = 0; y < box.size; y += 1) {
    const sourceY = Math.min(source.height - 1, Math.floor((y / box.size) * source.height));
    for (let x = 0; x < box.size; x += 1) {
      const sourceX = Math.min(source.width - 1, Math.floor((x / box.size) * source.width));
      copyPixel(source, target, sourceX, sourceY, box.x + x, box.y + y);
    }
  }
}

export async function createStudentQrCard(token) {
  const card = template();
  const qrBuffer = await QRCode.toBuffer(`GEUQR1:${token}`, {
    type: 'png',
    errorCorrectionLevel: 'H',
    width: qrBox.size,
    margin: 2,
    color: { dark: '#000000', light: '#FFFFFF' },
  });
  drawImage(PNG.sync.read(qrBuffer), card, qrBox);
  return PNG.sync.write(card);
}

function compactTemplateDataUri() {
  if (cachedCompactTemplateDataUri) return cachedCompactTemplateDataUri;
  const source = template();
  const width = 512;
  const height = 768;
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const targetIndex = (width * y + x) << 2;
      const sourceX = x * 2;
      const sourceY = y * 2;
      for (let channel = 0; channel < 4; channel += 1) {
        const topLeft = source.data[((source.width * sourceY + sourceX) << 2) + channel];
        const topRight = source.data[((source.width * sourceY + sourceX + 1) << 2) + channel];
        const bottomLeft = source.data[((source.width * (sourceY + 1) + sourceX) << 2) + channel];
        const bottomRight = source.data[((source.width * (sourceY + 1) + sourceX + 1) << 2) + channel];
        data[targetIndex + channel] = Math.round((topLeft + topRight + bottomLeft + bottomRight) / 4);
      }
    }
  }
  const compressed = jpeg.encode({ data, width, height }, 70).data;
  cachedCompactTemplateDataUri = `data:image/jpeg;base64,${compressed.toString('base64')}`;
  return cachedCompactTemplateDataUri;
}

// SVG is compact, resolution-independent and much faster to create than PNG.
// It keeps a full-cohort ZIP in the MB range without blocking the API process.
export async function createStudentQrTemplateSvg(token) {
  const qr = await QRCode.toString(`GEUQR1:${token}`, {
    type: 'svg',
    errorCorrectionLevel: 'M',
    width: qrBox.size,
    margin: 3,
    color: { dark: '#000000', light: '#FFFFFF' },
  });
  const positionedQr = qr.replace('<svg ', `<svg x="${qrBox.x}" y="${qrBox.y}" `);
  const background = compactTemplateDataUri();
  return `<?xml version="1.0" encoding="UTF-8"?>\n<svg xmlns="http://www.w3.org/2000/svg" width="512" height="768" viewBox="0 0 1024 1536" role="img" aria-label="GEU student QR card">\n  <image href="${background}" x="0" y="0" width="1024" height="1536" preserveAspectRatio="none"/>\n  ${positionedQr}\n</svg>`;
}

export function createStudentQrImage(token) {
  const qr = QRCode.create(`GEUQR1:${token}`, { errorCorrectionLevel: 'M' });
  const margin = 2;
  const scale = 4;
  const size = (qr.modules.size + margin * 2) * scale;
  const image = new PNG({ width: size, height: size });
  image.data.fill(255);
  for (let y = 0; y < qr.modules.size; y += 1) {
    for (let x = 0; x < qr.modules.size; x += 1) {
      if (!qr.modules.get(x, y)) continue;
      for (let offsetY = 0; offsetY < scale; offsetY += 1) {
        for (let offsetX = 0; offsetX < scale; offsetX += 1) {
          const pixel = ((((y + margin) * scale + offsetY) * size + ((x + margin) * scale + offsetX)) << 2);
          image.data[pixel] = 0;
          image.data[pixel + 1] = 0;
          image.data[pixel + 2] = 0;
          image.data[pixel + 3] = 255;
        }
      }
    }
  }
  return PNG.sync.write(image, { colorType: 0, deflateLevel: 9, deflateStrategy: 3 });
}
