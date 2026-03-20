export const STATE_CODES: Record<string, string> = {
    '01': 'Jammu and Kashmir',
    '02': 'Himachal Pradesh',
    '03': 'Punjab',
    '04': 'Chandigarh',
    '05': 'Uttarakhand',
    '06': 'Haryana',
    '07': 'Delhi',
    '08': 'Rajasthan',
    '09': 'Uttar Pradesh',
    '10': 'Bihar',
    '11': 'Sikkim',
    '12': 'Arunachal Pradesh',
    '13': 'Nagaland',
    '14': 'Manipur',
    '15': 'Mizoram',
    '16': 'Tripura',
    '17': 'Meghalaya',
    '18': 'Assam',
    '19': 'West Bengal',
    '20': 'Jharkhand',
    '21': 'Odisha',
    '22': 'Chhattisgarh',
    '23': 'Madhya Pradesh',
    '24': 'Gujarat',
    '25': 'Daman and Diu',
    '26': 'Dadra and Nagar Haveli and Daman and Diu',
    '27': 'Maharashtra',
    '28': 'Andhra Pradesh',
    '29': 'Karnataka',
    '30': 'Goa',
    '31': 'Lakshadweep',
    '32': 'Kerala',
    '33': 'Tamil Nadu',
    '34': 'Puducherry',
    '35': 'Andaman and Nicobar Islands',
    '36': 'Telangana',
    '37': 'Andhra Pradesh',
    '38': 'Ladakh',
};

export class GstUtility {
    /**
     * Parse GSTIN to get state and PAN
     */
    static parse(gstin: string): { valid: boolean; stateCode?: string; stateName?: string; pan?: string } {
        if (!gstin || gstin.length !== 15) {
            return { valid: false };
        }

        const stateCode = gstin.substring(0, 2);
        const pan = gstin.substring(2, 12);
        const stateName = STATE_CODES[stateCode];

        return {
            valid: !!stateName,
            stateCode,
            stateName,
            pan
        };
    }

    /**
     * Determine optimal tax split (CGST, SGST, IGST) based on seller and buyer GSTINs (or states)
     */
    static calculateTaxes(
        sellerGstinOrState: string | null | undefined,
        buyerGstinOrState: string | null | undefined,
        totalTaxableValue: number,
        gstRate: number,
        cessRate: number = 0
    ) {
        // If no buyer GSTIN, fallback to checking if it's the exact same state name string
        let isIntraState = true; // default to local sale if unknown (B2C)

        // Check if both are GSTINs (15 chars) or both are State Names
        if (sellerGstinOrState && buyerGstinOrState) {
            if (sellerGstinOrState.length === 15 && buyerGstinOrState.length === 15) {
                // Match first two digits
                isIntraState = sellerGstinOrState.substring(0, 2) === buyerGstinOrState.substring(0, 2);
            } else {
                // E.g. fallback string match
                isIntraState = sellerGstinOrState.toLowerCase() === buyerGstinOrState.toLowerCase();
            }
        }

        const totalGstAmount = totalTaxableValue * (gstRate / 100);
        const cessAmount = totalTaxableValue * (cessRate / 100);

        let cgst = 0, sgst = 0, igst = 0;

        if (isIntraState) {
            cgst = totalGstAmount / 2;
            sgst = totalGstAmount / 2;
        } else {
            igst = totalGstAmount;
        }

        return {
            taxableValue: totalTaxableValue,
            cgstAmount: Number(cgst.toFixed(2)),
            sgstAmount: Number(sgst.toFixed(2)),
            igstAmount: Number(igst.toFixed(2)),
            cessAmount: Number(cessAmount.toFixed(2)),
            totalTaxAmount: Number((totalGstAmount + cessAmount).toFixed(2))
        };
    }
}
