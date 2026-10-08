import React, { useEffect, useRef } from 'react';
import JsBarcode from 'jsbarcode';

// Renders a real, scannable CODE128 barcode for the given value (product
// code). Wraps the jsbarcode package rather than faking a bar pattern.
export default function BarcodeSvg({ value, height = 40, width = 1.4, fontSize = 12, displayValue = true, ...rest }) {
  const ref = useRef(null);

  useEffect(() => {
    if (!ref.current || !value) return;
    try {
      JsBarcode(ref.current, value, {
        format: 'CODE128', height, width, fontSize, displayValue, margin: 4, background: 'transparent',
      });
    } catch (err) {
      // Value not encodable — leave the SVG blank rather than throw.
    }
  }, [value, height, width, fontSize, displayValue]);

  if (!value) return null;
  return <svg ref={ref} {...rest} />;
}
