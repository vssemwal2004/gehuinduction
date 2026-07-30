import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PNG } from 'pngjs';
import QRCode from 'qrcode';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const templatePath = path.resolve(__dirname, '../../../frontend/src/img/123.png');
// The template is 1024 × 1536. Keep the generated code inside the printed
// red scanner frame, below the “SCAN ME” label, without covering its border.
const qrBox = { x: 257, y: 550, size: 510 };

let cachedTemplate;

function template() {
  if (!cachedTemplate) cachedTemplate = PNG.sync.read(fs.readFileSync(templatePath));
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
