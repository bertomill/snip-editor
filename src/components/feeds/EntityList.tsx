'use client';

import { useState, useRef, useEffect } from 'react';
import { Entity, SocialAccount, SocialPlatform, SOCIAL_PLATFORMS } from '@/types/feeds';

interface EntityListProps {
  entities: Entity[];
  onCreateEntity: () => void;
  onAddSocialAccount: (entityId: string, platform: SocialPlatform) => void;
  onDeleteEntity: (id: string) => void;
  onDeleteSocialAccount: (id: string) => void;
}

export function EntityList({
  entities,
  onCreateEntity,
  onAddSocialAccount,
  onDeleteEntity,
  onDeleteSocialAccount,
}: EntityListProps) {
  const [expandedEntityId, setExpandedEntityId] = useState<string | null>(null);
  const [showPlatformPicker, setShowPlatformPicker] = useState<string | null>(null);
  const [dropdownPosition, setDropdownPosition] = useState<{ top: number; left: number; width: number } | null>(null);
  const buttonRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  const openPlatformPicker = (entityId: string) => {
    const button = buttonRefs.current[entityId];
    if (button) {
      const rect = button.getBoundingClientRect();
      setDropdownPosition({
        top: rect.bottom + 4,
        left: rect.left,
        width: rect.width,
      });
    }
    setShowPlatformPicker(entityId);
  };

  const closePlatformPicker = () => {
    setShowPlatformPicker(null);
    setDropdownPosition(null);
  };

  const getPlatformIcon = (platform: SocialPlatform) => {
    switch (platform) {
      case 'twitter':
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-5.214-6.817L4.99 21.75H1.68l7.73-8.835L1.254 2.25H8.08l4.713 6.231zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
          </svg>
        );
      case 'instagram':
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zm0-2.163c-3.259 0-3.667.014-4.947.072-4.358.2-6.78 2.618-6.98 6.98-.059 1.281-.073 1.689-.073 4.948 0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98 1.281.058 1.689.072 4.948.072 3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98-1.281-.059-1.69-.073-4.949-.073zm0 5.838c-3.403 0-6.162 2.759-6.162 6.162s2.759 6.163 6.162 6.163 6.162-2.759 6.162-6.163c0-3.403-2.759-6.162-6.162-6.162zm0 10.162c-2.209 0-4-1.79-4-4 0-2.209 1.791-4 4-4s4 1.791 4 4c0 2.21-1.791 4-4 4zm6.406-11.845c-.796 0-1.441.645-1.441 1.44s.645 1.44 1.441 1.44c.795 0 1.439-.645 1.439-1.44s-.644-1.44-1.439-1.44z" />
          </svg>
        );
      case 'tiktok':
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z" />
          </svg>
        );
      case 'youtube':
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z" />
          </svg>
        );
      case 'linkedin':
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
          </svg>
        );
      case 'facebook':
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z" />
          </svg>
        );
      case 'threads':
        return (
          <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor">
            <path d="M12.186 24h-.007c-3.581-.024-6.334-1.205-8.184-3.509C2.35 18.44 1.5 15.586 1.472 12.01v-.017c.03-3.579.879-6.43 2.525-8.482C5.845 1.205 8.6.024 12.18 0h.014c2.746.02 5.043.725 6.826 2.098 1.677 1.29 2.858 3.13 3.509 5.467l-2.04.569c-1.104-3.96-3.898-5.984-8.304-6.015-2.91.022-5.11.936-6.54 2.717C4.307 6.504 3.616 8.914 3.589 12c.027 3.086.718 5.496 2.057 7.164 1.43 1.783 3.631 2.698 6.54 2.717 2.623-.02 4.358-.631 5.8-2.045 1.647-1.613 1.618-3.593 1.09-4.798-.31-.71-.873-1.3-1.634-1.75-.192 1.352-.622 2.446-1.284 3.272-.886 1.102-2.14 1.704-3.73 1.79-1.202.065-2.361-.218-3.259-.801-1.063-.689-1.685-1.74-1.752-2.96-.065-1.182.408-2.256 1.332-3.023.88-.73 2.088-1.146 3.396-1.17 1.15-.02 2.218.156 3.168.518-.034-.86-.188-1.593-.46-2.18-.368-.795-.992-1.39-1.854-1.77-.944-.418-2.16-.633-3.617-.64l-.032-2.118c1.777.01 3.32.293 4.583.84 1.187.515 2.092 1.305 2.69 2.35.54.94.853 2.063.93 3.341 1.157.563 2.097 1.323 2.782 2.263.93 1.276 1.295 2.86 1.056 4.58-.317 2.28-1.47 4.093-3.334 5.243C18.04 23.268 15.482 24 12.186 24zm.059-8.118c-.868.017-1.614.207-2.159.55-.49.31-.764.716-.79 1.173-.026.458.185.89.594 1.218.452.362 1.106.563 1.841.526 1.058-.054 1.876-.45 2.433-1.18.39-.51.662-1.172.813-1.975-.851-.241-1.752-.335-2.732-.312z" />
          </svg>
        );
      default:
        return null;
    }
  };

  const getAvailablePlatforms = (entity: Entity) => {
    const existingPlatforms = (entity.socialAccounts || []).map(sa => sa.platform);
    return SOCIAL_PLATFORMS.filter(p => !existingPlatforms.includes(p.id));
  };

  return (
    <div className="space-y-2">
      {/* Section Header */}
      <div className="flex items-center justify-between px-1 mb-3">
        <span className="text-xs font-medium text-[#8E8E93] uppercase tracking-wider">Accounts</span>
        <button
          onClick={onCreateEntity}
          className="p-1 hover:bg-white/10 rounded transition-colors"
          title="Add person or company"
        >
          <svg className="w-4 h-4 text-[#8E8E93]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
        </button>
      </div>

      {entities.length === 0 ? (
        <button
          onClick={onCreateEntity}
          className="w-full p-3 border border-dashed border-[#3C3C3E] rounded-lg text-center hover:border-[#10B981] hover:bg-[#10B981]/5 transition-colors group"
        >
          <div className="w-8 h-8 rounded-full bg-[#2C2C2E] group-hover:bg-[#10B981]/20 flex items-center justify-center mx-auto mb-2">
            <svg className="w-4 h-4 text-[#8E8E93] group-hover:text-[#10B981]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
            </svg>
          </div>
          <p className="text-xs text-[#8E8E93] group-hover:text-[#10B981]">Add person or company</p>
        </button>
      ) : (
        <div className="space-y-1">
          {entities.map((entity) => {
            const isExpanded = expandedEntityId === entity.id;
            const availablePlatforms = getAvailablePlatforms(entity);

            return (
              <div key={entity.id} className="rounded-lg overflow-hidden">
                {/* Entity Header */}
                <button
                  onClick={() => setExpandedEntityId(isExpanded ? null : entity.id)}
                  className="w-full flex items-center gap-3 p-2 hover:bg-white/5 rounded-lg transition-colors group"
                >
                  {/* Avatar */}
                  <div className={`w-8 h-8 rounded-full flex items-center justify-center text-white text-sm font-medium ${
                    entity.type === 'company' ? 'bg-[#4A8FE7]' : 'bg-[#8B5CF6]'
                  }`}>
                    {entity.avatarUrl ? (
                      <img src={entity.avatarUrl} alt={entity.name} className="w-full h-full rounded-full object-cover" />
                    ) : (
                      entity.name.charAt(0).toUpperCase()
                    )}
                  </div>

                  {/* Name and count */}
                  <div className="flex-1 text-left">
                    <p className="text-sm text-white font-medium truncate">{entity.name}</p>
                    <p className="text-[10px] text-[#636366]">
                      {(entity.socialAccounts || []).length} platform{(entity.socialAccounts || []).length !== 1 ? 's' : ''}
                    </p>
                  </div>

                  {/* Expand icon */}
                  <svg
                    className={`w-4 h-4 text-[#636366] transition-transform ${isExpanded ? 'rotate-180' : ''}`}
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                  </svg>
                </button>

                {/* Expanded Content */}
                {isExpanded && (
                  <div className="pl-11 pr-2 pb-2 space-y-1">
                    {/* Social Accounts */}
                    {(entity.socialAccounts || []).map((account) => {
                      const platformConfig = SOCIAL_PLATFORMS.find(p => p.id === account.platform);
                      return (
                        <div
                          key={account.id}
                          className="flex items-center gap-2 p-2 rounded-md bg-[#2C2C2E] group"
                        >
                          <span style={{ color: platformConfig?.color }}>
                            {getPlatformIcon(account.platform)}
                          </span>
                          <span className="flex-1 text-xs text-white truncate">
                            {account.handle || platformConfig?.name}
                          </span>
                          <button
                            onClick={() => onDeleteSocialAccount(account.id)}
                            className="p-1 opacity-0 group-hover:opacity-100 hover:bg-white/10 rounded transition-all"
                          >
                            <svg className="w-3 h-3 text-[#636366]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        </div>
                      );
                    })}

                    {/* Add Platform Button */}
                    {availablePlatforms.length > 0 && (
                      <button
                        ref={(el) => { buttonRefs.current[entity.id] = el; }}
                        onClick={() => showPlatformPicker === entity.id ? closePlatformPicker() : openPlatformPicker(entity.id)}
                        className="w-full flex items-center gap-2 p-2 text-xs text-[#8E8E93] hover:text-white hover:bg-white/5 rounded-md transition-colors"
                      >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        Add platform
                      </button>
                    )}

                    {/* Platform Picker Dropdown - Rendered with fixed positioning */}
                    {showPlatformPicker === entity.id && dropdownPosition && (
                      <>
                        <div
                          className="fixed inset-0 z-[200]"
                          onClick={closePlatformPicker}
                        />
                        <div
                          className="fixed bg-[#2C2C2E] border border-[#3C3C3E] rounded-lg shadow-xl z-[201] overflow-hidden"
                          style={{
                            top: dropdownPosition.top,
                            left: dropdownPosition.left,
                            width: dropdownPosition.width,
                          }}
                        >
                          {availablePlatforms.map((platform) => (
                            <button
                              key={platform.id}
                              onClick={() => {
                                onAddSocialAccount(entity.id, platform.id);
                                closePlatformPicker();
                              }}
                              className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-white/10 transition-colors"
                            >
                              <span style={{ color: platform.color }}>
                                {getPlatformIcon(platform.id)}
                              </span>
                              <span className="text-xs text-white">{platform.name}</span>
                            </button>
                          ))}
                        </div>
                      </>
                    )}

                    {/* Delete Entity */}
                    <button
                      onClick={() => {
                        if (window.confirm(`Delete "${entity.name}" and all their social accounts?`)) {
                          onDeleteEntity(entity.id);
                        }
                      }}
                      className="w-full flex items-center gap-2 p-2 text-xs text-red-400 hover:bg-red-400/10 rounded-md transition-colors mt-2"
                    >
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                      </svg>
                      Remove
                    </button>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
