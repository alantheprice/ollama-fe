import asyncio
import threading
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from ollama import chat

app = FastAPI()

@app.websocket("/ws")
async def websocket_endpoint(websocket: WebSocket):
    await websocket.accept()
    try:
        while True:
            prompt = await websocket.receive_text()
            async for partial_response in generate_response(prompt):
                await websocket.send_text(partial_response)
    except WebSocketDisconnect:
        print("Client disconnected")
    except Exception as e:
        print(f"Error: {e}")

async def generate_response(prompt: str):
    queue = asyncio.Queue()
    loop = asyncio.get_running_loop()

    def sync_chat():
        response_generator = chat(
            model='llama3.2',
            messages=[
                {'role': 'user', 'content': prompt},
            ],
            stream=True,
        )
        for response in response_generator:
            content = response['message']['content']
            print(f"Response: {content}")  # Debugging line
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

# Mount static files (CSS, JS, etc.)
app.mount("/static", StaticFiles(directory="static"), name="static")

# Serve index.html for the root path
@app.get("/")
def read_root():
    return FileResponse("static/index.html")