import React, { useState, useRef, useEffect, useMemo, useCallback } from "react";

export interface SelectableItem {
    id: string;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    [key: string]: any;
}

interface SelectableListProps<T extends SelectableItem> {
    items: T[];
    selectedIds: string[];
    onSelectionChange: (selectedIds: string[]) => void;
    renderItem: (item: T, isSelected: boolean) => React.ReactNode;
    rowClassName?: string;
    containerClassName?: string;
}

// 1. Memoized Row Component to prevent full list re-renders
const SelectableRow = React.memo(({
    item,
    isSelected,
    index,
    onMouseDown,
    onMouseEnter,
    renderItem,
    className
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
}: any) => {
    return (
        <div
            className={`${className} select-none ${isSelected ? "bg-primary/10 border-primary/30 hover:bg-primary/20" : "hover:bg-gray-100 hover:border-gray-200"}`}
            onMouseDown={(e) => onMouseDown(e, item.id, index)}
            onMouseEnter={() => onMouseEnter(item.id, index)}
        >
            {renderItem(item, isSelected)}
        </div>
    );
});

export default function SelectableList<T extends SelectableItem>({
    items,
    selectedIds,
    onSelectionChange,
    renderItem,
    rowClassName = "p-2 rounded-lg transition-colors border border-transparent cursor-pointer",
    containerClassName = "space-y-3",
}: SelectableListProps<T>) {
    const [isSelecting, setIsSelecting] = useState(false);
    const lastSelectedIndex = useRef<number | null>(null);

    // 2. Convert array to Set for O(1) lookups during render
    const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

    const handleMouseDown = useCallback((e: React.MouseEvent, itemId: string, index: number) => {
        if ((e.target as HTMLElement).closest("[data-no-select]")) return;

        const isMultiSelect = e.ctrlKey || e.metaKey;
        const isRangeSelect = e.shiftKey;
        let newSelection: string[];

        if (isRangeSelect && lastSelectedIndex.current !== null) {
            const start = Math.min(lastSelectedIndex.current, index);
            const end = Math.max(lastSelectedIndex.current, index);
            const rangeIds = items.slice(start, end + 1).map(i => i.id);
            // Combine range with existing selection
            newSelection = Array.from(new Set([...selectedIds, ...rangeIds]));
        } else if (isMultiSelect) {
            const nextSet = new Set(selectedIds);
            if (nextSet.has(itemId)) nextSet.delete(itemId);
            else nextSet.add(itemId);
            newSelection = Array.from(nextSet);
            lastSelectedIndex.current = index;
        } else {
            // Toggle logic for single click: if already selected and alone, deselect. Otherwise, select only this.
            newSelection = (selectedIds.length === 1 && selectedIds[0] === itemId) ? [] : [itemId];
            lastSelectedIndex.current = index;
        }

        onSelectionChange(newSelection);
        setIsSelecting(true);
    }, [items, selectedIds, onSelectionChange]);

    const handleMouseEnter = useCallback((_itemId: string, index: number) => {
        if (!isSelecting || lastSelectedIndex.current === null) return;

        const start = Math.min(lastSelectedIndex.current, index);
        const end = Math.max(lastSelectedIndex.current, index);
        const rangeIds = items.slice(start, end + 1).map(i => i.id);

        // Use a Set to avoid duplicates while dragging
        onSelectionChange(Array.from(new Set([...selectedIds, ...rangeIds])));
    }, [isSelecting, items, selectedIds, onSelectionChange]);

    useEffect(() => {
        const handleMouseUp = () => setIsSelecting(false);
        window.addEventListener("mouseup", handleMouseUp);
        return () => window.removeEventListener("mouseup", handleMouseUp);
    }, []);

    return (
        <div className={containerClassName}>
            {items.map((item, index) => (
                <SelectableRow
                    key={item.id}
                    item={item}
                    index={index}
                    isSelected={selectedSet.has(item.id)}
                    className={rowClassName}
                    onMouseDown={handleMouseDown}
                    onMouseEnter={handleMouseEnter}
                    renderItem={renderItem}
                />
            ))}
        </div>
    );
}