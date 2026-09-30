import { Injectable } from '@nestjs/common';
import type { RTKStatementData } from './rtk-statement.document';
import { ensureReactPdfCompat } from '../common/utils/react-pdf-compat';

@Injectable()
export class RtkStatementPdfService {
  /**
   * Compiles an RTKStatementData object into a binary PDF Buffer using dynamic import
   * to prevent CommonJS ERR_REQUIRE_ESM crashes during Node 18 startup.
   */
  async generatePdf(statement: RTKStatementData): Promise<Buffer> {
    let ReactPDF: any;
    try {
      // In CommonJS or Jest mock environments where require works
      ReactPDF = require('@react-pdf/renderer');
    } catch {
      // In Node 18 production ESM runtime
      const dynamicImport = new Function('specifier', 'return import(specifier)');
      ReactPDF = await dynamicImport('@react-pdf/renderer');
    }

    const { renderToBuffer } = ReactPDF;
    const { RTKStatementPDFDocument } = require('./rtk-statement.document');
    const React = require('react');

    ensureReactPdfCompat(React);

    const doc = React.createElement(RTKStatementPDFDocument, {
      statement,
      reactPdf: ReactPDF,
    });

    return await renderToBuffer(doc);
  }
}
