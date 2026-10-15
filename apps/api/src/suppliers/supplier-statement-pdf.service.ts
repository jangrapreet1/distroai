import { Injectable } from '@nestjs/common';
import type { SupplierStatementData } from './supplier-statement.document';
import { ensureReactPdfCompat } from '../common/utils/react-pdf-compat';

@Injectable()
export class SupplierStatementPdfService {
  async generatePdf(statement: SupplierStatementData): Promise<Buffer> {
    let ReactPDF: any;
    try {
      ReactPDF = require('@react-pdf/renderer');
    } catch {
      const dynamicImport = new Function('specifier', 'return import(specifier)');
      ReactPDF = await dynamicImport('@react-pdf/renderer');
    }

    const { renderToBuffer } = ReactPDF;
    const { SupplierStatementPDFDocument } = require('./supplier-statement.document');
    const React = require('react');

    ensureReactPdfCompat(React);

    const doc = React.createElement(SupplierStatementPDFDocument, {
      statement,
      reactPdf: ReactPDF,
    });

    return await renderToBuffer(doc);
  }
}
