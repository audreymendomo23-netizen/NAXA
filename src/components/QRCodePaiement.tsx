"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";

export function QRCodePaiement({ code }: { code: string }) {
  const [src, setSrc] = useState("");
  const [error, setError] = useState(false);
  useEffect(() => {
    let active = true;
    setSrc("");
    setError(false);
    QRCode.toDataURL("NAXA:PAY:" + code, {
      errorCorrectionLevel: "M",
      margin: 2,
      width: 240,
      color: { dark: "#0B3D26", light: "#FFFFFF" },
    }).then((url) => {
      if (active) setSrc(url);
    }).catch(() => {
      if (active) setError(true);
    });
    return () => { active = false; };
  }, [code]);

  if (error) return <p role="alert" className="text-sm text-amber-800">QR code indisponible ; utilisez le code de paiement affiché.</p>;
  if (!src) return <p role="status" className="text-sm text-slate-500">Génération du QR code…</p>;
  return <figure className="flex flex-col items-center gap-1">
    {/* QR generated locally in the browser; no external QR service receives the transaction code. */}
    <img src={src} width={240} height={240} alt={"QR code de paiement NAXA " + code} className="h-48 w-48 rounded-lg border bg-white p-2" />
    <figcaption className="text-xs text-slate-500">Code de paiement sécurisé · lecture locale</figcaption>
  </figure>;
}
