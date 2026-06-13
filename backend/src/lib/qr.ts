import QRCode from 'qrcode';

/**
 * Generates a Data URL for a QR Code.
 * For bulk bookings, we use Version 40 with Error Correction Level H
 * to maximize data capacity and robustness.
 */
export async function generateQRCode(data: string | object): Promise<string> {
  const content = typeof data === 'string' ? data : JSON.stringify(data);
  
  return QRCode.toDataURL(content, {
    errorCorrectionLevel: 'H',
    version: 40,
    margin: 4,
    color: {
      dark: '#000000',
      light: '#ffffff',
    },
  });
}
