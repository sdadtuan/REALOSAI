'use strict';

const fs = require('fs');
const { execSync } = require('child_process');

function decodeXmlEntities(text) {
  return String(text)
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>');
}

function extractDocumentXml(docxPath) {
  return execSync(`unzip -p ${JSON.stringify(docxPath)} word/document.xml`, {
    encoding: 'utf8',
    maxBuffer: 50 * 1024 * 1024,
  });
}

function extractParagraphsFromDocx(docxPath) {
  if (!fs.existsSync(docxPath)) {
    throw new Error(`DOCX not found: ${docxPath}`);
  }
  const xml = extractDocumentXml(docxPath);
  const paragraphs = [];
  const paragraphRe = /<w:p[\s>][\s\S]*?<\/w:p>/g;
  let match;
  while ((match = paragraphRe.exec(xml))) {
    const parts = [];
    const textRe = /<w:t[^>]*>([^<]*)<\/w:t>/g;
    let textMatch;
    while ((textMatch = textRe.exec(match[0]))) {
      parts.push(textMatch[1]);
    }
    const text = decodeXmlEntities(parts.join('')).trim();
    if (text) paragraphs.push(text);
  }
  return paragraphs;
}

function extractTablesFromDocx(docxPath) {
  if (!fs.existsSync(docxPath)) {
    throw new Error(`DOCX not found: ${docxPath}`);
  }
  const xml = extractDocumentXml(docxPath);
  const tables = [];
  const tableRe = /<w:tbl[\s\S]*?<\/w:tbl>/g;
  let tableMatch;
  while ((tableMatch = tableRe.exec(xml))) {
    const rows = [];
    const rowRe = /<w:tr[\s\S]*?<\/w:tr>/g;
    let rowMatch;
    while ((rowMatch = rowRe.exec(tableMatch[0]))) {
      const cells = [];
      const cellRe = /<w:tc[\s\S]*?<\/w:tc>/g;
      let cellMatch;
      while ((cellMatch = cellRe.exec(rowMatch[0]))) {
        const parts = [];
        const textRe = /<w:t[^>]*>([^<]*)<\/w:t>/g;
        let textMatch;
        while ((textMatch = textRe.exec(cellMatch[0]))) {
          parts.push(textMatch[1]);
        }
        cells.push(decodeXmlEntities(parts.join('')).trim());
      }
      if (cells.some((c) => c)) rows.push(cells);
    }
    if (rows.length) tables.push(rows);
  }
  return tables;
}

module.exports = {
  decodeXmlEntities,
  extractDocumentXml,
  extractParagraphsFromDocx,
  extractTablesFromDocx,
};
