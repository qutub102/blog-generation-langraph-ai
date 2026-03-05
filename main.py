import uvicorn
import json
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from src.graphs.graph_builder import GraphBuilder
from src.llms.openaillm import OpenAILLM

import os
from dotenv import load_dotenv
load_dotenv()

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173","https://blog-generation-langraph-ai.vercel.app"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

os.environ["LANGSMITH_API_KEY"] = os.getenv("LANGCHAIN_API_KEY", "")

## API's

@app.get("/")
async def root():
    return {"message": "Server is running..."}


async def generate_blog_stream(topic: str, language: str):
    openaillm = OpenAILLM()
    llm = openaillm.get_llm()
    graph_builder = GraphBuilder(llm)
    
    # We will use language routing if language is given
    if language:
        graph = graph_builder.setup_graph(usecase="language")
        inputs = {"topic": topic, "current_language": language.lower()}
    else:
        graph = graph_builder.setup_graph(usecase="topic")
        inputs = {"topic": topic}
        
    async for event in graph.astream_events(inputs, version="v2"):
        kind = event["event"]
        if kind == "on_chat_model_stream":
            content = event["data"]["chunk"].content
            if content:
                # SSE format requires data: prefix and double newline
                yield f"data: {json.dumps({'chunk': content})}\n\n"
        
    # Send a completion event
    yield f"data: {json.dumps({'event': 'done'})}\n\n"

@app.post("/blogs")
async def create_blogs(request: Request):
    data = await request.json()
    topic = data.get("topic", "")
    language = data.get("language", "")
    print(f"Topic: {topic}, Language: {language}")

    # Return a StreamingResponse utilizing the generator
    return StreamingResponse(
        generate_blog_stream(topic, language), 
        media_type="text/event-stream"
    )

if __name__ == "__main__":
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)