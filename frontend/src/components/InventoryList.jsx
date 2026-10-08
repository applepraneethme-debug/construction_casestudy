import React from 'react';

/**
 * InventoryList Component
 * Displays the table of inventory items and provides delete action
 */
const InventoryList = ({ items, onDeleteItem, loading }) => {
  return (
    <div className="card">
      <h2 className="card-title">
        📋 Current Inventory
        <span style={{ fontSize: '0.85rem', color: '#64748b', marginLeft: 'auto' }}>
          Total Items: {items.length}
        </span>
      </h2>

      {loading ? (
        <div className="empty-state">
          <p>⏳ Loading inventory...</p>
        </div>
      ) : items.length === 0 ? (
        <div className="empty-state">
          <p>🚫 No items in inventory yet.</p>
          <p style={{ fontSize: '0.8rem', marginTop: '0.25rem' }}>
            Add materials or equipment using the form!
          </p>
        </div>
      ) : (
        <div className="table-container">
          <table className="inventory-table">
            <thead>
              <tr>
                <th>Item Name</th>
                <th>Category</th>
                <th>Quantity</th>
                <th>Supplier</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {items.map((item) => (
                <tr key={item._id}>
                  <td><strong>{item.itemName}</strong></td>
                  <td>
                    <span className={`badge-category badge-${item.category.toLowerCase()}`}>
                      {item.category}
                    </span>
                  </td>
                  <td>
                    {item.quantity} {item.unit}
                  </td>
                  <td>{item.supplier}</td>
                  <td>
                    <button
                      className="btn btn-danger"
                      onClick={() => onDeleteItem(item._id)}
                      title="Remove Item"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default InventoryList;
