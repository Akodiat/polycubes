rootdir="*"

if [[ $# -ge 1 ]]; then
    rootdir=$1
fi

for f in $rootdir/*.out; do
    echo "$f $(tail -n 7 $f | head -n 1)"
done

