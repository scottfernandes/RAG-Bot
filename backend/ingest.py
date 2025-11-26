import os
import re
from PyPDF2 import PdfReader
from langchain_text_splitters import CharacterTextSplitter

def extract_text_from_pdf(file_path: str) -> str:
    try:
        reader = PdfReader(file_path)
        if reader.is_encrypted:
            try:
                reader.decrypt("")
            except Exception:
                return ""
        text = []
        for i, page in enumerate(reader.pages):
            content = page.extract_text()
            if content:
                content = re.sub(r'\s+', ' ', content.strip())
                text.append(f"--- Page {i+1} --- {content}")
        extracted_text = " ".join(text).strip()
        print(f"Extracted PDF: {file_path} ({len(extracted_text)} chars)")
        return extracted_text
    except Exception as e:
        print(f"[ERROR] Failed to extract PDF {file_path}: {e}")
        return ""

def extract_text_from_txt(file_path: str) -> str:
    try:
        with open(file_path, "r", encoding="utf-8", errors="ignore") as f:
            text = f.read()
        clean_text = re.sub(r'\s+', ' ', text.strip())
        print(f"Extracted TXT: {file_path} ({len(clean_text)} chars)")
        return clean_text
    except Exception as e:
        print(f"[ERROR] Failed to read text file {file_path}: {e}")
        return ""

def extract_text_from_documents(data_dir: str = "data") -> list[str]:
    extracted_data = []
    for root, _, files in os.walk(data_dir):
        for file in files:
            ext = os.path.splitext(file)[-1].lower()
            path = os.path.join(root, file)
            if ext == ".pdf":
                text = extract_text_from_pdf(path)
            elif ext in [".txt", ".md"]:
                text = extract_text_from_txt(path)
            else:
                continue
            if text:
                extracted_data.append(text)
            else:
                print(f"Skipped empty: {file}")
    return extracted_data

def chunk_creator(extracted_data_list: list[str]) -> list[str]:
    text_splitter = CharacterTextSplitter.from_tiktoken_encoder(
        encoding_name="cl100k_base",
        chunk_size=1000,
        chunk_overlap=100
    )

    all_chunks = []
    for i, extracted_text in enumerate(extracted_data_list):
        if not extracted_text.strip():
            continue
        chunks = text_splitter.split_text(extracted_text)
        tagged_chunks = [f"[DOC {i+1}] {chunk}" for chunk in chunks]
        all_chunks.extend(tagged_chunks)
    return all_chunks

