/**
 * A simplified JavaScript interface for interacting with IndexedDB using promises.
 * This interface abstracts away much of the complexity involved in directly working with IndexedDB.
 *
 * Usage Example:
 * (async () => {
 *   try {
 *     const stores = [
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


/**
 * @typedef {Object} StoreDefinition
 * @property {string} name - The name of the object store.
 * @property {Object} options - The options for the object store.
 * @property {string} options.keyPath - The key path for the object store.
 * @property {boolean} [options.autoIncrement] - Whether the key should auto-increment.
 * @property {Array<IndexDefinition>} [indexes] - An array of index definitions.
 */

/**
 * @typedef {Object} IndexDefinition
 * @property {string} name - The name of the index.
 * @property {string} keyPath - The key path for the index.
 * @property {Object} options - The options for the index.
 * @property {boolean} [options.unique] - Whether the index should enforce unique values.
 */

/**
 * A simplified JavaScript interface for interacting with IndexedDB using promises.
 * @class Yexed
 * @param {string} dbName - The name of the database.
 * @param {number} [version=1] - The version of the database.
 * @param {Array} [stores=[]] - An array of store definitions.
 * @returns {Promise<Yexed>} - A promise that resolves to a Yexed instance.
 * @example
 * const db = await new Yexed('myDatabase', 1, [
 *   {
 *    name: 'users',
 *    options: { keyPath: 'id' },
 *    indexes: [{ name: 'name', keyPath: 'name', options: { unique: false } }]
 *   }
 * ]);
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API|IndexedDB API}
 */
class Yexed {
  constructor(dbName, version = 1, stores = []) {
    this.dbName = dbName;
    this.version = version;
    this.stores = stores;
    this.database = null;

    return (async () => {
      await this.open();
      return this;
    })();
  }

  /**
   * Opens the database connection and initializes the object stores.
   * @returns {Promise<void>}
   */
  open() {
    return new Promise((resolve, reject) => {
      const request = indexedDB.open(this.dbName, this.version);

      request.onupgradeneeded = event => {
        this.database = event.target.result;
        this.defineStores();
      };

      request.onsuccess = event => {
        this.database = event.target.result;
        resolve();
      };

      request.onerror = error => {
        reject(error);
      };
    });
  }

  /**
   * Defines the object stores and indexes based on the provided store definitions.
   */
  defineStores() {
    this.stores.forEach(store => {
      if (!this.database.objectStoreNames.contains(store.name)) {
        const objectStore = this.database.createObjectStore(store.name, store.options);
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
  getTransaction(mode, ...storeNames) {
    return new Promise((resolve, reject) => {
      try {
        const transaction = this.database.transaction(storeNames, mode);
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
  addData(storeName, data, key = undefined) {
    return this.getTransaction('readwrite', storeName)
      .then(transaction => {
        return new Promise((resolve, reject) => {
          const request = transaction.objectStore(storeName).add(data, key);

          request.onsuccess = event => resolve(event.target.result);
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
  getData(storeName, key) {
    return this.getTransaction('readonly', storeName)
      .then(transaction => {
        return new Promise((resolve, reject) => {
          const request = transaction.objectStore(storeName).get(key);

          request.onsuccess = event => resolve(event.target.result);
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
  updateData(storeName, data, key) {
    return this.getTransaction('readwrite', storeName)
      .then(transaction => {
        return new Promise((resolve, reject) => {
          const request = transaction.objectStore(storeName).put(data, key);

          request.onsuccess = event => resolve(event.target.result);
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
  deleteData(storeName, key) {
    return this.getTransaction('readwrite', storeName)
      .then(transaction => {
        return new Promise((resolve, reject) => {
          const request = transaction.objectStore(storeName).delete(key);

          request.onsuccess = event => resolve(event.target.result);
          request.onerror = error => reject(error);
        });
      });
  }

  /**
   * Clears all data from the specified object store.
   * @param {string} storeName - The name of the object store.
   * @returns {Promise<void>}
   */
  clearData(storeName) {
    return this.getTransaction('readwrite', storeName)
      .then(transaction => {
        return new Promise((resolve, reject) => {
          const request = transaction.objectStore(storeName).clear();

          request.onsuccess = event => resolve(event.target.result);
          request.onerror = error => reject(error);
        });
      });
  }

  /**
   * Retrieves all data from the specified object store.
   * @param {string} storeName - The name of the object store.
   * @returns {Promise<Array<any>>} - An array of all data in the store.
   */
  getAllData(storeName) {
    return this.getTransaction('readonly', storeName)
      .then(transaction => {
        return new Promise((resolve, reject) => {
          const request = transaction.objectStore(storeName).getAll();

          request.onsuccess = event => resolve(event.target.result);
          request.onerror = error => reject(error);
        });
      });
  }

  /**
   * Closes the database connection.
   */
  close() {
    if (this.database) {
      this.database.close();
    }
  }
}
