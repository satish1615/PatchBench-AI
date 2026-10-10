# PatchBench AI

**A local-first, interactive software engineering benchmark task validator**, built to reduce repetitive manual quality checks when authoring tasks for AI coding-agent evaluation.

[![CI](https://github.com/satish1615/PatchBench-AI/actions/workflows/ci.yml/badge.svg)](https://github.com/satish1615/PatchBench-AI/actions/workflows/ci.yml)

## What it does

Upload a ZIP with before/after source trees, a JSON task description, and named regression tests. PatchBench checks:

- **Repository integrity:** undeclared modifications or deletions, missing targets and duplicate paths.
- **Context fidelity:** exactly match `context_items` to all files in `states/before/`.
- **Target precision:** `whole_file`, `new_file`, `function_body` (Python) and `replacement_region` with unique anchors.
- **Test inventory:** every test reference must have `path::test_name`, point to an existing function, belong to the right suite, and account for all pass-to-pass tests.
- **Runner readiness:** checks for Docker/test.sh, missing pytest installation, unsupported test invocations, network calls and nondeterministic patterns.
- **Reports:** exports JSON and Markdown with categorized findings and source file status.

All checks happen **in your browser**. The tool never uploads your files, executes untrusted code, contacts an LLM, or calls GitHub. This is **static validation**, not a replacement for a secure offline runner. A structurally valid report is **not** proof that before-state fail-to-pass tests fail and after-state tests pass.

### Live demo

Open the repository in a browser-hosted static site (such as GitHub Pages) and select **Try a sample task**. The first sample passes structure checks; the deliberately broken sample demonstrates detection of unapproved edits, incomplete context, and test reference errors.

### How to run locally

No packages or API keys are needed. Python 3 is used only for the development web server:

```bash
python3 -m http.server 8080
# open http://localhost:8080
```

Tests require Node.js 20+ (no npm dependencies):

```bash
npm test
npm run check
```

### Input format

```text
my-task.zip
├── task.json
├── states/
│   ├── before/client.py
│   ├── before/config.py
│   ├── after/client.py
│   └── after/config.py
├── tests/
│   ├── fail2pass/test_retry.py
│   └── pass2pass/test_client.py
├── Dockerfile
└── test.sh
```

Example `task.json`:

```json
{
  "schema_version": "1.0",
  "task_id": "retry-policy-503",
  "title": "Repair HTTP retry behavior",
  "language": "python",
  "context_items": ["client.py", "config.py"],
  "targets": [
    {"path": "client.py", "type": "function_body", "symbol": "fetch"}
  ],
  "tests": {
    "FAIL_TO_PASS": ["tests/fail2pass/test_retry.py::test_retries_on_503"],
    "PASS_TO_PASS": ["tests/pass2pass/test_client.py::test_success"]
  }
}
```

Use paths relative to `states/before/` for `context_items` and relative to the ZIP root for `targets`. Tests must be identified by the exact source path and test function name. For Python `function_body` targets, the function signature and all code outside its body must remain identical in the after state. `replacement_region` uses `{ "start_anchor": "...", "end_anchor": "..." }` within `region`.

**Go:** use `whole_file` or `replacement_region` targets; the function-body checker currently covers Python only. Go test declarations are scanned from `func TestName(t *testing.T)`.

### ZIP safety limits

12 MB compressed, 16 MB total uncompressed, 4 MB per text file, 300 entries. Rejects paths with traversal, absolute paths, duplicate entries, symlinks, encrypted entries, unsupported formats, and incorrect checksums. ZIP32 with store/deflate is supported; ZIP64 and non-UTF-8 source files are not. A modern browser with `DecompressionStream('deflate-raw')` is recommended.

## Development log: bug found and fixed

During the initial manual test plan, a naive parser could accept a ZIP entry based only on its central-directory filename. A malicious entry such as `../secret.py` could then appear to be legitimate task content. **Standing rule:** every archive entry is checked for safe paths, duplicates, maximum size and CRC before it is used. Test coverage includes this path-traversal regression. A second refinement ensures missing test function names are reported independently of missing test files.

## Roadmap

- Isolated runner service that can execute before/after code without network, resource abuse or secrets exposure.
- More complete Python AST-based and Go parser-backed region validation.
- Configurable lint rules and task JSON schema versions.
- Team review queues and signatures for verified task artifacts.

## Scope and mission

Built as a repeatable benchmark review helper for the **Vibe Code an App** mission. The required Google AI Studio Build / Debug / Share workflow must be completed in Google AI Studio separately; this repository can serve as project code and a reference implementation. Do not present a GitHub repository link as a live app unless it has actually been deployed.

MIT License. All example tasks are independently created for demonstration.
