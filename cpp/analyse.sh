slurm=true

for f in "$1"/*-mers; do
    echo "Starting merge of $f"
    if [ "$slurm" = true ] ; then
        addqueue -s -c "Analyse $f 2 hours" -o "sort-%j.out" -n 1 -m 8 /usr/bin/python3 $(dirname "$0")/../py/mergeOutput.py "$f"
    else
        python $(dirname "$0")/../py/mergeOutput.py "$f" &
    fi
done

wait

echo "Done"
