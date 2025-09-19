#!/bin/bash

# F3RVA Redirect Test Suite
# Tests various domain redirects to ensure proper configuration

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Test counters
TOTAL_TESTS=0
PASSED_TESTS=0
FAILED_TESTS=0

# Function to test a redirect
test_redirect() {
    local source_url=$1
    local expected_code=$2
    local expected_destination=$3
    local test_name=$4

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    echo -n "Testing $test_name: $source_url -> "

    # Get HTTP response with redirect info
    local response=$(curl -s -o /dev/null -w "%{http_code}|%{redirect_url}" -L --max-redirs 0 "$source_url")
    local actual_code=$(echo "$response" | cut -d'|' -f1)
    local actual_destination=$(echo "$response" | cut -d'|' -f2)

    # Check status code
    if [ "$actual_code" != "$expected_code" ]; then
        echo -e "${RED}FAIL${NC}"
        echo "  Expected status: $expected_code, Got: $actual_code"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi

    # For redirects (3xx codes), check destination
    if [ "$expected_code" -ge 300 ] && [ "$expected_code" -lt 400 ]; then
        if [ -n "$expected_destination" ] && [ "$actual_destination" != "$expected_destination" ]; then
            echo -e "${RED}FAIL${NC}"
            echo "  Expected destination: $expected_destination, Got: $actual_destination"
            FAILED_TESTS=$((FAILED_TESTS + 1))
            return 1
        fi
    fi

    echo -e "${GREEN}PASS${NC}"
    if [ -n "$actual_destination" ]; then
        echo "  Redirects to: $actual_destination"
    fi
    PASSED_TESTS=$((PASSED_TESTS + 1))
    return 0
}

# Function to test final destination accessibility
test_final_destination() {
    local url=$1
    local test_name=$2

    TOTAL_TESTS=$((TOTAL_TESTS + 1))

    echo -n "Testing final accessibility: $test_name -> "

    local response_code=$(curl -s -o /dev/null -w "%{http_code}" -L "$url")

    if [ "$response_code" = "200" ]; then
        echo -e "${GREEN}PASS${NC}"
        echo "  Final destination accessible (200 OK)"
        PASSED_TESTS=$((PASSED_TESTS + 1))
        return 0
    else
        echo -e "${RED}FAIL${NC}"
        echo "  Expected: 200, Got: $response_code"
        FAILED_TESTS=$((FAILED_TESTS + 1))
        return 1
    fi
}

echo "=== F3RVA Redirect Test Suite ==="
echo "Testing redirect behavior for all F3RVA domains..."
echo

# Test all redirect scenarios based on the provided table
echo "Testing f3rva.com redirects..."
test_redirect "http://f3rva.com" "301" "https://f3rva.com/" "HTTP f3rva.com"
test_redirect "https://f3rva.com" "301" "https://f3rva.org/" "HTTPS f3rva.com"

echo
echo "Testing www.f3rva.com redirects..."
test_redirect "http://www.f3rva.com" "301" "https://www.f3rva.com/" "HTTP www.f3rva.com"
test_redirect "https://www.f3rva.com" "301" "https://f3rva.org/" "HTTPS www.f3rva.com"

echo
echo "Testing f3rva.net redirects..."
test_redirect "http://f3rva.net" "301" "https://f3rva.net/" "HTTP f3rva.net"
test_redirect "https://f3rva.net" "301" "https://f3rva.org/" "HTTPS f3rva.net"

echo
echo "Testing www.f3rva.net redirects..."
test_redirect "http://www.f3rva.net" "301" "https://www.f3rva.net/" "HTTP www.f3rva.net"
test_redirect "https://www.f3rva.net" "301" "https://f3rva.org/" "HTTPS www.f3rva.net"

echo
echo "Testing f3rva.org (final destination)..."
test_redirect "http://f3rva.org" "301" "https://f3rva.org/" "HTTP f3rva.org"
test_redirect "https://f3rva.org" "200" "" "HTTPS f3rva.org"

echo
echo "Testing www.f3rva.org redirects..."
test_redirect "http://www.f3rva.org" "301" "https://www.f3rva.org/" "HTTP www.f3rva.org"
test_redirect "https://www.f3rva.org" "301" "https://f3rva.org/" "HTTPS www.f3rva.org"

echo
echo "Testing final destination accessibility..."
test_final_destination "https://f3rva.org" "HTTPS f3rva.org final check"

echo
echo "=== Test Summary ==="
echo "Total tests: $TOTAL_TESTS"
echo -e "Passed: ${GREEN}$PASSED_TESTS${NC}"
echo -e "Failed: ${RED}$FAILED_TESTS${NC}"

if [ $FAILED_TESTS -eq 0 ]; then
    echo -e "${GREEN}All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}Some tests failed. Please check the redirect configuration.${NC}"
    exit 1
fi