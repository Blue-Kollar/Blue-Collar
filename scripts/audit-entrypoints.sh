#!/bin/bash
# Audit contract entrypoints for reentrancy and authorization checks

set -e

GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m'

echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}  Contract Entrypoint Security Audit${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
echo ""

# Find all contract directories
CONTRACT_DIRS=$(find packages/contracts/contracts -maxdepth 1 -type d 2>/dev/null | tail -n +2)

if [ -z "$CONTRACT_DIRS" ]; then
    echo -e "${RED}❌ No contract directories found${NC}"
    exit 1
fi

echo -e "${GREEN}✅ Found contract directories:${NC}"
for dir in $CONTRACT_DIRS; do
    echo "  - $(basename "$dir")"
done
echo ""

# Audit each contract
for contract_dir in $CONTRACT_DIRS; do
    contract_name=$(basename "$contract_dir")
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo -e "${BLUE}  Auditing: $contract_name${NC}"
    echo -e "${BLUE}═══════════════════════════════════════════════════════════════${NC}"
    echo ""
    
    # Find the lib.rs file
    lib_file="$contract_dir/src/lib.rs"
    if [ ! -f "$lib_file" ]; then
        echo -e "${YELLOW}⚠️ No lib.rs found for $contract_name${NC}"
        echo ""
        continue
    fi
    
    echo -e "${YELLOW}📋 Finding public entrypoints...${NC}"
    
    # Find all public functions (entrypoints)
    grep -n "pub fn" "$lib_file" 2>/dev/null | while read -r line; do
        func_name=$(echo "$line" | sed -E 's/.*pub fn ([a-zA-Z_][a-zA-Z0-9_]*).*/\1/')
        line_num=$(echo "$line" | cut -d: -f1)
        
        echo -e "  ${BLUE}Found entrypoint: $func_name (line $line_num)${NC}"
        
        # Check for require_auth
        if grep -A 20 "pub fn $func_name" "$lib_file" | grep -q "require_auth"; then
            echo -e "    ${GREEN}✅ require_auth found${NC}"
        else
            echo -e "    ${RED}❌ require_auth NOT found${NC}"
        fi
        
        # Check for checks-effects-interactions pattern
        # Look for state mutations before external calls
        if grep -A 30 "pub fn $func_name" "$lib_file" | grep -q "storage.*set\|storage.*put" | head -10; then
            echo -e "    ${GREEN}✅ State mutations present${NC}"
        else
            echo -e "    ${YELLOW}⚠️ No state mutations detected${NC}"
        fi
        
        # Check for external calls
        if grep -A 40 "pub fn $func_name" "$lib_file" | grep -q "env.invoke\|client\|transfer"; then
            echo -e "    ${YELLOW}⚠️ External calls detected - check ordering${NC}"
        fi
    done
    
    echo ""
done

echo -e "${GREEN}✅ Audit complete!${NC}"
