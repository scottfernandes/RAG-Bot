from ingest import extract_text_from_documents, chunk_creator
from dotenv import load_dotenv
import os
from langchain_community.docstore.in_memory import InMemoryDocstore
from pinecone import Pinecone,ServerlessSpec
from langchain_pinecone import PineconeVectorStore
from sentence_transformers import SentenceTransformer

load_dotenv()

embedding_function = SentenceTransformer("intfloat/e5-large-v2")
extracted_texts = extract_text_from_documents()
chunks = chunk_creator(extracted_texts)



pc = Pinecone(api_key=os.getenv("PINECONE_API_KEY"))

index_name = "rag"

def add_to_pinecone(chunks):
    
    existing_indexes = [index.name for index in pc.list_indexes()]
    embeddings = embedding_function.encode(chunks).tolist()
    if index_name not in existing_indexes:
        pc.create_index(
            name=index_name,
            dimension=1024,  
            metric="cosine",
            spec=ServerlessSpec(
                cloud="aws",
                region="us-east-1"
            )
        )
        print(f"Index {index_name} created successfully")
    index = pc.Index(index_name)
    vectors = [
        {"id": f"chunk-{i}", "values": embeddings[i], "metadata": {"text": chunks[i]}}
        for i in range(len(chunks))
    ]
    index.upsert(vectors)
    
   
    
    print(f"Data inserted into Pinecone")
   
    
