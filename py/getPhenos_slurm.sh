for f in "$1"/nmers/*-mers_*.p; do
    n=$(basename "$f")
    addqueue -o "$n-%j.out" -c "Find phenos $n" -n 1 -m 6 /usr/bin/python3 $(dirname "$0")/getPhenosForNMer.py "$f"
done
