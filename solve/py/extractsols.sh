for f in */*.out; do
    echo "$f $(tail -n 7 $f | head -n 1)"
done

