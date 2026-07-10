import { Injectable } from '@nestjs/common';

@Injectable()
export class AppService {
  getHealth() {
    return {
      success: true,
      data: {
        service: 'ZuniBee API',
        status: 'healthy',
        timestamp: new Date().toISOString(),
      },
    };
  }
}
