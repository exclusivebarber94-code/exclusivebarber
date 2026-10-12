import { formatCOP } from '../data';

// PDF del reporte (mensual o anual), con el mismo estilo del reporte anual de la barbería.
// jsPDF se carga solo al exportar, para no hacer más pesada la página.

export interface ReportPdfData {
  title: string;          // 'Reporte Anual · 2026'
  fileName: string;       // 'reporte-2026.pdf'
  generatedAt: string;    // '12/10/2026'
  kpis: { label: string; value: string }[];
  table: { title: string; headers: string[]; rows: string[][] };
  barbers: { name: string; services: number; revenue: number }[];
  services: { name: string; count: number; revenue: number }[];
}

const GOLD: [number, number, number] = [212, 175, 55];
const DARK: [number, number, number] = [30, 30, 30];
const GREY: [number, number, number] = [120, 120, 120];
const ZEBRA: [number, number, number] = [246, 246, 246];

export async function exportReportPdf(data: ReportPdfData): Promise<void> {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = doc.internal.pageSize.getWidth();
  const H = doc.internal.pageSize.getHeight();
  const M = 40;
  let y = 0;

  const header = () => {
    doc.setFillColor(...GOLD);
    doc.rect(0, 0, W, 72, 'F');
    doc.setTextColor(...DARK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.text('EXCLUSIVE BARBER', M, 32);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10.5);
    doc.text(data.title, M, 52);
    doc.setTextColor(90, 70, 20);
    doc.text(`Generado: ${data.generatedAt}`, W - M, 52, { align: 'right' });
    y = 96;
  };

  const ensureSpace = (needed: number) => {
    if (y + needed > H - 50) {
      doc.addPage();
      header();
    }
  };

  const sectionTitle = (text: string) => {
    ensureSpace(40);
    doc.setTextColor(...DARK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.text(text, M, y + 12);
    y += 24;
  };

  /** Tabla simple: encabezado dorado y filas alternadas. `widths` en proporción. */
  const table = (headers: string[], rows: string[][], widths: number[]) => {
    const total = widths.reduce((a, b) => a + b, 0);
    const cols = widths.map((w) => (w / total) * (W - 2 * M));
    const rowH = 20;
    const drawHead = () => {
      doc.setFillColor(...GOLD);
      doc.rect(M, y, W - 2 * M, rowH, 'F');
      doc.setFont('helvetica', 'bold');
      doc.setFontSize(9);
      doc.setTextColor(...DARK);
      let x = M;
      headers.forEach((h, i) => { doc.text(h, x + 7, y + 13.5); x += cols[i]; });
      y += rowH;
    };
    ensureSpace(rowH * 2);
    drawHead();
    doc.setFont('helvetica', 'normal');
    rows.forEach((row, r) => {
      if (y + rowH > H - 50) { doc.addPage(); header(); drawHead(); doc.setFont('helvetica', 'normal'); }
      if (r % 2 === 1) { doc.setFillColor(...ZEBRA); doc.rect(M, y, W - 2 * M, rowH, 'F'); }
      doc.setTextColor(...DARK);
      doc.setFontSize(9);
      let x = M;
      row.forEach((cell, i) => {
        const text = doc.splitTextToSize(cell, cols[i] - 12)[0] ?? '';
        doc.text(text, x + 7, y + 13.5);
        x += cols[i];
      });
      y += rowH;
    });
    y += 16;
  };

  header();

  // Tarjetas de cifras
  const gap = 10;
  const cardW = (W - 2 * M - gap * (data.kpis.length - 1)) / data.kpis.length;
  data.kpis.forEach((k, i) => {
    const x = M + i * (cardW + gap);
    doc.setFillColor(...GOLD);
    doc.roundedRect(x, y, cardW, 8, 3, 3, 'F');
    doc.setFillColor(240, 240, 240);
    doc.rect(x, y + 5, cardW, 58, 'F');
    doc.setTextColor(...DARK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(14);
    doc.text(k.value, x + cardW / 2, y + 35, { align: 'center' });
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8.5);
    doc.setTextColor(...GREY);
    doc.text(k.label, x + cardW / 2, y + 52, { align: 'center' });
  });
  y += 84;

  sectionTitle(data.table.title);
  table(data.table.headers, data.table.rows, data.table.headers.map((_, i) => (i === 0 ? 1.4 : 1)));

  sectionTitle('Ingresos por barbero');
  table(
    ['Barbero', 'Servicios', 'Ingresos'],
    data.barbers.length ? data.barbers.map((b) => [b.name, String(b.services), formatCOP(b.revenue)]) : [['Sin datos', '', '']],
    [2, 1, 1],
  );

  sectionTitle('Ingresos por servicio');
  table(
    ['Servicio', 'Completados', 'Ingresos'],
    data.services.length ? data.services.map((s) => [s.name, String(s.count), formatCOP(s.revenue)]) : [['Sin datos', '', '']],
    [2, 1, 1],
  );

  // Pie de página en todas las hojas
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFillColor(...GOLD);
    doc.rect(0, H - 34, W, 34, 'F');
    doc.setTextColor(...DARK);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(8.5);
    doc.text('Exclusive Barber — Reporte confidencial', M, H - 13);
    doc.text(`Página ${p} de ${pages}`, W - M, H - 13, { align: 'right' });
  }

  doc.save(data.fileName);
}
