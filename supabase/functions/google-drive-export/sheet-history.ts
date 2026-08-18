export type SheetCell = string | number | boolean;

export type HistoricalSheet = {
  title: string;
  headers: string[];
  rows: SheetCell[][];
  keyHeaders: string[];
};

function remapSheetRow(row: SheetCell[], sourceHeaders: string[], targetHeaders: string[]) {
  const valueByHeader = new Map(sourceHeaders.map((header, index) => [header, row[index] ?? ""]));
  return targetHeaders.map((header) => valueByHeader.get(header) ?? "");
}

function sheetRowKey(row: SheetCell[], headers: string[], keyHeaders: string[]) {
  const indexes = keyHeaders.map((header) => headers.indexOf(header));
  if (indexes.some((index) => index < 0)) return null;
  const values = indexes.map((index) => String(row[index] ?? "").trim());
  if (values.some((value) => !value)) return null;
  return JSON.stringify(values);
}

export function mergeSheetHistory(sheet: HistoricalSheet, existingValues: SheetCell[][]) {
  const existingHeaders = (existingValues[0] ?? []).map((value) => String(value).trim()).filter(Boolean);
  const headers = [...existingHeaders, ...sheet.headers.filter((header) => !existingHeaders.includes(header))];
  const finalHeaders = headers.length ? headers : sheet.headers;
  const rows = existingValues.slice(1).map((row) => remapSheetRow(row, existingHeaders, finalHeaders));
  const rowIndexByKey = new Map<string, number>();
  rows.forEach((row, index) => {
    const key = sheetRowKey(row, finalHeaders, sheet.keyHeaders);
    if (key && !rowIndexByKey.has(key)) rowIndexByKey.set(key, index);
  });

  for (const currentRow of sheet.rows) {
    const remappedCurrent = remapSheetRow(currentRow, sheet.headers, finalHeaders);
    const key = sheetRowKey(remappedCurrent, finalHeaders, sheet.keyHeaders);
    const existingIndex = key ? rowIndexByKey.get(key) : undefined;
    if (existingIndex === undefined) {
      rows.push(remappedCurrent);
      if (key) rowIndexByKey.set(key, rows.length - 1);
      continue;
    }

    const existingRow = rows[existingIndex];
    if (sheet.title === "Daily Performance") {
      const totalIndex = finalHeaders.indexOf("total_duties");
      const previousTotal = Number(existingRow[totalIndex] ?? 0);
      const currentTotal = Number(remappedCurrent[totalIndex] ?? 0);
      if (currentTotal < previousTotal) continue;
    }

    const updatedRow = [...existingRow];
    for (const header of sheet.headers) {
      const index = finalHeaders.indexOf(header);
      if (index >= 0) updatedRow[index] = remappedCurrent[index] ?? "";
    }
    rows[existingIndex] = updatedRow;
  }

  return { headers: finalHeaders, rows };
}
