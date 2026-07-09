#!/usr/bin/env bash
# Run every slice's offline test suite and print a summary.
# Usage: ./run_all_tests.sh
set -u
cd "$(dirname "$0")"

suites=(
  "tests/test_gateway.py"
  "tests/test_integration.py"
  "agent_runtime/tests_agent_runtime.py"
  "video_studio/tests_video_pipeline.py"
  "audio_studio/tests_audio_pipeline.py"
  "lead_gen/tests_lead_gen.py"
  "platform_core/tests_platform.py"
)

fail=0
total=0
echo "──────────────────────────────────────────────────────────────"
for s in "${suites[@]}"; do
  out=$(python "$s" 2>&1); code=$?
  last=$(echo "$out" | grep -E "tests passed" | tail -1)
  n=$(echo "$last" | grep -oE "[0-9]+" | head -1)
  if [ "$code" -eq 0 ]; then
    total=$(( total + ${n:-0} ))
    printf "  \033[32mPASS\033[0m  %-42s %s\n" "$s" "$last"
  else
    fail=1
    printf "  \033[31mFAIL\033[0m  %-42s\n" "$s"
    echo "$out" | tail -6 | sed 's/^/        /'
  fi
done
echo "──────────────────────────────────────────────────────────────"
if [ "$fail" -eq 0 ]; then
  echo "  All suites passed · ${total} tests"
  exit 0
else
  echo "  Some suites failed."
  exit 1
fi
