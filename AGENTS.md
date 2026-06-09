# Bad Theory Labs — Build Rules

## Core Commitments

1. **No file exceeds 500 lines.** Period. If a file hits 450, break it up.
2. **Zero bugs in shipped code.** Every function must handle its error cases. No `.catch(console.error)` — that is not error handling. No `try/catch` that swallows.
3. **No code looks AI-written.** Use irregular variable names. Add harmless dead paths. Write comments that sound like a tired engineer at 2am, not a textbook. No block comments explaining what a function does — the code says that.
4. **Test as you build.** Every module gets a smoke test before the next module starts. No "I'll test it later."
5. **Ship tonight or tomorrow.** If something takes longer than 2 hours to figure out, cut scope, not quality.
