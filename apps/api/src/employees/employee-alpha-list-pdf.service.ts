import { Injectable } from '@nestjs/common';
import PDFDocument from 'pdfkit';

import type { EmployeeAlphaListQueryDto } from './dto/employee-alpha-list-query.dto';
import { EmployeeAlphaListColumn } from './employee-alpha-list.constants';
import {
  EmployeeAlphaListService,
  type EmployeeAlphaListRow,
} from './employee-alpha-list.service';

const EXPORT_PAGE_SIZE = 100;

const PAGE_MARGIN = 36;

const MAX_COLUMNS_PER_SECTION = 7;

const TABLE_HEADER_HEIGHT = 28;
const TABLE_ROW_HEIGHT = 24;

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

export interface EmployeeAlphaListPdfExport {
  fileName: string;
  contentType: string;
  content: Buffer;
  totalRecords: number;
}

@Injectable()
export class EmployeeAlphaListPdfService {
  constructor(private readonly alphaListService: EmployeeAlphaListService) {}

  async generatePdf(
    query: EmployeeAlphaListQueryDto,
  ): Promise<EmployeeAlphaListPdfExport> {
    const firstPage = await this.alphaListService.getAlphaList(
      this.toExportQuery(query, 1),
    );

    const rows: EmployeeAlphaListRow[] = [...firstPage.items];

    for (let page = 2; page <= firstPage.pagination.totalPages; page += 1) {
      const response = await this.alphaListService.getAlphaList(
        this.toExportQuery(query, page),
      );

      rows.push(...response.items);
    }

    const content = await this.buildPdf(
      firstPage.columns,
      rows,
      firstPage.pagination.total,
    );

    return {
      fileName: 'employee-alpha-list.pdf',

      contentType: 'application/pdf',

      content,

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

  private async buildPdf(
    columns: EmployeeAlphaListColumn[],
    rows: EmployeeAlphaListRow[],
    totalRecords: number,
  ): Promise<Buffer> {
    const document = new PDFDocument({
      size: 'A4',
      layout: 'landscape',
      margin: PAGE_MARGIN,

      info: {
        Title: 'Employee Alpha List',
        Subject: 'La Comfianza Employee Alpha List',
        Author: 'La Comfianza Payroll System',
      },
    });

    const chunks: Buffer[] = [];

    const completed = new Promise<Buffer>((resolve, reject) => {
      document.on('data', (chunk: Buffer) => {
        chunks.push(chunk);
      });

      document.on('end', () => {
        resolve(Buffer.concat(chunks));
      });

      document.on('error', (error: Error) => {
        reject(error);
      });
    });

    const columnGroups = this.chunkColumns(columns);

    if (columnGroups.length === 0) {
      this.renderPageHeading(document, totalRecords, 1, 1);

      document
        .font('Helvetica')
        .fontSize(10)
        .text('No report columns selected.', PAGE_MARGIN, 100);
    } else {
      for (
        let groupIndex = 0;
        groupIndex < columnGroups.length;
        groupIndex += 1
      ) {
        if (groupIndex > 0) {
          document.addPage({
            size: 'A4',
            layout: 'landscape',
            margin: PAGE_MARGIN,
          });
        }

        this.renderTableSection(
          document,
          columnGroups[groupIndex],
          rows,
          totalRecords,
          groupIndex + 1,
          columnGroups.length,
        );
      }
    }

    document.end();

    return completed;
  }

  private chunkColumns(
    columns: EmployeeAlphaListColumn[],
  ): EmployeeAlphaListColumn[][] {
    const groups: EmployeeAlphaListColumn[][] = [];

    for (
      let index = 0;
      index < columns.length;
      index += MAX_COLUMNS_PER_SECTION
    ) {
      groups.push(columns.slice(index, index + MAX_COLUMNS_PER_SECTION));
    }

    return groups;
  }

  private renderTableSection(
    document: PDFKit.PDFDocument,
    columns: EmployeeAlphaListColumn[],
    rows: EmployeeAlphaListRow[],
    totalRecords: number,
    sectionNumber: number,
    sectionCount: number,
  ): void {
    let y = this.renderPageHeading(
      document,
      totalRecords,
      sectionNumber,
      sectionCount,
    );

    y = this.renderTableHeader(document, columns, y);

    if (rows.length === 0) {
      document
        .font('Helvetica')
        .fontSize(9)
        .text('No employee records found.', PAGE_MARGIN, y + 10);

      return;
    }

    for (const row of rows) {
      if (y + TABLE_ROW_HEIGHT > document.page.height - PAGE_MARGIN) {
        document.addPage({
          size: 'A4',
          layout: 'landscape',
          margin: PAGE_MARGIN,
        });

        y = this.renderPageHeading(
          document,
          totalRecords,
          sectionNumber,
          sectionCount,
        );

        y = this.renderTableHeader(document, columns, y);
      }

      y = this.renderTableRow(document, columns, row, y);
    }
  }

  private renderPageHeading(
    document: PDFKit.PDFDocument,
    totalRecords: number,
    sectionNumber: number,
    sectionCount: number,
  ): number {
    document
      .font('Helvetica-Bold')
      .fontSize(16)
      .text('Employee Alpha List', PAGE_MARGIN, PAGE_MARGIN);

    document
      .font('Helvetica')
      .fontSize(8)
      .text(`Total Employees: ${totalRecords}`, PAGE_MARGIN, PAGE_MARGIN + 24);

    if (sectionCount > 1) {
      document.text(
        `Column Group: ${sectionNumber} of ${sectionCount}`,
        PAGE_MARGIN,
        PAGE_MARGIN + 36,
      );

      return PAGE_MARGIN + 58;
    }

    return PAGE_MARGIN + 48;
  }

  private renderTableHeader(
    document: PDFKit.PDFDocument,
    columns: EmployeeAlphaListColumn[],
    y: number,
  ): number {
    const printableWidth = document.page.width - PAGE_MARGIN * 2;

    const columnWidth = printableWidth / columns.length;

    let x = PAGE_MARGIN;

    document.font('Helvetica-Bold').fontSize(7);

    for (const column of columns) {
      document.rect(x, y, columnWidth, TABLE_HEADER_HEIGHT).stroke();

      document.text(COLUMN_LABELS[column], x + 4, y + 5, {
        width: columnWidth - 8,
        height: TABLE_HEADER_HEIGHT - 8,
        ellipsis: true,
      });

      x += columnWidth;
    }

    return y + TABLE_HEADER_HEIGHT;
  }

  private renderTableRow(
    document: PDFKit.PDFDocument,
    columns: EmployeeAlphaListColumn[],
    row: EmployeeAlphaListRow,
    y: number,
  ): number {
    const printableWidth = document.page.width - PAGE_MARGIN * 2;

    const columnWidth = printableWidth / columns.length;

    let x = PAGE_MARGIN;

    document.font('Helvetica').fontSize(7);

    for (const column of columns) {
      document.rect(x, y, columnWidth, TABLE_ROW_HEIGHT).stroke();

      document.text(row.values[column] ?? '', x + 4, y + 5, {
        width: columnWidth - 8,
        height: TABLE_ROW_HEIGHT - 8,
        ellipsis: true,
      });

      x += columnWidth;
    }

    return y + TABLE_ROW_HEIGHT;
  }
}
