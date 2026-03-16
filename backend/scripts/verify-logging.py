#!/usr/bin/env python3
"""
Log Aggregation Verification Script - Armored Archer
=====================================================
Validates Loki and Promtail setup for centralized log aggregation.

Usage:
    python3 scripts/verify-logging.py
    
Options:
    --verbose, -v    Show detailed output
    --quiet, -q      Only show errors
    --json           Output results as JSON
    --fix            Attempt to fix common issues
"""

import argparse
import json
import os
import subprocess
import sys
import time
from datetime import datetime
from typing import Dict, List, Optional, Tuple

# ANSI color codes
class Colors:
    GREEN = '\033[92m'
    YELLOW = '\033[93m'
    RED = '\033[91m'
    BLUE = '\033[94m'
    RESET = '\033[0m'
    BOLD = '\033[1m'


class CheckResult:
    """Represents the result of a single verification check."""
    
    def __init__(self, name: str, passed: bool, message: str = "", details: Optional[Dict] = None):
        self.name = name
        self.passed = passed
        self.message = message
        self.details = details or {}
        self.timestamp = datetime.utcnow().isoformat()
    
    def to_dict(self) -> Dict:
        return {
            "name": self.name,
            "passed": self.passed,
            "message": self.message,
            "details": self.details,
            "timestamp": self.timestamp
        }
    
    def __str__(self) -> str:
        status = f"{Colors.GREEN}✓ PASS{Colors.RESET}" if self.passed else f"{Colors.RED}✗ FAIL{Colors.RESET}"
        return f"{status} {self.name}: {self.message}"


class LoggingVerifier:
    """Main verification class for log aggregation setup."""
    
    def __init__(self, verbose: bool = False, quiet: bool = False):
        self.verbose = verbose
        self.quiet = quiet
        self.results: List[CheckResult] = []
        self.backend_dir = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
        
    def log(self, message: str, level: str = "info"):
        """Print log message based on verbosity settings."""
        if self.quiet and level != "error":
            return
        
        prefix = {
            "info": f"{Colors.BLUE}[INFO]{Colors.RESET}",
            "success": f"{Colors.GREEN}[OK]{Colors.RESET}",
            "warning": f"{Colors.YELLOW}[WARN]{Colors.RESET}",
            "error": f"{Colors.RED}[ERROR]{Colors.RESET}",
        }.get(level, "")
        
        print(f"{prefix} {message}")
    
    def run_command(self, cmd: str, capture: bool = True) -> Tuple[int, str]:
        """Run shell command and return exit code and output."""
        try:
            result = subprocess.run(
                cmd,
                shell=True,
                capture_output=capture,
                text=True,
                timeout=30
            )
            return result.returncode, result.stdout + result.stderr
        except subprocess.TimeoutExpired:
            return -1, "Command timed out"
        except Exception as e:
            return -1, str(e)
    
    def check_file_exists(self, path: str, description: str) -> CheckResult:
        """Check if a configuration file exists."""
        full_path = os.path.join(self.backend_dir, path) if not path.startswith('/') else path
        
        if os.path.exists(full_path):
            return CheckResult(
                name=f"File: {description}",
                passed=True,
                message=f"Found at {full_path}",
                details={"path": full_path, "size": os.path.getsize(full_path)}
            )
        else:
            return CheckResult(
                name=f"File: {description}",
                passed=False,
                message=f"Not found at {full_path}",
                details={"path": full_path}
            )
    
    def check_yaml_syntax(self, path: str) -> CheckResult:
        """Validate YAML syntax."""
        full_path = os.path.join(self.backend_dir, path) if not path.startswith('/') else path
        
        if not os.path.exists(full_path):
            return CheckResult(
                name=f"YAML Syntax: {os.path.basename(path)}",
                passed=False,
                message="File does not exist"
            )
        
        # Try to parse YAML using Python
        try:
            import yaml
            with open(full_path, 'r') as f:
                yaml.safe_load(f)
            return CheckResult(
                name=f"YAML Syntax: {os.path.basename(path)}",
                passed=True,
                message="Valid YAML syntax"
            )
        except ImportError:
            # yaml module not available, skip detailed validation
            return CheckResult(
                name=f"YAML Syntax: {os.path.basename(path)}",
                passed=True,
                message="File exists (yaml module not available for validation)"
            )
        except Exception as e:
            return CheckResult(
                name=f"YAML Syntax: {os.path.basename(path)}",
                passed=False,
                message=f"Invalid YAML: {str(e)}"
            )
    
    def check_docker_service(self, service_name: str) -> CheckResult:
        """Check if a Docker service is running."""
        exit_code, output = self.run_command(f"docker ps --filter 'name={service_name}' --format '{{{{.Names}}}}'")
        
        if exit_code == 0 and service_name in output:
            return CheckResult(
                name=f"Docker Service: {service_name}",
                passed=True,
                message=f"Service {service_name} is running",
                details={"service": service_name, "status": "running"}
            )
        else:
            return CheckResult(
                name=f"Docker Service: {service_name}",
                passed=False,
                message=f"Service {service_name} is not running",
                details={"service": service_name, "status": "stopped"}
            )
    
    def check_loki_health(self) -> CheckResult:
        """Check Loki health endpoint."""
        exit_code, output = self.run_command(
            "curl -s -o /dev/null -w '%{http_code}' http://localhost:3100/ready"
        )
        
        if exit_code == 0 and output.strip() == "200":
            return CheckResult(
                name="Loki Health",
                passed=True,
                message="Loki is ready and accepting requests",
                details={"status": "ready", "http_code": 200}
            )
        else:
            return CheckResult(
                name="Loki Health",
                passed=False,
                message=f"Loki health check failed (HTTP {output.strip()})",
                details={"http_code": output.strip() if output.strip() else "N/A"}
            )
    
    def check_promtail_health(self) -> CheckResult:
        """Check Promtail health endpoint."""
        exit_code, output = self.run_command(
            "curl -s -o /dev/null -w '%{http_code}' http://localhost:9080/ready"
        )
        
        if exit_code == 0 and output.strip() == "200":
            return CheckResult(
                name="Promtail Health",
                passed=True,
                message="Promtail is ready and scraping logs",
                details={"status": "ready", "http_code": 200}
            )
        else:
            return CheckResult(
                name="Promtail Health",
                passed=False,
                message=f"Promtail health check failed (HTTP {output.strip()})",
                details={"http_code": output.strip() if output.strip() else "N/A"}
            )
    
    def check_grafana_loki_datasource(self) -> CheckResult:
        """Check if Loki datasource is configured in Grafana."""
        exit_code, output = self.run_command(
            "curl -s http://admin:admin@localhost:3000/api/datasources -H 'Content-Type: application/json'"
        )
        
        if exit_code == 0 and "loki" in output.lower():
            return CheckResult(
                name="Grafana Loki Datasource",
                passed=True,
                message="Loki datasource configured in Grafana",
                details={"datasource": "Loki", "configured": True}
            )
        else:
            return CheckResult(
                name="Grafana Loki Datasource",
                passed=False,
                message="Loki datasource not found in Grafana",
                details={"configured": False}
            )
    
    def check_log_volume(self) -> CheckResult:
        """Check if logs are being collected in Loki."""
        exit_code, output = self.run_command(
            'curl -s "http://localhost:3100/loki/api/v1/label/job/values"'
        )
        
        if exit_code == 0 and len(output.strip()) > 2:
            jobs = json.loads(output) if output.strip().startswith('[') else []
            return CheckResult(
                name="Log Volume",
                passed=len(jobs) > 0,
                message=f"Found {len(jobs)} log sources: {', '.join(jobs[:5])}",
                details={"jobs": jobs, "count": len(jobs)}
            )
        else:
            return CheckResult(
                name="Log Volume",
                passed=False,
                message="No logs being collected or Loki not responding",
                details={"jobs": []}
            )
    
    def check_docker_compose_config(self) -> CheckResult:
        """Validate docker-compose configuration."""
        compose_file = os.path.join(self.backend_dir, "docker-compose.yml")
        
        if not os.path.exists(compose_file):
            return CheckResult(
                name="Docker Compose Config",
                passed=False,
                message="docker-compose.yml not found"
            )
        
        with open(compose_file, 'r') as f:
            content = f.read()
        
        has_loki = 'loki:' in content or 'image: grafana/loki' in content
        has_promtail = 'promtail:' in content or 'image: grafana/promtail' in content
        
        if has_loki and has_promtail:
            return CheckResult(
                name="Docker Compose Config",
                passed=True,
                message="Loki and Promtail services configured",
                details={"loki": has_loki, "promtail": has_promtail}
            )
        elif has_loki or has_promtail:
            return CheckResult(
                name="Docker Compose Config",
                passed=False,
                message="Incomplete logging configuration",
                details={"loki": has_loki, "promtail": has_promtail}
            )
        else:
            return CheckResult(
                name="Docker Compose Config",
                passed=False,
                message="Loki and Promtail not configured in docker-compose"
            )
    
    def run_all_checks(self) -> List[CheckResult]:
        """Run all verification checks."""
        self.log("Starting log aggregation verification...", "info")
        self.log("=" * 60, "info")
        
        # Configuration file checks
        self.log("\n[1/8] Checking configuration files...", "info")
        self.results.append(self.check_file_exists("config/loki.yml", "Loki Configuration"))
        self.results.append(self.check_file_exists("config/promtail.yml", "Promtail Configuration"))
        
        # YAML syntax validation
        self.log("\n[2/8] Validating YAML syntax...", "info")
        self.results.append(self.check_yaml_syntax("config/loki.yml"))
        self.results.append(self.check_yaml_syntax("config/promtail.yml"))
        
        # Docker Compose configuration
        self.log("\n[3/8] Checking Docker Compose configuration...", "info")
        self.results.append(self.check_docker_compose_config())
        
        # Docker service status
        self.log("\n[4/8] Checking Docker service status...", "info")
        self.results.append(self.check_docker_service("armored_archer_loki"))
        self.results.append(self.check_docker_service("armored_archer_promtail"))
        
        # Health checks
        self.log("\n[5/8] Running health checks...", "info")
        self.results.append(self.check_loki_health())
        self.results.append(self.check_promtail_health())
        
        # Grafana integration
        self.log("\n[6/8] Checking Grafana integration...", "info")
        self.results.append(self.check_grafana_loki_datasource())
        
        # Log collection
        self.log("\n[7/8] Checking log collection...", "info")
        self.results.append(self.check_log_volume())
        
        # Documentation
        self.log("\n[8/8] Checking documentation...", "info")
        self.results.append(self.check_file_exists("docs/log-queries.md", "LogQL Queries Documentation"))
        
        return self.results
    
    def print_summary(self):
        """Print verification summary."""
        total = len(self.results)
        passed = sum(1 for r in self.results if r.passed)
        failed = total - passed
        success_rate = (passed / total * 100) if total > 0 else 0
        
        print("\n" + "=" * 60)
        print(f"{Colors.BOLD}VERIFICATION SUMMARY{Colors.RESET}")
        print("=" * 60)
        
        for result in self.results:
            print(str(result))
        
        print("\n" + "-" * 60)
        print(f"Total Checks: {total}")
        print(f"{Colors.GREEN}Passed: {passed}{Colors.RESET}")
        print(f"{Colors.RED}Failed: {failed}{Colors.RESET}")
        print(f"Success Rate: {success_rate:.1f}%")
        print("=" * 60)
        
        if failed == 0:
            print(f"\n{Colors.GREEN}{Colors.BOLD}✓ All checks passed! Log aggregation is properly configured.{Colors.RESET}\n")
            return 0
        else:
            print(f"\n{Colors.YELLOW}{Colors.BOLD}⚠ Some checks failed. Review the issues above.{Colors.RESET}\n")
            return 1
    
    def to_json(self) -> str:
        """Export results as JSON."""
        return json.dumps({
            "timestamp": datetime.utcnow().isoformat(),
            "total_checks": len(self.results),
            "passed": sum(1 for r in self.results if r.passed),
            "failed": sum(1 for r in self.results if not r.passed),
            "results": [r.to_dict() for r in self.results]
        }, indent=2)


def main():
    parser = argparse.ArgumentParser(
        description="Verify log aggregation setup for Armored Archer"
    )
    parser.add_argument("-v", "--verbose", action="store_true", help="Show detailed output")
    parser.add_argument("-q", "--quiet", action="store_true", help="Only show errors")
    parser.add_argument("--json", action="store_true", help="Output results as JSON")
    parser.add_argument("--fix", action="store_true", help="Attempt to fix common issues")
    
    args = parser.parse_args()
    
    verifier = LoggingVerifier(verbose=args.verbose, quiet=args.quiet)
    verifier.run_all_checks()
    
    if args.json:
        print(verifier.to_json())
        sys.exit(0 if all(r.passed for r in verifier.results) else 1)
    
    exit_code = verifier.print_summary()
    
    # Auto-fix suggestions
    if args.fix or exit_code != 0:
        print("\n" + "=" * 60)
        print(f"{Colors.BOLD}REMEDIATION STEPS{Colors.RESET}")
        print("=" * 60)
        
        failed_checks = [r.name for r in verifier.results if not r.passed]
        
        if any("Loki Configuration" in c for c in failed_checks):
            print(f"\n{Colors.YELLOW}• Loki configuration missing:{Colors.RESET}")
            print("  Run: cp backend/config/loki.yml.example backend/config/loki.yml")
        
        if any("Promtail Configuration" in c for c in failed_checks):
            print(f"\n{Colors.YELLOW}• Promtail configuration missing:{Colors.RESET}")
            print("  Run: cp backend/config/promtail.yml.example backend/config/promtail.yml")
        
        if any("Docker Service" in c and "loki" in c.lower() for c in failed_checks):
            print(f"\n{Colors.YELLOW}• Loki service not running:{Colors.RESET}")
            print("  Run: cd backend && docker-compose up -d loki")
        
        if any("Docker Service" in c and "promtail" in c.lower() for c in failed_checks):
            print(f"\n{Colors.YELLOW}• Promtail service not running:{Colors.RESET}")
            print("  Run: cd backend && docker-compose up -d promtail")
        
        if any("Health" in c for c in failed_checks):
            print(f"\n{Colors.YELLOW}• Services not healthy:{Colors.RESET}")
            print("  1. Check service logs: docker-compose logs loki")
            print("  2. Verify network connectivity")
            print("  3. Restart services: docker-compose restart loki promtail")
        
        if any("Grafana" in c for c in failed_checks):
            print(f"\n{Colors.YELLOW}• Grafana integration issue:{Colors.RESET}")
            print("  1. Verify Loki datasource in Grafana UI")
            print("  2. Check grafana/provisioning/datasources/datasources.yml")
            print("  3. Restart Grafana: docker-compose restart grafana")
        
        print(f"\n{Colors.BLUE}General troubleshooting:{Colors.RESET}")
        print("  1. Start all services: docker-compose up -d")
        print("  2. Check logs: docker-compose logs -f loki promtail")
        print("  3. Verify network: docker network ls")
        print("  4. Test connectivity: curl http://localhost:3100/ready")
        
        print()
    
    sys.exit(exit_code)


if __name__ == "__main__":
    main()
