set -e

polymer="[0-f]+\.([0-9]+-mer)"
oub="[0-f]+\.(oub[0-9]+)"
nondet="[0-f]+\.(nondet)"
monomer="[0-f]+\.(1-mer)"

# Move all unbounded, nondeterministic and monomer
# rules to a single files. We don't need to save
# coordinates for them.
sortToFile () {
  for f in *; do
    if [[ $f =~ $1 ]]; then
      match="${BASH_REMATCH[1]}"
      echo $f >> $match
      #echo "Writing $f to $match"
      rm $f
    fi
  done
  echo "Filesort $1 done"
}

sortToDir () {
  for f in *; do
    # Move all polymers to their own directories.
    if [[ $f =~ $polymer ]]; then
      match="${BASH_REMATCH[1]}"
      if [ "$match" != "1-mer" ]; then
        mkdir -p $match
        mv $f $match
        #echo "Moving $f to $match"
      fi
    fi
  done
  echo "Dirsort $1 done"
}

cd out

sortToFile $monomer &
sortToFile $oub &
sortToFile $nondet &
sortToDir $polymer &

cd ..

