mkdir -p out
cd out

if [ -z "$1" ]; then
    echo "Running once"
    N_TIMES=1
else
    N_TIMES=$1
fi

echo "Running $N_TIMES times"
for i in $(seq $N_TIMES); do
    RULE=$(../bin/randRule)
    ../bin/polycubes $RULE &> /dev/null &
done

cd ..
