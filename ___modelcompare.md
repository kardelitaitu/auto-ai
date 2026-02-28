# Overview

This repository serves as an audit-ready cognitive map for evaluating AI agent orchestration across IDE and CLI environments. Designed to support inheritable modular workflows, this matrix tracks cost-efficiency, cognitive capability (Coding Skill Index), and maximum context windows. It establishes the baseline metrics required for variant spawning, fallback logic, and entropy-rich system design, ensuring strategic foresight and operational clarity in automated deployments.

## Windsurf IDE (Monthly Cost $15 for 500 credit):

| Stack Origin | Model Identifier | Credit Burn Rate | Coding Skill Index | Max Context (k) | Cost per Prompt |
|---|---|---|---|---|---|
| Anthropic | claude-opus-4.6-fast-thinking | 12.0 credits | 98.5 | 200 | $0.36 |
| Anthropic | claude-opus-4.6-fast | 10.0 credits | 97.8 | 200 | $0.30 |
| Anthropic | claude-sonnet-4.6-thinking | 3.0 credits | 95.2 | 200 | $0.09 |
| Google | gemini-3.1-pro-high-thinking | 1.0 credit | 96.8 | 2000 | $0.03 |
| Google | gemini-2.5-pro | 1.0 credit | 94.1 | 2000 | $0.03 |
| OpenAI | gpt-5.3-codex-medium | 2.0 credits | 97.4 | 128 | $0.06 |
| OpenAI | gpt-5-high-reasoning | 1.5 credits | 96.0 | 128 | $0.045 |
| Windsurf Native | swe-1.5 | 0.0 credits | 92.5 | 128 | $0.00 |
| Windsurf Native | qwen3-coder | 0.5 credits | 91.0 | 128 | $0.0015 |

### Strategy & Fallback Logic

* **Layer 1 - Primary Heavy Orchestrator:** `claude-opus-4.6-fast-thinking` 
  * *Utilization:* Reserved strictly for high-entropy cognitive mapping, complex crypto vault engineering, and core architectural routing.
* **Layer 2 - Mid-Tier Balanced Nodes:** `claude-sonnet-4.6-thinking` | `gemini-3.1-pro-high-thinking`
  * *Utilization:* Deployed for standard modular coding tasks, variant spawning, and routine script hygiene. Offers optimal balance between Coding Skill Index and resource burn.
* **Layer 3 - Zero-Burn Fallback:** `swe-1.5`
  * *Utilization:* Operates continuously for background parsing, session audits, and low-level agentic feedback loops without draining primary token allocations.

## GitHub Copilot (Monthly Cost $10 for 300 credit):

| Stack Origin | Model Identifier | Credit Burn Rate | Coding Skill Index | Max Context (k) | Cost per Prompt |
|---|---|---|---|---|---|
| OpenAI | gpt-4.5-advanced | 50.0 credits | 98.8 | 128 | $1.5 |
| Anthropic | claude-opus-4 | 10.0 credits | 98.4 | 200 | $0.3 |
| Google | gemini-3-pro | 2.0 credits | 97.0 | 2000 | $0.06 |
| Anthropic | claude-sonnet-3.7-thinking | 1.25 credits | 95.8 | 200 | $0.0375 |
| Anthropic | claude-sonnet-4 | 1.0 credits | 96.5 | 200 | $0.03 |
| OpenAI | gpt-5 | 1.0 credits | 96.0 | 128 | $0.03 |
| Google | gemini-2.5-pro | 1.0 credits | 94.1 | 2000 | $0.03 |
| Google | gemini-2.0-flash | 0.25 credits | 89.0 | 1000 | 0.0075 |
| OpenAI | gpt-4.1-base | 0.0 credits | 92.0 | 128 | 0 |

### Strategy & Fallback Logic

* **Layer 1 - Primary Heavy Orchestrator:** `gpt-4.5-advanced` | `claude-opus-4` 
  * *Utilization:* Reserved strictly for high-entropy cognitive mapping, complex crypto vault engineering, and core architectural routing. The extreme burn rate multipliers require strict session hygiene and invocation discipline to preserve the monthly premium request allocation.
* **Layer 2 - Mid-Tier Balanced Nodes:** `claude-sonnet-4` | `gpt-5` | `gemini-3-pro`
  * *Utilization:* Deployed for standard modular coding tasks, variant spawning, and routine script hygiene. Offers optimal balance between cognitive output and the baseline 1x Premium Request burn rate.
* **Layer 3 - Zero-Burn Fallback:** `gpt-4.1-base` | `gemini-2.0-flash`
  * *Utilization:* Operates continuously for background parsing, inline autocompletions, session audits, and low-level agentic feedback loops. Essential for maintaining full-space utilization without draining primary token limits.

  ## Trae IDE (Monthly Cost $10 for 1000 credits):

| Stack Origin | Model Identifier | Credit Burn Rate | Coding Skill Index | Max Context (k) | Cost per Prompt |
|---|---|---|---|---|---|
| Anthropic | claude-opus-4.6-fast-thinking | 15.0 credits | 98.5 | 200 | $0.15 |
| OpenAI | gpt-5.3-codex-medium | 5.0 credits | 97.4 | 128 | $0.05 |
| DeepSeek | deepseek-r1-agent | 2.0 credits | 96.8 | 128 | $0.02 |
| Anthropic | claude-sonnet-4.6-thinking | 3.0 credits | 95.2 | 200 | $0.03 |
| ByteDance | doubao-1.5-pro | 1.0 credits | 95.5 | 200 | $0.01 |
| Trae Native | solo-coder-agent | 1.0 credits | 94.8 | 128 | $0.01 |
| ByteDance | doubao-1.5-lite | 0.0 credits | 89.5 | 128 | $0.00 |
| Trae Native | cue-predictive-v2 | 0.0 credits | 88.0 | 128 | $0.00 |

### Strategy & Fallback Logic

* **Layer 1 - Primary Heavy Orchestrator:** `claude-opus-4.6-fast-thinking` | `deepseek-r1-agent`
  * *Utilization:* Allocated for audit-ready protocol engineering and complex algorithmic parsing. The extreme cost efficiency ($0.15 max) allows for more aggressive variant spawning and cognitive mapping during heavy architectural phases.
* **Layer 2 - Mid-Tier Balanced Nodes:** `doubao-1.5-pro` | `solo-coder-agent`
  * *Utilization:* The baseline workhorses for standard modular development and API wiring. `solo-coder-agent` acts as an inheritable orchestration node that spins up sub-tasks natively within the IDE environment.
* **Layer 3 - Zero-Burn Fallback:** `doubao-1.5-lite` | `cue-predictive-v2`
  * *Utilization:* Continuous background processing for session hygiene, fast inline edits, and instant terminal feedback loops, running at $0.00 to preserve absolute operational clarity and minimize resource waste.