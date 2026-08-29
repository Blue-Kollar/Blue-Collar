#!/bin/bash
# Audit module #121 for unused code and duplicated helpers

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Module #121 Audit - Unused Code & Duplicated Helpers${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Find the module
MODULE_PATH="./packages/module-121"
if [ ! -d "$MODULE_PATH" ]; then
    # Try alternative locations
    MODULE_PATH="./src/modules/121"
fi
if [ ! -d "$MODULE_PATH" ]; then
    MODULE_PATH="./modules/121"
fi
if [ ! -d "$MODULE_PATH" ]; then
    echo -e "${RED}❌ Module #121 not found${NC}"
    echo "Searching for module 121..."
    find . -type d -name "*121*" 2>/dev/null
    exit 1
fi

echo -e "${GREEN}✅ Found module at: $MODULE_PATH${NC}"
echo ""

# 1. Find unused code
echo -e "${YELLOW}📋 Step 1: Finding unused code...${NC}"
./scripts/analyze-dead-code.sh "$MODULE_PATH"
echo ""

# 2. Find duplicated helpers
echo -e "${YELLOW}📋 Step 2: Finding duplicated helpers...${NC}"
find "$MODULE_PATH" -type f -name "*.ts" -exec grep -l "export function" {} \; 2>/dev/null | while read -r file; do
    grep -E "export function" "$file" 2>/dev/null
done | sort | uniq -c | while read -r count line; do
    if [ "$count" -gt 1 ]; then
        echo -e "  ${YELLOW}⚠️ Duplicated: $line ($count occurrences)${NC}"
    fi
done
echo ""

# 3. Check for unused imports
echo -e "${YELLOW}📋 Step 3: Checking for unused imports...${NC}"
find "$MODULE_PATH" -name "*.ts" -o -name "*.tsx" | while read -r file; do
    # Check for imports without usage
    grep -E "^import" "$file" 2>/dev/null | while read -r import_line; do
        imported_name=$(echo "$import_line" | sed -E 's/import \{ ([^}]+) \}.*/\1/' | sed -E 's/import ([a-zA-Z_][a-zA-Z0-9_]*).*/\1/')
        if [ -n "$imported_name" ]; then
            # Check if imported name is used in the file
            usage_count=$(grep -v "^import" "$file" | grep -c "$imported_name" 2>/dev/null || echo 0)
            if [ "$usage_count" -eq 0 ]; then
                echo -e "  ${YELLOW}⚠️ Possibly unused import: $imported_name in $file${NC}"
            fi
        fi
    done
done
echo ""

# 4. Verify tests
echo -e "${YELLOW}📋 Step 4: Verifying tests...${NC}"
TEST_PATH=$(find "$MODULE_PATH" -type d -name "tests" -o -name "__tests__" 2>/dev/null | head -1)
if [ -n "$TEST_PATH" ]; then
    echo -e "  ${GREEN}✅ Tests found at: $TEST_PATH${NC}"
else
    echo -e "  ${YELLOW}⚠️ No tests found for module #121${NC}"
fi
echo ""

echo -e "${GREEN}✅ Audit complete!${NC}"
