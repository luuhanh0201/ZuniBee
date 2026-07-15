import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ClassroomController } from '@/modules/classroom/classroom.controller';
import { ClassroomService } from '@/modules/classroom/classroom.service';
import { Classroom } from '@/modules/classroom/entities/classroom.entity';
import { ClassroomMember } from '@/modules/classroom/entities/classroom-member.entity';
import { ClassroomInvitation } from '@/modules/classroom/entities/classroom-invitation.entity';
import { ClassroomMaterial } from '@/modules/classroom/entities/classroom-material.entity';
import { ClassroomMaterialController } from '@/modules/classroom/classroom-material.controller';
import { ClassroomMaterialService } from '@/modules/classroom/classroom-material.service';
import { MailModule } from '@/modules/mail/mail.module';
import { User } from '@/modules/user/entities/user.entity';
import { Quiz } from '@/modules/quiz/entities/quiz.entity';
import { QuizAssignment } from '@/modules/quiz/entities/quiz-assignment.entity';
import { UploadFileModule } from '@/modules/upload-file/upload-file.module';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Classroom,
      ClassroomMember,
      ClassroomInvitation,
      ClassroomMaterial,
      User,
      Quiz,
      QuizAssignment,
    ]),
    MailModule,
    UploadFileModule,
  ],
  controllers: [ClassroomController, ClassroomMaterialController],
  providers: [ClassroomService, ClassroomMaterialService],
  exports: [ClassroomService],
})
export class ClassroomModule {}
