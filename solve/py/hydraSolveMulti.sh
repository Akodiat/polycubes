if [[ $# -lt 1 ]]; then
    echo "Please provide a path to a shape specification"
    exit 2
fi

n=$(basename "$1" .json)

mkdir -p $n

read -r maxNT maxNC <<< $(python -c "
import json;
import utils;
with open('$1', 'r') as f:
    data = f.read();
solveSpec = json.loads(data);
maxNT, maxNC = utils.countParticlesAndBindings(solveSpec['bindings'])
print(maxNT, maxNC)
") 

echo "Max number of cube types is $maxNT"
echo "Max number of colors is $maxNC"

for f in $(python -c "import solve; [print('{}:{}'.format(nt,nc)) for nt, nc in solve.smartEnumerate($maxNT, $maxNC)]"); do
    IFS=':' read -r nC nT <<< "$f"

    echo "Scheduling $n with $nT cube types and $nC colors"

    # Pad with zeroes to make sure things are sorted correctly
    printf -v paddedNT "%0$(echo -n $maxNT | wc -m)d" $nT
    printf -v paddedNC "%0$(echo -n $maxNC | wc -m)d" $nC

    addqueue -s -g $n -o "$n/${paddedNT}t_${paddedNC}c-%j.out" -c "SAT $n ${nT}t ${nC}c-" -n 1 -m 1 /users/joakim/miniconda3/bin/python solve.py "$1 $nT $nC" 
done
