from sentence_transformers import SentenceTransformer
import os
from dotenv import load_dotenv
from langchain_community.docstore.in_memory import InMemoryDocstore
from langchain_community.embeddings import SentenceTransformerEmbeddings
from pinecone import Pinecone

load_dotenv()

embedding_model = SentenceTransformer("intfloat/e5-large-v2")

pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))

index = pc.Index(host="https://rag-qvhhg09.svc.aped-4627-b74a.pinecone.io")

def retrieve_from_pinecone(query):
    
    try:
        query_embedding = embedding_model.encode(query).tolist()
        results = index.query(
            vector=query_embedding,
            top_k=5,
            include_metadata=True
        )
        context_parts = []
        for i, match in enumerate(results["matches"], 1):
            text = match.get("metadata", {}).get("text", "")
            score = match.get("score", 0)
            if text:
                context_parts.append(f"[Result {i}] (Score: {score:.3f})\n{text}")
        
        return "\n\n".join(context_parts)
    
    except Exception as e:
        return f"Error retrieving context: {str(e)}"



