# C++ implementation of polycubes
The Eigen and HDF5 libraries are required to compile the C++ binary. The python binding requires Eigen and the pybind library.

## Install dependencies:
```bash
conda install -c conda-forge pybind11 eigen

wget https://www.hdfql.com/releases/2.3.0/HDFql-2.3.0_Linux64_GCC-4.9.zip
unzip HDFql-2.3.0_Linux64_GCC-4.9.zip
mv hdfql-2.3.0 ~
```

The cmake specification at `cpp/src/CMakeLists.txt` is configured to search for HDFql at the path`\textasciitilde/hdfql-2.3.0`, so make sure to update the file if you install another version of HDFql or if it is installed at another path.

## Build C++ binary

```bash
mkdir build && cd build
cmake -DCMAKE_C_COMPILER=gcc -DCMAKE_CXX_COMPILER=g++ ..
make
```

You should find the binary in the root of this directory (`./cpp/)

Run `./polycubes --help` for more info on the binary

## Build python binding
```bash
cd solve/py
bash build_polycube_pybind.sh
```

In Python, you can then import and use the polycube library, for example:
```python
import libpolycubes as pl

coords = pl.getCoords('040087000000')
print(coords)

print(pl.assembleRatio(
  coords, '040087000000',
  torsion=False,
  nTries=5000
))
```
