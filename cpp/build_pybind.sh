c++ -O3 -Wall -shared -std=c++11 -fPIC `python3 -m pybind11 --includes` src/polycubeSystem.cpp src/utils.cpp src/pybind.cpp -o ../py/polycubes`python3-config --extension-suffix`
