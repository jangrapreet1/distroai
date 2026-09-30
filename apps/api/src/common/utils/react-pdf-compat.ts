import React from 'react';

let isPatched = false;

/**
 * Ensures compatibility between React 18 elements and @react-pdf/renderer 4.x / @react-pdf/reconciler 2.x.
 *
 * @react-pdf/reconciler 2.0.0 uses React 19's reconciler (reconciler-33) which checks for
 * Symbol.for('react.transitional.element') and explicitly throws Minified React error #525
 * ("A React Element from an older version of React was rendered") when it encounters
 * React 18's Symbol.for('react.element').
 *
 * This utility monkey-patches React.createElement so that generated elements have the
 * Symbol.for('react.transitional.element') tag expected by the reconciler.
 */
export function ensureReactPdfCompat(reactInstance: any = React): void {
  if (isPatched) return;

  const TRANSITIONAL_ELEMENT = Symbol.for('react.transitional.element');
  const REACT_ELEMENT = Symbol.for('react.element');

  if (reactInstance && typeof reactInstance.createElement === 'function') {
    const originalCreateElement = reactInstance.createElement;
    reactInstance.createElement = function (type: any, props: any, ...children: any[]) {
      const el = originalCreateElement.apply(this, arguments as any);
      if (el && typeof el === 'object' && el.$$typeof === REACT_ELEMENT) {
        el.$$typeof = TRANSITIONAL_ELEMENT;
      }
      return el;
    };
    isPatched = true;
  }
}
