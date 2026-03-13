import { Module, Global } from '@nestjs/common';
import { RedisService } from './services/redis.service';
import { RolesGuard } from './guards/roles.guard';

@Global()
@Module({
    providers: [RedisService, RolesGuard],
    exports: [RedisService, RolesGuard],
})
export class CommonModule { }
