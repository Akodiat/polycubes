# Polycubes

Try out the browser version of the stochastic assembler at https://akodiat.github.io/polycubes/
There is also a c++ implementation, found in the cpp directory.

If you use this code, please cite the following paper:
Bohlin, J., Turberfield, A. J., Louis, A. A., & Sulc, P. (2023). Designing the self-assembly of arbitrary shapes using minimal complexity building blocks. ACS nano, 17(6), 5387-5398. https://pubs.acs.org/doi/full/10.1021/acsnano.2c09677
As well as my thesis:
Bohlin, J. (2022). Design and modular self-assembly of nanostructures (Doctoral dissertation, University of Oxford). https://ora.ox.ac.uk/objects/uuid:5dc4bc2a-fa46-4615-b0a1-8ac2ddc6f9ab.
Appendix A in the thesis contains further information about this codebase.

## Stochastic assembler
The stochastic assembly code is implemented in both C++ (for efficiency) and JavaScript (for interactivity and visualisation). The C++ implementation also has a python binding to make it easier to interface with. 

The C++ code is found in [the `./cpp/` directory](https://github.com/Akodiat/polycubes/tree/master/cpp), where you can also find build instructions. The resulting binary is mainly used to randomly sample polycube rules and save the resulting shapes HDF5 files. The python binding can be used more freely to get the assembled coordinates and check for determinism. Python scripts and notebooks to analyse and visualise the result can be found in the [the `./py /` directory](https://github.com/Akodiat/polycubes/tree/master/py)

The JavaScript code is found in [the `./js/` directory](https://github.com/Akodiat/polycubes/tree/master/js), with the `index.html` file located at the root of the repository. You can try out the live code at https://akodiat.github.io/polycubes/. Specific assembly rules (in hexadecimal or decimal representation) can be linked using URL arguments, for example: https://akodiat.github.io/polycubes/?hexRule=00040008000c840088008c00.

## SAT solver
The repository also includes the tools to solve the inverse design problem, finding the minimal amount of species and colours required to reliably assemble a given polycube shape. These tools are found in [the `./solve/` directory](https://github.com/Akodiat/polycubes/tree/master/solve).

The JavaScript tool (found in [`./solve/js`](https://github.com/Akodiat/polycubes/tree/master/solve/js)) can be used to design the shape specification used as input for the SAT solver. Use the interface at https://akodiat.github.io/polycubes/solve/ to draw a polycube shape, clicking the cube faces to add cubes and shift-clicking to remove them. Small shapes can then be solved directly in the browser by clicking the `solve` button, while larger shapes need to use the Python implementation.

The Python tools are found in [the `./solve/py` directory](https://github.com/Akodiat/polycubes/tree/master/solve/py) directory. Type `python solve.py ../shapes/scaling/cube4.json 6 9` to solve the 4*4*4 solid cube shape for six species and nice colours.

A set of example shape specifications can be found in the  [`./solve/shapes`](https://github.com/Akodiat/polycubes/tree/master/solve/shapes) directory. 
