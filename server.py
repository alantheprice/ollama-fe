import asyncio
import json
import threading
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from ollama import chat, list

app = FastAPI()

# Dictionary to store conversation history
conversation_history = {}

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
            conversation_history[websocket].append({'role': 'user', 'content': prompt})
            full_response = ""
            async for partial_response in generate_response(websocket, model, prompt):
                await websocket.send_text(partial_response)
                full_response += partial_response
            # Append the full assistant response to the conversation history
            conversation_history[websocket].append({'role': 'assistant', 'content': full_response})
    except WebSocketDisconnect:
        print("Client disconnected")
        conversation_history.pop(websocket, None)  # Remove conversation history for this connection
    except Exception as e:
        print(f"Error: {e}")

async def generate_response(websocket: WebSocket, model: str, prompt: str):
    queue = asyncio.Queue()
    loop = asyncio.get_running_loop()

    def sync_chat():
        conversation_history[websocket].append({'role': 'user', 'content': prompt})
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