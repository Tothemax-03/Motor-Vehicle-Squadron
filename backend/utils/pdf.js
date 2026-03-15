const PDFDocument = require('pdfkit');

function streamSimpleReportPdf(res, title, columns, rows) {
  const doc = new PDFDocument({ margin: 36, size: 'A4' });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${title.toLowerCase().replace(/\s+/g, '_')}.pdf"`);

  doc.pipe(res);

  doc.fontSize(18).text(title, { align: 'center' });
  doc.moveDown(1);
  doc.fontSize(10).text(`Generated: ${new Date().toLocaleString()}`);
  doc.moveDown(1);

  doc.font('Helvetica-Bold').text(columns.join(' | '));
  doc.moveDown(0.5);
  doc.font('Helvetica');

  rows.forEach((row) => {
    const line = columns.map((col) => (row[col] == null ? '' : String(row[col]))).join(' | ');
    doc.text(line);
  });

  doc.end();
}

module.exports = {
  streamSimpleReportPdf
};
