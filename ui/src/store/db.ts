import { WebDB } from "../utils/webDb";

export const getDB = async () => {
    let _db: WebDB | null = null;

    const _getDB = async () => {
        if (_db) {
            return _db;
        }
        _db = await new WebDB('chats', 1, [
            {
                name: 'sessions',
                options: { keyPath: 'id', autoIncrement: true },
                indexes: [
                    { name: 'title', keyPath: 'title', options: { unique: false } },
                    { name: 'timestamp', keyPath: 'timestamp', options: { unique: false } }
                ]
            },
            {
                name: 'messages',
                options: { keyPath: 'id', autoIncrement: true },
                indexes: [
                    { name: 'timestamp', keyPath: 'timestamp', options: { unique: false } },
                    { name: 'session', keyPath: 'session', options: { unique: false } },
                    { name: 'sender', keyPath: 'sender', options: { unique: false } }
                ]
            }
        ]);
        return _db;
    };

    return await _getDB();
};

