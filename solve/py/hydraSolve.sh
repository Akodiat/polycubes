for f in ../shapes/*.json; do
    n=$(basename "$f")
    addqueue  -s -o "$n-%j.out" -c "Sat solve $n" -n 1x8 -m 1 /users/joakim/miniconda3/bin/python solve.py "$f"
done
