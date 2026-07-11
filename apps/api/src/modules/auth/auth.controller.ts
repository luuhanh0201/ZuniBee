import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Post,
  Req,
  Res,
  UnauthorizedException,
  UseGuards,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { AuthGuard } from '@nestjs/passport';
import { ApiOperation, ApiTags } from '@nestjs/swagger';
import type { Request, Response } from 'express';
import { AuthService } from '@/modules/auth/auth.service';
import { RegisterDto } from '@/modules/auth/dto/register.dto';
import { LoginDto } from '@/modules/auth/dto/login.dto';
import { ForgotPasswordDto } from '@/modules/auth/dto/forgot-password.dto';
import { ResetPasswordDto } from '@/modules/auth/dto/reset-password.dto';
import { ChangePasswordDto } from '@/modules/auth/dto/change-password.dto';
import { SelectRoleDto } from '@/modules/auth/dto/select-role.dto';
import { Public } from '@/common/decorators/public.decorator';
import { CurrentUser } from '@/common/decorators/current-user.decorator';
import type { AuthenticatedUser } from '@/modules/auth/types/authenticated-user.type';
import type { GoogleOAuthProfile } from '@/modules/auth/strategies/google.strategy';
import type { FacebookOAuthProfile } from '@/modules/auth/strategies/facebook.strategy';
import { durationToMilliseconds } from '@/common/utils/duration.util';

const REFRESH_COOKIE = 'refreshToken';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly config: ConfigService,
  ) {}

  @Public()
  @Post('register')
  @ApiOperation({ summary: 'Đăng ký tài khoản (Giáo viên hoặc Học sinh)' })
  async register(
    @Body() dto: RegisterDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { tokens, user } = await this.authService.register(
      dto,
      this.contextFrom(req),
    );
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken, user };
  }

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đăng nhập bằng email/mật khẩu' })
  async login(
    @Body() dto: LoginDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { tokens, user } = await this.authService.login(
      dto,
      this.contextFrom(req),
    );
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken, user };
  }

  @Public()
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Làm mới access token bằng refresh token cookie' })
  async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = this.getRefreshCookie(req);
    if (!refreshToken) {
      throw new UnauthorizedException('Không tìm thấy phiên đăng nhập');
    }

    const { tokens, user } = await this.authService.refresh(
      refreshToken,
      this.contextFrom(req),
    );
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken, user };
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Đăng xuất, thu hồi phiên hiện tại' })
  async logout(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const refreshToken = this.getRefreshCookie(req);
    if (refreshToken) {
      const session =
        await this.authService.getSessionTokenFromRefreshToken(refreshToken);
      if (session) {
        await this.authService.logout(session.sessionToken, currentUser.id);
      }
    }
    res.clearCookie(REFRESH_COOKIE, { path: '/' });
  }

  @Get('me')
  @ApiOperation({ summary: 'Thông tin người dùng đang đăng nhập' })
  me(@CurrentUser() currentUser: AuthenticatedUser) {
    return this.authService.getCurrentUser(currentUser.id);
  }

  @Post('select-role')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Chọn vai trò sau lần đăng nhập OAuth đầu tiên' })
  async selectRole(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: SelectRoleDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { tokens, user } = await this.authService.selectRole(
      currentUser.id,
      dto.role,
      this.contextFrom(req),
    );
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken, user };
  }

  @Public()
  @Post('forgot-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Gửi mật khẩu tạm qua email' })
  async forgotPassword(@Body() dto: ForgotPasswordDto) {
    await this.authService.forgotPassword(dto);
    return { message: 'Mật khẩu tạm đã được gửi tới email của bạn.' };
  }

  @Public()
  @Post('reset-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đổi mật khẩu bằng mật khẩu tạm nhận qua email' })
  async resetPassword(
    @Body() dto: ResetPasswordDto,
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ) {
    const { tokens, user } = await this.authService.resetPassword(
      dto,
      this.contextFrom(req),
    );
    this.setRefreshCookie(res, tokens.refreshToken);
    return { accessToken: tokens.accessToken, user };
  }

  @Post('change-password')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Đổi mật khẩu khi đã đăng nhập' })
  async changePassword(
    @CurrentUser() currentUser: AuthenticatedUser,
    @Body() dto: ChangePasswordDto,
  ) {
    await this.authService.changePassword(currentUser.id, dto);
    return { message: 'Đổi mật khẩu thành công' };
  }

  @Public()
  @Get('google')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Bắt đầu đăng nhập bằng Google' })
  googleAuth() {
    // Passport tự động điều hướng sang Google, không cần thân hàm.
  }

  @Public()
  @Get('google/callback')
  @UseGuards(AuthGuard('google'))
  @ApiOperation({ summary: 'Callback OAuth Google' })
  async googleCallback(
    @Req() req: Request & { user: GoogleOAuthProfile },
    @Res() res: Response,
  ) {
    const { tokens } = await this.authService.loginWithGoogle(
      req.user,
      this.contextFrom(req),
    );
    this.setRefreshCookie(res, tokens.refreshToken);
    res.redirect(this.oauthRedirectUrl(tokens.accessToken));
  }

  @Public()
  @Get('facebook')
  @UseGuards(AuthGuard('facebook'))
  @ApiOperation({ summary: 'Bắt đầu đăng nhập bằng Facebook' })
  facebookAuth() {
    // Passport tự động điều hướng sang Facebook, không cần thân hàm.
  }

  @Public()
  @Get('facebook/callback')
  @UseGuards(AuthGuard('facebook'))
  @ApiOperation({ summary: 'Callback OAuth Facebook' })
  async facebookCallback(
    @Req() req: Request & { user: FacebookOAuthProfile },
    @Res() res: Response,
  ) {
    const { tokens } = await this.authService.loginWithFacebook(
      req.user,
      this.contextFrom(req),
    );
    this.setRefreshCookie(res, tokens.refreshToken);
    res.redirect(this.oauthRedirectUrl(tokens.accessToken));
  }

  private getRefreshCookie(req: Request): string | undefined {
    const cookies = req.cookies as Record<string, string> | undefined;
    return cookies?.[REFRESH_COOKIE];
  }

  private contextFrom(req: Request) {
    return {
      ipAddress: req.ip,
      userAgent: req.headers['user-agent'],
    };
  }

  private setRefreshCookie(res: Response, refreshToken: string) {
    const isProduction = this.config.get('NODE_ENV') === 'production';
    const cookieExpiresIn = this.config.getOrThrow<string>(
      'AUTH_REFRESH_COOKIE_EXPIRES_IN',
    );

    res.cookie(REFRESH_COOKIE, refreshToken, {
      httpOnly: true,
      secure: isProduction,
      sameSite: 'lax',
      path: '/',
      maxAge: durationToMilliseconds(cookieExpiresIn),
    });
  }

  /** Trang FE nhận access token tạm thời trên query để hoàn tất phiên OAuth. */
  private oauthRedirectUrl(accessToken: string): string {
    const webUrl = this.config.get<string>('WEB_URL', 'http://localhost:1111');
    return `${webUrl}/oauth/callback?accessToken=${encodeURIComponent(accessToken)}`;
  }
}
