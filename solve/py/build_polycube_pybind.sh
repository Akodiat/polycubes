# Convenience script to build python binding
mkdir build && cd build
cmake ../../../cpp/src/pythonBinding
make
cp *.so ..
cd ..
rm -rf build