---
name: test-pipeline
description: Run an end-to-end test of the Head Hunter generation pipeline using the sample job description in tests/sample-jd.txt. Verifies the edge function responds, the JSON parses, and all three outputs (CV, cover letter, LinkedIn) render. Use after any change to claude.js, prompts, or the edge function.
allowed-tools: Bash, Read, Write, Edit
---

# Test the Head Hunter Pipeline End-to-End

Run a complete integration test of the CV/CL/LinkedIn generation flow.

## Configuration

The edge function URL is hardcoded in `src/lib/claude.js` as `EDGE_FN_URL`. Read it from there:

```bash
grep "EDGE_FN_URL" src/lib/claude.js
```

Also read the current model:

```bash
grep "^const MODEL" src/lib/claude.js
```

## Test procedure

1. **Read the sample JD:**
   ```bash
   cat tests/sample-jd.txt
   ```

2. **Call the edge function directly** with a minimal prompt to verify connectivity:

   ```bash
   EDGE_URL=$(grep "EDGE_FN_URL" src/lib/claude.js | grep -oP "https://[^'\"]+")
   MODEL=$(grep "^const MODEL" src/lib/claude.js | grep -oP "claude-[^'\"]+")

   curl -X POST "$EDGE_URL" \
     -H "Content-Type: application/json" \
     -d "{\"model\":\"$MODEL\",\"max_tokens\":100,\"messages\":[{\"role\":\"user\",\"content\":\"Reply with the word hello\"}]}" \
     --max-time 30
   ```

   Confirm HTTP 200 and valid JSON response.

3. **Full generation test.** Call the edge function with the sample JD and a minimal CV stub to test the CV writer prompt:

   ```bash
   JD=$(cat tests/sample-jd.txt | jq -Rs .)

   curl -X POST "$EDGE_URL" \
     -H "Content-Type: application/json" \
     -d "{\"model\":\"$MODEL\",\"max_tokens\":8000,\"messages\":[{\"role\":\"user\",\"content\":$(echo "Generate a tailored CV as JSON with keys: name, contact, summary, experience (array of {company, titleLine, bullets}), education (array of strings), skills (array of strings). Job description: $(cat tests/sample-jd.txt | head -5)" | jq -Rs .)}]}" \
     --max-time 90 \
     -o /tmp/hh-test-response.json
   ```

4. **Validate the response:**
   - HTTP 200 status
   - Response is valid JSON
   - Response contains `content` array with a `text` block
   - The text block contains parseable JSON (no stray markdown fences)

5. **Report results:**
   - Response time (ms)
   - Token usage (from response `usage` field)
   - Whether JSON parsed cleanly or needed cleanup
   - Any validation failures with specific details

## Failure modes to catch

- **Parse errors**: pipe characters, unescaped quotes, trailing commas → prompt regression
- **Timeouts**: > 90s response → model issue or network; retry once, then fail
- **5xx from edge function**: deploy issue; suggest user re-runs `/deploy-edge-function`
- **Empty content**: no text in response → schema regression
