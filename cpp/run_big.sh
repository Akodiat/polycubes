#echo "Clearing out"
#./clear.sh
echo "Re-building binaries"
./build.sh
echo "Run"
nohup ./run.sh 1e8 > /dev/null &
