import type { jsPDF } from 'jspdf';
import type { TripViewModel, ItineraryItem } from '../plan-canvas/types';

/**
 * Data-driven PDF export — draws real text/vector content from the trip
 * data directly, instead of rasterizing the live DOM (html2canvas). A
 * shareable artifact deserves selectable text, small file size, and a
 * layout that doesn't depend on whatever's currently scrolled into view or
 * how many days happen to fit on screen. See PF4 in
 * docs/planner-product-audit-2026-07.md.
 */

const MARGIN = 40;
const PAGE_WIDTH = 595.28; // A4 @ 72dpi, points
const PAGE_HEIGHT = 841.89;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;
const LINE_HEIGHT = 13;

const STATUS_LABEL: Record<string, string> = {
  booked: 'BOOKED',
  priced: 'PRICED',
  planned: 'PLANNED',
  idea: 'IDEA',
};

class PdfCursor {
  doc: jsPDF;
  y: number = MARGIN;

  constructor(doc: jsPDF) {
    this.doc = doc;
  }

  ensureSpace(height: number) {
    if (this.y + height > PAGE_HEIGHT - MARGIN) {
      this.doc.addPage();
      this.y = MARGIN;
    }
  }

  text(str: string, opts: { size: number; weight?: 'normal' | 'bold'; color?: [number, number, number]; gap?: number }) {
    const { size, weight = 'normal', color = [30, 30, 26], gap = LINE_HEIGHT } = opts;
    this.doc.setFont('helvetica', weight);
    this.doc.setFontSize(size);
    this.doc.setTextColor(...color);
    const lines: string[] = this.doc.splitTextToSize(str, CONTENT_WIDTH);
    for (const line of lines) {
      this.ensureSpace(gap);
      this.doc.text(line, MARGIN, this.y);
      this.y += gap;
    }
  }

  rule() {
    this.ensureSpace(8);
    this.doc.setDrawColor(226, 221, 210);
    this.doc.line(MARGIN, this.y, PAGE_WIDTH - MARGIN, this.y);
    this.y += 12;
  }

  space(amount: number) {
    this.y += amount;
  }
}

function drawItem(cursor: PdfCursor, item: ItineraryItem) {
  const time = item.startTime ? `${item.startTime}${item.endTime ? `–${item.endTime}` : ''}  ` : '';
  const status = item.blockStatus ? STATUS_LABEL[item.blockStatus] : null;
  const titleLine = `${time}${item.title}${status ? `  [${status}]` : ''}`;
  cursor.text(titleLine, { size: 10.5, weight: 'bold' });

  const detailParts = [item.subtitle, item.price].filter(Boolean);
  if (detailParts.length) {
    cursor.text(detailParts.join('  ·  '), { size: 9, color: [104, 100, 92] });
  }
  if (item.details) {
    cursor.text(item.details, { size: 9, color: [140, 133, 123] });
  }
  cursor.space(4);
}

export async function exportTripToPdf(planData: TripViewModel): Promise<void> {
  // jsPDF's constructor does real work at module load (sets up its font
  // metrics tables) — dynamic import keeps that off every workspace visit's
  // bundle, same as the html2canvas/jsPDF pair this replaces.
  const { default: JsPdfCtor } = await import('jspdf');
  {
    const doc = new JsPdfCtor({ orientation: 'p', unit: 'pt', format: 'a4' });
    const cursor = new PdfCursor(doc);

    cursor.text(planData.title || 'Trip Itinerary', { size: 18, weight: 'bold' });
    const metaParts = [planData.stats, planData.startDate && planData.endDate ? `${planData.startDate} – ${planData.endDate}` : null].filter(Boolean);
    if (metaParts.length) {
      cursor.text(metaParts.join('  ·  '), { size: 10, color: [140, 133, 123] });
    }
    cursor.space(6);
    cursor.rule();

    for (const city of planData.cities) {
      cursor.ensureSpace(30);
      cursor.text(`${city.cityName}  —  ${city.nights} ${city.nights === 1 ? 'night' : 'nights'}`, { size: 14, weight: 'bold' });
      cursor.text(city.dateRange, { size: 9.5, color: [140, 133, 123] });
      cursor.space(6);

      for (const day of city.days) {
        const activeItems = day.items.filter((i) => !i.isInactive);
        if (activeItems.length === 0) continue;

        cursor.ensureSpace(24);
        cursor.text(`Day ${day.dayNumber}  ·  ${day.dateStr}${day.title ? `  —  ${day.title}` : ''}`, { size: 11.5, weight: 'bold', color: [68, 64, 58] });
        cursor.space(2);

        for (const item of activeItems) {
          drawItem(cursor, item);
        }
        cursor.space(4);
      }

      if (city.transitToNext && !city.transitToNext.isInactive) {
        cursor.ensureSpace(20);
        const t = city.transitToNext;
        const status = t.blockStatus ? STATUS_LABEL[t.blockStatus] : null;
        cursor.text(`→ Onward: ${t.title}${status ? `  [${status}]` : ''}`, { size: 10, weight: 'bold', color: [37, 99, 235] });
        if (t.subtitle) cursor.text(t.subtitle, { size: 9, color: [104, 100, 92] });
      }

      cursor.space(8);
      cursor.rule();
    }

    // Footer — page numbers, stamped after content since total isn't known upfront.
    const pageCount = doc.getNumberOfPages();
    for (let p = 1; p <= pageCount; p++) {
      doc.setPage(p);
      doc.setFont('helvetica', 'normal');
      doc.setFontSize(8);
      doc.setTextColor(156, 149, 123);
      doc.text(`NeuralNomad  ·  Page ${p} of ${pageCount}`, PAGE_WIDTH - MARGIN, PAGE_HEIGHT - 20, { align: 'right' });
    }

    const filename = `${(planData.title || 'neural_nomad_itinerary').replace(/[^a-z0-9]+/gi, '_').toLowerCase()}.pdf`;
    doc.save(filename);
  }
}
