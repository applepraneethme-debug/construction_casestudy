# 🏗️ MERN Stack Case Study: Construction Inventory Management

This project is a **basic, full-stack MERN (MongoDB, Express, React, Node.js) application** designed for a university case study and lab evaluation. It demonstrates a simple system for managing construction materials, equipment, and tools.

---

## 🏗️ 1. MERN Architecture Overview

```
 ┌────────────────┐         HTTP Requests          ┌────────────────┐         Mongoose Query         ┌────────────────┐
 │  React Frontend│  ────────────────────────────> │ Express Backend│  ────────────────────────────> │MongoDB Database│
 │ (Port 3000/Vite)│  <──────────────────────────── │   (Port 5001)  │  <──────────────────────────── │  (Port 27017)  │
 └────────────────┘          JSON Response         └────────────────┘           BSON Records          └────────────────┘
```

1. **M - MongoDB**: NoSQL database to store inventory data.
2. **E - Express.js**: Backend framework to build the REST API.
3. **R - React.js**: Frontend library for building the user interface.
4. **N - Node.js**: Runtime environment to execute backend code.

---

## 📁 2. File Structure

```
project s/
├── backend/
│   ├── models/
│   │   └── InventoryItem.js  <-- Defines MongoDB table structure (Schema)
│   ├── routes/
│   │   └── inventoryRoutes.js<-- API requests (POST add, GET list, DELETE item)
│   ├── server.js            <-- Connects database & starts server
│   ├── package.json         <-- Backend dependencies (express, mongoose, cors)
│   └── .env                 <-- Environment variables (PORT=5001, MONGO_URI)
│
├── frontend/
│   ├── src/
│   │   ├── components/
│   │   │   ├── InventoryForm.jsx <-- Form to input new materials/equipment
│   │   │   └── InventoryList.jsx <-- Table to view and remove inventory
│   │   ├── App.jsx            <-- Parent component managing state
│   │   ├── index.css          <-- Simple CSS styling for the lab
│   │   └── main.jsx           <-- React entry point
│   ├── vite.config.js         <-- Configures proxy so Frontend can talk to Backend
│   └── package.json         <-- Frontend dependencies (react, react-dom, vite)
│
└── EXAM_LAB_GUIDE.md        <-- This guide
```

---

## 🚀 3. How to Run Locally

### Step 1: Start Backend
Open Terminal #1:
```bash
cd backend
npm run dev
```

### Step 2: Start Frontend
Open Terminal #2:
```bash
cd frontend
npm run dev
```

Visit: **`http://localhost:3000`**

---

## 🧠 4. Code Concepts Explained

### A. MongoDB Schema (`backend/models/InventoryItem.js`)
* **Schema**: Defines fields (`itemName`, `category`, `quantity`, `unit`, `supplier`).
* **Model**: Used to perform database operations (`InventoryItem.find()`, `new InventoryItem()`).

### B. Express REST API Routes (`backend/routes/inventoryRoutes.js`)
* `POST /api/inventory`: Receives item data, saves to MongoDB, returns status `201`.
* `GET /api/inventory`: Fetches all inventory items, returns status `200`.
* `DELETE /api/inventory/:id`: Removes an item by its ID.

### C. React Form & State (`frontend/src/components/InventoryForm.jsx`)
* `useState`: Manages form input state.
* `fetch()`: Sends form data to the backend API via a POST request.

---

## ❓ 5. Case Study Viva Questions & Answers

#### Q1: Why use MERN for a construction inventory system?
> **Answer**: MERN uses JavaScript end-to-end, making it easy to develop both frontend and backend. MongoDB's flexible schema easily handles different types of inventory (materials, tools, equipment) with varying attributes.

#### Q2: What is the difference between Schema and Model in Mongoose?
> **Answer**: A **Schema** defines the structure and rules for the data (e.g., quantity must be a number). A **Model** is a compiled version of the schema that provides methods to interact with the database (like `.save()` and `.find()`).

#### Q3: Why do we need `cors()` middleware?
> **Answer**: CORS (Cross-Origin Resource Sharing) is needed because our React frontend (port 3000) and Express backend (port 5001) run on different ports. By default, browsers block these requests for security; `cors()` allows them.

#### Q4: How does React communicate with the backend?
> **Answer**: The React app uses the built-in browser `fetch()` API to make HTTP requests (GET to fetch inventory, POST to add new items) to the Express backend routes (`/api/inventory`).

#### Q5: What is the role of `useEffect` in `App.jsx`?
> **Answer**: `useEffect` runs code after the component first loads. We use it to call `fetchInventory()` immediately when the app opens, so the table is populated with current data from the database.
