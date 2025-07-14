// documentsApi.js
// Only backend API calls for document CRUD and category management
import config from "../config";
import AuthManager from "../auth/AuthManager";

export async function getAllDocuments(category = null) {
  let url = `${config.apiBaseUrl}/documents/`;
  if (category && category !== "All") {
    url += `?category=${encodeURIComponent(category)}`;
  }
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${AuthManager.getToken()}` },
  });
  if (!res.ok) throw new Error("Failed to fetch documents");
  const data = await res.json();
  return data.documents || [];
}

export async function getDocument(id) {
  const res = await fetch(`${config.apiBaseUrl}/documents/${id}`, {
    headers: { Authorization: `Bearer ${AuthManager.getToken()}` },
  });
  if (!res.ok) throw new Error("Failed to fetch document");
  return await res.json();
}

export async function createDocument({ name, content, category }) {
  const res = await fetch(`${config.apiBaseUrl}/documents/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AuthManager.getToken()}`,
    },
    body: JSON.stringify({ name, content, category }),
  });
  if (!res.ok) throw new Error("Failed to create document");
  return await res.json();
}

export async function updateDocument(id, { name, content, category }) {
  const res = await fetch(`${config.apiBaseUrl}/documents/${id}`, {
    method: "PUT",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AuthManager.getToken()}`,
    },
    body: JSON.stringify({ name, content, category }),
  });
  if (!res.ok) throw new Error("Failed to update document");
  return await res.json();
}

export async function deleteDocument(id) {
  const res = await fetch(`${config.apiBaseUrl}/documents/${id}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${AuthManager.getToken()}` },
  });
  if (!res.ok) throw new Error("Failed to delete document");
  return true;
}

export async function getCategories() {
  const res = await fetch(`${config.apiBaseUrl}/documents/categories/`, {
    headers: { Authorization: `Bearer ${AuthManager.getToken()}` },
  });
  if (!res.ok) throw new Error("Failed to fetch categories");
  const cats = await res.json();
  return Array.isArray(cats) && cats.length ? cats : ["General"];
}

export async function addCategory(name) {
  const res = await fetch(`${config.apiBaseUrl}/documents/categories/`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${AuthManager.getToken()}`,
    },
    body: JSON.stringify({ name }),
  });
  if (!res.ok) throw new Error("Failed to add category");
  return true;
}

export async function deleteCategory(name) {
  const res = await fetch(`${config.apiBaseUrl}/documents/categories/${encodeURIComponent(name)}`, {
    method: "DELETE",
    headers: { Authorization: `Bearer ${AuthManager.getToken()}` },
  });
  if (!res.ok) throw new Error("Failed to delete category");
  return true;
}
