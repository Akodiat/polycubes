Polycube SAT solver

Install dependencies:
  conda install -c conda-forge pybind11 eigen
  bash build_polycube_pybind.sh
  python -m pip install 'python-sat[pblib,aiger]'

Run the solver for a specified shape, number of species, and number of colours:
  python solve.py ../shapes/tripod.json 2 1

Run the solver for a specified shape, trying all species and colour combinations
  bash solveMulti.sh ../shapes/cube.json
The output will be saved to a directory with the shape name