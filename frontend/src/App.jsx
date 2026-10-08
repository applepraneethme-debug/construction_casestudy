import React, { useState, useEffect } from 'react';
import InventoryForm from './components/InventoryForm';
import InventoryList from './components/InventoryList';

/**
 * App Main Component
 * Manages global application state for inventory
 */
function App() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);

  // Fetch inventory list from Backend API GET /api/inventory
  const fetchInventory = async () => {
    try {
      setLoading(true);
      const response = await fetch('/api/inventory');
      if (!response.ok) {
        throw new Error('Failed to fetch inventory data');
      }
      const data = await response.json();
      setItems(data);
    } catch (error) {
      console.error('Error fetching inventory:', error);
    } finally {
      setLoading(false);
    }
  };

  // Run fetchInventory once when component mounts
  useEffect(() => {
    fetchInventory();
  }, []);

  // Delete item by ID via Backend API DELETE /api/inventory/:id
  const handleDeleteItem = async (id) => {
    if (!window.confirm('Are you sure you want to remove this item?')) return;

    try {
      const response = await fetch(`/api/inventory/${id}`, {
        method: 'DELETE'
      });

      if (response.ok) {
        // Refresh list after successful delete
        fetchInventory();
      } else {
        alert('Failed to delete item.');
      }
    } catch (error) {
      console.error('Error deleting item:', error);
    }
  };

  return (
    <div className="container">
      {/* Header Banner */}
      <header className="header">
        <span className="badge-lab">Lab Case Study</span>
        <h1>Construction Inventory Management</h1>
        <p>Basic MERN Stack Application to track materials and equipment</p>
      </header>

      {/* Grid Layout: Left = Form, Right = Inventory Table */}
      <main className="app-grid">
        <InventoryForm onItemAdded={fetchInventory} />
        <InventoryList
          items={items}
          onDeleteItem={handleDeleteItem}
          loading={loading}
        />
      </main>

    </div>
  );
}

export default App;
