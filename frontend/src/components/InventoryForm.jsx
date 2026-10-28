import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import { STANDARD_UNITS } from '../utils/format';

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
    site: '',
    storageLocation: '',
    minThreshold: '10',
    unitCost: '0'
  });

  const [sites, setSites] = useState([]);
  const [loadingSites, setLoadingSites] = useState(true);
  const [message, setMessage] = useState({ type: '', text: '' });
  const [loading, setLoading] = useState(false);

  // Fetch authorized sites
  useEffect(() => {
    let isMounted = true;
    const fetchSites = async () => {
      try {
        setLoadingSites(true);
        const res = await authFetch('/api/sites');
        if (res.ok) {
          const data = await res.json();
          if (isMounted) {
            setSites(data);
          }
        }
      } catch (err) {
        console.error('Failed to load sites:', err);
      } finally {
        if (isMounted) setLoadingSites(false);
      }
    };
    fetchSites();
    return () => { isMounted = false; };
  }, [authFetch]);

  // Sync form state when itemToEdit or sites change
  useEffect(() => {
    if (itemToEdit) {
      setFormData({
        itemName: itemToEdit.itemName || '',
        sku: itemToEdit.sku || '',
        category: itemToEdit.category || 'Material',
        quantity: itemToEdit.quantity !== undefined ? itemToEdit.quantity.toString() : '',
        unit: itemToEdit.unit || 'pieces',
        supplier: itemToEdit.supplier || '',
        site: itemToEdit.site || (sites[0]?.name || ''),
        storageLocation: itemToEdit.storageLocation || '',
        minThreshold: itemToEdit.minThreshold !== undefined ? itemToEdit.minThreshold.toString() : '10',
        unitCost: itemToEdit.unitCost !== undefined ? itemToEdit.unitCost.toString() : '0'
      });
      setMessage({ type: '', text: '' });
    } else {
      const userAssigned = user?.assignedSites || [];
      const defaultSite = userAssigned.length > 0
        ? (sites.find((s) => userAssigned.includes(s.name))?.name || userAssigned[0])
        : (sites[0]?.name || '');

      setFormData((prev) => ({
        itemName: '',
        sku: '',
        category: 'Material',
        quantity: '',
        unit: 'pieces',
        supplier: '',
        site: prev.site && sites.some((s) => s.name === prev.site) ? prev.site : defaultSite,
        storageLocation: '',
        minThreshold: '10',
        unitCost: '0'
      }));
    }
  }, [itemToEdit, user, sites]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage({ type: '', text: '' });

    try {
      if (!formData.site || !formData.site.trim()) {
        throw new Error('Please select an authorized construction site.');
      }

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
        const userAssigned = user?.assignedSites || [];
        const defaultSite = userAssigned.length > 0
          ? (sites.find((s) => userAssigned.includes(s.name))?.name || userAssigned[0])
          : (sites[0]?.name || '');

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
      <h3 className="card-title">
        {itemToEdit ? '✏️ Update Inventory Item' : '📦 Add Inventory Item'}
      </h3>

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

        <div className="form-group" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '140px' }}>
            <label htmlFor="quantity">
              {itemToEdit ? 'Current Stock (Read-Only)' : 'Opening Quantity'}
            </label>
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
              disabled={Boolean(itemToEdit)}
              style={itemToEdit ? { backgroundColor: '#f1f5f9', cursor: 'not-allowed', color: '#64748b' } : {}}
              required={!itemToEdit}
            />
            {itemToEdit && (
              <small style={{ fontSize: '0.72rem', color: '#64748b', display: 'block', marginTop: '3px' }}>
                🔒 Stock balance changes are recorded via Stock Movements.
              </small>
            )}
          </div>
          <div style={{ flex: 1, minWidth: '140px' }}>
            <label htmlFor="unit">Unit of Measurement</label>
            <select
              id="unit"
              name="unit"
              className="form-control"
              value={formData.unit}
              onChange={handleChange}
              required
            >
              {STANDARD_UNITS.map((u) => (
                <option key={u} value={u}>
                  {u}
                </option>
              ))}
              {!STANDARD_UNITS.includes(formData.unit) && (
                <option value={formData.unit}>{formData.unit}</option>
              )}
            </select>
          </div>
        </div>

        <div className="form-group" style={{ display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
          <div style={{ flex: 1, minWidth: '140px' }}>
            <label htmlFor="unitCost">Unit Cost (₹)</label>
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
          <div style={{ flex: 1, minWidth: '140px' }}>
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

        {!loadingSites && sites.length === 0 && (
          <div className="alert alert-error" style={{ marginBottom: '1rem', padding: '0.65rem 1rem', fontSize: '0.85rem' }}>
            ⚠️ No authorized construction sites available. Please contact an Owner to register or assign a site before adding inventory.
          </div>
        )}

        <div className="form-group" style={{ display: 'flex', gap: '1rem' }}>
          <div style={{ flex: 1 }}>
            <label htmlFor="site">Assigned Construction Site</label>
            <select
              id="site"
              name="site"
              className="form-control"
              value={formData.site}
              onChange={handleChange}
              required
              disabled={loadingSites || (!itemToEdit && sites.length === 0)}
            >
              <option value="">{loadingSites ? 'Loading authorized sites...' : '-- Select Construction Site --'}</option>
              {sites.map((s) => (
                <option key={s._id} value={s.name}>
                  {s.name} ({s.code})
                </option>
              ))}
              {itemToEdit && itemToEdit.site && !sites.some((s) => s.name === itemToEdit.site) && (
                <option value={itemToEdit.site}>
                  {itemToEdit.site} (Current)
                </option>
              )}
            </select>
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
