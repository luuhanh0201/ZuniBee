import { BadRequestException } from '@nestjs/common';
import { normalizeGoogleDriveMaterialUrl } from '@/modules/classroom/google-drive-material-url.util';

describe('normalizeGoogleDriveMaterialUrl', () => {
  it.each([
    'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view?usp=sharing',
    'https://drive.google.com/open?id=1AbCdEfGhIjKlMnOp',
    'https://docs.google.com/document/d/1AbCdEfGhIjKlMnOp/edit',
    'https://docs.google.com/spreadsheets/u/0/d/1AbCdEfGhIjKlMnOp/edit',
  ])('accepts a supported Google file URL: %s', (url) => {
    expect(normalizeGoogleDriveMaterialUrl(url)).toBe(url);
  });

  it('removes fragments before persisting a Drive URL', () => {
    expect(
      normalizeGoogleDriveMaterialUrl(
        'https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view#page=2',
      ),
    ).toBe('https://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view');
  });

  it.each([
    'http://drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view',
    'https://drive.google.com.evil.example/file/d/1AbCdEfGhIjKlMnOp/view',
    'https://attacker@drive.google.com/file/d/1AbCdEfGhIjKlMnOp/view',
    'https://drive.google.com:8443/file/d/1AbCdEfGhIjKlMnOp/view',
    'https://drive.google.com/drive/folders/1AbCdEfGhIjKlMnOp',
    'https://docs.google.com/document/d/short/edit',
  ])('rejects an unsafe or unsupported URL: %s', (url) => {
    expect(() => normalizeGoogleDriveMaterialUrl(url)).toThrow(
      BadRequestException,
    );
  });
});
