import React, { useCallback, useState, useRef } from 'react';
import { UploadCloud, X, Loader2, Plus } from 'lucide-react';

interface MultiImageUploadProps {
    value?: string[];
    onChange: (urls: string[]) => void;
    onUpload: (file: File) => Promise<{ url: string }>;
    disabled?: boolean;
    className?: string;
}

export function MultiImageUpload({ value = [], onChange, onUpload, disabled, className = '' }: MultiImageUploadProps) {
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
                    if (!ctx) return reject('Failed to get canvas context');

                    const MAX_WIDTH = 1024;
                    const MAX_HEIGHT = 1024;
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

                    canvas.width = width;
                    canvas.height = height;
                    ctx.drawImage(img, 0, 0, width, height);

                    canvas.toBlob(
                        (blob) => {
                            if (!blob) return reject('Failed to compress image');
                            const compressedFile = new File([blob], file.name.replace(/\.[^/.]+$/, "") + ".jpg", {
                                type: 'image/jpeg',
                                lastModified: Date.now(),
                            });
                            resolve(compressedFile);
                        },
                        'image/jpeg',
                        0.8
                    );
                };
                img.onerror = (e) => reject(e);
            };
            reader.onerror = (e) => reject(e);
        });
    };

    const handleFiles = async (files: FileList | File[]) => {
        setIsUploading(true);
        try {
            const newUrls: string[] = [];
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                if (!file.type.startsWith('image/')) continue;

                // Compress image client side
                const compressedFile = await compressImage(file);
                const res = await onUpload(compressedFile);
                newUrls.push(res.url);
            }
            if (newUrls.length > 0) {
                onChange([...value, ...newUrls]);
            }
        } catch (error) {
            console.error('Upload failed', error);
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

        if (e.dataTransfer.files?.length) {
            await handleFiles(e.dataTransfer.files);
        }
    }, [disabled, value]);

    const onChangeInput = async (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files?.length) {
            await handleFiles(e.target.files);
            // Reset input so the same files can be selected again if needed
            e.target.value = '';
        }
    };

    const removeImage = (indexToRemove: number) => {
        onChange(value.filter((_, idx) => idx !== indexToRemove));
    };

    return (
        <div className={`w-full ${className}`}>
            {value.length > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3 mb-3">
                    {value.map((url, idx) => (
                        <div key={idx} className="relative group w-full aspect-square rounded-[var(--radius-md)] overflow-hidden border border-[var(--border)] bg-[var(--bg-secondary)] flex items-center justify-center">
                            <img src={url} alt={`Uploaded ${idx + 1}`} className="object-cover w-full h-full" />
                            {idx === 0 && (
                                <div className="absolute top-1 left-1 bg-[var(--gold)] text-black text-[9px] font-bold px-1.5 py-0.5 rounded uppercase tracking-wider shadow-sm z-10">
                                    Primary
                                </div>
                            )}
                            {!disabled && (
                                <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center backdrop-blur-sm">
                                    <button
                                        type="button"
                                        onClick={(e) => { e.preventDefault(); e.stopPropagation(); removeImage(idx); }}
                                        className="p-1.5 bg-[var(--red)] text-white rounded-full hover:scale-110 transition shadow-lg"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            )}
                        </div>
                    ))}
                    {!disabled && (
                        <div
                            onDragOver={onDragOver}
                            onDragLeave={onDragLeave}
                            onDrop={onDrop}
                            onClick={() => !isUploading && fileInputRef.current?.click()}
                            className={`w-full aspect-square rounded-[var(--radius-md)] flex flex-col items-center justify-center gap-1 border-2 border-dashed transition-all cursor-pointer ${isDragging ? 'border-[var(--gold)] bg-[var(--gold)]/5' : 'border-[var(--border)] bg-[var(--bg-secondary)] hover:bg-[var(--bg-card-hover)] hover:border-[var(--border-accent)]'}`}
                        >
                            {isUploading ? (
                                <Loader2 size={24} className="text-[var(--gold)] animate-spin" />
                            ) : (
                                <>
                                    <Plus size={24} className="text-[var(--text-muted)]" />
                                    <span className="text-[10px] text-[var(--text-muted)] mt-1">Add More</span>
                                </>
                            )}
                        </div>
                    )}
                </div>
            )}

            {value.length === 0 && (
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
                                <p className="text-sm font-medium text-[var(--text-primary)]">Drag & drop or Click to upload</p>
                                <p className="text-xs text-[var(--text-muted)] mt-1">Select multiple images (JPEG, PNG, WEBP auto-compressed)</p>
                            </div>
                        </>
                    )}
                </div>
            )}

            <input
                type="file"
                multiple
                ref={fileInputRef}
                onChange={onChangeInput}
                accept="image/jpeg, image/png, image/webp"
                capture="environment"
                className="hidden"
                disabled={disabled || isUploading}
            />
        </div>
    );
}
