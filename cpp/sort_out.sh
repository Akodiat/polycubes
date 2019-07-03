set -e

cd out
# Move all unbounded, nondeterministic and monomer
# rules to a single file. We don't need to save
# coordinates for them
find *.oub* -delete -print >> oub 2>/dev/null | true 
find *.nondet -delete -print >> nondet 2>/dev/null | true
find *.1-mer -delete -print >> 1-mer 2>/dev/null | true

# Move all polymers to their own directories
regex="[0-f]+\.([0-9]+-mer)"
for f in *.*-mer; do
  if [[ $f =~ $regex ]]; then
    nmer="${BASH_REMATCH[1]}"
    mkdir -p $nmer
    mv $f $nmer
  fi
done 
cd ..

echo "Done"
