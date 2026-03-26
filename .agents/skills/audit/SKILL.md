---
name: audit-read
description: |
    Security and compliance auditing through file reading and analysis.
    Use when auditing code for security vulnerabilities, checking configurations,
    verifying compliance, detecting sensitive data exposure, or performing
    integrity checks on files and codebases.
    Triggers on tasks involving security audits, code reviews, compliance checks,
    vulnerability scanning, or data privacy verification.
license: MIT
metadata:
    author: Auto-AI Framework
    version: '1.0.0'
---

# File Audit & Security Skill

Comprehensive guide for auditing files and codebases using Desktop Commander
read tools. This skill covers security auditing, compliance checking, vulnerability
detection, and integrity verification techniques.

## When to Use This Skill

Use this skill when:

- Auditing code for security vulnerabilities
- Checking for exposed secrets, API keys, or credentials
- Verifying configuration file security
- Performing compliance checks (GDPR, HIPAA, PCI-DSS)
- Detecting sensitive data patterns (PII, financial data)
- Validating file integrity and permissions
- Reviewing access controls and authentication logic
- Checking for common security anti-patterns

## Audit Categories

| Category          | Focus Areas                   | Key Patterns                                 |
| ----------------- | ----------------------------- | -------------------------------------------- |
| **Security**      | Secrets, injection, XSS, CSRF | `API_KEY`, `password`, `eval()`, `innerHTML` |
| **Privacy**       | PII, GDPR, data exposure      | Email, SSN, credit cards, phone numbers      |
| **Compliance**    | Standards, regulations        | PCI-DSS, HIPAA, SOC2 patterns                |
| **Configuration** | Hardening, defaults           | Debug modes, weak passwords, open ports      |
| **Integrity**     | Checksums, validation         | Hashes, signatures, tampering detection      |

## Security Auditing Patterns

### 1. Secret Detection

```javascript
async function auditSecrets(filePath) {
    const content = await Desktop_Commander_read_file(filePath);

    const secretPatterns = [
        { name: 'API Key', pattern: /api[_-]?key\s*[=:]\s*['"][^'"]+['"]/gi },
        { name: 'Secret Key', pattern: /secret[_-]?key\s*[=:]\s*['"][^'"]+['"]/gi },
        { name: 'Password', pattern: /password\s*[=:]\s*['"][^'"]+['"]/gi },
        { name: 'Token', pattern: /token\s*[=:]\s*['"][^'"]+['"]/gi },
        { name: 'Private Key', pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/g },
        { name: 'AWS Key', pattern: /AKIA[0-9A-Z]{16}/g },
        { name: 'GitHub Token', pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/g },
        { name: 'Slack Token', pattern: /xox[bpors]-[0-9]{10,13}/g },
        { name: 'Google API Key', pattern: /AIza[0-9A-Za-z_-]{35}/g },
        { name: 'JWT', pattern: /eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/g },
    ];

    const findings = [];

    for (const { name, pattern } of secretPatterns) {
        const matches = content.match(pattern);
        if (matches) {
            findings.push({
                type: 'SECRET',
                severity: 'CRITICAL',
                pattern: name,
                matches: matches.length,
                file: filePath,
                lines: findLineNumbers(content, pattern),
            });
        }
    }

    return findings;
}

function findLineNumbers(content, pattern) {
    const lines = content.split('\n');
    const lineNumbers = [];

    lines.forEach((line, index) => {
        if (pattern.test(line)) {
            lineNumbers.push(index + 1);
        }
        pattern.lastIndex = 0; // Reset regex
    });

    return lineNumbers;
}
```

### 2. Injection Vulnerability Detection

```javascript
async function auditInjectionVulnerabilities(filePath) {
    const content = await Desktop_Commander_read_file(filePath);

    const injectionPatterns = [
        { name: 'SQL Injection', pattern: /query\s*\(\s*['"`].*\$\{/g },
        { name: 'SQL Injection', pattern: /execute\s*\(\s*.*\+.*\)/gi },
        { name: 'Command Injection', pattern: /exec\s*\(\s*.*\$\{/g },
        { name: 'Command Injection', pattern: /spawn\s*\(\s*.*\+/g },
        { name: 'Eval Usage', pattern: /eval\s*\(/g },
        { name: 'InnerHTML', pattern: /\.innerHTML\s*=/g },
        { name: 'Document Write', pattern: /document\.write\s*\(/g },
        { name: 'OuterHTML', pattern: /\.outerHTML\s*=/g },
        { name: 'Template Literal Injection', pattern: /`\$\{.*exec/g },
    ];

    const findings = [];

    for (const { name, pattern } of injectionPatterns) {
        const matches = content.match(pattern);
        if (matches) {
            findings.push({
                type: 'INJECTION',
                severity: 'HIGH',
                vulnerability: name,
                occurrences: matches.length,
                file: filePath,
                lines: findLineNumbers(content, pattern),
            });
        }
    }

    return findings;
}
```

### 3. Privacy & PII Detection

```javascript
async function auditPrivacyViolations(filePath) {
    const content = await Desktop_Commander_read_file(filePath);

    const piiPatterns = [
        { name: 'Email Address', pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g },
        { name: 'Phone Number', pattern: /(\+?1[-.]?)?\(?[0-9]{3}\)?[-.]?[0-9]{3}[-.]?[0-9]{4}/g },
        { name: 'SSN', pattern: /\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/g },
        { name: 'Credit Card', pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g },
        { name: 'IP Address', pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g },
        {
            name: 'Date of Birth',
            pattern: /\b(0[1-9]|1[0-2])[-/](0[1-9]|[12]\d|3[01])[-/]\d{4}\b/g,
        },
        { name: 'Postal Code', pattern: /\b\d{5}(-\d{4})?\b/g },
        { name: 'Driver License', pattern: /\b[A-Z]{1,2}\d{5,8}\b/g },
    ];

    const findings = [];

    for (const { name, pattern } of piiPatterns) {
        const matches = content.match(pattern);
        if (matches && matches.length > 0) {
            findings.push({
                type: 'PII',
                severity: 'HIGH',
                dataType: name,
                occurrences: matches.length,
                file: filePath,
                lines: findLineNumbers(content, pattern),
            });
        }
    }

    return findings;
}
```

## Configuration Auditing

### 1. Security Configuration Audit

```javascript
async function auditSecurityConfig(filePath) {
    const content = await Desktop_Commander_read_file(filePath);

    let config;
    try {
        config = JSON.parse(content);
    } catch (e) {
        return [{ error: 'Invalid JSON configuration' }];
    }

    const findings = [];

    // Check for debug mode
    if (config.debug === true || config.DEBUG === true) {
        findings.push({
            type: 'CONFIG',
            severity: 'MEDIUM',
            issue: 'Debug mode enabled',
            recommendation: 'Disable debug mode in production',
        });
    }

    // Check for weak passwords
    if (config.password && config.password.length < 12) {
        findings.push({
            type: 'CONFIG',
            severity: 'HIGH',
            issue: 'Weak password detected',
            recommendation: 'Use passwords with at least 12 characters',
        });
    }

    // Check for default credentials
    const defaultCredentials = ['admin', 'password', '123456', 'root'];
    if (config.username && defaultCredentials.includes(config.username.toLowerCase())) {
        findings.push({
            type: 'CONFIG',
            severity: 'CRITICAL',
            issue: 'Default username detected',
            recommendation: 'Change default credentials',
        });
    }

    // Check for open CORS
    if (config.cors && config.cors.origin === '*') {
        findings.push({
            type: 'CONFIG',
            severity: 'MEDIUM',
            issue: 'CORS allows all origins',
            recommendation: 'Restrict CORS to specific domains',
        });
    }

    // Check for SQL logging
    if (config.logging && config.logging.sql === true) {
        findings.push({
            type: 'CONFIG',
            severity: 'LOW',
            issue: 'SQL logging enabled',
            recommendation: 'Disable SQL logging in production',
        });
    }

    return findings;
}
```

### 2. Environment File Audit

```javascript
async function auditEnvironmentFile(filePath) {
    const content = await Desktop_Commander_read_file(filePath);
    const lines = content.split('\n');

    const findings = [];

    lines.forEach((line, index) => {
        // Skip comments and empty lines
        if (line.trim().startsWith('#') || !line.trim()) return;

        const [key, ...valueParts] = line.split('=');
        const value = valueParts.join('=');

        // Check for sensitive values
        if (key.match(/(SECRET|PASSWORD|TOKEN|KEY|CREDENTIAL)/i)) {
            if (!value || value === '' || value === 'changeme' || value === 'xxx') {
                findings.push({
                    type: 'ENV',
                    severity: 'HIGH',
                    issue: `Empty or default value for ${key}`,
                    line: index + 1,
                    recommendation: 'Set a secure value',
                });
            }
        }

        // Check for production URLs in dev files
        if (key.match(/(URL|ENDPOINT)/i) && value.includes('localhost')) {
            findings.push({
                type: 'ENV',
                severity: 'LOW',
                issue: `Localhost URL in ${key}`,
                line: index + 1,
                recommendation: 'Verify this is not a production file',
            });
        }
    });

    return findings;
}
```

## Compliance Auditing

### 1. GDPR Compliance Check

```javascript
async function auditGDPRCompliance(filePath) {
    const content = await Desktop_Commander_read_file(filePath);

    const findings = [];

    // Check for data retention policies
    if (content.includes('userData') && !content.includes('retention')) {
        findings.push({
            type: 'COMPLIANCE',
            standard: 'GDPR',
            severity: 'HIGH',
            issue: 'User data handling without retention policy',
            recommendation: 'Implement data retention policies',
        });
    }

    // Check for consent mechanisms
    if (content.includes('collect') && !content.includes('consent')) {
        findings.push({
            type: 'COMPLIANCE',
            standard: 'GDPR',
            severity: 'MEDIUM',
            issue: 'Data collection without consent mechanism',
            recommendation: 'Implement user consent for data collection',
        });
    }

    // Check for data deletion capabilities
    if (content.includes('user') && !content.includes('delete') && !content.includes('erase')) {
        findings.push({
            type: 'COMPLIANCE',
            standard: 'GDPR',
            severity: 'MEDIUM',
            issue: 'No data deletion capability found',
            recommendation: 'Implement right to be forgotten',
        });
    }

    return findings;
}
```

### 2. PCI-DSS Compliance Check

```javascript
async function auditPCIDSSCompliance(filePath) {
    const content = await Desktop_Commander_read_file(filePath);

    const findings = [];

    // Check for plaintext card storage
    const cardPatterns = [
        /card_number\s*[=:]\s*['"][^'"]+['"]/gi,
        /credit_card\s*[=:]\s*['"][^'"]+['"]/gi,
        /cardNumber\s*[=:]\s*['"][^'"]+['"]/gi,
    ];

    for (const pattern of cardPatterns) {
        if (pattern.test(content)) {
            findings.push({
                type: 'COMPLIANCE',
                standard: 'PCI-DSS',
                severity: 'CRITICAL',
                issue: 'Plaintext credit card data detected',
                recommendation: 'Never store card data in plaintext',
            });
        }
    }

    // Check for encryption usage
    if (content.includes('card') && !content.includes('encrypt')) {
        findings.push({
            type: 'COMPLIANCE',
            standard: 'PCI-DSS',
            severity: 'HIGH',
            issue: 'Card data handling without encryption',
            recommendation: 'Use strong encryption for card data',
        });
    }

    return findings;
}
```

## Integrity Verification

### 1. File Integrity Check

```javascript
async function verifyFileIntegrity(filePath, expectedHash = null) {
    const { createHash } = await import('crypto');
    const content = await Desktop_Commander_read_file(filePath);

    const hash = createHash('sha256').update(content).digest('hex');

    const findings = {
        file: filePath,
        hash,
        size: content.length,
        lines: content.split('\n').length,
    };

    if (expectedHash) {
        findings.integrityMatch = hash === expectedHash;
        if (!findings.integrityMatch) {
            findings.severity = 'CRITICAL';
            findings.issue = 'File integrity check failed';
        }
    }

    return findings;
}
```

### 2. Code Tampering Detection

```javascript
async function detectCodeTampering(filePath, baselinePath = null) {
    const currentContent = await Desktop_Commander_read_file(filePath);

    if (!baselinePath) {
        return {
            file: filePath,
            warning: 'No baseline provided for comparison',
        };
    }

    const baselineContent = await Desktop_Commander_read_file(baselinePath);

    if (currentContent === baselineContent) {
        return {
            file: filePath,
            status: 'CLEAN',
            message: 'No tampering detected',
        };
    }

    // Find differences
    const currentLines = currentContent.split('\n');
    const baselineLines = baselineContent.split('\n');
    const differences = [];

    const maxLines = Math.max(currentLines.length, baselineLines.length);
    for (let i = 0; i < maxLines; i++) {
        if (currentLines[i] !== baselineLines[i]) {
            differences.push({
                line: i + 1,
                current: currentLines[i] || '[EOF]',
                baseline: baselineLines[i] || '[EOF]',
            });
        }
    }

    return {
        file: filePath,
        status: 'MODIFIED',
        severity: 'HIGH',
        differences: differences.length,
        details: differences.slice(0, 10), // First 10 differences
    };
}
```

## Comprehensive Audit Report

### Full Security Audit

```javascript
async function performSecurityAudit(directoryPath) {
    const report = {
        timestamp: new Date().toISOString(),
        directory: directoryPath,
        files: [],
        summary: {
            totalFiles: 0,
            criticalFindings: 0,
            highFindings: 0,
            mediumFindings: 0,
            lowFindings: 0,
        },
        findings: [],
    };

    // Get all files in directory
    const files = await Desktop_Commander_start_search({
        path: directoryPath,
        pattern: '*.{js,ts,py,json,yaml,yml,env,config}',
        searchType: 'files',
    });

    for (const file of files) {
        const fileAudit = {
            file,
            secrets: await auditSecrets(file),
            injections: await auditInjectionVulnerabilities(file),
            pii: await auditPrivacyViolations(file),
        };

        // Count findings by severity
        const allFindings = [...fileAudit.secrets, ...fileAudit.injections, ...fileAudit.pii];

        allFindings.forEach((finding) => {
            report.summary[`${finding.severity.toLowerCase()}Findings`]++;
            report.findings.push({ ...finding, file });
        });

        report.files.push(fileAudit);
        report.summary.totalFiles++;
    }

    // Generate recommendations
    report.recommendations = generateRecommendations(report);

    return report;
}

function generateRecommendations(report) {
    const recommendations = [];

    if (report.summary.criticalFindings > 0) {
        recommendations.push({
            priority: 'IMMEDIATE',
            action: 'Address critical findings immediately',
            count: report.summary.criticalFindings,
        });
    }

    if (report.summary.highFindings > 0) {
        recommendations.push({
            priority: 'HIGH',
            action: 'Review and fix high severity issues',
            count: report.summary.highFindings,
        });
    }

    if (report.findings.some((f) => f.type === 'SECRET')) {
        recommendations.push({
            priority: 'HIGH',
            action: 'Rotate exposed credentials and secrets',
        });
    }

    if (report.findings.some((f) => f.type === 'PII')) {
        recommendations.push({
            priority: 'MEDIUM',
            action: 'Review PII handling and ensure compliance',
        });
    }

    return recommendations;
}
```

## Audit Checklist

### Pre-Audit Checklist

- [ ] Verify file access permissions
- [ ] Create baseline snapshots
- [ ] Define scope and objectives
- [ ] Set up reporting format
- [ ] Identify compliance requirements

### During Audit

- [ ] Scan for secrets and credentials
- [ ] Check injection vulnerabilities
- [ ] Verify configuration security
- [ ] Review authentication logic
- [ ] Check for PII exposure
- [ ] Validate encryption usage
- [ ] Review access controls

### Post-Audit

- [ ] Document all findings
- [ ] Prioritize remediation
- [ ] Create action items
- [ ] Schedule follow-up audit
- [ ] Update security policies

## Severity Levels

| Level        | Description               | Response Time |
| ------------ | ------------------------- | ------------- |
| **CRITICAL** | Active exploitation risk  | Immediate     |
| **HIGH**     | Significant vulnerability | 24-48 hours   |
| **MEDIUM**   | Potential security issue  | 1-2 weeks     |
| **LOW**      | Minor security concern    | Next release  |
| **INFO**     | Informational finding     | As needed     |

## Common Vulnerability Patterns

### JavaScript/Node.js

```javascript
// BAD - SQL Injection
const query = `SELECT * FROM users WHERE id = ${userId}`;

// BAD - Command Injection
exec(`rm ${userInput}`);

// BAD - Eval
eval(userCode);

// GOOD - Parameterized query
const query = 'SELECT * FROM users WHERE id = ?';
db.query(query, [userId]);

// GOOD - Safe exec
execFile('rm', [userInput]);

// GOOD - Safe evaluation
const result = Function('"use strict";return (' + userCode + ')')();
```

### Python

```python
# BAD - SQL Injection
cursor.execute(f"SELECT * FROM users WHERE id = {user_id}")

# BAD - Command Injection
os.system(f"rm {user_input}")

# GOOD - Parameterized query
cursor.execute("SELECT * FROM users WHERE id = %s", (user_id,))

# GOOD - Safe subprocess
subprocess.run(["rm", user_input])
```

## Reporting Templates

### Executive Summary

```
Security Audit Report
=====================

Date: [DATE]
Scope: [DIRECTORY/FILES]
Overall Risk Level: [CRITICAL/HIGH/MEDIUM/LOW]

Summary:
- Files Scanned: [COUNT]
- Critical Findings: [COUNT]
- High Findings: [COUNT]
- Medium Findings: [COUNT]
- Low Findings: [COUNT]

Top Recommendations:
1. [RECOMMENDATION]
2. [RECOMMENDATION]
3. [RECOMMENDATION]
```

### Technical Findings

```
Finding #[ID]: [TITLE]
Severity: [CRITICAL/HIGH/MEDIUM/LOW]
Type: [SECRET/INJECTION/PII/CONFIG]

File: [FILE_PATH]
Line(s): [LINE_NUMBERS]

Description:
[DESCRIPTION]

Evidence:
[CODE_SNIPPET]

Recommendation:
[REMEDIATION_STEPS]

References:
- [LINK_TO_CWE]
- [LINK_TO_OWASP]
```

## Quick Commands

```bash
# Find secrets in files
grep -rn "api_key\|password\|secret" --include="*.{js,ts,py,json}" .

# Check file permissions
ls -la /path/to/files

# Verify file checksums
sha256sum /path/to/file

# Find SUID files
find / -perm -4000 -type f 2>/dev/null

# Check open ports
netstat -tulpn | grep LISTEN
```

## Integration with Other Tools

### With Code Analysis

```javascript
// Combine with static analysis
const auditResults = await performSecurityAudit('/project');
const codeAnalysis = await analyzeCodeQuality('/project');

// Merge findings
const combinedReport = {
    security: auditResults,
    quality: codeAnalysis,
    recommendations: mergeRecommendations(auditResults, codeAnalysis),
};
```

### With CI/CD

```javascript
// Run audit in CI pipeline
async function runCIAudit() {
    const report = await performSecurityAudit(process.env.SOURCE_DIR);

    if (report.summary.criticalFindings > 0) {
        console.error('CRITICAL SECURITY ISSUES FOUND');
        process.exit(1);
    }

    // Generate report artifact
    await writeAuditReport(report);
}
```

## Best Practices

1. **Automate Audits** - Run audits in CI/CD pipeline
2. **Use Baselines** - Compare against known good state
3. **Track Findings** - Use issue tracking for remediation
4. **Regular Updates** - Update patterns and rules regularly
5. **Training** - Train developers on security best practices
6. **Least Privilege** - Ensure minimal file permissions
7. **Encryption** - Encrypt sensitive data at rest and in transit
8. **Logging** - Log security events for monitoring
