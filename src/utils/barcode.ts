import JsBarcode from 'jsbarcode';

/**
 * Calcula el dígito verificador para un código EAN-13 (los primeros 12 dígitos)
 */
export function calculateEan13Checksum(code12: string): number {
  const digits = code12.replace(/\D/g, '').slice(0, 12);
  if (digits.length !== 12) return 0;

  let sum = 0;
  for (let i = 0; i < 12; i++) {
    const num = parseInt(digits[i], 10);
    // Posiciones impares x 1, posiciones pares x 3 (índice 0 = impar en numeración 1-based)
    sum += i % 2 === 0 ? num : num * 3;
  }

  const remainder = sum % 10;
  return remainder === 0 ? 0 : 10 - remainder;
}

/**
 * Genera un código de barras EAN-13 estándar de 13 dígitos
 * Utiliza el prefijo '200' estándar reservado para uso interno en tiendas minoristas.
 */
export function generateEan13Barcode(): string {
  const prefix = '200'; // Prefijo retail interno
  let middle = '';
  for (let i = 0; i < 9; i++) {
    middle += Math.floor(Math.random() * 10).toString();
  }
  const code12 = prefix + middle;
  const checksum = calculateEan13Checksum(code12);
  return `${code12}${checksum}`;
}

/**
 * Genera un código de barras Code-128 alfanumérico limpio
 * Ejemplo: BIK-749201 ó 7401928374
 */
export function generateCode128Barcode(type: 'alphanumeric' | 'numeric' = 'numeric'): string {
  if (type === 'alphanumeric') {
    const randomNum = Math.floor(100000 + Math.random() * 900000);
    return `BIK-${randomNum}`;
  }

  // Numérico de 12 dígitos (muy rápido de leer para escáneres ópticos y cámaras de smartphones)
  const timestampPart = Date.now().toString().slice(-6);
  const randomPart = Math.floor(100000 + Math.random() * 900000).toString();
  return `${randomPart.slice(0, 4)}${timestampPart}${randomPart.slice(4)}`;
}

/**
 * Genera un código de barras recomendado para un nuevo producto
 */
export function generateProductBarcode(format: 'EAN13' | 'CODE128' = 'CODE128'): string {
  if (format === 'EAN13') {
    return generateEan13Barcode();
  }
  return generateCode128Barcode('numeric');
}

/**
 * Renderiza el código de barras en un elemento SVG de forma segura
 */
export function renderBarcodeSvg(
  element: SVGSVGElement | null,
  text: string,
  options?: {
    format?: 'CODE128' | 'EAN13' | 'CODE39' | 'UPC';
    width?: number;
    height?: number;
    fontSize?: number;
    displayValue?: boolean;
    lineColor?: string;
    background?: string;
    margin?: number;
  }
): boolean {
  if (!element || !text || !text.trim()) return false;

  const cleanText = text.trim();
  const format = options?.format || (cleanText.length === 13 && /^\d{13}$/.test(cleanText) ? 'EAN13' : 'CODE128');

  try {
    JsBarcode(element, cleanText, {
      format,
      lineColor: options?.lineColor || '#000000',
      background: options?.background || '#ffffff',
      width: options?.width || 2,
      height: options?.height || 50,
      displayValue: options?.displayValue !== false,
      fontSize: options?.fontSize || 14,
      font: 'monospace',
      textMargin: 4,
      margin: options?.margin ?? 8,
    });
    return true;
  } catch (err) {
    // Si falló por formato estricto (ej. EAN13 con checksum inválido), reintentar como CODE128
    try {
      JsBarcode(element, cleanText, {
        format: 'CODE128',
        lineColor: options?.lineColor || '#000000',
        background: options?.background || '#ffffff',
        width: options?.width || 2,
        height: options?.height || 50,
        displayValue: options?.displayValue !== false,
        fontSize: options?.fontSize || 14,
        font: 'monospace',
        textMargin: 4,
        margin: options?.margin ?? 8,
      });
      return true;
    } catch {
      return false;
    }
  }
}

/**
 * Genera una imagen PNG en base64 para descargar o imprimir
 */
export function getBarcodeDataUrl(
  text: string,
  options?: {
    format?: 'CODE128' | 'EAN13' | 'CODE39';
    width?: number;
    height?: number;
    displayValue?: boolean;
  }
): string | null {
  if (typeof document === 'undefined') return null;

  try {
    const canvas = document.createElement('canvas');
    const cleanText = text.trim();
    const format = options?.format || (cleanText.length === 13 && /^\d{13}$/.test(cleanText) ? 'EAN13' : 'CODE128');

    JsBarcode(canvas, cleanText, {
      format,
      lineColor: '#000000',
      background: '#ffffff',
      width: options?.width || 2.5,
      height: options?.height || 70,
      displayValue: options?.displayValue !== false,
      fontSize: 16,
      font: 'monospace',
      textMargin: 5,
      margin: 12,
    });

    return canvas.toDataURL('image/png');
  } catch (err) {
    console.warn('[barcode] Error generating data URL:', err);
    return null;
  }
}
