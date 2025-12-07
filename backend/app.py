import os
from pathlib import Path
from typing import List, Annotated

from fastapi import FastAPI, UploadFile, File, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import StreamingResponse
from pydantic import BaseModel

import speech_recognition as sr
from gtts import gTTS
from pinecone import Pinecone
from fastapi.responses import StreamingResponse

from langgraph_workflows import get_rag_ans
from ingest import extract_text_from_documents, chunk_creator
from embeddings import add_to_pinecone
import json
app = FastAPI()

class QueryRequest(BaseModel):
    query: str

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  
    allow_credentials=True,
    allow_methods=["*"],  
    allow_headers=["*"],
)
@app.post("/ask")
def ask_question(req: QueryRequest):
    """Answer questions using RAG pipeline with streaming."""
    
    def ndjson_generator():
        try:
            print(f"Received query: {req.query}")
            chunks = get_rag_ans(req.query)  
            for chunk in chunks:
                if chunk:
                    json_line = json.dumps({"content": chunk}) + "\n"
                    yield json_line.encode('utf-8')
            
            yield (json.dumps({"done": True}) + "\n").encode('utf-8')
            
        except Exception as e:
            yield (json.dumps({"error": str(e)}) + "\n").encode('utf-8')
    return StreamingResponse(
        ndjson_generator(),
        media_type="application/x-ndjson",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        }
    )


@app.post("/upload-files")
async def create_upload_files(files: list[UploadFile]):
    upload_dir = Path("./data")
    upload_dir.mkdir(exist_ok=True)

    uploaded_files = []

    for file in files:
        content = await file.read()
        file_path = upload_dir / file.filename
        with open(file_path, "wb") as f:
            f.write(content)

        uploaded_files.append(file.filename)

        context = extract_text_from_documents()
        chunks = chunk_creator(context)
        print(chunks)
        add_to_pinecone(chunks)

    return {
        "uploaded_files": uploaded_files,
        "count": len(uploaded_files)
    }
