@echo off
REM Test script for the enhanced analyzer with code metrics

echo Testing enhanced analyzer with code metrics...

node scripts/enhanced-analyzer-with-metrics.js --modules=structure,quality --output=analysis-output

echo Test complete. Check the analysis-output directory for results.
