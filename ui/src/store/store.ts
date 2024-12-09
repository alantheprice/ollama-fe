import { getDB } from "./db";

interface StorableMessage {
    message: string;
    sender: string;
    session: number|null;
    timestamp: number;
  }

let currentSession: number|null = null;
  
export const saveMessage = async (message: string, sender: string) => {
    const chat: StorableMessage = {message, sender, session: null, timestamp: Date.now()};
    const db = await getDB();
    if (currentSession) {
        chat.session = currentSession;
    } else {
        const title = message.length > 20 ? message.substring(0, 20) : message;
        chat.session = await db.addData('sessions',  {'title': title, 'timestamp': Date.now()});
        currentSession = chat.session;
    }
    await db.addData('messages', chat);
}