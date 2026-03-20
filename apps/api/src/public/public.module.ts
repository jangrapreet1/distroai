import { Module } from '@nestjs/common';
import { PublicController } from './public.controller';
import { CustomersModule } from '../customers/customers.module';

@Module({
    imports: [CustomersModule],
    controllers: [PublicController],
})
export class PublicModule { }
