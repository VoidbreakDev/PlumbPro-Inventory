import { describe, expect, it } from 'vitest';

describe('exceljs browser bundle', () => {
  it('creates an xlsx buffer through the aliased browser build', async () => {
    const { Workbook } = await import('exceljs');
    const workbook = new Workbook();
    const worksheet = workbook.addWorksheet('Summary');

    worksheet.addRow(['Item', 'Quantity']);
    worksheet.addRow(['Copper Pipe', 12]);

    const buffer = await workbook.xlsx.writeBuffer();

    expect(buffer).toBeTruthy();
    expect(buffer.byteLength).toBeGreaterThan(0);
  });
});
