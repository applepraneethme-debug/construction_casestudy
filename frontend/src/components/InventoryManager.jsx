import React, { useState, useEffect } from 'react';
import { useAuth } from '../context/AuthContext';
import InventoryForm from './InventoryForm';
import InventoryList from './InventoryList';

const InventoryManager = () => {
  const { authFetch, user } = useAuth();
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [itemToEdit, setItemToEdit] = useState(null);

  // Search & Filter state
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [site, setSite] = useState('');
  const [lowStock, setLowStock] = useState(false);
  const [showForm, setShowForm] = useState(false);

  const fetchInventory = async () => {
    try {
      setLoading(true);
      let query = '/api/inventory?';
      if (search.trim()) query += `search=${encodeURIComponent(search.trim())}&`;
      if (category) query += `category=${encodeURIComponent(category)}&`;
      if (site.trim()) query += `site=${encodeURIComponent(site.trim())}&`;
      if (lowStock) query += `lowStock=true&`;

      const res = await authFetch(query);
      if (!res.ok) throw new Error('Failed to fetch inventory');
      const data = await res.json();
      setItems(data);
    } catch (err) {
      console.error('Error fetching inventory:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchInventory();
  }, [search, category, site, lowStock]);

  const handleDeleteItem = async (id) => {
    if (!window.confirm('Are you sure you want to remove this item? (Action will be logged)')) return;

    try {
      const response = await authFetch(`/api/inventory/${id}`, {
        method: 'DELETE'
      });

      const data = await response.json();
      if (response.ok) {
        fetchInventory();
        if (itemToEdit && itemToEdit._id === id) {
          setItemToEdit(null);
          setShowForm(false);
        }
      } else {
        alert(data.message || 'Failed to delete item.');
      }
    } catch (error) {
      console.error('Error deleting item:', error);
      alert('Error communicating with server.');
    }
  };

  const handleStartEdit = (item) => {
    setItemToEdit(item);
    setShowForm(true);
    window.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const handleCancelEdit = () => {
    setItemToEdit(null);
    setShowForm(false);
  };

  const totalValuation = items.reduce((acc, it) => acc + (it.quantity || 0) * (it.unitCost || 0), 0);
  const lowStockCount = items.filter((it) => it.quantity <= (it.minThreshold || 10)).length;

  return (
    <div>
      {/* Top Toolbar */}
      <div className="toolbar-bar">
        <div>
          <h2>📦 Construction Materials Inventory</h2>
          <p style={{ color: '#64748b', fontSize: '0.9rem' }}>
            Track site materials, minimum threshold limits, unit costs and storage locations
          </p>
        </div>

        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            onClick={() => {
              if (showForm && !itemToEdit) {
                setShowForm(false);
              } else {
                setItemToEdit(null);
                setShowForm(true);
              }
            }}
            className="btn btn-primary"
            style={{ width: 'auto', padding: '0.5rem 1rem' }}
          >
            {showForm && !itemToEdit ? '✕ Hide Form' : '➕ Add Inventory Item'}
          </button>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="card" style={{ marginBottom: '1.25rem', padding: '1rem 1.25rem' }}>
        <div className="toolbar-bar" style={{ margin: 0 }}>
          <div className="filter-group">
            <input
              type="text"
              className="form-control"
              style={{ width: '220px', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
              placeholder="🔍 Search name, SKU, supplier..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <select
              className="form-control"
              style={{ width: 'auto', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">All Categories</option>
              <option value="Material">Material</option>
              <option value="Equipment">Equipment</option>
              <option value="Tool">Tool</option>
              <option value="Other">Other</option>
            </select>

            <input
              type="text"
              className="form-control"
              style={{ width: '150px', padding: '0.4rem 0.75rem', fontSize: '0.85rem' }}
              placeholder="Filter site..."
              value={site}
              onChange={(e) => setSite(e.target.value)}
            />

            <label style={{ display: 'flex', alignItems: 'center', gap: '0.4rem', fontSize: '0.85rem', cursor: 'pointer', fontWeight: 500 }}>
              <input
                type="checkbox"
                checked={lowStock}
                onChange={(e) => setLowStock(e.target.checked)}
              />
              ⚠️ Low Stock Only ({lowStockCount})
            </label>
          </div>

          <div style={{ fontSize: '0.85rem', color: '#475569' }}>
            Filtered Value: <strong style={{ color: '#059669' }}>${totalValuation.toLocaleString()}</strong>
          </div>
        </div>
      </div>

      {/* Grid Layout: If showForm is true, Form + Table; Else full-width Table */}
      <div className={showForm ? 'app-grid' : ''}>
        {showForm && (
          <InventoryForm
            onItemAdded={() => {
              fetchInventory();
              if (itemToEdit) {
                setItemToEdit(null);
                setShowForm(false);
              }
            }}
            itemToEdit={itemToEdit}
            onCancelEdit={handleCancelEdit}
          />
        )}

        <InventoryList
          items={items}
          onDeleteItem={handleDeleteItem}
          onEditItem={handleStartEdit}
          loading={loading}
        />
      </div>
    </div>
  );
};

export default InventoryManager;
