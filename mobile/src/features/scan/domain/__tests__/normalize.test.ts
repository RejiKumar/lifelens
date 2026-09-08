import {
  computeTargetDimensions,
  needsResize,
  isHeicUri,
  extensionFromUri,
  mimeFromUri,
  mimeForFormat,
  chooseFormat,
  MAX_LONGEST_EDGE,
  MAX_IMAGE_BYTES,
  QUALITY_LADDER,
  DEFAULT_QUALITY,
} from '@/features/scan/domain/normalize';

describe('normalize helpers', () => {
  it('keeps dimensions when under max edge', () => {
    expect(computeTargetDimensions(1024, 768)).toEqual({ width: 1024, height: 768 });
    expect(needsResize(1024, 768)).toBe(false);
  });

  it('scales down proportionally when above max edge', () => {
    const { width, height } = computeTargetDimensions(4096, 2048);
    expect(Math.max(width, height)).toBeLessThanOrEqual(MAX_LONGEST_EDGE);
    expect(width / height).toBeCloseTo(2, 5);
    expect(needsResize(4096, 2048)).toBe(true);
  });

  it('handles exact max edge without resize', () => {
    const { width, height } = computeTargetDimensions(MAX_LONGEST_EDGE, 1024);
    expect(width).toBe(MAX_LONGEST_EDGE);
    expect(height).toBe(1024);
  });

  it('never produces zero dimensions', () => {
    const { width, height } = computeTargetDimensions(1, 100000);
    expect(width).toBeGreaterThanOrEqual(1);
    expect(height).toBeGreaterThanOrEqual(1);
  });

  it('detects HEIC extensions', () => {
    expect(isHeicUri('photo.heic')).toBe(true);
    expect(isHeicUri('photo.HEIF')).toBe(true);
    expect(isHeicUri('photo.jpg')).toBe(false);
  });

  it('extracts extensions case-insensitively ignoring query string', () => {
    expect(extensionFromUri('a/b/photo.PNG?size=1')).toBe('png');
    expect(extensionFromUri('photo.jpg')).toBe('jpg');
  });

  it('maps extension to mime type', () => {
    expect(mimeFromUri('photo.png')).toBe('image/png');
    expect(mimeFromUri('photo.webp')).toBe('image/webp');
    expect(mimeFromUri('photo.heic')).toBe('image/heic');
    expect(mimeFromUri('photo.jpg')).toBe('image/jpeg');
  });

  it('maps formats to mime types', () => {
    expect(mimeForFormat('jpeg')).toBe('image/jpeg');
    expect(mimeForFormat('png')).toBe('image/png');
    expect(mimeForFormat('webp')).toBe('image/webp');
  });

  it('chooses format from explicit mime when provided', () => {
    expect(chooseFormat('photo.jpg', 'image/png')).toBe('png');
    expect(chooseFormat('photo.jpg', 'image/webp')).toBe('webp');
    expect(chooseFormat('photo.png', 'image/jpeg')).toBe('jpeg');
  });

  it('defaults to jpeg for unknown extensions', () => {
    expect(chooseFormat('photo')).toBe('jpeg');
  });

  it('exposes the configured budget and ladder', () => {
    expect(MAX_IMAGE_BYTES).toBe(10 * 1024 * 1024);
    expect(QUALITY_LADDER[0]).toBe(85);
    expect(DEFAULT_QUALITY).toBe(85);
  });
});