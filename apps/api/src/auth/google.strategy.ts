import { PassportStrategy } from '@nestjs/passport';
import { Strategy, VerifyCallback } from 'passport-google-oauth20';
import { Injectable } from '@nestjs/common';
import { AuthService } from './auth.service';

@Injectable()
export class GoogleStrategy extends PassportStrategy(Strategy, 'google') {
    constructor(private readonly authService: AuthService) {
        super({
            clientID: process.env.GOOGLE_CLIENT_ID || 'placeholder_client_id',
            clientSecret: process.env.GOOGLE_CLIENT_SECRET || 'placeholder_client_secret',
            callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:3001/api/v1/auth/google/callback',
            scope: ['email', 'profile'],
        });
    }

    async validate(accessToken: string, refreshToken: string, profile: any, done: VerifyCallback): Promise<any> {
        const { id, emails, name, photos } = profile;
        const user = {
            googleId: id,
            email: emails[0].value,
            firstName: name.givenName || 'User',
            lastName: name.familyName || '',
            avatarUrl: photos[0].value,
        };

        const validatedUser = await this.authService.validateGoogleUser(user);
        return done(null, validatedUser);
    }
}
