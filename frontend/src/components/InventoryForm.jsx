import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';

/**
 * InventoryForm Component
 * Supports both creating new items and updating existing items (Complete CRUD)
 */
const InventoryForm = ({ onItemAdded, itemToEdit, onCancelEdit }) => {
  const { authFetch, user } = useAuth();

  const [formData, setFormData] = useState({
    itemName: '',
    sku: '',
    category: 'Material',
    quantity: '',
    unit: 'pieces',
    supplier: '',
    site: 'General Site',
    storageLocation: '',
    minThreshold: '10',
    unitCost: '0'
  });

  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  // Sync form state when itemToEdit changes
  useEffect(() => {
    if (itemToEdit) {
      setFormData({
        itemName: itemToEdit.itemName || '',
        sku: itemToEdit.sku || '',
        category: itemToEdit.category || 'Material',
        quantity: itemToEdit.quantity !== undefined ? itemToEdit.quantity.toString() : '',
        unit: itemToEdit.unit || 'pieces',
        supplier: itemToEdit.supplier || '',
        site: itemToEdit.site || 'General Site',
        storageLocation: itemToEdit.storageLocation || '',
        minThreshold: itemToEdit.minThreshold !== undefined ? itemToEdit.minThreshold.toString() : '10',
        unitCost: itemToEdit.unitCost !== undefined ? itemToEdit.unitCost.toString() : '0'
      });
      setMessage({ type: '', text: '' });
    } else {
      // Default new item site based on user assignment
      const defaultSite = user?.assignedSites?.length ? user.assignedSites[0] : 'General Site';
      setFormData({
        itemName: '',
        sku: '',
        category: 'Material',
        quantity: '',
        unit: 'pieces',
        supplier: '',
        site: defaultSite,
        storageLocation: '',
        minThreshold: '10',
        unitCost: '0'
      });
    }
  }, [itemToEdit, user]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      const isEdit = Boolean(itemToEdit);
      const url = isEdit ? `/api/inventory/${itemToEdit._id}` : '/api/inventory';
      const method = isEdit ? 'PUT' : 'POST';

      const response = await authFetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          quantity: Number(formData.quantity),
          minThreshold: Number(formData.minThreshold),
          unitCost: Number(formData.unitCost)
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || 'Operation failed');
      }

      setMessage({ type: 'success', text: '✅ ' + data.message });

      if (!isEdit) {
        setFormData({
          itemName: '',
          sku: '',
          category: 'Material',
          quantity: '',
          unit: 'pieces',
          supplier: '',
          site: user?.assignedSites?.length ? user.assignedSites[0] : 'General Site',
          storageLocation: '',
          minThreshold: '10',
          unitCost: '0'
        });
      }

      if (onItemAdded) {
        onItemAdded();
      }

      if (isEdit && onCancelEdit) {
        onCancelEdit();
      }
    } catch (err) {
      setMessage({ type: 'error', text: '❌ ' + err.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="card">
      <h2 className="card-title">
        {itemToEdit ? '✏️ Update Inventory Item' : '📦 Add Inventory Item'}
      </h2>

      {message.text && (
        <div className={`alert alert-${message.type}`}>
          {message.text}
        </div>
      )}

      <form onSubmit={handleSubmit}>
        <div className="form-group" style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ flex: 2 }}>
            <label htmlFor="itemName">Item Name</label>
            <input
              type="text"
              id="itemName"
              name="itemName"
              className="form-control"
              placeholder="e.g. Cement 53 Grade, Excavator"
              value={formData.itemName}
              onChange={handleChange}
              required
            />
          </div>
          <div style={{ flex: 1 }}>
            <label htmlFor="sku">SKU / Code</label>
            <input
              type="text"
              id="sku"
              name="sku"
              className="form-control"
              placeholder="e.g. MAT-CEM-01"
              value={formData.sku}
              onChange={handleChange}
            />
          </div>
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
              step="any"
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
              <option value="meters">Meters</option>
              <option value="sq.ft">Sq. Ft</option>
            </select>
          </div>
        </div>

        <div className="form-group" style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="unitCost">Unit Cost ($)</label>
            <input
              type="number"
              id="unitCost"
              name="unitCost"
              className="form-control"
              placeholder="0.00"
              value={formData.unitCost}
              onChange={handleChange}
              min="0"
              step="any"
            />
          </div>
          <div style={{ flex: 1 }}>
            <label htmlFor="minThreshold">Min Alert Threshold</label>
            <input
              type="number"
              id="minThreshold"
              name="minThreshold"
              className="form-control"
              placeholder="10"
              value={formData.minThreshold}
              onChange={handleChange}
              min="0"
            />
          </div>
        </div>

        <div className="form-group" style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="site">Assigned Site</label>
            <input
              type="text"
              id="site"
              name="site"
              className="form-control"
              placeholder="e.g. Site North, General Site"
              value={formData.site}
              onChange={handleChange}
              required
            />
          </div>
          <div style={{ flex: 1 }}>
            <label htmlFor="storageLocation">Storage Bay / Shed</label>
            <input
              type="text"
              id="storageLocation"
              name="storageLocation"
              className="form-control"
              placeholder="e.g. Shed B-2, Yard 1"
              value={formData.storageLocation}
              onChange={handleChange}
            />
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

        <div style={{ display: 'flex', gap: '0.5rem' }}>
          <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={loading}>
            {loading ? 'Saving...' : itemToEdit ? 'Save Changes' : 'Add Item'}
          </button>
          {itemToEdit && (
            <button
              type="button"
              className="btn btn-secondary"
              onClick={onCancelEdit}
              style={{ background: '#e2e8f0', color: '#475569', border: 'none', borderRadius: '6px', padding: '0 1rem' }}
            >
              Cancel
            </button>
          )}
        </div>
      </form>
    </div>
  );
};

export default InventoryForm;
