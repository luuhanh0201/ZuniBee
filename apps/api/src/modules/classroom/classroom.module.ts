import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassroomController } from '@/modules/classroom/classroom.controller';
import { ClassroomService } from '@/modules/classroom/classroom.service';
import { Classroom } from '@/modules/classroom/entities/classroom.entity';
import { ClassroomMember } from '@/modules/classroom/entities/classroom-member.entity';
import { ClassroomInvitation } from '@/modules/classroom/entities/classroom-invitation.entity';
import { MailModule } from '@/modules/mail/mail.module';
import { User } from '@/modules/user/entities/user.entity';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Classroom,
      ClassroomMember,
      ClassroomInvitation,
      User,
    ]),
    MailModule,
  ],
  controllers: [ClassroomController],
  providers: [ClassroomService],
  exports: [ClassroomService],
})
export class ClassroomModule {}
