import { formatINR, getCustomerTotalPaid, getCustomerBalance, getCustomerStatus } from './formatters';

/**
 * Escapes HTML characters to prevent XSS script injection when compiling PDF HTML templates.
 */
function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * Generates and downloads a complete Horizontal Landscape PDF Report
 * with Brand Logo, Telugu/English Customer List, Weekly Collections, and Cash Reconciliation Settlements.
 */
export function generatePdfReport({
  weeks,
  customers,
  weeklyReconciliation,
  reconciliationComputed,
  setIsGeneratingPDF,
  addToast
}) {
  if (!window.html2pdf) {
    if (addToast) addToast('PDF library loading... please retry in a moment.', 'warning');
    return;
  }

  if (addToast) addToast('Generating Landscape PDF with Brand Logo & Settlements...', 'info');

  // Chunks of max 8 weeks per horizontal landscape table
  const WEEKS_PER_CHUNK = 8;
  const weekChunks = [];
  for (let i = 0; i < weeks.length; i += WEEKS_PER_CHUNK) {
    weekChunks.push(weeks.slice(i, i + WEEKS_PER_CHUNK));
  }
  if (weekChunks.length === 0) {
    weekChunks.push([]);
  }

  // Capture Brand Logo as Data URL if available for crisp rendering in PDF
  let logoDataUrl = '';
  try {
    const logoImg = document.querySelector('header img');
    if (logoImg && logoImg.complete && logoImg.naturalWidth > 0) {
      const canvas = document.createElement('canvas');
      canvas.width = logoImg.naturalWidth;
      canvas.height = logoImg.naturalHeight;
      const ctx = canvas.getContext('2d');
      ctx.drawImage(logoImg, 0, 0);
      logoDataUrl = canvas.toDataURL('image/png');
    }
  } catch (e) {
    logoDataUrl = '/finroute_logo.png';
  }
  if (!logoDataUrl) logoDataUrl = '/finroute_logo.png';

  // Precalculate totals
  const weekTotals = {};
  weeks.forEach(w => {
    weekTotals[w.id] = customers.reduce((sum, c) => {
      if (c.isVillageDivider) return sum;
      return sum + (Number(c.payments?.[w.id]) || 0);
    }, 0);
  });

  const totalOriginalAll = customers.reduce((sum, c) => {
    if (c.isVillageDivider) return sum;
    const orig = (c.originalAmount !== undefined && c.originalAmount !== null && c.originalAmount !== '')
      ? Number(c.originalAmount)
      : Number(c.disbursed || 0);
    return sum + orig;
  }, 0);
  const totalDisbursedAll = customers.reduce((sum, c) => c.isVillageDivider ? sum : sum + Number(c.disbursed || 0), 0);
  const totalPaidAll = customers.reduce((sum, c) => c.isVillageDivider ? sum : sum + getCustomerTotalPaid(c), 0);
  const totalBalanceAll = customers.reduce((sum, c) => c.isVillageDivider ? sum : sum + getCustomerBalance(c), 0);

  const element = document.createElement('div');
  element.style.padding = '10px 14px';
  element.style.backgroundColor = '#FFFFFF';
  element.style.background = '#FFFFFF';
  element.style.fontFamily = "'Noto Sans Telugu', 'Inter', sans-serif";
  element.style.color = '#0F172A';
  element.style.boxSizing = 'border-box';

  let fullHtml = '';

  weekChunks.forEach((chunk, chunkIdx) => {
    const isFirstChunk = chunkIdx === 0;
    const chunkStartWeek = chunk[0]?.label || `Week 1`;
    const chunkEndWeek = chunk[chunk.length - 1]?.label || chunkStartWeek;
    const chunkDateRange = (chunk[0]?.date && chunk[chunk.length - 1]?.date)
      ? `${chunk[0].date} to ${chunk[chunk.length - 1].date}`
      : '';

    let tableRowsHtml = '';
    let pdfSerial = 0;

    customers.forEach(c => {
      if (c.isVillageDivider) {
        tableRowsHtml += `
          <tr style="background: #EEF2FF; font-weight: bold; border-top: 1.5px solid #C7D2FE; page-break-inside: avoid;">
            <td colspan="${chunk.length + 9}" style="padding: 5px 8px; text-transform: uppercase; color: #3730A3; font-size: 8pt;">
              📍 ${escapeHtml(c.villageName || c.name)}
            </td>
          </tr>
        `;
        return;
      }

      pdfSerial++;
      const paid = getCustomerTotalPaid(c);
      const bal = getCustomerBalance(c);
      const status = getCustomerStatus(c);
      const isPaid = status === 'Paid Off';
      const isDeleted = c.status === 'Deleted' || c.isDeleted;
      const statusBg = isDeleted ? '#FFE4E6' : isPaid ? '#DCFCE7' : '#FEF3C7';
      const statusColor = isDeleted ? '#BE123C' : isPaid ? '#15803D' : '#B45309';

      const origAmount = (c.originalAmount !== undefined && c.originalAmount !== null && c.originalAmount !== '')
        ? Number(c.originalAmount)
        : Number(c.disbursed || 0);

      let weekCellsHtml = '';
      chunk.forEach(w => {
        const val = c.payments?.[w.id] || 0;
        weekCellsHtml += `<td style="padding: 4px 4px; text-align: right; border: 1px solid #CBD5E1; font-size: 7.5pt;">${val ? '₹' + val.toLocaleString('en-IN') : '-'}</td>`;
      });

      tableRowsHtml += `
        <tr style="border-bottom: 1px solid #E2E8F0; page-break-inside: avoid;">
          <td style="padding: 4px 3px; text-align: center; border: 1px solid #CBD5E1; color: #64748B; font-size: 7.5pt;">${pdfSerial}</td>
          <td style="padding: 4px 6px; font-weight: 600; border: 1px solid #CBD5E1; font-size: 8pt; white-space: nowrap; overflow: hidden; text-overflow: ellipsis;">${escapeHtml(c.name)}</td>
          <td style="padding: 4px 4px; text-align: center; border: 1px solid #CBD5E1; font-size: 7.5pt; color: #475569;">${escapeHtml(c.phone || '-')}</td>
          <td style="padding: 4px 4px; text-align: center; border: 1px solid #CBD5E1; font-size: 7.5pt; color: #475569;">${escapeHtml(c.disbursedDate || '-')}</td>
          <td style="padding: 4px 4px; text-align: right; border: 1px solid #CBD5E1; font-size: 7.5pt; color: #334155;">₹${origAmount.toLocaleString('en-IN')}</td>
          <td style="padding: 4px 4px; text-align: right; border: 1px solid #CBD5E1; font-weight: 600; font-size: 7.5pt;">₹${Number(c.disbursed || 0).toLocaleString('en-IN')}</td>
          ${weekCellsHtml}
          <td style="padding: 4px 4px; text-align: right; font-weight: bold; color: #16A34A; border: 1px solid #CBD5E1; font-size: 7.5pt;">₹${paid.toLocaleString('en-IN')}</td>
          <td style="padding: 4px 4px; text-align: right; font-weight: bold; color: #DC2626; border: 1px solid #CBD5E1; font-size: 7.5pt;">₹${bal.toLocaleString('en-IN')}</td>
          <td style="padding: 3px 2px; text-align: center; border: 1px solid #CBD5E1;">
            <span style="display: inline-block; padding: 2px 6px; border-radius: 9999px; font-size: 7pt; font-weight: 700; background-color: ${statusBg}; color: ${statusColor};">
              ${escapeHtml(status)}
            </span>
          </td>
        </tr>
      `;
    });

    // Week headers
    let weekHeadersHtml = '';
    chunk.forEach(w => {
      weekHeadersHtml += `
        <th style="padding: 4px 3px; text-align: right; border: 1px solid #94A3B8; background: #F1F5F9; font-size: 7.5pt; font-weight: 700;">
          ${escapeHtml(w.label)}<br/>
          <span style="font-size: 6.5pt; font-weight: 500; color: #64748B;">${escapeHtml(w.date)}</span>
        </th>
      `;
    });

    // Bottom Totals row for this chunk
    let chunkWeekTotalsHtml = '';
    chunk.forEach(w => {
      const totalW = weekTotals[w.id] || 0;
      chunkWeekTotalsHtml += `<td style="padding: 4px 3px; text-align: right; border: 1px solid #94A3B8; font-weight: 800; font-size: 7.5pt;">₹${totalW.toLocaleString('en-IN')}</td>`;
    });

    fullHtml += `
      <div style="${!isFirstChunk ? 'page-break-before: always; margin-top: 15px;' : ''} box-sizing: border-box;">
        <!-- Brand Header with Logo -->
        <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 2px solid #2563EB; padding-bottom: 8px; margin-bottom: 8px;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <img src="${logoDataUrl}" style="height: 38px; width: auto; max-width: 140px; object-fit: contain;" alt="FinRoute Logo" />
            <div style="border-left: 1.5px solid #CBD5E1; padding-left: 10px;">
              <div style="display: flex; align-items: center; gap: 6px;">
                <h1 style="margin: 0; font-size: 15pt; color: #1E3A8A; font-weight: 800; letter-spacing: -0.3px; line-height: 1.1;">FinRoute Collect</h1>
                <span style="display: inline-block; padding: 1px 6px; border-radius: 4px; font-size: 7pt; font-weight: 800; background-color: #EFF6FF; color: #1D4ED8; border: 1px solid #BFDBFE;">Sub-Product</span>
              </div>
              <p style="margin: 2px 0 0; font-size: 8pt; color: #64748B; font-weight: 500;">
                A FinRoute Product • Sunday Collections & Ledger • <strong>Part ${chunkIdx + 1} of ${weekChunks.length}: ${chunkStartWeek} – ${chunkEndWeek}</strong> ${chunkDateRange ? '(' + chunkDateRange + ')' : ''}
              </p>
            </div>
          </div>
          <div style="text-align: right; font-size: 8pt; color: #64748B; line-height: 1.3;">
            <strong>Generated:</strong> ${new Date().toLocaleDateString('en-GB')}<br/>
            <span style="font-size: 7.5pt; color: #2563EB; font-weight: bold; background: #EFF6FF; padding: 2px 6px; border-radius: 4px; border: 1px solid #DBEAFE;">Horizontal Ledger Format (A4 Landscape)</span>
          </div>
        </div>

        {/* Top KPI Deck */}
        <div style="display: flex; justify-content: space-between; margin-bottom: 8px; font-size: 8pt; background: #F8FAFC; border: 1px solid #E2E8F0; border-radius: 6px; padding: 5px 10px;">
          <div><span style="color: #64748B;">Original Capital:</span> <strong>${formatINR(totalOriginalAll)}</strong></div>
          <div><span style="color: #64748B;">Total Payable:</span> <strong>${formatINR(totalDisbursedAll)}</strong></div>
          <div><span style="color: #64748B;">Total Collections:</span> <strong style="color: #16A34A;">${formatINR(totalPaidAll)}</strong></div>
          <div><span style="color: #64748B;">Balance Due:</span> <strong style="color: #DC2626;">${formatINR(totalBalanceAll)}</strong></div>
          <div><span style="color: #64748B;">Rolling Cash:</span> <strong style="color: #2563EB;">${formatINR(reconciliationComputed.rollingCash)}</strong></div>
        </div>

        <table style="width: 100%; border-collapse: collapse; font-size: 7.5pt; table-layout: fixed;">
          <colgroup>
            <col style="width: 26px;" />
            <col style="width: 125px;" />
            <col style="width: 75px;" />
            <col style="width: 70px;" />
            <col style="width: 70px;" />
            <col style="width: 70px;" />
            ${chunk.map(() => '<col style="width: auto;" />').join('')}
            <col style="width: 70px;" />
            <col style="width: 70px;" />
            <col style="width: 58px;" />
          </colgroup>
          <thead>
            <tr style="background: #F1F5F9;">
              <th style="padding: 5px 2px; border: 1px solid #94A3B8; text-align: center;">#</th>
              <th style="padding: 5px 4px; border: 1px solid #94A3B8; text-align: left;">Customer Name</th>
              <th style="padding: 5px 3px; border: 1px solid #94A3B8; text-align: center;">Mobile</th>
              <th style="padding: 5px 3px; border: 1px solid #94A3B8; text-align: center;">Issue Date</th>
              <th style="padding: 5px 3px; border: 1px solid #94A3B8; text-align: right;">Original (₹)</th>
              <th style="padding: 5px 3px; border: 1px solid #94A3B8; text-align: right;">Payable (₹)</th>
              ${weekHeadersHtml}
              <th style="padding: 5px 3px; border: 1px solid #94A3B8; text-align: right; color: #16A34A;">Total Paid</th>
              <th style="padding: 5px 3px; border: 1px solid #94A3B8; text-align: right; color: #DC2626;">Balance Due</th>
              <th style="padding: 5px 3px; border: 1px solid #94A3B8; text-align: center;">Status</th>
            </tr>
          </thead>
          <tbody>
            ${tableRowsHtml}
          </tbody>
          <tfoot>
            <!-- Row 1: Collections Sum TOTAL -->
            <tr style="background: #E2E8F0; font-weight: bold; border-top: 2px solid #64748B; page-break-inside: avoid;">
              <td style="padding: 4px 2px; border: 1px solid #94A3B8; text-align: center;">Σ</td>
              <td style="padding: 4px 4px; border: 1px solid #94A3B8;">TOTAL</td>
              <td style="padding: 4px 3px; border: 1px solid #94A3B8; text-align: center;">-</td>
              <td style="padding: 4px 3px; border: 1px solid #94A3B8; text-align: center;">-</td>
              <td style="padding: 4px 3px; border: 1px solid #94A3B8; text-align: right;">₹${totalOriginalAll.toLocaleString('en-IN')}</td>
              <td style="padding: 4px 3px; border: 1px solid #94A3B8; text-align: right;">₹${totalDisbursedAll.toLocaleString('en-IN')}</td>
              ${chunkWeekTotalsHtml}
              <td style="padding: 4px 3px; border: 1px solid #94A3B8; text-align: right; color: #16A34A;">₹${totalPaidAll.toLocaleString('en-IN')}</td>
              <td style="padding: 4px 3px; border: 1px solid #94A3B8; text-align: right; color: #DC2626;">₹${totalBalanceAll.toLocaleString('en-IN')}</td>
              <td style="padding: 4px 3px; border: 1px solid #94A3B8; text-align: center;">-</td>
            </tr>

            <!-- Row 2: Cash Settlements Section Header -->
            <tr style="background: #EEF2FF; border-top: 2px solid #6366F1; border-bottom: 1.5px solid #C7D2FE; page-break-inside: avoid;">
              <td colspan="${chunk.length + 9}" style="padding: 5px 8px; font-weight: 800; color: #3730A3; font-size: 8pt; text-transform: uppercase; letter-spacing: 0.5px;">
                💰 WEEKLY CASH SETTLEMENTS & RECONCILIATION
              </td>
            </tr>

            <!-- Row 3: Previous Cash in Hand -->
            <tr style="background: #FFFFFF; border-bottom: 1px solid #E2E8F0; page-break-inside: avoid;">
              <td style="padding: 4px 2px; border: 1px solid #CBD5E1; text-align: center; color: #64748B; font-size: 7.5pt;">—</td>
              <td style="padding: 4px 6px; border: 1px solid #CBD5E1; font-weight: 700; color: #0F172A; font-size: 7.5pt;">Previous Cash in Hand</td>
              <td style="padding: 4px 3px; border: 1px solid #CBD5E1; text-align: center; color: #94A3B8;">—</td>
              <td style="padding: 4px 3px; border: 1px solid #CBD5E1; text-align: center; color: #94A3B8;">—</td>
              <td style="padding: 4px 3px; border: 1px solid #CBD5E1; text-align: center; color: #94A3B8;">—</td>
              <td style="padding: 4px 3px; border: 1px solid #CBD5E1; text-align: center; color: #94A3B8;">—</td>
              ${chunk.map(w => {
                const cw = reconciliationComputed.computedWeeks?.find(item => item.weekId === w.id);
                const val = (cw?.prevCash !== undefined && cw?.prevCash !== null) ? Number(cw.prevCash) : 0;
                return `<td style="padding: 4px 3px; text-align: right; border: 1px solid #CBD5E1; font-weight: 600; font-size: 7.5pt; color: #1E293B;">₹${val.toLocaleString('en-IN')}</td>`;
              }).join('')}
              <td colspan="3" style="padding: 4px 6px; text-align: center; border: 1px solid #CBD5E1; color: #94A3B8; font-size: 7.5pt;">Opening Cash</td>
            </tr>

            <!-- Row 4: Collections Received -->
            <tr style="background: #F0FDF4; border-bottom: 1px solid #E2E8F0; page-break-inside: avoid;">
              <td style="padding: 4px 2px; border: 1px solid #CBD5E1; text-align: center; color: #15803D; font-weight: 800; font-size: 7.5pt;">+</td>
              <td style="padding: 4px 6px; border: 1px solid #CBD5E1; font-weight: 800; color: #15803D; font-size: 7.5pt;">+ Collections Received</td>
              <td style="padding: 4px 3px; border: 1px solid #CBD5E1; text-align: center; color: #94A3B8;">—</td>
              <td style="padding: 4px 3px; border: 1px solid #CBD5E1; text-align: center; color: #94A3B8;">—</td>
              <td style="padding: 4px 3px; border: 1px solid #CBD5E1; text-align: center; color: #94A3B8;">—</td>
              <td style="padding: 4px 3px; border: 1px solid #CBD5E1; text-align: center; color: #94A3B8;">—</td>
              ${chunk.map(w => {
                const cw = reconciliationComputed.computedWeeks?.find(item => item.weekId === w.id);
                const val = Number(cw?.collections || 0);
                return `<td style="padding: 4px 3px; text-align: right; border: 1px solid #CBD5E1; font-weight: 800; font-size: 7.5pt; color: #15803D;">₹${val.toLocaleString('en-IN')}</td>`;
              }).join('')}
              <td colspan="3" style="padding: 4px 6px; text-align: right; border: 1px solid #CBD5E1; font-weight: 800; color: #15803D; font-size: 7.5pt;">
                Total: ₹${(reconciliationComputed.grandTotalCollections || 0).toLocaleString('en-IN')}
              </td>
            </tr>

            <!-- Row 5: Operating Expenses -->
            <tr style="background: #FEF2F2; border-bottom: 1px solid #E2E8F0; page-break-inside: avoid;">
              <td style="padding: 4px 2px; border: 1px solid #CBD5E1; text-align: center; color: #B91C1C; font-weight: bold; font-size: 7.5pt;">-</td>
              <td style="padding: 4px 6px; border: 1px solid #CBD5E1; font-weight: 700; color: #B91C1C; font-size: 7.5pt;">- Operating Expenses</td>
              <td style="padding: 4px 3px; border: 1px solid #CBD5E1; text-align: center; color: #94A3B8;">—</td>
              <td style="padding: 4px 3px; border: 1px solid #CBD5E1; text-align: center; color: #94A3B8;">—</td>
              <td style="padding: 4px 3px; border: 1px solid #CBD5E1; text-align: center; color: #94A3B8;">—</td>
              <td style="padding: 4px 3px; border: 1px solid #CBD5E1; text-align: center; color: #94A3B8;">—</td>
              ${chunk.map(w => {
                const recon = weeklyReconciliation[w.id] || {};
                const val = Number(recon.expenses || 0);
                return `<td style="padding: 4px 3px; text-align: right; border: 1px solid #CBD5E1; font-weight: 700; font-size: 7.5pt; color: #DC2626;">₹${val.toLocaleString('en-IN')}</td>`;
              }).join('')}
              <td colspan="3" style="padding: 4px 6px; text-align: right; border: 1px solid #CBD5E1; font-weight: 800; color: #B91C1C; font-size: 7.5pt;">
                Total: ₹${(reconciliationComputed.grandTotalExpenses || 0).toLocaleString('en-IN')}
              </td>
            </tr>

            <!-- Row 6: Loan Amounts Given -->
            <tr style="background: #EFF6FF; border-bottom: 1px solid #E2E8F0; page-break-inside: avoid;">
              <td style="padding: 4px 2px; border: 1px solid #CBD5E1; text-align: center; color: #1D4ED8; font-weight: bold; font-size: 7.5pt;">-</td>
              <td style="padding: 4px 6px; border: 1px solid #CBD5E1; font-weight: 700; color: #1D4ED8; font-size: 7.5pt;">- Loan Amounts Given</td>
              <td style="padding: 4px 3px; border: 1px solid #CBD5E1; text-align: center; color: #94A3B8;">—</td>
              <td style="padding: 4px 3px; border: 1px solid #CBD5E1; text-align: center; color: #94A3B8;">—</td>
              <td style="padding: 4px 3px; border: 1px solid #CBD5E1; text-align: center; color: #94A3B8;">—</td>
              <td style="padding: 4px 3px; border: 1px solid #CBD5E1; text-align: center; color: #94A3B8;">—</td>
              ${chunk.map(w => {
                const recon = weeklyReconciliation[w.id] || {};
                const val = Number(recon.amountGiven || 0);
                return `<td style="padding: 4px 3px; text-align: right; border: 1px solid #CBD5E1; font-weight: 700; font-size: 7.5pt; color: #2563EB;">₹${val.toLocaleString('en-IN')}</td>`;
              }).join('')}
              <td colspan="3" style="padding: 4px 6px; text-align: right; border: 1px solid #CBD5E1; font-weight: 800; color: #1D4ED8; font-size: 7.5pt;">
                Total: ₹${(reconciliationComputed.grandTotalGiven || 0).toLocaleString('en-IN')}
              </td>
            </tr>

            <!-- Row 7: Staff Salaries -->
            <tr style="background: #FAF5FF; border-bottom: 1px solid #E2E8F0; page-break-inside: avoid;">
              <td style="padding: 4px 2px; border: 1px solid #CBD5E1; text-align: center; color: #6B21A8; font-weight: bold; font-size: 7.5pt;">-</td>
              <td style="padding: 4px 6px; border: 1px solid #CBD5E1; font-weight: 700; color: #6B21A8; font-size: 7.5pt;">- Staff Salaries</td>
              <td style="padding: 4px 3px; border: 1px solid #CBD5E1; text-align: center; color: #94A3B8;">—</td>
              <td style="padding: 4px 3px; border: 1px solid #CBD5E1; text-align: center; color: #94A3B8;">—</td>
              <td style="padding: 4px 3px; border: 1px solid #CBD5E1; text-align: center; color: #94A3B8;">—</td>
              <td style="padding: 4px 3px; border: 1px solid #CBD5E1; text-align: center; color: #94A3B8;">—</td>
              ${chunk.map(w => {
                const recon = weeklyReconciliation[w.id] || {};
                const val = Number(recon.salaries || 0);
                return `<td style="padding: 4px 3px; text-align: right; border: 1px solid #CBD5E1; font-weight: 700; font-size: 7.5pt; color: #7E22CE;">₹${val.toLocaleString('en-IN')}</td>`;
              }).join('')}
              <td colspan="3" style="padding: 4px 6px; text-align: right; border: 1px solid #CBD5E1; font-weight: 800; color: #6B21A8; font-size: 7.5pt;">
                Total: ₹${(reconciliationComputed.grandTotalSalaries || 0).toLocaleString('en-IN')}
              </td>
            </tr>

            <!-- Row 8: Net Cash in Hand -->
            <tr style="background: #F0F9FF; border-top: 2px solid #0284C7; border-bottom: 2px solid #0284C7; page-break-inside: avoid;">
              <td style="padding: 4px 2px; border: 1px solid #38BDF8; text-align: center; color: #0369A1; font-weight: bold; font-size: 7.5pt;">=</td>
              <td style="padding: 4px 6px; border: 1px solid #38BDF8; font-weight: 800; color: #0C4A6E; font-size: 8pt;">= Net Cash in Hand</td>
              <td style="padding: 4px 3px; border: 1px solid #38BDF8; text-align: center; color: #94A3B8;">—</td>
              <td style="padding: 4px 3px; border: 1px solid #38BDF8; text-align: center; color: #94A3B8;">—</td>
              <td style="padding: 4px 3px; border: 1px solid #38BDF8; text-align: center; color: #94A3B8;">—</td>
              <td style="padding: 4px 3px; border: 1px solid #38BDF8; text-align: center; color: #94A3B8;">—</td>
              ${chunk.map(w => {
                const cw = reconciliationComputed.computedWeeks?.find(item => item.weekId === w.id);
                const val = Number(cw?.netCash || 0);
                const isNeg = val < 0;
                return `<td style="padding: 4px 3px; text-align: right; border: 1px solid #38BDF8; font-weight: 800; font-size: 7.5pt; color: ${isNeg ? '#DC2626' : '#0369A1'}; background-color: ${isNeg ? '#FEE2E2' : '#E0F2FE'};">₹${val.toLocaleString('en-IN')}</td>`;
              }).join('')}
              <td colspan="3" style="padding: 4px 6px; text-align: right; border: 1px solid #38BDF8; font-weight: 800; font-size: 8pt; color: ${reconciliationComputed.rollingCash < 0 ? '#DC2626' : '#0369A1'}; background-color: ${reconciliationComputed.rollingCash < 0 ? '#FEE2E2' : '#BAE6FD'};">
                Today's Net: ₹${(reconciliationComputed.rollingCash || 0).toLocaleString('en-IN')}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>
    `;
  });

  element.innerHTML = fullHtml;

  const opt = {
    margin: [6, 6, 6, 6],
    filename: `FinRoute_Collection_Report_${new Date().toLocaleDateString('en-GB').replace(/\//g, '-')}.pdf`,
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: { scale: 2, useCORS: true, logging: false, backgroundColor: '#FFFFFF' },
    jsPDF: { unit: 'mm', format: 'a4', orientation: 'landscape' },
    pagebreak: { mode: ['css', 'legacy'], avoid: ['tr'] }
  };

  if (setIsGeneratingPDF) setIsGeneratingPDF(true);
  window.html2pdf().set(opt).from(element).save().then(() => {
    if (setIsGeneratingPDF) setIsGeneratingPDF(false);
    if (addToast) addToast('Horizontal Landscape PDF with Settlements downloaded!', 'success');
  }).catch(err => {
    if (setIsGeneratingPDF) setIsGeneratingPDF(false);
    if (addToast) addToast('Error generating PDF: ' + err.message, 'error');
  });
}
