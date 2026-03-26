# Audit Skill

[![Version](https://img.shields.io/badge/version-1.0.0-blue.svg)](https://github.com/auto-ai/auto-ai)
[![License](https://img.shields.io/badge/license-MIT-green.svg)](LICENSE)
[![Security](https://img.shields.io/badge/security-focused-red.svg)]()

> **Enterprise-grade security auditing and compliance verification toolkit for codebases.**

## Overview

The Audit Skill provides comprehensive security auditing, vulnerability detection, and compliance checking capabilities. It enables agents to perform thorough security reviews, identify sensitive data exposure, and ensure regulatory compliance.

## Key Features

| Feature                    | Description                                        |
| -------------------------- | -------------------------------------------------- |
| **Secret Detection**       | Find exposed API keys, tokens, credentials         |
| **Vulnerability Scanning** | SQL injection, XSS, command injection patterns     |
| **PII Detection**          | Personal data exposure (emails, SSN, credit cards) |
| **Compliance Checks**      | GDPR, HIPAA, PCI-DSS pattern matching              |
| **Configuration Audit**    | Security hardening verification                    |
| **Integrity Verification** | File checksum and tampering detection              |

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Audit Engine                               │
├─────────────────────────────────────────────────────────────────┤
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐             │
│  │   Pattern   │  │  Compliance │  │  Integrity  │             │
│  │   Scanner   │  │   Checker   │  │   Verifier  │             │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘             │
│         │                │                │                     │
│         └────────────────┼────────────────┘                     │
│                          ▼                                      │
│              ┌───────────────────────┐                          │
│              │    Security Report    │                          │
│              └───────────────────────┘                          │
└─────────────────────────────────────────────────────────────────┘
```

## Severity Levels

| Level        | Color | Description               | Response Time |
| ------------ | ----- | ------------------------- | ------------- |
| **CRITICAL** | 🔴    | Active security risk      | Immediate     |
| **HIGH**     | 🟠    | Significant vulnerability | 24-48 hours   |
| **MEDIUM**   | 🟡    | Potential security issue  | 1-2 weeks     |
| **LOW**      | 🔵    | Minor security concern    | Next release  |
| **INFO**     | ⚪    | Informational finding     | As needed     |

## Quick Start

```javascript
// Import audit functions
import { performSecurityAudit, auditSecrets } from './skills/audit/SKILL.md';

// Quick secret scan
const secrets = await auditSecrets('/project/src');
console.log(`Found ${secrets.length} potential secrets`);

// Full security audit
const report = await performSecurityAudit('/project');
console.log(`Critical: ${report.summary.criticalFindings}`);
console.log(`High: ${report.summary.highFindings}`);
```

## Detection Capabilities

### Secret Patterns

| Pattern       | Example                       | Risk Level |
| ------------- | ----------------------------- | ---------- |
| API Keys      | `api_key="sk-..."`            | CRITICAL   |
| AWS Keys      | `AKIA...`                     | CRITICAL   |
| GitHub Tokens | `ghp_...`                     | CRITICAL   |
| JWT Tokens    | `eyJ...`                      | HIGH       |
| Private Keys  | `-----BEGIN PRIVATE KEY-----` | CRITICAL   |
| Passwords     | `password="..."`              | HIGH       |

### Vulnerability Patterns

| Vulnerability            | Pattern             | OWASP Category |
| ------------------------ | ------------------- | -------------- |
| SQL Injection            | `query(\`${...\}`)` | A03:2021       |
| XSS                      | `.innerHTML =`      | A03:2021       |
| Command Injection        | `exec(`${...}`)`    | A03:2021       |
| Path Traversal           | `../../`            | A01:2021       |
| Insecure Deserialization | `eval()`            | A08:2021       |

### PII Patterns

| Data Type   | Pattern                   | Regulation |
| ----------- | ------------------------- | ---------- |
| Email       | `[a-z]+@[a-z]+\.[a-z]+`   | GDPR       |
| Phone       | `\d{3}-\d{3}-\d{4}`       | GDPR       |
| SSN         | `\d{3}-\d{2}-\d{4}`       | HIPAA      |
| Credit Card | `\d{4}-\d{4}-\d{4}-\d{4}` | PCI-DSS    |
| IP Address  | `\d+\.\d+\.\d+\.\d+`      | GDPR       |

## Use Cases

| Use Case              | Description                  | Output               |
| --------------------- | ---------------------------- | -------------------- |
| **Pre-commit Scan**   | Scan code before commit      | Pass/Fail + findings |
| **CI/CD Integration** | Automated security gate      | Security gate status |
| **Compliance Audit**  | Verify regulatory compliance | Compliance report    |
| **Code Review**       | Security-focused review      | Annotated findings   |
| **Incident Response** | Post-breach investigation    | Exposure report      |

## Configuration

```json
{
    "audit": {
        "enabled": true,
        "severityThreshold": "MEDIUM",
        "excludePatterns": ["node_modules/**", "*.test.js", "coverage/**"],
        "customPatterns": {
            "secrets": [],
            "vulnerabilities": [],
            "pii": []
        },
        "compliance": {
            "gdpr": true,
            "hipaa": false,
            "pcidss": false
        }
    }
}
```

## API Reference

### `performSecurityAudit(directoryPath, options)`

Performs comprehensive security audit on a directory.

**Parameters:**

- `directoryPath` (string): Path to directory
- `options` (object): Audit options
    - `depth`: number - Scan depth
    - `excludePatterns`: string[] - Patterns to exclude

**Returns:** `Promise<AuditReport>`

### `auditSecrets(filePath, options)`

Scans file for exposed secrets.

**Parameters:**

- `filePath` (string): Path to file or directory
    - `patterns`: string[] - Custom patterns to scan

**Returns:** `Promise<SecretFinding[]>`

### `auditCompliance(filePath, standards)`

Checks file against compliance standards.

**Parameters:**

- `filePath` (string): Path to file
- `standards`: string[] - Standards to check (GDPR, HIPAA, PCI-DSS)

**Returns:** `Promise<ComplianceReport>`

## Output Format

```json
{
    "timestamp": "2024-01-15T10:30:00Z",
    "directory": "/project",
    "summary": {
        "totalFiles": 150,
        "criticalFindings": 2,
        "highFindings": 5,
        "mediumFindings": 12,
        "lowFindings": 8
    },
    "findings": [
        {
            "type": "SECRET",
            "severity": "CRITICAL",
            "file": "/project/.env",
            "line": 5,
            "pattern": "AWS Access Key",
            "recommendation": "Rotate key immediately"
        }
    ],
    "recommendations": [
        {
            "priority": "IMMEDIATE",
            "action": "Address critical findings",
            "count": 2
        }
    ]
}
```

## CI/CD Integration

```yaml
# GitHub Actions example
- name: Security Audit
  run: |
      node -e "
      const { performSecurityAudit } = require('./skills/audit');
      const report = await performSecurityAudit('.');
      if (report.summary.criticalFindings > 0) {
        process.exit(1);
      }
      "
```

## Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/security-enhancement`)
3. Commit your changes (`git commit -m 'Add new security pattern'`)
4. Push to the branch (`git push origin feature/security-enhancement`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Security

If you discover a security vulnerability, please report it responsibly:

- **Email:** security@auto-ai.dev
- **Security Policy:** [SECURITY.md](SECURITY.md)

---

_Built with ❤️ by the Auto-AI Team_
