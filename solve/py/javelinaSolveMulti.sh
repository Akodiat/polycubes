#!/bin/bash

echo "devices ", $CUDA_VISIBLE_DEVICES

if [[ $# -lt 1 ]]; then
    echo "Please provide a path to a shape specification"
    exit 2
fi

n=$(basename "$1" .json)

mkdir -p $n

#SBATCH --job-name="solve_$n"      # Name of the job in the queue
#SBATCH --error="$n/slurm.%j.err"      # Name of stderr file
#SBATCH --output="$n/slurm.%j.out"     # Name of the stdout file
#SBATCH -p run
#SBATCH --gres=gpu:0                 # Number of GPUs
#SBATCH --ntasks-per-node=1      # Number of CPUs
#SBATCH -t 6-00:00:00              # max wall time is 48 hours
#SBATCH --mem 50000

read -r maxNT maxNC <<< $(python -c "
import json;
import utils;
with open('$1', 'r') as f:
    data = f.read();
solveSpec = json.loads(data);
maxNT, maxNC = utils.countParticlesAndBindings(solveSpec['bindings'])
print(maxNT, maxNC)
") 

if [[ $# -eq 3 ]]; then
    echo "Using custom limits"
    echo "Limiting species to max $2"
    echo "Limiting colors to max $3"
    maxNT=$(($maxNT<$2?$maxNT:$2))
    maxNC=$(($maxNC<$3?$maxNC:$3))
fi


echo "Max number of cube types is $maxNT"
echo "Max number of colors is $maxNC"

max_jobs=1
declare -A cur_jobs=( ) # build an associative array w/ PIDs of jobs we started

for f in $(python -c "import solve; [print('{}:{}'.format(nt,nc)) for nt, nc in solve.smartEnumerate($maxNT, $maxNC)]"); do
    if (( ${#cur_jobs[@]} >= max_jobs )); then
        wait -n # wait for at least one job to exit
	# ...and then remove any jobs that aren't running from the table
	for pid in "${!cur_jobs[@]}"; do
	    kill -0 "$pid" 2>/dev/null && unset cur_jobs[$pid]
	done
    fi

    IFS=':' read -r nT nC <<< "$f"

    echo "Scheduling $n with $nT cube types and $nC colors"

    # Pad with zeroes to make sure things are sorted correctly
    printf -v paddedNT "%0$(echo -n $maxNT | wc -m)d" $nT
    printf -v paddedNC "%0$(echo -n $maxNC | wc -m)d" $nC

    # nohup python solve.py $1 $nT $nC > "$n/${paddedNT}t_${paddedNC}c.out" &
    python solve.py $1 $nT $nC > "$n/${paddedNT}t_${paddedNC}c.out" & cur_jobs[$!]=1

done
