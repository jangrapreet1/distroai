import { getApiError } from './api-errors';
import axios from 'axios';

jest.mock('axios');

describe('getApiError', () => {
    it('extracts message from nested error object correctly (The Fix)', () => {
        const mockAxiosError = {
            isAxiosError: true,
            response: {
                status: 409,
                data: {
                    success: false,
                    error: {
                        code: 'CONFLICT',
                        message: 'Insufficient stock for some items',
                        details: []
                    }
                }
            }
        };

        (axios.isAxiosError as unknown as jest.Mock).mockReturnValue(true);
        
        const result = getApiError(mockAxiosError);
        
        expect(result.code).toBe('CONFLICT');
        expect(result.message).toBe('Insufficient stock for some items');
        expect(result.statusCode).toBe(409);
    });

    it('falls back to top-level message if error object is missing', () => {
        const mockAxiosError = {
            isAxiosError: true,
            response: {
                status: 400,
                data: {
                    code: 'BAD_REQUEST',
                    message: 'Validation failed'
                }
            }
        };

        (axios.isAxiosError as unknown as jest.Mock).mockReturnValue(true);
        
        const result = getApiError(mockAxiosError);
        
        expect(result.code).toBe('BAD_REQUEST');
        expect(result.message).toBe('Validation failed');
    });

    it('returns generic error if no message found', () => {
        const mockAxiosError = {
            isAxiosError: true,
            response: {
                status: 500,
                data: {}
            }
        };

        (axios.isAxiosError as unknown as jest.Mock).mockReturnValue(true);
        
        const result = getApiError(mockAxiosError);
        
        expect(result.message).toBe('Something went wrong');
    });
});
