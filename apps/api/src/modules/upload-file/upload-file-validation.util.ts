import { BadRequestException } from '@nestjs/common';

const OFFICE_ZIP_MIMES = new Set([
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
]);
const LEGACY_OFFICE_MIMES = new Set([
  'application/msword',
  'application/vnd.ms-excel',
  'application/vnd.ms-powerpoint',
]);

export function verifiedImageMime(
  buffer: Buffer,
): 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif' {
  const detected = detectMime(buffer);
  if (
    !detected ||
    !['image/jpeg', 'image/png', 'image/webp', 'image/gif'].includes(detected)
  ) {
    throw new BadRequestException(
      'Nội dung tệp không phải ảnh JPEG, PNG, WebP hoặc GIF hợp lệ',
    );
  }
  return detected as 'image/jpeg' | 'image/png' | 'image/webp' | 'image/gif';
}

export function assertDeclaredFileType(file: {
  buffer: Buffer;
  mimetype: string;
  originalname: string;
}): void {
  const detected = detectMime(file.buffer);
  if (file.mimetype === 'text/plain') {
    if (detected || file.buffer.includes(0)) {
      throw invalidFile(file.originalname);
    }
    return;
  }
  if (!detected) throw invalidFile(file.originalname);

  const exactMatch = detected === file.mimetype;
  const officeZipMatch =
    OFFICE_ZIP_MIMES.has(file.mimetype) &&
    (detected === 'application/zip' || OFFICE_ZIP_MIMES.has(detected));
  const legacyOfficeMatch =
    LEGACY_OFFICE_MIMES.has(file.mimetype) && detected === 'application/x-cfb';
  const zipMatch =
    file.mimetype === 'application/zip' && detected === 'application/zip';
  if (!exactMatch && !officeZipMatch && !legacyOfficeMatch && !zipMatch) {
    throw invalidFile(file.originalname);
  }
}

function detectMime(buffer: Buffer): string | undefined {
  if (startsWith(buffer, [0xff, 0xd8, 0xff])) return 'image/jpeg';
  if (startsWith(buffer, [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))
    return 'image/png';
  if (
    buffer.subarray(0, 4).toString('ascii') === 'RIFF' &&
    buffer.subarray(8, 12).toString('ascii') === 'WEBP'
  )
    return 'image/webp';
  if (['GIF87a', 'GIF89a'].includes(buffer.subarray(0, 6).toString('ascii')))
    return 'image/gif';
  if (buffer.subarray(0, 5).toString('ascii') === '%PDF-')
    return 'application/pdf';
  if (startsWith(buffer, [0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]))
    return 'application/x-cfb';
  if (
    startsWith(buffer, [0x50, 0x4b, 0x03, 0x04]) ||
    startsWith(buffer, [0x50, 0x4b, 0x05, 0x06]) ||
    startsWith(buffer, [0x50, 0x4b, 0x07, 0x08])
  ) {
    const directory = buffer.toString('latin1');
    if (directory.includes('word/'))
      return 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
    if (directory.includes('xl/'))
      return 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
    if (directory.includes('ppt/'))
      return 'application/vnd.openxmlformats-officedocument.presentationml.presentation';
    return 'application/zip';
  }
  return undefined;
}

function startsWith(buffer: Buffer, bytes: number[]): boolean {
  return (
    buffer.length >= bytes.length &&
    bytes.every((byte, index) => buffer[index] === byte)
  );
}

function invalidFile(name: string): BadRequestException {
  return new BadRequestException(
    `Nội dung tệp ${name.slice(0, 120)} không khớp định dạng khai báo`,
  );
}
