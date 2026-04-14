# Multi-Agent LangChain System: Quick Reference & Answers

This package contains 3 files answering your specific questions:

---

## Files in This Package

1. **`multi_agent_minimal.py`** (The working demo)
   - Fully functional, runs immediately
   - No API keys needed
   - Agents are simple Python functions
   - Shows the exact pattern you'd use with LLMs

2. **`multi_agent_example.py`** (Production template)
   - Integrates with LangChain + Claude/OpenAI
   - Shows tool binding, error handling, observability
   - More realistic for real applications
   - Requires: `pip install langchain langchain-openai`

3. **`MULTI_AGENT_ARCHITECTURE.md`** (Detailed explanations)
   - In-depth answer to each of your 6 questions
   - What's included vs deferred and why
   - Trade-off analysis: when to add complexity

---

## Quick Answers to Your 6 Questions

### 1. How do you define agents?

Agents = LLM + tools bound together:

```python
from langchain_core.tools import tool

@tool
def parse_csv(data: str) -> dict:
    """Parse CSV into rows."""
    ...

@tool
def validate_data(data: dict) -> dict:
    """Validate required fields."""
    ...

agent = llm.bind_tools([parse_csv, validate_data])
```

In the minimal example (no LLM):
```python
def agent_1_processor(state: ProcessingState) -> ProcessingState:
    # Do work, update state
    return state
```

**The pattern is the same: function that reads state, does work, returns state.**

---

### 2. How do agents communicate / pass state?

**Use a shared TypedDict:**

```python
class ProcessingState(TypedDict):
    raw_data: str                    # Agent 1 reads
    processed_data: Optional[dict]   # Agent 1 writes, Agent 2 reads
    analysis_results: Optional[dict] # Agent 2 writes, Agent 3 reads
    final_report: Optional[str]      # Agent 3 writes
```

**Execution flow:**
```
orchestrator creates state
  ↓
agent_1_processor(state) → writes processed_data
  ↓
agent_2_analyzer(state) → reads processed_data, writes analysis_results
  ↓
agent_3_reporter(state) → reads analysis_results, writes final_report
  ↓
return state with all results
```

**Not this:**
- Don't have agents call each other (tight coupling)
- Don't return values and pass as arguments (hard to track)
- Don't use global variables (hidden dependencies)

---

### 3. How do you handle if Agent 2 fails partway through?

**Check for failure at each agent boundary:**

```python
def run(self, raw_data: str) -> ProcessingState:
    state = ProcessingState(raw_data=raw_data)
    
    state = agent_1_processor(state)
    if state.get("failed_agent"):  # ← Check
        return state               # ← Stop here
    
    state = agent_2_analyzer(state)
    if state.get("failed_agent"):  # ← Check
        return state               # ← Stop here
    
    state = agent_3_reporter(state)
    return state
```

**Inside each agent:**
```python
def agent_2_analyzer(state: ProcessingState) -> ProcessingState:
    if not state.get("processed_data"):
        state["failed_agent"] = "agent_2_analyzer"  # ← Mark failure
        return state                                # ← Exit cleanly
    
    try:
        # Do work
    except Exception as e:
        state["failed_agent"] = "agent_2_analyzer"  # ← Mark failure
    
    return state
```

**Caller sees:**
```python
result = orchestrator.run(data)
if result["failed_agent"]:
    print(f"Failed at: {result['failed_agent']}")
    print(f"Errors: {result['<agent>_errors']}")
```

**To add retry logic:**
```python
from tenacity import retry, wait_exponential

@retry(wait=wait_exponential(multiplier=1, min=2, max=10))
def agent_2_analyzer_with_retry(state):
    return agent_2_analyzer(state)
```

---

### 4. Where's the orchestration logic?

**In the `run()` method (or `orchestrate()` if you prefer):**

```python
class PipelineOrchestrator:
    def run(self, raw_data: str) -> ProcessingState:
        state = ProcessingState(raw_data=raw_data)
        
        # Line 1: Call Agent 1
        state = agent_1_processor(state)
        if state.get("failed_agent"):
            return state
        
        # Line 2: Call Agent 2
        state = agent_2_analyzer(state)
        if state.get("failed_agent"):
            return state
        
        # Line 3: Call Agent 3
        state = agent_3_reporter(state)
        
        # Optional: log summary
        self._log_summary(state)
        
        return state
```

**This is the entire orchestration logic. 20 lines.**

**For complex workflows, use LangGraph:**
```python
from langgraph.graph import StateGraph

graph = StateGraph(ProcessingState)
graph.add_node("processor", agent_1_processor)
graph.add_node("analyzer", agent_2_analyzer)
graph.add_node("reporter", agent_3_reporter)

graph.add_edge("processor", "analyzer")
graph.add_edge("analyzer", "reporter")

result = graph.compile().invoke({"raw_data": data})
```

---

### 5. What monitoring/observability do you include?

**Minimum (what's shown):**

```python
# 1. Execution trace (what ran)
state["execution_trace"].append(("agent_1_processor", "success"))

# 2. Structured logging
logger.info("AGENT 1: Processed 6 rows")
logger.error(f"AGENT 1: Failed - {e}")

# 3. State contains all errors
state["processing_errors"] = [str(e)]
state["analysis_errors"] = [str(e)]
state["report_errors"] = [str(e)]

# 4. Caller can inspect
if result["failed_agent"]:
    # Debug: which agent failed?
    # When: check execution_trace timestamps
    # Why: check <agent>_errors list
```

**For production, add:**
```python
# Metrics export
from prometheus_client import Counter
pipeline_success = Counter('pipeline_success', 'Successful runs')
pipeline_success.inc()

# Event logging to cloud
import boto3
cloudwatch = boto3.client('cloudwatch')
cloudwatch.put_metric_data(Namespace='MyApp', MetricData=[...])

# Structured logging
import structlog
structlog.get_logger().info(
    "pipeline_complete",
    duration_ms=elapsed_ms,
    success=True,
    trace=execution_trace
)
```

---

### 6. What do you explicitly skip and why?

**We skip these on purpose (add when you need them):**

| Feature | Why Skip | Add When |
|---------|----------|----------|
| **Retry/backoff** | Sequential is good enough initially | Agents fail transiently (rate limits, network) |
| **Caching** | No repeated computations here | Same data analyzed 1000s of times |
| **Async/parallel** | Sequential is simpler. Agents are CPU-bound here | Agents call external APIs (I/O bound) |
| **Input validation** | TypedDict + duck typing works | Untrusted input from external APIs |
| **Human review** | Not needed for automation | Medical/legal decisions |
| **Dashboard** | Logs are queryable with grep | 1000s of pipelines running |
| **Checkpointing** | Pipeline runs in seconds | Agents take hours/cost $$$ |
| **Dead letter queue** | Synchronous, not high-volume | Running millions of jobs |
| **Dynamic routing** | Fixed order is clear | 10+ agents with conditional logic |
| **ReAct loops** | LangGraph handles it | Need agentic reasoning |

**Honest take:** Start with what's in the minimal example. Log problems. Add complexity only when you feel the pain.

---

## Running the Examples

### Run the minimal version (no dependencies):
```bash
python multi_agent_minimal.py
```

Output: Full pipeline trace + report

### Run the production template:
```bash
# First install
pip install langchain langchain-openai

# Set API key
export OPENAI_API_KEY="your_key_here"

# Run
python multi_agent_example.py
```

---

## The Architecture, Visualized

```
INPUT: raw_data
  │
  ├─→ agent_1_processor
  │     Reads: raw_data
  │     Writes: processed_data
  │     On error: sets failed_agent="agent_1_processor" → STOP
  │
  ├─→ agent_2_analyzer
  │     Reads: processed_data
  │     Writes: analysis_results
  │     On error: sets failed_agent="agent_2_analyzer" → STOP
  │
  ├─→ agent_3_reporter
  │     Reads: analysis_results
  │     Writes: final_report
  │     On error: sets failed_agent="agent_3_reporter" → STOP
  │
  └─→ RETURN: ProcessingState
        ├─ processed_data
        ├─ analysis_results
        ├─ final_report
        ├─ execution_trace (who ran when)
        └─ failed_agent (if failed)
```

---

## Copy-Paste Starting Point

For your own project:

```python
from typing_extensions import TypedDict
from typing import Optional
import logging

logger = logging.getLogger(__name__)

# 1. Define state
class YourState(TypedDict):
    input: str
    agent_1_output: Optional[dict]
    agent_2_output: Optional[dict]
    final_output: Optional[str]
    execution_trace: list
    failed_agent: Optional[str]

# 2. Define agents
def agent_1(state: YourState) -> YourState:
    try:
        state["agent_1_output"] = process(state["input"])
        state["execution_trace"].append(("agent_1", "success"))
    except Exception as e:
        state["failed_agent"] = "agent_1"
        logger.error(f"Agent 1: {e}")
        state["execution_trace"].append(("agent_1", "failed"))
    return state

def agent_2(state: YourState) -> YourState:
    if not state.get("agent_1_output"):
        state["failed_agent"] = "agent_2"
        return state
    try:
        state["agent_2_output"] = analyze(state["agent_1_output"])
        state["execution_trace"].append(("agent_2", "success"))
    except Exception as e:
        state["failed_agent"] = "agent_2"
        logger.error(f"Agent 2: {e}")
        state["execution_trace"].append(("agent_2", "failed"))
    return state

# 3. Orchestrate
def run_pipeline(input: str) -> YourState:
    state = YourState(
        input=input,
        agent_1_output=None,
        agent_2_output=None,
        final_output=None,
        execution_trace=[],
        failed_agent=None
    )
    
    state = agent_1(state)
    if state["failed_agent"]:
        return state
    
    state = agent_2(state)
    if state["failed_agent"]:
        return state
    
    return state

# 4. Use it
result = run_pipeline("my input")
print(result["execution_trace"])  # Who ran
if result["failed_agent"]:
    print(f"Failed at: {result['failed_agent']}")
else:
    print(f"Success: {result['final_output']}")
```

**That's it. That's the entire pattern.**

---

## Key Takeaways

1. **Agents are functions** that read from state, do work, write back to state
2. **State is the contract** - all agents agree on its shape (TypedDict)
3. **Orchestration is simple** - call agents in order, check for failure
4. **Error handling is explicit** - flag in state, not exceptions
5. **Observability is built-in** - execution_trace + structured logs
6. **Add complexity only when you need it** - start minimal, expand as pain increases

The minimal example has everything you need. The full example shows where to add sophistication. The architecture doc explains the trade-offs.

Choose based on your needs:
- **Learning**: Use `multi_agent_minimal.py`
- **Prototyping**: Add retry logic, better logging
- **Production**: Full `multi_agent_example.py` + monitoring
