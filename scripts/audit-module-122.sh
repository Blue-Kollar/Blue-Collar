#!/bin/bash
# Audit module #122 for unused code and duplicated helpers

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Module #122 Audit - Unused Code & Duplicated Helpers${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Find the module
MODULE_PATH="./packages/module-122"
if [ ! -d "$MODULE_PATH" ]; then
    MODULE_PATH="./src/modules/122"
fi
if [ ! -d "$MODULE_PATH" ]; then
    MODULE_PATH="./modules/122"
fi
if [ ! -d "$MODULE_PATH" ]; then
    echo -e "${RED}❌ Module #122 not found${NC}"
    echo "Searching for module 122..."
    find . -type d -name "*122*" 2>/dev/null
    exit 1
fi

echo -e "${GREEN}✅ Found module at: $MODULE_PATH${NC}"
echo ""

# 1. Find unused code
echo -e "${YELLOW}📋 Step 1: Finding unused code...${NC}"

# Check TypeScript/JavaScript files
find "$MODULE_PATH" -type f \( -name "*.ts" -o -name "*.tsx" -o -name "*.js" -o -name "*.jsx" \) | while read -r file; do
    # Check for unused exports
    grep -E "^export (const|function|class|interface|type)" "$file" 2>/dev/null | while read -r line; do
        name=$(echo "$line" | sed -E 's/export (const|function|class|interface|type) ([a-zA-Z_][a-zA-Z0-9_]*)/\2/')
        if [ -n "$name" ]; then
            usage_count=$(grep -r "$name" "$MODULE_PATH" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null | grep -v "$file" | wc -l)
            if [ "$usage_count" -eq 0 ]; then
                echo -e "  ${YELLOW}⚠️ Possibly unused export: $name in $file${NC}"
            fi
        fi
    done
done

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
    grep -E "^import" "$file" 2>/dev/null | while read -r import_line; do
        imported_name=$(echo "$import_line" | sed -E 's/import \{ ([^}]+) \}.*/\1/' | sed -E 's/import ([a-zA-Z_][a-zA-Z0-9_]*).*/\1/')
        if [ -n "$imported_name" ]; then
            usage_count=$(grep -v "^import" "$file" | grep -c "$imported_name" 2>/dev/null || echo 0)
            if [ "$usage_count" -eq 0 ]; then
                echo -e "  ${YELLOW}⚠️ Possibly unused import: $imported_name in $file${NC}"
            fi
        fi
    done
done
echo ""

# 4. Find unused variables
echo -e "${YELLOW}📋 Step 4: Checking for unused variables...${NC}"
find "$MODULE_PATH" -name "*.ts" -o -name "*.tsx" | while read -r file; do
    grep -E "(const|let|var) [a-zA-Z_][a-zA-Z0-9_]*" "$file" 2>/dev/null | while read -r line; do
        var_name=$(echo "$line" | sed -E 's/(const|let|var) ([a-zA-Z_][a-zA-Z0-9_]*).*/\2/')
        if [ -n "$var_name" ] && [ "$var_name" != "_" ]; then
            usage_count=$(grep -v "^[[:space:]]*\(const\|let\|var\)" "$file" | grep -c "$var_name" 2>/dev/null || echo 0)
            if [ "$usage_count" -eq 0 ]; then
                echo -e "  ${YELLOW}⚠️ Possibly unused variable: $var_name in $file${NC}"
            fi
        fi
    done
done
echo ""

# 5. Verify tests
echo -e "${YELLOW}📋 Step 5: Verifying tests...${NC}"
TEST_PATH=$(find "$MODULE_PATH" -type d -name "tests" -o -name "__tests__" 2>/dev/null | head -1)
if [ -n "$TEST_PATH" ]; then
    echo -e "  ${GREEN}✅ Tests found at: $TEST_PATH${NC}"
    # Count tests
    TEST_COUNT=$(find "$TEST_PATH" -name "*.test.ts" -o -name "*.spec.ts" 2>/dev/null | wc -l)
    echo -e "  ${GREEN}✅ Found $TEST_COUNT test file(s)${NC}"
else
    echo -e "  ${YELLOW}⚠️ No tests found for module #122${NC}"
fi
echo ""

echo -e "${GREEN}✅ Audit complete!${NC}"
