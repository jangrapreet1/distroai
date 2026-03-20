import { Controller, Get, Post, Body, Param } from '@nestjs/common';
import { CustomersService } from '../customers/customers.service';
import { Public } from '../common/decorators/public.decorator';

@Public()
@Controller('public')
export class PublicController {
    constructor(private readonly customers: CustomersService) { }

    @Get('location-request/:token')
    async getLocationRequest(@Param('token') token: string) {
        return this.customers.publicGetLocationRequest(token);
    }

    @Post('location-request/:token')
    async submitLocation(
        @Param('token') token: string,
        @Body() body: { lat: number; lng: number }
    ) {
        return this.customers.publicSubmitLocation(token, body.lat, body.lng);
    }
}
