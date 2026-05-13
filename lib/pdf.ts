'use client';

import { PDFDocument, type PDFFont, type PDFPage, rgb, StandardFonts } from 'pdf-lib';
import { computeRunningBalance } from '@/lib/entries';
import type { Entry, PersonEntry } from '@/lib/types';

function formatDate(date: Date): string {
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
}

function formatPdfAmount(amount: number): string {
  const abs = Math.abs(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${amount < 0 ? '-' : '+'}Rs.${abs}`;
}

function formatPdfBalance(amount: number): string {
  const abs = Math.abs(amount).toLocaleString('en-IN', {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  });
  return `${amount < 0 ? '-' : ''}Rs.${abs}`;
}

function safeText(text: string): string {
  return text.replace(/[^\x20-\x7E]/g, ' ');
}

function sanitizeFilename(name: string): string {
  return safeText(name).replace(/[\\/:*?"<>|]/g, '-').trim() || 'Money-Ledger';
}

async function createBasePdf(title: string): Promise<{
  pdfDoc: PDFDocument;
  page: PDFPage;
  font: PDFFont;
  boldFont: PDFFont;
  pageWidth: number;
}> {
  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const page = pdfDoc.addPage([595, 842]);
  const { width } = page.getSize();

  page.drawRectangle({ x: 0, y: 792, width, height: 50, color: rgb(0.49, 0.43, 0.97) });
  page.drawText('Money Ledger', { x: 40, y: 812, size: 14, font: boldFont, color: rgb(1, 1, 1) });
  page.drawText(safeText(title).slice(0, 72), {
    x: 40,
    y: 796,
    size: 11,
    font,
    color: rgb(0.9, 0.9, 1),
  });
  page.drawText(`Generated: ${new Date().toLocaleDateString('en-IN')}`, {
    x: width - 160,
    y: 806,
    size: 9,
    font,
    color: rgb(0.9, 0.9, 1),
  });

  return { pdfDoc, page, font, boldFont, pageWidth: width };
}

function drawHeader(
  page: PDFPage,
  y: number,
  font: PDFFont,
  pageWidth: number,
  columns: { date: number; note: number; amount: number; balance: number },
  margin: number
): number {
  page.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 0.5,
    color: rgb(0.72, 0.72, 0.72),
  });
  page.drawText('Date', { x: columns.date, y: y - 14, size: 8, font, color: rgb(0.5, 0.5, 0.5) });
  page.drawText('Description', { x: columns.note, y: y - 14, size: 8, font, color: rgb(0.5, 0.5, 0.5) });
  page.drawText('Amount', { x: columns.amount - 30, y: y - 14, size: 8, font, color: rgb(0.5, 0.5, 0.5) });
  page.drawText('Balance', { x: columns.balance - 34, y: y - 14, size: 8, font, color: rgb(0.5, 0.5, 0.5) });
  return y - 28;
}

export async function exportWindowToPDF(windowTitle: string, entries: Entry[]): Promise<void> {
  const { pdfDoc, page, font, boldFont, pageWidth } = await createBasePdf(windowTitle);
  const margin = 40;
  const columns = {
    date: margin,
    note: margin + 80,
    amount: pageWidth - 168,
    balance: pageWidth - 68,
  };
  let currentPage = page;
  let y = drawHeader(currentPage, 762, boldFont, pageWidth, columns, margin);

  for (const entry of computeRunningBalance(entries)) {
    if (y < 60) {
      currentPage = pdfDoc.addPage([595, 842]);
      y = drawHeader(currentPage, 800, boldFont, pageWidth, columns, margin);
    }

    const amountColor = entry.amount >= 0 ? rgb(0.13, 0.62, 0.44) : rgb(0.82, 0.24, 0.24);
    const balanceColor = entry.runningBalance >= 0 ? rgb(0.13, 0.62, 0.44) : rgb(0.82, 0.24, 0.24);
    const note = safeText(entry.note || entry.rawText).slice(0, 38);
    const amountText = formatPdfAmount(entry.amount);
    const balanceText = formatPdfBalance(entry.runningBalance);

    currentPage.drawText(formatDate(entry.entryDate), {
      x: columns.date,
      y,
      size: 8,
      font,
      color: rgb(0.28, 0.28, 0.28),
    });
    currentPage.drawText(note, { x: columns.note, y, size: 9, font, color: rgb(0.1, 0.1, 0.1) });
    currentPage.drawText(amountText, {
      x: columns.amount - amountText.length * 4.4,
      y,
      size: 9,
      font: boldFont,
      color: amountColor,
    });
    currentPage.drawText(balanceText, {
      x: columns.balance - balanceText.length * 4.4,
      y,
      size: 9,
      font: boldFont,
      color: balanceColor,
    });
    currentPage.drawLine({
      start: { x: margin, y: y - 5 },
      end: { x: pageWidth - margin, y: y - 5 },
      thickness: 0.3,
      color: rgb(0.93, 0.93, 0.93),
    });
    y -= 20;
  }

  const total = entries.reduce((sum, entry) => sum + entry.amount, 0);
  if (y < 60) {
    currentPage = pdfDoc.addPage([595, 842]);
    y = 800;
  }
  const totalText = formatPdfAmount(total);
  currentPage.drawLine({
    start: { x: margin, y },
    end: { x: pageWidth - margin, y },
    thickness: 1,
    color: rgb(0.72, 0.72, 0.72),
  });
  currentPage.drawText('TOTAL', { x: columns.note, y: y - 16, size: 9, font: boldFont, color: rgb(0.25, 0.25, 0.25) });
  currentPage.drawText(totalText, {
    x: columns.balance - totalText.length * 4.6,
    y: y - 16,
    size: 11,
    font: boldFont,
    color: total >= 0 ? rgb(0.13, 0.62, 0.44) : rgb(0.82, 0.24, 0.24),
  });

  downloadPdf(await pdfDoc.save(), `${sanitizeFilename(windowTitle)}.pdf`);
}

export async function exportPersonToPDF(personName: string, entries: PersonEntry[]): Promise<void> {
  const { pdfDoc, page, font, boldFont, pageWidth } = await createBasePdf(`${personName} - Ledger`);
  const margin = 40;
  const columns = {
    date: margin,
    note: margin + 80,
    amount: pageWidth - 168,
    balance: pageWidth - 68,
  };
  let currentPage = page;
  let y = drawHeader(currentPage, 762, boldFont, pageWidth, columns, margin);

  for (const entry of computeRunningBalance(entries)) {
    if (y < 60) {
      currentPage = pdfDoc.addPage([595, 842]);
      y = drawHeader(currentPage, 800, boldFont, pageWidth, columns, margin);
    }

    const amountText = formatPdfAmount(entry.amount);
    const balanceText = formatPdfBalance(entry.runningBalance);

    currentPage.drawText(formatDate(entry.entryDate), {
      x: columns.date,
      y,
      size: 8,
      font,
      color: rgb(0.28, 0.28, 0.28),
    });
    currentPage.drawText(safeText(entry.note || entry.rawText).slice(0, 38), {
      x: columns.note,
      y,
      size: 9,
      font,
      color: rgb(0.1, 0.1, 0.1),
    });
    currentPage.drawText(amountText, {
      x: columns.amount - amountText.length * 4.4,
      y,
      size: 9,
      font: boldFont,
      color: entry.amount >= 0 ? rgb(0.13, 0.62, 0.44) : rgb(0.82, 0.24, 0.24),
    });
    currentPage.drawText(balanceText, {
      x: columns.balance - balanceText.length * 4.4,
      y,
      size: 9,
      font: boldFont,
      color: entry.runningBalance >= 0 ? rgb(0.13, 0.62, 0.44) : rgb(0.82, 0.24, 0.24),
    });
    y -= 20;
  }

  downloadPdf(await pdfDoc.save(), `${sanitizeFilename(personName)}-ledger.pdf`);
}

function downloadPdf(bytes: Uint8Array, filename: string): void {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  const blob = new Blob([copy], { type: 'application/pdf' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  setTimeout(() => URL.revokeObjectURL(url), 0);
}
