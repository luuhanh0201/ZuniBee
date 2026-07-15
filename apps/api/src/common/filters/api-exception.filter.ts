import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

type ExceptionPayload = {
  message?: unknown;
};

const STATUS_MESSAGES: Partial<Record<number, string>> = {
  [HttpStatus.BAD_REQUEST]: 'Dữ liệu gửi lên không hợp lệ.',
  [HttpStatus.UNAUTHORIZED]: 'Phiên đăng nhập không hợp lệ hoặc đã hết hạn.',
  [HttpStatus.FORBIDDEN]: 'Bạn không có quyền thực hiện thao tác này.',
  [HttpStatus.NOT_FOUND]: 'Không tìm thấy dữ liệu yêu cầu.',
  [HttpStatus.CONFLICT]: 'Dữ liệu đã tồn tại hoặc vừa được thay đổi.',
  [HttpStatus.PAYLOAD_TOO_LARGE]: 'Tệp tải lên vượt quá dung lượng cho phép.',
  [HttpStatus.UNSUPPORTED_MEDIA_TYPE]: 'Định dạng dữ liệu không được hỗ trợ.',
  [HttpStatus.UNPROCESSABLE_ENTITY]: 'Không thể xử lý dữ liệu đã gửi.',
  [HttpStatus.TOO_MANY_REQUESTS]:
    'Bạn thao tác quá nhanh. Vui lòng chờ một lúc rồi thử lại.',
  [HttpStatus.INTERNAL_SERVER_ERROR]:
    'Hệ thống đang gặp sự cố. Vui lòng thử lại sau.',
  [HttpStatus.BAD_GATEWAY]:
    'Dịch vụ bên ngoài đang phản hồi không ổn định. Vui lòng thử lại sau.',
  [HttpStatus.SERVICE_UNAVAILABLE]:
    'Dịch vụ đang tạm thời gián đoạn. Vui lòng thử lại sau.',
  [HttpStatus.GATEWAY_TIMEOUT]:
    'Yêu cầu mất quá nhiều thời gian xử lý. Vui lòng thử lại.',
};

@Catch()
export class ApiExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ApiExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const context = host.switchToHttp();
    const response = context.getResponse<Response>();
    const request = context.getRequest<Request>();
    const status: number =
      exception instanceof HttpException ? exception.getStatus() : 500;
    const message = resolvePublicErrorMessage(exception, status);

    if (status === 429) {
      this.logger.warn(
        `Yêu cầu bị giới hạn tần suất: ${request.method} ${request.originalUrl}`,
      );
    } else if (status >= 500) {
      const detail =
        exception instanceof Error ? exception.stack : String(exception);
      this.logger.error(
        `Lỗi hệ thống khi xử lý ${request.method} ${request.originalUrl}`,
        detail,
      );
    }

    response.status(status).json({ statusCode: status, message });
  }
}

export function resolvePublicErrorMessage(
  exception: unknown,
  status: number,
): string {
  if (status === 429) return STATUS_MESSAGES[HttpStatus.TOO_MANY_REQUESTS]!;
  if (!(exception instanceof HttpException))
    return STATUS_MESSAGES[HttpStatus.INTERNAL_SERVER_ERROR]!;

  const payload = exception.getResponse();
  const candidate = extractMessage(payload);
  if (candidate && isVietnameseMessage(candidate)) return candidate;
  return (
    STATUS_MESSAGES[status] ??
    'Không thể xử lý yêu cầu lúc này. Vui lòng thử lại sau.'
  );
}

function extractMessage(payload: string | object): string | null {
  if (typeof payload === 'string') return payload.trim() || null;
  const message = (payload as ExceptionPayload).message;
  if (typeof message === 'string') return message.trim() || null;
  if (Array.isArray(message)) {
    const first = message.find(
      (item): item is string =>
        typeof item === 'string' && Boolean(item.trim()),
    );
    return first?.trim() ?? null;
  }
  return null;
}

function isVietnameseMessage(message: string): boolean {
  if (
    /\b(?:Exception|Error|Bad Request|Unauthorized|Forbidden|Not Found)\b/i.test(
      message,
    )
  )
    return false;
  if (
    /\b(?:must|should|invalid|unexpected|failed|too many requests)\b/i.test(
      message,
    )
  )
    return false;
  return /[À-ỹĐđ]/u.test(message);
}
