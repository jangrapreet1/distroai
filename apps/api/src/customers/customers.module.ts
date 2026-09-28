import { Module } from '@nestjs/common';
import { CustomersController } from './customers.controller';
import { CustomersService } from './customers.service';
import { CustomersImportService } from './customers-import.service';

@Module({
    controllers: [CustomersController],
    providers: [CustomersService, CustomersImportService],
    exports: [CustomersService, CustomersImportService],
})
export class CustomersModule { }
