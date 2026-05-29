import React from 'react';
import { Layers, MapPin } from 'lucide-react';
import { useStream } from '../context/StreamContext';

interface StoreSelectorProps {
  selectedStoreId: string | null;
  onSelectStore: (storeId: string | null) => void;
}

export const StoreSelector: React.FC<StoreSelectorProps> = ({
  selectedStoreId,
  onSelectStore
}) => {
  const { activeStores } = useStream();

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
      {/* Fleet vs Single Selector Toggle */}
      <div
        style={{
          display: 'flex',
          backgroundColor: 'var(--bg-tertiary)',
          border: '1px solid var(--border-glass)',
          borderRadius: '8px',
          padding: '2px',
          overflow: 'hidden'
        }}
      >
        <button
          onClick={() => onSelectStore(null)}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: selectedStoreId === null ? 'var(--bg-glass)' : 'transparent',
            border: 'none',
            color: selectedStoreId === null ? 'var(--color-cyan)' : 'var(--text-secondary)',
            padding: '8px 14px',
            borderRadius: '6px',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all var(--transition-fast)'
          }}
        >
          <Layers size={14} />
          <span>FLEET VIEW</span>
        </button>

        <button
          onClick={() => {
            if (activeStores.length > 0) {
              onSelectStore(activeStores[0].store_id);
            }
          }}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '6px',
            background: selectedStoreId !== null ? 'var(--bg-glass)' : 'transparent',
            border: 'none',
            color: selectedStoreId !== null ? 'var(--color-cyan)' : 'var(--text-secondary)',
            padding: '8px 14px',
            borderRadius: '6px',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer',
            transition: 'all var(--transition-fast)'
          }}
        >
          <MapPin size={14} />
          <span>SINGLE STORE</span>
        </button>
      </div>

      {/* Store Dropdown if Single Store active */}
      {selectedStoreId !== null && (
        <select
          value={selectedStoreId}
          onChange={(e) => onSelectStore(e.target.value)}
          className="ops-select"
          style={{
            padding: '8px 14px',
            borderRadius: '8px',
            border: '1px solid var(--border-glass)',
            fontSize: '0.8rem',
            fontWeight: 600,
            cursor: 'pointer'
          }}
        >
          {activeStores.map((store) => (
            <option key={store.store_id} value={store.store_id}>
              {store.name} ({store.location})
            </option>
          ))}
        </select>
      )}
    </div>
  );
};
export default StoreSelector;
