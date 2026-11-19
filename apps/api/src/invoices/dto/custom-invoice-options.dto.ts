import { IsBoolean, IsOptional, IsString } from 'class-validator';

export interface InvoiceCustomOptions {
    title?: string;
    subtitle?: string;
    showGstNumber?: boolean;
    showPanNumber?: boolean;
    showHsnCode?: boolean;
    showDiscountCol?: boolean;
    showTaxBreakup?: boolean;
    showUnit?: boolean;
    showPlaceOfSupply?: boolean;
    showShipTo?: boolean;
    showBankDetails?: boolean;
    showUpiQr?: boolean;
    showAmountInWords?: boolean;
    showTerms?: boolean;
    customTerms?: string;
    showSignatory?: boolean;
    customNotes?: string;
    accentColor?: string;
    buyerGstNumber?: string;
    isTaxInclusive?: boolean;
    targetAmount?: number;
    roundOffAmount?: number;
}

export class InvoiceCustomOptionsDto implements InvoiceCustomOptions {
    @IsOptional() @IsString() title?: string;
    @IsOptional() @IsString() subtitle?: string;
    @IsOptional() @IsBoolean() showGstNumber?: boolean;
    @IsOptional() @IsBoolean() showPanNumber?: boolean;
    @IsOptional() @IsBoolean() showHsnCode?: boolean;
    @IsOptional() @IsBoolean() showDiscountCol?: boolean;
    @IsOptional() @IsBoolean() showTaxBreakup?: boolean;
    @IsOptional() @IsBoolean() showUnit?: boolean;
    @IsOptional() @IsBoolean() showPlaceOfSupply?: boolean;
    @IsOptional() @IsBoolean() showShipTo?: boolean;
    @IsOptional() @IsBoolean() showBankDetails?: boolean;
    @IsOptional() @IsBoolean() showUpiQr?: boolean;
    @IsOptional() @IsBoolean() showAmountInWords?: boolean;
    @IsOptional() @IsBoolean() showTerms?: boolean;
    @IsOptional() @IsString() customTerms?: string;
    @IsOptional() @IsBoolean() showSignatory?: boolean;
    @IsOptional() @IsString() customNotes?: string;
    @IsOptional() @IsString() accentColor?: string;
    @IsOptional() @IsString() buyerGstNumber?: string;
    @IsOptional() @IsBoolean() isTaxInclusive?: boolean;
    @IsOptional() targetAmount?: number;
    @IsOptional() roundOffAmount?: number;
}

export class GenerateInvoicePdfDto {
    @IsOptional()
    options?: InvoiceCustomOptionsDto;

    @IsOptional()
    @IsBoolean()
    saveAsDefault?: boolean;
}
