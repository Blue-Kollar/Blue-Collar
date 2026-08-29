#!/bin/bash
# Static dead-code analysis for module #121

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

MODULE_PATH="${1:-.}"

echo -e "${BLUE}🔍 Running dead-code analysis on: $MODULE_PATH${NC}"
echo ""

# Check for TypeScript/JavaScript dead code
if command -v npx &> /dev/null; then
    echo -e "${YELLOW}📋 Running TypeScript dead-code analysis...${NC}"
    
    # Run typescript-eslint with no-unused-vars
    npx eslint "$MODULE_PATH" --ext .ts,.tsx,.js,.jsx --rule 'no-unused-vars: error' --rule '@typescript-eslint/no-unused-vars: error' 2>/dev/null || true
    
    # Check for unused exports
    echo -e "${YELLOW}📋 Checking for unused exports...${NC}"
    find "$MODULE_PATH" -name "*.ts" -o -name "*.tsx" | while read -r file; do
        grep -E "^export (const|function|class|interface|type)" "$file" 2>/dev/null | while read -r line; do
            name=$(echo "$line" | sed -E 's/export (const|function|class|interface|type) ([a-zA-Z_][a-zA-Z0-9_]*)/\2/')
            if [ -n "$name" ]; then
                # Check if exported symbol is used elsewhere
                usage_count=$(grep -r "$name" "$MODULE_PATH" --include="*.ts" --include="*.tsx" --include="*.js" --include="*.jsx" 2>/dev/null | grep -v "$file" | wc -l)
                if [ "$usage_count" -eq 0 ]; then
                    echo -e "  ${YELLOW}⚠️ Possibly unused export: $name in $file${NC}"
                fi
            fi
        done
    done
fi

# Check for Rust dead code
if command -v cargo &> /dev/null; then
    echo -e "${YELLOW}📋 Running Rust dead-code analysis...${NC}"
    cd "$MODULE_PATH" 2>/dev/null || cd .
    cargo check --all-features --message-format=json 2>/dev/null | grep -A 5 "unused" || true
    cd - > /dev/null 2>&1
fi

# Check for duplicated helper functions
echo -e "${YELLOW}📋 Checking for duplicated helpers...${NC}"
find "$MODULE_PATH" -type f \( -name "*.ts" -o -name "*.rs" -o -name "*.js" \) | while read -r file; do
    # Look for common helper function patterns
    grep -E "function (format|validate|parse|convert|transform|process|handle|generate|create|get|set|update)" "$file" 2>/dev/null | while read -r line; do
        func_name=$(echo "$line" | sed -E 's/function ([a-zA-Z_][a-zA-Z0-9_]*).*/\1/')
        if [ -n "$func_name" ]; then
            # Check if function appears in multiple files
            count=$(find "$MODULE_PATH" -type f \( -name "*.ts" -o -name "*.rs" -o -name "*.js" \) -exec grep -l "$func_name" {} \; 2>/dev/null | wc -l)
            if [ "$count" -gt 1 ]; then
                echo -e "  ${YELLOW}⚠️ Helper $func_name found in $count files${NC}"
            fi
        fi
    done
done

echo -e "${GREEN}✅ Dead-code analysis complete!${NC}"
