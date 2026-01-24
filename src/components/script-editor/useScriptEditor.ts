import { useState, useCallback, useEffect } from 'react';

interface UseScriptEditorOptions {
  onDeleteWords?: (wordIds: string[]) => void;
}

interface UseScriptEditorReturn {
  deletedWordIds: Set<string>;
  selectedWordIds: Set<string>;
  deleteSelectedWords: () => void;
  toggleWordSelection: (wordId: string, shiftKey?: boolean) => void;
  selectWordRange: (startId: string, endId: string, allWordIds: string[]) => void;
  clearSelection: () => void;
  undo: () => void;
  redo: () => void;
  canUndo: boolean;
  canRedo: boolean;
  restoreWord: (wordId: string) => void;
  restoreAll: () => void;
}

/**
 * Hook for managing script editor state with undo/redo support
 */
export function useScriptEditor(options: UseScriptEditorOptions = {}): UseScriptEditorReturn {
  const [deletedWordIds, setDeletedWordIds] = useState<Set<string>>(new Set());
  const [selectedWordIds, setSelectedWordIds] = useState<Set<string>>(new Set());
  const [undoStack, setUndoStack] = useState<Set<string>[]>([]);
  const [redoStack, setRedoStack] = useState<Set<string>[]>([]);

  // Delete selected words
  const deleteSelectedWords = useCallback(() => {
    if (selectedWordIds.size === 0) return;

    // Save current state to undo stack
    setUndoStack(prev => [...prev, new Set(deletedWordIds)]);
    setRedoStack([]);

    // Add selected words to deleted set
    setDeletedWordIds(prev => {
      const next = new Set(prev);
      selectedWordIds.forEach(id => next.add(id));
      return next;
    });

    // Notify parent
    if (options.onDeleteWords) {
      options.onDeleteWords(Array.from(selectedWordIds));
    }

    // Clear selection
    setSelectedWordIds(new Set());
  }, [selectedWordIds, deletedWordIds, options]);

  // Toggle single word selection
  const toggleWordSelection = useCallback((wordId: string, shiftKey = false) => {
    setSelectedWordIds(prev => {
      const next = new Set(shiftKey ? prev : []);
      if (prev.has(wordId) && !shiftKey) {
        next.delete(wordId);
      } else {
        next.add(wordId);
      }
      return next;
    });
  }, []);

  // Select a range of words
  const selectWordRange = useCallback((startId: string, endId: string, allWordIds: string[]) => {
    const startIndex = allWordIds.indexOf(startId);
    const endIndex = allWordIds.indexOf(endId);

    if (startIndex === -1 || endIndex === -1) return;

    const minIndex = Math.min(startIndex, endIndex);
    const maxIndex = Math.max(startIndex, endIndex);

    setSelectedWordIds(new Set(allWordIds.slice(minIndex, maxIndex + 1)));
  }, []);

  // Clear selection
  const clearSelection = useCallback(() => {
    setSelectedWordIds(new Set());
  }, []);

  // Undo
  const undo = useCallback(() => {
    if (undoStack.length === 0) return;

    const previousState = undoStack[undoStack.length - 1];
    setRedoStack(prev => [...prev, new Set(deletedWordIds)]);
    setUndoStack(prev => prev.slice(0, -1));
    setDeletedWordIds(previousState);
  }, [undoStack, deletedWordIds]);

  // Redo
  const redo = useCallback(() => {
    if (redoStack.length === 0) return;

    const nextState = redoStack[redoStack.length - 1];
    setUndoStack(prev => [...prev, new Set(deletedWordIds)]);
    setRedoStack(prev => prev.slice(0, -1));
    setDeletedWordIds(nextState);
  }, [redoStack, deletedWordIds]);

  // Restore single word
  const restoreWord = useCallback((wordId: string) => {
    setUndoStack(prev => [...prev, new Set(deletedWordIds)]);
    setRedoStack([]);
    setDeletedWordIds(prev => {
      const next = new Set(prev);
      next.delete(wordId);
      return next;
    });
  }, [deletedWordIds]);

  // Restore all words
  const restoreAll = useCallback(() => {
    if (deletedWordIds.size === 0) return;
    setUndoStack(prev => [...prev, new Set(deletedWordIds)]);
    setRedoStack([]);
    setDeletedWordIds(new Set());
  }, [deletedWordIds]);

  // Keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Delete/Backspace - delete selected words
      if ((e.key === 'Delete' || e.key === 'Backspace') && selectedWordIds.size > 0) {
        // Only prevent if we have selection
        e.preventDefault();
        deleteSelectedWords();
      }

      // Cmd+Z - Undo
      if ((e.metaKey || e.ctrlKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault();
        undo();
      }

      // Cmd+Shift+Z - Redo
      if ((e.metaKey || e.ctrlKey) && e.shiftKey && e.key === 'z') {
        e.preventDefault();
        redo();
      }

      // Escape - clear selection
      if (e.key === 'Escape') {
        clearSelection();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedWordIds, deleteSelectedWords, undo, redo, clearSelection]);

  return {
    deletedWordIds,
    selectedWordIds,
    deleteSelectedWords,
    toggleWordSelection,
    selectWordRange,
    clearSelection,
    undo,
    redo,
    canUndo: undoStack.length > 0,
    canRedo: redoStack.length > 0,
    restoreWord,
    restoreAll,
  };
}
