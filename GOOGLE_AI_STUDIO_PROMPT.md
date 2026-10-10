# Google AI Studio build instructions for the Vibe Code an App mission

Paste this into **Google AI Studio → Build → New app**. Review the plan before accepting code generation.

> Build "PatchBench AI", a professional browser-based productivity tool for software engineering benchmark authors. It automates repetitive validation of benchmark task packages used to evaluate AI coding agents. The user uploads a ZIP containing task.json, states/before, states/after, tests/fail2pass and tests/pass2pass. Parse archives only in the browser, never execute the contents, never send files to a backend. Compare non-target files byte-for-byte, check context_items against all before-state files, verify declared edit types (function_body, replacement_region, whole_file, new_file), check exact test path::function identifiers, warn about missing test coverage and runner issues, and provide a clear downloadable JSON/Markdown report. Include two original demo tasks, one valid and one broken. Use accessible responsive design with Overview, Validate, Rules and History views. Limit upload size and block ZIP path traversal. Provide clear first-user guidance and explain that static validation cannot prove actual test execution. Plan before building. Add automated validator tests and a public sharing-ready UI. After the first version, test with a deliberately broken example, fix one reproducible defect, rerun and document the permanent rule.

## Required user steps

1. Open [Google AI Studio](https://aistudio.google.com/) and enter the Build area.
2. Paste the prompt above and inspect Gemini's plan. Correct any missing privacy and deterministic validation requirements.
3. Build, test using valid/broken examples, and make at least one verified improvement in Google AI Studio.
4. Add an onboarding view, use its share control to privately test with a trusted person, then publish/share as your mission allows.
5. Use **the actual live Google AI Studio app URL** in the Handshake form. The GitHub project is supporting evidence, not a substitute.

This plan is meant to help you complete the platform-specific mission requirements accurately, not to imply the GitHub implementation was built inside Google AI Studio.
