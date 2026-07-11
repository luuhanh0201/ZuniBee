import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { UserRole, type UpdateProfileRequest } from '@zunibee/shared';
import { User } from '@/modules/user/entities/user.entity';
import { UploadFileService } from '@/modules/upload-file/upload-file.service';

@Injectable()
export class UserService {
  constructor(
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    private readonly uploadFileService: UploadFileService,
  ) {}

  findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { email } });
  }

  findById(id: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { id } });
  }

  findByGoogleId(googleId: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { googleId } });
  }

  findByFacebookId(facebookId: string): Promise<User | null> {
    return this.userRepository.findOne({ where: { facebookId } });
  }

  create(data: {
    email: string | null;
    fullName: string;
    role: UserRole;
    roleSelected?: boolean;
    passwordHash?: string;
    googleId?: string;
    facebookId?: string;
    provider?: string;
    avatar?: string;
    isVerify?: boolean;
  }): Promise<User> {
    const user = this.userRepository.create(data);
    return this.userRepository.save(user);
  }

  async updateLastLogin(id: string): Promise<void> {
    await this.userRepository.update(id, { lastLoginAt: new Date() });
  }

  async selectRole(id: string, role: UserRole): Promise<User | null> {
    await this.userRepository.update(id, { role, roleSelected: true });
    return this.findById(id);
  }

  async updateProfile(
    id: string,
    input: UpdateProfileRequest,
  ): Promise<User | null> {
    const currentUser = await this.findById(id);
    if (!currentUser) return null;
    const nextAvatar = input.avatar?.trim() || null;

    await this.userRepository.update(id, {
      fullName: input.fullName.trim(),
      phone: input.phone?.trim() || null,
      avatar: nextAvatar,
    });
    if (currentUser.avatar !== nextAvatar) {
      await this.uploadFileService.deleteLocalAvatar(currentUser.avatar);
    }
    return this.findById(id);
  }

  /** Ghi mật khẩu tạm (đã hash) + hạn dùng khi user quên mật khẩu. */
  async setTempPassword(
    id: string,
    passwordHash: string,
    expiresAt: Date,
  ): Promise<void> {
    await this.userRepository.update(id, {
      passwordHash,
      passwordResetExpiresAt: expiresAt,
    });
  }

  /** Đặt mật khẩu mới (đổi mật khẩu thường, hoặc hoàn tất reset) và xoá hạn mật khẩu tạm. */
  async setPassword(id: string, passwordHash: string): Promise<void> {
    await this.userRepository.update(id, {
      passwordHash,
      passwordResetExpiresAt: null,
    });
  }
}
