import React, { useState } from 'react';

/**
 * InventoryForm Component
 * Renders form to add inventory items and sends POST request to backend API
 */
const InventoryForm = ({ onItemAdded }) => {
  // Local state to store form inputs
  const [formData, setFormData] = useState({
    itemName: '',
    category: 'Material',
    quantity: '',
    unit: 'pieces',
    supplier: ''
  });

  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  // Handle text input changes
  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value
    }));
  };

  // Handle form submission
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      // Send POST request to backend Express server
      const response = await fetch('/api/inventory', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify(formData)
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Failed to add item');
      }

      // Show success message
      setMessage({ type: 'success', text: '✅ ' + data.message });

      // Reset form fields
      setFormData({
        itemName: '',
        category: 'Material',
        quantity: '',
        unit: 'pieces',
        supplier: ''
      });

      // Notify parent component to reload inventory list
      if (onItemAdded) {
        onItemAdded();
      }
    } catch (err) {
      setMessage({ type: 'error', text: '❌ ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2 className="card-title">📦 Add Inventory Item</h2>

      {message.text && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label htmlFor="itemName">Item Name</label>
          <input
            type="text"
            id="itemName"
            name="itemName"
            className="form-control"
            placeholder="e.g. Cement, Excavator"
            value={formData.itemName}
            onChange={handleChange}
            required
          />
        </div>

        <div className="form-group">
          <label htmlFor="category">Category</label>
          <select
            id="category"
            name="category"
            className="form-control"
            value={formData.category}
            onChange={handleChange}
            required
          >
            <option value="Material">Material</option>
            <option value="Equipment">Equipment</option>
            <option value="Tool">Tool</option>
            <option value="Other">Other</option>
          </select>
        </div>

        <div className="form-group" style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="quantity">Quantity</label>
            <input
              type="number"
              id="quantity"
              name="quantity"
              className="form-control"
              placeholder="e.g. 100"
              value={formData.quantity}
              onChange={handleChange}
              min="0"
              required
            />
          </div>
          <div style={{ flex: 1 }}>
            <label htmlFor="unit">Unit</label>
            <select
              id="unit"
              name="unit"
              className="form-control"
              value={formData.unit}
              onChange={handleChange}
              required
            >
              <option value="pieces">Pieces</option>
              <option value="bags">Bags</option>
              <option value="kg">Kg</option>
              <option value="tons">Tons</option>
              <option value="liters">Liters</option>
            </select>
          </div>
        </div>

        <div className="form-group">
          <label htmlFor="supplier">Supplier Name</label>
          <input
            type="text"
            id="supplier"
            name="supplier"
            className="form-control"
            placeholder="e.g. ABC Construction Supplies"
            value={formData.supplier}
            onChange={handleChange}
            required
          />
        </div>

        <button type="submit" className="btn btn-primary" disabled={loading}>
          {loading ? 'Adding...' : 'Add Item'}
        </button>
      </form>
    </div>
  );
};

export default InventoryForm;
