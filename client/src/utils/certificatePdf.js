import { notify } from '../services/notify';

function pdfEscape(value) {
  return String(value || '')
    .replace(/\\/g, '\\\\')
    .replace(/\(/g, '\\(')
    .replace(/\)/g, '\\)');
}

function buildPdf(lines) {
  const content = [
    'BT',
    ...lines.map(line => `/${line.font || 'F1'} ${line.size || 14} Tf 1 0 0 1 ${line.x} ${line.y} Tm (${pdfEscape(line.text)}) Tj`),
    'ET',
  ].join('\n');

  const objects = [
    '<< /Type /Catalog /Pages 2 0 R >>',
    '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
    '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 842 595] /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> /Contents 4 0 R >>',
    `<< /Length ${content.length} >>\nstream\n${content}\nendstream`,
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>',
    '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>',
  ];

  let pdf = '%PDF-1.4\n';
  const offsets = [0];
  objects.forEach((obj, idx) => {
    offsets.push(pdf.length);
    pdf += `${idx + 1} 0 obj\n${obj}\nendobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  offsets.slice(1).forEach(offset => {
    pdf += `${String(offset).padStart(10, '0')} 00000 n \n`;
  });
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`;
  return pdf;
}

export function openCertificatePdf({
  name,
  domain,
  date,
  id,
  internId,
}) {
  const pdf = buildPdf([
    { text: 'DEVCRAFT VIRTUAL INTERNSHIP PROGRAM', x: 215, y: 520, size: 16, font: 'F2' },
    { text: 'CERTIFICATE OF COMPLETION', x: 230, y: 475, size: 28, font: 'F2' },
    { text: 'This certificate is proudly presented to', x: 295, y: 425, size: 13 },
    { text: name, x: 290, y: 385, size: 30, font: 'F2' },
    { text: `for successfully completing the virtual internship in ${domain}.`, x: 165, y: 335, size: 15 },
    { text: 'The candidate demonstrated commitment, completed assigned project work,', x: 170, y: 310, size: 13 },
    { text: 'and met the program completion criteria reviewed by DevCraft.', x: 205, y: 290, size: 13 },
    { text: `Date of Issue: ${date}`, x: 90, y: 145, size: 12, font: 'F2' },
    { text: `Intern ID: ${internId}`, x: 575, y: 145, size: 12, font: 'F2' },
    { text: 'DevCraft', x: 386, y: 155, size: 18, font: 'F2' },
    { text: 'Authorized Signatory', x: 360, y: 130, size: 11 },
    { text: `Credential ID: ${id}`, x: 330, y: 65, size: 10 },
  ]);

  const blob = new Blob([pdf], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const win = window.open(url, '_blank');
  if (!win) {
    URL.revokeObjectURL(url);
    notify('Please allow pop-ups to open your certificate PDF.', 'warning');
  }
}
