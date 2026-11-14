import { Employee } from '../types/employee';

const REQUIRED_COLUMNS = [
  'EmployeeID',
  'FirstName',
  'LastName',
  'Gender',
  'Age',
  'Department',
  'JobTitle',
  'JobLevel',
  'EmploymentType',
  'Location',
  'HireDate',
  'YearsAtCompany',
  'YearsSinceLastPromotion',
  'Education',
  'BusinessTravel',
  'MonthlyIncome_GBP',
  'Attrition',
] as const;

export interface CsvParseResult {
  employees: Employee[];
  warnings: string[];
}

function parseCsvMatrix(rawText: string): string[][] {
  const cleanText = rawText.replace(/^\uFEFF/, '').trim();
  const rows: string[][] = [];
  let currentRow: string[] = [];
  let currentCell = '';
  let inQuotes = false;

  for (let i = 0; i < cleanText.length; i++) {
    const ch = cleanText[i];

    if (inQuotes) {
      if (ch === '"') {
        if (cleanText[i + 1] === '"') {
          currentCell += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        currentCell += ch;
      }
      continue;
    }

    if (ch === '"') {
      inQuotes = true;
    } else if (ch === ',') {
      currentRow.push(currentCell.trim());
      currentCell = '';
    } else if (ch === '\r') {
      if (cleanText[i + 1] === '\n') {
        i++;
      }
      currentRow.push(currentCell.trim());
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else if (ch === '\n') {
      currentRow.push(currentCell.trim());
      if (currentRow.some((cell) => cell.length > 0)) {
        rows.push(currentRow);
      }
      currentRow = [];
      currentCell = '';
    } else {
      currentCell += ch;
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim());
    if (currentRow.some((cell) => cell.length > 0)) {
      rows.push(currentRow);
    }
  }

  return rows;
}

function parseNumber(val: string | undefined, fallback = 0): number {
  if (!val) return fallback;
  const cleaned = val.replace(/[£$,\s]/g, '');
  const parsed = Number(cleaned);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function parseHireYear(hireDate: string): number | null {
  if (!hireDate) return null;
  const match = hireDate.match(/(\d{4})/);
  if (!match) return null;
  const yr = Number(match[1]);
  return yr >= 1970 && yr <= 2100 ? yr : null;
}

export function parseEmployeeMatrix(matrix: string[][]): CsvParseResult {
  if (matrix.length < 2) {
    throw new Error('Spreadsheet must include a header row and at least one employee record.');
  }

  const headers = matrix[0].map((h) => String(h ?? '').trim());
  const headerIndex = new Map<string, number>();
  headers.forEach((h, idx) => {
    headerIndex.set(h, idx);
    headerIndex.set(h.toLowerCase(), idx);
  });

  const missingColumns = REQUIRED_COLUMNS.filter(
    (col) => !headerIndex.has(col) && !headerIndex.has(col.toLowerCase())
  );

  if (missingColumns.length > 0) {
    throw new Error(
      `Missing required column(s): ${missingColumns.join(', ')}. Verify the sheet matches the Shell UK employee schema.`
    );
  }

  const getVal = (row: string[], colName: string): string => {
    const idx = headerIndex.get(colName) ?? headerIndex.get(colName.toLowerCase());
    if (idx === undefined) return '';
    return String(row[idx] ?? '').trim();
  };

  const employees: Employee[] = [];
  const warnings: string[] = [];

  for (let i = 1; i < matrix.length; i++) {
    const row = matrix[i];
    if (!row || row.every((cell) => String(cell ?? '').trim() === '')) {
      continue;
    }
    const employeeId = getVal(row, 'EmployeeID');
    if (!employeeId) {
      warnings.push(`Skipped row ${i + 1}: missing EmployeeID.`);
      continue;
    }

    const firstName = getVal(row, 'FirstName');
    const lastName = getVal(row, 'LastName');
    const hireDate = getVal(row, 'HireDate');
    const rawAttrition = getVal(row, 'Attrition').toLowerCase();
    const attrition: 'Yes' | 'No' =
      rawAttrition === 'yes' || rawAttrition === 'true' || rawAttrition === '1' ? 'Yes' : 'No';

    employees.push({
      employeeId,
      firstName,
      lastName,
      fullName: `${firstName} ${lastName}`.trim() || employeeId,
      gender: getVal(row, 'Gender') || 'Unspecified',
      age: parseNumber(getVal(row, 'Age'), 0),
      maritalStatus: getVal(row, 'MaritalStatus') || 'Unspecified',
      department: getVal(row, 'Department') || 'Unassigned',
      jobTitle: getVal(row, 'JobTitle') || 'Unspecified',
      jobLevel: parseNumber(getVal(row, 'JobLevel'), 1),
      employmentType: getVal(row, 'EmploymentType') || 'Full-Time',
      location: getVal(row, 'Location') || 'Unspecified',
      hireDate,
      hireYear: parseHireYear(hireDate),
      yearsAtCompany: parseNumber(getVal(row, 'YearsAtCompany'), 0),
      yearsInCurrentRole: parseNumber(getVal(row, 'YearsInCurrentRole'), 0),
      yearsSinceLastPromotion: parseNumber(getVal(row, 'YearsSinceLastPromotion'), 0),
      yearsWithCurrManager: parseNumber(getVal(row, 'YearsWithCurrManager'), 0),
      education: getVal(row, 'Education') || 'Unspecified',
      distanceFromHomeKm: parseNumber(getVal(row, 'DistanceFromHome_km'), 0),
      businessTravel: getVal(row, 'BusinessTravel') || 'Non-Travel',
      monthlyIncomeGbp: parseNumber(getVal(row, 'MonthlyIncome_GBP'), 0),
      attrition,
    });
  }

  if (employees.length === 0) {
    throw new Error('No valid employee rows could be parsed.');
  }

  return { employees, warnings };
}

export function parseEmployeeCsv(rawText: string): CsvParseResult {
  const trimmed = rawText.trim();
  if (!trimmed) {
    throw new Error('The received CSV file is empty.');
  }

  if (
    trimmed.startsWith('<!DOCTYPE') ||
    trimmed.startsWith('<html') ||
    trimmed.includes('<title>Google Sheets')
  ) {
    throw new Error(
      'Google Sheets returned an HTML login/access page instead of CSV data. Sign in with Google to access private sheets, or upload a CSV file directly.'
    );
  }

  const matrix = parseCsvMatrix(trimmed);
  return parseEmployeeMatrix(matrix);
}
