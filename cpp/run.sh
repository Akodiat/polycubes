mkdir -p out
cd out
rule=$(../bin/randRule)
../bin/polycubes $rule &> /dev/null
echo $?
cd ..
