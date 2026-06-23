/**
 * offline-data.service.ts
 * Wrapper IndexedDB pour le mode offline
 * Stocke les données critiques localement pour consultation hors connexion
 */
import { openDB } from "idb"; // Utilisation d'une librairie pour simplifier IndexedDB
const DB_NAME = "DigitservzOfflineDB";
const DB_VERSION = 1;
class OfflineDatabase {
    constructor() {
        this.db = null;
    }
    async init() {
        try {
            this.db = await openDB(DB_NAME, DB_VERSION, {
                upgrade(db) {
                    if (!db.objectStoreNames.contains("offers")) {
                        const store = db.createObjectStore("offers", { keyPath: "id" });
                        store.createIndex("status", "status", { unique: false });
                        store.createIndex("syncedAt", "lastSynced", { unique: false });
                    }
                    if (!db.objectStoreNames.contains("offerDetails")) {
                        db.createObjectStore("offerDetails", { keyPath: "id" });
                    }
                    if (!db.objectStoreNames.contains("syncQueue")) {
                        db.createObjectStore("syncQueue", { keyPath: "id" });
                    }
                },
            });
        }
        catch (err) {
            return Promise.reject(err);
        }
    }
    async saveOfferList(offers) {
        if (!this.db)
            await this.init();
        const tx = this.db.transaction("offers", "readwrite");
        const store = tx.objectStore("offers");
        for (const offer of offers) {
            await store.put(offer);
        }
    }
    async getOfferList() {
        if (!this.db)
            await this.init();
        const tx = this.db.transaction("offers", "readonly");
        const store = tx.objectStore("offers");
        return store.getAll();
    }
    async saveOfferDetail(detail) {
        if (!this.db)
            await this.init();
        const tx = this.db.transaction("offerDetails", "readwrite");
        const store = tx.objectStore("offerDetails");
        await store.put(detail);
    }
    async getOfferDetail(offerId) {
        if (!this.db)
            await this.init();
        const tx = this.db.transaction("offerDetails", "readonly");
        const store = tx.objectStore("offerDetails");
        return store.get(offerId);
    }
    async deleteOffer(offerId) {
        if (!this.db)
            await this.init();
        const tx = this.db.transaction(["offers", "offerDetails"], "readwrite");
        await tx.objectStore("offers").delete(offerId);
        await tx.objectStore("offerDetails").delete(offerId);
    }
    async isOnline() {
        if (typeof navigator === "undefined")
            return false;
        return navigator.onLine;
    }
    async syncIfOnline() {
        if (typeof navigator === "undefined" || !navigator.onLine) {
            return { synced: 0, failed: 0 };
        }
        // Trigger background sync via service worker
        if (typeof navigator !== "undefined" &&
            "serviceWorker" in navigator &&
            typeof window !== "undefined" &&
            "SyncManager" in window) {
            const registration = await navigator.serviceWorker.ready;
            await registration.sync.register("sync-offline-data");
        }
        return { synced: 0, failed: 0 }; // Actual sync handled by SW
    }
}
export const offlineDB = new OfflineDatabase();
/**
 * Hook React pour le mode offline
 */
export function useOfflineStatus() {
    const nav = typeof navigator !== "undefined" ? navigator : undefined;
    const win = typeof window !== "undefined" ? window : undefined;
    const [isOnline, setIsOnline] = React.useState(!!nav && nav.onLine);
    const [isSyncing, setIsSyncing] = React.useState(false);
    React.useEffect(() => {
        const handleOnline = () => setIsOnline(true);
        const handleOffline = () => setIsOnline(false);
        if (win && win.addEventListener) {
            win.addEventListener("online", handleOnline);
            win.addEventListener("offline", handleOffline);
        }
        return () => {
            if (win && win.removeEventListener) {
                win.removeEventListener("online", handleOnline);
                win.removeEventListener("offline", handleOffline);
            }
        };
    }, []);
    const sync = async () => {
        setIsSyncing(true);
        try {
            await offlineDB.syncIfOnline();
        }
        finally {
            setIsSyncing(false);
        }
    };
    return { isOnline, isSyncing, sync };
}
// Need to import React for the hook
import React from "react";
//# sourceMappingURL=offline-data.service.js.map