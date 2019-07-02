MAX_N_COLORS=4
MAX_N_RULES=5

mkdir -p out
cd out

if [ -z "$1" ]; then
    N_TIMES=1
    echo "Running once"
else
    N_TIMES=$1
    echo "Running $N_TIMES times"
fi

for i in $(seq $N_TIMES); do
    RULE=$(../bin/randRule 1 $MAX_N_COLORS $MAX_N_RULES)
    ../bin/polycubes $RULE &> /dev/null &
done

cd ..
