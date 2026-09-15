import { Injectable } from '@nestjs/common';

import type { EmployeeAlphaListQueryDto } from './dto/employee-alpha-list-query.dto';
import { EmployeeAlphaListColumn } from './employee-alpha-list.constants';
import {
  EmployeeAlphaListService,
  type EmployeeAlphaListRow,
} from './employee-alpha-list.service';

const EXPORT_PAGE_SIZE = 100;

const COLUMN_LABELS: Record<EmployeeAlphaListColumn, string> = {
  [EmployeeAlphaListColumn.EMPLOYEE_NUMBER]: 'Employee Number',

  [EmployeeAlphaListColumn.FULL_NAME]: 'Employee Name',

  [EmployeeAlphaListColumn.EMAIL]: 'Email',

  [EmployeeAlphaListColumn.MOBILE]: 'Mobile',

  [EmployeeAlphaListColumn.STATUS]: 'Employee Status',

  [EmployeeAlphaListColumn.COMPANY_CODE]: 'Company Code',

  [EmployeeAlphaListColumn.COMPANY_NAME]: 'Company',

  [EmployeeAlphaListColumn.COMPANY_EMPLOYEE_NUMBER]: 'Company Employee Number',

  [EmployeeAlphaListColumn.DEPARTMENT_CODE]: 'Department Code',

  [EmployeeAlphaListColumn.DEPARTMENT_NAME]: 'Department',

  [EmployeeAlphaListColumn.POSITION_CODE]: 'Position Code',

  [EmployeeAlphaListColumn.POSITION_NAME]: 'Position',

  [EmployeeAlphaListColumn.EMPLOYMENT_START_DATE]: 'Employment Start Date',

  [EmployeeAlphaListColumn.PAYOUT_METHOD]: 'Payout Method',

  [EmployeeAlphaListColumn.ADDRESS_LINE_1]: 'Address Line 1',

  [EmployeeAlphaListColumn.ADDRESS_LINE_2]: 'Address Line 2',

  [EmployeeAlphaListColumn.BARANGAY]: 'Barangay',

  [EmployeeAlphaListColumn.CITY]: 'City',

  [EmployeeAlphaListColumn.PROVINCE]: 'Province',

  [EmployeeAlphaListColumn.POSTAL_CODE]: 'Postal Code',

  [EmployeeAlphaListColumn.COUNTRY]: 'Country',
};

export interface EmployeeAlphaListCsvExport {
  fileName: string;
  contentType: string;
  content: string;
  totalRecords: number;
}

@Injectable()
export class EmployeeAlphaListCsvService {
  constructor(private readonly alphaListService: EmployeeAlphaListService) {}

  async generateCsv(
    query: EmployeeAlphaListQueryDto,
  ): Promise<EmployeeAlphaListCsvExport> {
    const firstPage = await this.alphaListService.getAlphaList(
      this.toExportQuery(query, 1),
    );

    const columns = firstPage.columns;

    const rows: EmployeeAlphaListRow[] = [...firstPage.items];

    for (let page = 2; page <= firstPage.pagination.totalPages; page += 1) {
      const response = await this.alphaListService.getAlphaList(
        this.toExportQuery(query, page),
      );

      rows.push(...response.items);
    }

    const csv = this.buildCsv(columns, rows);

    return {
      fileName: 'employee-alpha-list.csv',

      contentType: 'text/csv; charset=utf-8',

      content: csv,

      totalRecords: firstPage.pagination.total,
    };
  }

  private toExportQuery(
    query: EmployeeAlphaListQueryDto,
    page: number,
  ): EmployeeAlphaListQueryDto {
    return {
      ...query,

      page,
      pageSize: EXPORT_PAGE_SIZE,

      columns: query.columns,
    };
  }

  private buildCsv(
    columns: EmployeeAlphaListColumn[],
    rows: EmployeeAlphaListRow[],
  ): string {
    const lines: string[] = [];

    lines.push(
      columns
        .map((column) => this.escapeCsvValue(COLUMN_LABELS[column]))
        .join(','),
    );

    for (const row of rows) {
      lines.push(
        columns
          .map((column) => this.escapeCsvValue(row.values[column] ?? ''))
          .join(','),
      );
    }

    /*
     * UTF-8 BOM improves compatibility when opening
     * exported CSV files directly in Microsoft Excel.
     */
    return `\uFEFF${lines.join('\r\n')}\r\n`;
  }

  private escapeCsvValue(value: string): string {
    /*
     * Prefix spreadsheet-formula characters with an
     * apostrophe to reduce CSV formula-injection risk
     * when the file is opened in Excel or similar apps.
     */
    const safeValue = /^[=+\-@]/.test(value) ? `'${value}` : value;

    const escaped = safeValue.replace(/"/g, '""');

    return `"${escaped}"`;
  }
}
