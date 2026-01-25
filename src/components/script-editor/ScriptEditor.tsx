'use client';

import { useCallback, useRef, useMemo, useEffect, useState } from 'react';
import { TranscriptWord } from '@/lib/types/composition';
import { WordSpan } from './WordSpan';
import { useScriptEditor } from './useScriptEditor';

interface ScriptEditorProps {
  words: TranscriptWord[];
  currentTime: number;  // seconds
  onWordClick: (word: TranscriptWord) => void;
  onDeletedWordsChange?: (deletedWordIds: Set<string>) => void;
}

/**
 * Descript-style transcript editor with word-level editing
 * Click to seek, select + Delete to remove, Cmd+Z to undo
 * Click and drag to select multiple words
 */
export function ScriptEditor({
  words,
  currentTime,
  onWordClick,
  onDeletedWordsChange,
}: ScriptEditorProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const lastSelectedWordId = useRef<string | null>(null);

  // Drag selection state
  const [isDragging, setIsDragging] = useState(false);
  const dragStartWordId = useRef<string | null>(null);

  const {
    deletedWordIds,
    selectedWordIds,
    toggleWordSelection,
    selectWordRange,
    clearSelection,
    undo,
    redo,
    canUndo,
    canRedo,
    restoreWord,
    restoreAll,
  } = useScriptEditor({
    onDeleteWords: () => {
      // Notify parent when words are deleted
      if (onDeletedWordsChange) {
        onDeletedWordsChange(deletedWordIds);
      }
    },
  });

  // Notify parent of deleted word changes
  useEffect(() => {
    if (onDeletedWordsChange) {
      onDeletedWordsChange(deletedWordIds);
    }
  }, [deletedWordIds, onDeletedWordsChange]);

  // Find the currently active word based on playback time
  const activeWordId = useMemo(() => {
    const activeWord = words.find(
      w => currentTime >= w.start && currentTime < w.end
    );
    return activeWord?.id || null;
  }, [words, currentTime]);

  // All word IDs for range selection
  const allWordIds = useMemo(() => words.map(w => w.id), [words]);

  // Handle drag start (mouse down on word)
  const handleWordMouseDown = useCallback((word: TranscriptWord, e: React.MouseEvent) => {
    // Don't start drag on deleted words or with modifier keys
    if (deletedWordIds.has(word.id)) return;
    if (e.shiftKey || e.metaKey || e.ctrlKey) return;

    e.preventDefault();
    setIsDragging(true);
    dragStartWordId.current = word.id;
    toggleWordSelection(word.id, false); // Start fresh selection
    lastSelectedWordId.current = word.id;
  }, [deletedWordIds, toggleWordSelection]);

  // Handle drag over word (mouse enter while dragging)
  const handleWordMouseEnter = useCallback((word: TranscriptWord) => {
    if (!isDragging || !dragStartWordId.current) return;
    if (deletedWordIds.has(word.id)) return;

    // Select range from drag start to current word
    selectWordRange(dragStartWordId.current, word.id, allWordIds);
  }, [isDragging, deletedWordIds, selectWordRange, allWordIds]);

  // Handle drag end (mouse up)
  useEffect(() => {
    const handleMouseUp = () => {
      if (isDragging) {
        setIsDragging(false);
        dragStartWordId.current = null;
      }
    };

    document.addEventListener('mouseup', handleMouseUp);
    return () => document.removeEventListener('mouseup', handleMouseUp);
  }, [isDragging]);

  // Handle word click (for seeking and other interactions)
  const handleWordClick = useCallback((word: TranscriptWord, e: React.MouseEvent) => {
    e.stopPropagation();

    if (e.shiftKey && lastSelectedWordId.current) {
      // Shift-click: select range
      selectWordRange(lastSelectedWordId.current, word.id, allWordIds);
    } else if (deletedWordIds.has(word.id)) {
      // Click on deleted word: restore it
      restoreWord(word.id);
    } else if (!isDragging) {
      // Normal click (not from drag): seek to word
      onWordClick(word);
      // Only toggle if using Cmd/Ctrl, otherwise selection is handled by drag
      if (e.metaKey || e.ctrlKey) {
        toggleWordSelection(word.id, true);
      }
    }

    lastSelectedWordId.current = word.id;
  }, [allWordIds, deletedWordIds, isDragging, onWordClick, restoreWord, selectWordRange, toggleWordSelection]);

  // Handle container click to clear selection
  const handleContainerClick = useCallback((e: React.MouseEvent) => {
    if (e.target === containerRef.current) {
      clearSelection();
    }
  }, [clearSelection]);

  // Format time as mm:ss
  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  if (words.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6">
        <div className="w-16 h-16 rounded-full bg-[#181818] flex items-center justify-center mb-5">
          <svg className="w-7 h-7 text-[#636366]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
          </svg>
        </div>
        <p className="text-white font-medium mb-2">No transcript yet</p>
        <p className="text-[#636366] text-sm leading-relaxed">
          Click &quot;Generate Transcript&quot; to extract speech from your clips
        </p>
      </div>
    );
  }

  const deletedCount = deletedWordIds.size;

  return (
    <div className="flex flex-col h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        {deletedCount > 0 && (
          <button
            onClick={restoreAll}
            className="btn-secondary text-xs py-1.5 px-3"
          >
            Restore All ({deletedCount})
          </button>
        )}
        <button
          onClick={undo}
          disabled={!canUndo}
          className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-30"
          title="Undo (Cmd+Z)"
        >
          Undo
        </button>
        <button
          onClick={redo}
          disabled={!canRedo}
          className="btn-secondary text-xs py-1.5 px-3 disabled:opacity-30"
          title="Redo (Cmd+Shift+Z)"
        >
          Redo
        </button>
        {selectedWordIds.size > 0 && (
          <span className="text-xs text-[#636366] ml-2">
            {selectedWordIds.size} word{selectedWordIds.size > 1 ? 's' : ''} selected
          </span>
        )}
      </div>

      {/* Transcript content */}
      <div
        ref={containerRef}
        className={`flex-1 overflow-y-auto px-1 ${isDragging ? 'select-none cursor-default' : ''}`}
        onClick={handleContainerClick}
      >
        <div className="leading-relaxed text-base space-y-0.5">
          {words.map((word, i) => (
            <span key={word.id}>
              {/* Add timestamp markers at intervals */}
              {i === 0 || (i > 0 && word.start - words[i - 1].end > 1) ? (
                <span className="block text-[10px] text-[#4A8FE7] font-medium mt-3 mb-1 first:mt-0">
                  {formatTime(word.start)}
                </span>
              ) : null}
              <WordSpan
                id={word.id}
                text={word.text}
                isDeleted={deletedWordIds.has(word.id)}
                isActive={word.id === activeWordId}
                isSelected={selectedWordIds.has(word.id)}
                onClick={(e) => handleWordClick(word, e)}
                onMouseDown={(e) => handleWordMouseDown(word, e)}
                onMouseEnter={() => handleWordMouseEnter(word)}
              />
              {/* Add space between words */}
              {i < words.length - 1 && ' '}
            </span>
          ))}
        </div>
      </div>
    </div>
  );
}
