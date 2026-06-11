import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { EventEmitterModule } from '@nestjs/event-emitter';
import { APP_INTERCEPTOR } from '@nestjs/core';

import { PrismaModule } from './prisma/prisma.module';
import { AuditModule } from './audit/audit.module';
import { AuthModule } from './auth/auth.module';
import { UsersModule } from './users/users.module';
import { OrdersModule } from './orders/orders.module';
import { AuditInterceptor } from './audit/audit.interceptor';
import { RequestContextMiddleware } from './audit/request-context.middleware';
import { LoggingMiddleware } from './common/logging.middleware';
import { DebugController } from './common/debug.controller';

@Module({
  imports: [
    ConfigModule.forRoot({ isGlobal: true }),
    EventEmitterModule.forRoot(),
    PrismaModule,
    AuditModule,
    AuthModule,
    UsersModule,
    OrdersModule,
  ],
  controllers: [DebugController],
  providers: [
    {
      provide: APP_INTERCEPTOR,
      useClass: AuditInterceptor,
    },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer) {
    // RequestContextMiddleware must run before any controller/guard so the
    // AsyncLocalStorage context is established for the Prisma extension.
    // LoggingMiddleware runs after, so it can read the requestId set by RC.
    consumer
      .apply(RequestContextMiddleware, LoggingMiddleware)
      .forRoutes('*');
  }
}
