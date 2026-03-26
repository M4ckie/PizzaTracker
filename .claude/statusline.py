#!/usr/bin/env python3
"""
Agent Kit Statusline for Claude Code

Input (JSON via stdin):
  cwd, model, session_id, transcript_path

Output (2 lines):
  Line 1: [context bar] | [active crew member]
  Line 2: [edited files] [upstream] | [git branch]
"""

import json
import sys
import subprocess
import os
from pathlib import Path

# ── Windows UTF-8 fix ──
if sys.platform == "win32":
    import io
    sys.stdout = io.TextIOWrapper(
        sys.stdout.buffer, encoding="utf-8", errors="replace", line_buffering=True
    )

# ── Read stdin ──
data = json.load(sys.stdin)
cwd = data.get("cwd", ".")
model_name = data.get("model", {}).get("display_name", "unknown")
transcript_path = data.get("transcript_path")

# ── ANSI colors (Ayu Dark palette) ──
green = "\033[38;5;114m"
orange = "\033[38;5;215m"
red = "\033[38;5;203m"
gray = "\033[38;5;242m"
l_gray = "\033[38;5;250m"
cyan = "\033[38;5;111m"
purple = "\033[38;5;183m"
yellow = "\033[38;5;222m"
reset = "\033[0m"

# ── Crew definitions ──
CREW = {
    "planner":   {"icon": "󰠗 ", "label": "Planner"},
    "fixer":     {"icon": "󰣈 ", "label": "Fixer"},
    "cleaner":   {"icon": "󰍉 ", "label": "Cleaner"},
    "ghost":     {"icon": "󰙨 ", "label": "Ghost"},
    "librarian": {"icon": "󰂺 ", "label": "Librarian"},
}

# ── Context limit by model ──
context_limit = 200000
model_lower = model_name.lower()
if "1m" in model_lower or "opus" in model_lower:
    context_limit = 1000000


# ── Parse transcript for token usage ──
def get_context_usage(tp):
    if not tp or not os.path.exists(tp):
        return None
    try:
        with open(tp, "r", encoding="utf-8", errors="backslashreplace") as f:
            lines = f.readlines()
        most_recent = None
        most_recent_ts = None
        for line in lines:
            try:
                entry = json.loads(line.strip())
                if entry.get("isSidechain", False):
                    continue
                usage = entry.get("message", {}).get("usage")
                ts = entry.get("timestamp")
                if usage and ts and (not most_recent_ts or ts > most_recent_ts):
                    most_recent_ts = ts
                    most_recent = usage
            except (json.JSONDecodeError, AttributeError):
                continue
        if most_recent:
            return (
                most_recent.get("input_tokens", 0)
                + most_recent.get("cache_read_input_tokens", 0)
                + most_recent.get("cache_creation_input_tokens", 0)
            )
    except Exception:
        pass
    return None


# ── Detect active crew member from transcript ──
def get_active_crew(tp):
    """Scan transcript for the most recent Agent tool_use with a crew subagent_type."""
    if not tp or not os.path.exists(tp):
        return None
    try:
        with open(tp, "r", encoding="utf-8", errors="backslashreplace") as f:
            lines = f.readlines()
        active = None
        active_ts = None
        for line in lines:
            try:
                entry = json.loads(line.strip())
                if entry.get("isSidechain", False):
                    continue
                content = entry.get("message", {}).get("content")
                if not isinstance(content, list):
                    continue
                for block in content:
                    if block.get("type") != "tool_use":
                        continue
                    if block.get("name") != "Agent":
                        continue
                    inp = block.get("input", {})
                    agent_type = inp.get("subagent_type", "")
                    if agent_type in CREW:
                        ts = entry.get("timestamp")
                        if ts and (not active_ts or ts > active_ts):
                            active_ts = ts
                            active = agent_type
            except (json.JSONDecodeError, AttributeError, TypeError):
                continue
        return active
    except Exception:
        return None


# ── Git helpers ──
def git_cmd(*args):
    try:
        cwd_abs = str(Path(cwd).resolve())
        result = subprocess.check_output(
            ["git", "-C", cwd_abs] + list(args),
            stderr=subprocess.PIPE,
            encoding="utf-8",
            errors="replace",
        )
        return result.strip()
    except (subprocess.CalledProcessError, OSError):
        return None


def get_branch():
    branch = git_cmd("branch", "--show-current")
    if branch:
        return branch, False
    commit = git_cmd("rev-parse", "--short", "HEAD")
    return (commit or "???"), True


def get_upstream():
    parts = []
    ahead = git_cmd("rev-list", "--count", "@{u}..HEAD")
    behind = git_cmd("rev-list", "--count", "HEAD..@{u}")
    if ahead and int(ahead) > 0:
        parts.append(f"↑{ahead}")
    if behind and int(behind) > 0:
        parts.append(f"↓{behind}")
    return " ".join(parts) if parts else None


def get_edited_count():
    unstaged = git_cmd("diff", "--name-only")
    staged = git_cmd("diff", "--cached", "--name-only")
    count = 0
    if unstaged:
        count += len([f for f in unstaged.split("\n") if f])
    if staged:
        count += len([f for f in staged.split("\n") if f])
    return count


# ── Build output ──

# Context bar
context_length = get_context_usage(transcript_path)
if context_length and context_length < 17000:
    context_length = 17000

if context_length:
    pct = min((context_length * 100) / context_limit, 100.0)
    pct_int = int(pct)
    tokens_k = f"{context_length // 1000}k"
    limit_k = f"{context_limit // 1000}k"

    filled = min(pct_int // 10, 10)
    empty = 10 - filled

    if pct_int < 50:
        bar_color = green
    elif pct_int < 80:
        bar_color = orange
    else:
        bar_color = red

    context_bar = (
        f"{l_gray}󱃖  "
        f"{bar_color}{'█' * filled}{gray}{'░' * empty}"
        f"{reset} {l_gray}{pct:.1f}% ({tokens_k}/{limit_k}){reset}"
    )
else:
    context_bar = f"{l_gray}󱃖  {gray}{'░' * 10} 0.0% (17k/{context_limit // 1000}k){reset}"

# Active crew member
active = get_active_crew(transcript_path)
if active:
    crew_info = CREW[active]
    crew_str = f"{yellow}{crew_info['icon']}{crew_info['label']}{reset}"
else:
    crew_str = f"{gray}󰋑  Crew Idle{reset}"

# Git branch
branch, detached = get_branch()
if detached:
    branch_str = f"{l_gray}@{branch} [detached]{reset}"
else:
    branch_str = f"{l_gray}󰘬 {branch}{reset}"

# Upstream
upstream = get_upstream()
upstream_str = f"{orange}{upstream}{reset}" if upstream else ""

# Edited files
edited = get_edited_count()
edited_str = f"{orange}✎ {edited}{reset}"

# ── Print ──

# Line 1: context bar | active crew member
print(f"{context_bar} | {crew_str}")

# Line 2: edited [upstream] | branch
line2_parts = [edited_str]
if upstream_str:
    line2_parts[0] += f" {upstream_str}"
line2_parts.append(branch_str)
print(" | ".join(line2_parts))
