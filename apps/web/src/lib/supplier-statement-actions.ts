import apiClient, { getApiError } from '@/lib/api-client';
import toast from 'react-hot-toast';

export interface SupplierStatementFilterParams {
  startDate?: string;
  endDate?: string;
  statementDate?: string;
}

export function buildSupplierStatementFilename(supplierName: string, dateStr?: string): string {
  const sanitized = supplierName
    .trim()
    .replace(/[\/\\:*?"<>|]/g, '')
    .replace(/\s+/g, '-');
  const date = dateStr || new Date().toISOString().slice(0, 10);
  return `Supplier-Summary-${sanitized || 'Supplier'}-${date}.pdf`;
}

export async function downloadSupplierStatementPdf({
  supplierId,
  supplierName,
  params,
}: {
  supplierId: string;
  supplierName: string;
  params?: SupplierStatementFilterParams;
}): Promise<void> {
  const toastId = toast.loading('Generating supplier statement PDF...');
  try {
    const response = await apiClient.get<Blob>(
      `/api/v1/suppliers/${supplierId}/statement/pdf`,
      {
        params,
        responseType: 'blob',
      }
    );

    const blob = new Blob([response.data], { type: 'application/pdf' });
    const blobUrl = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = blobUrl;
    link.download = buildSupplierStatementFilename(supplierName, params?.statementDate || params?.endDate);
    document.body.appendChild(link);
    link.click();

    document.body.removeChild(link);
    window.URL.revokeObjectURL(blobUrl);

    toast.success('Supplier statement downloaded', { id: toastId });
  } catch (error: unknown) {
    const apiErr = typeof getApiError === 'function' ? getApiError(error) : undefined;
    toast.error(apiErr?.message || 'Failed to download statement PDF', { id: toastId });
    throw error;
  }
}

export async function printSupplierStatement({
  supplierId,
  params,
}: {
  supplierId: string;
  params?: SupplierStatementFilterParams;
}): Promise<void> {
  const toastId = toast.loading('Preparing statement for printing...');
  try {
    const response = await apiClient.get<Blob>(
      `/api/v1/suppliers/${supplierId}/statement/pdf`,
      {
        params,
        responseType: 'blob',
      }
    );

    const blob = new Blob([response.data], { type: 'application/pdf' });
    const blobUrl = window.URL.createObjectURL(blob);

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
        window.open(blobUrl, '_blank');
        toast.success('Opened statement in new tab for printing', { id: toastId });
        setTimeout(cleanup, 120000);
      }
    };

    setTimeout(() => {
      if (!hasPrinted) {
        window.open(blobUrl, '_blank');
        toast.dismiss(toastId);
        setTimeout(cleanup, 120000);
      }
    }, 4000);
  } catch (error: unknown) {
    const apiErr = typeof getApiError === 'function' ? getApiError(error) : undefined;
    toast.error(apiErr?.message || 'Failed to print statement', { id: toastId });
    throw error;
  }
}
