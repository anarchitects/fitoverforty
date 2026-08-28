import { Module } from '@nestjs/common';
import { DataSource } from 'typeorm';
import { AdminGuard } from './admin.guard';
import { AuthController } from './auth.controller';
import { createAuth } from './auth.factory';
import { AUTH_INSTANCE } from './auth.tokens';

/**
 * Better Auth over the application's own TypeORM connection.
 *
 * The instance is built from the injected `DataSource` rather than a second
 * connection of its own: sessions and posts are written by the same process
 * against the same pool, and a separate connection would double the pool for
 * no benefit.
 */
@Module({
  controllers: [AuthController],
  providers: [
    {
      provide: AUTH_INSTANCE,
      inject: [DataSource],
      useFactory: (dataSource: DataSource) => createAuth(dataSource),
    },
    AdminGuard,
  ],
  exports: [AUTH_INSTANCE, AdminGuard],
})
export class AuthModule {}
