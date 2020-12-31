set -e

slurm=false

if [ "$#" -ne 1 ]; then
    echo "Please provide a path to an out directory"
    exit
fi

for f in "$1"/*-mers/pheno_*; do
    echo "Starting analysis of $f"
    if [ "$slurm" = true ]; then
        b=$(basename $f)
        addqueue -s -c "Analyse $f 2 hours" -o "analyse-%j-$b.out" -n 1 -m 8 /usr/bin/python3 $(dirname "$0")/../py/analysePhenotype.py "$f"
    else
        python $(dirname "$0")/../py/analysePhenotype.py "$f" &
    fi
done

wait

echo "Done"