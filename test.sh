#!/bin/bash

# Test script for RO-Crate Visualizer
# This script tests the CLI with sample data from the workspace

echo "🧪 Testing RO-Crate Visualizer..."
echo ""

# Test 1: Lameta Fishing Sample
echo "Test 1: Processing lameta-fishing sample..."
yarn cli ../../../../ro-crate-validation/lameta-fishing/ro-crate-metadata.json
echo ""

# Test 2: Farms to Freeways Sample (if you want to test multiple files)
# echo "Test 2: Processing farmstofreeways sample..."
# yarn cli ../../../../ro-crate-validation/farmstofreeways/ro-crate-metadata.json
# echo ""

echo "✅ Test completed!"
echo "Output saved to: .rocrate-viz/visualization.html"
