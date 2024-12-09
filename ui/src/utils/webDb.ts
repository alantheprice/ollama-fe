/**
 * A simplified TypeScript interface for interacting with IndexedDB using promises.
 * This interface abstracts away much of the complexity involved in directly working with IndexedDB.
 *
 * Usage Example:
 * (async () => {
 *   try {
 *     const stores: StoreDefinition[] = [
 *       {
 *         name: 'users',
 *         options: { keyPath: 'id' },
 *         indexes: [
 *           { name: 'name', keyPath: 'name', options: { unique: false } }
 *         ]
 *       },
 *       {
 *         name: 'messages',
 *         options: { keyPath: 'id', autoIncrement: true },
 *         indexes: [
 *           { name: 'timestamp', keyPath: 'timestamp', options: { unique: false } },
 *           { name: 'session', keyPath: 'session', options: { unique: false } },
 *           { name: 'sender', keyPath: 'sender', options: { unique: false } }
 *         ]
 *       }
 *     ];
 *
 *     const db = await new Yexed('myDatabase', 1, stores);
 *
 *     // Add data to the store
 *     await db.addData('users', { id: 1, name: 'John Doe' });
 *
 *     // Retrieve data from the store
 *     const user = await db.getData('users', 1);
 *     console.log(user);
 *
 *     // Update data in the store
 *     await db.updateData('users', { id: 1, name: 'Jane Doe' });
 *     console.log(await db.getData('users', 1));
 *
 *     // Delete data from the store
 *     await db.deleteData('users', 1);
 *     console.log(await db.getAllData('users'));
 *
 *     // Close the database connection
 *     db.close();
 *   } catch (error) {
 *     console.error('IndexedDB Error:', error);
 *   }
 * })();
 */

export interface StoreDefinition {
    name: string;
    options: {
        keyPath: string;
        autoIncrement?: boolean;
    };
    indexes?: IndexDefinition[];
}

export interface IndexDefinition {
    name: string;
    keyPath: string;
    options: {
        unique?: boolean;
    };
}

export class WebDB {
    private dbName: string;
    private version: number;
    private stores: StoreDefinition[];
    private database: IDBDatabase | null;

    constructor(dbName: string, version: number = 1, stores: StoreDefinition[] = []) {
        this.dbName = dbName;
        this.version = version;
        this.stores = stores;
        this.database = null;

        return (async () => {
            await this.open();
            return this;
        })() as unknown as WebDB;
    }

    /**
     * Opens the database connection and initializes the object stores.
     * @returns {Promise<void>}
     */
    open(): Promise<void> {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, this.version);

            request.onupgradeneeded = (event: IDBVersionChangeEvent) => {
                this.database = (event.target as IDBOpenDBRequest).result;
                this.defineStores();
            };

            request.onsuccess = (event: Event) => {
                this.database = (event.target as IDBOpenDBRequest).result;
                resolve();
            };

            request.onerror = (error: Event) => {
                reject(error);
            };
        });
    }

    /**
     * Defines the object stores and indexes based on the provided store definitions.
     */
    defineStores(): void {
        if (!this.database) return;

        this.stores.forEach(store => {
            if (!this.database!.objectStoreNames.contains(store.name)) {
                const objectStore = this.database!.createObjectStore(store.name, store.options);
                if (store.indexes) {
                    store.indexes.forEach(index => {
                        objectStore.createIndex(index.name, index.keyPath, index.options);
                    });
                }
            }
        });
    }

    /**
     * Gets a transaction for the specified object stores.
     * @param {string} mode - The transaction mode ('readonly' or 'readwrite').
     * @param {...string} storeNames - The names of the object stores to include in the transaction.
     * @returns {Promise<IDBTransaction>}
     */
    getTransaction(mode: IDBTransactionMode, ...storeNames: string[]): Promise<IDBTransaction> {
        return new Promise((resolve, reject) => {
            try {
                const transaction = this.database!.transaction(storeNames, mode);
                resolve(transaction);
            } catch (error) {
                reject(error);
            }
        });
    }

    /**
     * Adds data to the specified object store.
     * @param {string} storeName - The name of the object store.
     * @param {Object} data - The data to add.
     * @param {any} [key] - The key to use for the data (optional).
     * @returns {Promise<any>} - The key of the added data.
     */
    addData(storeName: string, data: any, key?: any): Promise<any> {
        return this.getTransaction('readwrite', storeName)
            .then(transaction => {
                return new Promise((resolve, reject) => {
                    const request = transaction.objectStore(storeName).add(data, key);

                    request.onsuccess = event => resolve((event.target as IDBRequest).result);
                    request.onerror = error => reject(error);
                });
            });
    }

    /**
     * Retrieves data from the specified object store.
     * @param {string} storeName - The name of the object store.
     * @param {any} key - The key of the data to retrieve.
     * @returns {Promise<any>} - The retrieved data.
     */
    getData(storeName: string, key: any): Promise<any> {
        return this.getTransaction('readonly', storeName)
            .then(transaction => {
                return new Promise((resolve, reject) => {
                    const request = transaction.objectStore(storeName).get(key);

                    request.onsuccess = event => resolve((event.target as IDBRequest).result);
                    request.onerror = error => reject(error);
                });
            });
    }

    /**
     * Updates data in the specified object store.
     * @param {string} storeName - The name of the object store.
     * @param {Object} data - The data to update.
     * @param {any} [key] - The key to use for the data (optional).
     * @returns {Promise<any>} - The key of the updated data.
     */
    updateData(storeName: string, data: any, key?: any): Promise<any> {
        return this.getTransaction('readwrite', storeName)
            .then(transaction => {
                return new Promise((resolve, reject) => {
                    const request = transaction.objectStore(storeName).put(data, key);

                    request.onsuccess = event => resolve((event.target as IDBRequest).result);
                    request.onerror = error => reject(error);
                });
            });
    }

    /**
     * Deletes data from the specified object store.
     * @param {string} storeName - The name of the object store.
     * @param {any} key - The key of the data to delete.
     * @returns {Promise<any>} - The key of the deleted data.
     */
    deleteData(storeName: string, key: any): Promise<any> {
        return this.getTransaction('readwrite', storeName)
            .then(transaction => {
                return new Promise((resolve, reject) => {
                    const request = transaction.objectStore(storeName).delete(key);

                    request.onsuccess = event => resolve((event.target as IDBRequest).result);
                    request.onerror = error => reject(error);
                });
            });
    }

    /**
     * Clears all data from the specified object store.
     * @param {string} storeName - The name of the object store.
     * @returns {Promise<void>}
     */
    clearData(storeName: string): Promise<void> {
        return this.getTransaction('readwrite', storeName)
            .then(transaction => {
                return new Promise((resolve, reject) => {
                    const request = transaction.objectStore(storeName).clear();

                    request.onsuccess = event => resolve((event.target as IDBRequest).result);
                    request.onerror = error => reject(error);
                });
            });
    }

    /**
     * Retrieves all data from the specified object store.
     * @param {string} storeName - The name of the object store.
     * @returns {Promise<Array<any>>} - An array of all data in the store.
     */
    getAllData(storeName: string): Promise<any[]> {
        return this.getTransaction('readonly', storeName)
            .then(transaction => {
                return new Promise((resolve, reject) => {
                    const request = transaction.objectStore(storeName).getAll();

                    request.onsuccess = event => resolve((event.target as IDBRequest).result);
                    request.onerror = error => reject(error);
                });
            });
    }

    /**
     * Closes the database connection.
     */
    close(): void {
        if (this.database) {
            this.database.close();
        }
    }
}