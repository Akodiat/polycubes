# Convenience script to build python binding
mkdir build && cd build
cmake CMAKE_C_COMPILER=gcc -D CMAKE_CXX_COMPILER=g++ ../../cpp/src/pythonBinding
make
cp *.so ..
cd ..
rm -rf build
