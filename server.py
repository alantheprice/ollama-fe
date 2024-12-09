import sys
import os

# Add the server directory to the Python path
sys.path.append(os.path.join(os.path.dirname(__file__), 'server'))

import asyncio
import json
import threading
import re
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from ollama import chat, list, embeddings  # Ensure `ollama` module is correctly imported
import requests
from bs4 import BeautifulSoup
import logging
from embedding_utils import generate_embeddings, query_embeddings
from utils import check_factuality

# Configure logging
logging.basicConfig(level=logging.DEBUG, format='%(asctime)s - %(levelname)s - %(message)s')


app = FastAPI()

# Dictionary to store conversation history
conversation_history = {}


# Function to scrape text from a URL
def scrape_text_from_url(url):
    try:
        logging.debug(f"Scraping text from {url}")
        response = requests.get(url)
        
        soup = BeautifulSoup(response.text, 'html.parser')
        # Extract text from the page, you can customize this based on the page structure
        text = soup.get_text(separator='\n', strip=True)
        logging.debug(f"Extracted text: {text[:200]}...")  # Log first 200 characters of the extracted text
        return text
    except Exception as e:
        logging.error(f"Failed to scrape text from {url}: {e}")
        raise

def scrape_url(url, prompt):
    try:
        text = scrape_text_from_url(url)
        collection = generate_embeddings(text, url)
        relevant_text = query_embeddings(collection, prompt, url)
        return relevant_text
    except Exception as e:
        logging.error(f"Failed to scrape {url}: {str(e)}")
        raise


def extract_urls(prompt):
    # Regular expression to find URLs in the prompt
    url_pattern = r'https?://[^\s]+'
    urls = re.findall(url_pattern, prompt)
    logging.debug(f"Extracted URLs: {urls}")
    return urls

async def generate_response(websocket: WebSocket, model: str, prompt: str):
    queue = asyncio.Queue()
    loop = asyncio.get_running_loop()

    # Extract URLs from the prompt
    urls = extract_urls(prompt)
    combined_content = prompt

    for url in urls:
        scraped_content = scrape_url(url, prompt)
        combined_content += f"\n\nScraped content from {url}:\n{scraped_content}"

    def sync_chat():
        conversation_history[websocket].append({'role': 'user', 'content': combined_content})
        print(f"history: {conversation_history[websocket]}")
        # Summarize the conversation history
        response_generator = chat(
            model=model,
            messages=conversation_history[websocket],  # Include past responses
            stream=True,
        )
        for response in response_generator:
            content = response['message']['content']
            # Put the content into the queue
            asyncio.run_coroutine_threadsafe(queue.put(content), loop)
        # Indicate that the generator is done
        asyncio.run_coroutine_threadsafe(queue.put(None), loop)

    # Start the sync_chat function in a separate thread
    threading.Thread(target=sync_chat).start()

    while True:
        partial_response = await queue.get()
        if partial_response is None:
            # No more responses; exit the loop
            break
        yield partial_response
    
    # Optionally, send an end-of-message marker
    yield "[END_OF_MESSAGE]"

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    conversation_history[websocket] = []  # Initialize conversation history for this connection
    try:
        while True:
            data = await websocket.receive_text()
            message = json.loads(data)
            model = message.get("model", "llama3.2")  # Default to 'llama3.2' if no model is specified
            prompt = message["prompt"]
            full_response = ""
            async for partial_response in generate_response(websocket, model, prompt):
                await websocket.send_text(partial_response)
                full_response += partial_response
            # Append the full assistant response to the conversation history
            conversation_history[websocket].append({'role': 'assistant', 'content': full_response})
            truthy = check_factuality(prompt, full_response)
            if not truthy:
                await websocket.send_text("Looks like my last answer is a bit sus, you might want to double check that.")
            # else :
                # await websocket.send_text("Looks like my last answer is pretty accurate, but you might want to double check")
    except WebSocketDisconnect:
        print("Client disconnected")
        conversation_history.pop(websocket, None)  # Remove conversation history for this connection

@app.get("/models")
async def get_models():
    models = list()
    return models

# Mount static files (CSS, JS, etc.)
app.mount("/assets", StaticFiles(directory="public/assets"), name="assets")

# Serve index.html for the root path
@app.get("/")
def read_root():
    return FileResponse("public/index.html")