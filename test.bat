@echo off
REM Test script for RO-Crate Visualizer
REM This script tests the CLI with sample data from the workspace

echo Testing RO-Crate Visualizer...
echo.

echo Test 1: Processing lameta-fishing sample...
call yarn cli ..\..\..\..\ro-crate-validation\lameta-fishing\ro-crate-metadata.json
echo.

echo Test completed!
echo Output saved to: .rocrate-viz\visualization.html
