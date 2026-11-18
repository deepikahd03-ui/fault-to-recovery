#!/usr/bin/env bash
# Auth smoke-test for the Fault-to-Recovery backend.
# Verifies: no-token 401, wrong-password 401, valid-login issues token,
#           token grants access, tampered token 401, protected write endpoints work.
set -u
BASE="http://localhost:5000/api"
pass=0; fail=0
check() { # desc  expected_status  actual_status
  if [ "$2" = "$3" ]; then echo "  PASS [$1] HTTP $3"; pass=$((pass+1));
  else echo "  FAIL [$1] expected $2 got $3"; fail=$((fail+1)); fi
}

echo "== 1. No token on protected endpoint =="
s=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/network/state")
check "GET /network/state without token" 401 "$s"

echo "== 2. Wrong password =="
body=$(curl -s -w "\n%{http_code}" -X POST "$BASE/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@bescom.sim","password":"WRONGPASS"}')
code=$(echo "$body" | tail -1)
json=$(echo "$body" | head -1)
check "POST /login wrong password" 401 "$code"
echo "     body: $json"

echo "== 3. Valid login =="
body=$(curl -s -w "\n%{http_code}" -X POST "$BASE/login" \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@bescom.sim","password":"demo123"}')
code=$(echo "$body" | tail -1)
json=$(echo "$body" | head -1)
check "POST /login valid creds" 200 "$code"
TOKEN=$(echo "$json" | python3 -c "import sys,json;print(json.load(sys.stdin).get('token',''))" 2>/dev/null)
if [ -n "$TOKEN" ]; then echo "     PASS [token issued] len=${#TOKEN}"; pass=$((pass+1));
else echo "     FAIL [no token in response]"; fail=$((fail+1)); fi

echo "== 4. Valid token grants access =="
s=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/network/state" -H "Authorization: Bearer $TOKEN")
check "GET /network/state with token" 200 "$s"

echo "== 5. Tampered token rejected =="
s=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/network/state" -H "Authorization: Bearer ${TOKEN}tampered")
check "GET /network/state tampered token" 401 "$s"

echo "== 6. Protected write endpoints with token =="
s=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/simulate/fault" \
  -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"scenario":"S1"}')
check "POST /simulate/fault S1 with token" 200 "$s"
s=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/simulate/restore" -H "Authorization: Bearer $TOKEN")
check "POST /simulate/restore with token" 200 "$s"
s=$(curl -s -o /dev/null -w "%{http_code}" "$BASE/events?type=fault" -H "Authorization: Bearer $TOKEN")
check "GET /events with token" 200 "$s"

echo "== 7. Protected write endpoints WITHOUT token =="
s=$(curl -s -o /dev/null -w "%{http_code}" -X POST "$BASE/simulate/fault" \
  -H "Content-Type: application/json" -d '{"scenario":"S1"}')
check "POST /simulate/fault without token" 401 "$s"

echo ""
echo "RESULT: $pass passed, $fail failed"
