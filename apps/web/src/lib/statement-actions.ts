import apiClient, { getApiError } from '@/lib/api-client';
import toast from 'react-hot-toast';

export interface StatementFilterParams {
  startDate?: string;
  endDate?: string;
  statementDate?: string;
}

/**
 * Sanitizes customer name and generates a standardized statement filename.
 * Example: "Radhakishan Trading / Manish" -> "RTK-Statement-Radhakishan-Trading-Manish-2026-09-22.pdf"
 */
export function buildStatementPdfFilename(customerName: string, dateStr?: string): string {
  const sanitized = customerName
    .trim()
    .replace(/[\/\\:*?"<>|]/g, '')
    .replace(/\s+/g, '-');
  const date = dateStr || new Date().toISOString().slice(0, 10);
  return `RTK-Statement-${sanitized || 'Customer'}-${date}.pdf`;
}

/**
 * Robust error extractor for axios requests with responseType: 'blob'.
 */
export async function extractBlobErrorMessage(error: unknown): Promise<string> {
  const maybeResponse =
    error && typeof error === 'object' && 'response' in error
      ? (error as { response?: { data?: unknown } }).response
      : undefined;

  const data = maybeResponse?.data;
  const isBlob =
    data instanceof Blob ||
    Object.prototype.toString.call(data) === '[object Blob]' ||
    Boolean(data && typeof (data as { text?: unknown }).text === 'function');

  if (isBlob && data) {
    try {
      const blob = data as Blob;
      let text = '';
      if (typeof blob.text === 'function') {
        text = await blob.text();
      } else {
        text = await new Promise<string>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => resolve(reader.result as string);
          reader.onerror = () => reject(reader.error);
          reader.readAsText(blob);
        });
      }
      const json = JSON.parse(text);
      return json?.error?.message || json?.message || 'Failed to download statement PDF';
    } catch {
      return 'Failed to download statement PDF';
    }
  }

  const apiErr = typeof getApiError === 'function' ? getApiError(error) : undefined;
  return apiErr?.message || 'Failed to download statement PDF';
}

/**
 * Downloads the RTK Statement PDF via authenticated apiClient.
 */
export async function downloadCustomerStatementPdf({
  customerId,
  customerName,
  params,
}: {
  customerId: string;
  customerName: string;
  params?: StatementFilterParams;
}): Promise<void> {
  const toastId = toast.loading('Generating statement PDF...');
  try {
    const response = await apiClient.get<Blob>(
      `/api/v1/customers/${customerId}/statement/pdf`,
      {
        params,
        responseType: 'blob',
      }
    );

    const blob = new Blob([response.data], { type: 'application/pdf' });
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = buildStatementPdfFilename(customerName, params?.statementDate || params?.endDate);
    document.body.appendChild(link);
    link.click();

    // Cleanup DOM and memory
    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);

    toast.success('Statement PDF downloaded', { id: toastId });
  } catch (error: unknown) {
    const message = await extractBlobErrorMessage(error);
    toast.error(message, { id: toastId });
    throw error;
  }
}

/**
 * Triggers an in-browser print dialog for the customer statement.
 * Uses an invisible iframe with fallback to window.open for maximum compatibility.
 */
export async function printCustomerStatement({
  customerId,
  params,
}: {
  customerId: string;
  params?: StatementFilterParams;
}): Promise<void> {
  const toastId = toast.loading('Preparing statement for printing...');
  try {
    const response = await apiClient.get<Blob>(
      `/api/v1/customers/${customerId}/statement/pdf`,
      {
        params,
        responseType: 'blob',
      }
    );

    const blob = new Blob([response.data], { type: 'application/pdf' });
    const blobUrl = window.URL.createObjectURL(blob);

    // Create an invisible iframe
    const iframe = document.createElement('iframe');
    iframe.style.position = 'fixed';
    iframe.style.right = '0';
    iframe.style.bottom = '0';
    iframe.style.width = '0';
    iframe.style.height = '0';
    iframe.style.border = '0';
    iframe.src = blobUrl;

    document.body.appendChild(iframe);

    let hasPrinted = false;
    const cleanup = () => {
      if (document.body.contains(iframe)) {
        document.body.removeChild(iframe);
      }
      window.URL.revokeObjectURL(blobUrl);
    };

    iframe.onload = () => {
      try {
        iframe.contentWindow?.focus();
        iframe.contentWindow?.print();
        hasPrinted = true;
        toast.dismiss(toastId);
        setTimeout(cleanup, 60000);
      } catch {
        // Fallback for browsers blocking iframe print execution
        window.open(blobUrl, '_blank');
        toast.success('Opened statement in new tab for printing', { id: toastId });
        setTimeout(cleanup, 120000);
      }
    };

    // Safety timeout: if iframe onload fails to trigger within 4s, fallback to new tab
    setTimeout(() => {
      if (!hasPrinted) {
        window.open(blobUrl, '_blank');
        toast.dismiss(toastId);
        setTimeout(cleanup, 120000);
      }
    }, 4000);
  } catch (error: unknown) {
    const message = await extractBlobErrorMessage(error);
    toast.error(message, { id: toastId });
    throw error;
  }
}
