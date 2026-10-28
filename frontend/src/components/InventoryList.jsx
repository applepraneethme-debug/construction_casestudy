import React from 'react';
import { useAuth } from '../context/AuthContext';
import { formatCurrency } from '../utils/format';

/**
 * InventoryList Component
 * Displays the table of inventory items, alert indicators, valuation, and provides edit/delete actions
 */
const InventoryList = ({ items, onDeleteItem, onEditItem, loading }) => {
  const { user } = useAuth();

  const canDelete = user?.role === 'Owner';
  const canEdit = user?.role === 'Owner' || user?.role === 'Material Manager';

  return (
    <div className="card">
      <h3 className="card-title">
        📋 Current Inventory Items
        <span style={{ fontSize: '0.85rem', color: '#64748b', marginLeft: 'auto' }}>
          Total Items: {items.length}
        </span>
      </h3>

      {loading ? (
        <div className="empty-state">
          <p>⏳ Loading inventory...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <p>🚫 No items matching current criteria.</p>
          <p style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
            Add materials or equipment using the form!
          </p>
        </div>
      ) : (
        <div className="table-container">
          <table className="inventory-table">
            <thead>
              <tr>
                <th>Item Details</th>
                <th>Category</th>
                <th>Site / Location</th>
                <th>Stock & Value</th>
                <th>Supplier</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => {
                const threshold = item.minThreshold ?? 10;
                const isLowStock = item.quantity <= threshold;
                const itemValuation = (item.quantity || 0) * (item.unitCost || 0);

                return (
                  <tr key={item._id}>
                    <td>
                      <strong>{item.itemName}</strong>
                      {item.sku && (
                        <span style={{ display: 'block', fontSize: '0.72rem', color: '#64748b', fontFamily: 'monospace' }}>
                          SKU: {item.sku}
                        </span>
                      )}
                      {isLowStock && (
                        <span
                          style={{
                            display: 'inline-block',
                            fontSize: '0.72rem',
                            color: '#b91c1c',
                            fontWeight: 600,
                            marginTop: '2px',
                            background: '#fee2e2',
                            padding: '1px 6px',
                            borderRadius: '4px'
                          }}
                        >
                          ⚠️ Low Stock (&le; {threshold})
                        </span>
                      )}
                    </td>
                    <td>
                      <span className={`badge-category badge-${(item.category || 'other').toLowerCase()}`}>
                        {item.category}
                      </span>
                    </td>
                    <td>
                      <span style={{ fontSize: '0.85rem', color: '#334155', fontWeight: 500 }}>
                        {item.site || 'General Site'}
                      </span>
                      {item.storageLocation && (
                        <div style={{ fontSize: '0.75rem', color: '#64748b' }}>
                          📍 {item.storageLocation}
                        </div>
                      )}
                    </td>
                    <td>
                      <strong>{item.quantity}</strong> <span style={{ color: '#64748b' }}>{item.unit}</span>
                      {item.unitCost > 0 && (
                        <div style={{ fontSize: '0.75rem', color: '#059669', fontWeight: 500 }}>
                          {formatCurrency(item.unitCost)} / {item.unit} • {formatCurrency(itemValuation)}
                        </div>
                      )}
                    </td>
                    <td>{item.supplier}</td>

                    <td>
                      <div style={{ display: 'flex', gap: '0.35rem' }}>
                        {canEdit && (
                          <button
                            className="btn btn-secondary"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem', background: '#e2e8f0', color: '#1e293b' }}
                            onClick={() => onEditItem(item)}
                            title="Edit Item"
                          >
                            Edit
                          </button>
                        )}
                        {canDelete && (
                          <button
                            className="btn btn-danger"
                            style={{ padding: '0.25rem 0.5rem', fontSize: '0.75rem' }}
                            onClick={() => onDeleteItem(item._id)}
                            title="Remove Item (Owner Only)"
                          >
                            Delete
                          </button>
                        )}
                        {!canEdit && !canDelete && (
                          <span style={{ fontSize: '0.75rem', color: '#94a3b8', fontStyle: 'italic' }}>
                            Read Only
                          </span>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default InventoryList;
