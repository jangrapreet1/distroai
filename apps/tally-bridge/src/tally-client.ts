import axios from 'axios';

export class TallyClient {
    private url: string;

    constructor(url: string = 'http://localhost:9000') {
        this.url = url;
    }

    async postXml(xmlPayload: string): Promise<string> {
        try {
            const response = await axios.post(this.url, xmlPayload, {
                headers: {
                    'Content-Type': 'application/xml;charset=utf-8',
                },
            });
            return response.data;
        } catch (error) {
            console.error('Failed to communicate with Tally ERP:', (error as Error).message);
            throw error;
        }
    }

    async checkConnection(): Promise<boolean> {
        try {
            // A simple request to check if Tally is listening
            await axios.get(this.url, { timeout: 2000 });
            return true;
        } catch (err) {
            // Tally might return 400 for GET, but connection works. Only timeout/network error means offline.
            if (axios.isAxiosError(err) && !err.response) return false;
            return true;
        }
    }
}
