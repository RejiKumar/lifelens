export const MAX_LONGEST_EDGE = 2048;
export const MAX_IMAGE_BYTES = 10 * 1024 * 1024;
export const QUALITY_LADDER = [85, 80, 75, 70, 65, 60] as const;
export type Quality = (typeof QUALITY_LADDER)[number];
export const DEFAULT_QUALITY: Quality = 85;

export const HEIC_EXTENSIONS = ['heic', 'heif'] as const;

export type ImageFormat = 'jpeg' | 'png' | 'webp';

export interface TargetDimensions {
  width: number;
  height: number;
}

export function computeTargetDimensions(
  width: number,
  height: number,
  maxEdge: number = MAX_LONGEST_EDGE,
): TargetDimensions {
  const longest = Math.max(width, height);
  if (longest <= maxEdge) {
    return { width, height };
  }
  const scale = maxEdge / longest;
  return {
    width: Math.max(1, Math.round(width * scale)),
    height: Math.max(1, Math.round(height * scale)),
  };
}

export function needsResize(width: number, height: number, maxEdge: number = MAX_LONGEST_EDGE): boolean {
  return Math.max(width, height) > maxEdge;
}

export function isHeicUri(uri: string): boolean {
  const ext = extensionFromUri(uri);
  return (HEIC_EXTENSIONS as readonly string[]).includes(ext);
}

export function extensionFromUri(uri: string): string {
  const clean = uri.split('?')[0].split('#')[0].toLowerCase();
  const match = /\.([a-z0-9]+)$/.exec(clean);
  return match ? match[1] : '';
}

export function mimeFromUri(uri: string): string {
  switch (extensionFromUri(uri)) {
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    case 'heic':
    case 'heif':
      return 'image/heic';
    default:
      return 'image/jpeg';
  }
}

export function mimeForFormat(format: ImageFormat): string {
  switch (format) {
    case 'png':
      return 'image/png';
    case 'webp':
      return 'image/webp';
    default:
      return 'image/jpeg';
  }
}

export function chooseFormat(uri: string, explicitMime?: string): ImageFormat {
  const mime = explicitMime ?? mimeFromUri(uri);
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp' || extensionFromUri(uri) === 'webp') return 'webp';
  return 'jpeg';
}