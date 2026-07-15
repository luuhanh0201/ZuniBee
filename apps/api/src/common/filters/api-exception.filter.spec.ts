import { BadRequestException, HttpException, HttpStatus } from '@nestjs/common';
import { resolvePublicErrorMessage } from './api-exception.filter';

describe('resolvePublicErrorMessage', () => {
  it('dịch lỗi giới hạn tần suất sang tiếng Việt', () => {
    expect(
      resolvePublicErrorMessage(
        new HttpException(
          'ThrottlerException: Too Many Requests',
          HttpStatus.TOO_MANY_REQUESTS,
        ),
        HttpStatus.TOO_MANY_REQUESTS,
      ),
    ).toBe('Bạn thao tác quá nhanh. Vui lòng chờ một lúc rồi thử lại.');
  });

  it('giữ thông báo nghiệp vụ tiếng Việt', () => {
    expect(
      resolvePublicErrorMessage(
        new BadRequestException('Tài liệu không hợp lệ'),
        HttpStatus.BAD_REQUEST,
      ),
    ).toBe('Tài liệu không hợp lệ');
  });

  it('không đưa lỗi validation tiếng Anh ra client', () => {
    expect(
      resolvePublicErrorMessage(
        new BadRequestException(['questionCount must not be greater than 50']),
        HttpStatus.BAD_REQUEST,
      ),
    ).toBe('Dữ liệu gửi lên không hợp lệ.');
  });

  it('ẩn chi tiết lỗi hệ thống không xác định', () => {
    expect(
      resolvePublicErrorMessage(
        new Error('password database leaked'),
        HttpStatus.INTERNAL_SERVER_ERROR,
      ),
    ).toBe('Hệ thống đang gặp sự cố. Vui lòng thử lại sau.');
  });
});
