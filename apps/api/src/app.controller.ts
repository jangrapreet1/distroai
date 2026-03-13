import { Controller, Get } from '@nestjs/common';
import { ApiTags } from '@nestjs/swagger';
import { AppService } from './app.service';
import { Public } from './common/decorators/public.decorator';

@ApiTags('health')
@Controller()
export class AppController {
    constructor(private readonly appService: AppService) { }

    @Public()
    @Get('health')
    getHealth() {
        return this.appService.getHealth();
    }
}
