for f in "$1"/nmers/*-mers_*.p; do
    python $(dirname "$0")/getPhenosForNMer.py "$f" &
done

wait

echo "Done"
