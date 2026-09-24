import React from 'react';

export const Document = ({ children }: any) => React.createElement('Document', null, children);
export const Page = ({ children, style, size }: any) => React.createElement('Page', { style, size }, children);
export const View = ({ children, style, wrap }: any) => React.createElement('View', { style, wrap }, children);
export const Text = ({ children, style }: any) => React.createElement('Text', { style }, children);
export const StyleSheet = {
  create: (styles: any) => styles,
};
export const Font = {
  register: jest.fn(),
  registerHyphenationCallback: jest.fn(),
  getRegisteredFontFamilies: jest.fn(() => ['NotoSansDevanagari']),
};

export const renderToBuffer = jest.fn(async (element: any) => {
  const serializeTree = (node: any): string => {
    if (!node) return '';
    if (typeof node === 'string' || typeof node === 'number') return String(node);
    if (Array.isArray(node)) return node.map(serializeTree).join(' ');
    if (typeof node.type === 'function') {
      return serializeTree(node.type(node.props));
    }
    if (node.props?.children) return serializeTree(node.props.children);
    return '';
  };
  const textContent = serializeTree(element);
  return Buffer.from(`%PDF-1.4\nMock RTK Statement PDF\n${textContent}\n%%EOF`, 'utf8');
});

export default {
  Document,
  Page,
  View,
  Text,
  StyleSheet,
  Font,
  renderToBuffer,
};
