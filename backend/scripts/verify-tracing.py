#!/usr/bin/env python3
"""
Trace Verification Script for Armored Archer
Validates distributed tracing configuration and services.

Usage:
    python3 verify-tracing.py
    python3 verify-tracing.py --json
    python3 verify-tracing.py --fix
"""

import argparse
import json
import os
import subprocess
import sys
from pathlib import Path

# Configuration
TEMPO_PORT = 3200
OTEL_COLLECTOR_PORT = 4317
OTEL_COLLECTOR_HEALTH_PORT = 13133
GRAFANA_PORT = 3000

TEMPO_HEALTH_ENDPOINT = f"http://localhost:{TEMPO_PORT}/ready"
OTEL_HEALTH_ENDPOINT = f"http://localhost:{OTEL_COLLECTOR_HEALTH_PORT}/health"
GRAFANA_HEALTH_ENDPOINT = f"http://localhost:{GRAFANA_PORT}/api/health"

CONFIG_FILES = [
    "config/tempo.yml",
    "otel-collector-config.yaml",
]

DOCKER_SERVICES = [
    "armored_archer_tempo",
    "armored_archer_otel_collector",
]


class Colors:
    """ANSI color codes for terminal output."""
    GREEN = '\033[92m'
    RED = '\033[91m'
    YELLOW = '\033[93m'
    BLUE = '\033[94m'
    END = '\033[0m'
    BOLD = '\033[1m'


class TestResult:
    """Represents a single test result."""

    def __init__(self, name: str, passed: bool, message: str = "", details: str = ""):
        self.name = name
        self.passed = passed
        self.message = message
        self.details = details

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "passed": self.passed,
            "message": self.message,
            "details": self.details,
        }

    def __str__(self) -> str:
        status = f"{Colors.GREEN}✓ PASS{Colors.END}" if self.passed else f"{Colors.RED}✗ FAIL{Colors.END}"
        return f"{status} {self.name}: {self.message}"


class TraceVerifier:
    """Verifies distributed tracing configuration and services."""

    def __init__(self, backend_dir: str, verbose: bool = False, fix: bool = False):
        self.backend_dir = Path(backend_dir)
        self.verbose = verbose
        self.fix = fix
        self.results: list[TestResult] = []

    def log(self, message: str):
        """Print a message if verbose mode is enabled."""
        if self.verbose:
            print(f"{Colors.BLUE}[INFO]{Colors.END} {message}")

    def run_command(self, cmd: list[str], capture: bool = True) -> tuple[int, str, str]:
        """Run a shell command and return exit code, stdout, stderr."""
        try:
            result = subprocess.run(
                cmd,
                cwd=self.backend_dir,
                capture_output=capture,
                text=True,
                timeout=30,
            )
            return result.returncode, result.stdout, result.stderr
        except subprocess.TimeoutExpired:
            return -1, "", "Command timed out"
        except Exception as e:
            return -1, "", str(e)

    def check_file_exists(self, filepath: str) -> TestResult:
        """Check if a configuration file exists."""
        full_path = self.backend_dir / filepath
        exists = full_path.exists()

        if not exists and self.fix:
            self.log(f"Would create missing file: {filepath}")

        return TestResult(
            name=f"File: {filepath}",
            passed=exists,
            message="Found" if exists else "Missing",
        )

    def check_yaml_syntax(self, filepath: str) -> TestResult:
        """Check YAML syntax of a configuration file."""
        full_path = self.backend_dir / filepath

        if not full_path.exists():
            return TestResult(
                name=f"YAML Syntax: {filepath}",
                passed=False,
                message="File not found",
            )

        try:
            import yaml
            with open(full_path) as f:
                yaml.safe_load(f)
            return TestResult(
                name=f"YAML Syntax: {filepath}",
                passed=True,
                message="Valid YAML",
            )
        except yaml.YAMLError as e:
            return TestResult(
                name=f"YAML Syntax: {filepath}",
                passed=False,
                message=f"Invalid YAML: {e!s}",
            )
        except Exception as e:
            return TestResult(
                name=f"YAML Syntax: {filepath}",
                passed=False,
                message=f"Error: {e!s}",
            )

    def check_docker_service(self, service_name: str) -> TestResult:
        """Check if a Docker service is running."""
        returncode, stdout, stderr = self.run_command([
            "docker", "inspect", "-f", "{{.State.Status}}", service_name
        ])

        if returncode == 0:
            status = stdout.strip()
            is_running = status == "running"

            if not is_running and self.fix:
                self.log(f"Would restart service: {service_name}")

            return TestResult(
                name=f"Docker Service: {service_name}",
                passed=is_running,
                message=f"Status: {status}",
            )
        else:
            return TestResult(
                name=f"Docker Service: {service_name}",
                passed=False,
                message="Service not found",
            )

    def check_health_endpoint(self, url: str, service_name: str) -> TestResult:
        """Check if a health endpoint is responding."""
        try:
            import urllib.error
            import urllib.request

            req = urllib.request.Request(url, method='GET')
            with urllib.request.urlopen(req, timeout=5) as response:
                if response.status == 200:
                    return TestResult(
                        name=f"Health: {service_name}",
                        passed=True,
                        message=f"HTTP {response.status}",
                    )
        except urllib.error.URLError as e:
            return TestResult(
                name=f"Health: {service_name}",
                passed=False,
                message=f"Connection failed: {e!s}",
            )
        except Exception as e:
            return TestResult(
                name=f"Health: {service_name}",
                passed=False,
                message=f"Error: {e!s}",
            )

        return TestResult(
            name=f"Health: {service_name}",
            passed=False,
            message="Unknown error",
        )

    def check_grafana_datasource(self) -> TestResult:
        """Check if Tempo datasource is configured in Grafana."""
        datasource_file = self.backend_dir / "grafana/provisioning/datasources/datasources.yml"

        if not datasource_file.exists():
            return TestResult(
                name="Grafana Tempo Datasource",
                passed=False,
                message="Datasource file not found",
            )

        try:
            import yaml
            with open(datasource_file) as f:
                config = yaml.safe_load(f)

            datasources = config.get('datasources', [])
            tempo_found = any(ds.get('type') == 'tempo' for ds in datasources)

            if not tempo_found and self.fix:
                self.log("Would add Tempo datasource to Grafana configuration")

            return TestResult(
                name="Grafana Tempo Datasource",
                passed=tempo_found,
                message="Configured" if tempo_found else "Missing",
            )
        except Exception as e:
            return TestResult(
                name="Grafana Tempo Datasource",
                passed=False,
                message=f"Error: {e!s}",
            )

    def check_grafana_dashboard(self) -> TestResult:
        """Check if Tempo dashboard is configured in Grafana."""
        dashboard_file = self.backend_dir / "grafana/provisioning/dashboards/tempo-tracing-dashboard.json"

        exists = dashboard_file.exists()

        if not exists and self.fix:
            self.log("Would create Tempo dashboard file")

        return TestResult(
            name="Grafana Tempo Dashboard",
            passed=exists,
            message="Found" if exists else "Missing",
        )

    def check_opentelemetry_package(self) -> TestResult:
        """Check if OpenTelemetry Go package is available."""
        go_mod_file = self.backend_dir / "go.mod"

        if not go_mod_file.exists():
            return TestResult(
                name="OpenTelemetry Go Package",
                passed=False,
                message="go.mod not found",
            )

        with open(go_mod_file) as f:
            content = f.read()

        has_otel = "go.opentelemetry.io/otel" in content

        if not has_otel and self.fix:
            self.log("Would add OpenTelemetry dependency to go.mod")

        return TestResult(
            name="OpenTelemetry Go Package",
            passed=has_otel,
            message="Found" if has_otel else "Missing",
        )

    def check_tracing_code(self) -> TestResult:
        """Check if tracing code exists."""
        tracing_file = self.backend_dir / "metrics/tracing.go"

        exists = tracing_file.exists()

        if not exists and self.fix:
            self.log("Would create tracing.go file")

        return TestResult(
            name="Tracing Implementation",
            passed=exists,
            message="Found" if exists else "Missing",
        )

    def check_docker_compose_config(self) -> TestResult:
        """Check if tracing services are in docker-compose.yml."""
        compose_file = self.backend_dir / "docker-compose.yml"

        if not compose_file.exists():
            return TestResult(
                name="Docker Compose Tracing Services",
                passed=False,
                message="docker-compose.yml not found",
            )

        with open(compose_file) as f:
            content = f.read()

        has_tempo = "tempo:" in content or "  tempo:\n" in content
        has_otel = "otel-collector:" in content or "  otel-collector:\n" in content

        passed = has_tempo and has_otel

        if not passed and self.fix:
            self.log("Would add Tempo and OTel Collector services to docker-compose.yml")

        return TestResult(
            name="Docker Compose Tracing Services",
            passed=passed,
            message="Configured" if passed else "Missing services",
        )

    def test_trace_generation(self) -> TestResult:
        """Test if traces can be generated (requires running services)."""
        # This would require actually running the Go backend
        # For now, we check if the configuration allows it

        config_file = self.backend_dir / "otel-collector-config.yaml"

        if not config_file.exists():
            return TestResult(
                name="Trace Generation Capability",
                passed=False,
                message="OTel collector config not found",
            )

        with open(config_file) as f:
            content = f.read()

        has_otlp_receiver = "otlp:" in content
        has_tempo_exporter = "otlphttp/tempo:" in content or "tempo" in content

        passed = has_otlp_receiver and has_tempo_exporter

        return TestResult(
            name="Trace Generation Capability",
            passed=passed,
            message="Configured" if passed else "Missing configuration",
        )

    def run_all_checks(self) -> list[TestResult]:
        """Run all verification checks."""
        self.results = []

        print(f"\n{Colors.BOLD}=== Armored Archer Trace Verification ==={Colors.END}\n")

        # Configuration file checks
        print(f"{Colors.BOLD}Configuration Files:{Colors.END}")
        for config_file in CONFIG_FILES:
            result = self.check_file_exists(config_file)
            self.results.append(result)
            print(f"  {result}")

            if result.passed:
                syntax_result = self.check_yaml_syntax(config_file)
                self.results.append(syntax_result)
                print(f"  {syntax_result}")

        print()

        # Go package checks
        print(f"{Colors.BOLD}OpenTelemetry Integration:{Colors.END}")
        otel_result = self.check_opentelemetry_package()
        self.results.append(otel_result)
        print(f"  {otel_result}")

        tracing_result = self.check_tracing_code()
        self.results.append(tracing_result)
        print(f"  {tracing_result}")

        print()

        # Docker Compose checks
        print(f"{Colors.BOLD}Docker Compose Configuration:{Colors.END}")
        compose_result = self.check_docker_compose_config()
        self.results.append(compose_result)
        print(f"  {compose_result}")

        for service in DOCKER_SERVICES:
            result = self.check_docker_service(service)
            self.results.append(result)
            print(f"  {result}")

        print()

        # Health checks
        print(f"{Colors.BOLD}Service Health:{Colors.END}")
        tempo_health = self.check_health_endpoint(TEMPO_HEALTH_ENDPOINT, "Tempo")
        self.results.append(tempo_health)
        print(f"  {tempo_health}")

        otel_health = self.check_health_endpoint(OTEL_HEALTH_ENDPOINT, "OTel Collector")
        self.results.append(otel_health)
        print(f"  {otel_health}")

        print()

        # Grafana integration checks
        print(f"{Colors.BOLD}Grafana Integration:{Colors.END}")
        datasource_result = self.check_grafana_datasource()
        self.results.append(datasource_result)
        print(f"  {datasource_result}")

        dashboard_result = self.check_grafana_dashboard()
        self.results.append(dashboard_result)
        print(f"  {dashboard_result}")

        grafana_health = self.check_health_endpoint(GRAFANA_HEALTH_ENDPOINT, "Grafana")
        self.results.append(grafana_health)
        print(f"  {grafana_health}")

        print()

        # Capability checks
        print(f"{Colors.BOLD}Trace Generation:{Colors.END}")
        trace_gen_result = self.test_trace_generation()
        self.results.append(trace_gen_result)
        print(f"  {trace_gen_result}")

        return self.results

    def get_summary(self) -> dict:
        """Get a summary of verification results."""
        total = len(self.results)
        passed = sum(1 for r in self.results if r.passed)
        failed = total - passed

        return {
            "total": total,
            "passed": passed,
            "failed": failed,
            "success_rate": (passed / total * 100) if total > 0 else 0,
        }

    def print_summary(self):
        """Print a summary of verification results."""
        summary = self.get_summary()

        print(f"\n{Colors.BOLD}=== Verification Summary ==={Colors.END}")
        print(f"Total Checks: {summary['total']}")
        print(f"Passed: {Colors.GREEN}{summary['passed']}{Colors.END}")
        print(f"Failed: {Colors.RED}{summary['failed']}{Colors.END}")
        print(f"Success Rate: {summary['success_rate']:.1f}%")

        if summary['failed'] > 0:
            print(f"\n{Colors.YELLOW}Failed Checks:{Colors.END}")
            for result in self.results:
                if not result.passed:
                    print(f"  - {result.name}: {result.message}")

            if self.fix:
                print(f"\n{Colors.YELLOW}Auto-fix mode enabled. Apply fixes manually or run with --fix flag.{Colors.END}")

    def to_json(self) -> str:
        """Convert results to JSON."""
        return json.dumps({
            "results": [r.to_dict() for r in self.results],
            "summary": self.get_summary(),
        }, indent=2)


def main():
    parser = argparse.ArgumentParser(
        description="Verify distributed tracing configuration for Armored Archer"
    )
    parser.add_argument(
        "--json",
        action="store_true",
        help="Output results as JSON",
    )
    parser.add_argument(
        "--fix",
        action="store_true",
        help="Enable auto-fix mode (suggest fixes for failed checks)",
    )
    parser.add_argument(
        "--verbose",
        "-v",
        action="store_true",
        help="Enable verbose output",
    )
    parser.add_argument(
        "--backend-dir",
        default=os.path.dirname(os.path.abspath(__file__)),
        help="Path to backend directory",
    )

    args = parser.parse_args()

    verifier = TraceVerifier(
        backend_dir=args.backend_dir,
        verbose=args.verbose,
        fix=args.fix,
    )

    verifier.run_all_checks()

    if args.json:
        print(verifier.to_json())
    else:
        verifier.print_summary()

    # Exit with error code if any checks failed
    summary = verifier.get_summary()
    sys.exit(0 if summary['failed'] == 0 else 1)


if __name__ == "__main__":
    main()
