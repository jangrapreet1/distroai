import { Controller, Post, Get, Body, UseGuards, Req, Res } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { ThrottlerGuard, Throttle } from '@nestjs/throttler';
import { AuthService } from './auth.service';
import {
    RegisterDto,
    LoginDto,
    RefreshTokenDto,
    LogoutDto,
    ForgotPasswordDto,
    ResetPasswordDto,
} from './dto/auth.dto';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser, JwtPayload } from '../common/decorators/current-user.decorator';
import { JwtAuthGuard } from './jwt-auth.guard';

@ApiTags('auth')
@Controller('auth')
@UseGuards(ThrottlerGuard)
export class AuthController {
    constructor(private readonly auth: AuthService) { }

    @Public()
    @Post('register')
    @Throttle({ default: { ttl: 60000, limit: 5 } })
    register(@Body() dto: RegisterDto) {
        return this.auth.register(dto);
    }

    @Public()
    @Post('login')
    @Throttle({ default: { ttl: 60000, limit: 5 } })
    login(@Body() dto: LoginDto) {
        return this.auth.login(dto);
    }

    @Public()
    @Post('refresh')
    @Throttle({ default: { ttl: 60000, limit: 3 } })
    refresh(@Body() dto: RefreshTokenDto) {
        return this.auth.refresh(dto);
    }

    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @Post('logout')
    logout(@CurrentUser() user: JwtPayload, @Body() dto: LogoutDto) {
        return this.auth.logout(user.sub, dto.refreshToken);
    }

    @Public()
    @Post('forgot-password')
    @Throttle({ default: { ttl: 60000, limit: 3 } })
    forgotPassword(@Body() dto: ForgotPasswordDto) {
        return this.auth.forgotPassword(dto);
    }

    @Public()
    @Post('reset-password')
    @Throttle({ default: { ttl: 60000, limit: 3 } })
    resetPassword(@Body() dto: ResetPasswordDto) {
        return this.auth.resetPassword(dto);
    }

    @ApiBearerAuth()
    @UseGuards(JwtAuthGuard)
    @Get('me')
    getMe(@CurrentUser() user: JwtPayload) {
        return this.auth.getMe(user.sub);
    }

    @Public()
    @Get('google')
    @UseGuards(AuthGuard('google'))
    async googleAuth() {
        // Redirects to Google
    }

    @Public()
    @Get('google/callback')
    @UseGuards(AuthGuard('google'))
    async googleAuthRedirect(@Req() req: any, @Res() res: any) {
        // req.user contains the output of validateGoogleUser
        const authData = req.user;

        // Pass tokens to frontend, usually via cookie or redirect params
        // For simplicity, redirecting with token in query params (frontend should extract and store)
        return res.redirect(`http://localhost:3000/login?accessToken=${authData.accessToken}&refreshToken=${authData.refreshToken}`);
    }
}
