import time
import ollama

def flatten(l):
    return [item for sublist in l for item in sublist]

def chunk_words(words, chunk_size=150, overlap=10):
    chunks = []
    i = 0
    while i < len(words):
        if i > 0:
            i -= overlap  # Overlap the previous chunk by 10 words
        chunk = words[i:i+chunk_size]
        chunks.append(" ".join(chunk))
        i += chunk_size
    return chunks

def timer(func):
    def wrapper(*args, **kwargs):
        start_time = time.time()
        result = func(*args, **kwargs)
        print(f"{func.__name__} took {time.time() - start_time:.2f} seconds.")
        return result
    return wrapper

def check_factuality(claim, document):
    prompt = f"Document: {document}\nClaim: {claim}"
    response = ollama.generate(
        model="bespoke-minicheck",
        prompt=prompt,
        options={"num_predict": 2, "temperature": 0.0}
    )
    return response["response"].strip()