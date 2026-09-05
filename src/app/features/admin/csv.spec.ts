import { toCsv } from './csv';

/** The BOM that makes Excel read the file as UTF-8 rather than the local codepage. */
const BOM = '﻿';

describe('toCsv', () => {
  it('writes a header row followed by the data rows', () => {
    const csv = toCsv(['Ticket', 'Status'], [['CP-2026-00001', 'Submitted']]);
    expect(csv).toBe(`${BOM}"Ticket","Status"\r\n"CP-2026-00001","Submitted"`);
  });

  it('escapes quotes by doubling them, per RFC 4180', () => {
    const csv = toCsv(['Note'], [['He said "fix it"']]);
    expect(csv).toContain('"He said ""fix it"""');
  });

  it('keeps commas and newlines inside a single field', () => {
    // A ticket description spanning lines must not become extra CSV rows.
    const csv = toCsv(['Description'], [['Pothole, deep\nand widening']]);
    expect(csv).toBe(`${BOM}"Description"\r\n"Pothole, deep\nand widening"`);
  });

  it('renders null and undefined as empty fields, not as the words', () => {
    const csv = toCsv(['Name', 'Phone'], [[null, undefined]]);
    expect(csv).toBe(`${BOM}"Name","Phone"\r\n"",""`);
  });

  it('emits just the header when there are no rows', () => {
    expect(toCsv(['Ticket'], [])).toBe(`${BOM}"Ticket"`);
  });
});
