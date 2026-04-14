"""
MINIMAL WORKING MULTI-AGENT SYSTEM - No API keys needed

This is a simplification of multi_agent_example.py that runs locally.
Agents are simple functions instead of LLM-based. Same architecture.
Shows the core pattern: State → Agent 1 → Agent 2 → Agent 3 → Results

Run: python multi_agent_minimal.py
"""

import logging
from typing import Optional, Any
from dataclasses import dataclass, field
from typing_extensions import TypedDict
import json

logging.basicConfig(
    level=logging.INFO,
    format='%(levelname)s - %(name)s - %(message)s'
)
logger = logging.getLogger(__name__)


# ============================================================================
# PART 1: STATE (The contract between agents)
# ============================================================================

class ProcessingState(TypedDict):
    """Shared state that flows through all agents."""
    raw_data: str
    processed_data: Optional[dict]
    analysis_results: Optional[dict]
    final_report: Optional[str]
    execution_trace: list
    failed_agent: Optional[str]


# ============================================================================
# PART 2: AGENTS (Simple functions, same pattern as LLM-based)
# ============================================================================

def agent_1_processor(state: ProcessingState) -> ProcessingState:
    """Agent 1: Parse and validate data.

    Reads: state["raw_data"]
    Writes: state["processed_data"]
    """
    logger.info("AGENT 1: Starting data processing")

    try:
        # Parse CSV
        lines = state["raw_data"].strip().split('\n')
        headers = lines[0].split(',')
        rows = []
        for line in lines[1:]:
            row = dict(zip(headers, line.split(',')))
            rows.append(row)

        # Validate (must have 'name' and 'value')
        if 'name' not in headers or 'value' not in headers:
            raise ValueError("Missing required columns: 'name' and 'value'")

        # Normalize (convert string numbers to float)
        for row in rows:
            try:
                row['value'] = float(row['value'])
            except (ValueError, KeyError):
                pass  # Keep as string if can't convert

        # Success
        state["processed_data"] = {
            "headers": headers,
            "rows": rows,
            "row_count": len(rows)
        }
        state["execution_trace"].append(("agent_1_processor", "success"))
        logger.info(f"AGENT 1: Processed {len(rows)} rows")

    except Exception as e:
        state["failed_agent"] = "agent_1_processor"
        logger.error(f"AGENT 1: Failed - {e}")
        state["execution_trace"].append(("agent_1_processor", "failed"))

    return state


def agent_2_analyzer(state: ProcessingState) -> ProcessingState:
    """Agent 2: Analyze processed data.

    Reads: state["processed_data"]
    Writes: state["analysis_results"]
    """
    logger.info("AGENT 2: Starting analysis")

    # Check input
    if not state.get("processed_data"):
        state["failed_agent"] = "agent_2_analyzer"
        logger.error("AGENT 2: No processed data from Agent 1")
        state["execution_trace"].append(("agent_2_analyzer", "failed"))
        return state

    try:
        data = state["processed_data"]
        rows = data["rows"]

        # Compute statistics on numeric 'value' column
        values = [r['value'] for r in rows if isinstance(r.get('value'), (int, float))]

        stats = {
            "count": len(values),
            "sum": sum(values),
            "mean": sum(values) / len(values) if values else 0,
            "min": min(values) if values else 0,
            "max": max(values) if values else 0
        }

        # Find patterns: count by 'name'
        name_counts = {}
        for row in rows:
            name = row.get('name', 'unknown')
            name_counts[name] = name_counts.get(name, 0) + 1

        state["analysis_results"] = {
            "statistics": stats,
            "name_distribution": name_counts,
            "total_rows": len(rows)
        }
        state["execution_trace"].append(("agent_2_analyzer", "success"))
        logger.info(f"AGENT 2: Analyzed {len(rows)} rows. Mean value: {stats['mean']:.2f}")

    except Exception as e:
        state["failed_agent"] = "agent_2_analyzer"
        logger.error(f"AGENT 2: Failed - {e}")
        state["execution_trace"].append(("agent_2_analyzer", "failed"))

    return state


def agent_3_reporter(state: ProcessingState) -> ProcessingState:
    """Agent 3: Generate human-readable report.

    Reads: state["analysis_results"]
    Writes: state["final_report"]
    """
    logger.info("AGENT 3: Starting report generation")

    # Check input
    if not state.get("analysis_results"):
        state["failed_agent"] = "agent_3_reporter"
        logger.error("AGENT 3: No analysis results from Agent 2")
        state["execution_trace"].append(("agent_3_reporter", "failed"))
        return state

    try:
        analysis = state["analysis_results"]
        stats = analysis["statistics"]
        distribution = analysis["name_distribution"]

        report_lines = [
            "=" * 60,
            "DATA ANALYSIS REPORT",
            "=" * 60,
            "",
            "SUMMARY STATISTICS",
            "-" * 60,
            f"Total records analyzed: {analysis['total_rows']}",
            f"Sum of values: {stats['sum']:.2f}",
            f"Mean value: {stats['mean']:.2f}",
            f"Min value: {stats['min']:.2f}",
            f"Max value: {stats['max']:.2f}",
            "",
            "DISTRIBUTION BY NAME",
            "-" * 60,
        ]

        for name, count in sorted(distribution.items()):
            percentage = (count / analysis['total_rows']) * 100
            report_lines.append(f"{name:15} {count:3} records ({percentage:5.1f}%)")

        report_lines.extend([
            "",
            "=" * 60,
            "Report generated successfully",
            "=" * 60,
        ])

        state["final_report"] = "\n".join(report_lines)
        state["execution_trace"].append(("agent_3_reporter", "success"))
        logger.info("AGENT 3: Report generated")

    except Exception as e:
        state["failed_agent"] = "agent_3_reporter"
        logger.error(f"AGENT 3: Failed - {e}")
        state["execution_trace"].append(("agent_3_reporter", "failed"))

    return state


# ============================================================================
# PART 3: ORCHESTRATOR (The "multi-agent" system)
# ============================================================================

class PipelineOrchestrator:
    """Orchestrates the 3-agent pipeline.

    Responsibility:
    - Decide execution order (1 → 2 → 3)
    - Pass state between agents
    - Handle failures
    - Log execution
    """

    def __init__(self):
        self.logger = logging.getLogger(__name__)

    def run(self, raw_data: str) -> ProcessingState:
        """Execute the full pipeline.

        Returns:
            ProcessingState with all results and metadata
        """
        # Initialize state
        state = ProcessingState(
            raw_data=raw_data,
            processed_data=None,
            analysis_results=None,
            final_report=None,
            execution_trace=[],
            failed_agent=None
        )

        self.logger.info("Pipeline starting")

        # Step 1: Agent 1
        state = agent_1_processor(state)
        if state.get("failed_agent"):
            self.logger.error(f"Pipeline stopped: Agent 1 failed")
            return state

        # Step 2: Agent 2
        state = agent_2_analyzer(state)
        if state.get("failed_agent"):
            self.logger.error(f"Pipeline stopped: Agent 2 failed")
            return state

        # Step 3: Agent 3
        state = agent_3_reporter(state)
        if state.get("failed_agent"):
            self.logger.error(f"Pipeline stopped: Agent 3 failed")
            return state

        self.logger.info("Pipeline completed successfully")
        return state


# ============================================================================
# PART 4: USAGE
# ============================================================================

def main():
    print("\n" + "="*70)
    print("MINIMAL MULTI-AGENT SYSTEM: Data Processing Pipeline")
    print("="*70 + "\n")

    # Sample data
    raw_data = """name,value,category
alice,100,type_a
bob,150,type_b
alice,200,type_a
charlie,120,type_c
bob,180,type_b
alice,90,type_a"""

    print("INPUT DATA:")
    print("-" * 70)
    print(raw_data)
    print("\n" + "-" * 70 + "\n")

    # Run pipeline
    orchestrator = PipelineOrchestrator()
    result = orchestrator.run(raw_data)

    # Display results
    print("\nPIPELINE EXECUTION TRACE:")
    print("-" * 70)
    for agent, status in result["execution_trace"]:
        symbol = "[OK]" if status == "success" else "[FAIL]"
        print(f"  {symbol} {agent:25} {status}")

    if result.get("failed_agent"):
        print(f"\nWARNING: Pipeline failed at: {result['failed_agent']}")
        return

    # Show processed data
    if result.get("processed_data"):
        print("\n" + "="*70)
        print("AGENT 1 OUTPUT (Processed Data)")
        print("="*70)
        data = result["processed_data"]
        print(f"Rows: {data['row_count']}")
        print(f"Headers: {data['headers']}")
        print("Sample rows:")
        for row in data["rows"][:3]:
            print(f"  {row}")

    # Show analysis
    if result.get("analysis_results"):
        print("\n" + "="*70)
        print("AGENT 2 OUTPUT (Analysis)")
        print("="*70)
        analysis = result["analysis_results"]
        stats = analysis["statistics"]
        print(f"Statistics: mean={stats['mean']:.2f}, min={stats['min']:.2f}, max={stats['max']:.2f}")
        print(f"Distribution: {analysis['name_distribution']}")

    # Show report
    if result.get("final_report"):
        print("\n" + "="*70)
        print("AGENT 3 OUTPUT (Final Report)")
        print("="*70)
        print(result["final_report"])

    print("\n" + "="*70)
    print("PIPELINE COMPLETE")
    print("="*70 + "\n")


if __name__ == "__main__":
    main()
