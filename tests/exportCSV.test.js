import { describe, it, expect } from 'vitest';
import { escapeCSV } from '../src/utils/exportCSV';

describe('CSV cell escaping', () => {
  it('neutralises spreadsheet formulas (CSV / DDE injection)', () => {
    for (const payload of ['=HYPERLINK("http://evil")', '+1+1', '-2+3', '@SUM(A1)', '\tcmd', '\rcmd']) {
      const cell = escapeCSV(payload);
      // The cell content must start with an apostrophe after the opening quote
      expect(cell.startsWith(`"'`)).toBe(true);
    }
  });

  it('quotes and doubles embedded quotes', () => {
    expect(escapeCSV('say "hi"')).toBe('"say ""hi"""');
  });

  it('keeps commas and newlines inside one cell', () => {
    expect(escapeCSV('a,b')).toBe('"a,b"');
    expect(escapeCSV('line1\nline2')).toBe('"line1\nline2"');
  });

  it('handles empty values and Telugu text', () => {
    expect(escapeCSV(null)).toBe('""');
    expect(escapeCSV(undefined)).toBe('""');
    expect(escapeCSV('రాంపూర్')).toBe('"రాంపూర్"');
    expect(escapeCSV(0)).toBe('"0"');
  });
});
