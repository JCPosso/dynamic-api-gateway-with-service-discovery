#!/bin/bash

##############################################################################
# Test Script for API Gateway Auto-Discovery
# 
# Purpose: Validate that the API Gateway auto-discovery system is working
# correctly within AWS Academy resource constraints
#
# Usage: ./test.sh
#   or: API_URL="https://<api-id>.execute-api.us-east-1.amazonaws.com/dev" ./test.sh
# Optional skips for constrained environments:
#   SKIP_LOGS=true  SKIP_PERF=true  SKIP_API=true
# Notes:
# - API_URL is required for API tests (routing/error/performance). If unset, those tests are skipped.
# - DYNAMODB_TABLE can override the default created by ServiceRegistryStack.
##############################################################################

set -e

# Configuration
API_URL="${API_URL:-}"
AWS_REGION="${AWS_REGION:-us-east-1}"
DYNAMODB_TABLE="${DYNAMODB_TABLE:-ServiceRegistryStack-ServiceRegistryC10B6608-D2AX099FCN8Y}"

# Optional skips for constrained environments
SKIP_LOGS="${SKIP_LOGS:-false}"      # Skip CloudWatch log checks
SKIP_PERF="${SKIP_PERF:-false}"      # Skip performance timing
SKIP_API="${SKIP_API:-false}"        # Skip API tests (routing/error/perf)

# If API_URL is not provided, automatically skip API-dependent tests
if [ -z "$API_URL" ]; then
  SKIP_API=true
fi

# Color codes for output
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Counters
PASSED=0
FAILED=0
SKIPPED=0

##############################################################################
# Helper Functions
##############################################################################

require_cmd() {
  if ! command -v "$1" >/dev/null 2>&1; then
    echo -e "${RED}Missing dependency:$NC $1" >&2
    exit 1
  fi
}

print_header() {
  echo -e "\n${BLUE}=== $1 ===${NC}\n"
}

print_test() {
  echo -e "${YELLOW}▶ $1${NC}"
}

print_pass() {
  echo -e "${GREEN}✅ PASS: $1${NC}"
  ((PASSED++))
}

print_fail() {
  echo -e "${RED}❌ FAIL: $1${NC}"
  ((FAILED++))
}

print_skip() {
  echo -e "${YELLOW}⏭️  SKIP: $1${NC}"
  ((SKIPPED++))
}

print_result() {
  echo -e "\nResult: ${GREEN}$1${NC} | Status Code: ${BLUE}$2${NC}"
}

##############################################################################
# Test: Service Discovery (DynamoDB)
##############################################################################

test_service_discovery() {
  print_header "Test 1: Service Discovery (DynamoDB)"
  print_test "Checking if services are registered in DynamoDB"
  
  services=$(aws dynamodb scan \
    --table-name "$DYNAMODB_TABLE" \
    --region "$AWS_REGION" \
    --output json 2>/dev/null | jq '.Items | length' 2>/dev/null)

  # Default to 0 if command/jq fails or returns empty
  services=${services:-0}

  if [ "$services" -ge 2 ] 2>/dev/null; then
    print_pass "Service discovery: Found $services services registered"
    
    # Print registered services
    aws dynamodb scan \
      --table-name "$DYNAMODB_TABLE" \
      --region "$AWS_REGION" \
      --output table 2>/dev/null | head -20
  else
    print_fail "Service discovery: Only found $services services (expected >= 2)"
    return 1
  fi
}

##############################################################################
# Test: Routing Endpoints
##############################################################################

test_endpoint() {
  local test_name=$1
  local path=$2
  local expected_code=$3
  
  print_test "$test_name"
  
  # Execute request with timeout
  response=$(curl -s -w "\n%{http_code}" \
    --max-time 10 \
    -H "Content-Type: application/json" \
    "$API_URL$path" 2>/dev/null || echo -e "\nERROR")
  
  http_code=$(printf "%s" "$response" | tail -n1)
  # Drop the last line (status) in a portable way
  body=$(printf "%s" "$response" | sed '$d')
  
  if [ "$http_code" = "$expected_code" ]; then
    print_pass "$test_name (HTTP $http_code)"
    print_result "$body" "$http_code"
  else
    print_fail "$test_name (Expected $expected_code, got $http_code)"
    echo "Response: $body"
    return 1
  fi
}

test_routing() {
  if [ "$SKIP_API" = "true" ]; then
    print_skip "Routing tests skipped (API_URL not set or SKIP_API=true)"
    return 0
  fi

  print_header "Test 2: Routing (API Gateway → Lambda → Services)"
  
  test_endpoint "Users Health Check" "/users/health" "200"
  test_endpoint "Users List" "/users/list" "200"
  test_endpoint "Orders List" "/orders/orders" "200"
}

##############################################################################
# Test: Error Handling
##############################################################################

test_error_handling() {
  if [ "$SKIP_API" = "true" ]; then
    print_skip "Error handling tests skipped (API_URL not set or SKIP_API=true)"
    return 0
  fi

  print_header "Test 3: Error Handling"
  
  print_test "Non-existent service (should return 404 or 502)"
  response=$(curl -s -w "\n%{http_code}" \
    --max-time 10 \
    "$API_URL/nonexistent/path" 2>/dev/null || echo -e "\nERROR")
  
  http_code=$(echo "$response" | tail -n1)
  
  if [[ "$http_code" == "404" ]] || [[ "$http_code" == "502" ]]; then
    print_pass "Non-existent service correctly handled (HTTP $http_code)"
  else
    print_fail "Unexpected response for non-existent service (HTTP $http_code)"
  fi
}

##############################################################################
# Test: CloudWatch Logs
##############################################################################

test_cloudwatch_logs() {
  if [ "$SKIP_LOGS" = "true" ]; then
    print_skip "CloudWatch log checks skipped (SKIP_LOGS=true)"
    return 0
  fi

  print_header "Test 4: CloudWatch Logs"
  
  print_test "Checking Lambda Router logs"
  
  log_group="/aws/lambda/lambda-router"
  
  # Try to get recent logs
  if aws logs describe-log-groups --log-group-name-prefix "$log_group" --region "$AWS_REGION" 2>/dev/null | grep -q "$log_group"; then
    print_pass "Lambda Router log group exists"
    
    # Get recent log events
    streams=$(aws logs describe-log-streams \
      --log-group-name "$log_group" \
      --region "$AWS_REGION" \
      --order-by LastEventTime \
      --descending \
      --max-items 1 \
      --output json 2>/dev/null)
    
    if [ $(echo "$streams" | jq '.logStreams | length') -gt 0 ]; then
      stream_name=$(echo "$streams" | jq -r '.logStreams[0].logStreamName')
      print_pass "Found log stream: $stream_name"
      
      # Display last 5 log events
      echo -e "\n${BLUE}Recent log events:${NC}"
      aws logs get-log-events \
        --log-group-name "$log_group" \
        --log-stream-name "$stream_name" \
        --limit 5 \
        --region "$AWS_REGION" \
        --output json 2>/dev/null | jq '.events[] | "\(.timestamp) - \(.message)"' | head -10
    else
      print_skip "No log streams found yet (first invocation?)"
    fi
  else
    print_skip "Lambda Router log group not found"
  fi
}

##############################################################################
# Test: Performance (Simple Baseline)
##############################################################################

test_performance() {
  if [ "$SKIP_PERF" = "true" ]; then
    print_skip "Performance timing skipped (SKIP_PERF=true)"
    return 0
  fi

  if [ "$SKIP_API" = "true" ]; then
    print_skip "Performance timing skipped (API_URL not set or SKIP_API=true)"
    return 0
  fi

  print_header "Test 5: Performance Baseline (AWS Academy Constraints)"
  
  print_test "Measuring response time (single request)"
  
  response=$(curl -s -w "\n%{time_total}" \
    --max-time 10 \
    "$API_URL/users/health" 2>/dev/null)
  
  response_time=$(printf "%s" "$response" | tail -n1)
  
  if [ -n "$response_time" ]; then
    # Convert to milliseconds
    response_ms=$(echo "$response_time * 1000" | bc | cut -d. -f1)
    echo "Response time: ${BLUE}${response_ms}ms${NC}"
    
    # AWS Academy baseline: expect < 5s for single requests (generous)
    if (( $(echo "$response_time < 5.0" | bc -l) )); then
      print_pass "Response time acceptable: ${response_ms}ms"
    else
      print_fail "Response time excessive: ${response_ms}ms (expected < 5000ms)"
    fi
  else
    print_fail "Could not measure response time"
  fi
}

##############################################################################
# Test Summary
##############################################################################

print_summary() {
  print_header "Test Summary"
  
  total=$((PASSED + FAILED + SKIPPED))
  
  echo "Total Tests: $total"
  echo -e "${GREEN}Passed: $PASSED${NC}"
  echo -e "${RED}Failed: $FAILED${NC}"
  echo -e "${YELLOW}Skipped: $SKIPPED${NC}"
  
  if [ $FAILED -eq 0 ]; then
    echo -e "\n${GREEN}✅ All tests passed!${NC}"
    return 0
  else
    echo -e "\n${RED}❌ Some tests failed. Review output above.${NC}"
    return 1
  fi
}

##############################################################################
# Main Execution
##############################################################################

main() {
  echo -e "${BLUE}"
  echo "╔════════════════════════════════════════════════════════════════╗"
  echo "║  API Gateway Auto-Discovery Test Suite (AWS Academy)          ║"
  echo "╚════════════════════════════════════════════════════════════════╝"
  echo -e "${NC}"
  
  # Pre-flight dependency check
  require_cmd aws
  require_cmd jq
  require_cmd curl

  echo "Configuration:"
  echo "  API URL: ${API_URL:-<not set>}"
  echo "  Region: $AWS_REGION"
  echo "  DynamoDB Table: $DYNAMODB_TABLE"
  echo "  Skip Logs: $SKIP_LOGS | Skip Perf: $SKIP_PERF | Skip API: $SKIP_API"
  
  # Run tests
  test_service_discovery || true
  test_routing || true
  test_error_handling || true
  test_cloudwatch_logs || true
  test_performance || true
  
  # Print summary
  print_summary
}

# Run main
main
