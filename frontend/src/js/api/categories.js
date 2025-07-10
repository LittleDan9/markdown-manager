import config from "../config.js";

export async function addCategory(category) {
    try {
        if (true) { // TODO: if user is not logged in, use local storage else use API
            let categories = [];
            const raw = localStorage.getItem("documentCategories");
            categories = raw ? JSON.parse(raw) : [];
            if (!categories.includes(category)) {
                categories.push(category);
                localStorage.setItem("documentCategories", JSON.stringify(categories));
            }
        } else {
            const response = await fetch(config.apiBaseUrl + "/api/categories", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ name: category })
            });
            if (!response.ok) throw new Error("Failed to add category");
        }

    } catch (e) {
        console.error("Failed to add category:", e);
    }
}

export async function fetchCategories() {
    let categories = [];

    try {
        // TODO: if user is not logged in, use local storage else use API
        if (true) {
        const raw = localStorage.getItem("documentCategories");
        categories = raw ? JSON.parse(raw) : ["General"];
        } else {
            const response = await fetch(config.apiBaseUrl + "/api/categories");
            if (!response.ok) throw new Error("Failed to fetch categories");
            return response.json(); // Should return an array of category names
        }

    } catch (e) {
        categories = ["General"];
        console.error("Failed to load categories from localStorage:", e);
    }

    if (!categories.includes("General")) {
        categories.unshift("General");
    }

    const generalIndex = categories.findIndex(cat => cat.trim().toLowerCase() === "general");
    let general = null;
    if (generalIndex !== -1) {
        general = categories.splice(generalIndex, 1)[0];
    }
    categories.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
    if (general) categories.unshift(general);
    return categories;
}

export async function deleteCategory(category) {
    try {
        // TODO: if user is not logged in, use local storage else use API

        if (true) {
            let categories = []
            const raw = localStorage.getItem("documentCategories");
            categories = raw ? JSON.parse(raw) : [];
            categories = categories.filter(cat => cat !== category);
            localStorage.setItem("documentCategories", JSON.stringify(categories));
        } else {
            const response = await fetch(config.apiBaseUrl + "/api/categories/" + encodeURIComponent(category), {
                method: "DELETE"
            });
            if (!response.ok) throw new Error("Failed to delete category");
        }
    } catch (e) {
        console.error("Failed to delete category:", e);
    }
}