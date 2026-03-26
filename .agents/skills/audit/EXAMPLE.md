# Audit Skill - Examples

> **Practical examples for security auditing, vulnerability detection, and compliance checking.**

## Table of Contents

- [Secret Detection](#secret-detection)
- [Vulnerability Scanning](#vulnerability-scanning)
- [PII Detection](#pii-detection)
- [Compliance Auditing](#compliance-auditing)
- [Configuration Security](#configuration-security)
- [Integrity Verification](#integrity-verification)
- [Custom Audit Rules](#custom-audit-rules)
- [CI/CD Integration](#cicd-integration)

---

## Secret Detection

### Basic Secret Scanning

```javascript
// Example: Scan file for secrets
async function scanForSecrets(filePath) {
    const content = await Desktop_Commander_read_file(filePath);

    const secretPatterns = [
        {
            name: 'AWS Access Key',
            pattern: /AKIA[0-9A-Z]{16}/g,
            severity: 'CRITICAL',
        },
        {
            name: 'GitHub Token',
            pattern: /gh[pousr]_[A-Za-z0-9_]{36,}/g,
            severity: 'CRITICAL',
        },
        {
            name: 'API Key',
            pattern: /api[_-]?key\s*[=:]\s*['"][^'"]{8,}['"]/gi,
            severity: 'HIGH',
        },
        {
            name: 'Generic Secret',
            pattern: /secret[_-]?key\s*[=:]\s*['"][^'"]{8,}['"]/gi,
            severity: 'HIGH',
        },
        {
            name: 'Password',
            pattern: /password\s*[=:]\s*['"][^'"]{4,}['"]/gi,
            severity: 'HIGH',
        },
        {
            name: 'Private Key',
            pattern: /-----BEGIN\s+(RSA\s+)?PRIVATE\s+KEY-----/g,
            severity: 'CRITICAL',
        },
        {
            name: 'JWT Token',
            pattern: /eyJ[A-Za-z0-9-_]+\.eyJ[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+/g,
            severity: 'HIGH',
        },
        {
            name: 'Slack Token',
            pattern: /xox[bpors]-[0-9]{10,13}-[a-zA-Z0-9-]+/g,
            severity: 'CRITICAL',
        },
    ];

    const findings = [];
    const lines = content.split('\n');

    lines.forEach((line, index) => {
        for (const { name, pattern, severity } of secretPatterns) {
            const matches = line.match(pattern);
            if (matches) {
                findings.push({
                    type: 'SECRET',
                    severity,
                    pattern: name,
                    file: filePath,
                    line: index + 1,
                    content: line.trim().substring(0, 100) + '...',
                    matches: matches.length,
                });
            }
        }
    });

    return findings;
}

// Usage
const secrets = await scanForSecrets('/project/.env');
console.log(`Found ${secrets.length} potential secrets`);
```

### Directory-Wide Secret Scan

```javascript
// Example: Scan entire project for secrets
async function scanProjectSecrets(projectPath) {
    const files = await Desktop_Commander_start_search({
        path: projectPath,
        pattern: '*.{js,ts,json,env,yml,yaml,conf,config}',
        searchType: 'files',
    });

    const allFindings = [];
    const fileSummaries = [];

    for (const file of files) {
        const findings = await scanForSecrets(file);
        allFindings.push(...findings);
        fileSummaries.push({
            file,
            secretsFound: findings.length,
        });
    }

    // Sort by severity
    const severityOrder = { CRITICAL: 0, HIGH: 1, MEDIUM: 2, LOW: 3 };
    allFindings.sort((a, b) => severityOrder[a.severity] - severityOrder[b.severity]);

    // Group by pattern
    const byPattern = {};
    allFindings.forEach((f) => {
        if (!byPattern[f.pattern]) byPattern[f.pattern] = [];
        byPattern[f.pattern].push(f);
    });

    return {
        summary: {
            totalFiles: files.length,
            totalSecrets: allFindings.length,
            critical: allFindings.filter((f) => f.severity === 'CRITICAL').length,
            high: allFindings.filter((f) => f.severity === 'HIGH').length,
            byPattern: Object.entries(byPattern).map(([pattern, findings]) => ({
                pattern,
                count: findings.length,
            })),
        },
        findings: allFindings,
        fileSummaries: fileSummaries.filter((f) => f.secretsFound > 0),
    };
}

// Usage
const report = await scanProjectSecrets('/project');
console.log(report.summary);
```

---

## Vulnerability Scanning

### Code Injection Detection

```javascript
// Example: Scan for code injection vulnerabilities
async function scanInjectionVulnerabilities(filePath) {
    const content = await Desktop_Commander_read_file(filePath);
    const lines = content.split('\n');

    const vulnerabilities = [];

    const patterns = [
        {
            name: 'SQL Injection (Template Literal)',
            pattern: /(?:query|execute|raw)\s*\(\s*`[^`]*\$\{/g,
            severity: 'CRITICAL',
            cwe: 'CWE-89',
            fix: 'Use parameterized queries',
        },
        {
            name: 'SQL Injection (Concatenation)',
            pattern: /(?:query|execute|raw)\s*\(\s*['"].*['"]\s*\+\s*/g,
            severity: 'CRITICAL',
            cwe: 'CWE-89',
            fix: 'Use parameterized queries',
        },
        {
            name: 'Command Injection (exec)',
            pattern: /(?:exec|execSync|spawn)\s*\(\s*`[^`]*\$\{/g,
            severity: 'CRITICAL',
            cwe: 'CWE-78',
            fix: 'Use execFile with arguments array',
        },
        {
            name: 'Command Injection (system)',
            pattern: /system\s*\(\s*`[^`]*\$\{/g,
            severity: 'CRITICAL',
            cwe: 'CWE-78',
            fix: 'Use safe subprocess execution',
        },
        {
            name: 'XSS (innerHTML)',
            pattern: /\.innerHTML\s*=\s*[^;]/g,
            severity: 'HIGH',
            cwe: 'CWE-79',
            fix: 'Use textContent or DOMPurify',
        },
        {
            name: 'XSS (document.write)',
            pattern: /document\.write\s*\(/g,
            severity: 'HIGH',
            cwe: 'CWE-79',
            fix: 'Use DOM manipulation methods',
        },
        {
            name: 'Eval Usage',
            pattern: /\beval\s*\(/g,
            severity: 'HIGH',
            cwe: 'CWE-95',
            fix: 'Remove eval or use JSON.parse for JSON',
        },
        {
            name: 'Unsafe Regex',
            pattern: /new\s+RegExp\s*\([^)]*\$\{/g,
            severity: 'MEDIUM',
            cwe: 'CWE-1333',
            fix: 'Validate regex input or use safe-regex',
        },
    ];

    lines.forEach((line, index) => {
        for (const vuln of patterns) {
            if (vuln.pattern.test(line)) {
                vulnerabilities.push({
                    ...vuln,
                    file: filePath,
                    line: index + 1,
                    content: line.trim(),
                    context: lines.slice(Math.max(0, index - 2), index + 3).join('\n'),
                });
            }
            vuln.pattern.lastIndex = 0; // Reset regex
        }
    });

    return vulnerabilities;
}

// Usage
const vulns = await scanInjectionVulnerabilities('/project/src/app.js');
vulns.forEach((v) => console.log(`${v.severity}: ${v.name} at line ${v.line}`));
```

### Dependency Vulnerability Check

```javascript
// Example: Check package.json for vulnerable dependencies
async function checkDependencyVulnerabilities(packageJsonPath) {
    const content = await Desktop_Commander_read_file(packageJsonPath);
    const pkg = JSON.parse(content);

    const knownVulnerable = {
        lodash: { safe: '4.17.21', vulnerability: 'Prototype Pollution' },
        minimist: { safe: '1.2.6', vulnerability: 'Prototype Pollution' },
        axios: { safe: '0.21.2', vulnerability: 'SSRF' },
        express: { safe: '4.17.3', vulnerability: 'Open Redirect' },
        'node-fetch': { safe: '2.6.7', vulnerability: 'Information Exposure' },
    };

    const findings = [];
    const allDeps = {
        ...pkg.dependencies,
        ...pkg.devDependencies,
    };

    for (const [dep, version] of Object.entries(allDeps)) {
        const cleanVersion = version.replace(/[\^~>=<]/g, '');

        if (knownVulnerable[dep]) {
            const safe = knownVulnerable[dep].safe;
            if (compareVersions(cleanVersion, safe) < 0) {
                findings.push({
                    dependency: dep,
                    currentVersion: cleanVersion,
                    safeVersion: safe,
                    vulnerability: knownVulnerable[dep].vulnerability,
                    severity: 'HIGH',
                    fix: `Update to ${dep}@${safe}`,
                });
            }
        }
    }

    return {
        totalDependencies: Object.keys(allDeps).length,
        vulnerable: findings.length,
        findings,
    };
}

function compareVersions(v1, v2) {
    const parts1 = v1.split('.').map(Number);
    const parts2 = v2.split('.').map(Number);

    for (let i = 0; i < 3; i++) {
        if (parts1[i] < parts2[i]) return -1;
        if (parts1[i] > parts2[i]) return 1;
    }
    return 0;
}
```

---

## PII Detection

### Personal Data Scanner

```javascript
// Example: Detect PII in files
async function scanForPII(filePath, options = {}) {
    const { includeContext = true, contextLines = 1 } = options;

    const content = await Desktop_Commander_read_file(filePath);
    const lines = content.split('\n');

    const piiPatterns = [
        {
            name: 'Email Address',
            pattern: /[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/g,
            gdpr: true,
            hipaa: false,
        },
        {
            name: 'Phone Number (US)',
            pattern: /(\+?1[-.]?)?\(?[0-9]{3}\)?[-.]?[0-9]{3}[-.]?[0-9]{4}/g,
            gdpr: true,
            hipaa: false,
        },
        {
            name: 'Social Security Number',
            pattern: /\b\d{3}[-.]?\d{2}[-.]?\d{4}\b/g,
            gdpr: false,
            hipaa: true,
        },
        {
            name: 'Credit Card Number',
            pattern: /\b(?:\d{4}[-\s]?){3}\d{4}\b/g,
            gdpr: true,
            hipaa: false,
        },
        {
            name: 'Date of Birth',
            pattern: /\b(0[1-9]|1[0-2])[-/](0[1-9]|[12]\d|3[01])[-/]\d{4}\b/g,
            gdpr: true,
            hipaa: true,
        },
        {
            name: 'IP Address',
            pattern: /\b\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}\b/g,
            gdpr: true,
            hipaa: false,
        },
        {
            name: 'Passport Number',
            pattern: /\b[A-Z]{1,2}\d{6,9}\b/g,
            gdpr: true,
            hipaa: false,
        },
        {
            name: 'Driver License',
            pattern: /\b[A-Z]{1,2}\d{5,8}\b/g,
            gdpr: true,
            hipaa: false,
        },
    ];

    const findings = [];

    lines.forEach((line, index) => {
        for (const pii of piiPatterns) {
            const matches = line.match(pii.pattern);
            if (matches) {
                const finding = {
                    type: 'PII',
                    dataType: pii.name,
                    file: filePath,
                    line: index + 1,
                    matches: matches.length,
                    redacted: matches.map((m) => m.substring(0, 4) + '****'),
                    gdpr: pii.gdpr,
                    hipaa: pii.hipaa,
                };

                if (includeContext) {
                    finding.context = lines
                        .slice(
                            Math.max(0, index - contextLines),
                            Math.min(lines.length, index + contextLines + 1)
                        )
                        .join('\n');
                }

                findings.push(finding);
            }
        }
    });

    return {
        file: filePath,
        totalPII: findings.length,
        byType: groupBy(findings, 'dataType'),
        gdprApplicable: findings.filter((f) => f.gdpr).length,
        hipaaApplicable: findings.filter((f) => f.hipaa).length,
        findings,
    };
}

function groupBy(arr, key) {
    return arr.reduce((acc, item) => {
        const group = item[key];
        acc[group] = (acc[group] || 0) + 1;
        return acc;
    }, {});
}

// Usage
const piiReport = await scanForPII('/project/data/users.csv');
console.log(`Found ${piiReport.totalPII} PII instances`);
console.log('GDPR applicable:', piiReport.gdprApplicable);
```

---

## Compliance Auditing

### GDPR Compliance Check

```javascript
// Example: Check GDPR compliance
async function auditGDPRCompliance(projectPath) {
    const files = await getAllSourceFiles(projectPath);

    const checks = [
        {
            name: 'Data Processing Consent',
            pattern: /consent|agreed|accepted.*terms/i,
            required: true,
            description: 'Check for user consent mechanisms',
        },
        {
            name: 'Data Retention Policy',
            pattern: /retention|delete.*data|expire|ttl/i,
            required: true,
            description: 'Check for data retention policies',
        },
        {
            name: 'Right to Erasure',
            pattern: /delete.*user|forget.*user|erase.*data/i,
            required: true,
            description: 'Check for data deletion capability',
        },
        {
            name: 'Privacy Policy Link',
            pattern: /privacy.*policy|data.*protection/i,
            required: true,
            description: 'Check for privacy policy references',
        },
        {
            name: 'Data Encryption',
            pattern: /encrypt|cipher|hash|bcrypt/i,
            required: true,
            description: 'Check for encryption implementation',
        },
        {
            name: 'Data Portability',
            pattern: /export.*data|download.*data|json.*export/i,
            required: false,
            description: 'Check for data export capability',
        },
    ];

    const results = [];

    for (const file of files) {
        const content = await Desktop_Commander_read_file(file);

        for (const check of checks) {
            const found = check.pattern.test(content);
            results.push({
                check: check.name,
                file,
                found,
                required: check.required,
                description: check.description,
            });
        }
    }

    // Aggregate by check
    const byCheck = {};
    checks.forEach((check) => {
        const matches = results.filter((r) => r.check === check.name && r.found);
        byCheck[check.name] = {
            found: matches.length > 0,
            files: matches.map((m) => m.file),
            required: check.required,
        };
    });

    const missingRequired = Object.entries(byCheck)
        .filter(([_, data]) => data.required && !data.found)
        .map(([name, _]) => name);

    return {
        compliant: missingRequired.length === 0,
        checks: byCheck,
        missingRequired,
        recommendations: missingRequired.map((name) => ({
            check: name,
            action: `Implement ${name.toLowerCase()} mechanism`,
        })),
    };
}

async function getAllSourceFiles(dirPath) {
    const results = await Desktop_Commander_start_search({
        path: dirPath,
        pattern: '*.{js,ts,py,java,go,rb,php}',
        searchType: 'files',
    });
    return results;
}
```

### PCI-DSS Compliance Check

```javascript
// Example: Check PCI-DSS compliance
async function auditPCIDSS(projectPath) {
    const findings = {
        cardDataStorage: [],
        encryptionUsage: [],
        accessControls: [],
        logging: [],
    };

    const files = await getAllSourceFiles(projectPath);

    for (const file of files) {
        const content = await Desktop_Commander_read_file(file);

        // Check for card data storage
        const cardPatterns = [
            /card_number|cardNumber|credit_card/gi,
            /\b\d{4}[-\s]?\d{4}[-\s]?\d{4}[-\s]?\d{4}\b/g,
        ];

        for (const pattern of cardPatterns) {
            if (pattern.test(content)) {
                findings.cardDataStorage.push({
                    file,
                    pattern: pattern.source,
                    severity: 'CRITICAL',
                    recommendation: 'Never store card data in plaintext',
                });
            }
        }

        // Check for encryption
        if (content.includes('card') || content.includes('payment')) {
            if (!content.match(/encrypt|cipher|AES|RSA/i)) {
                findings.encryptionUsage.push({
                    file,
                    severity: 'HIGH',
                    recommendation: 'Use encryption for card data handling',
                });
            }
        }

        // Check for access controls
        if (content.match(/payment|card/i)) {
            if (!content.match(/auth|permission|role|access/i)) {
                findings.accessControls.push({
                    file,
                    severity: 'HIGH',
                    recommendation: 'Implement access controls for payment functions',
                });
            }
        }
    }

    return {
        compliant: findings.cardDataStorage.length === 0,
        summary: {
            cardDataExposures: findings.cardDataStorage.length,
            missingEncryption: findings.encryptionUsage.length,
            missingAccessControls: findings.accessControls.length,
        },
        findings,
    };
}
```

---

## Configuration Security

### Environment File Audit

```javascript
// Example: Audit environment files
async function auditEnvironmentFile(envPath) {
    const content = await Desktop_Commander_read_file(envPath);
    const lines = content.split('\n');

    const issues = [];
    const variables = [];

    const sensitiveKeywords = ['SECRET', 'PASSWORD', 'TOKEN', 'KEY', 'CREDENTIAL', 'AUTH'];

    lines.forEach((line, index) => {
        if (line.trim().startsWith('#') || !line.trim()) return;

        const match = line.match(/^([A-Z_][A-Z0-9_]*)=(.*)$/i);
        if (!match) {
            issues.push({
                type: 'FORMAT',
                line: index + 1,
                content: line.trim(),
                severity: 'LOW',
                message: 'Invalid environment variable format',
            });
            return;
        }

        const [, name, value] = match;
        const isSensitive = sensitiveKeywords.some((kw) => name.toUpperCase().includes(kw));

        variables.push({
            name,
            sensitive: isSensitive,
            line: index + 1,
            hasValue: value.trim().length > 0,
        });

        // Check for issues
        if (isSensitive) {
            if (!value || value === '' || value === 'changeme') {
                issues.push({
                    type: 'EMPTY_SECRET',
                    variable: name,
                    line: index + 1,
                    severity: 'CRITICAL',
                    message: 'Empty or default value for sensitive variable',
                });
            }

            if (value.length < 16) {
                issues.push({
                    type: 'WEAK_SECRET',
                    variable: name,
                    line: index + 1,
                    severity: 'HIGH',
                    message: 'Value appears to be too short for a secure secret',
                });
            }
        }

        if (value.includes('localhost') || value.includes('127.0.0.1')) {
            issues.push({
                type: 'LOCALHOST_URL',
                variable: name,
                line: index + 1,
                severity: 'MEDIUM',
                message: 'Localhost URL in environment variable',
            });
        }
    });

    return {
        file: envPath,
        totalVariables: variables.length,
        sensitiveVariables: variables.filter((v) => v.sensitive).length,
        issues,
        severityCounts: {
            critical: issues.filter((i) => i.severity === 'CRITICAL').length,
            high: issues.filter((i) => i.severity === 'HIGH').length,
            medium: issues.filter((i) => i.severity === 'MEDIUM').length,
            low: issues.filter((i) => i.severity === 'LOW').length,
        },
    };
}
```

---

## Integrity Verification

### File Checksum Verification

```javascript
// Example: Verify file integrity with checksums
import { createHash } from 'crypto';

async function verifyFileIntegrity(filePath, expectedHash = null) {
    const content = await Desktop_Commander_read_file(filePath);

    const hash = createHash('sha256').update(content).digest('hex');

    const result = {
        file: filePath,
        hash,
        size: content.length,
        lines: content.split('\n').length,
        verified: false,
    };

    if (expectedHash) {
        result.expectedHash = expectedHash;
        result.verified = hash === expectedHash;

        if (!result.verified) {
            result.severity = 'CRITICAL';
            result.message = 'File integrity check failed - possible tampering';
        }
    }

    return result;
}

// Usage
const integrity = await verifyFileIntegrity('/project/config.json', 'abc123...');
console.log(`Integrity verified: ${integrity.verified}`);
```

### Directory Integrity Baseline

```javascript
// Example: Create and verify directory baseline
async function createIntegrityBaseline(dirPath) {
    const files = await getAllSourceFiles(dirPath);
    const baseline = [];

    for (const file of files) {
        const content = await Desktop_Commander_read_file(file);
        const hash = createHash('sha256').update(content).digest('hex');

        baseline.push({
            file: file.replace(dirPath, ''),
            hash,
            size: content.length,
            modified: (await Desktop_Commander_get_file_info(file)).mtime,
        });
    }

    return {
        timestamp: new Date().toISOString(),
        directory: dirPath,
        fileCount: baseline.length,
        baseline,
    };
}

async function verifyAgainstBaseline(currentBaseline, savedBaseline) {
    const differences = [];

    // Create lookup maps
    const savedMap = new Map(savedBaseline.baseline.map((b) => [b.file, b]));
    const currentMap = new Map(currentBaseline.baseline.map((b) => [b.file, b]));

    // Check for modified files
    for (const [file, current] of currentMap) {
        const saved = savedMap.get(file);

        if (!saved) {
            differences.push({ file, change: 'ADDED', severity: 'MEDIUM' });
        } else if (current.hash !== saved.hash) {
            differences.push({
                file,
                change: 'MODIFIED',
                severity: 'HIGH',
                previousHash: saved.hash,
                currentHash: current.hash,
            });
        }
    }

    // Check for deleted files
    for (const [file, _] of savedMap) {
        if (!currentMap.has(file)) {
            differences.push({ file, change: 'DELETED', severity: 'HIGH' });
        }
    }

    return {
        verified: differences.length === 0,
        differences,
        summary: {
            added: differences.filter((d) => d.change === 'ADDED').length,
            modified: differences.filter((d) => d.change === 'MODIFIED').length,
            deleted: differences.filter((d) => d.change === 'DELETED').length,
        },
    };
}
```

---

## Custom Audit Rules

### Creating Custom Security Rules

```javascript
// Example: Define custom audit rules
class CustomAuditor {
    constructor() {
        this.rules = [];
    }

    addRule(config) {
        this.rules.push({
            id: config.id,
            name: config.name,
            pattern: config.pattern,
            severity: config.severity,
            message: config.message,
            fix: config.fix,
        });
    }

    async audit(filePath) {
        const content = await Desktop_Commander_read_file(filePath);
        const lines = content.split('\n');
        const findings = [];

        lines.forEach((line, index) => {
            for (const rule of this.rules) {
                if (rule.pattern.test(line)) {
                    findings.push({
                        ruleId: rule.id,
                        ruleName: rule.name,
                        severity: rule.severity,
                        file: filePath,
                        line: index + 1,
                        content: line.trim(),
                        message: rule.message,
                        fix: rule.fix,
                    });
                }
                rule.pattern.lastIndex = 0;
            }
        });

        return findings;
    }
}

// Usage
const auditor = new CustomAuditor();

// Add custom rules
auditor.addRule({
    id: 'CUSTOM-001',
    name: 'Hardcoded API URL',
    pattern: /https?:\/\/api\.[a-z]+\.[a-z]+\/v\d+/gi,
    severity: 'MEDIUM',
    message: 'Hardcoded API URL found',
    fix: 'Use environment variable for API URL',
});

auditor.addRule({
    id: 'CUSTOM-002',
    name: 'Console.log in Production',
    pattern: /console\.(log|debug|info)\(/g,
    severity: 'LOW',
    message: 'Console statement found',
    fix: 'Remove or replace with proper logging',
});

auditor.addRule({
    id: 'CUSTOM-003',
    name: 'TODO/FIXME',
    pattern: /\/\/\s*(TODO|FIXME|HACK|XXX):/gi,
    severity: 'INFO',
    message: 'TODO comment found',
    fix: 'Address or remove TODO comment',
});

const findings = await auditor.audit('/project/src/app.js');
console.log(`Found ${findings.length} issues`);
```

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/security-audit.yml
name: Security Audit

on:
    push:
        branches: [main, develop]
    pull_request:
        branches: [main]

jobs:
    audit:
        runs-on: ubuntu-latest

        steps:
            - uses: actions/checkout@v3

            - name: Run Security Audit
              run: |
                  node -e "
                  const { performSecurityAudit } = require('./skills/audit');

                  (async () => {
                    const report = await performSecurityAudit('.');
                    
                    console.log('Security Audit Report');
                    console.log('====================');
                    console.log('Critical:', report.summary.criticalFindings);
                    console.log('High:', report.summary.highFindings);
                    console.log('Medium:', report.summary.mediumFindings);
                    console.log('Low:', report.summary.lowFindings);
                    
                    if (report.summary.criticalFindings > 0) {
                      console.error('CRITICAL SECURITY ISSUES FOUND');
                      process.exit(1);
                    }
                  })();
                  "
```

### Pre-commit Hook

```bash
#!/bin/bash
# .git/hooks/pre-commit

echo "Running security audit..."

node -e "
const { auditSecrets } = require('./skills/audit');

(async () => {
  const secrets = await auditSecrets('.');

  if (secrets.length > 0) {
    console.error('Potential secrets found:');
    secrets.forEach(s => console.error(\`  - \${s.pattern} in \${s.file}:\${s.line}\`));
    process.exit(1);
  }

  console.log('No secrets found.');
})();
"
```

---

## Best Practices

1. **Scan early and often** - Integrate into CI/CD pipeline
2. **Use multiple patterns** - Combine regex with semantic analysis
3. **Minimize false positives** - Allow list known safe patterns
4. **Track findings** - Use issue tracker for remediation
5. **Rotate exposed secrets** - Immediate action for critical findings
6. **Document exceptions** - Justify accepted risks
7. **Regular audits** - Schedule periodic security reviews
8. **Team training** - Educate on security best practices

---

## Related Documentation

- [SKILL.md](./SKILL.md) - Main skill documentation
- [README.md](./README.md) - Skill overview and API reference
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE/SANS Top 25](https://cwe.mitre.org/top25/)
