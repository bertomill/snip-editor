'use client';

import React, { useState, useRef, useMemo } from 'react';
import { useMediaLibrary } from '@/contexts/MediaLibraryContext';
import { MediaType, MediaFile } from '@/types/media';
import { useUser } from '@/lib/supabase/hooks';

type TabType = 'all' | MediaType;

interface MediaLibraryPanelProps {
  isOpen: boolean;
  onClose: () => void;
  onSelectMedia?: (file: MediaFile) => void;
}

export function MediaLibraryPanel({ isOpen, onClose, onSelectMedia }: MediaLibraryPanelProps) {
  const { user } = useUser();
  const { mediaFiles, isLoading, error, uploadMedia, deleteMedia, refreshMedia } = useMediaLibrary();
  const [activeTab, setActiveTab] = useState<TabType>('all');
  const [uploadProgress, setUploadProgress] = useState(false);
  const [previewFile, setPreviewFile] = useState<MediaFile | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<MediaFile | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Filter media based on active tab
  const filteredMedia = useMemo(() => {
    if (activeTab === 'all') return mediaFiles;
    return mediaFiles.filter(file => file.type === activeTab);
  }, [mediaFiles, activeTab]);

  // Count by type
  const counts = useMemo(() => ({
    all: mediaFiles.length,
    video: mediaFiles.filter(f => f.type === 'video').length,
    image: mediaFiles.filter(f => f.type === 'image').length,
    audio: mediaFiles.filter(f => f.type === 'audio').length,
  }), [mediaFiles]);

  const handleUploadClick = () => {
    fileInputRef.current?.click();
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setUploadProgress(true);

    for (const file of Array.from(files)) {
      await uploadMedia(file);
    }

    setUploadProgress(false);

    // Reset input
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleDeleteClick = (file: MediaFile) => {
    setDeleteTarget(file);
  };

  const handleDeleteConfirm = async () => {
    if (!deleteTarget) return;

    setIsDeleting(true);
    await deleteMedia(deleteTarget.id);
    setIsDeleting(false);
    setDeleteTarget(null);
  };

  const handleDeleteCancel = () => {
    setDeleteTarget(null);
  };

  const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  const formatDuration = (seconds?: number): string => {
    if (!seconds) return '';
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/50 z-40"
        onClick={onClose}
      />

      {/* Panel */}
      <div className="fixed left-[72px] top-0 bottom-0 w-80 bg-[#0F0F0F] border-r border-[#2A2A2A] z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#2A2A2A]">
          <h2 className="text-white font-semibold">Uploads</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Upload Section */}
        <div className="p-4 border-b border-[#2A2A2A]">
          <div className="flex items-center justify-between mb-3">
            <span className="text-sm text-gray-400">Saved Uploads</span>
            <button
              onClick={handleUploadClick}
              disabled={uploadProgress || !user}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-[#4A8FE7] text-white text-sm rounded-lg hover:bg-[#3A7FD7] transition-colors disabled:opacity-50"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12" />
              </svg>
              Upload
            </button>
            <input
              ref={fileInputRef}
              type="file"
              accept="video/*,image/*,audio/*"
              multiple
              className="hidden"
              onChange={handleFileChange}
            />
          </div>

          {/* Tabs */}
          <div className="flex gap-1">
            {(['all', 'image', 'video', 'audio'] as TabType[]).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`px-3 py-1.5 text-xs rounded-lg transition-colors ${
                  activeTab === tab
                    ? 'bg-[#2A2A2A] text-white'
                    : 'text-gray-400 hover:text-white hover:bg-[#1A1A1A]'
                }`}
              >
                {tab === 'all' ? 'All' : tab.charAt(0).toUpperCase() + tab.slice(1)}
                <span className="ml-1 text-gray-500">({counts[tab]})</span>
              </button>
            ))}
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-4">
          {!user ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-12 h-12 rounded-full bg-[#1A1A1A] flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                </svg>
              </div>
              <p className="text-white text-sm font-medium mb-1">Sign in required</p>
              <p className="text-gray-500 text-xs">Log in to upload and manage your media</p>
            </div>
          ) : isLoading ? (
            <div className="flex items-center justify-center h-32">
              <div className="w-8 h-8 border-2 border-[#4A8FE7] border-t-transparent rounded-full animate-spin" />
            </div>
          ) : uploadProgress ? (
            <div className="flex flex-col items-center justify-center h-32">
              <div className="w-8 h-8 border-2 border-[#4A8FE7] border-t-transparent rounded-full animate-spin mb-2" />
              <p className="text-gray-400 text-sm">Uploading...</p>
            </div>
          ) : error ? (
            <div className="text-center py-8">
              <p className="text-red-400 text-sm mb-2">{error}</p>
              <button
                onClick={refreshMedia}
                className="text-[#4A8FE7] text-sm hover:underline"
              >
                Try again
              </button>
            </div>
          ) : filteredMedia.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full text-center px-4">
              <div className="w-12 h-12 rounded-full bg-[#1A1A1A] flex items-center justify-center mb-3">
                <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
              <p className="text-white text-sm font-medium mb-1">No uploads yet</p>
              <p className="text-gray-500 text-xs">Click Upload to add media files</p>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-3">
              {filteredMedia.map((file) => (
                <MediaItem
                  key={file.id}
                  file={file}
                  onSelect={() => {
                    setPreviewFile(file);
                  }}
                  onDelete={() => handleDeleteClick(file)}
                  formatFileSize={formatFileSize}
                  formatDuration={formatDuration}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Preview Modal */}
      {previewFile && (
        <MediaPreviewModal
          file={previewFile}
          onClose={() => setPreviewFile(null)}
          onAdd={onSelectMedia ? () => {
            onSelectMedia(previewFile);
            setPreviewFile(null);
          } : undefined}
        />
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <DeleteConfirmModal
          file={deleteTarget}
          isDeleting={isDeleting}
          onConfirm={handleDeleteConfirm}
          onCancel={handleDeleteCancel}
        />
      )}
    </>
  );
}

// Media Item Component
function MediaItem({
  file,
  onSelect,
  onDelete,
  formatFileSize,
  formatDuration,
}: {
  file: MediaFile;
  onSelect: () => void;
  onDelete: () => void;
  formatFileSize: (bytes: number) => string;
  formatDuration: (seconds?: number) => string;
}) {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);
  const [videoLoaded, setVideoLoaded] = useState(false);

  return (
    <div
      className="group relative bg-[#1A1A1A] rounded-lg overflow-hidden cursor-pointer hover:ring-2 hover:ring-[#4A8FE7]/50 transition-all"
      onClick={onSelect}
    >
      {/* Thumbnail */}
      <div className="aspect-video bg-[#0A0A0A] relative">
        {file.type === 'video' ? (
          <>
            {!videoLoaded && (
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M15 10l4.553-2.276A1 1 0 0121 8.618v6.764a1 1 0 01-1.447.894L15 14M5 18h8a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v8a2 2 0 002 2z" />
                </svg>
              </div>
            )}
            <video
              src={file.url}
              className={`w-full h-full object-cover ${videoLoaded ? 'opacity-100' : 'opacity-0'}`}
              muted
              preload="metadata"
              onLoadedData={() => setVideoLoaded(true)}
              onError={() => setVideoLoaded(false)}
            />
          </>
        ) : file.type === 'image' ? (
          <>
            {!imageLoaded && !imageError && (
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
              </div>
            )}
            {imageError && (
              <div className="absolute inset-0 flex items-center justify-center">
                <svg className="w-8 h-8 text-gray-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={file.url}
              alt={file.name}
              className={`w-full h-full object-cover transition-opacity ${imageLoaded ? 'opacity-100' : 'opacity-0'}`}
              onLoad={() => setImageLoaded(true)}
              onError={() => {
                setImageError(true);
                setImageLoaded(false);
              }}
            />
          </>
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <svg className="w-8 h-8 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19V6l12-3v13M9 19c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zm12-3c0 1.105-1.343 2-3 2s-3-.895-3-2 1.343-2 3-2 3 .895 3 2zM9 10l12-3" />
            </svg>
          </div>
        )}

        {/* Duration badge for video/audio */}
        {file.duration && (
          <div className="absolute bottom-1 right-1 bg-black/70 px-1.5 py-0.5 rounded text-[10px] text-white">
            {formatDuration(file.duration)}
          </div>
        )}

        {/* Delete button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDelete();
          }}
          className="absolute top-1 right-1 w-6 h-6 bg-black/70 rounded-full flex items-center justify-center text-gray-400 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>

      {/* Info */}
      <div className="p-2">
        <p className="text-white text-xs truncate">{file.name}</p>
        <p className="text-gray-500 text-[10px]">{formatFileSize(file.size)}</p>
      </div>
    </div>
  );
}

// Preview Modal
function MediaPreviewModal({
  file,
  onClose,
  onAdd,
}: {
  file: MediaFile;
  onClose: () => void;
  onAdd?: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80" onClick={onClose} />

      <div className="relative bg-[#1A1A1A] rounded-xl max-w-2xl w-full max-h-[80vh] overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-[#2A2A2A]">
          <h3 className="text-white font-medium truncate">{file.name}</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Media Preview */}
        <div className="aspect-video bg-black">
          {file.type === 'video' ? (
            <video
              src={file.url}
              controls
              className="w-full h-full"
            />
          ) : file.type === 'image' ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={file.url}
              alt={file.name}
              className="w-full h-full object-contain"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center">
              <audio src={file.url} controls />
            </div>
          )}
        </div>

        {/* Footer */}
        {onAdd && (
          <div className="p-4 border-t border-[#2A2A2A]">
            <button
              onClick={onAdd}
              className="w-full py-2.5 bg-[#4A8FE7] text-white rounded-lg hover:bg-[#3A7FD7] transition-colors text-sm font-medium"
            >
              Add to Timeline
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Delete Confirmation Modal
function DeleteConfirmModal({
  file,
  isDeleting,
  onConfirm,
  onCancel,
}: {
  file: MediaFile;
  isDeleting: boolean;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/80" onClick={isDeleting ? undefined : onCancel} />

      <div className="relative bg-[#1A1A1A] rounded-xl w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-200">
        {/* Icon */}
        <div className="pt-6 pb-4 flex justify-center">
          <div className="w-14 h-14 rounded-full bg-red-500/15 flex items-center justify-center">
            <svg className="w-7 h-7 text-red-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 pb-4 text-center">
          <h3 className="text-white font-semibold text-lg mb-2">Delete file?</h3>
          <p className="text-gray-400 text-sm mb-1">
            Are you sure you want to delete
          </p>
          <p className="text-white text-sm font-medium truncate px-4">
            &quot;{file.name}&quot;
          </p>
          <p className="text-gray-500 text-xs mt-2">
            This action cannot be undone.
          </p>
        </div>

        {/* Actions */}
        <div className="px-6 pb-6 flex gap-3">
          <button
            onClick={onCancel}
            disabled={isDeleting}
            className="flex-1 py-2.5 bg-[#2A2A2A] text-white rounded-lg hover:bg-[#3A3A3A] transition-colors text-sm font-medium disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            onClick={onConfirm}
            disabled={isDeleting}
            className="flex-1 py-2.5 bg-red-500 text-white rounded-lg hover:bg-red-600 transition-colors text-sm font-medium disabled:opacity-50 flex items-center justify-center gap-2"
          >
            {isDeleting ? (
              <>
                <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                Deleting...
              </>
            ) : (
              'Delete'
            )}
          </button>
        </div>
      </div>
    </div>
  );
}

export default MediaLibraryPanel;
