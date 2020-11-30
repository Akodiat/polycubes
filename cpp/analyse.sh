slurm=false

for f in "$1"/*-mers; do
    echo "Starting merge of $f"
    if [ "$slurm" = true ] ; then
        addqueue -s -q "bigmem" -c "Analyse $f 2 hours" -o "sortNMers_%j.out" -n 1 -m 128 /usr/bin/python3 $(dirname "$0")/../py/mergeOutput.py "$f"
    else
        python $(dirname "$0")/../py/mergeOutput.py "$f" &
    fi
done

wait

echo "Done"