import { IsNotEmpty, IsObject, IsOptional, IsString, ValidateNested } from 'class-validator';
import { Type } from 'class-transformer';

export class PushSubscriptionKeysDto {
    @IsNotEmpty()
    @IsString()
    p256dh!: string;

    @IsNotEmpty()
    @IsString()
    auth!: string;
}

export class CreatePushSubscriptionDto {
    @IsNotEmpty()
    @IsString()
    endpoint!: string;

    @IsNotEmpty()
    @IsObject()
    @ValidateNested()
    @Type(() => PushSubscriptionKeysDto)
    keys!: PushSubscriptionKeysDto;

    @IsOptional()
    @IsString()
    userAgent?: string;
}

export class UnsubscribePushDto {
    @IsNotEmpty()
    @IsString()
    endpoint!: string;
}
