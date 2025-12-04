#!/bin/bash
# Script to reprocess all error documents

echo "Fetching error documents..."
ERROR_IDS=$(curl -s http://localhost:5005/api/documents | python3 -c "
import sys, json
docs = json.load(sys.stdin)
error_docs = [d['_id'] for d in docs if d.get('status') == 'error']
for doc_id in error_docs:
    print(doc_id)
")

if [ -z "$ERROR_IDS" ]; then
    echo "No error documents found!"
    exit 0
fi

echo "Reprocessing error documents..."
count=0
for doc_id in $ERROR_IDS; do
    echo "  Retrying document: $doc_id"
    curl -s -X POST "http://localhost:5005/api/documents/$doc_id/retry" > /dev/null
    count=$((count + 1))
    sleep 0.5
done

echo ""
echo "✅ Queued $count documents for reprocessing!"
echo "Documents will be processed in the background. Refresh the page in a few seconds."
