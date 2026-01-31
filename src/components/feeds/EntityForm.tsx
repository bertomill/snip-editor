'use client';

import { useState, useEffect } from 'react';
import { Entity, EntityType, CreateEntityInput } from '@/types/feeds';

interface EntityFormProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (data: CreateEntityInput) => Promise<void>;
  entity?: Entity | null;
}

export function EntityForm({ isOpen, onClose, onSubmit, entity }: EntityFormProps) {
  const [name, setName] = useState('');
  const [type, setType] = useState<EntityType>('person');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const isEditing = !!entity;

  useEffect(() => {
    if (entity) {
      setName(entity.name);
      setType(entity.type);
    } else {
      setName('');
      setType('person');
    }
  }, [entity, isOpen]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || isSubmitting) return;

    setIsSubmitting(true);
    try {
      await onSubmit({ name: name.trim(), type });
      onClose();
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!isOpen) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100]" onClick={onClose} />

      {/* Modal */}
      <div className="fixed inset-0 z-[101] flex items-center justify-center p-4" onClick={onClose}>
        <div
          className="w-full max-w-sm bg-[#1C1C1E] rounded-2xl shadow-2xl overflow-hidden animate-scale-in"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#2C2C2E]">
            <h2 className="text-lg font-semibold text-white">
              {isEditing ? 'Edit Account' : 'Add Account'}
            </h2>
            <button onClick={onClose} className="p-1.5 hover:bg-white/10 rounded-lg transition-colors">
              <svg className="w-5 h-5 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          <form onSubmit={handleSubmit}>
            <div className="p-5 space-y-4">
              {/* Type Selection */}
              <div>
                <label className="block text-xs text-[#8E8E93] mb-2">Type</label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setType('person')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-all ${
                      type === 'person'
                        ? 'bg-[#8B5CF6] text-white'
                        : 'bg-[#2C2C2E] text-[#8E8E93] hover:bg-[#3C3C3E]'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                    </svg>
                    Person
                  </button>
                  <button
                    type="button"
                    onClick={() => setType('company')}
                    className={`flex-1 flex items-center justify-center gap-2 py-3 rounded-lg text-sm font-medium transition-all ${
                      type === 'company'
                        ? 'bg-[#4A8FE7] text-white'
                        : 'bg-[#2C2C2E] text-[#8E8E93] hover:bg-[#3C3C3E]'
                    }`}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                    </svg>
                    Company
                  </button>
                </div>
              </div>

              {/* Name Input */}
              <div>
                <label className="block text-xs text-[#8E8E93] mb-2">Name *</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={type === 'person' ? 'e.g., John Doe' : 'e.g., Acme Corp'}
                  maxLength={100}
                  className="w-full bg-[#2C2C2E] border border-[#3C3C3E] rounded-lg px-4 py-3 text-sm text-white placeholder:text-[#636366] focus:outline-none focus:border-[#10B981] transition-colors"
                  autoFocus
                />
              </div>
            </div>

            {/* Footer */}
            <div className="px-5 py-4 border-t border-[#2C2C2E] flex justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg text-sm font-medium text-[#8E8E93] hover:bg-[#2C2C2E] transition-colors"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={!name.trim() || isSubmitting}
                className="px-4 py-2 rounded-lg text-sm font-medium bg-[#10B981] text-white hover:bg-[#059669] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {isSubmitting ? 'Saving...' : isEditing ? 'Save' : 'Add'}
              </button>
            </div>
          </form>
        </div>
      </div>
    </>
  );
}
