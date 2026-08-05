import { useEffect, useState } from 'react';
import QRCodeLib from 'qrcode';

/** Renders a QR code image for the given value. */
export function QRCode({ value, size = 220 }: { value: string; size?: number }) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    QRCodeLib.toDataURL(value, { width: size, margin: 1 })
      .then((url) => {
        if (active) setDataUrl(url);
      })
      .catch(() => {
        if (active) setDataUrl(null);
      });
    return () => {
      active = false;
    };
  }, [value, size]);

  if (!dataUrl) {
    return <div className="qr" style={{ width: size, height: size }} />;
  }
  return (
    <img
      className="qr"
      src={dataUrl}
      width={size}
      height={size}
      alt={`QR code to join at ${value}`}
    />
  );
}
