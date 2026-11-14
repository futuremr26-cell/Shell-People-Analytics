import { ScoredEmployee } from '../types/employee';
import { CsvParseResult, parseEmployeeMatrix } from './csvParser';

export interface DriveSpreadsheetFile {
  id: string;
  name: string;
  modifiedTime?: string;
}

export interface SpreadsheetTabMeta {
  sheetId: number;
  title: string;
  rowCount: number;
  columnCount: number;
}

export interface SpreadsheetMetadata {
  spreadsheetId: string;
  title: string;
  spreadsheetUrl: string;
  sheets: SpreadsheetTabMeta[];
}

async function handleGoogleApiError(res: Response, fallbackMsg: string): Promise<never> {
  if (res.status === 401) {
    throw new Error('Your Google session expired. Please sign in with Google again.');
  }
  let detail = '';
  try {
    const json = (await res.json()) as { error?: { message?: string } };
    detail = json.error?.message ?? '';
  } catch {
    detail = res.statusText;
  }
  throw new Error(detail ? `${fallbackMsg}: ${detail}` : `${fallbackMsg} (HTTP ${res.status})`);
}

export async function listDriveSpreadsheets(
  accessToken: string,
  searchTerm = ''
): Promise<DriveSpreadsheetFile[]> {
  const escaped = searchTerm.trim().replace(/'/g, "\\'");
  const qParts = [
    "mimeType='application/vnd.google-apps.spreadsheet'",
    'trashed=false',
  ];
  if (escaped) {
    qParts.push(`name contains '${escaped}'`);
  }
  const params = new URLSearchParams({
    q: qParts.join(' and '),
    fields: 'files(id,name,modifiedTime)',
    orderBy: 'modifiedTime desc',
    pageSize: '25',
  });

  const res = await fetch(`https://www.googleapis.com/drive/v3/files?${params.toString()}`, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  });

  if (!res.ok) {
    await handleGoogleApiError(res, 'Could not list spreadsheets from Google Drive');
  }

  const data = (await res.json()) as { files?: DriveSpreadsheetFile[] };
  return data.files ?? [];
}

export async function getSpreadsheetMetadata(
  spreadsheetId: string,
  accessToken: string
): Promise<SpreadsheetMetadata> {
  const params = new URLSearchParams({
    fields: 'spreadsheetId,properties.title,spreadsheetUrl,sheets.properties(sheetId,title,gridProperties)',
  });

  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(spreadsheetId)}?${params.toString()}`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    await handleGoogleApiError(res, 'Could not read spreadsheet metadata');
  }

  const data = (await res.json()) as {
    spreadsheetId: string;
    spreadsheetUrl?: string;
    properties?: { title?: string };
    sheets?: Array<{
      properties?: {
        sheetId?: number;
        title?: string;
        gridProperties?: { rowCount?: number; columnCount?: number };
      };
    }>;
  };

  return {
    spreadsheetId: data.spreadsheetId,
    title: data.properties?.title ?? 'Untitled Spreadsheet',
    spreadsheetUrl:
      data.spreadsheetUrl ?? `https://docs.google.com/spreadsheets/d/${spreadsheetId}/edit`,
    sheets: (data.sheets ?? []).map((s) => ({
      sheetId: s.properties?.sheetId ?? 0,
      title: s.properties?.title ?? 'Sheet1',
      rowCount: s.properties?.gridProperties?.rowCount ?? 0,
      columnCount: s.properties?.gridProperties?.columnCount ?? 0,
    })),
  };
}

export async function readSpreadsheetTab(
  spreadsheetId: string,
  sheetTitle: string,
  accessToken: string
): Promise<CsvParseResult> {
  const safeRange = `'${sheetTitle.replace(/'/g, "''")}'`;
  const res = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      spreadsheetId
    )}/values/${encodeURIComponent(safeRange)}?majorDimension=ROWS`,
    {
      headers: {
        Authorization: `Bearer ${accessToken}`,
      },
    }
  );

  if (!res.ok) {
    await handleGoogleApiError(res, `Could not read sheet tab "${sheetTitle}"`);
  }

  const data = (await res.json()) as { values?: string[][] };
  const values = data.values ?? [];
  return parseEmployeeMatrix(values);
}

export async function exportCohortToNewSheet(
  accessToken: string,
  spreadsheetTitle: string,
  employees: ScoredEmployee[]
): Promise<{ spreadsheetId: string; spreadsheetUrl: string; rowsWritten: number }> {
  const tabTitle = 'People Analytics Export';

  const createRes = await fetch('https://sheets.googleapis.com/v4/spreadsheets', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${accessToken}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      properties: {
        title: spreadsheetTitle,
      },
      sheets: [
        {
          properties: {
            title: tabTitle,
          },
        },
      ],
    }),
  });

  if (!createRes.ok) {
    await handleGoogleApiError(createRes, 'Could not create new Google Sheet');
  }

  const created = (await createRes.json()) as {
    spreadsheetId: string;
    spreadsheetUrl: string;
  };

  const headers = [
    'EmployeeID',
    'FullName',
    'Department',
    'Location',
    'JobTitle',
    'JobLevel',
    'EmploymentType',
    'Gender',
    'YearsAtCompany',
    'YearsSinceLastPromotion',
    'MonthlyIncome_GBP',
    'Attrition',
    'FlightRiskScore',
    'RiskTier',
  ];

  const rows = employees.map((e) => [
    e.employeeId,
    e.fullName,
    e.department,
    e.location,
    e.jobTitle,
    String(e.jobLevel),
    e.employmentType,
    e.gender,
    String(e.yearsAtCompany),
    String(e.yearsSinceLastPromotion),
    String(e.monthlyIncomeGbp),
    e.attrition,
    String(e.flightRiskScore),
    e.riskTier,
  ]);

  const allValues = [headers, ...rows];
  const range = `'${tabTitle}'!A1`;

  const updateRes = await fetch(
    `https://sheets.googleapis.com/v4/spreadsheets/${encodeURIComponent(
      created.spreadsheetId
    )}/values/${encodeURIComponent(range)}?valueInputOption=USER_ENTERED`,
    {
      method: 'PUT',
      headers: {
        Authorization: `Bearer ${accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        range,
        majorDimension: 'ROWS',
        values: allValues,
      }),
    }
  );

  if (!updateRes.ok) {
    await handleGoogleApiError(updateRes, 'Created sheet, but failed to write employee rows');
  }

  return {
    spreadsheetId: created.spreadsheetId,
    spreadsheetUrl: created.spreadsheetUrl,
    rowsWritten: employees.length,
  };
}
