mkdir -p bin
g++ src/main.cpp src/polycubeSystem.cpp -o bin/polycubes
g++ src/randRule.cpp -o bin/randRule
echo "Done! If successful, you will find the binaries in ./bin"
