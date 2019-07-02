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

echo "Generating list of rules"
#../bin/randRule $N_TIMES $MAX_N_COLORS $MAX_N_RULES > ../randRules.txt
genRules() {
  ../bin/randRule $N_TIMES $MAX_N_COLORS $MAX_N_RULES
}
echo "Evaluating rules"

genRules | parallel -X ../bin/polycubes {} &> /dev/null

cd ..
