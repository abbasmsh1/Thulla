# Multi-Agent LangChain Architecture: Direct Answers

This document answers your 6 specific questions about the working example in `multi_agent_example.py`.

---

## 1. How do you define the agents?

**Answer: Agents are functions that wrap an LLM + tools**

```python
def create_processor_agent(llm):
    @tool
    def parse_csv(data: str) -> dict:
        # Implementation
        
    @tool
    def validate_data(data: dict) -> dict:
        # Implementation
    
    tools = [parse_csv, validate_data]
    return llm.bind_tools(tools)  # Agent = LLM + bound tools
```

**Key insight**: You don't instantiate "Agent" objects. You bind an LLM to a set of tools. The LLM decides when/how to call them. That's the agent.

**Minimum working pattern**:
- 1 LLM instance (Claude, GPT-4, etc.)
- N tool functions decorated with `@tool`
- Call `llm.bind_tools(tools)` → you have an agent

**What happens at runtime**:
```
prompt: "Here are tools: parse_csv, validate_data. Use them to process this data."
  ↓
LLM decides: "I should call parse_csv first"
  ↓
Tool execution: parse_csv() runs
  ↓
Result back to LLM: "Here's what parse_csv returned"
  ↓
LLM decides: "Now call validate_data"
  ↓
Repeat until LLM says "I'm done"
```

---

## 2. How do agents communicate / pass state?

**Answer: Shared TypedDict (the critical pattern)**

```python
class ProcessingState(TypedDict):
    raw_data: str                      # Input
    processed_data: Optional[dict]     # Agent 1 writes, Agent 2 reads
    analysis_results: Optional[dict]   # Agent 2 writes, Agent 3 reads
    execution_trace: list              # Everyone reads/writes
```

**This is the contract**. All agents know this shape.

**Execution flow**:
```
Orchestrator creates state:
  ProcessingState(raw_data="csv,data,here", processed_data=None, ...)
    ↓
Agent 1 runs, updates state:
  state["processed_data"] = {...}
    ↓
State passes to Agent 2:
  Agent 2 reads state["processed_data"]
  Agent 2 reads state["raw_data"]  (if needed)
  Agent 2 writes state["analysis_results"]
    ↓
State passes to Agent 3:
  Agent 3 reads state["analysis_results"]
  Agent 3 writes state["final_report"]
```

**Why this works**:
- Agents don't call each other directly (loose coupling)
- State is explicit - you can inspect it, log it, save it
- Easy to debug: "What did Agent 2 get from Agent 1?"
- Easy to parallelize: If Agent 2 and 3 don't depend on each other, run them simultaneously

**Alternative approaches (and why not)**:
- ❌ Agents return results, next agent takes it as input: brittle, hard to track
- ❌ Agents call each other directly: tight coupling, hard to test
- ❌ Global dict/Redis: Works, but hidden dependencies, hard to reason about

---

## 3. How do you handle if Agent 2 fails partway through?

**Answer: Check state at each agent transition, stop pipeline if failed**

```python
def run(self, raw_data: str) -> ProcessingState:
    state = ProcessingState(raw_data=raw_data)
    
    # Step 1
    state = self._run_processor(state)
    if state.get("failed_agent"):  # ← Check for failure
        return state  # Stop, don't call Agent 2
    
    # Step 2
    state = self._run_analyzer(state)
    if state.get("failed_agent"):  # ← Check again
        return state  # Stop, don't call Agent 3
    
    # Step 3
    state = self._run_reporter(state)
    
    return state
```

**Inside each agent**:
```python
def _run_analyzer(self, state: ProcessingState) -> ProcessingState:
    if not state.get("processed_data"):
        state["failed_agent"] = "analyzer"
        state["analysis_errors"] = ["No data from Agent 1"]
        return state  # Early return = stop
    
    try:
        # Do work
        state["analysis_results"] = {...}
    except Exception as e:
        state["failed_agent"] = "analyzer"
        state["analysis_errors"] = [str(e)]
        # Don't raise - return state with error flag
    
    return state
```

**What caller sees**:
```python
result = orchestrator.run(data)
if result.get("failed_agent"):
    print(f"Pipeline stopped at {result['failed_agent']}")
    print(f"Error: {result['analysis_errors']}")
else:
    print(f"Success: {result['final_report']}")
```

**Retry logic (what you'd add)**:
```python
if state.get("failed_agent") == "analyzer":
    state["should_retry"] = True
    state["retry_count"] = state.get("retry_count", 0) + 1
    if state["retry_count"] < 3:
        return self._run_analyzer(state)  # Retry
```

**Honest trade-off**: This example doesn't include:
- Exponential backoff (use `tenacity` library)
- Circuit breakers (use `pybreaker`)
- Dead letter queue (use Celery + Redis)

Add when you know failure modes. Start simple.

---

## 4. Where's the orchestration logic?

**Answer: In the `AgentOrchestrator` class, specifically `run()` method**

This is the "main" logic that decides:
1. **Who runs** (Agent 1, then 2, then 3)
2. **In what order** (sequential, not parallel)
3. **With what data** (State flows through)
4. **On what conditions** (If no errors)

```python
class AgentOrchestrator:
    def run(self, raw_data: str) -> ProcessingState:
        state = ProcessingState(raw_data=raw_data)
        
        # Line 1: Call Agent 1
        state = self._run_processor(state)
        if state.get("failed_agent"):
            return state
        
        # Line 2: Call Agent 2
        state = self._run_analyzer(state)
        if state.get("failed_agent"):
            return state
        
        # Line 3: Call Agent 3
        state = self._run_reporter(state)
        
        return state
```

**This is 20 lines and contains the entire orchestration logic.** Everything else is detail.

**Where order/logic could get complex**:
```python
# Example: conditional routing
if state.get("analysis_results", {}).get("needs_review"):
    state = self._run_human_reviewer(state)
    
# Example: retry with backoff
max_retries = 3
for attempt in range(max_retries):
    state = self._run_analyzer(state)
    if not state.get("failed_agent"):
        break
    time.sleep(2 ** attempt)

# Example: parallel agents
import concurrent.futures
with concurrent.futures.ThreadPoolExecutor() as executor:
    future2 = executor.submit(self._run_analyzer, state)
    future3 = executor.submit(self._run_reporter, state)
    state = future2.result()
    state = future3.result()
```

**For 3 sequential agents: 20 lines. For complex workflows: use LangGraph.**

---

## 5. What monitoring/observability do you include?

**Answer: Structured logging + execution trace**

### Execution Trace (what happened)
```python
state["execution_trace"] = [
    ("processor", "success"),
    ("analyzer", "success"),
    ("reporter", "success")
]
```

Result:
```
Execution trace: [('processor', 'success'), ('analyzer', 'success'), ('reporter', 'success')]
```

### Structured Logging (when it happened + why)
```python
self.logger.info("Starting Data Processor Agent")
# logs: "2024-04-14 10:23:45 - orchestrator - INFO - Starting Data Processor Agent"

self.logger.error(f"Processor error: {e}", exc_info=True)
# logs full stack trace
```

### Event Recording (for monitoring dashboards)
```python
def _record_event(self, event: str, state: ProcessingState):
    self.execution_events.append({
        "event": event,
        "timestamp": ...,
        "state_keys": list(state.keys())
    })

# Result: list of {"event": "processor_start", "timestamp": "2024-04-14T10:23:45", ...}
```

### Summary at End (high-level health check)
```python
def _log_execution_summary(self, state: ProcessingState):
    summary = {
        "trace": state["execution_trace"],
        "success": state.get("failed_agent") is None,
        "error_count": sum(len(e or []) for e in [...])
    }
    self.logger.info(f"Summary: {summary}")
```

**What this enables**:
- ✅ Debug: "Which agent failed? At what step?"
- ✅ Alerts: Parse logs for `"failed_agent"`, send PagerDuty alert
- ✅ Metrics: Count successful runs vs errors
- ✅ Tracing: Replay execution with `execution_trace`

**What you'd add for production**:
```python
# Send to Datadog
from datadog import initialize, api
initialize(api_key="xxx")
api.Event.create(title="Pipeline complete", text=json.dumps(summary))

# Or CloudWatch
import boto3
cloudwatch = boto3.client('cloudwatch')
cloudwatch.put_metric_data(
    Namespace='MyApp/Pipeline',
    MetricData=[{'MetricName': 'SuccessCount', 'Value': 1}]
)

# Or Prometheus
from prometheus_client import Counter
pipeline_success = Counter('pipeline_success', 'Successful pipeline runs')
pipeline_success.inc()
```

---

## 6. What do you explicitly skip and why?

### Skip #1: ReAct Agentic Loops
**What it is**: Agent calls tool → sees result → calls another tool → repeat until done

**Shown in example**: Simplified version (single tool call)

**Why skip**: LangGraph handles this for you. For your first implementation, just understand that agents call tools iteratively. You don't need to code the loop.

**Add when**: You want true reasoning. Agent needs to think through multi-step problems.

```python
# This is what you DON'T need to write:
while not done:
    response = llm.call(f"Here are your tools: {tools}. Previous result: {result}")
    if tool_call in response:
        result = execute_tool(tool_call)
    else:
        done = True
# LangGraph does this for you. Just use langgraph.graph.StateGraph
```

### Skip #2: Retry with Backoff
**What it is**: If Agent 2 fails, wait 1s, try again. If fails, wait 2s, try again.

**Shown in example**: Error logging

**Why skip**: Add complexity. Start with "fail fast, log it, move on."

**Add when**: You know specific agents fail transiently (API rate limits, network flakes)

```python
# Use tenacity library (3 lines of code)
from tenacity import retry, wait_exponential

@retry(wait=wait_exponential(multiplier=1, min=2, max=10))
def _run_analyzer(self, state):
    ...
```

### Skip #3: Caching
**What it is**: "We've analyzed this data before. Reuse the result."

**Shown in example**: Nothing

**Why skip**: No repeated calls in this example. State already prevents recomputation within a run.

**Add when**: Agents process similar data repeatedly. Use Redis or LRU cache.

```python
from functools import lru_cache

@lru_cache(maxsize=100)
def analyze_data(data_hash: str) -> dict:
    # Only runs if data_hash not seen before
    ...
```

### Skip #4: Input Validation Schemas
**What it is**: Pydantic models that verify data at each agent boundary

**Shown in example**: TypedDict (type hints only)

**Why skip**: Assumes data quality. Add validation if untrusted input.

**Add when**: State comes from external API, user input, or unreliable source

```python
from pydantic import BaseModel, validator

class AnalysisInput(BaseModel):
    processed_data: dict
    
    @validator('processed_data')
    def check_has_rows(cls, v):
        if not v.get('rows'):
            raise ValueError('No rows in processed data')
        return v

# Then at Agent 2 start:
input = AnalysisInput(processed_data=state["processed_data"])
```

### Skip #5: Async / Parallel Execution
**What it is**: Run Agents 2 & 3 simultaneously (they don't depend on each other if Agent 2 finishes)

**Shown in example**: Sequential (Agent 1 → Agent 2 → Agent 3)

**Why skip**: Sequential is easier to understand. Parallelism adds complexity (race conditions, thread safety).

**Add when**: Agents are I/O bound (calling external APIs). Use `asyncio` or `concurrent.futures`.

```python
import asyncio

async def run_async(self, raw_data: str):
    state = await self._run_processor(raw_data)
    
    # Run Agents 2 & 3 in parallel
    tasks = [
        asyncio.create_task(self._run_analyzer(state)),
        asyncio.create_task(self._run_reporter(state))
    ]
    results = await asyncio.gather(*tasks)
    
    return results
```

### Skip #6: Human-in-the-Loop
**What it is**: "Before Agent 3, ask human to approve Agent 2's work"

**Shown in example**: Fully automated

**Why skip**: Not needed for automation. Add complexity.

**Add when**: Domain requires expert review (medical, legal, financial)

```python
def _run_analyzer(self, state):
    state = self._analyzer_agent.run(state)
    
    # NEW: Get human approval
    approval = input(f"Approve analysis? {state['analysis_results']}: [y/n] ")
    if approval != 'y':
        state["analysis_approved"] = False
        return state
    
    state["analysis_approved"] = True
    return state

def _run_reporter(self, state):
    if not state.get("analysis_approved"):
        state["failed_agent"] = "reporter"
        state["report_errors"] = ["Analysis not approved by human"]
        return state
    # Continue...
```

### Skip #7: Monitoring Dashboard
**What it is**: Real-time UI showing "Agent 1 running... Agent 2 done... Agent 3 running..."

**Shown in example**: Logs + summary dict

**Why skip**: Overkill for starting out. Logs are queryable.

**Add when**: This runs on thousands of machines. Need visibility into failures.

```python
# Add simple HTTP endpoint that returns summary
from fastapi import FastAPI
app = FastAPI()

@app.get("/pipeline/status")
def status():
    return {
        "trace": orchestrator.execution_events[-10:],  # Last 10 runs
        "success_rate": success_count / total_count
    }
```

### Skip #8: Checkpoints / Rollback
**What it is**: Save state after each agent. If Agent 2 fails repeatedly, restart from Agent 1's output without re-running it.

**Shown in example**: No checkpointing

**Why skip**: Pipeline completes in seconds. Not worth it.

**Add when**: Agents are expensive (cost $$$) or take hours.

```python
# Pseudo-code
checkpoint_path = f"/checkpoints/run_{run_id}"

state = self._run_processor(state)
save_checkpoint(checkpoint_path, "processor", state)

state = self._run_analyzer(state)
save_checkpoint(checkpoint_path, "analyzer", state)

# On retry, load last checkpoint and continue from there
```

### Skip #9: Dead Letter Queue
**What it is**: Automatic retry of failed jobs later (Celery + Redis)

**Shown in example**: Just logs the failure

**Why skip**: Synchronous example. No job queue.

**Add when**: Running millions of pipelines. Need reliability layer.

```python
from celery import Celery

app = Celery('pipeline')

@app.task(bind=True, max_retries=3)
def run_pipeline(self, raw_data: str):
    try:
        result = orchestrator.run(raw_data)
        if result.get("failed_agent"):
            # Retry in 60s
            raise self.retry(exc=Exception("Pipeline failed"), countdown=60)
        return result
    except Exception as exc:
        raise self.retry(exc=exc, countdown=60)
```

### Skip #10: Agent Routing (Dynamic Decisions)
**What it is**: LLM decides "After analysis, should I run Agent 3 or Agent 4 or neither?"

**Shown in example**: Fixed pipeline (always run all 3)

**Why skip**: Only useful if you have 10+ agents. For 3 agents, hardcode order.

**Add when**: Complex workflows. Use LangGraph's conditional edge.

```python
def route_after_analysis(state):
    if state["analysis_results"]["needs_deeper_review"]:
        return "deep_analyzer"
    elif state["analysis_results"]["is_simple"]:
        return "simple_reporter"
    else:
        return "standard_reporter"

# LangGraph: add_conditional_edges(source, route_after_analysis, ...)
```

---

## Summary Table: What's In vs Out

| Feature | Example | Complexity | Add When |
|---------|---------|-----------|----------|
| Agents + tools | ✅ | Low | Always |
| Shared state (TypedDict) | ✅ | Low | Always |
| Error catching | ✅ | Low | Always |
| Sequential orchestration | ✅ | Low | Always |
| Logging + trace | ✅ | Low | Always |
| **Retry with backoff** | ❌ | Medium | Transient failures common |
| **Caching** | ❌ | Medium | Repeated computations |
| **Async/parallel** | ❌ | High | I/O bound, many agents |
| **Input validation** | ❌ | Low | Untrusted input |
| **Human-in-loop** | ❌ | Medium | Domain requires review |
| **Dashboard** | ❌ | Medium | 1000s of pipelines |
| **Checkpointing** | ❌ | High | Expensive agents |
| **Dead letter queue** | ❌ | High | High-volume, mission-critical |
| **Dynamic routing** | ❌ | High | 10+ agents |
| **ReAct loops** | ~Partial | Low | LangGraph handles |

---

## The Honest Take

**Minimum to get working (what example shows):**
- Agents = LLM + tools
- State = TypedDict
- Orchestration = function that calls agents in order
- Error handling = check state flag, stop if failed
- Observability = structured logs + execution trace

**Lines of code**: ~200

**Time to working system**: 2-4 hours

---

**Production-ready additions (in order of value):**
1. Input validation (find bugs early)
2. Retry with backoff (recover from flakes)
3. Structured logging + alerting (know when it breaks)
4. Checkpointing (if agents are expensive)
5. Async execution (if agents are I/O bound)
6. Dashboard (once you have many pipelines)

**Don't add**:
- Routing until you have 10+ agents
- Dead letter queue until you're running 1000s/day
- Rollback until it's costing you money

Start with what's shown in the example. Add when you feel the pain.
