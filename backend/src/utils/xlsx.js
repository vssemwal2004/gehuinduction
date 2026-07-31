import { XMLParser } from 'fast-xml-parser';
import { strFromU8, strToU8, unzipSync, zipSync } from 'fflate';

const parser = new XMLParser({ ignoreAttributes: false, parseTagValue: false, trimValues: false });

function array(value) {
  if (value === undefined || value === null) return [];
  return Array.isArray(value) ? value : [value];
}

function escapeXml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

function columnName(index) {
  let result = '';
  let value = index + 1;
  while (value > 0) {
    value -= 1;
    result = String.fromCharCode(65 + (value % 26)) + result;
    value = Math.floor(value / 26);
  }
  return result;
}

function dimensionRef(rowCount, columnCount) {
  return `A1:${columnName(Math.max(0, columnCount - 1))}${Math.max(1, rowCount)}`;
}

function columnDefinitions(columnCount, imageColumnIndex) {
  const columns = [];
  for (let index = 0; index < columnCount; index += 1) {
    const column = index + 1;
    const width = index === imageColumnIndex ? 18 : 24;
    columns.push(`<col min="${column}" max="${column}" width="${width}" customWidth="1"/>`);
  }
  return `<cols>${columns.join('')}</cols>`;
}

function sheetRow(row, rowIndex, imageColumnIndex) {
  const height = rowIndex > 0 && imageColumnIndex >= 0 ? ' ht="92" customHeight="1"' : '';
  const cells = row.map((value, columnIndex) => {
    const reference = `${columnName(columnIndex)}${rowIndex + 1}`;
    return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
  }).join('');
  return `<row r="${rowIndex + 1}"${height}>${cells}</row>`;
}

export function createSimpleXlsx(rows, sheetName = 'Students') {
  const worksheetRows = rows.map((row, rowIndex) => {
    const cells = row.map((value, columnIndex) => {
      const reference = `${columnName(columnIndex)}${rowIndex + 1}`;
      return `<c r="${reference}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`;
    }).join('');
    return `<row r="${rowIndex + 1}">${cells}</row>`;
  }).join('');

  const files = {
    '[Content_Types].xml': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>'),
    '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
    'xl/workbook.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'),
    'xl/styles.xml': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="1"><xf xfId="0"/></cellXfs></styleSheet>'),
    'xl/worksheets/sheet1.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${worksheetRows}</sheetData></worksheet>`),
  };
  return Buffer.from(zipSync(files, { level: 6 }));
}

export function createXlsxWithImages(rows, imagesByRow, sheetName = 'Students') {
  const imageColumnIndex = rows[0]?.length ? rows[0].length - 1 : -1;
  const worksheetRows = rows.map((row, rowIndex) => sheetRow(row, rowIndex, imageColumnIndex)).join('');
  const imageEntries = Array.from(imagesByRow.entries()).sort(([left], [right]) => left - right);
  const hasImages = imageEntries.length > 0;
  const imageExtensions = [...new Set(imageEntries.map(([_rowIndex, image]) => String(image.name).split('.').pop()?.toLowerCase()).filter(Boolean))];
  const imageContentTypes = imageExtensions.map((extension) => `<Default Extension="${escapeXml(extension)}" ContentType="${extension === 'svg' ? 'image/svg+xml' : `image/${escapeXml(extension)}`}"/>`).join('');
  const drawingRelationships = imageEntries.map(([_rowIndex, image], index) => `<Relationship Id="rId${index + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/image" Target="../media/${escapeXml(image.name)}"/>`).join('');
  const anchors = imageEntries.map(([rowIndex, _image], index) => {
    const row = rowIndex;
    const column = imageColumnIndex;
    return `<xdr:oneCellAnchor><xdr:from><xdr:col>${column}</xdr:col><xdr:colOff>95250</xdr:colOff><xdr:row>${row}</xdr:row><xdr:rowOff>95250</xdr:rowOff></xdr:from><xdr:ext cx="857250" cy="857250"/><xdr:pic><xdr:nvPicPr><xdr:cNvPr id="${index + 1}" name="QR ${index + 1}"/><xdr:cNvPicPr/></xdr:nvPicPr><xdr:blipFill><a:blip r:embed="rId${index + 1}"/><a:stretch><a:fillRect/></a:stretch></xdr:blipFill><xdr:spPr><a:prstGeom prst="rect"><a:avLst/></a:prstGeom></xdr:spPr></xdr:pic><xdr:clientData/></xdr:oneCellAnchor>`;
  }).join('');
  const files = {
    '[Content_Types].xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/>${hasImages ? `${imageContentTypes}<Override PartName="/xl/drawings/drawing1.xml" ContentType="application/vnd.openxmlformats-officedocument.drawing+xml"/>` : ''}<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/></Types>`),
    '_rels/.rels': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>'),
    'xl/workbook.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="${escapeXml(sheetName)}" sheetId="1" r:id="rId1"/></sheets></workbook>`),
    'xl/_rels/workbook.xml.rels': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/><Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>'),
    'xl/styles.xml': strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><fonts count="1"><font><sz val="11"/><name val="Calibri"/></font></fonts><fills count="1"><fill><patternFill patternType="none"/></fill></fills><borders count="1"><border/></borders><cellStyleXfs count="1"><xf/></cellStyleXfs><cellXfs count="1"><xf xfId="0"/></cellXfs></styleSheet>'),
    'xl/worksheets/sheet1.xml': strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><dimension ref="${dimensionRef(rows.length, rows[0]?.length || 1)}"/>${columnDefinitions(rows[0]?.length || 1, imageColumnIndex)}<sheetData>${worksheetRows}</sheetData>${hasImages ? '<drawing r:id="rId1"/>' : ''}</worksheet>`),
  };
  if (hasImages) {
    files['xl/worksheets/_rels/sheet1.xml.rels'] = strToU8('<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/drawing" Target="../drawings/drawing1.xml"/></Relationships>');
    files['xl/drawings/drawing1.xml'] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><xdr:wsDr xmlns:xdr="http://schemas.openxmlformats.org/drawingml/2006/spreadsheetDrawing" xmlns:a="http://schemas.openxmlformats.org/drawingml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">${anchors}</xdr:wsDr>`);
    files['xl/drawings/_rels/drawing1.xml.rels'] = strToU8(`<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${drawingRelationships}</Relationships>`);
    imageEntries.forEach(([_rowIndex, image]) => {
      files[`xl/media/${image.name}`] = new Uint8Array(image.buffer);
    });
  }
  return Buffer.from(zipSync(files, { level: 6 }));
}

function textValue(value) {
  if (typeof value === 'string' || typeof value === 'number') return String(value);
  return value?.['#text'] === undefined ? '' : String(value['#text']);
}

function sharedText(item) {
  const direct = textValue(item?.t);
  if (direct) return direct;
  return array(item?.r).map((run) => textValue(run?.t)).join('');
}

export function parseSimpleXlsx(buffer) {
  const source = Buffer.from(buffer);
  const searchStart = Math.max(0, source.length - 65_557);
  let endOffset = -1;
  for (let offset = source.length - 22; offset >= searchStart; offset -= 1) {
    if (source.readUInt32LE(offset) === 0x06054b50) {
      endOffset = offset;
      break;
    }
  }
  if (endOffset < 0) throw new Error('The uploaded Excel file is invalid or damaged');
  const entryCount = source.readUInt16LE(endOffset + 10);
  let centralOffset = source.readUInt32LE(endOffset + 16);
  if (entryCount > 100) throw new Error('The Excel workbook contains too many internal files');
  let totalUncompressed = 0;
  for (let index = 0; index < entryCount; index += 1) {
    if (centralOffset + 46 > source.length || source.readUInt32LE(centralOffset) !== 0x02014b50) {
      throw new Error('The uploaded Excel file is invalid or damaged');
    }
    const uncompressedSize = source.readUInt32LE(centralOffset + 24);
    const fileNameLength = source.readUInt16LE(centralOffset + 28);
    const extraLength = source.readUInt16LE(centralOffset + 30);
    const commentLength = source.readUInt16LE(centralOffset + 32);
    if (uncompressedSize > 16 * 1024 * 1024) throw new Error('An Excel worksheet is too large to process safely');
    totalUncompressed += uncompressedSize;
    if (totalUncompressed > 32 * 1024 * 1024) throw new Error('The Excel workbook expands beyond the safe processing limit');
    centralOffset += 46 + fileNameLength + extraLength + commentLength;
  }
  let files;
  try {
    files = unzipSync(new Uint8Array(source));
  } catch {
    throw new Error('The uploaded Excel file is invalid or damaged');
  }
  const sheetFile = files['xl/worksheets/sheet1.xml'];
  if (!sheetFile) throw new Error('The workbook does not contain a first worksheet');

  const sharedFile = files['xl/sharedStrings.xml'];
  const shared = sharedFile
    ? array(parser.parse(strFromU8(sharedFile))?.sst?.si).map(sharedText)
    : [];
  const sheet = parser.parse(strFromU8(sheetFile))?.worksheet;
  return array(sheet?.sheetData?.row).map((row) => {
    const result = [];
    array(row?.c).forEach((cell) => {
      const reference = String(cell?.['@_r'] || 'A1');
      const letters = reference.match(/[A-Z]+/)?.[0] || 'A';
      let column = 0;
      for (const letter of letters) column = column * 26 + letter.charCodeAt(0) - 64;
      const raw = cell?.['@_t'] === 's'
        ? shared[Number(cell?.v)] || ''
        : cell?.['@_t'] === 'inlineStr'
          ? sharedText(cell?.is)
          : cell?.v ?? '';
      result[column - 1] = String(raw).trim();
    });
    return result;
  });
}
