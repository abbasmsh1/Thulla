"""
Unit tests for multi_agent_minimal.py

Shows how to test agents independently and as part of the pipeline.
This is important: you want to be able to test each agent in isolation
before they run in the full pipeline.

Run: python -m pytest test_multi_agent.py -v
"""

import pytest
from multi_agent_minimal import (
    ProcessingState,
    agent_1_processor,
    agent_2_analyzer,
    agent_3_reporter,
    PipelineOrchestrator
)


class TestAgent1Processor:
    """Test the data processing agent in isolation."""

    def test_valid_csv_data(self):
        """Agent 1 should parse and validate valid CSV."""
        state = ProcessingState(
            raw_data="name,value\nalice,100\nbob,200",
            processed_data=None,
            analysis_results=None,
            final_report=None,
            execution_trace=[],
            failed_agent=None
        )

        result = agent_1_processor(state)

        assert result["failed_agent"] is None
        assert result["processed_data"] is not None
        assert result["processed_data"]["row_count"] == 2
        assert result["processed_data"]["rows"][0]["name"] == "alice"
        assert result["processed_data"]["rows"][0]["value"] == 100.0

    def test_missing_required_column(self):
        """Agent 1 should fail if required columns are missing."""
        state = ProcessingState(
            raw_data="name,other\nalice,100",  # Missing 'value' column
            processed_data=None,
            analysis_results=None,
            final_report=None,
            execution_trace=[],
            failed_agent=None
        )

        result = agent_1_processor(state)

        assert result["failed_agent"] == "agent_1_processor"
        assert ("agent_1_processor", "failed") in result["execution_trace"]

    def test_execution_trace_recorded(self):
        """Agent 1 should record itself in execution trace."""
        state = ProcessingState(
            raw_data="name,value\nalice,100",
            processed_data=None,
            analysis_results=None,
            final_report=None,
            execution_trace=[],
            failed_agent=None
        )

        result = agent_1_processor(state)

        assert ("agent_1_processor", "success") in result["execution_trace"]

    def test_numeric_conversion(self):
        """Agent 1 should convert string numbers to floats."""
        state = ProcessingState(
            raw_data="name,value\nalice,100\nbob,200.5",
            processed_data=None,
            analysis_results=None,
            final_report=None,
            execution_trace=[],
            failed_agent=None
        )

        result = agent_1_processor(state)

        values = [r["value"] for r in result["processed_data"]["rows"]]
        assert isinstance(values[0], float)
        assert isinstance(values[1], float)
        assert values[1] == 200.5


class TestAgent2Analyzer:
    """Test the analysis agent in isolation."""

    def test_requires_processed_data(self):
        """Agent 2 should fail gracefully if no processed data."""
        state = ProcessingState(
            raw_data="",
            processed_data=None,  # Missing input
            analysis_results=None,
            final_report=None,
            execution_trace=[],
            failed_agent=None
        )

        result = agent_2_analyzer(state)

        assert result["failed_agent"] == "agent_2_analyzer"

    def test_computes_statistics(self):
        """Agent 2 should calculate statistics correctly."""
        processed_data = {
            "headers": ["name", "value"],
            "rows": [
                {"name": "alice", "value": 100.0},
                {"name": "bob", "value": 200.0},
                {"name": "charlie", "value": 150.0}
            ],
            "row_count": 3
        }

        state = ProcessingState(
            raw_data="",
            processed_data=processed_data,
            analysis_results=None,
            final_report=None,
            execution_trace=[],
            failed_agent=None
        )

        result = agent_2_analyzer(state)

        stats = result["analysis_results"]["statistics"]
        assert stats["mean"] == 150.0
        assert stats["min"] == 100.0
        assert stats["max"] == 200.0
        assert stats["count"] == 3

    def test_identifies_patterns(self):
        """Agent 2 should count value distributions."""
        processed_data = {
            "headers": ["name", "value"],
            "rows": [
                {"name": "alice", "value": 100.0},
                {"name": "alice", "value": 200.0},
                {"name": "bob", "value": 150.0}
            ],
            "row_count": 3
        }

        state = ProcessingState(
            raw_data="",
            processed_data=processed_data,
            analysis_results=None,
            final_report=None,
            execution_trace=[],
            failed_agent=None
        )

        result = agent_2_analyzer(state)

        distribution = result["analysis_results"]["name_distribution"]
        assert distribution["alice"] == 2
        assert distribution["bob"] == 1


class TestAgent3Reporter:
    """Test the report generation agent in isolation."""

    def test_requires_analysis_results(self):
        """Agent 3 should fail gracefully if no analysis results."""
        state = ProcessingState(
            raw_data="",
            processed_data=None,
            analysis_results=None,  # Missing input
            final_report=None,
            execution_trace=[],
            failed_agent=None
        )

        result = agent_3_reporter(state)

        assert result["failed_agent"] == "agent_3_reporter"

    def test_generates_report(self):
        """Agent 3 should generate a formatted report."""
        analysis_results = {
            "statistics": {
                "count": 3,
                "sum": 450.0,
                "mean": 150.0,
                "min": 100.0,
                "max": 200.0
            },
            "name_distribution": {
                "alice": 2,
                "bob": 1
            },
            "total_rows": 3
        }

        state = ProcessingState(
            raw_data="",
            processed_data=None,
            analysis_results=analysis_results,
            final_report=None,
            execution_trace=[],
            failed_agent=None
        )

        result = agent_3_reporter(state)

        report = result["final_report"]
        assert "DATA ANALYSIS REPORT" in report
        assert "150.00" in report  # Mean value
        assert "alice" in report
        assert "bob" in report


class TestPipelineOrchestrator:
    """Test the full pipeline integration."""

    def test_successful_full_pipeline(self):
        """Full pipeline should execute all agents successfully."""
        orchestrator = PipelineOrchestrator()
        raw_data = "name,value\nalice,100\nbob,200"

        result = orchestrator.run(raw_data)

        assert result["failed_agent"] is None
        assert result["processed_data"] is not None
        assert result["analysis_results"] is not None
        assert result["final_report"] is not None
        assert len(result["execution_trace"]) == 3

    def test_pipeline_stops_on_agent_1_failure(self):
        """Pipeline should stop if Agent 1 fails."""
        orchestrator = PipelineOrchestrator()
        raw_data = "name,other\nalice,100"  # Missing 'value' column

        result = orchestrator.run(raw_data)

        assert result["failed_agent"] == "agent_1_processor"
        assert result["processed_data"] is None
        # Agents 2 and 3 shouldn't run
        assert ("agent_2_analyzer", "success") not in result["execution_trace"]

    def test_execution_trace_order(self):
        """Execution trace should show agents in execution order."""
        orchestrator = PipelineOrchestrator()
        raw_data = "name,value\nalice,100\nbob,200"

        result = orchestrator.run(raw_data)

        trace = result["execution_trace"]
        assert trace[0][0] == "agent_1_processor"
        assert trace[1][0] == "agent_2_analyzer"
        assert trace[2][0] == "agent_3_reporter"

    def test_state_flows_between_agents(self):
        """State should flow correctly from one agent to the next."""
        orchestrator = PipelineOrchestrator()
        raw_data = "name,value\nalice,100\nbob,150"

        result = orchestrator.run(raw_data)

        # Agent 1 output → Agent 2 input (via state)
        assert result["processed_data"]["row_count"] == 2

        # Agent 2 output → Agent 3 input (via state)
        assert "DISTRIBUTION BY NAME" in result["final_report"]

        # Report should contain derived statistics
        assert "100.00" in result["final_report"]
        assert "150.00" in result["final_report"]


class TestStateContract:
    """Test that state structure is maintained throughout pipeline."""

    def test_state_shape_is_consistent(self):
        """ProcessingState should maintain structure throughout execution."""
        orchestrator = PipelineOrchestrator()
        raw_data = "name,value\nalice,100"

        result = orchestrator.run(raw_data)

        # Check all expected keys are present
        expected_keys = {
            "raw_data",
            "processed_data",
            "analysis_results",
            "final_report",
            "execution_trace",
            "failed_agent"
        }
        assert set(result.keys()) >= expected_keys

    def test_raw_data_preserved_throughout(self):
        """Raw data should be preserved and not modified."""
        original_data = "name,value\nalice,100"
        orchestrator = PipelineOrchestrator()

        result = orchestrator.run(original_data)

        assert result["raw_data"] == original_data


# Integration tests with realistic data
class TestRealisticScenarios:
    """Test with realistic data scenarios."""

    def test_large_dataset(self):
        """Pipeline should handle larger datasets."""
        rows = ["name,value"]
        for i in range(100):
            rows.append(f"user_{i},{i * 10}")
        raw_data = "\n".join(rows)

        orchestrator = PipelineOrchestrator()
        result = orchestrator.run(raw_data)

        assert result["failed_agent"] is None
        assert result["processed_data"]["row_count"] == 100
        assert "Total records analyzed: 100" in result["final_report"]

    def test_single_row(self):
        """Pipeline should handle single row."""
        raw_data = "name,value\nalice,100"

        orchestrator = PipelineOrchestrator()
        result = orchestrator.run(raw_data)

        assert result["failed_agent"] is None
        assert result["processed_data"]["row_count"] == 1
        assert result["analysis_results"]["statistics"]["mean"] == 100.0

    def test_repeated_values(self):
        """Pipeline should handle repeated values correctly."""
        raw_data = "name,value\nalice,100\nalice,100\nalice,100"

        orchestrator = PipelineOrchestrator()
        result = orchestrator.run(raw_data)

        assert result["failed_agent"] is None
        assert result["analysis_results"]["name_distribution"]["alice"] == 3
        assert result["analysis_results"]["statistics"]["mean"] == 100.0


if __name__ == "__main__":
    # Run tests
    pytest.main([__file__, "-v"])
