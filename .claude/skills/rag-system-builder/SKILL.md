---
name: rag-system-builder
description: '**WORKFLOW SKILL** — Create and debug RAG systems, implement vector databases and data pipelines. USE FOR: building retrieval-augmented generation applications, setting up vector stores, implementing data ingestion pipelines, integrating embeddings and LLMs, debugging RAG performance. DO NOT USE FOR: general ML tasks, non-RAG AI systems, database administration without RAG context.'
---

# RAG System Builder

## Overview
This skill guides you through creating end-to-end Retrieval-Augmented Generation (RAG) systems using Python and LangChain. It covers vector databases, data pipelines, embeddings, retrieval strategies, and LLM integration with code examples and debugging workflows.

## Prerequisites
- Python 3.8+
- Basic understanding of vector databases and embeddings
- Access to embedding models (OpenAI, HuggingFace, etc.)
- LLM API access (OpenAI, Anthropic, etc.)

## Workflow Steps

### 1. Requirements Assessment
**Goal**: Define system requirements and constraints.

- Identify data sources (documents, APIs, databases)
- Determine use case (Q&A, chat, summarization)
- Assess scale (documents count, query volume, latency requirements)
- Choose technology stack (vector DB, embedding model, LLM)

**Actions**:
- Analyze data formats and volumes
- Evaluate embedding model requirements (dimensions, performance)
- Select appropriate vector database based on scale

### 2. Vector Database Setup
**Goal**: Set up and configure the vector database.

**Supported Databases**:
- Pinecone (cloud)
- Weaviate (self-hosted)
- Chroma (local)
- Qdrant (self-hosted)
- FAISS (local/in-memory)

**Actions**:
- Install required packages (`pip install langchain pinecone-client weaviate-client chromadb qdrant-client faiss-cpu`)
- Create database connection and collections
- Configure indexing parameters (dimensions, metrics)
- Set up authentication and connection strings

**Example - Chroma Setup**:
```python
from langchain.vectorstores import Chroma
from langchain.embeddings import OpenAIEmbeddings

# Initialize embeddings
embeddings = OpenAIEmbeddings()

# Create Chroma vector store
vectorstore = Chroma(
    collection_name="my_docs",
    embedding_function=embeddings,
    persist_directory="./chroma_db"
)
```

**Example - Pinecone Setup**:
```python
import pinecone
from langchain.vectorstores import Pinecone

# Initialize Pinecone
pinecone.init(api_key="your-api-key", environment="us-west1-gcp")
index_name = "rag-index"

# Create index if it doesn't exist
if index_name not in pinecone.list_indexes():
    pinecone.create_index(
        name=index_name,
        dimension=1536,  # OpenAI ada-002 dimensions
        metric="cosine"
    )

# Connect to vector store
vectorstore = Pinecone.from_existing_index(
    index_name=index_name,
    embedding=embeddings
)
```

### 3. Data Pipeline Implementation
**Goal**: Build data ingestion and processing pipeline.

**Components**:
- Document loaders (PDF, web, databases)
- Text splitters and chunking strategies
- Metadata extraction and enrichment
- Batch processing and error handling

**Actions**:
- Implement document loading with `DirectoryLoader`, `WebBaseLoader`, etc.
- Configure text splitters (`RecursiveCharacterTextSplitter`, `MarkdownHeaderTextSplitter`)
- Add preprocessing (cleaning, deduplication)
- Create pipeline orchestration (sequential, parallel processing)

**Example - Document Loading Pipeline**:
```python
from langchain.document_loaders import DirectoryLoader, PyPDFLoader
from langchain.text_splitter import RecursiveCharacterTextSplitter
from langchain.schema import Document

def load_and_split_documents(directory_path: str) -> list[Document]:
    # Load documents
    loader = DirectoryLoader(
        directory_path,
        glob="**/*.pdf",
        loader_cls=PyPDFLoader
    )
    documents = loader.load()
    
    # Split documents
    text_splitter = RecursiveCharacterTextSplitter(
        chunk_size=1000,
        chunk_overlap=200,
        length_function=len
    )
    
    splits = text_splitter.split_documents(documents)
    return splits
```

### 4. Embedding Integration
**Goal**: Generate and store vector embeddings.

**Embedding Options**:
- OpenAI embeddings (`text-embedding-ada-002`)
- HuggingFace models (sentence-transformers)
- Cohere embeddings
- Custom models

**Actions**:
- Initialize embedding model
- Generate embeddings for document chunks
- Store embeddings in vector database
- Implement batch processing for large datasets

**Example - Batch Embedding Generation**:
```python
from langchain.embeddings import OpenAIEmbeddings
from langchain.vectorstores import Chroma
import numpy as np

def batch_embed_and_store(documents, batch_size=100):
    embeddings = OpenAIEmbeddings()
    vectorstore = Chroma(embedding_function=embeddings)
    
    # Process in batches
    for i in range(0, len(documents), batch_size):
        batch = documents[i:i + batch_size]
        vectorstore.add_documents(batch)
        print(f"Processed {i + len(batch)} documents")
    
    return vectorstore
```

### 5. Retrieval System
**Goal**: Implement document retrieval logic.

**Strategies**:
- Similarity search (cosine, euclidean)
- MMR (Maximal Marginal Relevance)
- Hybrid search (keyword + vector)
- Multi-query retrieval
- Parent-child document retrieval

**Actions**:
- Configure retrievers (`VectorStoreRetriever`, `BM25Retriever`)
- Implement query preprocessing (expansion, rewriting)
- Add filtering and metadata-based retrieval
- Optimize retrieval parameters (k, score thresholds)

**Example - Advanced Retrieval Setup**:
```python
from langchain.retrievers import MultiQueryRetriever
from langchain.chains import RetrievalQA
from langchain.llms import OpenAI

# Create multi-query retriever for better recall
retriever = MultiQueryRetriever.from_llm(
    retriever=vectorstore.as_retriever(search_kwargs={"k": 5}),
    llm=OpenAI(temperature=0)
)

# Create QA chain
qa_chain = RetrievalQA.from_chain_type(
    llm=OpenAI(),
    chain_type="stuff",
    retriever=retriever,
    return_source_documents=True
)
```

### 6. LLM Integration
**Goal**: Connect retrieval to language model generation.

**Integration Patterns**:
- Stuffing (all docs in context)
- Map-reduce (summarize then combine)
- Refine (iterative refinement)
- Map-rerank (re-rank retrieved docs)

**Actions**:
- Set up LLM chains (`RetrievalQA`, `ConversationalRetrievalChain`)
- Configure prompt templates
- Implement conversation memory
- Add source attribution and citations

**Advanced Integration Patterns**:

**Conversational RAG**:
```python
from langchain.memory import ConversationBufferMemory
from langchain.chains import ConversationalRetrievalChain

memory = ConversationBufferMemory(
    memory_key="chat_history",
    return_messages=True
)

conversational_chain = ConversationalRetrievalChain.from_llm(
    llm=OpenAI(),
    retriever=retriever,
    memory=memory,
    return_source_documents=True
)
```

**Agent-based RAG**:
```python
from langchain.agents import initialize_agent, Tool
from langchain.agents import AgentType

# Create retrieval tool
retrieval_tool = Tool(
    name="Document Search",
    func=lambda q: retriever.get_relevant_documents(q),
    description="Search through documents for relevant information"
)

# Initialize agent
agent = initialize_agent(
    tools=[retrieval_tool],
    llm=OpenAI(),
    agent=AgentType.ZERO_SHOT_REACT_DESCRIPTION,
    verbose=True
)
```

**Streaming RAG**:
```python
from langchain.callbacks.streaming_stdout import StreamingStdOutCallbackHandler

llm = OpenAI(
    streaming=True,
    callbacks=[StreamingStdOutCallbackHandler()]
)

qa_chain = RetrievalQA.from_chain_type(
    llm=llm,
    chain_type="stuff",
    retriever=retriever
)
```

### 7. Testing and Debugging
**Goal**: Validate system performance and fix issues.

**Testing Areas**:
- Retrieval accuracy (precision, recall)
- Generation quality (relevance, hallucinations)
- Latency and throughput
- Edge cases (no relevant docs, ambiguous queries)

**Debugging Tools**:
- Query tracing and logging
- Embedding visualization
- Performance profiling
- A/B testing frameworks

**Actions**:
- Create test datasets and evaluation metrics
- Implement logging and monitoring
- Profile bottlenecks (embedding time, retrieval latency)
- Tune parameters based on evaluation results

**Debugging Workflow**:

**Step 1: Enable Logging**
```python
import logging
logging.basicConfig(level=logging.DEBUG)

# Enable LangChain debug mode
import langchain
langchain.debug = True
```

**Step 2: Test Retrieval Quality**
```python
def evaluate_retrieval(query, expected_docs):
    retrieved = retriever.get_relevant_documents(query)
    retrieved_ids = {doc.metadata.get('id') for doc in retrieved}
    expected_ids = set(expected_docs)
    
    precision = len(retrieved_ids & expected_ids) / len(retrieved_ids)
    recall = len(retrieved_ids & expected_ids) / len(expected_ids)
    
    return {"precision": precision, "recall": recall}
```

**Step 3: Profile Performance**
```python
import time
import cProfile

def profile_query(query):
    start_time = time.time()
    result = qa_chain({"query": query})
    end_time = time.time()
    
    print(f"Query time: {end_time - start_time:.2f}s")
    return result
```

**Step 4: Visualize Embeddings**
```python
from sklearn.manifold import TSNE
import matplotlib.pyplot as plt

def visualize_embeddings(documents):
    embeddings = OpenAIEmbeddings()
    vectors = embeddings.embed_documents([doc.page_content for doc in documents])
    
    tsne = TSNE(n_components=2, random_state=42)
    reduced_vectors = tsne.fit_transform(vectors)
    
    plt.scatter(reduced_vectors[:, 0], reduced_vectors[:, 1])
    plt.show()
```

**Common Issues & Fixes**:

**Low Retrieval Accuracy**:
- Check embedding model quality - try different models
- Adjust chunk size and overlap - experiment with 500-2000 chars
- Implement query expansion - use MultiQueryRetriever
- Use hybrid search - combine BM25 with vector search

**High Latency**:
- Optimize vector database - use approximate search
- Implement caching - cache frequent queries
- Use approximate nearest neighbors - HNSW indexing
- Profile and optimize - identify bottlenecks

**Hallucinations**:
- Improve retrieval quality - better chunking strategies
- Add source verification - include source citations
- Use better prompts - specify "answer based only on provided context"
- Implement fact-checking - cross-reference multiple sources

**Memory Issues**:
- Use smaller batch sizes for embedding
- Implement streaming for large documents
- Use disk-based vector stores for large datasets
- Optimize memory usage in text splitting

### 8. Deployment and Monitoring
**Goal**: Deploy system and set up monitoring.

**Deployment Options**:
- Cloud services (AWS, GCP, Azure)
- Containerized (Docker, Kubernetes)
- Serverless functions
- Local deployment

**Monitoring**:
- Performance metrics (latency, throughput)
- Quality metrics (accuracy, user satisfaction)
- System health (uptime, error rates)
- Cost tracking (API usage, storage)

**Actions**:
- Containerize application
- Set up CI/CD pipelines
- Implement monitoring dashboards
- Configure alerting and logging

**Example - Docker Deployment**:
```dockerfile
FROM python:3.9-slim

WORKDIR /app
COPY requirements.txt .
RUN pip install -r requirements.txt

COPY . .
EXPOSE 8000

CMD ["uvicorn", "app:app", "--host", "0.0.0.0", "--port", "8000"]
```

**Example - FastAPI App**:
```python
from fastapi import FastAPI
from pydantic import BaseModel

app = FastAPI()

class Query(BaseModel):
    question: str

@app.post("/ask")
async def ask_question(query: Query):
    result = qa_chain({"query": query.question})
    return {
        "answer": result["result"],
        "sources": [doc.metadata for doc in result["source_documents"]]
    }
```

## Common Patterns

### Quick RAG Setup
For simple use cases:
1. Use Chroma for local vector storage
2. OpenAI embeddings and GPT models
3. Basic directory loader
4. Standard retrieval QA chain

### Production RAG
For scalable systems:
1. Pinecone or Weaviate for vector storage
2. Custom embedding models
3. Advanced chunking and preprocessing
4. Hybrid retrieval with reranking
5. Comprehensive monitoring

### Multi-Modal RAG
For images/documents:
1. Use CLIP embeddings for images
2. Combine text and image retrieval
3. Multi-modal LLM integration
4. Cross-modal retrieval

## Tools and Technologies

**Core Libraries**:
- LangChain: Framework for RAG applications
- LlamaIndex: Alternative RAG framework
- Vector Databases: Pinecone, Weaviate, Chroma, Qdrant, FAISS

**Supporting Tools**:
- HuggingFace Transformers: Custom embeddings
- Streamlit/Gradio: UI for testing
- Weights & Biases: Experiment tracking
- LangSmith: Debugging and monitoring
- Docker: Containerization
- Kubernetes: Orchestration

## Next Steps
Once the skill is finalized, try these example prompts:
- "/rag-system-builder Create a RAG system for customer support docs using Chroma and OpenAI"
- "/rag-system-builder Debug why my RAG system is returning irrelevant results"
- "/rag-system-builder Add streaming responses to my existing RAG implementation"