import { BadRequestException } from '@nestjs/common';

const GOOGLE_DRIVE_HOSTS = new Set(['drive.google.com', 'docs.google.com']);
const GOOGLE_FILE_ID_PATTERN = '[A-Za-z0-9_-]{10,}';
const DRIVE_FILE_PATH = new RegExp(
  `^/(?:drive/u/\\d+/)?file/d/(${GOOGLE_FILE_ID_PATTERN})(?:/|$)`,
);
const DOCS_FILE_PATH = new RegExp(
  `^/(?:document|spreadsheets|presentation|forms)(?:/u/\\d+)?/d/(${GOOGLE_FILE_ID_PATTERN})(?:/|$)`,
);
const DRIVE_QUERY_FILE_PATH = new Set(['/open', '/uc']);

export function normalizeGoogleDriveMaterialUrl(value: string): string {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw invalidDriveUrl();
  }

  const hostname = url.hostname.toLowerCase();
  if (
    url.protocol !== 'https:' ||
    !GOOGLE_DRIVE_HOSTS.has(hostname) ||
    url.username ||
    url.password ||
    url.port
  ) {
    throw invalidDriveUrl();
  }

  const hasFileId =
    hostname === 'drive.google.com'
      ? DRIVE_FILE_PATH.test(url.pathname) ||
        (DRIVE_QUERY_FILE_PATH.has(url.pathname) &&
          new RegExp(`^${GOOGLE_FILE_ID_PATTERN}$`).test(
            url.searchParams.get('id') ?? '',
          ))
      : DOCS_FILE_PATH.test(url.pathname);

  if (!hasFileId) throw invalidDriveUrl();

  url.hash = '';
  return url.toString();
}

function invalidDriveUrl(): BadRequestException {
  return new BadRequestException(
    'Liên kết phải trỏ đến một tệp Google Drive hoặc Google Docs hợp lệ',
  );
}
