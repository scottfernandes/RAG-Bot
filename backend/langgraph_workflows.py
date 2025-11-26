from langchain.chat_models import init_chat_model
from dotenv import load_dotenv
from typing_extensions import TypedDict, List,Annotated
from langgraph.graph import StateGraph, START, END,add_messages
from langchain_core.prompts import ChatPromptTemplate
from langgraph.checkpoint.memory import MemorySaver
from langchain_core.runnables import RunnableConfig
from langchain_core.messages import AIMessage, HumanMessage, SystemMessage
from langchain_huggingface import HuggingFaceEmbeddings
import os
from langchain_community.embeddings import SentenceTransformerEmbeddings
import time
from tools import retrieve_from_pinecone
load_dotenv()

llm = init_chat_model("llama-3.1-8b-instant", model_provider="groq")
config= {"configurable": {"thread_id": "1"}}

model = SentenceTransformerEmbeddings(model_name="intfloat/e5-large-v2")
checkpointer=MemorySaver()  

class State(TypedDict):
    messages: Annotated[list,add_messages]
    query:str
    context:str

workflow = StateGraph(State)

def retrieve_context(state: State):
    query = state["query"]
    combined_context=' '
    try:
        pinecone_context = retrieve_from_pinecone(query)
        
        if pinecone_context and pinecone_context.strip():
            combined_context += f"Knowledge Base:\n{pinecone_context}\n\n"
    except Exception as e:
        print(f"Pinecone error: {e}")
    return {"context":pinecone_context}


prompt_template = ChatPromptTemplate.from_messages(
    [
        SystemMessage(
            content="You are a helpful assistant. Answer all questions to the best of your ability."
        )
    ]
)

def generate_ans(state: State):
    
    system_prompt = (
        "You are a helpful assistant. Answer questions based on the provided context "
        "and conversation history. If the context doesn't contain relevant information, "
        "say so honestly.\n\n"
        f"Context:\n{state['context']}\n\n"
        "Now answer the user's question based on this context."
    )

    messages = [SystemMessage(content=system_prompt)] + state["messages"]
    start = time.time()
    result= llm.invoke(messages)
    end = (time.time() - start)*1000
    print(f"LLM Latency:{end:.2f}")
    return {"messages":[AIMessage(content=result.content)]}

workflow.add_node("retriever", retrieve_context)
workflow.add_node("generate_ans", generate_ans)

workflow.add_edge(START, "retriever")
workflow.add_edge("retriever", "generate_ans")
workflow.add_edge("generate_ans",END)

chain = workflow.compile(checkpointer=checkpointer)

async def get_rag_ans(query: str):
    
    async for event in chain.astream({
        "messages": [HumanMessage(content=query)],
        "query": query,
        "context": "",
    }, config):
        for node_name, node_output in event.items():
            if node_name == "generate_ans" and "messages" in node_output:
                ai_messages = [msg for msg in node_output["messages"] if isinstance(msg, AIMessage)]
                if ai_messages:
                    yield ai_messages[-1].content