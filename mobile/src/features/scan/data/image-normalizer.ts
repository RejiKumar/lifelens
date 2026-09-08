import * as Crypto from 'expo-crypto';
import { Platform, Image as RNImage } from 'react-native';
import type { NormalizedImage, ScanSource } from '../domain/types';
import { isHeicUri, chooseFormat, mimeForFormat, needsResize, computeTargetDimensions, MAX_LONGEST_EDGE, MAX_IMAGE_BYTES, QUALITY_LADDER, DEFAULT_QUALITY, type ImageFormat, type Quality } from '../domain/normalize';
import { clientError, toLifeLensError, type LifeLensError } from '../domain/errors';
import { ImageManipulator, SaveFormat } from 'expo-image-manipulator';

export interface NormalizeInput {
  uri: string;
  source: ScanSource;
  width?: number;
  height?: number;
  mimeType?: string;
  fileName?: string;
}

export async function normalizeImage(input: NormalizeInput): Promise<NormalizedImage> {
  const heic = isHeicUri(input.uri) || (input.fileName ? isHeicUri(input.fileName) : false);
  if (heic && Platform.OS === 'web') {
    throw clientError(
      'unsupported_format',
      'UNSUPPORTED_FORMAT',
      'HEIC photos are not supported on the web app. Please choose a JPEG or PNG photo.',
    );
  }

  const { width, height } = await measureDimensions(input.uri, input.width, input.height);
  const format = chooseFormat(input.uri, input.mimeType);
  const results = format === 'png' ? ['png', 'jpeg'] as ImageFormat[] : [format];

  for (const fallbackFormat of results) {
    const result = await attemptRenderWithLadder(input.uri, width, height, fallbackFormat);
    if (result) {
      const sizeBytes = await getOutputFileSize(result.uri);
      return {
        uri: result.uri,
        name: deriveName(fallbackFormat, input.fileName),
        type: mimeForFormat(fallbackFormat),
        width: result.width,
        height: result.height,
        sizeBytes,
        source: input.source,
      };
    }
  }

  throw clientError(
    'payload_too_large',
    'PAYLOAD_TOO_LARGE',
    'The photo is too large to analyze even after compression. Try a smaller image.',
  );
}

async function attemptRenderWithLadder(
  sourceUri: string,
  origWidth: number,
  origHeight: number,
  format: ImageFormat,
): Promise<{ uri: string; width: number; height: number } | null> {
  const target = computeTargetDimensions(origWidth, origHeight, MAX_LONGEST_EDGE);
  const qualities: readonly Quality[] = QUALITY_LADDER;

  for (const quality of qualities) {
    try {
      const saved = await renderOnce(sourceUri, target, origWidth, origHeight, format, quality);
      const sizeBytes = await getOutputFileSize(saved.uri);
      if (sizeBytes <= MAX_IMAGE_BYTES) {
        return saved;
      }
    } catch (error) {
      const mapped = toLifeLensError(error);
      if (mapped.category === 'unsupported_format') throw mapped;
      if (mapped.category === 'canceled') throw mapped;
    }
  }

  return null;
}

async function renderOnce(
  sourceUri: string,
  target: { width: number; height: number },
  origWidth: number,
  origHeight: number,
  format: ImageFormat,
  quality: Quality,
): Promise<{ uri: string; width: number; height: number }> {
  const context = ImageManipulator.manipulate(sourceUri);
  if (needsResize(origWidth, origHeight, MAX_LONGEST_EDGE)) {
    context.resize({ width: target.width, height: target.height });
  }
  const ref = await context.renderAsync();
  const saved = await ref.saveAsync({
    format: format === 'jpeg' ? SaveFormat.JPEG : format === 'png' ? SaveFormat.PNG : SaveFormat.WEBP,
    compress: format === 'png' ? 1 : quality / 100,
  });
  return { uri: saved.uri, width: saved.width, height: saved.height };
}

function measureDimensions(
  uri: string,
  explicitWidth?: number,
  explicitHeight?: number,
): Promise<{ width: number; height: number }> {
  if (typeof explicitWidth === 'number' && typeof explicitHeight === 'number' && explicitWidth > 0 && explicitHeight > 0) {
    return Promise.resolve({ width: explicitWidth, height: explicitHeight });
  }
  return new Promise((resolve, reject) => {
    RNImage.getSize(
      uri,
      (w, h) => resolve({ width: w, height: h }),
      (err) => reject(err),
    );
  });
}

async function getOutputFileSize(uri: string): Promise<number> {
  if (Platform.OS === 'web') {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      return blob.size;
    } catch {
      return 0;
    }
  }
  try {
    const { File } = await import('expo-file-system');
    const file = new File(uri);
    return file.exists ? file.size : 0;
  } catch {
    return 0;
  }
}

function deriveName(format: ImageFormat, originalFileName?: string): string {
  const base = originalFileName ? originalFileName.replace(/\.[^.]+$/, '') : 'image';
  const ext = format === 'jpeg' ? 'jpg' : format;
  return `${base}.${ext}`;
}

export async function hashNormalizedImage(uri: string): Promise<string> {
  if (Platform.OS === 'web') {
    try {
      const response = await fetch(uri);
      const blob = await response.blob();
      const buffer = await blob.arrayBuffer();
      const hash = await Crypto.digest(Crypto.CryptoDigestAlgorithm.SHA256, new Uint8Array(buffer));
      let hex = '';
      const bytes = new Uint8Array(hash);
      for (let i = 0; i < bytes.length; i += 1) {
        hex += bytes[i].toString(16).padStart(2, '0');
      }
      return hex;
    } catch {
      return Crypto.randomUUID();
    }
  }
  try {
    const { File } = await import('expo-file-system');
    const file = new File(uri);
    if (file.exists) {
      const base64 = await file.base64();
      return Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, base64);
    }
    return Crypto.randomUUID();
  } catch {
    return Crypto.randomUUID();
  }
}