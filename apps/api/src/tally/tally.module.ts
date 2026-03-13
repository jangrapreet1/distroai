import { Module } from '@nestjs/common';
import { TallyController } from './tally.controller';

@Module({
    controllers: [TallyController],
})
export class TallyModule { }
