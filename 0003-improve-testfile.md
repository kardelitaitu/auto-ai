# Repeatable Workflow for Improving One *.test.js File

  ## Summary

  - Create a fixed process for taking one test file from “works” to “strong unit test.”
  - The workflow is optimized for repeatability, so the same steps can be reused across api/tests/unit/*.test.js
    files without redesigning the approach each time.
  - The main outcome is a test file that has clearer scope, better assertions, stronger edge-case coverage, and
    less brittle mocking.

  ## Workflow

  1. Pick one target file.
      - Choose the test file with the highest business value or weakest coverage signal.
      - Record the source module it is meant to protect.
      - Define the file’s responsibility in one sentence.
  2. Map the source API before editing tests.
      - List the public functions, exported objects, and key branches in the source module.
      - Identify dependencies that must be mocked.
      - Identify the “happy path,” error path, and boundary cases.
  3. Audit the current test file.
      - Check what the file already covers.
      - Mark missing branches, weak assertions, and duplicated setup.
      - Note whether the test file is too broad, too shallow, or too tightly coupled to implementation details.
  4. Refactor test structure first.
      - Normalize setup into reusable local helpers.
      - Reduce repeated mock construction.
      - Separate “arrange,” “act,” and “assert” sections.
      - Make each test verify one behavior only.
  5. Add high-value coverage in this order.
      - Public API shape and export wiring.
      - Happy path behavior.
      - Error handling and fallback behavior.
      - Boundary values and invalid inputs.
      - Side effects such as logging, cleanup, or state reset.
  6. Strengthen assertions.
      - Prefer behavior assertions over implementation assertions.
      - Assert returned values, call counts, arguments, and error messages where meaningful.
      - Avoid asserting private internals unless the behavior is otherwise impossible to observe.
  7. Remove test brittleness.
      - Eliminate over-specific timing checks unless timing is the behavior being tested.
      - Keep mocks minimal.
      - Replace broad snapshots or giant fixture objects with smaller, purpose-built ones.
  8. Verify the file in isolation.
      - Run the single test file first.
      - Fix any setup or mock issues.
      - Confirm the file passes consistently before running the wider suite.
  9. Measure the improvement.
      - Compare coverage before and after for that module.
      - Check if the file now protects the important branches.
      - Record what remains uncovered and why.
  10. Repeat on the next file.
  - Keep the workflow stable so each new file gets improved the same way.
  ## Standard Test File Checklist

  - The file has a single source module it is protecting.
  - The file covers the public API first, not internals first.
  - Each test focuses on one behavior.
  - Happy path, error path, and edge case coverage are all present.
  - Shared setup is centralized.
  - Mocks are only as large as needed.
  - Assertions prove behavior, not just call presence.
  - The file can run alone and pass repeatedly.

  ## Suggested File Improvement Order

  1. Fix test file structure and helpers.
  2. Cover the main success path.
  3. Add failure and recovery paths.
  4. Add boundary cases.
  5. Remove brittle assertions.
  6. Re-run and measure coverage.

  ## Success Criteria

  - The test file is easier to read and extend.
  - Coverage increases on the source module it protects.
  - The file passes consistently when run alone.
  - Future changes to the source module are more likely to fail fast for real regressions.

  ## Assumptions

  - The user wants a reusable process for improving one test file at a time, not a full suite redesign.
  - The target is Vitest-based unit tests.
  - The best way to improve coverage is to strengthen the test file around observable behavior, not to mirror
    implementation details.