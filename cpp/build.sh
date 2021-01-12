mkdir -p bin
g++ src/main.cpp src/polycubeSystem.cpp src/utils.cpp src/phenotypes.pb.cc -lprotobuf -o bin/polycubes
echo "Done! If successful, you will find the binaries in ./bin"
