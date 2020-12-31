set -e

slurm=false

if [ "$#" -ne 1 ]; then
    echo "Please provide a path to an out directory"
    exit
fi

echo "Merging config and result files into $$.result and $$.conf"
python $(dirname "$0")/../py/mergeConfigs.py "$1" $$
echo "Done"

for f in "$1"/*-mers; do
    echo "Starting merge of $f"
    if [ "$slurm" = true ]; then
        addqueue -s -c "Merge $f 2 hours" -o "merge-%j.out" -n 1 -m 8 /usr/bin/python3 $(dirname "$0")/../py/mergeOutput.py "$f" $$
    else
        python $(dirname "$0")/../py/mergeOutput.py "$f" $$ &
    fi
done

wait

echo "Done"
