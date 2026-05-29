import React, { useState, useEffect, useRef } from 'react';

interface VirtualListProps<T> {
  items: T[];
  height: number | string;
  itemHeight: number;
  renderItem: (item: T, index: number) => React.ReactNode;
}

export function VirtualList<T>({
  items,
  height,
  itemHeight,
  renderItem
}: VirtualListProps<T>) {
  const [scrollTop, setScrollTop] = useState(0);
  const containerRef = useRef<HTMLDivElement | null>(null);

  // Keep track of scroll positions
  const handleScroll = (e: React.UIEvent<HTMLDivElement>) => {
    setScrollTop(e.currentTarget.scrollTop);
  };

  const totalHeight = items.length * itemHeight;

  // Resolve pixel container height
  const [clientHeight, setClientHeight] = useState(400);
  useEffect(() => {
    if (containerRef.current) {
      setClientHeight(containerRef.current.clientHeight);
    }
  }, [height]);

  // Compute item indices currently in viewport
  const startIndex = Math.max(0, Math.floor(scrollTop / itemHeight) - 2); // subtract buffer
  const endIndex = Math.min(
    items.length - 1,
    Math.floor((scrollTop + clientHeight) / itemHeight) + 2 // add buffer
  );

  // Sliced items and their top offsets
  const visibleItems = [];
  for (let i = startIndex; i <= endIndex; i++) {
    if (items[i]) {
      visibleItems.push({
        item: items[i],
        index: i,
        offsetTop: i * itemHeight
      });
    }
  }

  return (
    <div
      ref={containerRef}
      onScroll={handleScroll}
      className="virtual-feed-container"
      style={{
        height,
        position: 'relative',
        overflowY: 'auto'
      }}
    >
      <div style={{ height: totalHeight, width: '100%', position: 'relative' }}>
        {visibleItems.map(({ item, index, offsetTop }) => (
          <div
            key={index}
            style={{
              position: 'absolute',
              top: 0,
              transform: `translateY(${offsetTop}px)`,
              left: 0,
              right: 0,
              height: itemHeight,
              overflow: 'hidden'
            }}
          >
            {renderItem(item, index)}
          </div>
        ))}
        {items.length === 0 && (
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              height: '100%',
              color: 'var(--text-secondary)',
              fontSize: '0.9rem'
            }}
          >
            No events streaming.
          </div>
        )}
      </div>
    </div>
  );
}
export default VirtualList;
