import React, { useRef, useState } from 'react';
import { Artwork, ArtworkType, ARTWORK_SPECS } from '../types/artwork';
import { formatArtworkUrl } from '../utils/artwork';
import { ImageIcon } from './icons';

interface ArtworkSlotCardProps {
  type: ArtworkType;
  episodeId: string;
  artwork: Artwork | undefined;
  onUpload: (type: ArtworkType, file: File) => Promise<void>;
  onDeleteRequest: (type: ArtworkType) => void;
  isBusy: boolean;
}

export const ArtworkSlotCard: React.FC<ArtworkSlotCardProps> = ({
  type,
  artwork,
  onUpload,
  onDeleteRequest,
  isBusy,
}) => {
  const spec = ARTWORK_SPECS[type];
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [clientError, setClientError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    setClientError(null);
    const file = e.target.files?.[0];
    if (!file) return;

    // Reset input so re-selecting the same file also triggers onChange
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }

    // Client-side format validation
    const validMimes = ['image/jpeg', 'image/png', 'image/webp'];
    if (!validMimes.includes(file.type)) {
      setClientError('Invalid file type. Only JPEG, PNG, and WebP are supported.');
      return;
    }

    // Client-side size validation
    if (file.size > spec.maxSizeBytes) {
      setClientError(
        `File is too large (${(file.size / 1024).toFixed(1)} KB). Maximum allowed is ${(
          spec.maxSizeBytes / 1024
        ).toFixed(0)} KB.`
      );
      return;
    }

    // Start auto-upload immediately
    setIsSubmitting(true);
    try {
      await onUpload(type, file);
      setClientError(null);
    } catch (err: unknown) {
      const msg =
        (err as any)?.data?.detail ||
        (err as any)?.message ||
        'Failed to upload artwork.';
      setClientError(typeof msg === 'string' ? msg : JSON.stringify(msg));
    } finally {
      setIsSubmitting(false);
    }
  };

  const formatFileSize = (bytes: number | null | undefined) => {
    if (bytes === null || bytes === undefined) return '—';
    return `${(bytes / 1024).toFixed(1)} KB`;
  };

  const isUploaded = Boolean(artwork);
  const inProgress = isBusy || isSubmitting;

  return (
    <div
      className={`flex flex-col bg-slate-900/90 border ${
        isUploaded ? 'border-emerald-500/30' : 'border-slate-800'
      } rounded-2xl p-5 shadow-lg relative overflow-hidden`}
      data-testid={`artwork-slot-${type}`}
    >
      <div className="flex items-start justify-between gap-2 mb-3">
        <div>
          <h4 className="text-base font-bold text-white tracking-tight">{spec.label}</h4>
          <span className="inline-block mt-0.5 text-xs text-slate-400 font-mono">
            {spec.width} &times; {spec.height} ({spec.aspectRatio}) &bull; max 200 KB
          </span>
        </div>
        {inProgress ? (
          <span
            className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-indigo-500/10 border border-indigo-500/30 text-indigo-400 uppercase tracking-wide"
            data-testid={`artwork-status-${type}`}
          >
            <span className="w-2 h-2 rounded-full bg-indigo-400 animate-ping" />
            Uploading...
          </span>
        ) : isUploaded ? (
          <span
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 uppercase tracking-wide"
            data-testid={`artwork-status-${type}`}
          >
            Uploaded
          </span>
        ) : (
          <span
            className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-500/10 border border-amber-500/30 text-amber-400 uppercase tracking-wide"
            data-testid={`artwork-status-${type}`}
          >
            Missing
          </span>
        )}
      </div>

      {/* Preview Area */}
      <div
        className="relative flex-1 min-h-[160px] bg-slate-950/80 border border-slate-800 rounded-xl overflow-hidden flex items-center justify-center p-3 my-2"
        data-testid={`artwork-preview-box-${type}`}
      >
        {inProgress ? (
          <div className="flex flex-col items-center justify-center gap-2 py-6" data-testid={`artwork-uploading-${type}`}>
            <div className="w-7 h-7 border-2 border-indigo-500/20 border-t-indigo-500 rounded-full animate-spin" />
            <p className="text-xs font-medium text-indigo-300">Uploading {spec.label}...</p>
          </div>
        ) : isUploaded && artwork?.file_path ? (
          <div className="flex flex-col items-center justify-center gap-2 w-full p-1" data-testid={`artwork-metadata-${type}`}>
            <img
              src={formatArtworkUrl(artwork.file_path)}
              alt={`${spec.label} preview`}
              className="max-h-[110px] max-w-full object-contain rounded shadow border border-slate-800"
              data-testid={`artwork-preview-${type}`}
            />
            <div className="space-y-0.5 text-center text-xs text-slate-300">
              <p className="text-[11px] text-slate-400">
                {artwork?.width} &times; {artwork?.height} px &bull; {formatFileSize(artwork?.file_size)} &bull; {artwork?.mime_type || 'image'}
              </p>
            </div>
          </div>
        ) : (
          <div className="text-center p-4">
            <ImageIcon className="w-8 h-8 text-slate-600 mx-auto mb-1" />
            <p className="text-xs text-slate-500">No {spec.label.toLowerCase()} uploaded</p>
          </div>
        )}
      </div>

      {/* Client / Backend Validation Warning/Error */}
      {clientError && (
        <div className="mt-2 p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs font-medium" role="alert" data-testid={`client-error-${type}`}>
          {clientError}
        </div>
      )}

      {/* Action Controls */}
      <div className="mt-3 pt-3 border-t border-slate-800/80">
        <input
          type="file"
          ref={fileInputRef}
          onChange={handleFileChange}
          accept="image/jpeg,image/png,image/webp"
          style={{ display: 'none' }}
          disabled={inProgress}
          data-testid={`file-input-${type}`}
        />

        <div className="flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={`flex-1 px-3 py-2 rounded-lg text-xs font-semibold ${
              inProgress
                ? 'bg-indigo-600/30 text-indigo-300 border border-indigo-500/30 cursor-not-allowed'
                : 'text-slate-200 hover:text-white bg-slate-800 hover:bg-slate-700 border border-slate-700/60'
            } transition-colors text-center flex items-center justify-center gap-1.5`}
            disabled={inProgress}
            data-testid={`select-file-btn-${type}`}
          >
            {inProgress ? (
              <>
                <span className="w-3.5 h-3.5 border-2 border-white/20 border-t-white rounded-full animate-spin" />
                Uploading...
              </>
            ) : isUploaded ? (
              'Replace'
            ) : (
              `Upload ${spec.label}`
            )}
          </button>

          {isUploaded && !inProgress && (
            <button
              type="button"
              onClick={() => onDeleteRequest(type)}
              className="px-3 py-2 rounded-lg text-xs font-semibold text-rose-300 hover:text-white bg-rose-500/10 hover:bg-rose-600 border border-rose-500/20 transition-colors"
              disabled={inProgress}
              data-testid={`delete-artwork-btn-${type}`}
            >
              Delete
            </button>
          )}
        </div>
      </div>
    </div>
  );
};
