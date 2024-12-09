import ollama
import chromadb
from utils import chunk_words

embed_model = "mxbai-embed-large"

# Initialize ChromaDB client and create the collection once
client = chromadb.Client()
collection_name = "docs"

def get_or_create_collection(client, collection_name):
    try:
        collection = client.get_collection(name=collection_name)
    except chromadb.errors.InvalidCollectionException:  # Collection does not exist, so we create it
        collection = client.create_collection(name=collection_name)
    return collection

collection = get_or_create_collection(client, collection_name)

def generate_embeddings(page_content, url):
    words = page_content.split()
    chunks = chunk_words(words, 100, 20)
    
    for i, d in enumerate(chunks):
        response = ollama.embeddings(model=embed_model, prompt=d)
        embedding = response["embedding"]
        # Add metadata with the URL
        collection.add(
            ids=[f"{url}_{i}"],  # Use a unique ID based on the URL and chunk index
            embeddings=[embedding],
            documents=[d],
            metadatas=[{"url": url}]
        )
    return collection

def query_embeddings(collection, query_prompt, url=None):
    query_response = ollama.embeddings(
        prompt=query_prompt,
        model=embed_model,
    )
    
    if url:
        # Filter by URL
        results = collection.query(
            query_embeddings=[query_response["embedding"]],
            n_results=5,
            where={"url": {"$eq": url}}
        )
    else:
        # Query without filtering
        results = collection.query(
            query_embeddings=[query_response["embedding"]],
            n_results=5
        )
    
    # Flatten the list of lists
    documents = [doc for sublist in results['documents'] for doc in sublist]
    return '\n'.join(documents)
