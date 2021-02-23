# C++ implementation of polycubes

## Dependencies
You need Eigen and HDF5 installed to build

## Build
Build the polycube binary with cmake:

mkdir build && cd build
cmake ..
make

You should find the binary in the root of this directory (cpp)

Run ./polycubes --help for more info

To build python bindings, call `./build_pybind.sh` and make sure you have the pybind python module installed.

