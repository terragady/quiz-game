import QRCodeLib from 'qrcode';
import { useEffect, useState } from 'react';

export function QRCode({
  value,
  size = 220,
}: {
  value: string;
  size?: number;
}) {
  const [dataUrl, setDataUrl] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    const render = async () => {
      const url = await QRCodeLib.toDataURL(value, {
        width: size,
        margin: 1,
      }).catch(() => null);
      if (active) {
        setDataUrl(url);
      }
    };
    void render();
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
