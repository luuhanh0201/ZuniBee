import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from '@/modules/user/entities/user.entity';
import { UserSession } from '@/modules/auth/entities/user-session.entity';
import { UserService } from '@/modules/user/user.service';
import { AdminUserService } from '@/modules/user/admin-user.service';
import { UserController } from '@/modules/user/user.controller';
import { AdminUserController } from '@/modules/user/admin-user.controller';
import { UploadFileModule } from '@/modules/upload-file/upload-file.module';

@Module({
  imports: [TypeOrmModule.forFeature([User, UserSession]), UploadFileModule],
  controllers: [UserController, AdminUserController],
  providers: [UserService, AdminUserService],
  exports: [UserService],
})
export class UserModule {}
