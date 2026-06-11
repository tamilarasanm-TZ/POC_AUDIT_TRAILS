import { Controller, Get, NotFoundException } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';

// Dev-only helper endpoints for verifying logger + exception filter.
// Remove or guard with NODE_ENV !== 'production' before shipping.
@ApiTags('debug')
@Controller('debug')
export class DebugController {
  // Triggers an uncaught runtime error → 500 → ERROR row in error-*.log.
  @Get('throw')
  triggerError() {
    throw new Error('Forced error for log pipeline test');
  }

  // Triggers a 404 HTTP exception → also lands in error-*.log now.
  @Get('not-found')
  triggerNotFound() {
    throw new NotFoundException('Forced 404 for log pipeline test');
  }
}
