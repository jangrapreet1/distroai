import React, { useCallback, useState, useRef } from 'react';
import { UploadCloud, X, Image as ImageIcon, Loader2 } from 'lucide-react';
import toast from 'react-hot-toast';

interface ImageUploadProps {
    value?: string;
    onChange: (url: string) => void;
    onUpload: (file: File) => Promise<{ url: string }>;
    disabled?: boolean;
    className?: string;
}

export function ImageUpload({ value, onChange, onUpload, disabled, className = '' }: ImageUploadProps) {
    const [isDragging, setIsDragging] = useState(false);
    const [isUploading, setIsUploading] = useState(false);
    const fileInputRef = useRef<HTMLInputElement>(null);

    // Client-side image compression function
    const compressImage = (file: File): Promise<File> => {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.readAsDataURL(file);
            reader.onload = (event) => {
                const img = new Image();
                img.src = event.target?.result as string;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    const ctx = canvas.getContext('2d');
                    if (!ctx) return reject(new Error('Failed to get canvas context'));

                    const MAX_WIDTH = 1200;
                    const MAX_HEIGHT = 1200;
                    let width = img.width;
                    let height = img.height;

                    if (width > height) {
                        if (width > MAX_WIDTH) {
                            height *= MAX_WIDTH / width;
                            width = MAX_WIDTH;
                        }
                    } else {
                        if (height > MAX_HEIGHT) {
                            width *= MAX_HEIGHT / height;
                            height = MAX_HEIGHT;
                        }
                    }

                    canvas.width = Math.round(width);
                    canvas.height = Math.round(height);

                    const isPng = file.type === 'image/png' || file.name.toLowerCase().endsWith('.png');
                    const isWebp = file.type === 'image/webp' || file.name.toLowerCase().endsWith('.webp');
                    const outputType = isPng ? 'image/png' : isWebp ? 'image/webp' : 'image/jpeg';
                    const outputExt = isPng ? '.png' : isWebp ? '.webp' : '.jpg';
                    const quality = isPng ? undefined : 0.85;

                    // If converting to JPEG, fill canvas with white so transparent PNGs don't turn black
                    if (outputType === 'image/jpeg') {
                        ctx.fillStyle = '#FFFFFF';
                        ctx.fillRect(0, 0, canvas.width, canvas.height);
                    }

                    ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                    canvas.toBlob(
                        (blob) => {
                            if (!blob) return reject(new Error('Failed to compress image'));
                            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + outputExt, {
                                type: outputType,
                                lastModified: Date.now(),
                            });
                            resolve(compressedFile);
                        },
                        outputType,
                        quality
                    );
                };
                img.onerror = (e) => reject(e);
            };
            reader.onerror = (e) => reject(e);
        });
    };

    const handleFile = async (file: File) => {
        if (!file.type.startsWith('image/') && !file.name.match(/\.(jpg|jpeg|png|webp|avif)$/i)) return;
        setIsUploading(true);
        try {
            // Compress image client side with fallback to raw file
            let fileToUpload = file;
            try {
                fileToUpload = await compressImage(file);
            } catch (compressErr) {
                console.warn('Image compression fallback to raw file', compressErr);
            }
            const res = await onUpload(fileToUpload);
            if (res?.url) {
                onChange(res.url);
            }
        } catch (error: any) {
            console.error('Upload failed', error);
            toast.error(error?.message || 'Failed to upload image. Please try again.');
        } finally {
            setIsUploading(false);
        }
    };

    const onDragOver = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        if (!disabled) setIsDragging(true);
    }, [disabled]);

    const onDragLeave = useCallback((e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
    }, []);

    const onDrop = useCallback(async (e: React.DragEvent) => {
        e.preventDefault();
        setIsDragging(false);
        if (disabled) return;

        const file = e.dataTransfer.files?.[0];
        if (file) await handleFile(file);
    }, [disabled]);

    const onChangeInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (file) await handleFile(file);
    };

    return (
        <div className={`w-full ${className}`}>
            {value ? (
                <div className="relative group w-full h-48 rounded-[var(--radius-lg)] overflow-hidden border border-[var(--border)] bg-[var(--bg-secondary)] flex items-center justify-center">
                    <img src={value} alt="Uploaded" className="object-contain w-full h-full" />
                    {!disabled && (
                        <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                            <button
                                type="button"
                                onClick={() => onChange('')}
                                className="p-2 bg-[var(--red)] text-white rounded-full hover:scale-110 transition shadow-lg"
                            >
                                <X size={20} />
                            </button>
                        </div>
                    )}
                </div>
            ) : (
                <div
                    onDragOver={onDragOver}
                    onDragLeave={onDragLeave}
                    onDrop={onDrop}
                    onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
                    className={`
                        w-full h-48 rounded-[var(--radius-lg)] flex flex-col items-center justify-center gap-3
                        border-2 border-dashed transition-all cursor-pointer
                        ${disabled ? 'opacity-50 cursor-not-allowed border-[var(--border)] bg-[var(--bg-card)]' : ''}
                        ${isDragging ? 'border-[var(--gold)] bg-[var(--gold)]/5 scale-[0.99]' : 'border-[var(--border)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-card-hover)] hover:border-[var(--border-accent)]'}
                    `}
                >
                    <input
                        type="file"
                        ref={fileInputRef}
                        onChange={onChangeInput}
                        accept="image/jpeg, image/png, image/webp"
                        className="hidden"
                        disabled={disabled || isUploading}
                    />

                    {isUploading ? (
                        <>
                            <Loader2 size={32} className="text-[var(--gold)] animate-spin" />
                            <div className="text-sm font-medium text-[var(--gold)]">Compressing & Uploading...</div>
                        </>
                    ) : (
                        <>
                            <div className={`p-4 rounded-full ${isDragging ? 'bg-[var(--gold)]/20 text-[var(--gold)]' : 'bg-[var(--bg-primary)] text-[var(--text-muted)] group-hover:text-[var(--gold)]'} transition-colors shadow-sm`}>
                                <UploadCloud size={32} />
                            </div>
                            <div className="text-center">
                                <p className="text-sm font-medium text-[var(--text-primary)]">Drag & drop or click to upload</p>
                                <p className="text-xs text-[var(--text-muted)] mt-1">JPEG, PNG, WEBP up to 10MB (Auto-compressed)</p>
                            </div>
                        </>
                    )}
                </div>
            )}
        </div>
    );
}
